# Owned textured geometry and Mesh2D: CPU evidence

English | [简体中文](../../Cns/docs/自有纹理几何与Mesh2D证据.md) · [Contract](textured-geometry-and-mesh2d-contract.md) · [Profile CPU evidence](textured-profile-cpu-evidence.md)

Engineering checkpoint **0.23.0**, prepared 2026-10-11. Owned textured geometry, Mesh2D, immutable profile frames and the explicit WebGPU host have bounded CPU, strict-type and desktop native evidence. The native run passed all 11 calibration and 10 held-out windows, with all 16 assigned windows detecting their 12 independently copied faults. Independent saved-result review accepted this one recorded Windows/Edge/NVIDIA environment. Public reproduction tooling, final paired-material review, current complete pre-push and remote delivery are separately recorded; this document does not infer them from a native PASS.

## Accepted CPU scope

The geometry factory owns independent frozen dense numeric arrays, validates every supplied component including unused vertices, and grants identity through private registration only after completion. Input buffer mutation cannot alter the completed value. Logical bytes are admission units, not a physical heap or GPU-memory measurement.

Mesh2D borrows the caller's exact lease. Atomic content replacement preserves Engine affinity and leaves prior content intact on failure; clear and disposal drop cached content without releasing that borrow. Bounds consume authored triangles before referenced index reads and include referenced point, line and collinear content without using visibility, alpha or clips to suppress it. Source review covers private ownership, debit order and guards inaccessible through public callbacks; the fixtures do not fabricate private-state corruption or otherwise inaccessible reentry.

| Check | Actual result | Evidence boundary |
| --- | --- | --- |
| Geometry behavior | 10/10 passed | Includes the dense own-property repair; separate review closed the finding and geometry was accepted. |
| Earlier image/frame regressions | 39/39 passed | Relevant geometry-stage regression, with overlapping cases. |
| Mesh display behavior | 6/6 passed | Real public Engine/AssetManager leases and literal geometry; missing-capability RED preceded implementation. |
| Direct content bounds | 78/78 passed | 5/5 semantic RED preceded the change; direct referenced-point arithmetic and quota priority checked. |
| Legacy Mesh refusal | 97/97 passed | One existing-skip case passed and three missing-refusal/order cases failed before the change. |
| Mesh-stage policy controls | 36/36 passed | Valid baseline plus four value/type leak controls reached genuine missing-guard RED before checker adoption. |
| Mesh-stage architecture scan | 315 files passed | Exact facades, declaration graph and private authority boundaries. |
| Mesh-stage strict root consumers | 110 negative diagnostics checked | Includes 16 geometry and 13 Mesh cases, each matched to its actual generated file, line and code; positive/DOM-free consumers passed. |
| Other strict consumers | 5 web and 28 project diagnostics checked | Web-positive passed; project cases individually located. |
| Independent CPU review | Passed with limits | Geometry and Mesh acceptance is limited to the CPU scope above. |

These are the final geometry/Mesh-stage observations, rather than the later helper totals. Subsequent profile and helper checks retain those cases; see the profile evidence. Focused and regression suites overlap and their counts are not added. The historical final Mesh emission had 296 files, the accepted profile CPU build had 324, Task 1 had 328, Task 2 had 340, Task 3 had 352 and Task 4 has 360. Each inventory retains its own build revision.

## Preserved failure history

On 2026-10-10, the unchanged implementation built under Node v24.19.0 at 09:12:55.011–09:12:55.859 UTC, exit 0. The geometry trial ran at 09:13:03.202–09:13:03.426 UTC, exit 1: 6 registered callbacks, 0 passed and 6 failed, with no cancelled, skipped or todo cases. The public facade imported. Each G01–G06 callback stopped at the common missing createTexturedGeometry2D capability assertion before geometry fixture allocation. This is authentic API-absence RED, rather than six reached geometric counterexamples or an import/setup failure. The 284-file emitted inventory remained stable around those historical runs.

A later implementation admitted an authentic frozen value whose canonical writes could be swallowed by an inherited Array numeric setter. A semantic RED preceded the own-property repair. The failed initial repair build and predecessor review remain recorded; the final successful build and 10/10 checks closed this bounded density defect. The repair is not general hostile-intrinsic protection.

Four Mesh type-code predictions were corrected from actual unsuppressed compiler output: forged geometry TS2741, unknown lease TS2379, wrong resource TS2379 and reversed arguments TS2739. Only expected-code comments changed. The failed observations remain test-expectation history, with no type weakening or suppression. A separate private verification-helper generation failed syntactically before any product/test imports; it is a setup failure and is not feature RED.

Two isolated arithmetic witnesses confirm authored-collinear translation rounding and Float32 NDC orientation reversal described in the contract. They import no product and prove no clipping, product packing, shader or native pixel behavior. Older image-alpha and rendering observations retain their original scope.

## Recorded stages and remaining work

The profile package/importer, browser-map and selected-copy provenance controls have completed; exact final CPU adoption is accepted. Separate selected host/type and final source-policy implementation reviews retain their own scope. Fresh affected desktop browser observations are recorded separately from CPU checks; see the paired profile evidence for their bounded results.

GPU plan Task 1's private shared budget and legacy preparation seams are accepted. Historical A01 reached the missing-ledger assertion only after genuine public geometry and accepted rectangle preparation succeeded. The unchanged budget fixture then passed 31/31 and the affected legacy files 37/37 after an actual build and independent source/emission review, at 216 source/fixture files and 328 emissions.

Task 2's private Mesh CPU preparation, packing and ordered dispatcher are also accepted. Historical G01 completed authentic public geometry before its missing-helper assertion. After implementation, a fresh build passed, the unchanged combined suite passed 90/90 (31 budget plus 59 Mesh cases), and the separate affected legacy run passed 37/37. Independent source/emission review bound 236 fresh runner inputs and 340 emissions: all prior 328 emissions remain unchanged, with exactly 12 additions. The completed CPU helper scope preserves authored-before-affine suppression, robust rank/represented signs, full XY/UV/RGBA clipping, shared accounting, one represented conversion per corner and empty painter barriers.

Task 3 adds authenticated metadata admission, complete indexed/clip preflight and storage planning before Float32/projection payload allocation. Its first-party per-invocation failure authority preserves exact allocation/conversion causes and rejects classification by a foreign caller-thrown class alone. Admitted upload bounds, device/dimension/readback checks and deterministic quota priorities are CPU/source evidence; actual GPU allocation and reservation are exercised by the later controlled host.

Task 4 implements createTexturedWebGPUHost, its four readonly optional numeric extensions, own immutable profile advertisement and synchronous new port. Rectangle, Bitmap and Mesh share the existing startup, ordered submission, fences, quarantine and cleanup owner. Controlled fixtures check the 32-byte XY/UV/light-RGBA ABI, per-draw layouts, crop sharing, pending geometry admission and exactly-once retirement. These observable device-boundary descriptors and lifecycle counters do not validate native WGSL compilation or rendered pixels.

Task 3 subsequently passed 155/155 combined CPU cases (31 budget, 59 Mesh and 65 admission), with separate 94/94 projection/image-host and 37/37 legacy geometry runs, at 241 selected inputs and 352 emissions. Task 4 passed 30/30 public controlled-host cases, 14/14 profile/legacy-port cases, a fresh 155/155 helper run and 146/146 affected old GPU checks including all 13 B1 cases, after its corrected build with 360 emissions. These historical results cover bounded source/controlled behavior; the later fixed desktop native cases are recorded separately. Existing Canvas, rectangle WebGPU and separate 3D evidence keeps its original scope.

Task 6 passed the strict positive consumer and checked 19 individually located unsuppressed new diagnostics, 33/33 new policy cases and 299/299 retained policy cases. Its source scan passed at the recorded 363-file boundary; later native-only additions retain separate provenance. The fixed comparator passed 208/208 CPU units with unchanged expectations and tolerances. Constructed byte arrays and metadata checks establish comparator behavior, without validating native shader compilation, pixels or copied-production sensitivity.

Fixed desktop Mesh2D pixels are accepted in the recorded scope. Spine playback, complete A2/3D/UI/fonts, physical phones, power/performance, production hosts and complete legacy-project migration remain unaccepted. Paired public material, final source-origin and key English comments, independent review, fresh pre-push checks and actual remote delivery remain separate gates.

## Sources and licensing

This summary curates first-party specifications, retained execution receipts and scoped independent reviews. Implementation and document preparation used AI assistance. Geometry explicitly reuses the first-party ImageData2D intrinsic-admission pattern; resource, bounds, frame and host mechanisms are reused within their reviewed scopes. This declaration is bounded process evidence, not global-originality or training-provenance certification.

First-party code and documentation retain [Apache-2.0](https://github.com/cnedwin/Egret_rebuild/blob/main/LICENSE); the Chinese license text is informational. The existing robust-predicates 3.0.3 public-root orientation dependency retains its [Unlicense notice](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE). No new dependency or copied upstream engine implementation was introduced by this CPU stage. Dependency notices and unrelated research-asset rights retain their own scope.
