# 文档导航

[English](DOCUMENTATION.md) | 简体中文

建议按下列顺序了解产品与工程，再查阅所需子系统的接口契约。知识库提供完整 [English](knowledge-base/en/README.md) 和[简体中文](knowledge-base/Cns/README.md)版本。

0.56 资源槽增量组合了可恢复绑定替换及已记录的桌面 Canvas/WebGPU 示例，所链接规格、证据与示例限定当前行为及核验范围。

## M2–M4 架构与社区交付

[M2–M4 架构与社区交付](knowledge-base/Cns/docs/m2-m4-delivery-plan.md) · [M2](knowledge-base/Cns/docs/m2-spine-content-plan.md) · [M3](knowledge-base/Cns/docs/m3-ui-text-input-plan.md) · [M4](knowledge-base/Cns/docs/m4-core-acceptance-plan.md)

## 产品与工程

| 主题 | 文档 |
| --- | --- |
| 产品方向 | [定位](knowledge-base/Cns/docs/设计理念与定位.md) |
| 产品方向 | [需求](knowledge-base/Cns/docs/产品需求说明书.md) |
| 技术架构 | [技术白皮书](knowledge-base/Cns/docs/技术白皮书.md) |
| 技术架构 | [系统架构](knowledge-base/Cns/docs/技术架构.md) |
| 技术架构 | [渲染与运行时](knowledge-base/Cns/docs/渲染引擎与运行时.md) |
| 技术架构 | [产品组成](knowledge-base/Cns/docs/产品组成.md) |
| 工程实施 | [工程规划](knowledge-base/Cns/docs/工程规划.md) |
| 工程实施 | [交付与验收](knowledge-base/Cns/docs/交付计划.md) |
| 工程实施 | [工程结构](knowledge-base/Cns/docs/工程技术架构与项目结构.md) |
| 工程实施 | [API 设计](knowledge-base/Cns/docs/公共API设计与命名规范.md) |
| 创作与兼容 | [AI 与工程接口](knowledge-base/Cns/docs/AI创作与工程接口.md) |
| 创作与兼容 | [Spine 支持](knowledge-base/Cns/docs/Spine动画支持需求与验收.md) |
| 创作与兼容 | [旧工程迁移](knowledge-base/Cns/docs/旧工程迁移.md) |
| 进展与参与 | [能力与进展](knowledge-base/Cns/docs/core-progress.md) |
| 进展与参与 | [变更记录](knowledge-base/Cns/CHANGELOG.md) |
| 进展与参与 | [贡献指南](CONTRIBUTING.zh-CN.md) |
| 资料来源 | [鸣谢](ACKNOWLEDGEMENTS.zh-CN.md) |

## 子系统参考

- [实验性 WebGPU 图像驻留契约](knowledge-base/Cns/docs/gpu-image-residency-contract.md)
- [实验性 WebGPU 图像驻留证据](knowledge-base/Cns/docs/gpu-image-residency-evidence.md)

- [图集导入计划契约](knowledge-base/Cns/docs/atlas-import-plan-contract.md)
- [图集导入计划证据](knowledge-base/Cns/docs/atlas-import-plan-evidence.md)
- [图集导入组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-import-playback/README.md)

- [CPU 场景快照契约](knowledge-base/Cns/docs/3d-cpu-scene-contract.md)
- [CPU 场景实现证据](knowledge-base/Cns/docs/3d-cpu-scene-evidence.md)
- [3D CPU 基础与后续渲染边界](knowledge-base/Cns/docs/3d-foundation.md)
- [固定 WebGPU 网格管线与绘制契约](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md)
- [固定 WebGPU 网格实现证据](knowledge-base/Cns/docs/3d-webgpu-mesh-evidence.md)
- [复现有限的 B1 WebGPU 检查](knowledge-base/Cns/docs/b1-browser-verifier.md)
- [B1 场景主机契约](knowledge-base/Cns/docs/b1-host-contract.md)
- [B1 场景主机验证证据](knowledge-base/Cns/docs/b1-host-evidence.md)
- [Bitmap 区域契约](knowledge-base/Cns/docs/bitmap-region-contract.md)
- [Bitmap 区域：有限 CPU 证据](knowledge-base/Cns/docs/bitmap-region-evidence.md)
- [核心框架实现记录](knowledge-base/Cns/docs/核心框架实现记录.md)
- [显示与帧执行合同](knowledge-base/Cns/docs/显示与帧执行合同.md)
- [显示与帧执行实现计划](knowledge-base/Cns/docs/显示与帧执行实现计划.md)
- [显示与帧执行实现记录](knowledge-base/Cns/docs/显示与帧执行实现记录.md)
- [旧版 MovieClip CPU 转换契约](knowledge-base/Cns/docs/legacy-movieclip-contract.md)
- [旧版 MovieClip CPU 转换证据](knowledge-base/Cns/docs/legacy-movieclip-evidence.md)
- [旧 RES 资源声明分析](knowledge-base/Cns/docs/legacy-res-declarations.md)
- [旧版 RES 转换意图契约](knowledge-base/Cns/docs/legacy-res-plan-contract.md)
- [旧版 RES 规划器 CPU 验证证据](knowledge-base/Cns/docs/legacy-res-plan-evidence.md)
- [工程事务核心合同](knowledge-base/Cns/docs/工程事务核心合同.md)
- [工程事务核心实现证据](knowledge-base/Cns/docs/工程事务核心实现证据.md)
- [资源核心合同：CPU获取与租约](knowledge-base/Cns/docs/资源核心合同.md)
- [资源核心实现记录](knowledge-base/Cns/docs/资源核心实现记录.md)
- [序列帧 CPU 核心契约](knowledge-base/Cns/docs/sequence-clip-contract.md)
- [序列帧 CPU 核心验证证据](knowledge-base/Cns/docs/sequence-clip-evidence.md)
- [纹理首四项采集：证据边界](knowledge-base/Cns/docs/texture-first-four-evidence.md)
- [WebGPU 矩形执行合同——修订 0.6](knowledge-base/Cns/docs/WebGPU矩形执行合同.md)
- [WebGPU 矩形实现证据——修订 0.6](knowledge-base/Cns/docs/WebGPU矩形实现证据.md)
- [WebGPU 矩形实施计划——修订 0.6](knowledge-base/Cns/docs/WebGPU矩形实施计划.md)
- [显式时间序列播放器](knowledge-base/Cns/docs/显式时间序列播放器契约.md)
- [显示坐标查询契约](knowledge-base/Cns/docs/显示坐标查询契约.md)
- [显示坐标查询：有界证据](knowledge-base/Cns/docs/显示坐标查询证据.md)
- [显示内容边界——有界契约](knowledge-base/Cns/docs/显示内容边界契约.md)
- [显示内容边界：有界证据](knowledge-base/Cns/docs/显示内容边界证据.md)
- [自有纹理几何与 Mesh2D：有界契约](knowledge-base/Cns/docs/自有纹理几何与Mesh2D契约.md)
- [自有纹理几何与 Mesh2D：CPU 证据](knowledge-base/Cns/docs/自有纹理几何与Mesh2D证据.md)
- [纹理 Profile：CPU 与桌面 GPU 证据](knowledge-base/Cns/docs/纹理Profile的CPU证据与待完成门禁.md)
- [文字栅格 T1：Provider 与资源契约](knowledge-base/Cns/docs/文字栅格T1契约.md)
- [文字栅格 T1：有界实现证据](knowledge-base/Cns/docs/文字栅格T1证据.md)
- [Engine 自有显式游戏时间核心](knowledge-base/Cns/docs/游戏时间核心契约.md)
- [显式游戏时间核心：CPU、类型与源码证据](knowledge-base/Cns/docs/游戏时间核心证据.md)
- [Scope 所有的标量 Tween](knowledge-base/Cns/docs/标量补间契约.md)
- [标量补间证据](knowledge-base/Cns/docs/标量补间证据.md)
- [文字显示 TF1：显式行显示与资源契约](knowledge-base/Cns/docs/文字显示TF1契约.md)
- [文字显示 TF1：限定 CPU 集成证据](knowledge-base/Cns/docs/文字显示TF1证据.md)
- [字节读取器 BR1 契约](knowledge-base/Cns/docs/字节读取器BR1契约.md)
- [字节读取器 BR1 验证范围](knowledge-base/Cns/docs/字节读取器BR1证据.md)
- [显示树扩展性](knowledge-base/Cns/docs/显示树扩展性.md)
- [WC1 Canvas 文字预览](knowledge-base/Cns/docs/Canvas文字WC1.md)
- [自定义矩形显示命中：HT1](knowledge-base/Cns/docs/显示命中HT1.md)
- [显示拾取应用与有界证据](knowledge-base/Cns/docs/显示拾取示例.md)
- [资源批量获取](knowledge-base/Cns/docs/资源批量获取.md)
- [实验性公共场景帧与有序 UI 合成](knowledge-base/Cns/docs/公共3D场景契约.md)
- [主鼠标输入](knowledge-base/Cns/docs/主鼠标输入契约.md)
- [Spine 导入计划契约](knowledge-base/Cns/docs/Spine导入计划契约.md)
- [Spine 导入计划：证据与验收](knowledge-base/Cns/docs/Spine导入计划证据.md)
- [Scope 私有所有权](knowledge-base/Cns/docs/Scope私有所有权.md)
- [纹理场景宿主契约](knowledge-base/Cns/docs/textured-scene-host-contract.md)
- [字节写入器 BW1 契约](knowledge-base/Cns/docs/字节写入器BW1契约.md)
- [字节写入器 BW1 证据](knowledge-base/Cns/docs/字节写入器BW1证据.md)
- [九宫格几何 NS1：实验性契约](knowledge-base/Cns/docs/九宫格几何NS1契约.md)
- [九宫格几何 NS1 实际证据](knowledge-base/Cns/docs/九宫格几何NS1证据.md)
- [Spine 网格源规划契约](knowledge-base/Cns/docs/Spine网格源规划契约.md)
- [Spine 网格源规划：F2-A 证据](knowledge-base/Cns/docs/Spine网格源规划证据.md)
- [Spine 线性动画源规格契约](knowledge-base/Cns/docs/Spine线性动画源规格契约.md)
- [Spine 线性动画源规格证据](knowledge-base/Cns/docs/Spine线性动画源规格证据.md)
- [时钟驱动序列动画](knowledge-base/Cns/docs/时钟驱动序列动画契约.md)
- [Sequence playback verification / 时钟驱动序列动画核验](knowledge-base/Cns/docs/时钟驱动序列动画证据.md)
- [命名图集契约 — SS1](knowledge-base/Cns/docs/命名图集契约.md)
- [命名图集核验证据 — SS1](knowledge-base/Cns/docs/命名图集证据.md)
- [仓库路径身份与换行规范](knowledge-base/Cns/docs/仓库路径身份与换行规范.md)
- [仓库路径与换行验证记录 — 0.45.1](knowledge-base/Cns/docs/仓库路径与换行验证记录.md)
- [浏览器 PNG 纹理 Provider 契约 — BIP1](knowledge-base/Cns/docs/浏览器PNG纹理Provider契约.md)
- [浏览器 PNG 实施与验证计划 — BIP1](knowledge-base/Cns/docs/浏览器PNG实施计划.md)
- [浏览器 PNG 原生验证计划](knowledge-base/Cns/docs/浏览器PNG原生验证计划.md)
- [浏览器 PNG 证据与剩余验收 — BIP1](knowledge-base/Cns/docs/浏览器PNG验证证据.md)
- [Spine Core 手动网格桥接](knowledge-base/Cns/docs/SpineCore手动网格桥接.md)
- [Spine Core 手动桥接验证](knowledge-base/Cns/docs/SpineCore手动网格桥接证据.md)
- [NineSliceBitmap 契约](knowledge-base/Cns/docs/九宫格位图契约.md)
- [NineSliceBitmap 验证](knowledge-base/Cns/docs/九宫格位图证据.md)
- [NineSliceBitmap 原生核验器](knowledge-base/Cns/docs/九宫格位图原生核验指南.md)
- [显示容器批量分离契约](knowledge-base/Cns/docs/容器清空子节点契约.md)
- [批量分离验证](knowledge-base/Cns/docs/容器清空子节点证据.md)
- [批量分离原生核验安排](knowledge-base/Cns/docs/容器清空子节点原生核验指南.md)
- [直接子节点索引契约](knowledge-base/Cns/docs/容器子节点索引契约.md)
- [直接子节点索引验证](knowledge-base/Cns/docs/容器子节点索引证据.md)
- [直接子节点索引工程计划与待验证项](knowledge-base/Cns/docs/容器子节点索引工程计划.md)
- [容器按索引插入契约](knowledge-base/Cns/docs/容器按索引插入契约.md)
- [容器按索引插入证据](knowledge-base/Cns/docs/容器按索引插入证据.md)
- [容器按索引插入实现与剩余门禁](knowledge-base/Cns/docs/容器按索引插入工程计划.md)
- [显示锚点偏移](knowledge-base/Cns/docs/显示锚点偏移契约.md)
- [显示锚点偏移 — 证据](knowledge-base/Cns/docs/显示锚点偏移证据.md)
- [显示锚点偏移 — 实施与剩余计划](knowledge-base/Cns/docs/显示锚点偏移工程计划.md)
- [锚点图集播放 — 契约](knowledge-base/Cns/docs/锚点图集播放契约.md)
- [锚点图集播放 — 证据](knowledge-base/Cns/docs/锚点图集播放证据.md)
- [锚点图集播放 — 实施与剩余计划](knowledge-base/Cns/docs/锚点图集播放工程计划.md)
- [位图按钮](knowledge-base/Cns/docs/位图按钮契约.md)
- [位图按钮核验](knowledge-base/Cns/docs/位图按钮核验.md)
- [位图按钮工程计划](knowledge-base/Cns/docs/位图按钮实施计划.md)
- [位图资源槽规格](knowledge-base/Cns/docs/位图资源槽规格.md)
- [位图资源槽核验](knowledge-base/Cns/docs/位图资源槽核验.md)
- [位图资源替换组合示例](examples/bitmap-resource-slot/README.zh-CN.md)

## 来源与维护

[localization.json](localization.json)登记双语阅读文档及当前文件身份，[source-origin.json](source-origin.json)记录实现来源。原始实验证据与上游法律原件共用，解释性文档提供双语版本。文件组织与更新方式见[目录规范](knowledge-base/Cns/docs/documentation-layout.md)和[维护规范](knowledge-base/Cns/docs/知识库维护.md)。

- [Spine content SDK / Spine 内容 SDK](knowledge-base/Cns/docs/spine-content-ingress.md)
