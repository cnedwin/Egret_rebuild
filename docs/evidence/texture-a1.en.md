# Texture A1 CPU evidence

Scope: reproducible CPU validation evidence. Tests exercise actual factory/runtime/capture/mixed copier/preparation/packing; production-host rejection uses injected Canvas/GPU boundaries and actual host code. Browser sampled images, device performance and GPU lifetime remain untested. Independent review and publication validation are separate from these results. [API and ownership](../texture-a1.en.md).

## Cases and independent origins

PASS: literal identity clip x1..3 of4×4 returns UV .25/.75; reflection a=-1,tx4 swaps them, preserving y UVs. Reflected packed corner coordinates are x±.5,y±1 with original matching UVs. Quad emits six vertices96 bytes, alpha stays .5 metadata;95 bytes fails budget.

PASS: C2 adapts the pre-existing rectangle regression P=(4,16),Q=(15.999999999999998,28), frame48×40, exactly one specified clip to a new factory-created1×1 red image. Independent u=480,v=2^-46 yields t=1 and directly computed complementary s=v/(u+v), whose coordinate evaluation rounds to Q. A's Q UV is(1,0); B exchanges transformed axes, Q UV is(0,1). Position sets match; texture mappings need not match. No epsilon, output-derived pixel oracle or experiment-derived expected pixel is implied. Fixture: [image-affine-oracles](../../tests/fixtures/image-affine-oracles.mjs).

PASS: adjacent identical position/UV dedup; conflicting UV, nonadjacent duplicate and mixed turns precision; five collinear-attributed vertices retained, all-collinear empty. Bounds2^-101/2^21 range; edge budget0 and quad vertex budget5 fail budget. Zero alpha/singularity/empty clips still preflight later invalid clips and keep empty image/view/alpha metadata. Inverted packed winding precision; represented zero triangle emits0/count1. u=1+2^-23 survives float32 exactly, demonstrating no clamp.

PASS: acquire→Texture→Bitmap→capture→mixed copy→CPU prepare/pack, alternating rect/image/rect/image, immutable bytes/positions/packed data/order after release, invalidation and Engine shutdown; replay on another compatible CPU adapter. Nonempty nested image clips freeze each record/matrix/rect. Index-only table proxy returns valid length then throws FrameCopyError sentinel at0; FrameInputReadError retains the exact cause.

PASS: aggregate test-owned budgets24 fan vertices/352 edge tests,23 vertices or351 edges fail budget; no production mixed dispatcher added. Production Canvas/WebGPU reject images before mutation (existing texture-frame-types suite). Existing numerical endpoint/strict-interior/F4, rectangle/host/lease/byte/priority/type/boundary regressions pass in the affected/final checks recorded below.

## Failures and controls retained

RED1 retained six intended missing-image-port assertions plus a mistaken old counter literal65. Before extraction, RED2 corrected that pin to122 against unchanged original rectangle code and passed exact rectangle shape/packed floats/ranges/displacement. Independent count: subject corners9 + clip corners9 + clip traversal(16+12+16+12)=56 + viewport48 =122. This is a pin of old behavior, not a fixture regenerated from new implementation; all old position/packed expectations remained literal.

GREEN1 retained the integration's mistaken224 edge literal. Independent count corrected it to352: each ordinary rectangle9+4×12=57; each nested-clipped image5+2×9+3×4×8=119; two of each total352. No counter policy changed. GREEN2 passed8/8. Original failures and before/after source identities remain in receipt subjects below.

Actual disposable built-production controls: UV-only attribute reversal inserted into prepareImages2D emitted output fails affine and C2 assertions (two failures); swapping the first two commands in built copyMixedFrame2D fails painter-order assertion (one failure). Original emitted bytes were saved, restored and hash-checked in finally; restored affected suite passed8/8. Healthy tests also deliberately reverse only attached UV and reject each affine/C2 variant's literal assertion. No mutation was committed; changing only the test oracle is not the sensitivity evidence.

## Final full-suite limitation

FAIL: the initial tools/test.mjs invocation produced413 tests,411pass,2fail. boundaries.test.mjs:72 “boundary checker admits the exact external root only in engine rendering” used a minimal copied contracts facade lacking executable image exports; project-boundaries.test.mjs:58 “unmodified actual package copies preserve root resolution and every approved renderer entry” loaded duplicate IMAGE_LIMITS_2D identities. The boundary fixtures were corrected as described below. Direct actual-repository boundaries/types and affected157/157 passed. This first413-test result remains FAIL; later415-test results belong to separate source subjects.

## A2 evidence — UNRUN

All production Canvas/WebGPU image sampling/readback/black-white composition; browser/device/version; alpha corpus, fractional DPR/minification/seams/raster edges; numerical bounds; projection/color/layout implementation; image resource reservation/submission settlement; release-before-fence/write-then-encode/close-reentry/loss/rejection/hang/cleanup/exactly-once; native/editor/migration/performance are UNRUN. Mock host rejection and CPU displacement are not certification. Refer to the linked API document for the full A2 stop gates. Independent review and publication validation are separate gates.

## Source subjects

Implementation foundation BASE 29a7765f1bae9f91cbe88f9e467dd66ce71b4d0d, tree 7a7fa691be77ed0ccd0d64e5e68d8e7d5527c82e. This table binds source bytes from 015a4036b83104c2a6f528dadb4a9dc057efaaa2 as a historical subject. The subsequent shared-winding and bounded-admission changes have separate source tables and results. Source hashes identify bytes; documentation describes validation and is not executable proof.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/prepareImages2D.ts | 4446 | ae47a8eef62d7b455c71b6b7c30fcc9c4c1ff48ec32bdbed08e429734057af91 |
| packages/engine/rendering/packImageVertices2D.ts | 2652 | 99044ea7ed990a02251e1b5ecf67bd0f838af7783e4794670349c5bad5a4911a |
| tests/image-geometry-2d.test.mjs | 7322 | d9cbf647cc44810dd5a1a8cb4a8383e7b9e8a61317a13bbcaecffdf52f768f54 |
| tests/texture-a1-integration.test.mjs | 5444 | 85a75bc119436a4f01ffb2fd96277f297307a0f7e6422104b0ac3ab251faae5a |
| tests/fixtures/image-affine-oracles.mjs | 987 | fde9535e1b6fa9de954ca7c9eb81f4e651740ae9a485944ef27579323dd2e68b |
| packages/engine/rendering/prepareRectangles2D.ts | 10452 | 1a0c093f6168042d4316ab89b22c229d9a0ac1086dd099591355b3419ffd2da0 |
| packages/engine/web/webgpuPass.ts | 5107 | 26f9cff856de0e868a945cbe55379013877eb3046bc16f41d86776905278fcf5 |
| packages/engine/rendering/packedPosition2D.ts | 725 | 089777bcf9cb4dde92354091db7bea205f6dd616ee26a16d3b4a40ff2087fd26 |
| tests/boundaries.test.mjs | 8005 | 8671d2e417bc090fc0e595ad9451d2784fc4b250c9b4e19f858df740a5a64d23 |
| tests/project-boundaries.test.mjs | 12122 | 6972c3474605678f8d1d5cf48a6ea0316b87439bcb1928c7223d13b4e7bcaffa |

### Pre-production fixture subjects

| File | Bytes | SHA256 |
| --- | ---: | --- |
| tests/image-geometry-2d.test.mjs | 7324 | 912b2fd4f49ac998409bbc602052ea50461b522a84585cf053528e73a1bd4455 |
| tests/texture-a1-integration.test.mjs | 5365 | b57b8e62deea7c0734e01033d723ecda6352c7ba363f41d3243a8e76c8179545 |
| tests/fixtures/image-affine-oracles.mjs | 987 | fde9535e1b6fa9de954ca7c9eb81f4e651740ae9a485944ef27579323dd2e68b |

The pre-extraction rectangle source SHA256 is 7aa74f20214988d8631f36f9c1e8e2b3a6a332cc86aa1a23dfac8c94be8ccbd3; original webgpuPass SHA256 is 780bb10de89b894ea01b6ae4122281a7c2b3c32e3435bed6d1e071be4969a5a5. The original affine fixture above was written before production and its literal values remain unchanged. The fixture imports no production code. Shared packedPosition2D is a first-party extraction of NDC fround, finite guard and displacement from webgpuPass; its final source hash and the affected webgpuPass hash are included above. No upstream code copy or new dependency is claimed.

## Executed command receipts

Dates are UTC on2026-10-09. Commands below were actually executed with Node24.19.0 from repository root; exact native executable/cwd/start/end/exit and raw stdout/stderr/source hashes are retained in receipts. Public receipt hashes bind those original records without embedding transcripts or machine-specific paths. Type negative-fixture compiler diagnostics are expected verification output, not hidden failures. Both initial and corrected full invocations also retain three known project import-audit harness diagnostics: ExperimentalWarning: VM Modules is an experimental feature and might change at any time. They are embedded in stdout as retained harness output; outer stderr is empty. Corrected outer415 PASS/0 FAIL remains its recorded result. These warnings are not image implementation regression evidence and are not suppressed.

| Receipt subject | Command (node executable; repository root cwd) | UTC start / end | Exit / result | SHA256 |
| --- | --- | --- | --- | --- |
| boundary-fixtures-green | `node --test tests/boundaries.test.mjs tests/project-boundaries.test.mjs` | 2026-10-09T04:37:49.362Z / 2026-10-09T04:38:32.532Z | 0; 36 tests, 0 fail | 4eae8fdf6bc5db4e4715981478e2a6fbfe491a06428f6b6b4b04942d3b9267ac |
| final-affected | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/image-data-2d.test.mjs tests/texture-bitmap.test.mjs tests/texture-capture.test.mjs tests/texture-frame-types.test.mjs tests/mixed-frame-2d.test.mjs tests/geometry-webgpu.test.mjs tests/geometry-webgpu-numeric.test.mjs tests/webgpu-pass.test.mjs tests/canvas-host.test.mjs tests/webgpu-host.test.mjs` | 2026-10-09T04:30:46.856Z / 2026-10-09T04:30:47.467Z | 0; 157 tests, 0 fail | 33f3b3ee3ab7c8c1abe0120b666a727e5935b1edb65ca631bafe61785bb3cab8 |
| final-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T04:31:40.738Z / 2026-10-09T04:31:41.290Z | 0; - tests, - fail | d5997bc90ab7e1e435c8476340ea245125f51f2a77efcd20b157b90e077c3243 |
| final-build | `node tools/build.mjs` | 2026-10-09T04:30:46.363Z / 2026-10-09T04:30:46.798Z | 0; - tests, - fail | aea2d9005eed696df8337a07da986d76895ee29ba99b9f22af162cd6f76b68fb |
| final-eof-affected | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:41:22.834Z / 2026-10-09T04:41:23.016Z | 0; 8 tests, 0 fail | 82dd3a3bb580b86ff318247ac522949b399688eb3a85ad433f933699dfb508ec |
| final-full-corrected | `node tools/test.mjs` | 2026-10-09T04:38:37.901Z / 2026-10-09T04:39:24.562Z | 0; 415 tests, 0 fail | 2a4ad7e764b6bd5326fbe86610666a1b8ce3a44acf155a41f9395b64641eba9a |
| final-full | `node tools/test.mjs` | 2026-10-09T04:30:54.662Z / 2026-10-09T04:31:39.431Z | 1; 413 tests, 2 fail | f8eba4e51bd9878bc78008050a07d8b0568230ba11caec500ad11cf279e3ba9f |
| final-types | `node tools/check-types.mjs` | 2026-10-09T04:31:39.493Z / 2026-10-09T04:31:40.678Z | 0; - tests, - fail | 7094f7c38ff47065432fa74ae1dfd9cc522d6bf8902557eb67e14b36d4bfd0f5 |
| green-1 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/geometry-webgpu-numeric.test.mjs` | 2026-10-09T04:27:12.894Z / 2026-10-09T04:27:13.083Z | 1; 11 tests, 1 fail | 82742472a7e80bba0429cbdb55e6932f46e99a4061f35a26ac869381446ad083 |
| green-2 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:27:33.590Z / 2026-10-09T04:27:33.774Z | 0; 8 tests, 0 fail | 48d977ed860f34d1d4818c59376ee7b0c6184a7a00fead6c448d8d10392b4f2a |
| green-build-1 | `node tools/build.mjs` | 2026-10-09T04:27:12.381Z / 2026-10-09T04:27:12.835Z | 0; - tests, - fail | dc4317456e6599b708b75518f132d48f8e66f75c6002a3c7a1a8a9b4411ccfdf |
| mutation-order | `node --test tests/texture-a1-integration.test.mjs` | 2026-10-09T04:28:32.195Z / 2026-10-09T04:28:32.368Z | 1; 2 tests, 1 fail | ec0c7f5720a27609c7472e2c2976861ea1c67001c293d66ae6590623fb7a6519 |
| mutation-uv | `node --test tests/image-geometry-2d.test.mjs` | 2026-10-09T04:28:31.996Z / 2026-10-09T04:28:32.139Z | 1; 6 tests, 2 fail | 64931a8513aadc9070f4f5e1ff1d2bbd9cf2b5491705d02549cad2b711139829 |
| red-1 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:25:39.142Z / 2026-10-09T04:25:39.319Z | 1; 8 tests, 7 fail | 602659eacee622d61db95fe159f480b6c4e32df4ad9000a1b5d09222c16ac808 |
| red-2 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:25:47.976Z / 2026-10-09T04:25:48.152Z | 1; 8 tests, 6 fail | 62eef01c5fa349287211ea6bc85ef33fbe434c71395174ba94de200937649f9a |
| red-build | `node tools/build.mjs` | 2026-10-09T04:25:38.623Z / 2026-10-09T04:25:39.087Z | 0; - tests, - fail | ed6fb48e8f414b63410fe424aa7a5ed3a42dcbe9b533988f4c0f6a9f18ec3df3 |
| restored-green | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:28:32.424Z / 2026-10-09T04:28:32.608Z | 0; 8 tests, 0 fail | f4c2279035e746c2f849d4d06ea54fbd409ae2cf60400a2cf39812a0ec5f24fd |

## Boundary fixture corrections

The synthetic policy fixture provides the four image values and engine same-identity reexports, declarations and low-level runtime capture facade required by the unchanged checker. It proves policy/resolution only, not actual runtime/native behavior. The actual-copy Project fixture preserves ordinary package/dependency copies; one test-owned node_modules contracts root file explicitly reexports the preserved packages/contracts root. Assertions pin copied-root bytes before/after this resolution bridge. Original DAG/deep/inherited/declaration controls remain. A missing-image-export control fails the assigned executable-surface reason; a duplicate actual contracts module fails the assigned IMAGE_LIMITS_2D identity reason.

PASS: focused corrected boundary fixtures36/36. A necessary full rerun after new adapter changes passed415/415, exit0 (two new controls explain413→415). The initial413/411/2 FAIL receipt remains separate. Production code bytes were unchanged, so earlier actual build/type/direct-boundary receipts remain scoped to those identical production subjects; no redundant rebuild/types/direct-boundary run was made. The full suite itself retains its existing consumer type-gate tests. Documentation was finalized after these runs and is not an executable test subject. Independent review and all A2 gates remain separate.

Preserved pre-correction source subjects:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| tests/boundaries.test.mjs | 6757 | 2814620db64516ff9890afd142f863c6444e6ffac9d5e9021d9f62c2b284370c |
| tests/project-boundaries.test.mjs | 11327 | 19bc9edfd1e62f033876d2321543a4ee2ef774985af194c8375938091c01f4f6 |

EOF whitespace was normalized in two new tests and two API documents, with original bytes retained. Affected8/8 passed afterward (final-eof-affected). Production and corrected boundary fixture bytes remain identical to the415-test full run; that run retains its original test identities. Assertions did not change.

## Shared winding refactor: historical changed-source evidence

Refactor foundation 015a4036b83104c2a6f528dadb4a9dc057efaaa2, tree a86d2aaf73bfe7006582eff748b833e63c688a33. The earlier original-source table,413-failed/415-corrected/final8 and mutation receipts remain historical subjects, not results for these changed bytes. The refactor shares only finishPolygonWinding2D in the existing private preparation module; rectangle collinear removal and image UV/duplicate policy stay separate. Consecutive-triple sign call order, counters, mixed-turn precision, all-collinear empty result and full-point reversal are unchanged. The helper is engine-relative only, with no new file/framework/public barrel. Both API languages now state the complete image semantic priority and TEXTURE_FACTORY_REQUIRED.

| Changed production source | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/prepareRectangles2D.ts | 10705 | 4ff620e1670d594550534bd8ef70366ee0fda6c46307116060154e8415711473 |
| packages/engine/rendering/prepareImages2D.ts | 4139 | 1749ecc606a7a3f412b254a332842cbeadce2fab6b91a438ee685dd143a9e3ab |

| New fix receipt | Actual command (Node; repository-root cwd) | UTC start / end | Exit / result | Receipt SHA256 |
| --- | --- | --- | --- | --- |
| fix1-build | `node tools/build.mjs` | 2026-10-09T05:04:09.025Z / 2026-10-09T05:04:09.505Z | 0; build PASS | 76dad149c295bbbe320807f865cba1e7f71d2dc1d36e925c9b7d24968bcd2c6b |
| fix1-focused | `node --test tests/geometry-webgpu.test.mjs tests/geometry-webgpu-numeric.test.mjs tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/webgpu-pass.test.mjs` | 2026-10-09T05:04:09.563Z / 2026-10-09T05:04:10.176Z | 0; 33 PASS / 0 FAIL | 4169ada46816d16eeb6926afb61122761ba465bb9da6d40e84bca0c280e8b1c8 |
| fix1-types | `node tools/check-types.mjs` | 2026-10-09T05:04:19.931Z / 2026-10-09T05:04:21.134Z | 0; positive + expected compiler-negative fixtures PASS | 2d884b9ea7707f336c1b140f64650484b6dc4e591ccb94992e37fc2ef0f7bdb0 |
| fix1-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T05:04:21.190Z / 2026-10-09T05:04:21.898Z | 0; 237-file boundary PASS | 56fbf3ce88be74a82c7262afe39c1bb04e172bc6487425d5d83b0883fae17bda |

The new focused33/33 asserts both policy wrappers, exact old122-edge rectangle shape/packed output,352-edge aggregate, reflected UVs, both C2 Q mappings, topology/range/budget and existing represented-packing behavior. Tests were unchanged and retain independent literal origins. Build ran once; relevant types and direct boundaries passed on these changed sources. Expected compiler negatives and existing numeric test diagnostics remain output; focused outer stderr is empty with no VM warning. No whole415/browser run was repeated here. The later curated prepush subject is recorded separately below; the old415 result is not transferred. Documentation bytes postdate these executable receipts and describe their scope. All A2 gates remain UNRUN.

Known historical harness scope: both earlier full invocations retain three VM Modules ExperimentalWarning blocks in stdout, with empty outer stderr. Corrected full receipt SHA256 is 2a4ad7e764b6bd5326fbe86610666a1b8ce3a44acf155a41f9395b64641eba9a; its stdout-only SHA256 is aa212eee2dfa7455abcabbcde3e7ff45b3194d5061f497dae3e61fe2af18d8c3. These are different hash subjects. The warning is existing project import-audit harness noise, preserved and neither suppressed nor described as new production regression.

## Curated whole-source verification (historical)

A separate prepush invocation on af94a9a74be76d06a0964f9003b33af948f30a6a ran `node tools/prepush.mjs` from repository root at 2026-10-09T05:27:21.779Z / 2026-10-09T05:28:15.018Z, exit0. Receipt SHA256 d5671b127cfd1a757c2d26bad3050620438c7d874d44fc0120b0dd034653cc0a binds that subject: full415/415, build/types/direct237 boundaries, publication structural checks, headless example and KB checks passed; source inventory and HEAD remained unchanged and clean. Three known VM Modules warnings remain in stdout and outer stderr is empty. This historical415 result predates the admission change below.

## Bounded table admission: changed-source evidence

Foundation af94a9a74be76d06a0964f9003b33af948f30a6a. The table length cap is now an admission check before allocation/index reads. This intentionally changes oversized-table priority: an invalid65th entry and virtual2^32 length now fail FrameCopyError('budget'), replacing invalid authentication and native RangeError respectively. Admitted0..64 tables still authenticate all entries before payload/view/geometry.

New tests on unchanged production gave29 tests,24 pass,5 intended failures: invalid65th priority and four virtual lengths65/1024/2^32/MAX_SAFE_INTEGER. The proxy fixtures allocate only empty/small arrays; guarded indices throw immediately, so the RED does not traverse a huge table. After the fix each virtual length records one length read, zero index/iterator reads. Admitted64 reads every index once; an invalid unused final entry precedes payload and geometry, and an index-only sentinel retains exact cause. Existing rectangle/header/lazy/getter/view/payload tests remain.

Before-source subjects:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/copyMixedFrame2D.ts | 3906 | addd9c4bea9648bdf15e3f8da6873958a54080495f13a4d7e0ded2164c944365 |
| packages/engine/rendering/imageFrameBudget.ts | 1803 | 302063eb2a42f8543a1b728b10546618795b1d97f491ad4752e10f10d72a82e8 |
| tests/mixed-frame-2d.test.mjs | 16622 | 6246cd51ad8315b97bb87d9ae3c489ed42ba4f3e36233ee79e02924879d34ef2 |

Changed-source subjects:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/copyMixedFrame2D.ts | 4109 | 919f38d2c972c770f88d2ca9695e066895e790e2425b3935098d3743ba29cb61 |
| packages/engine/rendering/imageFrameBudget.ts | 1813 | cb4f33b67f24d95430a334d4d9381c405e6ac7f75ffc419372a3edd1adc5f803 |
| tests/mixed-frame-2d.test.mjs | 18110 | 0606c34108f4a54efb52cd3aaab47a8ed03e960fb7bbdb36e681e6ef746ee3f7 |

| Receipt | Command (Node; repository root cwd) | UTC start / end | Exit / result | Receipt SHA256 |
| --- | --- | --- | --- | --- |
| admission-red | `node --test tests/mixed-frame-2d.test.mjs` | 2026-10-09T05:46:45.565Z / 2026-10-09T05:46:45.746Z | 1; 29 tests / 24 pass / 5 fail | f731a834ed091657140ae2ab4fb09b16839ed2a63456f6c8c9eba7073b1d123f |
| admission-build | `node tools/build.mjs` | 2026-10-09T05:47:11.201Z / 2026-10-09T05:47:11.693Z | 0; build PASS | 6b86256f17fbdf37dac541451ae14630dac560f914d75f452d087bbfeae4af06 |
| admission-focused | `node --test tests/mixed-frame-2d.test.mjs tests/texture-a1-integration.test.mjs tests/image-geometry-2d.test.mjs tests/texture-frame-types.test.mjs` | 2026-10-09T05:47:11.750Z / 2026-10-09T05:47:11.956Z | 0; 41 pass / 0 fail | 6ed2bc4193a36338c5ae34d85af3199efba1a531171311da19efd0c6cdc8af62 |
| admission-types | `node tools/check-types.mjs` | 2026-10-09T05:47:12.015Z / 2026-10-09T05:47:13.230Z | 0; positive and expected negative fixtures PASS | b5b6ab78e27f8b6c23d59b8707b4958fa739eeaedc928d4a00f18b8600e10fad |
| admission-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T05:47:13.293Z / 2026-10-09T05:47:13.916Z | 0; 237-file boundary PASS | 6788d1a8cb7d4510418bb0d2933cd149898db0899a179a653c35f9a5cf7851d5 |

Build ran once; the changed-source focused41/41, relevant types and direct boundaries passed. Expected compiler-negative diagnostics remain recorded. No full415/browser/device run was repeated for this change; the earlier415 and focused33 subjects are historical. Documentation was edited after these executable receipts and has separate byte identity. Final source review and publication validation remain pending; all A2 evidence is UNRUN.
