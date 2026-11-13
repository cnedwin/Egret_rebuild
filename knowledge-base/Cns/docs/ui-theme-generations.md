# UI 主题代际

[English](../../en/docs/ui-theme-generations.md) | 简体中文

可选入口 `@egret/engine/ui` 在现有 `UiRoot` 准备与提交域中加入经过准入的不可变主题代际。这是 M3.4 的主题/皮肤切片，不代表完整控件、语义、IME、效果或设备验收完成。

## 数据与 API

`createUiTheme({ id, colors?, spacing?, typography?, skins? })` 返回独立、冻结的 `UiTheme` 身份。相同描述也产生不同代际；ID 只是标签，不是权限或全局版本号。嵌套记录被复制并冻结，每组最多 64 个 token。标识符以 ASCII 字母开头，后续允许字母、数字、下划线、点或连字符，最长 64 字符。只接受普通数据记录；访问器、Symbol 和未知字段被拒绝，getter 不会执行。

颜色为 0 至 0xffffff 的整数 RGB 值；间距为 0–4096 的有限数。排版提供非空、不含控制字符、最长 256 字符的字体族，字号 1–512，行高 1–2048。皮肤记录必需 `default`，可选 `hover`、`pressed`、`disabled`、`focus`、`checked`、`selected`、`expanded` 名称。这些名称由应用映射至已有的类型化资源引用，不是 URL 或隐式加载指令。状态选择及无障碍控件行为仍由现有控件或应用负责。[`selectUiSkin(skin, state)`](ui-controls.md#绘制状态) 给出控件当前成立的状态所对应的名称：先看不可用，再看按住、已设置、获得焦点和被指向；皮肤对它们都没有命名时取 `default`。

`UiRootOptions.theme` 指定初始期望代际；`root.setTheme(theme | undefined)` 暂存变更；`root.snapshot().theme` 只返回已提交代际。即便字段相同，仿造对象也会被拒绝。`LayoutNode.theme` 可将 `fill` 绑定颜色 token，将 `padding`/`gap` 绑定间距 token。引用缺失在接受意图前失败；主题为 undefined 时回退至节点字面值。fill 绑定只允许叶节点，虚拟列表不允许绑定 padding/gap。

`UiLeafPrepareContext.theme` 和 `RowBindContext.theme` 均携带捕获的主题代际。现有内容回调可为当前段落请求/provider 合同选择排版，或通过现有资源管理器/内容组选择皮肤资源。每项取得的租约或准备内容必须归属传入 Scope，并观察其取消信号。不增加第二个资源管理器、资源命名空间、输入监听器、CSS 层叠或字体 provider 权限。

## 准备、发布与取消

每次主题变化保守地在离线候选 Scope 中重新准备当前准入的叶节点及列表行。颜色和皮肤名称属于绘制变化；间距和排版差异属于度量变化。度量变化重算布局、使旧列表实测高度失效，并在现有边界约束内保留稳定 key 的滚动锚点及偏移。不提供跨 root 原子性。

没有其他未提交 root 编辑时，仅绘制切换复用已提交布局计划及 box 身份，不调用布局或用户测量回调。候选内容必须返回与原来完全相同的实测高度，否则以 `UI_THEME_METRICS_CHANGED` 拒绝，并保留旧提交域。列表行对照已提交高度索引进行校验，包括显式 updateHeights 变更，而不是较早的绑定测量值。皮肤影响尺寸时，应用须同时变更间距/排版 token。累计 `snapshot().counters.layoutPasses` 统计实际 planner 调用，包括离线宽度发现；仅绘制切换保持不变，发布后的当前测量计数为零。内容准备和绘制仍可能执行工作，这不构成性能或字体栅格化结论。

调用 `prepare()` 直到 ready，再在 Engine 空闲边界使用现有显式 `commit()`。提交在局部赋值之间不调用用户回调，一起发布显示绑定、几何、快照及主题，然后才回收旧内容。资源共享保留其他使用者的租约。初始空 root 在首次完整提交前保持不可交互占位。

失败保留已提交状态。较新的主题或普通 `setTree`、数据源、视口、原点、滚动、失效意图使旧准备过期。普通编辑保留期望主题并可能触发布局，但不会自行发布主题。取消待提交切换时调用 `root.setTheme(root.snapshot().theme)`，再准备/提交该意图；其他暂存编辑仍被保留。失败候选可通过再次准备重试。Scope/root/Engine 销毁会取消待完成准备并回收离线所有权；晚到结果不能复活内容。

显式 focus/composition 行保留继续遵守原有禁止重绑合同。主题若要替换保留绑定，会在接受主题意图前以 UI_ROW_RETAINED 拒绝；准备期间新增的保留也会在候选就绪前再次检查。须先释放保留，再显式重试主题切换；取消回保留绑定的已提交主题仍然可用。

回调重入遵守既有版本及所有权检查。UI 回调直接产生的清理错误仍放入 `postCommitErrors`；Scope 所有的清理错误走现有 Engine 清理诊断，不会倒退已经发布的主题。

## 示例与验证边界

已有 [UI 数据面板](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-data-panel/README.zh-CN.md) 加入深/浅色绘制变体、较大字号与行高、图像皮肤选择、延迟成功、拒绝、取消和新意图取代。第二面板保持独立，继续使用同一份核验 PNG、字体、类型化资源加载器、指针通道及共享渲染宿主。

聚焦公开行为测试覆盖不可变准入、真实身份、无布局绘制发布、变高拒绝、失败/过期/晚到所有权、普通编辑、锚点及清理诊断。严格正例和七个未抑制编译负例覆盖可选入口及只读品牌合同。示例采集器冻结完整输入闭包，在两个共享后端检查字面像素、几何、planner 计数、真实鼠标行为及关闭。局部结果、完整门禁、独立评审和 PR/main 交付分别记录；物理触摸、无障碍、完整控件状态及字体/文字体系验收仍开放。

[主题验证摘要](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-data-panel/theme-verification-summary.json)记录实际输入、聚焦与严格检查、双浏览器后端及剩余交付边界。
