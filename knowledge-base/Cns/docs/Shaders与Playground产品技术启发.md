# Shaders 与 Playground 对白鹭的启发

[English](../../en/docs/shaders-and-playground-lessons.md) | 简体中文

版本：0.1研究稿 · 核查日期：2026年10月8日 · 知识库：0.6.2

两者分别提供了“可组合且让Agent理解的效果组件”和“创作、试玩、修改、发布、发现”的参照。白鹭应将它们连接到同一份可维护工程，继续聚焦复杂2D UI与轻量3D。下述设计都是候选启发；本次只有官方资料与固定源码研究，没有安装、运行、生成游戏、性能测试或产品实现。

## 已核实的范围

| 对象 | 官方资料或固定源码支持什么 | 尚不能推导什么 |
| --- | --- | --- |
| Shaders | 10月6日公告将软件引擎、组件与框架绑定以MIT开源；宣传200+基础组件。公告署名Simon，官方仓库为Shader Effects Inc. | 未取得Evan You是作者的一手证据；组件数是展示口径，未清点精确独立效果数；编辑器平台、精选Pro预设和完整section与MIT软件范围分开。 |
| Shaders运行机制 | 固定v4.0.2提交的效果定义含参数、默认值及编译相关信息；组合生成compute、渲染到纹理与最终输出pass；同页默认共享GPUDevice并允许注入。 | 不等于所有效果合成一个pass、不等于高性能实测；注入device没有证明可嵌入白鹭已有pass/渲染目标。该版本WebGPU-only，没有WebGL回退，使用HTMLCanvasElement及浏览器生命周期。 |
| Google Playground | 10月7日发布实验平台；可对话创作、试玩和继续修改。当前帮助明确导出包含HTML、JS、CSS及生成资产的ZIP；发布后的修改留在私有草稿，旧公开版继续可玩。 | 游戏源码导出不等于平台开源；没有实测离线/自部署、导出后重导入、复杂作品维护或目标小游戏兼容。当前渲染器/模型/Agent内部实现未知。 |
| Unity Spark | Google和Unity宣布未来提供专业机制、高保真3D及Unity runtime体验；核查时Spark仍在测试/候补阶段，Unity公告计划今年晚些时候推出。CEO博客还提出连接Asset Store。 | 不能把未来Spark能力写成当前Playground已具备；作品分发效果、收入和完整工程互通没有本轮证据。 |

资料：[Shaders公告](https://shaders.com/updates/shaders-is-open-source)、[首页](https://shaders.com/)、[固定root源码](https://github.com/shader-effects-inc/shaders/blob/9435282c29d3505c67eef427470c8d835095a199/packages/core/src/gpu/root.ts)、[固定composer源码](https://github.com/shader-effects-inc/shaders/blob/9435282c29d3505c67eef427470c8d835095a199/packages/core/src/gpu/composer.ts)、[Google发布](https://blog.google/innovation-and-ai/technology/ai/playground-experimental-gaming-platform/)、[当前帮助](https://playground.google/helpcenter)、[Unity公告](https://unity.com/news/google-and-unity-partner-on-new-ai-gaming-platform-for-the-next-era-of-interactive-entertainment)、[Spark产品页](https://unity.com/spark)、[Unity CEO说明](https://unity.com/blog/why-we-built-unity-spark)。完整逐条事实、来源、未知与未执行范围分别见S040的[Shaders记录](../../evidence/shaders-reference-research.json)和S041的[Playground记录](../../evidence/playground-reference-research.json)。

## 效果应成为工程资产

建议独立设计白鹭效果资产合同：稳定ID与版本、参数类型/范围/默认值、输入资源、颜色与透明度约定、混合/遮罩顺序、运行能力条件、预览样例、来源，以及编译诊断映射。编辑器面板、Agent接口和运行时共享这份合同；开发者调出的效果与Agent修改的效果属于同一份工程。

例如“让抽卡金光更柔和，但不要遮挡文字”，Agent应定位已有发光效果，修改强度、范围与合成顺序，展示结果并保留撤销记录。默认路径选择已验证效果并调整参数，定制shader作为进阶能力。检索返回少量相关组件、参数说明与预览，减少Agent凭空发明不存在的API。Shaders的[MCP](https://shaders.com/docs/guide/mcp)、[CLI](https://shaders.com/docs/guide/cli)和[Agent参考](https://shaders.com/docs/guide/agent-skill)展示了文档、检索、代码出口与手动修改保护的组合；本轮没有连接或执行这些工具。

白鹭还应提供效果成本合同：哪些参数只更新uniform，哪些会重建pipeline；预计pass/中间纹理及能力需求，实际耗时另由测量提供。按目标能力选择白鹭自己的WebGPU/WebGL实现，或明确使用经过对照的简化效果、烘焙序列帧等退路。自动翻译WGSL不足以保证compute或多pass效果在其他后端等价。GPU设备、帧调度、资源代次和最终呈现统一由白鹭核心管理，设备丢失时不可由效果组件悄悄换设备。CPU Canvas仍按既有文字与兼容边界设计。

这关联D009资源专门化与D011诊断；Shaders在此提供效果资产与工具链的研究参考，白鹭渲染核心按自有规格独立实现。按R015及[独立实现规范](独立实现与第三方依赖规范.md)，先形成白鹭规格再独立实现；明确公共依赖可另行评估，保留其归属。精选Pro内容不能据MIT软件公告转入白鹭公开效果库。开源基础组件配合付费精选内容/服务是可研究的商业分层，本轮不确定白鹭收费方式。

## 从首次可玩走向持续创作

候选入门路径：描述想法 → 选择可玩模板 → 立即试玩 → 点选对象并提出局部修改 → 查看变化、试玩或撤销 → 保存工程 → 发布更新。UI树、状态、资源和代码作为进阶入口，不让新创作者首先学习渲染管线。可视化与Agent必须共同编辑同一项目，减少生成后进入另一套维护流程的成本；这关联[AI工程接口](AI创作与工程接口.md)与D012版本合同。

Playground的草稿/公开版隔离值得借鉴：生成中可取消，稳定发布版本继续运行，用户确认后才发布更新。白鹭的作品验收应同时覆盖具体操作、状态与资源回归；编译可玩不能代替需求达成。分享和反馈可帮助创作者完成作品，但首阶段无需同时建设大型社交平台、资产市场与通用高端3D制作平台。

“对话生成、持续编辑、源码导出”已是有官方依据的竞争基线。未来Spark又把专业3D和资产生态纳入竞争，因此不能将这些功能单独包装成白鹭优势，也不能未经验证声称竞品因技术债做不到复杂UI。

## 差异化必须落到可比较的任务

| 白鹭拟建立的优势 | 后续验证方式，均未执行 |
| --- | --- |
| 复杂UI、2D动画和轻量3D同时存在，连续修改仍可维护 | 用同题作品持续修改20轮；统计需求完成、误改、回归失败、人工修复和总耗时。 |
| 小游戏加载与运行体验 | 在明确宿主和真实设备上比较同功能同画质的首包、首次可玩、帧时分布、内存及能耗。不能借Shaders源码推定性能。 |
| 开源独立核心与工程自主性 | 验证本地构建、模型替换、工程导出及持续编辑；开源意图不等于已发布开源产品。 |
| 旧Egret完整迁移并继续创作 | 按R008/V006对真实项目的UI、动画、事件、资源和平台行为对照，完成继续编辑、真实发布及更新；参照[旧工程迁移](旧工程迁移.md)。 |

建议下一轮细化效果资产合同，以遮罩发光、局部模糊、序列帧叠加三类游戏UI效果检验参数和后端边界，再将它们放入同一多轮创作任务。上述是待细化的研究建议，不新增已确认交付或预算；D仍proposed，H仍untested，V002—V006实现与验收状态不变。
