# 检查维护提案流程

[English](../../en/docs/check-maintenance.md) | 中文

源码基线或测试清单需要处理时，贡献者可以继续执行完整门禁。这些记录由维护者负责；新人提交有效改进，不需要自行编造评审凭据或修改历史哈希。

维护工具根据当前文件准备评审输入，减少受支持声明之间的手工抄录和查找。它不会编辑基线、安装清单、执行产品代码或授予验收资格。原有钩子、CI、源码、严格类型和行为检查仍然必需。

## 生成与复查

使用固定的 Node 26.7.0 环境，在准备源码及产物记录之前完成构建。生成的提案保存在工作区之外。以下重定向使用 UTF-8 输出，包括文档规定的 PowerShell 7.6.5 环境。

~~~text
pnpm build
node tools/prepare-check-maintenance.mjs --baselines > ../baseline-proposal.json
node tools/prepare-check-maintenance.mjs --catalog > ../catalog-proposal.json
node tools/prepare-check-maintenance.mjs --check ../baseline-proposal.json
node tools/prepare-check-maintenance.mjs --check ../catalog-proposal.json
~~~

提案状态为 review-required。复查成功返回 current-inputs 和 acceptance: none，只说明受支持输入与提案内容仍然一致，不代表正确性、评审、新鲜编译产物或门禁通过；构建是单独记录的操作。复查重新读取清单和原始字节，不信任旧 PASS。生成器、身份工具、声明文件、目标、测试成员或提案内容变化都会使旧提案失效。生成过程中持续存在的输入变化会被拒绝；这不是恶意进程隔离保证。

## 源码基线范围

| 所属检查 | 登记声明 |
| --- | --- |
| SpriteSheet | graphPins、configurationPins、ss1AtlasGraphSuccessor |
| Browser PNG | acceptedSnapshot.graph、acceptedSnapshot.stablePins、atlasGraphSuccessor |
| 序列帧播放 | seqpbPackages、seqpbStableEntries、seqpbConfigurations |

每个声明独立保留每条路径的预期和当前身份，标为 same/different/missing；所属文件字节和声明选择位置明确保留。这是声明与当前文件的原始字节比较，不是门禁失败诊断：历史值可能与已经获准的后继版本不同。不能合并备选版本，也不能批量替换所有 different 行。同时记录四包 src/dist 及 engine web/rendering 下完整的当前 .ts/.js 文件清单，包括被 Git 忽略的编译产物，使新增文件与修改文件都能被发现。graphCoverage 列出当前完整代码清单中未出现在各受支持基础图谱及其具名后继中的文件指纹。其含义是“未列入这些声明”，并不意味着“尚未被政策接纳”。基础与后继声明仍分别保留；配置清单不被当成完整代码图谱。缺失必需目录时需修复构建或安装；已声明文件缺失会明确列出。路径拼写错误、链接和非普通文件属于错误，不会记作缺失。

读取器只支持受限声明格式：单一顶层 const 与单行 JSON 初始化器。声明前缀可包含普通字符串、注释与配对括号；不会导入或执行边界模块。原始文本中出现多个同名 const（包括无害的注释或字符串诱饵），以及前缀中的模板、正则、除法、转义标识符、未闭合或错配的界定符，都会被拒绝。超出格式的所有者仍须人工评审；这不是通用 JavaScript 解析器。文件身份按路径、字节数和 SHA-256 比较，不受 JSON 字段顺序影响。 声明缺失、语法不受支持，以及非法身份和同一列表内重复路径，也会被拒绝。下文说明新增 JSON 所有者和 Host 成对原始观察。编译器/依赖所有者、条件准入、多所有者资源/图集快照及语义/API/类型/原生验收仍不在读取器范围内。范围外的检查仍按既有流程处理；提案不会自动解释条件式后继准入，也不提供完整的依赖映射。


## 新增策略所有者与共享引用

同一个 --baselines 命令还会读取下列已登记 JSON 字段。policyLinks 分别记录边界文件中 policyPin/inventoryPin 的预期和当前身份，要求目标路径与登记值完全相同，并绑定这两个文件。策略文件变化会显示为原始差异；生成提案不代表新策略已经通过身份认证或准入。

| JSON 所有者 | 登记字段 |
| --- | --- |
| tools/bitmap-resource-slot-policy.json | packages、configurations、stableEntries、oldRootPins、oldEngineDeclarationPin、workspacePins |
| tools/bitmap-binding-ticket-policy.json | 上述六项，另加 selectedProductPins |
| tests/types/atlas-import-diagnostic-expectations.json | sourcePolicy.modules、sourcePolicy.configurationPins |

原有和新增所有者共登记 24 项普通指纹声明、三条策略文件引用，以及两项独立表示的 Host 成对声明。数量说明当前实现的登记范围，不代表仓库全部义务。JSON 重复键（含转义后同名的键）、畸形选择字段/指纹及单个声明内重复路径都会被拒绝，不会递归收集新增 JSON 字段。新增选择字段只接受规定的工作区配置、四包源码/产物/类型测试和 tests/types 配置范围，拒绝依赖及私有路径。在此单仓库读取器中，Atlas 的 inputPins、编译器字段和 jsoncPins 仅由 JSON 文件原始字节绑定。下方独立的已登记编译器流程会读取选定的依赖输入；两种流程都不授予验收。

四组 oldRootPins/oldEngineDeclarationPin 标注 comparison: transformed-baseline-raw-observation。真实门禁会去除指定新增内容后再与历史基线比较，因此这里的原始差异不意味着应更新旧指纹；必须查看原有变换并单独验证预期接口。必需的 JSON 所有者文件缺失会拒绝准备，声明目标缺失则继续在条目中显示。

两项 imageResidencySuccessors 声明分别保留每条路径的基础、后继和当前文件身份。条目标签为 base、current、both、neither 或 missing。这些只是原始观察：真实 Host 门禁要求整组版本兼容，混合匹配不能获得准入。成对分支不允许夹带另一条路径。本工具不执行硬编码的 Atlas 包后继规则或逆向变换。

references 是按完整路径排序的反向引用索引，保留受支持指纹的每一次出现。文件变化时，将所属文件、binding、branch、比较方式和预期身份一并查看。同一个文件可以有多个历史/当前预期，不会被合并成一个替换哈希。graphCoverage 另将 Atlas 的 sourcePolicy.modules 列为完整代码图谱。此索引用于查找共享维护义务，不缩减检查，也不发现全部动态导入或描述每一项策略依赖。

resource-scene 和 atlas-frame 源码采集器继续使用已有的多所有者快照流程，涉及外部包归属、动态模块闭包和原始资源证据，因此不合并进单仓库指纹读取器。继续按[进阶浏览器流程](getting-started.md)、[资源浏览器流程](resource-browser-workflow.md)处理受支持套件，必要时使用所属源码工具；保留原始快照和数值预期。编译器/依赖迁移、条件准入、语义/类型/原生检查、真人/fork 上手和设备/性能验收仍是独立工作。每次发布仍需独立评审、真实对照、双语检查及完整本地/推送/PR 门禁。

## 多所有者快照维护

使用 tools/prepare-snapshot-maintenance.mjs 复用现有 resource-scene 和 atlas-frame 源码采集器。入口采集当前 SDK 与选定应用，可与先前快照或提案比较，并将评审材料输出到标准输出；不会安装新基线或修改采集器。运行前须已有编译产物和精确安装的依赖，环境准备与构建按既有流程单独执行。本流程不构建、不启动浏览器或服务器，也不执行产品或编译器模块；仅执行可信采集器及身份辅助代码，读取现有源码闭包。

PowerShell 7 示例（产物保存在检出目录外）：

~~~powershell
node tools/prepare-snapshot-maintenance.mjs --family resource-scene > ../resource-snapshot.json
node tools/prepare-snapshot-maintenance.mjs --check "$(Resolve-Path ../resource-snapshot.json)"
node tools/prepare-snapshot-maintenance.mjs --family resource-scene --baseline "$(Resolve-Path ../resource-snapshot.json)" > ../resource-comparison.json
node tools/prepare-snapshot-maintenance.mjs --family atlas-frame > ../atlas-snapshot.json
~~~

没有基线时，提案明确标记 comparison: not-provided。提供基线后，以所有者和完整逻辑路径联合标识变化。新增、移除和变更条目保留前后记录，包括 resource-scene 的角色信息；不同所有者下的相同路径保持独立。所有者根目录的写法或位置变化单独显示，不通过路径归一化替换指纹。structureChanges 标识其他发生变化的顶层字段，包括模块导入边、路由、闭包、别名、构建解析和验收元数据；完整当前快照仍保留以供检查。

包装入口支持 resource-scene 的 SDK/application/foundation 所有者，以及 Atlas 的 repository/compiler/compiler-native/project-json/foundation 所有者。资源应用默认使用当前 SDK 检出目录；可通过 --application-root 明确指定独立应用的绝对目录。原采集器仍要求既有应用布局、原始资源与一致的采集器实现，只支持现有 resource-scene 布局，不表示支持任意游戏工程。Atlas 使用 ordinary 采集选择，并保留原有 Windows x64 编译器限制。历史 Atlas 快照没有场景区分字段，结构兼容不证明场景或来源。本命令不增加跨平台编译器准入，也不改变其他编译器/源码边界规则。

分离应用的 --check 同样要求显式提供 --application-root。采集前，指定路径的规范目录必须与已保存应用标签一致；省略、指定其他根目录或伪造标签都会被拒绝。采集后重新解析该路径，并核对返回的应用所有者。读取范围由调用者明确选择，不由快照中的所有者标签决定。

~~~powershell
node tools/prepare-snapshot-maintenance.mjs --family resource-scene --application-root "$(Resolve-Path ../application)" > ../split-snapshot.json
node tools/prepare-snapshot-maintenance.mjs --check "$(Resolve-Path ../split-snapshot.json)" --application-root "$(Resolve-Path ../application)"
~~~

只读取明确指定的基线 JSON 文件；其中的历史所有者路径及嵌套基线引用均为数据，不作为读取目标。先前提案只提供已保存的快照，成功或评审标签不授予任何权限。转义解码后重复的 JSON 键、不支持的顶层结构或所有者集合、重复清单键、非法路径及未声明的模块所有者都会被拒绝。输入产物上限为 16 MiB。记录顺序按保存形式保守比较，无害的重排也可能需要评审。这些检查属于有限结构验证，不是对历史模块或路由元数据的完整语义验证。

--check 会重读指定基线文件，重新调用当前源码采集器，并比较完整重建提案，包括差异和实现指纹。生成器、解析器、身份辅助代码、采集器和基线字节均被绑定并在采集过程中复查；采集和重检仅供独立直接启动的 Node CLI 使用，要求 execArgv、NODE_OPTIONS 和 NODE_PATH 为空。导出的辅助函数只比较或解析数据，不执行采集。该执行约定不隔离主动修改进程全局状态的调用者。输入变化、新增被采集文件或提案编辑均需重新生成和评审。这是在现有采集范围内检查输入新鲜度，不构成对抗并发恶意进程的隔离，也不是全仓依赖图。current-inputs 结果仍明确 acceptance: none。原生执行继续使用既有进阶/资源浏览器流程，分别满足输入评审、对照、清理及设备要求。

## 已登记编译器输入维护

使用独立的只读入口 tools/prepare-compiler-maintenance.mjs，检查 Atlas 导入、BitmapResourceSlot、BitmapBindingTicket 和 LinearLayout 四份严格检查 JSON 清单。它读取各自的 inputPins 与 Atlas 的 sourcePolicy.jsoncPins，保留五组独立声明；不导入严格门禁、编译器或依赖模块，也不改写诊断和基线。

~~~powershell
node tools/prepare-compiler-maintenance.mjs > ../compiler-proposal.json
node tools/prepare-compiler-maintenance.mjs --check "$(Resolve-Path ../compiler-proposal.json)"
~~~

已安装的 typescript、@typescript/typescript-win32-x64 和 jsonc-parser 分别保留规范所有者及完整原始文件清单。仓库直接选择与从包装包解析的原生包所有者必须一致，读取后再次检查所选所有者与清单成员。因此，即使历史指纹未提及新增的依赖文件，新增文件仍会使旧提案失效。内部链接、非普通文件、大小写别名、JSON 重复键、不支持的选择字段/路径和畸形原始身份都会被拒绝。必须已安装 Windows x64 包；在其他宿主读取它不证明编译器兼容性。版本只是观察到的元数据，不代表新版本获准使用。

每个预期指纹都保留原声明与完整逻辑路径。references 按当前所有者相对输入聚合全部预期，彼此矛盾的历史指纹不会合并成单一替代值。声明文件缺失会明确显示；必要所有者、元数据、门禁或 JSON 文件缺失则拒绝准备。声明、门禁、实现、所选所有者、依赖清单成员或观察文件变化都会使 --check 失效。新提案中可呈现历史指纹不匹配，不视为准备错误；是否准入仍由原门禁决定。

只解释列出的选择字段。nativeLibraryPins、原始编译器观察、诊断、消息投影和分组闭包等其他字段由 JSON 所有者原始字节绑定，不会单独解释或重放，因此本流程不是完整的历史原生边界迁移。完整安装清单属于当前观察，不是这些声明经过认证的替代品。保留全部原有严格重放、源码策略、版本检查、hooks 与 CI。current-inputs 只表示这些维护输入仍一致，始终为 acceptance: none。真人/fork 上手（#52）、其余策略流程（#53）以及设备/宿主/完整 Spine/性能验收（#54）继续开放。

## 测试清单范围

候选清单枚举当前顶层 tests/*.test.mjs 的完整成员。只有测试、已声明辅助文件、四包清单/依赖图及完整门禁调度均未改变时，才保留已有的包归属。新增或修改的测试、辅助文件变化或缺失均改为共享；包清单或调度变化时，保守地将全部测试设为共享。删除的测试单独列出；缺失辅助文件仍出现在 unavailable 输入中，现存辅助文件继续保留。已有共享测试不会被自动缩小为单包归属。

提案绑定旧清单、生成器、身份工具、包清单、调度、测试和已声明辅助文件，不推断新的导入依赖。维护者独立评审候选差异、源码归属及实际选中行为后，才通过仓库规范写入器安装清单并更新当前来源记录。即使候选与既有内容相同，也只是评审材料；选择器不会自动使用它。完整发布检查和全部共享测试仍保留，本轮不缩减或缓存耗时的共享检查。

## 评审与交付

1. 构建并生成提案，查看变化/缺失条目及支持范围。
2. 评审受影响的源码/语义边界和历史/当前备选版本。保留原始证据，明确设计任何新的准入方式。
3. 评审测试归属和辅助依赖。仅安装已评审的当前元数据，同步英文注释及中英文文档。
4. 运行真实正向和反例，再完成本地、已提交推送和受保护 PR CI 检查。任何输入修改后重新复查提案。
5. 分别记录真实交付结果和剩余限制。AI 评审不代表人工批准。

首批对照覆盖提案新鲜度、所属文件/目标原始身份、新增产物、缺失与路径别名、无执行的声明解析和保守清单变化。实际命令、失败记录、独立评审及最终交付记录归入 PR。本轮减少准备工作，不宣称已测得检查提速或完成全部源码基线迁移。真人/外部 fork 上手（#52）、其他策略所有者流程（#53）、设备/宿主、完整 Spine 和场景/性能预算（#54）继续开放。
