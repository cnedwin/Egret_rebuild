# Use a 2D or 3D engine file in a web page

English | [简体中文](../../Cns/docs/single-file.md)

Extract the engine files, usage guide and licences from the Egret Engine 7.0 [browser archive](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip). Put `egret2d.js` next to your HTML page to use [`play`](play.md). For World3D, use `egret3d.js` and [`play3d`](play3d.md). Either classic script works from a local folder. For ES modules, serve the corresponding `.mjs` file over HTTP. [Release notes and SHA-256](release-archives.md)

The packer loads all four files, checks their named exports and the `play` or `play3d` entry point, and synthesizes a sound sample. In the earlier single-file test, all three [Play example games](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.md) started, drew, handled keys and pointer input, and started audio sources in headless Chromium with software WebGL2 over both local files and HTTP.

## The page

```html
<!doctype html>
<meta charset="utf-8">
<title>Game</title>
<script src="egret2d.js"></script>
<script type="module">
const { play } = Egret;

await play({
  width: 480, height: 270,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); },
  update(dt, game) { },
});
</script>
```

Everything is on the global `Egret`. The second script is a module only so that it may use `await` at the top; it imports nothing, which is why the page also opens from a folder.

In a page served over HTTP, `import { play } from './egret2d.mjs'` loads the other file, which is the same engine as a module.

`tools/verify-game.mjs` requires frame progress during both its idle and input phases. It decides network and error checks after any optional play script has finished, so requests refused during that script affect the final result. `played` remains a separate check of the script's assertions. The sound witness counts source starts. Audibility and device performance require separate observations.

## Make the files

```text
node tools/build.mjs
node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>]
```

| File | For |
| --- | --- |
| `egret2d.js` | `<script src>`; defines the global `Egret` |
| `egret2d.mjs` | `import` |
| `egret3d.js`, `egret3d.mjs` | The same two with World3D and [`play3d`](play3d.md) as well, for a 3D game. A page loads one file, not both |
| `report.json` | The bundler and its version, the entries, every name, and for each file its size as written, with gzip and with Brotli, its SHA-256 and where its bytes come from |

The bundler is [esbuild](https://esbuild.github.io/). It is not a dependency of the repository: the person packing names an installed copy, as the browser checks name an installed Playwright. Nothing of the bundler but a few lines that define the exports is in the files. The first line of each file names the engine's licence, Apache-2.0, and `robust-predicates` (Unlicense), which the renderer uses.

## What is in it

Four entries and everything they load, the WebGL2 host and the WebGPU host included:

| Entry | Gives |
| --- | --- |
| `@egret/engine/play` | `play`, the sound effect recipes |
| `@egret/engine` | `Sprite`, `Bitmap`, `Graphics`, textures, `animate`, the Engine |
| `@egret/engine/kit` | Input by action, saves, random numbers, sound cues, asset bundles |
| `@egret/engine/web/game` | `createBrowserGame`, for a game that outgrows `play` |

A name is the same thing in the file as in its entry, and the packer refuses two different things under one name. Text, images, audio, tweens and the errors' sentences in English and Chinese are in it because those entries load them.

In 7.0.2, `egret2d.js` exports 86 names. The 3D file adds the World3D and WebGL2 World3D entries, including `play3d`, for a total of 436. The browser archive’s `report.json` lists each entry point, export and checksum. Games that need an additional feature can use its package entry directly. [Public imports](entry-points.md)

## 7.0.2 file sizes

The 7.0.2 files were minified with esbuild 0.28.2. The units below are KiB (1,024 bytes). Network transfer depends on the compression selected by the server.

| File | Raw KiB | gzip KiB | Brotli KiB |
| --- | ---: | ---: | ---: |
| `egret2d.js` | 701.7 | 222.6 | 181.8 |
| `egret2d.mjs` | 701.3 | 222.6 | 181.5 |
| `egret3d.js` | 1371.9 | 448.5 | 359.4 |
| `egret3d.mjs` | 1371.1 | 448.4 | 359.1 |

For a comparison with a custom build, the release’s `report.json` also lists the contribution of each source group to every bundle.
