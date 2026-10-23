# Reproducible content builds

English | [简体中文](../../Cns/docs/content-build-pipeline.md)

M2.1 first implementation · 2026-10-23 · PNG, single-page atlas and sequence profile. Complete M2.1 remains open.

## From authored files to playable resources

A content recipe joins source files already recorded in a project to three fixed importers. The build verifies source bytes, evaluates dependency keys, reuses complete cached outputs or imports changed resources, then binds the results back to that project. Atlas and sequence outputs use the existing SpriteSheet and SequenceClip representation; they do not introduce a second animation player.

The first profile preserves an admitted PNG as the primary distribution artifact and produces a tightly packed, top-left, straight-alpha RGBA8 reference. Atlas metadata produces named normalized frames and sequence inputs. A sequence references its atlas through dependency ordinal zero; an atlas references its page through ordinal zero. Intrinsic artifacts contain no owning project ID, resource ID, file ID or physical path. The admitted resource manifest resolves those dependencies.

The sample pixels and metadata are original synthetic fixtures under Apache-2.0. A successful fixture build does not certify a real Aseprite export, other exporters, licensed assets or target devices.

## Public boundaries

| Entry | Responsibility |
| --- | --- |
| `@egret/contracts/resources`: `validateResourceBuildPlanDescription`, `evaluateResourceBuildKeys` | Validate source-only descriptions and evaluate keys before artifacts exist, using the same authority as final manifest construction. |
| `@egret/project/resources`: `describeContentRecipes` | Capture project/recipe data, resolve sources, validate the finite importer profile and dependency graph, and reserve a producer/settings envelope. |
| `@egret/project/resources`: `bindContentArtifacts` | Bind complete intrinsic output descriptors to this project's files and resources, then build the admitted manifest. |
| `@egret/project/resources`: `createContentAdoption` | Prepare a complete project transaction from a genuine binding. It does not commit the caller's store or certify filesystem readiness. |
| Repository tool `tools/build-content.mjs` | Read actual owned files, run the finite Node pipeline and export the result and receipt. This is a build tool, not an engine runtime dependency. |

The old resource description still requires an actual artifact. Existing keys, runtime identities, manifest bytes and default package entries retain their meaning. There is no placeholder hash and no parallel key implementation.

A recipe has format `egret.content-build-recipe/1`, one `targetProfile`, and recipes with `resourceId`, `sourceFileId`, `importer`, `settings`, `artifactFormatVersion`, ordered `dependencies` and `provenance`. The finite importer identities are `egret.png@1.0.0`, `egret.aseprite-atlas@1.0.0` and `egret.sequence@1.0.0`. The atlas profile is `aseprite-json-array-1.3.18.6-v1`; rotations and multiple pages are refused. The output schemas are `png/1`, `egret.atlas/1` and `egret.sequence/1`.

New recipes receive a reserved settings envelope containing recipe/output/reference versions, their options and the actual Node/pngjs/zlib producer identity. Recipes cannot select executable code. Build tools enforce the installed versions before lookup. Target labels participate in the existing key algorithm, but this first importer set emits shared artifacts; a different label does not qualify a platform or target-specific texture conversion.

## Cache and invalidation

Keys include source digest/length, importer and output versions, producer settings, target, project version pins, provenance and ordered dependency IDs/keys. Changing a page invalidates that page, its atlas and its sequence, while an unrelated image can remain cached. Changing common project version pins invalidates all selected keys. Relocating identical source bytes does not by itself change the intrinsic key. A dependency ID rename can change keys because those IDs are part of the established contract.

Cache records retain every output, including RGBA references. Every hit verifies actual byte lengths and hashes. A missing blob is a rebuildable miss; a present conflicting blob is an integrity refusal. Rebuilding an incomplete record must reproduce its complete output description. Same-key/different-output results are refused. This delivery includes no automatic repair, quarantine or garbage collection.

Cross-project hits reuse intrinsic bytes only. Each project receives new binding/admission and its own immutable files. No cached manifest or transaction is transplanted. The cache belongs to the cooperating build environment; byte integrity is not a signature of an independently trusted producer.

## Two explicit commit points

1. **Ready generation:** verified blobs and the manifest are staged under an exclusive cooperating writer, then a complete generation directory is published. Its identity hashes a canonical descriptor containing the manifest digest/length and every resource output. Blob paths are independent of that identity. The manifest excludes its own configuration file and selection entity, avoiding a hash/path self-reference. Cache records become discoverable only after readiness.
2. **Adopted project revision:** the existing `ProjectStore.commit` applies the complete resource/file/selection transaction against the captured revision. The selection entity records the target, exact generation, manifest file and resource IDs. A conflict or cancellation after readiness leaves a reusable ready generation and the existing project selection. A successful commit is not undone by late cancellation.

Each target has one active selection entity. Rebuilds must reuse that selector ID; introducing a second selector for the same target is refused before publication. Other targets can coexist when their resource ownership is disjoint.

Sources are checked again before readiness. Cancellation is observed between bounded synchronous importer calls and immediately before readiness/adoption; it cannot interrupt the middle of a synchronous decoder call. Old generation bytes are never deleted during a build. Filesystem publication and project adoption are deliberately separate transactions, not a distributed atomic commit or a power-loss durability guarantee. The CLI exports a new candidate snapshot; it does not overwrite an existing project file or update another current pointer.

## Bounds and dependencies

The sequential runner admits at most 64 MiB of unique source bytes, 128 MiB of complete outputs and 64 MiB of cumulative PNG scanline work, counting both decompressions. These are logical admission/work budgets, not a physical process-memory or GPU-memory ceiling. Existing manifest limits remain 4 MiB, 4,096 resources, 8,192 edges and depth 32; project transaction/reference limits can refuse a smaller complete adoption.

Each PNG is limited to 8 MiB encoded, 4,096 pixels per edge, 1,048,576 pixels and 1,024 chunks. The admitted profile is RGB/RGBA8, noninterlaced, with the selected sRGB-compatible metadata rules. Every admitted chunk receives CRC verification. Public Node inflation enforces exact scanline length, complete stream finishing and trailing-input refusal before public pngjs decoding. Alpha is straight and encoded channel values are preserved; no gamma adjustment, premultiplication, recompression or custom codec is introduced. Invisible RGB preservation is tested offline, separately from browser composition.

The build-only dependency is exact `pngjs 7.0.0` under MIT, with its unmodified notice in `third-party/pngjs-7.0.0.LICENSE`. Node remains 26.7.0. Public [pngjs](https://github.com/pngjs/pngjs) and [Node zlib](https://nodejs.org/api/zlib.html) supply the codec/checksum primitives. Egret's recipe, ownership, cache, binding and transaction integration are independently authored. The dependency does not enter default Engine/Runtime packages.

## Verification and remaining scope

Focused tests exercise actual source bytes, cold/warm builds, reverse invalidation, fresh project binding, missing/corrupt secondary outputs, source drift, cancellation and revision conflicts. PNG tests include independently authored pixel/filter expectations and malformed streams. Store tests use real owned directories and no filesystem replacement; unsupported symbolic-link creation is reported separately from actual junction/path checks. Independent review includes source and result evidence, rather than test counts alone.

The actual generated-output browser run on 2026-10-23 passed five checks in headless Microsoft Edge 155.0.4283.62 on Windows x64, Node 26.7.0 and Playwright 1.62.1. It loaded the committed four-resource candidate, compared all 72 native Canvas pixels for the initial, advanced and completed frames, and verified cleanup with zero outstanding ownership counters. The public result summary (`examples/content-build/verification-summary.json` in the repository) records the environment, checks and raw-receipt hash; it is a projection, not a replacement for the retained original. This is browser functional evidence, not physical-device or performance qualification. Full merge gates and GitHub integration have separate outcomes.

Remaining M2.1 includes licensed Spine JSON/binary/multipage import, font artifacts, selected target variants, mip/rotation/compression qualification and complete feature inventories. M2.2–M2.4, complex UI, IME and physical Android/iPhone acceptance remain separate packages. M1.2's measured full-dirty 10.3 ms against 8 ms remains open.
