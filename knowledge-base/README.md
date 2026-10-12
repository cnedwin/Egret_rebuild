# Egret Rebuild knowledge base

English | [简体中文](README.zh-CN.md)

Explore the [English knowledge base](en/README.md), [technical white paper](en/docs/technical-white-paper.md), [product requirements](en/docs/product-requirements.md), [engineering plan](en/docs/engineering-plan.md), and [contribution guide](en/CONTRIBUTING.md).
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
