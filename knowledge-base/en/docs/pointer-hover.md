# Hover and wheel

English | [简体中文](../../Cns/docs/pointer-hover.md)

Two optional entries tell a game which display object a mouse or a pen is over while nothing is pressed, and route the wheel to what is under it. They belong to M3.3, [#89](https://github.com/cnedwin/Egret_rebuild/issues/89). Presses stay with the [contact input](multi-pointer-input.md); the two share a canvas.

## Public use

In a page, use `createBrowserHoverInput` from `@egret/engine/web/hover`:

```js
import { createBrowserHoverInput } from '@egret/engine/web/hover';

const hover = createBrowserHoverInput({ engine, scope, canvas, width: 480, height: 300 });
button.on(hover.events.enter, () => showHighlight());
button.on(hover.events.leave, () => hideHighlight());
list.on(hover.events.wheel, event => { if (scrollBy(event.payload.deltaY)) event.preventDefault(); });
```

`engine` is a started Engine, `scope` one of its open Scopes, `canvas` the canvas it draws on, and `width` and `height` the logical size of the stage. For a host that is not a page, `createHoverInput` from `@egret/engine/input/hover` takes the same options without `canvas` and is driven by `sample`, `leave` and `wheel`. Neither entry is part of the default Engine, and no other entry exports them.

A target is hovered under the same rules as a press: it is attached, `touchEnabled`, visible with every ancestor, and no ancestor has `touchChildren` off. Explicit hit areas and clips apply.

## Events

| Event | When | Payload |
| --- | --- | --- |
| `events.enter` | The pointer came over the target | The point, and `related` when it came from another target |
| `events.move` | It moved and is still over the same target | The point |
| `events.leave` | The target is no longer hovered | The point, `reason`, and `related` when it goes to another target |
| `events.wheel` | The wheel turned over the target | The wheel point. Cancelable. |

All four bubble, so a container hears what happens to its children. Enter, move and leave cannot be cancelled. A point carries `pointerId`, `pointerType` (`'mouse'` or `'pen'`), `globalX`, `globalY` in stage units, `timestamp`, a `sequence` that orders every observation of this input, and the `viewportRevision` it was mapped under. Points are frozen.

An enter and a leave that belong to one movement name each other: the payload of the leave has `related`, the object the pointer is going to, and the payload of the enter has `related`, the object it left. Without another end there is no `related`.

`onHover` in the options runs before the target path of each enter, move and leave. On a leave it names the object that lost the hover even when that object has left the stage; the event is dispatched only while the target can still be reached. `hover.observe(listener)` adds a listener later. It is told each notification after its target path has run, and a failure of the listener is kept from the input.

A leave says why:

| Reason | Meaning |
| --- | --- |
| `target` | The pointer went to another target or to none |
| `outside` | It left the canvas |
| `contact` | It pressed. It hovers again when it is released over the canvas. |
| `pointercancel` | The platform cancelled it |
| `owner` | The target was hidden, disabled or removed |
| `viewport` | The canvas moved or changed size on the page |
| `blur`, `hidden`, `pagehide` | The window or the page went away |
| `suspended`, `dispose`, `error` | The input was suspended, closed or failed |

A finger does not hover. Touch contacts go to the contact input only.

## A scene that moves under the pointer

A pointer that rests while the scene changes sends no event. Call `hover.sync()` after such a change, or once a frame: it picks again where each pointer rests and publishes the leave and the enter that follow. The example calls it after its list has scrolled.

## Wheel

A wheel is dispatched to what is under it as `events.wheel`. The payload has `deltaX`, `deltaY`, an optional `deltaZ`, `unit` (`'pixel'`, `'line'` or `'page'`, as the platform reported, unconverted) and `zoom`, which is true when the platform's zoom modifier was held, as a pinch on a trackpad also reports. A listener that used the wheel calls `event.preventDefault()`.

`onWheel` runs after the target path. It sees the target, if any, and whether a listener consumed the wheel, and may consume it itself by returning `true`. That is the place for a map that zooms when nothing under the pointer wanted the wheel.

`wheelPage` decides what the page does with a wheel over the canvas:

| `wheelPage` | The page scrolls |
| --- | --- |
| `'unconsumed'`, the default | Only when nothing consumed the wheel |
| `'never'` | Never: the canvas owns the wheel |
| `'always'` | Always. The listener is passive and cannot hold the page. |

## Mapping, interruption and ownership

The browser adapter accepts the profile of the contact adapter: a connected canvas with untransformed, unzoomed ancestors, no border or padding, and `object-fit: fill`. One scale and one offset map CSS pixels to stage units, and the device pixel ratio plays no part. A canvas outside this profile is refused with `HOVER_INPUT_SURFACE_INVALID`. A second adapter on the same canvas is refused with `HOVER_INPUT_SURFACE_BUSY`.

When the canvas moves or changes size, what is hovered is left under the old `viewportRevision`, and the next movement is mapped under the new one. A resize, a scroll and an orientation change do this at once. A layout change that raises no event is noticed at the next pointer event.

The adapter captures no pointer and sets no style, which is why it can share the canvas with `createBrowserPointerInput`. A lost WebGL context suspends the input, and the application resumes it with `setInteractive(true)` when its rendering host is ready again.

Scope disposal and Engine close end the input: what is hovered is left with reason `dispose`, the listeners are removed, and `onClose` listeners run. `capacity` bounds the pointers that hover at once (4 by default, at most 16). One pointer too many is reported through `onError` and the others go on.

## Failure

A sample or a wheel that arrives while another is being routed is refused with `HOVER_INPUT_REENTRANT`. Leaving, suspending and disposing are allowed from inside a callback. A callback that throws closes the input: everything hovered is left with reason `error`, and the error is `HOVER_INPUT_CALLBACK_FAILED` with the first failure as its `cause` and later ones in `cleanupErrors`. From the browser adapter the same error reaches `onError`, or the page as an uncaught error when there is no `onError`.

## What was checked

| Check | Scope |
| --- | --- |
| [`tests/hover-input.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/hover-input.test.mjs), 16 cases | The logical input on a genuine Engine: routing, reasons, wheel, revisions, suspension, reentry, failure and disposal |
| [`tests/browser-hover.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-hover.test.mjs), 15 cases | The adapter against a test-owned stand-in for the page, a strict TypeScript consumer and the exact exports |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs), 7 scenarios | A real page in headless Chromium with software WebGL2: mouse, pen, touch and wheel injected through the automation protocol |

Fifty-five faults were written into the built modules one at a time. The unit tests caught fifty-two. The other three change nothing a caller can see: a second eligibility check after a pick that already applies it, and two releases of references after close.

## Open

- No person moved a real mouse, pen or trackpad. Every input was injected.
- Hardware GPUs, WebGPU, Edge as installed, Safari and Firefox were not run. The verifier launches the installed Edge when its third argument is omitted.
- `createHoverControl` from `@egret/engine/ui` turns this input into the hovered state of a control ([guide](ui-controls.md)). The layout nodes and rows of the managed UI root do not use it yet.
- Mini-game and native hosts have no adapter. They can drive `createHoverInput`.
