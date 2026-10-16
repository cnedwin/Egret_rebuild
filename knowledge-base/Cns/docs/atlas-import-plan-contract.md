# 图集导入计划契约

[English](../../en/docs/atlas-import-plan-contract.md) | 简体中文 · [标准化图集帧](atlas-frame-layout-contract.md) · [证据与限制](atlas-import-plan-evidence.md)

图集元数据可以描述打包裁剪、精灵逻辑尺寸和帧时长，但不能标识已加载的 Texture，也不能证明运行库能够表达某项 exporter 特性。可选 `@egret/project/atlas` 入口把严格 JSON 文本与一个显式 PNG 绑定转换为现有 SpriteSheet、SequenceClip 工厂的自有输入。它同步规划元数据，不加载图像、不编辑工程、不创建资源、不推进时钟。

所选 profile 精确为 `aseprite-json-array-1.3.18.6-v1`：声明稳定版本 `1.3.18.6` 的单页 JSON-array、`RGBA8888`、scale 字符串 `"1"`，且帧不旋转。成功表示通过这一有限 profile，不能认证 Aseprite exporter 兼容性、生产者身份、像素、哈希、许可资格、播放或渲染。商业发行版原始输出中的实际 marker 仍未验证。源码研究推断普通 clean exact-tag Git 构建会产生 `1.3.18.6-dev`；该值与 fallback `1.x-dev` 均拒绝。不使用 `1.3.x` 通配，也不从源码推定发行制品身份。

## 显式输入与公开 API

入口恰有两个运行时值：`createAtlasImportPlan` 和冻结的 `ATLAS_IMPORT_LIMITS`；`@egret/project` 根入口不转导出。不提供 default export、公开错误类、测试钩子或未知字段透传。依赖仍为 `@egret/contracts` 和 jsonc-parser 3.3.1；project reference 仅指向 contracts。不新增 Engine、Runtime 或 Host 依赖或 API。保留 ES2022/NodeNext、`lib: ["ES2022"]`、`types: []`、strict flags、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 和 `verbatimModuleSyntax`；产品代码不依赖 DOM/Node。

```ts
function createAtlasImportPlan(input: unknown): AtlasImportResult;
const ATLAS_IMPORT_LIMITS: Readonly<AtlasImportLimits>;
```

恰有十六个擦除名称描述此接口：

| 仅类型名称 | 契约 |
| --- | --- |
| `AtlasImportProfile` | 字面量 `aseprite-json-array-1.3.18.6-v1` |
| `AtlasProvenance` | readonly 字符串 `origin/license/notice` 及可选字符串 `sha256` |
| `AtlasTextSource` | readonly `id/text/provenance` |
| `AtlasPageBinding` | readonly `pageName/assetId/width/height/provenance` |
| `AtlasImportInput` | readonly `profile`、`source: AtlasTextSource`、`page: AtlasPageBinding` |
| `AtlasSourceSpan` | readonly `source: 'metadata'`、`sourceId/offset/length/line/column` |
| `AtlasImportDiagnosticCode` | 下方诊断表的十三个字面量代码 |
| `AtlasImportDiagnostic` | readonly `code`、`severity: 'error'`、`source: 'input' \| 'metadata'`、`pointer/message`；可选 `span/relatedSpan/cause: unknown` |
| `AtlasNormalizedFrameLayout` | readonly 数字 `sourceWidth/sourceHeight/trimX/trimY`，以及字面量 `packedRotation: 0` |
| `AtlasSpriteSheetFrame` | readonly `name`、数字 `x/y/width/height`、`layout: AtlasNormalizedFrameLayout` |
| `AtlasSequenceFrame` | readonly 数字 `x/y/width/height/durationSeconds`、`layout: AtlasNormalizedFrameLayout` |
| `AtlasSequenceInput` | readonly 数字 `atlasWidth/atlasHeight` 及 readonly `frames: readonly AtlasSequenceFrame[]` |
| `AtlasFrameOrigin` | readonly 数字 `index`、字符串 `pointer`，以及 span `name/frame/sourceSize/spriteSourceSize/duration` |
| `AtlasImportPlan` | 下文说明的自有计划 |
| `AtlasImportResult` | `{ readonly ok: true; readonly value: AtlasImportPlan; readonly diagnostics: readonly [] }` 或 `{ readonly ok: false; readonly diagnostics: readonly [AtlasImportDiagnostic] }` |
| `AtlasImportLimits` | 下方全部 limit 字段对应的 readonly number 属性 |

全部属性及嵌套计划结构均 readonly，类型不导入 SDK 模块。成功计划包含 `planVersion: 1`、精确 profile、`exportVersion: '1.3.18.6'`、复制的 page，以及按序的 `names/spriteSheetFrames/sequenceInput/origins`。`sourceDeclarations.metadata` 包含复制的 `id/provenance`、原文 `utf8Bytes` 和 `hashVerification: 'declared_unverified'`；不保留源文本或私有 JSON tree。`acceptance` 字段精确为 `exporterArtifact: 'unverified'`、`assetPixels: 'not_run'`、`runtimeComposition: 'not_run'`、`rendering: 'not_run'`、`licenseEntitlement: 'unverified'`。

计划拥有并深冻结全部记录与数组，不保留输入 record/array；字符串与数字按值复制。名称及两份工厂输入保留数组顺序。每个帧与 layout 独立分配，sheet 与 sequence 两分支间也不共用对象；相同 crop 不合并。计划中没有 Texture、lease、Engine、文件操作或隐含 PNG discovery。失败诊断容器冻结，但真实反射 `cause` 是明确借用的例外：不读取其 `name/code/message`，也不递归冻结，不对该 cause 承诺零别名。

## 支持的调用与工厂独立准入

下面原创程序化元数据展示所选形状，并非捕获的 exporter 输出。`originalFullAtlasLease` 是另行获取、调用者拥有的 lease，其 Texture view 覆盖完整 4×4 图集；`resources` 是既有真实 Scope。这些名称代表应用已有资源准备，planner 不提供它们。

```ts
import { createAtlasImportPlan } from '@egret/project/atlas';
import { createSequenceClip, createSpriteSheet } from '@egret/engine';

const provenance = {
  origin: 'Original programmatic fixture',
  license: 'Apache-2.0',
  notice: 'Egret community fixture',
};
const result = createAtlasImportPlan({
  profile: 'aseprite-json-array-1.3.18.6-v1',
  source: {
    id: 'metadata:original', provenance,
    text: '{"frames":[{"filename":"idle","frame":{"x":0,"y":0,"w":2,"h":2},"rotated":false,"trimmed":true,"spriteSourceSize":{"x":1,"y":1,"w":2,"h":2},"sourceSize":{"w":4,"h":4},"duration":125}],"meta":{"app":"https://www.aseprite.org/","version":"1.3.18.6","image":"atlas.png","format":"RGBA8888","size":{"w":4,"h":4},"scale":"1"}}',
  },
  page: { pageName: 'atlas.png', assetId: 'page:original',
    width: 4, height: 4, provenance },
});
if (result.ok) {
  const plan = result.value;
  const sheet = resources.use(createSpriteSheet(
    originalFullAtlasLease, plan.spriteSheetFrames, 'trim-rotation-v1'));
  const clip = createSequenceClip(plan.sequenceInput, 'trim-rotation-v1');
  // 创建的 Bitmap 应纳入 Scope；播放另行使用既有 API。
} else {
  // 按应用输出场景转义诊断文本与来源 ID。
  console.log(result.diagnostics[0]);
}
```

Engine 工厂独立重新接纳标准化数据，并执行自身资源、布局与时间契约。planner 成功不认证 lease，也不建立 `assetId` 与 lease 的关联。调用者继续拥有 lease 和 Texture 生命周期；dispose sheet 不释放它们。播放使用既有时钟与 player API。importer 不实现放置矩阵、UV、旋转解包、renderer、像素裁剪或资源管理，参见[标准化图集帧契约](atlas-frame-layout-contract.md)。

## 捕获记录与声明页面

输入 record 的原型必须是 `Object.prototype` 或 null；拒绝数组、函数和 class instance。key 必须精确为自有、可枚举的 string data descriptor。不调用 getter，拒绝 symbol、accessor、缺失与额外字段。根按 `profile/source/page` 捕获；source 按 `id/text/provenance`；page 按 `pageName/assetId/width/height/provenance`；每份 provenance 按 `origin/license/notice/sha256`，其中 `sha256` 可省略。

每个 record 依次执行 `Array.isArray`、`getPrototypeOf`、`ownKeys`，再按固定顺序读取 own descriptor。结构拒绝立即结束。每个反射操作只执行一次，catch 仅围住该操作，不再次探测 revoked proxy。真实抛出产生 `ATLAS_READ_FAILED`；record 操作用当前容器 pointer，descriptor 操作用当前字段 pointer。诊断始终 own `cause`，即使抛出值为 `undefined`。每次调用私有 sentinel 区分自有拒绝，外部 `error.name/code` 无法冒充。完整捕获记录树后才校验 primitive 与预算；结构拒绝后不继续寻找后续 fault，不回滚任意 proxy 副作用。

`source.id` 与 `assetId` 必须是非空、well-formed Unicode 字符串，不附加去除空白的要求。`text` 必须为 primitive string。provenance 必需字符串非空且 well-formed；可选 `sha256` 精确为 64 位小写十六进制。全部只是声明，不验证来源、权利、原件哈希或许可资格。页面尺寸是正安全整数。输入标量/provenance 错误使用 `source: 'input'`，不伪造文本 span。

调用方 `/page/pageName` 在完整记录捕获之后、标量/预算检查阶段准入，先于 JSON 扫描及 metadata 语义。primitive 错型返回 `ATLAS_INPUT_INVALID`；primitive string 的 portable PNG basename 形状非法返回 `ATLAS_PAGE_BINDING_INVALID`；页面名 UTF-8 预算超限返回 `ATLAS_LIMIT_EXCEEDED`。这些调用方拒绝使用 `source: 'input'`，没有 metadata span；metadata 来源的拒绝另行诊断。`pageName` 与 `meta.image` 都必须是保留大小写的 portable PNG basename：非空 stem 加精确小写 `.png`，最多 255 UTF-8 bytes，不含正斜杠或反斜杠。既有 portable-path 规则拒绝 control/DEL、`: * ? " < > |`、空段/点段、尾空格/点及 Windows 保留设备名。`%`、`#` 是普通文件名字符，不作 URL 语法解释。不做 Unicode、NFC 或大小写正规化，不补扩展名，不发现相邻文件。两个名字必须逐 UTF-16 码元完全相等，`meta.size` 必须与显式 width/height 完全相同。`assetId` 是 opaque identity，不触发资源查找。

## 固定准入限制

`ATLAS_IMPORT_LIMITS` 冻结。这些是 planner 政策上限，不是厂商最大值、设备能力或性能测量；所有适用上限同时成立。

| `AtlasImportLimits` 字段 | 固定上限与计费 |
| --- | --- |
| `maxSourceUtf8Bytes` | 1048576，原文编码为 UTF-8；不是认证后的文件哈希 |
| `maxJsonDepth` | 16，根 object/array 深度为 1 |
| `maxJsonNodes` / `maxJsonProperties` | 65536 / 49152；object、array、literal 计 node，key 单独计 property |
| `maxJsonKeyUtf8Bytes` / `maxJsonStringUtf8Bytes` | 256 / 4096，按 decoded 值；所有 JSON 字段计费 |
| `maxSourceIdUtf8Bytes` / `maxAssetIdUtf8Bytes` | 256 / 256 |
| `maxNameUtf8Bytes` / `maxNameUtf16Units` / `maxTotalNameUtf16Units` | 1024 / 128 / 32768 |
| `maxPageNameUtf8Bytes` / `maxFrames` | 255 / 1024；至少 1 帧 |
| `maxAtlasEdge` / `maxAtlasPixels` | 4096 / 1048576；两边为正，面积安全 |
| `maxSourceDimension` / `maxDurationMilliseconds` | 65535 / 65535；正整数 |
| `maxProvenanceFieldUtf8Bytes` / `maxProvenanceTotalUtf8Bytes` | 4096 / 24576；source 与 page 的全部 `origin/license/notice/sha256` 值，source 先于 page |
| `maxDiagnosticPointerUtf8Bytes` | 2048；下文规定精确拒绝 span |

除原文本外，UTF-8 计费使用 decoded Unicode，不使用 JSON escape 的原始字符长度。名称为 1–128 UTF-16 码元，同时满足 UTF-8 与总码元预算。精确保留解码后的名字，不 trim、截断、改名、正规化或排序。允许非空的全空白名字，拒绝精确重复；允许 crop 重合。

数字字段拒绝字符串、强制转换、非有限、非整数和不安全值；零坐标转为 `+0`。JSON `1.0` 或 `1e2` 在解析值符合整数约束时可接纳。原文 Unicode 非法用 `ATLAS_JSON_SYNTAX`，其他输入字符串 Unicode 非法用 `ATLAS_INPUT_INVALID`，超预算用 `ATLAS_LIMIT_EXCEEDED`。几何正安全整数超过政策上限用 LIMIT，其他几何错误用 REGION。duration 错型、负数、零或小数用 TIME；正整数超过政策上限用 LIMIT。

## 严格 JSON 与拒绝优先级

准入按明确调度执行，不承诺全局最早字符优先。

1. 完整捕获输入记录树，再检查 primitive、Unicode 与预算。调用方 profile 非 string 或 Unicode 非法时返回 `ATLAS_INPUT_INVALID`，使用 `source: 'input'`、pointer `/profile`，不含 `span`、`relatedSpan` 或 `cause`；完整捕获期间的结构或反射错误仍优先。well-formed 的未知 profile 没有额外 profile 长度上限。其 `ATLAS_PROFILE_UNSUPPORTED` 拒绝须等完整 JSON 解析成功且步骤 4 进入调用方 profile 准入后才产生；该拒绝同样使用 `source: 'input'`、pointer `/profile`，不含 `span`、`relatedSpan` 或 `cause`。
2. 检查原文 Unicode 与 UTF-8 总量；开头 raw BOM 是 offset 0、length 1 的 syntax 错误。以 `createScanner(text, false)` 完整扫描至 EOF，不构树，拒绝 token error、comment/unknown、decoded 非法 Unicode 和深度超限。因此后续词法/深度错误先于较早的 duplicate、schema 或 unsupported concern。
3. 仅使用既有私有 JSON foundation 转出的公开 jsonc-parser 3.3.1 `visit` 作为 grammar authority，选项为 `disallowComments: true`、`allowTrailingComma: false`、`allowEmptyContent: false`。建立有序 property/node tree，用 Map 检测 decoded duplicate key，并在 callback 内检查 node/property/string/key/pointer 预算及 finite number。首个 callback 拒绝即结束。较早 duplicate 可以先于后续 grammar fault，不能承诺完整 grammar 先于 duplicate。schema 与 unsupported 解释必须等待完整 visitor 成功，因此后续 grammar fault 先于早期 unsupported concern。
4. 接纳 root object 及必需 `frames/meta` 结构，再验证调用方 profile，最后严格按 `meta.app/version/format/scale` 顺序验证 marker。marker 缺失、primitive 错型、未知值分码。object 形态 `frames` 属于不支持的 JSON-hash，不排序；其他非 array 形态是 schema 错误。
5. 从 `meta.image/size` 开始，再按帧数组顺序验证支持的必需 schema、几何、时间、名称及页面绑定。未知字段与已知不支持扩展先记 concern，待全部已支持检查完成。后续 invalid frame 压过较早可读 unsupported 字段。若仍有 concern，选原 JSON key offset 最小项，不按 schema 字段检查顺序选择。
6. 没有 concern 才创建并冻结公开 plan。声明的准入拒绝只返回一个 fatal，不含部分 plan 或此前 warning。未知内部异常向上保留，不伪装为反射 READ_FAILED，也不承诺从 OOM 恢复。

根键仅 `frames/meta`。meta 必需键为 `app/version/image/format/size/scale`；`size` 仅 `w/h`。每帧精确为 `filename/frame/rotated/trimmed/spriteSourceSize/sourceSize/duration`；`frame` 与 `spriteSourceSize` 仅 `x/y/w/h`，`sourceSize` 仅 `w/h`。必需字段缺失或错型使用 schema 或相应名字/数字码。未知字段即使值为 `false` 或 `null` 也记延后 concern。

`meta.app` 仅允许 `http://www.aseprite.org/` 或 `https://www.aseprite.org/`；version 精确 `1.3.18.6`，format 精确 `RGBA8888`，scale 是字符串 `"1"`。`meta.frameTags/layers/slices` 可缺省或为空 array；非 array 是 schema 错误，非空 array 为 unsupported。不消费 pivot/center、nine-slice、mesh/polygon、任何 multipage/textures/related_multi_packs marker，出现即记 concern。TexturePacker hash 格式、旋转方向推断、tag/layer/slice 语义、`.ase` 二进制、Spine、exporter 生成与旧迁移不属于该 profile。此切片不关闭整个 P04、完整 Spine R020/V020 或迁移 R008/V006，也不增加动画资源替换或性能保证。

## 几何、时间及逐帧来源

`frame.x/y/w/h` 原义转换为 packed `x/y/width/height`；坐标非负、尺寸为正、求和安全、crop 位于 `meta.size` 内。`sourceSize.w/h` 转为 layout `sourceWidth/sourceHeight`；`spriteSourceSize.x/y` 转为 `trimX/trimY`。声明可见 `w/h` 为正、偏移非负，偏移加可见尺寸须位于 sourceSize 内。`rotated: false` 时，可见 `w/h` 还必须等于 packed `w/h`，输出 `packedRotation` 是字面量 `0`。`rotated: true` 是延后 unsupported concern，不据此推断解包尺寸或旋转方向；其他 rotated 类型是 schema 错误。

`trimmed: false` 要求偏移为零且可见尺寸等于 sourceSize；`true` 不要求实际缩小。所有帧 sourceSize 必须相同，不同则记延后 unsupported concern。必需 boolean 错型为 schema 错误。合法 1×1 透明占位不凭 JSON 拒绝：planner 不能检查 alpha，也不能推断作者的空帧意图。

duration 是 1–65535 整数毫秒，仅除以 1000 一次得到秒。binary64 按数组顺序累加，结果须有限且严格增长。没有默认帧率或 tick 量化。每项 `origins` 保留帧 index/pointer，以及 filename、frame、sourceSize、spriteSourceSize、duration 的原文 span。

## 原文诊断

span 对应未经正规化的 `source.text` UTF-16 码元。`offset/length` 是从零开始的半开范围；`line/column` 从 1 开始，列按 UTF-16 码元计。CRLF 为一次换行，单独 CR 或 LF 也为换行。`span.source` 始终为 `metadata`，`sourceId` 是捕获的来源 ID。string、number、boolean、null 使用完整原始 literal token，字符串包括引号与 escape；key span 包括完整带引号 key。完成的 object/array span 使用实际 end callback 的 offset 加 length，延伸至闭合符号之后，不仅使用 opening 单字符。

语义坏值指 value span；缺必需字段的 pointer 指该字段，span 用完整 containing object；未知字段用 key span。decoded 重复键指第二 key 并关联第一 key；重复 filename 对两个 value 同样处理。EOF grammar error 可为 length 0；其他 syntax span 沿用公开 parser API 的 offset/length，不凭空扩大。scanner 诊断 pointer 为 `""`。tree pointer 将 decoded `~` 转义为 `~0`、`/` 为 `~1`。input 诊断没有文本 span。外部 raw-byte SHA 身份与 UTF-16 span、UTF-8 预算分别保留。

pointer 预算在 visitor 进入当前 property/node 时拒绝。2048 UTF-8 bytes 恰好允许，2049 以 `ATLAS_LIMIT_EXCEEDED` 拒绝，pointer 为最近仍在预算内的父 pointer。object property 使用 `onObjectProperty` 的完整原 key token；array index 没有 key token，literal 使用 `onLiteralValue` 的完整 token，object/array 使用 `onObjectBegin/onArrayBegin` 的 opening `{`/`[` 单字符且 length 精确 1。不借祖先 key，不等待容器闭合。此提前拒绝专用 span 不改变正常 full-container span，也不增加 relatedSpan 或 cause。

| 代码 | 固定英文消息 |
| --- | --- |
| `ATLAS_INPUT_INVALID` | Input must use the supported data descriptors. |
| `ATLAS_READ_FAILED` | Reading an input descriptor failed. |
| `ATLAS_LIMIT_EXCEEDED` | Input exceeds an atlas planning limit. |
| `ATLAS_JSON_SYNTAX` | Metadata must be strict finite Unicode JSON. |
| `ATLAS_JSON_DUPLICATE_KEY` | Metadata contains a duplicate decoded key. |
| `ATLAS_SCHEMA_INVALID` | Metadata does not have the selected schema. |
| `ATLAS_MARKER_MISSING` | A required exporter marker is missing. |
| `ATLAS_MARKER_INVALID` | An exporter marker has the wrong primitive type. |
| `ATLAS_PROFILE_UNSUPPORTED` | Metadata is outside the selected atlas profile. |
| `ATLAS_PAGE_BINDING_INVALID` | Metadata needs one exact declared PNG binding. |
| `ATLAS_NAME_INVALID` | Frame names must be nonempty and unique. |
| `ATLAS_REGION_INVALID` | Frame geometry is invalid. |
| `ATLAS_TIME_INVALID` | Frame durations must form a positive finite sequence. |

## 官方来源与接受边界

以下保留证据 ID E01–E09。研究截点是 2026-10-16 17:24 UTC。URL/tag/commit 用于定位研究来源，不代表已在本地认证上游 raw 制品或执行 exporter 发行版。

| ID | 官方来源与边界 |
| --- | --- |
| E01 | [Aseprite CLI](https://www.aseprite.org/docs/cli/) 说明 json-array/json-hash、trim 与可选 tag/layer/slice；当前未版本化文档不证明本 profile 兼容性。 |
| E02 | [v1.3.18.6 release tag](https://github.com/aseprite/aseprite/releases/tag/v1.3.18.6) 及 [commit 331e898ef405d919539c03fd1675691cfa16c3a3](https://github.com/aseprite/aseprite/commit/331e898ef405d919539c03fd1675691cfa16c3a3) 定位研究源码；未运行发行制品。 |
| E03 | 固定版 [doc_exporter.cpp](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/app/doc_exporter.cpp) 用于研究字段语义、sample 顺序、rotated=false、duration、图像 format 与 scale 字符串。文件头使用 Aseprite EULA，未复制 exporter 实现。 |
| E04 | 固定版 [sprite.h](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/doc/sprite.h) 与 [.ase specification](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/docs/ase-file-specs.md) 交叉核对毫秒单位；planner 不解析 .ase 二进制。 |
| E05 | 固定版 [info.c](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/info.c) 支持随平台使用 http/https，也允许自定义 app URL；marker 不认证生产者。 |
| E06 | 固定版 [EULA](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/EULA.txt) 与 [src/doc MIT license](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/doc/LICENSE.txt) 范围不同；src/doc 的 MIT 不授权整个应用或 exporter/app/ver 源码。 |
| E07 | TexturePacker [custom exporter](https://www.codeandweb.com/texturepacker/documentation/custom-exporter) 与 [texture settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings) 说明 packed frameRect 及 XML 选择 cw/ccw。未取得精确 JSON-hash 模板，不推广其方向。 |
| E08 | 官方 [download manifest](https://www.codeandweb.com/download/texturepacker/latest.json) 在读取时显示 8.3.0；[CLI parameters](https://www.codeandweb.com/texturepacker/documentation/commandline/parameters) 说明格式相关 multipack/alias 选项。两者均不确立已接纳的 JSON 或动画时间契约。 |
| E09 | 固定版 [version CMakeLists.txt](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/CMakeLists.txt) 与 [generated_version.h.in](https://raw.githubusercontent.com/aseprite/aseprite/v1.3.18.6/src/ver/generated_version.h.in) 支持默认 `-dev` 的源码推断；未实际构建，既有 Aseprite 许可边界仍适用。 |

Egret 独立定义本契约、捕获、预算、诊断及标准化输出。原创 tiny fixture 是第一方程序化数据，不是厂商示例美术或捕获的商业 exporter 输出。格式词汇研究不证明 Editor 资格、分发权利或原件哈希有效性。本文不分发上游代码或素材；第一方代码与文档保留 Apache-2.0。这些源码研究不构成 Aseprite 为 GPL/OSI 开源软件的断言。

source、parser 行为、实际 emitted-entry 类型诊断、包边界、真实公开 SDK CPU 组合、有限 Native 渲染、完整本地门禁、publication/Main/CI 应分别留证。历史标准化布局证据不接受新增 JSON 路径。Node 解析后由浏览器消费 plan，不证明浏览器执行了 parser。任何 exporter 兼容声明都需要另行取得合法工具输出、设置、版本及原始 PNG/JSON 身份。
