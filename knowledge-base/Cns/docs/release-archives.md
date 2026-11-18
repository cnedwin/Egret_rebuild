# 发行归档

[English](../../en/docs/release-archives.md) | 简体中文

仓库里的包是私有的，版本为 0.0.0。一次发行是由它们打出的一组归档，每个包一个，附在 GitHub release 上。不向 npm 发布任何内容。

## 运行与修改入门示例

1. 从 [preview.1 发行页](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) 下载 `egret-first-game.zip`，解压到新目录。`package.json` 已指定本次发行的引擎归档和 esbuild 0.28.2。
2. 使用 Node.js 26.7.0 和 npm，运行 `npm install`，再运行 `npm start`。打开 `http://127.0.0.1:8000`，点击橙色方块或按空格，每次移动 32 个舞台单位。
3. 将 `main.mjs` 中的 `STEP` 从 `32` 改为 `64`，保存并刷新。方块每次移动的距离变为两倍。在终端按 Ctrl+C 可停止本地服务器。

## 安装一个发行版

```
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v<版本>/egret-engine-<版本>.tgz
```

- 装引擎只需要这一个地址：它的归档用同一发行版中各归档的地址来指明 `@egret/contracts` 和 `@egret/runtime`，npm 会自动取回。
- `@egret/project` 和 `@egret/spine` 用同样的方式安装，文件名是 `egret-project-<版本>.tgz` 和 `egret-spine-<版本>.tgz`。
- 与归档一起附上的 `release.json` 给出每个归档的名字、大小和 SHA-256。
- pnpm 和 yarn 可以从同样的地址安装。

## 归档里有什么

- 构建出的 `dist` 目录，不含 source map；包的两份 README；仓库的 `LICENSE` 和 `NOTICE`。
- 一份清单，与仓库里的清单有四处不同：版本是发行版本；不是私有包；列出上面这些文件；对本工作区其他包的每个依赖都写成该包归档的地址。
- 入口、私有导入名和第三方依赖与仓库中相同。

## 制作一个发行版

1. 选定版本：三个数字，预览版再加连字符和名字，例如 `0.1.0-preview.1`。
2. 在要发行的提交上推送标签 `v<版本>`。
3. `Release archives` 工作流会构建、打包、把归档装进干净工程并在那里导入，然后把它们附到该标签的 GitHub release 上。带连字符的版本标为预发行。

只打归档而不发行：

```
node tools/build.mjs
node tools/pack-release.mjs --version 0.1.0-preview.1 --out ../release
node tools/verify-release.mjs --version 0.1.0-preview.1 --archives ../release
```

`verify-release` 会另打一组以文件地址互相指明的归档，用 npm 安装它们，并与给定的那一组逐个文件比较：只有清单可以不同。它需要网络来取得 `robust-predicates`、`jsonc-parser` 和 `@esotericsoftware/spine-core`。

## 已经检查的

- `tests/pack-release.test.mjs`：版本与地址、清单、拒绝的情况，以及全部五个归档的内容。
- 在 Linux 上用 Node 26.7.0 和 npm，把 `0.1.0-preview.1` 的归档装进仓库外的干净工程，并在那里导入了 `@egret/engine`、`@egret/engine/web/game`、`@egret/project` 和 `@egret/spine`。

发布前演练在 Windows 干净目录从本地归档安装引擎。无头 Edge 157 绘制了方块，点击后移动 32 个舞台单位，修改并刷新后按空格移动 64 个单位。归档安装演练使用 npm。独立新人、呈现时延和其他包管理器另行验收。[交付进度](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) 对应主干提交 `51b12255`。七个公开下载文件均通过 GitHub SHA-256 核对。全新的 npm 工程从发行地址安装了示例使用的引擎、运行时和契约包。另一个工程导入了工程和 Spine 入口，五个白鹭包的安装文件均与公开归档一致。Windows Edge 与 Galaxy Z Fold7 Chrome 用相同的游戏包分别通过 WebGPU 和 WebGL2 渲染。将 `STEP` 从 32 改为 64 后，两台设备上观察到的移动距离均翻倍。[交付记录](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) 列出了包体大小，以及从页面导航到观察到画面移动的耗时，其中包含自动输入和像素采集。独立新人走查和网络启动预算仍待验收。

## 限制

- 标签一经使用，对应的发行版就不能再改：请另出一个版本。
- 地址比包名长，也不能写版本范围。发布到注册表可以同时解决这两点，但那是关于 npm 上 `@egret` 名字的决定，尚未作出。
- `@egret/spine` 需要 `@esotericsoftware/spine-core` 4.3.13，它有自己的许可证，见该包的 README。
