# Use a 2D or 3D engine file in a web page

English | [简体中文](../../Cns/docs/single-file.md)

Extract the engine files, usage guide and licences from the Egret Engine 7.0 [browser archive](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-browser.zip). Put `egret2d.js` next to your HTML page to use [`play`](play.md). For World3D, use `egret3d.js` and [`play3d`](play3d.md). Either classic script works from a local folder. For ES modules, serve the corresponding `.mjs` file over HTTP. [Release notes and SHA-256](release-archives.md)

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

`egret3d.js` holds all of that and the two World3D entries, `@egret/engine/world3d` and `@egret/engine/webgl2/world3d`, with `play3d`: 394 names in all.

What is in neither stays an entry of its own, loaded as modules: the interface controls, tile maps, the 2D camera, particles with textures, 2D physics, paragraphs, text input, Spine. A game that needs one of them uses the packages, as in [using the preview from a clean project](clean-consumer.md).

## How large it is

Measured from main with this change, packed with esbuild 0.28.2, minified.

| File | KiB | KiB gzip | KiB Brotli |
| --- | ---: | ---: | ---: |
| `egret2d.js` | 628.4 | 197.7 | 161.2 |
| `egret2d.mjs` | 628.0 | 197.5 | 161.1 |
| `egret3d.js` | 1236.0 | 401.7 | 321.8 |
| `egret3d.mjs` | 1235.3 | 401.6 | 321.7 |

Where the bytes of `egret2d.js` come from, before compression:

| Part | KiB |
| --- | ---: |
| Engine | 145.6 |
| Runtime | 117.7 |
| WebGPU host | 81.2 |
| WebGL2 host | 68.4 |
| Sentences of errors, English and Chinese | 64.2 |
| Preparing a frame | 55.6 |
| Text | 55.1 |
| Sound | 19.9 |
| Play | 15.4 |
| Third party (`robust-predicates`) | 3.9 |

Leaving the WebGPU host out would take about 24 KiB off the gzip size and the Chinese sentences of errors about 8; the file keeps both, so that it behaves as the modules do in every browser and says what went wrong in either language.
