# 在干净工程中使用预览版

[English](../../en/docs/clean-consumer.md) | 简体中文

本页说明仓库之外的工程今天使用默认引擎时会拿到什么、这件事如何检查，以及哪些项目仍然开放。本页属于 [#93](https://github.com/cnedwin/Egret_rebuild/issues/93)。

## 分发物是什么

工作区的包是版本 0.0.0 的私有包，没有发布到任何注册表。目前可以交付的分发物是三个归档，由固定版本的 pnpm 从已构建的仓库打包：

| 归档 | 作用 | 消费者是否声明 |
| --- | --- | --- |
| `egret-contracts-0.0.0.tgz` | 共享契约 | 否，写在 overrides 里 |
| `egret-runtime-0.0.0.tgz` | Runtime | 否，写在 overrides 里 |
| `egret-engine-0.0.0.tgz` | `@egret/engine` 及其 23 个入口 | 是，唯一的依赖 |

引擎要求另外两个包的 0.0.0 版本。注册表里没有它们，所以消费者在自己的 `pnpm-workspace.yaml` 的 `overrides` 下写明这两个归档。pnpm 11 只从这个文件读取 overrides。

`@egret/spine` 和 `@egret/project` 是独立的包，各有自己的第三方依赖。它们不在这条路线内，检查会确认它们没有被安装。

## 运行检查

按[入门指南](getting-started.md)准备好仓库，然后给出仓库之外的一个新目录：

```text
pnpm setup:dev
pnpm exec node tools/verify-clean-consumer.mjs <仓库之外的新目录的绝对路径>
```

加上 `--offline` 时，`robust-predicates` 取自仓库里已安装的副本，安装过程不访问注册表。运行会在该目录写入 `archives/`、`consumer/` 和 `report.json`，并打印报告。有一行未通过时退出码为 1。[工具源码](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/verify-clean-consumer.mjs)

| 行 | 通过的条件 |
| --- | --- |
| `archives` | 每个归档包含该包声明的全部模块和类型文件、许可证文本，依赖写成版本号。 |
| `install` | 新工程里 `pnpm install --ignore-scripts` 成功。安装了四个包，可选包一个也没有。 |
| `entries` | `@egret/engine` 的 23 个入口都解析到消费者内部的声明文件，类型文件存在，并且能在 Node 中加载。 |
| `separation` | 非 Web 入口不加载 Web 模块。非 3D 入口不加载 3D 模块。只有 `webgl2` 和 `webgpu` 加载 `robust-predicates`。没有任何模块来自消费者之外。 |
| `examples` | 公开示例逐字节复制到消费者后可以运行，输出与在仓库里运行时相同。 |
| `types` | 使用默认入口和 `@egret/engine/layout` 的严格 TypeScript 消费者能按已安装的类型编译，错误的调用仍然报错。 |
| `notices` | 每个已安装的包都带有许可证文件。 |

两个示例分别是默认入口的 [`examples/headless.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/headless.mjs)，和一个显式可选入口 `@egret/engine/layout` 的 [`examples/layout-headless.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/layout-headless.mjs)。

## 手动操作

```text
pnpm --dir packages/contracts pack --pack-destination <目录>/archives
pnpm --dir packages/runtime pack --pack-destination <目录>/archives
pnpm --dir packages/engine pack --pack-destination <目录>/archives
```

在 `<目录>/consumer` 中写入 `package.json`：

```json
{
  "name": "my-game",
  "private": true,
  "type": "module",
  "dependencies": { "@egret/engine": "file:../archives/egret-engine-0.0.0.tgz" }
}
```

以及 `pnpm-workspace.yaml`：

```yaml
packages: []
overrides:
  '@egret/contracts': file:../archives/egret-contracts-0.0.0.tgz
  '@egret/runtime': file:../archives/egret-runtime-0.0.0.tgz
```

然后运行 `pnpm install --ignore-scripts`，把 `examples/headless.mjs` 复制到该目录，用 `node headless.mjs` 运行。

## 支持矩阵

| 项目 | 支持范围 | 依据 |
| --- | --- | --- |
| Node | 26.7.0 | 其他版本会被工具拒绝。 |
| 包管理器 | pnpm 11.25.0 | 其他版本会被工具拒绝。 |
| 编译器 | TypeScript 7.0.2，`module` 和 `moduleResolution` 为 `NodeNext`，开启 `strict` | `types` 行。 |
| 模块格式 | 仅 ECMAScript 模块。这些包没有 CommonJS 入口。 | 声明的 exports。 |
| 操作系统 | Linux x64 和 Windows x64 | 离线路线由 [`tests/clean-consumer.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/clean-consumer.test.mjs) 运行，它属于持续集成的完整 Windows 测试集。Linux 的运行在开发容器中完成。 |
| 浏览器 | 尚未从消费者一侧确认 | 见开放项目。 |

按能在哪里工作划分的入口：

| 分组 | 入口 | 在消费者中做到的 |
| --- | --- | --- |
| 默认 | `@egret/engine` | 运行了示例，编译了类型 |
| 无头，可选 | `/layout` | 运行了示例，编译了类型 |
| 无头，可选 | `/text`、`/resources`、`/input`、`/ui`、`/ui/editing`、`/animation`、`/paragraph`、`/world3d` | 已解析并加载 |
| 浏览器，可选 | `/webgl2`、`/webgpu`、`/web/input`、`/web/pointer`、`/web/keyboard`、`/web/image`、`/web/text`、`/web/paragraph`、`/web/resources`、`/web/editing`、`/web/text-input`、`/webgl2/world3d`、`/webgpu/world3d` | 已在 Node 中解析并加载。没有在浏览器中运行。 |

每项能力做什么、在仓库里测试到什么程度，见[当前能力](core-progress.md)。

## 模块集合

在 Linux x64 的消费者中测得，归档来自 main [215aa9e](https://github.com/cnedwin/Egret_rebuild/commit/215aa9eda94cdf25db50cd00ec598d1afb81887e) 加上本次变更。一个集合是一次导入在 Node 中加载的全部模块，未经打包。gzip 是每个文件按 9 级压缩后求和。打包器会得出别的数字，每次运行的 `report.json` 含全部 23 行。

| 入口 | 模块数 | KiB | gzip 后 KiB | 第三方 |
| --- | ---: | ---: | ---: | --- |
| `@egret/engine` | 80 | 480 | 136 | 无 |
| `@egret/engine/layout` | 52 | 297 | 85 | 无 |
| `@egret/engine/webgl2` | 78 | 634 | 163 | robust-predicates |
| `@egret/engine/webgpu` | 81 | 653 | 167 | robust-predicates |
| `@egret/engine/world3d` | 47 | 861 | 238 | 无 |
| `@egret/engine/webgl2/world3d` | 96 | 1041 | 288 | 无 |
| `@egret/engine/webgpu/world3d` | 94 | 1029 | 286 | 无 |

contracts、runtime 和 engine 的归档分别为 61 KiB、334 KiB 和 1710 KiB。

## 第三方声明

| 包 | 许可证 | 文本位置 | 由谁加载 |
| --- | --- | --- | --- |
| `@egret/contracts`、`@egret/runtime`、`@egret/engine` | Apache-2.0 | 每个归档里的 `LICENSE` 和 `LICENSE.zh-CN.md` | 所有入口，其中 `/world3d` 只加载引擎自身 |
| `robust-predicates` 3.0.3 | Unlicense | 已安装包里的 `LICENSE`，以及 [third-party/robust-predicates-3.0.3.LICENSE](https://github.com/cnedwin/Egret_rebuild/blob/main/third-party/robust-predicates-3.0.3.LICENSE) | 仅 `/webgl2` 和 `/webgpu` |

仓库的 [NOTICE](https://github.com/cnedwin/Egret_rebuild/blob/main/NOTICE) 文件写明了同一个依赖，但它不在归档里。Spine 运行时和 `jsonc-parser` 属于可选包，这条路线不会安装它们。

## 首次可交互

首次可交互没有从消费者一侧测量。检查只在 Node 中加载模块，不打开页面，所以它不说明下载时间、启动或第一帧。现有的启动记录属于从仓库经本地回环提供的示例。[验收计划](m4-core-acceptance-plan.md)中 M1 和 M4 的目标仍需针对实际的产物、内容和网络条件测量。

## 迁移说明

早期检查点有而本分发物没有的入口：

| 已移除 | 改用 |
| --- | --- |
| `@egret/engine/web`，即 Canvas Host，连同 `captureFrame` 和 `captureTexturedFrame` | 共享帧，由 `@egret/engine/webgl2` 的 `createSharedWebGL2Host` 或 `@egret/engine/webgpu` 的 `createSharedWebGPUHost` 绘制。见[共享渲染档位](shared-render-profile-contract.md)。 |
| `@egret/engine/scene3d`、`/scene3d/authoring`、`/webgl2/scene3d`、`/webgpu/scene3d` | [World3D](world3d.md)：`@egret/engine/world3d` 搭配 `/webgl2/world3d` 或 `/webgpu/world3d`。这是另一套接口，不是改名。 |

与旧版 Egret API 的差异见[旧项目迁移](旧工程迁移.md)。这里没有任何内容能转换旧项目。

## 开放项目

- 这些包没有发布。没有运行过从注册表安装引擎，工具的注册表路线也没有在开发容器中运行，该容器没有网络。
- 三个包的清单没有 `license` 字段。许可证文本在每个归档里。
- 没有 `files` 列表收窄归档。源码、一个包内测试和编译器配置随构建产物一起分发。
- 没有从消费者打开过页面。两个后端都没有用已安装的副本绘制过，任何浏览器或手机上都没有。
- 没有测量首次可交互，也没有测量打包器下的包体积。
- 还没有新贡献者照着本页操作过。这项检查是自动演练，不能关闭该项。
- 最终交接仍依赖 [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) 和 [#92](https://github.com/cnedwin/Egret_rebuild/issues/92)。
