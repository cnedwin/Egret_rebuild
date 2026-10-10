# 白鹭真实资产参考链

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

打开本地页会先执行 12 个真实集成用例，然后可以点击“查看动画示例”。手动页显示“验证完成”，只有带有效 runner 令牌的运行才保存报告。测试报告含每项输入/预期/实际与局限，不做任何耗时、电量或 GPU 性能结论。

## API 与所有权

`await createReferenceChain(canvas,{assetUrl,fontEpoch,signal?})` 返回 `acquireInstance()`、`releaseInstance(instance)`、`renderAt(seconds,{ui=true})`、`dispose()`、`waitForRestore()`、`setText(raw,{font,color,resolution,fontEpoch})` 与可读 `diagnostics`。

`instance` 保留独立 `root`、`mixer`，`timeOffset` 用于独立固定时间采样；共享 geometry/material。最后实例释放即结束该共享 bundle，不可再次 acquire；需新建 owner。release 幂等，实例 root/mixer 清空，mixer uncache、骨骼纹理清理并清空 renderer render lists。owner disposal 同样释放；release 他人实例不改变当前 owner。

只有调用方拥有帧循环；此模块没有 RAF 或 setAnimationLoop。示例的唯一 RAF 驱动同一个 renderAt，停止示例/pagehide 会取消 RAF 并 dispose。上下文丢失时停止提交帧且 diagnostics 为 lost，恢复时重建本实现 UI GPU 资源、按原始文字/style 再生成 Canvas 纹理，Three 自行恢复渲染资源。

本链实测 r186 恢复前的 geometry/骨骼纹理 GPU dispose 监听可能保留旧句柄。因此 lost 事件中调用公共 geometry.dispose 与 instance skeleton.dispose，仅撤销已无效的 GPU 分配/旧监听；保留 CPU geometry/material、骨架节点、动画与共享引用。恢复后由 Three 重新上传；这与最后引用时真正清空 CPU bundle 的 releaseShared 分开，不是上游全场景缺陷结论。

WebGL2 明确 alpha=true、premultipliedAlpha=true、antialias=false、preserveDrawingBuffer=true（便于像素验证）。同一上下文中的 UI 使用自己的 shader/VAO；Canvas 以 premultiplied、无隐式 Y 翻转上传；片元输出与 ONE / ONE_MINUS_SRC_ALPHA 混合匹配。每次回到 Three 前调用 renderer.resetState，UI 显式设定所需 GL 状态，不共享缓存假设。

文字调用原生 measureText/fillText，不规范化 raw。单条当前纹理缓存键包括 raw、font/color、resolution、fontEpoch。这是系统字体的有限 smoke evidence，不证明 CJK/emoji 全覆盖、IME、多行、换行策略或文字性能。

必需扩展在 loader 前按本参考 profile 检查；未知必需扩展与未配置的 Draco/KTX2/meshopt 解码路径拒绝。未知可选扩展允许 loader 忽略。此 profile 并不把上游全部警告重新解释为产品验收。

## 证据与复现

绿色主报告：`../../evidence/asset-reference-probe-results.json` 与 `asset-reference-probe.png`。每次 runId 对应独立 JSON/PNG，不把红版/变异重复次数叠加为主报告数量。四种变异分别移除 renderer reset、提前释放共享资源、忽略 required preflight、遗漏恢复 UI init，均有真实失败报告与 history/ 下源码快照。

历史源码快照以最小空间保留 authored modules；复现时将快照的 authored files 临时覆盖本目录，同一固定 vendor/assets/sources.json 保持不变，运行 runner，随后恢复绿色 authored files。历史报告内 SHA256 能与该快照核对。不要直接从 history/ 启动服务器；上游依赖仅存放在本实验根目录。

## 固定来源与许可

Three r186：commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`，MIT。Rigged Simple — Cesium (2017)，CC BY 4.0；Khronos glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`。精确来源、Git blob 与 SHA256 在 sources.json；许可原文在 vendor/three/r186/LICENSE、assets/RiggedSimple/LICENSE.md。资产为 1 动画、1 skin、2 joints、160 vertices、188 triangles 的蒙皮圆柱。

2026年10月10日调整阅读文档位置。文中的实验命令仍在仓库根目录下的共享目录 `knowledge-base/experiments/asset-reference-probe/history/pre-review-fix` 中运行。此次阅读文档迁移没有重跑实验，也没有改写原始证据。
