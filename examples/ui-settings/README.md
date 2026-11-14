# Settings screen

English | [简体中文](README.zh-CN.md)

One screen that joins the pieces of the UI: a switch, a group of three options, a text field, a theme switch, a button that asks before it resets, and a managed list of two hundred profiles. Every control answers a press, its usual keys and a request of assistive technology through the same state, and a theme repaints all of it in one frame.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-settings/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press the switch, an option, a profile. Choosing a profile makes its settings the settings; changing one by hand means the screen no longer shows that profile.
- Press the name and type, with an input method if you use one. Enter commits. At most eight characters are taken, and one Chinese character counts once.
- Click the canvas, then use the keyboard alone. Tab visits the switch, the options, the name, the theme switch and the button in that order, and then the list as one stop. Space or Enter activates, the arrow keys move within the options and through the list, and one more Tab leaves the canvas.
- Turn **Dark** off. The whole screen changes paint at once: the drawn controls, the rows of the list, the text, and the card that is not open.
- Press **Reset**. A card asks first. Tab stays inside it, a press on anything behind it reaches nothing, Escape cancels, and the focus returns to the button.

## How it works

| Part | From |
| --- | --- |
| Switch, options, button, text field | `createToggleControl`, `createSelectionGroup`, `createActionControl`, `createTextFieldControl` of `@egret/engine/ui`, with `createHoverControl` for the pointer |
| Keys | `createControlKeys` for each control and each row. Explicit stop indices give the order; `keyboard.tabStop` of the root makes the list one stop |
| Paint | Two `createUiTheme` generations. `selectUiSkin` gives the name a skin has for a control's state |
| Profiles | `createUiRoot` with a virtual list. Each row draws its own text |
| The card | A second root, shown as a modal layer by `createUiLayerManager` |
| Text | `createTextField` of `@egret/engine/text` with the canvas raster provider; the name is typed in `createBrowserTextInput` |
| Semantics | `createUiSemantics`, `createUiListSemantics` for the rows, `semanticBoxOf` for the card, projected by `createBrowserSemantics` |

**One frame for a theme.** `root.setTheme` and `card.setTheme` stage the new generation. The page prepares the text of its drawn controls in the new ink, commits both roots, and only then paints its own controls and draws. Nothing is drawn while the change is being prepared, so no frame shows two themes. The page counts a frame in which the roots and its own paint disagree; the check requires that count to stay zero.

**Text is prepared one line at a time.** A text raster cache prepares at most four lines at once, and a list binds its rows together, so the page queues its text.

See the guides for [control state](../../knowledge-base/en/docs/ui-controls.md), [semantics](../../knowledge-base/en/docs/ui-semantics.md), [themes](../../knowledge-base/en/docs/ui-theme-generations.md), [layers](../../knowledge-base/en/docs/ui-layers.md) and [text input](../../knowledge-base/en/docs/text-input.md).

## Check

```text
node examples/ui-settings/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Eight scenarios write `report.json` with a screenshot of each: the tree the browser computes for the whole screen; the keyboard alone through every control, a typed name and a chosen profile; presses and the paints of states; a composition of an input method; a theme changed by a press and by a key, read from the colours on the screen; the modal card; requests of assistive technology; and a phone profile. They passed in headless Chromium with software WebGL2.

The composition is driven through Chromium's protocol. A real input method, a real on-screen keyboard, a screen reader or other assistive technology, a person, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. The screen has no alpha mask or blur group, and no recovery from a lost device is exercised here: those parts of an integrated UI scenario are checked in their own examples.
