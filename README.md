# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Egret today

Egret is an open-source TypeScript engine for Web games. The display, event and resource APIs support 2D animation and complex interfaces through shared WebGPU and WebGL2 rendering. Optional World3D adds standalone 3D rendering and physics. The roadmap includes integrated AI-assisted creation and additional native and mini-game hosts. [World3D contract](knowledge-base/en/docs/world3d.md)

**Engineering preview.** Start from a runnable example and use its capability contract for supported platforms, features and validation scope. Workspace packages are private at 0.0.0.

| Area | Available on main | Remaining work |
| --- | --- | --- |
| Rendering and resources | Shared WebGPU/WebGL2 rendering, ordered preparation, resource groups and selected device recovery. The fixed M1.2 full-dirty Engine median-p95 is 5.3 ms against 8 ms. | Broader host/device qualification and the remaining [M1.2 pacing target](https://github.com/cnedwin/Egret_rebuild/issues/55) |
| Content and animation | PNG/atlas/sequence builds, multipage atlases and font artifacts, optional Spine playback/display and RESET, compatible sequence playback preservation | Complete selected-version Spine references and state preservation, texture variants, integrated lifecycle and performance qualification |
| UI and text | Variable-height lists, focus/navigation, multilingual styled paragraphs, text geometry, font/theme switching, masks/blur, owned popup/modal layers and optional native single/multiline editing | Actual IME, remaining controls/semantics and broader script/device qualification |
| 3D | [Optional World3D](knowledge-base/en/docs/world3d.md) covers glTF, lighting and shadows, post-processing, animation, text, automatic instancing and accelerated picking. The physics preview includes shape sweeps, compound bodies, solver slices and gameplay helpers. The shared host supports bounded 3D backgrounds with 2D composition. | Broader asset and device qualification and project authoring integration |
| Integration | [Editable Outfit Studio](examples/outfit-studio/README.md) with a compact desktop scene, fixed mixed workloads and a mobile multitouch profile | Selected feature coverage, full performance/device qualification and the core preview handoff |

[Android observations](knowledge-base/en/docs/android-device-validation.md) cover specific component and mixed-scene cases on the tested phones. See the [current capability map](knowledge-base/en/docs/core-progress.md) for device, input and performance coverage.

## Run an example

Use **Node.js 26.7.0** and **pnpm 11.25.0**. From the repository root:

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [getting-started guide](knowledge-base/en/docs/getting-started.md) explains prerequisites, expected results and troubleshooting. Explore [Outfit Studio](examples/outfit-studio/README.md), [responsive examples](examples/mobile/README.md), [paragraphs in UI](examples/paragraph-panel/README.md) and [sequence replacement](examples/sequence-reset/README.md). Use the fixed profiles for qualification and the responsive previews to try the UI.

See the [WebGL2 isometric map](examples/isometric-map/README.md) for depth ordering and frame submission in a small grid-based scene.

Run the [World3D example and feature gallery](examples/world3d/README.md) to explore the optional 3D capabilities. The example lists supported backends and verified environments.

For optional tile-map, physics, audio, save, archive, KTX2 and localization support, see the [third-party integrations](integrations/README.md).

## Development and community

Read the [current capability map](knowledge-base/en/docs/core-progress.md) and [engineering plan](knowledge-base/en/docs/engineering-plan.md) to see delivered features and open acceptance criteria across the eleven M2–M4 packages.

The [M2–M4 roadmap](knowledge-base/en/docs/m2-m4-delivery-plan.md), [Issues](https://github.com/cnedwin/Egret_rebuild/issues), [milestones](https://github.com/cnedwin/Egret_rebuild/milestones) and [community board](https://github.com/users/cnedwin/projects/2) describe delivered work, dependencies and remaining acceptance.

- **Native editing slice:** [single/multiline editing in managed UI (#89)](https://github.com/cnedwin/Egret_rebuild/issues/89) reuses paragraph geometry, focus and resource lifetimes. See the [contract](knowledge-base/en/docs/native-text-editing.md), [responsive form](examples/text-editing/README.md) and [Samsung Android keyboard/lifecycle observations](knowledge-base/en/docs/android-native-text-editing.md); other IMEs/devices, clipboard, accessibility and full-package acceptance remain open.
- **Integration and animation**. Complete selected features in the [editable mixed example (#91)](https://github.com/cnedwin/Egret_rebuild/issues/91), or work on [animation lifecycle and compatible Spine replacement (#86)](https://github.com/cnedwin/Egret_rebuild/issues/86) using the [Spine RESET contract](knowledge-base/en/docs/spine-reset-slot.md) and the [sequence compatibility contract](knowledge-base/en/docs/sequence-reset.md).
- **Contribute independently**. Authorized reference fixtures, reproducible issues, focused code, translation and [independent newcomer rehearsal (#52)](https://github.com/cnedwin/Egret_rebuild/issues/52) are welcome. Use #89 and #90 for shared input changes and cover the affected desktop and mobile cases.
- **Work in complete packages:** [M2 content/animation](https://github.com/cnedwin/Egret_rebuild/issues/56), [M3 UI/text/input](https://github.com/cnedwin/Egret_rebuild/issues/57) and [M4 integration](https://github.com/cnedwin/Egret_rebuild/issues/58). A merged increment does not close all acceptance for its package.

Read [CONTRIBUTING](CONTRIBUTING.md), discuss proposals in [Discussions](https://github.com/cnedwin/Egret_rebuild/discussions), and identify a bounded scope before starting. Develop with focused checks; publish with independent review, English/Chinese documentation, relevant browser evidence and complete protected merge checks. Reuse unchanged evidence and preserve failures. Repository and knowledge-base reading editions are English-first, with Chinese under Cns/ or companion files.

## Recent deliveries / 最近交付

Merged engineering increments for the current preview. 当前工程预览已合并的增量。

| Delivery / 交付 | Main change | 主要变化 |
| --- | --- | --- |
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
<summary>Earlier engineering checkpoints / 早期工程记录</summary>

The entries below describe their original delivery scope; later capabilities are summarized above. 以下条目保留当时的交付范围，后续能力以上表为准。

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

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Architecture](knowledge-base/en/docs/architecture-and-engineering-plan.md)

The [documentation index](DOCUMENTATION.md) links subsystem contracts and the knowledge base.

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes and sample assets retain their own notices and conditions. Read [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md) and the relevant capability's source record before redistribution; Spine runtime/content conditions are separate from the engine's license.
