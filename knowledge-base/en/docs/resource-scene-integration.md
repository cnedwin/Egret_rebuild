# Resource scene integration

English | [简体中文](../../Cns/docs/resource-scene-integration.md)

The resource scene connects real images, animation, text, selection and rendering in one executable application. Its two pilots provide a small, inspectable case for shared assets, independent state, asynchronous changes and complete retirement. It composes existing public APIs and preserves the DOM/Node-free core, package boundaries and Host protocol. The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md) describes its controls.

## Composition and ownership

At initial startup, both pilots acquire separate leases to the same decoded atlas Texture. Each pilot has a persistent display root, a body driven by a two-frame SequencePlayback and an independent clothing Bitmap. Selection belongs to the business ID, while display generations and leases belong to their current owners. This lets a resource change retain the target, transforms and selection without retaining obsolete request authority.

A Bitmap resource slot borrows the application's initial clothing binding and owns only fresh acquired replacements. The matching latest request on the current entity generation may update the committed business choice. A pending, failed, cancelled or superseded request leaves the prior choice usable. The application retires its initial borrow after the first successful replacement and never reclaims a released binding.

Atlas changes have an explicit preparation and publication boundary. Preparation acquires a full lease without changing the body. Publication stops the old playback, changes the existing body's exact lease and creates a new playback at phase zero. Old owners retire after publication. A preparation failure leaves the old playback running; a later commit failure retires the affected generation and requires explicit re-entry. The other pilot retains its independent lease and playback.

The DOM-free Session owns Engine/Scope/resource/display/animation/text composition. The browser entry owns native PNG transport, exact owned fonts, input attachment, presentation and outer retirement. Resource readiness, frame completion and interactive readiness remain separate. The example-local facade exposes genuine composition values and bounded observations without adding SDK diagnostic authority.

## Rendering paths

| Profile | Display and execution |
| --- | --- |
| `canvas-2d` | Ordinary Engine/frame capture and CanvasHost, with a Bitmap badge and the two-dimensional scene. |
| `webgpu-scene-textured` | Explicit textured Engine/Host, a genuine Mesh2D badge and the same screen UI above two opaque indexed 3D quads. |

Both profiles use 192×128 logical pixels at density 1. The GPU scene uses an orthographic projection, identity model-view and dyadic coordinates: red at z=-3 in front of blue at z=-7. Reversing draw order preserves the expected overlap; swapping genuine depth supplies a distinct negative control. The Canvas static dependency closure excludes the optional GPU recipe and its foundational geometry dependency.

The browser entry delegates to the real PNG provider's default ports. It fetches and verifies the exact local bytes before optionally holding delivery. SDK demand cancellation and original source work have separate outcomes. A held cancelled source can complete without issuing a Texture; a stale lease already delivered from a warm manager entry has a separate ownership test. At most two held gates, four source jobs, one external warm lease and 256 activity rows are admitted.

Each GPU presentation arms the original readback before submission and waits for its result and Host idle. Canvas reads its native pixels after synchronous drawing. Saved full RGBA originals carry the application Host lifetime, Engine epoch where applicable, frame ID, serial, label and dimensions. Literal interior-point checks and the fixed text region define the comparison domain; retaining a complete frame does not establish every edge pixel or physical-display correctness.

## Fonts and independent expectations

Six first-party RGBA8 PNGs describe two atlas versions and four clothing colors. The retained red/green badge is reused without encoding changes. [Asset provenance](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/assets/provenance.json) identifies raw bytes, sources and rights.

Ahem covers the fixed `X X`/`XX` case. The original Noto Sans SC normal-400 publisher subset covers the selected `左侧 已选择` and `右侧 已选择` strings. The original WOFF2, publisher CSS and OFL/copyright are retained. FontFace membership, exact selected face and load/check results establish application readiness; general coverage and Canvas internal font selection are separate questions.

The [portable reference metadata](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/resource-scene/reference/manifest.json) identifies two original direct-Canvas RGBA measurements made without Egret or the application. They apply only to Edge 155.0.4283.45, Playwright 1.62.1, Windows build 10.0.26300/x64, the recorded font and 12px profile. The fixed source region (4,4,64,16) maps to (72,8,64,16) by translation (68,4), derived from the declared baseline. White source alpha is composited over authored black or blue. Only partially transparent text permits one RGB byte of UNORM rounding difference; opaque RGB, alpha and literal points require exact equality. There is no image alignment or color fitting.

## Reconstruction and retirement

Quiescent replay retires the original Session, leases, wrappers, cache, provider, fonts and Host before a fresh raw Host receives the retained genuine overlay and scene. That Host completes its own readback/idle/close and leaves the application suspended. A subsequent rebuild creates a further new Engine epoch from the closed version-1 business snapshot. Selection, presence, clothing, atlas and pause policy survive; playback phase resets to zero. Application Host IDs identify these separate lifetimes and are not device handles.

Close publishes one stable Promise and terminal admission state before cleanup callouts. It revokes current demand, settles owned gates and waits for original startup, acquisition, text, source and presentation work. The caller separately closes the PNG provider. Owned fonts remain until text work settles. A surface is reset or removed only after safe original Host retirement; unsafe or unsettled work remains reported and quarantined. Primary `undefined` failures and ordered secondary failures retain explicit occurrence records.

## Verification and acceptance

Source, focused CPU/encoding, actual browser results, saved-result review, bilingual publication, complete local gates and repository delivery are separate acceptance stages. The source collector preserves original HTML and fourteen exact import-map aliases, pins selected public source/emission/declaration closures and assets, and resolves robust-predicates 3.0.3 through its declared physical owner. Each source refusal control starts from its own complete healthy baseline. The native verifier additionally binds its own executing source before comparing the reviewed snapshot.

The browser schedule uses seven fresh contexts: ordinary Canvas and GPU; wrong clothing and wrong time for each; and wrong GPU depth. Ordinary runs include real mouse/DOM operations, out-of-order delivery, raw Error/undefined failure, warm lease retirement, atlas changes, clipping/rotation, removal/re-entry, saved replay, reconstruction and pending-request close. An assigned negative result contributes no ordinary acceptance.

The 16 October 2026 desktop run completed seven fresh contexts and retained 64 original RGBA frames: 27 for each ordinary profile and two for each of five negative controls. Each ordinary profile passed 348 literal point samples and compared 27,648 fixed-region CJK pixels with zero observed difference. The assigned clothing, time and depth errors were detected separately.

Each ordinary workflow retired 16 original PNG loads and nine issued Textures, then six reconstructed loads and five Textures. Every issued Texture received its original disposer. Source, text, readback and Host work settled with zero pending operations; each workflow retained 255 activity rows. Page errors and unclassified console diagnostics were zero. The exact Canvas frequent-readback advisory is retained; default Host context settings are preserved.

Native validation exposed two integration defects: unsupported width/height assignments on the ordinary Bitmap badge and slot-state access during re-entry preparation. Public scale setters and preparation-aware controls resolve them. The badge regression observed the original 2×1 extent before passing the authored 16×8 extent after repair; the focused suite passed 58 checks. Native pointer actions bring the canvas into view and record its actual viewport hit.

To reproduce, run `node tools/verify-resource-scene.mjs --repository <absolute-repository> --application-root <absolute-repository> --snapshot <new-external-json> --snapshot-only` and review the captured inputs. Then run the same collector against that snapshot without `--snapshot-only`, adding `--playwright <installed-1.62.1-directory> --output <new-external-directory>`. It uses default Edge launch without extra flags and the exact environment above. Complete local gates and GitHub delivery are separate stages; this native result does not assert remote CI.

General Chinese typography/fallback/IME, touch and complete UI, production hosts, device-loss recovery, imported/animated 3D characters, full Spine R020/V020, target-phone energy/performance and complete legacy migration R008/V006 remain open.
