# 键盘输入与逻辑焦点

[English](../../en/docs/keyboard-focus-input.md) | 简体中文

## 范围与入口

M3.3 增加由 Scope 管理、面向真实 Engine 显示目标的键盘通道。可选 `@egret/engine/input` 在保留指针工厂的同时导出 `createKeyboardInput`；`@egret/engine/web/keyboard` 导出 `createBrowserKeyboardInput`。默认 Engine／Canvas 入口不增加键盘导出。核心复用现有 Engine、Scope 和同步显示事件，不依赖 DOM、Node、渲染器或第三方库；浏览器桥单独组装。

本基础增量不实现托管 UI 的自动焦点注册、模态约束、复合控件方向导航、原生文字编辑／输入法或语义 DOM 投影，这些仍属于 M3.3／M3.4 后续工作。逻辑目标已可通过公开显示事件操作。旧 MouseInput／PointerInput 行为和全部固定验收示例保留。

## 注册与聚焦控件

用 `{engine,scope,onFocusChange?}` 创建通道，再调用 `registerTarget({id,target,tabIndex?,disabled?})` 注册已挂在同一 Engine 舞台的真实 DisplayObject。注册借用显示目标，释放注册不会释放显示对象。目标不需要指针命中区域或 touchEnabled。ID 是不含 NUL、最多 128 个 UTF16 单元的非空字符串，在通道中唯一。默认上限为 4,096 个目标、64 个按住的键和 4,096 层祖先检查，可配置最大值分别为 65,536／256／65,536。

注册句柄支持 `update({target?,tabIndex?,disabled?})` 和 `dispose()`。同一逻辑 ID 可更换显示实例并保留逻辑焦点，已按住的键在替换前取消。旧句柄不能修改复用 ID 的新注册。准入失败保留原记录。祖先隐藏、禁用、脱离舞台或已释放的目标不可聚焦；`sync()` 协调显示状态变化。移除或失效的焦点目标清空焦点，不擅自选择其他控件。

通过 `focus(id,{visible?,reason?})` 显式聚焦，`focus(undefined)` 清空。`moveFocus('next'|'previous',wrap?)` 先按正 tabIndex 升序，再按零索引目标的注册顺序遍历；-1 仅支持程序聚焦。默认不循环：越过边界清空焦点并返回 undefined，显式 wrap=true 才循环。键盘遍历显示焦点提示，指针／程序调用默认隐藏。同一 ID 和显示实例下的调用只更新快照的 focusVisible，不发出 focusIn／focusOut 或 onFocusChange；改变该标志的调用者应读取通道快照并重绘。

`getSnapshot()` 以不可变标量记录／数组提供 state、focusedId、focusVisible、pressedKeys 和 targetCount，不暴露显示目标或 Engine 权限，关闭后仍可读取。公开类型事件包括 `keyDown`、`keyUp`、`cancel`、`focusIn`、`focusOut`；处理器读取 `event.payload`。焦点载荷包含逻辑目标／关联 ID、原因和可见状态，焦点通知不可取消。

## 按键、取消与所有权

`keyDown(sample)` 和 `keyUp(sample)` 接收 code、key、repeat 及 alt／ctrl／meta／shift 修饰键；code 长度 1–64，key 长度 1–128，布尔值默认 false。数据复制并冻结，返回真实同步事件的 defaultPrevented，不合成点击／激活，也不提供可编辑文字。重复按下复用已按住的物理 code，取消后的重复不会创建新按下；未知释放被忽略。

焦点转移、目标替换／移除、暂停、所有者关闭、显式取消和释放，都会在回调转移后续按键前清空按住状态。原生原因包括 blur／hidden／pagehide，新目标不会接收旧目标的迟到释放。`setInteractive(false)` 清空焦点和按键，true 恢复新输入；`dispose()` 幂等，并由真实 Scope 和 Engine 管理。按键处理器可转移焦点或关闭所有者；焦点通知中的递归修改在改写其他状态前被拒绝。回调失败仍完成安全清理并保留错误。显示路由使用现有 UI 输入投递保护和原始准入操作。

## 浏览器策略

浏览器工厂只绑定认证 Host 所属、位于声明 realm 且连接到文档的 HTMLCanvasElement。原生焦点由应用决定，构造不会抢焦点。缺失的 tabindex 在桥生命周期内设为 0；关闭只恢复仍由该桥拥有的值，保留外部修改。每个 Canvas 只有一个原生键盘桥，可与指针桥共存。

仅当 Canvas 真正拥有文档焦点时准入按键，忽略其他输入框／编辑器。普通 Tab／Shift+Tab 在类型事件投递后遍历逻辑目标，处理器已阻止时不再遍历；只有仍留在内部时才阻止 Tab 默认行为，否则允许浏览器离开画布。其他键只由真实被阻止的类型事件阻止默认操作；处理器同步暂停、释放或聚焦原生输入框时，阻止仍属于原始原生事件。失焦、隐藏／离开页面和关闭取消按住状态，不伪造释放；暂停会移除原生监听器，恢复不重复安装。

排除 composing／Process／Dead 事件与空物理 code，不将其当作输入法实现。桥不截获其他编辑器文字，也不把文字记录到诊断。完整原生编辑、手机键盘和辅助技术仍需专门集成验收。

## 示例、检查与边界

运行 `pnpm example:browser`，选择双触点示例。指针选择可转移逻辑焦点；聚焦 Canvas 后使用 Tab／Shift+Tab、方向键和回车／空格。应用通过类型事件决定方向／激活策略，金色／白色边框显示焦点和按住状态。视口替换不保留触点或按键，应用快照可恢复已提交的激活计数和仍有效的逻辑焦点。[响应式示例契约](mobile-examples.md)继续保留独立固定入口。

公开 SDK／类型／包检查覆盖准入、顺序、重复／取消、目标替换、旧句柄、回调／所有者重入和可选入口边界。既有浏览器命令增加默认 Edge 的真实按键／焦点流程、指针共存、原生输入框交接、Tab／默认行为和属性／监听器清理：

```text
node --test tests/keyboard-input.test.mjs tests/keyboard-package.test.mjs
node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>
```

验收要求与实际记录分开。浏览器自动化验证默认操作和 SDK 路由，不代表真人输入法、Android／iPhone 真机、屏幕阅读器、帧耗时或完整 M3／M4 验收。M1.2 正式性能继续 OPEN。新核心／适配器／测试为复用白鹭原语的独立第一方 Apache-2.0 实现，不新增第三方代码或素材。

2026-10-30 的本地记录：139 项相关公开行为／类型／兼容检查通过，其中包括 23 项键盘行为及四项严格类型／包检查；当前包／源码／声明门禁检查 804 个文件通过。默认无头 Edge 156.0.4314.50／Playwright 1.62.1 在既有十个上下文完成 556 项检查，失败为零。处理器暂停／释放输入或交接到编写的原生输入框时，已核对真实原生事件的默认阻止；这不代表真人输入法验收。较早的定向失败、首次浏览器采集断言错误及当前源码身份更新各自保留独立记录。
