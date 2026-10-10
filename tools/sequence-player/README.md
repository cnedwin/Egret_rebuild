# Public SequencePlayer opaque browser verifier

English | [简体中文](README.zh-CN.md)

This first-party tool projects the existing opaque Bitmap collector into the public [SequencePlayer contract](../../knowledge-base/en/docs/sequence-player-contract.md). It exercises `egret.createSequenceClip` and `egret.SequencePlayer` from the root public entry, plus the selected `/web` or `/webgpu` public host entry. It never imports a private sampler or manually assigns the Bitmap crop. The separately reviewed fresh public-player observation and its exact source identities are recorded in the [contract acceptance section](../../knowledge-base/en/docs/sequence-player-contract.md#recorded-acceptance--2026-10-10); earlier Bitmap evidence remains a distinct prerequisite.

## Run prerequisites and command

Use an existing installed Node.js 24.19.0, Playwright and adjacent playwright-core 1.62.1, standard installed Microsoft Edge, and the repository's pinned dependencies. The collector installs nothing and downloads nothing. Build the current source first with `node tools/build.mjs` from the checkout root. See the [repository guide](../../README.md) for dependency setup.

From the repository root:

```text
node tools/sequence-player/collector.mjs --playwright <installed module> --channel msedge --output <fresh output directory>
```

Replace both path placeholders with absolute paths; quote paths containing spaces. `--playwright` selects the installed `playwright` package directory, whose sibling must be `playwright-core`. The output parent must already exist. The candidate directory must not exist and must be outside the repository and both installed module roots. Each attempt uses a fresh directory and cannot overwrite a prior result.

The collector retains the original Windows x64 / Node.js 24.19.0 / Playwright 1.62.1 admission profile and standard Edge executable location. It launches installed `msedge` headlessly with default options and no extra flags. Actual browser version, OS release and WebGPU adapter observations are recorded per attempt. This is a fixed rig qualification, not portable or device-wide acceptance. The recorded public-player native attempt accepted only the fixed opaque subset on its recorded rig; the original execution-time reading-file identities and subsequent reading-only updates are distinct.

## Fixed observation scope

A literal 6×2 opaque atlas supplies red 2×2, green 1×2 and blue 3×1 regions. A once player applies exactly 0, 0.125 and 0.375 seconds to the actual Bitmap, then disposes before caller-owned Bitmap/lease/Texture/Engine retirement. Disposal must leave the Bitmap live, the exact lease entitled, and `lastSample` equal to the cached immutable returned sample. A distinct compatible host replays the saved red frame without resampling or recapturing.

Each backend submits four 8×4 DPR-1 frames: eight frames, 256 pixels and 1,024 raw channel comparisons total. [oracle.mjs](oracle.mjs) retains independent literal coordinate/RGBA expectations and zero tolerance. Opaque interior pixels and transparent cleared background belong to this subset; partial-alpha blending, interpolation, performance, physical scanout, hardware acceleration, production devices and complete A2 remain unproved.

The adopted [file graph](file-graph.mjs), pixel oracle and [console policy](console-policy.mjs) retain their original bytes and algorithms. The collector binds the seven public tool/source/reading files, installed dependencies and selected source/emitted/runtime inputs before launch, saves the oracle before launch, and rechecks all selected input identities after collection. It preserves raw `.rgba` captures, metadata, requests, events, host/device cleanup and an explicit result. Missing player proof, identity drift, budget overflow, unexpected faults or unsafe cleanup prevent completion.

Only this exact warning on the Canvas backend at warning level is advisory:

```text
Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
```

Classification uses full text equality before recorded-text truncation; it performs no trimming or substring/URL matching. The same text at error level or on WebGPU is fatal, as are all other warning/error messages. The suggestion is preserved with `performanceEvidence:false` and does not prove a performance improvement. The 128-event and 8,192-character limits still fail closed on overflow.

## External retirement and result boundaries

Use a separate external owner with a finite outer watchdog of at most 300,000 ms and an explicit Windows Job/process-retirement receipt. Per-operation, collection, cleanup and hard deadlines remain 20,000 / 240,000 / 280,000 / 295,000 ms. Collector closure does not attest OS process retirement. The external receipt must establish assigned ownership, complete output streams, active-zero and Job closure; review it separately from the tool result.

`result.json` reports `PASS_OPAQUE_REGION_SUBSET`, `FAIL_OPAQUE_REGION_SUBSET` or `INCOMPLETE`, with exit codes 0, 1 or 2. A subset result applies only to its recorded current-build inputs, rig and observations. It is not full player lifecycle acceptance, portable browser qualification, alpha precision, GPU performance or production readiness. The externally owned native run and independent saved-artifact review remain separate obligations.
