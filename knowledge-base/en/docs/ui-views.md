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

It was not run on a phone, with a screen reader, or in another browser.

## Design notes

LumioGames LGUI builds its screens from data made in an editor, finds controls by name, and binds data to them in code. This keeps that division but writes the data by hand or by an agent, as a plain object. The data is checked strictly, so a typo is an error and not an empty space. Screens are placed in the safe part of any screen shape, are reached by tests through the semantic tree, and close as screens of the stack. The design was studied as a reference; none of its code is used.
