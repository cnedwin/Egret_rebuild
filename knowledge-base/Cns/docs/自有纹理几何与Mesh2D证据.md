# 自有纹理几何与 Mesh2D：CPU 证据

[English](../../en/docs/textured-geometry-and-mesh2d-evidence.md) | 简体中文 · [契约](自有纹理几何与Mesh2D契约.md) · [Profile CPU 证据](纹理Profile的CPU证据与待完成门禁.md)

工程检查点 **0.23.0**，整理于 2026-10-11。自有纹理几何、Mesh2D、不可变 profile 帧及显式 WebGPU 宿主已有有界 CPU、严格类型和桌面原生证据。原生运行的 11 个 calibration 与 10 个 held-out 窗口通过，16 个指定对照窗口全部检出了 12 项独立副本故障。独立保存结果审阅验收了此次记录的 Windows／Edge／NVIDIA 单一环境。公开复现工具、最终双语材料审阅、当前完整推送前检查和远端交付分别记录，本文不从原生 PASS 推断这些结论。

## 已验收的 CPU 范围

几何工厂拥有独立、冻结、稠密的数字数组，验证所有输入分量，包括未引用顶点；只有全部完成后，私有注册才授予身份。修改输入 buffer 不改变完成后的值。逻辑字节是准入单位，不是真实堆或 GPU 内存测量。

Mesh2D 借用调用者的精确 lease。原子替换保留 Engine 归属，失败时原内容不变；clear 与 dispose 丢弃缓存内容，不 release 该借用。边界在引用索引读取前收取 authored triangle，并保留引用点、线、共线内容，不因 visibility、alpha 或 clips 而抑制。私有所有权、收费顺序及公共回调无法到达的 guard 由源码评审覆盖；夹具不伪造私有状态损坏或无法到达的重入。

| 检查 | 实际结果 | 证据边界 |
| --- | --- | --- |
| 几何行为 | 10/10 通过 | 包含稠密自有属性修复；单独评审关闭发现，几何已验收。 |
| 既有 image/frame 回归 | 39/39 通过 | 几何阶段相关回归，存在重叠用例。 |
| Mesh 显示行为 | 6/6 通过 | 真实公共 Engine/AssetManager lease 与字面量几何；实现前有缺失能力 RED。 |
| 直接内容边界 | 78/78 通过 | 修改前有 5/5 语义 RED；检查直接引用点算术与限额优先级。 |
| 旧采集 Mesh 拒绝 | 97/97 通过 | 修改前一项既有跳过用例通过、三项缺失拒绝/顺序用例失败。 |
| Mesh 阶段策略控制 | 36/36 通过 | 有效基线与四项 value/type 泄漏控制，在 checker 采用前到达真实缺失 guard RED。 |
| Mesh 阶段架构扫描 | 315 文件通过 | 精确 facade、声明图与私有权威边界。 |
| Mesh 阶段严格 root 消费者 | 核验 110 项负向诊断 | 包含 16 项几何与 13 项 Mesh，分别匹配实际生成文件、行号、代码；positive/DOM-free 通过。 |
| 其他严格消费者 | 核验 5 项 web 与 28 项 project 诊断 | Web-positive 通过；project 分别定位。 |
| CPU 独立评审 | 有限制地通过 | 几何与 Mesh 验收限于上述 CPU 范围。 |

这些是几何/Mesh 阶段的最终观察，不是后续 helper 总数。后续 profile 与 helper 检查保留这些用例，见 profile 证据。聚焦套件与回归套件有重叠，不累加计数。历史 Mesh 最终 emission 有 296 文件，已验收 profile CPU 构建有 324 文件，Task 1 有 328 文件，Task 2 有 340 文件，Task 3 有 352 文件，Task 4 有 360 文件；各份 inventory 保留自己的构建修订。

## 保留的失败历史

2026-10-10，未修改实现使用 Node v24.19.0 在 09:12:55.011–09:12:55.859 UTC 构建，exit 0。几何试运行发生于 09:13:03.202–09:13:03.426 UTC，exit 1：注册 6 个回调，0 通过、6 失败，无 cancelled/skipped/todo。公共 facade 已导入；每个 G01–G06 回调都在几何夹具分配前，止于共同的缺失 createTexturedGeometry2D 能力断言。这是真实 API 缺失 RED，不是六个已到达的几何反例或导入/初始化失败。历史运行前后 284 文件 emission inventory 稳定。

后续实现曾返回真实且冻结的值，但 Array 继承数字 setter 能吞掉规范写入。语义 RED 先于自有属性修复。初次修复的构建失败与前序评审仍保留；最终成功构建及 10/10 检查关闭这一有限的 density 缺陷。修复不代表一般恶意内建函数防护。

四项 Mesh 类型代码预测根据实际未抑制编译器输出修正：伪造几何 TS2741、未知 lease TS2379、错误资源 TS2379、参数颠倒 TS2739。仅预期代码注释改变；失败观察保留为测试预期历史，没有类型削弱或抑制。另一次私有验证 helper 生成在产品/测试导入前发生语法错误，属于初始化失败，不是 feature RED。

两项隔离算术反例确认契约中的 authored 共线平移舍入及 Float32 NDC 朝向翻转。它们不导入产品，不证明裁剪、产品 packing、shader 或原生像素行为。既有 image-alpha 与渲染观察保留原范围。

## 已记录阶段与待完成工作

Profile 的 package/importer、浏览器映射和选定副本来源控制已完成，精确 CPU 最终采用已验收。选定宿主/类型与最终源码策略实现的单独评审保留各自范围。新受影响桌面浏览器观察与 CPU 检查分开记录；有界结果见配对 Profile 证据。

GPU 计划 Task 1 的私有共享预算与旧准备接点已验收。历史 A01 在真实公共几何与既有矩形准备成功后才到达缺失 ledger 断言。随后实际构建通过，未修改预算夹具 31/31 通过、受影响旧文件 37/37 通过，并完成独立源码/emission 评审；该检查点为 216 项源码/夹具与 328 项 emission。

Task 2 的私有 Mesh CPU 准备、packing 与有序 dispatcher 也已验收。历史 G01 在真实公共几何完成后才到达缺失 helper 断言。实现后新构建通过，未修改合并套件 90/90 通过（31 项预算加 59 项 Mesh），单独受影响旧运行 37/37 通过。独立源码/emission 评审绑定 236 项新 runner 输入及 340 项 emission：原有 328 项均不变，精确新增 12 项。完成的 CPU helper 范围保留 authored-before-affine 抑制、robust rank/represented sign、完整 XY/UV/RGBA 裁剪、共享计费、每 corner 一次表示后转换及空 painter barrier。

Task 3 增加真实身份 metadata 准入、完整索引/clip 预检，以及 Float32/projection 负载分配前的 storage 规划。第一方逐次调用故障权威保留精确分配/转换原因，不凭调用者抛出的外来类身份单独分类。准入 upload 上界、device/dimension/readback 检查及确定限额优先级属于 CPU/源码证据；实际 GPU 分配与预留由后续受控宿主执行检查。

Task 4 实现 createTexturedWebGPUHost、四个 readonly 可选数值扩展、自有不可变 profile 标识及同步新端口。rectangle、Bitmap、Mesh 共用既有 startup、有序提交、fence、quarantine 与 cleanup 所有者。受控夹具检查 32 字节 XY/UV/light-RGBA ABI、逐 draw layout、crop 共享、pending geometry 准入及精确一次退休。这些设备边界 descriptor 与寿命计数不验证原生 WGSL 编译或渲染像素。

Task 3 随后通过 155/155 项合并 CPU 用例（31 项预算、59 项 Mesh、65 项准入），另有单独 94/94 项 projection/image-host 与 37/37 项旧几何运行；该阶段为 241 项选定输入与 352 项 emission。Task 4 通过 30/30 项公共受控宿主、14/14 项 profile/旧端口、新运行 155/155 项 helper，以及 146/146 项受影响旧 GPU 检查，含全部 13 项 B1 场景；其修正后构建具有 360 项 emission。这些历史结果覆盖有界源码／受控行为；后续固定桌面原生用例分别记录。既有 Canvas、矩形 WebGPU 与独立 3D 证据保留原范围。

Task 6 通过严格 positive 消费者，核验 19 项单独定位且未抑制的新诊断，33/33 项新策略及 299/299 项保留策略用例通过。源码扫描在所记录的 363 文件边界通过；后续 native-only 新增文件保留单独来源范围。固定比较器在预期与 tolerance 不变的条件下，208/208 项 CPU 单元检查通过。构造字节数组与 metadata 检查建立比较器行为证据，不验证原生 shader 编译、像素或复制产品灵敏度。

固定桌面 Mesh2D 像素已在所记录范围验收。Spine 播放、完整 A2/3D/UI/fonts、实体手机、电耗/性能、生产宿主及完整旧工程迁移仍未验收。配对公开材料、最终源码来源与关键英文注释、独立评审、新推送前检查、实际远程交付保持为单独门禁。

## 来源与许可

本摘要整理第一方规格、保留的执行回执与限定独立评审。实现及文档准备采用 AI 辅助。几何明确复用第一方 ImageData2D 内建准入模式；资源、边界、帧与宿主机制在各自已评审范围内复用。这是有限的过程证据，不是全球原创性或训练来源认证。

第一方代码与文档保留 [Apache-2.0](https://github.com/cnedwin/Egret_rebuild/blob/main/LICENSE)，中文许可证文本仅供阅读。既有 robust-predicates 3.0.3 公共入口朝向依赖保留其 [Unlicense 声明](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)。本 CPU 阶段没有引入新依赖或复制上游引擎实现；依赖声明与无关研究资产权限保留各自范围。
