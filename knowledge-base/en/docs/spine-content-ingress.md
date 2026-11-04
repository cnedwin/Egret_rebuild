# Optional Spine content ingress

English | [简体中文](../../Cns/docs/spine-content-ingress.md)

M2.1 provides an explicit `@egret/spine` asset SDK. It reads JSON setup data through official Core 4.3.13, binds original Spine atlas pages to existing Egret textures, and exposes immutable information with group lifetime. Default Engine entries stay unchanged. Independent playback instances are described below; the bounded shared-rendering connection and remaining M2.3 qualification are described below.

## Version, rights and reference basis

The exact npm dependency is `@esotericsoftware/spine-core@4.3.13`, source `b7beb2ccbbce667a12c02f44d070644f59b04968`. The inspected 1,154,900-byte archive matches registry SHA512; its SHA256 is `761d0f03f84ea073e66a55b11758afb7416cd1494ed20d70c534c324225f52b9`. Editor/export patch numbers differ from runtime-package patches; the supported export series is 4.3. Default admission refuses prerelease headers. Explicit `allowPrerelease: true` permits evaluation while retaining the actual beta label.

Egret's own adapter and original numerical/pixel fixtures use Apache-2.0. Core retains the [Spine Runtimes License](https://github.com/cnedwin/Egret_rebuild/blob/main/third-party/spine-core-4.3.13.LICENSE). This integration uses the license's conditional SDK/library route: each user of the Products obtains their own Spine Editor license, and redistribution includes the runtime license and copyright notice. The alternative licensed route is governed by [Editor section 2](https://esotericsoftware.com/spine-editor-license#s2). Selecting this route establishes neither an individual's entitlement nor unrestricted redistribution rights. Installing an optional package does not change these terms. Distributors must retain the applicable notice and satisfy the route they use; the SDK does not verify or grant licenses.

Official runtime/examples may be evaluated under the [pinned upstream README](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/README.md). Private evaluation of the original Spineboy JSON/binary pair using genuine Core read 67 bones, 52 slots and 11 animations in both. Their actual export header is 4.3.75-beta. Seven selected official JSON candidates carried that beta header. These facts neither certify a stable export corpus nor independently verify animation semantics. No official artwork, exports or runtime implementation has been copied into Egret's first-party source or public fixtures.

## Manifest profiles

Use an existing admitted `egret.resource-manifest/1` from the generic manifest/build interface. The existing PNG/atlas/sequence and multipage content recipes are unchanged; no Spine Node producer is registered by this increment. Callers provide their admitted, integrity-declared source artifacts.

| Resource kind | Importer (version 1.0.0) | Artifact format | Media type | Ordered dependencies/settings |
| --- | --- | --- | --- | --- |
| spine | egret.spine-json | spine-json/4.3-1 | application/json | One atlas; coreVersion: 4.3.13 |
| spine-atlas | egret.spine-atlas | spine-atlas/4.3-1 | text/plain | One to sixteen distinct PNGs; coreVersion: 4.3.13 and ordered pageNames |
| image | egret.png | png/1 | image/png | No dependencies; existing PNG profile |

Only these exact Spine/atlas settings are accepted. Product binary profiles are refused during catalog admission, before factory/provider work. The private binary format-read prototype is retained separately: Core's binary API supplies no count budget, and source-byte limits alone do not bound its allocation. A bounded binary parser boundary remains OPEN in M2.1; the SDK does not silently fall back to unbounded parsing. Unrelated manifest resources remain available to other loaders. Page names are case-sensitive Unicode scalar strings, one to 255 UTF-16 units without ASCII control characters. Their order and actual atlas page names must match image dependency order exactly. A name is a binding label, never a filesystem path.

The original atlas is parsed by Core. Its 90-degree rotation means counterclockwise in the [Spine format](https://esotericsoftware.com/spine-atlas-format); Egret's generic SpriteSheet profile uses packed clockwise rotation. No cast or UV conversion between these profiles is performed. This ingress supports straight-alpha PNG pages only; PMA pages are refused explicitly. Sampling/color equivalence, PMA normalization, mips and actual drawing remain M2.3 qualification.

## Ownership and public API

`createSpineContentLoader(engine, ownerScope, manifest, factory, options?)` captures an explicit source-provider factory. The factory receives immutable resource IDs/kinds and genuine manifest bindings; it supplies texture and metadata-string providers. Custom providers own source verification and decoding; the browser facade reuses existing SHA256 transport and native PNG ports.

`loader.load(scope, roots, options?)` authenticates an Engine-owned consumer Scope and selects exactly the requested skeleton dependency closure. It returns `SpineContentGroup` with `ready`, `getSpine(id)` and `dispose()`. Readiness is atomic for all requested roots. `getSpine` returns a group-lifetime view containing copied immutable version/format, bone/slot counts, skin/animation names and durations, and page metadata. The asset view exposes no mutable Core object, pose, texture or draw command; a separate authenticated factory creates instances below.

The existing AssetManager is the only cache and lease authority. A raw ManifestGroup stages verified sources. Setup acquisition retains independent page leases through that same manager, parses once for overlapping groups, and retires staging metadata before readiness. The last setup lease releases the private Core atlas/data and page demand. Source ref identities separate simultaneous loader generations without a second resource manager. Old ready groups remain usable when another catalog fails or is cancelled; applications choose when to retire an old generation.

Consumer Scope/group disposal cancels its demand. Owner Scope, loader or Engine shutdown revokes all associated groups. A late provider result is retired by the existing manager and never publishes a partial setup. A group's previously copied information may remain readable as detached metadata; its `isDisposed` reports retirement. `dispose()` revokes demand synchronously; `close()` also awaits owned provider work. Custom host ports remain caller-owned. The browser facade closes its own PNG provider and byte source.

## Bounds

The catalog admits at most 128 skeletons and 512 selected resource entries. Each loader has at most eight groups and 32 roots per group; the existing ManifestGroup limit of 128 resources per dependency closure also applies. Source artifacts are at most 4 MiB per skeleton, 256 KiB per atlas and 8 MiB per PNG. Core input strings are bounded to 2,097,152 UTF-16 units for JSON and 262,144 for atlas text; JSON traversal is bounded to 262,144 nodes and depth 64. Pages retain the existing 4,096 dimension and 1,048,576 pixel limits.

After parsing, admitted setup metadata is limited to 1,024 bones, 2,048 slots, 128 skins, 1,024 animations and 8,192 atlas regions. Skin/animation names use the same scalar/name rule; animation durations are finite from zero to 86,400 seconds. `maxSetupBytes` defaults to 16 MiB, accepts zero to disable setup publication, and is capped at 64 MiB. It charges logical input retention plus declared setup-record fees separately from images. This is a logical capacity contract, not a bound on vendor parser peak allocation, physical memory or GC. Before Core, a first-party admission ledger bounds cumulative allocation drivers to 2,097,152 logical cells: vertex/weighted payloads, sequence counts and inherited UV lengths, linked-mesh slot memberships, timeline frame arrays, deformation expansion and ordinary/folder draw-order arrays. Sequence counts are at most 4,096 and digits at most eight. Lists must be genuine JSON arrays; weighted groups must consume their declared payload, and draw-order offsets must progress through distinct ordered slots with in-range distinct destinations. This prevents non-progressing order loops as well as small-source allocation amplification. It is admission, not a second animation parser. Binary remains refused; arbitrary untrusted-file isolation is not supplied by this SDK.

## Use and verify

See the [package guide](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/README.md). Normal `pnpm build` builds the optional leaf in the existing TypeScript build graph; normal `pnpm test` includes its public behavior/type suites. The unchanged four-core dependency checks remain in place, with one scoped optional-leaf dependency/public-boundary check. No historical source snapshot is regenerated for this package.

The [verification record](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json) separates source, controlled behavior, strict ES-only public consumers and actual desktop browser resource checks. Programmatic fixtures are original data, not certified Editor exports. The browser collector uses default Edge with Playwright 1.62.1, genuine public Engine/Scope objects, ordinary fetch, SHA256 and native PNG decoding. It checks shared JSON setups, exact two-page binding of live full-image textures, HTTP503 replacement refusal, acknowledged cancellation before a late response, and zero owned logical counters after close. It installs no decoder/crypto/constructor/prototype interceptors and makes no renderer/pixel claim.

Full selected-version Spine support, independently authored pose/event/pixel references, stable authorized export provenance, full playback qualification, shared graphics/color variants, Android/iPhone, native hosts and performance remain open. M1.2 remains 10.3 ms against the 8 ms target. Asset ingress advances M2.1 within issue #83; the playback increment below advances M2.2 within issue #84; the existing eleven M2–M4 work packages remain intact.

Binary ingress requires a separately bounded parser before admission; this is an explicit remaining M2.1 obligation.

The optional leaf declares its browser-resource project dependency explicitly, so a clean checkout builds without relying on previously emitted files.

## Independent playback instances

The optional root also exports `createSpineInstance(asset, scope, options?)`. It accepts only a genuine ready asset and an open Scope from the same Engine. Each instance owns a private Core Skeleton and AnimationState; setup data and page leases stay shared in the existing group. An instance borrows that group lifetime: Scope disposal closes its instance, while group/loader/Engine closure closes associated instances before releasing setup/pages. Closing one instance or group cannot close a sibling group's instance. `loader.getStatus().liveInstances` reports the logical count, capped at 128 per loader. This is not a physical-memory measurement.

Controls are queued for the next `advance(tick)`: `setAnimation(track,name,{loop?,mixSeconds?})`, `addAnimation(track,name,{loop?,mixSeconds?,delaySeconds?})`, `clearTrack`, `setSkin`, `setTransform(x,y,scaleX=1,scaleY=1)`, `setRate` and `setPaused`. Tracks are 0–15; there are at most 256 pending commands and 128 retained Core track entries per instance. Named skins are selected independently; arbitrary upstream mutation and combined-skin construction are not exposed. Clearing a track follows Core semantics and does not automatically restore the setup pose. Mix is 0–3,600 seconds, queue delay is 0–86,400, rate is 0–16, and each transform component is finite within ±1,000,000. Queue delay zero uses Core's previous-entry/mix boundary; it does not mean immediately override the active track.

Time is explicit. Supply the existing GameClockTick or an equivalent own-data record with increasing positive safe-integer tickId, nondecreasing finite nonnegative elapsedSeconds and finite nonnegative deltaSeconds. No RAF or timer is created. Each accepted advance consumes one tick; pause/rate zero does not accumulate wall-time catch-up. The effective delta uses the queued rate/pause controls, in command order. Advances split into at most eight segments of at most 1/60 second by default; maxSegments can be 1–120. An oversized advance rejects before consuming commands or changing committed state. Configure the Engine clock clamp consistently, or provide explicit bounded catch-up. The adapter invokes Core's selected physics update but does not claim full constraint/physics qualification from these numerical fixtures.

`getSnapshot()` returns frozen copied bones, slot attachment names, tracks, event records, time and status. Bone world matrices come from Core's final applied pose, including its constraints, not guessed transforms. Snapshot coordinates follow Spine's setup/world convention; they are numerical inspection data, not Egret draw commands, textures or renderer authority. Snapshots remain detached and readable after later updates or disposal. No Core object or pooled TrackEntry escapes. Published names and event strings are validated primitives; nonfinite numbers or malformed event payloads fault the instance before publication, preventing mutable JSON fields from leaking across shared setups.

Events preserve Core queue order for start, interrupt, end, dispose, complete and authored event payloads. maxEvents defaults to 1,024 and accepts 1–8,192 per advance. Events are dispatched only after the new numerical snapshot commits; listener-issued commands wait for the next advance. Disposal immediately suppresses remaining callbacks. Listener errors finish eligible callbacks, then throw SPINE_INSTANCE_LISTENER_FAILED; committed time and pose are retained and events are not replayed. Event times retain Core's numeric representation; authored decimal timestamps may be rounded to Float32 precision.

Invalid inputs and excessive delta are prevalidation refusals. An unexpected semantic error, retained-entry overflow, event overflow or nonfinite pose during advancement faults that instance, suppresses its unpublished event batch and preserves the last published snapshot. Mutable Core state is not rolled back; the faulted instance refuses more controls/advances and must be disposed and reconstructed. Other instances continue. This is separate from listener failure after commitment. The adapter copies bounded snapshot fields; it does not clone an entire instance for each update. Input descriptors cannot reenter advancement.

Example, after a ready group:

```js
import {createSpineInstance} from '@egret/spine';
const instanceScope = engine.createScope();
const player = createSpineInstance(group.getSpine('e_skeleton'), instanceScope);
player.setAnimation(0, 'walk', {loop: true});
engine.clock.onTick(instanceScope, tick => { player.advance(tick); });
// Drive engine.advanceTime(sourceSeconds) from the existing application loop.
// Use clock.maxDeltaSeconds <= 8 / 60, or select a matching maxSegments.
instanceScope.dispose();
```

This M2.2 increment covers independent semantic playback, not shared-renderer integration. Seek/replay history and checkpoints, combined skins, a complete independently authored constraint/timeline corpus, full selected-version support and M2.3 graphics remain open. Runtime/license and original source attribution above are unchanged. The original numerical fixture adds authored translation, layering, switching and event expectations; it is not a certified Editor export.

Validation for this increment: 60 focused tests passed, including 27 new playback cases and strict ES-only consumers. Actual default desktop Edge 156.0.4314.58 with Playwright 1.62.1 passed six check groups over 369 frozen source files: genuine transport/PNG, independent numerical poses, time refusal/pause/mixing/events, fault isolation and cleanup. Source integrity and all cleanup checks passed. Original failed expectations and the input-inspection reentry regression are retained separately in the [verification record](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json); these checks do not qualify pixels, phones, the full animation corpus or performance.

## Shared rendering display

M2.3 connects a genuine player to the existing ordered display path with `createSpineDisplay(player, scope, {colorProfile: 'egret-shared-linear/1'})`. A player has at most one live display. The returned `node` supports ordinary position, scale, opacity, visibility and rectangular clipping; its descendants are adapter-owned. Add it between other display objects to preserve scene order. Unsupported child topology changes are refused before the next publication. Disposing the node or display Scope removes only this display; the independent player may continue and create another display. Disposing the player or its source group retires its display before shared page leases. No second resource manager, timer, canvas overlay or GPU ownership path is introduced.

`advance(tick)` commits the successful numerical pose first, then prepares and publishes copied draw geometry before delivering callbacks. Drawing is a separate commit domain: a conversion, limit or publication failure retains the last visual, while committed animation time and events remain valid. Callbacks still receive that event batch, then `advance` reports `SPINE_INSTANCE_RENDER_FAILED` with its cause. The semantic instance stays running or paused; a later valid tick can recover drawing without replaying already delivered events. Unexpected semantic advancement errors keep the distinct whole-instance fault policy. Stable ordered page/material topology reuses opaque Mesh2D producer bindings; topology changes prepare a detached subtree. Existing captures retain immutable geometry and page data, so an older frame can replay after player/group retirement while its Engine/Host remains live. These are logical lifecycle properties, not physical-memory measurements or replacement/recovery acceptance.

Core 4.3.13 supplies ordered region/mesh and clipping output. Egret converts only the used buffers into authenticated SharedGeometry2D, flips Y once into the display coordinate system and binds original page leases. Packed ARGB8 light/dark values become copied coefficients; no Core command or pool escapes. Defaults and hard maxima per display are 256 commands, 65,536 vertices and 196,608 indices; `maxCommands`, `maxVertices` and `maxIndices` may lower each positive limit. These caps apply to publication, not Core's internal allocation peak. Nearest or linear page sampling requires identical min/mag filters and clamp addressing. PMA pages, mip filtering and other sampling combinations remain refused.

The color profile is mandatory, not an implicit promise to match every Spine renderer. It preserves shared-frame/1: texture data follows the existing canonical page conversion, shading/compositing uses linear working values, and output uses the existing sRGB transfer. Let `p` and `a` be the canonical sampled premultiplied RGB and alpha, `L` the packed light RGB, `D` the dark RGB and `f` the product of light alpha and display opacity. Source RGB is `S=f*(p*L+(a-p)*D)`; source alpha is `A=f*a`. For destination premultiplied RGB `B`, normal uses `S+B*(1-A)`, additive uses `S+B`, multiply uses `S*B+B*(1-A)`, and screen uses `S+B*(1-S)`. Normal/multiply/screen alpha is source-over; additive accumulates alpha. Existing target quantization/clamping and output transfer still apply. This maps to normal/add-accumulate/multiply-factor/screen without changing shaders. Legacy gamma-space renderer parity requires a separately qualified profile; the present results do not establish it.

`getStatus()` reports the explicit profile, publication revision, used command/vertex/index counts and disposal. Rendering does not advance animation: hidden displays still follow explicit ticks and callbacks. The public contract is DOM/Node-free; WebGPU and WebGL2 consume the same admitted Engine frame. Canvas remains outside this mesh/shared profile.

```js
import {createSpineDisplay} from '@egret/spine';
const displayScope = engine.createScope();
const display = createSpineDisplay(player, displayScope, {
  colorProfile: 'egret-shared-linear/1',
});
engine.stage.addChild(display.node);
display.node.x = 120;
display.node.y = 200;
// Existing player.advance(tick) commits the pose, then drawing, then dispatches events.
engine.renderSharedFrame({width: 640, height: 360});
displayScope.dispose(); // The independent player remains available.
```

Validation: 95 focused public behavior/type tests passed, including 35 new rendering/binding cases. Default desktop Edge 156.0.4314.58 / Playwright 1.62.1 passed 16 positive pixel cases and rejected six intentional wrong-page/order/tint/blend/clip/filter controls on each of WebGL2 and WebGPU. The 551-file frozen closure includes exact host lazy-module dependencies. Original cases cover multipage order, regions, weighted/unweighted meshes, polygon and rectangular clipping, negative scale, DPR 2, nearest/linear sampling, trimmed/rotated regions, two-color tint, all four blends, transparency and complete retained-frame replay after retirement. Numerical position tolerance is 1e-5 and sampled RGBA tolerance is two code values; neither is a performance benchmark. Initial strict-float assertions and a gamma-space oracle mismatch remain recorded separately. Reproduce with `node tools/verify-spine-rendering.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`.

This establishes the bounded shared rendering connection in issue #85. Full selected-version attachment/constraint/physics coverage, nested/inverse clipping references, licensed stable Editor exports, gamma-equivalent or PMA/mip profiles, native/phone qualification and M2.4 replacement/recovery scenarios remain OPEN. The existing M1.2 performance failure remains 10.3 ms against 8 ms. Original runtime licensing and attribution are unchanged.

The additive `Mesh2D.createBinding(lease, geometry)` primitive keeps the existing capture path while returning an opaque DisplayObject and a separate producer handle. The node is not a Mesh2D identity and exposes no lease or content writer, even through Mesh2D prototype methods. The handle may be owned by a genuine same-Engine Scope; its node has a permanent private cleanup owner and cannot be adopted by another Scope. `prepare` authenticates content before producing an abortable, one-use commit; superseded, released or disposed candidates refuse publication. Spine prepares every binding before committing any of them and explicitly retires all handles, including detached descendants. Original Mesh2D constructor/content APIs remain compatible. This prevents tree traversal from releasing shared setup leases or causing a partial multi-mesh update.

Old subtree retirement occurs after geometry and numerical pose have both committed. Cancellation-listener cleanup can observe the new pose, issue deferred controls or dispose the player; it cannot resurrect a retired display. Owned listener-cleanup errors retain the existing Engine diagnostic path. Unexpected escaping postcommit cleanup errors use `SPINE_INSTANCE_POSTCOMMIT_FAILED` without semantic rollback. The adapter explicitly retires tracked internal containers even if detached. These cases are separate from prepublication faults.

Binding retirement has two phases: `beginDispose()` clears capture state and terminates the node without invoking cleanup callbacks, then returns an idempotent finisher for listener cleanup. `dispose()` performs both phases. Adapters must finish every begun retirement. Spine marks all active and retiring leaves terminal before any cleanup callback can recursively dispose the resource group, and keeps retired rows tracked until cleanup finishes. Thus page-provider release cannot observe a live tracked drawing leaf.

The first full PR check exposed a stale current Mesh2D declaration fingerprint after the additive producer API. The repair updates only its source, emitted JavaScript and declaration identities in the existing finite successor groups; historical predecessor bytes and rejection rules remain intact. This is a source-gate repair, not additional browser or product acceptance.
