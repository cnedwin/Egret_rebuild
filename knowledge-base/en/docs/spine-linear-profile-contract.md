# Spine linear animation source-profile contract

English | [简体中文](../../Cns/docs/Spine线性动画源规格契约.md)

Engineering preview **0.43.0 candidate** · specification **S096** · verification **V047**. F2-B extends the opt-in `knowledge-base/experiments/spine-f2` experiment with a synchronous, DOM-free source-profile planner. It admits a bounded static topology and linear translate/deform source description. It retains owned source text for a future compatibility bridge; it does not produce a pose, player, resource permission or rendered frame. [Evidence and current boundaries](spine-linear-profile-evidence.md) are separate from this contract. Full Spine **R020/V020 remains OPEN**.

## Entry, ownership and results

After the standalone experiment build, its public entry is `knowledge-base/experiments/spine-f2/dist/index.js`. The complete experiment namespace contains **2 runtime values**: retained `createF2MeshSourcePlan` and new `createF2MeshProfilePlan(input: SpineImportInput): F2MeshProfileResult`. It contains **10 erased types**: the retained `F2MeshSourceDiagnosticCode`, `F2MeshSourceDiagnostic`, `F2MeshSourceSummary`, `F2SetupReference`, `F2MeshSourcePlan`, `F2MeshSourceResult`, plus `F2MeshProfileDiagnosticCode`, `F2MeshProfileDiagnostic`, `F2MeshProfilePlan`, `F2MeshProfileResult`. The default SDK roots and `@egret/project/spine` gain no experiment exports or npm package.

The input is the public `SpineImportInput`, not a caller-created plan. The shared private sequence owns one descriptor-qualified snapshot, calls public SP1 planning once, forms one bounded public jsonc-parser visitor view from that same text, and completes all existing F2-A checks before F2-B. The A facade preserves its result and refusal order and discards the private text/view. The B success retains recursively frozen copied input records, provenance and page bindings; skeleton/atlas strings preserve original code units. The [A contract](spine-mesh-source-plan-contract.md) and [SP1 contract](spine-import-plan-contract.md) retain their independent limits and priorities.

In particular, ordinary own data descriptors are required; getters are not invoked. Pages qualify as a genuine ordinary array before the **64-page copy cap**, then density/index descriptors are checked. Frozen ordinary arrays are accepted. The inherited text/view ceilings are skeleton **8 MiB**, atlas **1 MiB**, JSON depth **32**, nodes **262144**, properties **131072**, key **1024 UTF-8 bytes**, string **65536 UTF-8 bytes**, pointer **2048 UTF-8 bytes**. No coercion, normalization or hash/rights verification is added. Proxy side effects, replaced intrinsics and process-level exhaustion are outside the isolation guarantee.

The new plan has these readonly fields; all records, arrays and copied spans are frozen ordinary data:

| Field | Exact content |
| --- | --- |
| `planVersion`, `profile` | `1`, `'static-unweighted-linear-4.3.13'` |
| `sourcePlan`, `ownedInput` | This invocation's unchanged A plan and copied public input |
| `page` | `pageName`, `assetId`, `width`, `height`, `regionCount` |
| `bones[]` | `name`, `pointer`, `span`, `parentIndex`, `depth`, `x`, `y`; root parent index −1 |
| `slots[]` | `name`, `pointer`, `span`, `boneIndex`, `attachmentPointer: string \| null` |
| `attachments[]` | `pointer`, `span`, `slotIndex`, `attachmentName`, `path`, `kind: 'region' \| 'mesh'`, `vertexCount`, `indexCount`; includes inactive attachments |
| `animations[]` | `name`, `pointer`, `span`, `duration`, `timelineCount`, `keyframeCount`, `expandedDeformScalarCount`, `timelines` |
| `timelines[]` | `kind: 'translate' \| 'deform'`, `pointer`, `span`, `boneIndex`, `slotIndex`, `attachmentPointer`, `keyframeCount`, `firstTime`, `lastTime`, `expandedDeformScalarCount`; translate uses bone index, deform uses slot/attachment; unused targets are null |
| `acceptance` | `sourceProfile` and `linearTimelineSourceAdmission`: `'passed'`; `coreCompatibility`, `poseNumerics`, `resourceIdentity`, `playback`, `rendering`: `'not_run'`; `licenseEntitlement`: `'unverified'` |

Valid numbers, including −0, remain unchanged. No typed array, Map, parsed visitor node, frame payload or complete parsed object is returned. These structural records have no new brand or execution authority. A future bridge must establish its own source authority and compatibility; reflecting a fabricated caller plan is insufficient.

Success is `{ok:true, value, diagnostics}` and preserves SP1 warnings. A refusal is forwarded intact, including stage, codes, messages and related spans. B refusal is `{ok:false, stage:'profile', diagnostics: readonly [F2MeshProfileDiagnostic]}`: one frozen diagnostic, no value, partial inventory or earlier warnings. Unexpected non-diagnostic exceptions use fixed `F2_PROFILE_INTERNAL`, input root and no span, without exposing arbitrary exception text. Dropping private view references does not promise a GC time or physical erasure.

## Fixed admission order

1. Complete the original A sequence: snapshot shape/pages qualification, copy cap, density; SP1 strict JSON/version/atlas/binding; bounded view; all containers/encoding; each whole raw mesh shape/budget/numeric/index admission; static setup. Any A refusal wins.
2. Complete B's global structural pass over root, metadata, bones, slots, skins/attachments and all animation maps in original property/depth-first order. Per object: unknown keys in source order, required fields in the table order below, then listed field kinds in table order. Deform payload member kinds are included. No reference, count or numeric-range checks occur here; a later shape failure can precede an earlier numeric failure.
3. Atlas: page count, dimensions, format/filter/repeat/PMA, page extras, region count, then each region's rotation/trim/index/extras.
4. Skeleton metadata; bone count and each bone's references before its values; slot count and each slot's references before fixed configuration; skin count/name, attachment total and every attachment's references/path before its values; finally require a setup mesh.
5. Animation count; for each animation complete all dynamic target references, including empty maps, before timeline count; check all timeline frame counts, expanded budgets, then frame values/time. Require an active deform after all animations.
6. Publish frozen output only after every check succeeds.

Order is visitor source order, including numeric-looking keys, rather than reordered object enumeration. Names/path are non-empty primitive strings of at most **256 decoded UTF-8 bytes**, with exact matching. An unknown field is refused even when its value is empty, null or false. Null is permitted only for an empty slot attachment.

## Exact source fields and static topology

Numeric fields below require primitive finite numbers. “Default” means omission; it does not accept null. Absolute coordinate bounds are **65536**.

| Object | Required fields, in order | Optional fields, in order and qualification |
| --- | --- | --- |
| Root | `skeleton,bones,slots,skins,animations` | None |
| Skeleton | `spine` | `hash`: string; `x,y`: absolute bound; `width,height`: [0,65536]; `fps`: (0,240]; `images,audio`: string declarations with no I/O; `referenceScale`: exactly 100. Version is exactly 4.3.13 through A. |
| Bone | `name` | `parent`: non-empty string; `x,y`: default 0/absolute bound; `length`: default 0/[0,65536]; `rotation,shearX,shearY`: default or 0; `scaleX,scaleY`: default or 1; `inherit`: default or `'normal'`; `skin`: default or false; `color`: eight ASCII hex digits; `icon`: string; `iconSize`: [0,65536]; `iconRotation`: absolute bound |
| Slot | `name,bone` | `attachment`: omitted/null or non-empty string; `color`: default or `'ffffffff'`; `blend`: default or `'normal'`; `visible`: default or true |
| Skin | `name,attachments` | `color`: eight ASCII hex digits; name must be `'default'` |
| Attachment maps | Dynamic slot-name / attachment-name keys | Slot must exist; each attachment is an object |
| Region | `width,height` | `type`: default or `'region'`; `name,path`: non-empty strings; `x,y`: default 0/absolute bound; `rotation`: default or 0; `scaleX,scaleY`: default or 1; `color`: default or `'ffffffff'`; dimensions (0,65536] |
| Mesh | `type,vertices,uvs,triangles` | `type` exactly `'mesh'`; `name,path` as region; `color`: default or `'ffffffff'`; `width,height`: [0,65536]; `hull`: safe integer [0,vertexCount]; `edges`: even-length number array, length ≤24576, each safe integer [0,vertexCount−1] |
| Animation | None | `bones,attachments`: objects |
| Animation bone entry | None | `translate`: array |
| Attachment timeline maps | Dynamic default-skin / slot / attachment keys | Existing independent mesh targets only; innermost object admits only `deform`: array |
| Translate frame | None | `time,x,y` |
| Deform frame | None | `time,offset,vertices` |

Path falls back to the attachment's `name`, then its map key, and must resolve exactly to one atlas region. There is no path normalization or inferred sequence suffix. Constraints, events, IK, transform/path/physics features, dark color, skin bone/constraint lists, attachment sequences, linked/weighted meshes, rotations, scaling/shearing timelines, attachment switching and curves are outside the field allowlist. No topology, winding, connectivity or triangulation proof is added.

There are **1..32 bones**, one root at index 0 without parent, root depth 1 and maximum depth **8**. Every later bone requires an exact earlier parent; self, forward and unknown references are refused. Setup supports translation only. There are **1..32 slots**, exactly **one default skin**, and **1..64 total attachments**, including inactive ones. Every attachment is checked. Raw mesh caps remain **4096 vertices / 12288 indices**; positions additionally satisfy the absolute bound. A setup still independently charges each legal slot reference, with cumulative caps **32 references / 4096 vertices / 12288 indices**; regions contribute 4 vertices/6 indices. B requires at least one selected setup mesh. These logical totals are not Core commands or draw counts.

Atlas qualification requires exactly one page, positive integer axes ≤**2048**, defensive RGBA logical size ≤**16777216 bytes**, RGBA8888, Nearest/Nearest, repeat none, PMA false and no page extras. There are **1..64 regions**, rotation 0, both offsets 0, original dimensions equal packed dimensions, index −1 and no extras. SP1 bounds remain authoritative. At these axis limits the RGBA size guard is defensive, not a separate reachable ordinary overflow witness. Declared asset IDs/provenance do not verify texture bytes, crop, sampler or rights.

## Linear timeline and deform rules

All **1..8 animations** are checked. Only bone translate and default-skin mesh deform timelines are admitted. Within each animation every dynamic bone, skin, slot and attachment key is resolved, ancestor before child and in source order, **even when its child is empty**. Known eligible empty maps are legal and add no timeline; unknown or wrong-kind targets receive REFERENCE at the original key. Complete this reference pass before counts, so an unknown empty target wins over another timeline's minimum-frame failure. The preceding global structure pass still has priority over references.

Each animation admits **1..128 timelines** and at most **4096 cumulative keyframes**. Each present timeline has at least **2 frames**. The 128 guard is defensive: the other allowlists limit ordinary legal structures to at most 32 bone plus 64 mesh targets, or **96** timelines. It is not a claim of ordinary 128/129-case coverage. Any `curve` field is refused, including null, false, `'linear'` or a final-frame field.

Time defaults to 0; present time must be finite in **[0,60]**. First time is 0, original binary64 times strictly increase, last time is positive, and `Math.fround(time)` must be finite and strictly increasing too. Original ordering is checked before Float32 ordering. Tiny positive times that round to zero and distinct doubles that merge in Float32 are refused. Output times/durations retain binary64 values; duration is the maximum last time. This qualification is not a Core pose-precision guarantee. Translate x/y default to 0 and satisfy the absolute bound; no world transform is calculated.

Deform coordinate count is **2 × original vertex count**. `vertices` may be omitted or a number array, including empty; each delta is finite with absolute value ≤65536. `offset` defaults to 0; when present it is a safe integer in [0,coordinateCount], and requires present `vertices`. Offset plus payload length must fit. Component offsets and odd-length sparse payloads are legal; deltas need not be integers. No padding, narrowing, deformed vertices or frame expansion is produced.

Diagnostic partition is exact:

| Condition | B code and location |
| --- | --- |
| Wrong listed field/container kind, including null deform payload, or a non-number deform `vertices` member | Global SHAPE, original value/member token. Other array-member kinds remain in their later numeric checks; non-number `edges` entries, such as `edges:[null,0]`, receive F2_PROFILE_NUMBER there. |
| Numeric time outside [0,60], coordinate/delta outside the absolute bound, or non-finite numeric field | NUMBER, original number token |
| Finite offset not a safe integer, outside its component domain, present without payload, or payload extent overflow | DEFORM; offset token, or payload opening for extent without explicit offset |
| In-domain time with wrong first/last value, non-increasing binary64 or collapsed/non-increasing Float32 | TIME; present time token, or frame pointer/opening when default time was omitted |

Within a frame, check time, then translate x/y; for deform check time, offset finite/integer/domain/presence, each delta, then extent. A late global shape error still precedes an early range error. Literal `1e400`, bare NaN or Infinity is already a public SP1 strict-JSON/non-finite refusal (`stage:'sp1'`, `SPINE_JSON_SYNTAX`); it is not a B non-finite witness fabricated from a parsed object.

Each deform timeline is charged `coordinateCount × keyframeCount`, even with omitted, empty or sparse payloads. Expanded scalar caps are **262144 per animation** and **1048576 per asset**; equality is allowed. At the first exceeding timeline check per-animation before asset, using that timeline's opening token. References and frame counts precede charging; frame numbers follow it. The hypothetical Float32 contents correspond to 1 MiB/4 MiB, not measured peak memory or a bound on all Core allocations. At least one deform must target the mesh selected by that slot's setup; inactive targets remain fully checked.

## Diagnostics and original locations

`F2MeshProfileDiagnostic` has readonly `code`, `severity:'error'`, `source:'input'|'skeleton'|'atlas'`, `pointer`, fixed `message`, optional `span`. The 11 B codes use these exact English messages in both language editions:

| Code | Message |
| --- | --- |
| F2_PROFILE_SHAPE | The source must use the supported static profile shape. |
| F2_PROFILE_FIELD | The source contains a field outside the supported static profile. |
| F2_PROFILE_ATLAS | The profile requires one untrimmed nearest straight-alpha atlas page. |
| F2_PROFILE_REFERENCE | A profile reference must resolve to the required source target. |
| F2_PROFILE_TRANSFORM | Setup transforms and colors must use the supported fixed profile. |
| F2_PROFILE_NUMBER | Profile values must satisfy the finite numeric domain. |
| F2_PROFILE_TIME | Linear timeline times must remain strictly ordered in binary64 and Float32. |
| F2_PROFILE_DEFORM | Deform data must fit the original independent mesh coordinates. |
| F2_PROFILE_LIMIT | The profile exceeds a fixed source or expanded-data budget. |
| F2_PROFILE_REQUIRED | The profile requires an active mesh and an active linear deform timeline. |
| F2_PROFILE_INTERNAL | Profile planning could not complete safely. |

Unknown fields use FIELD/key token; fixed transforms/configuration use TRANSFORM; counts, depth and budgets use LIMIT; missing active use receives REQUIRED. A's 13 codes and stages are retained, not renamed to B codes.

Spans use original UTF-16 offset/length, one-based line/column and CRLF as one line break. Decoded pointer segments escape `~`/`/`; pointer overflow retains the last admitted parent. Value/ref failures use actual value tokens, dynamic targets/unknown fields their key tokens, and missing fields the enclosing opening token. Counts normally use collection openings. Atlas has no invented collection token: page-count ATLAS points to `/pages` with the first admitted page header; dimension LIMIT to `/pages/0` with that header; region-count LIMIT to `/pages/0/regions` with that page header; region restrictions use `/pages/0/regions/i` and its region header. Extras retain their actual saved spans.

A later bone missing parent receives REFERENCE at `/bones/i/parent` and its bone opening; present wrong-kind parent is earlier global SHAPE. Root string-parent, empty, unknown, forward or self-parent refusals use the actual parent string token; depth LIMIT uses that token. Missing setup mesh/active deform uses `/slots`/`/animations` openings. Repeated literals are not searched to reconstruct positions. Consumer displays must escape source IDs, pointers and messages as data.

## Sources and remaining scope

The planner and programmatic fixtures are original first-party Egret work under Apache-2.0; repository-root `LICENSE` and `NOTICE` retain attribution. Microsoft's [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) **3.3.1**, MIT, is the existing root development dependency/lock-owned grammar foundation. No private SDK parser, new SDK dependency or bundled upstream Core payload is introduced.

The design references the locally pinned official **Spine Core 4.3.13**, upstream source commit `b7beb2ccbbce667a12c02f44d070644f59b04968`: [SkeletonJson source](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts), [official runtime repository](https://github.com/EsotericSoftware/spine-runtimes). Lookup and component-offset behavior inform a separately defined Egret allowlist; they do not establish equivalent Core error priority or numerical compatibility. The independently authored Egret implementation and programmatic fixtures remain separate from upstream source and artwork.

The saved **2026-10-12** source refresh recorded the official [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) and [Spine Editor License](https://esotericsoftware.com/spine-editor-license) pages as last updated **2025-04-05**. This is attribution and a future qualification boundary, not entitlement, legal clearance or Editor-export certification. Core compatibility, pose numerics, mixing/looping/seeking, runtime resources, Clock/display integration, browser/GPU/native/device behavior, performance and full Spine remain separate work. Source admission alone does not authorize runtime construction or distribution.
