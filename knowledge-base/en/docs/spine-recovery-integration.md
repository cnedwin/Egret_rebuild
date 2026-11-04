# Spine application recovery

English | [中文](../../Cns/docs/spine-recovery-integration.md)

This bounded M2.4 increment connects the ordinary Spine RESET example to the existing shared Host recovery contract. It adds no SDK API, resource manager, device session or animation clock. The application borrows its Engine, Host and RESET slot. Existing Host generation tickets remain the native authority; resource-version labels are only metadata.

## Application flow

The example's recovery-flow.mjs coordinates a single current intent. prepare loads a genuine RESET candidate, captures its immutable frame and stages it on the existing Host. It awaits the genuine upload readiness and records its device generation. commit checks that the Host is ready and still has that generation before CPU publication. It records the actual ticket's committed state even if owned-predecessor cleanup throws or a diagnostic callback cancels/closes the flow. It checks current intent, flow lifetime and Host generation again after CPU cleanup. submit repeats that final check immediately before entering native submission. Ordinary replace calls commit and submit synchronously without an intervening await; the separated buttons remain explicit teaching operations with the same generation check.

cpuPublished, nativeSubmitted and nativeSettled describe different domains for that operation. nativeSubmitted changes from false to unknown just before entering submit, and to true only when the Host returns a submission. A synchronous native throw may follow issued drawing: unknown is retained, CPU publication is never undone and gameplay events are never replayed. Native completion can independently succeed or fail. Cancellation after submission rejects the caller's wait but the original completion remains observed and Host-owned.

replay first cancels the current uncommitted RESET/upload, then awaits this same Host's whenReady barrier. It captures the actual current scene, stages it in the fresh generation and explicitly submits it. It never calls RESET, reconstructs a player, reacquires CPU groups or advances time. If CPU commit already succeeded, the newly active player remains authoritative even when the first native submission failed. Owned WebGPU uses the existing automatic recovery option; WebGL2 uses its existing context restoration. The application invokes recover explicitly after native recovery is available. A failed Host recovery follows its existing manual retry rules; this example adds no automatic retry loop.

A newer prepare/replay, cancel or close revokes older application continuations. A late readiness/completion cannot publish over a newer intent. Cancel/close settle caller waits promptly; they do not declare the original native work settled. Flow close releases only its own unsubmitted ticket demands and borrows the Engine/Host/slot; application close then performs the existing owner, loader, Engine and Host cleanup.

## Clock and ownership

The existing Engine GameClock subscription advances only the current active player plus its shared sibling on explicit caller ticks. No RAF, timer or recovery clock is installed. During the brief capture/stage/commit window the ordinary Step action refuses; loading may continue while the caller advances the game. Explicit advance remains available for the deliberate stale-snapshot demonstration. Recovery tests hold this application clock fixed while comparing snapshots, then accept a later explicit tick and verify event continuation.

CPU snapshots retain tracks, selected skins, rate, elapsed time, tick identity and consumed event observations. Recovery preserves the existing instances and groups; cancelling a replacement releases only its candidate. Closing an owned predecessor or the flow does not release the borrowed initial player or its shared sibling. This is device-resource reconstruction, not state-preserving cross-version asset replacement, seek, physics replay or complete Spine qualification.

## Verification boundaries

The new application UNIT cases use owned controlled ports, covering generation changes, CPU cleanup reentry, native issue-then-throw uncertainty, failed completion, cancellation, supersession and explicit retry. They prove application ordering only. Existing genuine RESET behavior and unsuppressed emitted type refusals are run separately.

The opt-in collector examples/spine-reset/verify-recovery.mjs uses the same original two-version geometric assets, genuine public SDK, PNG transport and shared Hosts. It installs only the already reviewed owned-requestDevice observer before Host startup; it forwards original calls/promises unchanged, observes the authentic lost promise and restores the complete descriptor after Host close/drain. WebGL2 invokes WEBGL_lose_context on its own canvas and checks trusted loss/restoration events. Four loss cycles per backend cover borrowed nonzero active state, a ready uncommitted candidate, owned nonzero active state, and CPU-published content before native submit. It also checks explicit continuation, cancellation, shared consumers and ready-held close. Five literal pixel points per image use a one-channel tolerance; snapshots/counters and pixel evidence remain separate.

Run with Node 26.7.0, Playwright 1.62.1 and pngjs 7.0.0, default headed msedge and no extra launch flags:

~~~text
node examples/spine-reset/verify-recovery.mjs <absolute-playwright-index.mjs> <fresh-absolute-external-output>
~~~

Freeze the complete input closure before launch. The collector retains actual requested and Node-side input identities, raw readbacks/screenshots, all failures and native cleanup observations. Playwright/pngjs are checked external tool versions, not byte-complete tool-distribution fingerprints. Results are recorded separately in recovery-verification-summary.json. Source, controlled behavior, actual native execution, independent review, full gates and remote delivery remain distinct. These controlled native routes do not establish spontaneous driver, phone or native-SDK recovery. M1.2's 10.3 ms / 8 ms performance result remains OPEN. No new package dependency or license is introduced; first-party integration is independently authored with AI assistance under Apache-2.0, with Core 4.3.13's existing separate license retained.

### Recorded result and lifecycle repair

On 2026-11-04, default headed Edge 156.0.4314.58 passed four actual loss/recovery cycles on each backend, nine image observations per backend, active/owned snapshots and event continuation, stale generation refusal, cancellation and ready-held close. The owned WebGPU observer recorded exactly five real acquisitions, zero pending native observations after close and complete descriptor restoration. Application UNIT cases passed 14/14; the combined RESET/type/application run passed 35/35 and related Host/session/staging/ledger/application checks passed 111/111. These overlapping totals are separate runs, not additive unique tests.

The first actual run is retained as failed evidence. A ready-held WebGPU upload exposed a pre-existing Host ordering defect: confirmed loss marked the native owner invalid, then synchronously retired stages before invalidating the CPU retention ledger. Context-invalidated settlement therefore reached a still-active ledger, threw and became terminal unknown ownership. The narrow repair moves existing ledger/cache invalidation before stage revocation, preserving the prior unknown-owner branch and never converting invalidation into native destruction. The same four-loss scenario then passed. The initial WebGL2 fixture also incorrectly reacquired its loss extension while lost; it now retains the original genuine extension. No product WebGL2 change was made.

The collector declares a modified loading order: it intercepts only its exact example HTML response and removes the main.mjs module script, installs the native observer, then imports the unchanged application module. This is not an unmodified original-HTML navigation. The separately rerun original RESET collector uses the normal example loading path and passed both backends; its historical summary remains unchanged.

The final application also binds each outer readiness continuation to its original intent before commit, submit or phase updates. Two deterministic original-Promise microtask controls previously observed a cancelled outer call returning FLOW_STAGE_FIRST/FLOW_COMMIT_FIRST; they now return FLOW_CANCELLED and leave the newer intent untouched until its own explicit commit. Erroneous cross-intent publication was not reproduced. After this clarification, the same native four-loss matrix and the original RESET browser regression were re-executed successfully against final application sources.

The final collector bounds Node-side page-evaluation waits to 15 seconds, final snapshot probes to 2 seconds and realm/browser/server closure to 5 seconds. A deadline records incomplete/unknown work and does not settle the original Promise, claim Host cleanup or claim descriptor restoration. Late rejection remains observed; independent realm closure is recorded separately. Input-closure and final source-integrity failures are retained in the result instead of preventing the earlier failure record from being saved. The Node author's actually executed contracts/resources closure is pinned independently of browser navigation. One test-owned page Promise that never resolves confirmed the collector deadline and realm closure; it creates no GPU and is not a native-loss simulation. The same four-loss backend matrix passed once more with this final collector.

## Integrated delivery evidence

The prepared subtree, CPU RESET slot and application recovery layers now form one delivery candidate over the merged UI baseline. Their product implementation is the exact union of the independently reviewed chain and that baseline. Complete M2.4 remains OPEN.

The original recovery collector's 245 actual inputs and the adjacent RESET collector's 243 actual inputs match this candidate byte for byte, including regenerated original fixture assets. These are reused observations, not new loss runs. The original RESET receipt has 242 inputs and remains attached to its earlier application revision. Of the prepared-subtree receipt's 144 inputs, only the Host emission and example server changed across the chain; its unchanged fixed WebGPU/WebGL2 schedule was rerun once on the integrated candidate, with all 144 executed inputs matching the new preflight snapshot. Public summaries keep original receipts and add this integration record separately.

Finite source/declaration bindings and inert policy fixtures were updated together; historical pins and compiler diagnostic tuples stay intact. Independent whole-package review and protected integrated CI/merge remain separate from these local results.
