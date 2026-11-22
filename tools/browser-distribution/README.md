# Egret Engine browser bundles

English | [简体中文](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/browser-distribution/README.zh-CN.md)

These two distributions carry the prebuilt Egret Engine browser scripts. Each contains an ES module and a classic script. For selective imports such as UI, text, Spine or project services, use the corresponding entries in the five modular packages. To identify the source release, read the version in the installed package’s `package.json` and open the matching GitHub release tag. [Release history](https://github.com/cnedwin/Egret_rebuild/releases)

| Game | Install | Module entry | Script to copy |
| --- | --- | --- | --- |
| 2D game | `npm install @egret/2d` | `import { play } from '@egret/2d'` | `egret2d.js` |
| World3D scene and 2D UI | `npm install @egret/3d` | `import { play3d } from '@egret/3d'` | `egret3d.js` |

## With a bundler

Choose one of these entries for a browser application built with an ES module bundler. The first draws a circle. The second shows a ball above a ground plane.

```js
import { play } from '@egret/2d';

await play({
  width: 480, height: 270, audio: false,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
});
```

```js
import { play3d } from '@egret/3d';

await play3d({
  width: 480, height: 270, audio: false,
  setup(game) {
    game.ground(12, 0x2d6a4f);
    const ball = game.sphere(0.5, 0xe8453c, { y: 1 });
    game.follow(ball, { y: 4, z: 6 });
  }
});
```

## From an HTML page

Copy `node_modules/@egret/2d/egret2d.js` next to the HTML file and start the game from the global `Egret` object.

```html
<script src="./egret2d.js"></script>
<script>
  Egret.play({
    width: 480, height: 270, audio: false,
    setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
  });
</script>
```

For a 3D page, copy `node_modules/@egret/3d/egret3d.js` instead and call `Egret.play3d` with the 3D example above. For native browser ES modules, copy the matching `.mjs` file, serve it over HTTP and import its relative URL, for example `import { play } from './egret2d.mjs'`. Include the licence and attribution notices when redistributing the files.

## One engine instance per game

One project can install both packages and `@egret/engine` for separate pages or entry points. Choose one engine entry for each running game. The 3D bundle also includes the 2D `play` API. Create, use and dispose of sprites, scenes, textures and resource leases within the engine that owns them. Exchange plain data such as level JSON, coordinates or identifiers across independent games. Both classic scripts define the global `Egret`, so load only one of them on a page.

[Play guide](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/play.md) · [Play3D guide](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/play3d.md) · [Release and installation](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/release-archives.md)
