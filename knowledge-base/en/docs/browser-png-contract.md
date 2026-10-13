# Browser PNG texture-provider contract — BIP1

English | [简体中文](../../Cns/docs/浏览器PNG纹理Provider契约.md)

## Current 0.46.0 publication cutoff — 2026-10-14

The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. Complete current repository/prepush gates, this increment's push/PR/Main and remote CI acceptance remain PENDING.

The sections retained below record the earlier 2026-10-13 source/documentation cutoff. Their NOT_RUN statements retain that historical scope; the current successor in this section takes precedence for status, while the behavior and frozen numeric schedule remain unchanged.

Current public documentation draft, 2026-10-13. The specification and current implementation have independent source acceptance; bounded CPU/cold, strict-type and observer UNIT evidence is accepted. Current owned-copy policy controls also have independent actual acceptance. Native browser validation, full repository gates and delivery remain pending. See [evidence and retained failures](browser-png-evidence.md), [implementation plan](browser-png-implementation-plan.md) and [native schedule](browser-png-native-plan.md). This is one optional browser resource adapter with the profile below.

## 1. Public boundary and ownership

Only `@egret/engine/web/image` exposes one runtime value, `createBrowserTextureProvider`, and four erased interfaces below. Engine/runtime/contracts default entries, `@egret/engine/web`, WebGPU entries and their dependencies gain no image-provider API or browser work. The adapter imports public contracts/runtime identities only; it adds no dependency, fetch, timer, scheduler, cache or PNG codec. Cold import reads no browser globals and allocates no host resource.

```ts
export interface BrowserPngDecodeOptions {
  readonly imageOrientation: 'from-image';
  readonly premultiplyAlpha: 'none';
  readonly colorSpaceConversion: 'none';
}
export interface BrowserPngPorts {
  readonly decode: (blob: Blob, options: BrowserPngDecodeOptions) => Promise<ImageBitmap>;
  readonly createCanvas: () => HTMLCanvasElement;
}
export interface BrowserTextureProviderOptions {
  readonly readBytes: (ref: AssetRef<Texture>, context: AssetLoadContext) => Promise<Uint8Array<ArrayBuffer>>;
  readonly ports?: BrowserPngPorts;
}
export interface BrowserTextureProvider extends AssetProvider<Texture> {
  readonly profile: 'png-rgb-rgba8-browser-normalized-v1';
  readonly isClosed: boolean;
  close(): Promise<void>;
}
export function createBrowserTextureProvider(options: BrowserTextureProviderOptions): BrowserTextureProvider;
```

The existing `AssetProvider<Texture>` supplies `load(ref, context): Promise<Texture>` and synchronous `dispose(value): void`. A frozen provider record has exact receiver checks for these methods, `close` and `isClosed`; its profile remains readable after close. `load` rejects on invalid receiver; `dispose` and `close` throw synchronously on invalid receiver. Repeated authentic `close()` returns the same Promise.

The caller owns this provider and borrowed browser ports/document. AssetManager captures load/dispose methods and receiver; it does **not** own or await provider.close. Do not pass this provider to Scope.use as a Disposable. Close Engine/manager demand, then separately await provider.close. Closing the provider never disposes already delivered Textures or their leases: manager demand owns their retirement. `dispose` remains usable after close, accepts only Textures created and returned by this provider, and invokes the captured original Texture disposer once/idempotently. Foreign/forged values are refused without touching them.

Use the existing `createImageData2D(input: ImageData2DInput): ImageData2D` and `createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture`, not an Engine method or private context assembler. Texture/ImageData2D identities carry no Engine affinity. Acquire the value through genuine `engine.assets`, retain its `AssetLease<Texture>` in that Engine's Scope, and pass that same lease to `createSpriteSheet`/Bitmap; their existing original lease/context checks remain authoritative. A provider can be registered in more than one manager without combining their generations or lease ownership.

## 2. Factory and invocation snapshots

Factory options must be a nonnull object. Read known fields `readBytes`, then `ports`, once each before validating their values; unknown fields are not read. A throwing read wins over an earlier invalid value. A supplied ports value must be a nonnull object; otherwise OPTIONS_INVALID, without reading its methods. For admitted supplied ports, read `decode`, then `createCanvas`, once before function validation. Capture callbacks and original receivers: readBytes uses the options receiver; supplied methods use the ports receiver. Use intrinsic invocation, ignoring mutable `.call`/`.apply` properties.

With ports omitted, factory captures current same-window document, its original createElement operation, window.createImageBitmap and receiver, original ImageBitmap.prototype.close, and Blob constructor; missing capabilities refuse. Native default createCanvas creates a fresh unattached canvas. Supplied ports are explicit trusted platform/test operations with the same ownership contract; they neither certify browser decoding nor authenticate native handles. Supplied ports still require a captured native Blob constructor, but do not read window/document; no caller receives the provider's owned byte array. There is no fallback decoder or lazy replacement of captured operations.

Each load reserves a job before reading caller context or invoking callbacks. Precedence: exact receiver → provider closed → occupied-job cap → context snapshot. Refuse nonobject/null context as CONTEXT_INVALID before reading fields. Context fields are read once in order `signal`, `resourceGeneration`, `taskId`, with closed-gate checks after each successful read; do not poll an unvalidated signal during this bootstrap. Complete the snapshot before value validation: signal is nonnull object and the numeric identities are positive safe integers. Then enter normal checkpoints. Their meaning remains manager-local; this provider performs no global generation lookup and does not authenticate a fabricated AssetRef. Genuine AssetManager authenticates refs before invoking it. Pass the **original** ref and frozen manager context to readBytes, unchanged; use the captured signal for later checkpoints.

At every normal checkpoint, provider close precedes signal cancellation. If open, read signal.aborted; require a boolean; read reason only when aborted. Signal getter failure is a signal-read error. Check before and after successful external reads/calls/writes and after awaited source/decode settlement. At a multi-field snapshot, successful reads are followed by checkpoints before the next read; only a completed snapshot proceeds to semantic validation. A throwing callback/getter remains the stage's primary failure, even if it also cancelled/closed the provider; do not replace it with a subsequent checkpoint error. Cleanup/retirement staging in §5 is the explicit exception needed to dispose newly returned handles.

Signal polling is itself a checkpoint, not recursive polling: after each successful aborted/reason read, recheck only the closed gate before validating/continuing. Invalid aborted type is SIGNAL_READ_FAILED with TypeError cause; a throwing signal getter retains its original cause. A successful signal getter that closes the provider therefore reports PROVIDER_CLOSED before cancellation.

## 3. Fixed admission profile and caps

Caps are fixed, with no factory overrides: 4 occupied jobs, 8,388,608 encoded bytes per load, 33,554,432 aggregate admitted encoded-payload bytes, 1,024 chunks, source edge 4,096 and source pixels 1,048,576 (the latter two reuse IMAGE_LIMITS_2D). No queue or automatic retry. Occupied jobs include unsettled operations and quarantined jobs. These bound admission and source-owned accounting, **not** browser internal copies, decode peaks, GPU allocation, physical RAM or OOM safety.

The aggregate ceiling equals four maximum payloads. Under the fixed job/per-load limits, an independent aggregate one-over load cannot be reached legally; validate the four-payload endpoint and assigned JOB_LIMIT/per-load INPUT_LIMIT refusals, without inventing an unreachable aggregate-negative witness.

Resolve readBytes through Promise machinery, without assuming a native Promise brand. On success admit intrinsic Uint8Array, including a valid nonzero-offset view; reject SharedArrayBuffer, detached/resizable buffers and invalid backing/type. Read intrinsic backing/offset/length before copying the exact selected bytes to one private array. No user iterator, species or instance getter is used. Reserve encoded payload credit before the copy; refund it only on completed clean retirement. Reader input is not modified or detached. No browser operation begins before the copy and complete preflight finish.

Preflight is a bounded structural reader over this owned copy. Complete framing and admitted-chunk length/order checks precede value/profile checks, so a later framing fault wins over an earlier unsupported feature; no partially scanned input reaches decode. [PNG 3, sections 5 and 11](https://www.w3.org/TR/2025/REC-png-3-20250624/) is the format reference; the **Egret subset**, not all conforming PNG, is:

- Exact eight-byte PNG signature. Scan length/type/data/four CRC bytes with checked bounds, unsigned big-endian integers and exact end-of-input; no alignment assumption. Length must not exceed 2^31−1; type is four ASCII letters with an uppercase third letter. At most 1,024 chunks.
- One first IHDR, data length 13; positive dimensions within the caps. Bit depth 8, color type 2 or 6, compression/filter/interlace fields 0. Other field combinations are unsupported.
- Before IDAT, at most one each of sRGB, gAMA and cHRM. sRGB has one byte 0–3. gAMA has four bytes with value 45455; cHRM has 32 bytes containing 31270,32900,64000,33000,30000,60000,15000,6000. gAMA/cHRM require an sRGB chunk. These compatibility values are drawn from [section 11.3.2.5](https://www.w3.org/TR/2025/REC-png-3-20250624/); they do not claim device rendering-intent fidelity.
- One or more consecutive IDAT chunks with nonzero aggregate data; one zero-data IEND ends the file. Duplicate/misordered admitted chunks and trailing bytes are structural errors. All other chunk types, including palette, tRNS, ICC/HDR, EXIF, textual/private and animation chunks, refuse as unsupported; nothing is silently stripped.

The reader checks CRC **storage**, not CRC correctness; it performs no decompression, filtering or color-profile algorithm. Browser acceptance supplies actual decoding, not a complete CRC/conformance guarantee. No integrity hash or security certification is implied.

## 4. Decoding and normalized value

Construct an immutable image/png Blob from the owned copy. Invoke captured decode once with a fresh frozen exact three-field options record in order `imageOrientation`, `premultiplyAlpha`, `colorSpaceConversion`; no resize/crop fields. [Current HTML ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap) permits from-image/flipY for orientation; this adapter selects from-image and rejects EXIF metadata in preflight.

On bitmap fulfillment first register the returned handle for retirement and capture its close operation/receiver. Then checkpoint before reading width followed by height; require positive safe integers exactly matching IHDR. Decode rejection creates no bitmap retirement. Default ports use captured original native close; supplied handles supply one captured close method. An unclosable object result quarantines the job; a primitive/absent result creates no fictitious handle.

Acquire one fresh owned unattached Canvas through the captured port. A supplied port promises to create a fresh Canvas and transfer exclusive transient ownership; an unseen unattached borrowed Canvas cannot be authenticated from this return value. Read isConnected once and require false. Reject any returned bitmap/Canvas identity already observed by this provider, without closing/resizing its earlier owner's handle. A connected or repeated surface is invalid: do not resize or detach it; retain an ownership-refusal reason as quarantine. The identity bookkeeping is a weak handle registry, not an asset cache. Before normal work establish whether the returned surface can be safely retired, even if a terminal transition occurred in the creation callback. After this retirement staging, normal checkpoints apply.

Set width then height to admitted dimensions and verify each readback. Capture getContext, request `2d` once with `{alpha:true,colorSpace:'srgb',willReadFrequently:true}`, capture getContextAttributes and snapshot alpha then colorSpace before validation; require true/srgb. Do not read other returned attributes. willReadFrequently is a requested hint, not a success requirement or performance claim. Capture setTransform, drawImage and getImageData in that order before function validation/use. Call setTransform(1,0,0,1,0,0); set and verify globalAlpha=1, globalCompositeOperation='copy', imageSmoothingEnabled=false, filter='none', shadowBlur=0, shadowOffsetX=0, shadowOffsetY=0, shadowColor='rgba(0, 0, 0, 0)' in that order. Draw bitmap once at (0,0), without scaling. Read one complete image.

Snapshot readback width, height, data, colorSpace in that order before validation. Require exact admitted dimensions, srgb, intrinsic Uint8ClampedArray backed by fixed attached ArrayBuffer, and tight `4*width*height` bytes. Create an intrinsic Uint8Array view, then call existing createImageData2D to make owned pixels. Do not rewrite color/alpha channels. Finish transient retirement, checkpoint again, then call existing createTexture(image) with its full-image default. Track the issued authentic Texture before resolving load; no caller callback occurs at commit.

Output is **browser-normalized straight sRGB RGBA8/top-left bytes**, not authored lossless PNG equality. [Canvas uses premultiplied backing](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context), so hidden RGB and translucent precision can be lost despite the decode options. A successful opaque/transparent-black golden comparison establishes only its recorded browser subset; the current native PNG run is pending. It does not establish full-alpha/HDR/color-management fidelity. The [Blob representation](https://w3c.github.io/FileAPI/#blob-section) is described in an Editor's Draft; its raw-data immutability is not a codec-support result.

## 5. Terminal work, cleanup and close

State path: reserve → read → owned/preflighted → decode pending → bitmap owned → surface/readback → cleanup → commit → clean retirement. A failure/cancellation skips later normal work but still retires every actually obtained handle. Source/decode Promises that do not settle keep their job and credit. No abort listener, timer or fabricated cancellation completion is added. Manager can reject its waiter earlier; direct provider.load may remain pending until external work settles.

Retirement-only staging may retrieve the bitmap's close method or establish surface ownership after an awaited/callback return even when already terminal. It must not draw/read pixels. A retirement getter failure is preserved and quarantines unknown ownership. Try bitmap close once, then canvas width=0/readback, then height=0/readback, attempting both resets even if the first fails. Never close document/window/borrowed ports. Record actual cleanup-attempt errors in attempt order; keep an explicit primary-failure boolean so thrown undefined remains a primary cause.

An unclosable object, connected/repeated handle or throwing retirement descriptor retains a separate quarantine reason, without inventing a cleanup attempt. With no earlier work failure, load's primary code is BITMAP_INVALID/SURFACE_INVALID for an invalid shape/ownership, or DESCRIPTOR_READ_FAILED for a throwing descriptor; its cause is the original thrown value or an authored TypeError. If no close/reset was attempted, load.cleanupErrors stays empty. Quarantine reasons include these ownership/capability refusals and actual failed cleanup values in observation order; a retained reason may itself be undefined.

With a work failure, preserve its code/cause and attach the complete frozen cleanupErrors array. With no work failure but cleanup failure, reject WEB_PNG_CLEANUP_FAILED, cause=first cleanup value; no Texture is issued. With clean cleanup, perform the final terminal checkpoint before commit. Failed cleanup retains the job's slot/encoded credits and failed owned-handle records as quarantine; it grants no retries or resource-release claim.

Authentic close sets the closed gate synchronously before observation, then waits for all admitted jobs to settle and attempted retirement to finish. It does not abort the original manager signal, interrupt native decode, invalidate refs or dispose issued Textures. Unsettled external work keeps close pending indefinitely: the application/outer host owns timeout/containment. If quarantines remain after settlement, close rejects WEB_PNG_CLOSE_INCOMPLETE, cause=the first retained quarantine reason; its frozen cleanupErrors contains all quarantine reasons ordered by job admission, then within-job observation order. This close-specific list includes refusals and does not imply that an unavailable operation executed. Same close Promise is retained. Clean close resolves undefined. Disposal of caller-owned Texture values remains independently available afterward.

Manager invalidate removes only the future route; old waiters/leases may complete against their old entry. Test both generations; do not redefine invalidate as cancellation. Last demand or manager/Engine closure may abort its signal. Late success returned to an already terminal manager entry follows its existing one-attempt dispose path. No provider cache or shared ref-id map is introduced.

## 6. Errors and observations

Stable provider codes: WEB_PNG_OPTIONS_INVALID, WEB_PNG_DESCRIPTOR_READ_FAILED, WEB_PNG_UNAVAILABLE, WEB_PNG_PROVIDER_INVALID, WEB_PNG_PROVIDER_CLOSED, WEB_PNG_JOB_LIMIT, WEB_PNG_CONTEXT_INVALID, WEB_PNG_SIGNAL_READ_FAILED, WEB_PNG_CANCELLED, WEB_PNG_READ_FAILED, WEB_PNG_BYTES_INVALID, WEB_PNG_INPUT_LIMIT, WEB_PNG_STRUCTURE_INVALID, WEB_PNG_PROFILE_UNSUPPORTED, WEB_PNG_BLOB_FAILED, WEB_PNG_DECODE_FAILED, WEB_PNG_BITMAP_INVALID, WEB_PNG_SURFACE_INVALID, WEB_PNG_RASTER_FAILED, WEB_PNG_READBACK_INVALID, WEB_PNG_VALUE_INVALID, WEB_PNG_CLEANUP_FAILED, WEB_PNG_CLOSE_INCOMPLETE. Short code names elsewhere in this contract always retain the WEB_PNG_ prefix.

External property reads use DESCRIPTOR_READ_FAILED; signal reads use SIGNAL_READ_FAILED. Default browser-capability capture/missing capability uses UNAVAILABLE; source invocation/rejection uses READ_FAILED; Blob construction uses BLOB_FAILED; decode invocation/rejection uses DECODE_FAILED; surface drawing/context/write failures use RASTER_FAILED. Invalid returned shapes use BITMAP/SURFACE/READBACK_INVALID; invalid scalar/binary admission uses the corresponding input code. Owned image/Texture materialization or foreign value disposal refusal uses VALUE_INVALID. All retain original cause, including undefined. Unsupported/malformed/budget refusal uses TypeError/RangeError cause without impersonating a browser error. Manager acquisition can wrap these in ASSET_LOAD_FAILED; tests examine that original provider cause instead of changing manager semantics. No progress counters, byte counts or logical close certify GC/device reclamation.

## 7. Eight acceptance families and evidence limits

| Family | Required independent witnesses |
| --- | --- |
| BIP01 | Exact optional facade/types, cold import inert, DOM/Node-free roots and unchanged package DAG/default routes. |
| BIP02 | Snapshot order, thrown getters, intrinsic offset view, backing refusal, copy-before-callback ownership, exact encoded/chunk/dimension caps and fresh legal controls. |
| BIP03 | Narrow chunk/profile admission, no decoder call after refusal, literal original PNGs and independently generated bytes/expected pixels. Production owns structural admission and delegates image decoding to the browser. |
| BIP04 | Original ref/context receivers, four pending jobs/no queue, source/decode cancellation and late fulfillment; no premature capacity refund or unobserved rejection. |
| BIP05 | Returned bitmap/surface retirement capture, exact readback/normalization, every failure point, original cause including undefined, all cleanup attempts and quarantine. |
| BIP06 | Genuine built AssetManager sharing/independent leases, old/new invalidate demand, Engine closure/late result, provider close preserving delivered Texture and idempotent disposal. |
| BIP07 | Genuine public SpriteSheet/Bitmap/clip/clock composition; default-browser RGB and RGBA opaque+transparent-black decoding, Canvas/WebGPU pixels and held-image/frame lifetime. Counts/tolerances frozen before execution. |
| BIP08 | Unsuppressed strict types, assigned baseline-first policy controls, separate native/source/actual reviews, EN/Cns source/meaning and mandatory full prepush/push hook/delivery gates. |

Supplied-port CPU results qualify adapter behavior. Native codec/rendering acceptance requires the default actual browser path and original first-party PNGs with independent literal RGBA oracles; that run is pending. Phone, mini-game, Native SDK, physical GPU, energy and performance coverage is unverified. This independent Egret adapter adds no runtime dependency. Full PNG/alpha/3D-material support, full Spine R020/V020 and migration R008/V006 remain OPEN. Related existing contracts: [resources](resource-core-contract.md), [SpriteSheet](spritesheet-contract.md) and [clock-driven sequence playback](sequence-playback-contract.md).
