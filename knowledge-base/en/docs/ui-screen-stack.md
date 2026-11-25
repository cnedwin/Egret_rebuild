# The screen stack

English | [简体中文](../../Cns/docs/ui-screen-stack.md)

A game with more than one screen needs the same rules every time. A shop opens over the map and the map waits behind it. A dialog asks a question and gives the answer to whoever asked. The back key closes what is in front, but not the screen the game starts from. Two dialogs do not appear over each other. `createUiScreenStack` of `@egret/engine/ui` keeps these rules. It draws nothing: each screen is made by its definition, and the stack tells it, through its handle, when it is shown, covered, revealed, put in front or closed.

## Layers

| Layer | What it is | Covers what is under it |
| --- | --- | --- |
| `page` | A whole screen: the map, a shop, a bag. Pages form a stack | A page with `fullScreen` (the default) covers the pages under it |
| `popup` | A panel over the pages: a menu, a picker, item details | Never |
| `modal` | A question that must be answered: one is shown at a time, and the others wait their turn | Never |

The screen in front, the `active` one, is the modal shown, or the top popup, or the top page. Only it should take input.

## Use

```js
import { createUiScreenStack } from '@egret/engine/ui';

const screens = createUiScreenStack();
const Shop = {
  id: 'shop',
  layer: 'page',
  open(context) {
    const panel = drawShop(context.params.tab);       // what the game draws
    return {
      show: () => (panel.visible = true),
      cover: () => (panel.visible = false),          // a full-screen page went over it
      reveal: () => (panel.visible = true),
      close: () => panel.dispose()
    };
  }
};
const Confirm = {
  id: 'confirm',
  layer: 'modal',
  open(context) {
    const card = drawQuestion(context.params.text, answer => context.close(answer));
    return { close: () => card.dispose() };
  }
};

void screens.open(Shop, { tab: 'gear' });
if (await screens.open(Confirm, { text: 'Sell the sword?' })) sell();
```

- `open(screen, params)` opens a screen after whatever was asked before it is done. The promise settles when the screen closes: with what was given to `context.close(result)` or `close(screen, result)`, or with undefined when the back key, `popTo`, `replace` or `closeAll` closed it. A page that is never awaited may be opened without `await`.
- Opening a screen that is open, or still being made, with equal parameters gives the same promise, so a double tap opens one reward. With other parameters it is refused with `UI_SCREENS_ALREADY_OPEN`: queue such screens in the game, one after another.
- `back()` does what the back key does: what the `back` of the screen in front says. That is `'close'` (the default), `'none'`, or a function to call. It never closes a page that is alone on the stack. It resolves to whether something was done. Bind Escape and Android's back key to it.
- `replace(page, params)` closes the top page and opens another in its place. `popTo(screen)` closes everything over a screen. `closeAll(layer?)` closes a layer, or everything, waiting modals too.
- `context.signal` is aborted when the screen closes: give it to a request the screen starts. `context.covered` and `context.active` say how it stands now.
- `snapshot()` gives the ids of the pages, popups, the modal shown, the modals waiting, the screen in front and the covered pages. `onChange(listener)` is told after each change.

## The order of calls

Opening calls `open`, then `show`, then `cover` on the pages it hides, then `deactivate` on the screen that was in front and `activate` on the new one. Closing calls `deactivate` if it was in front, `hide`, `close`, then `reveal` and `activate` on what is in front after it. Then the next waiting modal opens. Several screens closed by one call, such as `popTo` and `closeAll`, are closed top first, and the stack moves the front once, after all of them.

A screen whose `open` throws or rejects is not kept, and its promise rejects with what was thrown. A handle call that throws does not stop the stack: the change is completed, the first failure rejects the call that made the change, and later ones go to `onError`, or to the page.

## Limits and refusals

A stack holds 32 open or waiting screens unless `maxScreens` (at most 256) says otherwise. A definition without an id of letters, digits, `.`, `-` and `_`, a layer or an `open` function is refused with `UI_SCREENS_DEFINITION_INVALID`. A full stack refuses with `UI_SCREENS_FULL`, and a disposed one with `UI_SCREENS_CLOSED`.

## What is checked

`tests/ui-screen-stack.test.mjs` checks the stack in Node:

- pages covering and revealing, and the back key on the first page;
- results, and signals that are aborted;
- the modal queue, and a waiting modal closed without being made;
- the same promise for equal parameters, and refusal for others;
- `back` policies, `popTo`, `replace` and `closeAll`;
- screens that fail to be made, and handles that throw;
- calls that wait for one another, and a screen closed while it is made;
- refusals.

The stack draws nothing, so pictures and input are checked with the screens built on it.

## Design notes

LumioGames LGUI has five layers, a stack and a modal queue, results given back on close, and a check for the same parameters when a screen is opened twice. These rules follow that design, which was studied as a reference; none of its code is used. Here the stack is separate from drawing and from any screen format, so a `play` game, a managed UI root or the data-described screens can each use it.
