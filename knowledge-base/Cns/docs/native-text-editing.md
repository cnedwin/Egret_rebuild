# 原生纯文本编辑

[English](../../en/docs/native-text-editing.md) | 简体中文

M3.3 现已提供整合到现有托管 UI 的可选单行／多行编辑切片。活动编辑期间，真实浏览器 input 或 textarea 负责编辑、选区、原生撤销／重做和组合输入；UI 发布后，现有段落渲染器呈现同一已提交源文本。本切片不代表完整 M3.3、IME、手机或无障碍要求通过。

## 入口与所有权

| 入口 | 职责 |
| --- | --- |
| @egret/runtime/ui/editing | createTextEditState 及源文本／选区／会话类型；无 DOM／Node 依赖的有界状态 |
| @egret/engine/ui/editing | createUiTextEditor 与 UI 类型；真实 Engine／Scope、现有 ParagraphCache 和准备后的 UI 绑定 |
| @egret/engine/web/editing | createBrowserEditorFontProvider 与 createBrowserTextEditor；显式浏览器字体注册、原生元素／监听器及定位 |

默认 Engine、Canvas、UI 和键盘入口保留已有公开接口。不增加新的渲染器、整形引擎、资源管理器、触点路由或帧调度器。私有根／控件身份阻止结构复制件或外部 Engine／Scope 获得原生编辑权限；源码及当前依赖记录保留精确的历史前身。

## 文本与事务

已提交文本必须是合法 UTF-16，最多 8192 个编码单元，也可配置更小的 maxLength。选区采用源文本 anchor／focus 和 upstream／downstream 亲和性，位置不能分割代理对。多行文本将 CRLF／CR 转为 LF，偏移针对规范化后的源文本；单行文本拒绝换行。非法文本、控制字符或选区在发布前拒绝。字素删除和原生编辑由宿主负责，不估算字符宽度。

一个不透明激活标识对应一次编辑会话。原生更新携带期望的已提交修订；过期会话／修订不能覆盖新意图。组合输入只保存一个临时草稿，根据最终观察到的原生值提交一次；相同的重复最终 input 不重复提交。组合输入期间拒绝程序化修改文本或选区。显式 setValue(..., {cancelComposition:true}) 取消旧会话、发布指定意图，并拒绝已脱离原生节点的迟到事件。避免写入相同 DOM 值以保留原生撤销历史；显式程序化替换不同文本可能重置宿主历史，不另设撤销栈。

cancel() 丢弃临时组合状态，保留普通编辑已经提交的值。finish()、单行 Enter 和失焦提交观察到的原生文本；多行 Enter 留在 textarea 内。组合输入中的 Enter／Escape、Process／229 事件交给宿主。未配置 keyboard 时，Tab 遵循浏览器行为；配置真实键盘输入后，先恢复激活时捕获的逻辑目标，再使用既有正向／反向焦点顺序。恢复交互不会伪造焦点。

## 托管 UI 与渲染

以 engine、scope、cache、mode 和样式创建控件。样式包括配对字体的 fontSet 键／字体族、fontSize、locale、direction 和 fillColor；lineHeight、textAlign、backgroundColor、padding、minHeight、visibleLines 可选。只读呈现默认单行限制一行、多行限制六行；原生元素编辑完整的已准入文本。普通叶节点使用 content，现有虚拟数据源使用 prepare(context)，自然段落高度在配置的最小高度之上驱动布局。

只有值／样式变化推进 content.revision；选区和临时组合输入不会重新栅格化。onChange 回调暂存现有树／数据源的新修订；按原有路径执行 root.prepare()／commit()、bridge.sync()、共享帧捕获／渲染。onInvalidate 在原生／画布可见性变化时请求同一渲染路径，不启动新循环。回调异常保留已提交模型并关闭原生所有权；应用应显式重试 UI 发布。

浏览器桥核验已提交的叶 ID，或虚拟列表 ID／稳定键，使用真实段落命中／选区几何及捕获的显示变换。每个控件最多保留八个活动／暂存呈现。编辑期间只隐藏只读段落，背景与包装节点仍由 UI 管理；已提交 UI 的内容修订和文本匹配后才移除原生显示。准备失败或取消保留旧的已提交 UI 和原生呈现。finish 后等待交接的原生元素只读，直到匹配段落发布。缺字拒绝不会悄悄替换已提交文本，应提供合格字体或显式替换文本恢复。

活动虚拟编辑器借用现有行保留计数和额度。其私有令牌保留稳定键身份，同时允许只读内容、字体度量、宽度和密度重新发布；原有公开 focus／composition 保留令牌继续锁定原绑定。两类令牌存续时都不能删除行；删除键之前先结束或销毁编辑器。行被完全裁剪时结束原生编辑并释放令牌。Scope、根或 Engine 关闭会移除原生元素、监听器／观察器、临时状态及行／字体租约；重复清理安全。

## 字体与定位

createBrowserEditorFontProvider 将同一不可变 FontContentLoader 根传给现有段落字体集合 provider 和资源组，从已准入字节创建使用生成 CSS 别名的 FontFace，等待真实加载完成，返回与段落集合使用同一键的真实句柄。仅 CanvasKit 就绪不足以代表原生字体就绪。不使用网络字体 URL，也不另建资源缓存。集合退役时先取消活动原生使用者，再移除 CSS 注册。候选失败／取消保留旧句柄；setFontSet 在组合输入之外接受已就绪的配对句柄。调用者协调多个字段，在旧只读呈现交接完成后退役前一集合。

浏览器 provider 准入最多八个待定／就绪集合、64 MiB 字体源字节，每个集合最多 64 个原生编辑器租约；原生加载默认期限 30 秒，最大 120 秒。这些是逻辑限制，不是已测量的原生／Wasm 内存。关闭或取消请求不会伪称中止尚未结算的浏览器字体解析，任务持续计数至实际结算。provider 借用已有段落 provider，不负责关闭它。

首批定位档位支持横向文本、正向轴对齐显示／CSS 缩放及矩形裁剪。显式逻辑场景尺寸独立于底图像素／DPR；每次 UI 发布后调用 sync，浏览器 resize／scroll／visual viewport 通知更新定位。旋转、透视、编辑路径上的特效／透明度、非矩形裁剪、裁剪祖先的边框／内边距、CSS zoom、具有变换／包含块的文档根、圆角裁剪、Shadow DOM 祖先链和捏合后的 visual viewport 均显式拒绝。表面／模态所有者通过 setInteractive(false) 在排除之前结束所有权。原生与只读字体共享准入身份，但整形／换行／墨迹可能不同，不承诺像素等价。

## 验证与剩余资格

[可运行表单](../../../examples/text-editing/README.zh-CN.md) 通过公开入口覆盖普通 UI 与虚拟行生命周期。[结果汇总](../../../examples/text-editing/verification-summary.json) 区分纯状态单元、字面量宿主 SDK／类型用例，以及实际桌面 Edge 156.0.4314.58 浏览器运行。WebGL2、WebGPU 各通过 20 项整合检查，包含可信输入／撤销／重做、原生多行 Enter、反向选区、受控组合输入／粘贴、过期事件、布局／密度、字体失败／取消／替换、裁剪行返回、只读交接失败及自有资源归零。WebGPU 运行使用 deviceScaleFactor 2，属于浏览器模拟，不是手机结果。此前失败及修正原因均保留。

真实中日韩输入法／死键、实体 Android／iPhone 键盘与 Emoji 删除、系统剪贴板和辅助技术仍待验收。随附 Noto 集合没有合格的 Emoji fallback；受控 Emoji 用例验证只读准备失败和文本恢复。Native SDK／小游戏宿主需要各自的适配器和证据。M1.2 的 10.3 ms 对 8 ms 目标保持 OPEN。本功能不扩大上述结论或现有触摸贡献者的范围。

协议依据 [Input Events Level 2](https://www.w3.org/TR/input-events-2/)、[UI Events](https://www.w3.org/TR/uievents/)、[HTML 文本控件选区](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection) 和 [CSS Font Loading](https://drafts.csswg.org/css-font-loading/) 独立实现。现有已署名 CanvasKit／Noto 产物及许可未变；标准参考不等于浏览器／IME 验收。
