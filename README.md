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
| 0.31.0 | Scope-owned resource acquisition groups with 0–128 occurrences and a 1–16 local waiter window. Adopted build/example and CPU 86/86 (29 RG1 + 57 retained), private exact strict types and finite policy 35/35 passed; seven retained desktop profiles passed their existing subsets. Complete verification, bilingual/publication, push hook and RG1 delivery successors are tracked in the [verification record](knowledge-base/evidence/resource-acquisition-groups-verification.json). | [Reading](knowledge-base/en/docs/resource-acquisition-groups.md) |
| 0.30.0 | Existing Stage picking, typed dispatch and Canvas rendering composed into a small application; 12/12 public-entry headless checks passed. Desktop mouse/Canvas input, pixels and five controls passed the fixed subset; 32/32 pure admission checks passed separately. Complete local verification passed: core 2377/2377 and structural publication 63/63; final independent meaning, actual Git push hook and delivery remain pending. | [Example](knowledge-base/en/docs/display-picking-example.md) |
| 0.29.0 | Authored rectangular Stage picking, whole-tree budgets, half-open local clips and explicit input flags. Targeted CPU 98/98, strict types, 426-file boundaries and 221/221 policy records passed; complete core 2,333/2,333, publication 59/59 and six existing desktop renderer regressions passed. Picking supplement, bilingual meaning, Git push hook and delivery remain pending. | [Details](knowledge-base/en/docs/display-hit-test-ht1.md) |
| 0.28.0 | Explicit Canvas-only WC1 text provider, caller-owned fonts and exact native raster/frame controls. 2,285 core and 59 publication tests, build, strict types and complete current checks passed alongside the bounded desktop Canvas subset; bilingual review passed with 0 open findings; the mandatory Git push hook and delivery remain pending. | [Details](knowledge-base/en/docs/canvas-text-wc1-canvas.md) |
| 0.27.2 | Bounded display-tree attachment, direct child-list reads and tail detach. 2,228 core tests, 52 publication tests and all five existing desktop browser regressions passed; delivery is recorded separately. | [Details](knowledge-base/en/docs/display-tree-scaling.md) |
| 0.27.1 | Owned ByteReader with explicit byte order and atomic bounded reads/copy-out. Main integration and 2,219 core tests passed; merged through [PR #13](https://github.com/cnedwin/Egret_rebuild/pull/13). | [Contract](knowledge-base/en/docs/byte-reader-br1-contract.md) · [Evidence](knowledge-base/en/docs/byte-reader-br1-evidence.md) |
| 0.27.0 | Explicit-line CPU TextField, genuine Scope/cache ownership, atomic preparation and display-resource cleanup. Complete existing core checks passed; native and delivery gates remain separate. | [Contract](knowledge-base/en/docs/text-field-tf1-contract.md) · [Evidence](knowledge-base/en/docs/text-field-tf1-evidence.md) |
| 0.26.0 | Scope-owned scalar Tween, four built-in easings and one-shot controls; game time and rendering remain explicit. Core checks passed; final publication and delivery are separate. | [Contract](knowledge-base/en/docs/scalar-tween-contract.md) · [Evidence](knowledge-base/en/docs/scalar-tween-evidence.md) |
| 0.25.0 | Engine-owned explicit game time in seconds, bounded Scope-owned callbacks and phase-safe cleanup; callers retain control of rendering and sequence sampling. Public behavior, strict types, source controls and the 2,076-test core run have separately recorded cutoffs. | [Details](knowledge-base/en/docs/game-clock-evidence.md) |
| 0.24.0 | DOM-free text-provider orchestration, fixed resource slots and budgets, genuine Texture leases and terminal cleanup. Six core findings closed; strict types and complete existing core-source verification passed, including 2,037/2,037 tests, with earlier failures preserved. Final prepush and delivery are recorded separately in delivery verification. | [Details](knowledge-base/en/docs/text-raster-t1-evidence.md) |
| 0.23.0 | Owned textured geometry and Mesh2D, immutable textured frames and explicit WebGPU execution. Fixed desktop pixels, copied controls and affected legacy routes have bounded independent review; public reproduction and final delivery are separate. | [Details](knowledge-base/en/docs/textured-profile-cpu-evidence.md) |
| 0.22.0 | Receiver-local content bounds: owned readonly results, explicit budgets and ordinary binary64 nonconservative measurement. Actual checks and affected desktop scope are recorded separately. | [Details](knowledge-base/en/docs/display-content-bounds-contract.md) |
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
| 0.31.0 | Scope 所有的资源批量获取：0–128 个输入位置、1–16 局部等待窗口。已采用构建/示例与 CPU 86/86（29 项 RG1 + 57 项既有）、私有精确严格类型和有限策略 35/35 通过；七项既有桌面 profile 在原子集通过。完整验证、双语/公开、推送钩子及 RG1 交付后继由[核验记录](knowledge-base/evidence/resource-acquisition-groups-verification.json)跟踪。 | [阅读](knowledge-base/Cns/docs/资源批量获取.md) |
| 0.30.0 | 将既有 Stage 拾取、类型化分发与 Canvas 渲染组合成小型应用，公共入口无界面检查通过 12/12。桌面鼠标／Canvas 输入、像素与五项对照通过固定子集；纯准入检查单独通过 32/32。完整本地验证通过：核心 2377/2377 与结构化公开检查 63/63；最终独立语义、实际 Git 推送钩子及交付待完成。 | [示例](knowledge-base/Cns/docs/显示拾取示例.md) |
| 0.29.0 | 自定义矩形 Stage 命中、整树预算、半开局部裁剪与显式输入标志。专项 CPU 98/98、严格类型、426 文件边界及 221/221 策略记录通过；完整核心 2,333/2,333、公开检查 59/59 及六项既有桌面渲染回归通过。命中补充、双语语义、Git 推送钩子与交付待完成。 | [详情](knowledge-base/Cns/docs/显示命中HT1.md) |
| 0.28.0 | 显式仅 Canvas WC1 文字提供者、调用方字体与精确原生栅格／帧控制。2,285 项核心及 59 项公开检查、构建、严格类型和完整当前检查与有界桌面 Canvas 子集均通过；双语审阅通过且未解决问题为 0；必要 Git 推送钩子及交付仍待完成。 | [详情](knowledge-base/Cns/docs/Canvas文字WC1.md) |
| 0.27.2 | 有界显示树挂接检查、直接子列表读取与尾部分离优化。2,228 项核心测试、52 项公开检查和五项既有桌面浏览器回归通过；远程交付单独记录。 | [详情](knowledge-base/Cns/docs/显示树扩展性.md) |
| 0.27.1 | 自有 ByteReader、显式字节序及原子有界读取／复制。Main 整合与 2,219 项核心测试通过，已通过 [PR #13](https://github.com/cnedwin/Egret_rebuild/pull/13) 合并。 | [契约](knowledge-base/Cns/docs/字节读取器BR1契约.md) · [证据](knowledge-base/Cns/docs/字节读取器BR1证据.md) |
| 0.27.0 | 显式行 CPU TextField、真实 Scope／cache 所有权、原子准备及显示资源清理。完整既有核心检查已通过；原生及交付门禁另记。 | [契约](knowledge-base/Cns/docs/文字显示TF1契约.md) · [证据](knowledge-base/Cns/docs/文字显示TF1证据.md) |
| 0.26.0 | Scope 所有的标量 Tween、四种内建缓动与一次性控制；游戏时间与渲染仍显式执行。核心检查已通过；最终公开门禁与交付另记。 | [契约](knowledge-base/Cns/docs/标量补间契约.md) · [证据](knowledge-base/Cns/docs/标量补间证据.md) |
| 0.25.0 | Engine 自有的显式秒制游戏时间、有界 Scope 回调及阶段安全清理；渲染与序列采样由调用者显式控制。公共行为、严格类型、源码对照及 2,076 项核心测试分别保留验证范围。 | [详情](knowledge-base/Cns/docs/游戏时间核心证据.md) |
| 0.24.0 | 无 DOM 文字 provider 编排、固定资源槽位与预算、真实 Texture 租约及终结清理。六项核心问题关闭，严格类型及完整既有核心源码验证通过，包括 2,037/2,037 测试，并保留此前失败。最终 prepush 与交付在交付验证中分别记录。 | [详情](knowledge-base/Cns/docs/文字栅格T1证据.md) |
| 0.23.0 | 自有纹理几何与 Mesh2D、不可变纹理帧及显式 WebGPU 执行。固定桌面像素、复制对照与受影响旧链路分别完成有界独立审阅；公开复现与最终交付单独记录。 | [详情](knowledge-base/Cns/docs/纹理Profile的CPU证据与待完成门禁.md) |
| 0.22.0 | 接收者局部内容边界：自有只读结果、显式预算与普通 binary64 非保守测量；实际检查及受影响桌面范围分别记录。 | [详情](knowledge-base/Cns/docs/显示内容边界契约.md) |
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

The latest engineering preview is **0.31.0**, adding Scope-owned resource acquisition groups for resource-backed scenes. The adopted working-tree build, two-texture CPU example and **86/86** combined checks passed (**29** RG1 and **57** retained resource/lifecycle cases). Private strict types bind **15** ordinary and **11** import negatives to exact unsuppressed diagnostics; corrected finite policy controls passed **35/35**. Seven retained desktop browser profiles passed their existing subsets and do not exercise a group-based browser application. Earlier **28/29**, **34/35** and current **29/86** results overlap and are not summed. The [shared verification record](knowledge-base/evidence/resource-acquisition-groups-verification.json) tracks complete current checks, bilingual/publication review, the mandatory push hook and RG1 remote delivery successors. First-party code remains Apache-2.0, with no added dependency; private packages stay `0.0.0`, protocol `1.0`. Read the [combined contract, usage and bounded evidence](knowledge-base/en/docs/resource-acquisition-groups.md). Full Spine under R020/V020, complete UI/3D, phones, performance, physical resource reclamation and migration remain separate unfinished acceptance obligations.

The following paragraph preserves the earlier 0.30.0 preparation cutoff; its separate delivery is recorded in [PR #17](https://github.com/cnedwin/Egret_rebuild/pull/17).

The latest engineering preview is **0.30.0**, adding a small display-picking application that composes the existing Stage, typed events and CanvasHost. The actual adopted public-entry headless run passed 12/12; private execution and independent core review are recorded separately, and overlapping counts are not summed. It covers authored overlap/clips, literal half-open boundaries, CSS mouse coordinates, one post-dispatch repaint/render and bounded startup/close ownership. The fresh desktop successor passed **PASS_DESKTOP_HT1_CANVAS_SUBSET** in default Edge **154.0.4258.62**: ten baseline rows and five assigned controls cover real mouse input, typed routes, Canvas pixels and an independent six-pair native listener ledger. Pure admission checks passed **32/32** separately; counts from these scopes are not summed. Complete local verification passed: build, type fixtures and package boundaries; core **2377/2377** and structural publication **63/63**. Localization checked **140** pairs, **6** registry views and **154** critical source files. Knowledge-base validation checked **159** records, **243** Markdown files, **1997** links and **955** references with **0** issues; the headless lifecycle closed with **0** pending timers. These are separate scopes, not a combined test count. Final independent bilingual meaning review, the mandatory Git push hook and delivery remain **PENDING**. This is a fixed desktop mouse/Canvas subset; phones, OS/physical reclamation, performance and full input/UI/Spine acceptance remain separate. Packages remain private `0.0.0`, protocol `1.0`. Read the [example record](knowledge-base/en/docs/display-picking-example.md) and [running guide](examples/hit-test/README.md). We are rebuilding an open-source game engine and creation workflow for people who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. The repository contains an experimental core and a structured knowledge base. The complete engine, production platform hosts, editor, Agent services, target-device performance and complete legacy-project migration still require implementation or acceptance.

The **0.29.0** HT1 delivery successor passed the mandatory push hook with 2,333 core and 59 publication tests and was merged through [PR #16](https://github.com/cnedwin/Egret_rebuild/pull/16) to Main `fb7f15b21cf80345e23490c551552deb4b68061a`, tree `e79ad52bf85a1efa7835a1d4074c5a4368ca8981`. The recorded source commit is `6e724971938ec8be4d271066f327814394e0b7fb`. Remote status/check counts were both 0; no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

The **0.28.0** Canvas text delivery successor passed the mandatory push hook with 2,285 core and 59 publication tests and was merged through [PR #15](https://github.com/cnedwin/Egret_rebuild/pull/15) to Main `b704349207c536d2bdae38496ef622613355a3f4`, tree `d1b4fcd5629c2fe54455244534220c50e0cdc419`. The recorded source commit is `94f239b2d1bd6b1af6f63ebc4f375bc7c9894bca`. Remote status/check counts were both 0, so no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

The prior **0.27.2** display-tree increment passed 2,228 core tests, 52 publication tests and all five affected existing browser gates, then was delivered through [PR #14](https://github.com/cnedwin/Egret_rebuild/pull/14) to Main `b8446d23d6cf8b979d05d35757876811fe190e7a`. Those results retain that source cutoff.

`ByteReader` and the frozen `BYTE_READER_LIMITS` are shared values at the engine and runtime roots; `ByteOrder` is type-only. A reader owns a fixed snapshot, supports explicit byte order, rejects out-of-range reads atomically and returns independent copies. Read the [contract](knowledge-base/en/docs/byte-reader-br1-contract.md) and [bounded evidence](knowledge-base/en/docs/byte-reader-br1-evidence.md).

The 0.27.0 engineering preview adds a factory-owned, noneditable TextField through `@egret/engine/text`: `createTextField(engine, scope, cache)` and type-only `TextField`/`TextFieldStatus`. Ten-scalar requests, explicit preparation, revision replacement and coalesced caller leases follow genuine Engine/Scope/cache affinity. Committed images and blank direct bounds participate in both image-capable collectors under existing budgets; legacy image refusal is preserved. Default roots remain unchanged. Read the [contract](knowledge-base/en/docs/text-field-tf1-contract.md) and [evidence](knowledge-base/en/docs/text-field-tf1-evidence.md).

`engine.createTween(scope, options)` provides one-shot start/pause/resume/stop, synchronous scalar callbacks and Scope/Engine cleanup, with `linear`, `quadIn`, `quadOut`, `quadInOut`. It uses the prior 0.25.0 game clock: advancement never renders, and capture/render never advances time. Read the [scalar contract](knowledge-base/en/docs/scalar-tween-contract.md) and [bounded evidence](knowledge-base/en/docs/scalar-tween-evidence.md).

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
