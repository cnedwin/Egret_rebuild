# WebGPU rectangle implementation evidence — revision 0.6

**Publication checkpoint history and final native binding:** The accepted 956 native result below retains its original identity. At the pre-native checkpoint `1aa0248`, final comment-build binding awaited execution. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. See the [comment-only proof](../evidence/webgpu-entry-comment-proof.json), [curated verification](../evidence/webgpu-verification.json) and [scoped review record](../evidence/webgpu-review.json).

2026-10-09. [完整中文](WebGPU矩形实现证据.md) · [Normative contract](WebGPU矩形执行合同.en.md) · [Implementation plan](WebGPU矩形实施计划.en.md).

This is bounded recorded evidence for experimental browser rectangle execution. The numerical CPU correction is accepted by scoped SPEC/QUALITY review. The complete native run and whole-task review now have **PASS / SPEC PASS / QUALITY PASS** at the corrected source; public evidence reconciliation and publication remain PENDING. This draft reads existing receipts; it does not claim new executions, a complete manual image audit or final public approval.

## Evidence status and chronology

| Scope | Recorded status | Boundary |
| --- | --- | --- |
| Frame copy/dependency/bounded preparation | Accepted at `ee24f9fb0f5bb103a1cb34b9cd9b5ba63bd28d42` | Inherited subsystem 1 acceptance, not reset by the plan. |
| Integrated host/pass/lifetime and R1–R4 repair | Accepted through `c80d3f49aea64df2891418c0ae18d563bb5d2f9f` | Inherited subsystems 2+3 acceptance; mocks do not prove native pixels. |
| Document amendment 0.5 → 0.6 | Scoped PASS | Only guarded numerical rule/associated plan; no implementation or native acceptance transfer. |
| Numerical CPU correction | SPEC PASS / QUALITY PASS at `956e2f9894dc8e27291ffd0210a6cd8b4e651eab` | BASE `aea6314622083737631d56e8c7e757118779d0fa`; one production source plus two test files, 92 insertions / 4 deletions. |
| Historical native attempts, including fifth/sixth | FAIL; retained | F4 failed preparation under the strict rule in both readback configurations. New results do not rewrite these attempts. |
| Corrected-source native continuation | Observed run PASS | Complete source range and final native gate independently reviewed SPEC PASS/QUALITY PASS; public evidence projection remains PENDING. |
| Public evidence reconciliation and delivery | PENDING | Accepted native counts are recorded; final export identity, source-origin projection and publication receipts remain pending. |

The copied source-research and decision records labeled 0.4 retain their historical identity. Their old pending/installed flags and probe observations are not current implementation or native certification. Technical decisions that remain relevant are curated below.

## Failure, minimal correction and regression history

The original rule used canonical `t=u/(u+v)` and rejected endpoint-rounded t. The unchanged independent F4 hierarchy used valid public transforms. Production copying succeeded, but preparation rejected precision before packing. A real CPU observation found directed A=(15.999999999999996,36), B=(16.000000000000004,-4), canonical P=(4,16), Q=(15.999999999999998,28), u=480, v=2^-46, sum=480, t=1. At 480, v is one quarter binary64 ULP. Robust opposite signs establish a crossing but do not prevent its large interpolation weight rounding to 1.

The scoped correction preserves strict `0<t<1` x-then-y `P+t*(Q-P)` operations. Only `t===1` computes direct `s=v/sum`, requires finite `0<s<=0.5`, and constructs `Q+s*(P-Q)` component by component. The complement is about 2.960594732333751e-17 and this arithmetic can legitimately round to Q. It is not endpoint substitution, 1-t, clamping, snapping or tolerance. Positive finite determinant and sum/t checks, envelope, component bounds, cache, normalization and topology rules remain.

| Recorded step | Actual outcome |
| --- | --- |
| Before source edit: two new numeric regressions | Exit 1, 0/2; both witness preparation and full immutable public F4 failed with Geometry preparation precision. This was not a missing-module failure. |
| Minimal correction then compiler build | Exit 0. |
| First focused run after correction | Exit 1, 19/20; both new regressions passed; sole failure was the old expected precision rejection (Missing expected exception). Retained, not hidden. |
| Narrow historical expectation superseded | Actual locals u=3, v=3*2^-60, sum=3, t=1 at both crossings. Direct complement constructs x=-2^-60; closed viewport removes the outside sliver, points=[]/commands=[], edgeTests=110. Old source and actual original rejection log remain preserved. |
| Final focused run | Exit 0, 21/21, no failure/skip/cancellation. Supplemental strict-interior bit check was added after the two meaningful RED regressions; no separate prechange RED is claimed for it. |
| Final top-level core run | Exit 0, 177/177, no failure/skip/cancellation; includes 21 geometry, 46 host, 4 pass and 10 Canvas host checks plus existing core checks. |

An inspector helper initially failed on an incorrect relative module URL before geometry ran; corrected execution is separately retained. That setup error is not numerical RED. Final observations read actual production locals with side-effect prohibition and do not modify source, globals, predicates, prototypes or private state.

Both traversal directions produce identical binary64 point bits, three normalized witness points and 95 edge tests. Literal strict-interior 2/3=`3fe5555555555555` and 4/3=`3ff5555555555555` pass under forward, reversed and repeated clips. Existing diamond/affine endpoints, duplicate/collinear/no-op, reflections/shear, thin/near-collinear, nested rational, envelope, topology and budget fixtures remain passing.

Cache-hit reuse of an identical unordered pair within one clipping edge was not runtime-observed. Bounded valid regressions did not reach t===0, invalid/nonfinite determinant/parameter or unusable-complement branches. These guards and cache reuse remain unchanged/source-reviewed, not invented runtime coverage.

## Actual unchanged F4 CPU preparation and packing

The regression constructs the literal hierarchy through public createEngine/Sprite: rotated outer ancestor, diamond ancestor, x≥16 half clip, green leaf, unclipped blue sibling. Public Engine.captureFrame yields an immutable 48×40 transparent-clear frame; actual production copy, preparation and packing run. CPU expectations do not import/transform the native fixture, harness or oracle.

- Green polygon: (28,16), (15.999999999999998,28), (16.000000000000004,4.000000000000002), pointIndices [0,1,2], color 65280, alpha 1.
- Blue sibling: (32,4), (40,4), (40,12), (32,12), pointIndices [3,4,5,6], color 255, alpha 1.
- Seven stored points, two ordered commands, edgeTests=336; packed capacity **216 bytes**; ranges **{firstVertex:0,vertexCount:3}**, **{firstVertex:3,vertexCount:6}**; collapsedTriangles=0; maximum float32 backing reconstruction displacement **4.76837158203125e-7**.

No later crossing/topology/packing failure was recorded in this CPU path. These outputs are diagnostics, never fitted native pixel expectations. Independent samples stay green (20,16), transparent (10,16)/(26,6), blue (36,8), both readback flags and black/white composition.

## Recorded compiler, boundary and shutdown checks

| Check | Actual recorded result |
| --- | --- |
| Compiler build | Exit 0; build before final tests, no later source/test changes in numerical handoff. |
| DOM/package/source/build/declaration boundaries | Exit 0; 123 files, actual exports and DOM-free checks. |
| Public/DOM-free/negative type consumers | Exit 0; 28 actual expected negative diagnostics, not unexplained errors. |
| Headless Engine shutdown | Exit 0; closed scope/tree/Engine, pendingTimers=0. |
| Independent numerical implementation review | SPEC PASS / QUALITY PASS; reviewer read recorded checks rather than rerunning them and freshly checked all 110 final recorded hashes and 13 checkpoint paths. |

Only preparation source and the narrow historical geometry test changed among prior recorded paths; the new numeric test is separately recorded. Eleven of thirteen protected checkpoint entries stayed byte-identical; only corrected preparation source and its generated JS differ. Canvas, GPU copier, host/pass, runtime, defaults, configs and independent F4 fixture were unchanged by the correction.

## Accepted bounded native run and independent review; publication PENDING

A subsequent recorded native run reports **PASS** at 2026-10-08T20:17:25.506Z, source `956e2f9894dc8e27291ffd0210a6cd8b4e651eab`, exit 0: 42 frames, 0 required fixture failures, 1709 raw checks, 84 screenshots, 6808 composition checks, 8 intended negative cases and 0 unexpected errors. Unchanged F4 passed both readback flags and all four black/white background combinations. The complete bounded native task subsequently received independent SPEC PASS/QUALITY PASS at the same source identity. This accepted native result is distinct from PENDING public evidence reconciliation and publication. The evidence record retains the raw-run/final-review identities and limits.

Recorded environment: Edge 154.0.4258.62, Playwright 1.62.1, Node v24.19.0, fresh default headless msedge profile, no additional flags, secure loopback, deviceScaleFactor/browser DPR 1. API/default adapter/default device succeeded. Preferred and observed production source format was bgra8unorm; returned ticket format is rgba8unorm/srgb/premultiplied. This run does not certify native rgba8unorm-target devices that were not observed. Screenshot decoder is pngjs 7.0.0/MIT, public PNG.sync.read, RGBA output without gamma adjustment; it is a verification tool, not a new engine runtime foundation.

Captured device limits (distinct from adapter limits): maxTextureDimension2D=8192, maxBufferSize=268435456, maxVertexBuffers=8, maxVertexAttributes=16, maxVertexBufferArrayStride=2048, maxColorAttachments=8, maxColorAttachmentBytesPerSample=32. Adapter-reported limits were respectively 16384, 2147483648, 8, 30, 2048, 8, 128. Reported nvidia/blackwell/isFallbackAdapter=false is metadata, not hardware-acceleration certification.

Unchanged F4 raw checks and the four nested readback/disabled × black/white composition cases pass. All 84 screenshots have automated pixel-composition checks; this is not a claim that all 84 received manual visual inspection. The complete reviewer independently decoded all four F4 PNGs plus painter-readback-white.png (five images, 20 named samples) and visually inspected nested-disabled-white.png and painter-readback-white.png. A separate earlier visual inspection covered nested-readback-black.png and nested-disabled-white.png. These finite inspections are distinct from all 84 automated comparisons; this drafting task itself did not inspect images. Browser screenshots prove composition under recorded CSS/backing/DPR/scale, not physical scanout.

The eight intended negatives distinguish **seven copied-production native mutations** (no-op, reversed order, removed diamond clip, double premultiply, translated geometry, missing clear, nominal-DPR substitution) from **one assertion-only synthetic cached-byte case** (cached-missing-clear-reset). Each records its intended assertion failure. Counterexample copies are not accepted production; originalProductPreserved=true and result exitStatus=0 are recorded. The synthetic case is not an eighth native GPU mutation.

Recorded bounded native observations include upload-budget rejection with FRAME_RENDER_FAILED/WEBGPU_FRAME_BUDGET and texture-limit rejection with FRAME_RENDER_FAILED/WEBGPU_DEVICE_LIMIT before dimension/serial mutation; live pending readback close retires safely; borrowed device survives ordinary close (16 mapped bytes from later work); controlled borrowed-default-device destroy records WEBGPU_DEVICE_LOST and ENGINE_CLOSE_FAILED/WEBGPU_CLOSE_UNSAFE. This covers explicit destroy, not arbitrary driver resets. A 4096-byte allocation succeeds, while a 16-byte usage=0 descriptor yields actual scoped GPUValidationError. This is validation evidence, not a portable OOM threshold or unbounded allocation stress test. The live pending ticket recorded one frame, 144 upload bytes and 17920 combined readback bytes before close, then closed safely with all pending accounting zero.

The complete native report and independent review now bind the accepted corrected source/build/observations. The reviewer independently matched 233 current source/build/tool/lock/dependency hashes, all 1702 coordinate raw checks plus seven exhaustive-zero records, five decoded PNGs/20 named samples, all 60 files in each of seven mutation trees with exactly one documented change, six lifecycle statuses and the preserved historical failures. The complete review range is c80d3f49aea64df2891418c0ae18d563bb5d2f9f → 956e2f9894dc8e27291ffd0210a6cd8b4e651eab, 11 changed files, 650 insertions and four deletions. No discrepancy or actionable defect was reported. This review read recorded runs and artifacts; it did not rerun the gate. Final public source/export/projection bindings still require the pending evidence/publication step. Fill null fields only from actual later evidence; null means pending, not zero or PASS. Curated public projections now exist as [verification](../evidence/webgpu-verification.json) and [review](../evidence/webgpu-review.json). They retain accepted receipt identities and explicit pending final bindings.

```json
{
  "nativeAcceptance": "PASS",
  "acceptedSourceCommit": "956e2f9894dc8e27291ffd0210a6cd8b4e651eab",
  "acceptedBuildReceiptSha256": "cc258d839e50d5e0cf220528399d5c29a6bcc5c3a9ee2616a915627e0363d91d",
  "nativeFinalReportSha256": "2d1941c0c151b161a4ceb0c33acf454410caaa69c938ce7623efef4641f9da72",
  "nativeIndependentReviewSha256": "44646d844f948f21deb86317216456f472c653aaf077e8b306da3ab6968a91b1",
  "nativeFinalCounts": {
    "frames": 42,
    "failedRequiredFixtures": 0,
    "rawChecks": 1709,
    "screenshots": 84,
    "compositionChecks": 6808,
    "counterexamples": 8,
    "unexpectedErrors": 0
  },
  "curatedVerificationPath": "../evidence/webgpu-verification.json",
  "curatedReviewPath": "../evidence/webgpu-review.json",
  "deliveredDependencyBytes": null,
  "performanceEvidence": null,
  "publicationStatus": "PENDING"
}
```

Accepted native diagnostics retain 801 strict equivalent-premultiplied rational/Canvas checks with 32 outer-edge differences, two strict adjacent-command checks with 127 shared/exterior differences, and two ordinary near-collinear strict checks with zero differences beyond tolerance. These finite results do not establish universal Canvas parity or watertightness. Entry isolation includes 30 actual unchanged Canvas-page requests with no GPU/rendering/robust modules and the six-module public robust-predicates root graph on the opt-in GPU page only.

## Source and receipt identities

The following identify recorded source/build/fixture and bounded reports, not a final export manifest. The accepted native source/build inventory and final report/review receipts are recorded; their public projection and final delivered identities must still be reconciled during the pending evidence gate. Private raw logs are retained outside public reading documents; only their receipt identity and useful scope are projected here.

| Artifact / receipt | SHA-256 |
| --- | --- |
| Historical preparation source | `394cf3deb8ee4dd3a3357d471a1acbc55868736ad40c7ab3c08c5b786dff3aba` |
| Historical built preparation JS | `d78e9ba8c3096c211feb9d32dfa00b145419b28527379c6e3c84a0feb43ea03b` |
| Current preparation source | `5003eef853f6982c9b7f5f36999279688e7b6aa4184e88ff5673af2ad02aa74f` |
| Current built preparation JS | `ec3f3ceff5501fd65517fa9850a3cf42e0f8505e431a474d93f471789b56048a` |
| Unchanged F4 fixture | `58d9c04eee8f32dab50f49ff01f686085132d390a0b3e936e2860865a0a07a6f` |
| New numerical regression | `4ab922fdcc92b79712674ec328f166dc439534822ee988fa9cf32b655ef9b4a9` |
| Protected CanvasHost source | `ae6c2f46bd3e43b44e8a915a5b4fb9c1cbebab6b5f14b93178b7bd7eb5f0c7cb` |
| Protected copyCanvasFrame source | `274069cd40f81ddbb9aa298f4119be2cf8e4791d17c0c2b2652033a0d4957637` |
| Protected copyFrame2D source | `28e29667b474a244103eab0fab11fd373b62079073d2a2bea2cc9bfd0bda882d` |
| Host source | `f07f59068f1c65f1247500ca8665747bb957d99e07286b16e3d6d08be3da51bc` |
| Pass source | `780bb10de89b894ea01b6ae4122281a7c2b3c32e3435bed6d1e071be4969a5a5` |
| Lockfile | `ed9759a4ae0d1ca6e2d707fd1a324d1eff3b326cb2a8c827eecf14e3ebfb53d4` |
| Recorded production WGSL | `71d623c069fad3d84b50ff17f2fabaad30f149b5faeb4677d63c1aaf9907b2a6` |
| Recorded native harness | `99e85364bbb2619f8e83e9877e68acce7443bc23b320fe19f7cd953c8b5b9b26` |
| Recorded independent oracle | `c58cc871e0996469eaad28b7d088534b3b9164c44678227b796088ce6fa3e741` |
| Numerical CPU report receipt | `c53e4384826f43c9a7a47bb3ed9c64d4b22e97e0d9d4f83495030960d7c51184` |
| Independent numerical review receipt | `06d3297946e23286b2cf20d7f4b8f3f52e25641e6a68c3ddd05458bdf6637ca9` |
| Observed native result receipt | `8cdff26d8067961588144ac6149aa40b83d70a74101745480d9b5e2daa35e695` |
| Final complete native report receipt | 2d1941c0c151b161a4ceb0c33acf454410caaa69c938ce7623efef4641f9da72 |
| Independent complete native review receipt | 44646d844f948f21deb86317216456f472c653aaf077e8b306da3ab6968a91b1 |
| Final native build receipt | cc258d839e50d5e0cf220528399d5c29a6bcc5c3a9ee2616a915627e0363d91d |
| Final native inventory receipt | b79db92e2062fec87a8fa485c64a2f3d37f9506d8310842a9ba650a3fb0a6a43 |
| Historical native attempt 5 | 4048cce24f4efa5c2a4cebc719865e614c15038c9a0f83c9242770b07b92b601 |
| Historical native attempt 6 | 9f3d12543d6e39b94b7cbd45589c352aaad3fdf4137627e691061bf06e7197fc |
| Historical native-third log | 56266723d7472810bdef88edea601b229e762a20d985f4d9b12c67a18972613f |

Current public source references: RenderFrame2D (`packages/contracts/src/RenderFrame2D.ts`), preparation (`packages/engine/rendering/prepareRectangles2D.ts`), GPU host (`packages/engine/web/WebGPUHost.ts`), pass (`packages/engine/web/webgpuPass.ts`), numerical regression (`tests/geometry-webgpu-numeric.test.mjs`), native harness (`tools/verify-webgpu.mjs`), independent oracle (`tools/webgpu-oracle.mjs`). Their link existence/source identity is checked for drafting; complete implementation acceptance still depends on the actual reviews.

## Dependency evidence and source-reference boundary

robust-predicates **3.0.3**, Vladimir Agafonkin, **Unlicense**, public root orient2d is the attributed foundational math dependency. The official exact-version audit at 2026-10-08T17:08:34.467Z verified **40820 bytes**, SHA-256 `54952e6a8c9e69e404f9be09bfb92a68482cf77702283399a44a689d67ba661c`, registry SRI `sha512-NS3levdsRIUOmiJ8FZWCP7LG3QpJyrs/TE0Zpf1yvZu8cAJJ6QMW92H1c7kWpdIHo8RvmLxN/o2JXTKHp74lUA==`, type declaration/public orient2d and license presence. It was an artifact audit, not runtime execution. Actual package metadata pins 3.0.3; compiler/import evidence is separately recorded above. Tarball bytes are not delivered/browser-transfer bytes. Full delivered dependency accounting remains pending; no npm-latest or performance claim follows. Preserve NOTICE (`NOTICE`, repository root) and [upstream license](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE).

Historically read primary GPUWeb and dated WGSL sources, exact research scope and access failures are retained in [contract section 8](WebGPU矩形执行合同.en.md#8-foundation-attribution-and-reference-limits). That source research was recorded on 2026-10-09 and was not re-fetched for this draft. The 0.4 source record is historical research, not new current-native proof.

## Design decisions and retained tradeoffs

| Decision | Rationale and limit |
| --- | --- |
| Complete language pairs and frozen API | Both languages carry all normative rules and identical API; English is not an abbreviated pointer. Structural parity still needs a separate meaning review. |
| Opt-in same-package browser entry | Canvas remains isolated from GPU/math eager loads; pure rendering emits separately with contracts-only TS reference. Base-load priority motivates isolation, without an unmeasured byte/performance claim. |
| One preferred-format production target | Readback copies the same texture in the same encoder; a mirror/offscreen rerender would weaken the actual-path oracle. Reacquisition does not promise a different texture object. |
| Attributed robust orientation with bounded construction | Predicate sign is robust for represented points, magnitude is approximate. The 0 or 2^-100..2^20 envelope explicitly excludes extremes and cancellation intermediates. No exact rational runtime or universal accuracy proof. |
| Exact degeneracy before rounded corner topology | Singular matrices and represented no-crossing touches remain no-ops; rounded multi-clip near-touching can reject or have subpixel coverage. |
| Withdraw fixed 1/1024-pixel rejection | Record float32 collapse/displacement; reject nonfinite/sign reversal rather than all thin geometry. Outer edges and separately clipped neighbors need separate diagnostics. |
| Bound work as well as output | 1024 polygon vertices and 4194304 default edge tests complement input/prepared/upload caps. No unchecked product or quiet truncation. |
| Preserve Canvas implementation and author indexed GPU copy | The proposed shared Canvas copier/wrapper was withdrawn because iterator/error identity are compatibility obligations. Canvas files remain exact; future sharing needs a new compatibility design. |
| Two-pass output allocation | Actual surviving V determines exact upload bytes before typed output allocation; caller budget has precedence over device cap. Predicted fan vertices may collapse to zero, so preparation is not clamped to upload-derived counts. |
| Guarded 0.6 complement only for t===1 | Direct s=v/sum preserves the small positive complement without changing strict-interior bits. Broader nearest-endpoint rewriting, 1-t, snapping, epsilon, tolerance widening and F4 waiver were rejected. |
| Outcome settlement separate from successful retirement | Failed fences/maps must drain and reach best-effort unsafe cleanup rather than a success-only deadlock. Bookkeeping retirement is not safe-return proof. |
| Acquired/borrowed ownership and conservative quarantine | Never destroy borrowed device; cooperative exclusive lease cannot be enforced across other libraries. Rendering failure and cleanup safety are separate. |
| Observe callbacks without awaiting user continuations | Cross-realm/thenable rejection is isolated; a callback returning close/whenIdle must not deadlock GPU cleanup. Healthy device.lost is not a close barrier. |
| Failures remain history | Artifact access failures, strict-rule numerical rejection and old native FAIL runs remain recorded; a corrected CPU/native result has a new identity and bounded scope. |

## Remaining limits

The envelope is an application support range, not a universal error bound. Robust sign does not make constructed intersections exact. Rounded multiple clips can displace boundaries or reject topology; separately constructed adjacent commands are not universally watertight. Single-sample outer edges differ from Canvas antialiasing; premultiplied raw WebGPU bytes cannot be compared directly with straight-alpha Canvas bytes. CPU mocks, production readback, browser composition and physical scanout are separate evidence layers.

The complete bounded native task is independently accepted; public evidence reconciliation and publication remain pending. No benchmark, acceleration leadership, physical-phone, Runtime SDK, 3D, text/texture/UI, migration, editor/AI creation loop or complete-engine claim is made. Broad product requirements remain bounded by their own existing evidence; this rectangle milestone does not close them.
