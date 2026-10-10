# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

### English introduction

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

## Changelog / 更新记录

### 中文

以下按从新到旧排列工程与知识库检查点，不代表 npm 或生产发行。工作区包仍为 private、版本 `0.0.0`，协议固定值仍为 `1.0`；各项结果仅适用于其记录的源码和验证范围。

| 检查点 | 主要解决的问题 | 记录 |
| --- | --- | --- |
| 未发行 | 英文优先的社区入口、独立的 `en/` 与 `Cns/` 知识库、英文文件名、创始人介绍与双语 Changelog。 | [详情](knowledge-base/Cns/docs/documentation-layout.md) |
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
| 0.5.0 | 有界的第三方 Three.js 真实资产研究链，覆盖蒙皮、动画、文字 UI、资源释放和上下文恢复。 | [详情](knowledge-base/Cns/docs/第三轮集成记录.md) |
| 0.4.0 | 固定版本开源参考研究，规划资产、字体／图集、压缩、动画与资源所有权。 | [详情](knowledge-base/Cns/docs/开源参考实现与采用方案.md) |
| 0.3.0 | 事件、资源、嵌套 UI 与合批的合同及浏览器研究，保留反例和修正。 | [详情](knowledge-base/Cns/docs/第二轮验证记录.md) |
| 0.2.0 | 首批技术白皮书、产品需求与工程规划，以及第一轮验证和独立审计记录。 | [详情](knowledge-base/Cns/docs/技术白皮书.md) |
| 0.1.0 | 建立结构化知识库，登记确认需求、候选决策、假设、来源和交付目标。 | [详情](knowledge-base/Cns/CHANGELOG.md) |

### English

These are engineering and knowledge-base checkpoints, newest first, rather than npm or production releases. Workspace packages remain private at `0.0.0`; protocol pins remain `1.0`. Each result belongs to its recorded source and test scope.

| Checkpoint | Main problem addressed | Record |
| --- | --- | --- |
| Unreleased | English-first community entry, separate `en/` and `Cns/` knowledge-base editions, English filenames, founder introduction and bilingual Changelog. | [Details](knowledge-base/en/docs/documentation-layout.md) |
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
| 0.5.0 | A bounded third-party Three.js real-asset research chain covering skinning, animation, text UI, resource release and context recovery. | [Details](knowledge-base/en/docs/round-3-integration-record.md) |
| 0.4.0 | Fixed-version open-source reference research and a plan for assets, fonts/atlases, compression, animation and resource ownership. | [Details](knowledge-base/en/docs/open-source-reference-implementations-and-adoption.md) |
| 0.3.0 | Contract and browser research on events, resources, nested UI and batching, with retained counterexamples and corrections. | [Details](knowledge-base/en/docs/round-2-validation-record.md) |
| 0.2.0 | Initial technical white paper, product requirements and engineering plan, plus the first verification and independent audit records. | [Details](knowledge-base/en/docs/technical-white-paper.md) |
| 0.1.0 | Structured knowledge base for confirmed requirements, candidate decisions, hypotheses, sources and delivery goals. | [Details](knowledge-base/en/CHANGELOG.md) |

## 当前范围与参与方式

当前工程预览为 **0.19.0**。我们正在为主要依靠 AI 制作游戏的创作者，重建开源游戏引擎与创作流程，首期方向涵盖复杂 2D UI 与轻量 3D。仓库包含实验性核心和结构化知识库；完整引擎、生产平台宿主、编辑器、Agent 服务、目标设备性能及完整旧工程迁移仍待实施或验收。

欢迎全球开发者参与实现、可复现问题与修复、文档翻译、API 提案，以及自有或获授权的游戏和迁移样本。请先阅读[贡献指南](CONTRIBUTING.zh-CN.md)、[中文知识库](knowledge-base/Cns/README.md)、[英文知识库](knowledge-base/en/README.md)、[文档索引](DOCUMENTATION.zh-CN.md)、[来源记录](source-origin.json)和[鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)。

## 运行与验证

固定工具版本：Node.js 24.19.0、pnpm 11.25.0、TypeScript 7.0.2。在仓库根目录执行：

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

每次推送前，审阅两种语言的文档、来源归属与公开内容，补齐关键代码英文注释，并运行完整推送前检查。浏览器渲染、设备性能和完整迁移需要各自范围内的验证。参阅[推送前规范](knowledge-base/Cns/docs/双语文档与推送前检查.md)。

第一方代码与文档采用 [Apache-2.0](LICENSE)，第三方依赖和资产保留原始声明及归属。

<details>
<summary>详细历史工程记录</summary>

下列段落保留原编写检查点的记录。其中 UNRUN、pending 或 HOLD_HTTP_403 等状态属于相应历史检查点，不覆盖后续已核验的提交和 PR。本次 README 调整不重跑浏览器／设备测量，也不提升产品验收状态。

## 当前本地工程增量：0.19.0

阅读已实施的[Bitmap 区域契约](knowledge-base/Cns/docs/bitmap-region-contract.md)和[CPU 证据](knowledge-base/Cns/docs/bitmap-region-evidence.md)、[纹理首四项采集](knowledge-base/Cns/docs/texture-first-four-evidence.md)，以及[可复现的 B1 浏览器验证器](knowledge-base/Cns/docs/b1-browser-verifier.md)。Bitmap 专项检查通过 113/113。公开 B1 命令记录 7 帧正例、5 项反例、11 次绘制和 8214 项字面量比较；有界保存产物的独立复核已接受。纹理采集完整性已接受，数值边界为 UNKNOWN，完整 A2 未完成。

本证据整理不包含后继完整 prepush，推送前必须另行通过新检查。可见 Bitmap 序列播放、设备／性能／完整迁移门禁仍开放。这是本地工程标签，不是发行版本，包 0.0.0／协议 1.0 不变；此前记录保留各自日期、身份和范围。

## 历史本地工程预览：0.18.0

新增单个具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、显示偏移和作者持续段时间；28/28 专项测试通过，输出已由真实序列帧工厂重新准入。阅读[契约](knowledge-base/Cns/docs/legacy-movieclip-contract.md)、[证据](knowledge-base/Cns/docs/legacy-movieclip-evidence.md)和[精简记录](knowledge-base/evidence/legacy-movieclip-focused.json)。API 保持内部使用，图片读取、解码和播放仍未验证。

0.17.0 及更早结果保留为各自源码身份下的历史证据。此次增量的默认模式、全仓回归和完整 prepush 未运行；当前浏览器／设备像素、性能及完整 R008/V006 迁移仍待验收。0.18.0 是本地工程标签，包 0.0.0／协议 1.0 不变；GitHub 交付继续保持 HOLD_HTTP_403。

## 历史本地工程预览：0.17.0

本预览新增自有 CPU 场景快照、固定网格辅助函数、有界 B1 宿主源码／模拟整合、CPU 序列帧采样与纯 RES 转换意图。阅读[CPU 场景](knowledge-base/Cns/docs/3d-cpu-scene-contract.md)、[网格](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md)、[宿主](knowledge-base/Cns/docs/b1-host-contract.md)、[序列帧](knowledge-base/Cns/docs/sequence-clip-contract.md)及[RES 意图](knowledge-base/Cns/docs/legacy-res-plan-contract.md)与配对证据。这些接口保持内部使用；公开入口与包 0.0.0／协议 1.0 不变。

已记录默认宿主验证通过 13/13 项，CPU 序列帧采样通过 25/25，RES 意图规划通过 14/14。所选整仓运行通过 901/901 项测试、编译、282 个边界文件及类型门禁；901 项包含宿主回归。源码绑定、仅格式后继及保留的早期失败见[配对宿主证据](knowledge-base/Cns/docs/b1-host-evidence.md)。此次文档采用未重跑产品检查。

GitHub 交付因已记录的 403 响应保持 HOLD；当前文档最终审阅与完整 prepush 仍待完成。此前 0.13.0–0.16.0 检查点保留身份及结果。Native SDK、当前浏览器／设备像素、性能、字体、DragonBones、完整 R008/V006 迁移、V003／编辑器及完整产品验收仍未验证或保持开放。

## 历史本地工程预览：0.16.0

当前增量覆盖已接受的有界图片源码／模拟逻辑、CPU 纹理参考公式、CPU 3D 数学／几何／打包，以及旧 RES 声明分析。阅读[核心进展](knowledge-base/Cns/docs/core-progress.md)、[3D CPU 基础](knowledge-base/Cns/docs/3d-foundation.md)和[旧 RES 声明](knowledge-base/Cns/docs/legacy-res-declarations.md)，查看契约、准确历史证据与开放任务。标签为工程预览；包 0.0.0 与协议 1.0 不变。最终独立公开审查、prepush 及本预览的 GitHub 交付仍待完成。

此前 0.13.0／0.14.0／0.15.0 章节是各自有源码身份和结果的历史检查点，其矩形／浏览器观察不能验证当前图片或 3D 的 native 像素。Task 5a 仅提供 CPU 公式／边界；A2 Task 5b／Task 6、P0–P7、设备／文字／动画／Native、V003 和完整 R008／V006 迁移保持开放或 UNRUN。


## 历史 0.14.0 工程事务核心工程预览

本地0.14.0工程预览候选包含私有0.0.0 headless `@egret/project`包，支持不可变创作快照、原子编辑/重试和通过规范历史恢复保留目标。见[包API](packages/project/README.zh-CN.md)、[完整合同](knowledge-base/Cns/docs/工程事务核心合同.md)及[有限实现和内存证据](knowledge-base/Cns/docs/工程事务核心实现证据.md)。协议固定值仍为1.0，历史0.13 WebGPU/知识库身份不变。本段文档编写检查点的最终独立预览审阅与公开交付待完成，后续审阅和交付证据另行记录；V003/编辑器和完整R008/V006迁移未接受。

## 历史0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/Cns/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/Cns/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/Cns/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/Cns/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/Cns/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/Cns/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

新白鹭面向主要依靠 AI 制作游戏的新创作者，首期目标是复杂 2D UI 与轻量 3D。渲染与运行时、可持续编辑的工程、Agent 协作工具和完整旧工程迁移共同构成产品方向。代码、双语文档、测试与可公开验证记录从开发阶段持续维护。

此前0.12.0为限定显示帧本地候选，公开仓库目标是 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)。本预览的远端提交状态另行记录，没有已发布 npm 包。第一方代码与文档采用仓库原有 [Apache-2.0](LICENSE)，第三方保留各自声明；包继续保持 `private: true`，接口为 experimental。

## 已实现的核心

| 包 | 当前职责 | 依赖 |
| --- | --- | --- |
| `@egret/project` | 不可变创作快照、原子编辑/重试及通过规范历史恢复保留目标 | contracts；私有jsonc-parser 3.3.1 scanner/visitor适配器 |
| `@egret/contracts` | 取消、同步清理、诊断与 headless 宿主端口 | 无 |
| `@egret/runtime` | Scope、显示树、类型化同步事件、CPU 资源引用/共享获取/独立租约 | contracts |
| `@egret/engine` | 实例与资产服务装配、surface 预留、启动和有界关闭 | contracts、runtime；WebGPU准备显式依赖robust-predicates 3.0.3 |

公共入口为 `@egret/engine`。核心不依赖 DOM/Node 全局，导入不启动宿主。新的 `engine.assets` 把等待取消与已交付租约的使用期分开：一个调用取消不会影响其他等待者，代际失效只切换后续获取，旧租约在释放或管理器关闭前仍可使用。Scope 和 Engine 负责退出期间的清理。见[资源合同](knowledge-base/Cns/docs/资源核心合同.md)与[实现记录](knowledge-base/Cns/docs/资源核心实现记录.md)。

这段服务管理 provider 返回的 CPU 值，网络与解码由相应 provider 提供。GPU纹理上传/在途回收、完整GPU渲染后端、字体/动画/3D产品执行链、真实小游戏/Native、迁移器、编辑器和 Agent 服务尚未完成。研究中的第三方图形链与自有产品代码分别登记。

## 运行与验证

固定工具：Node.js 24.19.0、pnpm 11.25.0、TypeScript 7.0.2。从根目录执行：

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

历史 CPU 资源切片验收见[资源核心验证](verification/asset-core-verification.json)；此前 [44 项 headless 检查](verification/headless-verification.json)与[双语修订记录](verification/bilingual-publication-verification.json)保留其历史版本和范围。历史CPU资源验证不代表GPU、设备性能、CI或完整产品验收。

每次推送执行[双语与公开检查](knowledge-base/Cns/docs/双语文档与推送前检查.md)，同步中文/英文阅读版本、登记状态与关键代码英文注释。新增核心按自有合同独立编写，历史源码/规格 hash 和当前修订身份分别保留，见[来源记录](source-origin.json)。

[知识库](knowledge-base/Cns/README.md) · [全部双语文档](DOCUMENTATION.zh-CN.md) · [贡献指南](CONTRIBUTING.zh-CN.md) · [鸣谢](ACKNOWLEDGEMENTS.zh-CN.md) · [发行说明](PUBLICATION.zh-CN.md)

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。

该历史检查点的本地工程预览标签为0.14.0；私有实验包版本仍为0.0.0，工程/历史/工具协议固定值仍为1.0。保留的WebGPU检查点及其知识库身份属于历史0.13.0记录。

## 公共WebGPU使用

`canvas`为HTMLCanvasElement。可选readback绑定下一次通过预检的帧；`renderFrame`同步返回undefined。`result.bytes`为调用者所有的预乘RGBA，不是浏览器合成结果。`whenIdle`仅截取已提交工作；只有`close`成功才证明安全归还，Engine包装保留原cause。见[示例](examples/webgpu/README.zh-CN.md)。

```ts
import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';

const host = createWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngine({ host });
const rect = new Sprite();
rect.graphics.beginFill(0x00ff00).drawRect(4, 4, 16, 16);
engine.stage.addChild(rect);
const pixels = host.requestReadback();
engine.renderFrame({ width: 48, height: 40, clearColor: 0, clearAlpha: 0 });
const result = await pixels;
await engine.dispose();
```

## CPU 纹理预览（本地 0.15.0）

新增不可变 ImageData2D、Texture、借用资源租约的 Bitmap、可保存的混合帧，以及保留 UV 属性的裁剪和顶点准备。阅读 [API 与所有权](docs/texture-a1.zh-CN.md) 和 [CPU 验证证据](docs/evidence/texture-a1.zh-CN.md)。这是对 0.14 工程核心的增量实验；生产 Canvas/WebGPU 图像采样、浏览器精度与 GPU 资源结算仍等待独立 A2 验证。源码与文档整理不代表 GitHub 已交付，历史记录及完整产品验收目标继续保留。

</details>
