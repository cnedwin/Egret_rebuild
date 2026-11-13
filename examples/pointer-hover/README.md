# Hover and wheel

English | [简体中文](README.zh-CN.md)

Three buttons that light up under a mouse or a pen, and a list that the wheel and a scrollbar scroll. Hover and wheel come from `@egret/engine/web/hover`. Presses come from `@egret/engine/web/pointer`. Both listen on the same canvas.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/pointer-hover/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Move the pointer over a button. It lights up, and the status line names it. Press it: the hover ends for the press and returns when you release.
- Rest the pointer on a row and turn the wheel. The list scrolls, and the row under the pointer changes without the pointer moving.
- Keep turning at the end of the list. The page scrolls instead.
- Drag the bar beside the list. The list follows, and the drag goes on when the pointer leaves the bar sideways.
- Click the canvas and press Tab: a ring marks the list. The arrow keys, Page Up, Page Down, Home and End scroll it, and at its end the same keys scroll the page.
- Make the window narrower than the canvas. The buttons are still found where they are drawn.
- Touch a button on a phone. It is pressed and nothing is hovered.

## How it works

`main.mjs` listens for `hover.events.enter` and `hover.events.leave` on each button. The scroll position of the list is a `createScrollControl` from `@egret/engine/ui`. It hears `hover.events.wheel` on the viewport and takes the wheel only while the content can still move that way; a wheel it leaves alone scrolls the page. It also turns a drag of the thumb into an offset. The list is one stop of `@egret/engine/web/keyboard`, and a `createControlKeys` of kind `'scroll'` gives it its keys. After a scroll the page calls `hover.sync()` so that the row under a resting pointer is picked again.

See [the guide](../../knowledge-base/en/docs/pointer-hover.md) for the events, the reasons of a leave, the wheel policy and what was checked.

## Check

```text
node examples/pointer-hover/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Nine scenarios drive a mouse, a pen, a finger, the wheel and the keyboard through the automation protocol and write `report.json` with a screenshot of each. They passed in headless Chromium with software WebGL2. A hardware GPU, WebGPU, Edge, Safari, Firefox and a person at a real mouse were not run.
