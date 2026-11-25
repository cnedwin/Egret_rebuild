# Fitting a stage to a screen

English | [简体中文](../../Cns/docs/screen-fit.md)

A game is designed for one size and played on screens of every shape: a phone held either way, a tablet, a wide monitor, a WeChat mini game. Parts of a phone's screen are covered by a notch, rounded corners or a home bar. `planScreen` of the optional entry `@egret/engine/web/screen` says where the stage goes on such a screen; [`play`](play.md#screens-of-any-shape) and [`createBrowserGame`](browser-game.md) use it with `fit: 'expand'` and `'contain'`.

## The rules

1. **The design is always whole.** The scale is the larger one at which the whole design fits the space: `min(space width / design width, space height / design height)`.
2. **`'contain'` leaves bars; `'expand'` shows more stage.** With `'contain'` the stage is the design, centred, and the rest of the space is bars. With `'expand'` the scale is the same, and the stage takes as many whole units as the space holds, never fewer than the design. A wider phone then shows more of the stage at its sides, and the design lies in the middle of the stage.
3. **A portrait design for a tall space.** While the space is taller than it is wide, a `portrait` size is the design. With designs that share their short side (1920 × 1080 and 1080 × 1920), a thing of the design is as large on the screen held either way.
4. **The safe part.** `insets` say how far a notch, rounded corners or a home bar reach in from each edge of the space. `safe` is the stage less what they cover, in stage units. What belongs at an edge is placed from it.

## Use

```js
import { planScreen } from '@egret/engine/web/screen';

const plan = planScreen({
  box: { width: 844, height: 390 },            // the space, in CSS pixels
  design: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  fit: 'expand',
  insets: { top: 0, right: 47, bottom: 21, left: 47 }
});
// plan.orientation 'landscape', plan.width × plan.height the stage, plan.scale CSS pixels a unit,
// plan.left and plan.top where the stage's corner is in the space,
// plan.designRect where the design is on the stage, plan.safe what nothing covers.
```

| Field | Meaning |
| --- | --- |
| `orientation` | `'portrait'` while the space is taller than wide, `'landscape'` otherwise |
| `design` | The design that applies |
| `width`, `height` | The stage, in whole units: the design's, or more with `'expand'` |
| `scale` | Pixels of the space in a stage unit |
| `left`, `top` | Where the stage's top left corner is in the space; above 0 where bars are left |
| `designRect` | Where the design is on the stage |
| `safe` | The part of the stage that is shown and that nothing covers |

The plan is frozen. Plan again whenever the space or the insets change. What is not a space, a whole design or insets of 0 or more is refused with `UI_SCREEN_OPTIONS_INVALID`.

## In a browser game

`createBrowserGame({ fit: 'expand', portrait, insets })` plans the stage from the element it fits into and the page's `safe-area-inset` values, and plans again when the element changes size:

- `game.screen` is the plan now, and `game.frame` the frame drawn at its size.
- `game.onScreenChange(listener)` calls `listener` with the new plan after the stage changes size or its safe part moves, and returns its removal.
- Pointer and hover input map the page to the stage at its current size. Each takes a `size` function for a stage that changes size; the game gives it.

A page has `safe-area-inset` values only when its viewport meta tag says `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`insets` gives them where the page or its host knows better. In a WeChat mini game, the adapter of `tools/wechat/export-wechat.mjs` reports WeChat's `safeArea` as the page's insets, and `'expand'` fills the screen canvas without stretching it.

## What is checked

- `tests/ui-screen.test.mjs` checks the arithmetic in Node: `'contain'` and `'expand'`, wider and taller spaces, the portrait design, insets inside and beyond the bars, and refusals.
- `examples/play/verify.mjs` checks a game in headless Chromium with software WebGL2. The game uses `'expand'`, a portrait size and a notch of 44 CSS pixels:
  - it shows the design whole at 960 × 540;
  - at 1200 × 540 it shows 80 more units on each side;
  - at 540 × 960 it takes the portrait size;
  - a tap in the page reaches a button that `arrange` placed in the safe part.
- `tests/wechat-minigame.test.mjs` checks that the adapter reports WeChat's safe area as the page's insets.

No phone with a notch, Safari or WeChat itself was run. The page's own insets were never other than 0 in these runs; the notch was given as `insets`.

## Design notes

Game UI frameworks commonly handle screen shapes this way. LumioGames LGUI, for one, uses two designs that share a short side and a safe node that the framework moves; it was studied as a reference and none of its code is used. Here the rules apply to a stage rather than to named components. A game places its edges from `safe` in its own code.
