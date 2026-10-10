# CPU 场景快照契约

[English](../../en/docs/3d-cpu-scene-contract.md) | 简体中文

白鹭的 CPU 场景快照把投影和有序网格绘制转换为自有、不可变的 `SceneFrame3D`。每次绘制保留真实 CPU 几何身份和独立 `mvp`；按首次出现顺序排列的几何清单，使共享资源的记账可以检查。这是内部引擎接口，历史源码验收见[实现证据](3d-cpu-scene-evidence.md)。

历史文档候选版本 0.1。公开发布继续 **HELD**。已接受范围是 CPU 快照行为；GPU 宿主整合、原生着色器/设备/像素精度及性能继续 **HELD**。

## 输入与投影

`createSceneFrame3D(input)` 要求自有 `projection` 和 `draws` 字段。投影为非数组对象，具有自有 `kind`、`left`、`right`、`bottom`、`top`、`near`、`far`；kind 为 `perspective` 或 `orthographic`。`draws` 为数组，长度须是获准的安全整数，索引项须自有。每个绘制项为非数组对象，具有自有 `geometry` 和 `modelView`。几何必须已是具有真实身份的 `MeshGeometry3D`；相同字段、副本和代理不能取得该身份。

模型矩阵通过既有 CPU 矩阵工厂捕获。场景建立**反向 zero-to-one** 投影，以列主序矩阵和列向量计算 `mvp = projection × modelView`。最终 MVP 将有符号零规范化为 +0。快照保留齐次几何和原始裁剪坐标 w：保留零/负 w 及穿越近裁剪面的几何；此工厂不做透视除法、可见性判定或裁剪。

必要字段的捕获不执行调用者迭代，也不以继承字段代替自有字段。长度/数量拒绝早于负载临时存储及绘制索引读取。获准的投影字段和绘制索引项先完成捕获，再处理延后的缺失/值检查；绘制项形状拒绝会停止后续负载读取。每次模型捕获在下一模型调用及投影 kind 语义之前完成。这些是局部顺序规则，不是所有后续读取故障都优先于所有先前失败的普遍定理。

## 所有权与身份

每次成功调用都产生新鲜且冻结的帧、绘制数组、首次出现几何数组、绘制包装对象和 MVP 元组。只有先前自有且不可变的几何按身份共享。工厂不保留调用者的投影/绘制/模型存储。空绘制仍验证投影，并返回新鲜且冻结的空数组和零记账值。

`isSceneFrame3D(value)` 通过内部身份登记认证准确发布的帧，不检查外来字段。帧的展开副本或代理不具有真实身份。登记发生在最后；构造失败不发布帧。

## 逻辑准入预算

设 N 为绘制数，V、I 为每个不同几何身份的顶点/索引数。

| 数量 | 记账方式 | 上限 |
|---|---|---:|
| 绘制项 | N | 64 |
| 不同几何 | 按首次出现的身份数 | 64 |
| `cpuLogicalBytes` | 每个身份计一次 `8*(6*V+I)`，再求和 | 8388608 |
| `sceneBytes` | 每个身份计一次 `24*V+4*I`，再求和 | 4194304 |
| `uniformBytes` | `64*N`，包含空几何绘制项 | 4096 |

记账值必须是安全整数。同一几何身份重复绘制只计一次几何费用，每次绘制另计 64 字节 MVP；值相同但身份不同的几何分别记账。身份记账早于该身份的负载数值检查。这些是逻辑数值/负载准入限制，不是 JS 堆/GPU 驻留实测或分配成功保证。工厂不分配 GPU 资源。

## 数值范围与失败

每个几何坐标、颜色及最终 MVP 系数必须为零或可精确表示的正常 float32：绝对值从 `1.1754943508222875e-38` 到 `3.4028234663852886e38`，且 `Math.fround(value) === value`。不支持需舍入的值和次正规数。未被索引使用的顶点仍需检查。模型输入为 binary64；此数值范围限制最终 MVP，而非每个中间模型系数。

对每个顶点和 MVP 行，工厂计算四项 binary64 乘积的绝对值，再按固定顺序 `((p0+p1)+p2)+p3` 求和；每个中间结果须有限，总和最多为 `1.329227995784916e36`。这个受限运算余量规则不是向外舍入的界，也不证明着色器精度或可见性。

| 错误码 | 登记来源 |
|---|---|
| `SCENE3D_INPUT_INVALID` | `validation` |
| `SCENE3D_INPUT_READ_FAILED` | `source` |
| `SCENE3D_BUDGET` | `budget` |
| `SCENE3D_PRECISION_UNSUPPORTED` | `validation` |
| `SCENE3D_ARITHMETIC_RANGE` | `validation` |
| `SCENE3D_NATIVE_FAILED` | `native` |

`getScene3DErrorOrigin` 识别登记过的错误，不采信调用者的类/错误码或错误形状对象。读取来源失败将原始抛出值保留为 cause。可信 CPU 数学调用失败保留包装错误和嵌套 cause。此处 `native` 指自有 JavaScript/内建操作失败，不表示原生图形已验证。恢复依赖错误构造/登记仍可完成；真实 OOM 或永久污染内建函数的普遍恢复仍未证明。

## 共享几何示例

这个内部接口示例使用已具有真实身份、满足上述数值及运算余量范围的三顶点、三索引几何。文档准备时未执行示例。

```ts
const modelView = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-1,1];
const frame = createSceneFrame3D({
  projection: {kind: 'orthographic', left: -1, right: 1,
    bottom: -1, top: 1, near: 0, far: 1},
  draws: [{geometry, modelView}, {geometry, modelView}],
});
// One geometry identity, two independently owned MVPs:
// cpuLogicalBytes = 168; sceneBytes = 84; uniformBytes = 128.
```

投影约定致谢先前选定的 [GPUWeb 草案源文件](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs)。[基础说明](3d-foundation.md)限定历史九个区间的阅读和仅类型证据。该草案引用提供设计语境，不是新增上游评审、最新标准声明或设备支持结果。

## 0.17.0 后继范围

上文 HELD 保留原 CPU／网格文档检查点。后续 B1 宿主源码／模拟整合通过默认 13 项调度与所选整仓 901/901 验证；见[宿主契约](b1-host-contract.md)、[宿主证据](b1-host-evidence.md)及[本地证据索引](../../evidence/b1-host-mock-evidence.json)。这些结果与早期总数重叠，不能相加。验证时宿主测试为 85984 字节；85983 字节后继仅删除最后一个 LF，没有重跑。GitHub 发布仍待完成。Native SDK、真实浏览器／设备着色器与像素、实体精度及性能仍未验证。这些辅助函数保持内部接口。
