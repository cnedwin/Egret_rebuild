# Tabs and progress

English | [简体中文](README.zh-CN.md)

Three tabs drawn by the application, each with its panel. The tabs are one selection group and one keyboard stop, and the panel follows the selection. One panel has three progress bars and a button that advances them. The semantic tree describes the same screen as a row of tabs, a tab panel and progress bars.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-tabs/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press a tab. Its panel takes the place of the one before it.
- Click the canvas, then use the keyboard alone. Tab stops at the tabs once; Arrow Left and Arrow Right move the selection, round past either end, and Home and End go to the first and the last. The panel changes with the selection, without another key.
- On **修炼 / Training**, Tab goes on to the button. Enter or Space trains: each bar advances by its own amount and stops at its end. When every bar is full the button is disabled, and a focus it held goes to the tabs.
- On the other two tabs there is nothing to stop at, so Tab leaves the canvas.

## How it works

| Part | From |
| --- | --- |
| The tabs | `createSelectionGroup` of `@egret/engine/ui`, with `createHoverControl` for the pointer |
| Keys | The tabs sit inside one display object, which is the keyboard stop with one `createControlKeys` binding of kind `'selection'`, `orientation: 'horizontal'` |
| The panels | One container each. The one of the selected tab is visible; what is not visible takes no press and no focus |
| The button | `createActionControl` with a binding of kind `'action'` |
| Semantics | `tablist`, `tab` and `tabpanel`; the selected tab names its panel with `controls`. Each bar is a `progressbar` with its `range` |

**The arrow keys select.** A tab is shown as soon as the selection reaches it, so the focused tab is always the selected one, and a tab that assistive technology asks to focus is selected with it. The arrows across the row are left to the page.

See the guides for [control state](../../knowledge-base/en/docs/ui-controls.md) and [semantics](../../knowledge-base/en/docs/ui-semantics.md).

## Check

```text
node examples/ui-tabs/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Five scenarios write `report.json` with a screenshot of each: the row of tabs and the one panel the browser computes, with the relation from the selected tab to its panel; presses on tabs and on the button, with the paints and the fill of the bars read from the screen and the values the browser gives; the keyboard alone; requests of assistive technology; and a phone profile. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run.
