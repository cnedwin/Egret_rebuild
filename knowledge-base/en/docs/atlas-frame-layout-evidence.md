# Atlas-frame layout evidence and limits

English | [简体中文](../../Cns/docs/atlas-frame-layout-evidence.md) · [Public contract](atlas-frame-layout-contract.md)

**Authoring cutoff: 2026-10-17.** The 0.59.0 engineering preview candidate has independently accepted SDK and finite desktop Canvas/WebGPU results. The current complete 13-stage verifier, final publication/prepush checks, affected retained browser gates, 0.59 commit/push/PR/Main and remote CI remain pending at this cutoff. Workspace packages remain private 0.0.0 and Host protocol 1.0.

The increment keeps a sprite's logical canvas stable across normalized single-page trim and clockwise90 packing through the existing Bitmap and sequence runtime. The [contract](atlas-frame-layout-contract.md) defines the API and ownership rules; the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md) shows their composition.

## Accepted evidence

| Lane | Accepted result and scope |
| --- | --- |
| SDK source and focused behavior | The reviewed implementation preserves the default rectangle path, owned five-field layout, exact-lease checks and `M * S` geometry. The focused run passed 48/48 tests; all nine dedicated strict/source guards passed. |
| Complete SDK run | The accepted twelve-stage `node tools/verify.mjs` run passed core 3559/3559 and the separate Spine experiment 160/160, each with failed/cancelled/skipped/todo 0. This is the earlier SDK cutoff. The newly registered thirteenth atlas source-boundary phase has a separate positive Source run: 114 modules, 1470 inputs and 117 routes. It is not a complete thirteen-stage rerun. |
| Assets and independent oracle | First-party atlas/provenance and literal masks were reviewed; pure oracle checks passed 23/23. They establish no browser pixels by themselves. |
| Public session and verification policy | The accepted R3 CPU suite passed 17/17: three genuine public-SDK session tests and fourteen policy tests. Genuine captures exercised N01–N10 and actual Scope cleanup faults. These are separate from native execution. |
| Native input closure | Six cases / ten role owners / 14896 unique raw files were independently admitted before launch, including actual compiler output, fixed toolchain, assets, oracle, routes and served-module closure. |
| Native pixels, playback and retirement | Six actual jobs passed on their first attempts, each in one fresh context. All 30 complete readbacks matched their independent literal mask at zero tolerance; assigned frames also differed from the healthy mask. Ordinary N11 replay passed after origin retirement on a distinct Host. Before/after role identities and loaded-response identities were retained and independently reviewed. |
| Final gates and delivery | Current complete verification, final prepush/publication and affected retained browser gates remain pending here. No 0.59 commit, PR, Main or remote-CI result is assigned. An absent remote check is not a CI pass. |

## Actual native results

All six jobs completed with exit 0, no timeout and accepted PASS reports in the recorded 2026-10-16 UTC run. Each readback is the complete 24×16 surface: 384 pixels / 1536 RGBA channels, zero tolerance.

| Backend | Ordinary | Rotation-sign control | Constant-trimY control | Contexts / readbacks |
| --- | --- | --- | --- | --- |
| Canvas 2D | N01–N11: 11 matched | Fresh healthy + assigned: 2 matched | Fresh healthy + assigned: 2 matched | 3 / 15 |
| Textured WebGPU 2D | N01–N11: 11 matched | Fresh healthy + assigned: 2 matched | Fresh healthy + assigned: 2 matched | 3 / 15 |

The recorded environment is Windows x64 10.0.26300, Node.js 24.19.0, Edge 155.0.4283.45 (`msedge`), Playwright/core 1.62.1 and no extra launch flags. The browser viewport was 640×480 at device scale factor 1; the compared surface was 24×16. SDK builds used pnpm 11.25.0 and TypeScript 7.0.2. All original owners, Hosts, contexts, browsers and servers closed; final diagnostics, page/console errors, cleanup failures and pending original tasks were zero. The Canvas ordinary run retained one `willReadFrequently` console warning; it is a readback hint, not a measured performance result. These observations do not identify physical GPU hardware or establish another host/device.

## Retained failures and repairs

The source-review counterexample showed that an algebraically expanded placement obscured the assigned local rotation-sign expression. The helper now keeps local `S` explicit before composing `M * S`; its focused behavior and guards were rerun. The original failure remains recorded.

The initial public-session/policy regression run retained five failures. The repaired scenario recognizes that a completed once controller has `isDisposed === true` while its Bitmap remains live with the final frame. Retirement now checks the settled authentic Scope diagnostic stream, preserving Error and `undefined` cleanup causes even when terminal getters are true. Compiler metadata references with lowercase physical spelling are bound uniquely to the authored logical source in each admitted role owner. The same suite then passed 15/15, followed by the final expanded 17/17 suite. Original failed evidence remains intact; the six later native runs needed no retries.

The assigned-copy difference is limited to the one approved TypeScript expression and corresponding genuine emitted JavaScript expression. Only its corresponding JavaScript source map and the one authenticated source-version entry in runtime `tsconfig.tsbuildinfo` may differ as compiler derivatives. Actual raw hashes, exact differences and compiler receipts are retained. All declarations and declaration maps, other code/maps, configurations and toolkit bytes remain identical. Build metadata is not served. These permissions do not allow arbitrary dependency-bookkeeping changes or normalized hashes.

A separate retained B1 verifier stopped at dependency admission before browser launch because its fixed allowlist omitted the new placement dependency; it produced no native frames. Its failure is preserved and a repaired fresh run remains pending here. It is outside the accepted six atlas runs above.

## Reproduce the checks

From the repository root, use the recorded pinned toolchain:

```text
node tools/verify.mjs
node --test tests/atlas-frame-admission.test.mjs tests/atlas-frame-bitmap.test.mjs tests/atlas-frame-capture.test.mjs tests/atlas-frame-playback.test.mjs
node --test tests/atlas-frame-oracle-unit.test.mjs tests/atlas-frame-session.test.mjs tests/atlas-frame-native-source.test.mjs tests/atlas-frame-boundary.test.mjs
node tools/atlas-frame/boundary.mjs
```

For each of the two profiles and three kinds, prepare a fresh private destination. Substitute absolute paths for the placeholders:

```text
node tools/atlas-frame/prepare-native.mjs --repository <repository> --task-root <private-task-root> --destination <new-private-directory> --playwright-root <installed-playwright-1.62.1-directory> --profile <canvas-2d|webgpu-textured-2d> --kind <ordinary|rotation-sign|trim-y-constant>
node tools/verify-atlas-frame.mjs --config <returned-config-path> --config-sha256 <returned-raw-sha256> --snapshot-only
node tools/verify-atlas-frame.mjs --config <same-config-path> --config-sha256 <same-raw-sha256>
```

Independently review the complete snapshot before the final command launches a browser. Private configuration, snapshots, compiler receipts and raw artifacts stay outside the repository. The following reference defines the finite scene and comparison domain; its protocol is the one exercised by the accepted six runs.

## Independent pixels and geometry

The fixed first-party atlas is 6×6 RGBA with transparent-zero background. Every named color uses channels 0 or 255 and alpha 255. A is packed at `(0,0,2,3)`, rotation 0, source 4×5 and trim `(1,1)`; its visible rows are `[red,green]`, `[blue,yellow]`, `[magenta,cyan]`. B is packed at `(3,0,2,3)`, clockwise90, source 4×5 and trim `(1,2)`; its packed rows are `[yellow,red]`, `[magenta,green]`, `[cyan,blue]`, and its unpacked rows must be `[red,green,blue]`, `[yellow,magenta,cyan]`.

A lasts 0.125 seconds and B lasts 0.25, for a 0.375-second clip. Both logical bounds remain 4×5, while both packed command rectangles remain 2×3. The asset generator and raw RGBA/encoded identities must be first-party and deterministic. The oracle must use independent literal masks, without importing product placement or sampling, importing the generator, or deriving expected pixels from actual commands.

Each backend uses a 24×16 DPR1 transparent surface with no text: **384 pixels / 1536 channels per complete frame, zero pixel tolerance**. Sampled points cannot substitute for this comparison domain. Parent Sprites begin at `(2,2)` and `(12,2)`; their child Bitmaps begin at `(0,0)`. Other initial transforms, anchors, clips, alpha and visibility are identity, zero, absent, 1 and true. The two actors share one immutable clip but have distinct exact leases. Left stays `once`; right stays `loop`.

The two exercised profiles are `canvas-2d` using public Engine, CanvasHost and `captureFrame`, and `webgpu-textured-2d` using public Engine, WebGPUHost and `captureTexturedFrame`. The latter covers textured 2D, without 3D or fonts. Each uses separate fresh contexts, default Edge and pinned Playwright/core 1.62.1 without added launch flags. Actual browser, Host and readback environment identities must be recorded; one backend's result cannot establish the other.

## Ordinary sequence reference

After `advanceTime(0)` establishes the source baseline, sheet-created Bitmaps show A; both controllers are idle with no `lastSample`. In the table, an idle actor's frame denotes its visible Bitmap, rather than a sample. A is index 0 and B is index 1. Source and game times coincide in this fixed schedule.

| Case | Operation before capture; source/game time | Left once: state / elapsed / frame | Right loop: state / elapsed / frame |
| --- | --- | --- | --- |
| N01 | Save genuine immutable frame as `savedN01`; 0 | idle / 0 / A | idle / 0 / A |
| N02 | Start left; advance to 0.125 | running / 0.125 / B | idle / 0 / A |
| N03 | Start right; no advance, 0.125 | running / 0.125 / B | running / 0 / A |
| N04 | Pause left; no advance, 0.125 | paused / 0.125 / B | running / 0 / A |
| N05 | Advance to 0.1875, then resume left | running / 0.125 / B | running / 0.0625 / A |
| N06 | Advance to 0.4375; delta 0.25 equals the default ceiling | completed / 0.375 / B | running / 0.3125 / B |
| N07 | Advance to 0.5 | completed / 0.375 / B | running / 0.375 / A |
| N08 | At 0.5, set left parent rotation 90 and both anchor offsets 1 | completed / 0.375 / B | running / 0.375 / A |
| N09 | At 0.5, set left parent clip `(0,0,3,4)` | completed / 0.375 / B | running / 0.375 / A |
| N10 | At 0.5, restore left parent rotation/anchors to zero and remove clip | completed / 0.375 / B | running / 0.375 / A |
| N11 | Retire origin resources and replay only `savedN01` through a distinct Host | no live handle or new time | no live handle or new time |

Only the four advances at N02/N05/N06/N07 produce ticks. Start and resume apply immediately without a tick; N05 reapplies held 0.125 and need not preserve sample object identity. Left remains completed after N06; N07 wraps the original right loop handle. N08/N09 change no time.

For identity parents, A begins at left `(3,3)` / right `(13,3)` with rows RG/BY/MC; B begins at left `(3,4)` / right `(13,4)` with rows RGB/YMC. All remaining pixels are transparent zero. N08's ideal left image matrix is `(1,0,0,1,-1,2)`; only canvas x=0 at y=2/3/4 shows R/G/B. N09 keeps parent matrix `(0,1,-1,0,3,1)` for the clip and removes the y=4 pixel, leaving R/G. Right A is unchanged. N10 restores left B/right A; N11 must exactly replay N01's two A frames.

The actual matrices at N08/N09 come from the existing sine/cosine display transform. Save the genuine command and clip coefficients unchanged; require all six to be finite and within absolute 1e-12 of the ideal literals. Do not round values back into the product. Packed rectangles, source rectangles, times and indices stay exact, and complete RGBA comparison remains zero tolerance. Direct literal-matrix checks and identity-parent assigned controls do not inherit this trigonometric tolerance.

Before N11, stop right and genuinely dispose the original controllers, Bitmaps, sheet, leases, Texture, Engine and Host, confirming retirement. The distinct Host receives only the saved frame, with no old-resource query, new sampling or edits to its frame/matrix/image. This tests immutable frame ownership after origin retirement, rather than device-loss or general graphics recovery.

## Assigned control reference

Healthy and assigned controls are first-party verifier mechanisms, not engine features. Each backend has two separate control contexts. Each control first needs its own fresh complete healthy baseline, then an independently sealed assigned root differing only in one approved product source expression and its actual compiled JavaScript counterpart. Declarations, other product bytes, fixture, atlas, layout, oracle and actor/time schedule stay identical.

Both controls capture left once/running/0.125/B and right loop/idle/0/A at source/game 0.125, with identity parents at their original positions. The healthy left image matrix is `(0,-1,1,0,3,6)`.

| Control | Sole source change in `packages/runtime/src/bitmapAtlasPlacement.ts` | Required assigned observation |
| --- | --- | --- |
| C-sign | In local clockwise90 `S`, change `b: -1` to `b: 1` | Matrix `(0,1,1,0,3,6)`; left rows YMC at `(3,6)` and RGB at `(3,7)` |
| C-trim | In `ty: layout.trimY + width`, replace only `layout.trimY` with literal `1` | Matrix `(0,-1,1,0,3,5)`; left rows RGB at `(3,3)` and YMC at `(3,4)` |

Each healthy page must first exactly match the full B-at-0.125 literal mask. Close that page and settle cleanup, then open a new page/document/module realm at a distinct assigned origin in the same control context. Load the complete accepted assigned module graph through its fixed routes/import map, recording actual response identities. An on-disk hash alone does not prove the assigned module was loaded. Do not patch an already loaded healthy module or introduce runtime bad-input flags, debug exports or fixture changes.

The assigned raw frame must both match its complete literal wrong mask and differ from the healthy expected mask, with unchanged right actor and background. Preserve actual actor state, mode, elapsed time, packed source rectangles and genuine submitted command matrices. Setup/import/page errors, missing B, failed browser/cleanup, altered scenes or an unproven loaded closure are refusals of the verification attempt, rather than a successful control hit. Close pages, Hosts, tasks, servers and contexts; compare each root before/after against its own accepted snapshot.

The accepted runs exercised **6 contexts and 30 complete readbacks**: per backend, ordinary 11 plus C-sign 2 plus C-trim 2, across 3 contexts. Each readback covered 1536 channels. The source expression uses `width`, the packed crop width, in `ty: layout.trimY + width`; it is the same packed-width term used in the contract's geometry.

## Snapshot and execution boundary

`tools/verify-atlas-frame.mjs` accepts only `--config`, `--config-sha256` and at most one `--snapshot-only`. It must reject unknown, duplicate or missing flags, authenticate raw configuration bytes before strict UTF-8/JSON and exact-own-key checks, and then inspect declared owners and closures. The closed configuration binds scenario profile/kind, roots, output/snapshot locations, fixture, oracle and ordered healthy/assigned roles; it supplies no arbitrary script or scene function.

Snapshot-only must produce a new complete source/emission/declaration/configuration/toolchain/asset/oracle/served-closure snapshot with status `SOURCE_ONLY_NO_BROWSER`. An independently accepted snapshot is a prerequisite for launch. Execution must use the same configuration bytes/hash, compare each current closure with its accepted snapshot before launch and after cleanup, and retain actual raw output and loaded-response identities. It must not replace the accepted snapshot during execution. A changed control expression requires renewed source/protocol acceptance before use.

Final full local gates, public-content/source-origin and bilingual successor review, actual 0.59 Git delivery and remote CI retain their separate pending lanes. This finite protocol cannot establish exporter imports, multipage, pivot/nine-slice import, seek/rate/events, atomic animated-resource replacement, full Spine R020/V020, migration R008/V006, physical GPU/mobile behavior, memory, device-loss or performance. The increment is independently implemented against the existing Egret Engine runtime. Existing [source records](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json) and [acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) retain provenance and applicable notices.
