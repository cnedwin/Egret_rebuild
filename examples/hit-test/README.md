# Display picking example

English | [简体中文](README.zh-CN.md)

Engineering preview **0.30.0** composes the existing Stage query, typed events and CanvasHost in a small authored-rectangle application.

## Run from the repository root

Use the repository pins: Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2.

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the printed loopback host and port, and change its path to `/examples/hit-test/index.html`. The existing server prints the older Canvas-example path. Stop it with Ctrl+C. The page imports the built SDK through its import map; packages remain private `0.0.0`, protocol `1.0`.

Click with the primary mouse button. Upper visibility demonstrates overlapping targets; green visibility and green input separately demonstrate rendering and input suppression. Adjacent lower rectangles share a half-open edge. A small feedback square shows the selected actor color. Misses preserve the admitted payload and leave the feedback frame unchanged.

## Composition and cleanup

[scene.mjs](scene.mjs) owns nine nodes including Stage, five authored actors and eight scoped typed listeners. Target/ancestor listeners record scalar routes. After `dispatchEvent` returns, scene code clears and repaints one feedback rectangle, then renders once. The handlers themselves do not paint.

[application.mjs](application.mjs) converts finite CSS coordinates to 320×200 logical coordinates from the fixed 640×400 CSS canvas, accepting primary left-button mouse input. It owns six concrete callback pairs and one shared Close promise. Close gates callbacks, attempts every listener removal, awaits acquisition, retires Scope/Engine and zeros/removes the borrowed canvas. A late Engine and a close during initial rendering cannot publish Ready.

[main.mjs](main.mjs) exports only scalar `readSnapshot()` observations and shared `close()`; evaluating the module does not wait for user closure. These are example ports, not new SDK exports.

## Recorded checks

Historical verification record for engineering preview 0.30.0:

The adopted public-entry headless checks passed **12/12**. The fresh desktop successor passed **PASS_DESKTOP_HT1_CANVAS_SUBSET** in default Edge **154.0.4258.62**: ten baseline rows and five assigned controls cover real mouse input, typed routes, Canvas pixels and an independent six-pair native listener ledger. Pure admission checks passed **32/32** separately; counts from these scopes are not summed. Complete local verification passed: build, type fixtures and package boundaries; core **2377/2377** and structural publication **63/63**. Localization checked **140** pairs, **6** registry views and **154** critical source files. Knowledge-base validation checked **159** records, **243** Markdown files, **1997** links and **955** references with **0** issues; the headless lifecycle closed with **0** pending timers. These are separate scopes, not a combined test count. Final independent bilingual meaning review, the mandatory Git push hook and delivery remain **PENDING**.

```text
node --test tests/hit-test-scene.test.mjs
```

The six isolated contexts saved 30 artifacts, including **424 target + 424 reference raw RGBA bytes**. Baseline Close removed all six owned native pairs with zero outstanding; the omit-retirement control deliberately retained six pairs and was detected. The collector closed every context and restored its observer. All contexts recorded zero errors and retained exactly two Canvas readback advisories each. The first native result remains **INCOMPLETE**; its records were not rewritten. V3 classifies only the exact known readback hint as advisory, without changing CanvasHost attributes, SDK, case actions or pixel oracle. Other warnings/errors remain fatal.

The 12 checks cover literal picking/routes, constant feedback commands, half-open boundaries, CSS admission, real Node EventTarget pair removal, shared close, late Engine ownership, a thrown `undefined`, failed CanvasHost startup and initial-render close reentry. Node EventTarget evidence does not establish native DOM retirement or native pixels. Final independent bilingual meaning review, the actual Git push hook and delivery remain **PENDING** at this preparation cutoff.

Read the [knowledge-base record](../../knowledge-base/en/docs/display-picking-example.md) for scope and retained failures. The first-party example uses Apache-2.0 and adds no dependency or external asset.
