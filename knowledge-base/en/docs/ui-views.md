# Screens as data

English | [简体中文](../../Cns/docs/ui-views.md)

A game's shop, settings page or result screen is mostly the same work each time: cards, rows of buttons, a number, a bar, a switch, placed against the edges and kept up to date. Written as sprites, that work hides the screen's shape in arithmetic and is redone when the phone turns. Here a screen is described as data instead. The description names the parts code cares about, and a table binds those names to the game's state. `@egret/engine/web/view` checks a description and plans where its parts go; `game.show` of [play](play.md) draws the plan in a skin and keeps it bound.

## A screen

```js
const shop = game.show(
  {
    label: 'Shop',
    root: {
      type: 'panel', card: true, anchor: 'center', width: 420, height: 280, padding: 16, layout: 'column', gap: 12,
      children: [
        { type: 'text', name: 'gold' },
        { type: 'bar', name: 'hp', label: 'Health', height: 14 },
        { type: 'toggle', name: 'sound', text: 'Sound' },
        { type: 'panel', layout: 'row', gap: 12, height: 52, justify: 'center', children: [
          { type: 'button', name: 'buy', text: 'Buy 60', width: 140 },
          { type: 'button', name: 'sell', text: 'Sell all', width: 140 }
        ] }
      ]
    },
    portrait: { /* the same names, across the bottom of a phone held upright */ }
  },
  {
    state,
    bind: {
      gold: { pick: s => s.gold, roll: 0.5, format: n => 'Gold ' + n },
      hp: { value: s => s.hp / s.maxHp },
      sound: { checked: s => s.sound, tap: s => (s.sound = !s.sound) },
      buy: { disabled: s => s.gold < 60, tap: s => (s.gold -= 60) },
      sell: { tap: () => askToSell() }
    }
  }
);
```

The code changes `state`; it does not touch the screen. Each frame, after `update`, every binding is read and only what changed is drawn again.

## Parts

| `type` | What it is | Its own fields |
| --- | --- | --- |
| `panel` | A place that holds parts, drawn as a card with `card: true` or `color` | `layout` (`'free'`, `'row'`, `'column'`), `gap`, `padding`, `align`, `justify`, `alpha`, `label`, `children` |
| `text` | A line of words, in the middle of its place up and down | `text`, `size`, `color`, `align` (`'left'`, `'center'`, `'right'`), `bold` |
| `button` | A button with words | `text` (required), `size`, `color`, `textColor` |
| `bar` | How full something is, 0 to 1 | `value`, `color`, `label` |
| `toggle` | Words, and a switch at the right end | `text` (required), `checked`, `size` |
| `space` | Nothing; `'fill'` in a row pushes what follows to the end | |

Every part may have `name`, `anchor`, `x`, `y`, `width`, `height` and `visible`. A size is game units, a share such as `'50%'`, or `'fill'`. In a free panel a part is placed from its `anchor`, one of the corners, edges or `'center'`, and `x` and `y` move it inward. In a row or a column, the parts follow one another. Fixed sizes come first, then the parts that fill share what is left. `align` places them across, and `stretch` is the default. `justify` gathers them along the row when none of them fills: `'start'`, `'center'`, `'end'` or `'between'`.

The root is placed in `game.safe`, the part of the screen no notch covers, or in all of `game.screen` with `area: 'screen'`. It is planned again whenever the [screen](screen-fit.md) changes. While the screen is taller than wide, `portrait` parts are used, and the parts are built again; `built(view)` is told each time. The portrait parts must have the same names, of the same kinds.

A field a part does not have, a name used twice, or a portrait that lacks a name is refused with `UI_VIEW_INVALID` or `UI_VIEW_VARIANT_MISMATCH`. The error says which part, such as `root/3/0 (buy)`. A binding for a name the view does not have is refused with `UI_VIEW_BINDING_UNKNOWN`, and one a part cannot take with `UI_VIEW_BINDING_INVALID`. A misspelt field is never drawn as nothing.

## Wrapped labels, button details, images and borders

Pass a `paragraphCache` to `game.show` to use the [paragraph SDK](paragraph-layout-controls.md) inside a text part or a button description. Give each paragraph part a height in the view description. Text wraps to the planned width and clips at the bottom of the box. Button details sit below the title and wrap within the button's inner width. Use `lineHeight` for minimum line spacing, `fontFamilies` in fallback order, and `maxLines` to cap the number of lines. A button with only `text` continues to use its single-line title.

```js
import { createParagraphCache } from '@egret/engine/paragraph';

// In play's setup, reuse the cache and provider owned by the game.
const paragraphCache = createParagraphCache(game.engine.assets, { provider });
const paragraph = { fontFamilies: ['Noto Sans', 'Noto Sans CJK SC'], locale: 'zh-CN', lineHeight: 24 };
const workshop = game.show({
  label: 'Workshop',
  root: {
    type: 'panel', width: 340, height: 300, padding: 14, layout: 'column', gap: 10,
    border: { color: 0x8ba87a, width: 2 },
    children: [
      { type: 'image', name: 'cover', src: '/art/workshop.webp', label: 'Workshop', height: 64 },
      { type: 'text', name: 'notes', text: '筹备 Wood workshop', paragraph, height: 72 },
      { type: 'button', name: 'build', text: 'Build workshop', description: '备齐两箱木材。\nPlace two crates.',
        paragraph: { ...paragraph, maxLines: 3 }, height: 108, border: { color: 0x56caff, width: 2 } }
    ]
  }
}, { paragraphCache, bind: { build: { tap: () => buildWorkshop() } } });
```

Any part accepts `border: { color, width }` and draws it inside the layout box. An `image` keeps its aspect ratio and is centred in the box. Give the image a `name` and `label` to expose its role and accessible name. `game.show` releases its own paragraph and image borrows when the view closes. Keep the shared cache and provider alive until the views that use them close, then dispose of them in your game.

Play queues declarative image parts across views in the same game. It starts up to four loads at a time and skips queued parts when their view closes or rebuilds. Explicit image loads share the same browser image budget. When they occupy all the slots, a declarative load can still report a job-limit error.

The paragraph provider and its fonts are selected by the game. For a browser setup, see the [paragraph panel example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.md). Its opt-in CanvasKit build and Noto fonts carry the [source and license records](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json). Normal single-line views can start without loading those files. A page that uses paragraphs through a native import map also maps `@egret/engine/paragraph` and `@egret/runtime/paragraph`, plus `@egret/engine/web/paragraph` for the CanvasKit provider.

```text
node tools/build.mjs
node --test tests/ui-view.test.mjs
node examples/play/verify-ui.mjs <absolute Playwright index.mjs> <new absolute output directory> <absolute Chromium executable> rich
```

In Chromium 157 with software WebGL2, both parts wrapped to three lines with 24-unit baseline spacing. Pixel samples confirmed the border and the WebP cover, the button fired once per click, and closing the view returned the cache's caller lease count to zero. Hardware WebGPU, Safari, Firefox and physical phone rendering for this fixture remain to be checked.

## Bindings

| Key | For | Read as |
| --- | --- | --- |
| `text` | text, button, toggle | the words |
| `pick`, `format`, `roll` | text, button | a number, the words for it (whole numbers unless given), and seconds to count to a new one |
| `value` | bar | 0 to 1 |
| `checked` | toggle | on or off |
| `disabled` | button, toggle | greyed; a press does nothing |
| `visible` | every part | hidden with what it holds |
| `color` | text, button, bar, panel | the colour drawn |
| `tap` | button, toggle, panel | what a press does, given the state |

What a binding throws stops the game, as what `update` throws does.

## The skin

Parts without colours of their own are drawn in `DEFAULT_VIEW_SKIN`: white words on slate cards, blue buttons, grey when disabled, a green accent for bars and switches, rounded by 10. `skin: { button: 0xe11d48 }` in a description changes what it names.

## The view

`game.show` returns the view:

- `get(name)` is the sprite of a part, to give [gestures](gestures.md), add to or tween.
- `rect(name)` is where the part is in game units, and `shows(name)` whether it shows.
- `show()`, `hide()`, `close()` and `refresh()`.

A view is also a handle of the [screen stack](ui-screen-stack.md). `open: () => game.show(...)` makes it hide when covered, take no presses when another screen is in front, and go when it closes. To use the stack in a page without a bundler, map `@egret/engine/ui` in its import map.

`modal: true` puts a dim over everything behind the view and takes every press that misses it.

## Scrollable views

Add `scroll: 'vertical'` to a panel with an explicit height. A column of row panels works for a two-column building list. The viewport clips its descendants and accepts wheel, touch drag and keyboard navigation.

```js
const buildings = game.show({
  label: 'Buildings',
  root: {
    type: 'panel', name: 'list', scroll: 'vertical',
    layout: 'column', gap: 8, width: 330, height: 104,
    children: [0, 1, 2, 3].map(row => ({
      type: 'panel', layout: 'row', gap: 12, height: 44,
      children: [
        { type: 'button', name: 'house' + row, text: 'House', width: 'fill' },
        { type: 'button', name: 'workshop' + row, text: 'Workshop', width: 'fill' }
      ]
    }))
  }
}, { bind });
const scroll = buildings.scroll('list');
scroll.scrollTo(48);
```

The handle exposes `offset`, `maximum`, `scrollTo`, `scrollBy`, and `page(-1 | 1)`. A binding refresh preserves the offset, clamped to the available content. Tab and Shift+Tab can bring the next or previous control into view. A direct tester or accessibility action on a fully clipped control is refused until it has a visible region. A touch drag along the viewport's local vertical axis scrolls without pressing the row, even if an ancestor is rotated. A wheel that moves this view is consumed by the view before `game.pointer.wheel`. When migrating existing screens, give each panel one scroll controller.

## Interaction bounds

The semantic tree publishes a part's live stage-space bounds after ancestor transforms and clips. A clipped-out control leaves the tree. Partially clipped controls publish the remaining bounds. A modal restores focus to the previous control if it is still actionable, or to another actionable control when the previous one is unavailable. `view.rect(name)` remains the authored layout box.

### Browser check

After building the workspace, run:

```text
node examples/play/verify-ui.mjs <absolute Playwright index.mjs> <new output directory> <absolute Chromium executable>
```

Windows Chromium 157 with SwiftShader WebGL2 reproduced the original button at (620, 430, 120, 42). It now moves to (545, 430, 120, 42), publishes and projects the clipped region (555, 415, 97.5, 12), and disappears when fully clipped. The building fixture observed offsets 62 by wheel, 54 by touch drag, 48 on keyboard reveal, and 0 after the list shrank. The input was injected through the browser, and the projected DOM is available to assistive technology. Actual screen-reader speech and real-finger interaction require device acceptance.

## Dense menus and controller focus

Keep each control's visible words and accessible name in its `text` binding. Play suspends the label's raster work when the view or one of its display ancestors is hidden. Showing the view prepares its current words again. A hidden page can retain its game state while releasing its borrowed rasters.

`game.browser.getLabelStatus()` reports work in progress, queued requests, budget refusals, released rasters and logical cache accounting. The cache accounts for reusable slots separately from live generations that are still borrowed. A direct label created with `game.browser.createLabel()` can use `setRasterActive(false)` while its owner is hidden. Its `ready` promise reports preparation errors when active.

The default cache retains 32 reusable slots and admits up to 64 current and retired generations within its byte budget. For a market with several pages, hide the previous page before showing the next. A direct active label reports `TEXT_CACHE_BUDGET` on `ready` if the limit persists after pending work settles. Release or suspend unused labels, then retry with `label.set({})`. Closing a page releases the labels' borrows. The cache can keep reusable entries until the game closes.

Tab and Shift+Tab move visual focus on the canvas. Enter and Space activate the focused control. A modal owns focus until it closes, and a disabled control is skipped. The foremost modal can also use the standard gamepad D-pad and A. Add `gamepad: true` for a nonmodal menu that should own those controls. Other nonmodal views leave these buttons available to gameplay.

```js
function openPauseMenu(game, pauseView) {
  game.pause();
  const resume = view => {
    view.close();
    game.resume();
  };
  const menu = game.show(pauseView, {
    dismiss: resume, // Escape or gamepad B
    resume,          // A fresh Start press while paused
    bind: { continue: { tap: () => resume(menu) } }
  });
  return menu;
}
```

Use a modal view description with a `continue` button. The D-pad goes forward or back in the view's authored order and can scroll a newly focused row into view. Pausing gameplay leaves menu input available. A held Start produces one edge, including when the callback resumes gameplay.

Run `node tools/build.mjs`, followed by `node examples/play/verify-market-ui.mjs <absolute Playwright index.mjs> <new absolute output directory> <absolute Chromium executable>`. The same run exercises the 390 × 844 market label fixture and a keyboard plus simulated standard gamepad modal. Physical gamepads are a separate test surface.

On Windows Chromium 157 with SwiftShader WebGL2, the previous engine drew 48 opening labels but only 16 of the next 48 after an immediate page switch. The new fixture detects the same capacity pressure and checks pixels in every cell. All 48 labels and matching names were present on both pages and after three rapid price updates. Switching released 48 borrows and closing returned active caller leases to zero. A separate saturation control admitted 64 labels, reported one refusal, and retried successfully after a release.

On Galaxy Z Fold7 with Android 17, Chrome 157 and the Adreno 830 GPU, the functional fixture passed with WebGL2 and WebGPU. Both rendered all 48 labels and activated the next-wave action once. The test page used a 390 × 844 CSS viewport and injected touch through Chrome DevTools Protocol. Physical controller input, human touch and frame performance have separate acceptance.

## Parts most screens need

| Call | What it is |
| --- | --- |
| `await game.confirm(question, { yes, no, title })` | A modal question. Enter, Space and gamepad A activate the focused button. Escape and B cancel. Questions asked while one is open wait their turn. `game.asking` is true while one is open, so `update` can leave the game alone |
| `game.hints(list)` | A bar at the bottom of the safe part. Each hint is `{ action, key, pad, touch }`, and the bar names it in the words of what the player last used, `game.device`. A keyboard or a mouse shows `Space Jump`, a pad `A Jump`, and a finger the `touch` words; a hint without them is left out on a touch screen. `shown` is what it says now; `set(list)` and `dispose()` |
| `await game.loading(tasks, { label, atOnce })` | `Loading 2 / 5` and a bar over everything while promises, or functions that return them, finish; functions run `atOnce` at a time (4). Gives their results in order; a failure closes it and is thrown |
| `game.badges` | Red dots that add up along paths: `set('mail/system', 3)` makes `count('mail')` 3 as well. `has`, `clear(path)`, `paths()`, `onChange`. A restart clears them. The `badge` binding draws one at a part's top right corner, and `view.badge(name)` reads it |
| `game.compact(n, { locale, digits })` | `999`, `12.3K`, `4.5M`; with `locale: 'zh'`, `9999`, `1.2万`, `3.4亿`. Cut rather than rounded, so 9999 is `9.9K` and not `10K`. The page's language unless given |
| `game.request(send)` | What a button sends, sent once at a time. A second `run()` while one is out gets the same promise. `busy`, `result` and `error` are there to bind the button's `disabled` and words to; a failure is kept in `error`, not thrown |

`createBadges`, `formatCompact`, `createRequest` and `keyCap` are exported from `@egret/engine/web/view` too, for code that does not use play.

## Tests and assistive technology

Give `play` a tree, `semantics: createUiSemantics()` from `@egret/engine/ui/semantics`. Every view then adds itself to it. Its `label` is a group, or a dialog when modal. Each named part becomes what it is: a group, a text, a button, a progress bar or a switch. The tree is published at the end of every frame. A [UI tester](ui-testing.md) then presses `'Shop / Buy 60'` and reads `state('Sound').checked`. It is refused, as a player is, when the button is disabled or a modal is over it. `@egret/engine/web/semantics` shows the same tree to a screen reader.

## What is checked

`tests/ui-view.test.mjs` plans views in Node. It checks:

- anchors, offsets, shares and fill in a free panel;
- rows and columns with fixed sizes and fill, gaps, padding, `align` and `justify`;
- portrait parts and the two areas;
- every refusal, with the place it names.

`examples/play/verify-views.mjs` shows a shop with `game.show` in headless Chromium (software WebGL2). It checks:

- the skin's blue, and its grey when the button is disabled, read from the page where the plan put the button;
- a number that counts down;
- a disabled button that refuses the mouse and the tester;
- a mouse click on the switch;
- a modal that takes the click meant for the shop and refuses a press by name behind it;
- after the window turns, the portrait parts with the same bindings, and a click at the button's new place.

`tests/ui-view-parts.test.mjs` checks the parts that draw nothing:

- red dots that add up and are told when they change;
- short numbers in both languages;
- a request a second press does not send;
- key caps.

`examples/play/verify-view-parts.mjs` checks the rest in the browser:

- a red dot read red at its corner;
- a double click that buys once while the button is busy;
- two questions answered by Escape and by a click;
- the hint bar after a key, a mouse click and a tap;
- loading that counts to three.

It was not run on a phone, with a screen reader, with a gamepad, or in another browser.

## Design notes

LumioGames LGUI builds its screens from data made in an editor, finds controls by name, and binds data to them in code. This keeps that division but writes the data by hand or by an agent, as a plain object. The data is checked strictly, so a typo is an error and not an empty space. Screens are placed in the safe part of any screen shape, are reached by tests through the semantic tree, and close as screens of the stack. The design was studied as a reference; none of its code is used.
