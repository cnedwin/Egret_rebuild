# Core capabilities and remaining work

English | [简体中文](../../Cns/docs/core-progress.md)

Reviewed main [39941143](https://github.com/cnedwin/Egret_rebuild/commit/39941143b6340be85ab6b1e59af9c72bb837fbb0) on 2026-11-14. The engineering preview provides runnable public examples. Workspace packages are private at 0.0.0. A stable engine distribution remains future work.

Use this page for current capability status, the [engineering plan](engineering-plan.md) for the next work, and subsystem contracts for exact APIs and evidence. Historical previews are not competing current versions.

## Product and implementation

Egret's product direction combines animation-rich 2D games and complex interfaces with lightweight 3D, an integrated AI-assisted creation platform, target publishing and legacy-project migration. The current implementation supplies the runtime foundation. It does not yet supply the complete creator, native/mini-game or migration products.

| Area | Available implementation | Remaining capability or acceptance |
| --- | --- | --- |
| Display and rendering | Familiar display objects, coordinates, explicit hit geometry and immutable captures; ordered shared WebGPU/WebGL2 paths, adjacent preparation/batching, texture pages, bounded buffer/target reuse, Alpha masks, separable blur and [opt-in cached WebGL2 layers](webgl2-executor-contract.md#cached-2d-layers) | Fixed desktop pacing and unmeasured GPU timing; broader devices and hosts; complete feature-specific references. The Canvas-based text and image providers remain available. |
| Resources and builds | Manifest admission, shared acquisition/leases, Scope cleanup, cancellation and late-result handling; reproducible selected PNG/atlas/sequence/font builds, cache/project adoption and typed runtime groups | Spine binary products, selected texture/mip/compression variants, broader format/exporter qualification and complete scene-level acceptance |
| Animation | Explicit Engine time, Tween, compatible sequence replacement and optional Spine JSON playback on the shared renderer. Independent players support tracks, queues, combined skins and finite plays. RESET and bounded seek/replay are available, and playback-preserving replacement covers selected in-progress mixes. | Independent selected-version references, exporter variants and hardware lifecycle qualification. [#213](https://github.com/cnedwin/Egret_rebuild/pull/213) · [#218](https://github.com/cnedwin/Egret_rebuild/pull/218) · [#219](https://github.com/cnedwin/Egret_rebuild/pull/219) |
| UI | Managed layout, variable-height lists and row focus, theme/skin generations, effects and popup/modal layers. The examples integrate toggles, selection groups, sliders, tabs, progress bars, dropdowns and multi-select with semantic projection. | Hardware/WebGPU, physical-phone and assistive-technology coverage for the latest controls, plus complete large-scene qualification. [UI semantics](ui-semantics.md) |
| Text and fonts | Readonly CanvasKit/SkParagraph paragraphs, final-line bidi, wrapping, alignment/maxLines, styled runs, committed hit/selection/caret geometry and managed font-set switching; optional native single/multiline editing and paired browser fonts | Actual IME qualification; independent required script/font/ink references; transfer/startup and CPU/Wasm/memory qualification |
| Input | Compatible old mouse API, optional multi-contact routing, keyboard/logical focus, responsive examples, movement/action state, hover/wheel and grouped keyboard focus | Broader gesture arbitration, human interaction, physical phone, IME and accessibility coverage |
| 3D | [Optional World3D](world3d.md) provides standalone WebGL2 and WebGPU renderers, with glTF instancing, lighting and shadows, post-processing, skinning, morphs and text. The physics preview includes shape sweeps, compound bodies, solver slices and gameplay helpers. | See the contract for backend and verification scope. Broader asset, device and performance qualification and unified 2D/3D authoring remain open. |
| Project and tools | Versioned project snapshots/transactions, browser opening in Outfit Studio, a clean-consumer package and browser smoke, structured diagnostics and bounded legacy RES/MovieClip analysis | Project-to-running-game authoring loop, integrated visual tools, Agent/Skill/MCP applications, publication/update adapters and complete migration |

## Current graphics and device verification — 2026-11-14

SharedFrame2D is the only current 2D frame path. Examples use `captureSharedFrame` with the shared WebGPU or WebGL2 Host. The previous Canvas Host, the earlier WebGPU Hosts and the prototype scene3d Host are historical. Canvas-based text and image providers remain. World3D has separate optional renderers, with supported canvas layering and screen-layer composition described in its contract. Outfit Studio's `/1` component routes draw two flat backdrop panels through SharedFrame2D. Its `/2` mixed routes place an opaque World3D canvas under the transparent SharedFrame2D overlay. The earlier 3D-backed receipts belong to the retired Host. [#180](https://github.com/cnedwin/Egret_rebuild/pull/180) · [#182](https://github.com/cnedwin/Egret_rebuild/pull/182) · [#187](https://github.com/cnedwin/Egret_rebuild/pull/187)

| Scope | Recorded evidence | Required follow-up |
| --- | --- | --- |
| 2D rendering | The 57-scene software comparison remains the historical pixel baseline. The merged batch-scratch fix reproduced four exact before/after pixel pairs on Windows. In the short 20,000-moving-bitmap stress sample, rAF p95 for WebGPU/WebGL2 fell from 195.8/55.6 to 50.0/41.7 ms on Windows Edge and from 400.4/133.4 to 50.2/66.7 ms on Galaxy Z Fold7 Chrome. | Broader device, recovery and sustained-scene qualification remains open. Fold7 WebGL2 GPU timer results are unavailable in this benchmark. [#185](https://github.com/cnedwin/Egret_rebuild/pull/185) · [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) · [#198](https://github.com/cnedwin/Egret_rebuild/pull/198) · [#199](https://github.com/cnedwin/Egret_rebuild/pull/199) |
| Desktop frame pacing | The 12-second E20 and current SharedFrame2D diagnostics observed 1,083 and 800 capacity stalls respectively. Each had two submissions waiting on native callbacks, with the queue fence last. | Keep the original formal thresholds and results. The trace does not link GPU execution completion to an individual JavaScript fence. [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) |
| Android and iPhone | The earlier mixed Fold7 run missed the 100 ms touch-response target. A separate current World3D example ran both backends on Fold7, zoomed with CDP two-contact input, went through Android Home and return, and stopped cleanly. Earlier Rally observations covered 120 WebGL2 frames. | Human touch, iPhone Safari, assistive technology and broader lifecycle qualification remain open. [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) · [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) · [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) |
| Native text over a canvas | The standalone adapter passed three cases per backend on Windows Edge 157 (RTX 5090 Laptop) and Galaxy Z Fold7 Chrome 157 (Adreno 830). The native Samsung keyboard appeared and the visual viewport fell from 813.7 to 423.2 CSS px. Text was entered through CDP. | Human CJK composition, candidate confirmation and cancellation, and iPhone Safari, desktop Firefox and Safari remain open. [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#195](https://github.com/cnedwin/Egret_rebuild/pull/195) |
| Managed native editor | Windows Edge and Fold7 Chrome each completed 12 open/finish cycles, six per backend, alternating native single-line and multiline fields. Fold7 displayed and hid the native keyboard in every cycle. Its visual viewport recovered from 487.2 to 813.7 CSS px. Closing an active editor released the native node, editor lease, loaded fonts and paragraph cache in both backends. | Native clipboard, broader IME coverage, human interaction and assistive technology retain separate checks. [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) |
| World3D | Dedicated browser Worker tests passed three remote physics cases on Windows Edge and Fold7 Chrome after the fixes. Separate ragdoll and vehicle checks passed two browser API cases on each device. Earlier Rally shadow accounting and software-rendered physics scenes remain separate. | [#169](https://github.com/cnedwin/Egret_rebuild/issues/169) records the five merged fixes. Broader gameplay, device performance and GPU timing still need qualification. [#168](https://github.com/cnedwin/Egret_rebuild/pull/168) · [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#201](https://github.com/cnedwin/Egret_rebuild/pull/201) · [#202](https://github.com/cnedwin/Egret_rebuild/pull/202) |
| Mixed qualification | The earlier X-D60/1 and X-MTouch/1 receipts retain the 3D-backed workload and its misses. In the current flat 2D component, the median of three five-second completed-frame p95 values was 26.0/26.4 ms on Windows and 61.2/91.3 ms on Fold7 for WebGPU/WebGL2. The merged orientation reflow fix matched the expected background pixels on both backends in Edge and on the physical Fold7. | Project opening passed scoped checks on Windows and Fold7 in #236. X-D60/2 passed scoped composition, keyboard, held-import cancel/retry and both layer-loss cases in Windows Edge on both backends. A Windows WebGPU case recovered background loss while the import was held. Final Fold7 X-MTouch/2 checks covered CDP touch, cancel/retry and both layer-loss cases in landscape, plus alignment, composed pixels and input in OS portrait. An earlier candidate also ran the full portrait checks. #92 retains the original thresholds, historical misses and full formal campaign. [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) · [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) · [#200](https://github.com/cnedwin/Egret_rebuild/pull/200) |

The /2 full-dirty comparison traced Spine geometry construction and reduced application-frame p95 on Windows Edge to 21.1/24.3 ms and on Fold7 Chrome to 54.6/61.0 ms for WebGPU/WebGL2. The four rows remain above 16.7 ms. Fold7 completed ten induced graphics-loss cycles per backend on the #255 reference build. [M4.2 measurement scope](m4-core-acceptance-plan.md#mixed-scene-frame-time-diagnostic--2026-11-14)

## Optional World3D — 2026-11-13

[#147](https://github.com/cnedwin/Egret_rebuild/pull/147) integrated the standalone renderers. [#148](https://github.com/cnedwin/Egret_rebuild/pull/148) and [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) expanded the material, scene, texture and collision paths. [#151](https://github.com/cnedwin/Egret_rebuild/pull/151) added refraction, light maps, depth of field, batching, text geometry, a transform gizmo and physics features. [#152](https://github.com/cnedwin/Egret_rebuild/pull/152) added the feature gallery and extended the CPU regression workloads, shadow preparation and collision paths.

[#154](https://github.com/cnedwin/Egret_rebuild/pull/154) through [#159](https://github.com/cnedwin/Egret_rebuild/pull/159) added character controls, compressed asset decoding, navigation, terrain and reflections, skinned crowds, and scene effects. Windows Edge passed all 24 fixed WebGL2/WebGPU comparisons and focused soft-particle depth checks. Earlier physical Android Chrome evidence covers the sample presentation and selected screen-space, vertex-hook and oblique-projection cases on both backends. The feature gallery has separate WebGL2 software-rendered evidence. See the [World3D contract](world3d.md) for the exact backend and device scope.

[#161](https://github.com/cnedwin/Egret_rebuild/pull/161) extends terrain and water, skinned crowds and effects. Windows Edge passed 25 fixed offscreen WebGL2/WebGPU comparisons, including volumetric fog, and the soft-particle depth check on both backends. Separate headless regressions cover streamed-tile and water-fog ownership. Interactive landscape, broader devices and formal performance qualification remain open.

Automatic instancing groups eligible meshes for drawing while preserving individual picking. The dense-mesh picking hierarchy and reduced per-frame allocations are also available. The reported performance figures are single-machine development measurements. [#163](https://github.com/cnedwin/Egret_rebuild/pull/163)

The physics checkpoints add shape sweeps, compound bodies, slider joints, springs, contact reports and visual jelly deformation, followed by a static-body hierarchy, face contacts, group sleeping, solver slices and swept fast bodies. The next checkpoint adds ragdolls, arcade vehicles, rope and cloth, and a message-port simulation client. The PR records report 26 and 27 fixed WebGL2/WebGPU comparisons in headless Chromium with software rendering, respectively. Those remote physics tests used MessageChannel and a Node worker thread. Later scoped Worker and device checks are recorded above. Broader gameplay and performance qualification remain open. [#169](https://github.com/cnedwin/Egret_rebuild/issues/169) [#166](https://github.com/cnedwin/Egret_rebuild/pull/166) · [#167](https://github.com/cnedwin/Egret_rebuild/pull/167) · [#168](https://github.com/cnedwin/Egret_rebuild/pull/168)

## Windows merge checks — 2026-11-13

The code route now runs an independent Windows checks job and four test shards. The route job selects the applicable checks, and the aggregate job requires their results. The final hosted workflow for #164 finished in 13 minutes 12 seconds. Its longest shard ran for 12 minutes 33 seconds. These times describe one workflow and its runner allocation. [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) · [Hosted run](https://github.com/cnedwin/Egret_rebuild/actions/runs/43294257120)

## Fixed mixed profiles — 2026-11-08

The original Outfit Studio checkpoint ran X-D60/1 and X-MTouch/1 with 6,000 authored nodes, eight dual-track Spine actors, 80 sequence instances and a 50,000-record virtual catalogue. Both desktop backends have five observed timing windows per state. Full-dirty synchronous elapsed p95 was 74.0 ms on WebGPU and 87.8 ms on WebGL2. This locates frame cost while formal whole-engine CPU remains open. The frame interval targets were missed. A physical Android Chrome collected 100 controlled touch responses per backend and actual keyboard, rotation and Home/resume results. The response p95 was 412.4 ms and 383.6 ms against 100 ms. Formal lifecycle, human input and iPhone rows remain open. [Fixed evidence](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/fixed-verification-summary.json)

## Shared clipping in the fixed scene — 2026-11-11

Both shared rendering backends reuse the normalized polygon when a canonical clip fully contains it. Budget replay charges the original predicate and tuple work. An actual intersection or a failed replay uses the existing clipping path.

A short foreground Edge comparison used the same X-D60/1 scene, a 5-second warm-up and three 5-second windows per state. Host p95 in static and full-dirty states measured 34.4 → 17.6, 39.5 → 19.2 ms on WebGPU and 40.9 → 22.6, 42.0 → 27.0 ms on WebGL2. The full X timing and device targets remain open. [M4.2 qualification](m4-core-acceptance-plan.md)

## Spine geometry in the fixed scene — 2026-11-11

The shared geometry factory now creates and freezes dense numeric arrays through a captured native constructor. It retains the existing copy, range, rounding and brand rules. Spine actors use the same public geometry path.

In a short foreground Edge comparison of the same fully changing X-D60/1 scene, animation stage p95 was 39.6 → 10.2 ms on WebGPU and 47.4 → 9.7 ms on WebGL2. Completed-frame interval p95 was 68.7 → 42.5 ms and 83.0 → 47.1 ms respectively. Each backend ran three 5-second windows after a 5-second warm-up. The completed-frame results still exceed the formal target. [M4.2 qualification](m4-core-acceptance-plan.md)

On one physical Android phone with the X-MTouch/1 profile, animation p95 was 51.1 → 11.6 ms on WebGPU and 68.1 → 11.7 ms on WebGL2. Completed-frame interval p95 was 112.8 → 68.9 ms and 132.3 → 77.2 ms respectively. Host p95 increased to 29.6 and 43.7 ms from 23.0 and 42.1 ms. This used short sequential windows on USB power. Formal mobile cadence and touch-response targets remain open.

## Compact desktop reference increment — 2026-11-08

The original Outfit Studio checkpoint composed two independently controlled Spine actors, a sequence effect, managed UI with native rename and an opaque 3D background under one Engine. A palette candidate uses the existing Spine RESET and shared Host staging. Exported snapshots reopen with stable IDs and authored values. Ten checks passed per backend, including font refusal, mouse release outside the pressed row, replacement failure, retry and retirement. [Outfit Studio](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/outfit-studio)

Browser Open shipped through [#204](https://github.com/cnedwin/Egret_rebuild/pull/204). It uses the existing project transaction with stable character IDs, order and version pins. The follow-up [#236](https://github.com/cnedwin/Egret_rebuild/pull/236) covers palette round trips and the cancellation boundary. The original Spine group is released when its last original actor is replaced. Once publication starts, the Open button stays disabled until the first draw settles. Windows Edge passed ten checks per backend. Fold7 Chrome passed five focused checks per backend in X-MTouch/1 using a File supplied to the browser input.

The six cold loopback observations include 28.91 MiB on WebGPU and 28.73 MiB on WebGL2. Three fonts account for 16.36 MiB and CanvasKit WASM for 8.20 MiB of browser-reported transfer. Median time through the first interactive frame was 885 ms and 744 ms respectively on the recorded desktop. The formal compressed, shaped and device profiles remain with #92.

## Popup/modal increment — 2026-11-07

M3.4 now provides [owned popup/modal roots](ui-layers.md), staged publication, clipped anchors, nested retirement, pointer barriers, contained logical focus and native editor suspension. The existing form integrates details/rename/return with shared resources. Complete controls, gestures, semantic projection and device/accessibility qualification remain in #90; this increment does not implement the separately owned touch work.

The M3.4 phone follow-up observed32 current-device assertions on the shared backends and corrected fallback-focus activation and provisional text loss during OS rotation. The [layer evidence](ui-layers.md) retains the initial locked attempt and real failures. Other devices/IMEs, semantics and complete M3.4/M4 remain OPEN.

## Native editing increment — 2026-11-07

M3.3 provides optional native input/textarea editing with committed source/selection/composition, existing paragraph/UI publication, paired fonts and row/resource lifetime. The final desktop batch passes 21 fixed plus eight responsive checks per backend; actual Samsung keyboard observations and exact-final-source Android lifecycle checks are separated in the [Android follow-up](android-native-text-editing.md). The bridge now handles terminal composition callbacks after cancellation, and the responsive form retires each view Scope on width changes. Other IMEs/devices, system clipboard, accessibility, complete packages and M1.2 remain open. Touch ownership and fixed fixtures are unchanged.

## Implemented packages and entry points

The repository has four foundation packages plus one explicitly optional Spine package. This is the actual workspace, not the larger directory proposal.

| Package | Current responsibility and entry |
| --- | --- |
| @egret/contracts | Dependency-free shared contracts and resource records |
| @egret/runtime | Host-free display, events, Scope, assets, text/input/UI state; depends on contracts |
| @egret/engine | Public assembly, clock, resources, UI/animation coordination and explicit browser backends; depends on runtime/contracts |
| @egret/project | Project transactions and selected content/import tools; depends on contracts and its declared parser |
| @egret/spine | Optional first-party asset/player/display/RESET integration with official Core 4.3.13; depends on public Egret boundaries and the separately licensed runtime |

Default Engine imports do not initialize Spine, 3D, paragraph WASM or a native VM. The [actual package structure](engineering-architecture-and-project-structure.md), package manifests and public-entry contracts define available names. Proposed CLI/editor/native packages are not installed products.

Current usage contracts:

- [Shared rendering](shared-render-profile-contract.md), [WebGL2](webgl2-executor-contract.md), [resource recovery](resource-recovery-contract.md) and [shared UI effects](shared-ui-effects.md).
- [Build-to-runtime content](content-build-pipeline.md), [multipage atlases](multipage-atlas-content.md) and [font resources/generations](font-resource-generations.md).
- [Spine assets/playback/display](spine-content-ingress.md), [Spine RESET](spine-reset-slot.md), [sequence controls](sequence-controls.md) and [sequence RESET](sequence-reset.md).
- [Managed UI](ui-data-panel.md), [styled paragraphs](paragraph-styled-runs.md), [committed text geometry](paragraph-text-geometry.md), [font/layout controls](paragraph-layout-controls.md) and [themes](ui-theme-generations.md).
- [Multi-contact input](multi-pointer-input.md), [keyboard/focus](keyboard-focus-input.md), [movement/action control scope](m3-ui-text-input-plan.md) and [responsive examples](mobile-examples.md).
- [World3D](world3d.md), [project transactions](project-transaction-core-contract.md) and [legacy migration scope](legacy-project-migration.md).

The independent optional integrations package supplies Tiled/TMX tooling, 2D physics, browser audio and saves, ZIP assets, KTX2 inspection and RGBA8 decoding, and localization through explicit imports.

## Existing work packages

All eleven M2–M4 packages remain open to their complete acceptance. A merged feature is credited below without declaring the whole package finished.

| Package / Issue | Delivered basis | Remaining outcome / coordinating role |
| --- | --- | --- |
| M2.1 / [#83](https://github.com/cnedwin/Egret_rebuild/issues/83) | PNG, atlas, multipage, sequence and font build/runtime paths; optional Spine JSON ingress | Binary/variant builds and authorized selected-version reference inventory / content maintainer |
| M2.2 / [#84](https://github.com/cnedwin/Egret_rebuild/issues/84) | Independent Spine instances, tracks/queues, skins and finite plays; sequence controls; [staged seek](spine-seek.md) from bounded history, equal to a straight run with physics on an original fixture | Complete qualified semantics, independent physics references and checkpoints / animation maintainer |
| M2.3 / [#85](https://github.com/cnedwin/Egret_rebuild/issues/85) | Shared Spine geometry under explicit egret-shared-linear/1 | Complete attachment/clip/tint/blend/sampling references / rendering maintainer |
| M2.4 / [#86](https://github.com/cnedwin/Egret_rebuild/issues/86) | Editable 20-Spine/200-sequence example, RESET, compatible sequence preservation, Spine replacement that keeps playback, a mix under way included, and selected recovery | Hardware rows for Spine preservation, and integrated animation lifecycle/budget qualification / resource-animation maintainer |
| M3.1 / [#87](https://github.com/cnedwin/Egret_rebuild/issues/87) | Managed layout, stable-key virtualization, anchors, focus/reveal, font/theme integration and bounded editor-row retention | Complete coherent UI scenario / UI maintainer |
| M3.2 / [#88](https://github.com/cnedwin/Egret_rebuild/issues/88) | Readonly styled text, geometry and font generations | Required independent references and provider cost/recovery qualification / text maintainer |
| M3.3 / [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) | Contact routing, [hover and wheel routing](pointer-hover.md), keyboard/focus, row integration and native single/multiline plain-text editing | Actual IME/mobile keyboard, a real mouse/pen/trackpad session, clipboard and accessibility qualification / input-host maintainer |
| M3.4 / [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) | Masks/blur, themes, owned popup/modals, contributed movement/action state, [hover, toggle, single-selection, range, scroll and text-field state](ui-controls.md) with [their usual keys](ui-controls.md#keys), and a [semantic tree with its browser projection](ui-semantics.md), which follows the [rows of a managed list](ui-semantics.md#a-managed-virtual-list) and describes [its boxes and layers](ui-semantics.md#boxes-and-layers-of-the-managed-ui). One [settings screen](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.md) joins these with themes, the text field, a managed list and a modal layer, and a [dropdown](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.md) anchors a popup to a row of a scrolling list, and [tabs with progress bars](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.md) have their roles | The mask and blur group and device recovery inside the integrated scenario, the U fixture, gestures, and real assistive-technology sessions / UI maintainer with existing touch contributor |
| M4.1 / [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) | Editable compact and fixed X Outfit Studio, in-browser opening of an exported project, dual-backend timing and scoped Android evidence | Selected feature coverage, reviewed mixed composition and formal X qualification / integration and qualification maintainers |
| M4.2 / [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) | Fixed desktop recovery, Android component evidence and short paired observations for shared clipping and geometry construction | Complete mixed lifecycle, performance and required device campaign / performance-platform maintainer |
| M4.3 / [#93](https://github.com/cnedwin/Egret_rebuild/issues/93) | Observable preview failure/cancel/reload, public contribution entry, and an automated [clean-consumer check](clean-consumer.md) of the packed default engine in Node, with a page of the consumer that draws and answers a press on WebGL2 under software rendering | Published distribution, the consumer page on WebGPU, hardware and other browsers, measured first interaction, human walkthrough and qualified handoff / release maintainer |

Roles describe responsibilities, not staffing or automatic volunteer assignments. Existing touch/control ownership is retained; other work consumes its interfaces.

## Evidence that remains open

M1.1–M1.5 engineering is integrated. The latest fixed Windows comparison reports static/sparse/full-dirty Engine median-p95 of **5.0 / 5.9 / 5.3 ms**, with containing Host spans of **2.5 / 3.2 / 2.8 ms**. All three states meet the 8 ms Engine target and establish the 4 ms preparation upper bound. The sparse and full-dirty duration-weighted wall-gap p95 exceeds 16.7 ms. The #55 pacing item remains open. GPU time remains unmeasured and overall D60 is incomplete. See the [current and historical evidence](incremental-frame-preparation-evidence.md).

The [Android report](android-device-validation.md) records finite WebGPU/WebGL2 component, lifecycle and controlled recovery results, including the font-registration example correction in #129 and twelve added diagnostic/lifecycle cases in #130. The historical approximately 41.4 ms callback trigger was not reproduced; precise heap/backing observations do not establish physical-memory or universal zero-leak acceptance. The withdrawn wrong-target startup report is not an Engine regression.

That phone evidence does not complete X-MTouch/1, the mixed 100-lifecycle/10-recovery campaign, required iPhone/IME/accessibility rows or a complete authorized Spine corpus. An API probe, simulated input, CI or a short callback sample cannot close those rows.

M0's [independent newcomer rehearsal #52](https://github.com/cnedwin/Egret_rebuild/issues/52) and [remaining scenario/rights/device qualification #54](https://github.com/cnedwin/Egret_rebuild/issues/54) also remain open. They block their stated claims, not unrelated implementation.

## Next development phase

Outfit Studio opens an exported project in the running page through one edit transaction. The original browser-opening checks passed in software WebGL2. The [#236](https://github.com/cnedwin/Egret_rebuild/pull/236) follow-up passed scoped WebGPU and WebGL2 checks on Windows and Fold7. [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) has scoped Windows and Fold7 functional evidence for the X-D60/2 and X-MTouch/2 dual-canvas workload. #55 needs a paired SharedFrame2D protocol with matched inputs for the remaining sparse and full-dirty wall-gap measurements. #92 starts formal qualification after the selected #91 features and the reviewed successor profile are ready.

#86 now has [Spine replacement that keeps playback](spine-reset-slot.md#keeping-the-playback), checked tick by tick against the player it replaces and on WebGL2 in software Chromium. Its hardware rows and integrated animation lifecycles continue in parallel. #89 and #90 track remaining IME, controls and semantics. #93 has an automated clean-consumer check of the default engine, its entries and its notices. The packed consumer also has a software WebGL2 browser smoke. Hardware and WebGPU runs, first-interaction qualification for the selected preview artifact and the human walkthrough remain. The complete handoff waits for #91 and #92. The [engineering plan](engineering-plan.md) sets dependencies and exit criteria.

## Historical records

The [changelog](../CHANGELOG.md), subsystem evidence and [previous progress page at the reviewed baseline](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/en/docs/core-progress.md) preserve original preview cutoffs, counts, failures, hashes and later repairs. This consolidation changes their presentation, not their execution results. Sources, upstream licenses and contributor credit remain in their original records.
