# Semantics of a drawn UI

English | [简体中文](../../Cns/docs/ui-semantics.md)

A canvas is one picture to assistive technology. `@egret/engine/ui/semantics` holds a description of the controls an application draws on it: what each one is, what it is called and what state it is in. `@egret/engine/web/semantics` projects that description to the page, where a screen reader, voice control or a switch finds it. Both belong to M3.4, [#90](https://github.com/cnedwin/Egret_rebuild/issues/90).

The description is not a second copy of the UI. Each node reads the control that is drawn, every time the tree is published, and its actions are the ones a press and a key already reach.

**What is checked and what is not.** The tree and the projection are checked in Node and in headless Chromium with software WebGL2, against the accessibility tree that browser computes. No screen reader or other assistive technology was run, and no other browser. See [What was run](#what-was-run).

## The tree

```js
import { createUiSemantics, semanticBoundsOf } from '@egret/engine/ui/semantics';

const semantics = createUiSemantics();
semantics.add({
  id: 'sound', role: 'switch',
  describe: () => ({ name: 'Sound', bounds: semanticBoundsOf(soundSprite), checked: sound.checked, disabled: !sound.enabled, focused: keyboard.getSnapshot().focusedId === 'sound' }),
  onActivate: () => sound.toggle(),
  onFocus: () => keyboard.focus('sound', { visible: true }),
});
// After the frame that shows the same state:
semantics.publish();
```

`add` takes an id, a role, the id of the node it is inside if there is one, and `describe`. It returns a handle whose `remove()` takes the node out together with everything inside it. `publish()` calls every `describe`, checks what they return and replaces `semantics.snapshot` with one frozen snapshot. Nothing is published by adding or removing.

A publication that fails publishes nothing: the snapshot before it stays whole. A publication equal to the last returns that same snapshot, and a node nothing changed in is the same object from one snapshot to the next, so a reader of the snapshot can compare by identity.

`describe` may read anything. It may not add, remove, publish, perform or dispose: each is refused with `UI_SEMANTICS_REENTRANT`.

`semanticBoundsOf(displayObject)` measures the rectangle on the stage that encloses a display object and what it holds. Bounds are in the logical coordinates of the stage, the ones picking uses.

### Roles

The set is the first control set of the UI. A role that is not listed is refused.

| Role | For | State it has | Must be inside |
| --- | --- | --- | --- |
| `group` | A panel | `disabled` | |
| `image` | A picture that means something | | |
| `text` | A label or a paragraph; `name` is the text | | |
| `button` | A push button | `disabled`, `expanded` | |
| `checkbox` | A box that is checked, unchecked or `'mixed'` | `checked` (required), `disabled` | |
| `switch` | An on or off switch | `checked` (required), `disabled` | |
| `radiogroup` | One choice of several | `disabled` | |
| `radio` | One of those choices | `checked` (required), `disabled`, `position` | `radiogroup` |
| `listbox` | A list with one selection | `disabled` | |
| `option` | An item of that list | `selected` (required), `disabled`, `position` | `listbox` |
| `list` | A list of rows | | |
| `listitem` | A row | `position` | `list` |
| `scrollbar` | The scroll position of a viewport | `range` (required), `orientation`, `controls`, `disabled` | |
| `dialog` | A dialog | `modal` | |
| `textbox` | A text field that is not being edited | `value`, `multiline`, `disabled` | |

Every node has `bounds`, and may have `name`, `hidden`, `focused` and `order`. A name is required except on `group`, `radiogroup`, `listbox`, `list` and `listitem`. `image`, `text`, `button`, `checkbox`, `switch`, `radio`, `option`, `scrollbar` and `textbox` are read as one thing and hold no nodes.

State a role does not have is refused, so a mistake is found when it is made. A refused description throws `UI_SEMANTICS_DESCRIPTION`, and its `cause` names the node and the field: `sound: checked`.

### Order, hiding and virtual rows

Nodes of one parent are read in the order of `order`, lowest first, and nodes with equal `order` in the order they were added. A hidden node is left out with everything inside it, and what is inside it is not asked.

A virtual list publishes the rows it has realized, never the records it has not. Each row gives `position: { index, size }` with its index in the whole list and the size of the whole list, and `order` equal to its index:

```js
semantics.add({ id: 'row-' + key, role: 'listitem', parent: 'messages',
  describe: () => ({ bounds: semanticBoundsOf(row), order: index, position: { index: index + 1, size: records.length } }) });
```

A tree holds at most 256 nodes unless `maxNodes` says otherwise, and never more than 4,096.

### A managed virtual list

The rows of a [managed UI](ui-data-panel.md) come and go with every commit of its root. `createUiListSemantics` keeps the nodes in step: one for the list, and one for each row that shows.

```js
import { createUiListSemantics } from '@egret/engine/ui/semantics';

const rows = createUiListSemantics({
  semantics, root, list: 'messages', role: 'listbox', name: 'Messages', focusable: true,
  describeRow: (key, index) => ({ name: titles[index], selected: key === chosen }),
  onActivateRow: key => choose(key),
});
// After root.commit(...), with the frame that shows the same rows:
semantics.publish(rows.sync());
```

`root` is the root `createUiRoot` returned and `list` is the id of the virtual list in its tree. `sync()` reads what the root committed: it removes the nodes of the rows that no longer show, moves those that stayed, adds those that show now, and returns the committed revision, which is what `publish` takes. A commit alone changes nothing in the tree.

- **Places.** A row's bounds are the part of it the list shows, on the stage. Its `position` is its index in the whole list and the number of records, and its `order` is its index.
- **Roles.** `'list'` publishes list items, which may hold other nodes; `'listbox'` publishes options, which need a name from `describeRow`. An option that does not say is not selected.
- **Ids.** The list node is `id`, by default the id of the root, a slash and the id of the list. A row adds a slash and its key, and `rows.rowId(key)` says it.
- **Focus.** The row that holds the focus of the root is the focused node. With `focusable: true` a row can be asked to take the focus, which needs a root with a keyboard. A row that scrolls away loses the focus in the root and its node in the tree together, so a projection never names an element that does not exist.
- **Nodes inside a row.** `onRowAdded(key, id)` is called after the node of a row was added. Nodes added there with `parent: id` go when the row does, and the callback is called again when the row is realized again.
- **Room.** The rows that left are removed before the new ones are added, so a page of new rows needs no room beside the old. When the tree still refuses a row, `sync()` throws that refusal and adds none of the new rows; what stays in the tree is true of the commit.

`dispose()` removes the list node and every row. The helper adds no listener and changes nothing in the root except the focus a row is asked to take. A root of the application's own is read the same way if it has `id`, `snapshot()` and `list(id)` in the shape of `SemanticListSource`.

### Focus

`focused: true` marks the node that holds the keyboard focus of the application. One node may hold it. A second is refused with `UI_SEMANTICS_FOCUS`.

### Modal dialogs

While a dialog with `modal: true` is published, every node outside it is `inert` in the snapshot, except the nodes the dialog is inside. An inert node refuses every action. If several modal dialogs are published, the one read last is the one in front. A focused node that is inert is refused: the focus belongs inside the dialog.

### Relations

A `scrollbar` may name the node it scrolls with `controls`. The named node must be published in the same snapshot, or the publication is refused with `UI_SEMANTICS_RELATION`.

### Actions

`semantics.perform(id, 'activate')` and `perform(id, 'focus')` call `onActivate` and `onFocus` of the node as it was last published. It returns false, and calls nothing, when the node is not published, was removed since, is disabled or inert, or has no handler for the action. An id that was removed and used again is not performed until it is published again.

A handler that throws is not caught: the error is the caller's.

### Listening and closing

`observe(listener)` is told `(snapshot, previous)` after each publication that differs. A listener that throws does not undo the publication: the others are still told, and `publish` then throws `UI_SEMANTICS_LISTENER_FAILED` with the first failure as its cause. A listener may add and remove nodes for the next publication. It may not publish.

`dispose()` lets go of every node and tells `onClose` listeners. Afterwards `add` and `publish` throw `UI_SEMANTICS_CLOSED` and `perform` returns false. The tree holds no state of the controls and belongs to no scope: dispose it with the screen it describes.

`publish(layoutRevision)` records the layout revision the bounds belong to. It may not go down.

## The projection

```js
import { createBrowserSemantics } from '@egret/engine/web/semantics';

const projection = createBrowserSemantics({ semantics, canvas, width: 480, height: 300, label: 'Outfit Studio' });
```

`width` and `height` are the logical size the bounds are given in. The projection puts an invisible container after the canvas, laid over it, with one element for each published node, and follows every publication. It writes only what changed.

- **The canvas keeps the keyboard.** The canvas gets `role="application"`, the label, and `aria-owns` naming the container, so the nodes are read as what is inside it. The node that is `focused` is named by `aria-activedescendant`. No element of the projection is a Tab stop: the keys of the application go on working exactly as they did.
- **Elements.** `button`, `checkbox`, `switch`, `radio` and `option` are native buttons carrying their role. The rest are plain elements with a role, and `text` is its text. State is written as the ARIA attribute of that state: `aria-checked`, `aria-selected`, `aria-expanded`, `aria-disabled`, `aria-modal`, `aria-multiline`, `aria-valuenow` with its bounds, `aria-orientation`, `aria-controls`, `aria-posinset` and `aria-setsize`. The outermost inert element gets the `inert` attribute, and the page keeps everything under it away from every user.
- **Geometry.** Each element lies over the control it describes, so a reader's highlight and exploration by touch find it where it is drawn. The container holds logical units and one scale maps it onto the rectangle of the canvas. It follows a resize, a scroll and a change of the visual viewport. `projection.sync()` measures again after a change of layout that came with no event. While the canvas has no size the projection is hidden.
- **Pointers go through.** The container takes no pointer. A mouse or a finger meets the canvas as before.
- **Requests.** A click made of an element, the way an accessibility interface makes it, performs `activate`. A request to focus an element performs `focus`, and the focus of the page is given back to the canvas.

A handler that throws is reported to `onError` and the projection goes on. A failure of the page stops the projection and is reported; the publication it failed in stands. Without `onError` both are reported to the page as uncaught errors. `projection.dispose()` removes the container and the listeners and gives the canvas back the attributes it set. The projection closes with its tree.

The application may set `role`, `aria-label` or `aria-owns` on its canvas first. The projection leaves the first two as they are and adds its container to the third.

One canvas has one projection: a second is refused with `UI_SEMANTICS_SURFACE_BUSY`. A canvas that is not in the page, has no size, or is under a transform or a zoom is refused with `UI_SEMANTICS_SURFACE_INVALID`, the same profile as the other browser adapters.

### A text field

A `textbox` node describes a field that is not being edited: its `name` and its `value`. `onActivate` opens the [native editor](native-text-editing.md). While the editor is open it is the field's node, so describe the `textbox` as `hidden` until the editor closes. Nothing is then announced twice.

## Keys

The projection adds no key handling. Keys arrive through the [keyboard input](keyboard-focus-input.md) as before and reach the same methods the nodes call: Space or Enter for a button, a switch and a checkbox; the arrow keys, Home and End inside a radio group or a listbox, where the focus follows the selection. [`createControlKeys`](ui-controls.md#keys) binds them, and the [example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-controls) uses it.

## What was run

| Check | Where | Result |
| --- | --- | --- |
| The tree: 19 cases | Node | Pass |
| The projection against a stand-in for the page: 13 cases | Node | Pass |
| A strict TypeScript consumer of both entries, with nine refused misuses | Node | Pass |
| The example page: the computed accessibility tree, the active descendant under Tab and the arrow keys, each element over its control, requests made of the elements, a phone profile | Headless Chromium 153, software WebGL2, injected input | Pass, 4 scenarios beside the 6 of the controls |
| The rows of a managed list: 12 cases on a genuine Engine and a genuine UI root, with a strict TypeScript consumer and six refused misuses | Node | Pass |
| [The list example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-list-semantics): the list box the browser computes for 8 of 50,000 rows, the active descendant through recycled rows, a jump to row 40,000, a scroll away from the focus, requests made of the options, a scaled and scrolled page, a phone profile | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |

Not run: a screen reader, voice control, switch access or any other assistive technology; a person; Edge as installed; Firefox; Safari; a real phone, where exploration by touch depends on the platform's accessibility service; hardware GPUs and WebGPU. A passing accessibility tree is not proof that the UI is usable with a screen reader.

Run a page check with `node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> software`, or the same with `examples/ui-list-semantics/verify.mjs`. Without `software` it launches the installed Edge headed.

Operator faults were written into the built list helper one at a time: 61, and the cases caught all of them.

## Not in this slice

- Roles beyond the first control set: menus, tabs, sliders, trees, grids, headings and live regions.
- Descriptions, error text and labelling one node by another.
- Wiring to the layer manager and to the leaves of the managed UI outside a virtual list. The application adds and removes those nodes. The rows of a virtual list have [a helper](#a-managed-virtual-list).
- A list with several selected rows, and rows in a grid.
- A projection of the native editor itself. The editor is its own element.
