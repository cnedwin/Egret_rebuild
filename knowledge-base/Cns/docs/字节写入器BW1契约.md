# 字节写入器 BW1 契约

[English](../../en/docs/byte-writer-bw1-contract.md) | 简体中文

ByteWriter 为资源工具和游戏基础设施提供固定容量的二进制写入能力。它保留白鹭开发者熟悉的方法命名，并共用 ByteReader 的字节序类型。BW1 是工具类路线中的工程选择，不实现文件格式或旧 ByteArray 兼容层。

## 公开使用

```ts
import { ByteWriter, ByteReader } from '@egret/engine';
import type { ByteOrder } from '@egret/engine';

const order: ByteOrder = 'littleEndian';
const writer = new ByteWriter(3, order);
try {
  writer.writeUnsignedShort(4660);
  writer.writeUnsignedByte(171);
  const bytes = writer.toUint8Array(); // [0x34, 0x12, 0xab]
  const reader = new ByteReader(bytes, order);
  try {
    console.log(reader.readUnsignedShort()); // 4660
  } finally {
    reader.dispose();
  }
} finally {
  writer.dispose();
}
```

runtime 根入口提供同一个 `ByteWriter` 构造器和冻结的 `BYTE_WRITER_LIMITS` 对象。`ByteOrder` 继续采用原有的纯类型联合 `'bigEndian' | 'littleEndian'`。可选浏览器、文本、输入和场景入口不新增写入器导出。不增加包、依赖或公开子路径；核心不依赖 DOM 和 Node API。

容量是必填的非负安全整数，负零归一化为零。不支持的数值抛出 RangeError，非数值输入抛出 TypeError，不做类型强制转换。先检查容量数值域，再检查字节序，之后检查 **16,777,216 字节**上限并分配自有存储。构造器省略字节序或显式传入 undefined 时，选择 bigEndian。上限只约束单个写入器的数据，不是进程总内存或快照预算。

## 追加与所有权

| API | 含义 |
| --- | --- |
| `capacity`、`length`、`remainingCapacity`、`disposed` | 只读诊断；长度从零开始。 |
| `endian` | 读取或改变后续多字节写入的字节序。 |
| `writeByte`、`writeUnsignedByte` | 追加有符号或无符号 8 位整数。 |
| `writeShort`、`writeUnsignedShort` | 追加有符号或无符号 16 位整数。 |
| `writeInt`、`writeUnsignedInt` | 追加有符号或无符号 32 位整数。 |
| `writeFloat`、`writeDouble` | 按原生 IEEE binary32 或 binary64 转换追加原始 number。 |
| `writeBytes(source)` | 追加真实 Uint8Array 选定范围内的字节，其底层必须是仍附着的固定普通 ArrayBuffer。 |
| `toUint8Array()` | 返回已提交前缀的独立紧凑副本，空结果也使用新的存储。 |
| `dispose()` | 同步释放自有存储引用；重复释放无害。 |

每个写入方法都返回 void。整数必须位于对应有符号或无符号数值域内，不会回绕或截断。浮点数支持正负零、NaN 和无穷；舍入、下溢和上溢遵循原生转换，不承诺 NaN 的载荷位。支持未对齐的多字节写入。

批量写入接受符合条件的子类及跨 realm 视图，拒绝共享、可调整大小或已分离的底层存储、其他视图类型及代理。输入属性覆盖、迭代器和 species 不参与准入或复制。调用者之后修改源数据，不会改变已提交字节。容量已满时，仍可追加空范围。除剩余容量外，没有单独的源数据大小限制。

## 失败与生命周期

写入依次检查真实且未释放的接收者、输入数值域或来源域、剩余容量，因此无效输入优先于容量不足。TypeError 覆盖接收者、字节序、来源和释放后的操作错误；RangeError 覆盖数值域、容量上限及剩余容量不足。原始分配和原生写入异常保持原样传播。

写入成功后才提交长度。受控的忠实原生操作即使在触及未使用尾部后抛错，也不会改变已提交前缀或长度；快照不包含这段尾部。BW1 不承诺任意篡改 realm 下的隔离、重入保护或真实内存耗尽后的恢复能力。

释放后，容量、长度和剩余容量归零，disposed 为 true，最后的 endian 仍可读取。写入、快照和字节序修改被拒绝；之前返回的快照仍可使用。现有 `Scope.use(writer)` 可管理其生命周期，不需要新的所有权 API。释放引用不等于已经验证物理内存回收或清零。

BW1 不提供增长、移动写入位置、覆盖、重置、流处理、文本编码或格式导入器。运行行为、类型、边界控制及发布状态分别记录在[证据文档](字节写入器BW1证据.md)。完整 Spine、旧工程迁移、原生 SDK、实体硬件和性能验收继续单独推进。
