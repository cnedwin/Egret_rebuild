# The 2D engine in one file

English | [简体中文](../../Cns/docs/single-file.md)

A game made with [`play`](play.md) needs one page and the engine. `tools/pack-single-file.mjs` writes the engine as one file, so the page needs no import map, no package manager and no build step, and opens from a folder as well as from a server. It is the file [llms.txt](https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt) tells an agent to put beside the page.

**What is checked and what is not.** The packer loads both files it has written and refuses them unless each gives every name it was made from and `play` and the sound effects work. From `egret.global.js` beside a page, the three games of the [play example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.md) started, drew, took keys and the pointer and made sound in headless Chromium on software WebGL2, both from a server and opened from the folder. The files are not published anywhere: no registry and no CDN has them. Other browsers, phones and WebGPU were not run.

## The page

```html
<!doctype html>
<meta charset="utf-8">
<title>Game</title>
<script src="egret.global.js"></script>
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

In a page served over HTTP, `import { play } from './egret.js'` loads the other file, which is the same engine as a module.

## Make the files

```text
node tools/build.mjs
node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>]
```

| File | For |
| --- | --- |
| `egret.global.js` | `<script src>`; defines the global `Egret` |
| `egret.js` | `import` |
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

What is not in it stays an entry of its own, loaded as modules: World3D, the interface controls, tile maps, the 2D camera, particles with textures, 2D physics, paragraphs, text input, Spine. A game that needs one of them uses the packages, as in [using the preview from a clean project](clean-consumer.md).

## How large it is

Measured from main with this change, packed with esbuild 0.28.2, minified.

| File | KiB | KiB gzip | KiB Brotli |
| --- | ---: | ---: | ---: |
| `egret.global.js` | 627.6 | 197.3 | 161.0 |
| `egret.js` | 627.1 | 197.2 | 160.8 |

Where the bytes of `egret.global.js` come from, before compression:

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
