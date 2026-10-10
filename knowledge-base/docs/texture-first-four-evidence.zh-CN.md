# 纹理首四项采集：证据边界

[English](texture-first-four-evidence.en.md) · [精简记录](../evidence/texture-first-four-collection.json) · [Bitmap 区域契约](bitmap-region-contract.zh-CN.md)

已记录的桌面采集分别在 Canvas 与 WebGPU 上完成 C01/C03/C05/C07：**8 次捕获、16 张 PNG、192 行观察**。独立保存产物审阅记录 **PASS_SAVED_ARTIFACT_INTEGRITY**，核对 **1233 份保全副本**。这接受保存采集的完整性与内部一致性，不接受纹理数值容差或完整 A2。

## 实际观察

192 行分别包括 **32 行 Canvas straight**、**32 行 WebGPU 编码空间预乘**、**128 行 PNG 合成**观察。它们是采样行，不是 192 次捕获。独立审阅解码十六张 PNG，核对所记录字节，并用字面量纹素、整数预乘和有理数 source-over 参考值重算选定行。

选定配置报告 Node.js **v24.19.0**、Playwright/Core **1.62.1**、pngjs **7.0.0**、Microsoft Edge **154.0.4258.62**，无附加浏览器参数。实际浏览器 DPR 为 **1**；引擎像素比 **1／1.5** 产生 **32×24／48×36** 绘制缓冲，CSS 刻意与绘制缓冲尺寸一致，以便采样。这不是浏览器 DPR 为 1.5 的结果。

八个 Host 和上下文安全关闭，待结算账本为零；四个采集器拥有的 WebGPU device 在借用的 Host 关闭后销毁。已记录的外部进程拥有者达到 active-zero 并关闭 Job。API 清理与进程退场仍是不同观察。保全源码／构建身份绑定本次尝试，后续 Bitmap 裁剪变化不继承此证据。

## 未知项

所有原生通道边界为 null，数值结论仍为 **UNKNOWN**：**numericAcceptance=false、wholeA2=false**。残差最大值是描述性观察，不是容差选择。其余十四项用例、Task5b/G5/Task6、确认、控制和重放仍未完成。

适配器报告的名称不证明硬件加速或性能。时间、内存／进程上限是执行保护。本采集不建立可见 Bitmap 序列播放、Native App／SDK、手机、字体、DragonBones、实体扫描输出或整个引擎验收。文档策展没有新增浏览器执行或数值验收。
