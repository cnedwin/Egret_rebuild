# Prepared resource groups: verification scope

English | [简体中文](../../Cns/docs/prepared-resource-groups-evidence.md)

Engineering preview 0.58.0 connects multi-Bitmap binding, prepared resource groups and a two-layer outfit scene. The [specification](prepared-resource-groups-spec.md) defines the contract. This record distinguishes implemented behavior, recorded desktop results and remaining product work.

## Interface and source review

`Engine.captureBitmapBindings(scope, targets)` returns a frozen `BitmapBindingTicket` with `prepare`, `commit` and `dispose`. The root adds one erased type; its 39 runtime value exports remain unchanged. The core remains free of DOM/Node access, new package dependencies and Host-protocol changes.

Independent review covered target authority, complete preflight before publication, binding generations, all-or-nothing commit, borrowed leases, reentry and shutdown. The example separately reviews its coordinator, original PNG reader, dependency/font owner, scene session and browser application. Existing first-party asset bytes and upstream license/source records remain unchanged.

## CPU, types and policy

| Recorded check | Result | Boundary |
| --- | --- | --- |
| Binding-ticket behavior and authority | 39 passed | Built public behavior plus explicitly identified authority units |
| Outfit coordinator | 17 passed | Publication, cancellation, compatibility and logical reservations |
| Outfit source | 18 passed | Original reader/PNG lifetime, content identity and options |
| Scene session | 10 passed | Genuine public SDK composition, dependency order and owner cleanup |
| Independent pixel-oracle units | 10 passed | Synthetic verifier controls; no native rendering claim |

Strict consumers passed their positive compilation and retained the 27 actual negative diagnostic tuples. Assigned boundary controls each used a fresh healthy baseline before their expected refusal. Updated retained type and source-policy identities preserve their historical records. An earlier complete-suite attempt exposed stale retained identity data. Corrected focused checks have saved receipts; at this source/native cutoff, the final full gate remains open until its own complete receipt. A timeout is not a passing suite.

## Real desktop scene

The recorded environment is Windows 10.0.26300 x64, Microsoft Edge 155.0.4283.45 and Playwright 1.62.1, with locale zh-CN, density 1 and no additional launch flags. Each run uses a fresh BrowserContext. The surface is 192×128 logical pixels.

| Profile | Scenario | Original readbacks | Result |
| --- | --- | ---: | --- |
| Canvas 2D | Ordinary lifecycle | 17 | Finite sequence passed |
| Canvas 2D | Old A outer layer | 5 | Assigned wrong layer detected |
| Canvas 2D | Old B trim layer | 5 | Assigned wrong layer detected |
| Textured WebGPU scene | Ordinary lifecycle | 17 | Finite sequence passed |
| Textured WebGPU scene | Old A outer layer | 5 | Assigned wrong layer detected |
| Textured WebGPU scene | Old B trim layer | 5 | Assigned wrong layer detected |

The initial six contexts retain 54 complete original RGBA files, totalling 5,308,416 bytes. Every context first renders and retires a direct public-SDK prerequisite before creating the application. The ordinary sequences cover startup, a genuine native mouse selection of the right pilot, animation immediately before and at 0.125 seconds, summer/mix publication, Error and `undefined` reader failure, held-reader cancellation, a distinct warm-lease cancellation, repeated changes, left-pilot removal and close while right-pilot reads remain held.

The repository-owned public verification tool was subsequently run in six further fresh contexts and retained its own 54 original readbacks. This is a separate reproduction of the same finite schedule, not an expanded pixel-comparison domain.

The independent comparison checks 49 authored points and a 1024-pixel fixed Chinese-text region per frame. Saved point comparisons total 2,646. Each of the four wrong-layer contexts first proves a healthy summer outfit, then manually changes only its assigned layer through a genuine separately owned lease. Exactly that layer's nine points differ; every other point and text comparison passes. These contexts never count as ordinary application acceptance. Retaining a full frame does not expand the finite comparison domain.

Both original direct-Canvas CJK references are authenticated before use. They cover only the recorded font subset and selected left/right labels in this environment. Opaque colors and output alpha are exact; only partially transparent reference pixels allow one RGB byte of premultiplied rounding. All 54 recorded text-region comparisons observed zero changed channels. The exact Canvas frequent-readback advisory is retained; there are no unexpected console or page errors.

## Ownership and resource accounts

Failed or cancelled changes retain both prior outfit layers. Error and `undefined` preserve their original rejection causes. Held cancellation and pending close each retain two real source reads and 164 bytes in the external reader until the original gates settle. The separate warm test holds two genuine public leases, then cancels before the replacement group's ready reaction.

Coordinator reservations, adapter encoded/raw/decoded ownership, external reader-held bytes, font payloads, frame images, geometry and Host pending work have distinct records. The application retains its initial and latest original RGBA results: one shared result is 98,304 bytes, two distinct results are 196,608 bytes. Verifier-saved files have their own account. These are logical payloads and recorded operations, not physical allocation or residency measurements.

All twelve prerequisite/application owner groups reached their recorded retirement conditions. Both coordinators, source/dependency work, fonts, warm leases and pending presentations drained; canvases were zeroed and removed. WebGPU reported safe cleanup with no pending frame/upload/readback/scene work. Zero pending work does not mean zero physical memory or immediate garbage collection.

Native font lifecycle testing also reproduced a close triggered by FontFaceSet observation. An additional state checkpoint before installation prevents a later font add. The same eight native cases passed after repair, with the assigned close case changing from one late add to zero. This is a bounded font-owner result.

## Reproduction and remaining work

After building the repository, use the public config preparer:

```text
node tools/prepared-resource-groups/prepare-native-config.mjs --playwright <absolute-playwright-1.62.1-directory> --workdir <existing-external-directory> --profile canvas-2d --kind ordinary
```

It writes a new configuration and prints the snapshot and actual-run commands. Capture and review the complete input snapshot before the actual run. Repeat for both profiles (`canvas-2d`, `webgpu-scene-textured`) and each scenario (`ordinary`, `manual-old-A-outer`, `manual-old-B-trim`). The source pins, original package inventory, actual trusted mouse actions, full original readbacks and owner retirement remain part of the verifier. A different reference environment refuses the fixed CJK comparison.

Full repository checks, mandatory hooks, GitHub PR/Main delivery and remote CI are separate evidence stages. This record establishes neither a CI pass nor complete P03 acceptance. General dependency manifests and additional 3D/Spine/audio consumers, full UI, production hosts, general typography, mobile energy/performance, physical GPU peaks and complete legacy migration remain open.
