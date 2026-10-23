# Multi-contact scene input

English | [简体中文](../../Cns/docs/multi-pointer-input.md)

M3.3 first implementation slice. The parent work package also owns focus, keyboard and native text editing; those capabilities are not supplied by this slice. Physical Android/iPhone acceptance remains OPEN.

## Public use

Use `createPointerInput` from `@egret/engine/input` for an application-supplied logical input stream, or `createBrowserPointerInput` from `@egret/engine/web/pointer` for the qualified browser Canvas profile. Both require a successfully started genuine Engine, one of its open Scopes and fixed positive logical width/height. Neither default Engine nor the old `@egret/engine/web/input` entry gains a new export. MI1 mouse/button semantics remain unchanged.

The browser factory obtains the authentic Engine surface through a private assembly binding. Do not install MI1 and the new bridge on the same surface. The runtime's optional `@egret/runtime/input` entry supplies the DOM-free state machine; ordinary game code uses the Engine entry, which retains Stage/Scope authority.

The two-region example (`examples/multi-pointer/index.html` in the repository) uses authored hit areas and simultaneous independent contacts. It is an input fixture, not a reusable joystick or a gesture recognizer.

## Sessions and routing

Each accepted down returns an opaque immutable session, with a bridge generation, monotonically increasing contact ID and the reported host pointer ID/type. Pointer IDs may be reused after termination; an older session cannot update a newer one. Mouse, touch and pen are admitted without filtering secondary fingers. Capacity defaults to 10 and accepts an explicit integer from 5 to 32. Overflow raises `POINTER_INPUT_CAPACITY` without replacing active contacts; the browser reports it and continues their input.

Every immutable contact snapshot carries its session, sequence, observation timestamp, logical coordinates, buttons and viewport revision. Pressure and contact size are optional reported values, not physical precision claims. Coordinates must be finite; timestamps must be nonnegative and nondecreasing for accepted observations; buttons are integers from 0 to 65535, pressure is 0–1 and size is nonnegative. Invalid samples do not partially mutate contacts. Unknown or stale sessions return false before reading an update.

Down picks current committed scene geometry with the existing explicit hit-area and clip rules. An empty pick still admits a session for the global observer. A hit target receives implicit logical capture; explicit capture/release is per contact. Released contacts pick their current point, while the initial owner's eligibility remains required. Capture is independent of native browser capture and keyboard focus. Reparenting uses the current genuine route; removal, hiding, disabling or suppressed ancestor children cancel ownership. Call `sync()` after a committed scene/UI mutation; delivery also reconciles ownership before and after callbacks.

The `onContact` observer runs synchronously before a target route and receives begin/move/end/cancel. It receives terminal cleanup even after a target is detached or disposed. Target events use existing capture/target/bubble dispatch, with contact data in `event.payload`; cancel also has `reason`. Cancelling or closing during the observer cannot produce a later begin/move on the target. Terminal state is removed before callbacks, so loss-of-capture after up cannot terminate twice. The raw input layer does not synthesize click, tap or gameplay activation.

Reentrant begin/move/end is refused; capture/release and cancellation are permitted during callbacks. An observer or routed-event failure closes the input, cancels remaining contacts and preserves the initiating failure plus cleanup errors. Other Engine subsystems are not closed. Consumers must handle cancel as release of held game actions. No mutable contact scratch objects are retained in public events.

## Mapping, interruption and ownership

A viewport revision change cancels all current sessions under the old revision before publishing the new mapping. A new down is required afterward. `setInteractive(false)` suspends admission and cancels active contacts; `setInteractive(true)` does not replay input. Applications connect device readiness to this switch: WebGL context loss suspends the browser bridge, and the application resumes only after the rendering host is ready. WebGPU and other hosts must wire their actual loss/readiness notifications explicitly.

The browser profile requires a connected same-realm Canvas, ordinary untransformed ancestors, normal zoom, zero Canvas border/padding and object-fit fill. Positive CSS bounds map once to logical coordinates; DPR affects rendering, not input. Resize, scroll, orientation and visual-viewport changes cancel contacts before using the new mapping. Unsupported transforms are refused. The adapter applies `touch-action: none` only to its Canvas before contact begins and restores the prior inline declaration on cleanup. It listens only to Pointer Events, avoiding a second compatibility-mouse activation path.

Window blur, hidden documents, pagehide, pointercancel and loss of an active native capture clear contacts. Scope disposal and Engine close retire the bridge and its listeners; Engine close starts this cleanup before awaiting host completion. Reconnection requires fresh downs. Native editing focus changes do not count as window-focus loss. Mini-game/native adapters and browser hover/wheel/keyboard/IME integration retain their separate M3.3 qualification rows.

## Evidence and remaining acceptance

Focused tests cover runtime schedules, genuine Engine routing/lifetimes and controlled browser ports. Controlled browser tests do not establish WebIDL/native capture or physical touch. Actual desktop browser collection must report its browser/version, source identities, injected versus physical events, cleanup and results separately. A successful build or CI is not device or performance acceptance.

The focused regression passes 176 tests: 41 runtime, 13 Engine, 24 controlled browser and 98 existing mouse/button cases. The raw desktop receipt (`examples/multi-pointer/browser-verification.json` in the repository) records Windows x64, Node 26.7.0, Playwright 1.62.1 and headless Edge 155.0.4283.62 without extra flags. Ten checks pass plus one partial-release observation; all 91 served files and 105 source/tool/configuration rows match their frozen bytes, with successful context/browser/server cleanup. Native capture, outside movement, two independent contacts, five injected contacts, cancellation, resize mapping, Engine close and authored region pixels have a separate desktop evidence scope. Injected events do not establish physical fingers or phone qualification.

Earlier collection attempts failed on partial-release assumptions; those failures remain separate from the corrected run. This Edge build removes the supplied contact IDs for nonempty CDP touchEnd; the collector records that version restriction. A runner attempt also stopped before browser launch because the native TypeScript package lacks the older AST API. The final runner uses the existing bounded literal reader; tooling failures are not product passes.

To reproduce after a complete pinned build, use an installed Playwright 1.62.1 module and local Microsoft Edge. The output parent must exist; output must be a new absolute directory outside the checkout:

~~~text
node tools/verify-multi-pointer.mjs --playwright <absolute-playwright-module-directory> --output <new-absolute-output-directory>
~~~

The collector freezes its served dependency closure before launch, saves raw results and a screenshot, and fails on assertion, cleanup or snapshot drift. A different browser version is a new observation. Full repository gates, CI and protected integration are separate from this receipt. Existing source/type checks admit only the exact reviewed optional package entries and private close-port revision; historical source inventories and compiler observations remain intact.

Android Chrome/iPhone Safari, real pen, mobile keyboard/IME, gesture arbitration, full controls and X-MTouch/1 remain OPEN. M1.2's existing full-dirty 10.3 ms result against the 8 ms target remains OPEN. This input implementation does not change those results or claim an input latency budget.

The implementation is original Apache-2.0 Egret code, authored with AI assistance and subject to independent review. Browser semantics were checked against [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/); no upstream implementation code is copied. No new runtime dependency is added.
