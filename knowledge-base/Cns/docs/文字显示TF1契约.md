# 文字显示 TF1：显式行显示与资源契约

[English](../../en/docs/text-field-tf1-contract.md) | 简体中文 · [文字栅格 T1 契约](文字栅格T1契约.md)

TF1 规定一个不可编辑的显示叶节点，使用显式源文本行和一份完整、统一样式的 T1 请求。它连接既有文字缓存、真实 Texture 调用者租约、自有 ImageData2D、显示边界及 CPU 图像命令。本契约规定应有行为，不报告验证全部完成、原生字体质量或完整 UI 验收。

## 显式入口与真实创建

使用 `@egret/engine/text`。该入口新增运行时值 `createTextField` 和仅类型导出 `TextField`/`TextFieldStatus`。其运行时值恰为 `createTextRasterCache` 与 `createTextField`，既有缓存工厂身份保持不变。`@egret/runtime/text` 的运行时值仍只有 `createTextRasterCache`。各包默认根入口不变，不新增子路径、依赖、公开所有权句柄、宿主方法、调度器或定时器。

```ts
import { createTextField } from '@egret/engine/text';
import type { TextField, TextRasterRequestInput } from '@egret/engine/text';

// 提供真实 Engine、它创建的 Scope，以及由 engine.assets 创建的缓存。
const field: TextField = createTextField(engine, scope, cache);
field.setRequest(input as TextRasterRequestInput);
await field.prepare();
engine.stage.addChild(field);
// Scope 拥有该字段；应用仍拥有共享缓存。
```

此片段不是完整提供者或可直接运行的示例。工厂签名为 `createTextField(engine: Engine, scope: Scope, cache: TextRasterCache): TextField`。创建要求真实 Engine、由该 Engine 创建的 Scope，以及属于同一 Engine 真实 AssetManager 的真实缓存。相似对象、代理、借用接收者、公开同名状态遮蔽和被替换的公开方法，都不能提供身份或生命周期权限。未经授权的直接构造，在创建显示状态、访问缓存或安装 Scope 所有权之前拒绝。工厂的私有创建权限不是调用者选项或公开构造器。

`TextField` 是工厂产生的不透明类型，继承 `DisplayObject` 的显示操作，另有以下操作：

| 操作 | 应有行为 |
| --- | --- |
| `setRequest(input: TextRasterRequestInput): void` | 同步采纳十个不可变标量，不获取缓存、不启动提供者工作。 |
| `prepare(): Promise<TextRasterMetrics>` | 显式获取当前期望修订，即使该修订此前已经提交。 |
| `getStatus(): TextFieldStatus` | 返回新的冻结只读快照，销毁后仍可读取。 |
| `dispose(): void` | 同步、幂等地终结本字段并清理。 |

状态仅包含只读 `state: 'unprepared' | 'ready' | 'disposed'`、`desiredRevision: number`、`committedRevision: number | undefined`、`pending: boolean` 和 `metrics: TextRasterMetrics | undefined`。不暴露缓存、租约、提供者计划、可变源记录或图像缓冲。初始期望修订为 0，已提交修订与指标为 undefined，pending 为 false。每次成功 setter 都推进期望修订，包括相同输入。修订必须为安全整数；超过 `Number.MAX_SAFE_INTEGER` 的推进拒绝且不改变状态。ready 表示至少有一次提交，包含空结果；后续替换处于 pending 或失败时仍保持 ready。disposed 状态保留最终修订和已保存的不可变指标，pending 为 false。

## 十标量准入与重入

依次各读取一次：`text`、`fontFamily`、`fontSize`、`fontWeight`、`fontStyle`、`lineHeight`、`locale`、`direction`、`density`、`fillColor`。TF1 保留 T1 准入：

| 标量 | 准入范围 |
| --- | --- |
| `text` | 良构 UTF-16，最多 8192 码元、64 个显式源文本行。 |
| `fontFamily` | 非空字符串，最多 256 码元，遵守 T1 控制字符策略。 |
| `fontSize` | 1 至 512 的有限数值。 |
| `fontWeight` | 1 至 1000 的整数。 |
| `fontStyle` | `normal` 或 `italic`。 |
| `lineHeight` | 1 至 1024 的有限数值。 |
| `locale` | 最多 64 个 ASCII 码元，完整匹配 `[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*`。 |
| `direction` | `ltr` 或 `rtl`，不承诺塑形或 bidi 算法。 |
| `density` | 0.5 至 4 的有限数值。 |
| `fillColor` | 0 至 `0xffffff` 的整数。 |

LF、CRLF、CR 保留各自精确源范围；末尾分隔符产生空的最后一行。不裁剪空白、不归一化、不自动折行。T1 拒绝不支持的控制字符和未配对代理码元，允许其定义的汉字、组合序列、阿拉伯文、ZWJ/ZWNJ 与变体选择符子集，但不宣称字体覆盖。不可变标量副本不保留调用者记录。

存活准入先检查字段销毁状态、Engine 内在开放状态和 Scope 内在开放状态，再检查短暂的同字段请求守卫。嵌套 setter 在读取输入之前同步拒绝 `TEXT_FIELD_BUSY`。嵌套 prepare 在检查期望/pending 状态或启动缓存工作之前，以该码拒绝 Promise。其他字段相互独立；状态观察和销毁仍可用。守卫在所有路径的 finally 中退出，并先于提交后的取消回调退出。

十次读取全部成功后，在数值/语义验证和修订提交前重新检查生命周期。抛错 getter 使用 T1 的 `TEXT_REQUEST_INVALID`，保留完全相同的 cause，即使该 getter 同时销毁所有者。调用者 getter 的效果不回滚。准入拒绝保留期望、pending 和已提交字段状态，调用者自身效果除外。普通后续 setter 仍可替代异步准备。

## 原子准备与所有权

每个字段保留一个已提交调用者租约或一个空的已提交布局，最多有一个当前需求中的准备。无隐式工作、重试、工作队列、修订历史或字段独立驻留缓存。没有期望请求的 prepare 拒绝 `TEXT_FIELD_UNPREPARED`；第二个当前 prepare 拒绝 `TEXT_FIELD_BUSY`。每次显式 prepare 使用缓存当前字体代次。`cache.invalidate()` 不启动字段工作，也不静默替换可见内容。TF1 不新增公开取消端口。

成功 setter 先替换期望修订、终结旧 pending 权限，再取消该需求。旧准备拒绝 `TEXT_FIELD_SUPERSEDED`。取消一个字段不能取消另一字段的合并需求：共享工作可使用同一 Texture，但成功字段各自拥有独立的真实调用者租约。替换处于 pending 时保留旧的已提交图像、指标和边界。

返回结果先暂存，并重新检查真实字段、Engine/Scope/缓存生命周期和当前修订。当前成功先原子提交复制后的不可变指标、栅格位置和真实租约，或提交不带租约的空布局，再释放旧租约。迟到或已替代交付释放其调用者租约，不能重新发布。无墨迹成功清除绘制但保留逻辑布局。提供者失败及完全相同的 cause 透传，不静默置空、不降采样。清理继续尝试必要操作，同时保留首个失败；释放过程中的重入不能恢复已终结或已退出权限的状态。

所传 Scope 拥有字段；移除或重新挂接只改变显示父子关系，不改变所有权。销毁先使显示/状态路由与 pending 需求终结，再允许外部取消/释放回调重入。它仅释放本字段资源，共享缓存、提供者、其他字段、字体及无关租约仍由各自所有者管理。

Scope 在 abort 观察者和逆序清理之前进入 closing。字段存活准入、当前提交以及到达的 bounds/capture 贡献，在访问自身贡献或租约前要求 Scope 内在开放。closing/closed Scope 使用 `SCOPE_CLOSED`；Engine 关闭使用既有生命周期错误。采集保留既有 visibility/alpha/clip 跳过顺序，不能发出 closing Scope 的图像。观察性状态无需在实际字段清理前报告 disposed。公开同名遮蔽不能重新开放所有者。Engine 清理不会无限等待任意提供者工作：逻辑取消与实际结算仍不同，后者由 T1 `cache.whenIdle()` 观察。已保存不可变指标和已采集自有 ImageData 在清理后仍遵守既有可读契约。

## 显示、空白布局与密度

`captureFrame`/`renderFrame` 与 `captureTexturedFrame`/`renderTexturedFrame` 均使用既有图像命令协议、变换、绘制顺序、可见性、alpha 和局部裁剪。已提交图像使用 T1 `metrics.raster` 的 x/y/logicalWidth/logicalHeight 和完整像素源矩形。密度已经体现在该位置中，不再次施加密度缩放、不转换 alpha。像素保持 straight-sRGB `rgba8unorm` 语义。仅矩形的 `collectFrameCommands` 路径在既有跳过之后，对本应发出的图像拒绝 `FRAME_IMAGE_UNSUPPORTED`。空/无墨迹文字不发出图像命令。

边界恰贡献一个已提交 `contentBounds` 矩形，即逻辑布局与真实墨迹的并集，不包含 2 个栅格像素的分配 guard。边界不依赖可见性或裁剪。宽或高为零的矩形仍计一个图元，但不贡献角点；逻辑空白指标仍可读。不计接收者自身和祖先变换；后代在完成的相对矩阵下贡献四个直接角点，不反复变换中间 AABB。不新增命中测试或父节点自动改尺寸。

T1 算术见证为 advance 8、baseline 5、ink (-1,-4,7,2)、行高 10。density 1 得到 12×10 像素、480 图像字节和 960 scratch 字节。density 1.5 得到 17×14、952 和 1904，位置为 (-8/3,-2/3,34/3,28/3)。这些是元数据公式，不是原生字形质量或性能测量。

## 继承预算

TF1 不提高任何上限。新增几何、输出或图像分配之前完成准入；隐藏子节点不能免除全树准入。

| 路径或资源 | 固定限制 |
| --- | --- |
| Bounds 节点 | 默认 4096，可选整数 1–65536。 |
| Bounds 图元 | 默认 65536，可选整数 1–262144；已提交空矩形计一个。 |
| Textured 路径节点 / authoring units / 源三角形 | 各 65536；已提交字段含空结果增加一个 authoring unit。三角形上限保留既有 Mesh 含义。 |
| Textured 路径唯一几何 / 逻辑几何字节 | 128 / 16777216，不变。 |
| Textured 路径命令 / 裁剪引用 | 65536 / 262144。 |
| 图像源边长 / 像素 | 4096 / 1048576；单个 T1 栅格最多 4194304 字节。 |
| 帧图像 / views | 64 / 128。 |
| 图像表 / 投影字节 | 各 16777216。 |
| 图像 scratch / pending Texture 字节 | 各 33554432，遵守既有图像契约。 |

Bounds 保留 `BOUNDS_TREE_LIMIT` 与 `BOUNDS_CONTENT_LIMIT`。Textured 全树限制先于可见发出；普通帧采集保留自身既有图像预算，不获得 textured 路径的树/几何限制。T1 指标绝对值仍最多 1048576，guard 为 2 个栅格像素。

| T1 缓存选项 | 默认及硬上限 | 最小值 |
| --- | ---: | ---: |
| `maxGenerations` | 64 | 1 |
| `maxPendingJobs` | 4 | 1 |
| `maxWaiters` | 128 | 1 |
| `maxCallerLeases` | 128 | 1 |
| `maxResidentEntries` | 32 | 0 |
| `maxMetadataBytes` | 2097152 | 4096 |
| `maxLogicalImageBytes` | 16777216 | 1 |
| `maxPendingRasterBytes` | 8388608 | 1 |

T1 选项必须为安全整数：undefined 选择默认值，null 无效。T1 保留恰好 32 个固定路由、最多 8 个 pending idle 观察者。当前/已退役代次、存活调用者、尚在结算的 actor 和隔离记账仍占各自上限。取消不为活跃工作虚构退款。这些逻辑记账不是 JS、Canvas、字体或 GPU 物理内存测量。

## 拒绝与后续工作

| TF1 错误码 | 含义 |
| --- | --- |
| `TEXT_FIELD_INVALID` | 创建权限错误、未经授权的构造或伪造接收者。 |
| `TEXT_FIELD_DISPOSED` | 销毁后执行字段特有的存活操作。 |
| `TEXT_FIELD_UNPREPARED` | 期望请求尚不存在时 prepare。 |
| `TEXT_FIELD_BUSY` | 同字段请求重入或已有当前准备。 |
| `TEXT_FIELD_SUPERSEDED` | 旧准备需求已被替换。 |
| `TEXT_FIELD_REVISION_LIMIT` | 期望修订不能安全推进。 |

工厂、setter、状态和销毁使用同步通道；prepare 失败拒绝其 Promise。既有 Engine/Scope、T1 验证/容量/提供者/资源及显示拒绝保留身份和原始 cause。必要清理继续进行，同时保留首个失败。

这是组合既有 Egret 文字、资源、图像、所有权及显示契约的第一方设计，采用 AI 辅助实现。该声明记录有限流程，不认证全球原创性或模型训练来源。代码与文档保持 Apache-2.0；既有第三方声明及研究权利独立保留。

TF1 不新增编辑、光标/选择/IME、文字输入/命中测试、自动折行、富文本、字体回退/选择、塑形/bidi 算法、字形图集/SDF、自动布局/父节点改尺寸、EUI/EXML/组件/虚拟列表或旧 TextField 属性兼容。不新增宿主协议或采样器变化、3D 或 Spine 支持。完整 UI、手机、Native SDK、完整迁移、CJK 字形覆盖与原生字体性能仍为独立开放要求。CPU 字面值集成和另行限定的原生字体证据不能证明这些结果。
