# Spine mesh source-plan contract

English | [简体中文](../../Cns/docs/Spine网格源规划契约.md)

F2-A is a development experiment in `knowledge-base/experiments/spine-f2`. Its synchronous, DOM-free source planner checks original unweighted mesh data before any runtime conversion. It is not a default SDK export or a new npm package. Build the experiment's standalone `tsconfig.json` against the installed public dependencies before importing its `dist/index.js`.

Admission is limited to source planning. Core compatibility, deform and animation semantics, resource identity, playback, rendering and license entitlement remain separate. Full Spine support remains R020/V020 OPEN.

## Entry and use

The experiment exports 1 runtime value, `createF2MeshSourcePlan(input: SpineImportInput): F2MeshSourceResult`, and 6 erased types: `F2MeshSourceSummary`, `F2SetupReference`, `F2MeshSourcePlan`, `F2MeshSourceDiagnostic`, `F2MeshSourceDiagnosticCode`, `F2MeshSourceResult`. `SpineImportInput`, `SpineImportPlan`, `SpineImportDiagnostic` and `SpineSourceSpan` retain their public identities from `@egret/project/spine`. Existing SDK roots and the optional planning entry do not gain experiment exports.

From the repository root, after the experiment build:

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

This example describes source text and a page declaration. It loads no image and constructs no Spine runtime or rendered frame.

## Owned input snapshot

The input must contain only the following fields. Records use exactly `Object.prototype` or null; each listed field is an enumerable own data property. Accessors, symbols, extra keys and missing required fields are refused without invoking a getter.

| Record | Required fields | Optional fields |
| --- | --- | --- |
| Input | `skeleton`, `atlas`, `pages` | None |
| Skeleton / atlas | `id`, `text`, `provenance` | None |
| Provenance | `origin`, `license`, `notice` | `sha256` |
| Page binding | `pageName`, `assetId`, `provenance` | None |

Text, identifiers and provenance fields are primitive strings. A record's complete descriptor shape precedes its field contents. Copy order is skeleton, atlas, then pages by index; provenance order is origin, license, notice, then optional sha256. The copied records and arrays are recursively frozen. Original string code units are preserved without trimming, normalization or hash verification.

For pages, basic qualification requires a genuine array with exactly `Array.prototype` and the standard own length data descriptor: non-enumerable, non-configurable, boolean writable, and a non-negative safe-integer value. Frozen arrays with writable false are accepted. Basic qualification precedes the 64-page copy cap. Exceeding the cap refuses before enumerating full own keys or reading any index descriptor. At or below the cap, the array must be dense, with only length and consecutive enumerable own data indices; subclasses, holes, accessors and extra properties are refused. Each page record is then copied in index order.

Record shape errors point to the record; primitive type errors point to the field; array shape or copy-cap errors point to `/pages`. Reflection failures use the fixed snapshot diagnostic, never an arbitrary exception string. Proxy-trap side effects, arbitrary replaced intrinsics and process-level memory exhaustion are not isolation guarantees.

## Admission order and source positions

After the snapshot, call public SP1 planning exactly once. Preserve its metadata, Unicode/byte, strict JSON, schema/version, atlas and binding priorities. An SP1 refusal returns stage `sp1` with its complete original diagnostic fields, including related spans; the second visitor does not run.

On SP1 success, use the same owned skeleton text and source ID with the public `jsonc-parser` visitor. Its strict options disallow comments, trailing commas and empty content. An independent bounded source view owns decoded values, ordered property pairs and original token positions. Only after that complete view exists is the declared version checked against exactly 4.3.13.

The second view retains the public ceilings: skeleton 8 MiB, atlas 1 MiB, JSON depth 32, nodes 262144, properties 131072, key 1024 UTF-8 bytes, string 65536 UTF-8 bytes and pointer 2048 UTF-8 bytes. The first byte limits are already enforced by SP1; the visitor rechecks its own structural ceilings before storing the next item.

Traverse skins by array order and slot/attachment properties by visitor source order, including numeric-looking keys. Complete all relevant container and encoding checks before checking any mesh's shapes or numbers. A later container or encoding error can therefore precede an earlier mesh's numeric error. After that preflight, finish each mesh in inventory order; an earlier mesh's numeric error precedes a later mesh's shape error. Static setup follows all meshes.

Spans point to original UTF-16 offsets and full token lengths; line and column start at 1, and CRLF is one line break. Value errors use the original literal token. Array shape/count errors use its opening token. Missing fields retain their field pointer and use the parent's opening token. Decoded pointer segments escape `~` as `~0` and `/` as `~1`; overflow uses the last admitted parent pointer and offending key token, without truncation. A missing key has no token, so its parent's span is used. Repeated numeric values are not located by token-string searching. Source IDs, pointers and messages remain data for consumers to escape when displayed.

## Mesh and static setup rules

Missing skins means no attachments. Present skins must be an array of object records; a missing attachments map is empty. Present attachments, slot maps and attachment records must be objects. A missing type means region; a present type must be a string. Every `mesh`, including inactive attachments and non-default skins, is checked. `linkedmesh`, or a mesh containing either `source` or `parent`, is refused. A non-mesh unreferenced feature receives no full feature qualification from this slice.

For each mesh, the fixed order is:

| Step | Rule |
| --- | --- |
| Vertices shape | `vertices` is an array with at least 6 entries and even length. Finish this check before checking the next field. |
| UV shape | `uvs` is an array with exactly the vertices length. |
| Index shape | `triangles` is an array with at least 3 entries and triplet length. |
| Original budgets | Original vertex count is at most 4096, then index count at most 12288; equality is allowed. |
| Coordinates | Every original vertices element is a finite primitive number, in index order. |
| UV values | Each UV first passes finite primitive-number admission, then the inclusive range [0,1]. Negative zero is valid and is not normalized. |
| Original indices | Each triangle value is a primitive safe integer with `0 <= index < originalVertexCount`, in index order. |

No value is converted to Float32 or Uint16, rounded, padded or truncated for admission. Equal coordinate/UV lengths define this independent unweighted path; weighted-stream decoding is unsupported. This slice does not establish non-degenerate geometry, winding, connectivity, topology, hull, edges or canonical Core output.

Slots are visited in original array order. Missing or null attachment means no setup reference. Otherwise it must be a non-empty string resolving by exact name in the default skin's same-named slot map. Resolve only independent mesh or region; do not search other skins. Missing type or explicit region contributes 4 vertices and 6 indices. An admitted mesh contributes its original counts. Different legal slot references are charged independently even when their geometry is equal; duplicate same-name slots remain an SP1 refusal.

Setup admission checks cumulative attachments 32, vertices 4096, then indices 12288, in that order at the first exceeding slot attachment token. Inactive attachments do not contribute to setup totals, although their mesh data was checked. No references is valid and yields zero totals. These totals describe logical source references, not Core commands, batches, GPU draws or future animated-frame budgets.

## Result data

All fields below are readonly. Arrays, records and copied spans are frozen ordinary data; no source-plan brand, resource permission or playback ticket is created.

| Type | Exact fields |
| --- | --- |
| `F2MeshSourceSummary` | String `pointer`, `skinName`, `slotName`, `attachmentName`; `span: SpineSourceSpan`; number `vertexCount`, `indexCount`, `triangleCount` |
| `F2SetupReference` | String `slotPointer` (the `/slots/i/attachment` field), `attachmentPointer`; `span: SpineSourceSpan`; number `vertexCount`, `indexCount` |
| `F2MeshSourcePlan` | `planVersion: 1`, owned `sp1: SpineImportPlan`, `meshes: readonly F2MeshSourceSummary[]`, `setup`, `acceptance` |
| `setup` | `references: readonly F2SetupReference[]`; number `attachmentCount`, `vertexCount`, `indexCount` |
| `F2MeshSourceDiagnostic` | `code`, `severity: 'error'`, `source: 'input' \| 'skeleton'`, `pointer`, fixed `message`, optional `span` |
| `F2MeshSourceDiagnosticCode` | Exactly the 13 codes below |
| `F2MeshSourceResult` | Success: `ok: true`, `value`, SP1 `diagnostics`; refusal: `ok: false`, `stage`, `diagnostics` |

Success preserves SP1's owned plan and warnings. Its acceptance fields are `rawMeshNumericAdmission: 'passed'`; `profileSemantics`, `animationSemantics`, `resourceIdentity`, `coreCompatibility` and `rendering` are all `not_run`; `licenseEntitlement` is `unverified`. Later caller changes do not change the result. Whole source text, the caller's request and the private parsed view are not retained in output.

Refusal has no value, partial summaries or earlier warnings. Stage `sp1` carries the original readonly SP1 diagnostics. Stages `snapshot`, `raw` or `internal` carry exactly one frozen experiment diagnostic. Snapshot/internal source is input; raw source is skeleton. Unexpected non-diagnostic exceptions fail closed as an internal refusal; no process-level recovery is promised.

## Fixed experiment diagnostics

| Code | Exact English message |
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

Snapshot codes have no span; internal uses input root pointer and no span. Version uses `/skeleton/spine` and its string token. Source-view failure uses its actual mismatch position, or root pointer without span when none is available. Other raw codes use the relevant container, field, array or literal token under the ordering above. Precise owned fault controls for F2_SOURCE_VIEW and F2_INTERNAL_ERROR remain PENDING; declaring the codes does not establish their executed fault acceptance.

## Dependency, attribution and remaining scope

The planner, tests and programmatic fixtures are original first-party Egret work under Apache-2.0. The bounded view consumes the public visitor of Microsoft's [jsonc-parser](https://github.com/microsoft/node-jsonc-parser), pinned to 3.3.1 and separately licensed under MIT. The repository root development dependency and lock importer own that dependency; normal frozen-lockfile installation must resolve it. No SDK package DAG change, private SDK parser import, Core dependency or bundled upstream Spine payload is part of this slice.

Read the [public SP1 contract](spine-import-plan-contract.md) for its independent metadata, atlas, provenance and planning rules. Names, page asset IDs, provenance and declared hashes are unverified declarations. This planner does not verify Editor export qualification or anyone's rights. Any later Spine runtime integration and distribution must address the official [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) and [Spine Editor License](https://esotericsoftware.com/spine-editor-license); this contract grants no entitlement.

Full profile allowlists, bones/transforms/constraints, timelines, deform, looping/mixing, actual resource loading and retirement, Core command ranges, texture/atlas rendering, Clock integration, browser/GPU acceptance and device performance remain later work. A successful source plan is not authority to construct Core or publish an animated mesh. Full Spine R020/V020 remains OPEN.
