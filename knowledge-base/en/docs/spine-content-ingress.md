# Optional Spine content ingress

English | [简体中文](../../Cns/docs/spine-content-ingress.md)

M2.1 provides an explicit `@egret/spine` asset SDK. It reads JSON setup data through official Core 4.3.13, binds original Spine atlas pages to existing Egret textures, and exposes immutable information with group lifetime. Default Engine entries stay unchanged. Playback, instances and graphics remain M2.2/M2.3 responsibilities.

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

`loader.load(scope, roots, options?)` authenticates an Engine-owned consumer Scope and selects exactly the requested skeleton dependency closure. It returns `SpineContentGroup` with `ready`, `getSpine(id)` and `dispose()`. Readiness is atomic for all requested roots. `getSpine` returns a group-lifetime view containing copied immutable version/format, bone/slot counts, skin/animation names and durations, and page metadata. No mutable Core object, pose, texture, draw command or player escapes.

The existing AssetManager is the only cache and lease authority. A raw ManifestGroup stages verified sources. Setup acquisition retains independent page leases through that same manager, parses once for overlapping groups, and retires staging metadata before readiness. The last setup lease releases the private Core atlas/data and page demand. Source ref identities separate simultaneous loader generations without a second resource manager. Old ready groups remain usable when another catalog fails or is cancelled; applications choose when to retire an old generation.

Consumer Scope/group disposal cancels its demand. Owner Scope, loader or Engine shutdown revokes all associated groups. A late provider result is retired by the existing manager and never publishes a partial setup. A group's previously copied information may remain readable as detached metadata; its `isDisposed` reports retirement. `dispose()` revokes demand synchronously; `close()` also awaits owned provider work. Custom host ports remain caller-owned. The browser facade closes its own PNG provider and byte source.

## Bounds

The catalog admits at most 128 skeletons and 512 selected resource entries. Each loader has at most eight groups and 32 roots per group; the existing ManifestGroup limit of 128 resources per dependency closure also applies. Source artifacts are at most 4 MiB per skeleton, 256 KiB per atlas and 8 MiB per PNG. Core input strings are bounded to 2,097,152 UTF-16 units for JSON and 262,144 for atlas text; JSON traversal is bounded to 262,144 nodes and depth 64. Pages retain the existing 4,096 dimension and 1,048,576 pixel limits.

After parsing, admitted setup metadata is limited to 1,024 bones, 2,048 slots, 128 skins, 1,024 animations and 8,192 atlas regions. Skin/animation names use the same scalar/name rule; animation durations are finite from zero to 86,400 seconds. `maxSetupBytes` defaults to 16 MiB, accepts zero to disable setup publication, and is capped at 64 MiB. It charges logical input retention plus declared setup-record fees separately from images. This is a logical capacity contract, not a bound on vendor parser peak allocation, physical memory or GC. Before Core, a first-party admission ledger bounds cumulative allocation drivers to 2,097,152 logical cells: vertex/weighted payloads, sequence counts and inherited UV lengths, linked-mesh slot memberships, timeline frame arrays, deformation expansion and ordinary/folder draw-order arrays. Sequence counts are at most 4,096 and digits at most eight. Lists must be genuine JSON arrays; weighted groups must consume their declared payload, and draw-order offsets must progress through distinct ordered slots with in-range distinct destinations. This prevents non-progressing order loops as well as small-source allocation amplification. It is admission, not a second animation parser. Binary remains refused; arbitrary untrusted-file isolation is not supplied by this SDK.

## Use and verify

See the [package guide](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/README.md). Normal `pnpm build` builds the optional leaf in the existing TypeScript build graph; normal `pnpm test` includes its public behavior/type suites. The unchanged four-core dependency checks remain in place, with one scoped optional-leaf dependency/public-boundary check. No historical source snapshot is regenerated for this package.

The [verification record](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json) separates source, controlled behavior, strict ES-only public consumers and actual desktop browser resource checks. Programmatic fixtures are original data, not certified Editor exports. The browser collector uses default Edge with Playwright 1.62.1, genuine public Engine/Scope objects, ordinary fetch, SHA256 and native PNG decoding. It checks shared JSON setups, exact two-page binding of live full-image textures, HTTP503 replacement refusal, acknowledged cancellation before a late response, and zero owned logical counters after close. It installs no decoder/crypto/constructor/prototype interceptors and makes no renderer/pixel claim.

Full selected-version Spine support, independently authored pose/event/pixel references, stable authorized export provenance, playback, shared graphics/color variants, Android/iPhone, native hosts and performance remain open. M1.2 remains 10.3 ms against the 8 ms target. This increment advances M2.1 within issue #83; the existing eleven M2–M4 work packages remain intact.

Binary ingress requires a separately bounded parser before admission; this is an explicit remaining M2.1 obligation.
