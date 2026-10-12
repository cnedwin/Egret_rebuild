# Spine 线性动画源规格契约

[English](../../en/docs/spine-linear-profile-contract.md) | 简体中文

工程预览 **0.43.0 候选** · 规格 **S096** · 验证 **V047**。F2-B 在可选的 `knowledge-base/experiments/spine-f2` 实验中增加同步、无 DOM 的源规格规划器，准入有界的静态拓扑和线性 translate/deform 源描述。它为未来兼容性桥接保留自有源文本，不生成姿态、播放器、资源权限或渲染帧。[证据与当前边界](Spine线性动画源规格证据.md)独立于本契约。完整 Spine **R020/V020 保持 OPEN**。

## 入口、所有权与结果

独立实验构建后，公开入口为 `knowledge-base/experiments/spine-f2/dist/index.js`。整个实验命名空间包含 **2 个运行时值**：保留的 `createF2MeshSourcePlan` 与新增的 `createF2MeshProfilePlan(input: SpineImportInput): F2MeshProfileResult`，以及 **10 个擦除类型**：原有 `F2MeshSourceDiagnosticCode`、`F2MeshSourceDiagnostic`、`F2MeshSourceSummary`、`F2SetupReference`、`F2MeshSourcePlan`、`F2MeshSourceResult`，加上 `F2MeshProfileDiagnosticCode`、`F2MeshProfileDiagnostic`、`F2MeshProfilePlan`、`F2MeshProfileResult`。默认 SDK 根入口与 `@egret/project/spine` 不增加实验导出或 npm 包。

输入是公共 `SpineImportInput`，不能以调用方自行构造的 plan 作为权限。共用私有流程只持有一次经过描述符检查的快照，调用公共 SP1 一次，从同一文本形成一次有界的公共 jsonc-parser visitor 视图，并在 F2-B 前完成全部原有 F2-A 检查。A 外壳保留结果和拒绝顺序，丢弃私有全文与视图。B 成功结果保留递归冻结的输入记录、来源声明与页面绑定副本；skeleton/atlas 字符串保留原始 code unit。[A 契约](Spine网格源规划契约.md)和 [SP1 契约](Spine导入计划契约.md)的独立上限与优先级保持有效。

输入要求普通自有数据描述符，不调用 getter。pages 先通过真实普通数组资格，再检查 **64 页复制上限**，然后检查密度与索引描述符；接受已冻结的普通数组。沿用的文本／视图上限为 skeleton **8 MiB**、atlas **1 MiB**、JSON 深度 **32**、节点 **262144**、属性 **131072**、key **1024 UTF-8 字节**、string **65536 UTF-8 字节**、pointer **2048 UTF-8 字节**。不增加隐式转换、正规化或哈希／权利认证。Proxy 副作用、替换 intrinsic 和进程级资源耗尽不属于隔离保证。

新 plan 的字段均 readonly；所有记录、数组及复制的 span 都是冻结的普通数据：

| 字段 | 精确内容 |
| --- | --- |
| `planVersion`、`profile` | `1`、`'static-unweighted-linear-4.3.13'` |
| `sourcePlan`、`ownedInput` | 本次调用未改变的 A plan 和公共输入副本 |
| `page` | `pageName`、`assetId`、`width`、`height`、`regionCount` |
| `bones[]` | `name`、`pointer`、`span`、`parentIndex`、`depth`、`x`、`y`；根 parent index 为 −1 |
| `slots[]` | `name`、`pointer`、`span`、`boneIndex`、`attachmentPointer: string \| null` |
| `attachments[]` | `pointer`、`span`、`slotIndex`、`attachmentName`、`path`、`kind: 'region' \| 'mesh'`、`vertexCount`、`indexCount`；包含未激活附件 |
| `animations[]` | `name`、`pointer`、`span`、`duration`、`timelineCount`、`keyframeCount`、`expandedDeformScalarCount`、`timelines` |
| `timelines[]` | `kind: 'translate' \| 'deform'`、`pointer`、`span`、`boneIndex`、`slotIndex`、`attachmentPointer`、`keyframeCount`、`firstTime`、`lastTime`、`expandedDeformScalarCount`；translate 使用 bone index，deform 使用 slot/attachment，未用目标为 null |
| `acceptance` | `sourceProfile` 与 `linearTimelineSourceAdmission` 为 `'passed'`；`coreCompatibility`、`poseNumerics`、`resourceIdentity`、`playback`、`rendering` 为 `'not_run'`；`licenseEntitlement` 为 `'unverified'` |

合法数字（包括 −0）保持原值。不返回 typed array、Map、visitor 节点、帧 payload 或完整解析对象。结构化记录没有新增 brand 或执行权限。未来桥接必须建立自身的来源权限与兼容资格，不能反射一个调用方伪造的 plan 即视为有效。

成功为 `{ok:true, value, diagnostics}`，保留 SP1 warnings。A 拒绝原样透传，包括阶段、codes、messages 和 related spans。B 拒绝为 `{ok:false, stage:'profile', diagnostics: readonly [F2MeshProfileDiagnostic]}`：单条冻结诊断，没有 value、部分清单或先前 warnings。意外的非诊断异常使用固定 `F2_PROFILE_INTERNAL`、input 根 pointer、无 span，不暴露任意异常文本。释放私有视图引用不承诺 GC 时间或物理清零。

## 固定准入顺序

1. 完成 A 原有全部流程：快照形状／pages 资格、复制上限、密度；SP1 严格 JSON／版本／atlas／绑定；有界视图；全部容器／编码；逐 mesh 完整原始形状／预算／数值／索引准入；静态 setup。任何 A 拒绝先行。
2. 完成 B 的全局结构检查，按原始属性／深度优先顺序遍历 root、metadata、bones、slots、skins／attachments 及全部动画 maps。每个对象先按源码顺序检查未知 key，再按下表顺序检查 required 缺失，最后按下表顺序检查列明字段的 kind。deform payload 成员的 kind 也包含在内。此处不查引用、数量或数值范围，较晚的结构错误可能先于较早的数值错误。
3. Atlas：页面数量、尺寸、format／filter／repeat／PMA、页面 extras、region 数量，再逐 region 检查 rotation／trim／index／extras。
4. Skeleton metadata；bone 数量及每条先引用后数值；slot 数量及每条先引用后固定配置；skin 数量／名称、附件总数及每个附件先引用／path 后数值；最后要求 setup mesh。
5. 动画数量；每个 animation 先完整认证动态目标引用（包含空 map），再查 timeline 数量；完成所有 timeline 帧数、展开预算，再查逐帧数值／时间。全部动画完成后要求 active deform。
6. 所有检查成功后才发布冻结结果。

顺序使用 visitor 的源属性顺序，包含类似数字的 key，不采用重排后的对象枚举。名字／path 为非空 primitive string，上限 **256 个解码后 UTF-8 字节**，精确匹配。未知字段即使为空、null 或 false 也拒绝。null 只允许表示空 slot attachment。

## 精确源字段与静态拓扑

下表数值字段要求 primitive finite number。“缺省”指省略，不接受 null。坐标绝对值上限为 **65536**。

| 对象 | Required 字段，按顺序 | Optional 字段，按顺序及资格 |
| --- | --- | --- |
| Root | `skeleton,bones,slots,skins,animations` | 无 |
| Skeleton | `spine` | `hash`：string；`x,y`：绝对值上限；`width,height`：[0,65536]；`fps`：(0,240]；`images,audio`：string 声明，无 I/O；`referenceScale`：精确 100。版本由 A 要求精确 4.3.13。 |
| Bone | `name` | `parent`：非空 string；`x,y`：缺省 0／绝对值上限；`length`：缺省 0／[0,65536]；`rotation,shearX,shearY`：缺省或 0；`scaleX,scaleY`：缺省或 1；`inherit`：缺省或 `'normal'`；`skin`：缺省或 false；`color`：8 位 ASCII hex；`icon`：string；`iconSize`：[0,65536]；`iconRotation`：绝对值上限 |
| Slot | `name,bone` | `attachment`：省略／null 或非空 string；`color`：缺省或 `'ffffffff'`；`blend`：缺省或 `'normal'`；`visible`：缺省或 true |
| Skin | `name,attachments` | `color`：8 位 ASCII hex；name 必须为 `'default'` |
| Attachment maps | 动态 slot-name／attachment-name keys | Slot 必须存在，每个 attachment 为对象 |
| Region | `width,height` | `type`：缺省或 `'region'`；`name,path`：非空 string；`x,y`：缺省 0／绝对值上限；`rotation`：缺省或 0；`scaleX,scaleY`：缺省或 1；`color`：缺省或 `'ffffffff'`；尺寸 (0,65536] |
| Mesh | `type,vertices,uvs,triangles` | `type` 精确 `'mesh'`；`name,path` 同 region；`color`：缺省或 `'ffffffff'`；`width,height`：[0,65536]；`hull`：safe integer [0,vertexCount]；`edges`：偶数长度 number array，长度 ≤24576，每项为 safe integer [0,vertexCount−1] |
| Animation | 无 | `bones,attachments`：object |
| Animation bone entry | 无 | `translate`：array |
| Attachment timeline maps | 动态 default-skin／slot／attachment keys | 仅现存独立 mesh 目标；最内层对象仅允许 `deform`：array |
| Translate frame | 无 | `time,x,y` |
| Deform frame | 无 | `time,offset,vertices` |

Path 依次回退到 attachment 的 `name` 和 map key，必须精确对应一个 atlas region。不做路径正规化或序列后缀猜测。Constraints、events、IK、transform／path／physics、dark color、skin bone／constraint 列表、附件 sequence、linked／weighted mesh、rotation、scale／shear timeline、attachment switching 与 curve 不在白名单内。不增加拓扑、winding、连通性或三角化证明。

Bones 为 **1..32** 条，唯一根位于 index 0 且没有 parent，根 depth 为 1，最大 depth **8**。之后每条要求精确的较早 parent；self、forward、unknown 拒绝。Setup 仅支持平移。Slots 为 **1..32** 条、精确 **一个 default skin**，总附件 **1..64** 个，包含未激活附件，全部检查。原始 mesh 上限保持 **4096 vertices／12288 indices**，positions 另受绝对值上限约束。A setup 仍对每个合法 slot 引用独立计费，累计上限 **32 references／4096 vertices／12288 indices**；region 按 4 vertices／6 indices 计。B 要求至少一个选中的 setup mesh。这些逻辑总数不是 Core 命令或 draw 数量。

Atlas 要求精确一页，正整数每轴 ≤**2048**、防御性的 RGBA 逻辑尺寸 ≤**16777216 字节**、RGBA8888、Nearest／Nearest、repeat none、PMA false、无页面 extras。Regions 为 **1..64**，rotation 0、两个 offset 均为 0、original 尺寸等于 packed 尺寸、index −1、无 extras。Bounds 继续由 SP1 准入。在这些轴上限下，RGBA 尺寸 guard 是防御性限制，不是独立可达的普通溢出见证。Asset ID／provenance 声明不认证纹理字节、crop、sampler 或权利。

## 线性 timeline 与 deform 规则

全部 **1..8 animations** 都要检查。只准入 bone translate 和 default-skin mesh deform timeline。每个 animation 中，每个动态 bone、skin、slot、attachment key 都按祖先先于子项、源属性顺序解析，**即使 child 为空**。已知且合格的空 map 合法、不贡献 timeline；未知或错误目标在原 key token 得到 REFERENCE。完整引用检查先于数量，所以未知空目标先于另一条 timeline 的最少帧数错误。此前全局结构阶段仍优先于引用。

每个 animation 准入 **1..128 timelines**、累计最多 **4096 keyframes**；每条存在的 timeline 至少 **2 frames**。128 guard 是防御性限制：其它白名单使普通合法结构最多为 32 个 bone 加 64 个 mesh 目标，即 **96 timelines**，不代表普通 128／129 案例覆盖。任何 `curve` 字段都拒绝，包括 null、false、`'linear'` 或最后一帧的字段。

Time 缺省为 0，存在时必须有限且在 **[0,60]**。第一帧为 0，原始 binary64 时间严格递增，最后时间为正，且 `Math.fround(time)` 也必须有限并严格递增。先检查原始顺序，再检查 Float32 顺序。极小正数舍入为 0、不同 double 合并为同一 Float32 均拒绝。输出 time／duration 保留 binary64，duration 为最大 last time。这不是 Core 姿态精度保证。Translate x/y 缺省 0、满足绝对值上限；不计算世界变换。

Deform coordinate count 为 **2 × 原始 vertex count**。`vertices` 可省略或为 number array（允许空），每个 delta 有限且绝对值 ≤65536。`offset` 缺省 0，存在时要求 safe integer [0,coordinateCount]，且必须有 `vertices`；offset 加 payload 长度必须容纳于坐标范围。允许 component offset 和奇数长度的 sparse payload；delta 不要求整数。不产生 padding、缩窄、变形顶点或帧展开。

诊断分区固定：

| 条件 | B code 与位置 |
| --- | --- |
| 列明字段／container 的 kind 错误，包括 null deform payload，或 deform `vertices` 成员非 number | 全局 SHAPE，原 value／member token。其它 array 成员 kind 留在后续数值检查；非 number `edges` 成员（例如 `edges:[null,0]`）在该阶段报 F2_PROFILE_NUMBER。 |
| 数值 time 超出 [0,60]、coordinate／delta 超绝对值上限，或非有限数值字段 | NUMBER，原 number token |
| 有限 offset 非 safe integer、超 component 范围、有 offset 无 payload，或 payload extent 溢出 | DEFORM；offset token，无显式 offset 的 extent 使用 payload opening |
| 域内 time 的 first／last 错误、binary64 不递增或 Float32 合并／不递增 | TIME；存在 time 使用其 token，省略的缺省 time 使用 frame pointer／opening |

每帧先查 time，再查 translate x/y；deform 为 time、offset finite／integer／domain／presence、逐 delta、最后 extent。较晚全局结构错误仍先于较早范围错误。文本 `1e400`、bare NaN 或 Infinity 已在公共 SP1 严格 JSON／非有限检查中拒绝（`stage:'sp1'`、`SPINE_JSON_SYNTAX`），不能从解析对象制造 B 非有限见证。

每条 deform timeline 按 `coordinateCount × keyframeCount` 计费，省略、空或 sparse payload 也如此。展开 scalar 上限为 **每 animation 262144／每 asset 1048576**，等值合法。首条超限 timeline 先查 per-animation、再查 asset，使用该 timeline opening token。引用与帧数先于计费，逐帧数值在后。假设的 Float32 内容对应 1 MiB／4 MiB，不是实测峰值或 Core 所有分配的上限。至少一条 deform 必须指向该 slot setup 当前选中的 mesh，未激活目标仍完整检查。

## 诊断与原始位置

`F2MeshProfileDiagnostic` 有 readonly `code`、`severity:'error'`、`source:'input'|'skeleton'|'atlas'`、`pointer`、固定 `message`、可选 `span`。11 个 B codes 在两个语言版本均使用下列精确英文 message：

| Code | Message |
| --- | --- |
| F2_PROFILE_SHAPE | The source must use the supported static profile shape. |
| F2_PROFILE_FIELD | The source contains a field outside the supported static profile. |
| F2_PROFILE_ATLAS | The profile requires one untrimmed nearest straight-alpha atlas page. |
| F2_PROFILE_REFERENCE | A profile reference must resolve to the required source target. |
| F2_PROFILE_TRANSFORM | Setup transforms and colors must use the supported fixed profile. |
| F2_PROFILE_NUMBER | Profile values must satisfy the finite numeric domain. |
| F2_PROFILE_TIME | Linear timeline times must remain strictly ordered in binary64 and Float32. |
| F2_PROFILE_DEFORM | Deform data must fit the original independent mesh coordinates. |
| F2_PROFILE_LIMIT | The profile exceeds a fixed source or expanded-data budget. |
| F2_PROFILE_REQUIRED | The profile requires an active mesh and an active linear deform timeline. |
| F2_PROFILE_INTERNAL | Profile planning could not complete safely. |

未知字段为 FIELD／key token，固定变换／配置为 TRANSFORM，数量、depth、预算为 LIMIT，缺少 active 用途为 REQUIRED。A 的 13 codes 与阶段保留，不改名为 B code。

Span 使用原始 UTF-16 offset／length、从 1 开始的 line／column，CRLF 算一次换行。解码 pointer segment 转义 `~`／`/`，pointer 溢出保留最后准入的 parent。Value／ref 错误使用实际 value token，动态目标／未知字段使用 key token，缺字段使用所属对象 opening。数量通常使用 collection opening。Atlas 不虚构 collection token：页面数量 ATLAS 的 pointer 为 `/pages`、span 为第一准入页面 header；尺寸 LIMIT 为 `/pages/0`、该 header；region 数量 LIMIT 为 `/pages/0/regions`、该页面 header；region 配置为 `/pages/0/regions/i`、其 region header。Extras 保留实际已记录 span。

非首 bone 缺 parent，在 `/bones/i/parent` 与该 bone opening 报 REFERENCE；parent 存在但 kind 错误为先行全局 SHAPE。根 string-parent、empty、unknown、forward、self-parent 使用实际 parent string token，depth LIMIT 也使用该 token。缺 setup mesh／active deform 使用 `/slots`／`/animations` opening。不靠搜索重复 literal 重建位置。显示这些数据时，调用方必须转义 source ID、pointer 与 message。

## 来源与后续边界

规划器和程序化 fixtures 是 Apache-2.0 下的原创 Egret 第一方工程；仓库根 `LICENSE` 与 `NOTICE` 保留署名。Microsoft 的 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) **3.3.1**、MIT，是由现有根开发依赖与 lock 持有的语法基础。不引入私有 SDK parser、新 SDK 依赖或捆绑的上游 Core payload。

设计参考本地固定的官方 **Spine Core 4.3.13**，上游 source commit 为 `b7beb2ccbbce667a12c02f44d070644f59b04968`：[SkeletonJson 源码](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts)、[官方 runtime 仓库](https://github.com/EsotericSoftware/spine-runtimes)。Lookup 和 component offset 原理为另行定义的 Egret 白名单提供依据，不证明与 Core 相同的错误优先级或数值兼容性。独立编写的 Egret 实现与程序化 fixtures 同上游源码和美术保持分离。

已保存的 **2026-10-12** 来源刷新将官方 [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) 与 [Spine Editor License](https://esotericsoftware.com/spine-editor-license) 页面记录为最后更新于 **2025-04-05**。这用于署名与后续资格边界，不代表 entitlement、法律许可结论或 Editor 导出认证。Core 兼容、姿态数值、mix／loop／seek、运行时资源、Clock／display 集成、browser／GPU／native／设备行为、性能及完整 Spine 均为独立后续工作。源准入本身不授权构造运行时或发布分发。
