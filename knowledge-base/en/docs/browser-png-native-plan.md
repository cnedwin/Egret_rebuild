# Browser PNG native acceptance plan

English | [简体中文](../../Cns/docs/浏览器PNG原生验证计划.md)

## Current 0.46.0 publication cutoff — 2026-10-14

The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. Complete current repository/prepush gates, this increment's push/PR/Main and remote CI acceptance remain PENDING.

The sections retained below record the earlier 2026-10-13 source/documentation cutoff. Their NOT_RUN statements retain that historical scope; the current successor in this section takes precedence for status, while the behavior and frozen numeric schedule remain unchanged.

Current public native plan draft, 2026-10-13. The schedule has independent source acceptance. The six-operation observer has accepted source and 39/39 controlled UNIT results; these are not native browser results. Product CPU/cold and strict-type evidence is accepted, current policy controls are independently accepted, and the native collector is being prepared as source. Native browser execution, full repository gates and delivery are NOT_RUN. All native counts below are requirements, not observed passes. See the [contract](browser-png-contract.md), [implementation plan](browser-png-implementation-plan.md) and [evidence](browser-png-evidence.md).

## Original input and output authority

Reuse the independently accepted original encoded fixtures; do not regenerate or edit them:

| File | Bytes | Raw SHA-256 | Dimensions | Literal decoded RGBA expectation |
| --- | ---: | --- | --- | --- |
| rgb-red-green.png | 72 | 917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d | 2×1 | [255,0,0,255, 0,255,0,255] |
| rgba-red-transparent-black.png | 72 | b94f4bc3c8e745088406b8f87bd06c99c6bbc2cd2646b9948a4cab0b89084ab0 | 2×1 | [255,0,0,255, 0,0,0,0] |

Both are original 8-bit, noninterlaced, untagged IHDR/IDAT/IEND files. Accepted generation used Python standard-library CRC/zlib, including its encoder sanity relation. Generation is not browser decoding. Keep its original generator, generation record and actual independent review pinned, with the two literal 8-channel oracles. The controlled CPU framing fixture with placeholder CRC/IDAT is not a native PNG input.

The separately authored full-frame masks represented by the row table below and the sealed schedule data are the expected pixels; never derive them from a rendered frame, product decoder, image sampler or screenshot. The mask uses transparent black T=[0,0,0,0], red R=[255,0,0,255] and green G=[0,255,0,255]. Canvas straight RGBA and WebGPU premultiplied RGBA are equal for this opaque/transparent-black subset. This establishes no arbitrary translucent, hidden-RGB, HDR, color-profile or all-PNG fidelity.

## One genuine resource route per backend

Run Canvas first, then WebGPU, in separate fresh contexts in one default headless msedge launch. Use the already admitted installed browser/Playwright/Node owners; add no launch flags, browser-environment overrides, installations or dependencies. Set deviceScaleFactor and host pixelRatio to 1, a viewport of 800×650, and an 8×4 canvas with exact 8×4 CSS size. Record the actual browser version and available adapter information; neither is predicted here. Unavailable WebGPU is an explicit incomplete/unavailable lane, not a Canvas fallback or skipped PASS.

Import only the emitted public `@egret/engine`, `@egret/engine/web/image` and selected public host entry: `@egret/engine/web` or `@egret/engine/webgpu`. Construct `createBrowserTextureProvider({ readBytes })` with **ports omitted**. The real reader fetches only the two admitted same-origin PNG routes and returns the actual native response bytes; record original ref/receiver/frozen manager context and exact fetched bytes. No fabricated context, direct provider.load, reconstructed oracle Texture or additional provider cache is permitted.

Create a genuine Engine and register one original asset type with that provider. Acquire RGB twice through engine.assets to qualify one shared entry with distinct leases; release the first lease and retain the second in the resource Scope. Acquire RGBA once and retain that lease in the same Scope. Require two reader/native decode invocations, two genuine Texture values and the exact public ImageData2D pixel copies. The provider internally materializes its owned image and Texture through the existing APIs; the collector does not substitute createTexture/createImageData2D for PNG decoding.

Use RGB SpriteSheet regions red=(0,0,1,1) and green=(1,0,1,1). The actor and static green icon borrow the same RGB lease; put them at (1,1) and (2,1). Use an RGBA sheet region pair=(0,0,2,1), with its Bitmap at (4,1). These are three painter-ordered image commands over two original images. Preserve exact lease/image identities, natural sizes and source crops.

Create the existing RGB SequenceClip with red/green durations 0.125/0.125 seconds and the genuine Engine once playback in a separate animation Scope. Seed advanceTime(0), start playback, then advance only at the literal scheduled source below. Scope ownership, sampling and invalidate-generation semantics remain the independently qualified CPU lane; native adds the real decoded-image/render/held-frame route, not another player or manager algorithm.

## Frozen draw/readback schedule

| Step, per backend | Action | Expected row y=1, x=0…7 |
| --- | --- | --- |
| N1 | Capture and submit the red sample after seed 0 and start; retain this exact frame | T R G T R T T T |
| N2 | advanceTime(0.125), capture and submit the green sample | T G G T R T T T |
| N3 | After origin Engine and provider retirement, submit the exact saved N1 on a fresh host/Engine of the same backend | T R G T R T T T |

Rows y=0,2,3 are entirely T. Each captured frame specifies width=8, height=4, clearColor=0 and clearAlpha=0; sampling is 1:1 at integer coordinates with no scaling, rotation or fractional transform. Pixel tolerance is exactly 0, including alpha and the full transparent exterior.

Required primary schedule: **6 submissions = 4 new captures + 2 saved-frame replays**; **32 pixels / 128 channels per submission**, hence **192 pixels / 768 channels** compared. Each submission has **3 authored image commands**; this is not a claim about GPU draw-call batching. Each origin Engine has exactly **1 advancing tick**. Capture/render/readback/replay must not advance the original clock or replace its held sample. Do not invent fixed frame IDs or GPU serials: bind N3 to the observed original N1 frame identity and record genuine native IDs.

Canvas submits through its real host and reads one full native getImageData buffer for each step. WebGPU requests one readback ticket before each renderFrame, then awaits that ticket and whenIdle, retaining normalized RGBA bytes and actual format/alpha metadata. No screenshot decoder, extra rendered frame or selective pixel-only pass is needed.

After each backend's positive comparisons, apply the N1 mask to its already saved N2 buffer. Require a pixel refusal at (1,1); this gives **2 separate wrong-oracle classification controls**, with **0 additional submissions/readbacks**. It qualifies the comparison path, not a product mutation.

The two delivered ImageData2D copies per backend are each checked against their 8-channel source oracle. Check the saved frame's same two image identities and bytes again after origin retirement. These repeated source-image checks remain separate from the 768 rendered-channel comparisons.

## Native operation ledger and its bounded permission

The primary native route must observe actual Blob/createImageBitmap/readback and transient retirement, without supplying decode/createCanvas ports. The independently reviewed observation unit is limited to six operations; its accepted 39 UNIT cases qualify forwarding/restoration on controlled owners. Actual collector admission still requires its own source/closure review and completed policy qualification. No general patch or private-import permission follows.

The bounded observer may temporarily observe exactly these operations in the isolated same-window origin page: window.createImageBitmap, ImageBitmap.prototype.close, document.createElement, HTMLCanvasElement.prototype width/height setters, and CanvasRenderingContext2D.prototype.getImageData. Capture their precise owner/ownness/full descriptors and original methods first. Install after origin host/Engine startup and before default provider construction; no rendering or replay host creation occurs while installed. Track only returned native ImageBitmaps and freshly created unattached source canvases in this interval.

Every wrapper must invoke its captured original exactly once with the original receiver/arguments and return the identical result or throw the identical occurrence, including undefined. A decode observer returns the original native Promise unchanged; attach immediate handled observations without replacing it. Do not alter Blob, decode options, pixels, dimensions or native ownership. Trace recording failure must preserve the native operation's occurrence and independently fail the probe. Any copied metadata comes from original native outputs, not stand-in objects.

Required primary observations per backend: **2 native Blob/decode invocations**, **2 successful native bitmap closes**, **2 source canvases/readbacks**, and **4 zero-dimension reset attempts** (width then height for each Canvas), with actual final dimensions 0×0. Record each Blob's native size/type and exact raw PNG bytes, frozen decode options, native source dimensions and the original 8-channel readback. Across both backends these are **4 / 4 / 4 / 8** respectively, separate from host readbacks. Store handled observer tickets and complete success/rejection records.

After both original acquisitions settle and their transients retire, restore every complete descriptor or remove only an owned temporary shadow; verify original operation/descriptor identity before N1. A partial installation or early failure still restores all touched descriptors in reverse order, while retaining original primary and cleanup occurrences. The separately authored source-policy/unit tests must qualify native forwarding, unchanged original-Promise identity, primary undefined handling, partial-install restoration and a restored pristine baseline. The accepted 39 UNIT cases belong to the separate observer evidence and contribute no native decode/render count. Missing admission or native observations retain PENDING; supplied ports cannot substitute for the default path.

## Collector closure and raw evidence

Freeze one original collector/fixture/oracle unit and its exact source-policy permission before actors. Seal each backend's complete literal emitted import closure through the public entries, with actual package-export aliases, source counterparts and raw source/JavaScript/declaration/configuration identities. This plan does not qualify or freeze the implemented image entry or its final closure; admission must bind the actual independently accepted source and emission. Package-owned internal dependencies can appear only through that reviewed public closure; the fixture itself may not import private product files.

Serve only sealed module bytes, the two pinned PNGs, exact entry HTML and a fixed empty favicon, through admitted loopback GET routes/Host. The reader requires same-origin fetch, so the new HTML policy permits connect-src 'self'; the old SpriteSheet collector's connect-src 'none' is not reusable here. Reject unlisted methods, paths, query/alias/traversal variants, redirects and response-byte drift. Record module/PNG requests and response hashes. Use the accepted shared file-identity helper for logical/physical ownership and raw fingerprints, not older platform-blind lowercase/basename recipes.

Admission must bind current implementation, API RED, public CPU/lifecycle/assets, strict consumers, policy, operation-unit and collector source reviews, plus the actual current build and workspace/installed-tool owners. Capture before/after exact identities and declared-versus-observed module/PNG route inventories. Do not fabricate closure sizes, environment versions or current Git identities.

Save literal original schedule/oracle data before browser launch; preserve all **6 complete 128-byte render buffers**, each input PNG, all native source-image 8-byte outputs, module graph, raw operation ledger, runtime metadata, errors and cleanup results. Save original command job and literal ARRAY receipts plus complete raw stdout/stderr. Hash original artifact bytes without normalizing EOL/BOM/Unicode. Public projections remove private paths while preserving original identities and failure cutoffs.

The collector contains no build/install/generator action. It takes already reviewed existing inputs and a fresh output outside the checkout; help/source/admission checks must not start SDK, browser or GPU work. Planned per-operation timeout is 20,000 ms, operation deadline 180,000 ms, cleanup deadline 220,000 ms, and outer containment 240,000 ms from start. A timeout, trace overflow or incomplete EOF is INCOMPLETE, never a successful retirement.

## Caller retirement and acceptance boundary

Register every actually fulfilled lease/Engine/device/readback ticket immediately so an earlier assertion cannot skip its later ownership cleanup. Preserve primary failure presence separately from its value and aggregate all secondary cleanup occurrences. Settle original startup/readback/observer tickets; a raced timeout does not settle them.

After N2, close the origin Engine (including its Scopes/leases/Bitmaps and host), then separately await provider.close. Confirm Texture disposal and unreadable retired leases while the saved frame's original owned images remain readable and byte-equal. Manager/Engine does not own provider.close. Provider-close preservation of still-issued leases and old/new invalidate generations stay explicitly in the separate actual CPU evidence; no native repetition is inferred.

A borrowed WebGPU device remains application-owned: after safe host return and settled tickets, destroy only the acquired device and observe its loss reason. Reopen a fresh replay host/Engine, with its own new device for WebGPU, submit N3, then retire it by the same ownership order. Native Canvas/bitmap closure, browser/server/context closure and any outer process-ownership facts retain their actual scope. Quarantine or unresolved work blocks PASS; logical closure is not physical memory/GC/OS reclamation.

Require independent source and saved-result review before any native acceptance statement, then complete the separate full repository and delivery gates. This desktop fixture establishes no phone/mini-game/Native SDK/Steam platform matrix, physical GPU identity, energy/performance, Chinese fonts, complete PNG/3D/UI/Spine R020/V020 or migration R008/V006 acceptance. No future version, registry ID or release status is assigned.

## Published original assets and collector interface

The repository supplies `tools/browser-png/assets/rgb-red-green.png`, `tools/browser-png/assets/rgba-red-transparent-black.png` and their `tools/browser-png/assets/provenance.json`. Both PNGs are exact 72-byte copies of the original independently qualified fixture bytes in the table above. The first-party provenance records raw input identities and literal pixel expectations; it does not regenerate the fixtures or bundle a codec.

The explicit collector interface is `node tools/verify-browser-png.mjs --admission <absolute-reviewed-admission.json> --output <fresh-absolute-output-directory>`. The two arguments are absolute paths; output is a fresh direct child of the admitted output owner outside the checkout. The admission JSON has `schemaVersion: 1` and `status: BIP1_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED`, with `sourceFilesRoot`, `outputOwner`, the original `graphPin`, `graphInputs`, `reviewPins`, `proofBindings` and `runtime`. Review roles are plan, productSource, observerSource, collectorSource, missingEntryRed, cpu, build, strictTypes, policy, observerUnits and fixtures. Runtime inputs include original pins and explicit nodeExecutable, playwrightEntry and edgeExecutable identities. Full absolute owners use the shared physical-path comparison; logical graph paths and every raw-byte fingerprint remain exact. These fields are supplied by a reviewed admission, not inferred from basenames or edited into old receipts.

The source-established R1 runtime-cap finding applied the 64 MiB data limit to a 92,825,416-byte executable. R2 separates 64 MiB data, 256 MiB per runtime file and 1 GiB aggregate runtime limits, with at most 4,096 runtime pins. The correction was independently accepted in source review; the R1 finding is not an observed browser failure. Collector source, adoption/syntax and input preparation are accepted. The prepared graph has 375 files, 107 modules, 113 declarations, 113 source files and 1,492,342 bytes; Canvas/WebGPU declare 72/103 module routes. Runtime preparation has 175 files and 116,779,934 bytes. Preparation proves input closure and byte identity, not browser execution.

Saved browser execution reports PASS with browser 155.0.4283.45: 6 submissions comprising 4 captures and 2 replays, 6 raw readbacks, 192 pixels / 768 channels at tolerance 0, no primary/cleanup/pending outcome, and closed contexts, browser and server. Graph/runtime identities are stable. There are 180 requests: Canvas requested 72/72 declared module routes; WebGPU requested 96/103 with 7 lazy routes unrequested. Independent saved native-result qualification is ACCEPTED for this bounded browser subset at the current successor cutoff; complete repository gates and delivery remain PENDING. Declared routes are not all observed requests, and this desktop run establishes no phone, physical GPU, performance or energy qualification.

## Independently accepted native-result successor

The saved-result review is **PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY**, status **SAVED_NATIVE_SUBSET_ACCEPTED**, with 0 open findings. Its original raw identity is 37111 bytes / `34080f219a352d1713f93f511761c746f8adb9711c85e3d89472f3b83a58d728`; it qualified the original 47-file packet against current original source bindings.

Across Canvas and WebGPU, the recorded 4 original decode invocations, 4 returned ImageBitmap closes, 4 source-image readbacks and 8 returned zero-dimension resets are separate from the 39/39 controlled observer UNIT cases. Descriptors were restored before N1 on each backend. Both 2×1 source images matched their original literal RGBA bytes. Each backend recorded frame ids 1/2/1, clock elapsed 0/0.125/0.125 and ticks 0/1/1; the closed origin clock retains elapsed time. WebGPU serials were 1/2/1, with the replay using a distinct host/device. Both wrong-oracle controls rejected saved N2 at (1,1), channel 0, expected 255 / actual 0, without extra submission or readback.

Caller lifetime assertions use the original collector/fixture source and saved fulfilled snapshots: genuine shared Texture leases, SpriteSheet/Bitmap/SequenceClip, the single clock tick, origin Engine then provider retirement and N1 replay on a distinct host. These are source-mediated assertions, not cryptographic per-object or physical memory reclamation. Saved ports report safe close, no pending tickets, and owned WebGPU devices observe loss reason `destroyed`; contexts, browser and server are closed. Before/after graph stability and runtime stability are accepted from original snapshots, original source assertions and current pinned-file comparisons. There is no fabricated runtime-after packet or separately persisted HTTP response-body proof.

This is the installed default headless browser's bounded two-fixture Canvas/WebGPU result. It establishes no phone/mini-game/Native SDK, hardware identity, physical OS/GC reclamation, benchmark, energy, text/font, general PNG/translucent/HDR/color-management or complete-product acceptance. Full Spine R020/V020 and migration R008/V006 remain OPEN. Full current gates and PNG push/PR/Main remain PENDING.
