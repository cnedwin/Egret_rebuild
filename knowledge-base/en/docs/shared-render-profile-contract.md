# Texture pages and shared rendering contract

English | [中文](../../Cns/docs/shared-render-profile-contract.md)

2026-10-18 · M1.3 · Implementation specification; execution and acceptance remain pending

## Purpose and compatibility

Complex interfaces and animated atlases need many independently positioned regions of the same image. Uploading a separate texture for every crop duplicates work and obscures the relationship between source data, sampling and GPU ownership. M1.3 separates immutable source pages, logical regions and device resources, and introduces one explicit linear-composition profile for 2D content and the existing bounded 3D scene subset.

The profile is `egret.shared-frame2d/1`. It extends the existing display tree, Texture, AssetLease, Engine frame registry and WebGPUHost submission lifecycle. It does not create a second scene or asset system. Existing Canvas, textured frames and encoded B1 results retain their contracts and error order. Old entries explicitly refuse new metadata they cannot represent; saved old frames never acquire a new color interpretation.

This is one package in the [M1 plan](m1-rendering-resource-plan.md). Complete Spine integration remains M2; WebGL2 execution is M1.4; manifests, device reconstruction and sustained mixed-scene acceptance are M1.5. The finite linear B1 path described here ships with M1.3. M1.2 performance acceptance remains open independently of this package.

## Public API and authoritative state

Contracts owns the single authenticity registry for each new material/geometry value. Its package root exports isSharedMaterial2D and isSharedGeometry2D for runtime/rendering; neither the runtime nor engine facade forwards these guards. They convey no asset, frame or GPU authority.

The root SDK adds three CPU constructors: `createTextureView(image, region)`, `createSharedMaterial2D(input)` and `createSharedGeometry2D(input)`. The first returns a genuine existing Texture. Material and geometry values are immutable and independently authenticated; shape, a copied symbol or a cloned object supplies no authority.

`SHARED_FRAME_PROFILE_2D` selects the new branch of `createEngineForProfile`. Engine adds `captureSharedFrame` and `renderSharedFrame`; both share its current frame ID counter, open/clock/reentry barriers and completed-frame registry. Failed capture consumes no ID; a Host failure after frame registration consumes that committed ID. Replaying a saved frame advances no clock or animation. The old capture methods retain their original return types.

`DisplayObject.sharedMaterial` defaults to null and inherits the nearest ancestor's complete material. An explicit identity material resets inherited effects; null does not reset them. Materials are replaced as values, not multiplied at every ancestor. `renderBoundary` is either `none` or `isolate`. Setters obey existing node/Engine lifetime checks and invalidate the corresponding appearance state.

Mesh2D gains a geometry type parameter defaulting to TexturedGeometry2D. Its getter remains `G | undefined` after clear/disposal. Existing consumers retain their original type; a new SharedGeometry2D never passes the old geometry brand check. Both use the same genuine mesh content slot and exact borrowed Texture lease.

Optional entries add `createSharedWebGPUHost` and `createSharedSceneWebGPUHost`, with `renderSharedFrame` and `renderSceneSharedFrame` respectively. They reuse the internal Host/device/submission owner. New factories advertise only supported protocols; an unsupported old method refuses before reading its frame payload. The scene factory requires an explicit outputAlpha of opaque; its overlay must also be opaque. The general 2D factory defaults to premultiplied. Existing factories retain their behavior. Canvas remains isolated in `@egret/engine/web`; the default SDK adds no browser or Spine dependency.

`SharedWebGPUHostOptions` adds only outputAlpha to the existing textured options. Its snapshot reads the 18 existing top-level fields, then outputAlpha, then the selected device policy. `SharedWebGPUReadback.alphaMode` reports premultiplied or opaque; the old readback type retains its original premultiplied literal. `getSharedStatus()` reports the existing Host status plus pendingGeometryBytes, pendingColorBytes and pendingCanonicalBytes. The last field counts accepted conversion outputs still held by submissions, not total temporary memory. Shared scene additionally retains the existing `getSceneStatus()` contract.

## Input stages and errors

Material reads all top-level fields once in this order: light, dark, blend, samplingDomain, filter, addressU, addressV, regionIsolation, mipLevel, minFilter, magFilter, maxAnisotropy. Only then does it validate tuple brands/lengths, read own tuple slots, validate values and supported combinations, and publish frozen owned data. Geometry reads positions, uvs, lightColors, darkColors, indices; all native array tags precede any backing check, shape/capacity precede every copy, and every native copy precedes component validation. Caller iterators/species are not used. A failed read stops the stage and preserves its exact cause.

Pure contracts factories use TypeError/RangeError with their declared messages; read wrappers preserve cause, while actual native intrinsic/allocation failures retain their identity. They do not depend on runtime EgretError. Runtime adds only TEXTURE_VIEW_REGION_INVALID, TEXTURE_VIEW_REGION_IMMUTABLE, FRAME_PROFILE_METADATA_UNSUPPORTED and SHARED_MATERIAL_UNSUPPORTED. The latter describes an effective material/content mismatch after resource qualification, not an unsupported factory option. Old source, lease, lifecycle and error precedence remain. Engine render wraps a direct Host failure as FRAME_RENDER_FAILED with the original cause; direct Host calls expose their Host error.

## Sources, regions and ordinary display content

The current source is authentic straight-alpha, top-left, sRGB RGBA8 ImageData2D, identified by object identity. Equal bytes in two source objects do not merge owners. Texture.imageData remains that genuine source; Texture.width/height and sourceRect retain packed-image meaning. A new read-only viewRegion records packed rectangle, logicalWidth/Height, trimX/Y and clockwise quarterTurn 0–3. Odd turns swap content dimensions. All fields are safe integers; content must fit both its page and untrimmed logical extent.

Texture-view descriptor reads are ordered: packed, logicalWidth, logicalHeight, trimX, trimY, quarterTurn; then packed x, y, width, height. Validation and owned snapshots finish before publication. Disposing the Texture wrapper does not invalidate a completed frame's retained source values. Explicit views reject sourceRect mutation; replacement uses a new view and the existing binding transaction.

| Consumer | Shared-profile behavior |
| --- | --- |
| Bitmap and resource/binding slots | Preserve exact lease, entitlement, token and atomic commit/rollback. The real bitmap slot stores packed and logical region data together; natural dimensions use the logical extent. |
| SequenceClip/SequencePlayer | Preserve full-page old Texture qualification, exact lease and applyAt rules. Capture translates the already committed crop/layout once and never advances time. Cross-page and complete Spine sequences remain later adapter work. |
| NineSliceBitmap | Build from untrimmed, unrotated logical dimensions. All nine pieces sample the same complete region; internal slice boundaries do not clamp separately. Leaf state and mesh slot publish atomically. Page-domain sampling is refused. |
| Mesh2D | Old geometry supplies linear light coefficients and zero dark coefficients in this explicit profile. New geometry supplies light RGBA, dark RGB and qualified UV values. Material selects the UV domain. |
| Graphics | Each primitive retains its encoded fill color and alpha. Decode fill RGB once; primitive alpha enters the final source once, separately from ancestor opacity. |
| TextField | Consume only the committed raster and current Scope/lease. Capture performs no font request or preparation and does not apply baked text color/alpha again. |

SequencePlayer and SpriteSheet accept the existing full-page Texture atlas contract. An explicit view remains immutable even when its packed rectangle fills the source page. SequencePlayer rejects it with SEQ_ATLAS_MISMATCH at the existing atlas check, after mode and clip authentication; SpriteSheet uses SPRITE_SHEET_ATLAS_INVALID after current resource qualification and before reading frame descriptors. An existing player whose Bitmap changes to another lease still reports SEQ_BINDING_CHANGED first. Internal atlas publication cannot bypass the view crop restriction. Legacy atlas layouts keep their existing integer range; conversion to this shared profile requires logical extents and trim values no greater than 2^20. After current resource qualification, an unrepresentable layout refuses with FRAME_PROFILE_METADATA_UNSUPPORTED. Legacy capture remains unchanged.

Region-domain Bitmap uses a complete logical quad with virtual transparent trim. Page-domain Bitmap draws its actual content quad at the trim offset and uses packed page UVs; it does not apply region coverage again. Existing bounds, layout and explicit hitArea remain the source of their own behavior.

## Material and color interpretation

The material stores light RGBA, dark RGB, blend, samplingDomain, filter, addressU/V, regionIsolation, mipLevel, minFilter/magFilter and maxAnisotropy. Defaults are identity light, zero dark, normal blend, region domain, nearest filter, clamp-to-edge, bounded isolation, mip 0 and anisotropy 1. Supported filters are nearest and linear, with minFilter = magFilter = filter. Region addressing is clamp-only; page addressing additionally supports repeat and mirror-repeat. Unsupported requests refuse rather than silently changing sampling. Page-domain isolation uses the bounded placeholder; strict isolation applies only to regions.

All light/dark coefficients are linear values in [0,1]. Let a page sample be premultiplied (P,a), vertex coefficients be Lv/Kv/tv, material coefficients be Lm/Km/tm, and accumulated display opacity be o:

```text
V  = P * Lv + (a - P) * Kv
S  = o * tv * tm * (V * Lm + (a - V) * Km)
as = o * tv * tm * a
```

Image/text vertices use identity coefficients. Graphics can use white source, Lv = decoded fill RGB and tv = primitive alpha. UV/color interpolation uses explicitly rounded f32 preparation values; 2D interpolation is linear and B1 retains perspective interpolation.

| Blend | RGB with destination C | Alpha with destination ad |
| --- | --- | --- |
| normal | S + C(1 − as) | as + ad(1 − as) |
| add-accumulate | S + C | as + ad |
| add-preserve | S + C | ad |
| multiply-factor | S*C + C(1 − as) | as + ad(1 − as) |
| screen | S + C(1 − S) | as + ad(1 − as) |

The target subsequently saturates and quantizes. Add-preserve requires opaque output with an alpha-one clear; transparent output refuses it before presentation. Multiply-factor denotes this factor equation, not CSS multiply. These linear recipes do not promise pixel identity with an encoded-space Spine renderer.

## Canonical pages, filtering and output

The source representation is `egret.srgb-straight-rgba8/1`; its page representation is `egret.alpha8-capped-srgb-pma8/1`. Define standard sRGB decode D and encode E. For source channel byte C and alpha byte A, a = A/255 and P = aD(C/255). Store alpha A and RGB min(round(255E(P)), cap[A]), where cap[A] is the largest byte b for which D(b/255) ≤ a. Round is floor(x+0.5); transparent RGB is zero. The fixed 256-entry cap table has an independent exact reference. Compared with uncapped encoding this alpha8 representation can decrease a channel by one additional code; that is not a lossless or final-image error guarantee.

Pages use single-mip rgba8unorm-srgb, four bytes per texel. Conversion is charged by the full source page and occurs once for a newly resident page, not once per region. Encoded-premultiplied and floating-point source representations are reserved design extensions and explicitly unsupported here; they are not disguised as existing ImageData2D values.

For region sampling, q = (uW,vH) is the interpolated logical texel position. For either axis, with logical extent W, trim t and content extent w:

```text
r = clamp(q, 0.5, W - 0.5)
c = clamp(r, t + 0.5, t + w - 0.5)
g = min(1, max(0, r - t + 0.5), max(0, t + w + 0.5 - r))
```

Bounded linear sampling maps c into packed page coordinates after the declared quarter-turn and multiplies the sampled value by gx*gy. Strict region sampling uses four integer logical taps, transparent trim and integer rotation before weighting. Nearest uses a fixed floor rule and integer load. Page-domain UVs address the source page directly, with clamp/repeat/mirror applied at the sampling stage. Never clamp or wrap vertex UVs before interpolation. POT and NPOT pages use the same policy; no atlas gutter is required by the descriptor.

WebGPU hardware linear sampling decodes sRGB texels before filtering. Its bounded region path has declared finite quality targets, not a universal promise of zero neighboring contribution. Strict integer region loads preserve the texel-index boundary. A sampled RGB-to-alpha clamp is only a numerical guard. WebGL2 may implement the same canonical reference through manual decoding/filtering because its applicable specification permits a different sRGB filter order.

The working target is rgba8unorm-srgb, with linear blending and format quantization after every write; it is not a floating-point target. Clear color is authored encoded RGB, decoded and multiplied by clearAlpha. Transparent output defaults to alpha-zero clear. Opaque output requires alpha-one clear. Frame and Host outputAlpha must agree.

One final resolve writes an ordinary preferred rgba8unorm/bgra8unorm canvas view with blending disabled. For decoded target (C,a), first clamp RGB to [0,a]. Transparent output is (aE(C/a),a), with zero at a=0; opaque output is (E(C),1). Canvas color space is sRGB and alpha mode matches outputAlpha. Copying internal encoded premultiplied pixels directly to the browser canvas is not equivalent. Readback records and normalizes the actual RGBA/BGRA storage order.

## Frames, ordering and finite B1 composition

A completed frame owns frozen commands/pages/regions/materials/geometries arrays. Tables use first actual draw occurrence: pages by source identity, regions by source and complete region tuple, materials by complete value, geometries by authentic immutable identity. Every call creates new top-level arrays and frame identity. Saved frames contain no mutable display object, lease or Texture wrapper references.

Draw order remains node rectangles, Bitmap, Mesh, committed text, then children. Commands preserve dense ordinal, source occurrence, material, opacity and ordered clips. Explicit isolate enter/exit events remain even for a reached hidden/alpha-zero/empty node; an entirely skipped ancestor subtree emits no descendant events. Effective clip boundaries and validated empty/degenerate/clipped-out content preserve barriers. These are rendering boundaries, not a claim that a complete Spine slot adapter already exists. Capture emits a public empty barrier only for qualified content it has itself proved empty. Later Host clipping preserves the saved frame and its tables, retaining any newly empty draw as a private ordered preparation boundary. A resource or capability refusal remains an error.

Only contiguous compatible draws may batch; preserve full ordinal ranges and never cross A–B–A order, region differences, empty events or boundaries. Sharing a page does not require merging all its regions. Current resource/Scope checks and complete logical charges run even on cache hits. A correct cold path is permitted where caching is not yet implemented.

The new scene path accepts a genuine existing SceneFrame3D plus an opaque shared frame. It keeps bounded opaque vertex RGB geometry, current MVP/index conventions and reverse depth clear 0/greater/write. It decodes each authored vertex RGB before f32 packing and perspective interpolation. The old encoded B1 shader/reference remains separate. Scene and UI plan atomically, draw into one owned target with one clear, then perform one resolve; UI ignores scene depth. Unsupported scene/alpha combinations refuse before submission.

The initial shared collector and geometry preparation use a complete cold path. Existing derived-cache profiles and their address scheme remain unchanged; this path adds no second cache allowance. Adjacent batching remains required and uses the same 8 MiB concatenation owner. Compatibility includes the complete material, region, source, sampling strategy, opacity and ordered clips. Logical fees are charged before any physical merge. Cold-path correctness is separate from performance acceptance.

## Budgets and lifetime

These are logical admission/ownership ledgers, not exact JavaScript heap or driver-memory measurements. Checked integer arithmetic and full charges precede publication. Cache hits and partial visibility do not reduce logical fees.

| Ledger | Bound |
| --- | --- |
| Source | Existing axis ≤4096, pixels ≤1,048,576 and bytes ≤4 MiB per image |
| Frame pages | ≤64 unique sources; source bytes ≤16 MiB and canonical requested bytes ≤16 MiB separately, including ready hits |
| Regions/materials | ≤128 distinct regions and ≤256 complete materials |
| Tree/commands | ≤65,536 nodes, authoring units, occurrence-charged source triangles and draw-plus-barrier commands; ≤262,144 ordered clip references |
| Geometry | V≤65,536, I≤196,608; indices in triples; new payload 88V+4I bytes, old payload 64V+4I; each ≤4,980,736 bytes, ≤128 unique values/16 MiB per frame |
| Preparation | ≤1,048,576 vertices, 4,194,304 predicates, 1,048,576 tuple comparisons, 64 clip polygon corners |
| Upload | Default 32 MiB per call/64 MiB pending; 44-byte new 2D vertices and 128-byte non-dynamic draw uniforms, plus generated indices/B1 charges |
| Page transient/ready | Pending texture ≤32 MiB; CPU conversion/upload scratch ≤32 MiB; all profiles share ready residence ≤32 MiB/256 entries |
| Derived caches | Existing per-Stage 16 MiB/65,536-entry and per-Host 16 MiB/4,096-address totals; old/new profiles share them |
| Active color targets | Four bytes per backing pixel, ≤64 MiB per frame and ≤128 MiB for at most two accepted frames; configured/device caps may be stricter |
| Reusable retention | Buffers plus owned color/depth targets share one 32 MiB/4,096-entry idle-and-return-reservation authority |
| Other existing bounds | Batch concatenation ≤8 MiB; readback staging plus output defaults to ≤64 MiB; original B1 geometry/uniform/depth limits remain, including depth ≤16 MiB per call/32 MiB pending |

The packed vertex stride is 44 bytes: position float32x2 at 0, UV float32x2 at 8, light float32x4 at 16 and dark float32x3 at 32. The 128-byte draw uniform is eight aligned vec4 blocks: viewport/opacity at 0, light/tint at 16, dark at 32, logical extent/trim at 48, content extent/packed origin at 64, packed extent/turn/domain at 80, sampler policy at 96 and page/execution data at 112. Unused padding is zero. Opacity, vertex alpha and material alpha each apply once. Every logical draw retains its 128-byte uniform charge even when batching reduces physical allocations. Blend/output policy and resource/session identity remain complete separate key fields.

Frame metadata has a separate 32 MiB logical limit: header 256; each of five tables 24+8*length; page record 96; region 128; material 192; draw 192; barrier 64; owned clip value 80; clip-array 24+8*length. Payload is charged separately, and shared immutable clip values are counted once while every reference is charged. This does not limit caller-retained frame totals or imply a physical heap bound.

Texture/page keys include real source identity, representation, format, usage, mip count and device session. Target keys include kind, dimensions, format, usage, sample/mip/layer count, recipe and session. Borrowed canvas textures never enter a pool. Every accepted target is exclusive until all queue, error-scope, mapping and readback obligations settle.

The Host remains the sole native lifecycle owner. A shared private retention authority handles atomic reservations and identities only. Reserve return capacity before publishing idle resources; rollback preserves all owners still requiring native cleanup. Eviction uses global return FIFO. Oversized or overflow targets are transient rather than a new optional-pool rejection. Unknown destruction retains its charge, disables session reuse and stops acceptance; it is never treated as successful release. Unknown memory can exceed the idle limit and must be reported separately.

Page conversion admission counts already-held shared canonical outputs, this call's unique cold outputs and the largest one-page source-copy temporary together, with a 32 MiB peak limit. An individual call exceeding that bound is WEBGPU_FRAME_BUDGET; excess caused by pending work is WEBGPU_BACKPRESSURE. Both refuse before native effects. A READY hit retains its logical page fees but requires no conversion copy. Two concurrent cold conversions of the same source each own and charge their outputs. A two-frame concurrency limit therefore does not promise admission for two maximum-size cold workloads. Mixed buffer/target claim and return reservations are atomic under the one retention authority.

## Numeric qualification and verification

New positions/UVs are checked for finite input, explicitly rounded with Math.fround, then checked for their rounded finite/range validity. Light/dark coefficients must first satisfy the original finite [0,1] input range before rounding, so an out-of-range value cannot gain admission by rounding. New immutable factories normalize signed zero. Logical extents and qualified interpolated q are bounded by 2^20. This is an arithmetic bound, not a precision proof. The Host preparation stage validates GPU q qualification; pure capture does not enforce that device-execution rule. Periodic page q has an initial tighter absolute bound of 8192 texels; exceeding it refuses without vertex wrapping or probe-based admission. The independent reference preserves the declared rounded input and distinguishes binary64 reference calculations from product f32 execution.

Before native execution, freeze source/build identities, exact cases, sample coordinates, output policy, literal expected RGBA, layer counts and negative-control margins. The reference independently performs source encoding, taps/trim/rotation, material, each blend and target quantization, then resolve. It never calls product helpers to produce expectations.

| Finite quality row | Per-channel absolute RGBA8 error limit |
| --- | --- |
| Q0: identity-material transparent zero, opaque primary/black/white endpoints, declared uncovered regions | [0,0,0,0] |
| Q1: one flat/nearest layer | [1,1,1,1] |
| Q2: one filtered/trimmed/two-color layer, or one scene gradient | [2,2,2,1] |
| Q3: two–four effective color writes, including scene and UI | [3,3,3,2] |

Each named pixel/channel must pass; no averaging hides failures. Red-region/blue-neighbor tests separately require forbidden blue ≤1 for bounded hardware and exactly zero for strict sampling. Transparent safe areas remain exact zero. A scene write rejected by depth is not a color layer; a far write later overwritten by a near write counts twice. Four layers bound this fixture's proof, not general runtime scene size.

An assigned native wrong-model witness must differ by at least 16 codes and at least 4T+4, where T is its channel tolerance, before execution. A timeout or import error is not a pixel counterexample. One-code cap omissions use exact CPU controls. Retain complete raw images and separately check transparent RGB≤alpha and opaque alpha=255; those checks are not full-image color comparisons.

Coverage includes four rotations, trim, no-gutter boundaries, both UV domains, wrapping, nine-slice, clips, two-color coefficients, every blend/alpha policy, ordering, saved frames, real concurrent targets, failures and new linear B1. Small and maximum legal POT/NPOT page pairs run separately within page budgets. Real browser results, allocation/upload counts, timing, other devices and physical display appearance remain distinct. Failures stay recorded and thresholds cannot be fitted after observation.

## Reproducible finite native matrix

The fixed inputs and literal target bytes are in `tools/shared-rendering/native-cases.json`. Run `node tools/shared-rendering/check-native-cases.mjs` to reconstruct input-to-reference relationships from source page patterns, geometry, UVs, clips, material and layer order. This check shares the scalar color oracle; it establishes neither a second independent color oracle nor product or browser acceptance.

| Group | Cases | Named points | Scope |
| --- | ---: | ---: | --- |
| A | 3 | 42 | Exact endpoints, flat alpha and output resolve |
| B | 4 | 52 | Two-axis filtering and two-color coefficients |
| C | 4 | 56 | Trim, rotations and bounded/strict region isolation |
| D | 3 | 46 | Region/page domains, address seams and nearest floor |
| E | 5 | 34 | Interpolated UVs, nine-slice seams and clip coverage |
| F | 4 | 31 | Blend modes, mixed order and alpha policies |
| G | 4 | 12 | Linear B1 with zero to three UI writes and nested clips |
| H | 3 | 48 | Legal POT/NPOT page-size pairs without neighboring bleed |

The 321 points comprise 299 color points and 22 coverage-only points, with 1,236 assigned channel comparisons and 104 additional bleed checks. Eleven wrong-model witnesses have fixed scalar margins. Each actual native mutation still requires a healthy run, one recorded product-emission change, its assigned numeric failure and a restored healthy run. A missing capability, startup error or timeout never supplies that numeric failure.

The opt-in collector is `node tools/verify-shared-webgpu.mjs --playwright <absolute-installed-package> --channel msedge --output <fresh-absolute-private-directory>`. It uses the selected Node 26.7.0 and Playwright 1.62.1, default Edge without additional flags, a 256×256 backing surface and explicit rendering pixel ratio 1. Actual browser DPR, adapter, device limits, source/emitted inputs, readback and cleanup are recorded. A known fallback adapter is outside this hardware-quality run. Complete RGBA and black/white background screenshots are retained before cleanup. These screenshots do not qualify physical display appearance or ICC behavior.

Raw files and failed receipts remain private execution artifacts; the public evidence records their actual scope and relevant identities. A qualified named-point violation is FAIL. Unproven execution, source identity or cleanup is INCOMPLETE. These fixed checks do not replace legacy browser regressions, full local gates, other devices or sustained performance.

The current contributor entry also exposes this collector as `node tools/browser-verify.mjs --suite shared-webgpu --playwright <absolute-installed-package> --output <fresh-absolute-private-directory>`. It requires the complete 63-run schedule, retained raw samples, assigned failures and cleanup receipts. The [implementation record](shared-rendering-evidence.md) separates observed results from the remaining package obligations.

## Implementation and acceptance

Implement in four connected steps: authentic CPU inputs and independent references; existing display/lease capture with ordered preparation; shared page/target/Host execution including linear B1 and final resolve; then full regressions, actual browser matrix, bilingual evidence and protected integration. These are internal steps of one deliverable, not additional project milestones.

Completion requires the public SDK chain and old strict consumers, meaningful failure controls, independent source/result review, all affected legacy browser gates and new finite native acceptance. Full Spine, authorized Editor assets, mobile hosts, M1.2 formal timing and M1.5 recovery/sustained workloads retain their own open acceptance. No speedup follows merely from fewer allocations or uploads.

## Sources and independent implementation

The representation and ownership code are first-party Egret work under Apache-2.0. API and numerical requirements use the [WebGPU format rules](https://gpuweb.github.io/gpuweb/#texture-formats), [filter modes](https://gpuweb.github.io/gpuweb/#enumdef-gpufiltermode), [WGSL textureSampleLevel](https://gpuweb.github.io/gpuweb/wgsl/#texturesamplelevel), [WebGPU conformance tests](https://github.com/gpuweb/cts) and [OpenGL ES 3.0.6](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf). These define relevant semantics, not this engine's observed quality or speed.

Spine requirements use the already recorded core 4.3.13 at [revision b7beb2cc](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core). This package adds no third-party renderer or runtime distribution. Original notices, API qualification, authorized export compatibility and distribution conditions remain separate from first-party implementation and later complete Spine acceptance.
