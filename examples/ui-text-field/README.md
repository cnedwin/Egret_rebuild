# Text fields

English | [简体中文](README.zh-CN.md)

A form drawn by the engine: a name, a motto and a button. `createTextFieldControl` holds the text of each field and opens the platform text input over it, so a player types with whatever input method the platform has. A press, a key and a request of assistive technology all begin the same edit.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-text-field/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press the name and type, with an input method if you use one. Enter commits. At most eight characters are taken, and one Chinese character counts once.
- Press the motto and type several lines. Enter is a line break there. Press elsewhere to commit, or Escape to cancel.
- Press one field while the other is open. The open one is committed and the other opens.
- Click the canvas, then use the keyboard. Tab moves between the name, the motto and the button. Enter or Space opens a field or presses the button, and when an edit ends the focus is back on the field.
- Press the button. The line beside it shows what was saved.
- Disable the form. Nothing opens, and an edit that was open is cancelled.

## How it works

`main.mjs` creates one `createBrowserTextInput` for the canvas and gives it to both fields as their `editor`. Each `createTextFieldControl` is asked through `field()` where its box is on the stage and how the platform field should look. The engine draws the committed text and hides it while the control is `editing`, because the platform field shows the text then.

Keys arrive from `@egret/engine/web/keyboard` at the display object with the focus, where a `createControlKeys` of kind `'textField'` opens a field with `edit()` when Enter or Space is released, so that the key types nothing into it. When an edit ends the page gives the focus of the application back to the field.

`createUiSemantics` describes the form: a group, two text boxes with their text, and a button. The node of a field is hidden while the field is edited, because the platform field is then the field's own element and nothing should be announced twice.

See [the control guide](../../knowledge-base/en/docs/ui-controls.md#text-field), [the text input guide](../../knowledge-base/en/docs/text-input.md) and [the semantics guide](../../knowledge-base/en/docs/ui-semantics.md).

## Check

```text
node examples/ui-text-field/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: a composition of an input method, several lines and one field handing the editor to the other, the keyboard, the accessibility tree, disabling, and a phone profile. They passed in headless Chromium with software WebGL2.

The composition is driven through Chromium's protocol: provisional pinyin, then the chosen characters. A real input method, a real on-screen keyboard, the system clipboard, a hardware GPU, WebGPU, Edge, Safari, Firefox, a real phone, a person at the keyboard and any screen reader were not run.
