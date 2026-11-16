# 发行归档

[English](../../en/docs/release-archives.md) | 简体中文

仓库里的包是私有的，版本为 0.0.0。一次发行是由它们打出的一组归档，每个包一个，附在 GitHub release 上。不向 npm 发布任何内容。

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

没有检查的：工作流本身，它只在推送标签时运行；用 pnpm 或 yarn 安装；用已安装的发行版构建的浏览器页面，这一项由[干净消费者检查](clean-consumer.md)对私有归档覆盖。

## 限制

- 标签一经使用，对应的发行版就不能再改：请另出一个版本。
- 地址比包名长，也不能写版本范围。发布到注册表可以同时解决这两点，但那是关于 npm 上 `@egret` 名字的决定，尚未作出。
- `@egret/spine` 需要 `@esotericsoftware/spine-core` 4.3.13，它有自己的许可证，见该包的 README。
