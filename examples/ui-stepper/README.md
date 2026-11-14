# Amounts in steps

English | [简体中文](README.zh-CN.md)

A hundred spirit stones shared among four halls. Each amount is a spin button: one keyboard stop that takes the keys of a range, with a button on either side for a pointer. A line under the halls says how many stones are left, and another says why an amount did not go up. To assistive technology the two lines are a status message and an alert.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/ui-stepper/index.html` there. The page draws with WebGPU where the browser offers it; add `?backend=webgl2` for WebGL2.

## What to try

- Press **+** and **−** beside a hall. Each press is a step of five. A button that has nothing to do is dimmed: **−** at nothing, **+** at a hundred.
- Click the canvas, then use the keyboard alone. Tab moves from amount to amount. Up and Down are a step, Page Up and Page Down four steps, Home takes the amount to nothing and End gives it everything that is left.
- Share everything out, then try to raise an amount. It stays, and the second line says that there are not enough stones. The next change that goes through takes that line away.
- **均分 / Even** gives every hall the same. **重置 / Reset** takes everything back. A button that has nothing to do is disabled, leaves the Tab order, and gives the focus to the first amount if it held it.

## How it works

| Part | From |
| --- | --- |
| An amount | A number in the application. No control owns it: one function changes it, keeps it between nothing and what is left, and returns whether it changed |
| Its keys | `createControlKeys` of kind `'range'` with `orientation: 'vertical'` and `page: 4`, bound to an object of the application that has `enabled`, `stepBy`, `toMin` and `toMax` |
| Its buttons | A `createActionControl` and a `createHoverControl` each. A press gives the amount the focus without a ring |
| A button out of the Tab order | `registration.update({ disabled })` of its keyboard stop, in a microtask, because the stops are not changed from inside a key |
| The text that changes | One text field for each line; a line that changes again while it is being prepared is prepared once more, with what it says last |
| Semantics | Each amount is a `spinbutton` with its `range`, and its two buttons are `button` nodes for assistive technology that activates and has no keys. What is left is a `status` and the refusal an `alert` |

**The two messages are in the tree from the start.** A reader says a message when the text of a node it already knows changes. The alert is published with an empty name until something is refused, and is emptied again by the next change that goes through, so the same refusal is said again the next time it happens.

**The far end of an amount is what is left.** End, and a page of steps that would pass it, stop there. Only a change that asked for more than there is says so.

See the guides for [semantics](../../knowledge-base/en/docs/ui-semantics.md#messages), [control state](../../knowledge-base/en/docs/ui-controls.md#value-in-a-range) and [the keyboard](../../knowledge-base/en/docs/keyboard-focus-input.md).

## Check

```text
node examples/ui-stepper/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright bundles runs headless with software rendering. Six scenarios write `report.json` with a screenshot of each: the tree the browser computes at the start, with the value and the ends of each spin button and the two messages as elements of the page; a pointer on the buttons, with the paints read from the screen, an even share, a refusal and a reset; the keyboard alone, with every key of an amount, the two buttons leaving the Tab order, and the page not scrolled; the two messages watched in the page, whose text changes inside elements that were already there, and is not changed by the same refusal twice; requests of assistive technology; and a phone profile. They passed in headless Chromium with software WebGL2.

Input was injected through the automation protocol. A person, a physical mouse, finger or keyboard, a screen reader or other assistive technology, a hardware GPU, WebGPU, Edge, Safari, Firefox and a real phone were not run. That the text of a message changes in the page was checked; that a reader says it was not heard. A button that is held does not repeat, and an amount cannot be typed.
