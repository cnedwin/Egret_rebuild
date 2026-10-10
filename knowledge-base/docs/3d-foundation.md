# 3D CPU 基础与后续渲染边界

[English](3d-foundation.en.md) | 简体中文

0.16.0 的 3D 增量先建立可验证的数据与数值契约，再接入 GPU 宿主。当前已接受 B0 数学／投影、B1 CPU 网格和 CPU 打包；场景、角色、特效与复杂 2D UI 的混合 GPU 执行仍待实现和实际验证。这些模块是内部工程基础，不新增公共渲染 API，也不改变 RenderFrame2D。

## 数学与投影

B0 使用自有且冻结的 binary64 元组，矩阵按 column-major 存储并作用于列向量。齐次变换保留原始 w，不隐式做透视除法或裁剪。投影显式选择 zero-to-one／minus-one-to-one 深度及 forward／reverse 方向，避免把不同后端约定隐藏进矩阵调用。有限输入和结果由 CPU 契约检查；binary64 的测试不能证明 float32 着色器精度。

## 网格所有权和准入

B1 网格包含 positions、colors、indices、vertexCount、indexCount 和 logicalBytes。输入为普通数组；坐标是有限 binary64，RGB 位于 [0,1]，索引是范围内的安全整数，三角形索引数为 3 的倍数。空网格同时为空；非空网格至少有 3 个顶点和 3 个索引。每个数值的 -0 规范化为 +0。

顶点上限 65536，索引上限 196608，逻辑字节预算为 8*(6*V+I) ≤ 4194304。数量与完整预算在负载分配及索引读取前检查。工厂依次捕获自有位置、颜色、索引，再验证并冻结自有数组和 wrapper；它不保留调用者存储，也不执行调用者迭代器。内部 WeakMap 身份登记只在最终成功后产生，类型标注、相同字段和代理无法获得真实网格身份。

错误来源区分 validation、budget、source 和 native，并保存原始 cause。恢复依赖错误对象仍能被构造／登记，不保证永久污染的内建函数或真实 OOM 能恢复。这些数量与字节是逻辑准入，不能解释为 JS 堆、GPU 内存或分配成功保证。

## CPU 打包的刻意有限 profile

打包只接受已认证网格，并在读取字段前认证身份。它先检查数量／字节，再预检全部位置、随后全部颜色，包括未使用顶点，最后分配两份新的 typed-array 存储。当前验证 profile 只接受零或可精确表示的正常 float32 数；不接受舍入、subnormal、溢出或非零变零。范围为 2^-126 到 (2−2^-23)*2^127，符号由原值保留；零保持 +0。这是有限验证 profile，不是完整资产导入策略。

布局为每顶点 24 字节，XYZ 偏移 0、RGB 偏移 12，索引为 Uint32Array。结果的 wrapper 冻结，Float32Array／Uint32Array 与 backing buffers 是新鲜、自有、可变的可信上传数据；它们不是深度冻结对象或 GPU 资源。每次调用都产生新存储，修改结果不会修改 CPU 网格。

打包保存证据为 43 项专项、794 项完整通过；几何为 21／752，B0 为 121／731。B0 曾有 119 通过、2 失败的 fixture 记录，修正后才接受。原 P01 oracle 提供数值和数量，完整 IEEE word／byte 预期数组由独立实现者编写。little-endian fixture 不证明所有 native 平台端序；不存在能绕过身份认证的超预算真实网格 fixture 声明。准确历史对象与当前具名源码身份见[CPU 证据摘要](../evidence/3d-cpu-source-verification.json)。文档整理未重跑产品测试，以上历史集合不能相加。

## GPU 设计依据与待验证选择

选定的[GPUWeb 草案源文件](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs)固定到 commit 25a5dc4537074c9b3844dd95891f5cfd193f4407。研究阅读九个语义区间，覆盖坐标、索引／顶点布局、depth 与 render-pass／提交语义；完整字节 digest 仅建立身份，不表示全规范语义阅读。该快照不是“最新最终标准”或设备支持证明。选定的安装 TypeScript 7.0.2 DOM 声明仅提供类型证据；只读文件有 6 个 hard links，不代表独占所有权或 native 行为验证。

B1 受限场景候选选择 reversed zero-to-one、depth32float、clear 0、greater／write、cull none 与 CCW。场景 pass clear，随后有序 2D UI pass load／store 且无 depth，使用一个 encoder／submit，readback 位于选定的两个 pass 后。这些是白鹭的架构选择；尤其无 depth UI 和上述 readback 顺序不是 WebGPU 的普遍要求。它们尚不是实现验收，不能据此承诺边缘像素包含规则、跨设备精度或性能。

下一阶段需要明确宿主端口、MVP 的 float32 准入、资源 ledger、fence／readback／销毁与错误来源，再用模拟和实际 GPU 反例分别验证。材质、透明排序、蒙皮／动画、3D 角色特效、字体与复杂 UI 的真实预算、手机、Native SDK 和性能比较保持开放。标准机制与成熟社区经验提供设计依据；当前没有在同条件实验中证明竞品性能优势。

[核心进展](core-progress.md) · [渲染与运行时方向](渲染引擎与运行时.md) · [知识库入口](../README.md)
