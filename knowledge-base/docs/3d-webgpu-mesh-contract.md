# 固定 WebGPU 网格管线与绘制契约

[English](3d-webgpu-mesh-contract.en.md) | 简体中文

白鹭的固定网格辅助函数表达一个小而可检查的 GPU 接口：一种坐标/RGB 顶点布局、一个列主序 MVP uniform，以及使用调用者所给资源的有序索引绘制。`createWebGPUMeshPipeline` 经捕获的回调传入固定着色器/描述器文本；`encodeWebGPUMesh` 在所给 pass 中记录状态及绘制。[实现证据](3d-webgpu-mesh-evidence.md)区分已接受源码/模拟行为与原生执行。

历史文档候选版本 0.1。公开发布、场景/UI 宿主整合、原生 WGSL/设备/像素及性能继续 **HELD**。这些内部辅助函数不新增公开包入口，也不发布宿主实现。

## 固定着色器与资源 ABI

着色器在 `@group(0) @binding(0)` 定义一个 `MeshUniform.mvp: mat4x4<f32>`：64 字节列主序 MVP。顶点坐标为 location 0 的 `vec3<f32>`；颜色为 location 1 的 `vec3<f32>`。着色器计算 `draw.mvp * vec4<f32>(position, 1.0)`，保留原始裁剪坐标 w，不转置、做透视除法或反转 Y。它将 RGB 原样传给插值变量，返回 `vec4<f32>(input.rgb, 1.0)`。没有显式伽马转换、预乘、纹理访问、discard 或 flat 插值标注。这是编写出的源码行为，不是原生着色器验证或像素证据。

| 描述器部分 | 固定选择 |
|---|---|
| 布局 | `auto` |
| 顶点入口 | `vertexMain`；stride 24；stepMode `vertex` |
| 坐标 | location 0，offset 0，`float32x3` |
| RGB | location 1，offset 12，`float32x3` |
| 片元入口/目标 | `fragmentMain`；所给 format；writeMask 15；无 blend 字段 |
| 图元 | `triangle-list`；frontFace `ccw`；cullMode `none`；unclippedDepth false |
| 深度 | `depth32float`；depthWriteEnabled true；depthCompare `greater` |
| 深度偏移 | depthBias 0；depthBiasSlopeScale 0；depthBiasClamp 0 |
| 多重采样 | count 1；alphaToCoverageEnabled false |

类型参数 format 为 `rgba8unorm` 或 `bgra8unorm`。辅助函数将该值传入描述器；运行时参数准入与原生格式支持仍由调用者/原生验证承担。它不加入条带索引或 stencil 字段。匹配反向 zero-to-one 的宿主需提供 clear depth 0；此辅助函数不创建 render pass，也不建立清除或合成行为。分配、绑定对齐/限制、上传及真实场景/几何准入属于宿主边界。

## 回调与 Promise 身份

`createWebGPUMeshPipeline(shader, pipeline, format)` 先以 `{code: MESH_SHADER}` 调用 shader 一次，再以固定描述器调用 pipeline 一次。准确的同一着色器模块对象用于两个阶段。辅助函数返回 pipeline 回调的**原 Promise**，不加 async 包装、缓存或替换完成结果。

shader 回调同步失败会阻止 pipeline 调用。pipeline 回调同步失败仍同步传播。返回 Promise 的拒绝保留原值。调用者负责捕获操作、错误作用域/门禁及立即观察完成结果；接受辅助函数不表示这些宿主行为已经建立。

## 编码顺序与所有权

`indexCount === 0` 时，编码直接返回，不读取任何 pass 属性。每个非零调用都按下列准确顺序使用所给资源对象：

| 顺序 | 调用 |
|---:|---|
| 1 | `setPipeline(pipeline)` |
| 2 | `setViewport(0, 0, width, height, 0, 1)` |
| 3 | `setScissorRect(0, 0, width, height)` |
| 4 | `setVertexBuffer(0, vertices)` |
| 5 | `setIndexBuffer(indices, 'uint32')` |
| 6 | `setBindGroup(0, bindings)` |
| 7 | `drawIndexed(indexCount, 1, 0, 0, 0)` |

pass 方法接收真实 pass 作为调用接收者。失败使轨迹停在该调用，并传播准确原始抛出值。重复绘制保留每次所给绑定身份及顺序。编码器不验证数量/尺寸/资源，不分配或上传，不开始/结束 pass，不完成/提交 encoder，不建立错误作用域、观察 fence 或退役资源。这些职责仍由宿主承担。

## 所给资源调用示例

```ts
encodeWebGPUMesh(pass, pipeline, vertices, indices, bindings, 3, 20, 12);
// Indexed triangle draw, one instance, full 20-by-12 viewport/scissor.
```

此示例描述所给 pass 的调用轨迹，文档准备时未执行。它假定资源已适当获准，不证明分配、缓冲区边界、真实设备输出或已整合场景 pass。

[CPU 场景契约](3d-cpu-scene-contract.md)提供独立的快照/数值范围契约。白鹭独立编写这些接口及固定源码样例，致谢先前选定的 [GPUWeb 草案源文件](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs)，作为坐标/布局/深度/render-pass 约定依据。[基础说明](3d-foundation.md)保留历史九个区间阅读和仅类型证据的限定；此处不宣称新增上游评审、最新标准或设备支持。

## 0.17.0 后继范围

上文 HELD 保留原 CPU／网格文档检查点。后续 B1 宿主源码／模拟整合通过默认 13 项调度与所选整仓 901/901 验证；见[宿主契约](b1-host-contract.zh-CN.md)、[宿主证据](b1-host-evidence.zh-CN.md)及[本地证据索引](../evidence/b1-host-mock-evidence.json)。这些结果与早期总数重叠，不能相加。验证时宿主测试为 85984 字节；85983 字节后继仅删除最后一个 LF，没有重跑。GitHub 发布仍待完成。Native SDK、真实浏览器／设备着色器与像素、实体精度及性能仍未验证。这些辅助函数保持内部接口。
