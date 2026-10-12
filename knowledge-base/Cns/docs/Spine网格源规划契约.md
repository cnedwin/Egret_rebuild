# Spine 网格源规划契约

简体中文 | [English](../../en/docs/spine-mesh-source-plan-contract.md)

F2-A 是位于 `knowledge-base/experiments/spine-f2` 的开发实验。同步、无 DOM 的源规划器在运行时转换之前检查原始非加权网格数据。它不是默认 SDK 导出，也不是新的 npm 包。导入 `dist/index.js` 前，须基于已安装的公共依赖构建实验独立的 `tsconfig.json`。

准入仅限源规划。Core 兼容、deform 与动画语义、资源身份、播放、渲染和许可资格分别需要后续验收。完整 Spine 支持的 R020/V020 保持 OPEN。

## 入口与使用

当前实验导出 2 个运行时值和 10 个擦除类型。F2-A 自身保留 1 个运行时值 `createF2MeshSourcePlan(input: SpineImportInput): F2MeshSourceResult`，以及 6 个擦除类型：`F2MeshSourceSummary`、`F2SetupReference`、`F2MeshSourcePlan`、`F2MeshSourceDiagnostic`、`F2MeshSourceDiagnosticCode`、`F2MeshSourceResult`。[F2-B 契约](Spine线性动画源规格契约.md)定义 `createF2MeshProfilePlan` 与另外 4 个类型。`SpineImportInput`、`SpineImportPlan`、`SpineImportDiagnostic` 和 `SpineSourceSpan` 保留 `@egret/project/spine` 的公共身份。既有 SDK 根入口与可选规划入口不新增实验导出。

在仓库根目录，完成实验构建后：

```js
import { createF2MeshSourcePlan } from './knowledge-base/experiments/spine-f2/dist/index.js';

const provenance = {
  origin: 'Own programmatic asset',
  license: 'Own declared license',
  notice: 'Declaration only; not verified by this planner.',
};
const result = createF2MeshSourcePlan({
  skeleton: {
    id: 'own-mesh', provenance,
    text: '{"skeleton":{"spine":"4.3.13"},"skins":[{"name":"default","attachments":{"panel":{"mesh":{"type":"mesh","vertices":[0,0,2,0,0,2],"uvs":[0,0,1,0,0,1],"triangles":[0,1,2]}}}}]}',
  },
  atlas: {
    id: 'own-atlas', provenance,
    text: 'page.rgba\nsize: 2, 2\nformat: RGBA8888\nfilter: Nearest, Nearest\nrepeat: none\npma: false\npanel\nbounds: 0, 0, 2, 2\n',
  },
  pages: [{ pageName: 'page.rgba', assetId: 'own-page', provenance }],
});
if (result.ok) {
  const meshes = result.value.meshes;
  const setup = result.value.setup;
  // No slot selects this mesh: a valid source plan has an empty setup.
  // Neither the summaries nor declared page IDs grant runtime authority.
  void meshes; void setup;
} else {
  const stage = result.stage;
  const diagnostics = result.diagnostics;
  void stage; void diagnostics;
}
```

示例只描述源文本与页面声明，不加载图像，不构造 Spine runtime 或渲染帧。

## Owned 输入快照

输入只能包含下列字段。记录原型必须精确为 `Object.prototype` 或 null；列出的字段必须是 enumerable own data property。accessor、symbol、额外键和缺失必选字段会被拒绝，不调用 getter。

| 记录 | 必选字段 | 可选字段 |
| --- | --- | --- |
| 输入 | `skeleton`、`atlas`、`pages` | 无 |
| Skeleton / atlas | `id`、`text`、`provenance` | 无 |
| Provenance | `origin`、`license`、`notice` | `sha256` |
| 页面绑定 | `pageName`、`assetId`、`provenance` | 无 |

文本、标识符和 provenance 字段必须是 primitive string。记录的完整 descriptor 形状检查先于字段内容。复制次序为 skeleton、atlas，然后按索引复制 pages；provenance 次序为 origin、license、notice，然后可选 sha256。复制后的记录与数组逐层冻结。原字符串 code units 保留，不 trim、不规范化、不验证 hash。

pages 的基本资格要求真正的数组、精确的 `Array.prototype` 和标准 own length data descriptor：non-enumerable、non-configurable、writable 为布尔值，value 为非负安全整数。writable 为 false 的冻结数组有效。基本资格先于 64 页复制上限；超过上限时，在完整 own-key 枚举或任意 index descriptor 读取之前拒绝。未超过上限才检查密集数组形状：只能有 length 与连续 enumerable own data indices，拒绝子类、空洞、accessor 和额外属性。随后按索引复制各页面记录。

记录形状错误定位到记录；primitive 类型错误定位到字段；数组形状或复制上限错误定位 `/pages`。反射异常使用固定快照诊断，不暴露任意异常字符串。不保证隔离 Proxy trap 副作用、任意 intrinsic 替换或进程级内存耗尽。

## 准入顺序与源位置

快照完成后，恰好调用一次公共 SP1 规划。保留其 metadata、Unicode/bytes、严格 JSON、schema/version、atlas 和 binding 优先级。SP1 拒绝返回 `sp1` 阶段与完整原始诊断字段，包括 related spans；第二遍 visitor 不运行。

SP1 成功后，公共 `jsonc-parser` visitor 使用同一份 owned skeleton text 与 source ID。严格选项禁止注释、尾逗号和空文本。独立、有界的源视图拥有 decoded values、源次序 property pairs 和原始 token 位置。只有完整视图建立后，才检查声明版本是否精确为 4.3.13。

第二遍视图沿用公共上限：skeleton 8 MiB、atlas 1 MiB、JSON depth 32、nodes 262144、properties 131072、key 1024 UTF-8 bytes、string 65536 UTF-8 bytes、pointer 2048 UTF-8 bytes。前两项字节上限已由 SP1 检查；visitor 在保存下一项前重检自身结构上限。

按 skins 数组次序和 visitor 的 slot/attachment 属性源次序遍历，包括数字形键。全部相关容器与 encoding 检查完成后，才检查任何网格的形状或数值。因此后面的容器或 encoding 错误可以先于前面网格的数值错误。此预检之后，按 inventory 次序逐网格完成检查；前一个网格的数值错误先于后一个网格的形状错误。全部网格之后再核算静态 setup。

span 指向原始 UTF-16 offset 与完整 token length；line/column 从 1 开始，CRLF 作为一个换行。值错误使用原始 literal token；数组 shape/count 错误使用其 opening token。缺失字段保留字段 pointer，span 使用父对象 opening token。decoded pointer segment 将 `~` 转义为 `~0`、`/` 转义为 `~1`；超限使用最后已准入父 pointer 与出错 key token，不截断。缺失键没有 token，所以使用父 span。不用 token 字符串搜索来定位重复数值。source ID、pointer 和 message 都是数据，消费方展示时需要转义。

## 网格与静态 setup 规则

缺少 skins 表示无附件；存在则必须是对象记录数组。缺少 attachments map 视为空；存在的 attachments、slot map 和 attachment record 必须是对象。缺少 type 表示 region；存在的 type 必须是 string。所有 `mesh` 都检查，包括 inactive 附件和非 default skin。拒绝 `linkedmesh`，以及含 `source` 或 `parent` 的 mesh。未引用的非 mesh 特性不因此获得完整特性资格。

每个网格的固定次序如下：

| 步骤 | 规则 |
| --- | --- |
| Vertices 形状 | `vertices` 为数组，至少 6 项且长度为偶数；完整检查此字段后，才检查下一字段。 |
| UV 形状 | `uvs` 为数组，长度与 vertices 精确相同。 |
| Index 形状 | `triangles` 为数组，至少 3 项且长度为三的倍数。 |
| 原始预算 | 原始顶点数不超过 4096，然后索引数不超过 12288；允许等于上限。 |
| 坐标 | 按索引次序检查每个原 vertices 元素为有限 primitive number。 |
| UV 值 | 每项先检查有限 primitive number，再检查闭区间 [0,1]；负零有效且不规范化。 |
| 原始索引 | 按索引次序检查每个 triangle 值为 primitive safe integer，满足 `0 <= index < originalVertexCount`。 |

准入不转成 Float32 或 Uint16，不四舍五入、补零或截断。相等的 coordinate/UV 长度定义此独立非加权路径；不支持 weighted-stream 解码。本切片不证明三角形非退化、绕序、连通性、拓扑、hull、edges 或 canonical Core 输出。

按原 slots 数组次序处理引用。缺少或 null attachment 表示没有 setup 引用；否则必须是非空 string，按精确名称在 default skin 的同名 slot map 解析。只接受独立 mesh 或 region，不搜索其他 skin。缺少 type 或显式 region 计入 4 vertices 与 6 indices；已准入 mesh 使用原始 counts。合法 slot 引用分别计费，即使几何相同；同名重复 slot 仍由 SP1 拒绝。

累计 setup 准入依次检查 attachments 32、vertices 4096、indices 12288，在首次超限 slot 的 attachment token 拒绝。inactive 附件不计入 setup 合计，但其 mesh 数据已检查。没有引用有效，返回零合计。这些 totals 表示逻辑源引用，不是 Core command、batch、GPU draw 或未来动画帧预算。

## 结果数据

以下字段均为 readonly。数组、记录与复制的 span 都是冻结普通数据，不产生源规划品牌、资源权限或播放 ticket。

| 类型 | 精确字段 |
| --- | --- |
| `F2MeshSourceSummary` | string `pointer`、`skinName`、`slotName`、`attachmentName`；`span: SpineSourceSpan`；number `vertexCount`、`indexCount`、`triangleCount` |
| `F2SetupReference` | string `slotPointer`（`/slots/i/attachment` 字段）、`attachmentPointer`；`span: SpineSourceSpan`；number `vertexCount`、`indexCount` |
| `F2MeshSourcePlan` | `planVersion: 1`、owned `sp1: SpineImportPlan`、`meshes: readonly F2MeshSourceSummary[]`、`setup`、`acceptance` |
| `setup` | `references: readonly F2SetupReference[]`；number `attachmentCount`、`vertexCount`、`indexCount` |
| `F2MeshSourceDiagnostic` | `code`、`severity: 'error'`、`source: 'input' \| 'skeleton'`、`pointer`、固定 `message`、可选 `span` |
| `F2MeshSourceDiagnosticCode` | 下表精确的 13 个 code |
| `F2MeshSourceResult` | 成功：`ok: true`、`value`、SP1 `diagnostics`；拒绝：`ok: false`、`stage`、`diagnostics` |

成功保留 SP1 的 owned plan 与 warnings。acceptance 字段为 `rawMeshNumericAdmission: 'passed'`；`profileSemantics`、`animationSemantics`、`resourceIdentity`、`coreCompatibility`、`rendering` 均为 `not_run`；`licenseEntitlement` 为 `unverified`。调用方之后的修改不改变结果。输出不保留全文、原调用请求或私有 parsed view。

拒绝没有 value、partial summary 或此前 warnings。`sp1` 阶段保留原 readonly SP1 diagnostics；`snapshot`、`raw` 或 `internal` 阶段恰好返回一个冻结实验诊断。snapshot/internal 的 source 是 input，raw 的 source 是 skeleton。未预期的非诊断异常以 internal 拒绝失败闭合，不承诺进程级恢复。

## 固定实验诊断

| Code | 精确 English message |
| --- | --- |
| F2_INPUT_SHAPE | Input must use the supported ordinary own data shape. |
| F2_INPUT_LIMIT | Input exceeds the fixed owned snapshot limit. |
| F2_SOURCE_VERSION | The source version must be exactly 4.3.13. |
| F2_SOURCE_VIEW | The admitted source could not form a consistent bounded source view. |
| F2_MESH_CONTAINER | Raw mesh containers must have the supported data shape. |
| F2_MESH_ENCODING | Raw meshes must use independent unweighted coordinates. |
| F2_MESH_SHAPE | Raw mesh arrays must have the required coordinate and triangle shape. |
| F2_MESH_NUMBER | Raw mesh coordinates and UVs must be finite primitive numbers. |
| F2_MESH_UV | Raw mesh UV values must be within zero and one. |
| F2_MESH_INDEX | Raw triangle indices must be safe integers within the original vertex range. |
| F2_MESH_LIMIT | Raw mesh or setup references exceed a fixed admission limit. |
| F2_SETUP_REFERENCE | Static setup references must resolve to an independent mesh or region. |
| F2_INTERNAL_ERROR | Source planning could not complete safely. |

snapshot code 无 span；internal 使用 input 根 pointer 且无 span。版本错误使用 `/skeleton/spine` 与原 string token。source-view 失败使用实际失配位置；无位置时使用根 pointer 且无 span。其他 raw code 按上述顺序定位相关容器、字段、数组或 literal token。F2_SOURCE_VIEW 与 F2_INTERNAL_ERROR 的精确 owned fault controls 仍 PENDING；声明诊断 code 不等于它们已通过实际故障验收。

## 依赖、归属与剩余范围

规划器、测试和程序化夹具是 Apache-2.0 的白鹭第一方原创工作。有界视图消费 Microsoft [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 的公共 visitor，固定 3.3.1，独立遵循 MIT 许可。仓库根开发依赖与 lock importer 负责该依赖，通过正常 frozen-lockfile 安装解析。不包含 SDK package DAG 变更、SDK 私有 parser 导入、Core 依赖或捆绑的上游 Spine payload。

独立 metadata、atlas、provenance 与规划规则见[公共 SP1 契约](Spine导入计划契约.md)。名称、页面 asset ID、provenance 和声明 hash 都是未验证声明。规划器不验证 Editor 导出资格或任何人的权利。后续 Spine runtime 集成与分发需处理官方 [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) 与 [Spine Editor License](https://esotericsoftware.com/spine-editor-license)；本契约不授予许可资格。

完整 profile 白名单、骨骼/transform/constraint、timeline、deform、循环/混合、实际资源加载与退休、Core command range、texture/atlas 渲染、Clock 集成、浏览器/GPU 验收和设备性能都是后续工作。源计划成功不授权构造 Core 或发布动画网格。完整 Spine R020/V020 保持 OPEN。
