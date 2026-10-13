# Core engineering progress

English | [简体中文](../../Cns/docs/core-progress.md)

<!-- SS1-0.45.0-BEGIN -->
## Engineering preview 0.45.0 — Named SpriteSheet

**S098 / V049.** Named `createSpriteSheet` shares one full-image lease between immutable named crops, static icons and the existing Engine-clock sequence controller. Runtime/Engine roots add one factory and two erased types, `SpriteSheet` / `SpriteSheetFrameInput`; package version stays private `0.0.0` and host protocol `1.0`. No new dependency, public subpath or animation clock is added.

Saved public CPU passed 100/100, with retained CPU 133/133 counted separately. SS01–SS10 are specification families. SpriteSheet positive types produced 0 diagnostics; ordinary/import negatives contained 22/14, totaling 36 precise tuples and 6 continuation lines. Original-operation units passed 10/10; policy passed 5/5 including 4 assigned controls, and retained generic policy passed 272/272 separately. The recording example has 8 rows, 6 explicit ticks, 1 load and 1 disposal. Independently accepted Canvas/WebGPU observations completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, with bounded cleanup. Final publication gates, mandatory push hook and 0.45 PR/Main remain PENDING.

Recorded 0.44 delivery: PR #31 merged; Main `1dce76a62cd0a4180969949939041f889eb1d923`, tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`. Its hook separately passed 63 publication, 2794 core and 160 experimental tests; KB issues were 0. Remote status/check-run counts 0/0 do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.

The first-party Apache-2.0 increment establishes finite named-crop composition. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN; complete UI/EUI, packed atlas import, phone/native SDK and comparative performance remain future work.

[Contract](spritesheet-contract.md) / [Evidence](spritesheet-evidence.md). Native tool: `tools/spritesheet/README.md`.
<!-- SS1-0.45.0-END -->

<!-- SEQP-0.44.0-CORE-BEGIN -->
## Engineering preview 0.44.0 — Engine-clock sequence playback / 工程预览 0.44.0 — Engine 时钟驱动序列播放

**S097 / V048. Explicit Engine-clock sequence playback is accepted within the recorded finite lanes; full prepush, mandatory push hook and current PR/Main remain PENDING.** Use `engine.createSequencePlayback(scope, bitmap, clip, { mode: "once" })`, then `start()`; advance the Engine clock explicitly. The controller supports once/loop, pause, resume and stop, using genuine Scope ownership and the existing texture lease. It adds 3 erased root types and no root runtime value, dependency or public subpath. Rendering stays inert with respect to playback.

Saved public CPU tests passed 41/41; 25 source behavior families are a separate inventory. Positive diagnostics were 0; the two rejected-consumer lanes had 27/13 diagnostics and 40 exact tuples. Policy tests passed 5/5 with 4 assigned controls. The example records 5 rows, 1 atlas load and 1 disposal. The independently reviewed default desktop browser run completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, including cleanup.

[Contract](../docs/sequence-playback-contract.md) / [Evidence](../docs/sequence-playback-evidence.md) / Native verifier (`tools/sequence-playback/README.md`). This finite first-party increment does not close full Spine R020/V020 or migration R008/V006. Phone/native SDK, performance, physical display and third-party entitlement remain separate.

Recorded 0.43.0 delivery: [PR #30](https://github.com/cnedwin/Egret_rebuild/pull/30) merged; Main `ced3ef008b8c37868c6d1a505a02737451d937e1` and tree `c42eddecfa6737d12a3093ba0a4067aa9326d702` were read back. Its mandatory hook passed 63 publication, 2748 core and 160 experimental tests, counted separately. Zero remote statuses/check-runs do not establish remote CI PASS. Earlier Pending cutoffs remain historical.
<!-- SEQP-0.44.0-CORE-END -->

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](nine-slice-geometry-ns1-contract.md) / [evidence](nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Engineering preview 0.40.0 — owned ByteWriter

**S093 / V044. Finite CPU, type and assigned boundary results accepted; final publication gates and delivery remain PENDING.** ByteWriter supplies fixed-capacity strict binary appends, native IEEE floating conversion and independent snapshots of the committed prefix, reusing the original ByteOrder and Scope lifetime.

The build and 37/37 public/regression cases passed: 8 BW groups, 23 ByteReader cases and 6 Scope cases. Separately, 2/2 process-isolated fault test files passed. BW has 24 internal observations and 22 controlled fault hits; these are not extra test cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/16 diagnostics, with 57 exact located/code inventory entries. Strict-type gate and boundary guard exited 0; assigned boundary controls passed 17/17.

Retained complete boundary suite: PENDING_AT_SOURCE_CURATION. This is separate from the finite assigned controls and the pending final complete prepush.

Recorded 0.39.0 delivery successor: textured scene composition was merged through [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26), with Main `ac490f90b7467164e461112a9f572a3269107c02` and tree `c137666681de663360a9bc153d85e6e71f48bd42` read back locally and remotely. The mandatory push hook completed with exit code 0. Remote statuses and check runs were both zero; remote CI PASS is not claimed. Earlier pending cutoffs and the first failed prepush remain historical records.

Read the [contract](byte-writer-bw1-contract.md) and [evidence](byte-writer-bw1-evidence.md). This original first-party utility increment establishes no file format, legacy ByteArray compatibility, full Spine, migration, native SDK or device/performance acceptance. Historical failures, preparation cutoffs and open work remain visible.
<!-- BW1-DOC-0.40.0-END -->

<!-- CHOST-DOC-0.39.0-BEGIN -->
## 0.39.0 proposed — textured scene composition

**CPU scope accepted; native, full gates and publication pending. S092 / V043.** The explicit `createTexturedSceneWebGPUHost` draws an opaque RGB scene and a genuine Engine-captured textured overlay through one owner, two passes and one submission. Set `clearAlpha: 1` and use `renderSceneTexturedFrame`; existing factories and captured-frame lifetime remain unchanged.

Recorded actual results cover the build, combined tests **12/12**, retained scene/textured tests **48/48**, positive types with **0** diagnostics, complete negative inventories **8/16/15**, the boundary guard and four assigned boundary controls **4/4**. This documentation curation is **SOURCE_ONLY / NOT_RUN** and does not add product execution.

The **180-second** full boundary-suite attempt is **INCOMPLETE**. Mandatory full prepush and publication remain **PENDING**. New browser/GPU execution is **NOT_RUN at this preparation cutoff**; physical phones, performance and native SDK acceptance remain unclaimed. FullSpine **R020/V020** and migration **R008/V006** remain **OPEN**.

**Recorded 0.38.0 delivery successor:** public Matrix authoring was merged through [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25), with Main `893f1ca86af10a092066dcccdaaa16ac194efded` and tree `5960109ca14c9a53ba1cd7ba80d967e6451ad102` read back locally and remotely. This supersedes earlier pending delivery labels while preserving their historical cutoffs; it does not establish 0.39 delivery or remote CI PASS.

See the [textured scene contract](textured-scene-host-contract.md) and the [planned public verification record](../../evidence/textured-scene-host-verification.json). The record awaits final evidence curation.
**Actual browser successor:** the default headless Edge **155.0.4283.45** run completed **2** genuine frames. All **24** fixed pixels (**12** per frame) matched exact RGBA expectations; each **16384**-byte normalized buffer is preserved in the shared record. Applying the first overlap expectation to the second buffer rejected the changed UI order at **(34, 32)**, without another rendered frame. Host safe close, resource/Scope/lease/Engine cleanup, application device destruction and cooperative browser closure passed. This establishes the bounded composition only; OS process retirement, physical hardware, phones, performance, complete 3D and full Spine remain separate. Full prepush and GitHub delivery are PENDING at this successor cutoff.
<!-- CHOST-DOC-0.39.0-END -->

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 proposed — public Matrix4 authoring

**SOURCE_ONLY / NOT_RUN. S091 / V042** proposes typed matrix authoring in `@egret/engine/scene3d`: `createMatrix4`, `multiplyMatrix4` and the original `Math3DError` / `Math3DErrorCode` bindings. Editor and JSON source arrays can become owned tuples and compose transforms before existing scene capture. The proposal reuses Egret's independently authored matrix algorithm through thin public forwarders.

Implementation, actual RED/GREEN, public behavior/types, current full gates and delivery are **PENDING**. Clock **0.37.0** delivery is **PENDING at this preparation cutoff**; earlier recorded results and cutoffs are retained. Broader scene/rendering, performance, complete Spine and migration acceptance remain separate.

**Recorded delivery successor:** Clock **0.37.0** was merged through [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24), with Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` read back locally and remotely. This supersedes the earlier delivery checkpoint without rewriting it and establishes no Matrix acceptance or remote CI PASS.

See the [public scene contract](public-scene3d-contract.md) for the proposed API and authoring example.
**Actual 0.38.0 successor:** the old public SDK passed **17** retained cases and refused **4** new cases at the named missing-API assertion; its positive type consumer reported **4** missing exports. The newly built SDK passed **168/168** retained math, projection, scene and public cases, including **21/21** public cases. The positive consumer compiled; **11** intentional import negatives were bound to actual diagnostics, and exact boundary/strict-type gates passed with **0** unexpected failures. Original math algorithms remain unchanged. No new GPU, device or performance acceptance is claimed. Independent source/bilingual review, the full repository gate and delivery remain PENDING at this successor cutoff. See [the shared verification record](../../evidence/public-matrix-authoring-verification.json).
<!-- MATRIX4-DOC-0.38.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Read [Clock guide](../experiments/spine-f1/README.md), [saved verification](../../evidence/spine-f1-clock-verification.json) and [pending public projection](../../evidence/spine-f1-clock-public-projection.json).
A subsequent actual replay of the public source in an independent clone passed manual **12/12** with **6** original controls and full Clock **10/10** with **3** assigned controls; the named fault actually executed, with **0** skipped accepted cases. Separate default-headless WebGPU execution passed **10+1** readbacks, **30** positive samples and **120** channels at tolerance **0**, retaining original full-byte relations and bounded cleanup. Cold import/help observed **280** modules and **0** Core/GPU/host accesses. The saved CPU collection retains its earlier native-pending cutoff; the separate native receipt is the actual successor. Original source and input identities remained unchanged. Independent saved-result review, final repository gates and delivery remain PENDING here; full Spine **R020/V020 remains OPEN**. See the current successor in the linked Clock verification/projection records.
<!-- F1C-DOC-0.37.0-END -->

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](../experiments/spine-f1/README.md), [verification](../../evidence/spine-f1-manual-verification.json) and [projection provenance](../../evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

<!-- SPH-DOC-0.35.0-BEGIN -->
## Engineering preview 0.35.0 — Scope ownership repair

Four internal Scope members now use JavaScript private storage/dispatch. Explicit same-name properties cannot bypass registration, replace owned cleanup values or cancellation, or retain closed Scopes in shutdown tracking. Public API and error/cleanup order remain intact. See the [contract and evidence](scope-private-ownership.md).

Original baseline passed; the unchanged six-test suite produced 1 pass / 5 assigned failures. After repair: **6/6** new and **183/183** retained lifecycle tests, build, strict types and boundaries passed. Independent implementation review has zero open findings. Final full publication checks and **0.35.0** delivery are **PENDING** at this cutoff.

The preceding **0.34.0** was delivered through [PR #21](https://github.com/cnedwin/Egret_rebuild/pull/21), Main `74ca6c3293167d8d3eb253074c0596bd1922db21`, tree `94e6a96f17b656cb8cd28cd65a75f48575cb0c38`. Its mandatory push gate passed **2672/2672** core and **63/63** publication tests, checking **147** document pairs and **177** critical comment records. GitHub returned **0** statuses and **0** check runs; no remote CI PASS is claimed. Earlier pending cutoffs remain history.

This covers four explicit named shadows; it makes no claim about all internals, arbitrary public overrides, security isolation, GC or device performance. The next Spine step connects original manual animation fixtures to owned Mesh2D frames; full Spine, UI, 3D, platform, AI workflow and legacy migration acceptance remain in the engineering plan.
<!-- SPH-DOC-0.35.0-END -->

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Engineering preview 0.34.0 — Spine import planning

The optional built `@egret/project/spine` entry provides `createSpineImportPlan` and frozen `SPINE_IMPORT_LIMITS`. It prepares an immutable bounded plan from stable 4.3 skeleton JSON, a modern atlas and explicit page-to-asset bindings. Precise diagnostics identify original source locations. Read the [contract](spine-import-plan-contract.md) and [verification record](../../evidence/spine-import-plan-verification.json). Successful planning keeps animation semantics and rendering **not_run**, entitlement **unverified** and feature inventory **partial**.

<!-- SP1A-READING-ACTUAL-BEGIN -->
Current build and production boundary scan passed (465 files). Public planning behavior passed **32/32**; TypeScript **7.0.2** passed one DOM-free positive and **22 + 6** exact unsuppressed negative diagnostics. Focused policy passed **9/9**, and **5** separate owned-copy controls each passed a genuine baseline before failing its assigned mutant witness. Independent finite implementation review has zero open findings. Initial **30/32** exposed a test-helper source-ID assumption; the retained production boundary refusal exposed message wording and exact forwarding punctuation. Narrow repairs preserve the API and guard rules. Final complete publication checks, the mandatory push hook and **0.34.0** remote delivery remain **PENDING** at this cutoff.
<!-- SP1A-READING-ACTUAL-END -->

The preceding **0.33.0** package was delivered through [PR #20](https://github.com/cnedwin/Egret_rebuild/pull/20), merged to Main `4ae7e71ee72e5f2c46e7dbccd28b27f482294a0c`, tree `f340e46f0d88783b268b732dcacbfcf7c45a363a`. Its complete mandatory push gate passed **2,631/2,631** core and **63/63** publication tests, **145** document pairs and **174** critical comment records. Local/remote Main identity and a clean checkout were verified at **2026-10-11 23:31:37 UTC**. GitHub returned zero statuses and check runs; no remote CI PASS is claimed. Earlier pending cutoffs below remain historical.

Full Spine **R020/V020** remains open. A separately prepared official core artifact and original animation fixture recipe establish research inputs, not executed playback, redistribution rights or product acceptance. Next work connects per-instance animation state and owned mesh frames to the genuine clock, asset leases and renderers. Complete UI, target phones/SDKs, performance, editor/Agent workflows and legacy migration remain in the engineering plan.
<!-- SP1A-DOC-0.34.0-END -->

<!-- MI1-DOC-0.33.0-BEGIN -->
## Current engineering preview: 0.33.0 (MI1)

Development preview **0.33.0 (MI1)** introduces Scope-owned primary mouse input through the optional `@egret/engine/web/input` entry. It connects existing logical hit testing and typed display events while rendering remains explicit. Read the [primary mouse contract](primary-mouse-input-contract.md) and designated [verification record](../../evidence/primary-mouse-input-verification.json) for the exact profile, ownership, failure handling and gate scopes.

At the documentation cutoff **2026-10-11 22:52:43 UTC**, the final Engine build and genuine public interface check passed. Public MI1 behavior/lifecycle passed **98/98**. TypeScript **7.0.2** passed one public positive and matched **26 + 15 + 5** exact unsuppressed negative diagnostics; the public type gate exited **0**. Focused MI1 policy passed **21/21** after correcting one expected diagnostic to retain the existing guard order. Public cancellation **8/8** and earlier retained CPU checks keep their separately recorded scopes. These overlapping checks are not added.

Default headless Edge **154.0.4258.62** with Playwright **1.62.1** passed the fixed desktop Canvas mouse subset: **1** genuine native baseline and **6** assigned controls cover literal events, logical points, RGBA witnesses and observed physical listener cleanup. The ordinary HTTP example passed, and collector policy/grammar units passed **13/13**. All **7** retained desktop gates—Canvas, WebGPU, B1, textured rendering, sequence animation, Canvas text and picking—passed their existing bounded profiles. This establishes neither phones, arbitrary UI/3D, OS reclamation nor a performance lead.

**The complete 259-case boundary rerun, final publication/bilingual checks, mandatory pre-push gate and current 0.33.0 remote delivery remain PENDING.** The earlier timeout and full **258/259** result retain their original artifacts; the latter exposed one expected-message mismatch. Focused **21/21** is its finite successor, not a complete rerun. Other earlier failures retain their recorded identities and cutoffs in the verification record.

The delivered baseline **0.32.0 (S3D1)** was merged through [PR #19](https://github.com/cnedwin/Egret_rebuild/pull/19) to Main `a240bc1e6ee218c63fc1511d715d01d1358d908f`. Earlier scene/preview sections retain their original sources, results and pending/failure cutoffs as history; their earlier pending labels do not undo this delivery.

Full Spine support **R020/V020** remains planned, implementation **not_started**, acceptance **not_run**. Complete UI, touch/pen, phones, Native SDKs, target-device performance, editor/Agent tools and complete legacy migration retain their separate implementation and acceptance obligations.
<!-- MI1-DOC-0.33.0-END -->

<!-- S3D1-DOC-0.32.0-BEGIN -->
## Current bounded checkpoint: 0.32.0 (S3D1)

Verified implementation: public behavior **35/35**, boundaries **238/238**, **2** positive type consumers and **10 + 3 + 11 + 15** exact negative diagnostics pass. Retained integration checks **161/161** and fresh fixed headless Edge composition pass after independently reviewed repairs. Full final publication and current delivery remain pending at this curation cutoff; the linked scene contract records exact scopes and successors.

**Initial source/API observation (historical cutoff):**

The [public scene contract](public-scene3d-contract.md) is the current entry for experimental owned mesh/scene frames and their explicit browser Host. Independently designed interfaces directly reuse current first-party algorithms. Three-file adoption, build and interface GREEN at **2026-10-11 19:54:25–19:54:26 UTC** confirm source/API reachability only. Behavior, types, policy, native and final acceptance/delivery are **PENDING**. Complete UI/3D, characters, Spine, Native SDKs and performance remain roadmap obligations beyond this bounded frame route.

The delivered **0.31.0** successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. Older sections below are historical readings at their saved cutoffs. Their factual text/results are retained; earlier pending labels do not describe this new public-interface cutoff.
<!-- S3D1-DOC-0.32.0-END -->

## Historical reading: engineering preview 0.27.0

The 0.27.0 engineering preview adds a factory-owned, noneditable TextField through `@egret/engine/text`: `createTextField(engine, scope, cache)` and type-only `TextField`/`TextFieldStatus`. Ten-scalar requests, explicit preparation, revision replacement and coalesced caller leases follow genuine Engine/Scope/cache affinity. Committed images and blank direct bounds participate in both image-capable collectors under existing budgets; legacy image refusal is preserved. Default roots remain unchanged. Read the [contract](text-field-tf1-contract.md) and [evidence](text-field-tf1-evidence.md).

Complete existing prototype verification passed 2,157/2,157 and its current production boundary scan covered 411 files. The focused public result is 16/16 (13 main top-level, two nested and one constructor test); strict types cover 18 ordinary, four supplemental and 12 dedicated-file import diagnostic locations, with one compiler invocation for the import file. Copied-source controls passed 27/27, including existing T1 controls; affected regressions passed 83/83 and private collector units 20/20. These scopes overlap and are not added. Earlier failures and source/emission cutoffs remain in the evidence.

Workspace packages remain private 0.0.0 and protocol 1.0. Current five existing native regression gates, final mandatory prepush and remote delivery remain PENDING at this curation cutoff. Those native gates do not constitute a native TextField supplement. Complete UI, editing, automatic wrapping, browser fonts/native TextField, CJK, phones, Native SDKs, performance, 3D, Spine and complete migration remain open.

## Historical engineering preview: 0.26.0

The [scalar Tween contract](scalar-tween-contract.md) adds `engine.createTween(scope, options)` with four type-only root names, built-in linear/quadratic easing and one-shot controls. Synchronous undefined-only writer/completion callbacks, authentic Scope ownership and terminal cleanup govern borrowed application targets. The prior [0.25.0 game clock](game-clock-contract.md) drives explicit seconds; advancement never renders and capture/render never advances time. Read the [bounded evidence](scalar-tween-evidence.md) for separate source/fixture scopes. Complete core verification passed in its recorded source/fixture scope; final publication and delivery remain separate gates; this checkpoint does not establish chains/property arbitration, complete legacy Tween/Spine or production performance. Packages remain private 0.0.0 and protocol 1.0.

## Historical engineering preview: 0.22.0

The [content-bounds contract](display-content-bounds-contract.md) defines receiver-local measurement of authoritative Graphics and cached Bitmap content. Descendant direct corners, ordinary binary64 nonconservative subtraction, authored-zero count/skip behavior and explicit budgets retain the exact contract boundary. Read the [evidence](display-content-bounds-evidence.md) for actual baseline, passing successors, strict gates, retained corrections and exact source/build/review identities; their suites overlap.

Fresh affected desktop evidence retains its own fixture and source scope. Bounds arithmetic is not executed on the GPU; B1 OS descendant retirement is UNBOUND. Other coordinate spaces, output adapters, layout/input/hit testing, phones/performance, full UI/3D/Spine, production hosts, editor/Agent and complete migration remain pending. Final prepush and actual stacked delivery are separate gates; packages stay private 0.0.0 and protocol 1.0.

## Historical engineering preview: 0.21.0

The public [display coordinate contract](display-coordinate-query-contract.md) adds inherited logical `localToGlobal`/`globalToLocal` queries, fresh immutable results and bounded ancestor/lifetime authority. The recorded baseline had 49 missing-method failures; the strengthened focused successor passed 92/92, the type gate passed 68/5/28 expected negative diagnostics, and the separately recorded core verifier passed 1045/1045 with 300 boundary files. These suites overlap. Read the [evidence](display-coordinate-query-evidence.md) for retained fixture repairs and exact source identities.

Fresh affected desktop Canvas/WebGPU rectangles and selected B1 browser gates passed within their fixture scope. B1 API cleanup is cooperative; OS descendant retirement is UNBOUND. Complete UI/3D/Spine, production hosts, phones/performance, editor/Agent and full migration remain open. Final public-material review, complete prepush and remote delivery are separate gates; packages remain private 0.0.0 and protocol pins 1.0.

## Historical engineering preview: 0.20.0

The public [explicit-time SequencePlayer](sequence-player-contract.md) connects admitted atlas metadata to a borrowed Bitmap through the root API, with once/loop selection, immutable samples, backward seeks and explicit disposal. The browser example (`examples/sequence-player/README.md`) and opaque verifier (`tools/sequence-player/README.md`) use public entries. Read the contract acceptance section and its compact record for the exact executed source and scope.

Fourteen focused behavior checks passed. The type gate passed 54 root, 5 web and 28 project expected negative diagnostics; the affected B1 source-admission driver passed 13 cases after a narrowly selected delimiter repair. Full prepush is a separate publication gate. The prerequisite [Bitmap native observation](bitmap-region-evidence.md) remains distinct from the new public player observation.

The [Spine specification](spine-animation-support-and-acceptance.md) remains a confirmed requirement, with implementation and acceptance pending. Full A2/alpha calibration, production hosts, fonts/UI/skeletons, target-device performance, editor/Agent and complete R008/V006 migration remain open. Packages stay private at 0.0.0, protocol pins at 1.0; 0.20.0 is an engineering checkpoint.

The sections below retain historical checkpoint results and delivery statuses, including the earlier 403 response. They do not report current publication status or new test execution.

## Historical local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](legacy-movieclip-contract.md), [evidence](legacy-movieclip-evidence.md) and [compact record](../../evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](3d-cpu-scene-contract.md), [mesh](3d-webgpu-mesh-contract.md), [Host](b1-host-contract.md), [sequence](sequence-clip-contract.md) and [RES intents](legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical 0.16.0 overview

The local 0.16.0 engineering preview continues the product direction of complex 2D UI and lightweight 3D. This increment covers bounded image-execution source/mock logic, CPU math and mesh data for 3D, and legacy RES declaration analysis. Packages remain 0.0.0 and protocol pins remain 1.0. The label does not constitute a complete engine release; final publication checks, GitHub submission and delivery status are recorded separately.

## Implemented scope and boundaries

| Scope | Implemented bounded contract | Still requires verification |
| --- | --- | --- |
| A2 Task 1 | Owned CPU source-pixel projections with separate premultiplied and straight representations | Browser upload/sampling precision |
| A2 Task 2 | Mixed rectangle/image preparation and image pass descriptors preserving painter order | Real WebGPU execution and pixels |
| A2 Task 3/C1 | Bounded image-vertex packing, in-flight work and cleanup/error-origin source/mock checks | GPU completion, device interoperability and performance |
| A2 Task 4 | Canvas image-source preparation, frame copying and original-source error classification correction | Actual Canvas image pixels and browser comparison |
| A2 Task 5a | CPU upload/blend reference formulas and explicit per-channel error-bound checks | Task 5b browser calibration, Task 6 confirmation and P0–P7 |
| B0/B1 | binary64 math, owned CPU meshes and exact float32 packing | GPU scenes, materials, skinning and animation |
| RES declarations | Strict JSON declaration checks and frozen reports | Files, decoding, execution and complete R008/V006 migration |

Images enter frame preparation through immutable CPU image identities and cropped views. Admission, projection, packing, execution and retirement each enforce their own boundary; an asset lease or source-level pass descriptor does not establish GPU completion. Error classification uses internally registered origins, rather than caller-constructed error classes or codes. Closing and safe return still follow the host lifetime contract; budgets are deterministic work/byte admission bounds, not heap measurements or promises of real OOM recovery.

Canvas remains in the explicit web entry and WebGPU in the opt-in entry. The engine root remains DOM-free and importing it does not start a host. Internal math, mesh, packing and RES helpers add no public facade; deep imports are unsupported as stable product APIs.

## CPU reference formulas

Task 5a's tool identity is tools/texture-oracle.mjs. expectedUploadRGBA selects floor((C*A+127)/255) for integer straight channels. expectedEncodedOver computes continuous binary64 source-over in the premultiplied encoded domain with explicit opacity. It applies neither UNORM quantization nor color transfer conversion. assertTexturePixel takes four explicit absolute channel bounds from the caller and compares only after admitting every argument. It provides no default, unknown or result-fitted tolerance. These tools neither consume/authenticate browser profiles nor prove native blend precision. Independent rational fixtures and actual device calibration retain their separate authority.

## Historical engineering evidence

The table records saved outcomes on each accepted source identity. This documentation work reran no product tests; full totals include the regression set at that checkpoint and cannot be added into a new pass count. Exact historical commits/trees, acceptance-record identities and named current source hashes are in the [curated evidence summary](../../evidence/core-progress-0.16.0.json).

| Scope | Focused passes | Full passes | Preserved correction and scope |
| --- | ---: | ---: | --- |
| A2 Task 1 | 10 | — | The 10 checks belong to the original projection; Task 4 superseded that source |
| A2 Task 2 | 42 | — | 11 new checks and 31 regressions, CPU/mock scope |
| A2 Task 3/C1 | 124 | 515 | Original failed review retained; accepted after allocation-origin correction; Task 4 later superseded the host |
| A2 Task 4 | 193 | 610 | Earlier 193 checks had 182 passes and 11 failures; the origin-classification successor passed |
| A2 Task 5a | 31 | 825 | All 31 behavioral RED checks failed; final 31/825 passed, CPU formulas/bounds only |

Historical 0.13.0 desktop WebGPU rectangle records retain their results and do not validate A2 images, 3D, fonts, animation, phones or Native SDKs. Source hashes establish byte identities; source/mock tests, browser pixels, device performance and complete product acceptance require distinct evidence.

## Next work and contributions

Next steps separately verify actual browser-image behavior in A2 Task 5b/Task 6 and P0–P7, and actual device execution of the source/mock-verified B1 Host. Chinese fonts, complex-UI device budgets, skeleton/frame animation, Native SDKs, mini-game platforms and performance still need their own experiments. Agent/editor V003, complete migration R008/V006 and full V002 renderer/runtime acceptance remain open.

Community contributions can target declared inputs, ownership, error origins and counterexamples, using fixed primary sources to support design proposals. Implementations follow first-party contracts; public dependencies retain attribution and licenses. Complete legacy conversion still requires version/module inventory, behavior/visual comparison, Agent repair/rollback, actual target publication and continued editing.

[3D CPU foundation](3d-foundation.md) · [Legacy RES declarations](legacy-res-declarations.md) · [Contribution guide](../CONTRIBUTING.md) · [Knowledge base](../README.md)
