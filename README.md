# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Changelog

### English

These are engineering and knowledge-base checkpoints, newest first, rather than npm or production releases. Workspace packages remain private at `0.0.0`; protocol pins remain `1.0`. Each result belongs to its recorded source and test scope.

| Checkpoint | Main problem addressed | Record |
| --- | --- | --- |
| Unreleased | English-first community entry, separate `en/` and `Cns/` knowledge-base editions, English filenames, founder introduction and bilingual Changelog. Simplified document entries and grouped historical research for easier navigation. | [Details](knowledge-base/en/docs/documentation-layout.md) |
| 0.21.0 | Public logical display coordinate queries, fresh immutable results, exact stored-matrix inverse and explicit ancestor/lifetime budgets. CPU/type and affected desktop regression results have separate recorded scopes. | [Details](knowledge-base/en/docs/display-coordinate-query-contract.md) |
| 0.20.0 | Public explicit-time SequencePlayer with once/loop selection, exact borrowed lease and immutable samples; a public browser verifier and example. Focused behavior/type and opaque Canvas/WebGPU observations have separate recorded scopes. | [Details](knowledge-base/en/docs/sequence-player-contract.md) |
| 0.19.0 | Bitmap atlas regions and sequence-sample placement; reproducible B1 browser checks and preserved texture-collection evidence. Bitmap CPU checks passed; visible sequence playback and texture numeric bounds remain open. | [Details](knowledge-base/en/docs/bitmap-region-evidence.md) |
| 0.18.0 | Bounded CPU conversion of a named legacy MovieClip, preserving atlas crops, offsets and authored hold durations. Image decoding and playback remain unverified. | [Details](knowledge-base/en/docs/legacy-movieclip-evidence.md) |
| 0.17.0 | Owned CPU scene snapshots, fixed mesh helpers, bounded B1 host source/mock integration, CPU sequence sampling and RES conversion intents. | [Details](knowledge-base/en/docs/b1-host-evidence.md) |
| 0.16.0 | Bounded image-source/mock logic, CPU texture reference formulas, 3D math/geometry/packing and legacy RES declaration analysis. | [Details](knowledge-base/en/docs/core-progress.md) |
| 0.15.0 | Immutable ImageData2D, Texture, lease-borrowing Bitmap, saved mixed frames and clipping/vertex preparation with UVs. This checkpoint covers CPU texture preparation. | [Details](docs/texture-a1.md) |
| 0.14.0 | Headless project transaction core: immutable authored snapshots, atomic edits/retries and retained-target restoration through canonical journals. | [Details](knowledge-base/en/docs/project-transaction-core-evidence.md) |
| 0.13.0 | Opt-in WebGPU rectangle execution, independent WGSL preparation and host lifetime handling, with bounded desktop browser verification. | [Details](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md) |
| 0.12.0 | Display transforms, inherited visibility/alpha, rectangle clipping, Sprite Graphics fills, immutable frame capture and the separate Canvas adapter. | [Details](knowledge-base/en/docs/display-and-frame-implementation-record.md) |
| 0.11.0 | CPU asset management: typed references, shared acquisition, waiter cancellation, independent leases, generation isolation and Scope/Engine cleanup. | [Details](knowledge-base/en/docs/resource-core-implementation-record.md) |
| 0.10.0 | Mandatory bilingual documentation, critical English code comments and public-content checks before every push. | [Details](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) |
| 0.9.0 | Community contribution rules, source attribution and a local repository candidate combining core code with the knowledge base. | [Details](knowledge-base/en/CHANGELOG.md) |
| 0.8.0 | First independent core slice: three packages, typed events, display-tree/lifecycle logic, headless Engine and actual strict build/behavior checks. | [Details](knowledge-base/en/docs/core-framework-implementation-record.md) |
| 0.7.0 | Modern package structure, public API/naming contracts and code-quality gates while retaining Egret conventions. | [Details](knowledge-base/en/docs/engineering-architecture-and-project-structure.md) |
| 0.6.2 | Source-backed research into Shaders and Playground for effect assets and continuously editable AI creation workflows. Research only. | [Details](knowledge-base/en/docs/shaders-and-playground-lessons.md) |
| 0.6.1 | Independent implementation and dependency policy, with explicit references, attribution and implementation-origin records. | [Details](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md) |
| 0.6.0 | Candidate selection for graphics backends, fast compilation and modular Native Runtime. Language/backend choices remain proposals. | [Details](knowledge-base/en/docs/graphics-backends-and-native-runtime-selection.md) |
| 0.5.0 | A bounded third-party Three.js real-asset research chain covering skinning, animation, text UI, resource release and context recovery. | [Details](knowledge-base/en/archive/round-3-research.md) |
| 0.4.0 | Fixed-version open-source reference research and a plan for assets, fonts/atlases, compression, animation and resource ownership. | [Details](knowledge-base/en/docs/open-source-reference-implementations-and-adoption.md) |
| 0.3.0 | Contract and browser research on events, resources, nested UI and batching, with retained counterexamples and corrections. | [Details](knowledge-base/en/archive/round-2-research.md) |
| 0.2.0 | Initial technical white paper, product requirements and engineering plan, plus the first verification and independent audit records. | [Details](knowledge-base/en/docs/technical-white-paper.md) |
| 0.1.0 | Structured knowledge base for confirmed requirements, candidate decisions, hypotheses, sources and delivery goals. | [Details](knowledge-base/en/CHANGELOG.md) |

### 中文

以下按从新到旧排列工程与知识库检查点，不代表 npm 或生产发行。工作区包仍为 private、版本 `0.0.0`，协议固定值仍为 `1.0`；各项结果仅适用于其记录的源码和验证范围。

| 检查点 | 主要解决的问题 | 记录 |
| --- | --- | --- |
| 未发行 | 英文优先的社区入口、独立的 `en/` 与 `Cns/` 知识库、英文文件名、创始人介绍与双语 Changelog。精简文档入口，集中历史研究，便于查阅。 | [详情](knowledge-base/Cns/docs/documentation-layout.md) |
| 0.21.0 | 公共逻辑显示坐标查询、全新不可变结果、已存储矩阵精确逆算及明确祖先／生命周期预算。CPU／类型与受影响桌面回归分别记录范围。 | [详情](knowledge-base/Cns/docs/显示坐标查询契约.md) |
| 0.20.0 | 公共显式时间 SequencePlayer，提供 once／loop 选帧、精确借用租约与不可变采样；附公共浏览器验证器和示例。行为／类型检查与 Canvas／WebGPU 不透明观察分别记录范围。 | [详情](knowledge-base/Cns/docs/显式时间序列播放器契约.md) |
| 0.19.0 | Bitmap 图集区域与序列采样定位；可复现的 B1 浏览器检查与纹理采集证据。Bitmap CPU 检查已通过，可见序列播放及纹理数值边界仍待验证。 | [详情](knowledge-base/Cns/docs/bitmap-region-evidence.md) |
| 0.18.0 | 具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、偏移与作者持续段时间。图片解码和播放仍未验证。 | [详情](knowledge-base/Cns/docs/legacy-movieclip-evidence.md) |
| 0.17.0 | 自有 CPU 场景快照、固定网格辅助逻辑、有界 B1 宿主源码与模拟集成、CPU 序列采样及 RES 转换意图。 | [详情](knowledge-base/Cns/docs/b1-host-evidence.md) |
| 0.16.0 | 有界图像源码与模拟逻辑、CPU 纹理参考公式、3D 数学／几何／打包以及旧 RES 声明分析。 | [详情](knowledge-base/Cns/docs/core-progress.md) |
| 0.15.0 | 不可变 ImageData2D、Texture、借用租约的 Bitmap、混合帧快照及带 UV 的裁剪／顶点准备。本检查点覆盖 CPU 纹理准备。 | [详情](docs/texture-a1.zh-CN.md) |
| 0.14.0 | 无界面工程事务核心：不可变创作快照、原子编辑与重试，以及基于规范日志恢复保留目标。 | [详情](knowledge-base/Cns/docs/工程事务核心实现证据.md) |
| 0.13.0 | 独立入口的 WebGPU 矩形执行、自主 WGSL 准备与宿主生命周期处理，并完成有界桌面浏览器验证。 | [详情](knowledge-base/Cns/docs/WebGPU矩形实现证据.md) |
| 0.12.0 | 显示变换、继承可见性／透明度、矩形裁剪、Sprite Graphics 填充、不可变帧捕获及独立 Canvas 适配器。 | [详情](knowledge-base/Cns/docs/显示与帧执行实现记录.md) |
| 0.11.0 | CPU 资源管理：类型化引用、共享获取、等待取消、独立租约、代次隔离及 Scope／Engine 清理。 | [详情](knowledge-base/Cns/docs/资源核心实现记录.md) |
| 0.10.0 | 每次推送前必须补齐双语文档、关键代码英文注释和公开内容检查。 | [详情](knowledge-base/Cns/docs/双语文档与推送前检查.md) |
| 0.9.0 | 社区贡献规则、来源归属，以及整合核心代码和知识库的本地仓库候选。 | [详情](knowledge-base/Cns/CHANGELOG.md) |
| 0.8.0 | 首批自主核心：三个包、类型化事件、显示树／生命周期逻辑、无界面 Engine 及实际严格编译和行为检查。 | [详情](knowledge-base/Cns/docs/核心框架实现记录.md) |
| 0.7.0 | 在保留白鹭命名习惯的基础上，制定现代包结构、公共 API／命名合同和代码质量门禁。 | [详情](knowledge-base/Cns/docs/工程技术架构与项目结构.md) |
| 0.6.2 | 基于来源研究 Shaders 与 Playground 的效果资产及可持续编辑的 AI 创作流程；属于研究工作。 | [详情](knowledge-base/Cns/docs/Shaders与Playground产品技术启发.md) |
| 0.6.1 | 自主实现与依赖规范，明确参考出处、归属及实现来源记录。 | [详情](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md) |
| 0.6.0 | 图形后端、快速编译及模块化 Native Runtime 的候选选型；语言和后端选择仍为提案。 | [详情](knowledge-base/Cns/docs/图形后端编译与原生Runtime选型.md) |
| 0.5.0 | 有界的第三方 Three.js 真实资产研究链，覆盖蒙皮、动画、文字 UI、资源释放和上下文恢复。 | [详情](knowledge-base/Cns/archive/第三轮研究.md) |
| 0.4.0 | 固定版本开源参考研究，规划资产、字体／图集、压缩、动画与资源所有权。 | [详情](knowledge-base/Cns/docs/开源参考实现与采用方案.md) |
| 0.3.0 | 事件、资源、嵌套 UI 与合批的合同及浏览器研究，保留反例和修正。 | [详情](knowledge-base/Cns/archive/第二轮研究.md) |
| 0.2.0 | 首批技术白皮书、产品需求与工程规划，以及第一轮验证和独立审计记录。 | [详情](knowledge-base/Cns/docs/技术白皮书.md) |
| 0.1.0 | 建立结构化知识库，登记确认需求、候选决策、假设、来源和交付目标。 | [详情](knowledge-base/Cns/CHANGELOG.md) |

## Current scope and participation

The current engineering preview is **0.21.0**. We are rebuilding an open-source game engine and creation workflow for people who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. The repository contains an experimental core and a structured knowledge base. The complete engine, production platform hosts, editor, Agent services, target-device performance and complete legacy-project migration still require implementation or acceptance.

Contributors worldwide are welcome to help with implementation, reproducible bugs and fixes, documentation and translations, API proposals, and game or migration samples they own or are authorized to share. Start with the [contribution guide](CONTRIBUTING.md), [English knowledge base](knowledge-base/en/README.md), [Chinese knowledge base](knowledge-base/Cns/README.md), [document index](DOCUMENTATION.md), [source records](source-origin.json) and [acknowledgements](ACKNOWLEDGEMENTS.md).

## Running and verifying

Pinned tools: Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2. Run from the repository root:

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

Before every push, review both language editions, source attribution and public content, complete critical English code comments, and run the full pre-push checks. Browser rendering, device performance and complete migration require their own scoped verification. See the [publication policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md).

First-party code and documentation use [Apache-2.0](LICENSE); third-party dependencies and assets retain their original notices and attribution.
