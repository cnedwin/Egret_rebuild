# A bag of items

English | [简体中文](README.zh-CN.md)

Twenty-four slots in four rows of six, some of them holding a stack of something. The bag is one keyboard stop with a cursor that moves in two directions. Beside it are what the item under the cursor is and three buttons; under it a line says what happened. To assistive technology the bag is a grid of rows and cells.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-inventory/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press a slot. The cursor goes there and the panel beside the bag says what it holds.
- Click the canvas, then use the keyboard alone. Tab moves to the bag. The arrow keys move the cursor and stop at the edges; Home and End go to the ends of the row and, with Control, to the first and the last slot; Page Up and Page Down go to the top and the bottom of the column.
- Enter or Space uses one of the item under the cursor. The last one empties its slot. Iron and stones cannot be used: the line under the bag says so and nothing changes.
- **使用 / Use**, **丢弃 / Drop** and **整理 / Sort** use one, drop the whole stack, and close the gaps. A button that has nothing to do is disabled, leaves the Tab order, and gives the focus to the bag if it held it.

## How it works

| Part | From |
| --- | --- |
| The bag | An array of twenty-four slots and the index of the cursor, in the application. No control owns them |
| The keyboard stop | One `keyboard.registerTarget` on the display object that holds the slots. The page reads the arrow keys, Home, End, Page Up and Page Down from its key events and moves the cursor; it takes them also at an edge, so the page does not scroll |
| Enter and Space | `createControlKeys` of kind `'action'` on the same display object |
| A slot under a pointer | A `createHoverControl` and a `createActionControl` each. A press moves the cursor and gives the bag the focus without a ring |
| The cursor | A frame behind its slot: bright while the keyboard shows where the focus is, quiet otherwise |
| The text that changes | One text field for each glyph, count and line; a line that changes again while it is being prepared is prepared once more, with what it says last |
| Semantics | A `grid` with `extent`, four `row` nodes with their `position`, and twenty-four `gridcell` nodes that say `selected` and their column. The cell under the cursor is the focused node while the bag has the focus. The panel is a `group` of `text`, the line a `status`, and the buttons are `button` nodes |

**One stop, not twenty-four.** Tab moves between the bag and the buttons. Inside the bag the arrow keys move, which is what a grid is to a keyboard. The projection names the cell under the cursor as the active descendant of the canvas.

**An empty slot is a cell too.** It has a name that says it is empty, and the cursor can stand on it, so the shape of the bag is the same to every reader.

See the guides for [semantics](../../knowledge-base/en/docs/ui-semantics.md#a-grid), [control state](../../knowledge-base/en/docs/ui-controls.md) and [the keyboard](../../knowledge-base/en/docs/keyboard-focus-input.md).

## Check

```text
node examples/ui-inventory/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the grid the browser computes at the start, with its counts and indices, and the paints of the start state read from the screen; presses that move the cursor, and the buttons using, dropping and sorting; the keyboard alone, with every key of the cursor at and away from the edges, an item that cannot be used, the buttons entering and leaving the Tab order, the page not scrolled, and Tab leaving the canvas past the last stop; the status line watched in the page, whose text changes inside an element that was already there; requests of assistive technology on cells and buttons; and a phone profile. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. An item is not dragged from one slot to another, stacks are not split or merged, and the bag does not scroll: it has as many rows as show.
