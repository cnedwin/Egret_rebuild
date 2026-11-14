# A menu for a row

English | [简体中文](README.zh-CN.md)

A roster of forty members in a managed list, each with a menu of three actions: promote, demote and rest. The menu is a second managed root shown as a popup that hangs from the end of its row. The right mouse button, the Menu key, Shift+F10, a button and a request of assistive technology all open it through the same function.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-context-menu/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press a member with the left button: it is selected. Press one with the right button: it is selected and its menu opens under the end of its row, or above it near the bottom.
- Press an action. The member changes, the row says so, and the menu closes. A member of the outer rank cannot be demoted and one of the top rank cannot be promoted: that item is dimmed and a press on it does nothing.
- Press anywhere else while the menu is open. The menu closes and the press reaches nothing behind it.
- Click the canvas, then use the keyboard alone. Tab enters the roster and the arrow keys move the focus; Space or Enter selects. The Menu key, or Shift with F10, opens the menu of the focused row with the focus on the first action that can act. The arrow keys go round the items, Home and End go to the ends, Enter or Space acts, and Escape closes. The focus is then on the row again.
- Tab on to **操作 / Actions**. It opens the menu of the selected member, bringing its row back into view if it was scrolled away. This is the way in for a finger, which has no right button.
- Turn the wheel while the menu is open until its row leaves the list: the menu closes.

## How it works

| Part | From |
| --- | --- |
| The roster | `createUiRoot` with a virtual list of forty records, and `keyboard.tabStop` so that it is one stop |
| Which button pressed a row | `onRowPointer` of the root. The notification carries the contact, and `event.payload.buttons & 2` says that the secondary button is down |
| The page's own menu | The canvas prevents the default of `contextmenu`, or the menu of the browser would cover the one that is drawn |
| The menu | A second `createUiRoot` with a virtual list of three records, registered with `createUiLayerManager` as a `popup` each time it opens, with `anchor: { root, target: { kind: 'row', listId, key }, align: 'end' }`, `closeOnEscape` and `initialFocus` on the first action that can act |
| The items | `context.target` of each binding with a `createHoverControl` and a `createActionControl`; `createControlKeys` of kind `'action'`; the arrow keys call `list.focus` |
| An action | A new source whose record has another `contentVersion`: that row is bound again with its new text. Then `layers.close` |
| The Menu key | Read from the key events of the row by the page: `ContextMenu`, or `F10` with Shift |
| Semantics | The roster is a `listbox`. The menu is `createUiListSemantics` with `role: 'menu'`, hidden until the layer is open; each item says `disabled` while it has nothing to do. The button says `expanded` while the menu is open |

**The layers are changed outside the input.** A press and a key arrive inside a routed callback, where a layer may not be registered or opened. Opening is therefore queued behind the commits that are under way.

**An item that cannot act keeps its keys.** A binding whose control is disabled takes no key, and Space left to the page scrolls it. The item keeps its binding and does nothing when it is activated.

**The menu belongs to its row.** It is anchored to the row, not to a point, so it follows the row and is closed by the layers when the row leaves the list.

See the guides for [semantics](../../knowledge-base/en/docs/ui-semantics.md#a-menu), [layers](../../knowledge-base/en/docs/ui-layers.md), [the managed list](../../knowledge-base/en/docs/ui-data-panel.md) and [control state](../../knowledge-base/en/docs/ui-controls.md).

## Check

```text
node examples/ui-context-menu/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the tree the browser computes while the menu is closed; the right button, with the page's own menu prevented, the place of the menu under and above its row, an item that is dimmed and refuses, an action, and a press elsewhere; the keyboard alone, with the Menu key, Shift+F10, the items going round, Escape, and the button; a selected row that was scrolled away and is brought back, and a menu that closes when its row leaves; requests of assistive technology; and a phone profile, where a finger selects and uses the button. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a long press, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. A long press of a finger does not open the menu: a finger uses the button. There are no submenus, no items that are checked, and no first letters that jump to an item.
