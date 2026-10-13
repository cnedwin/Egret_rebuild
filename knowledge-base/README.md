# Egret Rebuild knowledge base

English | [简体中文](README.zh-CN.md)

Explore the [English knowledge base](en/README.md), [technical white paper](en/docs/technical-white-paper.md), [product requirements](en/docs/product-requirements.md), [engineering plan](en/docs/engineering-plan.md), and [contribution guide](en/CONTRIBUTING.md).
<!-- SS1-0.45.0-BEGIN -->
## Engineering preview 0.45.0 — Named SpriteSheet

**S098 / V049.** Named `createSpriteSheet` shares one full-image lease between immutable named crops, static icons and the existing Engine-clock sequence controller. Runtime/Engine roots add one factory and two erased types, `SpriteSheet` / `SpriteSheetFrameInput`; package version stays private `0.0.0` and host protocol `1.0`. No new dependency, public subpath or animation clock is added.

Saved public CPU passed 100/100, with retained CPU 133/133 counted separately. SS01–SS10 are specification families. SpriteSheet positive types produced 0 diagnostics; ordinary/import negatives contained 22/14, totaling 36 precise tuples and 6 continuation lines. Original-operation units passed 10/10; policy passed 5/5 including 4 assigned controls, and retained generic policy passed 272/272 separately. The recording example has 8 rows, 6 explicit ticks, 1 load and 1 disposal. Independently accepted Canvas/WebGPU observations completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, with bounded cleanup. Final publication gates, mandatory push hook and 0.45 PR/Main remain PENDING.

Recorded 0.44 delivery: PR #31 merged; Main `1dce76a62cd0a4180969949939041f889eb1d923`, tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`. Its hook separately passed 63 publication, 2794 core and 160 experimental tests; KB issues were 0. Remote status/check-run counts 0/0 do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.

The first-party Apache-2.0 increment establishes finite named-crop composition. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN; complete UI/EUI, packed atlas import, phone/native SDK and comparative performance remain future work.

[Contract](en/docs/spritesheet-contract.md) / [Evidence](en/docs/spritesheet-evidence.md). Native tool: `tools/spritesheet/README.md`.
<!-- SS1-0.45.0-END -->

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](en/docs/nine-slice-geometry-ns1-contract.md) / [evidence](en/docs/nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Engineering preview 0.40.0 — owned ByteWriter

**S093 / V044. Finite CPU, type and assigned boundary results accepted; final publication gates and delivery remain PENDING.** ByteWriter supplies fixed-capacity strict binary appends, native IEEE floating conversion and independent snapshots of the committed prefix, reusing the original ByteOrder and Scope lifetime.

The build and 37/37 public/regression cases passed: 8 BW groups, 23 ByteReader cases and 6 Scope cases. Separately, 2/2 process-isolated fault test files passed. BW has 24 internal observations and 22 controlled fault hits; these are not extra test cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/16 diagnostics, with 57 exact located/code inventory entries. Strict-type gate and boundary guard exited 0; assigned boundary controls passed 17/17.

Retained complete boundary suite: PENDING_AT_SOURCE_CURATION. This is separate from the finite assigned controls and the pending final complete prepush.

Recorded 0.39.0 delivery successor: textured scene composition was merged through [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26), with Main `ac490f90b7467164e461112a9f572a3269107c02` and tree `c137666681de663360a9bc153d85e6e71f48bd42` read back locally and remotely. The mandatory push hook completed with exit code 0. Remote statuses and check runs were both zero; remote CI PASS is not claimed. Earlier pending cutoffs and the first failed prepush remain historical records.

Read the [contract](en/docs/byte-writer-bw1-contract.md) and [evidence](en/docs/byte-writer-bw1-evidence.md). This original first-party utility increment establishes no file format, legacy ByteArray compatibility, full Spine, migration, native SDK or device/performance acceptance. Historical failures, preparation cutoffs and open work remain visible.
<!-- BW1-DOC-0.40.0-END -->

<!-- CHOST-DOC-0.39.0-BEGIN -->
## 0.39.0 proposed — textured scene composition

**CPU scope accepted; native, full gates and publication pending. S092 / V043.** The explicit `createTexturedSceneWebGPUHost` draws an opaque RGB scene and a genuine Engine-captured textured overlay through one owner, two passes and one submission. Set `clearAlpha: 1` and use `renderSceneTexturedFrame`; existing factories and captured-frame lifetime remain unchanged.

Recorded actual results cover the build, combined tests **12/12**, retained scene/textured tests **48/48**, positive types with **0** diagnostics, complete negative inventories **8/16/15**, the boundary guard and four assigned boundary controls **4/4**. This documentation curation is **SOURCE_ONLY / NOT_RUN** and does not add product execution.

The **180-second** full boundary-suite attempt is **INCOMPLETE**. Mandatory full prepush and publication remain **PENDING**. New browser/GPU execution is **NOT_RUN at this preparation cutoff**; physical phones, performance and native SDK acceptance remain unclaimed. FullSpine **R020/V020** and migration **R008/V006** remain **OPEN**.

**Recorded 0.38.0 delivery successor:** public Matrix authoring was merged through [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25), with Main `893f1ca86af10a092066dcccdaaa16ac194efded` and tree `5960109ca14c9a53ba1cd7ba80d967e6451ad102` read back locally and remotely. This supersedes earlier pending delivery labels while preserving their historical cutoffs; it does not establish 0.39 delivery or remote CI PASS.

See the [textured scene contract](en/docs/textured-scene-host-contract.md) and the [planned public verification record](evidence/textured-scene-host-verification.json). The record awaits final evidence curation.
**Actual browser successor:** the default headless Edge **155.0.4283.45** run completed **2** genuine frames. All **24** fixed pixels (**12** per frame) matched exact RGBA expectations; each **16384**-byte normalized buffer is preserved in the shared record. Applying the first overlap expectation to the second buffer rejected the changed UI order at **(34, 32)**, without another rendered frame. Host safe close, resource/Scope/lease/Engine cleanup, application device destruction and cooperative browser closure passed. This establishes the bounded composition only; OS process retirement, physical hardware, phones, performance, complete 3D and full Spine remain separate. Full prepush and GitHub delivery are PENDING at this successor cutoff.
<!-- CHOST-DOC-0.39.0-END -->

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 proposed — public Matrix4 authoring

**SOURCE_ONLY / NOT_RUN. S091 / V042** proposes typed matrix authoring in `@egret/engine/scene3d`: `createMatrix4`, `multiplyMatrix4` and the original `Math3DError` / `Math3DErrorCode` bindings. Editor and JSON source arrays can become owned tuples and compose transforms before existing scene capture. The proposal reuses Egret's independently authored matrix algorithm through thin public forwarders.

Implementation, actual RED/GREEN, public behavior/types, current full gates and delivery are **PENDING**. Clock **0.37.0** delivery is **PENDING at this preparation cutoff**; earlier recorded results and cutoffs are retained. Broader scene/rendering, performance, complete Spine and migration acceptance remain separate.

**Recorded delivery successor:** Clock **0.37.0** was merged through [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24), with Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` read back locally and remotely. This supersedes the earlier delivery checkpoint without rewriting it and establishes no Matrix acceptance or remote CI PASS.

See the [public scene contract](en/docs/public-scene3d-contract.md) for the proposed API and authoring example.
**Actual 0.38.0 successor:** the old public SDK passed **17** retained cases and refused **4** new cases at the named missing-API assertion; its positive type consumer reported **4** missing exports. The newly built SDK passed **168/168** retained math, projection, scene and public cases, including **21/21** public cases. The positive consumer compiled; **11** intentional import negatives were bound to actual diagnostics, and exact boundary/strict-type gates passed with **0** unexpected failures. Original math algorithms remain unchanged. No new GPU, device or performance acceptance is claimed. Independent source/bilingual review, the full repository gate and delivery remain PENDING at this successor cutoff. See [the shared verification record](evidence/public-matrix-authoring-verification.json).
<!-- MATRIX4-DOC-0.38.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Read [Clock guide](en/experiments/spine-f1/README.md), [saved verification](evidence/spine-f1-clock-verification.json) and [pending public projection](evidence/spine-f1-clock-public-projection.json).

### 中文 / Chinese

## 工程预览 0.37.0 — 可选 F1 Clock 候选

**S090 / V041** 登记原创 F1 Clock 实验；**D017 仍为 proposed**，仅涉及实验的受信会话及显式可选出处。已保存私有 CPU 执行通过 **10/10** Clock 用例，包含具名推进后故障；**3** 项指定错误副本对照各有新基线。原手动 **12/12** 保持不变。已保存私有桌面 WebGPU 执行通过 **10** 次正例回读及 **1** 次独立重复推进对照：**30** 个原始正例采样点、**120** 个通道、容差 **0**，并观察完整字节重复与限定清理。各阶段数量不与历史运行相加。

**公开 Clock 可移植源码／重放、当前完整门禁、最终双语评审、必要推送及 0.37.0 交付，在本次策展截止时均为 PENDING。** 私有结果不能替代这些步骤。下方 0.36.0 段落保留历史 pending 截止状态；0.36.0 后续已通过 [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23) 交付，Main 为 `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`。

官方外置 `@esotericsoftware/spine-core@4.3.13` 明确署名，不打包、不改许可。集成／分发资格仍未核实。完整 Spine **R020/V020 继续 OPEN**；上述观察不构成手机／Native SDK、物理 GPU、操作系统进程退役、性能／能耗或完整产品验收。

阅读 [Clock 指南](Cns/experiments/spine-f1/README.md)、[已保存核验](evidence/spine-f1-clock-verification.json)和[待完成公开投影](evidence/spine-f1-clock-public-projection.json)。
A subsequent actual replay of the public source in an independent clone passed manual **12/12** with **6** original controls and full Clock **10/10** with **3** assigned controls; the named fault actually executed, with **0** skipped accepted cases. Separate default-headless WebGPU execution passed **10+1** readbacks, **30** positive samples and **120** channels at tolerance **0**, retaining original full-byte relations and bounded cleanup. Cold import/help observed **280** modules and **0** Core/GPU/host accesses. The saved CPU collection retains its earlier native-pending cutoff; the separate native receipt is the actual successor. Original source and input identities remained unchanged. Independent saved-result review, final repository gates and delivery remain PENDING here; full Spine **R020/V020 remains OPEN**. See the current successor in the linked Clock verification/projection records.
<!-- F1C-DOC-0.37.0-END -->

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](en/experiments/spine-f1/README.md), [verification](evidence/spine-f1-manual-verification.json) and [projection provenance](evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

### 中文 / Chinese

<!-- SP1B-DOC-0.36.0-BEGIN -->
## 工程预览 0.36.0 — 原创 F1 Spine 实验

可选的原创两区域手动动画桥接接入真实资源与自有 Mesh2D 几何。可移植 CPU 执行通过 **12/12** 项原始测试及 **6** 项指定错误对照，各项均先通过全新基线。完整 Spine **R020/V020 继续 OPEN**。

另行浏览器 WebGPU 桌面验证记录 **8** 次正例提交及 **1** 项重复推进指定错误对照；独立的 **3** 次读回分类 actor 验证 `PIXEL_FAIL`，各组结果不合计。已准备的公开 CPU／浏览器复现工具也在一个新 clone 通过相同 **8+1** profile；这是重复观察，不增加特性覆盖。其有限独立评审有 **0** 项开放问题。公开 checkout 也通过相同 CPU／浏览器 profile。**本截止点，最终公开门禁及 0.36.0 交付继续 PENDING。** 精确 profile、原创 oracle、来源条款及后续 UI／runtime／创作／迁移工作见[实验指南](Cns/experiments/spine-f1/README.md)、[验证](evidence/spine-f1-manual-verification.json)与[投影出处](evidence/spine-f1-public-projection.json)。

前一版本 **0.35.0** 已经 [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22) 实际交付；其记录的门禁及 Main 身份见指南／证据。远端 **0** 项状态和 **0** 项检查任务不证明 CI 通过。以下早先 PENDING 截止点继续保留为历史。
<!-- SP1B-DOC-0.36.0-END -->


This is an evolving open-source engineering project. Documents distinguish design proposals, implemented slices, recorded tests and open validation work. Language-specific reading files live in `en/` and `Cns/`; shared code, original evidence and upstream legal notices keep their own provenance.

## 中文简介

白鹭重构工程面向全球开源社区。完整[中文知识库](Cns/README.md)位于 `Cns/`，完整[英文知识库](en/README.md)位于 `en/`。阅读文档明确区分设计提案、局部实现、已有验证与尚待验证的工作。
