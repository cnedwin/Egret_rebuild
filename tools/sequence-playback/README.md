# Public SequencePlayback opaque browser verifier

Historical collector profile: the Node 24.19.0 instructions below preserve this experiment’s original protocol. They are not the current onboarding path or proof of Node 26 compatibility. Use [the current guide](../../knowledge-base/en/docs/getting-started.md#contribution-metadata-and-browser-checks) and tools/browser-tool-matrix.json to select an active suite. Those suites do not replace this collector’s comparison domain; changes affecting this domain require a separately reviewed migration.

English | [简体中文](README.zh-CN.md)

This first-party verifier observes a real Engine clock driving public `engine.createSequencePlayback`, then explicit capture/render and immutable-frame replay. It consumes `@egret/engine` and selected `/web` or `/webgpu` public hosts. It uses no explicit player, private sampler, product stub or manual crop. Existing `tools/sequence-player` observations remain historical and cannot qualify the new controller.

Source files alone do not establish browser success. The counts below define the protocol requirements; consult the saved result for an actual attempt.

## Prerequisites and invocation

Use the reviewed Windows x64 rig: installed Node.js24.19.0, TypeScript7.0.2, Playwright and adjacent playwright-core1.62.1, normal installed Microsoft Edge, and genuine checkout dependencies. Setup follows the [repository guide](../../README.md). The collector installs, builds and downloads nothing. A separate owner must build current source, review source/build records and freeze admission.

From the checkout root:

```text
node tools/sequence-playback/collector.mjs --playwright "<absolute installed playwright package directory>" --channel msedge --output "<absolute fresh output directory>" --admission "<absolute reviewed admission JSON>"
```

All three paths are absolute. Output parent must exist; output directory must be absent and outside the checkout and installed Playwright roots. Each attempt uses fresh output. Only these four options, once each, are accepted. Default headless Edge has no added flags or browser environment/profile overrides. Actual versions, OS and adapter observations belong to each attempt, not all devices.

## Read-only admission contract

Pins are plain `{path,bytes,sha256}` with nonnegative safe integer bytes and lowercase SHA256. Product/source/emission/configuration arrays retain the saved root-relative forward-slash logical paths; authority/runtime pins are absolute, and the seven compiler-owner rows retain their saved absolute spellings. Logical and physical identities are related only by the fixed owner mapping below, not treated as identical path text. These saved identity checks are not signatures, security attestation or CI authorization. Supplied admission must be independently reviewed; the collector does not create it or grant independence to an author.

| Field | Required meaning |
| --- | --- |
| `schemaVersion` | `sequence-playback-native-admission/1` |
| `status` | `ROOT_FROZEN_REVIEWED_CURRENT_BUILD` |
| `repositoryRoot` | Absolute path whose realpath equals this actual tool checkout |
| `sourceBase` | Recorded `head/tree`, each40-character lowercase Git SHA; tool does not run Git to verify them |
| `productSourcePins` | Exact four paths below, matching complete source inventory and product review |
| `sdkSourcePins` | Complete current four-SDK `src` plus Engine `web/rendering` `.ts` inventory |
| `sdkEmittedPins` | Complete four-SDK `dist` `.js/.d.ts` inventory, without maps or experimental outputs |
| `configurationPins` | Exact configuration set below |
| `compilerOwnerPins` | Exact seven saved rows: the already bound external Node executable, four TypeScript package/launcher files, and two native platform package/executable files |
| `runtimePin` | Actual Node executable shared by saved build and collector |
| `reviews.plan` | `{pin}` accepted review, numeric `openFindings:0`, verdict beginning `PASS` |
| `reviews.product` | `{pin,sourcePinsPointer}` accepted source review, explicit JSON pointer to four plain logical/absolute pins |
| `reviews.build` | `{pin,receiptPinPointer,inventoryPinPointer}` independent `PASS_ACTUAL` build review, numeric open0, pointers to exact saved receipt/inventory pins |
| `build` | `{receiptPin,jobPin,inventoryPin,commandName,stdoutPin,stderrPin}` real saved actor/job/inventory/raw logs |

Product paths are `packages/engine/src/sequencePlaybackTypes.ts`, `sequencePlayback.ts`, `Engine.ts`, `index.ts`. The exact twenty configuration paths are root `package.json/pnpm-lock.yaml/pnpm-workspace.yaml/tsconfig.json/tsconfig.base.json`, `tools/build.mjs`, `tools/generate-project-format.mjs`, `packages/contracts/schema/project-format.schema.json`, four SDK package manifests and `tsconfig.json`, Engine `tsconfig.rendering.json/tsconfig.web.json`, and logical `node_modules/typescript/bin/tsc` and `node_modules/typescript/package.json`.

The two compiler configuration paths and the four TypeScript owner rows (`package.json`, `bin/tsc`, `lib/tsc.js`, `lib/getExePath.js`) resolve through the genuine `node_modules/typescript` Junction to `node_modules/.pnpm/typescript@7.0.2/node_modules/typescript`. The exact platform owner is `node_modules/.pnpm/@typescript+typescript-win32-x64@7.0.2/node_modules/@typescript/typescript-win32-x64`; the TypeScript package's adjacent platform Junction must resolve there, with pinned `package.json` and `lib/tsc.exe`. Package names/version, launcher metadata and Windows/x64 metadata must match. Only the already verified saved build/collector Node executable may be external; no general alias or external-file permission exists. Original saved rows remain unchanged while each byte/hash is checked against its assigned physical owner.

Before browser launch, `compiler-owner-before.json` and `admission-binding.json` record the four fixed directory relationships (two logical aliases and their physical-owner self mappings) and six assigned logical file paths with their expected and observed physical pins. The two logical compiler configuration files are included in those six paths. After fixture/context/browser/loopback retirement, the collector re-resolves the same four directory and six file relationships, writes `compiler-owner-after.json`, and requires the same endpoints and byte/hash identities before `identitiesStable` or any `PASS` status. Missing, changed, failed or unobserved relationships yield `INCOMPLETE`, even when the old physical files still hash correctly. This is a fixed-owner readback check, not a general resolver or OS process-retirement proof.

`build.inventoryPin` identifies an object with schema `sequence-playback-sdk-build-inventory/1`, status `ROOT_FROZEN_ACTUAL_SDK_BUILD_INVENTORY` and an explicit `repositoryRoot` equal to this checkout. Its nested `build` contains the exact `receiptPin/jobPin/stdoutPin/stderrPin/runtimePin`. All five recorded arrays `productSourcePins/sdkSourcePins/sdkEmittedPins/configurationPins/compilerOwnerPins` must preserve the same path/byte/hash sets as admission, then pass the fixed logical-to-physical checks. Its association must be independently accepted, not filled from arbitrary current hashes.

Receipt is a literal ARRAY. Exactly one `build.commandName` row must have exit0, timeoutfalse, args `["tools/build.mjs"]`, real timestamps and matching raw log paths/hashes. Its same-named `job.commands` entry uses checkout cwd, this Node executable and identical args. Missing owner, drift, unqualified review, missing declaration or unsupported graph syntax refuses before browser launch; no future hashes/counts are predicted.

Graph serves canonical package-declared roots/imports and genuine foundational files through loopback. The copied restricted lexical reader has no general resolver, evaluation or remote fallback. Every selected first-party source/JS/declaration is bound to saved build inventory; before/after identities include tool, configuration, installed runtime/dependencies and saved authorities.

## Fixed literal observations

Each fresh Canvas/WebGPU realm owns one6×2 opaque atlas, Texture, manager-issued lease and Bitmap at `(1,1)`. Red2×2, green1×2, blue3×1 clip durations are `.125/.25/.125`. Resource, playback and observer Scopes are separate. Clock ceiling is `.5`, source baseline0.

| Submission | Public operation | Expected state / local elapsed | Crop |
| --- | --- | --- | --- |
| once-start | start once | running /0 | red |
| once-end | source .5 | completed /.5 | blue |
| loop-start | create/start loop on same target | running /0 | red |
| loop-cross | source1 | running /.5 | red |
| loop-green | source1.125 | running /.625 | green |
| paused-gap | pause, source1.625 | paused /.625 | green |
| resumed-held | resume without advance | running /.625 | green |
| resumed-blue | source1.875 | running /.875 | blue |
| saved-red | caller resources/Engine closed, distinct-host replay | cached terminal records | red |

Capture/render/equal-source preserve clock/sample observations. A genuine owned observer records five literal ticks and public subscription disposal; no internal handler count is fabricated. Playback Scope close leaves Bitmap/Texture/exact lease live and provider-disposal0. Caller retirement clears/releases resources, closes Engine/clock/Scopes and disposes provider once. Cached samples and saved authentic image/frame stay unchanged. Replay uses another asset-free compatible host and, for WebGPU, another acquired distinct device; it does not capture/resample after shutdown.

Nine submissions/backend are eight new captures and one replay. Completeness requirements are18 submissions,576 pixels and2304 raw channel comparisons, not actual success. The independent [oracle](oracle.mjs) fixes every8×4 DPR1 pixel including transparent exterior, tolerance0. Every full128-byte RGBA is saved before comparison with source/destination/matrix, image identity, frame IDs1–8/replay1 and host serials. No screenshot-only or observed-byte-fitted oracle.

## Native cleanup and limits

Request readback before render; register `whenIdle` before awaiting both. Record startup/loss/uncaptured GPU errors, page/network faults, full warning classifications, pending work and late ownership. Only the exact inherited Canvas readback advisory in [console-policy.mjs](console-policy.mjs) is recorded with `performanceEvidence:false`; all other warning/error routes are fatal. No performance conclusion follows.

Settle acquisitions/tickets before safe host close, then destroy collector-owned devices borrowed by the host and observe destroyed loss. Unsafe or unsettled timeout quarantines ownership and yields `INCOMPLETE`. Fixture/context/browser/loopback-server closure and stable identities are required. Deadlines retain20,000ms per operation,240,000 collection,280,000 cleanup,295,000 hard and at most300,000 external watchdog, with inherited finite event/file/byte budgets.

Separate external Windows Job ownership must save complete stdout/stderr and EOF, assignment, active-zero/Job closure and process-retirement evidence. Collector/browser close does not prove OS physical retirement. Saved results require independent review.

`result.json` reports `PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET`, `FAIL_SEQUENCE_PLAYBACK_OPAQUE_SUBSET` or `INCOMPLETE`, exit0/1/2. Raw submission count includes replay and applies only to recorded current-build inputs/actual rig. Capacity, controlled faults, alpha blending/interpolation, other browsers/phones, physical scanout, hardware acceleration, performance, full MovieClip/Spine and migration remain separate.
