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
| `listbox` | A list with a selection: one option, or several with `multiple` | `multiple`, `disabled` | |
| `option` | An item of that list | `selected` (required), `disabled`, `position` | `listbox` |
| `list` | A list of rows | | |
| `listitem` | A row | `position` | `list` |
| `scrollbar` | The scroll position of a viewport | `range` (required), `orientation`, `controls`, `disabled` | |
| `slider` | One value out of a range | `range` (required), `orientation`, `disabled` | |
| `spinbutton` | One value changed by steps | `range` (required), `disabled` | |
| `progressbar` | How far some work has come | `range`; without it the length of the work is not known | |
| `tablist` | A row of tabs | `orientation`, `disabled` | |
| `tab` | One of those tabs | `selected` (required), `controls`, `position`, `disabled` | `tablist` |
| `tabpanel` | What a tab shows | | |
| `menu` | A menu of actions | `orientation`, `disabled` | |
| `menuitem` | One of those actions | `disabled`, `position` | `menu` |
| `grid` | Cells in rows and columns | `extent`, `multiple`, `disabled` | |
| `row` | One row of a grid | `position`, `selected`, `disabled` | `grid` |
| `gridcell` | One cell of a row | `selected`, `disabled`, `position` | `row` |
| `columnheader` | The header of a column, in a row of headers | `sort`, `position`, `disabled` | `row` |
| `tree` | Items under items, some of which open and close | `multiple`, `disabled` | |
| `treeitem` | One of those items | `level` (required), `expanded`, `selected`, `position`, `disabled` | `tree` |
| `heading` | A title of what follows it | `level` | |
| `dialog` | A dialog | `modal` | |
| `textbox` | A text field that is not being edited | `value`, `multiline`, `disabled` | |
| `status` | A message that is said when it changes, after what is being said | | |
| `alert` | A message that is said at once | | |

Every node has `bounds`, and may have `name`, `hidden`, `focused` and `order`. A name is required except on `group`, `radiogroup`, `listbox`, `list`, `listitem`, `tablist`, `menu`, `grid`, `row` and `tree`, and on `status` and `alert`, whose name is the message and may be empty. `image`, `text`, `button`, `checkbox`, `switch`, `radio`, `option`, `scrollbar`, `slider`, `spinbutton`, `progressbar`, `tab`, `menuitem`, `gridcell`, `columnheader`, `treeitem`, `heading`, `textbox`, `status` and `alert` are read as one thing and hold no nodes.

A `slider` and a `tablist` lie along the line unless `orientation` says `'vertical'`; a `scrollbar` stands beside what it scrolls, and the items of a `menu` stand one under another, unless it says `'horizontal'`. A slider and a spin button are moved by [their keys](ui-controls.md#keys) once they hold the focus, so their nodes take `onFocus` and need no activation.

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
- **Roles.** `'list'` publishes list items, which may hold other nodes; `'listbox'` publishes options, which need a name from `describeRow`. An option that does not say is not selected. With `multiple: true` the list box says that several options may be selected at once; each option still says whether it is, and the application keeps the set of selected keys, because the list has rows only for what shows. The [multiple selection example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-multi-select) does this. `'menu'` publishes menu items, which need a name as options do and are never selected. `'grid'` publishes the rows of [a table](#a-table-of-a-managed-list), and `'tree'` the items of [a tree](#a-tree).
- **Ids.** The list node is `id`, by default the id of the root, a slash and the id of the list. A row adds a slash and its key, and `rows.rowId(key)` says it.
- **Focus.** The row that holds the focus of the root is the focused node. With `focusable: true` a row can be asked to take the focus, which needs a root with a keyboard. A row that scrolls away loses the focus in the root and its node in the tree together, so a projection never names an element that does not exist.
- **Nodes inside a row.** `onRowAdded(key, id)` is called after the node of a row was added. Nodes added there with `parent: id` go when the row does, and the callback is called again when the row is realized again.
- **Room.** The rows that left are removed before the new ones are added, so a page of new rows needs no room beside the old. When the tree still refuses a row, `sync()` throws that refusal and adds none of the new rows; what stays in the tree is true of the commit.

`dispose()` removes the list node and every row. The helper adds no listener and changes nothing in the root except the focus a row is asked to take. A root of the application's own is read the same way if it has `id`, `snapshot()` and `list(id)` in the shape of `SemanticListSource`.

### Boxes and layers of the managed UI

`semanticBoxOf(root, id)` is the rectangle on the stage of a box the root laid out: a leaf, a row, a column or a list, by its id in the tree of the root. It is read from the last commit when it is called, so call it from `describe`. A box the root has not laid out has no size.

A popup or a modal of the [layer manager](ui-layers.md) is a node of the application's own. It reads the layer: hidden while the layer is closed, and modal when the layer is.

```js
import { semanticBoxOf } from '@egret/engine/ui/semantics';

const layer = () => layers.snapshot().layers.find(found => found.id === 'details');
semantics.add({ id: 'details', role: 'dialog',
  describe: () => ({ name: 'Details', modal: true, hidden: !layer().visible, bounds: semanticBoxOf(card, 'card') }) });
semantics.add({ id: 'details/close', role: 'button', parent: 'details', onActivate: close,
  describe: () => ({ name: 'Close', bounds: semanticBoxOf(card, 'close'), focused: keyboard.getSnapshot().focusedId === 'details-close' }) });
```

A managed list inside such a layer takes `hidden` in `createUiListSemantics`: `hidden: () => !layer().visible`. While it says so the list is left out with its rows, and the rows are not asked. The jobs of the [dropdown example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-dropdown) are a `listbox` of this kind, in the tree only while their popup is open.

Nothing more is needed for the rest. The layer manager moves the root when it places the layer, so the box follows. It moves the focus into the layer and back, and the nodes read the focus. While a modal dialog is published the tree makes [everything outside it inert](#modal-dialogs), which is what the manager's barrier does to a press. Publish after `layers.sync()`.

### Focus

`focused: true` marks the node that holds the keyboard focus of the application. One node may hold it. A second is refused with `UI_SEMANTICS_FOCUS`.

### Modal dialogs

While a dialog with `modal: true` is published, every node outside it is `inert` in the snapshot, except the nodes the dialog is inside. An inert node refuses every action. If several modal dialogs are published, the one read last is the one in front. A focused node that is inert is refused: the focus belongs inside the dialog.

### Relations

A `scrollbar` may name the node it scrolls with `controls`, and a `tab` the `tabpanel` it shows. The named node must be published in the same snapshot, or the publication is refused with `UI_SEMANTICS_RELATION`. A panel that is not shown is usually hidden or not there at all, so only the selected tab names one.

### Tabs and progress

A row of tabs is a [selection group](ui-controls.md#one-of-several) to the application and a `tablist` to a reader. Each `tab` says whether it is `selected`, and the selected one names its `tabpanel`:

```js
semantics.add({ id: 'tabs', role: 'tablist', describe: () => ({ name: 'Sect', bounds: stripBounds }) });
for (const [index, key] of keys.entries()) semantics.add({ id: 'tab-' + key, role: 'tab', parent: 'tabs',
  onActivate: () => { group.select(key); },
  onFocus: () => { group.select(key); keyboard.focus('tabs', { visible: true }); },
  describe: () => ({ name: names[key], bounds: boxes[key], selected: group.selected === key, position: { index: index + 1, size: keys.length },
    focused: keyboard.getSnapshot().focusedId === 'tabs' && group.selected === key,
    ...(group.selected === key ? { controls: 'panel-' + key } : {}) }) });
for (const key of keys) semantics.add({ id: 'panel-' + key, role: 'tabpanel',
  describe: () => ({ name: names[key], hidden: group.selected !== key, bounds: panelBounds }) });
```

The tabs are [one keyboard stop](ui-controls.md#keys) with the keys of a selection: the arrow keys move the selection and the panel follows it, so a tab that is asked to take the focus is selected with it. What a panel holds is added under its node and is hidden with it.

A `progressbar` reports and takes no action. With a `range` it says how far the work has come; without one it says that work is under way and its length is not known.

### A menu

A menu of actions for something is a `menu`, and each action a `menuitem` that is activated as a button is. An item that has nothing to do says `disabled` and stays in the menu, so the menu reads the same wherever it is opened. Nothing in a menu is selected.

A menu is usually a popup of the [layer manager](ui-layers.md) that holds a managed list, so it is a list with `role: 'menu'` that is [hidden](#boxes-and-layers-of-the-managed-ui) until its layer is open. A button that opens it says `expanded` while it is:

```js
const items = createUiListSemantics({ semantics, root: menu, list: 'actions', id: 'menu', role: 'menu', name: 'Actions', focusable: true,
  hidden: () => !layers.snapshot().openStack.includes('menu'),
  describeRow: key => ({ name: names[key], disabled: !can(key, member) }), onActivateRow: act });
semantics.add({ id: 'open', role: 'button', onActivate: open,
  describe: () => ({ name: 'Actions', bounds: buttonBounds, expanded: layers.snapshot().openStack.includes('menu') }) });
```

The keys are the application's, as everywhere: the arrow keys move the focus among the items and wrap, Enter or Space activates, and Escape closes through the layer, which gives the focus back to where it was. The [row menu example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-context-menu) opens one from the right mouse button, the Menu key, Shift+F10 and a button. Submenus, and items that are checked, are not in this slice.

### A grid

A `grid` is things in rows and columns that are reached in two directions: the slots of a bag, a board, a calendar. It holds `row` nodes and a row holds `gridcell` nodes. Where cells are what is selected, as here, each cell says whether it is `selected`; where rows are, each row says it and the cells say nothing of it:

```js
semantics.add({ id: 'bag', role: 'grid', describe: () => ({ name: 'Bag', bounds: bagBounds, extent: { rows: 4, columns: 6 } }) });
for (let row = 0; row < 4; row++) semantics.add({ id: 'bag/r' + row, role: 'row', parent: 'bag',
  describe: () => ({ bounds: rowBounds(row), position: { index: row + 1, size: 4 } }) });
for (let index = 0; index < 24; index++) semantics.add({ id: 'bag/' + index, role: 'gridcell', parent: 'bag/r' + Math.floor(index / 6),
  onActivate: () => moveTo(index),
  onFocus: () => { keyboard.focus('bag', { visible: true }); moveTo(index); },
  describe: () => ({ name: nameOf(index), bounds: cellBounds(index), selected: cursor === index, position: { index: index % 6 + 1, size: 6 },
    focused: keyboard.getSnapshot().focusedId === 'bag' && cursor === index }) });
```

`extent` is how many rows and columns the grid has in all. The `position` of a row says which row it is and that of a cell which column it is in, both counted from one. A reader needs them when not every row is published, and they cost nothing when all are. A cell has a name: an empty one says that it is empty.

A grid is one keyboard stop with a cursor of its own, as a row of tabs is one stop with its selection. The arrow keys move the cursor in two directions and stop at the edges; Home and End go to the ends of the row, and with Control to the ends of the grid. The cell under the cursor is the focused node, so a cell that is asked to take the focus gets the cursor and the grid the focus. The keys are the application's, and the [bag example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-inventory) binds them. Headers of rows and cells that span several are not in this slice.

### A table of a managed list

The rows of a [managed list](#a-managed-virtual-list) are the rows of a grid with `role: 'grid'`. The helper publishes the grid with its `extent` and one `row` for each row that shows, with its place among all the rows. The cells inside a row are the application's: they are added when the row is, and go with it. A row of headers above the list is the application's too, as a `row` of the same grid:

```js
const rows = createUiListSemantics({
  semantics, root, list: 'members', id: 'roster', role: 'grid', name: 'Roster', columns: 4, rowOffset: 1, focusable: true,
  describeRow: key => ({ selected: key === selected }), onActivateRow: select,
  onRowAdded(key, id) {
    for (const [at, column] of columns.entries()) semantics.add({ id: id + '/' + column.key, role: 'gridcell', parent: id, describe: () => {
      const part = rows.rowBounds(key);
      return { name: column.text(key), bounds: { x: part.x + column.x, y: part.y, width: column.width, height: part.height }, position: { index: at + 1, size: 4 }, order: at };
    } });
  },
});
semantics.add({ id: 'roster/head', role: 'row', parent: 'roster', describe: () => ({ bounds: headBounds, position: { index: 1, size: count + 1 }, order: -1 }) });
for (const [at, column] of columns.entries()) semantics.add({ id: 'roster/head/' + column.key, role: 'columnheader', parent: 'roster/head',
  onActivate: () => sortBy(column.key), onFocus: () => keyboard.focus('head-' + column.key, { visible: true }),
  describe: () => ({ name: column.name, bounds: column.headBounds, sort: sorted.column === column.key ? sorted.way : 'none', position: { index: at + 1, size: 4 } }) });
```

- **`columns`** is how many columns the grid has, and a grid needs it. **`rowOffset`** is how many rows the application publishes above the first row of the list, 0 unless said: with one row of headers the first record is the second row of the grid, and the grid has one row more than the list has records.
- **`rows.rowBounds(key)`** is the part of a row that the list shows, on the stage, as of the last `sync()`. A cell is measured from it, so a row that is cut by the edge of the list has cells that are cut the same way.
- **Rows are what is selected** when `describeRow` says `selected`: every row then says whether it is, and with `multiple: true` the grid says that several may be. Without it no row says anything of selection.
- **A header** is a `columnheader` in a row. `sort` says whether the rows are ordered by its column: `'ascending'`, `'descending'`, or `'none'` for a column they could be ordered by and are not. A header that does not say cannot be sorted by. It is activated as a button is.

When the order changes, give the list its records in the new order with `setSource` and then say where it should be, as with `setScrollOffset(0)`: [a list keeps its anchor in view](ui-data-panel.md) through a new source unless it is told otherwise. The [table example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-roster-table) sorts forty members by four columns this way.

### A tree

A `tree` is items under items: a sect, its halls and their members; folders; the branches of a skill. Every `treeitem` is a node directly inside the tree, and says with `level` how deep it is, from one. One that has items under it says whether they show with `expanded`; one that has none does not say. So the items that show can be the rows of a [managed list](#a-managed-virtual-list), which holds only what shows:

```js
semantics.add({ id: 'title', role: 'heading', describe: () => ({ name: 'Sect', level: 1, bounds: titleBounds }) });
const rows = createUiListSemantics({
  semantics, root, list: 'items', id: 'org', role: 'tree', name: 'Sect', focusable: true,
  describeRow(key) {
    const { name, level, children } = items.get(key), among = siblings(key);
    return { name, level, selected: key === selected, position: { index: among.indexOf(key) + 1, size: among.length },
      ...(children.length > 0 ? { expanded: open.has(key) } : {}) };
  },
  onActivateRow: press,
});
```

- **The list is what shows.** The application keeps the whole tree and which items are open, and gives the list the items whose every ancestor is open. Opening or closing one is a new source; the list keeps the row at its top in view.
- **`position`** of an item is where it stands among the items under the same item, which is not where its row stands in the list, so the helper leaves it to `describeRow`.
- **`selected`** is said by every item of a tree where items are selected, and by none where nothing is.
- **Keys** are the application's: Up and Down move through the items that show; Right opens an item that is closed and goes into one that is open; Left closes an item that is open and goes out of any other. An item that closes over the focus takes it. The [tree example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-tree) does all of this.

A `heading` is the title of what follows it, and its `name` is its text. `level` is its rank from one to six; a heading that does not say is read as the page reads one without a rank. It takes no action. A reader can move from heading to heading, so a screen of several panels is easier to find one's way in when each panel has one.

### Messages

A `status` or an `alert` is a message for someone who is not looking at the place where it is drawn: how much is left, that the game was saved, why a change was refused. Its `name` is the message. A reader says a message when the text of a node it already knows changes, so add the node once and keep it published, with an empty name while there is nothing to say:

```js
semantics.add({ id: 'left', role: 'status', describe: () => ({ name: left + ' left', bounds: lineBounds }) });
semantics.add({ id: 'fault', role: 'alert', describe: () => ({ name: fault, bounds: faultBounds }) });
```

A `status` waits for what the reader is saying; an `alert` interrupts it, so keep an alert for what cannot wait. The same text published again is no change and is not said again: empty the message when what it was about is over, and it is said the next time. A message takes no action and holds no nodes. The [stepper example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-stepper) has both beside its spin buttons.

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

- **The canvas keeps the keyboard.** The canvas gets `role="application"`, the label, and `aria-owns` naming the container, so the nodes are read as what is inside it. The node that is `focused` is named by `aria-activedescendant`. No element of the projection is a Tab stop: a native button carries `tabindex="-1"` from the moment it is made, whatever it can do, and a plain element carries it only where a request may give it the focus. The keys of the application go on working exactly as they did, and past its last stop Tab leaves the canvas.
- **Elements.** `button`, `checkbox`, `switch`, `radio`, `option`, `tab`, `menuitem`, `gridcell`, `columnheader` and `treeitem` are native buttons carrying their role. The rest are plain elements with a role, and `text`, `heading`, `status` and `alert` are their text. State is written as the ARIA attribute of that state: `aria-checked`, `aria-selected`, `aria-expanded`, `aria-disabled`, `aria-modal`, `aria-multiline`, `aria-multiselectable`, `aria-valuenow` with its bounds, `aria-orientation`, `aria-controls`, `aria-posinset` and `aria-setsize`, and in a grid `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex` and `aria-sort`, and for a tree item and a heading `aria-level`. The outermost inert element gets the `inert` attribute, and the page keeps everything under it away from every user.
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
| The tree: 26 cases | Node | Pass |
| The projection against a stand-in for the page: 17 cases | Node | Pass |
| A strict TypeScript consumer of both entries, with nine refused misuses | Node | Pass |
| The example page: the computed accessibility tree, the active descendant under Tab and the arrow keys, each element over its control, requests made of the elements, a phone profile | Headless Chromium 153, software WebGL2, injected input | Pass, 4 scenarios beside the 7 of the controls |
| The rows of a managed list, a list that is hidden, a list box with several selections, a list as a menu, a list as a grid under rows of the application's own, a list as the items of a tree, the boxes of a root and a layer as a dialog: 20 cases on a genuine Engine, a genuine UI root and a genuine layer manager, with a strict TypeScript consumer and seven refused misuses | Node | Pass |
| [The list example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-list-semantics): the list box the browser computes for 8 of 50,000 rows, the active descendant through recycled rows, a jump to row 40,000, a scroll away from the focus, requests made of the options, a scaled and scrolled page, a phone profile | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The tabs example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-tabs): the row of tabs and the one panel the browser computes, the relation from the selected tab to its panel, the values of progress bars, the active descendant on the selected tab, and requests made of tabs | Headless Chromium 153, software WebGL2, injected input | Pass, 5 scenarios |
| [The multiple selection example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-multi-select): a list box the browser computes as multiselectable, options selected and let go one by one, options that are disabled, runs chosen with Shift, and requests made of them | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The dropdown example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-dropdown): a list box that is in the computed tree only while its popup is open, the active descendant moving from the row into the jobs and back, requests made of rows and options, and a scroll bar that names the list it scrolls | Headless Chromium 153, software WebGL2, injected input | Pass, 9 scenarios |
| [The row menu example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-context-menu): a menu that is in the computed tree only while it is open, with its disabled items, the button that says it is expanded, the active descendant moving from the row into the items and back, and requests made of the button and the items | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The stepper example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-stepper): spin buttons with their values and ends, a status and an alert that are elements of the page from the start and whose text changes in place, the active descendant on an amount, and requests made of the buttons beside it | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The bag example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-inventory): a grid of four rows of six cells with its counts and indices, the one selected cell, the active descendant following the cursor in two directions, a status whose text changes in place, and requests made of cells and buttons | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The table example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-roster-table): a grid of forty-one rows of which eight are in the page, the headers with how the rows are sorted, the index each row has in the whole table as it scrolls, the selected row through a new order, the active descendant on a header and on a row, and requests made of headers and rows | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| [The tree example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-tree): a heading with its rank, and a tree whose items say their depth, whether they are open and their place among their own, as items open and close and the tree scrolls; the active descendant moving into and out of items; and requests made of items | Headless Chromium 153, software WebGL2, injected input | Pass, 6 scenarios |
| The same example with a modal layer of the layer manager: the dialog and its buttons over the card, the list behind it absent from the tree the browser computes, Tab kept inside, a press beside the card reaching nothing, Escape, and the focus back on its row | Headless Chromium 153, software WebGL2, injected input | Pass, 2 scenarios |

Not run: a screen reader, voice control, switch access or any other assistive technology; a person; Edge as installed; Firefox; Safari; a real phone, where exploration by touch depends on the platform's accessibility service; hardware GPUs and WebGPU. A passing accessibility tree is not proof that the UI is usable with a screen reader, and a message whose text changed in the page was not heard said.

Run a page check with `node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> software`, or the same with `examples/ui-list-semantics/verify.mjs`. Without `software` it launches the installed Edge headed.

Operator faults were written into the built list helper one at a time: 108, and the cases caught all of them.

## Not in this slice

- Roles beyond the first control set. A slider, a spin button, tabs, a progress bar, a menu of actions, the two messages, a grid of cells with the headers of its columns, a tree and headings were added to it; headers of rows and spanning cells of a grid, a tree whose items hold other nodes, a menu bar, submenus, menu items that are checked, and live regions other than `status` and `alert` were not.
- Descriptions, error text and labelling one node by another.
- Nodes for the leaves and the layers of the managed UI are the application's own, measured with [`semanticBoxOf`](#boxes-and-layers-of-the-managed-ui). The rows of a virtual list have [a helper](#a-managed-virtual-list).
- Selecting a range of rows at once, as with Shift and the arrow keys, is the application's; the multiple selection example shows one way.
- A projection of the native editor itself. The editor is its own element.
