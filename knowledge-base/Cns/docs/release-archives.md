# 白鹭引擎 7.0 发行说明与安装

[English](../../en/docs/release-archives.md) | 简体中文

[白鹭引擎 7.0.2](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.2) 是 7.0 产品线的稳定发行版。浏览器 2D 和 3D 单文件、五个 JavaScript 包及可编辑示例从同一份源代码构建。

| 开发方式 | 下载 |
| --- | --- |
| 从可编辑的 2D 游戏开始 | [入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip) |
| 给已有网页加入引擎 | [浏览器文件与许可证](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip)。2D 可选 [`egret2d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret2d.js) 或 [`egret2d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret2d.mjs)，包含 World3D 的版本可选 [`egret3d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret3d.js) 或 [`egret3d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret3d.mjs)。 |
| 在现有 npm 工程中导入模块 | 运行 `npm install @egret/engine` 从 npm 注册表安装，或使用归档：[`@egret/engine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-engine-7.0.2.tgz)、[`@egret/contracts`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-contracts-7.0.2.tgz)、[`@egret/runtime`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-runtime-7.0.2.tgz)、[`@egret/project`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-project-7.0.2.tgz)、[`@egret/spine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-spine-7.0.2.tgz) |

[发行清单](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/release.json)记录源提交、文件大小及 SHA-256。下载浏览器单文件后，请放在游戏自己的站点或目录中提供给页面；分发游戏时一并保留浏览器归档里的许可声明。

此前的候选版 [7.0.1-rc.3](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3) 仍可下载，也可以用准确版本号从 npm 安装。

GitHub 在 2026 年 11 月 22 日核对时对两个更早版本的标签和发行下载返回 404。研究历史版本请使用 [7.0.1-rc.2 的源码](https://github.com/cnedwin/Egret_rebuild/tree/859bd0eecdc039ffc34e89c55d5de0986bafb67c)、[0.1.0-preview.1 的源码](https://github.com/cnedwin/Egret_rebuild/tree/51b122555503533a4064736e7cbad4934db70862) 和 [7.0.1-rc.1 浏览器构建记录](https://github.com/cnedwin/Egret_rebuild/pull/367)。

## 7.0.2 更新内容

- **浏览器 2D 与 Play。** WebGPU 相邻帧可以复用已提交的不可变图集。两个共享渲染后端都能报告实际绘制次数。使用自有混音器的游戏可以给 `play` 或 `play3d` 传入 `audio: false`，省去内置音频上下文和预设加载。
- **Spine 内容构建。** 资源构建工具可以将 Spine 4.3 JSON 或二进制骨架、图集和命名 PNG 页组合成运行时直接读取的清单。模型导出和分发仍适用各自的许可条件。[Spine 输入格式与验收](spine-content-ingress.md)
- **World3D。** 可以用距离场生成模型，为模型设置表面材质并制作骨骼动画。仓库示例画廊预生成 22 个静态网格，保留两套实时骨骼。在同一台 Fold7 上，使用低画质并经 USB 访问本地服务时，WebGL2 与 WebGPU 到首个可交互画面的中位数都降到 1.68 秒。[硬件记录](november-browser-hardware.md)
- **原生与小游戏。** 仓库中的 Android Runtime SDK 可在本地生成签名 APK/AAB。裁剪 V8 和 GLES3 播放器已有带贴图车辆关卡、210 帧驾驶回放和设备恢复的 Fold7 记录。微信小游戏导出器已通过模拟 `wx` 环境检查，微信开发者工具、微信真机及上传仍待单独验证。Android 和微信工具随仓库源码提供。[Android SDK](https://github.com/cnedwin/Egret_rebuild/tree/v7.0.2/runtime-sdk) · [微信导出说明](wechat-minigame.md)

## 运行与修改入门示例

1. 把[入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip)解压到新目录。它的 `package.json` 已固定同版引擎归档和 esbuild 0.28.2。
2. 使用 Node.js 26.7.0 和 npm，运行 `npm install`，再运行 `npm start`。打开 `http://127.0.0.1:8000`，点击橙色方块或按空格，每次移动 32 个舞台单位。
3. 将 `main.mjs` 中的 `STEP` 从 `32` 改为 `64`，保存并刷新页面。方块每次移动的距离会翻倍。在终端按 Ctrl+C 停止本地服务器。

## 使用 npm 安装

稳定版使用 npm 的 `latest` 标签，候选版使用 `next`。下面的命令安装默认渠道的引擎。

```sh
npm install @egret/engine
```

`@egret/engine` 会一并安装同一版本的 `@egret/contracts` 和 `@egret/runtime`。需要工程格式时加装 `@egret/project`，需要 Spine 时加装 `@egret/spine`。要显式选择候选版标签，可运行 `npm install @egret/engine@next`。要在 `package.json` 中固定本版，可运行 `npm install --save-exact @egret/engine@7.0.2`。

同样的包也可以按归档地址从 GitHub Releases 安装，白鹭自己的包不经过注册表：

```sh
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-engine-7.0.2.tgz
```

npm 会从同一发行版取得 `@egret/contracts` 和 `@egret/runtime`。需要工程格式或 Spine 时，用上表相应的 `.tgz` 地址运行 `npm install`。

## 通过 npm 使用已构建的浏览器脚本

五个模块包按功能提供导入入口。另外两个独立分发包提供与 7.0.2 GitHub 发行相同的浏览器脚本，适合需要单文件部署的游戏。

| 游戏需要 | 安装 | 模块入口 | 可直接部署的脚本 |
| --- | --- | --- | --- |
| 2D 游戏 | `npm install @egret/2d@7.0.2` | `import { play } from '@egret/2d'` | `egret2d.js` |
| World3D 场景与 2D 界面 | `npm install @egret/3d@7.0.2` | `import { play3d } from '@egret/3d'` | `egret3d.js` |

3D 包已包含 2D 游戏入口，每个游戏使用一个包。引擎对象及其资源在同一入口内创建和释放。[HTML 与 ES 模块用法](single-file.md)

## 通过 GitHub Packages 安装浏览器合集

使用 GitHub Packages 的项目可以通过 `@cnedwin/egret-browser` 管理同一版的四个浏览器脚本。在项目的 `.npmrc` 中添加 `@cnedwin:registry=https://npm.pkg.github.com`。这项配置只将 `@cnedwin` 指向 GitHub，`@egret` 模块包和两个独立浏览器包继续使用原有 npm 配置。

```sh
npm login --scope=@cnedwin --registry=https://npm.pkg.github.com --auth-type=legacy
npm install --save-exact @cnedwin/egret-browser@7.0.2
```

从 GitHub 下载公开 npm 包也需要登录。请在密码提示处输入具有 `read:packages` 权限的个人访问令牌（classic），账号须有该包的访问权限。从 `@cnedwin/egret-browser` 或其 `/2d` 入口导入 `play`，从 `@cnedwin/egret-browser/3d` 导入 `play3d`。直接编写 HTML 时，从包中复制一个传统脚本即可。[GitHub Packages 安装与浏览器示例](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/github-browser-distribution/README.zh-CN.md)

## 归档里有什么

五个模块包的 npm 归档包含构建后的 `dist`、包的两份 README、`LICENSE` 和 `NOTICE`。仓库内的工作区包使用私有占位版本 `0.0.0`。归档的 `package.json` 写入发行版本号、可分发的文件列表和许可证；源码清单没有写许可证的包使用 Apache-2.0。公共入口和第三方依赖沿用源码中的声明。

每个模块包打包两次。`egret-<名称>-<版本>.tgz` 将白鹭包之间的依赖固定为同一发行版的地址；发布到注册表的 `npm-egret-<名称>-<版本>.tgz` 则按同一版本号互相依赖。两者包含的文件相同，只有 `package.json` 不同。`release.json` 记录两者的大小和 SHA-256，以及归档首次发布到注册表时使用的标签。

## 制作一个发行版

在准备发行的提交上创建并推送 `v<版本>` 标签。发行工作流从该标签取号，编译这一提交，用同一编号生成浏览器单文件、npm 归档和入门工程，再把全部文件附到同一份 GitHub Release。带预发行标识的版本在 GitHub 上标为候选版。

GitHub Release 发布后，把 `release.json` 和五个 `npm-*.tgz` 归档下载到一个新目录，用有权向 `@egret` 发布的 npm 账号运行 `node tools/publish-registry.mjs --release <目录>`。它逐个核对归档与 `release.json` 的记录，按依赖顺序发布：候选版用 `next` 标签，不带预发行标识的版本用 `latest`。发布后再从注册表读回每个包的完整性校验值并比对。注册表上已有且字节相同的包会跳过，所以中断后可以重新运行。加 `--dry-run` 只显示 npm 将要上传的内容。`7.0.1-rc.3` 发布后，维护者单独将 `latest` 标签移到了该版本。

如果通过 npm 的暂存发布流程操作，先核对发行清单，再对每个已核验的 `npm-*.tgz` 依次运行 `npm stage publish <归档> --tag latest --access public`。在 npm 批准暂存条目后，从公共注册表逐包读回 `dist.integrity` 和 `dist-tags`，再在空工程用包名安装。候选版在暂存时用 `--tag next`。

本地演练五个 npm 归档的打包及安装可运行以下命令。

```sh
node tools/build.mjs
node tools/pack-release.mjs --version 7.0.2 --out ../release
node tools/verify-release.mjs --version 7.0.2 --archives ../release
node tools/publish-registry.mjs --release ../release --dry-run
```

安装检查另打一套使用本地文件地址的归档，以便在发布前运行。它还会把五个注册表归档一起装进第二个工程，确认各包能按版本号找到彼此。npm 会下载第三方依赖，检查脚本会将安装包内容与发行归档逐一比较。

## 从发行资产打包浏览器 npm 包

维护者从对应 GitHub Release 下载发行资产到一个目录，并从 GitHub 资产记录取得 `release.json` 的 SHA-256。下面的命令核对已发行的脚本与许可文件后写出两个 npm 归档。输出目录应为新目录。

    node tools/pack-browser-npm.mjs --release <已下载的发行目录> --manifest-sha256 <GitHub记录的SHA-256> --out <新目录>

维护者从 `main` 手动运行 [GitHub Packages 工作流](https://github.com/cnedwin/Egret_rebuild/blob/main/.github/workflows/publish-github-browser.yml) 来分发 7.0.2。工作流核对原发行清单，用 `--target github` 制作合集，再在空工程里安装已发布的包。运行摘要会列出实际可见性。如果结果为 `private`，需要在包设置中调整访问权限，社区开发者才能安装。[包的访问权限与可见性](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)

## 早期工程预览的验证记录

- `tests/pack-release.test.mjs`：版本与地址、清单、拒绝的情况，以及全部五个归档的内容。
- 在 Linux 上用 Node 26.7.0 和 npm，把 `0.1.0-preview.1` 的归档装进仓库外的干净工程，并在那里导入了 `@egret/engine`、`@egret/engine/web/game`、`@egret/project` 和 `@egret/spine`。

发布前演练在 Windows 干净目录从本地归档安装引擎。无头 Edge 157 绘制了方块，点击后移动 32 个舞台单位，修改并刷新后按空格移动 64 个单位。归档安装演练使用 npm。独立新人、呈现时延和其他包管理器另行验收。[交付进度](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/tree/51b122555503533a4064736e7cbad4934db70862) 当时对应主干提交 `51b12255`。七个公开下载文件均通过 GitHub SHA-256 核对。全新的 npm 工程从发行地址安装了示例使用的引擎、运行时和契约包。另一个工程导入了工程和 Spine 入口，五个白鹭包的安装文件均与公开归档一致。Windows Edge 与 Galaxy Z Fold7 Chrome 用相同的游戏包分别通过 WebGPU 和 WebGL2 渲染。将 `STEP` 从 32 改为 64 后，两台设备上观察到的移动距离均翻倍。[交付记录](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) 列出了包体大小，以及从页面导航到观察到画面移动的耗时，其中包含自动输入和像素采集。独立新人走查和网络启动预算仍待验收。

## 限制

- 标签一经使用，对应的发行版就不能再改：请另出一个版本。
- 地址比包名长，也不能写版本范围；从注册表安装可以同时解决这两点。`7.0.1-rc.3` 是首个发布到 npm 的版本。
- `@egret/spine` 需要 `@esotericsoftware/spine-core` 4.3.13，它有自己的许可证，见该包的 README。
