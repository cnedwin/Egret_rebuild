# Named SpriteSheet opaque browser verifier

Current tooling uses Node 26.7.0. Follow the [prepare/review/run guide](../../knowledge-base/en/docs/historical-browser-workflow.md). Previous Node 24 receipts retain their original scope; the fixed oracle, admission and external-retirement requirements below remain mandatory.

English | [简体中文](README.zh-CN.md)

This first-party Apache-2.0 verifier composes public `createSpriteSheet` with the existing Engine-clock sequence controller. One original CPU atlas and one manager-issued lease supply two genuine caller-owned Bitmaps: the animated actor and a static named icon. The selected public Canvas and WebGPU hosts render captured authentic frames. It uses no private product import, copied validator, explicit player, renderer patch or third-party asset.

The original source-candidate record classified syntax, browser execution and independent saved-result review as **NOT_RUN**. That historical cutoff remains separate from later attempts. The numbers below define completeness requirements, not measured results; earlier sequence-playback results do not qualify this SpriteSheet fixture.

## Invocation and prerequisites

Use the reviewed installed Windows x64 rig: Node 26.7.0, TypeScript 7.0.2, Playwright and adjacent playwright-core 1.62.1, and normal Microsoft Edge. Follow the [repository setup guide](../../README.md) for the genuine workspace installation. A separate owner builds and reviews current source, accepts all finite lanes, and supplies admission. The collector does not install, build, download, invoke Git or run a compiler.

From the checkout root:

```text
node tools/spritesheet/collector.mjs --playwright "<absolute installed package directory>" --channel msedge --output "<absolute fresh outside-checkout directory>" --admission "<absolute independently accepted admission JSON>"
```

Exactly these four options, once each, are admitted. All three paths are absolute; the output parent exists while the directory is absent and outside the checkout and Playwright inputs. Each attempt is fresh. Launch is default headless `msedge` with no added flags, browser environment override or persistent profile override. The actual browser/OS/adapter facts are recorded for the attempt; adapter names do not prove hardware acceleration or performance.

## Saved-build admission

The collector reads `spritesheet-native-admission/1`, status `ROOT_FROZEN_REVIEWED_CURRENT_BUILD`, with an explicit actual `repositoryRoot`, recorded forty-character `sourceBase.head/tree`, plain runtime identity, complete SDK inventories and saved build actor. It performs no fresh Git provenance check. Root-relative rows remain forward-slash logical paths; absolute authority/compiler rows retain their saved spelling. Pins contain only `{path,bytes,sha256}` with safe nonnegative byte counts and lowercase SHA256. No basename matching or arbitrary alias normalization exists.

The exact four product rows are runtime `src/spriteSheet.ts`, `src/Bitmap.ts`, `src/index.ts`, and Engine `src/index.ts`. Full source includes the four SDK `src` trees and Engine `web/rendering`; emitted inventory includes all four `dist` JS/declarations, excluding maps/buildinfo/experiments. Every served first-party JS, original TS counterpart and matching declaration must belong to that saved build. The two package-declared public host roots and Engine root have a bounded literal ESM closure, fixed package/Engine aliases and no resolver, evaluation or remote fallback.

`build` supplies `receiptPin/jobPin/inventoryPin/commandName/stdoutPin/stderrPin`. The build receipt is a literal JSON ARRAY; exactly one named actor has exit0, timeoutfalse, args `["tools/build.mjs"]`, valid ordered timestamps and matching complete raw streams. The same job command declares the current checkout and exact collector Node executable. Job declarations are the exe/cwd authority; those fields are not independently recorded by the raw receipt. Other historical rows in the ARRAY retain their own failures and do not create an aggregate build/CPU success.

The pinned producer has schema `spritesheet-sdk-build-inventory/1` and preserves its original status `CURRENT_SDK_INVENTORY_DATA_PENDING_INDEPENDENT_ACTUAL_REVIEW`, state and `originalActualReviewPin:null`. Separate `reviews.build` must be actual accepted `ACTUAL_GREEN_ACCEPTED`/open0 with explicit `receiptPinPointer` and `inventoryPinPointer`. It qualifies the producer bytes without rewriting their generation cutoff. All five original identity arrays remain exactly equal between admission and producer, with the same nested build receipt/job/log/runtime pins.

`reviews.plan/product/build/cpu/types/policy/units/example/nativeSource` each supply an exact pinned accepted review, numeric open0. CPU/types/policy/units/example/build require an actual verdict. Product uses explicit `sourcePinsPointer`; `nativeSource` uses the same field for all seven current `tools/spritesheet` paths. Missing, future, incomplete or mismatched reviews refuse before launch. Source acceptance never invents an actual lane result. The exact schema1 plan record with kind SPRITESHEET_SS1_FINITE_INDEPENDENT_IMPLEMENTATION_PLAN_SOURCE_REVIEW uses status PASS_SOURCE_PLAN and has no verdict field; this adapter applies only to the native-plan role. All other roles retain their verdict checks. The current product identity pointer is /reviewedPins; /reviewedFiles contains names, not identity rows.

The exact twenty configuration rows retain root manifests/lock/workspace/strict configs, build/project-format tools/schema, four SDK package manifests/configs, Engine rendering/web configs, and the two logical TypeScript package/launcher files. Seven compiler-owner rows retain the bound external Node plus four TypeScript package/launcher files and the native Windows package/executable. Fixed hoisted 7.0.2 logical/physical relationships admit only these known owners; original physical rows are not converted into invented logical identities.

Four compiler directory relationships and six assigned compiler files are observed before launch and after full retirement; the same endpoints, bytes and hashes are required. All four saved workspace aliases must resolve to their own current checkout packages and original package pins before/after. Raw owner observations, complete selected-input identities and their stable comparisons are saved. Missing, changed, failed or unobserved ownership yields `INCOMPLETE` even if an old physical file still hashes correctly. These checks are source/build readback, not signatures, security attestation or OS process-retirement proof.

## Original literal matrix

The atlas is 6×2, 48-byte straight-sRGB rgba8unorm: top row red/red/green/blue/blue/blue; bottom row red/red/green/transparent/transparent/transparent. Its four exact names are `red`, `green`, `blue`, `__proto__`. The red2×2 actor is at `(1,1)`; the static3×1 blue icon is at `(4,1)` and painted second. Output is 8×4/DPR1, clearColor0/clearAlpha0. Input mutation cannot alter canonical frozen names/regions. Both Bitmaps use the same original borrowed lease and belong to the resource Scope.

The clip uses `.125/.25/.125`; the real clock has maxDelta`.5`. `advanceTime(0)` seeds without a tick. Resource, playback and observer Scopes are separate.

| Row | Literal public action | Actor / controller |
| --- | --- | --- |
| N1 | Initial capture; preserve original frame | red / idle once, source0 |
| N2 | Start once; absolute source`.125` | green / running |
| N3 | Dispose sheet; absolute source`.375` | blue / running; canonical metadata retained |
| N4 | Absolute source`.5` | blue / completed once; target claim released |
| N5 | Create/start loop on the same actor; no advance | red / running loop0 |
| N6 | Pause; absolute source`1` | held red / paused loop0 |
| N7 | Resume held red without a tick; absolute source`1.125` | green / running loop`.125` |
| N8 | Absolute source`1.5` | red / loop boundary`.5` |
| N9 | Close live callers/origin Engine; replay original N1 on another host/device | original red and static blue; no recapture |

Each backend requires six explicit ticks, eight new captures and one replay. Canvas plus WebGPU requires 18 submissions, 576 pixels/2304 channels at tolerance0. The [independent oracle](oracle.mjs) contains three entire 128-channel literals including the static icon and every transparent exterior channel. It checks both command geometries, image/frame/clip metadata, frame IDs1–8/replay1, host serials, clock/sample prefixes, same-lease ownership and terminal cleanup. Every original 128-byte raw buffer is saved before any oracle comparison. Expectations never depend on observed output pixels.

Playback Scope closure preserves both live caller Bitmaps, Texture/exact lease and frozen sheet metadata. Caller retirement then releases that lease, clears both Bitmaps, closes all Scopes/clock/Engine and disposes the provider once. Original images and cached samples remain unchanged. N9 uses the exact original frame on an asset-free distinct host, and a distinct application-owned device for WebGPU.

## Closure, result and limits

Acquire readback before rendering and register idle before awaiting both. Settle acquisitions and original tickets before host retirement. Require safe host close and zero pending work before destroying the application-owned device, then await destroyed device loss. Unsafe, timed-out or late unresolved owners quarantine and yield `INCOMPLETE`; zero counters alone are insufficient. Fixture/context/browser/loopback closure and complete stable identities are mandatory. Only the exact inherited Canvas advisory in [console-policy](console-policy.mjs) is recorded as non-performance evidence; other warnings/errors are fatal.

Inherited budgets are 20s per operation,240s collection,280s retirement,295s hard deadline, and an at-most300s external owner watchdog, with finite event/module/input/output budgets. A separate reviewed external Windows Job owner must save raw streams/EOF, process assignment, active-zero/Job closure and retirement facts. Collector closure alone proves no OS process retirement.

Only completed actual attempts emit `PASS_SPRITESHEET_OPAQUE_SUBSET`/exit0, `FAIL_SPRITESHEET_OPAQUE_SUBSET`/exit1, or `INCOMPLETE`/exit2. Raw submission counts include replay. This rig establishes no alpha calibration, interpolation, physical OOM/GC, hardware scanout, phone/browser matrix, throughput, entitlement, full Spine R020/V020 or migration R008/V006 acceptance.

In the current hoisted layout, the retained four compiler-directory rows represent two physical owners twice; each is a self mapping. They do not prove four distinct aliases.
