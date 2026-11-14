# Control state

English | [简体中文](../../Cns/docs/ui-controls.md)

`@egret/engine/ui` has eight controls that hold the state of something a player operates: a virtual stick, a button, a hover, a switch, one choice out of several, one value out of a range, a scroll position, and a text field. They belong to M3.4, [#90](https://github.com/cnedwin/Egret_rebuild/issues/90).

What these controls are to someone who cannot see them is described by the [semantic tree](ui-semantics.md), which reads the same state.

They own state only. A control adds no listener of the page, draws nothing and decides no routing: it listens on a display object for the events of the [contact input](multi-pointer-input.md) or of the [hover input](pointer-hover.md), and reports changes through callbacks. The application paints each state. `createControlKeys` binds the [usual keys](#keys) of a control to the same methods a pointer reaches.

| Factory | Holds | Driven by |
| --- | --- | --- |
| `createMovementControl` | A direction of length at most one | One contact dragged from where it began |
| `createActionControl` | Pressed, and a count of activations | A press that is released |
| `createHoverControl` | Hovered | A mouse or a pen over the target or a descendant |
| `createToggleControl` | Checked | An activation flips it |
| `createSelectionGroup` | One selected key of several | An activation of an item, or movement among them |
| `createRangeControl` | One value out of a range | A press on the track, a drag from there, or a call |
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

This is the state of a radio group, a segmented control, a row of tabs or a listbox with a single selection. `items` are one to 256 entries with distinct keys and distinct targets, in the order movement follows. Without `selected` nothing is selected until an item is chosen; after that one item always is.

A completed press on an item selects it. `select(key)` does the same by name, and `next()`, `previous()`, `first()` and `last()` move the selection among the enabled items. Each returns whether the selection changed. Movement wraps past either end unless `wrap` is false. With nothing selected, `next()` starts at the first enabled item and `previous()` at the last.

A disabled item is skipped by movement and refuses a press and `select`. Disabling the selected item leaves it selected, as a disabled checked radio button stays checked. `setEnabled(false)` on the group refuses every way of selecting. An unknown key is refused with `UI_CONTROL_UNKNOWN_ITEM`.

**Tabs** are this control with a panel for each key: show the panel of `selected` and hide the others. An object that is not visible takes no press and no focus, so nothing more is needed to keep a hidden panel quiet. The [tabs example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.md) does this, and the [semantic tree](ui-semantics.md#tabs-and-progress) has the roles for it.

## Value in a range

```js
import { createControlKeys, createRangeControl } from '@egret/engine/ui';

const volume = createRangeControl({
  input, target: track, length: 120, min: 0, max: 100, step: 5, value: settings.volume,
  onChange: value => { settings.volume = value; redraw(); },
  onDragChange: () => redraw(),
});
keyboard.registerTarget({ id: 'volume', target: track });
createControlKeys({ keyboard, target: track, kind: 'range', control: volume, page: 4 });
```

A slider: one value out of a range, such as a volume, a share or an amount. `target` is the track. A press on it moves the value to where it was pressed, and the same contact then drags it, also outside the track, until it is released. A second contact is refused while one drags. The application draws the track and the thumb from `value`, or from `fraction`, which is the value as a share of the range from 0 to 1.

- **The track** is read in the coordinates of `target`, so a track that is moved or scaled, or that sits inside something scaled, needs nothing more. `length` is how long it is, and `start` where it begins, which is 0 unless said. `axis: 'y'` is a vertical track, on which the value grows upward.
- **Values.** The range runs from `min` to `max`, which are 0 and 100 unless said. Its values are `min` and every `step` from it, 1 unless said, and the far end is always a value, also when no whole step reaches it. A number between two values goes to the nearer, and one halfway goes up.
- **`setValue(n)`** sets the value from the application, also while the control is disabled, and brings the number to a value of the range. `stepBy(steps)`, `toMin()` and `toMax()` are what keys and scripts call, and do nothing while it is disabled. Each returns whether the value changed, and `onChange(value, previous)` is told only then.
- **`dragging`** is true from the press to the release, and `onDragChange` reports it, so that a thumb is painted as held. Disabling or disposing the control ends a drag.

Its keys are those of a native slider, listed under [Keys](#keys). To someone who cannot see it, it is a [`slider`](ui-semantics.md) with its `range`.

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

The controls listen to no keyboard. The [keyboard input](keyboard-focus-input.md) delivers keys to the display object that holds the focus, and `createControlKeys` binds the usual keys of one control there:

```js
import { createControlKeys } from '@egret/engine/ui';

keyboard.registerTarget({ id: 'apply', target: button });
const keys = createControlKeys({ keyboard, target: button, kind: 'action', control: apply, onPressChange: paint });
```

`keyboard` is the keyboard input. `target` is the display object that takes the focus, or one above it, because keys rise through the tree. `kind` says which control it is, and `control` is that control or anything with the same methods.

| `kind` | Keys | What happens |
| --- | --- | --- |
| `'action'` | Space, Enter | Released: `press()` then `release()`, one activation |
| `'toggle'` | Space, Enter | Released: `toggle()` |
| `'textField'` | Space, Enter | Released: `edit()` |
| `'selection'` | Arrow keys, Home, End | Pressed, and again while held: `next()`, `previous()`, `first()`, `last()` |
| `'range'` | Arrow keys, Page Up, Page Down, Home, End | Pressed, and again while held: `stepBy(1)` or `stepBy(-1)`, `stepBy(page)` or `stepBy(-page)`, `toMin()`, `toMax()` |
| `'scroll'` | The arrow keys of its axis, Page Up, Page Down, Home, End | Pressed, and again while held: `line()`, `page()`, `toStart()`, `toEnd()` |
| `'movement'` | Arrow keys and the W A S D positions | While down: `setDirection(x, y)` from the keys that are held |

- **Activation waits for the release.** The key that opens a text field therefore types nothing into it, and a key that repeats while it is held activates once. While the key is down `keys.pressed` is true and `onPressChange` has reported it, so that a held key is painted as a press is: `control.pressed || keys.pressed`. A hold that loses the focus, or whose page loses it, ends without an activation. One key activates at a time.
- **A selection** takes `orientation: 'horizontal'` or `'vertical'` to keep the arrows across it for whatever is outside. Its keys are taken also at an end that does not wrap, as in a native group, so the page does not scroll under it.
- **A range** goes up with Arrow Right and Arrow Up and down with Arrow Left and Arrow Down, one step each. Page Up and Page Down move it `page` steps, ten unless said. `orientation` keeps the arrows across it for whatever is outside. Its keys are taken also at an end, as in a native slider, so the page does not scroll under it.
- **A scroll** takes a key only when the key moved it. At its end the key goes on to a viewport outside it, or to the page, as the wheel does.
- **A movement** adds up the keys that are down. Opposite keys cancel each other and a diagonal is no faster. `keys: 'arrows'` or `'wasd'` binds one set only. The letters are positions of the keyboard, not characters, so they are the same four keys on every layout.
- **A key taken below is left alone above.** A binding skips a key that a display object nearer the focus has already taken, so a button inside a scrolling viewport and a viewport inside another each get their own keys.
- **Shortcuts are not the control's.** A key held with Alt, Control or the platform key is ignored. Shift is not a shortcut.
- A disabled control takes no key. A key the binding took returns `true` from `keyboard.keyDown`, which is what stops the page from acting on it.

`dispose()` ends a hold without an activation, stops a movement the keys were steering, and listens no more. Dispose the binding before its control. The binding moves no focus: registering stops and moving between them is the [keyboard input](keyboard-focus-input.md)'s.

While a text field is open the keys belong to the platform field. When the edit ends the application gives the focus back to the field with `keyboard.focus(id)`.

**A group is one stop.** Put the options inside one display object, register that object as the stop, and bind the group's keys there once. The focus then stays on the group while the selection moves inside it: Tab enters and leaves the group once, a held arrow key goes on through the options, and the application draws the focus ring on the option that is selected. The semantic node of that option is the focused one. The examples do this.

## Painting states

A control reports state; the application chooses what it looks like. The [theme](ui-theme-generations.md) carries skin names for `default`, `hover`, `pressed`, `disabled`, `focus`, `checked`, `selected` and `expanded`, and `selectUiSkin` gives the name for the states that hold now:

```js
import { selectUiSkin } from '@egret/engine/ui';

const name = selectUiSkin(theme.skins.button, {
  disabled: !apply.enabled, pressed: apply.pressed || keys.pressed, hover: hovered.hovered, focus: ringed });
```

When several states hold, the first in the order a player reads a control wins: unavailable, held, set (`checked`, `selected`, `expanded`), focused, pointed at. A state the skin has no name for falls to the next that holds, and then to `default`. A third argument gives another order, and a state left out of it is never chosen.

A skin has one name for each state, not one for each combination. A control that must stay set while it is held or pointed at takes a skin of its own for its set value, as the example does for its switch: `skins.control` and `skins.controlOn`, chosen by the value, each with its own `hover`. A focus ring is usually drawn beside the skin and not chosen as one.

## What was checked

| Check | Scope |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | Movement and action on a genuine Engine |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs), 13 cases | Hover, toggle and selection on a genuine Engine, a strict TypeScript consumer and the exports |
| [`tests/ui-scroll-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-scroll-control.test.mjs), 13 cases | The scroll position on a genuine Engine: range, wheel units, nested viewports, the thumb and its drag, and a strict TypeScript consumer |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs), 7 scenarios | A real page in headless Chromium with software WebGL2: mouse, touch and keys injected through the automation protocol, among them a key that is held, a hold that loses the focus, and the colour each state is painted with. Four further scenarios of the same file check the [semantic projection](ui-semantics.md) |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs), 9 scenarios | The scroll control in a real page: the wheel, the hand-over to the page, a drag of the thumb, and its keys with their hand-over to the page |
| [`tests/ui-range-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-range-control.test.mjs), 11 cases | The value in a range on a genuine Engine: the press, the drag and its ends, a second contact, tracks that are inset, vertical and scaled, the values of a range whose far end is no whole step, steps, a disabled control, its keys through the keyboard input, its semantic node, and a strict TypeScript consumer |
| [`tests/ui-control-keys.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-control-keys.test.mjs), 16 cases | The key bindings on a genuine Engine with the keyboard input and the six controls: holds, repeats, lost focus, shortcuts, nested targets, disposal, failing listeners, and a strict TypeScript consumer |
| [`tests/ui-skin-states.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-skin-states.test.mjs), 6 cases | The name a skin gives: each state alone, every pair of states, missing names, an order of the application's own, refused arguments, and a strict TypeScript consumer |
| [`tests/ui-text-field.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-text-field.test.mjs), 17 cases | The text field on a genuine Engine with a test-owned editor: sessions, drafts, limits, shared editors, failing editors and listeners, the semantic node, and a strict TypeScript consumer with the platform text input as its editor |
| [`examples/ui-text-field/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/verify.mjs), 6 scenarios | Two text fields in a real page in headless Chromium with software WebGL2: a composition of an input method driven through the browser's protocol, the keyboard, one field handing the editor to the other, the accessibility tree, disabling, and a phone profile |
| [`examples/ui-settings/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/verify.mjs), 9 scenarios | [One screen](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.md) that joins the controls, their keys, a text field, two themes, a managed list, a modal layer and semantics, in headless Chromium with software WebGL2: the keyboard alone, presses, a composition, a theme changed in one frame, the modal card, requests of assistive technology and a phone profile. One scenario is the slider: a press, a drag past both ends of the track, each of its keys, a held key, the values the accessibility tree is given, and a finger that drags it |

Twenty-nine faults were written into the built hover, toggle and selection code one at a time, and the unit tests caught all of them. Of thirty-two written into the scroll control they caught thirty; the other two change nothing a caller can see. Of 114 operator faults in the text field control they caught 112; the other two are a shortcut that saves a loop and changes no result. Of 100 operator faults in the key bindings they caught all, and all 22 in the choice of a skin name. Of 95 in the range control they caught 94; the other one changes no result, because a step that lands on the far end is the far end either way. All 15 written into the keys of a range were caught.

## Open

- No person operated the example. Every input was injected.
- The key bindings were run with the keys of headless Chromium on a US layout. No other keyboard layout, no physical keyboard, no game controller and no screen reader's own key commands were run.
- The bindings follow left-to-right reading: Arrow Right is `next()`, and more on a slider. A right-to-left group or slider is bound by the application.
- A slider is moved through its keys once it holds the focus, which is how a reader moves an ARIA slider. A request that names a value, as some assistive technology on phones sends, is not carried.
- Hardware GPUs, WebGPU, Edge as installed, Safari, Firefox and a real phone were not run for these controls.
- The [semantic projection](ui-semantics.md) gives these controls roles, names and states, checked against the accessibility tree of headless Chromium. No screen reader or other assistive technology was run.
- A finger does not pan a scroll viewport: that gesture and its arbitration with presses remain in #90.
- A real input method, a real on-screen keyboard and the system clipboard were not run for the text field: its composition was driven through Chromium's protocol.
- The text field is not the editor of the managed UI: [native editing](native-text-editing.md) in a managed row keeps its own contract. The virtual list is not built from these controls.
- A selection over the recycled rows of a virtual list is the list's own subject, not this group's.
