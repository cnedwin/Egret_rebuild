# 九宫格几何 NS1 实际证据

[English](../../en/docs/nine-slice-geometry-ns1-evidence.md)

## 工程预览 0.41.0 — 九宫格拉伸几何 NS1

**S094 / V045。有限 CPU、类型、策略和浏览器结果已接受；完整发布门禁与交付仍为 PENDING。** 固定边框的拉伸网格复用现有 Mesh2D 纹理租约，调整尺寸时仅替换几何。运行时／引擎根入口提供一个工厂与两个只读类型，保留原有自有几何身份。

实际 CPU 27/27 项通过，其中 11 个 NS 组、6 个 Mesh 组及包含嵌套用例的 10 项几何检查。正例类型诊断为 0；两组刻意负例实际为 41/35 条，共 76 条精确位置记录。严格类型门禁与策略检查退出码为 0；指定策略对照 13/13 通过。实际浏览器完成 2 帧和 96 次颜色通道比较，并验证资源清理；具体环境与范围见证据。

原始 NSP09 的 13/12/1 失败与有限测试输入修正分别保留。

0.40.0 ByteWriter 已通过 [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27) 合并；已回读 Main `8e1509878252cc2a9295fcc56d7597877d023c85` 与 tree `ca1f2f176713e388e09016ae22d610c5c1b95201`。必要推送门禁退出码为 0，公开校验 63 项、核心校验 2724 项。远端状态／检查运行数均为零，不能据此声明远端 CI PASS。较早的 PENDING 截止点和失败记录继续保留。

[契约](九宫格几何NS1契约.md) / [证据](九宫格几何NS1证据.md)。

这是复杂 2D UI 的有限几何增量，不构成完整 UI/EUI、布局、完整 Spine、迁移、手机能耗／性能或原生 SDK／PC 验收。

原始浏览器准备清单失败：prepare-binding 退出码 1，SETUP_FAILURE / NOT_CREATED。准确拒绝为 NS_BROWSER_BINDING:SAVED_SOURCE_DECLARATION_REQUIRED:/packages/runtime/dist/displayTreeState.js。此时未启动浏览器渲染，不是像素或 GPU RED。后续单独封存的 r2 声明清单含 68 项补充声明，已绑定完整实际构建回执并通过独立实际审查。原始失败、合格声明后继和后续实际浏览器成功分别记录；声明资格本身不授予渲染验收。

本记录仅投影已保存且独立审查接受的实际结果。固定 16 顶点／54 索引／18 三角形包含有意退化单元；逻辑字节数 1240 不是物理内存或性能数据。完整类型位置、当前源码／发射身份、实际环境及原始失败见[共享核验记录](../../evidence/nine-slice-geometry-ns1-verification.json)。

实际环境与浏览器范围：

```json
{
  "exitCode": 0,
  "cleanupComplete": true,
  "frameCount": 2,
  "pixelComparisons": 96,
  "environment": {
    "browserVersion": "155.0.4283.45",
    "channel": "msedge",
    "headless": true,
    "flags": "DEFAULT_NO_ADDED_FLAGS",
    "preferredFormat": "bgra8unorm",
    "hostPixelRatio": 1,
    "browserDPR": 1,
    "isSecureContext": true
  }
}
```

此前契约和各阶段原始截止点继续保持原样。当前策展不是完整 prepush、必要推送门禁或 PR/Main 的完成证据。

<!-- NS1-B1-FULL-GATE-SUCCESSOR-BEGIN -->

## 保留宿主验证的实际后继

原始完整门禁保留 2748/2747/1 的失败：S01 静态扫描尚未识别新九宫格模块的一条合法除法表达式。修正仅为该模块及完整表达式增加精确锚点，并将已选见证计数更新为 5 份源码、11 个除法 token；原有通用拒绝规则保留。原默认启动的验证文件实际 2/2 通过，十三个子案例全部完成。此前带名称筛选的启动在子案例开始前被严格进程环境规则拒绝，单独保留为设置历史。渲染实现未改动，已有实际浏览器／类型结果无需重跑；新的完整门禁、推送和 Main 交付仍待单独验收。

<!-- NS1-B1-FULL-GATE-SUCCESSOR-END -->
