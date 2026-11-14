# A tree that opens and closes

English | [简体中文](README.zh-CN.md)

A sect of four halls, each with two squads of five members: fifty-two items, of which only those show whose every ancestor is open. What shows is a managed list, so there are rows only for what shows. A press opens or closes a hall or a squad and selects what is pressed; the arrow keys move through the items and into and out of them. To assistive technology it is a tree under a heading.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-tree/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press **乙队 / Second squad**. It opens: its five members appear under it, and it is selected. Press it again and it closes. An item with items under it carries a bar while it is open and a cross while it is closed.
- Press a member. It is selected; it has nothing to open.
- Press **丹房 / Alchemy**. The hall closes over everything under it. Opened again, the squad that was open in it is open still.
- Click the canvas, then use the keyboard alone. Tab goes to the tree. Up and Down, Page Up, Page Down, Home and End move through the items that show. Right opens an item that is closed and goes to the first item under one that is open. Left closes an item that is open and goes to the item above any other. Space or Enter selects.
- Open several halls: the tree is longer than its window, and the wheel and the scroll bar move it.

## How it works

| Part | From |
| --- | --- |
| The sect | A map of fifty-two items in the application, each with its name, its depth, the item it is under and the items under it, and a set of the items that are open |
| What shows | The items whose every ancestor is open, in order, as the records of a virtual list of `createUiRoot`. Opening or closing one gives the list a new source; the list keeps the row at its top in view |
| A row | Is bound once for its item. Whether the item is open is painted, not bound, and where it stands is read from the order when a key needs it |
| A press | `context.target` of the binding with a `createHoverControl` and a `createActionControl` |
| Keys | `createControlKeys` of kind `'action'` on each row for Space and Enter; the page reads the arrow keys and the others from the key events of the row. `keyboard.tabStop` makes the tree one stop |
| An item that closes over the focus | Takes the focus: the row that held it is gone, and the item is revealed and focused after the commit |
| The scroll bar | `createScrollControl`, told the new length of what shows with `setLengths` after each commit |
| Semantics | `createUiListSemantics` with `role: 'tree'`: `describeRow` says the `level` of each item, `expanded` where it has items under it, `selected`, and its `position` among the items under the same item. The title is a `heading` of level one |

**Every item is directly inside the tree.** How deep an item is, is said by its level and not by nesting, which is what lets the rows of a list be the items of a tree.

**Its place is among its own.** The second squad of a hall is the second of two, whatever row of the list it is in.

See the guides for [semantics](../../knowledge-base/en/docs/ui-semantics.md#a-tree), [the managed list](../../knowledge-base/en/docs/ui-data-panel.md) and [control state](../../knowledge-base/en/docs/ui-controls.md).

## Check

```text
node examples/ui-tree/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the heading and the tree the browser computes at the start, with the depth, the opening and the place of each item, and the start state read from the screen; presses that open, close and select, with a hall closed over what was open under it; the keyboard alone, with every key into and out of items, and Tab leaving the canvas; an item closed by the pointer over the focus, and the tree scrolling once it is longer than its window; requests of assistive technology; and a phone profile. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. A press on an item with items under it always opens or closes it: there is no separate mark to press. Several items are not selected at once, an item is not found by typing its first letters, and a finger does not pan the rows.
