# 旧版 MovieClip CPU 转换契约

[English](../../en/docs/legacy-movieclip-contract.md) · [证据](legacy-movieclip-evidence.md)

这一首方组件把一个明确具名的旧 MovieClip 声明转换为不可变序列帧输入和显示偏移映射。当前实现及 28 组 CPU 焦点测试已完成检查；图片加载、解码、渲染、标签/事件播放和完整工程迁移仍是后续工作。

## 内部 API 与数据

内部模块 packages/project/src/legacy-movieclip-plan.ts 从同模块导出类型和以下函数，尚未加入包统一导出入口：

```ts
planLegacyMovieClipConversion(
  text: unknown, clipName: unknown, atlasPath: unknown,
  atlasWidth: unknown, atlasHeight: unknown,
): LegacyMovieClipConversionResult
```

输入为三个原始字符串和两个原始数字。图集路径与尺寸是显式声明；转换器不接受调用方解析图、纹理、运行时动画片段、加载器或回调。复用项目包内既有严格 JSON、Unicode 和可移植路径函数，不导入运行时私有模块，不引入新依赖。

结果仅含 planVersion/profile/status/diagnostics/acceptance/plan。版本和配置标识为 0.1 / legacy-movieclip-single-atlas-0.1；状态为 planned、invalid、unsupported 或 incomplete。planned 无诊断且有完整计划；拒绝结果只有首条诊断，plan 为 null。验收字段 fileExistence/decoding/execution/migration 始终为 unverified。每次输出容器和嵌套记录均新建、独立持有并冻结。

计划仅含 clipName/atlasPath/totalLegacyFrames/sequenceInput/holds。sequenceInput 包含 atlasWidth/atlasHeight/frames；每条帧包含 x/y/width/height/durationSeconds；对应持续段包含 resourceName/offsetX/offsetY/firstLegacyFrame/durationFrames。图集 x/y 是裁剪坐标，offsetX/offsetY 是显示偏移，旧逻辑起点从 1 开始。输出为普通数据，必须交给真实 createSequenceClip 重新准入并创建真实运行时身份。重新准入与采样已有测试；渲染偏移尚未验证。

## 声明子集与时间

根字段为 mc/res，只转换请求的精确自有 mc 成员，不回退首个条目，也不规范化名称。所选片段字段为 frames/frameRate/labels/events，帧字段为 res/x/y/duration，引用区域字段为 x/y/w/h。__proto__、constructor 等名称必须存在为真实自有属性。未选片段和未引用区域不获语义认证，全文解析预算仍适用。

frameRate 缺省为 24；显式帧率须有限且大于零，支持小数。duration 缺省为一个逻辑帧，显式值须为正安全整数。显示偏移缺省为零，显式值须为有符号 32 位整数，负零归一为零。裁剪 x/y 为非负安全整数，w/h 为正安全整数，安全边界须分别适配声明的图集宽度、高度。

每条作者关键帧形成一个持续段，相邻相同记录保持分开，用 durationFrames 表示重复逻辑帧，不展开。每个持续段只做一次 binary64 除法，不转为整数秒或 float32；秒数须有限且大于零，从零按作者顺序累计的终点须有限且严格递增，并保留正非正规秒数。压缩后的除法/求和可能不同于展开的旧逻辑帧计算：帧率 10 下先持续一帧、再持续两帧的两个段结束于 0.30000000000000004；一个三帧段结束于 0.3。旧播放器实际时钟等价性尚未验证。不宣称当前逻辑帧预算下覆盖微小增量被舍入吞没的分支。

labels/events 缺省、null 或空数组可接受；非空数组不支持，不检查其成员；其他列表类型无效。res 缺省或为空表示不支持的空白帧，显式非字符串 res 无效，引用缺失无效。内部生成的 frame 回指、旋转、裁切扩展及其他未知所选字段不支持。旧版宽松数值转换不在当前严格子集内。

## 预算

| 边界 | 上限 |
| --- | ---: |
| 原始文本 UTF-16 长度与 UTF-8 字节数，分别 | 1,048,576 |
| 解码 JSON 键/字符串 UTF-8 字节数 | 4096 |
| 容器深度 | 16 |
| mc 成员 / res 成员 | 64 / 4096 |
| 作者帧 | 1–1024 |
| 旧逻辑帧总数 | 1,048,576 |
| 选择名称 / 引用资源名称 UTF-8 字节数，分别 | 256 |
| 图集路径 UTF-8 字节数 | 1024 |

严格 JSON 拒绝无效 Unicode、重复或转义后重复键、BOM、注释和尾逗号。路径保留原始拼写，通过可移植工程相对路径规则，并排除协议、绝对/双斜线开头、反斜线、查询/片段/百分号语法、遍历/空分段、无效字符、末尾点/空格以及 Windows 保留分段。词法准入不证明文件存在、物理或符号链接包含关系，也不授予覆盖权限。

## 确定的验证顺序

1. 从左到右检查全部五个原始类型，不读取或转换对象。非有限数字原始值进入后续尺寸检查。之后只调用一次 readLegacyResourceJSON，将真实 LEGACY_RES_INPUT_INVALID、LEGACY_RES_SYNTAX_INVALID、LEGACY_RES_LIMIT_EXCEEDED、LEGACY_RES_INTERNAL_FAILED 结果映射到对应 LEGACY_MOVIECLIP_ 代码。输入、语法、预算拒绝为 invalid，内部或未知解析结果为 incomplete。严格解析优先于名称/路径/尺寸语义检查；不使用第二个解析器、reviver 或输入执行。
2. 检查名称非空、Unicode、字节数，路径 Unicode、字节数、词法规则，宽度然后高度为正安全整数。依次验证根/mc/res 非数组记录，再依次检查 mc/res 数量。解析精确自有片段，然后验证其记录和自有非空 frames 数组及数量。
3. 捕获帧率/labels/events，按此顺序验证。逐条作者帧检查记录、res 类型与名称字节数、x、y、duration、引用区域。区域先检查记录再检查 x/y/w/h，之后先横向、再纵向安全适配。进入下一帧前验证逻辑帧累计、秒数商和累计终点。空白帧/列表暂记为不支持标记；首个支持字段无效值优先。
4. 所有支持数据有效后，依次选择不支持项：根未知字段，片段未知字段，按作者顺序的帧未知字段，按首次引用顺序的不同区域未知字段，首个空白帧，非空 labels，非空 events。每条记录内使用 JavaScript 默认字符串排序。因此后续无效值优先于之前的不支持标记。
5. 准入后才发布完整自有冻结记录。意外内部故障在能够分配拒绝结果时返回 incomplete，不检查或转换外部抛出值，不承诺通用内存不足恢复，不发布部分计划。

## 诊断

诊断仅含 code/source/severity/jsonPointer/message。source 为 text/clipName/atlasPath/atlasWidth/atlasHeight；不支持项为 warning，其他为 error。消息为 1–160 个 UTF-16 单元的静态英文，不插入调用方内容或序列化异常，具体措辞不作为行为断言。参数指针为空，文本指针先转义 ~ 再转义 /，保留真实自有字段拼写。

下列代码均使用 LEGACY_MOVIECLIP_ 前缀：

| 后缀 | 含义 / 指针 |
| --- | --- |
| INPUT_INVALID | 原始类型/Unicode、记录/数组、res/列表/偏移类型；对应参数或文本字段 |
| SYNTAX_INVALID | 严格解析器语法拒绝；保留原指针 |
| LIMIT_EXCEEDED | 解析器或转换器预算；保留原指针，或 /mc、/res、frames、duration、名称字段 |
| PATH_INVALID | 图集路径词法；atlasPath，空指针 |
| CLIP_NOT_FOUND | /mc/转义名称 |
| REFERENCE_UNRESOLVED | 帧 res 字段 |
| RATE_INVALID | 片段 frameRate |
| DURATION_INVALID | 当前 duration |
| REGION_INVALID | 区域记录/字段；横向边界 w，纵向边界 h |
| TIME_INVALID | 当前 duration，包括其缺省值 |
| SCHEMA_UNSUPPORTED | 首个未知所选字段 |
| FEATURE_UNSUPPORTED | 首个空白 res 或非空 labels/events |
| INTERNAL_FAILED | text，空指针 |

名称/路径 Unicode 无效使用 INPUT_INVALID，字节超限使用 LIMIT_EXCEEDED；宽/高语义使用 INPUT_INVALID。帧率和 duration 须满足声明的严格类型；秒数商或累计时间失败使用 TIME_INVALID。实际检查与剩余门禁见配对证据。
