# Bitmap 区域：有限 CPU 证据

[English](bitmap-region-evidence.en.md) · [区域契约](bitmap-region-contract.zh-CN.md) · [精简记录](../evidence/bitmap-region-cpu.json)

首方 `Bitmap.sourceRect` 实现通过既有构建、**113/113 项专项 CPU 检查**及选定类型检查。对三个变化源码和保存 CPU 观察的独立审阅记录 **PASS_SOURCE_AND_SAVED_CPU_EVIDENCE**，在该范围未发现可行动的 P1/P2 问题。这是本地 **0.19.0** 工程增量，包 **0.0.0** 与协议 **1.0** 不变。

## 实际检查

构建以零退出，工程格式检查覆盖 **21 个定义**。专项运行使用 Node.js **v24.19.0** 和 `--test-isolation=none`，113 项通过，失败、取消、跳过、todo 均为零。测试组合包括 `tests/bitmap-region.test.mjs` 的 B01–B23，以及既有纹理、保存帧、整合、类型形状、判定器和 CPU 序列帧测试。

类型命令以零退出，接纳正例夹具，并核对 **76 项预期负诊断**：**43 项核心 + 5 项 web + 28 项 project**。新成员反例分别产生字符串宽度的 TS2322、null 复位的 TS2322、给只读 x 赋值的 TS2540。预期负诊断是成功拒绝证据，不是编译器缺陷。

这些观察覆盖绝对裁剪包含、不可变自有元数据、租约／裁剪共用修改保护、读取／错误顺序、复位和同租约替换、保存裁剪捕获、预算计数与所有权。完整图集的 CPU 采样可选择裁剪，无需每次采样取得或释放资产；这不建立可见动画输出。

## 保留 RED 历史

实施前，固定选区测试登记 **23 组失败**。B01 到达真实捕获差异：请求 x=2／width=1，却捕获原视图 x=0／width=6。缺少 setter 和清理后果**不能**建立 23 个独立到达的行为反例。正例类型夹具另产生 **3 项 TS2339** 缺失成员诊断。两类失败均在通过的后继之前保留。

## 绑定的源码身份

| 源码 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `packages/runtime/src/Bitmap.ts` | 7397 | `21b209ee6809e8645e2920b3680eac0eb91f481edf9ad07f961b638624ebfffe` |
| `packages/runtime/src/frameCapture.ts` | 5066 | `23ebe914a57f165ecd210fa31d28ae4681508b684ec68895d3bbfb58a81f9fa1` |
| `packages/runtime/src/imageFrameBudget.ts` | 1968 | `591700c47a2ec78a5a2e11b9b380386e6d79fd0bc09a5d37c0a637bbc4d5b19e` |

捕获将保存裁剪改为经过认证的 Bitmap 选区；runtime 图像预算算法不变，仅更新权威说明注释。保存命令拥有裁剪与不可变图像值，Bitmap 保留借用租约。源码审阅、保存 CPU 执行与浏览器像素属于不同证据类别；文档整合没有复跑检查。

本证据整理不包含后继完整 prepush，推送前必须另行通过新检查；本检查点的可见选区序列浏览器验证仍为 **UNRUN**。此前纹理采集与有限 B1 浏览器结果保留自身用例／源码范围，均不证明 Bitmap 动画序列。时钟／播放器、解码器、骨骼、Native SDK、手机／性能、完整 A2 或完整迁移均未验收；R008/V006 与 V003 保留更大范围义务。
