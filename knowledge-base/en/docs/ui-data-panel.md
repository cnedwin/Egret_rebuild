# Committed UI data panels

English | [中文](../../Cns/docs/ui-data-panel.md)

This is the first implementation profile within M3.1: a resizable panel with variable-height rows, stable data keys and explicit preparation. Complete M3.1, paragraph text, keyboard focus, native editing, accessibility and mobile qualification remain open. Validation and delivery status are recorded separately below.

## Ownership and publication

The optional `@egret/engine/ui` entry provides `createUiRoot` and its TypeScript contracts. An authentic Engine and an open Scope own each root. The root mounts directly under the original Stage; existing siblings retain their order. Separate roots prepare independently. Existing manual display APIs and `planLinearLayout` retain their contracts.

The component tree admits leaves, rows, columns and one virtual list. Layout uses explicit/minimum/maximum dimensions, padding, gaps and cross-axis alignment. Leaves may measure synchronously or paint a solid fill through the existing graphics implementation. Fills use the familiar RGB integer and alpha representation. The root viewport is explicit; intrinsic stretch cycles, unknown properties and unsupported layout modes are rejected.

Call setters or `invalidate`, await `prepare()`, then call `commit(token)` outside frame capture and input delivery. Preparation constructs detached content and complete geometry. Until publication, the previous image, clip, row identities and hit regions remain authoritative. A root without a previous commit presents an empty, noninteractive placeholder.

A ready token belongs to one root and is single-use. An unchanged token performs no layout or binding work. A pending token indicates bounded row-window completion; explicitly prepare again instead of committing it. Superseded results never update current geometry. Failures before publication preserve the previous commit. Direct errors from input reconciliation or unbind after publication appear in `postCommitErrors`; Scope-owned cleanup failures continue through existing diagnostics.

Managed root, shell and row wrappers reject direct geometry, hit-region, reparenting and disposal writes. Update them through their owner. Custom row content remains owned by its binding Scope; a new content version replaces it. The logical Stage must have an identity transform at admission and publication. Ordinary Stage transform changes remain possible, but that interval is outside this qualified UI profile.

## Data, preparation and recycling

A source supplies an immutable revision with unique string keys, content versions, estimated heights and values, plus a paired `bind`/`unbind`. A binding receives a genuine Scope, cancellation signal, key, generation, width and density. It returns detached, fully ready content and a measured height. Existing text and image owners remain responsible for raster preparation and resource leases; UI adds no asset manager.

A setter may accept a newer desired revision, finish retiring staged rows, then throw `UI_CLEANUP_FAILED` for directly observed cleanup failures. That error does not roll back accepted intent; the previously committed presentation remains unchanged. An interrupted preparation rejects `UI_STALE` with its cleanup causes.

The captured bind/unbind pair and receiver stay attached to each binding. Every entered bind receives exactly one unbind, including failure. Replacing the adapter or index-dependent painted data requires appropriate source and content-version changes. Reorder follows the stable key; a binding-time index is advisory.

The list preserves the top visible key and its within-row offset. If the key disappears, it selects the next surviving key in the previous order, then the nearest previous key. Explicit scroll intent overrides anchor preservation; final scroll is clamped once. Height lookup and sparse point updates use a Fenwick index. Structural and width/density changes rebuild bounded numeric state in linear time; they are not logarithmic edits.

Only the live window has display objects. Noninteractive shells may be reused, but each binding gets a fresh interactive target. After a complete new revision is published, the existing pointer router reconciles retired targets. A held contact cannot become a contact on another data key. A detached target may receive no routed cancel; the existing contact observer and unbind provide terminal notification.

Required asynchronous work keeps the previous complete presentation visible. Cancellation promptly ends the public preparation promise; a provider that ignores cancellation still occupies the outstanding-call budget until it actually settles. This distinction prevents an unbounded queue without pretending native work has stopped.

## Input and retained rows

An optional genuine PointerInput from the same Engine supplies the existing events and capture operations. Row notifications carry the original event, committed key/index, binding generation and layout revision. UI layout changes do not change the host viewport revision. Same-Engine pointer observers and routed events, including the legacy mouse route, exclude concurrent UI publication.

An input switch requires the previous bridge to be closed or idle and the new bridge to be active and idle. It never cancels an unrelated contact to force adoption. The first profile keeps host logical Canvas dimensions fixed; resizing the internal panel is distinct from recreating the browser mapping.

Retention tokens reserve already realized rows for later focus/composition integration. Offscreen retained rows remain bound but are hidden and noninteractive. Delete or rebind of a retained row is refused until release. These ownership tokens do not establish keyboard focus or IME behavior.

## Bounds and evidence

| Limit | First profile |
| --- | --- |
| Logical records | 50,000 |
| Layout nodes / depth | 4,096 / 64 |
| Viewport / density | Up to 16,384 logical pixels per axis / 8 |
| Row height / total extent | 1–1,048,576 / at most 2^40 logical pixels |
| Resident shells | Default 128; configurable up to 2,048 |
| Overscan | Default 2 per side; up to 32 |
| Retained-only rows / tokens | Default 2, at most 8 rows / 16 tokens |
| Binding content | At most 32 display nodes, depth 8 |
| Range completion | At most eight explicit preparation rounds per intent |

Counters describe logical records, bindings, shells, measurements and outstanding calls. Numeric index bytes exclude JavaScript heap, GPU memory and caller-retained snapshots. Arbitrary adapter resource ownership cannot be inferred from object counts; unavailable demand/lease totals remain unavailable.

The integrated UI/input regression passed 158 tests with no failures, cancellations or skips. Real desktop verification on Windows 10.0.26300, Node 26.7.0, Playwright 1.62.1 and default headless Edge 155.0.4283.62 passed separately on WebGPU and WebGL2. Each backend checked 177 exact pixels, 35 actual mouse positions and ten raw-frame captures, including unchanged complete pixels during delayed replacement and byte-identical replay of the retained original frame. All 52 entered bindings received exactly one terminal callback; cache, scope, input, font and provider cleanup observations passed. These are functional and logical ownership observations, not physical reclamation or timing evidence.

`examples/ui-data-panel/verification-summary.json` is a public projection with the original receipt hash; it does not replace the retained raw evidence. Earlier example-capacity, missing-dimension and sandbox-launch failures are preserved separately. Protected CI and main delivery have separate outcomes. Full M3.1, phone input and performance acceptance remain open. See the [M3 plan](m3-ui-text-input-plan.md) and `examples/ui-data-panel/README.md`.
