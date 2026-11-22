# 白鹭引擎浏览器合集

[English](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/github-browser-distribution/README.md) | 简体中文

`@cnedwin/egret-browser` 通过 GitHub Packages 将同一版白鹭引擎的四个 2D 和 World3D 浏览器文件作为一个依赖提供。包的版本号对应 [GitHub 发行版](https://github.com/cnedwin/Egret_rebuild/releases)。独立分发的 `@egret/2d`、`@egret/3d` 和五个模块包继续使用公共 npm。

## 从 GitHub Packages 安装

在项目的 `.npmrc` 中添加下面一行。其他命名空间及没有命名空间的依赖继续使用原有的仓库配置。

```ini
@cnedwin:registry=https://npm.pkg.github.com
```

从 GitHub 下载 npm 包需要登录，包括公开包。登录时填写 GitHub 用户名，在密码提示处输入个人访问令牌（classic）。账号需要有该包的读取权限，令牌需要 `read:packages` 权限。将凭据保存在本机 npm 配置中，避免提交到代码仓库。[GitHub npm 仓库指南](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

```sh
npm login --scope=@cnedwin --registry=https://npm.pkg.github.com --auth-type=legacy
npm install @cnedwin/egret-browser
```

GitHub Actions 可以使用 `GITHUB_TOKEN` 安装。工作流需要 `packages: read`，运行工作流的仓库也需要有该包的访问权限。包与源码仓库的可见性分别设置。[包的权限](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)

## 选择入口

| 游戏 | 构建工具中的 ES 模块导入 | 传统脚本 | 浏览器 ES 模块 |
| --- | --- | --- | --- |
| 2D 游戏 | `import { play } from '@cnedwin/egret-browser/2d'` | `egret2d.js` | `egret2d.mjs` |
| World3D 与 2D 界面 | `import { play3d } from '@cnedwin/egret-browser/3d'` | `egret3d.js` | `egret3d.mjs` |

包的默认入口与 `/2d` 指向同一个 ES 模块。这个示例会画出一个圆。

```js
import { play } from '@cnedwin/egret-browser';

await play({
  width: 480, height: 270, audio: false,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
});
```

直接编写 HTML 时，将 `node_modules/@cnedwin/egret-browser/` 中的一个传统脚本复制到网站资源目录。比如脚本与网页同目录时，`<script src="./egret3d.js"></script>` 会提供 `Egret.play3d`。若使用浏览器原生 ES 模块，复制对应的 `.mjs` 文件，通过 HTTP 提供访问并用相对地址导入。再次分发时请附带包中的许可和署名文件。

每个运行中的游戏选择一个引擎入口。3D 入口已经包含 2D API。即使项目的另一个入口安装了 `@egret/engine`，场景、显示对象和资源租约也应由创建它们的引擎使用和回收。两个传统脚本都定义全局对象 `Egret`，一个页面只加载其中一个。

[Play 指南](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/play.md) · [Play3D 指南](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/play3d.md)
