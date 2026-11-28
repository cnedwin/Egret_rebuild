# Gestures and drag and drop

English | [简体中文](../../Cns/docs/gestures.md)

Pointer input says where each contact is, and when it goes down, moves and lifts. A game rarely wants that. It wants to know that a card was held, an item was dragged into a slot, a map was pinched, or a page was swiped. The optional entry `@egret/engine/web/gestures` turns the contacts that [pointer input](multi-pointer-input.md) routes to a display object into those gestures, each said once. It adds no listener to any page, so a host that gives contacts to pointer input in its own way, such as a [WeChat mini game](wechat-minigame.md), uses it as it is.

## In play

```js
game.gestures(card, {
  hold: at => showDetails(card),           // a still press of half a second
  doubleTap: at => equip(card),
  drag: d => { card.x += d.dx; card.y += d.dy; },
  swipe: s => s.direction === 'left' && nextPage(),
});

const bag = game.dragAndDrop();
bag.source(gem, { data: () => gem.item, ghost: item => game.circle(0, 0, 16, item.color) });
bag.target(slot, { drop: item => put(slot, item), accepts: item => item.kind === 'rune', hover: (item, over) => (slot.alpha = over ? 1 : 0.7) });
```

`game.gestures` returns a function that stops them. Places are in the game's units, so they hold however [the screen is fitted](screen-fit.md). `localX` and `localY` are in the sprite's own units. What a handler throws stops the game, as a tap's does.

A dragged sprite stays where it is. The picture that `ghost` makes follows the finger over everything, and it is gone when the drag ends. If several targets are under the finger, the innermost one that accepts the data takes it, so a slot inside a bag takes the item rather than the bag. A drag let go where no target accepts it changes nothing.

## What is told

| Handler | When | What it is given |
| --- | --- | --- |
| `onTap` | A contact lifts close to where it went down, before it becomes a long press | Where it was |
| `onDoubleTap` | A second tap within 0.3 seconds and close to the first | Where it was |
| `onHold` | A still press lasts 0.5 seconds on the engine's clock. It is then no tap | Where it is |
| `onDrag` | A contact moves past the slop of 12 units. Then each move, and the end or cancel | `phase`, the step `dx`, `dy`, and all of it so far, `totalX`, `totalY` |
| `onSwipe` | A drag ends faster than 600 units a second over its last tenth of a second | `direction`, `speed`, `dx`, `dy` |
| `onPinch` | A second contact goes down. What the first was doing ends | `phase`, `scale` against the start, `rotation` in degrees, the middle |
| `onSecondaryTap` | A press of the mouse's secondary (usually right) button lifts within the slop of where it went down, however long it was held | Where it was |

All of these come from `createGestures({ engine, scope, input, target, ... })`. The thresholds are options: `slop`, `holdSeconds`, `doubleTapSeconds` and `swipeSpeed`. `createDragAndDrop({ engine, scope, input, layer })` gives `source`, `target` and `dragging`, and each registration returns its removal. Both end with their scope or `dispose()`. They refuse unusable options with `GESTURE_OPTIONS_INVALID`, and refuse registering on one that has ended with `GESTURE_CLOSED`.

A long press waits on the engine's clock, so it does not fire while the game is paused. A pinch ends when either finger lifts. The other finger is done until it lifts too, so it never turns into a drag.

Only touches, pens and the mouse's primary button make taps, double taps, long presses, drags, swipes and pinches. A press that also holds the primary button counts as a primary one. A right press goes to `onSecondaryTap` alone; the middle button and the side buttons make no gesture. Gestures add no listener to the page, so the browser still opens its menu on a right click: a game that uses `onSecondaryTap` stops it on its own canvas with `canvas.addEventListener('contextmenu', event => event.preventDefault())`. `createMouseInput` of `@egret/engine/web/input` keeps its primary-button contract.

## What is checked

`tests/gestures.test.mjs` gives contacts to pointer input on a real engine, as a host does. It checks:

- taps and double taps, and a moved contact that is no tap;
- a long press on the clock, and no tap after it;
- a drag past the slop, the steps it reports, and a swipe;
- a two-finger pinch with its scale and turn;
- mouse buttons: a still right press as a secondary tap however long held, no tap, drag or long press from the right or middle button, and the primary button tapping and dragging as before;
- drag and drop onto the innermost target, a drop with no target, and an empty source;
- refusals, and an ended recognizer that hears nothing.

`examples/play/verify-gestures.mjs` runs in headless Chromium with the mouse. It checks a double click, a long press, a drag that moves a card, a fast flick that is a swipe, and a gem dragged onto a slot. That original software run did not exercise two browser contacts or a physical touch screen; the later device follow-up below does.

## Design notes

LumioGames LGUI gives its controls drag, long press and drop handling. Here they are made from the contacts pointer input already routes, so a host and a test give contacts the same way, and play's sprites, buttons and taps share one pointer. The design was studied as a reference; none of its code is used.

## November 27 device follow-up

November 27 follow-up: the Windows mouse gesture helper passed; on actual Fold7 each backend received two CDP touch contacts, with measured pinch scale 1.9167, turn 28°, single hold, drag and drop. These are device-browser inputs, not human fingers. [Device observations and remaining coverage](november-27-claude-hardware.md).
