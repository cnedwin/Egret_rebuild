# Agent collaboration agreement

English | [简体中文](AGENTS.zh-CN.md)

<!-- HYGIENE-0.45.1-POLICY-BEGIN -->
## Repository path and raw-byte hygiene

Use the shared `tools/lib/file-identity.mjs` helper for verification and delivery tools. Keep complete owner-relative logical paths in canonical POSIX spelling with authored case, and use explicit platform semantics for absolute physical path comparison and containment. A basename match, universal lowercasing or a lexical path match cannot authorize another file identity.

Write newly authored first-party text through `tools/write-repository-text.mjs --path <owner-relative-file>` or `knowledge-base/tools/Write-CanonicalText.ps1 -RelativePath <owner-relative-file> -Text <text>`. Author UTF-8 without BOM, LF and one final newline; preserve interior blank lines and Markdown hard-break spaces. Do not use `Environment.NewLine` to serialize repository text. Keep raw fingerprints byte-exact: never normalize EOL, BOM, Unicode or whitespace during hashing, and never run an authoring formatter over upstream/legal originals, raw receipts, sealed source snapshots or historical evidence. Refresh only reviewed current identities for files actually changed.

Enable both repository-local hooks with `git config --local core.hooksPath .githooks` and preserve their executable Git modes. The pre-commit hook checks working/untracked text and actual staged bytes; the pre-push hook runs the complete `node tools/prepush.mjs --committed` on a clean committed snapshot. Also run the normal `node tools/prepush.mjs` while preparing a change. Fix failures and complete independent source/result and bilingual review before delivery; bypassing hooks or weakening byte checks is not a substitute.

Use `-CheckOnly` when validating the knowledge base. Report source, saved execution, full local gates, actual push/PR/Main and remote CI separately, retaining earlier failures and pending cutoffs. Read the [repository policy](knowledge-base/en/docs/repository-identity-and-line-endings.md) and [bounded evidence](knowledge-base/en/docs/repository-hygiene-evidence.md).
When changing existing first-party text, serialize the complete new file through the canonical writer; appending canonical text to a legacy CRLF prefix still violates the authored-file policy. An unchanged legacy pin is exempt only while all original bytes remain identical; preserved originals, sealed evidence and legal/upstream files remain untouched.

<!-- HYGIENE-0.45.1-POLICY-END -->

This agreement applies across the repository, including shared knowledge-base experiments, tools, evidence, comments, Issues and PRs. Read [README](README.md), [CONTRIBUTING](CONTRIBUTING.md), [source records](source-origin.json) and the relevant specifications. Work within the user's existing authorization.

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Spine import planning boundaries

- SP1-A uses the optional built `@egret/project/spine` entry only: two runtime values and eleven type-only names. Default project/engine entries remain separate; the first-party planner adds no runtime dependency, host access or SDK import.
- Follow the [import contract](knowledge-base/en/docs/spine-import-plan-contract.md). Preserve fixed limits, strict metadata descriptors, scanner-before-visitor precedence, exact original source spans and one-fatal refusal. Planning success does not verify animation, rendering, declared hashes or entitlement.
- Original programmatic fixtures and public behavior tests consume the emitted entry. Freeze actual unsuppressed compiler tuples; synthetic controls require a fresh complete baseline before each assigned mutant. Source, execution, third-party artifact inspection and final delivery retain separate status.
- Full R020/V020 requires a separately tested clock/asset/mesh adapter and the versioned feature matrix. Record official runtime attribution and applicable license conditions before distribution. Keep public documentation bilingual and exclude private prompts or personal absolute paths.
<!-- SP1A-DOC-0.34.0-END -->

## Architecture and implementation

- Implement Egret's core independently from its specifications. Retain familiar Egret domain names and follow the documented module, API and code conventions. Record research references, third-party dependencies, Egret adapters and first-party implementation separately, with sources and versions.
- Preserve the package DAG: engine depends on runtime/contracts; runtime depends only on contracts; contracts has no package dependencies. Preserve package exports, strict configuration and the DOM/Node-free core. Public examples and behavioral tests consume built artifacts through the `@egret/engine` public entry.
- Keep `@egret/engine/web` Canvas-only; it requests no WebGPU or robust-predicates modules. WebGPU is an explicit `@egret/engine/webgpu` entry. The DOM-free rendering composite references contracts only; engine's exact external `robust-predicates` 3.0.3 import is restricted to rendering through the package root/public `orient2d`, under Unlicense, and is checked separately from the internal package DAG and project references.
- Private geometry unit tests may import built `engine/dist/rendering` helpers directly. This does not permit private imports in public behavior tests.
- For the adopted T1 fixtures, public controls also use built `@egret/engine/text`; `@egret/runtime/text` is limited to T02 entry identity/type/source checks. Private runtime imports in `tests/text-raster-private.test.mjs` are limited to `packages/runtime/dist/text/budget.js`, `packages/runtime/dist/text/request.js`, `packages/runtime/dist/text/plan.js` and `packages/runtime/dist/EgretError.js`, and must be reported as units.
- `tests/text-raster-allocation.test.mjs` and `tests/text-raster-materialization.test.mjs` are controlled construction/counter-fault units with genuine setup and restored intercepted state. `tests/text-raster-residency-audit.test.mjs` may append only its read-only `__textRetainedAudit` to the actual compiled `packages/runtime/dist/text/TextRasterCache.js` in memory, deregister its one-module load hook and preserve on-disk bytes. These fixtures add no product export, grant no arbitrary private import and do not replace public behavior controls; logical counters/retained-reference observations establish neither physical memory/GC nor fonts/renderer acceptance.
- The experimental `tools/verify-webgpu-b1.mjs` ordinary fixture imports built `@egret/engine`, `@egret/engine/scene3d` and `@egret/engine/webgpu/scene3d` through its exact generated import maps. Its only direct private product import is `packages/engine/dist/web/webgpuMeshPass.js` for the source-bound fixed native WGSL compilation/N4 diagnostic. Serving is limited to the verifier's explicit module allowlist and those public entries' bounded literal-import closure and fixed aliases; N1–N5 each alter exactly one recorded emitted file in repository-external disposable copies. S1/S2/SN1 are a separate genuine Engine/Stage/Scope/Bitmap composition stage; SN1 omits only the named parent clip. The original oracle and seven-baseline/five-control/eleven-render/8214-comparison schedule remain unchanged. This exception permits no private product imports in ordinary examples or public behavior tests and grants no new product export or arbitrary diagnostic hook.
- When public behavior changes, update its specifications, source records and necessary regressions. Record actual environments, unverified items, counterexamples and repairs. Third-party research and historical tests do not replace independent product acceptance.

<!-- BRS-0.56.0-POLICY-BEGIN -->
## Bitmap resource replacement boundaries

- The built `@egret/engine` root adds `Engine.createBitmapResourceSlot(scope, bitmap)` and exactly two erased types, `BitmapResourceSlot` and `BitmapResourceSlotState`. Preserve the package DAG, DOM/Node-free core, private assembly authority and existing Host protocol. The slot borrows the initial live binding, owns only fresh acquired replacement leases and admits only the latest accepted intent. Follow the [selected specification](knowledge-base/en/docs/bitmap-resource-slot-spec.md), [evidence record](knowledge-base/en/docs/bitmap-resource-slot-evidence.md) and [public example](examples/bitmap-resource-slot/README.md).
- `tests/bitmap-resource-slot-authority-unit.test.mjs`, `tests/bitmap-binding-ticket-authority-unit.test.mjs` and `tests/bitmap-resource-slot-authority-supplement.test.mjs` are bounded UNIT fixtures. They may construct a custom context from built public `@egret/runtime` contracts and genuine public runtime objects, and observe operations registered by that construction. Foreign-target controls use a genuine public Engine. This permission adds no private SDK imports, load hooks, prototype interception or product exports; ordinary public behavior fixtures and examples continue to use the public SDK.
- Run the dedicated strict and source-boundary obligations in `tools/bitmap-resource-slot-types.mjs` and `tools/bitmap-resource-slot-boundary.mjs` with the existing full checks. Freeze actual unsuppressed diagnostic tuples; each assigned type/policy mutation requires a fresh complete baseline and a separate observed refusal. Keep the exact selected public types, private capture/commit/cleanup bridge, source/emission identities and declared dependency boundaries.
- Native composition requires a separately reviewed complete input-closure snapshot before `tools/verify-bitmap-resource-slot.mjs` launches default Edge with pinned Playwright 1.62.1 and no extra flags. Preserve original import-map counterexamples, complete ordinary and separate wrong-color contexts, unaltered RGBA artifacts and cleanup records. Six literal pixel points define the comparison domain; retained frames add replay evidence. Source, UNIT, behavior, strict/policy, browser, full gates and PR/Main delivery retain separate status. Full UI, Spine R020/V020 and migration R008/V006 remain OPEN.
<!-- BRS-0.56.0-POLICY-END -->

<!-- LL-0.55.0-POLICY-BEGIN -->
## Explicit local-layout boundaries

The optional built `@egret/engine/layout` entry provides only the pure `planLinearLayout` function and four erased interfaces. Keep the core DOM/Node-free and preserve default entries and the SDK Host protocol. Callers supply dimensions, filter membership explicitly and apply returned coordinates through existing display APIs; the planner does not write scenes or guarantee automatic EUI layout. Follow the [layout specification](knowledge-base/en/docs/local-linear-layout-spec.md) and separate source, focused/strict, full-code and actual browser acceptance in the [evidence record](knowledge-base/en/docs/local-linear-layout-evidence.md).
<!-- LL-0.55.0-POLICY-END -->

<!-- MI1-AGENT-POLICY-BEGIN -->
## Primary mouse input boundaries

- MI1 public use consumes built `@egret/engine` and optional `@egret/engine/web/input` only. The optional entry exports `createMouseInput`, `createBitmapButton` and nine erased contract types; default Engine/Canvas/WebGPU entries gain no input or Button API. Button consumers follow the [selected contract](knowledge-base/en/docs/bitmap-button-contract.md), borrowed-resource ownership and complete-route final picking. Runtime display assembly ports are not exposed through Engine, and the core remains DOM/Node-free. See the [contract](knowledge-base/en/docs/primary-mouse-input-contract.md) and [verification record](knowledge-base/evidence/primary-mouse-input-verification.json).
- `tests/mouse-input.test.mjs` and `tests/mouse-input-lifecycle.test.mjs` use genuine public SDK objects with controlled browser ports, without private product imports or copied picking/event algorithms. They do not establish real DOM/native acceptance; actual browser and controlled-unit results are recorded separately.
- `#egret-mouse-input` uses its exact package mapping from named browser input modules/declarations to core outputs. Shared verifiers allow only explicit fixed mappings and bounded closures, without wildcard/private-import permissions or new product exports. Every new policy mutant requires a fresh complete fixture baseline first; type negatives freeze actual unsuppressed diagnostics, and pending tables cannot be labeled PASS.
- MI1 evidence separates source, build/public interface, behavior/lifecycle, types, policy, native and final publication/delivery status while preserving failures and repairs. Public content excludes private prompts, delegation files, unedited conversations and personal absolute paths.
- MI1 retains HT1 admission: interactive objects must be attached to the genuine Engine Stage and have an explicit authored local `hitArea`; Graphics bounds or rendered pixels do not create a hit region. Event handlers read coordinates through `event.payload`.
<!-- MI1-AGENT-POLICY-END -->

## Public contributions and evidence

Write explanatory documents in a neutral project voice: user needs, constraints, design reasoning, interfaces and delivery. Keep conversational prompts, respondent roles and routine drafting history out of the narrative. Preserve technical decisions, dated evidence, sources and accurate AI attribution; never invent an individual's thoughts or promote unverified work.

Use professional, objective and friendly language. Explain changes through Egret's target scenarios, independent design, interfaces and reproducible results. Design records connect questions, options, evidence, counterexamples and conclusions. Technical comparisons identify material versions and test conditions; performance goals and measured results remain separate.

State the actual scope of AI assistance, source material and author review. Retain references and acknowledgements; distinguish mechanism research, experimental dependencies, product dependencies and development tools. Preserve third-party attribution, copyright, licenses, NOTICE files and asset provenance. First-party code and documentation remain Apache-2.0.

Use fixed tools and the lockfile; disable lifecycle scripts during installation. Explain the reasons and effects of changes to versions, dependencies, licenses or publication settings. Protect personal and business information, unauthorized original projects, credentials and private configuration; publish only necessary authorized summaries. Workbench scheduling and unedited chats remain outside release content.

Organizing evidence may change presentation and publishable scope, while preserving data, results, source identity, failures and revision history. Identify projection relationships without rewriting historical hashes. Registered status and version-bound verification determine acceptance. Browser results, Native SDKs, hosts, CI, target-device performance and complete migration have separate acceptance obligations.

## Documentation and verification

Public introductions are English first, followed by Chinese. Maintain complete reading editions in `knowledge-base/en/` and `knowledge-base/Cns/`, using English filenames in the English tree. Generate read-only English registry views from the authoritative Chinese records; IDs, statuses, numbers and sources must match. Shared experiment code, original evidence, historical source identities and upstream legal originals retain their provenance.

Before every GitHub push, review source attribution, public content and both language editions, complete critical English code comments, update current document identities and run `node tools/prepush.mjs`. It checks publication structure, core/type/package boundaries, headless behavior and knowledge-base structure; it does not launch a browser. Structural checks do not establish translation quality or publication approval.

After cloning, contributors and CI must enable the same push hook with `git config --local core.hooksPath .githooks`. Fix failures instead of bypassing the hook. See the [bilingual policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) and [layout policy](knowledge-base/en/docs/documentation-layout.md).

Affected rendering changes additionally require the corresponding real-browser gates:

```text
node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"
```

The B1 command applies to affected B1 scene rendering; see its [bounded verifier](knowledge-base/en/docs/b1-browser-verifier.md). Use accepted pinned dependencies and default browser launch without extra flags. Retained unchanged-build evidence requires explicit identity comparison; a fresh complete prepush is still required before pushing.

Discovery and registered inventory paths exclude private execution, dependency and generated trees case-insensitively on Windows; listings cannot override exclusions. Public AGENTS files remain valid. Only the two exact sealed Three r186 research build paths/hashes retain their documented exceptions.

## Authorization

Pushes, releases, deployments and repository administration require actual user authorization. Existing authorization remains applicable to its scope; local generation or verification does not prove remote publication. This agreement grants no account permissions and expands no authorization for external publication, message sending or asset use.

<!-- SS1-PRIVILEGED-UNIT-POLICY-BEGIN -->
## SpriteSheet original-operation units

`tests/spritesheet-fault.test.mjs` and `tests/spritesheet-fault-child.mjs` form the isolated SS1 original-operation fault units. The child pins only `packages/runtime/dist/Bitmap.js` and `packages/runtime/dist/spriteSheet.js`; its one-module load hook may replace the unique captured original-operation block in Bitmap in memory for counters and one assigned fault/callback. SpriteSheet loads through the public `@egret/engine` facade and its bytes remain unchanged. The sole direct private import is the child's pinned Bitmap module before the public facade loads, to capture the genuine original class before temporarily replacing its `sourceRect` setter and `dispose` prototype method.

Each case requires a fresh genuine no-hook child baseline, a separate assigned child and another fresh no-hook child after restoration. Deregister the hook, restore exact prototype descriptors before ordinary caller/Scope/Engine cleanup, and verify source, emission, configuration, unit and permission bytes plus clone-owned package aliases before and after every child. Hook deregistration does not unload the module cache. Construction faults before a handle exists must not fabricate a Bitmap retirement; successful real construction followed by a crop/terminal failure uses only the captured original disposer, with the primary cause and secondary cleanup errors preserved. These units add no product export or dependency, permit no arbitrary private imports or private imports in ordinary examples/public behavior tests, and establish no physical OOM, GC, security or renderer acceptance.
<!-- SS1-PRIVILEGED-UNIT-POLICY-END -->

## M0 current metadata integration

Contributors edit content and isolated contributions/*.json declarations. Normal full prepush validates derived current metadata without changing shared ledgers; maintainers run tools/contribution-metadata.mjs --base <target-base> --write, then --check and tools/prepush.mjs --integrated on the final candidate. EGRET_METADATA_BASE selects that exact base for prepush; CI uses the PR base SHA. The generator is the narrowly authorized canonical authoring entry for localization.json, knowledge-base/documentation-layout.json and source-origin.json only. It preserves historical objects and refuses protected/private inputs. Do not refresh unrelated stale source rows. New content/base changes invalidate integration. Full hooks and independent source/bilingual review remain mandatory. Current browser suites use tools/browser-verify.mjs; advanced/historical tools retain their separate acceptance domains. See the [contributor workflow](knowledge-base/en/docs/getting-started.md#contribution-metadata-and-browser-checks).

## M1.1 warm-submission units

The private buffer and binding helpers remain metadata-only; WebGPUHost is the sole submission, proof and cleanup authority. Follow the [contract](knowledge-base/en/docs/warm-submission-contract.md). Public signatures, cold-route error priority and logical admission remain unchanged. Do not publish a reusable allocation on a fence alone or treat idle retention as native destruction.

Only tests/webgpu-submission-buffer-private.test.mjs, tests/webgpu-submission-binding-private.test.mjs and the private binding-retention cases in tests/webgpu-submission-controls.test.mjs may import packages/engine/dist/web/webgpuBufferPool.js and webgpuBindingCache.js directly. These are labelled UNIT cases, with no product export, arbitrary loader or public-example permission. Their synchronous prototype controls restore exact descriptors in finally.

tests/webgpu-submission-preparation.test.mjs and tests/webgpu-submission-precedence.test.mjs use genuine public SDK frames with controlled GPU ports. Their synchronous Float32Array/Uint8Array construction faults and crop counters restore original global descriptors; crop counting ends before native error-scope entry. They establish controlled operation order/counts, not physical OOM, total allocation or speed.

The B1 source-inspection successor retains the historical 19 captures and admits exactly 21 complete original-method capture initializers in three named helper emissions. The former buffer facade is inspected as an unlinked module; that inspection does not imply runtime execution. Seven exact static-only import edges cover that facade and the shared B1 preparation helpers; every edge in the five original runtime entry closures still requires actual resolution evidence. Preserve native unlinked module construction, exact capture consumption, assigned lexical refusals and the original thirteen-case schedule. Collector request and receipt capacities are finite verification limits, separate from product budgets. This grants no dynamic code construction or generic Function exception.

## M1.2 incremental rendering units

`tests/incremental-batch-private.test.mjs` is a CPU UNIT using only the built private `engine/dist/rendering/preparedBatches2D.js` helper. Its synthetic packed arrays verify bounded concat retention and ordered provenance, not public admission or native performance. In `tests/incremental-preparation-batching.test.mjs`, only the labelled constructor-fault units may synchronously intercept `Float32Array` for the exact eight-image concat allocation or original four-element uniform construction; restore the exact global descriptor in `finally` before asynchronous settlement and normal cleanup. Public behavior uses genuine SDK values and controlled GPU ports. These permissions add no product export, arbitrary loader or physical OOM claim.

The additional CPU UNIT files have these exact built private-module permissions:

- `tests/incremental-frame-cache-private.test.mjs`: `packages/runtime/dist/frameCaptureCache.js` and `packages/runtime/dist/displayVisualState.js`. Genuine public Engine, Stage and Sprite objects provide ownership. Reading the helper's logical ledger and setting private revision numbers immediately before overflow are restricted to these UNIT cases. The byte allowance may become binding before the entry allowance; report which limit was actually reached.
- `tests/incremental-preparation-private.test.mjs`: `packages/engine/dist/rendering/preparedFrameCache2D.js`, `prepareMixedDraws2D.js`, `prepareTexturedDraws2D.js`, `prepareRectangles2D.js`, `prepareImages2D.js`, `prepareTexturedMesh2D.js`, `packImageVertices2D.js`, `packTexturedMesh2D.js`, `texturedPreparationBudget2D.js` in that same rendering directory, and `packages/engine/dist/web/webgpuPass.js`. Public SDK constructors supply resources. Tests exercise actual preparation, exact keys, current-frame indices, logical accounting, atomic budget replay and terminal invalidation.

These permissions allow no loader interception, additional product export or private import in ordinary public examples. Logical accounting does not establish physical memory usage or speed.

## M1.3 shared retention units

Only `tests/shared-retention-private.test.mjs` may directly import the built private `packages/engine/dist/web/webgpuRetentionPool.js` helper. These labelled metadata UNIT cases use inert owned-resource ports to check the joint byte/count limits, exact compatibility, reservation order, genuine leases and terminal cleanup ownership. They invoke no native GPU methods, add no product export or loader interception, and establish no physical allocation or browser acceptance. Ordinary public behavior and examples continue to use public SDK entries.

The opt-in shared native collector uses only built public SDK entries for ordinary fixtures. Its eleven assigned controls may alter exactly one recorded engine emission in the collector's private served copy; never edit product files or change the numeric references. Require the reviewed unique source anchor and complete original/changed raw identities, a fresh healthy baseline, the assigned numerical failure and healthy restoration. Preserve raw RGBA, background captures and cleanup receipts. The current entry is `tools/browser-verify.mjs --suite shared-webgpu`; see the [shared contract](knowledge-base/en/docs/shared-render-profile-contract.md). These controls add no public private-helper access or general loader permission.

## M1.4 shared retention ledger units

Only `tests/shared-retention-ledger-private.test.mjs` may directly import the built private `packages/engine/dist/web/sharedRetentionLedger.js` helper. These metadata UNIT cases use inert allocation identities to verify complete backend keys, authentic whole-allocation leases, joint retention limits, disjoint snapshots and distinct destroyed, context-invalidated and unknown settlements. The backend wrapper owns descriptor validation; the Host owns native proof and cleanup. Tests invoke no native methods, add no public export or loader interception, and establish neither physical memory nor browser recovery. Existing M1.3 private-unit permissions remain unchanged.

## M1.4 shared storage units

Only `tests/shared-storage-private.test.mjs` may directly import built private `packages/engine/dist/web/sharedSubmissionStorage2D.js` and `packages/engine/dist/web/prepareSharedSubmission2D.js`. These CPU UNIT cases use bounded synthetic already-prepared metadata for logical fees, concrete readback layouts, capacity and original WebGPU refusal order; genuine public ImageData2D supplies cold-page copy witnesses. The test may use property getters only on its own metadata to observe refusal before device/pending/source-copy reads. It adds no product export, global interception, loader hook or native access, and establishes neither public frame admission nor browser pixels or performance. Ordinary behavior tests and examples continue to consume public SDK entries.

## M1.4 WebGL2 option and arena units

Only `tests/shared-webgl2-private.test.mjs` may directly import built private `packages/engine/dist/web/sharedWebGL2Options.js` and `packages/engine/dist/web/sharedWebGL2Arena.js`. These CPU UNIT cases use inert canvas objects, getters on their own options, small typed payloads and bounded synthetic packed metadata to verify ordered snapshots, finite scalar domains, exact range arithmetic and pure pending-capacity checks. Numeric-only byte-length and pending-counter fixtures are arithmetic controls, not uploadable payloads or accepted public frames. The tests invoke no canvas or GL method, add no global interception, loader hook or public export, and establish neither native allocation nor public Host admission, recovery, pixels or performance. Public behavior tests and examples continue to use genuine public SDK values.

## M1.4 WebGL2 public behavior and source boundaries

WebGL2 uses only the explicit built entries `@egret/engine/webgl2` and `@egret/engine/webgl2/scene3d`. The first exports `createSharedWebGL2Host` and nine erased types; the second exports `createSharedSceneWebGL2Host` and two erased types. The root and Canvas entry load no WebGL2 module. Scene mode is a fixed first-party assembly using the existing scene authority and packing helpers; only the private scene-enabled Host loads its exact scene module. No caller-supplied shader, scene plugin or native object is an SDK input.

`tests/shared-webgl2-controls.test.mjs` and `tests/fixtures/gl-shared-rendering.mjs` use built public SDK entries, genuine Engine captures and test-owned canvas, GL and event ports. Property getters, assigned failures, completion delays and reentrant callbacks are confined to those owned ports/options. Lookalike frames are refusal controls, never accepted fixtures. Apart from the exact clock control below, these units add no private product import, loader hook, global/prototype interception or test export. They establish controlled admission, command order, logical ownership and lifecycle outcomes; real browser pixels, native loss/restoration and performance require separate evidence. Existing option/arena, shared-storage and retention UNIT permissions remain unchanged.

Only the labelled monotonic-deadline controls in `tests/shared-webgl2-controls.test.mjs` may temporarily replace the full `globalThis.performance` descriptor with a test-owned monotonic clock to cross the unchanged 30-second Host sync deadline or configured restoration deadlines without a wall-clock wait, including distinct restoration attempts and duplicate-loss handling. Restore the exact original descriptor in `finally` before ordinary cleanup; keep the control scoped to the assigned case. This does not permit other global/prototype interception, a shorter product deadline, native fault simulation or a performance claim.

The source boundary fixes both public export maps, all source/emitted/declaration edges for nine WebGL2 modules, the Host's exact registry imports and its guarded scene import. Native capture is limited to the enumerated 68 methods and creation/deletion operations for eight resource kinds in `webgl2Native`; capture reads each named method and binds it to its owning context. It grants no enumeration of a native context/prototype, computed dependency discovery, dynamic code construction or general interception. All retained WebGPU capture, closure and verifier quotas continue to apply independently. Source inspection and a raw-WebGL prerequisite do not establish SDK acceptance or recovery.

<!-- M14-NATIVE-PUBLIC-BEGIN -->
## M1.4 finite public native collectors

The opt-in `tools/verify-shared-webgl2.mjs` collector uses only built public SDK entries in its ordinary fixture. Its unchanged thirty-case scalar-reference matrix and eleven assigned controls run in 63 fresh contexts. Each control changes exactly one recorded engine emission in the collector's private served copy after verifying the unique source anchor, original/changed raw identities and unchanged literal import graph; require a fresh healthy baseline, its assigned numerical refusal and healthy restoration. Preserve the original shared WebGPU catalog, controls and oracle, raw RGBA, black/white captures and cleanup receipts. The tool adds no product export, public private-helper import, native interception or general loader permission. Pixel acceptance, native recovery/depth/state checks, timing and delivery remain separate.

The separate `tools/verify-shared-webgl2-lifetime.mjs` fixture uses genuine public SDK values and its own canvas to set fixed dirty state and invoke the actual `WEBGL_lose_context` extension. Its four-context / six-readback / 24-point / 96-channel schedule covers immediate submissions, fixed depth/state, one restoration/replay and one close-before-restore race. It adds no private product import, interception or synthetic loss proof. Keep its exact zero-tolerance endpoints and cleanup observations; sustained M1.5 recovery and timing remain separate.
<!-- M14-NATIVE-PUBLIC-END -->
