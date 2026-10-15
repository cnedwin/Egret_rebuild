# Primary mouse input

English | [简体中文](../../Cns/docs/主鼠标输入契约.md)

MI1 connects the existing display-tree hit test, typed event dispatch and explicit rendering into a Scope-owned browser input adapter. It is a small foundation for interactive 2D UI. Complete UI widgets, touch and pen input, Spine, native platforms and target-device performance remain separate engineering requirements. The implementation is independently authored first-party Egret code, Apache-2.0, and adds no third-party dependency.

The [verification record](../../evidence/primary-mouse-input-verification.json) records source identities, actual results, failures, repairs and acceptance boundaries. This contract specifies behavior; it does not establish that a gate has passed.

<!-- MI1-CURRENT-EVIDENCE-BEGIN -->
## Current bounded evidence

At the documentation cutoff **2026-10-11 22:52:43 UTC**, the final Engine build and genuine public interface check passed. Public MI1 behavior/lifecycle passed **98/98**. TypeScript **7.0.2** passed one public positive and matched **26 + 15 + 5** exact unsuppressed negative diagnostics; the public type gate exited **0**. Focused MI1 policy passed **21/21** after correcting one expected diagnostic to retain the existing guard order. Public cancellation **8/8** and earlier retained CPU checks keep their separately recorded scopes. These overlapping checks are not added.

Default headless Edge **154.0.4258.62** with Playwright **1.62.1** passed the fixed desktop Canvas mouse subset: **1** genuine native baseline and **6** assigned controls cover literal events, logical points, RGBA witnesses and observed physical listener cleanup. The ordinary HTTP example passed, and collector policy/grammar units passed **13/13**. All **7** retained desktop gates—Canvas, WebGPU, B1, textured rendering, sequence animation, Canvas text and picking—passed their existing bounded profiles. This establishes neither phones, arbitrary UI/3D, OS reclamation nor a performance lead.

**At that historical cutoff, the complete 259-case boundary rerun, final publication/bilingual checks, mandatory pre-push gate and 0.33.0 remote delivery were PENDING.** The earlier timeout and full **258/259** result retain their original artifacts; the latter exposed one expected-message mismatch. Focused **21/21** is its finite successor, not a complete rerun. Other earlier failures retain their recorded identities and cutoffs in the verification record.
<!-- MI1-CURRENT-EVIDENCE-END -->

## Optional entry and use

The original 0.33.0 MI1 surface adds one function, `createMouseInput`, and six types to `@egret/engine/web/input`: `MouseInputOptions`, `MouseInput`, `MouseInputState`, `MouseInputEvents`, `MouseInputPayload` and `MouseInputCancelReason`. The default Engine, Canvas and WebGPU entries do not export this API. Importing the optional entry does not acquire browser resources or schedule work.

Use an already started genuine Engine and its genuine open Scope. The adapter uses the original Host surface and Stage captured during Engine assembly. Its fixed logical dimensions must be finite and positive. `maxNodes` defaults to `4096` and accepts integers from `1` through `65536`; the existing hit-test budget applies to the complete tree.

Attach interactive objects to the genuine Engine Stage and assign an explicit authored local `hitArea`. HT1 does not infer a hit region from Graphics bounds or rendered pixels; being visible does not imply being pickable.

```ts
import { createMouseInput } from '@egret/engine/web/input';

// engine and button are existing genuine Engine and display objects.
// button is attached to engine.stage; HT1 requires an authored local hit area.
button.hitArea = { x: 0, y: 0, width: 40, height: 24 };
const scope = engine.createScope();
const input = createMouseInput({ engine, scope, width: 160, height: 100 });
button.on(input.events.activate, event => {
  selectAt(event.payload.globalX, event.payload.globalY);
  engine.renderFrame({ width: 160, height: 100 });
}, { signal: scope.signal });
```

Game time and repaint remain application decisions. Input dispatch does not start a clock, render automatically or change the browser's native default behavior.

## Events and release ordering

The frozen handle exposes `state`, `events` and synchronous `dispose()`. States are `idle`, `pressed` and `closed`. Each adapter has fresh descriptors for `begin`, `end`, `activate` and `cancel`; all bubble through the current genuine display route. `begin` and `end` are cancelable. Their genuine dispatch results determine activation. Preventing either default vetoes activation; stopping propagation alone does not.

Frozen payloads contain `pointerId`, `globalX`, `globalY`, `pointerType: 'mouse'` and `button: 0`. Cancellation adds the reason `pointercancel`, `blur` or `pagehide`. One fresh genuine Event is created for each dispatch.

| Input | Observable behavior |
| --- | --- |
| Primary left-button mouse down while idle | One hit query. A hit stores the original target and down position, enters `pressed`, then dispatches `begin`. A miss stays idle. |
| Matching mouse up | Capture its logical position once and query Q1. Clear the press and enter `idle` before dispatching `end` to the original still-attached target, including when release misses or selects a sibling. |
| Eligible successful end | Query Q2 at the same captured position after handlers. Activate only when Q1 and Q2 both select the original target, both defaults permit it, and ownership/attachment remain valid. |
| Matching pointer cancel or blur | Clear the press before at most one cancellation to the available original target, using the cached down position. Blur leaves the adapter idle and open. |
| Pagehide | Cancel if applicable, then retire even when a handler or cleanup fails. |
| Adapter, Scope or Engine closure | Gate input synchronously, discard the press and perform cleanup without a gameplay cancellation. |

Q2 makes end-handler changes to visibility, transforms, clipping, child interaction and ordering effective before activation. Release never retargets `end`. Ignored pointers and states do not read coordinates or inspect layout. Native callback reentry closes the adapter; ordinary nested typed dispatch retains existing event semantics.

## Admitted browser layout

The surface is a genuine Canvas in the current document/window. Its ordinary Element ancestor chain must reach that document, within 64 Elements, without shadow or foreign-document boundaries. Canvas and ancestors use no CSS transform, perspective, translate, rotate or scale, and zoom is `normal` or `1`. Canvas padding and border widths are zero; `object-fit` is `fill`.

Relevant down and matching up read a fresh native bounding rectangle and map client coordinates to the fixed logical dimensions. Conversion does not multiply by device pixel ratio, round or clamp coordinates. CSS scaling through the rectangle is supported within this profile. This is a finite desktop mouse profile, not arbitrary transformed layout, mobile input, pointer capture, movement or gesture support.

## Ownership and errors

One acquiring or live adapter may own a captured surface. It registers Canvas `pointerdown` without capture; Window `pointerup` and `pointercancel` with capture; Window `blur` and `pagehide` without capture; and one stable original-Scope abort listener with frozen `once: true` options.

Retirement publishes closed state and releases only its own input token before callback-capable cleanup. It attempts every acquired or attempted native pair in reverse order, then the abort pair. An in-flight synchronous add is gated immediately and removed after its add operation settles. Failed removal remains a failure; logical closure does not prove physical cleanup. The adapter does not release the Host reservation, remove a borrowed Canvas or dispose other owners.

Explicit cleanup failure throws `MOUSE_INPUT_CLEANUP_FAILED` once, preserving the first cause and later cleanup errors. Setup failures throw `MOUSE_INPUT_SETUP_FAILED`. Native read, pick, handler or reentry failures retire and report `MOUSE_INPUT_CALLBACK_FAILED` through the protected diagnostic port. Falsey causes, including `undefined`, remain distinguishable from no failure. The same reported cause/wrapper is not reported again during unwinding; genuinely distinct later source failures remain observable. A normal handler closure quietly suppresses further input; a handler that closes and then throws retains its source error.

The cancellation dependency retires once subscriptions through its own state before calling them. Replacing an original signal's public removal method cannot bypass Scope-owned cleanup. This guarantee does not extend to arbitrary private-field mutation or compromised built-ins/browser realms.

## Verification and remaining work

Behavior tests use genuine public SDK objects with controlled browser ports; these establish state, ordering and fault handling, not real DOM behavior. The real Canvas collector uses an installed default headless Edge profile and actual mouse input, literal logical positions, rendered RGBA witnesses and exact native/abort registration and removal observations. Its declared device scale factor of `2` distinguishes incorrect DPR conversion; it is not a phone or performance benchmark.

Six separate source controls omit begin, retarget end, omit Q2, inspect only Canvas CSS, multiply coordinates by DPR, or omit one physical removal. Each must reach its genuine baseline before failing its assigned witness. Build/import/setup failure is not a successful control. Shared Engine and dispatcher changes also require the seven retained native gates, strict types, package boundaries, bilingual/provenance review and mandatory pre-push checks. Results and delivery are recorded separately in the verification record.
