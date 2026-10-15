# 纹理 Profile：CPU 与桌面 GPU 证据

[English](../../en/docs/textured-profile-cpu-evidence.md) | 简体中文 · [契约](自有纹理几何与Mesh2D契约.md) · [几何/Mesh 证据](自有纹理几何与Mesh2D证据.md)

工程检查点 **0.23.0**，整理于 2026-10-11。自有纹理几何、Mesh2D、不可变 profile 帧及显式 WebGPU 宿主已有有界 CPU、严格类型和桌面原生证据。原生运行的 11 个 calibration 与 10 个 held-out 窗口通过，16 个指定对照窗口全部检出了 12 项独立副本故障。独立保存结果审阅验收了此次记录的 Windows／Edge／NVIDIA 单一环境。公开复现工具、最终双语材料审阅、当前完整推送前检查和远端交付分别记录，本文不从原生 PASS 推断这些结论。

## 已实现行为

createEngineForProfile(options, TEXTURED_FRAME_PROFILE_2D) 显式选择 egret.textured-frame2d/1。协商捕获宿主端口一次，进入既有 startup/cleanup 路径；默认创建保持原读取顺序。四个 capture/render 方法共用 ID 流、寿命检查和同步 barrier；新帧渲染使用捕获的新端口，不回退旧端口。

纹理采集采用两遍有界私有迭代遍历，每祖先一个 cursor。第一遍在负载、lease 或引用索引工作前准入整棵树的 metadata，包含隐藏与空内容；第二遍按 painter order 发出可见 Graphics、Bitmap、Mesh2D。帧保留不可变 image/geometry 值，不保留显示叶子、Texture 包装器或 lease；后续资源退休不改变重放。命令/clip 准入先于命令记录创建与 clip 展平。私有所有权、不重扫及精确分配顺序属于源码评审结论，不是通过无法到达的回调测量所得。

旧 Canvas 与 WebGPU 端口在旧复制、负载读取或 target/queue/ledger 工作前拒绝每个真实新 profile 帧，包含 clear-only 与 rectangle-only。Canvas 保留 active-before-busy 优先级，WebGPU 保留 busy-before-active。受控检查使用真实采集帧与已启动宿主，不建立原生浏览器像素证据。普通结构副本与 Proxy 不获得私有注册身份。

GPU 计划 Task 1 实现一个私有共享 ledger，用于原子的 whole-count 预留及实际 predicate/tuple 尝试。矩形/图像准备与表示后 packing 通过可选私有接点共用它；选定 Mesh tuple 规范化/cache 在有界 policy 内保留完整属性。省略参数时保留旧路径。

Task 2 在该 ledger 上实现私有完整 tuple 的 Mesh 准备、表示后 32 字节 XY/UV/light-RGBA packing 及 rectangle/image/Mesh 有序 dispatch。authored 退化在舍入 affine transform 前抑制栅格；robust rank、represented collapse 与 reversal 各有不同结果。裁剪保留全部属性，表示后 collapse 不退 prepared 预留，空 image/Mesh draw 保留 painter barrier。该已验收 CPU helper 被后续准入与受控宿主实现复用；后续固定桌面原生观察具有单独证据。

Task 3 增加真实身份 metadata 准入、完整索引/clip 预检，以及 Float32/projection 负载分配前的 storage 规划。第一方逐次调用故障权威保留精确分配/转换原因，不凭调用者抛出的外来类身份单独分类。准入 upload 上界、device/dimension/readback 检查及确定限额优先级属于 CPU/源码证据；实际 GPU 分配与预留由后续受控宿主执行检查。

Task 4 实现 createTexturedWebGPUHost、四个 readonly 可选数值扩展、自有不可变 profile 标识及同步新端口。rectangle、Bitmap、Mesh 共用既有 startup、有序提交、fence、quarantine 与 cleanup 所有者。受控夹具检查 32 字节 XY/UV/light-RGBA ABI、逐 draw layout、crop 共享、pending geometry 准入及精确一次退休。这些设备边界 descriptor 与寿命计数不验证原生 WGSL 编译或渲染像素。

Task 6 验证显式 GPU facade、readonly options/status 及同步端口类型，同时保留 DOM-free root 与 Canvas 图。复制包控制从有效基线检查实际私有权威/类型泄漏及 GPU-only 隔离。固定 CPU 比较器单独核验 channel intervals、合成字节反例及 metadata/schema 处理；这些检查不建立原生浏览器运行或 GPU 像素证据。

## 实际保留的验证

| 检查 | 实际结果 | 范围 |
| --- | --- | --- |
| 聚焦纹理采集 | 47/47 通过 | 显式排除耗时的平铺节点子用例。 |
| 平铺节点边界 | 2/2 通过 | 单独冻结的采集构建中，公共夹具覆盖含 Stage 的精确 65,536 总节点与最小超限 65,537；父/子用例与聚焦套件重叠。 |
| 协商/共享执行器 | 10/10 通过 | 命令准入修复后的新构建。 |
| 既有功能回归 | 164/164 通过 | 与聚焦套件重叠，不累加计数。 |
| 新帧的旧宿主拒绝 | 4/4 通过 | 真实帧；受控 Canvas 与借用 GPU 夹具。 |
| 既有宿主/加载检查 | 222/222 通过 | 包含 13 个显式 B1 加载场景及一项无损回执传输控制。 |
| 较早架构策略控制 | 190/190 通过 | 历史检查点；下列附加控制保留单独源码绑定。 |
| Root 消费者类型 | 核验 122 项负向诊断 | Positive/DOM-free 通过；新增 12 项 profile 用例各有实际文件、行号、列号及错误代码记录。 |
| 隔离缺失导出 | 核验 2 项 TS2305 诊断 | 私有注册器与 workspace 采集端口不从 root facade 导出，无导入级联。 |
| 既有严格消费者 | 保留 16 项几何、13 项 Mesh、5 项 web、28 项 project | 几何/Mesh 包含在 root 计数中；project 分别定位。 |
| 架构扫描 | 336 文件通过 | 精确导出、声明依赖及 DOM-free root 隔离。 |
| 实现独立评审 | 有限制地通过 | 核心、宿主/类型、最终源码策略集成分别评审；成功浏览器分支仍需实际浏览器证据。 |
| 精确 package 别名/importer 控制 | 16/16 通过 | 既有 package 规则已正确，保留其 guard。 |
| 合并架构/源码策略 | 299/299 通过 | 早于最终验证器集成；与来源用例重叠，保留历史源码绑定。 |
| 最终来源/源码控制 | 94/94 通过 | 集成后实际有界文件系统控制，含 S01 及原始/编译/选定副本检查。 |
| 最终选定映射控制 | 61/61 通过 | 实际产品消费的 resolver/map observer；字面量映射，不是浏览器加载。 |
| 最终验证器工具/oracle 控制 | 30/30 通过 | 实际 CLI 拒绝与独立 oracle-buffer 控制，不执行成功浏览器分支。 |
| Task 1 私有共享预算与 clip-policy 检查 | 31/31 通过 | 历史未修改 helper 夹具；predicate/tuple 准入、完整 tuple、fan 预留与省略参数行为。 |
| Task 1 受影响旧几何/图像/pass 检查 | 37/37 通过 | Task 1 源码修订上的历史指定五个旧文件。 |
| Task 1 composite 构建 | 通过；检查 21 项 format 定义 | 该阶段精确采用源码，不执行浏览器/native。 |
| Task 2 合并预算/Mesh helper 检查 | 90/90 通过：31 项预算 + 59 项 Mesh | 新运行使用未修改 CPU 夹具，共用较早预算用例，不再次累加其计数。 |
| Task 2 受影响旧几何/图像/pass 检查 | 37/37 通过 | 单独新执行指定五个旧文件，不累加计数。 |
| Task 2 composite 构建 | 通过；检查 21 项 format 定义 | 该阶段精确采用私有源码，不执行 GPU 宿主或浏览器/native。 |
| Task 3 合并预算/Mesh/准入检查 | 155/155 通过：31 项预算 + 59 项 Mesh + 65 项准入 | 该阶段已验收 CPU 修订；与较早 helper 套件重叠。 |
| Task 3 旧 projection/image-host 检查 | 94/94 通过 | 单独实际执行，不声明原生像素。 |
| Task 3 受影响旧几何/图像/pass 检查 | 37/37 通过 | 单独实际旧文件运行，不累加重叠总数。 |
| Task 3 composite 构建 | 通过；检查 21 项 format 定义 | 该阶段精确已验收源码与 352 项 emission。 |
| Task 4 公共受控宿主行为 | 30/30 通过 | 真实 Engine/lease/采集帧；受控设备 ABI、options、顺序及寿命。 |
| Task 4 profile/旧端口行为 | 14/14 通过 | 修正源码上的新旧端口身份/拒绝行为。 |
| Task 4 保留 helper 回归 | 155/155 通过 | 新执行既有合并 helper，不增加用例总数。 |
| Task 4 受影响旧 GPU/加载器检查 | 146/146 通过；全部 13 项 B1 完成 | 更新夹具的预期工厂导出后，旧 pipeline 与 guard 保留。 |
| Task 4 修正后 composite 构建 | 通过；检查 21 项 format 定义 | 窄类型组合已修复；360 项 emission，不执行原生 WGSL/像素。 |
| Task 6 严格公共类型 | Positive 消费者通过；核验 19 项新诊断 | 每项未抑制用例匹配实际文件、行号、列号及代码；保留既有 root 122、web 5、project 28 检查。 |
| Task 6 源码边界 | 363 文件通过 | 后续 native-only 新增前所记录 source/build/declaration 范围，不声明原生请求/singleton。 |
| Task 6 复制包策略 | 33/33 项新用例及 299/299 项保留用例通过 | 旧覆盖为 205 项互不重叠前缀分片测试加 94 项完整来源策略测试，含所报告父用例；无新 B1 工具或浏览器结果。 |
| 固定 native-fixture CPU 比较器 | 208/208 项单元通过：188 项 interval + 13 项合成反例 + 7 项其他单元 | 第一方字面量与 tolerance 不变；合成字节/metadata 检查，与原生复制产品灵敏度分开。 |

最终 CPU 类型/边界检查点具有 324 个稳定 emission 文件，后续已验收 Task 1 构建有 328 个，Task 2 有 340 个，Task 3 有 352 个，Task 4 有 360 个；每次记录的运行保留自己的源码/emission 修订。源码 TypeScript、编译 JavaScript、选定复制 JavaScript 是不同来源对象；字节相同也不授权混用原始/副本模块实例。策略扫描不是实际浏览器请求或 singleton 观察。 Task 6 与固定比较器保留 360 项未变化 emission；其测试/checker/比较器新增不需要新产品构建。

## 历史边界与已修正失败

平铺节点运行保留原始 807 项 source/emission/configuration 副本绑定。它早于引擎协商、后续宿主修改及 rectangle/image 命令字面量的局部修复。该空输出节点夹具不执行此修复，但历史运行不改称为后续完整源码执行。耗时包含公共树构建和清理，不是采集性能基准。后续核心源码评审及聚焦新构建检查核对此历史，不替换原回执或 emission 身份。

最初旧宿主运行在真实采集与宿主启动后，到达两项预期缺失拒绝断言，属于 feature RED；修正后的四项通过。有效源码策略基线通过时，六个新私有权威泄漏 guard 仍缺失；后续聚焦控制 7/7 通过，聚合检查 190/190 通过。有效与无效夹具保留不同观察。

最初两项精确 profile 重导出断言因测试的 Windows 相对声明路径产生第二份不透明类型身份，报 TS2344。仅测试的 type bridge 经引擎既有 contracts 声明依赖修正导入路径；相等性断言完整保留，产品 API、配置、依赖不变，无新增抑制。这是测试夹具历史，不是预期误用 RED；后续编译器运行检查全部必要的单独定位诊断。

既有加载器增加一个精确私有 registry 别名。回执传输无损整理重复仓库 URL 前缀：发送方验证还原，接收方 schema 验证与 262,144 字节上限保持不变。单独维护评审绑定源码修改及全部 13 个完成的子场景。此前的别名/配置、回执容量、错误消息预期失败保留为维护历史，不改称成功观察或纹理 Mesh 渲染失败。

剩余源码策略控制先从有效夹具执行；来源与选定映射的缺失 guard 在实现前到达指定断言，修正后通过。已正确的 package guard 保留，不为制造 RED 而关闭。最终验证器保留具名拒绝原因、原始/编译/副本身份与清理，并保持私有 INCOMPLETE 优先级。在该历史 CPU／工具检查点，成功浏览器 capture/window/retirement 分支仅完成源码评审；后续真实桌面观察及其独立验收记录在下文。

首次 Task 3 构建前，DPR 限额优先级在保留的源码后继版本中修正；64 项原始准入用例不变，增加一项真实公共优先级用例后，验收套件为 65 项。Task 4 初次构建因两个 adapter 的 start/stop/surface 声明不完全相同而报 TS2320。用 Pick 仅选 texturedFrameProfile/renderTexturedFrame，保留完整必需 WebGPU 接口，不改变 runtime 所有者逻辑；修正后构建通过。旧 B1 namespace 夹具仍预期单一 GPU 工厂，实际回归为 145/146。针对合法显式工厂精确修正两个接口预期字符串后，新 146/146 运行完成全部 13 项 B1，既有 guard/寿命检查保留。这些原始观察保留为失败历史，不改称缺失渲染行为 RED 或原生证据。

Task 6 先通过有效复制包基线，再于执行新规则前到达真实旧 checker 缺失工厂 guard RED。首次严格类型运行中，positive 消费者通过，全部 19 项非法表达式产生诊断，但一项预测 TS2345 实际为 TS2739，位置为第 46 行、第 26 列。仅预期代码注释改变，表达式、位置、消费者检查及无抑制条件均保留。一次合并旧策略运行在 120 秒超时，保留原始输出为零；它不建立 PASS 或 feature RED。后续八个互不重叠前缀分片与完整来源策略运行覆盖未修改旧用例，不覆盖该失败历史。

初始化后的比较器缺失 RED 在真实公共 Engine、assets、Texture、geometry、Mesh2D 及冻结采集准备完成后，才到达唯一缺失能力断言。加入已评审且未修改的比较器后，208/208 项 CPU 单元通过：188 项含端点 channel-interval、13 项明确合成字节反例及 7 项其他单元。合成控制与实际复制产品 GPU 控制保持区别，不据此推断原生观察或灵敏度。

## 已记录检查点与待完成边界

最终 CPU 采用已在所记录的 137 项核心文件、214 项源码/夹具及 324 项 emission 检查点完成。Task 1 保留后续 216 项源码/夹具与 328 项 emission 检查点：304 项原始 emission 不变、20 项有已评审后继版本、4 项新增，无删除。新 Task 2 runner 绑定 236 项选定源码/夹具/配置输入与 340 项 emission，扩大已记录夹具覆盖并加入已评审 Mesh helper 源码。原有 328 项 emission 均不变，精确新增 12 项；不把较窄保留文件子集或较早运行改称为新 runner inventory。核心、宿主/类型、源码策略、helper 的各项独立评审保留自己的修订；计数存在重叠，不得累加。Task 3 保留 241 项新选定源码/夹具输入与 352 项 emission 检查点。Task 4 绑定其 17 项已评审宿主/helper 源码及 360 项 emission；该源码子集不替代完整 runner inventory。后续构建版本不改称较早 emission 全部不变。 Task 6 保留 248 项所记录源码/夹具输入及 360 项 emission；源码扫描限于历史 363 文件，后续 native-only 新增有单独绑定。比较器运行保留自身 250 输入 RED 与 251 输入 GREEN inventory，360 项 emission 不变。

后续真实桌面运行及保存结果独立审阅覆盖：选定纹理原始／副本 registry 请求、B1 WebGPU 宿主／选定 registry 请求及策略消费者解析、SequencePlayer 的 Engine／宿主／registry 加载，以及既有全新 Canvas 请求隔离检查。B1 中标记 moduleCollected:false 的 Engine／Canvas 策略行仍是解析观察，不是浏览器加载。超出这些记录行的完整旧链路原始／副本 singleton／拒绝覆盖仍未验收。有界 B1 closure 在下一次添加前少于 128 模块，每模块最多 1 MiB，总量最多 4 MiB；源码控制不能替代浏览器观察。

已采用 GPU 计划现已完成 Task 1–3 CPU 准入/helper、Task 4 受控宿主，以及所记录边界内 Task 6 严格公共类型/源码策略的有界验收。历史 A01、G01、P01、H01 都在真实公共前提完成后才到达指定缺失能力断言，原始 RED 回执保持完整。固定比较器及独立评审的第一方 channels、coverage、bounds 在 CPU 范围验收，预期在原生观察前已冻结。后续默认浏览器采集通过了固定 calibration/held-out 像素及全部指定复制产品对照；原生证据另行绑定，不从比较器或源码检查推断。既有矩形 GPU、Canvas、3D 证据保留原范围。

手机、电耗/性能、完整 UI/fonts、Spine 播放、生产宿主、完整 engine/A2/3D 验收及完整旧工程迁移不在本阶段范围。配对文档/源码来源/注释评审、新受影响检查、最终推送前验证先于单独授权的远程交付；本候选不声称新增 push、包发布或 release。

## 桌面原生结果与边界

第一方夹具及有理数通道预期在原生采集前已冻结。已验收运行产生 37 个窗口、27 份正向及 19 份对照观察、46 份 RGBA 像素记录及 92 张原生画布黑／白 PNG。原始 21 个用例包含 47 个独立字面量采样点（188 个通道）；保留帧重放后共有 56 次正向采样比较。零通道必须精确为零，非零通道沿用先前固定的一字节边界。完整 reset buffer 为零，来源场景退役后重放仍保留已保存帧身份。

12 项复制产品对照分别只修改一个选定产品文件，全部到达各自指定的 16 个窗口。错误 opacity 在保留原 shader layout 后触发预定像素差异；名义 DPR 违反冻结的自有 metadata schema；错误 clear 违反完整 reset buffer 预期。设置拒绝或不支持设备不计为灵敏对照。13 次 capture 与 50 次完整三角色 registry 重读均符合选定源码／emission／副本身份。

完成的采集保留 272 份产物（9,643,297 字节），包含完整的 2,686,260 字节结果，未改变单产物 4 MiB／总计 16 MiB 上限。所有窗口关闭、浏览器／服务器关闭，upload／readback／geometry ledger 退休，无意外错误或设备丢失。另有 Windows Job 证据记录确认前分配、完整原始输出、活跃进程数归零及 Job 关闭。这些是资源／进程完成观察，不是性能测量。

环境为 Windows x64 10.0.26300、Node 24.19.0、Playwright 1.62.1 及默认无头 Edge 154.0.4258.62，未添加 GPU flags。adapter 报告 NVIDIA／blackwell，脱敏 device／description 字符串为空。冻结的已服务 WGSL 完成真实异步 pipeline 创建、提交与 readback；没有单独 getCompilationInfo trace 或原生 descriptor 拦截。结论仅覆盖这个报告环境中的固定用例，不验收手机、多 adapter、实体屏幕输出、性能、电耗、Native SDK、完整 A2／3D／UI／字体、Spine 或迁移。

首次尝试保持 INCOMPLETE：最初移除 shader opacity 同时移除了自动推断 binding，随后缩进格式 JSON 报告超过固定上限。已评审后继修改真实 opacity uniform 并保留 shader／layout，紧凑 JSON 保留全部字段。原始失败仍是历史记录，没有修改像素预期、tolerance 或上限。既有旧验证器图检查仅为无 DOM／GPU 的私有错误来源模块添加精确例外；SequencePlayer 补齐其已有 registry 精确 alias；旧 WebGPU 报告采用同样无损空白修改。其先前报告超限导致的整个 owner INCOMPLETE 与后续成功运行分开保留。

单独受影响桌面运行记录：Canvas 14 项检查，矩形 WebGPU 42 帧／1,709 项原始检查／84 张 PNG／6,808 项合成检查，有界 B1 7 个正向帧／5 项预设对照／11 次提交，以及 SequencePlayer 8 次 capture／256 个不透明像素／1,024 个通道。矩形 WebGPU 的八项反例由七项原生副本故障及一项明确合成的缓存 reset 断言组成。四条受影响运行的保存结果及其外层进程退休独立审阅在这些既有范围内通过，保留预期编译器／设备丢失拒绝及独立合成断言。最终公开候选验证与远程交付分别记录。见[结构化证据](../../evidence/textured-mesh2d-verification.json)。

## 复现原生采集器

使用固定的 Node 24.19.0、pnpm 11.25.0、TypeScript 7.0.2 工具链、单独安装的 Playwright 1.62.1 目录，以及默认 Microsoft Edge channel，不增加浏览器 flags。从新克隆的仓库目录运行：

    pnpm install --frozen-lockfile --ignore-scripts
    node tools/freeze-textured-webgpu-inputs.mjs
    node tools/verify-textured-webgpu.mjs --playwright "<已安装 Playwright 目录的绝对路径>" --channel msedge --output "<此克隆目录之外尚不存在的绝对输出目录>"

冻结命令执行既有固定构建，保留 120 秒超时及 32 MiB 输出捕获上限。它记录实际结果，只有构建成功且源码输入未改变时才发布 ready 输入；根据当前源码/编译产物图、harness、lockfile、source-origin、精确 shader literal 与十二项未修改灵敏度配方生成记录，不复用另一台机器的先前构建成功。受跟踪模板保持 ready:false。生成的 manifest、构建原始输出及仓库相对回执位于被忽略的 work/textured-webgpu-freeze/。命令不覆盖先前尝试；重新尝试前须自行归档或删除该生成目录。源码、harness、配方、lockfile 或 source-origin 改变后，采集前重新冻结。

此命令仅准备输入；采集器的实际原生结论及协作式清理分别记录。既有 operation/close/hard 截止时间为 240/280/295 秒。OS 后代进程退休仍需单独记录的外层进程证据；此流程不声称手机、性能、跨设备或完整引擎验收。

## 来源与许可

本记录整理第一方规格、保留的实际执行回执及限定独立评审。实现与文档采用 AI 辅助；几何、资源、裁剪、宿主基础设施在记录范围内明确复用。本 CPU 阶段不引入新依赖或复制上游引擎实现。

第一方源码与文档保留 [Apache-2.0](https://github.com/cnedwin/Egret_rebuild/blob/main/LICENSE)。既有 robust-predicates 3.0.3 朝向依赖保留其 [Unlicense 声明](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)，使用该依赖不建立 GPU 或 native 验收。无关依赖与研究资产保留各自声明。来源披露是有限过程证据，不是全球原创性、权利或训练来源认证。
