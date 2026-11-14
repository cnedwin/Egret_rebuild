# Dropdown in a list

English | [简体中文](README.zh-CN.md)

A roster of forty members in a managed list, each with a job. Activating a row opens the jobs as a popup layer anchored to that row: a second managed root that the layer manager places under the row, outside the clip of the roster. A press, the keyboard and a request of assistive technology all reach the same two functions.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-dropdown/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Move a mouse over the roster and over the jobs: the row under it is lit, and darker while it is held.
- Press a member. The jobs open under the chip at the end of the row, with the member's job marked. Press a job: the row shows it and the jobs close.
- Press a member near the bottom. There is no room below, so the jobs stand above the row.
- Open the jobs and press anywhere else. They close, and that press reaches nothing behind them.
- Click the canvas, then use the keyboard alone. Tab enters the roster, the arrow keys, Page Up, Page Down, Home and End move through it, and Enter or Space opens the jobs with the focus on the member's job. The arrow keys, Home and End move among the jobs, Enter chooses, Escape closes, and the focus is back on the row.
- Open the jobs and turn the wheel. The roster scrolls and the jobs follow their row; when the row leaves the roster they close.
- Drag the thumb of the scroll bar, with a mouse or with a finger. The drag goes on beside the track and stops at its ends.

## How it works

| Part | From |
| --- | --- |
| The roster | `createUiRoot` with a virtual list of forty records |
| The pointer on a row | The binding of a row is given `context.target`, the display object of the row. A `createHoverControl` and a `createActionControl` listen on it, so a row is pointed at, held and activated as a button is |
| The jobs | A second `createUiRoot` with five rows |
| The popup | `createUiLayerManager`. The jobs are registered as a `popup` once at the start, closed. Each time a row is activated they are registered again with `anchor: { root, target: { kind: 'row', listId, key }, align: 'end' }` and `initialFocus` on the member's job, then opened |
| A changed job | A new source for the roster whose record has another `contentVersion`: that row is bound again and keeps the focus |
| Keys | `createControlKeys` on each row for Enter and Space; the arrow keys reveal and focus the next row. `keyboard.tabStop` makes the roster one stop |
| The wheel and the scroll bar | `createScrollControl` with the hover input for the wheel and a `thumb` for the drag. It sets the scroll offset of the list, and the page draws the thumb from `scroll.thumb` |
| Semantics | `createUiListSemantics` twice: a `list` for the roster, and a `listbox` for the jobs with `hidden: () => !open`, so that it is in the tree only while the popup is open. A `scrollbar` node gives the offset and names the roster with `controls` |

**The popup is a layer before it first opens.** A root that is not registered as a layer is an ordinary root: it is drawn where it stands and its rows are keyboard stops. The jobs are therefore registered at the start, closed, and the layers keep them off the screen until a row opens them.

**The layers are changed outside routed callbacks.** A press and a key arrive inside the input's own dispatch, where the layer manager refuses to register or publish. `openFor` and `choose` therefore run after the commits that are under way, on the same promise chain that publishes.

**What closes the jobs.** A press outside them, Escape, a choice, and the loss of their anchor: when the row scrolls out of the roster the layer manager retires the popup at the next `sync()`. The page asks the layers whether the popup is still open after each `sync()` and forgets the open row when it is not.

See the guides for [layers](../../knowledge-base/en/docs/ui-layers.md), [the managed list](../../knowledge-base/en/docs/ui-data-panel.md), [semantics](../../knowledge-base/en/docs/ui-semantics.md) and [control state](../../knowledge-base/en/docs/ui-controls.md).

## Check

```text
node examples/ui-dropdown/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Nine scenarios write `report.json` with a screenshot of each: the tree the browser computes while the jobs are closed, with nothing of the jobs drawn and none of them a keyboard stop before they were ever opened; a press that opens them under the chip and a press that chooses, with the paints read from the screen; the popup below the clip of the roster, above a row near the bottom, and over the rows behind it; a press elsewhere; the keyboard alone; the wheel, with the jobs following their row and closing when it is gone; the thumb of the scroll bar under a mouse; requests of assistive technology; and a phone profile. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, wheel, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. A finger does not pan the rows of the roster: panning is a gesture, and none is recognized here. On a phone the rest of the roster is reached by dragging the thumb, which the phone scenario does with an injected touch.
