# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 当前白鹭引擎

白鹭是面向 Web 与轻量游戏的社区重建项目，重点支持复杂 2D 界面、动画，以及能够承接 AI 辅助创作的架构。熟悉的 TypeScript API、明确的资源所有权和共享渲染构成基础。一体化 AI 创作平台、更完整的 3D 与新增原生／小游戏宿主属于后续产品工作。

**工程预览阶段：**main 包含经评审、可运行的工程增量，不代表完整引擎发布，也不代表所有平台、Spine 功能、无障碍与性能已验收。请按各能力契约和实际测量范围使用。

| 领域 | 主干已有能力 | 仍需完成 |
| --- | --- | --- |
| 渲染与资源 | WebGPU／WebGL2 共享渲染、有序准备、资源组及选定设备恢复路径 | 更广泛的宿主／设备验收；固定 M1.2 全脏 Engine p95 中位数仍为 [10.3 ms，目标 8 ms](https://github.com/cnedwin/Egret_rebuild/issues/55) |
| 内容与动画 | PNG／图集／序列构建、多页图集、字体产物；可选 Spine 播放／显示和选定替换路径 | 选定版本完整 Spine 参考、纹理变体、保留状态替换及最终生命周期／性能验收 |
| UI 与文字 | 变高列表、焦点／导航、多语言多样式段落、已提交文字几何、字体／主题切换、遮罩及模糊 | 原生编辑／IME、完整控件／模态／语义整合，以及更多文字／设备验收 |
| 集成 | 可编辑资源、UI 与动画示例，响应式预览 | 完整混合参考游戏与经资格验证的核心交付 |

[Android 观察与剩余设备限制](knowledge-base/Cns/docs/android-device-validation.md)只覆盖准确组件档位，不代表通用手机支持或关闭 M1.2 性能目标。

## 运行示例

使用 **Node.js 26.7.0** 和 **pnpm 11.25.0**，在仓库根目录运行：

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

[上手指南](knowledge-base/Cns/docs/getting-started.md)说明环境、预期结果和排错方法。可体验[响应式示例](examples/mobile/README.zh-CN.md)、[UI 段落](examples/paragraph-panel/README.zh-CN.md)和[序列替换](examples/sequence-reset/README.zh-CN.md)。固定验收夹具与响应式预览分别保留。

## 开发与社区参与

选定工作前先读[当前能力图](knowledge-base/Cns/docs/core-progress.md)和[下一阶段工程计划](knowledge-base/Cns/docs/工程规划.md)。2026-11-07 复盘统一已实现核心、剩余需求及原十一个 M2–M4 工作包。

[M2–M4 路线图](knowledge-base/Cns/docs/m2-m4-delivery-plan.md)、[Issues](https://github.com/cnedwin/Egret_rebuild/issues)、[里程碑](https://github.com/cnedwin/Egret_rebuild/milestones)和[社区看板](https://github.com/users/cnedwin/projects/2)统一记录交付、依赖与验收缺口。

- **下一项核心工作建议：**[原生纯文本编辑与托管 UI 整合（#89）](https://github.com/cnedwin/Egret_rebuild/issues/89)，复用段落几何、焦点与资源生命周期。这是范围明确的下一步，不代表已经实现或自动向他人分派任务。
- **并行整合入口：**[同一可编辑混合参考（#91）](https://github.com/cnedwin/Egret_rebuild/issues/91)可使用已有资产／UI／动画开始；[剩余 M2 工作](https://github.com/cnedwin/Egret_rebuild/issues/56)分别补齐二进制／参考／跳转／保留状态。这些是有界贡献入口，不代表完整验收。
- **可独立参与：**授权素材／参考夹具、可复现问题、聚焦代码、翻译和[独立新贡献者演练（#52）](https://github.com/cnedwin/Egret_rebuild/issues/52)。触摸／手势相关修改先与现有贡献者协调，避免争用共享输入代码。
- **按完整工作包推进：**[M2 内容／动画](https://github.com/cnedwin/Egret_rebuild/issues/56)、[M3 UI／文字／输入](https://github.com/cnedwin/Egret_rebuild/issues/57)和[M4 集成](https://github.com/cnedwin/Egret_rebuild/issues/58)。增量合并不会自动关闭整个工作包的验收要求。

请先阅读[贡献指南](CONTRIBUTING.zh-CN.md)，在[Discussions](https://github.com/cnedwin/Egret_rebuild/discussions)讨论提案，明确范围后开始。开发阶段使用相关检查；发布前完成独立评审、中英文文档、适用浏览器验证和完整保护分支门禁。复用输入未变的证据，保留原始失败。仓库和知识库默认英文，中文放在 Cns/ 或对应伴随文件中。

## 最近交付 / Recent deliveries

下列记录为已合并工程增量，不代表发布新包版本或完整支持声明。These are merged engineering increments, not new package-version or full-support announcements.

| Delivery / 交付 | Main change | 主要变化 |
| --- | --- | --- |
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
