# Keyboard input and logical focus

English | [简体中文](../../Cns/docs/keyboard-focus-input.md)

## Scope and entries

M3.3 adds a Scope-owned keyboard channel for genuine Engine display targets. Optional `@egret/engine/input` exports `createKeyboardInput` alongside the unchanged pointer factory; `@egret/engine/web/keyboard` exports `createBrowserKeyboardInput`. Default Engine/Canvas entries gain no keyboard export. Core code uses existing Engine, Scope and synchronous display dispatch, with no DOM, Node, renderer or third-party dependency. The browser bridge is separate.

This foundation does not implement automatic managed-UI focus registration, modal containment, composite directional-navigation rules, native text editing/IME or semantic DOM projection. Those remain in M3.3/M3.4. Logical targets can already be operated through the public display event system. Existing MouseInput/PointerInput behavior and all fixed qualification examples are retained.

## Register and focus a control

Create the channel with `{engine,scope,onFocusChange?}`. Call `registerTarget({id,target,tabIndex?,disabled?})` for an attached genuine DisplayObject belonging to that Engine. Registration borrows the display target; disposing a registration does not dispose the display object. Targets do not need pointer hit areas or touchEnabled. ID is a nonempty string of at most 128 UTF16 units without NUL; target IDs are unique per channel. Defaults bound the channel to 4,096 targets, 64 held keys and a 4,096-node ancestry walk; configured maxima are 65,536/256/65,536.

The registration handle supports `update({target?,tabIndex?,disabled?})` and `dispose()`. A fresh display instance can replace the same logical ID while preserving logical focus; held keys cancel before replacement. A stale handle cannot change a new registration reusing the ID. Failed admission preserves the prior record. Hidden ancestors, disabled controls and detached/disposed targets are ineligible; `sync()` reconciles changed display state. Removing or invalidating the focused target clears focus rather than arbitrarily selecting another control.

Use `focus(id,{visible?,reason?})` for explicit focus and `focus(undefined)` to clear it. `moveFocus('next'|'previous',wrap?)` traverses positive tabIndex values in ascending order, then zero-index targets in registration order. Index -1 is programmatic-only. No implicit wrap: crossing an end clears focus and returns undefined; explicit wrap=true cycles. Keyboard traversal requests a visible focus indicator; pointer/programmatic calls default to hidden. Reusing the same ID and display instance only changes the snapshot's focusVisible flag and emits neither focusIn/out nor onFocusChange; callers changing that flag redraw from the returned channel snapshot.

`getSnapshot()` exposes state, focusedId, focusVisible, pressedKeys and targetCount as immutable scalar records/arrays. It exposes no display target or Engine authority. It remains readable after close. Public typed events are `keyDown`, `keyUp`, `cancel`, `focusIn` and `focusOut`; handlers read `event.payload`. Focus payloads carry logical target/related IDs, reason and visible state. Focus notifications are not cancelable.

## Keys, cancellation and ownership

`keyDown(sample)` and `keyUp(sample)` accept code, key, repeat and alt/ctrl/meta/shift modifiers. Code length is 1–64 and key length 1–128; booleans default false. Values are copied and frozen. The return value is the actual synchronous event.defaultPrevented result. This channel produces no synthesized click/activation or editable text. Repeated down events reuse an existing held code; repeats after cancellation do not create a new press. Unknown up events are ignored.

Focus transfer, target rebind/removal, suspension, owner closure, explicit cancellation and disposal drain held state before callbacks can redirect later keys. Native reasons include blur/hidden/pagehide. A new target cannot receive an old target's late up event. `setInteractive(false)` clears focus and held keys; true resumes new input. `dispose()` is idempotent and is also owned by the genuine Scope and Engine. Direct key handlers may transfer focus or close their owner. Recursive focus-notification mutation is rejected before changing another state; callback failure completes safe key cleanup and remains observable. Display routes use the existing UI-delivery guard and captured original admission operations.

## Browser policy

The browser factory binds only the authenticated Host's connected HTMLCanvasElement in its declared realm. The application retains native Canvas-focus policy: construction never steals focus. A missing tabindex becomes 0 for the bridge lifetime; close restores it only while the bridge still owns that value. An externally changed attribute is preserved. Only one native keyboard bridge owns a Canvas; a pointer bridge can coexist.

Native keys are admitted only while that Canvas is the actual document focus owner. Unrelated inputs/editors are ignored. Plain Tab/Shift+Tab traverses logical targets after typed dispatch unless the handler already prevented it; Tab default is prevented only while traversal stays inside, otherwise the browser can leave the Canvas. Other key default actions are prevented only by a genuine prevented typed event. Prevention still belongs to the original native event if its handler synchronously suspends/disposes input or focuses a native editor. Blur, hidden/pagehide and close cancel held keys without inventing an up event. Suspended bridges detach native listeners and resume without duplicates.

Composing/Process/Dead events and empty physical codes are excluded. They are not an IME implementation. The bridge neither intercepts unrelated editor text nor records it in diagnostics. Full native editing, phone keyboards and assistive technology need their own qualified integration.

## Example, checks and boundaries

Run `pnpm example:browser` and choose Two contacts. Pointer selection can transfer logical focus; after focusing the Canvas use Tab/Shift+Tab, arrows and Enter/Space. The application owns arrow/activation policy through typed events; gold/white borders show focus and held state. Contacts and key holds never survive viewport replacement, while committed activation counters and eligible logical focus can be restored by the application snapshot. The [responsive example contract](mobile-examples.md) retains the separate fixed-entry paths.

Focused public SDK/type/package checks cover admission, ordering, repeat/cancel, target rebind, stale handles, callback/owner reentry and optional-entry boundaries. The existing browser command adds real default-Edge key/focus scenarios, pointer coexistence, native editor handoff, Tab/default prevention and attribute/listener cleanup:

```text
node --test tests/keyboard-input.test.mjs tests/keyboard-package.test.mjs
node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>
```

Read actual recorded results separately from these acceptance requirements. Browser-driving automation tests default actions and SDK routing, not human IME, real Android/iPhone, screen readers, frame-time or whole M3/M4 acceptance. M1.2 formal performance remains OPEN. The new core/adapter/tests are independently authored first-party Apache-2.0 work using existing Egret primitives; no new third-party code or assets are added.

Recorded local results on 2026-10-30: 139 affected public behavior/type/compatibility checks passed, including 23 keyboard behavior cases and four strict/package cases. The current package/source/declaration gate passed over 804 files. Default-headless Edge 156.0.4314.50 / Playwright 1.62.1 completed 556 checks across the existing ten contexts with zero failures. Genuine native prevention was checked when handlers suspend/dispose input or transfer focus to an authored native editor; this is not human IME acceptance. Earlier focused failures, the initial browser-harness assertion error and source-identity successor work remain separate saved records.
