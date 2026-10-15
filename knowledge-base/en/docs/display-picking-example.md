# Display picking application and bounded evidence

English | [简体中文](../../Cns/docs/显示拾取示例.md)

Engineering preview **0.30.0** makes the existing HT1 query usable in a small application: authored rectangles, CSS mouse coordinates, real typed dispatch and explicit Canvas rendering. It adds example code, not an SDK input router or new package API. Packages remain private `0.0.0`, protocol `1.0`. See the [running guide](../../../examples/hit-test/README.md) and existing [HT1 contract](display-hit-test-ht1.md).

## Authored behavior

The 320×200 logical scene contains nine nodes including Stage and five eligible actors. The canvas is 640×400 in CSS with no border/padding; coordinates subtract its CSS origin and scale to logical units without clamping, rounding or DPR. Only finite, primary left-button mouse input is admitted. The genuine `Stage.hitTest` uses `maxNodes: 9`.

| Literal logical point | Expected example result |
| --- | --- |
| (56, 48) | Upper; hiding upper reveals lower. |
| (168, 32) | Gated green child; hiding its ancestor or disabling ancestor touchChildren suppresses input. Disabling touchChildren keeps green rendering. |
| (16, 128) / (48, 136) | Left / right; the shared edge belongs to right. |
| (80, 136) / (20, 160) | Outside right/bottom half-open edges; miss. |

Five actor listeners, Stage capture, root bubble and Stage bubble provide eight scoped subscriptions. A successful pick dispatches a genuine `Event` carrying a frozen `{globalX, globalY, button, pointerType}` payload. Four handler records identify Stage capture, selected actor atTarget, root bubble and Stage bubble. Listeners record the route. After dispatch returns, scene code clears/repaints one feedback rectangle and renders once; feedback is not painted by a listener. Misses store the payload, clear the route and perform no dispatch or render.

## Ownership and startup

The application owns six target/type/callback/capture pairs: pointerdown, three toggle clicks, Close and pagehide. One cached close Promise gates callbacks and attempts every removal, then waits for acquisition, disposes Scope/Engine and zeros/removes its borrowed canvas. Acquisition never waits for Close. A late Engine is retained for cleanup without publishing a scene; an initial-render close is rechecked before publishing Ready. An explicit failure flag retains a first thrown `undefined` while later cleanup continues. Eight typed unsubscribe closures are attempted after Scope signal cancellation. Main exports only scalar observations and the shared close operation.

## Evidence at this cutoff

| Scope | Recorded status |
| --- | --- |
| Adopted public-entry headless checks | **PASS 12/12**, actual execution through existing package entries; no private alias loader in this run. |
| Private source/Node EventTarget envelope | **PASS 12/12**, five candidate inputs unchanged before/after and 60 emitted SDK inputs recorded; independent bounded core review has 0 open findings. This overlaps the public-entry checks. |
| Native browser input, DOM pair retirement, pixels and five projection controls | **PASS_DESKTOP_HT1_CANVAS_SUBSET**: Edge 154.0.4258.62, ten baseline rows and five assigned controls. Baseline owned-pair cleanup and deliberate omission sensitivity are distinct observations. |
| Pure verifier admission | **PASS 32/32**; synthetic admission/classifier checks, separate from native execution. |
| Complete local verification | **PASS**: build, type fixtures and boundaries; core **2377/2377**, structural publication **63/63**; **140** pairs, **6** registry views, **154** critical source files; KB **159** records, **243** Markdown files, **1997** links, **955** references, **0** issues; headless closed with **0** pending timers. Scope counts are not summed. |
| Final independent bilingual meaning, actual Git push hook and delivery at the original pre-delivery checkpoint | **PENDING**. |

The six isolated contexts saved 30 artifacts, including **424 target + 424 reference raw RGBA bytes**. Baseline Close removed all six owned native pairs with zero outstanding; the omit-retirement control deliberately retained six pairs and was detected. The collector closed every context and restored its observer. All contexts recorded zero errors and retained exactly two Canvas readback advisories each. The first native result remains **INCOMPLETE**; its records were not rewritten. V3 classifies only the exact known readback hint as advisory, without changing CanvasHost attributes, SDK, case actions or pixel oracle. Other warnings/errors remain fatal.

The [shared verification record](../../evidence/display-picking-example-verification.json) binds sources and results. Retain setup/missing-module failures, the correction from an invented dispatch method to existing `dispatchEvent`, and the real Ready-revival RED caused by pagehide during initial rendering. The phase recheck closed that observed failure. Counts from private/public/headless/whole scopes are not added together.

This increment is an independently authored first-party Egret application under Apache-2.0; it adds no external asset, runtime dependency or SDK API. It does not accept general routing, gestures, accessibility/layout, full UI/fonts/Spine/3D input, phones, performance leadership or complete migration. Earlier HT1 and rendering/font records retain their original source, legal and failure cutoffs.
