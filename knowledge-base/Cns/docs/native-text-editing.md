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

cancel() 丢弃临时组合状态，保留普通编辑已经提交的值。finish()、单行 Enter 和失焦提交观察到的原生文本；多行 Enter 留在 textarea 内。组合输入中的 Enter／Escape、Process／229 事件交给宿主。未配置 keyboard 时，Tab 遵循浏览器行为；配置真实键盘输入后，先恢复激活时捕获的逻辑目标，再使用既有正向／反向焦点顺序。恢复交互不会伪造焦点。会话令牌退役后的输入／组合终止回调会被忽略；活动会话的重入继续拒绝。

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

[可运行表单](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/README.zh-CN.md)提供启动 DPR 有界的响应式预览，以及独立固定验收档。真实宽度改变时替换独立 Scope 界面，保留模型／字体和可见稳定键锚点；键盘引起的纯高度变化保持原生编辑。实际 DPR 变化后需重新打开预览。

原[结果汇总](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/verification-summary.json)保留每后端 20 项桌面记录。[Android 补充验证](android-native-text-editing.md)记录最终桌面每后端固定 21 项及响应式八项、核心与最终版本相同但示例为前序字节的三星实际软键盘观察，以及两后端最终准确源码的 Android 生命周期检查。明确区分源码复用、事件可信属性和受控注入。

CPU 层面的一个用例 [`tests/ui-editor-row-integration.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-editor-row-integration.test.mjs) 让虚拟列表中的编辑器行持有焦点，同时字体迟到、主题改变，或者两者与新的文本值一起发生。四项测试检查各行的高度和位置、逻辑焦点和键盘焦点、编辑器的文字几何，以及行内带有文本框节点的[语义树](ui-semantics.md)保持一致：字体到达之前，已提交的内容不发生任何移动；主题改变会重新绑定每一行，但读屏用户得到的内容没有任何位移；被后来的请求超过的准备以 `UI_STALE` 被拒绝。字体由一个字面量段落提供方代替。原生输入元素、真实字体和浏览器投射不在这个文件中；整合用例的这一部分仍需在浏览器中运行。

其他中日韩／死键输入法、iPhone、真人手指、系统剪贴板和辅助技术继续开放。随附 Noto 集合没有合格 Emoji fallback；删除／文本恢复不代表 Emoji 渲染资格。Native SDK／小游戏宿主需要各自适配器。M1.2 的 10.3 ms 对 8 ms 目标和完整 M3／M4 保持 OPEN。现有触摸贡献者的范围不变。

协议依据 [Input Events Level 2](https://www.w3.org/TR/input-events-2/)、[UI Events](https://www.w3.org/TR/uievents/)、[HTML 文本控件选区](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection) 和 [CSS Font Loading](https://drafts.csswg.org/css-font-loading/) 独立实现。现有已署名 CanvasKit／Noto 产物及许可未变；标准参考不等于浏览器／IME 验收。
