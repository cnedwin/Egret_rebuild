# Control state

English | [简体中文](../../Cns/docs/ui-controls.md)

`@egret/engine/ui` has five controls that hold the state of something a player operates: a virtual stick, a button, a hover, a switch, and one choice out of several. They belong to M3.4, [#90](https://github.com/cnedwin/Egret_rebuild/issues/90).

They own state only. A control adds no listener of the page, draws nothing and decides no routing: it listens on a display object for the events of the [contact input](multi-pointer-input.md) or of the [hover input](pointer-hover.md), and reports changes through callbacks. The application paints each state and binds keys to the same methods a pointer reaches.

| Factory | Holds | Driven by |
| --- | --- | --- |
| `createMovementControl` | A direction of length at most one | One contact dragged from where it began |
| `createActionControl` | Pressed, and a count of activations | A press that is released |
| `createHoverControl` | Hovered | A mouse or a pen over the target or a descendant |
| `createToggleControl` | Checked | An activation flips it |
| `createSelectionGroup` | One selected key of several | An activation of an item, or movement among them |

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

## Keys

The controls listen to no keyboard. The [keyboard input](keyboard-focus-input.md) delivers keys to the focused display object, and the application calls the control:

| Control | Usual keys | Call |
| --- | --- | --- |
| Action | Space or Enter | `press()` then `release()` |
| Toggle | Space or Enter | `toggle()` |
| Selection group | Arrow keys, Home, End | `next()`, `previous()`, `first()`, `last()` |
| Movement | Arrow keys or WASD | `setDirection(x, y)` |

The example registers one keyboard stop for its group and moves that stop to the selected item, so that Tab enters and leaves the group once.

## Painting states

A control reports state; the application chooses what it looks like. The [theme](ui-theme-generations.md) carries skin names for `default`, `hover`, `pressed`, `disabled`, `focus`, `checked`, `selected` and `expanded`. Which name wins when several states hold together is the application's choice. The example reads them in the order a player does: unavailable, held, pointed at, set.

## What was checked

| Check | Scope |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | Movement and action on a genuine Engine |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs), 13 cases | Hover, toggle and selection on a genuine Engine, a strict TypeScript consumer and the exports |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs), 5 scenarios | A real page in headless Chromium with software WebGL2: mouse, touch and keys injected through the automation protocol |

Twenty-nine faults were written into the built hover, toggle and selection code one at a time, and the unit tests caught all of them.

## Open

- No person operated the example. Every input was injected.
- Hardware GPUs, WebGPU, Edge as installed, Safari, Firefox and a real phone were not run for these controls.
- Nothing is announced to assistive technology. Roles, names and states for a screen reader remain in #90.
- Scroll viewports, drag scrollbars, text fields and the virtual list are not built from these controls.
- A selection over the recycled rows of a virtual list is the list's own subject, not this group's.
