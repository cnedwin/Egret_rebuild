# Control state

English | [简体中文](../../Cns/docs/ui-controls.md)

`@egret/engine/ui` has seven controls that hold the state of something a player operates: a virtual stick, a button, a hover, a switch, one choice out of several, a scroll position, and a text field. They belong to M3.4, [#90](https://github.com/cnedwin/Egret_rebuild/issues/90).

What these controls are to someone who cannot see them is described by the [semantic tree](ui-semantics.md), which reads the same state.

They own state only. A control adds no listener of the page, draws nothing and decides no routing: it listens on a display object for the events of the [contact input](multi-pointer-input.md) or of the [hover input](pointer-hover.md), and reports changes through callbacks. The application paints each state and binds keys to the same methods a pointer reaches.

| Factory | Holds | Driven by |
| --- | --- | --- |
| `createMovementControl` | A direction of length at most one | One contact dragged from where it began |
| `createActionControl` | Pressed, and a count of activations | A press that is released |
| `createHoverControl` | Hovered | A mouse or a pen over the target or a descendant |
| `createToggleControl` | Checked | An activation flips it |
| `createSelectionGroup` | One selected key of several | An activation of an item, or movement among them |
| `createScrollControl` | The offset of one axis of a viewport | The wheel, a drag of the scrollbar thumb, or a call |
| `createTextFieldControl` | The text of a field, and whether it is being edited | An activation opens an editor over it |

Every control has `enabled`, `setEnabled` and `dispose`. After `dispose` its methods throw `UI_CONTROL_CLOSED` and its subscriptions are gone. Options that are not sound are refused with `UI_CONTROL_OPTIONS`.

## Movement and action

```js
import { createActionControl, createMovementControl } from '@egret/engine/ui';

const stick = createMovementControl({ input, target: pad, radius: 40, onMovement: value => player.steer(value.x, value.y) });
const fire = createActionControl({ input, target: button, onActivate: () => player.fire(), onPressChange: pressed => paint(pressed) });
```

`input` is the contact input, and `target` the display object whose contacts the control takes. A movement control takes one contact and refuses a second without stealing the first. Its `value` is the drag from where the contact began divided by `radius`, clamped to length one, and zero inside `deadZone` (a tenth of the radius by default). Release, cancellation, disabling and disposal all end at zero. `setDirection(x, y)` sets the same value from keys or a script.

An action control is `pressed` while its contact is down and activates when that contact ends on its route. A cancelled contact releases without activating. `press()` and `release()` are the scripted equivalents: a release activates only when a press is outstanding. Disabling clears a held press without an activation. `activationCount` counts activations.

## Hover

```js
import { createHoverControl } from '@egret/engine/ui';

const over = createHoverControl({ hover, target: button, onHoverChange: hovered => paint(hovered) });
```

`hover` is the hover input. `hovered` is true while a mouse or a pen is over `target` or one of its descendants. A pointer that goes from one descendant to another has not left the control, and no change is reported. With two pointers the control stays hovered until the last one leaves.

A disabled control is not hovered. The pointer may still be over it, and enabling the control again finds it there. When the target or a descendant leaves the stage under the pointer, the control still learns that the hover ended: it follows `hover.observe` as well as the events on its target.

## Toggle

```js
import { createToggleControl } from '@egret/engine/ui';

const sound = createToggleControl({ input, target: box, checked: true, onChange: checked => audio.setMuted(!checked) });
```

A completed press flips `checked` and reports the new value. `toggle()` is one activation from a key or a script, and does nothing while the control is disabled. `setChecked(value)` sets the value without an activation, also while disabled, and reports a change only when the value differs. `pressed`, `press()` and `release()` are those of the action control inside it.

## One of several

```js
import { createSelectionGroup } from '@egret/engine/ui';

const level = createSelectionGroup({
  input,
  items: [{ key: 'easy', target: a }, { key: 'normal', target: b }, { key: 'hard', target: c, enabled: false }],
  selected: 'normal',
  onChange: (selected, previous) => apply(selected),
});
```

This is the state of a radio group, a segmented control or a listbox with a single selection. `items` are one to 256 entries with distinct keys and distinct targets, in the order movement follows. Without `selected` nothing is selected until an item is chosen; after that one item always is.

A completed press on an item selects it. `select(key)` does the same by name, and `next()`, `previous()`, `first()` and `last()` move the selection among the enabled items. Each returns whether the selection changed. Movement wraps past either end unless `wrap` is false. With nothing selected, `next()` starts at the first enabled item and `previous()` at the last.

A disabled item is skipped by movement and refuses a press and `select`. Disabling the selected item leaves it selected, as a disabled checked radio button stays checked. `setEnabled(false)` on the group refuses every way of selecting. An unknown key is refused with `UI_CONTROL_UNKNOWN_ITEM`.

## Scroll position

```js
import { createScrollControl } from '@egret/engine/ui';

const scroll = createScrollControl({
  viewportLength: 140,
  contentLength: rows * rowHeight,
  wheel: { hover, target: viewport, lineLength: rowHeight },
  thumb: { input, target: thumbSprite, trackLength: 140 },
  onScroll: offset => { content.y = -offset; drawThumb(scroll.thumb); },
});
```

The control holds the offset of one axis, `'y'` unless `axis` is `'x'`. `offset` runs from zero to `maximum`, the content that does not fit. `scrollTo`, `scrollBy`, `line`, `page`, `toStart` and `toEnd` return whether the offset changed, and `onScroll` is told each change once. `setLengths(viewportLength, contentLength)` follows a layout or a change of content and clamps the offset to the new range. The application moves its content and clips its viewport.

With `wheel`, a wheel over the viewport or a descendant scrolls by the deltas of that axis: pixel deltas as they are, a line as `lineLength` (40 by default), a page as the viewport. The control consumes a wheel only when the offset moved. At either end it leaves the wheel alone, so a viewport inside another hands the wheel to the outer one, and the outermost hands it to the page under the [wheel policy](pointer-hover.md#wheel). A wheel with the zoom modifier is not a scroll.

With `thumb`, one contact on the thumb drags it along a track of `trackLength`, and the offset follows in proportion; a second contact is refused. `scroll.thumb` gives where to draw it: `start` and `length` on the track. The length is the share of the content that shows, never shorter than `minimumLength` (16 by default) nor longer than the track. `dragging` and `onDragChange` report the drag. Cancellation, disabling, disposal and a thumb that leaves the stage all end it.

Panning the content with a finger is a gesture. It needs arbitration against the presses of what is inside the viewport, and is not recognized by this control.

## Text field

```js
import { createTextFieldControl } from '@egret/engine/ui';
import { createBrowserTextInput } from '@egret/engine/web/text-input';

const editor = createBrowserTextInput({ canvas, logicalWidth: 480, logicalHeight: 300 });
const name = createTextFieldControl({
  input, target: nameBox, editor, value: sect.name, maxLength: 8, placeholder: '最多 8 个字', label: 'Name',
  field: () => ({ x: 40, y: 78, width: 400, height: 40, fontFamily: 'sans-serif', fontSize: 20, color: 0xf3e9d2 }),
  onChange: value => { sect.name = value; redraw(); },
  onEditingChange: () => redraw(),
});
```

The control holds the text of a field the application draws. It types nothing itself. A completed press on `target`, or `edit()` from a key or from [assistive technology](ui-semantics.md), asks `editor` to show a field over the place `field()` names, and the control then is `editing`. The [platform text input](text-input.md) is such an editor as it is, so an input method, the on-screen keyboard of a phone, paste and selection are the platform's own. That is how a player types Chinese into a drawn field.

- **`field()`** is asked each time an edit begins. It returns the rectangle of the field on the stage, with whatever else the editor's request takes: a font, a colour, an alignment. The control adds the text, `multiline`, `password`, `maxLength`, `placeholder` and `label`.
- **`value`** is the committed text. While a field is open, `draft` is what has been typed so far and `composing` says whether an input method still holds provisional text. `onInput` reports both. The draft becomes the value when the edit is committed, and `onChange(value, previous)` is told after `onEditingChange(false)`, only when the text differs.
- **Ending.** The editor ends an edit: Enter in a single line, a press elsewhere, Escape. `commit()` and `cancel()` end it from the application. A cancelled edit leaves the text as it was. Disabling or disposing the control cancels an open edit.
- **One editor, several fields.** An editor shows one field at a time. Opening a second field ends the first the way the editor ends it, and each control hears only its own session.
- **`setValue(text)`** sets the text without an edit and replaces the text of an open field. `maxLength` counts code points, so one Chinese character or one emoji counts once; longer text is cut to it.

**Do not draw the text of a field while it is `editing`.** The platform field shows it, and two copies never align exactly.

An editor of the application's own has `open(request)`, `commit()`, `cancel()` and `setValue(text)`, and ends every session with exactly one `onCommit(text)` or `onCancel()` of the request. A control does not wait for an editor that never answers: its own `commit()` keeps the draft and its own `cancel()` drops it. An editor that throws when asked to end is not trusted with its text.

## Keys

The controls listen to no keyboard. The [keyboard input](keyboard-focus-input.md) delivers keys to the focused display object, and the application calls the control:

| Control | Usual keys | Call |
| --- | --- | --- |
| Action | Space or Enter | `press()` then `release()` |
| Toggle | Space or Enter | `toggle()` |
| Selection group | Arrow keys, Home, End | `next()`, `previous()`, `first()`, `last()` |
| Movement | Arrow keys or WASD | `setDirection(x, y)` |
| Scroll | Arrow keys, Page Up, Page Down, Home, End | `line()`, `page()`, `toStart()`, `toEnd()` |
| Text field | Enter or Space, released | `edit()` |

A text field is opened when the key is released, so that the key that opened it types nothing into it. While it is open the keys belong to the platform field, and when the edit ends the application gives the focus back to the field with `keyboard.focus(id)`.

The example registers one keyboard stop for its group and moves that stop to the selected item, so that Tab enters and leaves the group once.

## Painting states

A control reports state; the application chooses what it looks like. The [theme](ui-theme-generations.md) carries skin names for `default`, `hover`, `pressed`, `disabled`, `focus`, `checked`, `selected` and `expanded`. Which name wins when several states hold together is the application's choice. The example reads them in the order a player does: unavailable, held, pointed at, set.

## What was checked

| Check | Scope |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | Movement and action on a genuine Engine |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs), 13 cases | Hover, toggle and selection on a genuine Engine, a strict TypeScript consumer and the exports |
| [`tests/ui-scroll-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-scroll-control.test.mjs), 13 cases | The scroll position on a genuine Engine: range, wheel units, nested viewports, the thumb and its drag, and a strict TypeScript consumer |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs), 5 scenarios | A real page in headless Chromium with software WebGL2: mouse, touch and keys injected through the automation protocol. Four further scenarios of the same file check the [semantic projection](ui-semantics.md) |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs), 8 scenarios | The scroll control in a real page: the wheel, the hand-over to the page, and a drag of the thumb |
| [`tests/ui-text-field.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-text-field.test.mjs), 17 cases | The text field on a genuine Engine with a test-owned editor: sessions, drafts, limits, shared editors, failing editors and listeners, the semantic node, and a strict TypeScript consumer with the platform text input as its editor |
| [`examples/ui-text-field/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/verify.mjs), 6 scenarios | Two text fields in a real page in headless Chromium with software WebGL2: a composition of an input method driven through the browser's protocol, the keyboard, one field handing the editor to the other, the accessibility tree, disabling, and a phone profile |

Twenty-nine faults were written into the built hover, toggle and selection code one at a time, and the unit tests caught all of them. Of thirty-two written into the scroll control they caught thirty; the other two change nothing a caller can see. Of 114 operator faults in the text field control they caught 112; the other two are a shortcut that saves a loop and changes no result.

## Open

- No person operated the example. Every input was injected.
- Hardware GPUs, WebGPU, Edge as installed, Safari, Firefox and a real phone were not run for these controls.
- The [semantic projection](ui-semantics.md) gives these controls roles, names and states, checked against the accessibility tree of headless Chromium. No screen reader or other assistive technology was run.
- A finger does not pan a scroll viewport: that gesture and its arbitration with presses remain in #90.
- A real input method, a real on-screen keyboard and the system clipboard were not run for the text field: its composition was driven through Chromium's protocol.
- The text field is not the editor of the managed UI: [native editing](native-text-editing.md) in a managed row keeps its own contract. The virtual list is not built from these controls.
- A selection over the recycled rows of a virtual list is the list's own subject, not this group's.
