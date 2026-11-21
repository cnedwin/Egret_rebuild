# A browser game as a WeChat mini game

English | [简体中文](../../Cns/docs/wechat-minigame.md)

A game made with the engine for the browser can be packaged as a WeChat mini game without changing its code. `tools/wechat/export-wechat.mjs` writes the folder that WeChat DevTools opens and that is uploaded to the WeChat platform. `tools/wechat/check-minigame.mjs` runs that folder in a headless browser with a stand-in for `wx` before a phone is involved.

## What a mini game lacks, and what stands in for it

A mini game runs one script, `game.js`, in a global that holds `wx`, the console, timers and frames. There is no window, no document, no `fetch`, and one canvas for the screen. The export puts `tools/wechat/adapter.js` in front of the game. The adapter makes what the engine and the game reach for out of `wx`:

| A page has | The adapter gives |
| --- | --- |
| `document`, elements, `getElementById`, `querySelector` | A document built from the elements of the game's `index.html`, with the classes of a page (`Node`, `Element`, `HTMLElement`, `HTMLCanvasElement`, `Document`). Their properties are accessors on the prototypes, which the engine's input reads. |
| A canvas for WebGL2 | The first canvas that asks for WebGL2 is given the screen. It takes the stage's size, and `gl.canvas` is the game's canvas. Other canvases draw in 2D on canvases of their own. |
| Pointer, mouse and keyboard events | Touches become `PointerEvent`s on the stage, with a `click` after a tap. `wx.onKeyDown` becomes `KeyboardEvent`s. |
| `fetch`, `Image`, `new URL(x, import.meta.url)` | The package's files are read from the package and other addresses through `wx.request`. Each module's `import.meta.url` names its file under `https://game.local/`. |
| `Blob`, `createImageBitmap` | The engine decodes a PNG from bytes. The bytes are written to a file of the game's own under `wx.env.USER_DATA_PATH` and loaded as an image. |
| `localStorage` | `wx` storage, each key under the prefix `ls:`. |
| `AudioContext` | `wx.createWebAudioContext()`, with `decodeAudioData` also returning a promise. |
| `visibilitychange` | `wx.onShow` and `wx.onHide`. |
| The page under a transparent canvas | See below. |

**Scenery under the canvas.** A game may paint its scenery as the CSS background of an element under the canvas, and clear the canvas to nothing. A mini game has nothing under its canvas. The adapter paints the backgrounds of the elements that come before the stage onto a canvas of its own. At the end of each frame that drew into the screen, it draws them under what the game drew, by blending into the clear pixels only. It then binds again everything of the game's WebGL state it changed. Colours, `linear-gradient` and pictures with position and size (`cover`, `contain`, lengths and percentages) are painted. Other gradients and `repeat` are not; the adapter names them once on the console.

Every other name a page has (`XMLHttpRequest`, `Worker`, `OffscreenCanvas`, `indexedDB` and so on) is bound to nothing inside the game. A game that reaches for one fails in the stand-in as it would on a phone, rather than on a phone alone.

## Export

```sh
node tools/wechat/export-wechat.mjs --esbuild <installed esbuild> --game <game folder> --out <new folder> \
  [--appid <AppID>] [--orientation portrait|landscape] [--playwright <installed Playwright index.mjs>]
```

- The game's `index.html` gives its import map, which says where each module of the engine is. It also gives the elements the game looks up. The entry is `src/main.mjs` unless `--entry` names another.
- The game and the engine are bundled into one script and brought down to ES2017. The script is minified unless `--no-minify` is given.
- `game.json` sets the orientation, hides the status bar and asks for iOS high-performance mode (`iOSHighPerformance`). `project.config.json` makes it a game project, with the AppID given or `touristappid`.
- The game's other files are copied if WeChat accepts their kind. Files it would refuse are listed and left out.
- WeChat on some phones does not decode WebP. With `--playwright`, each `.webp` is written again by a headless Chromium. It becomes a JPEG at quality 0.9 when every pixel is opaque, and a PNG otherwise. The adapter finds it under its new name. Without that option, the export lists the WebP files.
- The report gives the size of `game.js` and of the package against WeChat's limits: 4 MB for the main package and 30 MB in all.

## Check

```sh
node tools/wechat/check-minigame.mjs <installed Playwright index.mjs> <mini game folder> <picture.png> \
  [--size 390x844] [--ratio 2] [--wait 8] [--tap x,y ...] [--then-wait 3]
```

The stand-in gives the game what a mini game gives and nothing more. `GameGlobal` holds `wx`, the console, timers and frames. `wx.createCanvas` gives the screen first, then canvases off the screen. Files are read from the folder and storage is kept in memory. Touches come from the mouse; `--tap` taps the screen. The report has:

- whether the game stopped;
- the errors on the console;
- the `wx` calls made and the storage keys written;
- how many colours the picture has;
- whether any element reached the real page past the adapter.

`ok` requires no failure, no error, more than eight colours and no element leaked.

## Upload

Uploading needs the game's AppID and its upload key, from the WeChat platform (mp.weixin.qq.com). They belong to the game's owner, so the tools do not upload.

1. Export with the AppID, and with `--playwright` if the game has WebP pictures.
2. Open the folder in WeChat DevTools. Try it in the simulator and on a phone through the preview QR code.
3. On the platform, enable high-performance mode for the AppID. WebGL2 on iOS needs it.
4. Press Upload in DevTools, with a version and a description. Alternatively, use `miniprogram-ci` with the upload key and the IP allow-list set on the platform:

   ```js
   const ci = require('miniprogram-ci');
   const project = new ci.Project({ appid: 'wx…', type: 'miniGame', projectPath: './out', privateKeyPath: './private.wx….key' });
   await ci.upload({ project, version: '1.0.0', desc: 'First upload', robot: 1, setting: { es6: true } });
   ```

5. Submit the uploaded version for review on the platform. A game also needs the category, the age rating and, for a game sold in mainland China, the licence the platform asks for.

## What is checked

The tests in `tests/wechat-minigame.test.mjs` run the adapter in a Node context. Like a mini game's global, the context holds only `wx`, the console, timers and frames. The tests check:

- the page's classes and their prototype accessors;
- the screen canvas and the 2D canvases;
- touches as pointer events and taps as clicks;
- storage, package files, renamed pictures and decoded bytes;
- the backdrop drawn under a frame, with the game's WebGL state bound again;
- the export of a small game folder, run in that context.

On November 22, 2026, a ported 2D game exported this way was played in the stand-in, in headless Chromium on software WebGL2. The game was 0.54 MB of pictures, and its scenery is CSS backgrounds. The package came to 1.75 MB with its WebP written as JPEG. The title showed its scenery under the canvas; a tap went to the choice of night, and a second tap started the first night. No error was reported and no element leaked.

**Not checked.** WeChat itself has not been run: not DevTools, not a phone, not the review. The stand-in is a browser and its JavaScript engine, WebGL and limits are a browser's. In particular, WebGL2 on Android WeChat and on iOS high-performance mode, the decoding of every format and the speed on a phone are open.

**Limits.**

- HTML the game shows over the canvas (menus, text fields, overlays) is not drawn. Only backgrounds under the stage are drawn.
- The screen canvas fills the window. A stage of another shape is stretched, and the adapter reports the full window as the stage's rectangle, so touches stay where they are drawn.
- WebGPU is not available in a mini game. A game that requires it does not start.
