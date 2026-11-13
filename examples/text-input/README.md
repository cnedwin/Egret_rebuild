# Text input over a canvas

English | [简体中文](README.zh-CN.md)

A panel drawn by the engine with two fields a player can type into: a name of at most eight characters, and a motto of several lines. Any input method the platform offers works, because the field being edited is the platform's own.

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

This runs the page in headless Chromium, with a mouse and with an emulated phone, and drives a composition through the browser's protocol. It does not use a physical input method or a real phone.
