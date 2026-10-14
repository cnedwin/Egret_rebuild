# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

<!-- ADI-0.51.0-DRAFT-BEGIN -->
## Engineering preview 0.51.0 — indexed child insertion · Source draft

**S105 / V056 · 2026-10-14.** `DisplayObjectContainer.addChildAt<T extends DisplayObject>(child: T, index: number): T` places an exact object at a layer in one operation. Integer [0,n] includes -0 and append at n. Same-parent index is the final position; n aliases the last position. Current-source reparent preserves other siblings, the subtree and cleanup owners. Sprite/Stage inherit the member; Stage cannot become a child.

**R3 current Source draft · accepted code successor, 2026-10-14.** The independently reviewed complete run finished at 14:05:03 UTC: all 9 code phases completed, Core 3113/3113 and Spine source checks 160/160, with zero failures, cancellations or skips. Original standalone strict consumers and the complete types phase retain ADI 0/10, CGI 0/12 and DCA 0/10 complete unsuppressed diagnostic vectors. The accepted Actual review is 262199 bytes / 5b4516bd58e875d25559b8426f4ed8ee6e9d7268afd3f40c55680f070d1863df. This accepts current local code verification only; full Spine product R020/V020 stays OPEN.

The authenticated current union contains 25 distinct adopted Source files, including reviewed native support and retained readers. Current product identities bind 3 Source files and 6 JS/DTS outputs; the repaired 2 Source files and 2 JS emissions replace their earlier identities, while all 3 declarations retain their earlier accepted bytes. **R3 Native successor · 2026-10-14.** The independently accepted desktop opaque Canvas/WebGPU run finished at 14:35:58 UTC. Main execution completed 10 submissions and 10 full raw RGBA readbacks, covering 5760 pixels and 23040 channels at tolerance 0 with no mismatches. There were 8 new captures and 2 saved replays. N5 reused the exact saved N1 frame on the same live Engine while the current N4 tree remained mutated. The fresh Canvas C1 control used 2 additional submissions and 2 readbacks, with main credit 0; its deliberate wrong index produced the expected 64 mismatched pixels and 128 mismatched channels. The accepted Native review is 59975 bytes / 334c304b4ad1f2b66e6beddb8f40f89b8b08b11d7b9cd0d5e41b95c5a057c370. Saved evidence contains raw RGBA files; no PNG files were saved. Scope/Engine/host/context/browser/server retirement completed safely, with no primary or cleanup error and no pending tickets. The collector recorded stability for 175 admitted runtime pins; the reviewer separately authenticated the current 175 pins. That later observation does not invent per-file retrospective before/after arrays. Public/source/bilingual review, normal full prepush, mandatory hooks and new 0.51 Git delivery remain PENDING. Physical GPU identity, fonts, phones, performance and complete Spine remain unverified or OPEN; remote CI PASS is not claimed. Read the [contract](knowledge-base/en/docs/container-add-child-at-contract.md), [evidence](knowledge-base/en/docs/container-add-child-at-evidence.md) and [remaining plan](knowledge-base/en/docs/container-add-child-at-implementation-plan.md).

Dated 2026-10-14 preceding-delivery successor: [PR #38](https://github.com/cnedwin/Egret_rebuild/pull/38) delivered bounded 0.50.0 to Main `13200c72dd51d35d12e84c6d1c81dfeaef94af53`, tree `c6f1a791f649c96606fb5e2a1b2a096c2a3f027b`. Original 0.50 public-PENDING cutoffs remain history; the later Root DATA pointer projection adds no independent review or remote CI PASS.

Full Spine R020/V020, migration R008/V006, complete EUI/layout, advanced 3D, AI and phones/platforms/performance remain OPEN or unverified. First-party source follows Egret specifications and familiar APIs, with English critical comments and attributed AI assistance. Packages remain private 0.0.0, protocol 1.0 and dependencies/notices unchanged.

## 工程预览 0.51.0 — 按索引插入子节点 · 源码草稿

**S105 / V056 · 2026-10-14。** `DisplayObjectContainer.addChildAt<T extends DisplayObject>(child: T, index: number): T` 一次操作将精确对象放到指定层。整数 [0,n] 包含 -0 和 n 追加；同父 index 表示最终位置，n 是末尾位置别名。按当前来源换父节点保留其他兄弟、子树及清理所有者。Sprite／Stage 继承该成员，Stage 不能成为子节点。

**R3 当前源码草稿 · 已接受的代码验证后继，2026-10-14。** 经独立审阅的完整运行在 14:05:03 UTC 结束：全部 9 项代码阶段完成，Core 3113/3113、Spine 源码检查 160/160，失败、取消、跳过均为零。原始独立严格类型使用方和完整类型阶段保留 ADI 0/10、CGI 0/12、DCA 0/10 完整未抑制诊断向量。已接受的实际结果审阅为 262199 bytes / 5b4516bd58e875d25559b8426f4ed8ee6e9d7268afd3f40c55680f070d1863df。该接受仅覆盖当前本地代码验证；完整 Spine 产品 R020/V020 保持 OPEN。

经认证的当前清单包含 25 个不同的已采用源码文件，其中包括经审阅的 Native 支持和保留的读取器。当前产品身份绑定 3 个源码文件和 6 项 JS/DTS；修复后的 2 个源码文件和 2 项 JS 产物替换旧身份，全部 3 项声明继续保留此前已接受的字节。**R3 Native 后继 · 2026-10-14。** 经独立接受的桌面不透明 Canvas／WebGPU 运行在 14:35:58 UTC 结束。主运行完成 10 次提交、10 份完整原始 RGBA 读回，比较 5760 个像素和 23040 个通道，容差 0，均无差异。实际有 8 次新捕获、2 次保存帧重放。N5 在同一存活 Engine 上使用精确保存的 N1 帧，而当前 N4 树仍保持变更。另行的新鲜 Canvas C1 对照增加 2 次提交和 2 份读回，主运行计入 0；其故意错误索引产生预期的 64 个差异像素和 128 个差异通道。已接受的 Native 审阅为 59975 bytes / 334c304b4ad1f2b66e6beddb8f40f89b8b08b11d7b9cd0d5e41b95c5a057c370。保存的证据为原始 RGBA 文件，没有保存 PNG 文件。Scope／Engine／host／context／browser／server 均完成安全退役，没有主错误、清理错误或待处理 ticket。采集器记录了 175 项已接受 runtime pin 的稳定状态；审阅者另行认证了当前 175 项 pin。该后续观察不虚构逐文件回溯 before／after 数组。公开源码／双语审阅、普通完整 prepush、强制 hook、新 0.51 Git 交付仍为 PENDING。物理 GPU 身份、字体、手机、性能及完整 Spine 仍未验证或 OPEN，不宣称远端 CI PASS。阅读[契约](knowledge-base/Cns/docs/容器按索引插入契约.md)、[证据](knowledge-base/Cns/docs/容器按索引插入证据.md)及[剩余计划](knowledge-base/Cns/docs/容器按索引插入工程计划.md)。

2026-10-14 上一交付有日期后继：[PR #38](https://github.com/cnedwin/Egret_rebuild/pull/38) 将有限 0.50.0 交付到 Main `13200c72dd51d35d12e84c6d1c81dfeaef94af53`、tree `c6f1a791f649c96606fb5e2a1b2a096c2a3f027b`。原 0.50 公开 PENDING 截止点保留为历史；后续 Root DATA 指针投影不增加独立审阅或远端 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、完整 EUI／布局、高级 3D、AI、手机／平台／性能仍为 OPEN 或未验证。第一方源码遵循白鹭规格和熟悉 API，包含关键英文注释并注明 AI 协助；package 保持私有 0.0.0，协议 1.0，依赖／notice 不变。
<!-- ADI-0.51.0-DRAFT-END -->

<!-- CGI-0.50.0-BEGIN -->
## Engineering preview 0.50.0 — query a direct child’s current index

**S104 / V055.** DisplayObjectContainer.getChildIndex(child: DisplayObject): number is a read-only query of the exact current direct child. It scans the authoritative private order in O(n), with no list snapshot/cache, tree mutation, owner transfer, resource operation or display callback. Sprite/Stage inherit it; root values/types, subpaths, dependencies and protocol are unchanged.

Independent acceptance covers the two-file product/four JS-DTS emissions, build exit 0, focused CPU 128/128 (six new and 122 retained) and two overlapping original strict lanes with 0/12 diagnostics and twelve complete unsuppressed tuples. Genuine old operations/cleanup preceded the named missing-member RED. The earlier old-build 122-pass/6-fail attempt remains historical and is not a product defect. Native source is accepted. All nine current code phases later completed successfully (Core 3091/3091 and retained Spine Source checks 160/160), including current strict CGI 0/12 and retained DCA 0/10; independent saved-result review has accepted this scope. Native Canvas/WebGPU is separately accepted: two cases, six full 24×24 readbacks/four captures/two same-live-Engine replays, 13824 channels at zero tolerance. Public Source/bilingual review and prepush/hook/delivery remain pending.

Read the [contract](knowledge-base/en/docs/container-child-index-contract.md), [evidence](knowledge-base/en/docs/container-child-index-evidence.md) / [implementation plan](knowledge-base/en/docs/container-child-index-implementation-plan.md).

Dated 2026-10-14 successor: [PR #37](https://github.com/cnedwin/Egret_rebuild/pull/37) delivered bounded 0.49.0 batch detachment to Main `01e8e8063c2f2234b66486beba8bc9529f1f77b0`, tree `3585d370cc637edde2a94856909daa6bc74960d4`, from feature `c95bde158a0ec941ff9e494da5b1567465ff2d8b`. Original 0.49 curation PENDING cutoffs/failures remain historical; zero remote statuses/check runs with combined pending are not CI PASS.

Full Spine R020/V020, migration R008/V006, EUI/layout, advanced 3D, AI interfaces and phone/platform/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.

## 工程预览 0.50.0 — 查询直接子节点当前索引

**S104 / V055.** DisplayObjectContainer.getChildIndex(child: DisplayObject): number 只读查询精确当前直接子节点，以 O(n) 扫描私有真实顺序，不建立列表快照／缓存，不修改树、转移 owner、操作资源或调用显示回调。Sprite／Stage 继承，根值／类型、子入口、依赖及协议不变。

独立接受两文件产品／四项 JS-DTS、构建 exit 0、专项 CPU 128/128（新增六项、保留 122 项），及两组重叠原始严格类型 0/12 诊断、十二个完整未抑制元组。具名缺成员 RED 前真实旧操作／清理已完成；此前旧 build 的 122 通过／6 失败保留为历史，不是产品缺陷。原生源码已接受；之后全部九个当前代码阶段实际成功完成（Core 3091/3091、保留 Spine 源码检查 160/160），包含当前 CGI 0/12 与保留 DCA 0/10 严格类型，独立保存结果评审已接受该范围；Native Canvas／WebGPU 另行接受两个后端例、六份完整 24×24 读回／四次捕获／两次同存活 Engine 重放，13824 通道零容差。公开源码／双语审阅及 prepush／hook／交付仍待完成。

阅读[契约](knowledge-base/Cns/docs/容器子节点索引契约.md), [evidence](knowledge-base/Cns/docs/容器子节点索引证据.md) / [implementation plan](knowledge-base/Cns/docs/容器子节点索引工程计划.md).

2026-10-14 有日期后继：[PR #37](https://github.com/cnedwin/Egret_rebuild/pull/37) 将有限 0.49.0 批量分离交付至 Main `01e8e8063c2f2234b66486beba8bc9529f1f77b0`，tree `3585d370cc637edde2a94856909daa6bc74960d4`，功能提交 `c95bde158a0ec941ff9e494da5b1567465ff2d8b`；原 0.49 整理 PENDING 截止点／失败保留为历史，远端状态／check run 为零、汇总 pending 不等于 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、EUI／布局、高级 3D、AI 接口及手机／平台／性能接受保持 OPEN 或未验证；package 私有 0.0.0、宿主协议 1.0。
<!-- CGI-0.50.0-END -->

<!-- DCA-0.49.0-BEGIN -->
## Engineering preview 0.49.0 — detach all direct display children

**S103 / V054.** `DisplayObjectContainer.removeChildren(): void` clears a display layer while keeping its nodes, descendants, resources and cleanup owners alive. It authenticates the genuine receiver, checks Engine before receiver lifetime even when empty, preflights every direct edge and commits without caller hooks. Sprite and Stage inherit the method; root values/types, profiles, dependencies and protocol remain unchanged.

Independent acceptance covers 122 focused CPU tests (one API, five behavior and 116 retained) and two parallel original strict lanes: zero positive diagnostics and ten complete actual unsuppressed negative tuples. Genuine old behavior and cleanup preceded the named missing-member RED. The new strict driver and all nine current default code/policy gates are independently accepted: Core 3085/3085 and retained F2 Source checks 160/160. Native R1 failed in its fixture before submission; independent review separately accepted R2 Canvas/WebGPU execution: six full 24×24 readbacks, four captures/two same-live-Engine replays, 13824 channels at zero tolerance. Publication remains pending. Source cleanup repair does not establish executed cleanup faults.

Read the [contract](knowledge-base/en/docs/container-remove-children-contract.md), [evidence](knowledge-base/en/docs/container-remove-children-evidence.md) / [native schedule](knowledge-base/en/docs/container-remove-children-native-verifier.md).

Dated 2026-10-14 successor: [PR #36](https://github.com/cnedwin/Egret_rebuild/pull/36) delivered bounded 0.48.0 NineSliceBitmap to Main `cca65d0322807e53bfa3f7cc7fbcf8d903dcbc59`, tree `bc5c205ee988aa6aa4245391068a6ee73120594e`, from feature `f1f4bcbe5b12171f5077e66775d8bd1a9b771b44`. Original 0.48 curation PENDING cutoffs remain historical. Remote statuses/check runs 0/0 and combined pending do not establish CI PASS.

Full Spine R020/V020, migration R008/V006, complete UI/layout, advanced 3D and target-device/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.

## 工程预览 0.49.0 — 分离全部直接显示子节点

**S103 / V054.** `DisplayObjectContainer.removeChildren(): void` 清空显示层，同时保留节点、后代、资源及清理所有者。它认证真实接收者，空容器也先检查 Engine 再检查接收者生命周期，在全部直接边校验后无调用者 hook 提交；Sprite 和 Stage 继承方法，根值／类型、规格、依赖和协议不变。

独立接受 122 项专项 CPU（API 一项、行为五项、保留 116 项），及两组原始并行严格类型：正例零诊断，负例十个实际未抑制完整元组。具名缺成员 RED 前已完成真实旧行为及清理。新严格 driver 及全部九个当前默认代码／策略门禁已独立接受：Core 3085/3085、保留 F2 源码检查 160/160。Native R1 在提交前于夹具中失败，独立评审另行接受 R2 Canvas／WebGPU：六份完整 24×24 读回、四次捕获／两次同存活 Engine 重放，13824 通道零容差；公开发布仍待完成；源码清理修复不等于执行过清理故障。

阅读[契约](knowledge-base/Cns/docs/容器清空子节点契约.md), [evidence](knowledge-base/Cns/docs/容器清空子节点证据.md) / [native schedule](knowledge-base/Cns/docs/容器清空子节点原生核验指南.md).

2026-10-14 有日期后继：[PR #36](https://github.com/cnedwin/Egret_rebuild/pull/36) 将有限 0.48.0 NineSliceBitmap 交付至 Main `cca65d0322807e53bfa3f7cc7fbcf8d903dcbc59`，tree `bc5c205ee988aa6aa4245391068a6ee73120594e`，功能提交 `f1f4bcbe5b12171f5077e66775d8bd1a9b771b44`。原 0.48 整理 PENDING 截止点保留为历史；远端状态／check run 为 0/0、汇总 pending，不等于 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、完整 UI／布局、高级 3D 及目标设备／性能接受保持 OPEN 或未验证；package 私有 0.0.0、宿主协议 1.0。
<!-- DCA-0.49.0-END -->

<!-- NLB-0.48.0-BEGIN -->
## Engineering preview 0.48.0 — NineSliceBitmap fixed-border backgrounds

**S102 / V053.** `NineSliceBitmap` derives source dimensions from a genuine Texture crop, borrows the caller’s lease and resizes a fixed-border background in one operation while retaining old frames. Runtime/Engine roots add one class value and one erased options type, reusing independent NS1 geometry and existing textured rendering; no third-party dependency is added.

Independent focused CPU acceptance is 71/71 (fourteen NLB, one independent TXI and fifty-six retained regressions); three strict lanes produced 0/17/8 diagnostics, twenty-five complete actual unsuppressed tuples. The recording example has two sizes/two frames, one load/disposal and zero timers; it is not native pixel verification. Four original source refusals and two genuine RED observations remain; the Engine-closing counterexample stays source-only.

Independent review dated 2026-10-14 accepted all nine code-verification phases, ordinary tests 3079/3079 and retained F2 source tests 160/160. One real WebGPU main case completed three 24×24 readbacks, two captures and one replay after origin retirement: 6912 channels passed at zero tolerance. Two Canvas refusals had zero positive Canvas submissions; adapter identity was unobserved. Curated public-content gates, bilingual review and 0.48 push/PR/Main remain pending. Full EUI/layout, Spine R020/V020 and migration R008/V006 remain OPEN; packages stay private 0.0.0, host protocol 1.0.

Read the [contract](knowledge-base/en/docs/nine-slice-bitmap-contract.md), [evidence](knowledge-base/en/docs/nine-slice-bitmap-evidence.md) and [native verifier guide](knowledge-base/en/docs/nine-slice-bitmap-native-verifier.md).

Dated 2026-10-14 delivery successor: [PR #35](https://github.com/cnedwin/Egret_rebuild/pull/35) merged the bounded 0.47.0 Spine manual bridge into Main `5ae877705d76a470ec942a29cfe0212f069da6fb`, tree `60d224ec1ed6bc0824cd2f93871595809d3c21d5`, from feature `29e6f97d1d594efe3a49f9c530b1728a4756fe2c`. This is separate from new NineSlice baseline admission; old PENDING cutoffs remain. Remote statuses/check runs 0/0 with combined pending do not establish CI PASS.

## 工程预览 0.48.0 — NineSliceBitmap 固定边框背景

**S102 / V053。** `NineSliceBitmap` 从真实 Texture 裁剪取得源尺寸，借用调用者租约，以一次 `resize` 调整固定边框背景并保留旧帧。Runtime／Engine 根入口新增一个类值和一个擦除 options 类型，复用独立 NS1 几何及既有纹理渲染；不增加第三方依赖。

独立接受的专项 CPU 为 71/71（十四项 NLB、一项独立 TXI、五十六项保留回归）；严格类型为三组 0/17/8 诊断，共二十五个实际未抑制完整元组。记录型示例为两个尺寸／两个帧、一次加载／释放、零 timer，不是原生像素验证。原四项源码拒绝及两项真实 RED 继续保留；Engine 关闭反例保持 source-only。

2026-10-14 的独立评审已经接受全部九个代码验证阶段，普通测试 3079/3079、保留 F2 源码测试 160/160。真实 WebGPU 的一个主例完成三份 24×24 读回、两次捕获及一次资源退役后重放，6912 个通道零容差通过；两项 Canvas 拒绝、正向 Canvas 提交为零，adapter 身份未观察。整理后公开材料门禁、双语审阅及 0.48 推送／PR/Main 仍待完成。完整 EUI／布局、Spine R020/V020 与迁移 R008/V006 保持 OPEN；package 私有 0.0.0，宿主协议 1.0。

阅读[契约](knowledge-base/Cns/docs/九宫格位图契约.md)、[证据](knowledge-base/Cns/docs/九宫格位图证据.md)和[原生核验指南](knowledge-base/Cns/docs/九宫格位图原生核验指南.md)。

2026-10-14 的交付后继：[PR #35](https://github.com/cnedwin/Egret_rebuild/pull/35) 已将有限 0.47.0 Spine 手动桥接合入 Main `5ae877705d76a470ec942a29cfe0212f069da6fb`，tree `60d224ec1ed6bc0824cd2f93871595809d3c21d5`，功能提交 `29e6f97d1d594efe3a49f9c530b1728a4756fe2c`。这与新 NineSlice 基线准入分别记录；旧 PENDING 截止点保留。远端状态／check run 为 0/0、汇总 pending，不构成 CI PASS。
<!-- NLB-0.48.0-END -->

<!-- F2C-0.47.0-BEGIN -->
## Engineering preview 0.47.0 — Spine Core manual mesh bridge

**R004 / R012 / R015 / R016 / R019 / R020 / R021 · S101 / V052.** The optional F2-C experiment connects genuine Egret resources/display ownership to external official Core 4.3.13 for bounded unweighted-mesh manual absolute translate/deform sampling, two resident instances and owned immutable geometry. Default SDK entries gain no Core dependency or export. Independent acceptance covers ten main CPU cases, four separate resource transactions, fourteen type lanes (twenty-five actual unsuppressed diagnostic tuples) and one G1 callback observer with separate ordinary before/after baselines. The post-implementation ordinary default suite passed 3064/3064. Counts stay separate; the numerical bound covers only the original five-point fixture.

Controlled copied-source execution is independently accepted: ten separate complete original baselines, two discriminating mutants and three fault units, with five successful restorations. These repetitions do not increase unique main-case, type-lane or diagnostic-tuple counts.

Fixed policy/cold/help observations are separately accepted: eight default roots, 145 reachable keys, 1416 literal relations and seven fresh children. Negative filesystem/DOM/scheduler observations cover selected operations; they do not prove universal absence.

Independent native R2 review accepted one F2C11 default-Edge WebGPU case: seven submissions / seven 64 × 48 readbacks at DPR 1, five literal pixels / twenty channels and two complete repeat/backward frames / 24576 channels matched at tolerance zero. Canvas refused separately with zero submissions; cleanup passed. The opaque fixture does not qualify alternate alpha modes, adapter identity was not recorded, and these are not device-performance results.

At the 2026-10-14 curation cutoff, complete current publication/push gates and 0.47.0 PR/Main remain pending. Full Spine R020/V020 and migration R008/V006 remain OPEN; Clock/mixing, weighted meshes, phone/platform performance and entitlement are outside this acceptance. The external SDK is not bundled: entitlement unknown, distribution clearance unverified; packages remain private 0.0.0 and host protocol 1.0.

Read the [contract and guide](knowledge-base/en/docs/spine-core-manual-bridge.md) and [verification/open work](knowledge-base/en/docs/spine-core-manual-bridge-evidence.md).

Previous 0.46.0 delivery merged through [PR #34](https://github.com/cnedwin/Egret_rebuild/pull/34) at 2026-10-13T18:18:51Z: Main `562543ea10d9a6b8124561a7027811f3f7dede4c`, tree `ff54205b5e4ba83bfbb75867226e1cbca0e27a32`. Separate local/mandatory-hook suites passed 137/137 publication, 3064/3064 core and 160/160 experimental tests; 1486 committed raw blobs had zero issues. Remote statuses/check runs 0/0 with combined pending do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.

## 工程预览 0.47.0 — Spine Core 手动网格桥接

**R004 / R012 / R015 / R016 / R019 / R020 / R021 · S101 / V052。** 可选 F2-C 实验将真实白鹭资源、显示树与外部官方 Core 4.3.13 连接，支持限定非加权 mesh 的手动绝对时间 translate／deform 采样、两个驻留实例与自有不可变几何。默认 SDK 不增加 Core 依赖或导出。已独立接受十项主 CPU、四项独立资源事务、十四组类型（二十五个实际未抑制诊断元组）和一项 G1 回调观察器；后者具有单独的前后普通基线。实现后普通默认套件通过 3064/3064。各次执行范围分别计数，数值界仅适用于原始五点夹具。

受控复制源码执行已独立接受：十次独立完整原始基线、两个可区分变异与三个故障单元，五次恢复均通过。它们不增加主用例、类型组或诊断元组的唯一计数。

固定策略／冷导入／help 观察另行接受：八个默认根入口、145 个可达键、1416 条字面关系及七个新子进程。同步文件访问、DOM 与调度的负向观察限定于所选操作；不能推导普遍不存在。

独立原生 R2 评审接受一项 F2C11 默认 Edge WebGPU 用例：七次提交／七份 64 × 48 读回、DPR 1，五个字面像素／二十个通道及两个完整重复／后退帧／24576 个通道以零容差一致。Canvas 另行拒绝且提交为零；清理通过。不透明夹具不验收其他 alpha 模式，未记录 adapter 身份；这些不是设备性能证据。

本整理截止点为 2026-10-14：当前完整公开／推送门禁及 0.47.0 PR/Main 仍待完成。完整 Spine R020/V020 与迁移 R008/V006 保持 OPEN；Clock／混合、加权网格、手机／平台性能及许可资格不在本次接受范围。外部 SDK 不打包，许可资格 unknown、分发资格 unverified；package 保持私有 0.0.0，宿主协议 1.0。

阅读[契约与指南](knowledge-base/Cns/docs/SpineCore手动网格桥接.md)和[验证与待完成工作](knowledge-base/Cns/docs/SpineCore手动网格桥接证据.md)。

前一版本 0.46.0 已经 [PR #34](https://github.com/cnedwin/Egret_rebuild/pull/34) 于 2026-10-13T18:18:51Z 合并，Main `562543ea10d9a6b8124561a7027811f3f7dede4c`、tree `ff54205b5e4ba83bfbb75867226e1cbca0e27a32`。分别执行的本机／必要推送钩子套件通过 137/137 公开材料、3064/3064 核心及 160/160 实验测试；1486 个提交原始 blob 检查的问题为零。远端状态／check run 为 0/0、汇总 pending，不宣称远端 CI PASS。保留此前 PENDING 截止点。
<!-- F2C-0.47.0-END -->

<!-- BIP1-0.46.0-BEGIN -->
## Engineering preview 0.46.0 — Optional browser PNG textures

**R004 / R012 / R015 / R016 / R019 / R021 · S100 / V051.** The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. Complete current repository/prepush gates, this increment's push/PR/Main and remote CI acceptance remain PENDING.

Support is bounded to 8-bit RGB/RGBA noninterlaced still PNG, with browser-normalized straight sRGB RGBA8 output. This is not lossless decoding of every PNG: Canvas may lose hidden RGB and translucent precision. The adapter preserves existing engine.assets lease, Texture, SpriteSheet, Bitmap and clock ownership. Application shutdown retires Engine/manager demand and separately awaits provider.close(). Default core entries remain DOM-free; the sole optional factory and four erased interfaces add no runtime dependency. Four occupied jobs, 8 MiB per input and 32 MiB occupied encoded-byte budget remain the explicit limits. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN.

Read the [contract](knowledge-base/en/docs/browser-png-contract.md) · [implementation plan](knowledge-base/en/docs/browser-png-implementation-plan.md) · [native schedule and CLI](knowledge-base/en/docs/browser-png-native-plan.md) · [evidence and retained repairs](knowledge-base/en/docs/browser-png-evidence.md).

Previous completed delivery: [PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) merged 0.45.1 into Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`, tree `56e49e879d93fae351c948375e0ec12f21c739ab`. Its separate mandatory-hook suites passed 137/137 publication, 2,909/2,909 core and 160/160 experimental tests; knowledge-base issues were 0. This successor does not rewrite earlier PENDING cutoffs or claim remote CI acceptance.

## 工程预览 0.46.0 — 可选浏览器 PNG 纹理

**R004 / R012 / R015 / R016 / R019 / R021 · S100 / V051.** 可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

支持范围限定为 8 位 RGB／RGBA、非隔行的静态 PNG，输出是经浏览器规范化的 straight sRGB RGBA8。这不保证所有 PNG 的无损解码：Canvas 可能丢失隐藏 RGB 与半透明精度。适配器沿用 engine.assets 租约、Texture、SpriteSheet、Bitmap 与时钟的既有所有权。应用关闭时先退役 Engine／资源管理器需求，再单独等待 provider.close()。默认核心入口仍不依赖 DOM；唯一可选工厂与四个擦除接口不增加运行时依赖。上限仍为四个占用任务、每份输入 8 MiB 与占用编码字节合计 32 MiB。完整 Spine R020/V020 与旧工程迁移 R008/V006 仍为 OPEN。

阅读 [契约](knowledge-base/Cns/docs/浏览器PNG纹理Provider契约.md) · [实施计划](knowledge-base/Cns/docs/浏览器PNG实施计划.md) · [原生验证安排与 CLI](knowledge-base/Cns/docs/浏览器PNG原生验证计划.md) · [证据与保留修复记录](knowledge-base/Cns/docs/浏览器PNG验证证据.md).

此前已完成交付：[PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) 将 0.45.1 合并到 Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`，树 `56e49e879d93fae351c948375e0ec12f21c739ab`。强制推送门禁分别通过 137/137 公开材料、2,909/2,909 核心及 160/160 实验测试，知识库问题为 0。此后继记录保留旧 PENDING 截止点，不宣称远端 CI 验收。
<!-- BIP1-0.46.0-END -->

<!-- HYGIENE-0.45.1-BEGIN -->
## Engineering preview 0.45.1 — Repository path and byte hygiene

**R016 / R019 / R021 · S099 / V050.** Repository tooling now separates complete, case-preserving logical paths from platform-aware physical path comparisons and keeps every file fingerprint bound to raw bytes. The focused independent review accepted 111/111 regressions, the build and separate strict SpriteSheet/Sequence diagnostics. The actual pre-fix case-alias RED (0 passed / 2 assigned failures) remains preserved.

Separate real Node/PowerShell writer execution passed 3/3 with independent acceptance. Saved isolated Git fixtures passed 12/12; a separate related collection passed 123/123, including 9 knowledge-base cases. Those overlapping runs are not added together, and independent Gate saved-result review accepted the finite data as **PASS_ACTUAL_REPOSITORY_HYGIENE_DATA**. Complete local publication gates, committed-snapshot qualification, the mandatory push hook and current PR/Main delivery remain **PENDING at this curation cutoff**. Packages stay private `0.0.0`, host protocol `1.0`; full Spine **R020/V020** and legacy migration **R008/V006** remain **OPEN**.

Previous actual delivery: [PR #32](https://github.com/cnedwin/Egret_rebuild/pull/32) merged 0.45.0 into Main `863b29c90b92b62e37ce77cf32e02c4294135a16`, tree `1c7b706163ab58e41916bdaa8a6d45f74743a4f9`. Its mandatory hook passed 63 publication, 2,909 core and 160 experimental tests as separate suites; knowledge-base issues were 0. Remote CI PASS is not claimed. Earlier PENDING sections retain their original cutoffs.

## 工程预览 0.45.1 — 仓库路径与字节规范

**R016 / R019 / R021 · S099 / V050。** 仓库工具现在分别处理完整、保留大小写的逻辑路径和按平台语义比较的物理路径，文件指纹始终绑定原始字节。限定独立评审接受 111/111 项回归、构建及分别执行的 SpriteSheet／Sequence 严格诊断；修复前真实大小写别名 RED（0 项通过／2 项指定失败）继续保留。

另行真实 Node／PowerShell 写入执行通过 3/3 并已独立接受；保存的隔离 Git 对照通过 12/12，独立相关集合通过 123/123，其中包括 9 项知识库用例。各次重叠运行不累加，Gate 保存结果独立评审已按 **PASS_ACTUAL_REPOSITORY_HYGIENE_DATA** 接受有限数据。完整本机公开门禁、提交快照资格、必要推送钩子及本次 PR/Main 交付在**此整理截止点继续 PENDING**。package 仍为私有 `0.0.0`，宿主协议为 `1.0`；完整 Spine **R020/V020** 和旧工程迁移 **R008/V006** 保持 **OPEN**。

前一版本实际交付：[PR #32](https://github.com/cnedwin/Egret_rebuild/pull/32) 将 0.45.0 合入 Main `863b29c90b92b62e37ce77cf32e02c4294135a16`，树 `1c7b706163ab58e41916bdaa8a6d45f74743a4f9`。其必要钩子分别通过 63 项 publication、2,909 项 core 和 160 项实验测试，知识库问题为 0；不宣称远端 CI PASS。较早 PENDING 章节保留原截止点。

[Policy](knowledge-base/en/docs/repository-identity-and-line-endings.md) / [Evidence](knowledge-base/en/docs/repository-hygiene-evidence.md) / [中文规范](knowledge-base/Cns/docs/仓库路径身份与换行规范.md) / [中文证据](knowledge-base/Cns/docs/仓库路径与换行验证记录.md)。
<!-- HYGIENE-0.45.1-END -->

<!-- SS1-0.45.0-BEGIN -->
## Engineering preview 0.45.0 — Named SpriteSheet / 工程预览 0.45.0 — 命名图集

**S098 / V049.** Named `createSpriteSheet` shares one full-image lease between immutable named crops, static icons and the existing Engine-clock sequence controller. Runtime/Engine roots add one factory and two erased types, `SpriteSheet` / `SpriteSheetFrameInput`; package version stays private `0.0.0` and host protocol `1.0`. No new dependency, public subpath or animation clock is added.

Saved public CPU passed 100/100, with retained CPU 133/133 counted separately. SS01–SS10 are specification families. SpriteSheet positive types produced 0 diagnostics; ordinary/import negatives contained 22/14, totaling 36 precise tuples and 6 continuation lines. Original-operation units passed 10/10; policy passed 5/5 including 4 assigned controls, and retained generic policy passed 272/272 separately. The recording example has 8 rows, 6 explicit ticks, 1 load and 1 disposal. Independently accepted Canvas/WebGPU observations completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, with bounded cleanup. Final publication gates, mandatory push hook and 0.45 PR/Main remain PENDING.

Recorded 0.44 delivery: PR #31 merged; Main `1dce76a62cd0a4180969949939041f889eb1d923`, tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`. Its hook separately passed 63 publication, 2794 core and 160 experimental tests; KB issues were 0. Remote status/check-run counts 0/0 do not establish remote CI PASS. Earlier PENDING cutoffs remain historical.

The first-party Apache-2.0 increment establishes finite named-crop composition. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN; complete UI/EUI, packed atlas import, phone/native SDK and comparative performance remain future work.

**S098 / V049。** 命名 `createSpriteSheet` 在不可变命名裁剪、静态图标和既有 Engine 时钟序列控制器之间复用一个整图租约。Runtime／Engine 根入口新增一个工厂和两个擦除类型 `SpriteSheet` / `SpriteSheetFrameInput`；package 仍为私有 `0.0.0`，宿主协议为 `1.0`。不新增依赖、公开子路径或动画时钟。

已保存的公开 CPU 100/100 通过，保留 CPU 133/133 分别计数；SS01–SS10 是规格类别。SpriteSheet 正例类型诊断为 0，普通／导入负例分别 22/14，共 36 个精确元组及 6 行续行。原始操作单元 10/10 通过；策略 5/5 含 4 项指定对照，保留通用策略另有 272/272 通过。记录型示例有 8 行、6 次显式 tick、1 次加载和 1 次释放。已独立接受的 Canvas／WebGPU 观察完成 18 次提交（16 个新捕获 + 2 次已保存帧重放）、576 个像素及 2304 个通道的 0 容差比较，并核对有限清理。最终发布门禁、必要推送 hook 与 0.45 PR/Main 保持 PENDING。

已记录的 0.44 交付：PR #31 已合并；Main `1dce76a62cd0a4180969949939041f889eb1d923`、tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`。其 hook 分别通过 63 项 publication、2794 项 core 和 160 项实验测试，KB 问题为 0。远端 status/check-run 数 0/0 不能证明远端 CI PASS；旧 PENDING 截止点保留为历史。

这是 Apache-2.0 下的第一方有限命名裁剪组合增量。完整 Spine R020/V020 和旧工程迁移 R008/V006 保持 OPEN；完整 UI/EUI、打包图集导入、手机／Native SDK 和比较性能仍属于后续工作。

[Contract](knowledge-base/en/docs/spritesheet-contract.md) / [Evidence](knowledge-base/en/docs/spritesheet-evidence.md). Native tool: `tools/spritesheet/README.md`.
<!-- SS1-0.45.0-END -->

<!-- SEQP-0.44.0-BEGIN -->
## Engineering preview 0.44.0 — Engine-clock sequence playback / 工程预览 0.44.0 — Engine 时钟驱动序列播放

**S097 / V048. Explicit Engine-clock sequence playback is accepted within the recorded finite lanes; full prepush, mandatory push hook and current PR/Main remain PENDING.** Use `engine.createSequencePlayback(scope, bitmap, clip, { mode: "once" })`, then `start()`; advance the Engine clock explicitly. The controller supports once/loop, pause, resume and stop, using genuine Scope ownership and the existing texture lease. It adds 3 erased root types and no root runtime value, dependency or public subpath. Rendering stays inert with respect to playback.

Saved public CPU tests passed 41/41; 25 source behavior families are a separate inventory. Positive diagnostics were 0; the two rejected-consumer lanes had 27/13 diagnostics and 40 exact tuples. Policy tests passed 5/5 with 4 assigned controls. The example records 5 rows, 1 atlas load and 1 disposal. The independently reviewed default desktop browser run completed 18 submissions (16 new captures + 2 saved-frame replays), 576 pixels and 2304 channels at tolerance 0, including cleanup.

[Contract](knowledge-base/en/docs/sequence-playback-contract.md) / [Evidence](knowledge-base/en/docs/sequence-playback-evidence.md) / [Native verifier](tools/sequence-playback/README.md). This finite first-party increment does not close full Spine R020/V020 or migration R008/V006. Phone/native SDK, performance, physical display and third-party entitlement remain separate.

**S097 / V048：显式 Engine 时钟驱动的序列播放已在已记录的有限阶段内接受；完整 prepush、必要推送 hook 及当前 PR/Main 仍为 PENDING。** 使用 `engine.createSequencePlayback(scope, bitmap, clip, { mode: "once" })` 后调用 `start()`，显式推进 Engine 时钟。控制器支持 once/loop、暂停、恢复和停止，使用真实 Scope 所有权及既有纹理租约。新增 3 个擦除的根入口类型，不新增根运行时值、依赖或公开子路径；渲染不会推进播放。

保存的公开 CPU 测试 41/41 通过；25 类源码行为是另一份清单。正例诊断为 0；两组拒绝消费的类型负例分别为 27/13 条，共 40 个精确元组。策略测试 5/5 通过，包含 4 项指定对照。示例记录 5 行、1 次图集加载和 1 次释放。独立审阅的默认桌面浏览器运行完成 18 次提交（16 个新捕获 + 2 次旧帧重放）、576 个像素、2304 个通道的 0 容差比较及清理。

[契约](knowledge-base/Cns/docs/时钟驱动序列动画契约.md) / [证据](knowledge-base/Cns/docs/时钟驱动序列动画证据.md) / [原生核验器](tools/sequence-playback/README.zh-CN.md)。这一有限的第一方增量不会关闭完整 Spine R020/V020 或迁移 R008/V006；手机／原生 SDK、性能、物理显示和第三方许可资格分别待验。

Recorded 0.43.0 delivery: [PR #30](https://github.com/cnedwin/Egret_rebuild/pull/30) merged; Main `ced3ef008b8c37868c6d1a505a02737451d937e1` and tree `c42eddecfa6737d12a3093ba0a4067aa9326d702` were read back. Its mandatory hook passed 63 publication, 2748 core and 160 experimental tests, counted separately. Zero remote statuses/check-runs do not establish remote CI PASS. Earlier Pending cutoffs remain historical.

已记录的 0.43.0 交付：[PR #30](https://github.com/cnedwin/Egret_rebuild/pull/30) 已合并；Main `ced3ef008b8c37868c6d1a505a02737451d937e1` 与 tree `c42eddecfa6737d12a3093ba0a4067aa9326d702` 已回读。其必要 hook 通过 63 项 publication、2748 项 core 与 160 项实验测试，分别计数。远端 status/check-run 均为零，不构成远端 CI PASS；较早 Pending 截止点保留为历史。
<!-- SEQP-0.44.0-END -->

<!-- F2-B-0.43.0-BEGIN -->
## Engineering preview 0.43.0 — Spine linear source profile F2-B / 工程预览 0.43.0 — Spine 线性动画源规格 F2-B

**S096 / V047. Finite source behavior, types, policy and the complete development verifier are accepted; current full prepush, push hook and PR/Main delivery remain PENDING.** B retains owned source text and qualifies a fixed single-page, unweighted linear translate/deform profile. The opt-in experiment currently exports 2 values and 10 erased types; default SDK and public SP1 entries gain no B API. Saved B behavior passed 135/135; normal-host types had 0 positive and 100 actual negative diagnostics. The complete experiment verifier passed 160/160 and retained A39/B100 tuples.

[Contract](knowledge-base/en/docs/spine-linear-profile-contract.md) / [Evidence](knowledge-base/en/docs/spine-linear-profile-evidence.md). Source admission grants no Core, pose, resource, playback, rendering or entitlement authority. Controlled faults remain pending; R020/V020 and R008/V006 remain OPEN.

**S096 / V047：有限源行为、类型、策略与完整开发验证器已接受；当前完整 prepush、推送 hook 和 PR/Main 交付仍为 PENDING。** B 保留 owned 源文本，检查固定单页、非加权的线性 translate/deform 源规格。可选实验当前导出 2 个值与 10 个擦除类型；默认 SDK 和公开 SP1 入口不新增 B API。保存的 B 行为 135/135 通过；normal-host 类型正例 0、实际负例 100。完整实验验证器 160/160 通过，保留 A39/B100 元组。

[契约](knowledge-base/Cns/docs/Spine线性动画源规格契约.md) / [证据](knowledge-base/Cns/docs/Spine线性动画源规格证据.md)。源准入不授予 Core、pose、资源、播放、渲染或许可资格；受控故障仍待验收，R020/V020 和 R008/V006 保持 OPEN。

Version 0.42.0 merged through [PR #29](https://github.com/cnedwin/Egret_rebuild/pull/29); Main `e7a82283ef02b57976e5a94e10306fc6aee516b5` and tree `319de5686631afe3213699f9fc2a4a424d7bcbdf` were read back. Its mandatory push hook passed 63 publication, 2748 core and 22 experimental tests, counted separately. Zero remote statuses/check-runs do not establish remote CI PASS. Earlier Pending cutoffs remain historical records.

0.42.0 已经由 [PR #29](https://github.com/cnedwin/Egret_rebuild/pull/29) 合并；Main `e7a82283ef02b57976e5a94e10306fc6aee516b5` 与 tree `319de5686631afe3213699f9fc2a4a424d7bcbdf` 已回读。其必要推送 hook 通过 63 项 publication、2748 项 core 与 22 项实验检查，分别计数。远程 status/check-run 均为 0，不构成远端 CI PASS。较早 Pending 截止点继续保留。
<!-- F2-B-0.43.0-END -->

<!-- F2-A-0.42.0-BEGIN -->
## Engineering preview 0.42.0 — Spine mesh source planning F2-A

**S095 / V046: finite source-planning CPU, types and policy accepted; full prepush, mandatory push hook and PR/Main delivery remain PENDING.**

The development experiment admits original unweighted mesh sources while preserving public SP1 planning boundaries; default SDK exports do not grow. After separate compilation/import, experiment tests passed 22/22: 16 source behavior and 6 boundary tests, including 5 assigned refusal controls. Positive type diagnostics were 0; negative types had 39 complete actual location/code/message records.

These experiment counts are separate from prior core tests. Version 0.41.0 merged through [PR #28](https://github.com/cnedwin/Egret_rebuild/pull/28), with Main `758e516410a126483973a1d65eea0c6ca7f57ef6` and tree `ef0183ba3f555df5fd7a53cb98a677cd01f67356` read back; its mandatory push hook passed 2748 core and 63 publication tests. Remote statuses/check-runs were both 0; remote CI PASS is not claimed.

[Contract](knowledge-base/en/docs/spine-mesh-source-plan-contract.md) / [Evidence](knowledge-base/en/docs/spine-mesh-source-plan-evidence.md) / [Use and development verification](knowledge-base/en/experiments/spine-f2/README.md).

First-party independent Egret design uses AI assistance for engineering and bounded review; public dependencies retain their own licenses. Two internal fault controls remain pending. This slice establishes no Core, deform, playback, rendering, rights, full Spine R020/V020, legacy migration R008/V006, complete UI/3D, multi-host or performance acceptance. Earlier failures and PENDING sections retain their original cutoffs.

## 工程预览 0.42.0 — Spine 网格源规划 F2-A

**S095 / V046：有限源规划 CPU、类型及策略已接受；完整 prepush、必要 push hook 与 PR/Main 交付仍 PENDING。**

开发实验检查原始非加权网格，保留公共 SP1 规划边界；默认 SDK 不新增导出。独立编译／导入后，实验测试 22/22 通过：16 个源行为与 6 个边界测试，包含 5 个指定拒绝对照。正向类型诊断 0；反向类型有 39 条完整实际位置／code／message 记录。

这些实验数字独立于前序核心测试。0.41.0 经 [PR #28](https://github.com/cnedwin/Egret_rebuild/pull/28) 合并，Main `758e516410a126483973a1d65eea0c6ca7f57ef6`、tree `ef0183ba3f555df5fd7a53cb98a677cd01f67356` 已回读；必要推送 hook 通过 2748 core 与 63 publication。远程 status/check-run 均为 0，不宣称远程 CI PASS。

[契约](knowledge-base/Cns/docs/Spine网格源规划契约.md) / [证据](knowledge-base/Cns/docs/Spine网格源规划证据.md) / [使用与开发验证](knowledge-base/Cns/experiments/spine-f2/README.md).

白鹭第一方独立设计，AI 协助工程实施与有界审计；公共依赖保留各自许可。两个内部故障控制仍待验收；Core、deform、播放、渲染、许可、完整 Spine R020/V020、旧工程迁移 R008/V006、完整 UI/3D、多宿主与性能均不由本切片证明。此前失败和 PENDING 段落保留原截止点。
<!-- F2-A-0.42.0-END -->

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](knowledge-base/en/docs/nine-slice-geometry-ns1-contract.md) / [evidence](knowledge-base/en/docs/nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.

### 中文 / Chinese

## 工程预览 0.41.0 — 九宫格拉伸几何 NS1

**S094 / V045。有限 CPU、类型、策略和浏览器结果已接受；完整发布门禁与交付仍为 PENDING。** 固定边框的拉伸网格复用现有 Mesh2D 纹理租约，调整尺寸时仅替换几何。运行时／引擎根入口提供一个工厂与两个只读类型，保留原有自有几何身份。

实际 CPU 27/27 项通过，其中 11 个 NS 组、6 个 Mesh 组及包含嵌套用例的 10 项几何检查。正例类型诊断为 0；两组刻意负例实际为 41/35 条，共 76 条精确位置记录。严格类型门禁与策略检查退出码为 0；指定策略对照 13/13 通过。实际浏览器完成 2 帧和 96 次颜色通道比较，并验证资源清理；具体环境与范围见证据。

原始 NSP09 的 13/12/1 失败与有限测试输入修正分别保留。

0.40.0 ByteWriter 已通过 [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27) 合并；已回读 Main `8e1509878252cc2a9295fcc56d7597877d023c85` 与 tree `ca1f2f176713e388e09016ae22d610c5c1b95201`。必要推送门禁退出码为 0，公开校验 63 项、核心校验 2724 项。远端状态／检查运行数均为零，不能据此声明远端 CI PASS。较早的 PENDING 截止点和失败记录继续保留。

[契约](knowledge-base/Cns/docs/九宫格几何NS1契约.md) / [证据](knowledge-base/Cns/docs/九宫格几何NS1证据.md)。

这是复杂 2D UI 的有限几何增量，不构成完整 UI/EUI、布局、完整 Spine、迁移、手机能耗／性能或原生 SDK／PC 验收。
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Engineering preview 0.40.0 — owned ByteWriter

**S093 / V044. Finite CPU, type and assigned boundary results accepted; final publication gates and delivery remain PENDING.** ByteWriter supplies fixed-capacity strict binary appends, native IEEE floating conversion and independent snapshots of the committed prefix, reusing the original ByteOrder and Scope lifetime.

The build and 37/37 public/regression cases passed: 8 BW groups, 23 ByteReader cases and 6 Scope cases. Separately, 2/2 process-isolated fault test files passed. BW has 24 internal observations and 22 controlled fault hits; these are not extra test cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/16 diagnostics, with 57 exact located/code inventory entries. Strict-type gate and boundary guard exited 0; assigned boundary controls passed 17/17.

Retained complete boundary suite: PENDING_AT_SOURCE_CURATION. This is separate from the finite assigned controls and the pending final complete prepush.

Recorded 0.39.0 delivery successor: textured scene composition was merged through [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26), with Main `ac490f90b7467164e461112a9f572a3269107c02` and tree `c137666681de663360a9bc153d85e6e71f48bd42` read back locally and remotely. The mandatory push hook completed with exit code 0. Remote statuses and check runs were both zero; remote CI PASS is not claimed. Earlier pending cutoffs and the first failed prepush remain historical records.

Read the [contract](knowledge-base/en/docs/byte-writer-bw1-contract.md) and [evidence](knowledge-base/en/docs/byte-writer-bw1-evidence.md). This original first-party utility increment establishes no file format, legacy ByteArray compatibility, full Spine, migration, native SDK or device/performance acceptance. Historical failures, preparation cutoffs and open work remain visible.

### 中文 / Chinese

## 工程预览 0.40.0 — 自有 ByteWriter

**S093 / V044。有限 CPU、类型和指定边界结果已接受；完整发布门禁与交付仍为 PENDING。** ByteWriter 提供固定容量的严格二进制追加、原生 IEEE 浮点转换和已提交前缀的独立快照，复用原有 ByteOrder 与 Scope 生命周期。

实际构建与 37/37 项公开／回归用例通过，其中包括 8 组 BW、23 项 ByteReader 和 6 项 Scope；另有 2/2 个独立进程故障测试文件通过。BW 的 24 条内部观察包含 22 次受控故障触达，不是额外的测试用例。正向类型诊断为 0，两类刻意负向诊断分别为 41/16，共 57 条精确位置／代码记录。严格类型门禁和边界检查退出码均为 0，指定边界对照为 17/17。

保留完整边界套件状态：PENDING_AT_SOURCE_CURATION。它与指定的有限对照及尚待完成的最终完整 prepush 分别记录。

已记录的 0.39.0 交付后继：纹理场景合成已通过 [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26) 合并，Main `ac490f90b7467164e461112a9f572a3269107c02` 与 tree `c137666681de663360a9bc153d85e6e71f48bd42` 已在本地和远端回读一致。必要推送门禁退出码为 0。远端状态与检查运行数均为零，不声明远端 CI PASS。较早的待完成截止点与首轮失败 prepush 继续作为历史记录保留。

阅读[契约](knowledge-base/Cns/docs/字节写入器BW1契约.md)与[证据](knowledge-base/Cns/docs/字节写入器BW1证据.md)。这是一项原创实现的第一方工具类工程增量，不构成文件格式、旧 ByteArray 兼容、完整 Spine、迁移、原生 SDK 或设备／性能验收。历史失败、准备截止点与未完成项保持原样。
<!-- BW1-DOC-0.40.0-END -->

<!-- CHOST-DOC-0.39.0-BEGIN -->
## 0.39.0 proposed — textured scene composition

**CPU scope accepted; native, full gates and publication pending. S092 / V043.** The explicit `createTexturedSceneWebGPUHost` draws an opaque RGB scene and a genuine Engine-captured textured overlay through one owner, two passes and one submission. Set `clearAlpha: 1` and use `renderSceneTexturedFrame`; existing factories and captured-frame lifetime remain unchanged.

Recorded actual results cover the build, combined tests **12/12**, retained scene/textured tests **48/48**, positive types with **0** diagnostics, complete negative inventories **8/16/15**, the boundary guard and four assigned boundary controls **4/4**. This documentation curation is **SOURCE_ONLY / NOT_RUN** and does not add product execution.

The **180-second** full boundary-suite attempt is **INCOMPLETE**. Mandatory full prepush and publication remain **PENDING**. New browser/GPU execution is **NOT_RUN at this preparation cutoff**; physical phones, performance and native SDK acceptance remain unclaimed. FullSpine **R020/V020** and migration **R008/V006** remain **OPEN**.

**Recorded 0.38.0 delivery successor:** public Matrix authoring was merged through [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25), with Main `893f1ca86af10a092066dcccdaaa16ac194efded` and tree `5960109ca14c9a53ba1cd7ba80d967e6451ad102` read back locally and remotely. This supersedes earlier pending delivery labels while preserving their historical cutoffs; it does not establish 0.39 delivery or remote CI PASS.

See the [textured scene contract](knowledge-base/en/docs/textured-scene-host-contract.md) and the [planned public verification record](knowledge-base/evidence/textured-scene-host-verification.json). The record awaits final evidence curation.

## 0.39.0 拟议 — 纹理场景合成

**CPU 有限范围已接受；原生验收、完整门禁和发布待完成。S092 / V043。** 显式 `createTexturedSceneWebGPUHost` 通过同一所有者、两遍渲染和一次提交，绘制不透明 RGB 场景及真实 Engine 捕获的纹理覆盖层。必须设置 `clearAlpha: 1` 并调用 `renderSceneTexturedFrame`；既有工厂与捕获帧生命周期保持原契约。

已记录的实际结果覆盖构建、组合测试 **12/12**、保留场景／纹理测试 **48/48**、正向类型 **0** 项诊断、完整负向清单 **8/16/15**、边界检查和四项指定边界对照 **4/4**。本次文档整理为 **SOURCE_ONLY / NOT_RUN**，未新增产品执行。

**180 秒**完整边界测试尝试为 **INCOMPLETE**。强制完整推送前检查和发布仍为 **PENDING**。新浏览器／GPU 执行在**本准备截止点为 NOT_RUN**；不声明实体手机、性能或原生 SDK 验收。FullSpine **R020/V020** 与迁移 **R008/V006** 继续保持 **OPEN**。

**已记录的 0.38.0 交付后继：** 公共 Matrix 创作已经由 [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25) 合并，Main `893f1ca86af10a092066dcccdaaa16ac194efded` 与树 `5960109ca14c9a53ba1cd7ba80d967e6451ad102` 已完成本地和远端读回。这是较早待交付标签的后继，保留其历史截止点；不构成 0.39 交付或远端 CI PASS。

详见[纹理场景契约](knowledge-base/Cns/docs/textured-scene-host-contract.md)及[计划中的公共核验记录](knowledge-base/evidence/textured-scene-host-verification.json)；该记录待最终证据整理。
**Actual browser successor:** the default headless Edge **155.0.4283.45** run completed **2** genuine frames. All **24** fixed pixels (**12** per frame) matched exact RGBA expectations; each **16384**-byte normalized buffer is preserved in the shared record. Applying the first overlap expectation to the second buffer rejected the changed UI order at **(34, 32)**, without another rendered frame. Host safe close, resource/Scope/lease/Engine cleanup, application device destruction and cooperative browser closure passed. This establishes the bounded composition only; OS process retirement, physical hardware, phones, performance, complete 3D and full Spine remain separate. Full prepush and GitHub delivery are PENDING at this successor cutoff.

**实际浏览器后继：**默认无头 Edge **155.0.4283.45** 完成 **2** 幅真实捕获帧。全部 **24** 个固定像素（每幅 **12** 个）与精确 RGBA 预期一致；每份 **16384** 字节的归一化缓冲保存在共享记录中。将首幅覆盖预期用于第二幅缓冲，在 **(34, 32)** 拒绝了变化后的 UI 顺序，未增加渲染帧。Host 安全关闭、资源／Scope／租约／Engine 清理、应用销毁设备以及浏览器协作式关闭均通过。此处仅验收有限合成能力；操作系统进程退出、实体硬件、手机、性能、完整 3D 和完整 Spine 仍需独立验收。完整 prepush 与 GitHub 交付在本后继截止点仍为 PENDING。
<!-- CHOST-DOC-0.39.0-END -->

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 proposed — public Matrix4 authoring

**SOURCE_ONLY / NOT_RUN. S091 / V042** proposes typed matrix authoring in `@egret/engine/scene3d`: `createMatrix4`, `multiplyMatrix4` and the original `Math3DError` / `Math3DErrorCode` bindings. Editor and JSON source arrays can become owned tuples and compose transforms before existing scene capture. The proposal reuses Egret's independently authored matrix algorithm through thin public forwarders.

Implementation, actual RED/GREEN, public behavior/types, current full gates and delivery are **PENDING**. Clock **0.37.0** delivery is **PENDING at this preparation cutoff**; earlier recorded results and cutoffs are retained. Broader scene/rendering, performance, complete Spine and migration acceptance remain separate.

**Recorded delivery successor:** Clock **0.37.0** was merged through [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24), with Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` read back locally and remotely. This supersedes the earlier delivery checkpoint without rewriting it and establishes no Matrix acceptance or remote CI PASS.

See the [public scene contract](knowledge-base/en/docs/public-scene3d-contract.md) for the proposed API and authoring example.

## 0.38.0 拟议 — 公共 Matrix4 创作

**SOURCE_ONLY / NOT_RUN。S091 / V042** 拟在 `@egret/engine/scene3d` 提供类型化矩阵创作：`createMatrix4`、`multiplyMatrix4` 及原有 `Math3DError` / `Math3DErrorCode` 绑定。编辑器与 JSON 源数组可转换为自有元组，在既有场景捕获前组合变换。方案通过轻量公共转发器复用白鹭独立创作的矩阵算法。

实现、实际 RED/GREEN、公共行为／类型、当前完整门禁及交付均为 **PENDING**。Clock **0.37.0** 交付在**本准备截止点仍为 PENDING**；保留较早记录的结果与截止点。更广的场景／渲染、性能、完整 Spine 及迁移验收继续单独处理。

**已记录的交付后继：** Clock **0.37.0** 已经由 [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24) 合并，Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` 已完成本地与远端读回。这是较早交付检查点的后继，保留原检查点，不构成 Matrix 验收或远端 CI PASS。

拟议 API 与创作示例见[公共场景契约](knowledge-base/Cns/docs/公共3D场景契约.md)。
**Actual 0.38.0 successor:** the old public SDK passed **17** retained cases and refused **4** new cases at the named missing-API assertion; its positive type consumer reported **4** missing exports. The newly built SDK passed **168/168** retained math, projection, scene and public cases, including **21/21** public cases. The positive consumer compiled; **11** intentional import negatives were bound to actual diagnostics, and exact boundary/strict-type gates passed with **0** unexpected failures. Original math algorithms remain unchanged. No new GPU, device or performance acceptance is claimed. Independent source/bilingual review, the full repository gate and delivery remain PENDING at this successor cutoff. See [the shared verification record](knowledge-base/evidence/public-matrix-authoring-verification.json).

**实际 0.38.0 后继：**旧公开 SDK 通过 **17** 项原有用例，**4** 项新增用例在具名缺失 API 断言处失败；正向类型消费者报出 **4** 个缺失导出。新构建 SDK 通过 **168/168** 项原数学、投影、场景及公开用例，其中公开用例为 **21/21**。正向消费者编译通过；**11** 项有意导入负例对应真实诊断，精确边界与严格类型门禁通过，非预期失败为 **0**。原数学算法保持不变。此处不新增 GPU、设备或性能验收结论。独立源码／双语评审、完整仓库门禁与交付在本后继截止点仍为 PENDING。见[共享核验记录](knowledge-base/evidence/public-matrix-authoring-verification.json)。
<!-- MATRIX4-DOC-0.38.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Read [Clock guide](knowledge-base/en/experiments/spine-f1/README.md), [saved verification](knowledge-base/evidence/spine-f1-clock-verification.json) and [pending public projection](knowledge-base/evidence/spine-f1-clock-public-projection.json).

### 中文 / Chinese

## 工程预览 0.37.0 — 可选 F1 Clock 候选

**S090 / V041** 登记原创 F1 Clock 实验；**D017 仍为 proposed**，仅涉及实验的受信会话及显式可选出处。已保存私有 CPU 执行通过 **10/10** Clock 用例，包含具名推进后故障；**3** 项指定错误副本对照各有新基线。原手动 **12/12** 保持不变。已保存私有桌面 WebGPU 执行通过 **10** 次正例回读及 **1** 次独立重复推进对照：**30** 个原始正例采样点、**120** 个通道、容差 **0**，并观察完整字节重复与限定清理。各阶段数量不与历史运行相加。

**公开 Clock 可移植源码／重放、当前完整门禁、最终双语评审、必要推送及 0.37.0 交付，在本次策展截止时均为 PENDING。** 私有结果不能替代这些步骤。下方 0.36.0 段落保留历史 pending 截止状态；0.36.0 后续已通过 [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23) 交付，Main 为 `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`。

官方外置 `@esotericsoftware/spine-core@4.3.13` 明确署名，不打包、不改许可。集成／分发资格仍未核实。完整 Spine **R020/V020 继续 OPEN**；上述观察不构成手机／Native SDK、物理 GPU、操作系统进程退役、性能／能耗或完整产品验收。

阅读 [Clock 指南](knowledge-base/Cns/experiments/spine-f1/README.md)、[已保存核验](knowledge-base/evidence/spine-f1-clock-verification.json)和[待完成公开投影](knowledge-base/evidence/spine-f1-clock-public-projection.json)。
A subsequent actual replay of the public source in an independent clone passed manual **12/12** with **6** original controls and full Clock **10/10** with **3** assigned controls; the named fault actually executed, with **0** skipped accepted cases. Separate default-headless WebGPU execution passed **10+1** readbacks, **30** positive samples and **120** channels at tolerance **0**, retaining original full-byte relations and bounded cleanup. Cold import/help observed **280** modules and **0** Core/GPU/host accesses. The saved CPU collection retains its earlier native-pending cutoff; the separate native receipt is the actual successor. Original source and input identities remained unchanged. Independent saved-result review, final repository gates and delivery remain PENDING here; full Spine **R020/V020 remains OPEN**. See the current successor in the linked Clock verification/projection records.

随后在独立克隆中实际重放公开源码：手动 **12/12** 及 **6** 项原对照、完整 Clock **10/10** 及 **3** 项指定对照通过；具名故障实际执行，获接受用例跳过数为 **0**。独立默认无界面 WebGPU 执行通过 **10+1** 次回读、**30** 个正例采样点和 **120** 个通道，容差 **0**，保持原完整字节关系与限定清理。冷导入／帮助观察 **280** 个模块，Core／GPU／宿主访问均为 **0**。已保存 CPU 集合保留较早的 native-pending 截止状态；独立 native 回执才是实际后继。原创源码与输入身份未变。此处独立保存结果评审、最终仓库门禁和交付仍为 PENDING；完整 Spine **R020/V020 继续 OPEN**。当前后继见所链接的 Clock 核验／投影记录。
<!-- F1C-DOC-0.37.0-END -->

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](knowledge-base/en/experiments/spine-f1/README.md), [verification](knowledge-base/evidence/spine-f1-manual-verification.json) and [projection provenance](knowledge-base/evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

### 中文 / Chinese

<!-- SP1B-DOC-0.36.0-BEGIN -->
## 工程预览 0.36.0 — 原创 F1 Spine 实验

可选的原创两区域手动动画桥接接入真实资源与自有 Mesh2D 几何。可移植 CPU 执行通过 **12/12** 项原始测试及 **6** 项指定错误对照，各项均先通过全新基线。完整 Spine **R020/V020 继续 OPEN**。

另行浏览器 WebGPU 桌面验证记录 **8** 次正例提交及 **1** 项重复推进指定错误对照；独立的 **3** 次读回分类 actor 验证 `PIXEL_FAIL`，各组结果不合计。已准备的公开 CPU／浏览器复现工具也在一个新 clone 通过相同 **8+1** profile；这是重复观察，不增加特性覆盖。其有限独立评审有 **0** 项开放问题。公开 checkout 也通过相同 CPU／浏览器 profile。**本截止点，最终公开门禁及 0.36.0 交付继续 PENDING。** 精确 profile、原创 oracle、来源条款及后续 UI／runtime／创作／迁移工作见[实验指南](knowledge-base/Cns/experiments/spine-f1/README.md)、[验证](knowledge-base/evidence/spine-f1-manual-verification.json)与[投影出处](knowledge-base/evidence/spine-f1-public-projection.json)。

前一版本 **0.35.0** 已经 [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22) 实际交付；其记录的门禁及 Main 身份见指南／证据。远端 **0** 项状态和 **0** 项检查任务不证明 CI 通过。以下早先 PENDING 截止点继续保留为历史。
<!-- SP1B-DOC-0.36.0-END -->

<!-- SPH-DOC-0.35.0-BEGIN -->
## Engineering preview 0.35.0 — Scope ownership repair

Four internal Scope members now use JavaScript private storage/dispatch. Explicit same-name properties cannot bypass registration, replace owned cleanup values or cancellation, or retain closed Scopes in shutdown tracking. Public API and error/cleanup order remain intact. See the [contract and evidence](knowledge-base/en/docs/scope-private-ownership.md).

Original baseline passed; the unchanged six-test suite produced 1 pass / 5 assigned failures. After repair: **6/6** new and **183/183** retained lifecycle tests, build, strict types and boundaries passed. Independent implementation review has zero open findings. Final full publication checks and **0.35.0** delivery are **PENDING** at this cutoff.

The preceding **0.34.0** was delivered through [PR #21](https://github.com/cnedwin/Egret_rebuild/pull/21), Main `74ca6c3293167d8d3eb253074c0596bd1922db21`, tree `94e6a96f17b656cb8cd28cd65a75f48575cb0c38`. Its mandatory push gate passed **2672/2672** core and **63/63** publication tests, checking **147** document pairs and **177** critical comment records. GitHub returned **0** statuses and **0** check runs; no remote CI PASS is claimed. Earlier pending cutoffs remain history.

This covers four explicit named shadows; it makes no claim about all internals, arbitrary public overrides, security isolation, GC or device performance. The next Spine step connects original manual animation fixtures to owned Mesh2D frames; full Spine, UI, 3D, platform, AI workflow and legacy migration acceptance remain in the engineering plan.

### 中文

## 工程预览 0.35.0 — Scope 所有权修复

Scope 的四个内部成员改为 JavaScript 私有存储／调用。显式同名属性不能绕过登记、替换自有清理列表或取消控制器，也不能令关闭后的 Scope 滞留关闭跟踪。公共 API 与错误／清理顺序保持不变。 见 [契约与证据](knowledge-base/Cns/docs/Scope私有所有权.md).

原基线通过；未修改实现的六项测试得到 1 项通过／5 项指定失败。修复后：**6/6** 新测试、**183/183** 保留生命周期测试、构建、严格类型与边界通过。独立实现评审无开放问题。本截止点的最终完整公开检查及 **0.35.0** 交付为 **PENDING**。

前一版本 **0.34.0** 已经 [PR #21](https://github.com/cnedwin/Egret_rebuild/pull/21) 交付，Main 为 `74ca6c3293167d8d3eb253074c0596bd1922db21`，树为 `94e6a96f17b656cb8cd28cd65a75f48575cb0c38`。必要推送门禁通过 **2672/2672** 项核心及 **63/63** 项公开检查，检查 **147** 对文档与 **177** 项关键注释记录。GitHub 返回 **0** 项状态和 **0** 项检查任务；不宣称远端 CI 通过。早先待完成截止点继续作为历史保留。

本次仅覆盖四个显式同名属性案例，不宣称全部内部成员、任意公共覆盖、安全隔离、GC 或设备性能已验证。下一项 Spine 工作将原创手动动画 fixture 接入自有 Mesh2D 帧；完整 Spine、UI、3D、平台、AI 工作流及旧工程迁移的验收继续列入工程规划。
<!-- SPH-DOC-0.35.0-END -->

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Engineering preview 0.34.0 — Spine import planning

The optional built `@egret/project/spine` entry provides `createSpineImportPlan` and frozen `SPINE_IMPORT_LIMITS`. It prepares an immutable bounded plan from stable 4.3 skeleton JSON, a modern atlas and explicit page-to-asset bindings. Precise diagnostics identify original source locations. Read the [contract](knowledge-base/en/docs/spine-import-plan-contract.md) and [verification record](knowledge-base/evidence/spine-import-plan-verification.json). Successful planning keeps animation semantics and rendering **not_run**, entitlement **unverified** and feature inventory **partial**.

<!-- SP1A-READING-ACTUAL-BEGIN -->
Current build and production boundary scan passed (465 files). Public planning behavior passed **32/32**; TypeScript **7.0.2** passed one DOM-free positive and **22 + 6** exact unsuppressed negative diagnostics. Focused policy passed **9/9**, and **5** separate owned-copy controls each passed a genuine baseline before failing its assigned mutant witness. Independent finite implementation review has zero open findings. Initial **30/32** exposed a test-helper source-ID assumption; the retained production boundary refusal exposed message wording and exact forwarding punctuation. Narrow repairs preserve the API and guard rules. Final complete publication checks, the mandatory push hook and **0.34.0** remote delivery remain **PENDING** at this cutoff.
<!-- SP1A-READING-ACTUAL-END -->

The preceding **0.33.0** package was delivered through [PR #20](https://github.com/cnedwin/Egret_rebuild/pull/20), merged to Main `4ae7e71ee72e5f2c46e7dbccd28b27f482294a0c`, tree `f340e46f0d88783b268b732dcacbfcf7c45a363a`. Its complete mandatory push gate passed **2,631/2,631** core and **63/63** publication tests, **145** document pairs and **174** critical comment records. Local/remote Main identity and a clean checkout were verified at **2026-10-11 23:31:37 UTC**. GitHub returned zero statuses and check runs; no remote CI PASS is claimed. Earlier pending cutoffs below remain historical.

Full Spine **R020/V020** remains open. A separately prepared official core artifact and original animation fixture recipe establish research inputs, not executed playback, redistribution rights or product acceptance. Next work connects per-instance animation state and owned mesh frames to the genuine clock, asset leases and renderers. Complete UI, target phones/SDKs, performance, editor/Agent workflows and legacy migration remain in the engineering plan.

### 中文

## 工程预览 0.34.0 — Spine 导入计划

可选构建入口 `@egret/project/spine` 提供 `createSpineImportPlan` 和冻结的 `SPINE_IMPORT_LIMITS`。它根据稳定版 4.3 骨骼 JSON、现代格式图集及显式页面与资源绑定，生成有界、不可变的导入计划；精确诊断指向原始来源位置。见[契约](knowledge-base/Cns/docs/Spine导入计划契约.md)和[验证记录](knowledge-base/evidence/spine-import-plan-verification.json)。计划成功时，动画语义与渲染仍为 **not_run**，许可资格为 **unverified**，特性清单为 **partial**。

<!-- SP1A-READING-ACTUAL-BEGIN -->
当前构建和生产边界检查通过（465 个文件）。公共计划行为通过 **32/32**；TypeScript **7.0.2** 通过一个无 DOM 正例及 **22 + 6** 条精确、未抑制的负例诊断。限定策略通过 **9/9**；**5** 项独立自有副本对照均先通过真实基线，再在指定变体观察点拒绝。独立有限实现评审无开放问题。最初 **30/32** 暴露测试辅助代码的来源 ID 假设；保留的生产边界拒绝定位到消息措辞和精确类型转发标点。限定修正保留 API 与门禁规则。本截止点的最终完整公开检查、必要推送门禁及 **0.34.0** 远端交付仍为 **PENDING**。
<!-- SP1A-READING-ACTUAL-END -->

前一版本 **0.33.0** 已经 [PR #20](https://github.com/cnedwin/Egret_rebuild/pull/20) 交付，合并至 Main `4ae7e71ee72e5f2c46e7dbccd28b27f482294a0c`，树 `f340e46f0d88783b268b732dcacbfcf7c45a363a`。必要推送门禁完整通过 **2,631/2,631** 项核心和 **63/63** 项公开检查，并检查 **145** 对文档及 **174** 项关键注释记录。**2026-10-11 23:31:37 UTC** 核对了本地／远端 Main 身份及干净工作区。GitHub 返回零项状态和检查任务，因此不宣称远端 CI 通过。以下早先待完成截止点作为历史保留。

完整 Spine **R020/V020** 仍未完成。另行准备的官方 core 产物与原创动画 fixture 方案确认了研究输入，并未执行播放、确认分发资格或完成产品验收。下一步将每实例动画状态及自有网格帧接入真实时钟、资源租约和渲染器。完整 UI、目标手机／SDK、性能、编辑器／Agent 工作流和旧工程迁移继续列入工程规划。
<!-- SP1A-DOC-0.34.0-END -->

<!-- MI1-DOC-0.33.0-BEGIN -->
## Current engineering preview / 当前工程预览

### English

Development preview **0.33.0 (MI1)** introduces Scope-owned primary mouse input through the optional `@egret/engine/web/input` entry. It connects existing logical hit testing and typed display events while rendering remains explicit. Read the [primary mouse contract](knowledge-base/en/docs/primary-mouse-input-contract.md) and designated [verification record](knowledge-base/evidence/primary-mouse-input-verification.json) for the exact profile, ownership, failure handling and gate scopes.

At the documentation cutoff **2026-10-11 22:52:43 UTC**, the final Engine build and genuine public interface check passed. Public MI1 behavior/lifecycle passed **98/98**. TypeScript **7.0.2** passed one public positive and matched **26 + 15 + 5** exact unsuppressed negative diagnostics; the public type gate exited **0**. Focused MI1 policy passed **21/21** after correcting one expected diagnostic to retain the existing guard order. Public cancellation **8/8** and earlier retained CPU checks keep their separately recorded scopes. These overlapping checks are not added.

Default headless Edge **154.0.4258.62** with Playwright **1.62.1** passed the fixed desktop Canvas mouse subset: **1** genuine native baseline and **6** assigned controls cover literal events, logical points, RGBA witnesses and observed physical listener cleanup. The ordinary HTTP example passed, and collector policy/grammar units passed **13/13**. All **7** retained desktop gates—Canvas, WebGPU, B1, textured rendering, sequence animation, Canvas text and picking—passed their existing bounded profiles. This establishes neither phones, arbitrary UI/3D, OS reclamation nor a performance lead.

**The complete 259-case boundary rerun, final publication/bilingual checks, mandatory pre-push gate and current 0.33.0 remote delivery remain PENDING.** The earlier timeout and full **258/259** result retain their original artifacts; the latter exposed one expected-message mismatch. Focused **21/21** is its finite successor, not a complete rerun. Other earlier failures retain their recorded identities and cutoffs in the verification record.

The delivered baseline **0.32.0 (S3D1)** was merged through [PR #19](https://github.com/cnedwin/Egret_rebuild/pull/19) to Main `a240bc1e6ee218c63fc1511d715d01d1358d908f`. Earlier scene/preview sections retain their original sources, results and pending/failure cutoffs as history; their earlier pending labels do not undo this delivery.

Full Spine support **R020/V020** remains planned, implementation **not_started**, acceptance **not_run**. Complete UI, touch/pen, phones, Native SDKs, target-device performance, editor/Agent tools and complete legacy migration retain their separate implementation and acceptance obligations.

### 中文

开发预览 **0.33.0 (MI1)** 通过可选 `@egret/engine/web/input` 入口提供 Scope 所有的主鼠标输入，连接既有逻辑命中与类型化显示事件，渲染仍由应用显式控制。精确 profile、所有权、故障处理和门禁范围见[主鼠标契约](knowledge-base/Cns/docs/主鼠标输入契约.md)及指定的[验证记录](knowledge-base/evidence/primary-mouse-input-verification.json)。

截至文档截止点 **2026-10-11 22:52:43 UTC**，最终 Engine 构建与真实公共接口检查通过。MI1 公共行为／生命周期通过 **98/98**。TypeScript **7.0.2** 通过一个公共正例，并匹配 **26 + 15 + 5** 条精确、未抑制的负例诊断；公共类型门禁退出码为 **0**。修正一项预期诊断并保留既有门禁顺序后，MI1 限定策略通过 **21/21**。公共取消 **8/8** 与早先既有 CPU 检查继续保留各自记录范围；这些重叠检查不合计。

默认无界面 Edge **154.0.4258.62** 配合 Playwright **1.62.1** 通过固定桌面 Canvas 鼠标子集：**1** 个真实原生基线和 **6** 项指定对照覆盖字面事件、逻辑坐标、RGBA 观察及实际监听移除。普通 HTTP 示例通过，采集器策略／语法单元通过 **13/13**。**7** 项既有桌面门禁——Canvas、WebGPU、B1、纹理渲染、序列动画、Canvas 文字和拾取——在各自有界 profile 内通过。这不验收手机、任意 UI／3D、操作系统回收或性能领先。

**完整 259 项边界重跑、最终公开／双语检查、必要推送前门禁及本次 0.33.0 远端交付仍为 PENDING。** 早先超时和完整 **258/259** 结果保留原产物；后者暴露一项预期消息不匹配。限定 **21/21** 是其有限后继，不是完整重跑。其余早先失败在验证记录中保留原身份与截止点。

已交付基线 **0.32.0 (S3D1)** 经 [PR #19](https://github.com/cnedwin/Egret_rebuild/pull/19) 合并至 Main `a240bc1e6ee218c63fc1511d715d01d1358d908f`。早先场景／预览章节作为历史保留原来源、结果及待完成／失败截止点；原待完成标签不推翻此次交付。

完整 Spine 支持 **R020/V020** 仍为 planned，实施 **not_started**，验收 **not_run**。完整 UI、触摸／笔、手机、Native SDK、目标设备性能、编辑器／Agent 工具及旧工程完整迁移继续保留各自实现与验收义务。
<!-- MI1-DOC-0.33.0-END -->

<!-- S3D1-DOC-0.32.0-BEGIN -->
## Current bounded scene checkpoint / 当前限定场景检查点

### English

Verified implementation: public behavior **35/35**, boundaries **238/238**, **2** positive type consumers and **10 + 3 + 11 + 15** exact negative diagnostics pass. Retained integration checks **161/161** and fresh fixed headless Edge composition pass after independently reviewed repairs. Full final publication and current delivery remain pending at this curation cutoff; the linked scene contract records exact scopes and successors.

**Initial source/API observation (historical cutoff):**

The proposed **0.32.0 (S3D1)** checkpoint exposes immutable geometry and camera-space scene frames through `@egret/engine/scene3d`, with an explicit browser Host at `@egret/engine/webgpu/scene3d`. The independently designed facades directly reuse current first-party algorithms. At **2026-10-11 19:54:25–19:54:26 UTC**, three-file adoption, build and interface GREEN confirmed source/API reachability only. Behavior, types, policy, native composition and final acceptance/delivery are **PENDING**. Read the [bounded public scene contract](knowledge-base/en/docs/public-scene3d-contract.md). This is an experimental procedural mesh plus ordered screen-UI route; complete UI/3D, assets, characters, Spine, Native SDKs and performance remain separate roadmap obligations.

The delivered **0.31.0** successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. The changelog and current-scope paragraphs below preserve earlier saved curation cutoffs; their prior pending labels are historical observations.

### 中文

已验证的实现：公共行为 **35/35**、边界 **238/238**、**2** 个类型正例及 **10 + 3 + 11 + 15** 条精确负例诊断通过。经独立审阅的修正后，保留集成检查 **161/161** 和重新执行的固定无界面 Edge 合成通过。最终完整公开运行与当前交付在本整理截止点仍待完成；所链接场景契约记录精确范围及后继。

**初始源码／API 观察（历史截止点）：**

拟议 **0.32.0 (S3D1)** 检查点通过 `@egret/engine/scene3d` 公开不可变网格及相机空间场景帧，并以 `@egret/engine/webgpu/scene3d` 提供显式浏览器 Host。独立设计的 facade 直接复用当前第一方算法。在 **2026-10-11 19:54:25–19:54:26 UTC**，三文件采用、构建及接口 GREEN 仅确认源码／API 可达性；行为、类型、策略、原生合成及最终验收／交付均为 **PENDING**。阅读[限定公共场景契约](knowledge-base/Cns/docs/公共3D场景契约.md)。这是实验性程序化网格加有序屏幕 UI 路径；完整 UI／3D、资产、角色、Spine、Native SDK 及性能仍是单独路线图义务。

已交付的 **0.31.0** 后继经 [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) 合并至 Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`，树 `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`。下方 changelog 与当前范围段落保留早先整理截止点，其中原待完成标签属于历史观察。
<!-- S3D1-DOC-0.32.0-END -->

## Changelog / 更新记录

### 中文

以下按从新到旧排列工程与知识库检查点，不代表 npm 或生产发行。工作区包仍为 private、版本 `0.0.0`，协议固定值仍为 `1.0`；各项结果仅适用于其记录的源码和验证范围。

| 检查点 | 主要解决的问题 | 记录 |
| --- | --- | --- |
| 0.46.0 | 可选限定浏览器 PNG 纹理与既有资源／动画所有权；CPU／类型／策略及默认浏览器 Canvas／WebGPU 子集已接受，完整门禁与交付待完成。 | [详情](knowledge-base/Cns/docs/浏览器PNG验证证据.md) |
| 未发行 | 英文优先的社区入口、独立的 `en/` 与 `Cns/` 知识库、英文文件名、创始人介绍与双语 Changelog。精简文档入口，集中历史研究，便于查阅。 | [详情](knowledge-base/Cns/docs/documentation-layout.md) |
| 0.33.0 | Scope 所有的主鼠标输入：公共行为／生命周期 98/98、一个正例及 26/15/5 精确类型负例、MI1 策略 21/21、原生基线及六项对照、七项既有桌面门禁通过。完整边界重跑、最终公开／推送门禁和本次交付待完成。 | [契约](knowledge-base/Cns/docs/主鼠标输入契约.md) |
| 0.32.0 | 显式拥有型低层 3D 场景帧与 WebGPU 场景/UI 合成。公共行为 35/35、边界 238/238、精确严格类型、保留集成 161/161 及重新执行的固定桌面像素通过；最终公开运行与交付单独跟踪。 | [契约](knowledge-base/Cns/docs/公共3D场景契约.md) |
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

### English

These are engineering and knowledge-base checkpoints, newest first, rather than npm or production releases. Workspace packages remain private at `0.0.0`; protocol pins remain `1.0`. Each result belongs to its recorded source and test scope.

| Checkpoint | Main problem addressed | Record |
| --- | --- | --- |
| 0.46.0 | Optional bounded browser PNG textures with existing asset/animation ownership; CPU/type/policy and default-browser Canvas/WebGPU subset accepted; complete gates and delivery pending. | [Details](knowledge-base/en/docs/browser-png-evidence.md) |
| Unreleased | English-first community entry, separate `en/` and `Cns/` knowledge-base editions, English filenames, founder introduction and bilingual Changelog. Simplified document entries and grouped historical research for easier navigation. | [Details](knowledge-base/en/docs/documentation-layout.md) |
| 0.33.0 | Scope-owned primary mouse input: public behavior/lifecycle 98/98, one positive + 26/15/5 exact type negatives, MI1 policy 21/21, native baseline + six controls and seven retained desktop gates pass. Full boundary rerun, final publication/push gate and current delivery remain pending. | [Contract](knowledge-base/en/docs/primary-mouse-input-contract.md) |
| 0.32.0 | Explicit owned low-level 3D scene frames and WebGPU scene/UI composition. Public behavior 35/35, boundaries 238/238, exact strict types, retained integration 161/161 and fresh fixed desktop pixels pass; final publication and delivery are tracked separately. | [Contract](knowledge-base/en/docs/public-scene3d-contract.md) |
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

## 当前范围与参与方式

历史工程预览 **0.31.0**，为依赖资源的场景新增 Scope 所有的资源批量获取。已采用工作树构建、双纹理 CPU 示例及 **86/86** 合并检查通过（**29** 项 RG1、**57** 项既有资源/生命周期）。私有严格类型将 **15** 个普通、**11** 个导入反例绑定精确、未抑制诊断；修正后的有限策略为 **35/35**。七项既有桌面浏览器 profile 在原子集通过，没有执行使用 group 的浏览器应用。此前 **28/29**、**34/35** 及当前 **29/86** 结果重叠，不合计。[共享核验记录](knowledge-base/evidence/resource-acquisition-groups-verification.json)跟踪完整当前检查、双语/公开审阅、必要推送钩子及 RG1 远端交付后继。第一方代码保持 Apache-2.0、不新增依赖；private 包为 `0.0.0`、协议 `1.0`。阅读[合并的契约、用法和有界证据](knowledge-base/Cns/docs/资源批量获取.md)。R020/V020 完整 Spine、完整 UI/3D、手机、性能、物理资源回收及迁移仍是单独未完成的验收义务。

下方段落保留早先 0.30.0 准备截止点；其单独交付见 [PR #17](https://github.com/cnedwin/Egret_rebuild/pull/17)。

历史工程预览 **0.30.0**，新增组合既有 Stage、类型化事件与 CanvasHost 的小型显示拾取应用。实际已采用公共入口的无界面运行通过 12/12；私有执行与独立核心审阅单独记录，重叠数量不合计。范围涵盖自定义重叠／裁剪、字面半开边界、CSS 鼠标坐标、分发返回后的一次重绘／渲染，以及有界启动／关闭所有权。新桌面后继在默认 Edge **154.0.4258.62** 中通过 **PASS_DESKTOP_HT1_CANVAS_SUBSET**：十个基线记录与五项指定对照覆盖真实鼠标输入、类型化路径、Canvas 像素及独立的六组原生监听账本。纯准入检查单独通过 **32/32**，不同范围数量不合计。 完整本地验证通过：构建、类型夹具及包边界；核心 **2377/2377** 与结构化公开检查 **63/63**。本地化检查覆盖 **140** 对文档、**6** 个注册表视图及 **154** 个关键源文件。知识库验证检查 **159** 条记录、**243** 份 Markdown、**1997** 个链接及 **955** 个引用，问题数为 **0**；无界面生命周期关闭后待处理计时器为 **0**。以上是不同范围，不合并为测试总数。 最终独立双语语义审阅、必要 Git 推送钩子及交付仍为 **PENDING**。这是固定桌面鼠标／Canvas 子集；手机、操作系统／物理回收、性能及完整输入／UI／Spine 验收单独保留。包保持 private `0.0.0`、协议 `1.0`。阅读[示例记录](knowledge-base/Cns/docs/显示拾取示例.md)与[运行指南](examples/hit-test/README.zh-CN.md)。我们正在为主要依靠 AI 制作游戏的创作者，重建开源游戏引擎与创作流程，首期方向涵盖复杂 2D UI 与轻量 3D。仓库包含实验性核心和结构化知识库；完整引擎、生产平台宿主、编辑器、Agent 服务、目标设备性能及完整旧工程迁移仍待实施或验收。

**0.29.0** HT1 交付后继通过必要推送钩子（2,333 项核心与 59 项公开检查），经 [PR #16](https://github.com/cnedwin/Egret_rebuild/pull/16) 合并至 Main `fb7f15b21cf80345e23490c551552deb4b68061a`，树 `e79ad52bf85a1efa7835a1d4074c5a4368ca8981`，记录源码提交为 `6e724971938ec8be4d271066f327814394e0b7fb`。远程状态／检查数量均为 0，不宣称远程 CI 通过；此前准备记录保留原待完成／失败截止点。

**0.28.0** Canvas 文字交付后继通过必要推送钩子（2,285 项核心与 59 项公开检查），经 [PR #15](https://github.com/cnedwin/Egret_rebuild/pull/15) 合并至 Main `b704349207c536d2bdae38496ef622613355a3f4`，树 `d1b4fcd5629c2fe54455244534220c50e0cdc419`，记录源码提交为 `94f239b2d1bd6b1af6f63ebc4f375bc7c9894bca`。远程状态／检查数量均为 0，不宣称远程 CI 通过；此前准备记录保留原待完成／失败截止点。

前序 **0.27.2** 显示树增量通过 2,228 项核心测试、52 项公开检查和全部五项受影响既有浏览器门禁，随后经 [PR #14](https://github.com/cnedwin/Egret_rebuild/pull/14) 交付至 Main `b8446d23d6cf8b979d05d35757876811fe190e7a`。这些结果保留该源码截止点。

`ByteReader` 与冻结的 `BYTE_READER_LIMITS` 是 engine／runtime 根入口共享的值；`ByteOrder` 仅为类型。读取器拥有固定快照，支持显式字节序，越界读取原子拒绝，并返回独立副本。阅读[契约](knowledge-base/Cns/docs/字节读取器BR1契约.md)与[有界证据](knowledge-base/Cns/docs/字节读取器BR1证据.md)。

0.27.0 工程预览通过 `@egret/engine/text` 新增工厂所有、不可编辑的 TextField：`createTextField(engine, scope, cache)` 及仅类型 `TextField`／`TextFieldStatus`。十标量请求、显式准备、版本替换及合并工作的调用者租约遵循真实 Engine／Scope／cache 归属。已提交图片与空白直接边界在既有预算下接入两种可采集图片的 collector；旧路径的图片拒绝保持。默认根入口不变。 阅读[契约](knowledge-base/Cns/docs/文字显示TF1契约.md)与[证据](knowledge-base/Cns/docs/文字显示TF1证据.md)。

`engine.createTween(scope, options)` 提供一次性 start/pause/resume/stop、同步标量回调与 Scope/Engine 清理，以及 `linear`、`quadIn`、`quadOut`、`quadInOut` 缓动。它使用前序 0.25.0 游戏时钟：推进不渲染，捕获/渲染不推进时间。阅读[标量契约](knowledge-base/Cns/docs/标量补间契约.md)与[有界证据](knowledge-base/Cns/docs/标量补间证据.md)。

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
