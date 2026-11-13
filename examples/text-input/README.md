# Text input over a canvas

English | [简体中文](README.zh-CN.md)

A panel drawn by the engine with two fields a player can type into: a name of at most eight characters, and a motto of several lines. Editing uses a native browser field so the operating system can provide keyboard and composition input. See the checks below for verified coverage.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/text-input/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press the name box and type with a Chinese input method. The status line shows the provisional pinyin, then the chosen characters. Enter commits.
- Type more than eight characters: the excess of what you just entered is dropped.
- Press the motto box. Enter inserts a line break; press elsewhere to commit, or Escape to cancel.
- Make the window narrower than the canvas. The field stays on its box.

## How it works

`main.mjs` draws every caption and every committed value with `createTextField` from `@egret/engine/text`. A press on a box calls `input.open` from `@egret/engine/web/text-input` with the rectangle of the box in stage units. While the field is open the engine does not draw that box's text; when the session ends the game stores the value and draws it again.

See [the guide](../../knowledge-base/en/docs/text-input.md) for the request, the rules that end a session, and what is and is not checked.

## Check

```text
node examples/text-input/verify.mjs <directory from which "playwright" resolves>
```

The command runs headless Chromium with mouse input and phone emulation and drives composition through the browser protocol. A separate hardware check passed three cases per backend on Windows Edge 157 (RTX 5090 Laptop) and Galaxy Z Fold7 Chrome 157 (Adreno 830). The Samsung keyboard appeared on the phone, and the visual viewport shrank from 813.7 to 423.2 CSS px. Text was entered through CDP. Human CJK composition and candidate selection, iPhone Safari, desktop Firefox and desktop Safari still need verification. [Input qualification #89](https://github.com/cnedwin/Egret_rebuild/issues/89)
