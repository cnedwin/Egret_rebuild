# Egret Engine browser collection

English | [简体中文](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/github-browser-distribution/README.zh-CN.md)

`@cnedwin/egret-browser` groups the four prebuilt 2D and World3D browser files from one Egret release in a single GitHub Packages dependency. Its package version identifies the matching [GitHub release](https://github.com/cnedwin/Egret_rebuild/releases). The separate `@egret/2d`, `@egret/3d` and five modular packages use the public npm registry.

## Install from GitHub Packages

Add this one line to your project's `.npmrc`. Other scopes and unscoped dependencies keep their existing registry.

```ini
@cnedwin:registry=https://npm.pkg.github.com
```

GitHub requires authentication when downloading npm packages, including public ones. Sign in with your GitHub username. At the password prompt, enter a personal access token (classic) with `read:packages` from an account with read access to the package. Keep credentials in your local npm configuration and out of source control. [GitHub npm registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

```sh
npm login --scope=@cnedwin --registry=https://npm.pkg.github.com --auth-type=legacy
npm install @cnedwin/egret-browser
```

GitHub Actions can install using its `GITHUB_TOKEN` when the workflow has `packages: read` and its repository has access to the package. Package visibility and repository visibility are configured separately. [Package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)

## Choose an entry

| Game | ES module import for a bundler | Classic script | Browser ES module |
| --- | --- | --- | --- |
| 2D | `import { play } from '@cnedwin/egret-browser/2d'` | `egret2d.js` | `egret2d.mjs` |
| World3D and 2D UI | `import { play3d } from '@cnedwin/egret-browser/3d'` | `egret3d.js` | `egret3d.mjs` |

The package root selects the same ES module as `/2d`. This example draws a circle.

```js
import { play } from '@cnedwin/egret-browser';

await play({
  width: 480, height: 270, audio: false,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
});
```

For plain HTML, copy a classic script from `node_modules/@cnedwin/egret-browser/` to your site's asset directory. For example, `<script src="./egret3d.js"></script>` exposes `Egret.play3d` when the script sits next to the page. For a native browser ES module, copy the matching `.mjs` and import its relative URL over HTTP. Include the accompanying licence and attribution files when redistributing the scripts.

Choose one engine entry per running game. The 3D entry already includes 2D APIs. Keep scenes, display objects and resource leases with the engine that created them, including when `@egret/engine` is installed for another entry point. Load one classic script per page because both define the global `Egret`.

[Play guide](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/play.md) · [Play3D guide](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/play3d.md)
