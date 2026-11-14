# Screens to start from

English | [简体中文](../../Cns/docs/ui-examples.md)

The UI of this engine is drawn by the application: the engine gives it layout, lists, layers, the state of controls, keys and a description for assistive technology, and the application paints. Each example below is one such screen, small enough to read in a sitting and checked in a real browser. This page says which one to start from. They belong to M3.3 and M3.4, [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) and [#90](https://github.com/cnedwin/Egret_rebuild/issues/90).

**What is checked and what is not.** Every example has a check that drives it in headless Chromium with software WebGL2 and injected input. None was run by a person, with a physical mouse, finger or keyboard, with a screen reader, on a hardware GPU or on a real phone. Each README says what its own check covers.

## By what the screen is

| A screen with | Start from | It shows | Guide |
| --- | --- | --- | --- |
| Buttons, a switch, one choice of several | [Control states](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/README.md) | Every state of a control painted from a theme, and the keys of each | [Control state](ui-controls.md) |
| Fields a player types into | [Text fields](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/README.md) | A name and a motto edited with the platform's own input, so every input method works | [Control state](ui-controls.md#text-field) · [Text input](text-input.md) |
| Settings | [Settings screen](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.md) | A switch, options, a field, a slider, two themes, a list of profiles and a dialog that asks before it resets, on one screen | [Control state](ui-controls.md) · [Layers](ui-layers.md) |
| Several panels, one at a time | [Tabs and progress](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.md) | Tabs as one keyboard stop, their panels, and progress bars | [Semantics](ui-semantics.md#tabs-and-progress) |
| A very long list | [List semantics](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-list-semantics/README.md) | Fifty thousand rows of which eight exist, one selection, and details in a modal layer | [Managed UI](ui-data-panel.md) · [Semantics](ui-semantics.md#a-managed-virtual-list) |
| A list where each row has a choice | [Dropdown in a list](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.md) | A popup anchored to a row of a scrolling list, with rows that light up under a pointer | [Layers](ui-layers.md) · [Rows](ui-controls.md#rows-of-a-managed-list) |
| A list where each row has several actions | [A menu for a row](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-context-menu/README.md) | A menu from the right button, the Menu key or a button, with actions that are disabled | [Semantics](ui-semantics.md#a-menu) |
| A list from which several are chosen | [Several of a list](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.md) | A set of chosen rows, runs with Shift, everyone with Control+A, and a button that acts on the set | [Semantics](ui-semantics.md#a-managed-virtual-list) |
| A table that sorts | [A table that sorts](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-roster-table/README.md) | Headers that sort a managed list one way and the other, and a selected row kept through a new order | [Semantics](ui-semantics.md#a-table-of-a-managed-list) |
| Things with parts that have parts | [A tree that opens and closes](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tree/README.md) | Items that open and close, of which the list holds only what shows | [Semantics](ui-semantics.md#a-tree) |
| A bag, a store, a board | [A bag of items](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-inventory/README.md) | Slots in rows and columns with a cursor moved in two directions, and what the item under it is | [Semantics](ui-semantics.md#a-grid) |
| Amounts shared out of a total | [Amounts in steps](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.md) | Amounts raised and lowered by steps, what is left, and a message when a change is refused | [Semantics](ui-semantics.md#messages) · [Control state](ui-controls.md#value-in-a-range) |
| Buttons that light up, a list the wheel scrolls | [Hover and wheel](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/README.md) | Hover of a mouse or a pen, the wheel and a scroll bar | [Hover and wheel](pointer-hover.md) |

## What they have in common

- **One function for each thing that can happen.** A press, a key and a request of assistive technology reach the same function of the application, so the three cannot disagree.
- **The application keeps the state that is its own.** Which rows are chosen, where a cursor is, which items are open: a set, a number, a map. A control of the engine holds only what a control is, such as pressed, hovered or checked.
- **A row holds what it shows.** A managed list has rows only for what shows and reuses them. What a row is, is read from the application when the row is bound, painted or asked.
- **Semantics are read, not copied.** Each node of the [semantic tree](ui-semantics.md) describes the control that is drawn each time the tree is published.

## Before a screen is done

Each of these was a defect in one of the examples, found by looking or by walking the keyboard, and each is now part of a check.

- **Look at the first frame.** Before any input, the screen shows what it should and nothing else. A popup that was never opened is not there.
- **A popup or a modal is a layer from the start.** Register it with the [layer manager](ui-layers.md) when its root is made, closed. A root that is not a layer is an ordinary root: it is drawn where it stands and its rows are keyboard stops.
- **Walk Tab from the first stop past the last.** It reaches every control that can act, skips every control that cannot, and then leaves the canvas.
- **A disabled control is no stop.** Call `update({ disabled: true })` on what `keyboard.registerTarget` returned, after the key that disabled it, and move the focus first if the control held it. See [Keys](ui-controls.md#keys).
- **Say where a list should be after a new order.** `setSource` and then `setScrollOffset`: a [list keeps its anchor in view](ui-data-panel.md) unless it is told.
- **A message is in the tree before it has anything to say.** Publish a `status` or an `alert` from the start, empty, and change its text. See [Messages](ui-semantics.md#messages).
- **A key that is the control's is taken also at its edge.** An arrow at the last row, or Space on a row that cannot act, is still not the page's to scroll with.

## What none of them does

- A finger does not pan a list; it drags the scroll bar. A long press does nothing. Nothing is dragged from one place to another. Gestures are open under #90.
- No example was run on a real phone, on a hardware GPU, in Firefox or Safari, or with a screen reader. Those runs are open under #89 and #90.
- A mask or a blur over a whole root or layer is not part of these screens.
