# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

**浏览器试玩。** 体验用新白鹭引擎制作的游戏，合集内提供在线试玩链接。 [游戏试玩合集](https://github.com/cnedwin/PortedGamesEgret)

## 当前白鹭引擎

白鹭是面向 Web 游戏的开源 TypeScript 引擎。显示、事件与资源接口配合 WebGPU 和 WebGL2 共享渲染，支持 2D 动画与复杂界面。可选 World3D 提供独立 3D 渲染与物理。一体化 AI 辅助创作及更多原生和小游戏宿主已列入路线图。 [World3D 契约](knowledge-base/Cns/docs/world3d.md)

**工程预览阶段。** 可从公开示例开始体验，并查阅对应契约了解适用平台、功能与验收范围。工作区包为 private 0.0.0。

| 领域 | 主干已有能力 | 仍需完成 |
| --- | --- | --- |
| 渲染与资源 | WebGPU／WebGL2 共享渲染、有序准备、资源组及选定设备恢复路径。固定 M1.2 全脏 Engine p95 中位数为 5.3 ms，目标为 8 ms。 | 更广泛的宿主／设备验收和剩余 [M1.2 帧节奏目标](https://github.com/cnedwin/Egret_rebuild/issues/55) |
| 内容与动画 | PNG／图集／序列帧构建、多页图集和字体产物，可选 Spine 播放／显示与 RESET，兼容资源替换时保留序列播放状态 | 完整选定版本 Spine 参考与状态保留、纹理变体、组合生命周期和性能验收 |
| UI 与文字 | 变高列表、焦点／导航、多语言多样式段落、文字几何、字体／主题切换、遮罩／模糊、受管弹出层／模态层及可选原生单／多行编辑 | 真实 IME、其余控件／语义以及更多文字与设备验收 |
| 3D | [可选 World3D](knowledge-base/Cns/docs/world3d.md) 支持 glTF、光照与阴影、后处理、动画、文字、自动实例化和加速拾取。物理预览包含形状扫掠、组合刚体、分片求解和玩法辅助组件。 | 更多资产、设备性能和工程创作整合 |
| 集成 | [可编辑换装工作室](examples/outfit-studio/README.zh-CN.md)，含可编辑 SharedFrame2D 场景及桌面／移动负载变体 | 选定功能覆盖、完整性能／设备验收和核心预览交接 |

[Android 真机观察](knowledge-base/Cns/docs/android-device-validation.md)覆盖已测试手机上的特定组件和混合场景。设备、输入及性能的验收范围见[当前能力图](knowledge-base/Cns/docs/core-progress.md)。

## 运行示例

使用 **Node.js 26.7.0** 和 **pnpm 11.25.0**，在仓库根目录运行：

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

[上手指南](knowledge-base/Cns/docs/getting-started.md)说明环境、预期结果和排错方法。可体验[换装工作室](examples/outfit-studio/README.zh-CN.md)、[响应式示例](examples/mobile/README.zh-CN.md)、[UI 段落](examples/paragraph-panel/README.zh-CN.md)和[序列替换](examples/sequence-reset/README.zh-CN.md)。固定档位用于验收，响应式预览用于体验界面。

[WebGL2 等距地图示例](examples/isometric-map/README.zh-CN.md)展示小型网格场景的深度排序和帧提交。

运行 [World3D 示例与功能展厅](examples/world3d/README.zh-CN.md)，体验可选 3D 能力。示例文档列出了适用后端和已验证环境。

地图、物理、音频、存档、解包、KTX2 和多语言可按需启用，详见[第三方集成](integrations/README.zh-CN.md)。

开发时要在屏幕上查看帧耗时、共享帧统计和卡顿记录，详见[性能监控](devtools/README.zh-CN.md)。它只在调试模式显示。

## 开发与社区参与

选定工作前先读[当前能力图](knowledge-base/Cns/docs/core-progress.md)和[工程计划](knowledge-base/Cns/docs/工程规划.md)，了解十一个 M2–M4 工作包的已交付能力与验收缺口。

[M2–M4 路线图](knowledge-base/Cns/docs/m2-m4-delivery-plan.md)、[Issues](https://github.com/cnedwin/Egret_rebuild/issues)、[里程碑](https://github.com/cnedwin/Egret_rebuild/milestones)和[社区看板](https://github.com/users/cnedwin/projects/2)统一记录交付、依赖与验收缺口。

- **悬停与滚轮：**`@egret/engine/web/hover` 告诉游戏鼠标或手写笔正指向哪个显示对象，并把滚轮交给它，与触点输入共用同一个画布。见[指南](knowledge-base/Cns/docs/pointer-hover.md)和[示例](examples/pointer-hover/README.zh-CN.md)。
- **画布上的文字输入：**`@egret/engine/web/text-input` 把平台文本框盖在舞台的一个矩形上，玩家可以输入中文以及平台能输入的任何文字，2D 和 3D 游戏都适用。见[指南](knowledge-base/Cns/docs/text-input.md)和[示例](examples/text-input/README.zh-CN.md)。
- **原生编辑切片：**[单／多行编辑与托管 UI（#89）](https://github.com/cnedwin/Egret_rebuild/issues/89)复用段落几何、焦点及资源生命周期。见[契约](knowledge-base/Cns/docs/native-text-editing.md)、[响应式表单](examples/text-editing/README.zh-CN.md)和[三星 Android 键盘／生命周期观察](knowledge-base/Cns/docs/android-native-text-editing.md)；其他输入法／设备、剪贴板、无障碍及完整工作包继续开放。
- **集成与动画**。在[可编辑混合示例（#91）](https://github.com/cnedwin/Egret_rebuild/issues/91)上补齐选定功能，或根据[Spine RESET 契约](knowledge-base/Cns/docs/spine-reset-slot.md)与[序列兼容替换契约](knowledge-base/Cns/docs/序列动画RESET替换.md)完善[动画生命周期与 Spine 兼容替换（#86）](https://github.com/cnedwin/Egret_rebuild/issues/86)。
- **可独立参与**。欢迎授权素材与参考夹具、可复现问题、聚焦代码、翻译和[独立新贡献者演练（#52）](https://github.com/cnedwin/Egret_rebuild/issues/52)。共享输入接口的修改沿用 #89 和 #90，覆盖受影响的桌面和移动端用例。
- **按完整工作包推进：**[M2 内容／动画](https://github.com/cnedwin/Egret_rebuild/issues/56)、[M3 UI／文字／输入](https://github.com/cnedwin/Egret_rebuild/issues/57)和[M4 集成](https://github.com/cnedwin/Egret_rebuild/issues/58)。增量合并不会自动关闭整个工作包的验收要求。

请先阅读[贡献指南](CONTRIBUTING.zh-CN.md)，在[Discussions](https://github.com/cnedwin/Egret_rebuild/discussions)讨论提案，明确范围后开始。开发阶段使用相关检查；发布前完成独立评审、中英文文档、适用浏览器验证和完整保护分支门禁。复用输入未变的证据，保留原始失败。仓库和知识库默认英文，中文放在 Cns/ 或对应伴随文件中。

## 最近交付 / Recent deliveries

Merged engineering increments for the current preview. 当前工程预览已合并的增量。

| Delivery / 交付 | Main change | 主要变化 |
| --- | --- | --- |
| [#195](https://github.com/cnedwin/Egret_rebuild/pull/195) | Optional canvas text input with a native browser field and composition support | 可选画布文字输入，接入浏览器原生文本框与组合输入 |
| [#193](https://github.com/cnedwin/Egret_rebuild/pull/193) | Opt-in frame and hitch monitor for game debugging | 可选帧时与卡顿调试面板 |
| [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#188](https://github.com/cnedwin/Egret_rebuild/pull/188) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) | SharedFrame2D becomes the sole 2D frame path and retains stable capture, packing and batches | SharedFrame2D 成为统一 2D 帧路径，复用稳定捕获、打包与批次 |
| [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#185](https://github.com/cnedwin/Egret_rebuild/pull/185) | World3D shadow allocation and SharedFrame2D texture and timing diagnostics with scoped hardware observations | World3D 阴影分配、SharedFrame2D 纹理和计时诊断及有限真机观察 |
| [#177](https://github.com/cnedwin/Egret_rebuild/pull/177) | Browser-playable demo collection | 浏览器游戏试玩入口 |
| [#168](https://github.com/cnedwin/Egret_rebuild/pull/168) | World3D physics helpers for ragdolls, arcade vehicles, rope and cloth, plus a message-port simulation client | World3D 增加布娃娃、街机式载具、绳索和布料辅助组件，以及消息端口物理客户端 |
| [#166](https://github.com/cnedwin/Egret_rebuild/pull/166)–[#167](https://github.com/cnedwin/Egret_rebuild/pull/167) | Shape sweeps, compound bodies, joints and contacts, plus static-body hierarchy and solver slices | 新增形状扫掠、组合刚体、关节和接触报告，扩展静态刚体层级及分片求解 |
| [#163](https://github.com/cnedwin/Egret_rebuild/pull/163) | Automatic instancing, accelerated picking and reduced per-frame allocation | 自动实例化、加速拾取并减少逐帧分配 |
| [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) | Parallel Windows code gate with four complete test shards | Windows 代码门禁拆为并行作业，四个测试分片保留完整覆盖 |
| [#161](https://github.com/cnedwin/Egret_rebuild/pull/161) | World3D terrain, water, crowd and effects refinements, with 25 fixed Windows Edge WebGL2/WebGPU comparisons | World3D 地形、水面、人群与特效完善，Windows Edge 通过 25 个固定 WebGL2／WebGPU 对比 |
| [#154](https://github.com/cnedwin/Egret_rebuild/pull/154)–[#159](https://github.com/cnedwin/Egret_rebuild/pull/159) | World3D character controls, decoding, navigation, terrain, skinned crowds and effects. Windows Edge passed 24 fixed WebGL2/WebGPU comparisons. | World3D 新增角色控制、解码、导航、地形、蒙皮人群与特效，Windows Edge 通过 24 个 WebGL2／WebGPU 固定场景对比。 |
| [#153](https://github.com/cnedwin/Egret_rebuild/pull/153) | Fixed Windows full-dirty Engine median-p95 reaches 5.3 ms against 8 ms. Sparse/full-dirty pacing remains open. | Windows 固定全脏 Engine p95 中位数达到 5.3 ms，目标 8 ms。稀疏／全脏帧节奏仍待验收。 |
| [#152](https://github.com/cnedwin/Egret_rebuild/pull/152) | World3D feature gallery, CPU regression workloads, and physics and shadow optimizations | World3D 功能展厅、CPU 回归负载及物理与阴影优化 |
| [#147](https://github.com/cnedwin/Egret_rebuild/pull/147) | Optional World3D scene graph and standalone WebGL2/WebGPU renderers | 新增可选 World3D 场景图与独立 WebGL2／WebGPU 渲染器 |
| [#148](https://github.com/cnedwin/Egret_rebuild/pull/148) | World3D materials, lighting, post-processing, compressed textures and scene documents | 扩展 World3D 材质、光照、后处理、压缩纹理和场景文档 |
| [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) | World3D instance import, vertex hooks and static mesh collisions with PC and Android functional evidence | 新增 World3D 实例导入、顶点钩子和静态网格碰撞，补齐 PC 与 Android 功能证据 |
| [#151](https://github.com/cnedwin/Egret_rebuild/pull/151) | World3D refraction, light maps, depth of field, batching, text geometry, transform gizmo, and physics joints, hulls and continuous collision | 新增 World3D 折射、光照贴图、景深、合批、文字几何体、变换操纵器，以及物理关节、凸包和连续碰撞 |
| [#136](https://github.com/cnedwin/Egret_rebuild/pull/136) | Standalone WebGL2 isometric example with depth ordering, grid collision and bounded submission | 独立 WebGL2 等距地图示例，展示深度排序、网格碰撞和有界提交 |
| [#140](https://github.com/cnedwin/Egret_rebuild/pull/140) | Faster shared geometry construction for Spine, with short desktop and Android comparisons | 加快 Spine 使用的共享几何构造，记录桌面和 Android 短时对照 |
| [#139](https://github.com/cnedwin/Egret_rebuild/pull/139) | Preserve sequence playback across compatible ContentLoader replacements | 在兼容的 ContentLoader 资源替换中保留序列播放状态 |
| [#138](https://github.com/cnedwin/Egret_rebuild/pull/138) | Reuse fully contained shared clip geometry in WebGPU and WebGL2 | WebGPU 和 WebGL2 复用完全包含的裁剪几何 |
| [#137](https://github.com/cnedwin/Egret_rebuild/pull/137) | Fixed Outfit Studio workloads and mobile multitouch profile | 换装工作室固定负载与移动端多点触摸档位 |
| [#135](https://github.com/cnedwin/Egret_rebuild/pull/135) | Editable desktop Outfit Studio with UI, animation and bounded 3D | 可编辑桌面换装工作室，组合 UI、动画及有界 3D |
| [#134](https://github.com/cnedwin/Egret_rebuild/pull/134) | Owned popup and modal layers with keyboard and native-editor focus | 受管弹出层与模态层，接通键盘和原生编辑焦点 |
| [#133](https://github.com/cnedwin/Egret_rebuild/pull/133) | Native composition teardown repair and responsive editor preview | 修复原生组合会话退役，完善响应式编辑预览 |
| [#132](https://github.com/cnedwin/Egret_rebuild/pull/132) | Optional native single/multiline editing, managed UI and paired fonts | 可选原生单／多行编辑、托管 UI 与配对字体 |
| [#130](https://github.com/cnedwin/Egret_rebuild/pull/130) | Precise Android heap accounting and finite lifecycle/recovery follow-up; historical callback trigger remains unresolved | Android 精确内存口径及有限生命周期／恢复补充；历史回调触发原因仍待查 |
| [#129](https://github.com/cnedwin/Egret_rebuild/pull/129) | Registered-font selection retained across equipment changes in the paragraph example | 段落示例换装后保持已注册字体选择 |
| [#127](https://github.com/cnedwin/Egret_rebuild/pull/127) | Contributed movement/action state controls over existing contact routing | 社区移动／动作状态控件复用既有触点路由 |
| [#128](https://github.com/cnedwin/Egret_rebuild/pull/128) | Windows CI failure governance and reusable Skill | Windows CI 失败治理与可复用 Skill |
| [#108](https://github.com/cnedwin/Egret_rebuild/pull/108) | Contributed bounded Android collector with exact-setting restoration | 社区有界 Android 采集器及原设置恢复 |
| [#126](https://github.com/cnedwin/Egret_rebuild/pull/126) | Public overview, roadmap and community entry refresh | 公开简介、路线图与社区入口整理 |
| [#125](https://github.com/cnedwin/Egret_rebuild/pull/125) | Managed sequence RESET replacement; early shared validation before complete merge checks | 受管理序列 RESET 替换；完整合并检查前增加公共基线预检 |
| [#124](https://github.com/cnedwin/Egret_rebuild/pull/124) | Transactional UI theme/skin switching, paint-only layout reuse and metric-change anchor preservation | UI 主题／皮肤事务切换、纯绘制布局复用及度量变化时锚点保留 |
| [#123](https://github.com/cnedwin/Egret_rebuild/pull/123) | Font build artifacts and runtime font-set replacement through existing resource owners | 字体构建产物与运行时字体集合替换，复用既有资源所有权 |
| [#122](https://github.com/cnedwin/Egret_rebuild/pull/122) | Shared Alpha masks, bounded offscreen blur and UI integration | 共享 Alpha 遮罩、有界离屏模糊与 UI 整合 |
| [#121](https://github.com/cnedwin/Egret_rebuild/pull/121) | Styled paragraphs integrated into managed UI | 多样式段落接入托管 UI |
| [#120](https://github.com/cnedwin/Egret_rebuild/pull/120) | Selected Spine RESET, shared rendering and device-recovery integration | 选定 Spine RESET、共享渲染与设备恢复整合 |
| [#119](https://github.com/cnedwin/Egret_rebuild/pull/119) | Stable-key reveal and navigation in virtual lists | 虚拟列表按稳定键定位与导航 |
| [#118](https://github.com/cnedwin/Egret_rebuild/pull/118) | Editable reference with 20 independent Spine and 200 sequence instances | 20 个独立 Spine 与 200 个序列实例的可编辑参考场景 |
| [#114](https://github.com/cnedwin/Egret_rebuild/pull/114)–[#117](https://github.com/cnedwin/Egret_rebuild/pull/117) | Spine playback, shared display, combined skins and finite play counts | Spine 播放、共享显示、组合皮肤与有限播放次数 |
| [#113](https://github.com/cnedwin/Egret_rebuild/pull/113) | Managed-row keyboard and logical-focus integration | 托管行键盘与逻辑焦点整合 |
| [#112](https://github.com/cnedwin/Egret_rebuild/pull/112) | Observable preview loading/failure, cancellation and reload recovery | 预览加载／失败提示、取消及重新加载恢复 |
| [#109](https://github.com/cnedwin/Egret_rebuild/pull/109)–[#111](https://github.com/cnedwin/Egret_rebuild/pull/111) | Paragraph geometry, multipage atlas content and optional Spine JSON ingress | 段落几何、多页图集内容与可选 Spine JSON 接入 |

<details>
<summary>早期工程记录 / Earlier engineering checkpoints</summary>

以下条目保留当时的交付范围，后续能力以上表为准。The entries below describe their original delivery scope; later capabilities are summarized above.

| Version / 版本 | Main change | 主要变化 |
| --- | --- | --- |
| Optional Spine assets / 可选 Spine 资产 · 2026-10-30 | Core 4.3.13 JSON and original atlas pages share existing resource ownership; playback/graphics qualification remains open | Core 4.3.13 JSON 与原始图集页面复用既有资源所有权；播放／图形验收继续开放 |
| Keyboard focus / 键盘焦点 · 2026-10-30 | Stable logical targets, typed keys and native Canvas focus lifetime | 稳定逻辑目标、类型按键与原生 Canvas 焦点生命周期 |
| Mobile examples / 移动示例 · 2026-10-30 | Touch input, responsive UI and bounded DPR; preserved fixed fixtures | 触摸输入、响应式 UI 与有界 DPR，保留固定夹具 |
| Paragraph layout / 段落布局 · 2026-10-29 | Six alignments, maxLines and truthful overflow; hard-break marker and recoverable no-fit refusal | 六种对齐、maxLines 与真实溢出；硬换行省略号及过窄拒绝／恢复 |
| Final-line bidi / 最终行双向排版 · 2026-10-29 | Native line L1/L2 after wrapping; shared glyph/rect/hit order and sequential trailing-space geometry | 换行后原生行 L1／L2，字形／矩形／命中共享顺序，尾空格依次定位 |
| Readonly paragraphs / 只读段落 · 2026-10-29 | Width-based Latin/CJK/Arabic paragraph layout, natural/minimum line height, ordinary UI and variable-height list integration | 明确字体的中英阿文字自动换行、自然/最小行高，接入普通 UI 与动态高度列表 |
| M2.1 runtime integration / 运行时接入 · 2026-10-29 | Typed PNG/atlas/sequence groups reuse existing resources and lifetimes; complete readiness, cancellation and explicit generation replacement | PNG／图集／序列帧类型化组复用原资源与生命周期，支持完整就绪、取消及显式代际替换 |
| M1.5 delivered / 已交付 · 2026-10-21 | Resource manifests, shared resource loading and device recovery delivered through [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79); formal M1.2 performance remains open | 资源清单、共享资源加载与设备恢复通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付；M1.2 正式性能仍开放 |
| M1.5 recovery verification / 资源恢复验证 · 2026-10-20 | Seven fixed desktop recovery cases verified; [scope and remaining work](knowledge-base/en/docs/resource-recovery-evidence.md) | 七项固定桌面恢复验证完成；[范围与剩余工作](knowledge-base/Cns/docs/resource-recovery-evidence.md) |
| M1.4 | Implemented optional shared WebGL2 executor with finite desktop verification | 已实现可选共享 WebGL2 执行器，具有有限桌面验证 |
| M1.3 | Shared texture pages and linear scene/UI composition delivered through PR #75 | 共享纹理页与线性场景/UI 合成已通过 PR #75 交付 |
| M1.2 | Incremental capture and adjacent batching delivered; performance acceptance open | 增量捕获与相邻合批已交付；性能验收未完成 |
| M1.1 | Completion-safe GPU buffer and binding reuse | 安全完成后的 GPU 缓冲与绑定复用 |
| 0.61.0 | Internal WebGPU image cache with per-Host ownership | 各 Host 独立管理的 WebGPU 内部图像缓存 |
| 0.60.0 | Strict single-page atlas metadata planning with explicit PNG binding | 严格单页图集元数据规划与显式 PNG 绑定 |
| 0.59.0 | Normalized trimmed and clockwise90 atlas frames with stable logical dimensions | 标准化裁边与顺时针90度图集帧，保持逻辑尺寸 |
| 0.58.0 | Atomic multi-Bitmap binding and prepared two-layer outfits | 多 Bitmap 原子绑定与双层组合换装 |
| 0.57.0 | Real-resource scene composition connecting resources, animation, text and input | 连接资源、动画、文本与输入的真实资源场景组合 |
| 0.56.0 | Recoverable single-Bitmap resource replacement with latest accepted intent | 可恢复的单 Bitmap 资源替换与最新已接受意图 |
| 0.55.0 | Explicit local linear planning and a two-button composition example | 显式本地线性规划与双按钮组合示例 |
| 0.54.0 | Shared-input bitmap buttons with pressed/disabled skins and final activation picking | 共享输入位图按钮、按下与禁用皮肤、激活前最终命中复查 |
| 0.53.0 | Runnable atlas/animation playground with explicit pivots and saved/live frames | 图集与动画可运行示例、显式锚点和保存／实时画面 |
| 0.52.0 | Display anchor offsets shared by rendering, coordinates and picking | 渲染、坐标转换与拾取共用显示对象锚点 |

</details>

[完整更新日志](knowledge-base/Cns/CHANGELOG.md) · [English changelog](knowledge-base/en/CHANGELOG.md) · [架构计划](knowledge-base/Cns/docs/architecture-and-engineering-plan.md)

[文档导航](DOCUMENTATION.zh-CN.md)汇总各模块契约与知识库入口。

## 许可与来源

第一方代码与文档采用 [Apache-2.0](LICENSE)。第三方库、字体、动画运行库和示例素材保留各自的声明与条件。再分发前请阅读 [NOTICE](NOTICE) 与[来源鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)和相应能力的来源记录；Spine 运行库／内容条件与引擎许可分别适用。
