# Changelog

English | [简体中文](../Cns/CHANGELOG.md)

Version labels below identify engineering checkpoints; workspace packages remain private 0.0.0 and the host protocol remains 1.0. Subsystem contracts and evidence state each checkpoint's acceptance scope.

## A Spine replacement carries a mix under way — 2026-11-14

`requestPreserving` on the Spine reset slot no longer refuses a player that is mixing from one animation into another. The entries a track is still mixing out of are carried with the current one: how far each mix has come, the direction each mixed rotation turns, and the holds an entry keeps. With an equal asset the copy stands in the pose of the original at every later tick, across seven kinds of mix replaced at nine moments each. An asset must now also have the animations that are only being mixed out of. What an ended animation left on a bone is still not carried, and is now said so. Hardware and WebGPU rows of this path remain unrun. [Guide](docs/spine-reset-slot.md#keeping-the-playback)

## Physics under seek — 2026-11-14

An original Spine fixture with a physics constraint now stands beside the seek tests. Six cases show that the constraint is simulated and remembers what came before, pin the rule that cuts an advance into sixtieths with the short remainder last, and find a seek equal to a straight run with physics: at the end of every step, inside every step, beyond the present and through an instance made by the reset slot. No code changed. The fixture is not an Editor export and no independent reference was used. [Guide](docs/spine-seek.md#physics)

## A page opened from the clean consumer — 2026-11-14

`tools/verify-clean-consumer-page.mjs` goes on from the clean-consumer check: it serves the consumer directory alone, writes a page that imports the installed engine through an import map built from the installed manifests, and opens it in a real browser. The page draws a button and answers one injected press, and the frames the Host reads back are checked. It passed with WebGL2 under software rendering in headless Chromium, from 128 requests that all stayed inside the consumer. WebGPU, a hardware GPU and other browsers have not opened it, and its times are observations of one run, not a budget. [Guide](docs/clean-consumer.md#a-page-from-the-consumer)

## A text field control over the platform text input — 2026-11-14

`createTextFieldControl` in `@egret/engine/ui` holds the text of a field an application draws and whether it is being edited. A completed press, a key or a request of assistive technology opens an editor over the place the application names; the platform text input is such an editor as it is, so a player types Chinese into a drawn field with the platform's own input method. Several fields share one editor, a cancelled edit leaves the text as it was, and the length limit counts characters as a reader does. A new example draws a form of two fields and a button. Its composition was driven through Chromium's protocol; no real input method, on-screen keyboard or person was run. [Guide](docs/ui-controls.md#text-field)

## Semantics of a drawn UI — 2026-11-14

`@egret/engine/ui/semantics` holds a tree that describes the controls an application draws: a role, a name, bounds and state for each, read from the control at every publication, with the activation and the focus request a press and a key already reach. `@egret/engine/web/semantics` projects it to the page: the canvas keeps the keyboard, owns an invisible container of elements laid over the controls, and names the focused one as its active descendant. A modal dialog makes everything outside it inert. The control example now describes its switch, its options and its button. The projection was checked against the accessibility tree of headless Chromium; no screen reader, other assistive technology or other browser was run. [Guide](docs/ui-semantics.md)

## Staged seek for Spine instances — 2026-11-14

`instance.seek` moves a Spine instance to another elapsed time. The playback is rebuilt on a private copy from the setup pose by replaying the commands and deltas the instance accepted, in slices of bounded work, and the instance is untouched until the commit. Events are suppressed by default; a forward seek may replay them, capped and delivered only after it succeeds. History is bounded and dropped when it outgrows its limits, after which a seek is refused. A faulted instance is brought back by a seek to the time it last published. The tests use original numerical fixtures; none has a physics constraint. [Guide](docs/spine-seek.md) · [#84](https://github.com/cnedwin/Egret_rebuild/issues/84)

## Scroll position for viewports — 2026-11-14

`createScrollControl` in `@egret/engine/ui` holds the offset of one axis of a clipped viewport an application draws. The wheel scrolls it through the hover input and is consumed only when the offset moved, so a viewport inside another hands the wheel outward and the outermost hands it to the page. One contact drags the scrollbar thumb, and `line`, `page`, `toStart` and `toEnd` serve the keys. The hover example now scrolls its list with it. Panning the content with a finger is a gesture and is not recognized. [Guide](docs/ui-controls.md#scroll-position) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## Hover, toggle and selection state for controls — 2026-11-14

`@egret/engine/ui` gains `createHoverControl`, `createToggleControl` and `createSelectionGroup` beside the movement and action controls. They hold the state of a control an application draws: hovered by a mouse or a pen over the target or a descendant, checked, and one selected key of several with movement among the enabled items. Keys reach the same methods a pointer reaches. The hover input now names the other end of an enter and a leave (`related`) and accepts late observers. A guide documents all five controls. The checks are unit tests on a genuine Engine and a real page in headless Chromium with software WebGL2 and injected input; nothing is announced to assistive technology yet. [Guide](docs/ui-controls.md) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## Hover and wheel routing — 2026-11-14

Two optional entries route hover and the wheel over the display tree. `@egret/engine/input/hover` is the logical input; `@egret/engine/web/hover` listens on the canvas and shares it with the contact adapter. A target learns that a mouse or a pen entered, moved over or left it, with the reason of each leave, and a wheel goes to what is under it with a page policy the application chooses. The checks are unit tests on a genuine Engine and a real page in headless Chromium with software WebGL2 and injected input. A real mouse, pen or trackpad, hardware GPUs, WebGPU, Safari and Firefox were not run, and the managed controls do not use it yet. [Guide](docs/pointer-hover.md) · [#89](https://github.com/cnedwin/Egret_rebuild/issues/89)

## Clean-consumer check of the default engine — 2026-11-14

`tools/verify-clean-consumer.mjs` packs the three packages of the default engine with the pinned pnpm, installs them into a new project outside the checkout and uses them there. The unmodified public examples run, all 23 entries resolve and load from the installed copy, the minimal route loads no web, 3D or optional module, and a strict TypeScript consumer compiles. The check runs in Node. The packages remain unpublished, and a browser run from a consumer, first interaction and the human walkthrough remain open. [Guide](docs/clean-consumer.md) · [#93](https://github.com/cnedwin/Egret_rebuild/issues/93)

## Opening a project in Outfit Studio — 2026-11-14

Outfit Studio opens an exported project in the running page. The file is admitted on a copy of the live project and written as one edit transaction, under the same stable character IDs. New palettes are loaded and taken by the Host while the previous frame stays on screen, and the project, actors and roster then change together. A refused file, a failed load or Cancel changes nothing. The WebGL2 rows of the new browser check passed in headless Chromium with software rendering; the WebGPU, hardware and phone rows have not been run. [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) · [Outfit Studio](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/README.md)

## SharedFrame2D and rendering diagnostics — 2026-11-14

SharedFrame2D is the public 2D frame path for WebGPU and WebGL2. The older Canvas Host, legacy frame captures and prototype scene3d Host were retired. Ordered cross-page batching and retained command, packing and batch records are available on the shared path. The integrated pixel comparisons were software-rendered. The optional debug monitor and GPU timing harness report their available counters and timing sources. [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#188](https://github.com/cnedwin/Egret_rebuild/pull/188) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) · [#193](https://github.com/cnedwin/Egret_rebuild/pull/193)

## Spine replacement that keeps playback — 2026-11-14

The Spine reset slot gains `requestPreserving`. A new asset version takes up each track's animation and queue, the skins, rate, pause and placement where the player stands when the candidate is captured. The asset must have each carried animation under the same name, with the same length and event schedule; one that cannot continue the playback is refused before publication, and so is playback that is mixing. The preserved player was held tick by tick to the player it replaces, and the example passed its WebGL2 browser check in headless Chromium with software rendering. WebGPU, hardware and phone rows have not been run. [#86](https://github.com/cnedwin/Egret_rebuild/issues/86) · [Contract](docs/spine-reset-slot.md#keeping-the-playback)

## Native canvas text entry — 2026-11-14

An opt-in browser adapter places a native field over the game canvas. Its tests cover public API behavior and a Chromium protocol-driven composition example. The managed editing path remains available separately. Physical input methods, mobile keyboards for this adapter, Safari and Firefox remain to be qualified. [#195](https://github.com/cnedwin/Egret_rebuild/pull/195)

## Scoped PC and Android graphics observations — 2026-11-13

World3D WebGL2 shadow-atlas and frame-accounting checks ran in hardware Edge and one Android Chrome configuration. SharedFrame2D cold-texture and attachment changes also have paired hardware Edge pixel observations and selected Android lifecycle and timing evidence. Both records retain their own source, workload and adapter boundaries. [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#185](https://github.com/cnedwin/Egret_rebuild/pull/185)

## World3D gameplay physics and rendering — 2026-11-13

Automatic instancing groups compatible draws and the picking hierarchy accelerates dense-mesh queries. Physics adds shape sweeps, compound bodies, contact reports and solver improvements, followed by ragdoll, arcade vehicle, rope, cloth and message-port helpers. The latest PR reports 27 fixed headless software-rendered WebGL2/WebGPU comparisons and remote tests using MessageChannel and a Node worker thread. Browser Worker, physical-device and performance qualification remain open. [#163](https://github.com/cnedwin/Egret_rebuild/pull/163) · [#166](https://github.com/cnedwin/Egret_rebuild/pull/166) · [#167](https://github.com/cnedwin/Egret_rebuild/pull/167) · [#168](https://github.com/cnedwin/Egret_rebuild/pull/168)

## Parallel Windows merge checks — 2026-11-13

One Windows job runs the structural and publication checks while four independent test shards cover the complete suite on the same candidate. The final hosted run for #164 took 13 minutes 12 seconds from creation to completion. [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) · [Hosted run](https://github.com/cnedwin/Egret_rebuild/actions/runs/43294257120)

## World3D character, terrain and effects — 2026-11-12–13

Character controls, asset decoding, navigation, terrain and water, skinned crowds and effects landed across the series. The last checkpoint in this set passed 25 fixed Windows Edge offscreen WebGL2/WebGPU comparisons, with a separate soft-particle depth check on both backends. [#154](https://github.com/cnedwin/Egret_rebuild/pull/154)–[#159](https://github.com/cnedwin/Egret_rebuild/pull/159) · [#161](https://github.com/cnedwin/Egret_rebuild/pull/161)

## Fixed desktop rendering CPU targets — 2026-11-12

Windows E20 reached a 5.3 ms full-dirty Engine median-p95 and met the CPU and preparation targets in all states. Sparse and full-dirty pacing remains above target. GPU time is unmeasured. [#153](https://github.com/cnedwin/Egret_rebuild/pull/153)

## World3D rendering, physics and gallery — 2026-11-12

Add an optional standalone 3D scene graph and renderers, glTF, lights and shadows, post-processing, physics, a feature gallery and fixed CPU regression workloads. The [World3D contract](docs/world3d.md) records backend features and verified environments. [#147](https://github.com/cnedwin/Egret_rebuild/pull/147) · [#148](https://github.com/cnedwin/Egret_rebuild/pull/148) · [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) · [#151](https://github.com/cnedwin/Egret_rebuild/pull/151) · [#152](https://github.com/cnedwin/Egret_rebuild/pull/152)

## Isometric WebGL2 map — 2026-11-12

The standalone example uses Egret’s public APIs for grid movement, collision, depth ordering and bounded frame submission. [#136](https://github.com/cnedwin/Egret_rebuild/pull/136)

## Shared geometry construction — 2026-11-11

Reduce the per-frame cost of building shared geometry for Spine while retaining input copying, numeric admission and identity. Short desktop and single-Android comparisons show a lower animation stage cost. Formal frame intervals, CPU/GPU and device targets remain open. [#140](https://github.com/cnedwin/Egret_rebuild/pull/140)

## Compatible sequence playback preservation — 2026-11-11

Carry playback position, loop, rate, pause state and marker numbering across ContentLoader replacements with identical ordered frame boundaries. Both browser backends passed bounded pixel and lifecycle checks. Spine state preservation remains open. [#139](https://github.com/cnedwin/Egret_rebuild/pull/139)

## Shared clipping preparation — 2026-11-11

WebGPU and WebGL2 reuse fully contained polygons while keeping the original budget and intersection rules. The fixed scene has short paired Host p95 observations. Full M4 qualification remains open. [#138](https://github.com/cnedwin/Egret_rebuild/pull/138)

## Fixed Outfit Studio workloads and multitouch — 2026-11-11

Run fixed desktop and mobile profiles in one Outfit Studio and record desktop timing and controlled Android multi-contact results on both backends. Formal frame-interval and touch-response targets remain open. [#137](https://github.com/cnedwin/Egret_rebuild/pull/137)

## Editable Outfit Studio — 2026-11-07

Compose independent Spine instances, sequence animation, managed UI and an opaque 3D background in one Engine. The two desktop backends cover the compact scene, replacement and cold-start observations. [#135](https://github.com/cnedwin/Egret_rebuild/pull/135)

## UI popup/modal composition — 2026-11-07 · [#134](https://github.com/cnedwin/Egret_rebuild/pull/134)

Add optional root-owned popup/modal composition, staged publication, clipped anchors, pointer barriers and contained/restored keyboard/native-editor eligibility. Integrate the existing form with draft rename and shared font/lifecycle owners. Desktop evidence, the initial locked attempt, two actual phone failures and final32 current-device observations are distinguished. Programmatic fallback no longer activates the base editor; width rebuild settles the rename preedit before saving its model. Complete M3.4, semantics, touch contribution and M1.2 remain open. [Contract](docs/ui-layers.md).

## Android native editing and responsive form — 2026-11-07 · [#133](https://github.com/cnedwin/Egret_rebuild/pull/133)

Repair terminal composition callbacks after cancellation without weakening active-session reentry. The existing form gains responsive width/startup DPR and separately scoped view retirement, retaining the fixed fixture. Actual Samsung keyboard observations, final-source lifecycle on both backends and desktop checks are documented with predecessor/failure boundaries. [Evidence and remaining qualification](docs/android-native-text-editing.md).

## Product/core roadmap reconciliation — 2026-11-07

Reconcile current capabilities with all product requirements and the existing M2–M4 packages. Consolidate the white paper, engineering/delivery plans and navigation; prioritize native editing, one mixed reference and remaining content/animation work while retaining touch ownership, M1.2 failure and device/material limits. Current optional Spine/CanvasKit implementations replace stale no-player/no-provider descriptions. No engine behavior, acceptance target, dependency or historical receipt changes. See [the engineering plan](docs/engineering-plan.md).

## Android memory accounting and lifecycle — 2026-11-07

Precise target diagnostics distinguish cached performance.memory readings from live JS and backing storage. Existing paragraph, sequence and Spine examples add finite Android lifecycle/recovery evidence on both backends; the old41.4ms trigger remains unreproduced. No engine repair or full M4/M1.2 acceptance is claimed. See [the follow-up](docs/android-device-validation.md#cadence-memory-and-lifecycle-follow-up--2026-11-07).

## Equipment font selection on Android — 2026-11-06

The paragraph example now builds equipment style ranges from its captured font group, preserving default fixtures while allowing the alternate registered CJK alias. A real-device failure, short reproduction and selected-backend checks are recorded separately; core admission and budgets stay unchanged. See [Android component validation](docs/android-device-validation.md). Full M4 and M1.2 acceptance remain OPEN.

## Optional Spine assets — 2026-10-30

Pinned official Core 4.3.13 reads JSON setup assets and original multipage atlases through existing resources and Scope. The optional SDK preserves explicit license conditions and immutable information; complete playback, graphics, stable corpus and independent references remain open. [SDK](docs/spine-content-ingress.md).

## Paragraph alignment and line limits — 2026-10-29

Readonly paragraphs now support left/right/center/start/end/justify alignment and optional maxLines with a fixed ellipsis. Hard-break/blank-line overflow shows the marker; an impossibly narrow field rejects without replacing committed content. Existing UI geometry and resource ownership remain authoritative. See the [layout contract](docs/paragraph-layout-controls.md). The focused 36 cases and 20 actual browser checks per backend are finite functional evidence; full M3.2, devices, IME and performance remain OPEN.

## Final-line bidirectional layout — 2026-10-29

The optional paragraph runtime now applies native line-specific L1/L2 after wrapping, with canonical glyph storage shared by paint, geometry and hit queries. Finite native and actual-browser checks cover reset spaces, control slots and width restoration; full M3.2 and device/performance acceptance remain open. See the [line contract](docs/paragraph-line-bidi.md).

## M2.2 sequence controls — 2026-10-23

The optional animation entry adds rate, finite total plays, ordered markers and explicit silent/replaying seek, sharing the existing clock and resource ownership. Legacy and new playback cannot simultaneously claim the same Bitmap. See the [sequence-control contract](docs/sequence-controls.md). Complete Spine and M2.2 acceptance remain open.

## M3.1 committed UI panels — 2026-10-23

M3.1 adds an owned UI root with explicit prepare/commit, automatic row/column layout, stable-key variable-height lists and bounded asynchronous row recycling. Multiple panels share the existing renderer, input router and resource owners. Read the [UI panel contract](docs/ui-data-panel.md). Full controls, paragraphs, focus/IME, gestures, mobile qualification and performance acceptance remain open.

## M2.1 content build foundation — 2026-10-23

M2.1 adds verified PNG/atlas/sequence source builds, persistent cache reuse, dependency invalidation and immutable generations adopted through the existing project transaction. Sources and old generations remain intact. See the [content build contract](docs/content-build-pipeline.md). Complete Spine, fonts and target variants remain open.

## M3.3 multi-contact foundation — 2026-10-23

M3.3 provides an optional DOM-free contact router and Engine/browser entries for independent multi-touch sessions, capture, cancellation and viewport/lifetime cleanup. The two-region example and reproducible desktop collector are included. Focused regression passes 176 tests. Read the [contract and evidence](docs/multi-pointer-input.md). Full M3.3 focus/IME, M3.4 gestures and physical Android/iPhone acceptance remain open.

## M1.2 preparation follow-up — 2026-10-21

Bounded clip validation and rectangle reuse, same-slot cache lookup, fewer temporary corner arrays and contained-edge handling reduce repeated preparation work while retaining original work budgets and failure order. Public APIs are unchanged. Native preflight, pixels and operation counts passed for the candidate; the fixed count remains 991 baseline and 155 candidate draws per frame. The historical formal timing batch missed its targets. The latest diagnostic was interrupted by foreground-window changes, so no valid candidate timing pair or new formal timing batch is available. M1.2 acceptance remains open; see the [evidence and limits](docs/incremental-frame-preparation-evidence.md).

## M1.5 delivery — 2026-10-21

Resource manifests, dependency-aware shared loading, staged uploads and unified WebGL2/WebGPU recovery were delivered through [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79), main `4924b471b52927184252191055f902c30c29af52`. All four jobs in [CI run 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) succeeded. The Windows integrated gate passed 290 publication tests, 4,528 core tests and 160 Spine F2 tests; each group recorded zero failures, cancellations and skips.

The seven fixed C7 recovery cases and twenty-four affected browser suites (thirty-six calls) have actual results and independent review. M1.2 formal paired performance and external platform/device qualification remain open. The [verification record](docs/resource-recovery-evidence.md) preserves the earlier cutoff and failed local attempt alongside this later completed delivery.

## M1.5 recovery verification — 2026-10-20

M1.5 adds resource manifests, dependency-aware loading and shared resource ownership, with bounded integrity-checked loading, staged uploads and unified WebGL2/WebGPU recovery. Its seven fixed recovery cases on Windows / Chrome for Testing 157.0.8103.6 and the affected browser regression have passed independent review. WebGL2 and WebGPU each completed 100 resource cycles, ten native loss/recovery cycles and 30 minutes of foreground operation. At this verification cutoff, final package review, protected M1.5 merge checks and M1.2 formal performance acceptance still required completion. See the [verification record](docs/resource-recovery-evidence.md).

Workflow simplification was separately merged through [PR #78](https://github.com/cnedwin/Egret_rebuild/pull/78). Delivery is recorded in the repository's [pull requests](https://github.com/cnedwin/Egret_rebuild/pulls); earlier entries retain their recorded cutoffs.

## M1.3 candidate — shared texture pages and rendering

An explicit shared profile separates source pages, logical texture regions, material state and completed-frame identity. Several atlas regions share a canonical upload; trim/rotation, nine-slice, two-color tint, ordered boundaries and bounded target reuse support complex 2D interfaces. The finite linear B1 path composes opaque 3D with shared UI before one final output conversion. Existing color profiles remain available.

The 100 focused checks, 24 strict negatives and fixed desktop matrix of 30 positive scenes plus 11 numerical control triples pass in their recorded scope. Complete regression and protected integration remain pending. Read the [contract](docs/shared-render-profile-contract.md) and [results and limitations](docs/shared-rendering-evidence.md). No performance, phone or complete Spine claim follows from these results.

## M1.2 functional delivery — incremental ordered frame preparation

Merged through [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74), main `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`; formal performance acceptance remains open. The earlier candidate observations below retain their own cutoff.

M1.2 reuses unchanged display transforms, clipping and prepared geometry, then merges compatible adjacent draws without changing painter order or public APIs. Current resources still undergo complete admission, and saved frames remain isolated from later edits. The fixed native operation fixture records 991 baseline draws and 155 candidate draws per frame.

Read the [contract](docs/incremental-frame-preparation-contract.md) and [evidence and limits](docs/incremental-frame-preparation-evidence.md). Operation counts do not establish elapsed-time improvements. At that earlier cutoff, the baseline reached its two-frame in-flight limit during warm-up. Later completed timing and the current candidate are recorded above; M1.2 performance acceptance remains open. Full publication gates and repository delivery are separate.

## M1.1 delivered — warm WebGPU submission

Merged through [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73), main `fa88111f5e73503e1804f92a9f444207110b773c`. Earlier evidence retains its recorded cutoff; delivery does not extend its performance or platform claims.

M1.1 adds completion-safe vertex/index/uniform buffer reuse and complete-key binding reuse, and avoids covered warm image crop copies. The bounded caches preserve original admission, painter order and public APIs. Read the [contract](docs/warm-submission-contract.md) and [current evidence](docs/warm-submission-evidence.md). Actual operation counts, native image checks, performance and repository delivery remain separate acceptance domains.

## 0.61.0 — experimental WebGPU image residency

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](docs/gpu-image-residency-contract.md) and [evidence and limits](docs/gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## 0.60.0 candidate — atlas import planning

The **0.60.0 engineering preview** adds the optional `@egret/project/atlas` entry: strict single-page Aseprite stable-marker JSON-array planning with one explicit PNG binding. Its two runtime values and sixteen erased types produce owned, frozen inputs for the existing SpriteSheet and SequenceClip factories. The exact profile is `aseprite-json-array-1.3.18.6-v1`; exporter output compatibility, declared hashes and entitlement remain unverified.

Read the [contract](docs/atlas-import-plan-contract.md) and [evidence and limits](docs/atlas-import-plan-evidence.md).

Independently accepted saved results are focused planner 47/47, the earlier normal SDK run with core 3625/3625 and separate F2 160/160, and the distinct CPU firstGREEN 5/5. These overlapping scopes are not added together. Independent review also accepts the selected new Native Canvas/WebGPU four-readback result. Final integrated gates/prepush and 0.60 Git/remote delivery remain pending. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## 0.59.0 delivery update

The preceding 0.59 increment was delivered through [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48), Main `44f49f9d97a7baebc400fd4940541529dc33d147`. Earlier 0.59 readings and evidence retain their original authoring cutoffs; the new delivery statement does not rewrite them. No remote statuses or check runs were reported, so no CI pass is inferred.

## 0.59.0 candidate — normalized atlas frames — 2026-10-17

The explicit `'trim-rotation-v1'` profile on the existing SpriteSheet and SequenceClip factories supports single-page frames with transparent trim and clockwise90 packing. Owned layout preserves logical dimensions and placement through Bitmap and existing sequence playback, while the default rectangle path remains compatible. Read the [contract](docs/atlas-frame-layout-contract.md), [evidence and limits](docs/atlas-frame-layout-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md).

The independently accepted 12-stage SDK `node tools/verify.mjs` run passed **3559/3559 core tests** and a separate **160/160 Spine experiment tests**, with failed/cancelled/skipped/todo all **0** in each suite. Separate desktop Canvas and textured WebGPU verification passed six fresh contexts and 30 complete RGBA readbacks at zero tolerance, including assigned controls and replay after origin retirement. The current verifier adds a thirteenth atlas source-boundary phase; its complete rerun, final publication/prepush, 0.59 Git delivery and remote CI remain pending at this authoring cutoff. Earlier failures and repairs are retained in the linked evidence. Exporter imports, multipage, pivot/nine-slice import, animated retarget, controller seek/rate/events, full Spine R020/V020, migration R008/V006 and physical-device/performance acceptance remain OPEN.

## 0.58.0 — Atomic Bitmap bindings and prepared outfits

Engineering preview **0.58.0** adds `Engine.captureBitmapBindings(scope, targets)` and the erased `BitmapBindingTicket` type. The prepared-outfit example waits for both clothing textures and commits their bindings together. Pending, failed, cancelled and obsolete changes preserve the working outfit; a ticket refuses to overwrite a later caller binding.

Recorded desktop Canvas and WebGPU checks passed six fresh contexts with 54 original RGBA readbacks, including separate old-layer controls, genuine mouse selection, animation boundaries and shutdown with original reads still pending. This is finite desktop evidence. General dependency manifests, additional content types, full UI, Spine, production hosts, mobile performance and physical-memory acceptance remain open.

Read the [contract](docs/prepared-resource-groups-spec.md), [evidence and limits](docs/prepared-resource-groups-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md).

## 0.57.0 — real-resource scene integration

Engineering preview **0.57.0** combines real PNG resources, shared atlas playback, text and mouse input through existing public Engine APIs. Canvas is the default; the textured WebGPU scene is an explicit experimental choice. Resource preparation, presentation readiness, input readiness and safe shutdown have separate boundaries. Read the [integration record](docs/resource-scene-integration.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md).

The recorded desktop Canvas/WebGPU workflow completed seven fresh contexts and retained 64 original RGBA frames. Fixed-point and font-region comparisons, negative controls and retirement passed in the documented environment. Phone, cross-environment font, performance and energy acceptance remain open.

## 0.56.0 delivery update — 2026-10-16

The 0.56 resource-replacement increment was delivered through [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45), Main `19c308af4d7c9590f886c8105d5d678e708184c5`. Earlier verification records retain their original cutoffs.

## 0.56.0 — recoverable Bitmap resource replacement

`Engine.createBitmapResourceSlot(scope, bitmap)` adds explicit asynchronous Texture replacement for one persistent Bitmap through the existing root entry, with the erased `BitmapResourceSlot` and `BitmapResourceSlotState` types. It borrows the initial binding and owns only fresh replacement leases. The prior usable binding remains during pending, failed or cancelled requests; only the latest accepted intent may commit. Cancellation and supersession reject their request Promises. Read the [specification](docs/bitmap-resource-slot-spec.md), [evidence and remaining acceptance](docs/bitmap-resource-slot-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md).

Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence. Complete UI, Spine R020/V020 and legacy migration R008/V006 remain OPEN. The prior 0.55 increment was delivered through [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44), Main `f6b7968db89febfdbe00fb1322f208ab2135f68f`; earlier entries retain their own historical evidence cutoffs.

## 0.55.0 — explicit local linear layout

The optional `@egret/engine/layout` entry turns explicit numeric records into a frozen local rectangle plan. Callers filter membership, arrange children and apply coordinates. A two-Button example composes existing shared input, a borrowed programmatic atlas, nested clipping and saved/live frames. Read the [specification](docs/local-linear-layout-spec.md) and [verification scope](docs/local-linear-layout-evidence.md).

## Documentation maintenance — 2026-10-15

Reorganized the public narrative around product goals, design reasoning, contracts and delivery. Product documents, navigation and bilingual readings are maintained together; sources, licenses and original experimental evidence remain traceable. This editorial change adds no engine capability.

## Previous integration — 0.54.0

Engineering preview 0.54.0 was integrated through [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42), Main efd2a9c91fb6cfe633214b50b82cf7952941452a, tree 2b39b8439a5b30ce3572edc162e8a7a916a76185. Its recorded full local checks passed Core 3218/3218 and Spine Source 160/160; desktop Canvas/WebGPU checks completed 38 main readbacks and 87552 channel comparisons at tolerance 0. These are distinct, overlapping verification scopes. Remote CI had no reported checks; no CI pass is inferred.

## 0.54.0

Reusable bitmap buttons connect shared mouse input, resource leases and pressed/disabled skins; activation performs a final pick after event routing. [Details](docs/bitmap-button-contract.md).

## 0.53.0

A runnable atlas playground combines texture loading, SpriteSheet crops, Engine-clock playback, explicit pivots and saved/live frames. [Details](docs/anchored-atlas-playback-contract.md).

## 0.52.0

Authored anchor offsets use the same transform semantics in frame collection, coordinate queries, bounds and picking. [Details](docs/display-anchor-offsets-contract.md).

## 0.51.0

Indexed child insertion preserves parent/child order, ownership and reentrant validation. [Details](docs/container-add-child-at-contract.md).

## 0.50.0

Direct-child index queries expose the current ordering without mutating the tree. [Details](docs/container-child-index-contract.md).

## 0.49.0

Batch detachment removes all direct children while retaining their separate resource and lifetime rules. [Details](docs/container-remove-children-contract.md).

## 0.48.0

NineSliceBitmap supplies fixed-border backgrounds using existing geometry, texture leases and owned frames. [Details](docs/nine-slice-bitmap-contract.md).

## 0.47.0

An experimental official Spine Core bridge drives original manual fixtures into Mesh2D frames. Complete Spine remains a separate requirement. [Details](docs/spine-core-manual-bridge.md).

## 0.46.0

The optional browser PNG provider adds bounded still-image decoding and explicit shutdown over the existing asset system. [Details](docs/browser-png-contract.md).

## 0.45.1

Shared path/byte identity helpers, canonical text writers and mandatory hooks address Windows path spelling and line-ending drift. [Details](docs/repository-identity-and-line-endings.md).

## 0.45.0

Named SpriteSheet frames share one atlas lease across static crops and sequence playback. [Details](docs/spritesheet-contract.md).

## 0.44.0

Scope-owned sequence playback follows the explicit Engine clock and supports once/loop control. [Details](docs/sequence-playback-contract.md).

## 0.43.0

The Spine linear source profile defines versioned animation inputs and source-level checks. [Details](docs/spine-linear-profile-contract.md).

## 0.42.0

Spine mesh source planning defines owned mesh-frame preparation and validation boundaries. [Details](docs/spine-mesh-source-plan-contract.md).

## 0.41.0

Nine-slice geometry adds explicit border and stretch semantics before the display component. [Details](docs/nine-slice-geometry-ns1-contract.md).

## 0.40.0

ByteWriter adds owned binary output, explicit byte order and transactional cursor behavior. [Details](docs/byte-writer-bw1-contract.md).

## 0.39.0

Textured scene composition joins selected 3D passes and depth-free UI through an explicit browser Host. [Details](docs/textured-scene-host-contract.md).

## 0.38.0

Public Matrix4 authoring exposes the existing first-party CPU matrix semantics. [Details](docs/public-scene3d-contract.md).

## 0.37.0

The original Spine F1 experiment gains opt-in Engine-clock integration.

## 0.36.0

The original F1 Spine experiment connects manual animation fixtures, mesh frames and browser verification.

## 0.35.0

Scope ownership is protected against the recorded public-shadow cases and cleanup reentry. [Details](docs/scope-private-ownership.md).

## 0.34.0

The optional Spine import planner adds strict metadata and scanner-first refusal semantics. [Details](docs/spine-import-plan-contract.md).

## 0.33.0

Primary mouse input connects authored hit areas, typed display events and Scope lifetime. [Details](docs/primary-mouse-input-contract.md).

## 0.32.0

Optional public scene and mesh facades expose selected owned CPU frames and a browser Host. [Details](docs/public-scene3d-contract.md).

## 0.31.0

Resource acquisition groups add whole-input preflight, bounded local waiters and shared cleanup. [Details](docs/resource-acquisition-groups.md).

## 0.30.0

A Canvas picking example demonstrates public hit testing, typed routes and post-dispatch visual feedback. [Details](docs/display-picking-example.md).

## 0.29.0

Logical hit testing defines explicit rectangle admission and display-tree picking. [Details](docs/display-hit-test-ht1.md).

## 0.28.0

The Canvas text path integrates raster images, replacement, generation and lifetime handling within its verified subset. [Details](docs/canvas-text-wc1-canvas.md).

## 0.27.2

Display-tree attachment avoids selected sibling rescans while preserving validation and cleanup order. [Details](docs/display-tree-scaling.md).

## 0.27.1

ByteReader adds owned scalar reads, explicit byte order, independent copy-out and an atomic cursor. [Details](docs/byte-reader-br1-contract.md).

## 0.27.0

The optional noneditable TextField connects prepared text images, resource leases and explicit replacement. [Details](docs/text-field-tf1-contract.md).

## 0.26.0

Scalar Tween adds Scope-owned transitions, selected easing functions and terminal cleanup. [Details](docs/scalar-tween-contract.md).

## 0.25.0

An explicit Engine clock separates game-time advancement from rendering and capture. [Details](docs/game-clock-contract.md).

## 0.24.0

Text raster orchestration adds exact requests, signed metrics, resource slots and explicit budgets. [Details](docs/text-raster-t1-contract.md).

## 0.23.0

Owned textured geometry and Mesh2D add immutable capture, preparation and an explicit WebGPU route. [Details](docs/textured-geometry-and-mesh2d-contract.md).

## 0.22.0

Receiver-local content bounds add immutable measurements and explicit traversal budgets. [Details](docs/display-content-bounds-contract.md).

## 0.21.0

Public local/global coordinate queries add immutable points and ancestor/lifetime bounds. [Details](docs/display-coordinate-query-contract.md).

## 0.20.0

SequencePlayer provides explicit-time atlas sampling and a public browser example. [Details](docs/sequence-player-contract.md).

## 0.19.0

Bitmap region admission/capture and the B1 browser verifier establish separate image and scene checks. [Details](docs/bitmap-region-contract.md).

## 0.18.0

CPU conversion of one named legacy MovieClip preserves crops, offsets and authored holds; complete migration is open. [Details](docs/legacy-movieclip-contract.md).

## 0.17.0

Internal CPU scene, mesh, sequence and RES-intent work expands the initial core without claiming production hosts. [Details](docs/3d-cpu-scene-contract.md).

## 0.16.0

Image-source projection, frame preparation, CPU blend references and 3D/RES analysis receive consolidated evidence. [Details](docs/core-framework-implementation-record.md).

## 0.13.0

Browser WebGPU rectangle execution establishes its fixed rendering and lifetime profile. [Details](docs/webgpu-rectangle-execution-contract.md).

## 0.12.0

Display transforms, inherited visibility/alpha, clipping and immutable frames reach the separate Canvas adapter. [Details](docs/display-and-frame-execution-contract.md).

## 0.11.0

Typed assets add shared acquisition, independent leases, cancellation and generation isolation. [Details](docs/resource-core-contract.md).

## 0.10.0

Bilingual readings, current identities, critical English comments and pre-push checks become a shared contribution policy. [Details](docs/bilingual-documentation-and-prepush-checks.md).

## 0.9.0

The repository combines independent core source and the knowledge base with public collaboration and source attribution. [Details](docs/open-source-collaboration-and-public-communication.md).

## 0.8.0

The first independent headless core implements contracts, runtime and engine responsibilities, lifecycle and typed events. [Details](docs/core-framework-implementation-record.md).

## 0.7.0

Engineering structure, modern API conventions and code-quality rules establish a shared implementation foundation. [Details](docs/engineering-architecture-and-project-structure.md).

## 0.6.2

Technical research adds shader-asset distribution and continued project-editing workflow considerations. [Details](docs/shaders-and-playground-lessons.md).

## 0.6.1

Independent implementation, explicit dependencies and research provenance receive separate rules. [Details](docs/independent-implementation-and-dependency-policy.md).

## 0.6.0

Backend, compilation and native-runtime options are analyzed as candidate designs. [Details](docs/graphics-backends-and-native-runtime-selection.md).

## 0.5.0

A fixed-version third-party asset experiment examines animation instances, text, resource release and context recovery.

## 0.4.0

Reference research defines source versions, licensing, integration roles and validation responsibilities. [Details](docs/open-source-research-and-validation-roles.md).

## 0.3.0

Event, resource, UI and mixed-graphics experiments refine identity, generations and recovery constraints.

## 0.2.0

The first white paper, requirements and engineering plan connect design assumptions to technical experiments.

## 0.1.0

The initial knowledge base organizes product scope, architectural candidates, delivery and community contribution.

## Historical verification records

Earlier results, failures, repairs and PENDING labels retain their original dates and source identities in the linked evidence and [versioned detailed notes](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/CHANGELOG.md). They are historical checkpoints, not a description of today's integration state. This concise Changelog records the main change in each version; detailed test counts are kept with the relevant experiment or subsystem.

Complete Spine support was added as R020/V020 on 2026-10-10; the import, mesh and manual Core experiments above do not complete that requirement. Automated legacy migration R008/V006 remains open.
