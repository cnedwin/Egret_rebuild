# Testing a UI by what it says

English | [简体中文](../../Cns/docs/ui-testing.md)

A check that clicks at coordinates breaks when a button moves, and when it fails it says only that a pixel was the wrong colour. `createUiTester` of the optional entry `@egret/engine/ui/testing` finds a control by its name and drives it through the [semantic tree](ui-semantics.md). It uses the same actions that a press, a key and assistive technology reach. A check written this way runs in Node with no browser. When it fails, it says what the screen held instead.

## Use

```js
import { createUiTester } from '@egret/engine/ui/testing';

let now = 0; // the engine's clock takes the time of its source, in steps of at most a tenth of a second here
const advance = seconds => { for (const end = now + seconds; now < end; ) engine.advanceTime((now = Math.min(end, now + 0.1))); };
const t = createUiTester({ semantics, update: () => frame(), advance, screens });
t.press('Shop / Buy');                 // the Buy button inside the group named Shop
assert.equal(t.text('text:Gold 40'), 'Gold 40');
assert.equal(t.state('Sound').checked, false);
await t.wait(2);                       // two seconds of the game
assert.equal(t.screen, 'map');         // the screen in front of the screen stack
```

| Call | What it does |
| --- | --- |
| `find(query)` | The one node the query names, as the tree published it |
| `findAll(query)`, `exists(query)` | Every node it names; whether it names exactly one |
| `press(query)`, `focus(query)` | Performs `activate` or `focus` |
| `text(query)` | The node's name: the words of a text, the label of a button |
| `state(query)` | Its role, name, `disabled`, `focused`, `checked`, `selected`, `expanded`, `value` and `now` for a range |
| `wait(seconds)` | Calls `advance`, then brings the tree up to date |
| `screen`, `back()` | The id of the screen in front of [the screen stack](ui-screen-stack.md), and its back key |
| `outline()` | What the screen holds, one node a line, indented under what it is in |

`update` brings the tree up to date before every read. Give it when a frame of the game commits the UI and publishes the tree. Without it, `semantics.publish()` is called.

## Queries

- `'Buy'`: the node named Buy.
- `'button:Buy'`: a button named Buy. A role alone, `'dialog'`, names every node of that role.
- `'Shop / Buy'`: a Buy inside something named Shop. The earlier names are read from the outside in, and they need not be direct parents.
- `'Buy#1'`: the second Buy, counting from 0, in reading order.

## Failures

A query that names nothing throws `UI_TESTER_NOT_FOUND`, and one that names several throws `UI_TESTER_AMBIGUOUS`. A press on a control that is disabled, behind a modal dialog or without that action throws `UI_TESTER_REFUSED`. Each message ends with the outline of the screen:

```text
UI_TESTER_NOT_FOUND: Nothing on the screen has that name. … Inventory is not on the screen. It holds:
group "Shop"
  text "Gold 100"
  switch "Sound" [checked]
  group "Sword"
    button "Buy"
```

A press reaches the same function a tap does, but not the drawing in between: a button drawn in the wrong place, or covered, still passes. The picture is checked in a browser, as each example's `verify.mjs` does. The tester does not type text. A text field is edited through the platform's own input, which [text input](text-input.md) covers.

## What is checked

`tests/ui-tester.test.mjs` builds a shop by hand with a group, a text, a switch, a slider, two rows of Buy and a modal dialog, and checks:

- finding by name, role, path and number;
- presses that reach the shop's functions;
- states read after each change;
- refusals for a disabled control, a control behind the dialog and a missing action;
- the outline in failures;
- `wait` with a game's own clock;
- the screen stack's front and back key.

## Design notes

LumioGames LGUI tests its screens in Node by control paths such as `Bag/BagPanel.list[0]`, with a fake clock. Here a control is found through the semantic tree instead, which the application already publishes for assistive technology. A test and a screen reader then reach the same names and the same actions. The design was studied as a reference; none of its code is used.
