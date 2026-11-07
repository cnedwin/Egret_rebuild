# 核心能力与剩余工作

[English](../../en/docs/core-progress.md) | 简体中文

复盘基线：2026-11-07，main [f869b37](https://github.com/cnedwin/Egret_rebuild/commit/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1)。当前是提供可运行公共示例的工程预览。工作区包仍为 private、版本 0.0.0；源码公开不等于可安装的稳定引擎发布。

本页说明当前能力，[工程计划](工程规划.md)说明接下来的工作，子系统契约给出准确 API 和证据范围。历史预览记录不再作为并行的“当前版本”。

## 产品目标与当前实现

白鹭的产品目标包括动画丰富的 2D 游戏、复杂界面、轻量 3D、一体化 AI 创作平台、目标平台发布和旧工程迁移。当前实现提供运行时基础，尚未交付完整的创作、原生／小游戏或迁移产品。

| 领域 | 已有实现 | 仍缺失的能力或验收 |
| --- | --- | --- |
| 显示与渲染 | 熟悉的显示对象、坐标、显式命中几何和不可变捕获；有序 WebGPU／WebGL2 共享路径、相邻准备／合批、纹理页、有界缓冲／目标复用、Alpha 遮罩及可分离模糊 | 原全脏 CPU／准备目标、更广泛设备与宿主、完整功能参考；Canvas 保留较小的声明范围 |
| 资源与构建 | 清单准入、共享获取／租约、Scope 清理、取消及迟到结果处理；选定 PNG／图集／序列／字体的可复现构建、缓存／工程采用及类型化运行时组 | Spine 二进制产物、选定纹理／mip／压缩变体、更广泛格式／导出器资格与完整场景验收 |
| 动画 | 显式 Engine 时间、Tween、序列播放／控制；可选 Spine JSON 资产、独立播放器、组合皮肤、有限播放及共享显示；Spine／序列各有 RESET 槽 | 有界 Spine 跳转／重放、完整选定版本语义／参考，以及兼容的保留状态资源替换 |
| UI | 托管根、测量／排列、变高稳定键列表、锚点、行焦点与定位；不可变主题／皮肤代次、共享特效及受管弹出层／模态层 | 完整控件、语义投影及完整大场景资格 |
| 文字与字体 | 只读 CanvasKit／SkParagraph 段落、最终行双向排版、换行、对齐／行数限制、多样式、已提交命中／选区／插入点几何及受管字体集合切换、可选原生单／多行编辑及配对浏览器字体 | 真实 IME 资格、必需文字／字体／墨迹的独立参考、传输／启动及 CPU／Wasm／内存资格 |
| 输入 | 兼容旧鼠标 API、可选多触点路由、键盘／逻辑焦点、响应式示例及已合并的移动／动作控件状态 | 其余控件／示例／键盘接线、手势仲裁、完整语义整合和必需真实手机／IME／无障碍记录 |
| 3D | 自有几何／矩阵、固定不透明场景路径及声明后端上的有序 2D 叠层 | 模型导入、可用场景／相机／材质创作、3D 角色动画、光照和通用特效 |
| 工程与工具 | 版本化工程快照／事务、结构化诊断、有界旧 RES／MovieClip 分析；固定环境、评审及公开 CI | 工程到运行游戏的创作闭环、集成可视化工具、Agent／Skill／MCP 应用、发布／更新适配和完整迁移 |

## 弹出层与模态层增量 — 2026-11-07

M3.4 新增[根级弹出层与模态层](ui-layers.md)、分阶段发布、裁剪锚点、嵌套关闭、指针屏障、逻辑焦点包含及原生编辑暂停。现有表单整合详情、重命名与返回，共享既有资源。完整控件、手势、语义投影和设备与辅助技术验收仍归 #90，本增量不实现由其他贡献者负责的触摸工作。

## 原生编辑增量 — 2026-11-07

M3.3 提供可选原生 input／textarea 编辑，复用已提交文本／选区／组合状态、段落／UI 发布、配对字体和行／资源生命周期。最终桌面批次每后端通过固定 21 项及响应式八项；三星实际软键盘观察与最终准确源码的 Android 生命周期检查分别记录在 [Android 补充验证](android-native-text-editing.md)。桥接器修复取消后的终止组合回调，响应式表单在宽度切换时退役独立界面 Scope。其他输入法／设备、系统剪贴板、无障碍、完整工作包及 M1.2 继续开放；触摸分工和固定夹具不变。

## 已实现包与入口

仓库有四个基础包和一个显式可选 Spine 包。这是实际工作区，不是远期目录提案。

| 包 | 当前责任与入口 |
| --- | --- |
| @egret/contracts | 不依赖其他产品包的共享契约与资源记录 |
| @egret/runtime | 无宿主依赖的显示、事件、Scope、资源及文字／输入／UI 状态；仅依赖 contracts |
| @egret/engine | 公开装配、时钟、资源、UI／动画协调及显式浏览器后端；依赖 runtime／contracts |
| @egret/project | 工程事务及选定内容／导入工具；依赖 contracts 和已声明解析器 |
| @egret/spine | 可选第一方资产／播放器／显示／RESET 整合，采用官方 Core 4.3.13；依赖公共白鹭边界及单独许可的运行库 |

默认 Engine 导入不初始化 Spine、3D、段落 WASM 或原生虚拟机。[实际包结构](工程技术架构与项目结构.md)、包清单和公共入口契约定义可用名称。计划中的 CLI／编辑器／原生包不是已安装产品。

当前使用契约：

- [共享渲染](shared-render-profile-contract.md)、[WebGL2](webgl2-executor-contract.md)、[资源恢复](resource-recovery-contract.md)和[共享 UI 特效](shared-ui-effects.md)。
- [构建到运行时内容](content-build-pipeline.md)、[多页图集](multipage-atlas-content.md)和[字体资源／代次](font-resource-generations.md)。
- [Spine 资产／播放／显示](spine-content-ingress.md)、[Spine RESET](spine-reset-slot.md)、[序列控制](sequence-controls.md)和[序列 RESET](序列动画RESET替换.md)。
- [托管 UI](ui-data-panel.md)、[多样式段落](paragraph-styled-runs.md)、[已提交文字几何](paragraph-text-geometry.md)、[字体／布局控制](paragraph-layout-controls.md)和[主题](ui-theme-generations.md)。
- [多触点输入](multi-pointer-input.md)、[键盘／焦点](keyboard-focus-input.md)、[移动／动作控件范围](m3-ui-text-input-plan.md)和[响应式示例](mobile-examples.md)。
- [有界 3D](公共3D场景契约.md)、[工程事务](工程事务核心合同.md)和[旧工程迁移范围](旧工程迁移.md)。

## 现有工作包

M2–M4 的十一个工作包均保留完整验收要求。下表确认已合并能力，不据此宣布整个工作包完成。

| 工作包／Issue | 已交付基础 | 剩余结果／协调责任 |
| --- | --- | --- |
| M2.1／[#83](https://github.com/cnedwin/Egret_rebuild/issues/83) | PNG、图集、多页、序列、字体构建／运行时及可选 Spine JSON 接入 | 二进制／变体构建、授权选定版本参考清单／内容维护者 |
| M2.2／[#84](https://github.com/cnedwin/Egret_rebuild/issues/84) | 独立 Spine 实例、轨道／队列、皮肤、有限播放及序列控制 | 完整合格语义和有界跳转／重放／动画维护者 |
| M2.3／[#85](https://github.com/cnedwin/Egret_rebuild/issues/85) | 显式 egret-shared-linear/1 下的共享 Spine 几何 | 完整附件／裁剪／双色／混合／采样参考／渲染维护者 |
| M2.4／[#86](https://github.com/cnedwin/Egret_rebuild/issues/86) | 可编辑 20-Spine／200-序列示例、RESET 及选定恢复 | 兼容状态保留、最终动画生命周期／预算／资源动画维护者 |
| M3.1／[#87](https://github.com/cnedwin/Egret_rebuild/issues/87) | 托管布局、稳定键虚拟化、锚点、焦点／定位、字体／主题整合及有界编辑行保留 | 完整一致 UI 场景／UI 维护者 |
| M3.2／[#88](https://github.com/cnedwin/Egret_rebuild/issues/88) | 只读多样式文字、几何和字体代次 | 必需独立参考及 provider 成本／恢复资格／文字维护者 |
| M3.3／[#89](https://github.com/cnedwin/Egret_rebuild/issues/89) | 触点路由、键盘／焦点、行整合及原生单／多行纯文本编辑 | 真实 IME／移动键盘、剪贴板及无障碍资格／输入宿主维护者 |
| M3.4／[#90](https://github.com/cnedwin/Egret_rebuild/issues/90) | 遮罩／模糊、主题及社区移动／动作状态 | 其余控件、层级、手势和语义／UI 维护者与现有触摸贡献者 |
| M4.1／[#91](https://github.com/cnedwin/Egret_rebuild/issues/91) | 可运行组件示例和公共接口 | 同一个可编辑混合参考工程，可开始有界首轮整合／集成维护者 |
| M4.2／[#92](https://github.com/cnedwin/Egret_rebuild/issues/92) | 固定桌面恢复及有界 Android 组件证据 | 完整混合生命周期、性能和必需设备验收／性能平台维护者 |
| M4.3／[#93](https://github.com/cnedwin/Egret_rebuild/issues/93) | 可观察预览失败／取消／重载及公开贡献入口 | 干净消费者分发物与合格交接／发布维护者 |

角色表示责任，不代表人员配置或自动分派志愿者。保留既有触摸／控件贡献边界，其余工作消费对应接口。

## 继续开放的证据

M1.1–M1.5 工程已集成。M1.2 正式静态／稀疏／全脏 Engine p95 中位数仍为 **5.0／6.4／10.3 ms**，全脏未达到 **8 ms**。全脏 Host 7.7 ms 不能建立 4 ms 准备上界，也不能分离纯准备时间。GPU 时间未测。[#55](https://github.com/cnedwin/Egret_rebuild/issues/55)及[原始记录](incremental-frame-preparation-evidence.md)继续开放。

[Android 报告](android-device-validation.md)记录了有限 WebGPU／WebGL2 组件、生命周期与受控恢复，包括 #129 字体注册示例修正和 #130 新增十二个诊断／生命周期用例。历史约 41.4 ms 回调触发条件未复现；精确堆／后备存储观察不能证明物理内存或通用零泄漏验收。已撤回的错误目标启动报告不是 Engine 回归。

这些手机证据不等于完整 X-MTouch/1、混合百次生命周期／十次恢复、必需 iPhone／IME／无障碍记录或完整授权 Spine 素材。API 探测、模拟输入、CI 或短时回调采样不能关闭这些项目。

M0 的[独立新贡献者演练 #52](https://github.com/cnedwin/Egret_rebuild/issues/52)及[剩余场景／权利／设备资格 #54](https://github.com/cnedwin/Egret_rebuild/issues/54)同样保持开放。它们阻塞相应声明，不阻塞无关实现。

## 下一开发阶段

M3.3 已实现所声明的浏览器原生编辑切片，消费既有段落几何与托管 UI；真实 IME 等剩余资格仍待完成。在独立负责的分支中，M4.1 可将已有动画／UI／资源组合成同一示例，及早暴露 provider 传输／启动和完整引擎成本。M2 贡献者可沿现有所有者补齐二进制／内容资格、跳转／重放或保留状态替换。M3.4 已协调的触摸工作独立继续。

随后完成其余控件和完整混合场景，解决原 M1 性能缺口，并以冻结输入执行必需 M4 验收。有界工程预览可以先于完整资格交付，但必须标明实际限制。[工程计划](工程规划.md)给出依赖和退出标准，不增加工作包编号或承诺日期。

## 历史记录

[更新日志](../CHANGELOG.md)、子系统证据及[复盘基线中的旧进度页](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/Cns/docs/core-progress.md)保留原预览截止、计数、失败、散列及后续修复。本次整理改变呈现方式，不改变执行结果；来源、上游许可和贡献署名留在原记录中。
