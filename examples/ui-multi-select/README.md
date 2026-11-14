# Several of a list

English | [简体中文](README.zh-CN.md)

A roster of forty members in a managed list, of whom any number are chosen and then sent out. The choice is a set of keys the application keeps; the list has rows only for what shows. A press, the keyboard and a request of assistive technology all flip one member through the same function.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-multi-select/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press several members. Each press chooses one more or lets one go; the others stay as they are.
- Click the canvas, then use the keyboard alone. Tab enters the roster; the arrow keys, Page Up, Page Down, Home and End move the focus and leave the choice alone; Space or Enter flips the row that holds the focus. Held with Shift, a movement key chooses every member from the row it leaves to the row it reaches, and Control+A chooses everyone who is here. Tab goes on to the three buttons.
- **全选 / All** chooses everyone who is here, **清除 / Clear** nobody. A button that has nothing to do is disabled.
- **派遣 / Send** sends the chosen members out. Their rows say so, are dimmed, and can no longer be chosen.
- Turn the wheel or drag the thumb of the scroll bar. Members who were chosen stay chosen while their rows are not there.

## How it works

| Part | From |
| --- | --- |
| The roster | `createUiRoot` with a virtual list of forty records |
| The choice | A `Set` of keys in the application. A row paints itself from it when it is bound and whenever the screen is painted |
| The pointer on a row | `context.target` of the binding, with a `createHoverControl` and a `createActionControl`. They are disabled on a row whose member is away |
| Keys | `createControlKeys` of kind `'action'` on each row; the arrow keys reveal and focus the next row. `keyboard.tabStop` makes the roster one stop. Shift and Control+A are read from the key events of the row by the page itself |
| A member who is sent | A new source whose record has another `contentVersion`: that row is bound again with its new text |
| Semantics | `createUiListSemantics` with `role: 'listbox'` and `multiple: true`; each row says `selected` and `disabled`. The count is a `text` node, and a `scrollbar` names the roster |

**The keys of a row that is away are still taken.** A binding whose control is disabled takes no key, and Space left to the page scrolls it. The row therefore keeps its binding and its activation does nothing.

**A button that is disabled under the focus gives it away.** After a send nothing is chosen, so the button that was just pressed has nothing more to do; the page moves the focus to a button that can act.

See the guides for [the managed list](../../knowledge-base/en/docs/ui-data-panel.md), [control state](../../knowledge-base/en/docs/ui-controls.md) and [semantics](../../knowledge-base/en/docs/ui-semantics.md).

## Check

```text
node examples/ui-multi-select/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the list box the browser computes, with `aria-multiselectable`; presses that choose several members and let one go, the send, and the three buttons, with the paints read from the screen; the keyboard alone; runs chosen with Shift and everyone with Control+A; requests of assistive technology; and a phone profile, where a finger drags the scroll bar to reach more members. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. A run chosen with Shift only adds members: it has no anchor and lets nobody go, and a press with Shift is a press like any other. A finger does not pan the rows.
