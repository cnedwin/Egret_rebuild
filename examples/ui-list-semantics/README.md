# List semantics

English | [简体中文](README.zh-CN.md)

A list of fifty thousand servers drawn by the engine. The managed UI realizes the eight rows that show, and `createUiListSemantics` keeps one semantic node for each of them, so assistive technology is given a list box whose options say where they stand among the fifty thousand. A press, a key and a request of assistive technology all reach the same selection. The details of a server open in a modal layer, which assistive technology is given as a dialog.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-list-semantics/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press a row. It turns green: it is the chosen server.
- Click the canvas, then press Tab. A ring marks the row with the focus. The arrow keys, Page Up, Page Down, Home and End move through the whole list, which scrolls under the focus. Space or Enter chooses the row when the key is released.
- Press Arrow Right on a row, or **Details of the chosen server**. A card opens over the list with two buttons. Tab stays inside it, a press beside it reaches nothing, and Escape closes it. The focus returns to the row.
- Press **Go to row 40,000**. The list jumps there and the focus is on that row.
- Press **Scroll to the top** while a row far below has the focus. The row leaves, and nothing has the focus.
- With a screen reader, move into the list. Each option is announced with its number of fifty thousand. This was not run by the project: see below.

The rows carry no text. Each shows the last digit of its number as pips, so that rows can be told apart in a screenshot.

## How it works

`createUiRoot` owns the list: it realizes the rows that show, recycles the others, and tells the page which row a contact is on. After each commit the page calls `rows.sync()` and publishes the tree with the revision it returns:

```js
const rows = createUiListSemantics({
  semantics, root, list: 'list', role: 'listbox', name: 'Servers', focusable: true,
  describeRow: (key, index) => ({ name: 'Server ' + (index + 1), selected: key === selected }),
  onActivateRow: key => select(key),
});
// After root.commit(...), with the frame that shows the same rows:
semantics.publish(rows.sync());
```

`createBrowserSemantics` lays an invisible element over each row that shows. The keyboard stays with the canvas, which names the element of the row with the focus. A row that has left the list has no element, so the canvas never names one that does not exist.

The list is one stop of the keyboard (`keyboard: { input, idPrefix, tabStop }` of the root): Tab enters it at the row that last held the focus and leaves it from there. Each realized row has a `createControlKeys` binding for Space and Enter. The arrow keys ask the root to reveal the next row, and the focus is given after the commit that realizes it.

The card is a second root, registered with `createUiLayerManager` as a modal layer. Its semantic node is a dialog of the page's own: hidden while the layer is closed, and placed with `semanticBoxOf(card, 'card')`. While it is published the tree makes the list inert, so the browser gives assistive technology the dialog and its two buttons and nothing behind them.

See [the semantics guide](../../knowledge-base/en/docs/ui-semantics.md#a-managed-virtual-list), [the layer guide](../../knowledge-base/en/docs/ui-layers.md) and [the managed UI guide](../../knowledge-base/en/docs/ui-data-panel.md).

## Check

```text
node examples/ui-list-semantics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Eight scenarios write `report.json` with a screenshot of each: the list box the browser computes, the keyboard through recycled rows, a jump to row 40,000 and a scroll away from the focus, requests made of the options, a narrower window with a scrolled page, a phone profile, the modal card as the only thing in the tree the browser computes, and the keyboard through the card and back to the row. They passed in headless Chromium with software WebGL2.

A screen reader or other assistive technology, a person at the keyboard, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. A list box the browser computes correctly is not proof that the list is usable with a screen reader.
