# A table that sorts

English | [简体中文](README.zh-CN.md)

Forty members in a table of four columns: name, rank, job and level. The rows are a managed list, so there are rows only for what shows. A press on a header sorts by its column and a second press turns the order round; a press on a row selects its member. To assistive technology it is a grid of forty-one rows, the first of which is the headers.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-roster-table/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press **品阶 / Rank**. The rows are ordered by rank, and members of the same rank keep the order of their numbers. The header carries a bar along its top edge. Press it again: the order turns round and the bar is along the bottom edge.
- Press a row. Its member is selected, and stays selected when the table is sorted another way, wherever its row then is.
- Turn the wheel or drag the thumb of the scroll bar. After a sort the table shows its top again.
- Click the canvas, then use the keyboard alone. Tab goes through the four headers, where Enter or Space sorts, and then into the rows. There the arrow keys, Page Up, Page Down, Home and End move through the rows as they are ordered now, and Space or Enter selects.

## How it works

| Part | From |
| --- | --- |
| The rows | `createUiRoot` with a virtual list of forty records, and `keyboard.tabStop` so that the rows are one stop after the headers |
| A new order | The same records in another order as a new source: `list.setSource(...)` and then `list.setScrollOffset(0)`. A list keeps its anchor in view through a new source unless it is told where to be |
| A row | Holds only what it shows. Where its member stands is read from the order when a key needs it, because a row is not bound again when only its place changes |
| The headers | A `createHoverControl`, a `createActionControl` and `createControlKeys` of kind `'action'` each, and a keyboard stop each |
| Semantics | `createUiListSemantics` with `role: 'grid'`, `columns: 4` and `rowOffset: 1`; `describeRow` says `selected`. The four cells of a row are added in `onRowAdded` and measured from `rows.rowBounds(key)`. The row of headers is a `row` of the application's own with four `columnheader` nodes that say `sort`. A `status` says the order when it changes, and a `scrollbar` names the grid |

**Rows are what is selected.** Each row says whether it is selected and the cells say nothing of it. The row that holds the focus of the list is the focused node, as a row.

**The first row of the grid is the headers.** With `rowOffset: 1` the first member is the second row and the grid has forty-one. A row that scrolls into view says which row of the whole table it is.

See the guides for [semantics](../../knowledge-base/en/docs/ui-semantics.md#a-table-of-a-managed-list), [the managed list](../../knowledge-base/en/docs/ui-data-panel.md) and [control state](../../knowledge-base/en/docs/ui-controls.md).

## Check

```text
node examples/ui-roster-table/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the grid the browser computes at the start, with its counts, the sort each header says and the index of each row, and the start state read from the screen; presses on headers that sort one way and the other, each order compared with one worked out apart from the page, and a selected member kept through a new order; the wheel, with the index of the rows that show; the keyboard alone, through the headers into the rows and out of the canvas, with the page not scrolled; requests of assistive technology on headers and rows, with the order said by the status element; and a phone profile with an injected touch on the scroll bar. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. The rows have the focus as rows: there is no cursor on a single cell. Columns are not resized, hidden or moved, the table sorts by one column at a time, and a finger does not pan the rows.
