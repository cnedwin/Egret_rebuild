# 字节读取器 BR1 契约

[English](../../en/docs/byte-reader-br1-contract.md) | 简体中文

ByteReader 是读取自有二进制数据的小型同步工具。它保留熟悉的白鹭读取方法，明确字节序，并通过只读接口呈现游标，作为资源格式与工程工具的基础组件。

截至 2026-10-11，实现已通过隔离编译、23 项行为测试、严格正向类型检查、逐项核对的 18 个负向类型案例、受控复制输出故障测试及 156 项相关回归。完整集成和发布检查仍待完成。这些结果仅覆盖本工具，不表示新的渲染器、平台适配器或格式导入器已经完成。

## 公开入口与所有权

```ts
import { ByteReader, BYTE_READER_LIMITS } from '@egret/engine';
import type { ByteOrder } from '@egret/engine';

const reader = new ByteReader(new Uint8Array([0x34, 0x12, 0xab]), 'littleEndian');
try {
  console.log(reader.readUnsignedShort()); // 4660
  console.log(reader.readUnsignedByte());  // 171
  console.log(reader.bytesAvailable);      // 0
} finally {
  reader.dispose();
}
```

runtime 根入口导出同一份 ByteReader 和 BYTE_READER_LIMITS。ByteOrder 仅为 `'bigEndian' | 'littleEndian'` 类型联合，不增加运行时值，也不增加包或子路径。

构造参数必须是真实 Uint8Array，其底层为未脱离、固定长度的普通 ArrayBuffer；符合条件的子类与跨 realm view 也支持。共享、可变长度或已脱离的底层、其他 view 类型及 Proxy 仿制对象会被拒绝。只复制 view 选中的字节到紧密自有缓冲。之后修改调用者的数据不影响读取器，读取器也不暴露底层缓冲。

冻结的 `BYTE_READER_LIMITS.maxBytes` 为 16,777,216，限制单个读取器复制的载荷。调用者缓冲与返回副本是独立分配，不属于整个进程内存上限。构造时省略字节序或显式传入 undefined，均默认使用 bigEndian。

## 游标与读取方法

| API | 行为 |
| --- | --- |
| `length`、`position`、`bytesAvailable`、`disposed` | 只读诊断，初始位置为零。 |
| `endian` | 读取或设置后续多字节读取使用的字节序。 |
| `seek(position)` | 设置绝对位置，范围为零至 length，包含两端。 |
| `skip(count)` | 在剩余字节内前进非负数量。 |
| `readByte()`、`readUnsignedByte()` | 读取一个有符号或无符号 8 位整数。 |
| `readShort()`、`readUnsignedShort()` | 读取一个有符号或无符号 16 位整数。 |
| `readInt()`、`readUnsignedInt()` | 读取一个有符号或无符号 32 位整数。 |
| `readFloat()`、`readDouble()` | 按选定字节序读取 IEEE 754 binary32 或 binary64。 |
| `readBytes(count?)` | 返回紧密底层的新普通 Uint8Array 并前进游标。省略 count 时读取全部剩余字节；零也返回新的空副本。 |
| `dispose()` | 同步释放自有数据引用，重复释放无副作用。 |

位置与数量必须为非负安全整数；负零规范化为零，不对字符串或其他对象进行数值强制转换。支持未对齐的标量读取。浮点测试覆盖有限值、正负零、无穷及 NaN 分类，NaN 载荷位不属于公开契约。

读取成功时，解释或复制完成后才提交新位置。输入非法、字节不足及输出分配或复制突然失败时，游标和存储数据均保持不变。返回副本互不共享底层，也不共享读取器的存储。

## 错误与生命周期

接收者非法、源类型不支持、字节序非法或已释放后的操作抛 TypeError。非法数值位置/数量、越界移动、字节不足及载荷超过上限抛 RangeError。构造先检查源，再检查字节序；源合法时，字节序检查早于容量检查。分配或复制中的原始异常保持同一身份向外传播。

释放后，length、position、bytesAvailable 为零，disposed 为 true，保留最后使用的字节序诊断。继续读取、移动或修改字节序会被拒绝。ByteReader 符合现有可释放对象形状，可注册到既有 Scope，不增加所有权 API。

本包不增加文字编码、二进制写入、流式读取或旧 ByteArray 兼容保证。包括 Spine 二进制解码在内的格式支持，需另行提供格式规格、测试资源和集成验证。

## 验证与来源

实现与测试由不同作者独立编写，均为仓库 Apache-2.0 许可证下的第一方代码。行为测试通过公开引擎入口核对字面二进制期望；负向类型案例不使用错误抑制，逐文件、行号和编译器代码核对。受控 CPU 故障在新进程中到达真实捕获的分配与复制调用，随后恢复环境内建对象，并完整核对恢复后的剩余数据。这证明已测试异常路径，不代表物理内存耗尽后的恢复能力。

集成须保留既有 DOM-free 核心和精确导出边界；仅 runtime 与 engine 根入口增加两个值和一个擦除后的类型，其他入口保留既有表面。发布前，最终选定源码仍须通过完整检查工具、既有回归套件和双语发布门禁。
