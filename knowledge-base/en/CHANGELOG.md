# Changelog

English | [简体中文](../Cns/CHANGELOG.md)

<!-- ADI-0.51.0-DRAFT-BEGIN -->
## Engineering preview 0.51.0 — indexed child insertion · Source draft

**S105 / V056 · 2026-10-14.** `DisplayObjectContainer.addChildAt<T extends DisplayObject>(child: T, index: number): T` places an exact object at a layer in one operation. Integer [0,n] includes -0 and append at n. Same-parent index is the final position; n aliases the last position. Current-source reparent preserves other siblings, the subtree and cleanup owners. Sprite/Stage inherit the member; Stage cannot become a child.

**R3 current Source draft · accepted code successor, 2026-10-14.** The independently reviewed complete run finished at 14:05:03 UTC: all 9 code phases completed, Core 3113/3113 and Spine source checks 160/160, with zero failures, cancellations or skips. Original standalone strict consumers and the complete types phase retain ADI 0/10, CGI 0/12 and DCA 0/10 complete unsuppressed diagnostic vectors. The accepted Actual review is 262199 bytes / 5b4516bd58e875d25559b8426f4ed8ee6e9d7268afd3f40c55680f070d1863df. This accepts current local code verification only; full Spine product R020/V020 stays OPEN.

The authenticated current union contains 25 distinct adopted Source files, including reviewed native support and retained readers. Current product identities bind 3 Source files and 6 JS/DTS outputs; the repaired 2 Source files and 2 JS emissions replace their earlier identities, while all 3 declarations retain their earlier accepted bytes. **R3 Native successor · 2026-10-14.** The independently accepted desktop opaque Canvas/WebGPU run finished at 14:35:58 UTC. Main execution completed 10 submissions and 10 full raw RGBA readbacks, covering 5760 pixels and 23040 channels at tolerance 0 with no mismatches. There were 8 new captures and 2 saved replays. N5 reused the exact saved N1 frame on the same live Engine while the current N4 tree remained mutated. The fresh Canvas C1 control used 2 additional submissions and 2 readbacks, with main credit 0; its deliberate wrong index produced the expected 64 mismatched pixels and 128 mismatched channels. The accepted Native review is 59975 bytes / 334c304b4ad1f2b66e6beddb8f40f89b8b08b11d7b9cd0d5e41b95c5a057c370. Saved evidence contains raw RGBA files; no PNG files were saved. Scope/Engine/host/context/browser/server retirement completed safely, with no primary or cleanup error and no pending tickets. The collector recorded stability for 175 admitted runtime pins; the reviewer separately authenticated the current 175 pins. That later observation does not invent per-file retrospective before/after arrays. Public/source/bilingual review, normal full prepush, mandatory hooks and new 0.51 Git delivery remain PENDING. Physical GPU identity, fonts, phones, performance and complete Spine remain unverified or OPEN; remote CI PASS is not claimed. Read the [contract](docs/container-add-child-at-contract.md), [evidence](docs/container-add-child-at-evidence.md) and [remaining plan](docs/container-add-child-at-implementation-plan.md).

Dated 2026-10-14 preceding-delivery successor: [PR #38](https://github.com/cnedwin/Egret_rebuild/pull/38) delivered bounded 0.50.0 to Main `13200c72dd51d35d12e84c6d1c81dfeaef94af53`, tree `c6f1a791f649c96606fb5e2a1b2a096c2a3f027b`. Original 0.50 public-PENDING cutoffs remain history; the later Root DATA pointer projection adds no independent review or remote CI PASS.

Full Spine R020/V020, migration R008/V006, complete EUI/layout, advanced 3D, AI and phones/platforms/performance remain OPEN or unverified. First-party source follows Egret specifications and familiar APIs, with English critical comments and attributed AI assistance. Packages remain private 0.0.0, protocol 1.0 and dependencies/notices unchanged.
<!-- ADI-0.51.0-DRAFT-END -->

<!-- CGI-0.50.0-BEGIN -->
## Engineering preview 0.50.0 — query a direct child’s current index

**S104 / V055.** DisplayObjectContainer.getChildIndex(child: DisplayObject): number is a read-only query of the exact current direct child. It scans the authoritative private order in O(n), with no list snapshot/cache, tree mutation, owner transfer, resource operation or display callback. Sprite/Stage inherit it; root values/types, subpaths, dependencies and protocol are unchanged.

Independent acceptance covers the two-file product/four JS-DTS emissions, build exit 0, focused CPU 128/128 (six new and 122 retained) and two overlapping original strict lanes with 0/12 diagnostics and twelve complete unsuppressed tuples. Genuine old operations/cleanup preceded the named missing-member RED. The earlier old-build 122-pass/6-fail attempt remains historical and is not a product defect. Native source is accepted. All nine current code phases later completed successfully (Core 3091/3091 and retained Spine Source checks 160/160), including current strict CGI 0/12 and retained DCA 0/10; independent saved-result review has accepted this scope. Native Canvas/WebGPU is separately accepted: two cases, six full 24×24 readbacks/four captures/two same-live-Engine replays, 13824 channels at zero tolerance. Public Source/bilingual review and prepush/hook/delivery remain pending.

Read the [contract](docs/container-child-index-contract.md), [evidence](docs/container-child-index-evidence.md) / [implementation plan](docs/container-child-index-implementation-plan.md).

Dated 2026-10-14 successor: [PR #37](https://github.com/cnedwin/Egret_rebuild/pull/37) delivered bounded 0.49.0 batch detachment to Main `01e8e8063c2f2234b66486beba8bc9529f1f77b0`, tree `3585d370cc637edde2a94856909daa6bc74960d4`, from feature `c95bde158a0ec941ff9e494da5b1567465ff2d8b`. Original 0.49 curation PENDING cutoffs/failures remain historical; zero remote statuses/check runs with combined pending are not CI PASS.

Full Spine R020/V020, migration R008/V006, EUI/layout, advanced 3D, AI interfaces and phone/platform/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.
<!-- CGI-0.50.0-END -->

<!-- DCA-0.49.0-BEGIN -->
## Engineering preview 0.49.0 — detach all direct display children

**S103 / V054.** `DisplayObjectContainer.removeChildren(): void` clears a display layer while keeping its nodes, descendants, resources and cleanup owners alive. It authenticates the genuine receiver, checks Engine before receiver lifetime even when empty, preflights every direct edge and commits without caller hooks. Sprite and Stage inherit the method; root values/types, profiles, dependencies and protocol remain unchanged.

Independent acceptance covers 122 focused CPU tests (one API, five behavior and 116 retained) and two parallel original strict lanes: zero positive diagnostics and ten complete actual unsuppressed negative tuples. Genuine old behavior and cleanup preceded the named missing-member RED. The new strict driver and all nine current default code/policy gates are independently accepted: Core 3085/3085 and retained F2 Source checks 160/160. Native R1 failed in its fixture before submission; independent review separately accepted R2 Canvas/WebGPU execution: six full 24×24 readbacks, four captures/two same-live-Engine replays, 13824 channels at zero tolerance. Publication remains pending. Source cleanup repair does not establish executed cleanup faults.

Read the [contract](docs/container-remove-children-contract.md), [evidence](docs/container-remove-children-evidence.md) / [native schedule](docs/container-remove-children-native-verifier.md).

Dated 2026-10-14 successor: [PR #36](https://github.com/cnedwin/Egret_rebuild/pull/36) delivered bounded 0.48.0 NineSliceBitmap to Main `cca65d0322807e53bfa3f7cc7fbcf8d903dcbc59`, tree `bc5c205ee988aa6aa4245391068a6ee73120594e`, from feature `f1f4bcbe5b12171f5077e66775d8bd1a9b771b44`. Original 0.48 curation PENDING cutoffs remain historical. Remote statuses/check runs 0/0 and combined pending do not establish CI PASS.

Full Spine R020/V020, migration R008/V006, complete UI/layout, advanced 3D and target-device/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.
<!-- DCA-0.49.0-END -->

<!-- NLB-0.48.0-BEGIN -->
## Engineering preview 0.48.0 — NineSliceBitmap fixed-border backgrounds

**S102 / V053.** `NineSliceBitmap` derives source dimensions from a genuine Texture crop, borrows the caller’s lease and resizes a fixed-border background in one operation while retaining old frames. Runtime/Engine roots add one class value and one erased options type, reusing independent NS1 geometry and existing textured rendering; no third-party dependency is added.

Independent focused CPU acceptance is 71/71 (fourteen NLB, one independent TXI and fifty-six retained regressions); three strict lanes produced 0/17/8 diagnostics, twenty-five complete actual unsuppressed tuples. The recording example has two sizes/two frames, one load/disposal and zero timers; it is not native pixel verification. Four original source refusals and two genuine RED observations remain; the Engine-closing counterexample stays source-only.

Independent review dated 2026-10-14 accepted all nine code-verification phases, ordinary tests 3079/3079 and retained F2 source tests 160/160. One real WebGPU main case completed three 24×24 readbacks, two captures and one replay after origin retirement: 6912 channels passed at zero tolerance. Two Canvas refusals had zero positive Canvas submissions; adapter identity was unobserved. Curated public-content gates, bilingual review and 0.48 push/PR/Main remain pending. Full EUI/layout, Spine R020/V020 and migration R008/V006 remain OPEN; packages stay private 0.0.0, host protocol 1.0.

Read the [contract](docs/nine-slice-bitmap-contract.md), [evidence](docs/nine-slice-bitmap-evidence.md) and [native verifier guide](docs/nine-slice-bitmap-native-verifier.md).

Dated 2026-10-14 delivery successor: [PR #35](https://github.com/cnedwin/Egret_rebuild/pull/35) merged the bounded 0.47.0 Spine manual bridge into Main `5ae877705d76a470ec942a29cfe0212f069da6fb`, tree `60d224ec1ed6bc0824cd2f93871595809d3c21d5`, from feature `29e6f97d1d594efe3a49f9c530b1728a4756fe2c`. This is separate from new NineSlice baseline admission; old PENDING cutoffs remain. Remote statuses/check runs 0/0 with combined pending do not establish CI PASS.
<!-- NLB-0.48.0-END -->

<!-- F2C-0.47.0-BEGIN -->
## Engineering preview 0.47.0 — Spine Core manual mesh bridge

**R004 / R012 / R015 / R016 / R019 / R020 / R021 · S101 / V052.** The optional F2-C experiment connects genuine Egret resources/display ownership to external official Core 4.3.13 for bounded unweighted-mesh manual absolute translate/deform sampling, two resident instances and owned immutable geometry. Default SDK entries gain no Core dependency or export. Independent acceptance covers ten main CPU cases, four separate resource transactions, fourteen type lanes (twenty-five actual unsuppressed diagnostic tuples) and one G1 callback observer with separate ordinary before/after baselines. The post-implementation ordinary default suite passed 3064/3064. Counts stay separate; the numerical bound covers only the original five-point fixture.

Controlled copied-source execution is independently accepted: ten separate complete original baselines, two discriminating mutants and three fault units, with five successful restorations. These repetitions do not increase unique main-case, type-lane or diagnostic-tuple counts.

Fixed policy/cold/help observations are separately accepted: eight default roots, 145 reachable keys, 1416 literal relations and seven fresh children. Negative filesystem/DOM/scheduler observations cover selected operations; they do not prove universal absence.

Independent native R2 review accepted one F2C11 default-Edge WebGPU case: seven submissions / seven 64 × 48 readbacks at DPR 1, five literal pixels / twenty channels and two complete repeat/backward frames / 24576 channels matched at tolerance zero. Canvas refused separately with zero submissions; cleanup passed. The opaque fixture does not qualify alternate alpha modes, adapter identity was not recorded, and these are not device-performance results.

At the 2026-10-14 curation cutoff, complete current publication/push gates and 0.47.0 PR/Main remain pending. Full Spine R020/V020 and migration R008/V006 remain OPEN; Clock/mixing, weighted meshes, phone/platform performance and entitlement are outside this acceptance. The external SDK is not bundled: entitlement unknown, distribution clearance unverified; packages remain private 0.0.0 and host protocol 1.0.

Read the [contract and guide](docs/spine-core-manual-bridge.md) and [verification/open work](docs/spine-core-manual-bridge-evidence.md).

Previous 0.46.0 delivery merged through [PR #34](https://github.com/cnedwin/Egret_rebuild/pull/34) at 2026-10-13T18:18:51Z: Main `562543ea10d9a6b8124561a7027811f3f7dede4c`, tree `ff54205b5e4ba83bfbb75867226e1cbca0e27a32`. Separate local/mandatory-hook suites passed 137/137 publication, 3064/3064 core and 160/160 experimental tests; 1486 committed raw blobs had zero issues. Remote statuses/check runs 0/0 with combined pending do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.
<!-- F2C-0.47.0-END -->

<!-- BIP1-0.46.0-BEGIN -->
## Engineering preview 0.46.0 — Optional browser PNG textures

**R004 / R012 / R015 / R016 / R019 / R021 · S100 / V051.** The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. Complete current repository/prepush gates, this increment's push/PR/Main and remote CI acceptance remain PENDING.

Support is bounded to 8-bit RGB/RGBA noninterlaced still PNG, with browser-normalized straight sRGB RGBA8 output. This is not lossless decoding of every PNG: Canvas may lose hidden RGB and translucent precision. The adapter preserves existing engine.assets lease, Texture, SpriteSheet, Bitmap and clock ownership. Application shutdown retires Engine/manager demand and separately awaits provider.close(). Default core entries remain DOM-free; the sole optional factory and four erased interfaces add no runtime dependency. Four occupied jobs, 8 MiB per input and 32 MiB occupied encoded-byte budget remain the explicit limits. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN.

Read the [contract](docs/browser-png-contract.md) · [implementation plan](docs/browser-png-implementation-plan.md) · [native schedule and CLI](docs/browser-png-native-plan.md) · [evidence and retained repairs](docs/browser-png-evidence.md).

Previous completed delivery: [PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) merged 0.45.1 into Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`, tree `56e49e879d93fae351c948375e0ec12f21c739ab`. Its separate mandatory-hook suites passed 137/137 publication, 2,909/2,909 core and 160/160 experimental tests; knowledge-base issues were 0. This successor does not rewrite earlier PENDING cutoffs or claim remote CI acceptance.
<!-- BIP1-0.46.0-END -->

<!-- HYGIENE-0.45.1-BEGIN -->
## Engineering preview 0.45.1 — Repository path and byte hygiene

**R016 / R019 / R021 · S099 / V050.** Repository tooling now separates complete, case-preserving logical paths from platform-aware physical path comparisons and keeps every file fingerprint bound to raw bytes. The focused independent review accepted 111/111 regressions, the build and separate strict SpriteSheet/Sequence diagnostics. The actual pre-fix case-alias RED (0 passed / 2 assigned failures) remains preserved.

Separate real Node/PowerShell writer execution passed 3/3 with independent acceptance. Saved isolated Git fixtures passed 12/12; a separate related collection passed 123/123, including 9 knowledge-base cases. Those overlapping runs are not added together, and independent Gate saved-result review accepted the finite data as **PASS_ACTUAL_REPOSITORY_HYGIENE_DATA**. Complete local publication gates, committed-snapshot qualification, the mandatory push hook and current PR/Main delivery remain **PENDING at this curation cutoff**. Packages stay private `0.0.0`, host protocol `1.0`; full Spine **R020/V020** and legacy migration **R008/V006** remain **OPEN**.

Previous actual delivery: [PR #32](https://github.com/cnedwin/Egret_rebuild/pull/32) merged 0.45.0 into Main `863b29c90b92b62e37ce77cf32e02c4294135a16`, tree `1c7b706163ab58e41916bdaa8a6d45f74743a4f9`. Its mandatory hook passed 63 publication, 2,909 core and 160 experimental tests as separate suites; knowledge-base issues were 0. Remote CI PASS is not claimed. Earlier PENDING sections retain their original cutoffs.

[Policy](docs/repository-identity-and-line-endings.md) / [Evidence](docs/repository-hygiene-evidence.md).
<!-- HYGIENE-0.45.1-END -->

<!-- SS1-0.45.0-BEGIN -->
## Engineering preview 0.45.0 — Named SpriteSheet

**S098 / V049.** Named `createSpriteSheet` shares one full-image lease between immutable named crops, static icons and the existing Engine-clock sequence controller. Runtime/Engine roots add one factory and two erased types, `SpriteSheet` / `SpriteSheetFrameInput`; package version stays private `0.0.0` and host protocol `1.0`. No new dependency, public subpath or animation clock is added.

Saved public CPU passed 100/100, with retained CPU 133/133 counted separately. SS01–SS10 are specification families. SpriteSheet positive types produced 0 diagnostics; ordinary/import negatives contained 22/14, totaling 36 precise tuples and 6 continuation lines. Original-operation units passed 10/10; policy passed 5/5 including 4 assigned controls, and retained generic policy passed 272/272 separately. The recording example has 8 rows, 6 explicit ticks, 1 load and 1 disposal. Independently accepted Canvas/WebGPU observations completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, with bounded cleanup. Final publication gates, mandatory push hook and 0.45 PR/Main remain PENDING.

Recorded 0.44 delivery: PR #31 merged; Main `1dce76a62cd0a4180969949939041f889eb1d923`, tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`. Its hook separately passed 63 publication, 2794 core and 160 experimental tests; KB issues were 0. Remote status/check-run counts 0/0 do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.

The first-party Apache-2.0 increment establishes finite named-crop composition. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN; complete UI/EUI, packed atlas import, phone/native SDK and comparative performance remain future work.

[Contract](docs/spritesheet-contract.md) / [Evidence](docs/spritesheet-evidence.md). Native tool: `tools/spritesheet/README.md`.
<!-- SS1-0.45.0-END -->

<!-- SEQP-0.44.0-CHANGELOG-BEGIN -->
## Engineering preview 0.44.0 — Engine-clock sequence playback / 工程预览 0.44.0 — Engine 时钟驱动序列播放

**S097 / V048. Explicit Engine-clock sequence playback is accepted within the recorded finite lanes; full prepush, mandatory push hook and current PR/Main remain PENDING.** Use `engine.createSequencePlayback(scope, bitmap, clip, { mode: "once" })`, then `start()`; advance the Engine clock explicitly. The controller supports once/loop, pause, resume and stop, using genuine Scope ownership and the existing texture lease. It adds 3 erased root types and no root runtime value, dependency or public subpath. Rendering stays inert with respect to playback.

Saved public CPU tests passed 41/41; 25 source behavior families are a separate inventory. Positive diagnostics were 0; the two rejected-consumer lanes had 27/13 diagnostics and 40 exact tuples. Policy tests passed 5/5 with 4 assigned controls. The example records 5 rows, 1 atlas load and 1 disposal. The independently reviewed default desktop browser run completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, including cleanup.

[Contract](docs/sequence-playback-contract.md) / [Evidence](docs/sequence-playback-evidence.md) / Native verifier (`tools/sequence-playback/README.md`). This finite first-party increment does not close full Spine R020/V020 or migration R008/V006. Phone/native SDK, performance, physical display and third-party entitlement remain separate.

Recorded 0.43.0 delivery: [PR #30](https://github.com/cnedwin/Egret_rebuild/pull/30) merged; Main `ced3ef008b8c37868c6d1a505a02737451d937e1` and tree `c42eddecfa6737d12a3093ba0a4067aa9326d702` were read back. Its mandatory hook passed 63 publication, 2748 core and 160 experimental tests, counted separately. Zero remote statuses/check-runs do not establish remote CI PASS. Earlier Pending cutoffs remain historical.
<!-- SEQP-0.44.0-CHANGELOG-END -->

<!-- F2-B-0.43.0-CHANGELOG-BEGIN -->
## Engineering preview 0.43.0 — Spine linear source profile F2-B / 工程预览 0.43.0 — Spine 线性动画源规格 F2-B

**S096 / V047. Finite source behavior, types, policy and the complete development verifier are accepted; current full prepush, push hook and PR/Main delivery remain PENDING.** B retains owned source text and qualifies a fixed single-page, unweighted linear translate/deform profile. The opt-in experiment currently exports 2 values and 10 erased types; default SDK and public SP1 entries gain no B API. Saved B behavior passed 135/135; normal-host types had 0 positive and 100 actual negative diagnostics. The complete experiment verifier passed 160/160 and retained A39/B100 tuples.

[Contract](docs/spine-linear-profile-contract.md) / [Evidence](docs/spine-linear-profile-evidence.md). Source admission grants no Core, pose, resource, playback, rendering or entitlement authority. Controlled faults remain pending; R020/V020 and R008/V006 remain OPEN.

## Recorded 0.42.0 delivery — Spine F2-A / 已记录的 0.42.0 交付 — Spine F2-A

Version 0.42.0 merged through [PR #29](https://github.com/cnedwin/Egret_rebuild/pull/29); Main `e7a82283ef02b57976e5a94e10306fc6aee516b5` and tree `319de5686631afe3213699f9fc2a4a424d7bcbdf` were read back. Its mandatory push hook passed 63 publication, 2748 core and 22 experimental tests, counted separately. Zero remote statuses/check-runs do not establish remote CI PASS. Earlier Pending cutoffs remain historical records.
<!-- F2-B-0.43.0-CHANGELOG-END -->

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](docs/nine-slice-geometry-ns1-contract.md) / [evidence](docs/nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Engineering preview 0.40.0 — owned ByteWriter

**S093 / V044. Finite CPU, type and assigned boundary results accepted; final publication gates and delivery remain PENDING.** ByteWriter supplies fixed-capacity strict binary appends, native IEEE floating conversion and independent snapshots of the committed prefix, reusing the original ByteOrder and Scope lifetime.

The build and 37/37 public/regression cases passed: 8 BW groups, 23 ByteReader cases and 6 Scope cases. Separately, 2/2 process-isolated fault test files passed. BW has 24 internal observations and 22 controlled fault hits; these are not extra test cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/16 diagnostics, with 57 exact located/code inventory entries. Strict-type gate and boundary guard exited 0; assigned boundary controls passed 17/17.

Retained complete boundary suite: PENDING_AT_SOURCE_CURATION. This is separate from the finite assigned controls and the pending final complete prepush.

Recorded 0.39.0 delivery successor: textured scene composition was merged through [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26), with Main `ac490f90b7467164e461112a9f572a3269107c02` and tree `c137666681de663360a9bc153d85e6e71f48bd42` read back locally and remotely. The mandatory push hook completed with exit code 0. Remote statuses and check runs were both zero; remote CI PASS is not claimed. Earlier pending cutoffs and the first failed prepush remain historical records.

Read the [contract](docs/byte-writer-bw1-contract.md) and [evidence](docs/byte-writer-bw1-evidence.md). This original first-party utility increment establishes no file format, legacy ByteArray compatibility, full Spine, migration, native SDK or device/performance acceptance. Historical failures, preparation cutoffs and open work remain visible.
<!-- BW1-DOC-0.40.0-END -->

<!-- CHOST-DOC-0.39.0-BEGIN -->
## 0.39.0 proposed — textured scene composition

**CPU scope accepted; native, full gates and publication pending. S092 / V043.** The explicit `createTexturedSceneWebGPUHost` draws an opaque RGB scene and a genuine Engine-captured textured overlay through one owner, two passes and one submission. Set `clearAlpha: 1` and use `renderSceneTexturedFrame`; existing factories and captured-frame lifetime remain unchanged.

Recorded actual results cover the build, combined tests **12/12**, retained scene/textured tests **48/48**, positive types with **0** diagnostics, complete negative inventories **8/16/15**, the boundary guard and four assigned boundary controls **4/4**. This documentation curation is **SOURCE_ONLY / NOT_RUN** and does not add product execution.

The **180-second** full boundary-suite attempt is **INCOMPLETE**. Mandatory full prepush and publication remain **PENDING**. New browser/GPU execution is **NOT_RUN at this preparation cutoff**; physical phones, performance and native SDK acceptance remain unclaimed. FullSpine **R020/V020** and migration **R008/V006** remain **OPEN**.

**Recorded 0.38.0 delivery successor:** public Matrix authoring was merged through [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25), with Main `893f1ca86af10a092066dcccdaaa16ac194efded` and tree `5960109ca14c9a53ba1cd7ba80d967e6451ad102` read back locally and remotely. This supersedes earlier pending delivery labels while preserving their historical cutoffs; it does not establish 0.39 delivery or remote CI PASS.

See the [textured scene contract](docs/textured-scene-host-contract.md) and the [planned public verification record](../evidence/textured-scene-host-verification.json). The record awaits final evidence curation.
**Actual browser successor:** the default headless Edge **155.0.4283.45** run completed **2** genuine frames. All **24** fixed pixels (**12** per frame) matched exact RGBA expectations; each **16384**-byte normalized buffer is preserved in the shared record. Applying the first overlap expectation to the second buffer rejected the changed UI order at **(34, 32)**, without another rendered frame. Host safe close, resource/Scope/lease/Engine cleanup, application device destruction and cooperative browser closure passed. This establishes the bounded composition only; OS process retirement, physical hardware, phones, performance, complete 3D and full Spine remain separate. Full prepush and GitHub delivery are PENDING at this successor cutoff.
<!-- CHOST-DOC-0.39.0-END -->

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 proposed — public Matrix4 authoring

**SOURCE_ONLY / NOT_RUN. S091 / V042** proposes typed matrix authoring in `@egret/engine/scene3d`: `createMatrix4`, `multiplyMatrix4` and the original `Math3DError` / `Math3DErrorCode` bindings. Editor and JSON source arrays can become owned tuples and compose transforms before existing scene capture. The proposal reuses Egret's independently authored matrix algorithm through thin public forwarders.

Implementation, actual RED/GREEN, public behavior/types, current full gates and delivery are **PENDING**. Clock **0.37.0** delivery is **PENDING at this preparation cutoff**; earlier recorded results and cutoffs are retained. Broader scene/rendering, performance, complete Spine and migration acceptance remain separate.

**Recorded delivery successor:** Clock **0.37.0** was merged through [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24), with Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` read back locally and remotely. This supersedes the earlier delivery checkpoint without rewriting it and establishes no Matrix acceptance or remote CI PASS.

See the [public scene contract](docs/public-scene3d-contract.md) for the proposed API and authoring example.
**Actual 0.38.0 successor:** the old public SDK passed **17** retained cases and refused **4** new cases at the named missing-API assertion; its positive type consumer reported **4** missing exports. The newly built SDK passed **168/168** retained math, projection, scene and public cases, including **21/21** public cases. The positive consumer compiled; **11** intentional import negatives were bound to actual diagnostics, and exact boundary/strict-type gates passed with **0** unexpected failures. Original math algorithms remain unchanged. No new GPU, device or performance acceptance is claimed. Independent source/bilingual review, the full repository gate and delivery remain PENDING at this successor cutoff. See [the shared verification record](../evidence/public-matrix-authoring-verification.json).
<!-- MATRIX4-DOC-0.38.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Read [Clock guide](experiments/spine-f1/README.md), [saved verification](../evidence/spine-f1-clock-verification.json) and [pending public projection](../evidence/spine-f1-clock-public-projection.json).
A subsequent actual replay of the public source in an independent clone passed manual **12/12** with **6** original controls and full Clock **10/10** with **3** assigned controls; the named fault actually executed, with **0** skipped accepted cases. Separate default-headless WebGPU execution passed **10+1** readbacks, **30** positive samples and **120** channels at tolerance **0**, retaining original full-byte relations and bounded cleanup. Cold import/help observed **280** modules and **0** Core/GPU/host accesses. The saved CPU collection retains its earlier native-pending cutoff; the separate native receipt is the actual successor. Original source and input identities remained unchanged. Independent saved-result review, final repository gates and delivery remain PENDING here; full Spine **R020/V020 remains OPEN**. See the current successor in the linked Clock verification/projection records.
<!-- F1C-DOC-0.37.0-END -->

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](experiments/spine-f1/README.md), [verification](../evidence/spine-f1-manual-verification.json) and [projection provenance](../evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

<!-- SPH-DOC-0.35.0-BEGIN -->
## Engineering preview 0.35.0 — Scope ownership repair

Four internal Scope members now use JavaScript private storage/dispatch. Explicit same-name properties cannot bypass registration, replace owned cleanup values or cancellation, or retain closed Scopes in shutdown tracking. Public API and error/cleanup order remain intact. See the [contract and evidence](docs/scope-private-ownership.md).

Original baseline passed; the unchanged six-test suite produced 1 pass / 5 assigned failures. After repair: **6/6** new and **183/183** retained lifecycle tests, build, strict types and boundaries passed. Independent implementation review has zero open findings. Final full publication checks and **0.35.0** delivery are **PENDING** at this cutoff.

The preceding **0.34.0** was delivered through [PR #21](https://github.com/cnedwin/Egret_rebuild/pull/21), Main `74ca6c3293167d8d3eb253074c0596bd1922db21`, tree `94e6a96f17b656cb8cd28cd65a75f48575cb0c38`. Its mandatory push gate passed **2672/2672** core and **63/63** publication tests, checking **147** document pairs and **177** critical comment records. GitHub returned **0** statuses and **0** check runs; no remote CI PASS is claimed. Earlier pending cutoffs remain history.

This covers four explicit named shadows; it makes no claim about all internals, arbitrary public overrides, security isolation, GC or device performance. The next Spine step connects original manual animation fixtures to owned Mesh2D frames; full Spine, UI, 3D, platform, AI workflow and legacy migration acceptance remain in the engineering plan.
<!-- SPH-DOC-0.35.0-END -->

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Engineering preview 0.34.0 — Spine import planning

The optional built `@egret/project/spine` entry provides `createSpineImportPlan` and frozen `SPINE_IMPORT_LIMITS`. It prepares an immutable bounded plan from stable 4.3 skeleton JSON, a modern atlas and explicit page-to-asset bindings. Precise diagnostics identify original source locations. Read the [contract](docs/spine-import-plan-contract.md) and [verification record](../evidence/spine-import-plan-verification.json). Successful planning keeps animation semantics and rendering **not_run**, entitlement **unverified** and feature inventory **partial**.

<!-- SP1A-READING-ACTUAL-BEGIN -->
Current build and production boundary scan passed (465 files). Public planning behavior passed **32/32**; TypeScript **7.0.2** passed one DOM-free positive and **22 + 6** exact unsuppressed negative diagnostics. Focused policy passed **9/9**, and **5** separate owned-copy controls each passed a genuine baseline before failing its assigned mutant witness. Independent finite implementation review has zero open findings. Initial **30/32** exposed a test-helper source-ID assumption; the retained production boundary refusal exposed message wording and exact forwarding punctuation. Narrow repairs preserve the API and guard rules. Final complete publication checks, the mandatory push hook and **0.34.0** remote delivery remain **PENDING** at this cutoff.
<!-- SP1A-READING-ACTUAL-END -->

The preceding **0.33.0** package was delivered through [PR #20](https://github.com/cnedwin/Egret_rebuild/pull/20), merged to Main `4ae7e71ee72e5f2c46e7dbccd28b27f482294a0c`, tree `f340e46f0d88783b268b732dcacbfcf7c45a363a`. Its complete mandatory push gate passed **2,631/2,631** core and **63/63** publication tests, **145** document pairs and **174** critical comment records. Local/remote Main identity and a clean checkout were verified at **2026-10-11 23:31:37 UTC**. GitHub returned zero statuses and check runs; no remote CI PASS is claimed. Earlier pending cutoffs below remain historical.

Full Spine **R020/V020** remains open. A separately prepared official core artifact and original animation fixture recipe establish research inputs, not executed playback, redistribution rights or product acceptance. Next work connects per-instance animation state and owned mesh frames to the genuine clock, asset leases and renderers. Complete UI, target phones/SDKs, performance, editor/Agent workflows and legacy migration remain in the engineering plan.
<!-- SP1A-DOC-0.34.0-END -->

<!-- MI1-DOC-0.33.0-BEGIN -->
## Engineering preview: 0.33.0 — primary mouse input

Development preview **0.33.0 (MI1)** introduces Scope-owned primary mouse input through the optional `@egret/engine/web/input` entry. It connects existing logical hit testing and typed display events while rendering remains explicit. Read the [primary mouse contract](docs/primary-mouse-input-contract.md) and designated [verification record](../evidence/primary-mouse-input-verification.json) for the exact profile, ownership, failure handling and gate scopes.

At the documentation cutoff **2026-10-11 22:52:43 UTC**, the final Engine build and genuine public interface check passed. Public MI1 behavior/lifecycle passed **98/98**. TypeScript **7.0.2** passed one public positive and matched **26 + 15 + 5** exact unsuppressed negative diagnostics; the public type gate exited **0**. Focused MI1 policy passed **21/21** after correcting one expected diagnostic to retain the existing guard order. Public cancellation **8/8** and earlier retained CPU checks keep their separately recorded scopes. These overlapping checks are not added.

Default headless Edge **154.0.4258.62** with Playwright **1.62.1** passed the fixed desktop Canvas mouse subset: **1** genuine native baseline and **6** assigned controls cover literal events, logical points, RGBA witnesses and observed physical listener cleanup. The ordinary HTTP example passed, and collector policy/grammar units passed **13/13**. All **7** retained desktop gates—Canvas, WebGPU, B1, textured rendering, sequence animation, Canvas text and picking—passed their existing bounded profiles. This establishes neither phones, arbitrary UI/3D, OS reclamation nor a performance lead.

**The complete 259-case boundary rerun, final publication/bilingual checks, mandatory pre-push gate and current 0.33.0 remote delivery remain PENDING.** The earlier timeout and full **258/259** result retain their original artifacts; the latter exposed one expected-message mismatch. Focused **21/21** is its finite successor, not a complete rerun. Other earlier failures retain their recorded identities and cutoffs in the verification record.

The delivered baseline **0.32.0 (S3D1)** was merged through [PR #19](https://github.com/cnedwin/Egret_rebuild/pull/19) to Main `a240bc1e6ee218c63fc1511d715d01d1358d908f`. Earlier scene/preview sections retain their original sources, results and pending/failure cutoffs as history; their earlier pending labels do not undo this delivery.

Full Spine support **R020/V020** remains planned, implementation **not_started**, acceptance **not_run**. Complete UI, touch/pen, phones, Native SDKs, target-device performance, editor/Agent tools and complete legacy migration retain their separate implementation and acceptance obligations.
<!-- MI1-DOC-0.33.0-END -->

<!-- S3D1-DOC-0.32.0-BEGIN -->
## Engineering checkpoint: 0.32.0 (S3D1)

Verified implementation: public behavior **35/35**, boundaries **238/238**, **2** positive type consumers and **10 + 3 + 11 + 15** exact negative diagnostics pass. Retained integration checks **161/161** and fresh fixed headless Edge composition pass after independently reviewed repairs. Full final publication and current delivery remain pending at this curation cutoff; the linked scene contract records exact scopes and successors.

**Initial source/API observation (historical cutoff):**

Adds the [bounded public scene contract](docs/public-scene3d-contract.md): exact opt-in geometry/scene and browser Host exports, authentic readonly capture, camera/numeric/budget rules and inherited Host ownership. The independently designed typed facades reuse current first-party algorithms without new dependencies. The genuine missing-map interface RED on the delivered base is retained. Three-file adoption, build and interface GREEN at **2026-10-11 19:54:25–19:54:26 UTC** confirm source/API reachability only. Behavior, types, policy, native and final acceptance/delivery are **PENDING**. This checkpoint does not accept complete UI/3D, asset/character/Spine systems, Native SDKs or performance.

The delivered **0.31.0** successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. All prior sections retain their original source, results, failure/pending labels and curation cutoffs; this successor adds the delivery fact rather than rewriting them.
<!-- S3D1-DOC-0.32.0-END -->

## Engineering preview: 0.31.0 — 2026-10-12

Added independent Scope-owned resource acquisition groups: a homogeneous invariant Engine method, 0–128 own input occurrences, whole-input preflight and default 4 / integer 1–16 local waiter slots. Genuine member leases remain group-owned; queue stopping, late lease retirement, first observed terminal state, all-group Engine closure and manager/direct-group cleanup errors have explicit bounds. Read the [combined contract, usage and evidence](docs/resource-acquisition-groups.md).

At **2026-10-11 18:50:31 UTC**, the adopted working-tree build/example and **86/86** combined CPU checks passed (**29** RG1 + **57** retained). Private strict types passed with exact unsuppressed **15** ordinary/**11** import negatives. Corrected private finite policy controls passed **35/35** after the genuine one-mutant RED; finite source review resolved its finding with 0 open successor findings. The earlier **28/29** and **34/35** results remain preserved and overlap. Seven existing desktop browser profiles plus one build/freeze command passed; those profiles do not exercise a group-based browser application. Full current, bilingual/publication, push hook and RG1 delivery are **PENDING**. First-party Apache-2.0, no added dependency, private package `0.0.0` and protocol `1.0` remain; full Spine R020/V020 and broader UI/3D/device/performance/migration acceptance are unfinished.

The preceding 0.30.0 example was delivered through [PR #17](https://github.com/cnedwin/Egret_rebuild/pull/17) to Main `cd19ac07b8994b19ed777d1c2483a07c852fc1b9`, tree `828cd68ce8d86fc339848d5e9d4a10a443af6eba`. Local and remote Main identities were verified separately; this is no RG1 delivery or remote CI claim. All older sections below retain their original cutoffs.

## Engineering preview: 0.30.0 — 2026-10-12

Added a small authored-rectangle picking application through existing Stage, Event and CanvasHost APIs. CSS mouse coordinates feed the genuine logical query; actual typed target/ancestor listeners record routes. After dispatch returns, scene code clears and repaints one feedback rectangle and renders once; listeners do not paint the feedback. Six concrete callback pairs, eight scoped typed subscriptions and shared acquisition/close ownership keep cleanup explicit. No SDK API, dependency or external asset is added; package 0.0.0 and protocol 1.0 remain unchanged. Read the [example record](docs/display-picking-example.md).

Actual adopted public-entry headless checks passed 12/12. Independent private core review and its 12-case execution envelope are separate, overlapping evidence. Retain missing-module/setup failures, the correction to existing dispatchEvent, and the initial-render Ready-revival RED fixed by rechecking phase before Ready. Native browser input/pixels, five projection controls, complete current checks, final publication and independent bilingual meaning review, the mandatory Git push hook and delivery remain PENDING. This example does not accept a general input router, gestures, full UI/Spine/3D, phones, performance or complete migration.

The **0.29.0** HT1 delivery successor passed the mandatory push hook with 2,333 core and 59 publication tests and was merged through [PR #16](https://github.com/cnedwin/Egret_rebuild/pull/16) to Main `fb7f15b21cf80345e23490c551552deb4b68061a`, tree `e79ad52bf85a1efa7835a1d4074c5a4368ca8981`. The recorded source commit is `6e724971938ec8be4d271066f327814394e0b7fb`. Remote status/check counts were both 0; no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

### 0.30.0 desktop factual successor — 2026-10-12

The preparation paragraph above retains its original pending cutoff; the current desktop status is recorded here. The fresh desktop successor passed **PASS_DESKTOP_HT1_CANVAS_SUBSET** in default Edge **154.0.4258.62**: ten baseline rows and five assigned controls cover real mouse input, typed routes, Canvas pixels and an independent six-pair native listener ledger. Pure admission checks passed **32/32** separately; counts from these scopes are not summed.

The six isolated contexts saved 30 artifacts, including **424 target + 424 reference raw RGBA bytes**. Baseline Close removed all six owned native pairs with zero outstanding; the omit-retirement control deliberately retained six pairs and was detected. The collector closed every context and restored its observer. All contexts recorded zero errors and retained exactly two Canvas readback advisories each. The first native result remains **INCOMPLETE**; its records were not rewritten. V3 classifies only the exact known readback hint as advisory, without changing CanvasHost attributes, SDK, case actions or pixel oracle. Other warnings/errors remain fatal.

Complete current verification, final publication and independent bilingual meaning review, the mandatory Git push hook and delivery remain **PENDING**. This is a fixed desktop mouse/Canvas subset; phones, OS/physical reclamation, performance and full input/UI/Spine acceptance remain separate.

### 0.30.0 complete local verification successor — 2026-10-12

The preparation and desktop paragraphs above retain their original cutoffs; this later local verification result is recorded separately. Complete local verification passed: build, type fixtures and package boundaries; core **2377/2377** and structural publication **63/63**. Localization checked **140** pairs, **6** registry views and **154** critical source files. Knowledge-base validation checked **159** records, **243** Markdown files, **1997** links and **955** references with **0** issues; the headless lifecycle closed with **0** pending timers. These are separate scopes, not a combined test count.

Final independent bilingual meaning review, the mandatory Git push hook and delivery remain **PENDING**.

## Engineering preview: 0.29.0 — 2026-10-12

Added explicit Stage picking with `touchEnabled=false`, owned frozen `hitArea` rectangles and container `touchChildren=true`. Type-only `HitTestOptions` extends the existing engine/runtime roots; value exports, dependencies, package 0.0.0 and protocol 1.0 remain unchanged. The whole current Stage tree is admitted before arithmetic, with a receiver-inclusive default 4096 budget and range 1–65536. Eligible traversal uses Stage transforms, owner-local half-open clips and reverse painter/child-before-container order, retains the first winner while completing all active arithmetic, ignores alpha and never returns Stage or implicitly retargets. Read the [HT1 contract and bounded evidence](docs/display-hit-test-ht1.md).

Actual build, combined HT1/display-tree/scaling/coordinate checks 98/98 (32 HT1 cases), strict types with 16 exact ordinary/8 import diagnostics, 426 production boundary files and separate 221/221 synthetic policy records passed. The policy slice adds 15 leaf controls (1 positive, 14 mutants) and 1 parent record beside 205 retained records; it is checker evidence, not picking execution. These scopes overlap and are not summed. The missing-entry RED and review-cutoff fixture arithmetic correction remain preserved; finite source approval is separate from actual execution.

Complete current verification passed 2,333/2,333 core tests and 59/59 publication tests; all six affected existing desktop renderer regressions passed. The private-plan browser picking supplement, independent bilingual meaning review, mandatory Git push hook and delivery remain PENDING. This CPU increment does not accept routing, gestures, content/pixel hit, full UI, fonts, Spine, 3D input, phone performance or complete migration.

The **0.28.0** Canvas text delivery successor passed the mandatory push hook with 2,285 core and 59 publication tests and was merged through [PR #15](https://github.com/cnedwin/Egret_rebuild/pull/15) to Main `b704349207c536d2bdae38496ef622613355a3f4`, tree `d1b4fcd5629c2fe54455244534220c50e0cdc419`. The recorded source commit is `94f239b2d1bd6b1af6f63ebc4f375bc7c9894bca`. Remote status/check counts were both 0, so no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

## Engineering preview: 0.28.0 — 2026-10-11

Added only `createCanvasTextRasterProvider` through `@egret/engine/web/text`, composing existing T1/TF1 and CanvasHost with caller-owned fonts, explicit invalidation/preparation and genuine cleanup. Default value exports and dependencies remain unchanged; packages stay private 0.0.0 and protocol 1.0. Read the [single Canvas reading record](docs/canvas-text-wc1-canvas.md).

Actual Main public behavior/boundary passed 288/288; full strict types passed 12 new ordinary and 8 import diagnostics plus retained BR1 18, the production scan passed 420 files and the pure verifier contract passed 12/12. Default Edge 154.0.4258.62 returned PASS_WC1_CANVAS_SUBSET across six contexts, with 14 baseline rows, complete raster/frame bytes at zero tolerance, C01–C03 controls, composition, replacement, generation, lifetime/readiness and recorded cleanup. The first-party application smoke passed render/replacement/empty/close with zero browser errors. Scopes overlap and are not summed.

Finite source and actual saved-native review passed with 0 open findings. Complete current verification passed 2,285/2,285 core tests and 59/59 publication tests, build, strict types, production boundaries, knowledge-base checks and the headless example. Independent bilingual meaning review including the public shared JSON passed with 0 open findings; the mandatory Git push hook and delivery remain PENDING; all five affected existing browser gates passed within their existing route scopes. OS descendants and physical reclamation are unknown. The earlier mixed GPU result remains FAIL (512 composition bytes, maximum difference 1); Native7/OR1 remains pending. Complete WC1, CJK/phones, full UI/Spine/3D, performance and migration are separate. Prior 0.27.2 was delivered through [PR #14](https://github.com/cnedwin/Egret_rebuild/pull/14) to Main b8446d23d6cf8b979d05d35757876811fe190e7a; earlier records retain their cutoffs.

The first complete prepush retained 2,285/2,285 core and 52/52 publication passes but failed nine knowledge-base path checks. Registry artifacts resolve from the shared knowledge-base root. The finite repair corrects the example artifact paths, admits exactly five named repository reading files, and maps only exact inventoried language pairs in repository-root and shared-knowledge-base-relative forms. Actual repair controls changed from 3/5 to 5/5 for the knowledge-base reader and from 53/54 to 54/54 for publication parity; other outward paths and unpaired translations remain rejected. These checks establish the stated path behavior, not general filesystem security. The failed cutoff remains preserved; the later complete run is a distinct successor.

The next restricted-process run passed 59/59 publication tests but recorded 2,002/2,285 core passes and 283 aggregate core failures. EPERM setup observations included 172 isolated-package directory-symlink errors and 103 temporary-directory realpath errors before assigned probes; those error observations are not the aggregate test count. The authorized host-process successor ran the unchanged complete gate successfully; product code and tests were not weakened. Both cutoffs remain separately recorded.

## Engineering preview: 0.27.2 — 2026-10-11

Bounded CPU display-tree work narrows already bound receiver preflight to the receiver and full incoming subtree, retaining its own bindable callback and callback-free final revalidation after reentrant hooks. Initially unbound receivers retain whole-tree preflight and final binding validation. Direct child count/index reads and a last-child detach path address specific sibling scans; middle removals remain linear and unbound appends may still rescan. Read [attachment and cost boundaries](docs/display-tree-scaling.md).

The source diagnosis, one local Node.js 24.19.0 baseline timing observation, separate 32,012,000-hook observation for 8,000 children and 8-test pre-fix snapshot (7 pass, 1 fail) retain separate scopes. Actual successor checks/probe, complete current verification, finite source/bilingual review, mandatory prepush and remote delivery remain PENDING at this preparation cutoff. No exports or dependencies are added; packages stay private 0.0.0 and protocol 1.0. Browser/device/GPU/phone results, performance leadership, complete Spine and full migration are excluded. Earlier checkpoints retain their own cutoffs.

Actual corrected-source build and targeted display/scaling/cancellation/textured-capture checks passed 71/71, including nine scaling tests. The closing-hook error-priority failure was preserved and repaired with an open-engine guard before the receiver callback. An earlier 2,227/2,227 whole-core result predates that correction and ninth test, so remains intermediate only. Final whole verification/prepush, affected browser gates, finite review and remote delivery remain PENDING. These scopes overlap and are not summed.

## Engineering preview: 0.27.1 — 2026-10-11

Added a small owned ByteReader for binary resource and engineering work: signed/unsigned scalar reads, explicit byte order, an atomic cursor, independent copy-out and synchronous disposal. Only the engine/runtime roots gain two shared values and the erased ByteOrder type. The per-reader payload limit is 16,777,216 bytes; this is not a process-memory budget or a legacy ByteArray compatibility claim. Read the [contract](docs/byte-reader-br1-contract.md) and [bounded evidence](docs/byte-reader-br1-evidence.md).

Recorded isolated compilation, 23 behavior cases, strict positive types, 18 exact negative diagnostics, controlled allocation/copy failures and 156 affected regressions passed. Earlier missing-export, setup and type failures remain preserved. These scopes are not summed. The Main-compatible integration, complete current core checks, bilingual meaning review, final mandatory prepush and remote delivery remain PENDING at this preparation cutoff. The allocation fixture is an exact path copy into the default test inventory; its five observations are not five test cases. Packages remain private 0.0.0 and protocol 1.0. This increment does not accept new rendering, fonts, formats, Spine, platforms, performance or complete migration.

## Engineering preview: 0.27.0 — 2026-10-11

The 0.27.0 engineering preview adds a factory-owned, noneditable TextField through `@egret/engine/text`: `createTextField(engine, scope, cache)` and type-only `TextField`/`TextFieldStatus`. Ten-scalar requests, explicit preparation, revision replacement and coalesced caller leases follow genuine Engine/Scope/cache affinity. Committed images and blank direct bounds participate in both image-capable collectors under existing budgets; legacy image refusal is preserved. Default roots remain unchanged. Read the [contract](docs/text-field-tf1-contract.md) and [evidence](docs/text-field-tf1-evidence.md).

Complete existing prototype verification passed 2,157/2,157 and its current production boundary scan covered 411 files. The focused public result is 16/16 (13 main top-level, two nested and one constructor test); strict types cover 18 ordinary, four supplemental and 12 dedicated-file import diagnostic locations, with one compiler invocation for the import file. Copied-source controls passed 27/27, including existing T1 controls; affected regressions passed 83/83 and private collector units 20/20. These scopes overlap and are not added. Earlier failures and source/emission cutoffs remain in the evidence.

Workspace packages remain private 0.0.0 and protocol 1.0. Current five existing native regression gates, final mandatory prepush and remote delivery remain PENDING at this curation cutoff. Those native gates do not constitute a native TextField supplement. Complete UI, editing, automatic wrapping, browser fonts/native TextField, CJK, phones, Native SDKs, performance, 3D, Spine and complete migration remain open.

## Engineering preview: 0.26.0 — 2026-10-11

Added `engine.createTween(scope, options)` and four type-only root names for Scope-owned scalar transitions. Built-in `linear`, `quadIn`, `quadOut`, `quadInOut` easing, one-shot start/pause/resume/stop, synchronous undefined-only callbacks and terminal cleanup follow Engine/Scope lifetime. The prior 0.25.0 clock supplies explicit game seconds; capture/render never advances time and advancement never renders. Read the [contract](docs/scalar-tween-contract.md) and [bounded evidence](docs/scalar-tween-evidence.md). Complete core verification passed in its recorded source/fixture scope; final publication and delivery remain separate gates; scoped checks retain their own source/fixture cutoffs. Packages stay private 0.0.0 and protocol 1.0. Property arbitration, chains, complete legacy Tween/Spine and production performance remain separate work.

## Engineering preview: 0.25.0 — 2026-10-11

Added an Engine-owned explicit clock in seconds, an atomic delta ceiling (default 0.25, configurable up to 1), 256 live Scope-owned callbacks and phase-safe shutdown. Rendering and SequencePlayer sampling remain explicit. Initial public behavior passed 21/21 and affected regressions 59/59; strict types passed 234 actual unsuppressed diagnostics including 31 individually checked clock cases, production boundaries covered 393 source/build/declaration files and assigned source controls passed 18/18. Complete core verification passed 2,076/2,076 with the initial fixture; after that run, two narrow coverage additions passed the supplemented public fixture 21/21. These scopes overlap and are not added. Missing-feature and revoked-option REDs, diagnostic prediction failures and the corrected public-root namespace setup remain preserved. Read the [contract](docs/game-clock-contract.md) and [evidence](docs/game-clock-evidence.md). Bounded core integration is reviewed; publication and delivery are separate records. This does not accept automatic animation, browser visibility policy, fonts/TextField, full UI/3D/Spine, phones, Native SDKs, performance or migration. Packages remain private 0.0.0 and protocol 1.0; earlier checkpoints retain their scope.

## Engineering preview: 0.24.0 — 2026-10-11

Introduced DOM-free text-provider orchestration with exact request keys, signed layout metrics, 32 fixed resource slots, independent logical budgets, genuine Texture leases and observable terminal cleanup. Initial build and the unchanged T01 baseline passed; 80 affected old regressions passed under their initial source revision. The first unchanged 38-group public run found T22 primary-error loss during cleanup reentry (37/38); after the preserved correction, the unchanged successor passed 38/38. Independent review closed six core findings; the final core build, public 38, private units 32, raster authority 5, old regressions 80 and source controls 19 passed, while the boundary scan covered 387 files. These scopes overlap and are not summed. Strict types preserve development-resolution and 19-versus-18 fixture failures; the exact successor passed its positive and 18 ordinary/9 isolated diagnostics. Complete existing core-source verification passed 2,037/2,037 tests after preserving the initial runner timeout and failed synthetic-fixture baseline. Final prepush and publication are recorded separately in delivery verification. Read the [contract](docs/text-raster-t1-contract.md) and [version-bound evidence](docs/text-raster-t1-evidence.md). These observations do not accept browser fonts, TextField, native glyph pixels, performance, full UI/Spine or migration. Packages remain private 0.0.0 and protocol 1.0; earlier 0.23.0 records remain unchanged.

## Engineering preview: 0.23.0 — 2026-10-11

Added owned textured geometry and Mesh2D, immutable textured-frame capture, bounded clipping/vertex preparation and an explicit WebGPU host. Fixed desktop calibration, held-out pixels and copied-production sensitivity controls passed; affected Canvas, rectangle WebGPU, B1 and SequencePlayer saved results and process retirement received independent bounded review. Read the [contract](docs/textured-geometry-and-mesh2d-contract.md), [geometry evidence](docs/textured-geometry-and-mesh2d-evidence.md) and [CPU/desktop evidence](docs/textured-profile-cpu-evidence.md). Reproduction of the current public workflow and final delivery are separate records. Packages remain private 0.0.0 and protocol 1.0; phones, performance, full UI/fonts/Spine/3D and complete migration remain open.

## Engineering preview: 0.22.0 — 2026-10-10

Added receiver-local `getBounds` with a fresh readonly `Rectangle2D`, explicit node/primitive budgets and deterministic authority/lifetime checks. Descendant direct corners are measured with ordinary binary64 arithmetic; authored zero extents count and skip arithmetic, and conservative enclosure is not promised. Read the [contract](docs/display-content-bounds-contract.md) and [evidence](docs/display-content-bounds-evidence.md) for actual recorded results and their identities. Other spaces/output adapters/layout/hit testing remain pending. Packages remain private 0.0.0 and protocol 1.0; final prepush and stacked publication are separate gates.

## Engineering preview: 0.21.0 — 2026-10-10

Added public display coordinate queries with owned readonly results, exact stored-matrix inverse rounding and ancestor/lifetime budgets. CPU/type and fresh affected desktop rendering regressions passed within recorded scope; final publication is separately gated. Read the [contract](docs/display-coordinate-query-contract.md) and [evidence](docs/display-coordinate-query-evidence.md). No dependency or package/protocol release was added; private 0.0.0/protocol 1.0 and open full UI/3D/Spine/migration obligations remain.

## Engineering preview: 0.20.0 — 2026-10-10

Added the public sequence factory/types and explicit-time SequencePlayer with exact lease binding, atomic crop/sample commit, private receiver authority and Engine affinity. Added a public-entry example and opaque browser verifier. Read the [contract and acceptance](docs/sequence-player-contract.md) for measured behavior, type and browser scopes; the earlier [Bitmap observation](docs/bitmap-region-evidence.md) remains separate.

No third-party animation dependency was added. This does not accept full A2/alpha calibration, production hosts, UI/fonts/skeletons, performance, complete Spine support or R008/V006 migration. Packages remain private at 0.0.0 and protocol pins remain 1.0. The documentation cleanup and Spine requirement below are included without changing their historical technical acceptance.

## Documentation cleanup — 2026-10-10

Consolidated nine historical research/plan/execution/audit documents into three complete round records under `archive/`, kept both language editions, and removed the duplicated knowledge-base agent agreement in favor of the repository-wide rules. Shortened entry pages and replaced repeated historical GPU reports with evidence links. Raw results, failures, source snapshots, legal originals and product code are preserved; this is a reading-structure change, not a new engine version.

## Engineering preview: 0.19.0

Added bounded CPU Bitmap region admission/capture and the B1 browser verifier. Read the [Bitmap contract](docs/bitmap-region-contract.md), [Bitmap evidence](docs/bitmap-region-evidence.md) and [B1 verifier](docs/b1-browser-verifier.md). These increments do not accept complete UI, skeletons, target hosts, device performance, AI creation or R008/V006 migration. Older checkpoint statuses below describe their own dates and source identities.

## Requirement amendment — 2026-10-10: complete Spine support

Added confirmed R020, planned V020 and S066–S068, a complete bilingual support/acceptance specification, and corresponding product, rendering, engineering and delivery obligations. Initial version candidates are 4.3 and 4.2; all Egret Spine compatibility rows remain unverified. No runtime source, dependency, API, test result or engineering version was added. See the [Spine requirement](docs/spine-animation-support-and-acceptance.md).

## Historical local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](docs/legacy-movieclip-contract.md), [evidence](docs/legacy-movieclip-evidence.md) and [compact record](../evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](docs/3d-cpu-scene-contract.md), [mesh](docs/3d-webgpu-mesh-contract.md), [Host](docs/b1-host-contract.md), [sequence](docs/sequence-clip-contract.md) and [RES intents](docs/legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](docs/b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

Adopted 10 new Chinese/English document pairs and three compact public evidence summaries. The current index contains 112 pairs (102 preserved plus 10 added) and current hashes for 90 critical English-comment source files; no source comments were edited. Added V016 for bounded B1 Host source/mock (depending on V013/V014), V017 for standalone CPU sequence sampling and V018 for pure RES intents (depending on V015). Earlier deliverables and acceptance obligations remain unchanged.

## 0.16.0 engineering preview — October 10, 2026

Added paired core-progress, 3D-foundation and legacy-res-declarations documents plus three curated verification summaries. Accepted A2 Tasks 1–4 and CPU Task 5a, B0 math/projection, B1 CPU geometry/packing and RES declaration analysis are distinguished from unrun browser/device acceptance. Saved Task 5a evidence is 31 focused/825 full; Task 5b/Task 6 and P0–P7 remain UNRUN. Earlier failures/corrections and exact historical source subjects retain their scope.

Added V013–V015 and S059–S062 without upgrading V002 full acceptance, V003, V006 or R008. Preserved all 99 old pairs and added 3, yielding 102; observed English comments now cover 85 critical source files with historical identities retained. The knowledge-base checkpoint remains 0.13.0; 0.14.0/0.15.0 histories, package 0.0.0/protocol 1.0 and immutable historical dossiers remain unchanged. This author curation still requires independent public review, complete prepush and separate GitHub delivery.

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The historical 0.13.0 rectangle checkpoint has its own [implementation and verification record](docs/webgpu-rectangle-implementation-evidence.md). Its source identities, results and pending work retain their recorded scope; they do not establish current product acceptance.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](docs/display-and-frame-execution-contract.md) and [implementation plan](docs/display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](docs/display-and-frame-implementation-record.md) and [verification](../evidence/display-frame-verification.json).

0.12.0 (2026-10-09) adds the display/frame contract, plan, implementation record and V011/S054/S055; bounded rectangle CPU snapshots and Canvas execution passed. Current evidence binds source identities; publication and archives are recorded separately. Earlier 0.11.0 entries retain historical identities.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

## 0.11.0 October 8, 2026

Added the independent [CPU asset core](docs/resource-core-implementation-record.md) under V010, based on a separate [asset contract](docs/resource-core-contract.md). Typed references, shared acquisition, pending-only cancellation, independent leases, generation isolation, and Scope/Engine closure are implemented. Final core verification passes 73 behavioral checks, 19 negative type assertions, and package boundaries; both examples pass.

A scoped independent code review found mutable function.call invocation defeating callback capture. Two regressions were observed RED then GREEN; invocation now preserves the captured callable and provider receiver. A separate adapter-error regression and the initial test-oracle correction remain recorded. S052/S053 preserve implementation and review scopes, all new reading documents are bilingual, and historical 0.10.0/earlier identities are retained. This CPU increment does not accept GPU, real hosts, performance, AI creation or complete R008/V006 migration. No new dependencies or remote submission this revision.

## 0.10.0 October 8, 2026

R019 establishes that every push must first organize public content, complete English comments on critical code, and provide complete Chinese/English reading documents and shared registry views. Added the bilingual and pre-push policy. Current technical acceptance, original test records, and third-party implementation identities retain their existing scope; language versions and comment revisions each record source digests and check results. Branch and PR records determine actual remote outcomes.

## 0.9.0 October 8, 2026

R018 confirms public collaboration from early development. Added public communication/material-scope policies, contributor agreements, and source acknowledgements. Curated documents and review language so design rationale, implementation attribution, and verification boundaries support continuing community discussion. Public copies retain original material identity; historical results, source versions, and failure/revision facts remain traceable.

Established a local repository candidate combining core code and the knowledge base, with release content generated from an explicit inventory. The designated public repository is cnedwin/Egret_rebuild, continuing its existing Apache-2.0 configuration; submissions and review for this candidate are recorded separately. Core runtime logic and original 44 headless/11 type results retain their scope. No graphics, native, performance, or migration acceptance was added.

## 0.8.0 October 8, 2026

Started the [first independent core slice](docs/core-framework-implementation-record.md) under R017. V009 records three packages with actual responsibilities and limited verification. V002 moves to partial implementation in_progress; complete acceptance remains not_run. Fixed TS7.0.2, actual strict compilation/type/boundary checks, 44 headless tests, and the example pass. The core is independently written; the third-party compiler has explicit attribution. Initial review, repairs, and final review are saved separately from integration verification.

Added eight [evidence gaps](docs/core-framework-evidence-gaps.md). S045–S048 register user authorization, actual execution, official-entry checks, and independent code review respectively. No GPU, browser/native, CI, performance, or migration acceptance occurred. All D records remain proposed, H records untested, V003–V006 unimplemented, and full migration obligations remain. All 474 original 0.7.0 digests matched; the complete baseline was retained, without rewriting old research bytes. Main design documents are candidate version 0.7; the local prototype was not publicly released.

## 0.7.0 October 8, 2026

R016/S042 register the user's requirement to fully redefine architecture and standards, retain Egret naming, and modernize structure/API. Added [engineering structure](docs/engineering-architecture-and-project-structure.md), [API contracts](docs/public-api-design-and-naming.md), and [code gates](docs/code-standards-and-quality-gates.md). D016 is a candidate: three initial public package identities with explicit EUI/3D subentries; Scope, leases, events, and native/Agent contracts connect throughout. S043/S044 distinguish static checks of eight historical entries from official language/tool mechanisms.

Unified D006 wording with D014 native research as TS public state plus narrow candidate Rust/C++ modules, without accepting specific language/backend/VM choices. Main design documents update to candidate 0.6 and link policies. No source repository was created, dependencies installed, CI configured, API examples compiled, or experiments added/rerun. All D remain proposed and H untested; V002–V006 implementation/acceptance and R008/V006 obligations remain unchanged. All 463 pre-change digests matched; complete 0.6.2 was retained. Review of the eight old research files binds that historical version.

## 0.6.2 October 8, 2026

Added [Shaders and Playground insights](docs/shaders-and-playground-lessons.md). S040/S041 retain official sources and fixed-source boundaries. Shaders announced MIT open-source software on October 6; fixed v4.0.2 is WebGPU-only. No primary evidence established authorship by Evan. Playground launched October 7; help pages already describe complete HTML/JS/CSS/asset ZIP export and continued editing. Spark tests and future plans are recorded separately.

Effect assets, Agent parameter retrieval, and continuing creation workflows are candidate suggestions linked to D009/D011/D012, without changing existing proposals or acceptance status. The three main design documents remain candidate 0.5.1. No confirmed requirements, product deliveries, or tests were added. These projects were not installed or executed, and no experiments were added/rerun. Existing reference-chain scope, the complete product, and R008/V006 obligations remain unchanged. All 459 pre-change digests matched; complete 0.6.1 was retained. Old policy review explicitly binds that historical version.

## 0.6.1 October 8, 2026

R015 and S038 confirm independent design/implementation of Egret core from its own specifications, using open projects for mechanism research and public infrastructure as explicit attributed dependencies. Added the [independent implementation policy](docs/independent-implementation-and-dependency-policy.md) and [implementation source record](templates/implementation-origin-record.md), defining research-reference, explicit-dependency, and independent-implementation roles. Synchronized contribution, research, three design documents, and delivery source conditions. The three design documents are candidate 0.5.1.

Existing Three vendor files and experiment reports remain unchanged as a third-party research chain, without selection as an independent rendering core or production library. S039 registers independent review. Attribution, code, and release notices are assessed separately; this round checks limited files and sources. Experiment code was not changed and experiments were not added/rerun. D remain proposed, H untested, and V002–V006 and R008/V006 obligations/dependencies remain unchanged. All 453 pre-change digests matched; complete 0.6.0 was retained. Old selection review points to that historical version.

## 0.6.0 October 8, 2026

Added [candidate graphics-backend compilation and native Runtime design](docs/graphics-backends-and-native-runtime-selection.md). R013 records fast compilation/debug goals; R014 records native SDK and cross-platform extension research. D013–D015 and H008 register build separation, modular Runtime, and optional GPU AI; all remain candidates/unverified. Three design documents update to candidate 0.5.

Checked stable TS7.0.2 and Vite8's current architecture. Distinguished host WebGPU coverage, Canvas text, mainline wgpu/Dawn D3D11, V8/JSVM static-build relationships, GPUAI, and vendor conditions. S033–S037 retain user intent and official materials; native private entries are excluded from public candidates.

Compilation/Runtime/GPUAI were not installed or run, and graphics experiments were not added/rerun. The third round's 17 items retain original coverage/reports. D001–D015 remain proposed, H001–H008 untested, and full-product status and R008/V006 obligations unchanged. All 444 pre-write 0.5.0 digests matched; complete 0.5.0 was retained.

## 0.5.0 October 8, 2026

Executed the first Three r186 real-asset reference chain under R012: fixed glTF skinned cylinder, independent animation instances, same-context text UI, shared-resource release, required policy, cancellation, and actual context recovery. Added the [third-round integration record](archive/round-3-research.md#execution) and [audit](archive/round-3-research.md#audit). Three design documents update to candidate 0.4.

Current main checks pass 17/17, with zero page errors/console diagnostics. Retained the failing behavioral version, old-handle cleanup failure after recovery, four faulty mutations, and regressions after independent review. Sources and code received separate independent AI reviews; integration verification reran the final identical source. Counts cover only the current limited reference chain, neither accumulating historical repeats nor increasing existing 71-item coverage.

Added S030–S032. V002/V004 advance only research progress. D remain proposed and H untested; complete V002–V006 product implementation remains not_started and acceptance not_run. Mobile performance, text coverage/IME, complete 2D/complex UI/characters, WebGPU/hosts, AI creation, and complete migration have not passed acceptance. Untrimmed reference package size is only a file/compression estimate; target trimming and actual initial packages need separate acceptance.

Checked 150 pre-change digests and saved the complete 0.4.0 baseline; previous source/evidence bytes remain. R008/V006 complete one-click migration, continued editing, actual publication, and final V001–V005 dependencies remain unchanged.

## 0.4.0 October 8, 2026

R012 records the user-confirmed priority for mature open-source implementations. Added [verification responsibilities](docs/open-source-research-and-validation-roles.md) and the [reference adoption plan](docs/open-source-reference-implementations-and-adoption.md). S025–S029 register fixed-version Three, Babylon, PlayCanvas, Pixi, and DragonBones source, licenses, and independent AI review. Three design documents update to candidate 0.3.

Defined the first Three real-asset reference chain, mature Canvas text/controlled atlases, KTX2, and animation-reuse paths. Refined shared state, font/atlas generations, recovery sources, and resource ownership. Corrected wording: retain original text by default without forcing NFC; rejecting required extensions is an Egret product policy; the state-reset counterexample occurred in a new instance within the same Node process, rather than an OS-crash experiment.

Upstream projects were not installed or executed; existing experiments were not added/rerun. Fixed-source mechanisms do not establish mobile performance, Chinese/IME, host, or migration success. All 142 pre-change digests were checked and complete 0.3.0 retained. Existing experiment source/results remain. D001–D012 remain proposed, H001–H007 untested, V002–V006 products not_started, and R008/V006 complete migration and V001–V005 dependencies unchanged.

## 0.3.0 October 8, 2026

Updated the technical white paper, PRD, and engineering plan to candidate 0.2. Added the [second-round verification record](archive/round-2-research.md#execution) and [second-round audit](archive/round-2-research.md#audit). Main checks pass 64 items in four CPU programs and 7 actual WebGL mixed-graphics items. All conclusions remain experimental and do not constitute engine, host, performance, or migration acceptance.

Further separated identity and lifecycle for events, resources, UI, and batching. Audits repaired missing generations in device fences, sparse arrays, finite-input overflow, and a GPU reference sharing a builder. The weak blank-screen recovery criterion was also repaired after retaining counterexamples. Original failures, intermediate passing versions, source digests, and independent-review boundaries remain.

S018–S024 record this round's programs, official graphics references, and independent AI audit. Checked 65 old-file digests first and retained complete 0.2.0. Normalized local-position metadata in the public candidate while retaining internal originals; repaired false positives for JSON-escaped paths and verified that actual paths remain rejected. D001–D012 remain proposed, H001–H007 untested, V002–V006 products not_started, and R008/V006 complete migration and V001–V005 dependencies unchanged.

## 0.2.0 October 8, 2026

Added the candidate 0.1 technical white paper, product requirements document, and engineering-plan package, plus technical verification records, first-round independent audit, and first-round official-research entry points. R011 records the user's requirement for gradual research, deliberation, verification, and self-audit. V008 corresponds to the candidate design package; the complete 0.1.0 baseline snapshot remains in internal history.

Independent contract models and local browser graphics research programs ran, retaining partial results and failure history. Contract-model audits found defects; repairs, reverification, and final actual check counts follow the [technical verification record](archive/round-1-research.md#execution). V001 research becomes in_progress. V002–V006 product implementation has not started; all D001–D012 remain proposed and H001–H007 untested. The complete engine, production hosts, performance, creator tasks, and migration have not passed acceptance; delivery of candidate documents does not approve technical selections.

Tightened competitor evidence levels: LayaAir engine 3.4.1 was checked this round; IDE 3.4.1 and old official-site dates remain previous-round static excerpts only. Date differences between official services and GitHub for 3.3/3.4 retain conflicting sources/event definitions without combining them into new conclusions. Initial host order, team, schedule, and numerical performance budgets remain unconfirmed by the user. R008/V006 remains a formal requirement for the first complete release target; V006 ultimately depends on V001–V005.

[Technical white paper](docs/technical-white-paper.md) · [Product requirements document](docs/product-requirements.md) · [Engineering plan](docs/engineering-plan.md) · [Technical verification record](archive/round-1-research.md#execution) · [First-round audit](archive/round-1-research.md#audit) · [First-round research checks](archive/round-1-research.md#research)

## 0.1.0 October 8, 2026

Established the first Egret Engine Rebuild engineering knowledge base. Consolidated ten user-confirmed requirements, twelve technical candidates, seven advantage hypotheses, and seven delivery tasks. Organized two years of competitor iteration, host changes, historical asset boundaries, AI engineering interfaces, and migration acceptance.

Added community contribution entry points, RFC/ADR/experiment templates, and status/reference validation tools. Private-asset receipt records and original-plan snapshots are saved in separate directories; the original plan ledger became the current delivery entry.

This version organizes design materials. It did not implement a new engine, editor, or migration tool, run engine-performance, creator-task, or production-platform acceptance, or publish a public repository.
