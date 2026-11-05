# UI 中的只读段落

[English](README.md) | 简体中文

这个可运行示例使用构建后的公开段落、UI、指针及共享渲染 SDK 入口。普通列布局中包含按宽度排版的拉丁/中文和阿拉伯文段落，下方橙色条的位置跟随实际文字高度。另一个 UiRoot 展示 24 条多语言虚拟列表记录。行高与文字图像来自同一份已准备段落度量。

运行 `pnpm setup:dev` 和 `pnpm example:browser`，打开 `http://127.0.0.1:4173/examples/paragraph-panel/index.html`。默认使用 WebGL2，添加 `?backend=webgpu` 可显式选择 WebGPU。逻辑画布为 1100×760；左列起点 (24,28)、宽 530，列表起点 (646,28)、尺寸 420×704。

窄列/宽列在 300 和 530 间切换。大字号设为 26px，最小行高设为 44 个逻辑像素。密度在 1 和 2 间切换，不改变逻辑行几何。重复准备用于观察已有准备结果和缓存的复用；滚动列表将偏移设为 380。点击列表行可查看 Engine 指针通知。

延迟更新在准备新段落版本时保留之前完整的图像与几何；完成更新才发布替换结果。替换待定宽度用新宽度取代延迟中的内容。更新失败会主动拒绝一次真实提供器请求，之前完整的 UI 继续显示。这些开关仅包裹真实 CanvasKit 提供器，不使用替代文字渲染器。

页面提供 `globalThis.__egretParagraphPanel`，包含 `ready`、`inspect()`、`readback()`、`action(name)`、`beginDelayedUpdate()`、`pendingFrame()`、`finishDelayedUpdate()`、`supersedeDelayedUpdate()`、`close()`。检查结果包括已提交 UI 快照、真实准备度量、缓存计数、提供器调用、输入事件、失败及清理状态；读回返回宿主的真实 RGBA。这个接口属于示例代码，不是产品诊断导出。

`vendor/` 中的可选资源包含具有明确身份的后端和原始 Noto 字体，并附许可与来源。字体注册前校验原始字节，不静默替换为系统字体。为了复现，示例主动加载选定的拉丁、阿拉伯与中日韩字形；实际应用应按需选择字体。示例传输量不代表引擎核心体积或启动性能。

只读段落不实现编辑、选择或原生输入法。所选后端已集成最终行 L1／L2，并完成有限[原生／浏览器验证](../../knowledge-base/Cns/docs/paragraph-line-bidi.md)。本示例不能证明完整 Unicode 正确性、未列出文字/字体的覆盖、GPU 计时、物理内存、移动设备表现或剩余 M3/M4 验收。浏览器观察与受控生命周期测试应分别记录。

构建后，使用已安装的 Playwright 1.62.1 和 Edge，执行 `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>`，可一次运行两个后端的完整行为检查。[实际观察记录](../../verification/paragraph-sdk/verification.json)将有限功能结果与性能、手机、IME 和独立字形／墨迹验收区分。

## 段落布局控制

Align 按左／居中／右／start／end／两端顺序切换普通段落和虚拟行。两行限制在 maxLines=2 与不限行之间切换，后续几何使用同一准备结果更新。失败或不支持的更新保留旧画面。当前 layout-r1 运行库提供经验证的硬换行省略号及可恢复的过窄拒绝。见[契约与最新证据](../../knowledge-base/Cns/docs/paragraph-layout-controls.md)。

## 多样式装备说明

选择 **装备说明样式**，将普通栏目和虚拟列表切换到预设装备描述；也可使用 ?content=equipment，需要 WebGPU 时同时添加 backend=webgpu。金色标题、小号品质文字、彩色属性和明确的中文字体区间由同一完整段落排版。窄版／宽版、字号、对齐、两行省略和密度继续使用现有控件；页脚及回收列表行使用最终真实行高，不增加另一套文字渲染或输入机制。再次选择该按钮恢复原普通内容，默认地址仍保留原固定夹具。

纯数据模块 styled-copy.mjs 同时构造原文和不可变 UTF-16 样式区间。UI 内容修订拥有请求快照，延迟、失败及过期请求保留前一份已发布图像和几何。本示例只展示只读样式，不代表富文本编辑、任意 HTML/CSS、触摸控件或字体／性能验收。参阅[多样式段落契约](../../knowledge-base/Cns/docs/paragraph-styled-runs.md)。

示例为双倍密度下新旧 UI 事务重叠配置 32 MiB 段落图像缓存；引擎默认值和栅格上限不变。装备条目从 540 单位的保守估计开始，最终采用实测高度。运行 node examples/paragraph-panel/verify-equipment.mjs <playwright-root> <new-output-directory> 可执行有限的样式 UI 检查。[结果与边界](styled-verification-summary.json)。
