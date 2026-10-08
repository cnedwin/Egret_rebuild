# 白鹭真实资产参考链

[English](README.en.md) | 简体中文

有限的桌面浏览器参考实现。固定复用 Three r186 的 GLTFLoader、SkeletonUtils 与 AnimationMixer，加载 Cesium 的 RiggedSimple 蒙皮圆柱。不是完整角色、完整 2D 引擎或迁移验收。

## 运行

无需安装依赖；使用已有 Node 和 Playwright。

```powershell
# 在本目录，Playwright package root 由调用方提供；无需把机器路径写进代码。
node ./run-headless.cjs '<Playwright package root>' green
# 手工示例：只绑定 127.0.0.1，控制台给出本次本地地址。
node ./server.mjs
```

服务器只允许明确列出的本目录模块与 sources.json 的固定资产/上游文件。默认自动分配端口；可用 ASSET_PROBE_PORT=18767 指定端口。浏览器只能通过随机运行令牌向固定报告文件写入，大小上限 256000 bytes。报告和截图写到知识库 evidence/ 的 asset-reference- 文件家族；既有结果先保留独立历史文件。无 CDN、包安装或公开部署。

打开本地页会先执行 17 个真实集成用例，然后可以点击“查看动画示例”。手动页显示“验证完成”，只有带有效 runner 令牌的运行才保存报告。测试报告含每项输入/预期/实际与局限，不做任何耗时、电量或 GPU 性能结论。运行器在示例启动、截图与停止后再次序列化错误/诊断；示例需有一个运行 owner、实际帧，停止后无 owner/RAF。demoSmoke 与主用例计数分别记录；任何案例失败、页面错误、console 诊断或 demoSmoke 失败都会 exit 1。

## API 与所有权

`await createReferenceChain(canvas,{assetUrl,fontEpoch,signal?})` 返回 `acquireInstance()`、`releaseInstance(instance)`、`renderAt(seconds,{ui=true})`、`dispose()`、`waitForRestore()`、`setText(raw,{font,color,resolution,fontEpoch})` 与可读 `diagnostics`。

`instance` 保留独立 `root`、`mixer`，`timeOffset` 用于独立固定时间采样；共享 geometry/material。最后实例释放即结束该共享 bundle，不可再次 acquire；需新建 owner。release 幂等，实例 root/mixer 清空，mixer uncache、骨骼纹理清理并清空 renderer render lists。owner disposal 同样释放；release 他人实例不改变当前 owner。

只有调用方拥有帧循环；此模块没有 RAF 或 setAnimationLoop。示例的唯一 RAF 驱动同一个 renderAt，停止示例/pagehide 会取消 RAF 并 dispose。上下文丢失时停止提交帧且 diagnostics 为 lost，恢复时重建本实现 UI GPU 资源、按原始文字/style 再生成 Canvas 纹理，Three 自行恢复渲染资源。

`demo-controller.mjs` 安装实际按钮/pagehide 处理。pending start 立即获得 AbortController 与 generation；重复启动忽略，stop/pagehide 取消并使迟到结果无效；RAF 绑定捕获的 owner。失败会清理、启用重试按钮并在 diagnostics 保留原错误，不产生未处理的 Promise。`lifecycle-tests.mjs` 用真实上游解析的控制等待与实际 DOM handler 验证重复启动、加载中 pagehide、停止再启动、首帧前停止再启动及错误重试状态；不替换场景/渲染器。

适配层初始化是一条有界事务：UI 初始化失败会清理其部分 shader/program/VAO/texture，链初始化失败会清理已完整构造的 renderer 及其监听、parsed CPU bundle，再抛出原错误。测试控制真实 shader 状态检查/原生 Canvas 文本初始化异常，观察真实 dispose/delete 与监听删除；没有生产测试开关，也不构造通用异常框架。第三方 constructor 自身未完整返回前的内部部分分配，不声称由此做了穷尽性失败分析。

本链实测 r186 恢复前的 geometry/骨骼纹理 GPU dispose 监听可能保留旧句柄。因此 lost 事件中调用公共 geometry.dispose 与 instance skeleton.dispose，仅撤销已无效的 GPU 分配/旧监听；保留 CPU geometry/material、骨架节点、动画与共享引用。恢复后由 Three 重新上传；这与最后引用时真正清空 CPU bundle 的 releaseShared 分开，不是上游全场景缺陷结论。

WebGL2 明确 alpha=true、premultipliedAlpha=true、antialias=false、preserveDrawingBuffer=true（便于像素验证）。同一上下文中的 UI 使用自己的 shader/VAO；Canvas 以 premultiplied、无隐式 Y 翻转上传；片元输出与 ONE / ONE_MINUS_SRC_ALPHA 混合匹配。每次回到 Three 前调用 renderer.resetState，UI 显式设定所需 GL 状态，不共享缓存假设。

同一 canvas 再创建 renderer 时，适配层先归零 external context 的 unpack row/skip/flip/premultiply/PBO 状态；Three 构造期会初始化空 3D textures，必须在其首帧 reset 之前建立上传边界。首帧前 stop→restart 曾真实触发 GL1282，修复后该窗口零 GL 错误；正常完成首帧后 restart 的先前绿色记录也保留，未冒充红版。

文字调用原生 measureText/fillText，不规范化 raw。单条当前纹理缓存键包括 raw、font/color、resolution、fontEpoch。这是系统字体的有限 smoke evidence，不证明 CJK/emoji 全覆盖、IME、多行、换行策略或文字性能。

必需扩展在 loader 前按本参考 profile 检查；未知必需扩展与未配置的 Draco/KTX2/meshopt 解码路径拒绝。未知可选扩展允许 loader 忽略。此 profile 并不把上游全部警告重新解释为产品验收。

## 证据与复现

绿色主报告：`../../evidence/asset-reference-probe-results.json` 与 `asset-reference-probe.png`。每次 runId 对应独立 JSON/PNG，不把红版/变异重复次数叠加为主报告数量。四种变异分别移除 renderer reset、提前释放共享资源、忽略 required preflight、遗漏恢复 UI init，均有真实失败报告与 history/ 下源码快照。

初次独立审阅与 root 的 12 项绿色证据保留；R1/R2 后主计数增加为实际 17 项。新增 5 项 red→green：shader/text 初始化清理、真实示例重复加载/pagehide/异常重试。post-report 原生文本异常的 runner oracle 有单独变异证据：主 17 项仍通过，但新 runner 正确报告 demoSmoke 失败并 exit 1，未伪造主案例失败数量。

历史源码快照以最小空间保留 authored modules；复现时将快照的 authored files 临时覆盖本目录，同一固定 vendor/assets/sources.json 保持不变，运行 runner，随后恢复绿色 authored files。历史报告内 SHA256 能与该快照核对。不要直接从 history/ 启动服务器；上游依赖仅存放在本实验根目录。

## 固定来源与许可

Three r186：commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`，MIT。Rigged Simple — Cesium (2017)，CC BY 4.0；Khronos glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`。精确来源、Git blob 与 SHA256 在 sources.json；许可原文在 vendor/three/r186/LICENSE、assets/RiggedSimple/LICENSE.md。资产为 1 动画、1 skin、2 joints、160 vertices、188 triangles 的蒙皮圆柱。
