# 白鹭引擎 7.0 发行说明与安装

[English](../../en/docs/release-archives.md) | 简体中文

**白鹭引擎 7.0** 延续社区重建后的产品版本线。候选版 [`v7.0.1-rc.2`](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.2) 用同一个标签指向的提交生成以下文件。

| 开发方式 | 下载 |
| --- | --- |
| 从可编辑的 2D 游戏开始 | [入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-first-game.zip) |
| 给已有网页加入引擎 | [浏览器文件与许可证](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-browser.zip)。2D 可选 [`egret2d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret2d.js) 或 [`egret2d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret2d.mjs)，包含 World3D 的版本可选 [`egret3d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret3d.js) 或 [`egret3d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret3d.mjs)。 |
| 在现有 npm 工程中导入模块 | [`@egret/engine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-engine-7.0.1-rc.2.tgz)、[`@egret/contracts`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-contracts-7.0.1-rc.2.tgz)、[`@egret/runtime`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-runtime-7.0.1-rc.2.tgz)、[`@egret/project`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-project-7.0.1-rc.2.tgz)、[`@egret/spine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-spine-7.0.1-rc.2.tgz) |

[发行清单](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/release.json)记录源提交、文件大小及 SHA-256。下载浏览器单文件后，请放在游戏自己的站点或目录中提供给页面；分发游戏时一并保留浏览器归档里的许可声明。

`7.0.1-rc.1` 是较早的浏览器单文件候选构建，记录见 [PR #367](https://github.com/cnedwin/Egret_rebuild/pull/367)。使用 `0.1.0-preview.1` 的工程仍可从[早期工程预览](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1)取得原版本和[原入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0-preview.1/egret-first-game.zip)。

## 运行与修改入门示例

1. 把[入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-first-game.zip)解压到新目录。它的 `package.json` 已固定同版引擎归档和 esbuild 0.28.2。
2. 使用 Node.js 26.7.0 和 npm，运行 `npm install`，再运行 `npm start`。打开 `http://127.0.0.1:8000`，点击橙色方块或按空格，每次移动 32 个舞台单位。
3. 将 `main.mjs` 中的 `STEP` 从 `32` 改为 `64`，保存并刷新页面。方块每次移动的距离会翻倍。在终端按 Ctrl+C 停止本地服务器。

## 使用 npm 安装

```sh
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-engine-7.0.1-rc.2.tgz
```

npm 从 GitHub Release 安装 `@egret/engine`，并自动取得同一版本的 `@egret/contracts` 和 `@egret/runtime`。需要工程格式或 Spine 时，用上表相应的 `.tgz` 地址运行 `npm install`。本候选版通过 GitHub Releases 分发。在公共 npm 注册表按包名安装属于另一种分发方式。

## 归档里有什么

npm 归档包含构建后的 `dist`、包的两份 README、`LICENSE` 和 `NOTICE`。仓库内的工作区包使用私有占位版本 `0.0.0`。归档的 `package.json` 写入候选版本号和可分发的文件列表，并将白鹭包之间的依赖固定为同一发行版的地址。公共入口和第三方依赖沿用源码中的声明。

## 制作一个发行版

在准备发行的提交上创建并推送 `v<版本>` 标签。发行工作流从该标签取号，编译这一提交，用同一编号生成浏览器单文件、npm 归档和入门工程，再把全部文件附到同一份 GitHub Release。带预发行标识的版本在 GitHub 上标为候选版。

本地演练五个 npm 归档的打包及安装可运行以下命令。

```sh
node tools/build.mjs
node tools/pack-release.mjs --version 7.0.1-rc.2 --out ../release
node tools/verify-release.mjs --version 7.0.1-rc.2 --archives ../release
```

安装检查另打一套使用本地文件地址的归档，以便在发布前运行。npm 会下载第三方依赖，检查脚本会将安装包内容与发行归档逐一比较。

## 早期工程预览的验证记录

- `tests/pack-release.test.mjs`：版本与地址、清单、拒绝的情况，以及全部五个归档的内容。
- 在 Linux 上用 Node 26.7.0 和 npm，把 `0.1.0-preview.1` 的归档装进仓库外的干净工程，并在那里导入了 `@egret/engine`、`@egret/engine/web/game`、`@egret/project` 和 `@egret/spine`。

发布前演练在 Windows 干净目录从本地归档安装引擎。无头 Edge 157 绘制了方块，点击后移动 32 个舞台单位，修改并刷新后按空格移动 64 个单位。归档安装演练使用 npm。独立新人、呈现时延和其他包管理器另行验收。[交付进度](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) 对应主干提交 `51b12255`。七个公开下载文件均通过 GitHub SHA-256 核对。全新的 npm 工程从发行地址安装了示例使用的引擎、运行时和契约包。另一个工程导入了工程和 Spine 入口，五个白鹭包的安装文件均与公开归档一致。Windows Edge 与 Galaxy Z Fold7 Chrome 用相同的游戏包分别通过 WebGPU 和 WebGL2 渲染。将 `STEP` 从 32 改为 64 后，两台设备上观察到的移动距离均翻倍。[交付记录](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) 列出了包体大小，以及从页面导航到观察到画面移动的耗时，其中包含自动输入和像素采集。独立新人走查和网络启动预算仍待验收。

## 限制

- 标签一经使用，对应的发行版就不能再改：请另出一个版本。
- 地址比包名长，也不能写版本范围。发布到注册表可以同时解决这两点，但那是关于 npm 上 `@egret` 名字的决定，尚未作出。
- `@egret/spine` 需要 `@esotericsoftware/spine-core` 4.3.13，它有自己的许可证，见该包的 README。
