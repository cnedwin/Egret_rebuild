# Text input over a canvas

English | [简体中文](../../Cns/docs/text-input.md)

`@egret/engine/web/text-input` lets a player type text into a game that is drawn on a canvas: Chinese, Japanese, Korean, or anything else the platform can enter. It works over 2D display content and over a World3D scene alike, because it depends on neither.

## Why key events are not enough

`@egret/engine/web/keyboard` reports keys. An input method does not produce text key by key: the player types pinyin, the platform shows candidates in its own window, and the chosen characters arrive as one piece of text. The keyboard entry leaves keys alone while an input method holds them, so a game cannot build Chinese text from it.

While a field is edited, this entry puts a platform text field (`<input>` or `<textarea>`) exactly over a rectangle of the stage. The input method, the on-screen keyboard of a phone, paste, selection and undo are then the platform's own. When the player is done the field is removed, and the game receives the text and draws it itself.

## Use

```js
import { createBrowserTextInput } from '@egret/engine/web/text-input';

const input = createBrowserTextInput({ canvas, logicalWidth: 480, logicalHeight: 300 });

// From the handler of a press on the name box:
input.open({
  x: 40, y: 94, width: 400, height: 40,      // the box, in stage units
  value: sect.name, maxLength: 8, placeholder: '最多 8 个字',
  fontFamily: 'sans-serif', fontSize: 20, color: 0xf3e9d2,
  onCommit(value) { sect.name = value; redraw(); },
  onCancel() { redraw(); },
});
```

Creating the input adds nothing to the page. A field exists only between `open` and the end of its session, and one input shows one field at a time: opening another cancels the one that is open.

[The example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-input/README.md) draws a panel with a single-line and a multi-line field.

## The request

Every length is in logical stage units, the units of the display tree and of pointer positions. Every colour is `0xRRGGBB`.

| Field | Meaning | Default |
| --- | --- | --- |
| `x`, `y`, `width`, `height` | The rectangle the field covers | required |
| `value` | Text the field starts with | empty |
| `multiline` | Several lines (`<textarea>`) | `false` |
| `password` | Hidden characters; single line only | `false` |
| `maxLength` | Most characters, counted as code points: one Chinese character or one emoji counts once | none |
| `placeholder`, `placeholderColor` | Hint shown while the field is empty | none, platform colour |
| `label` | Accessible name | none |
| `locale` | Language tag such as `zh-CN` | none |
| `inputMode` | Kind of on-screen keyboard: `text`, `numeric`, `decimal`, `tel`, `email`, `url`, `search`, `none` | platform |
| `enterKeyHint` | Label of the Enter key of an on-screen keyboard | platform |
| `fontFamily`, `fontSize`, `fontWeight`, `lineHeight` | Text of the field | `sans-serif`, 16, normal, platform |
| `color`, `backgroundColor` | Text colour; background | black, transparent |
| `textAlign`, `padding` | `left`, `center` or `right`; space inside the rectangle | `left`, 0 |
| `select` | `all` selects the starting text, `end` puts the caret after it | `end` |
| `blur` | `commit` or `cancel`: what losing focus does | `commit` |
| `onChange`, `onCommit`, `onCancel` | See below | none |

The background is transparent unless one is given, so the box the game drew shows through. **The game should not draw the field's text while it is edited**: the platform field shows it, and two copies never align exactly.

## What ends a session

| Event | Single line | Several lines |
| --- | --- | --- |
| Enter | commits | inserts a line break |
| Ctrl+Enter or Command+Enter | commits | commits |
| Escape | cancels | cancels |
| A press outside the field | `blur` | `blur` |
| Focus moves to another element, or the on-screen keyboard is dismissed with its Done key | `blur` | `blur` |
| `commit()`, `cancel()` | as named | as named |
| `open()` of another field, `dispose()` | cancels | cancels |

- **`onCommit(value)` and `onCancel()` are called after the field is gone**, so either may open the next field.
- **A key the input method consumes ends nothing.** Enter that chooses a candidate and Escape that closes the candidate window belong to the input method.
- **The press that opens a field does not close it.** `open` may be called from `pointerdown`, `pointerup` or `click`.
- **A window that loses focus keeps the session.** The field has focus again when the window returns.

## Changes and composition

`onChange({ value, composing })` is called when the text changes. `composing` is `true` while the input method holds provisional text, for example `nihao` before `你好` is chosen; `value` then contains that provisional text. A game that validates or filters should wait for `composing: false`.

`maxLength` is applied when a composition ends, never during it, because pinyin is longer than the characters it becomes. Text over the limit is taken from what was just entered, at the caret; the text already in the field stays.

## Keys of the game

- **Keys typed into the field do not bubble out of it.** A shortcut that listens on the document or the window does not fire while the player types. Pass `isolateKeys: false` to let them bubble. A listener that uses the capture phase sees them either way.
- `createBrowserKeyboardInput` handles keys only while the canvas has focus, so it is silent while a field is open.
- **When a session ends, focus returns to the canvas** if the canvas can take it (it has a `tabindex`, which `createBrowserKeyboardInput` sets). When Enter or Escape ended the session, focus returns when that key is released, and its repeats and its release are not delivered to the game.
- `getSnapshot().state` is `'open'` while a field is shown.

## Placement

The field keeps its logical size and is scaled with the canvas, so its text is as large, relative to the picture, at any size of the canvas.

- The rectangle is mapped through the bounding box of the canvas, as pointer input maps positions. The canvas must have no border or padding and must show its whole picture (`object-fit: fill`, the default).
- The field is placed again when the window, the visual viewport or the canvas changes size, and when anything scrolls. Call `move(rectangle)` when the box moves on the stage, `resize(logicalWidth, logicalHeight)` when the logical size of the stage changes, and `sync()` after a change the page cannot observe, such as a CSS transform set on an ancestor.
- The field is added to the parent of the canvas, or to `options.parent`. **For fullscreen, request it on a container that holds the canvas, not on the canvas itself**: a fullscreen canvas shows nothing else.
- An ancestor that moves or scales the canvas with a CSS transform is allowed. **One that rotates it is not supported**: the field is placed on the bounding box.

## Phones

- **Call `open` from the handler of the press.** Platforms show the on-screen keyboard only for focus that follows a touch.
- **Use a `fontSize` of at least 16.** iOS zooms the page when a field with smaller text takes focus.
- The on-screen keyboard may cover the field. Browsers scroll or shift the page to show a focused field; the field follows the canvas when they do.

## Errors

Invalid arguments throw an `EgretError` and change nothing.

| Code | When |
| --- | --- |
| `BROWSER_TEXT_INPUT_OPTIONS` | An option of `createBrowserTextInput` is invalid |
| `BROWSER_TEXT_INPUT_SURFACE` | No page, not a canvas of this page, or the canvas or its parent is not in the page when a field opens |
| `BROWSER_TEXT_INPUT_REQUEST` | A field of the request is invalid |
| `BROWSER_TEXT_INPUT_IDLE` | `setValue` or `move` without an open field |
| `BROWSER_TEXT_INPUT_VALUE`, `_RECTANGLE`, `_SIZE` | Invalid argument of `setValue`, `move`, `resize` |
| `BROWSER_TEXT_INPUT_REENTRANT` | `open` replaced a field whose `onCancel` opened another one |
| `BROWSER_TEXT_INPUT_DISPOSED` | Any call but `getSnapshot` and `dispose` after `dispose` |

An error thrown by `onChange`, `onCommit` or `onCancel` goes to `options.onError`, or to the page's error reporting when none is given. The session ends as it would have.

## Relation to native text editing in managed UI

[Native text editing](native-text-editing.md) (`@egret/engine/web/editing`) edits a text node of the managed UI in place, with the engine's paragraph layout, caret and font sets. It needs a UI root and admitted fonts. This entry needs a canvas and a rectangle: it suits a game that draws its own interface, in 2D or 3D, and wants a name, a chat line or a note from the player.

## What was checked

- `tests/browser-text-input.test.mjs`: thirteen cases against a stand-in for the page. They state what is added to the page and when, where the field is placed, which events end a session, the length limit, focus, key isolation, errors and disposal, and that a strict TypeScript consumer compiles.
- `examples/text-input/verify.mjs`: the example in headless Chromium, with a mouse and with an emulated phone. A composition is driven through the browser's own protocol: provisional pinyin, then the chosen characters.

**Not checked: a physical input method, a real phone, Safari and Firefox.** The rules for composition follow the platform events those browsers document, and the quirks this code allows for (Enter delivered after a composition has ended, a field that keeps focus when the player touches elsewhere, Enter delivered only as a line break) are written from their documented behaviour, not observed here.
