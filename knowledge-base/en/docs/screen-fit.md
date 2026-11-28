# Fitting a stage to a screen

English | [简体中文](../../Cns/docs/screen-fit.md)

A game is designed for one size and played on screens of every shape: a phone held either way, a tablet, a wide monitor, a WeChat mini game. Parts of a phone's screen are covered by a notch, rounded corners or a home bar. `planScreen` of the optional entry `@egret/engine/web/screen` says where the stage goes on such a screen; [`play`](play.md#screens-of-any-shape) and [`createBrowserGame`](browser-game.md) use it with `fit: 'expand'`, `'contain'` and the stage scale modes of Egret 5.

## The rules

1. **The design is always whole.** The scale is the larger one at which the whole design fits the space: `min(space width / design width, space height / design height)`.
2. **`'contain'` leaves bars; `'expand'` shows more stage.** With `'contain'` the stage is the design, centred, and the rest of the space is bars. With `'expand'` the scale is the same, and the stage takes as many whole units as the space holds, never fewer than the design. A wider phone then shows more of the stage at its sides, and the design lies in the middle of the stage.
3. **A portrait design for a tall space.** While the space is taller than it is wide, a `portrait` size is the design. With designs that share their short side (1920 × 1080 and 1080 × 1920), a thing of the design is as large on the screen held either way.
4. **The safe part.** `insets` say how far a notch, rounded corners or a home bar reach in from each edge of the space. `safe` is the stage less what they cover, in stage units. What belongs at an edge is placed from it.
5. **The fixed modes of Egret 5 fill the space.** Each takes its scale from one side, and the stage is as many whole units as the space then holds:
   - `'fixedWidth'` fits the design's width to the space, and the stage's height follows the space;
   - `'fixedHeight'` does the same with the height;
   - `'fixedNarrow'` is `'expand'`;
   - `'fixedWide'` scales the design until it covers the space, and the stage is what the space shows of it.

   Where the stage is smaller than the design, the design is centred on it and its edges are not shown. Egret 5 rounded stage sizes to the nearest unit; here they are rounded down, so the stage never reaches past the space.
6. **Whole steps for pixel art.** With `wholeScale: true`, a stage unit covers a whole number of the device's pixels: the scale is rounded down to the step below, and the rest of the space is bars. `pixelRatio` says how many device pixels a pixel of the space has. Where the space cannot hold the design at one device pixel a unit, the scale stays as the fit makes it.

| Egret 5 `scaleMode` | `fit` | On a phone taller than the design (portrait design) |
| --- | --- | --- |
| `showAll` | `'contain'` | The design, bars above and below |
| `noBorder` | `'cover'` (browser game) | The design, its sides cut |
| `exactFit` | `'stretch'` (browser game) | The design, stretched |
| `fixedWidth` | `'fixedWidth'` | The design's width, more stage below and above |
| `fixedHeight` | `'fixedHeight'` | The design's height, less of it across |
| `fixedNarrow` | `'fixedNarrow'`, `'expand'` | As `fixedWidth`; on a wider screen, more stage at the sides |
| `fixedWide` | `'fixedWide'` | As `fixedHeight` |
| `noScale` | none | Not available |

A 750 × 1334 design with `'fixedWidth'` is 750 × 1625 units on a 393 × 852 phone (scale 0.524). On a 768 × 1024 tablet it is 750 × 1000 units, 167 units of the design cut above and below. `'expand'` keeps the whole design there instead: 1000 × 1334 units.

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
| `width`, `height` | The stage, in whole units: the design's with `'contain'`, at least the design's with `'expand'`, and less than the design's on one side with `'fixedWide'`, or with `'fixedWidth'` and `'fixedHeight'` on a screen of the other shape |
| `scale` | Pixels of the space in a stage unit |
| `left`, `top` | Where the stage's top left corner is in the space; above 0 where bars are left |
| `designRect` | Where the design is on the stage, centred; past the stage's edges where the stage is smaller |
| `safe` | The part of the stage that is shown and that nothing covers |

The plan is frozen. Plan again whenever the space or the insets change. What is not a space, a whole design, insets of 0 or more, a fit of these six, true or false for `wholeScale` or a `pixelRatio` above 0 is refused with `UI_SCREEN_OPTIONS_INVALID`.

## In a browser game

`createBrowserGame({ fit: 'expand', portrait, insets })` plans the stage from the element it fits into and the page's `safe-area-inset` values, and plans again when the element changes size:

- `game.screen` is the plan now, and `game.frame` the frame drawn at its size.
- `game.onScreenChange(listener)` calls `listener` with the new plan after the stage size, CSS scale, orientation or safe part changes, and returns its removal. A contained canvas can change only its CSS scale while the design and safe part stay the same; listeners, including Play's `arrange`, are called for that change too. Identical plans do not cause another notification.
- Pointer and hover input map the page to the stage at its current size. Each takes a `size` function for a stage that changes size; the game gives it.

A page has `safe-area-inset` values only when its viewport meta tag says `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`insets` gives them where the page or its host knows better. In a WeChat mini game, the adapter of `tools/wechat/export-wechat.mjs` reports WeChat's `safeArea` as the page's insets, and `'expand'` fills the screen canvas without stretching it.

`wholeScale: true` reads the page's device pixel ratio each time it plans the stage. The canvas is then drawn at one pixel a unit (`pixelRatio` 1, and no other is taken) and enlarged with `image-rendering: pixelated`, so each unit is a sharp square. It needs a planned fit: `'contain'`, `'expand'` or a fixed mode.

A project moved from Egret 5 by [Egret Migrate](legacy-project-migration.md) keeps its `scaleMode`. With a fixed mode, `stage.stageWidth` and `stage.stageHeight` follow the window, EUI lays its roots out again against the new size, and the stage dispatches `egret.Event.RESIZE`, as Egret 5 did.

In `play`, changing the screen repositions the world, effects and UI before calling `arrange`, including while paused. The world and effects keep the camera offset (`game.view`) and the last displayed shake offset. If `arrange` changes the camera, the resized frame uses that new offset. The first arrangement after `setup` also sees its camera offset even if setup paused the game. Reprojecting them does not advance the paused simulation, timers, tweens or shake. A resize therefore never requires resuming the game temporarily to reposition its layers.

## Pinning a box to the edges

`pinBox(area, box, pin)` says where a box goes to be held against the edges of an area: its top left corner, in the units of both. The area is `plan.safe`, or the whole stage, `{ x: 0, y: 0, width: plan.width, height: plan.height }`:

```js
import { pinBox } from '@egret/engine/web/screen';

game.onScreenChange(plan => {
  const at = pinBox(plan.safe, { x: score.x, y: score.y, width: score.width, height: score.height }, { right: 16, top: 16 });
  score.x = at.x; score.y = at.y;
});
```

On each axis the pin takes one of `left`, `right` and `centerX` across, and one of `top`, `bottom` and `centerY` down: a distance in from that edge, or from the middle. An axis without one keeps the box where it is. `isScreenPin(value)` says whether a value is a pin. A pin with two of one axis, an unknown name or a number that is not finite is refused with `UI_SCREEN_OPTIONS_INVALID`. `game.pin` of [play](play.md#screens-of-any-shape) places a node this way, again whenever the screen or its box changes.

## Checking many screens at once

`node tools/egret.mjs verify <page> --screens` (`node vendor/egret.mjs verify --screens` in a game's engine copy) opens one page on nine screen profiles in headless Chromium. It writes a picture of each and `report.json`. The screens are a phone without a notch (375 × 667), a phone with a notch and a home bar (393 × 852), the same phone held sideways (852 × 393), a tall Android phone (360 × 800), a tablet both ways (768 × 1024 and 1024 × 768), a folded phone's landscape cover-screen browser viewport (873 × 325, `foldable-cover-wide`), an unfolded phone (884 × 1104, `foldable`) and a desktop (1920 × 1080). `--screens=phone-notch,tablet` picks some. The folded profile uses the effective content viewport measured on a Galaxy Z Fold7 cover screen in landscape Chrome with browser chrome present (DPR 2.625, touch). The measured page reported no extra inset, so the stand-in has zero insets; this is not a measurement of the cutout or a replacement for the unfolded profile.

A headless browser has no notch. The tool gives the page `globalThis.__egretAgent.insets`, which the engine takes as the window's safe-area insets, and tints in red what they cover in each picture. Each screen is checked for:

- errors in the page;
- a blank picture;
- a page that scrolls;
- how much of the window the canvas fills, as a warning under three quarters.

A `play` game also tells the tool, about four times a second, where the nodes it takes taps on are and where its safe part is. For those, the report names:

- each control that reaches outside the safe part, an error;
- each control smaller than 44 CSS pixels either way on a touch screen, a warning;
- each pair of controls that cover each other without one holding the other, a warning.

A control is named by its `name`, the name `onTap` was given, the name of its part in a view, or the words of its button. A node over the whole canvas, such as the backdrop of a modal view or a "tap anywhere" layer, is no control, and the controls it is drawn over are left out while it shows. The tool exits with 1 when a screen has an error. It is Chromium with stand-in insets at each phone's size and pixel ratio, not a phone: a real notch's shape, the browser's own bars and the way a phone hands its insets to the page are not checked.

The Play and World3D native control reporters share the same transformed clipping geometry. Their safety and overlap findings use the exposed hit envelope; the touch-target size uses the authored hit rectangle when a real ancestor clip trims it (see below).

### Check several states along a route

Without a script the tool inspects the initial page, usually the title. To inspect the menus, a match or the result in the same run, add the existing verify play script:

```sh
node vendor/egret.mjs verify --screens --play test/play.mjs --out screen-route
```

The script's default async function receives the same player as one-window verification: `tap`, `drag`, `key`, `look`, `until`, `read`, `expect`, `sounds`, `warnings` and `picture`. Its module is loaded once and the function runs in a fresh browser context for every named screen, without blind play, so a save made on one screen does not carry to the next. Keep script state local to the function. The screen profile decides the viewport and insets; the script's `viewport` export is ignored, and a changed viewport at a capture is an error. The optional `stage` export maps its coordinates across the largest canvas, as in one-window verification; without it, coordinates are CSS pixels relative to that canvas. For a layout whose controls move between screens, read their actual position before tapping (see `examples/screen-check/play.mjs`). `look` samples CSS pixels even at a high device pixel ratio.

At each stable interface state, use `await player.checkpoint('rules')`, for example. Each checkpoint writes a tinted screenshot and runs the same screen findings. When the engine has told the tool of controls, the checkpoint and final capture wait for a new control report (up to five seconds, including while the game simulation is paused). If no new report arrives, `controlsFresh` fails the capture instead of checking stale geometry; a game that never reports controls has no control checks, as before. Names must be unique, non-empty strings without control characters. Await the call before changing the interface again. The final capture is still written as before. In `report.json`, each screen has its final findings and a `played` result (script pictures, checkpoint names and, on failure, a diagnostic); its ordered `checkpoints` contain independent findings and picture paths. The `controlReceipt` tells whether the reported geometry is fresh, absent or unconfirmed. Checkpoint files are numbered inside the screen's own folder, separate from `player.picture` files; repeated picture paths are refused. A checkpoint error or script failure fails the screen, even if its final state passes. The other screens still run. The scripts are trusted local JavaScript, as with ordinary `verify --play`; the browser's external requests are still refused. The player's tap and drag are mouse inputs; a touch-specific script can use `player.page.touchscreen` on a touch profile. Neither is physical touch or device testing.

### Check a later scene

`node vendor/egret.mjs verify --screens --prepare test/prepare-market.mjs --out screen-market` opens the ordinary game page on each fresh screen, then runs the explicitly named local module before the screenshot and safe-area checks. The module uses the same player helpers as `--play`; its default function receives the player and a read-only screen descriptor (`name`, CSS `width` and `height`, `scale`, `touch`, `insets`). For example, a game with a menu opened by Enter can use:

```js
export default async function prepare(player, screen) {
  await player.page.waitForFunction(() => window.demo?.ready);
  await player.key('Enter');
  await player.page.waitForFunction(() => window.demo?.screen === 'market');
  const actual = await player.read(() => window.demo.screen);
  player.expect(actual === 'market', screen.name + ': market ready');
  return actual;
}
```

Return the nonempty scene name actually reached, after checking readiness. The report for each screen includes `prepared` with the scene or the error. The tool waits for a fresh native control report after preparation; an absent or empty native control list fails that screen. Exceptions and an asynchronous preparation exceeding 20 seconds fail the screen as well. Its screenshot and other checks still serve as failure evidence. The asynchronous deadline cannot interrupt synchronous blocking code: the local module is trusted Node code, supplied explicitly by the operator; the tool never discovers or fetches a script from the page. Without `--screens`, `--play` remains the one-window gameplay check, including audio. Screen verification does not measure audio; use `--play` with `--screens` for a multi-state visual and geometry check, or `--prepare` to assert readiness of a later scene. When both options are supplied, preparation runs first. A preparation failure skips the play script on that screen; successful preparation is independently checked and recorded as `preparedState` before route checkpoints. Neither replaces a gameplay or audio check. For a real runnable example see `examples/screen-check/prepare.mjs`.

## What is checked

- `tests/ui-screen.test.mjs` checks the arithmetic in Node: `'contain'` and `'expand'`, wider and taller spaces, the portrait design, insets inside and beyond the bars, and refusals.
- `examples/play/verify.mjs` checks a game in headless Chromium with software WebGL2. The game uses `'expand'`, a portrait size and a notch of 44 CSS pixels:
  - it shows the design whole at 960 × 540;
  - at 1200 × 540 it shows 80 more units on each side;
  - at 540 × 960 it takes the portrait size;
  - a tap in the page reaches a button that `arrange` placed in the safe part.
- The same browser screen-fit fixture shrinks and enlarges an embedded 200 × 100 design through CSS scales 2 → 0.9 → 3. Its arrange callback keeps a 44 CSS-pixel button, the safe and design rectangles stay the same, the two actual changes notify once each, and the final mouse tap reaches the button.
- `tests/wechat-minigame.test.mjs` checks that the adapter reports WeChat's safe area as the page's insets.
- SCR06 and SCR07 check the four fixed modes against Egret 5's arithmetic, on spaces taller and wider than the design, and the whole steps, including a page of two device pixels to a CSS pixel.
- The browser screen-fit fixture also runs `'fixedWidth'` and `'fixedHeight'` in a resized element:
  - an 800 × 800 element shows 400 × 400 units of a 400 × 300 design;
  - at 1000 × 600 it shows 400 × 240 units;
  - a tap at the design's middle reaches its button.

  For `wholeScale`, a 160 × 90 game in 700 × 400 CSS pixels draws a 160 × 90 canvas at 640 × 360. Its 2 × 2 dot is 8 × 8 screen pixels, with no pixel between black and white.
- `tests/egret-migrate.test.mjs` checks that `inspect` keeps each fixed mode and refuses `noScale`.
- The browser screen-fit fixture also pauses a portrait game during camera shake, resizes it to landscape and back, and checks the world and a rendered burst at the projected positions. The time and update count remain unchanged while paused; the arrange callback already sees the new projection. After resuming it checks an ordinary active resize with the camera offset and without shake.
- SCR08 checks `pinBox` on each edge and the middle, an axis left alone, and the pins it refuses.
- The browser screen-fit fixture pins a score to the safe part's top right and a bar to the screen's bottom middle, in a game of `'expand'` with a notch on the right. Each stayed against its edges when the window grew wider and when it turned. When the score's box doubled across, it was placed again 8 units from the edge, and `set` moved it at once.
- `examples/screen-check/verify.mjs` runs a landscape game of `'expand'` through `verify --screens` on all nine profiles, written with three mistakes and then without them. Plain, the pause button pinned to the screen's corner is under the notch exactly on the three phones with an inset at that corner. The 24-unit help button is too small on every touch screen that shows it under 44 CSS pixels, and Jump and Fire cover each other. The safe part the engine took is the window less the stand-in insets, to within the canvas's last pixel, and the picture is red under the notch and not below it. With `?fixed=1`, no screen has a finding or an engine warning. With a question open as well (`?ask=1`), on three screens, only the question's buttons `no` and `yes` are told: its backdrop over the whole canvas is no finding, and the buttons under it are not compared with its own. `tests/egret-verify.test.mjs` checks the command's options and the findings for given controls in Node.
- The same example also uses `--screens --play` on all nine profiles to tap Pause and Stay in the modal: it checks the three states separately, checks a fresh control receipt while the simulation is paused, samples a colour at each device pixel ratio, and verifies that checkpoint and raw picture paths stay distinct. Assigned failures confirm that an unsafe earlier state fails a screen even if the last state is safe, a script error does not skip subsequent screens, invalid or duplicate checkpoint names and picture collisions are rejected, a resized viewport is not counted as the original profile, and a lost control report cannot silently pass.
- `tests/egret-migrate-eui.test.mjs` grows the screen of a `fixedWidth` project from 480 × 320 to 480 × 400 units. A bar at `bottom="0"` moves from 280 to 360, a centred part moves with the new middle, and `RESIZE` is told once.
- In headless Chromium, a migrated `fixedWidth` game of 750 × 1334 was turned from a 375 × 667 window to 393 × 852:
  - `stage.stageHeight` went from 1334 to 1625;
  - `RESIZE` was told once;
  - a bar drawn from `stageHeight` reached the bottom row of the window.

  That run is recorded in the pull request that added the modes.

The original software runs did not cover a physical notch phone, Safari or WeChat itself. The page's own insets were never other than 0 in these runs; the notch was given as `insets` or through `__egretAgent.insets`. `wholeScale` was checked at one device pixel to a CSS pixel in the browser, and at two only in Node.

## Design notes

Game UI frameworks commonly handle screen shapes this way. LumioGames LGUI, for one, uses two designs that share a short side and a safe node that the framework moves; it was studied as a reference and none of its code is used. Here the rules apply to a stage rather than to named components. A game places its edges from `safe` in its own code.

## November 27 device follow-up

November 27 follow-up: Windows hardware WebGL2 and Fold7 WebGL2/WebGPU passed the selected fixed modes, pin, whole-scale high-DPR and UI/view geometry cases. Fold7 ran at 873 × 325 CSS pixels and DPR 2.625; supplied insets and portrait/tablet parent sizes were scripted. Actual notch/fold transitions remain open. [Device observations and remaining coverage](november-27-claude-hardware.md). The separately tested #516 opt-out preserves world coordinates under independently scaled views on both physical devices and APIs.

## Independent scale and native screen reports for a 3D overlay

The ordinary fit sets CSS pixels per logical unit. With a full-coverage transparent World3D overlay, the interface may need its own size instead of shrinking with the design on a phone or growing without bound on a monitor:

```js
const overlay = await createWorld3DOverlay(canvas, {
  width: 800, height: 420, portrait: { width: 380, height: 680 },
  fit: 'expand', uiScale: { min: 1, max: 1.35 }
});
const game = overlay.game;
// Layout and projected world positions use game.screen.width, height, safe and scale.
```

`uiScale` bounds the actual CSS pixels per overlay logical unit. Both bounds are optional, finite, positive, and the minimum must not exceed the maximum. It is for a fit filling the overlay (`expand` or a fixed mode), not `stretch`, `contain`, `cover` or `wholeScale`. If a bound changes the fit's scale, the stage follows the space on **both** axes; the design centred on it may be cut off. Place controls using the current `game.screen.safe` instead of the design rectangle. `game.onScreenChange`, pointer hit testing, the semantic projection and `overlay.box` use the same actual logical extent and scale. The 3D canvas is not resized by this option. To project a point from the scene canvas, first map it to CSS pixels, subtract the overlay canvas's CSS origin and divide by the actual logical scale (or map by its CSS rectangle and logical width/height).

The same option is available to `planScreen` and the underlying `createBrowserGame` with a filling planned fit. It is distinct from `play({ uiScale })`, which scales its declarative views without changing its gameplay stage.

The native `verify --screens` report is emitted for World3D overlays even when the overlay draws on demand or its drawing loop is stopped. Geometry comes from visible, interactive display objects: explicit `hitArea` transformed to stage and CSS coordinates and restricted by clip rectangles. For an implicit hit area or transformed shape the report uses its axis-aligned envelope; pixel-level shape occlusion is not proved. A full-stage pointer barrier excludes background controls. When a real `createBrowserSemantics` projection owns the overlay canvas, actionable semantic nodes with matching native bounds supply their current names and modal/disabled state; sizes come from the native hit areas, not the painted shadow or focus outline. Native action, movement, range, and scrollbar-thumb bindings report even without a semantic name; toggle and selection items use their action binding. Their live enabled state is observed without adding an input route. An interactive semantic role (for example a slider with pointer drag but no activation action) can name a matching target. An anonymous pointer-only panel is not treated as a button when there is a semantic projection. Without a projection, visible native touch targets retain the name or position fallback. The tool-only receipt timer is removed on disposal and runs only when a screen-tool collector is present.

`tests/ui-screen.test.mjs` checks clamping and invalid bounds. `tests/world3d-overlay-screen-browser.mjs` exercises independent scale, actual semantic names and hit-area geometry, real touch routing, notch/target/overlap findings, a turn while drawing is stopped, and report cleanup in Chromium; it is not a device performance test.

## Clipped controls and declared painted coverage

Play and the World3D native overlay use one screen-receipt geometry collector. It includes real directly installed native action, range, movement and scroll bindings, as well as Play's own taps and gestures. Where a native hit rectangle matches a real semantic node, the receipt names it by that node's current accessible name. Hidden, disabled or inert actions are excluded, and decorative structural groups do not become buttons merely by having bounds.

A control's authored hit envelope is transformed with all four corners. The actual convex polygons of transformed ancestor clip rectangles and hit areas are intersected before taking their axis-aligned envelope. This avoids false exposed targets or inflated bounds at rotated, nested clips, and also applies to declared painted faces and semantic geometry matching. A completely clipped row is absent, and a partly clipped row uses its exposed geometry for safety and overlap but its authored size for the 44 CSS-pixel touch-target check. A row legitimately peeking out of a scrolling list is not inherently an undersized button. The reporter does not clip to the safe area or canvas boundary to hide a misplaced target; an unclipped target under a notch still fails. Native display ancestry, not geometric containment alone, identifies related targets; two unrelated buttons with one inside the other still produce an overlap warning. Older third-party receipts without identity metadata retain their former containment interpretation.

A later native input surface can receive an actual pick inside an unrelated target's overlap; the report then advises `occluded`. This is input obstruction, not a claim about pixels. To also check a visual-only HUD panel that deliberately paints over controls but takes no input, mark its actual painted face:

```js
import { registerScreenOccluder } from '@egret/engine/ui';

const registration = registerScreenOccluder(statusCardSprite, {
  name: 'Status card',
  rect: () => ({ x: 0, y: 0, width: cardWidth, height: cardHeight })
});
scope.use(registration);
```

The local rectangle and name may be values or functions. Registration is purely diagnostic; it does not alter rendering, hit testing, controls or focus. The reporter maps the declared face from the live display tree with its actual transform, ancestor clips, visibility and draw order. It reports an advisory `occluded` finding with `source: 'paint'` for an unrelated, later face that overlaps a target. It excludes invisible and alpha-zero faces and related ancestor/descendant decoration. Dispose the returned handle when its face is retired. For a declarative view, `view.get(name)` is the actual panel sprite; use its own painted local rectangle (not a container's combined children), and replace the registration from `built(view)` if an orientation variant replaces that sprite. Use a conservative inner rectangle for rounded faces. Do not mark a transparent holder or infer opacity from a semantic group's aggregate bounds.

These findings are geometric/input observations, not pixel-level visibility proof for arbitrary masks, texture transparency, filters or rotated shapes. Unregistered visual-only artwork remains a screenshot-review task. The native receipt runs only under the existing screen verifier.

`tests/egret-verify.test.mjs` checks visible-versus-authored sizes, real ancestry and input/paint finding interpretation. The real-browser fixture `tests/screen-control-report-browser.mjs <absolute Playwright index.mjs>` exercises both actual Play and World3D overlay surfaces, native scrolling and direct actions, declared painted coverage, true input obstruction, unrelated containment and disposal. It is not a device performance qualification.
