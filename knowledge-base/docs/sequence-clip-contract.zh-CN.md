# 序列帧 CPU 核心契约

[English](sequence-clip-contract.en.md) · [验证证据](sequence-clip-evidence.zh-CN.md)

白鹭自主实现的`packages/runtime/src/sequenceClip.ts` 把图集区域和帧时长转为不可变时间数据，再按调用者提供的秒数采样帧。它是内部 CPU 组件，不是播放器、纹理加载器或渲染器；函数和类型尚未由 runtime 包入口集中导出。

完整图像图集可用调用者秒数采样，并通过[已实施 Bitmap 区域成员](bitmap-region-contract.zh-CN.md)和同一借用租约应用选区。采样仍为内部组件，与赋值分别执行，不新增时钟／播放器。其有限 CPU 证据不验证可见播放，也不把较早采样器／整仓记录转为新的渲染结果。

```ts
createSequenceClip(input: unknown): SequenceClip
sampleSequenceClip(clip: SequenceClip, elapsedSeconds: number,
  options: { readonly mode: 'once' | 'loop'; readonly stopAtSeconds?: number }
): SequenceSample
```

## 构造

输入须自有 `atlasWidth`、`atlasHeight` 和包含 1–1024 条记录的稠密 `frames` 数组。每帧须自有 `x`、`y`、`width`、`height`、`durationSeconds`。图集尺寸和区域大小是正安全整数，坐标是非负安全整数；区域边界须在安全整数范围内，并落在独立声明的图集尺寸内。

自有字段按固定顺序捕获，再解释其值：先图集尺寸和帧数组，再逐项捕获数组元素及五个帧字段。源读取故障转为 `SEQ_READ_FAILED`，保留准确原始 `cause`，包括 `undefined`；语义错误使用 `SEQ_INPUT_INVALID`、`SEQ_BUDGET`、`SEQ_REGION_INVALID` 或 `SEQ_TIME_INVALID`。首个无效帧会终止验证，不读取后续帧。

时长采用 JavaScript 二进制 64 位浮点秒数，包括正次正规数。按输入顺序累加的结束时间必须有限，且舍入后严格递增；溢出或被舍入吸收的增量均拒绝。不转换为 32 位浮点数或整数时间刻度。

构造返回冻结元数据，准确包含 `atlasWidth`、`atlasHeight`、`frameCount`、`durationSeconds` 四项。自有区域和时间数组冻结，调用者记录不被保留或冻结。只有全部准备成功后，才在模块私有 WeakMap 中登记片段真实身份。副本和代理对象会先被判为 `SEQ_CLIP_INVALID`，不读取其字段、时间或选项。

## 采样

即使提供 `stopAtSeconds`，经过秒数也必须有限且非负。采样先捕获自有 `mode` 和可选停止字段，再解释值。显式有效停止时间替代经过时间；缺失或为 `undefined` 的停止字段不表示停止。

`once` 在总时长处截断，返回最后一帧并置 `atEnd: true`。`loop` 使用二进制 64 位浮点余数 `%`，不逐周期累积时间，且保持 `atEnd: false`。帧边界选择下一帧：查找首个严格大于当前位置的累积结束时间。1024 帧时二分查找最多比较十一轮。负零统一为正零。

每次调用返回新的冻结采样对象，包含 `frameIndex`、自有冻结 `region`、`positionSeconds`、`atEnd`、`stopped`；重复采样可复用同一个自有区域。这一核心不推进时钟、不派发事件、不加载资源、不修改渲染状态。所选组合源码已通过整仓验证：901/901项测试以及编译、边界、类型门禁。播放集成、真实图集资源和动画画面仍需另行验证，整仓结果不证明这些能力。配对证据保留此前未通过的整仓尝试。
