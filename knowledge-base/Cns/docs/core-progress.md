# 核心工程进展

[English](../../en/docs/core-progress.md) | 简体中文

核心工程通过可运行增量连接显示、资源、动画、输入与宿主执行。本页概述当前接口及后续产品工作，链接的契约说明精确行为与验证范围。

## 显式本地布局 — 0.55.0

`@egret/engine/layout` 的纯函数 `planLinearLayout` 生成冻结矩形计划。调用方选择成员，再通过既有 display API 应用坐标；双 Button 示例展示布局、共享输入及保存/实时帧的组合。已记录的桌面 Canvas/WebGPU 检查覆盖固定双 Button 流程；环境及边界见证据记录。 参阅[规格](local-linear-layout-spec.md)和[证据](local-linear-layout-evidence.md)。

## 前次集成 — 0.54.0

工程预览 **0.54.0** 已通过 [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42) 合并。Main 为 efd2a9c91fb6cfe633214b50b82cf7952941452a，tree 为 2b39b8439a5b30ce3572edc162e8a7a916a76185。工作区包仍为 private、版本 0.0.0，宿主协议为 1.0。

## 已实现范围与边界

| 领域 | 当前工程能力 | 参考 |
| --- | --- | --- |
| 显示与输入 | DisplayObject/Container、变换与锚点、坐标／bounds、显式命中区域、主鼠标路由与位图按钮。 | [契约与范围](位图按钮契约.md) |
| 资源 | 类型化引用、共享获取、租约、Scope 释放、获取组、纹理、命名 SpriteSheet 裁剪及可选 PNG Provider。 | [契约与范围](资源批量获取.md) |
| 动画 | 显式游戏时间、标量 Tween、图集序列采样及 Engine 时钟序列播放。 | [契约与范围](时钟驱动序列动画契约.md) |
| 二维呈现 | 不可变画面捕获、Canvas/WebGPU 路径、纹理几何／Mesh2D 及各自规格中的 NineSliceBitmap。 | [契约与范围](自有纹理几何与Mesh2D契约.md) |
| 文字 | 文字栅格编排、非编辑 TextField 及选定 Canvas 文字集成。 | [契约与范围](文字显示TF1契约.md) |
| 三维 | CPU 几何／矩阵、自有场景画面及选定的显式浏览器网格／场景路径。 | [契约与范围](公共3D场景契约.md) |
| Spine | 导入与网格源规划、线性动画源规格及实验性官方 Core 手动桥接。 | [契约与范围](SpineCore手动网格桥接.md) |
| 工程与迁移 | 自有二进制读写器、工程事务契约及受限旧 RES／MovieClip 分析。 | [契约与范围](旧工程迁移.md) |

默认核心不依赖 DOM/Node，Canvas 和 WebGPU 通过显式浏览器入口使用。显示组装、时间推进、捕获和提交分别定义契约。资源租约及 Scope/Engine 所有权明确取消与释放行为。

## 已集成 0.54 的验证

已记录的 0.54 工作完成全部九个本地代码阶段，核心 **3218/3218**、保留 Spine 源码 **160/160**、按钮聚焦检查 **163/163**。按钮类型正例产生 **0** 诊断，负例匹配 **19** 项诊断。正常 prepush、必需的提交／推送钩子均完成，合并代码树与已审阅文件核对一致。

桌面 Edge **155.0.4283.45** 的 Canvas/WebGPU 验证完成 **38** 次主读回及 **87552** 通道比较，容差 **0**、差异 **0**。另一个全新 Canvas 对照记录 **2** 次读回，故意错误的预期相差 **48** 像素和 **96** 通道，不计入主案例。详见[按钮验证记录](位图按钮核验.md)。这些计数对应不同范围，不能相加。

GitHub 未为 PR #42 返回状态或检查运行，以上本地验证与远端 CI 分别记录。桌面像素结果未完成目标手机性能、能耗、字体范围或完整宿主验收。

## 后续工作与贡献

- 在显式本地规划器之外继续完善 UI 组合，以及触摸、键盘、焦点、无障碍和编辑。
- 支持取消、过期结果抑制及可恢复发布的资源视觉替换。
- 按 **R020/V020** 完成版本化 Spine 支持及功能／后端／宿主矩阵。
- 扩展三维场景、角色和特效，连接资产及生命周期。
- 生产浏览器／小游戏／原生宿主，以及目标设备文字与性能。
- 创作工具、Agent／工程接口及 **R008/V006** 完整旧工程迁移。

以上均保留工程与验收义务，范围由[工程规划](工程规划.md)、[交付计划](交付计划.md)和登记册跟踪。

## CPU 参考公式

历史 A2 Task5a 使用 tools/texture-oracle.mjs。expectedUploadRGBA 对整数 straight 通道计算 floor((C*A+127)/255)。expectedEncodedOver 在 premultiplied encoded 域内，按显式 opacity 计算 binary64 source-over，不进行 UNORM 量化或颜色传递转换。assertTexturePixel 要求调用方提供四个明确的绝对通道界限。设备校准单独进行。

## 历史工程证据

[变更记录](../CHANGELOG.md)说明各增量的主要作用。早期详细结果、失败与准备截点保存在子系统证据及[固定版本进展记录](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/Cns/docs/core-progress.md)中。历史计数和哈希继续标识原始源码，后续阅读整理不重新执行或扩大其结论。

可复现改动与审阅流程见[贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.zh-CN.md)。第一方实现、外部依赖和研究参考分别保留来源及许可。
