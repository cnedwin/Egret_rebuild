# Control states

English | [简体中文](README.zh-CN.md)

A switch, a group of three options and a button, drawn by the engine in each of their states. The controls of `@egret/engine/ui` hold the state. The page paints it and binds the keys, and describes the same controls to assistive technology.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-controls/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Move the pointer over each control. It lightens. The switch and the button darken while a press is held.
- Press the switch, an option and the button. The status line under the canvas follows.
- Click the canvas, then use the keyboard. Tab moves between the switch, the group and the button, and a ring marks the one with the focus. Space or Enter activates. The arrow keys, Home and End move within the group.
- Hold Space on the button. It is painted as pressed and nothing happens until you let go. Hold it again and press Tab: the hold ends and nothing is applied.
- Disable the third option with the page button. A press on it does nothing and the arrow keys skip it.
- Disable everything. No control answers, and none is hovered.
- Open the accessibility tree in the browser's developer tools. The canvas is an application that holds a group, a switch, a radio group of three and a button, each with its state, and it names the one with the focus.

## How it works

`main.mjs` creates a `createToggleControl`, a `createSelectionGroup` and a `createActionControl` on the contact input, and a `createHoverControl` on the hover input for each of the five surfaces. Every callback repaints. The colours are those of a `createUiTheme`: a skin names a paint for each state, and `selectUiSkin` chooses among the states that hold, unavailable first, then held, then pointed at. A control that is set has a skin of its own, so that it stays set under the pointer.

Keys arrive from `@egret/engine/web/keyboard` at the display object with the focus, where a `createControlKeys` binds the usual keys of each control: Space or Enter, released, toggles the switch and activates the button, and the arrow keys, Home and End move within the group. A key that is held paints the control as a press does, and a hold that loses the focus activates nothing. The three options are inside one display object, which is the keyboard stop of the group and has its one binding. The focus stays on the group while the selection moves inside it, so a held arrow key goes on through the options, and the ring is drawn on the selected one.

`createUiSemantics` describes the five controls: each node reads the control that is drawn when the page publishes, after it paints. `createBrowserSemantics` lays an invisible element over each control. The keyboard stays with the canvas.

See [the guide](../../knowledge-base/en/docs/ui-controls.md) for each control and [the semantics guide](../../knowledge-base/en/docs/ui-semantics.md) for the description, with what was checked.

## Check

```text
node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Seven scenarios drive a mouse, a finger and the keyboard through the automation protocol, one of them reading the colour each state is painted with, and four read the accessibility tree the browser computes and make requests of its elements. They write `report.json` with a screenshot of each. All eleven passed in headless Chromium with software WebGL2. A hardware GPU, WebGPU, Edge, Safari, Firefox, a real phone, a person at the controls and any screen reader or other assistive technology were not run.
