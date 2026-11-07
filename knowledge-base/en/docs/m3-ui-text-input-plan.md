# M3: complex UI, paragraph text and input

English | [中文](../../Cns/docs/m3-ui-text-input-plan.md)

Architecture and delivery plan, reconciled 2026-11-07 at main f869b37. Parent tracking issue: #57. The four work packages are retained. Implemented input and UI foundations have separate contracts and evidence; this plan does not establish whole-package, performance, IME or assistive-technology acceptance.

M3 delivers a usable UI system on the existing Engine, display tree, Scope and resource owners. It includes automatic layout, variable-height virtual lists, styled paragraph text, pointer/keyboard input, focus, basic native text editing and browser accessibility. It does not complete legacy EUI/EXML migration, all platform integrations or M4 production acceptance.

M1.2/D60 remains OPEN after the valid sequence-6 formal timing failure. Existing rendering/resource results are prerequisites and regression references, not M3 acceptance. Independent M3 work may proceed without representing that performance gap as closed.

## 1. Current implementation and the intended change

Current source map, not a new platform test:

| Implemented foundation | Retain / remaining work |
| --- | --- |
| planLinearLayout and managed @egret/engine/ui roots | Preserve the pure 4,096-item planner and actual prepare/commit/measure/arrange; extend the UI owner rather than creating another layout system |
| Stable-key variable-height rows, anchors, focus and reveal | Reuse current behavior; add bounded active-editor/composition retention and complete coherent control integration |
| Scope, synchronous events, AssetManager/leases | Preserve cancellation, first-error/cleanup and genuine ownership; reparenting is not disposal |
| T1/TF1/WC1 explicit-line text | Preserve compatibility APIs/limits; their old exclusions do not describe the newer paragraph SDK |
| CanvasKit/SkParagraph readonly paragraphs, styles, final-line bidi and geometry | Reuse the adopted optional provider and exact font/layout results; qualify remaining script/ink/cost rows |
| Font artifacts/sets, UI themes, shared Alpha masks/blur | Existing resource/prepare/commit/Host authority; complete controls, layers, semantics and scenario qualification remain |
| Mouse compatibility, multi-contact routing, keyboard/focus and contributed movement/action state | Keep old entries and current touch ownership; native editing, gesture/example wiring and full phone/accessibility rows remain |

Actual code lives under packages/runtime/src/ui/, paragraph/, input/ and the existing optional Engine/web entries. packages/project/src/text-input.ts parses project JSON; it is not an IME implementation. [Core capabilities](core-progress.md) links each implemented contract.

## 2. One UI state, four cooperating modules

Keep the four foundation packages and separate optional Spine integration. DOM-free layout, paragraph/edit state and semantic descriptions belong in runtime-facing modules; public orchestration belongs in optional Engine entries; browser APIs stay under Engine web entries. Current paths and APIs follow their implemented contracts; remaining editor/semantic surfaces are targets.

| Responsibility concept — see contracts for actual APIs | Responsibility and boundary |
| --- | --- |
| UI root / committed layout | Owns component state, dirty queues, measure/arrange and one published layout revision. It writes the existing display tree before capture. |
| Paragraph plan / text provider | Owns source-range mapping, line layout and provider-qualified shaping geometry; raster output remains an ordinary owned image/texture resource. |
| Input/focus/edit bridge | Converts host input into synchronous typed actions and revisioned edit transactions; owns native listeners and native editable elements. |
| Semantic projection | Projects the same control state into browser roles, names, states and focus targets. It is not a second application model. |

The update boundary is: apply synchronous actions → resolve dirty measurement → arrange → publish layout/interaction/semantic revision → capture/render. Host submission does not start layout or font work. Reentrant mutations during preparation queue a later UI revision; a failed or stale preparation cannot partly publish a new layout.

This transaction belongs to the existing UI owner; it does not retroactively make arbitrary existing display-object setters transactional. UI-owned geometry is written only by its owner, and external overrides require an explicit escape hatch/invalidation policy.

Picking, derived hit regions, clipping, native caret placement and semantic bounds use the same committed revision and viewport transform. Existing manual `hitArea` remains available. Never derive interactive geometry from raster pixels or GPU readback.

Scope, AssetManager/leases and Host/device generations remain authoritative. M3 creates neither a second GPU manager nor a separate disposal hierarchy. UI and M2 share texture views, clipping, time and recovery contracts; M3 does not wait for every animation feature.

### Minimum target interface agreement

These are target data/lifecycle agreements, not implemented exports or fixed TypeScript spelling. M3.1–M3.4 use them rather than invent parallel identities.

| Target surface | Minimum fields and lifecycle |
| --- | --- |
| UI root / layout commit | `engine`, `scope`, logical `viewport`, `density`, component `id`, `revision`; constraints with min/max/explicit sizes; result boxes, clips, parent/order and dependency revision. `invalidate → prepare → commit` or retain old commit; `dispose` cancels queued work. |
| Virtual data source | stable `key`, record count, estimated/measured height and data revision; `bind(key, scope)` / `unbind`; anchor `{key, offset}`; visible, overscan and retained counts. A binding generation rejects late completion. |
| Paragraph request / plan | exact text and UTF-16 attributed ranges, font-set identity/generation, size/features/variations, language/direction, width/line policy, paint/density and request revision; result line/source ranges, glyph IDs/advances/offsets/clusters, logical/ink bounds and owned raster lease. `prepare` may cancel; only current complete results commit. |
| Font/provider owner | bytes identity, face index, fallback order, profile/build/Unicode versions and bounded work/residency; `acquire/release`, generation invalidation, idle settlement and terminal disposal. Provider memory and font bytes are CPU-accounted; Host owns GPU materialization. |
| Input / focus / edit | control ID, committed layout revision, pointer ID/type/logical point or key action; focus target and reason; edit base revision, replacement range/text, selection `{anchor, focus, affinity}` and composition session ID. Synchronous dispatch, explicit capture/release and composition begin/update/commit/cancel. |
| Theme / semantic snapshot | theme generation and immutable token/skin references; control ID, role/name/value/state, relations, bounds and layout revision. Stage and publish together; subscriptions/native nodes are Scope-owned and removed at disposal. |

Unknown fields, unsupported capabilities and stale revisions receive explicit rejection/ignored-stale outcomes in the owning contract; they cannot silently select another font, editor, layout or renderer. Public factories remain optional Engine entries; resource-owner authenticity and ordinary custom-adapter fallback remain explicit implementation requirements.

### Themes, layers, masks and effects

Theme values are immutable versioned records: colors, spacing, typography and state-to-skin references. A theme switch distinguishes metric changes from paint-only changes, stages required font/image leases and publishes one coherent revision. No executable CSS cascade or implicit asset loader is introduced.

Minimum skins provide default, hover, pressed, disabled and focus indication, with checked/selected/expanded variants for the controls that need them. Existing atlas/nine-slice capabilities supply skin images; theme replacement releases only the replaced demand and preserves other users of shared assets.

A UI root owns explicit content, popup and modal layers, ordered inside the same display/render sequence. An anchored popup tracks its owner's committed geometry, is constrained to the viewport, and closes or transfers ownership explicitly when the anchor disappears. A modal backdrop owns interception and focus containment; visual depth alone never grants input priority.

`DisplayObject.clipRect` and `renderBoundary` already exist; an isolate boundary does not prove an offscreen cache/filter implementation. Scroll containers use committed clips. A popup may escape an ancestor scroll clip only through an explicit move into the root's popup layer, not by silently ignoring a clip.

The target layered acceptance slice includes nested rectangular clips, one authored alpha-mask composition and one bounded offscreen blur group, interleaved with ordinary UI/content. Selected Alpha-mask and separable blur execution are implemented through the [shared effect contract](shared-ui-effects.md). Complete layered control/device qualification remains open; it is not blocked on reimplementing those delivered effects.

The UI owns effect parameters and invalidation; the renderer owns render targets, device-generation handles, pixel-area/scratch/in-flight budgets and physical retirement. A bounded declared kernel and fixed reference determine the blur fixture. Effects cannot silently disappear on Canvas or another unsupported backend; required capabilities are rejected at startup/load.

Hit testing uses the control's explicit committed geometry and clips. An alpha image mask does not automatically enable pixel-accurate hit testing; where the example requires a masked hit shape, it supplies a corresponding admitted geometric hit region. Blurred pixels never enlarge a control's hit area implicitly.

Accept nested popup/modal ordering, scrollbar drag, clipping and hit behavior, theme/font changes, effect invalidation and recovery using fixed layer/pixel/interaction references. Later scope includes arbitrary shader/filter graphs, general vector-mask authoring, unrestricted CSS, theme editors, docking/tree-grid controls and legacy EUI skins; none is hidden inside the first control-set claim.

### Coherent asynchronous updates and shared effects

M3.1 owns a committed UI update domain: the smallest subtree plus dependent ancestors, popup anchors, focus/editor and semantic projections that must change together. An asynchronous font/skin result stages its complete affected layout, paint bindings and interaction geometry; it cannot publish one of them alone. While pending or failed, that domain keeps its prior committed presentation and geometry; unrelated domains remain interactive. If a size change affects parent/sibling layout, enlarge the domain before commitment. For an initial domain with no prior version, publish an explicit placeholder with matching hit/semantic behavior. Do not wait for GPU recovery on the global animation clock.

M3.2 supplies readiness, cancellation and revision identity; M3.3 consumes only committed geometry. M3.1 commits through its UI owner at a documented frame boundary without invoking user callbacks between partial writes. Reentrant changes queue for the next revision. Direct scene setters outside the UI owner must either be rejected for managed geometry or enter an explicit invalidation path; they cannot silently bypass the transaction. Test a late font result changing a focused virtual row's height while a newer skin arrives, cancellation/disposal, and an unaffected sibling. Assert scroll anchor, hit target, editor position and semantic revision together. The retained focused/composition row counts toward the scenario's declared live-container cap.

M3.4 contains an explicit shared-renderer deliverable, reviewed by the rendering maintainer before the UI integrates it. Specify effect inputs/outputs, pass order, target extent/format, alpha/color convention, parent clipping and nested-effect admission. The renderer owns pooled targets, overlapping-generation and scratch budgets, completion-based retirement and loss/recovery. M2.3 owns Spine color conversion and reviews the common color boundary; it does not inherit UI effect implementation. Qualify the selected mask and blur kernel on both WebGPU and WebGL2, including nested clipping, budget refusal and device loss. Reuse existing execution paths; neither a general render graph nor a new shared-frame version is a prerequisite. An incompatible representation requires a specific reviewed extension before consumers merge.

## 3. M3.1 — automatic layout and variable-height virtualization

**Outcome:** a resizable, scrollable data panel with stable variable-height recycling, not a collection of disconnected layout helpers. Difficulty: high. Current managed layout/text/focus slices are implemented; remaining active-editor and complete-scenario integration joins M3.2/M3.3.

1. Define explicit/min/max sizes, content measurement, padding/gap, horizontal/vertical arrangement and alignment. Resolve constraints in deterministic measure then arrange phases; reject unsatisfied dependency cycles instead of iterating until a timing-dependent result appears.
2. Separate measurement, placement, paint, interaction and semantic dirtiness. A paint-only change must not trigger measurement; a local width/text change invalidates only the required ancestor/descendant dependencies. Unchanged UI performs no new measure or raster work.
3. Publish immutable layout results by revision. Stage component changes before display writes; validate the complete proposal and all admitted numeric values before publication. Retain the previous committed revision on failure.
4. Implement scrolling and a 50,000-record variable-height list with stable item keys, a prefix-height index and logarithmic offset/update lookup. Data records are not display nodes. Instantiate visible rows plus a fixed configured overscan region.
5. A row binding owns its listeners, text/image demand and asynchronous generation. Recycling cancels the old binding before reuse; late results cannot populate a different item. Detach does not release another owner's resource.
6. Preserve a scroll anchor as stable item key plus within-row offset when heights or data change. If the anchor is removed, use the documented next-survivor/predecessor rule and clamp once to the new range. Do not equate index with identity.
7. Keep keyboard focus/composition on a bounded explicitly retained row, or complete an explicit focus transfer before recycling. Report retained rows separately from overscan; never grow an unbounded hidden row cache.
8. Reflow after viewport/density/font changes is a single revisioned transaction; scrolling and picking never combine old clips with new row geometry.

Implementation entries: existing `packages/engine/src/layout*.ts` compatibility surface; existing optional `packages/engine/src/ui/` and `packages/runtime/src/ui/`; focused existing-style tests and an example under `examples/`. No new package is required.

Deliver one end-to-end data-panel example, a component/layout contract, bounded memory accounting, deterministic small reference fixtures and the large stress fixture. Dependencies are existing display/Scope/input primitives; paragraph measurement and focus connect through the contracts above.

Acceptance is executable: compare small layouts and virtual ranges against an independent simple reference; test conflicting constraints/cycles, signed zero/nonfinite admission, insertion/deletion/reorder, changing heights above the viewport, empty data and extreme scroll offsets. Test cancellation, reentry, disposal and late results during recycling.

Use counters to prove unchanged UI does not measure/raster again, local invalidation does not become an unexplained full traversal, and retained rows/resources remain within configured bounds. Large-fixture counts and time must be recorded separately; no fixed time result is claimed by this design.

## 4. M3.2 — paragraph text, font identity and recoverable text caches

**Current delivery:** readonly paragraph SDK and UI integration, final wrapped-line bidi, alignment/maxLines, styled runs, committed source/hit/selection/caret geometry, and build-to-runtime font-set switching. Actual entries are @egret/engine/paragraph, @egret/engine/web/paragraph and the existing UI/resource entries. Full M3.2 acceptance remains open.

The implemented host-injected CanvasKit/SkParagraph path supplies the paragraph services previously described as an ICU/HarfBuzz/FreeType provider. Reuse that adapter, its native final-line corrections and current font ownership; do not create a second text stack from the earlier proposal. The fixed-font provider remains compatible; the generation-aware provider allows managed replacement without recreating the Engine or renderer.

| Boundary | Current contract | Remaining qualification |
| --- | --- | --- |
| Source and layout | Immutable text/style ranges, explicit font bytes/fallback identity, width/density/language/direction, wrapping, line metrics and final-line ordering | Independent required script/font/ink references, fallback and cluster-edge coverage |
| Display and geometry | Raster and immutable hit/selection/caret results share the committed native paragraph; UTF-16 source ranges, grapheme/CRLF boundaries and affinity are explicit | Complete native-editor handoff in M3.3; no guessed prefix widths or invented internal ligature caret |
| Font lifecycle | Font artifacts and immutable managed sets use existing AssetManager/Scope; latest-intent UI updates preserve old content and anchors on failure | Actual cold transfer/initialization and complete provider/storage/recovery budgets |
| Cache and retirement | Complete request/provider/font-generation keys, bounded work/metadata/images and genuine leases; device materialization stays with the Host | Broader script/device residence, replacement peaks and physical-memory observations |

Preserve the following complete-package requirements:

1. Separate segmentation, bidi, line opportunities, shaping, layout and raster while keeping consistent font/source context. Pin engine-owned Unicode data/builds; grapheme conformance alone does not prove glyph or line correctness.
2. Preserve exact source/font/fallback/provider identities, style and paint semantics. Qualify leading-source paint when a range bisects one shaped cluster; font/size boundaries require the admitted shaping context. Do not infer arbitrary CSS equivalence.
3. Use the actual shaped glyph/line result for paint, source mapping and committed geometry. Retain required outline/embedded-color/COLRv0 qualification; SVG/COLRv1 need a separately admitted extension and otherwise remain explicitly refused. Keep T1/TF1/WC1 behavior and limits unchanged; unsupported required font/color formats must refuse rather than silently become monochrome or another font.
4. Keep independent source/run/line/metadata/work/image/scratch bounds and full shape/layout/raster keys. Warm reuse cannot bypass liveness or generation checks. Live borrowed images remain valid through cache invalidation.
5. Publish text, geometry, measured height and affected UI state together for the current revision. Cancellation, failed fonts, late preparation, stale set keys and Scope shutdown preserve the preceding usable presentation and cannot revive retired content.
6. Cover CJK/Latin, RTL/numbers, combining marks, ligatures, emoji/ZWJ, fallback, style boundaries, whitespace, overhang, wrapping/alignment/truncation and density through independent authored/Unicode/native-reference evidence. A second consumer of the same shaping runtime is not an independent oracle.
7. Use existing resource and Host recovery. Font-generation changes invalidate dependent CPU plans; device-generation changes rebuild GPU materialization without changing text/selection identity. Required scripts, formats and devices stay open until observed.
8. Measure required provider/glue/Unicode/font transfer, initialization, owned CPU/Wasm storage, raster/Host residence and overlapping generations in the first M4.1 integration. The historical approximately 25.85 MB raw paragraph payload is not compressed transfer or a passing first-interaction budget. Preserve X ceilings and full-language readiness; qualify any necessary profile revision before measurement.

Implementation entries are packages/runtime/src/paragraph/, packages/engine/src/paragraph.ts, packages/engine/web/CanvasKitParagraphProvider.ts and CanvasKitFontSetProvider.ts, plus existing UI/content resource owners. New input consumes these results; it does not reimplement paragraph layout.

Read the [readonly SDK](readonly-paragraph-sdk.md), [final-line bidi](paragraph-line-bidi.md), [layout controls](paragraph-layout-controls.md), [styled runs](paragraph-styled-runs.md), [text geometry](paragraph-text-geometry.md) and [font generations](font-resource-generations.md). Each retains its exact feature, budget, source and verification scope.

### Native-editor handoff and outstanding evidence

M3.3 also owns browser font registration/readiness and cleanup for the active native editor. CanvasKit registration does not register a CSS FontFace. Reuse the admitted font resource identity and leases, declare fallback and reflow behavior, and retire superseded registrations when their sessions drain; do not create another asset manager or assume identical native/CanvasKit line breaks.

M3.3 owns native composition/selection and visible editing geometry while active. Retain source selection and a stable control/scroll anchor on activation, avoid duplicate painted/semantic values, and settle composition before matching paragraph/layout publication on deactivation. Native and CanvasKit line geometry need declared font-specific reflow/anchor tolerances. Test delayed fonts, keyboard viewport changes, scrolling and stale callbacks with representative CJK/RTL/emoji.

The [Android follow-up](android-device-validation.md) adds bounded actual component/lifecycle evidence and precise JS/backing observations. It does not close the historical unreproduced 41.4 ms trigger, physical-memory, complete font/script, IME/accessibility or M4 budget rows.

The [private comparison record](paragraph-bidi-comparison.md), [prior M3 plan](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/en/docs/m3-ui-text-input-plan.md) and original receipts retain the October 28/29 ICU/SheenBidi checkpoints, original failures, unobserved cases, build identities, compression figures and source licenses. Their historical no-public-provider cutoff is not the current SDK status.

Relevant mechanism references remain [UAX #29](https://www.unicode.org/reports/tr29/), [UAX #9](https://www.unicode.org/reports/tr9/), [UAX #14](https://www.unicode.org/reports/tr14/), [HarfBuzz context/clusters](https://harfbuzz.github.io/adding-text-to-the-buffer.html) and [FreeType glyph retrieval](https://freetype.org/freetype2/docs/reference/ft2-glyph_retrieval.html). These explain mechanisms, not additional Egret acceptance.

## 5. M3.3 — cross-device input, multi-touch, focus and native text editing

**Outcome:** shared game/UI input with independent multi-touch, a two-hand control example, and a keyboard- and pointer-operable form inside scrolling/clipped UI, with real composition and predictable lifetime. Difficulty: expert browser/input. Current contact/keyboard/focus foundations are implemented. Next: native editing against delivered M3.1/M3.2 interfaces; retain coordinated touch ownership.

1. Preserve the implemented opt-in contact bridge covering mouse/touch/pen and capture/lost-capture/cancel. Hover and wheel/scroll integration remain M3.3 work; they are not delivered by the contact bridge. Preserve the old primary-mouse contract. Admit an explicit CSS/viewport profile; unsupported transforms must be refused, not guessed.
2. Convert coordinates from host viewport to committed logical geometry once. Recheck the target/owner at dispatch; capture is logical routing authority, not permanent entitlement after disposal. Backgrounding, lost focus and lost native capture terminate the corresponding gesture exactly once.
3. Declare browser default-action policy, including `touch-action`, scrolling and cancelable events. Use Pointer Events behavior as the browser-adapter contract; synthetic events cannot establish real touch/capture behavior. [Pointer Events](https://www.w3.org/TR/pointerevents3/).
4. Focus is a logical control identity independent of recycled display instances. Define tab traversal, directional navigation for composites, focus-visible state, disabled/hidden removal, modal containment and restoration to a surviving target.
5. Use one native `input`/`textarea` for the active basic editor as the authority for browser selection/composition while editing. It must remain an actual focusable native editor, with a qualified position/clip/scale profile; a `display:none` element is not an IME solution.
6. The engine edit model owns committed value/revision and source ranges. Composition is a distinct provisional session; browser value/selection events enter one ordered transaction stream. Do not transform committed value in the middle of an active composition.
7. Handle `beforeinput`, `input` and composition events without duplicate commits; noncancelable IME changes are reconciled from the native value. Reject stale revision writes and define programmatic changes, blur, submit, cancel, undo/redo and disposal during composition. [Input Events Level 2](https://www.w3.org/TR/input-events-2/).
8. Native offsets remain UTF-16; application delete/navigation behavior uses admitted cluster boundaries and affinity. Do not infer a caret from sums of individually measured characters. Native editable presentation and committed canvas text have an explicit handoff, not two competing visible values.
9. M3 basic editing supports single-line and multiline plain text. Rich-text display belongs to M3.2; a full rich-text document editor is a separate scope. Unsupported editor rotations/nonrectangular clips require a visible capability restriction, not silent coordinate loss.
10. Clipboard and virtual-keyboard interactions stay under host/user permissions. Do not persist typed personal text in diagnostics; input evidence uses authored fixtures. Scope disposal removes listeners/native elements and ends captures/composition without resurrecting controls.

Existing input/focus entry paths: contact/routing under `packages/runtime/src/input/`, optional Engine input and focus beside `packages/engine/src/mouseInput*.ts` and in `packages/engine/src/ui/`, and browser adapters under `packages/engine/web/`. The optional editing entries extend state/host behavior; DOM-free edit state lives under `packages/runtime/src/ui/` under the existing package. Preserve synchronous events and first-error/cleanup behavior.

Acceptance includes state-machine cases and actual host sessions: pointer cancellation outside the surface, simultaneous contacts, scroll versus activation, reparent/dispose during callbacks, focus restoration, CJK composition commit/cancel, dead keys, RTL selection, emoji deletion, paste, scaling and background return. Record exact browser/OS/IME; automation alone cannot close IME or mobile keyboard rows.

### Mobile and multi-contact input contract — M3.3

Touch and independent simultaneous contacts are required M3 capabilities, not a future platform enhancement. The existing MI1 bridge is mouse-only; receiving Pointer Events does not establish touch support. Preserve MI1's public behavior and explicit hit-area admission. New input orchestration is an optional Engine surface shared by game scenes and UI; it must not require paragraph shaping, a UI root or native text editing for raw game interaction. Core contact/routing state belongs in DOM-free runtime input modules, with browser translation in optional Engine web adapters. The optional @egret/engine/input and browser pointer entries implement the foundational routing; the following complete contract still governs retained behavior and remaining acceptance.

| Contract | Required behavior |
| --- | --- |
| Contact identity and events | Each accepted down creates a bridge-generation/contact-session identity distinct from the reusable host pointer ID. Carry source type, monotonic observation timestamp and sequence, logical position, button state, viewport revision and optional reported pressure/contact size. Do not invent unavailable precision. Track down/move/up/cancel independently for every admitted contact; a primary-pointer flag cannot discard other fingers. One ordered terminal outcome per admitted session; stale/unknown updates cannot revive it. |
| Capacity and ownership | Declare a bounded contact capacity, at least five simultaneously admitted touch contacts for the initial core profile. Refuse excess contacts observably without replacing an active contact. Two-contact gameplay is the required phone scenario; five-contact routing also has controlled tests, with hardware limits recorded separately. No unbounded histories, listeners or recognizer state. Scope disposal releases all owned sessions and listeners. |
| Routing and capture | Resolve the initial route from committed geometry and clips. Capture is per contact and distinct from keyboard focus; subsequent events use a still-live capture target or current picking according to the declared route policy. Revalidate ownership after callbacks. Up/cancel ends the session once; lost capture of an active session cancels it. A later capture-loss notification after up must not create a second terminal event. Removal, disabling or modal exclusion cancels affected ownership; reparenting alone follows existing route semantics. |
| Coordinates and revisions | Convert host coordinates once through the qualified viewport/surface transform into logical scene coordinates. UI picking uses its committed layout revision; raw scene input retains authored hit areas. A viewport mapping change, including rotation or keyboard resize, cancels active contacts before publishing the new mapping; require fresh down events afterward. Layout-only changes use the next committed geometry without mixing revisions. Reject unsupported CSS transforms rather than guessing. |
| Ordering and game actions | Keep existing synchronous typed event dispatch and first-error/cleanup semantics. A game may sample continuous state once per update, but down/up/cancel and action edges remain ordered and cannot be coalesced away. Retained public events cannot alias reused scratch storage. Provide a small explicit action binding for the example: keyboard or touch movement and pointer/keyboard activation share game commands. This does not require a configurable action editor or controller framework. |
| Interruption | Backgrounding, host/bridge shutdown, loss of window focus or system takeover ends affected contacts and clears held game actions. Resume never fabricates a down or replays activation. Do not confuse an ordinary UI focus change with window-focus loss. Device loss follows an explicit interaction policy: cancel active gameplay contacts while the affected surface is noninteractive, preserve application state, and admit new contacts only after interactive-ready. |
| Host policy | Browser adapters prefer Pointer Events; any separately supported fallback must suppress duplicate compatibility mouse activation. Declare canvas-local touch-action/default scrolling behavior before a gesture starts; keep page behavior outside the game surface intact. Actual browser capture and engine logical capture are distinct. Mini-game/native adapters translate their own events to this core contract and need separate qualification; browser success does not certify them. |

M3.3's input/host maintainer owns this contract and browser bridge; M3.1 provides committed UI hit geometry, M3.4 consumes the routing authority for gestures/controls, and M2 consumes game commands without installing input listeners. Preserve the existing #89 event payload, capacity, coordinate profile and error/cancellation outcomes, checking dependent consumers before extensions. The delivered first slice is raw scene multi-contact input plus a minimal two-region routing fixture. M3.4 now also has contributed movement/action state; its reusable two-hand example and gestures remain with that owner. Focus foundations and the declared browser editing slice are delivered; actual IME and remaining input qualification are still required to close the same package. No extra work package or global approval stage is introduced.

The [Pointer Events specification](https://www.w3.org/TR/pointerevents3/) informs the browser adapter, not the host-free core API. Keyboard state and native text editing remain separate input channels. Controlled tests cover ID reuse, over-capacity refusal, simultaneous contact routing, callback failure/reentry/disposal, duplicate compatibility events and complete cleanup. Real mobile acceptance follows M4's X-MTouch/1 matrix; synthetic events do not establish actual touch, system gesture or mobile keyboard behavior.

### Delivered native plain-text slice

The optional editing entries and [native editing contract](native-text-editing.md) now implement single-line/multiline input/textarea integration with existing UI publication, paragraph source geometry and font resources. An editor-only row token permits readonly re-publication under the existing caps; public retained-binding locks remain unchanged. Desktop browser, state/type/SDK and controlled composition evidence are recorded in the [example summary](../../../examples/text-editing/verification-summary.json). Real IME/dead-key/mobile keyboard, system clipboard and accessibility rows remain required in #89/#92. This slice adds no touch/gesture/control implementation.

## 6. M3.4 — accessible controls, skins and the integrated UI scenario

**Outcome:** a complete reusable control set and an inspectable complex UI example. Difficulty: high, with accessibility review. Current themes/effects/control state are implemented. Remaining controls and layers can extend those slices; native editor/semantic integration consumes M3.3.

The minimum set is explicit: layout panel; static image; paragraph label; push button; checkbox/toggle; mutually exclusive radio group; single-selection listbox; scroll viewport with draggable scrollbar; variable-height virtual list; anchored popup; modal dialog; single-line input; multiline textarea. Selection state, keyboard behavior, skin states and semantic roles are part of each applicable control. Menus, tabs, sliders and a document editor are later additions unless separately scoped.

1. Deliver containers, text/images, buttons, toggle/selection controls, scroll containers, virtual lists, popups/dialogs and basic text input. Use shared control state with default/hover/pressed/disabled/focus skins and one activation path for pointer, keyboard and semantic actions.
2. Preserve `BitmapButton` compatibility. New controls may reuse its owned textures and activation principles without pretending its current mouse-only state machine already supplies keyboard or accessibility semantics.
3. Project names, roles, values, selected/expanded/checked/disabled states and relations from the same state as visual controls. Prefer native HTML controls where they fit; ARIA describes semantics but does not supply missing keyboard behavior. [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/).
4. Keep only the admitted visible/overscan/explicitly retained virtual semantic region. Report position and set size truthfully; active-descendant targets must exist. Realize a target or transfer focus before removing it. Never publish thousands of unreachable focus targets for virtual rows.
5. The active native editor is the editor's semantic node; do not create a duplicate announcement through a second proxy. Modal inertness, names, labels, error text and focus restoration must agree with the actual interaction model.
6. Provide keyboard recipes and focus indicators for each control. The [ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) guide implementation; passing DOM assertions is not proof of usable screen-reader interaction or universal WCAG conformance.
7. Build one editable integrated example combining a variable-height list, localized styled text, a form, selection controls, scrolling, a popup and shared image/animation content. Use existing M2 interfaces when available; lack of a complete animation feature cannot be concealed by a placeholder in final M4 acceptance.
8. Exercise font/density/viewport changes, list replacement, release/reload, backend loss/recovery and background return while a control is focused. Preserve values, selection, anchors and ownership; errors remain observable and cleanup runs completely.
9. Deliver the theme/layer/mask/effect slice in section 2, including atomic theme switching, root popup ownership, geometric hit policy and shared-renderer resource accounting. A missing required effect/backend row cannot be called complete merely because unfiltered controls work.

Proposed paths: optional UI component/skin modules, browser semantic bridge, `examples/`, focused tests, and both knowledge-base languages. Do not add a parallel UI asset loader, a second scheduler or a general plugin/permission framework.

Acceptance includes control interaction references, layout/pixel and semantic-tree checks, keyboard-only navigation and real assistive-technology sessions on the declared browser/OS combinations. Record failed/unavailable combinations explicitly. Native SDK/phone accessibility is not inherited from desktop browser results.

### Gesture and control ownership — M3.4

Deliver tap, drag/pan, long press and two-contact pinch/rotation recognizers over M3.3's contact stream. Recognizers do not attach competing host listeners. Declare movement/time thresholds in logical units and the policy for nested scrolling, axis choice and boundary handoff before collection. A contact has one winning gesture owner; a two-contact recognizer must acquire both contacts atomically or refuse, never steal a contact already captured by a joystick/control. A map owner may promote its own single-contact pan to pinch only when the second contact is free: atomically end pan, acquire both contacts and rebase positions before emitting pinch deltas. A contact owned by another control cannot be transferred implicitly. Candidate tap is cancelled when drag/scroll wins; no delayed click follows. A remaining finger after a two-contact gesture ends requires a fresh down before another gesture, avoiding a jump or accidental tap. Different contacts may operate independent controls simultaneously.

Provide a reusable example control for virtual movement plus an independent action button, with keyboard equivalents through the same game commands. Include map pan/pinch/rotation and an explicit button alternative for zoom; this does not add a general camera/navigation framework. Modal interception, disabled controls, virtual-row recycling, system cancellation and resource/surface interruption must cancel affected ownership without passing the same action to the scene underneath. Browser default-action policy stays with M3.3; layout, scrolling and semantic activation stay with their existing owners.

M3.4 owns recognition, arbitration and control behavior; the input maintainer reviews its use of M3.3 routing and the UI maintainer reviews committed geometry and accessible alternatives. Acceptance covers simultaneous movement/action, nested scroll versus activation, modal opening while fingers are down, finger removal/replacement during pinch, touch plus mouse without duplicate activation, and cancel/dispose with zero held actions. Reuse the integrated example and M4's phone matrix; do not add a parallel gesture scheduler or a new task family.

## 7. Shared fixtures, gates and handoff

The existing architecture's U stress design specifies **10,000 logical nodes, 1,000 visible nodes, eight nested clips and 50,000 variable-height list records**, with Chinese/English/RTL/emoji and static, 1% changed and fully dirty updates. These are planned fixture inputs, not measured capacity or achieved performance.

Freeze authored data, fonts, viewport, density, scripts, mutation schedule, counters and independent references before comparing implementations. Logical data, live display rows, semantic nodes, pending work, resident bytes and device resources must be counted separately.

Use a small deterministic reference for layout/virtualization and fixed independent text/image references for the qualified host profile. Cover default/custom adapters, mutation/reentry, first failures, cancellation and cleanup; do not add tests that merely mirror an implementation loop.

Existing repository commands remain the entry points: `pnpm run build`, `pnpm run test`, `pnpm run check:types`, `pnpm run check:boundaries`, `pnpm run check:quick` and `pnpm run check:merge`. New cases join their applicable existing suites. This design creates no future CLI or new qualification command.

Local focused feedback is not merge qualification. The required complete gate and protected CI remain mandatory for a merge candidate. Browser/IME/accessibility evidence is an additional scoped result, not a substitute for those gates.

Performance work retains the architecture's budgets and full measurement disclosure. Report CPU phase/whole-window timing, cadence, raw samples and resource accounting with the fixed workload; do not treat glyph cache hit counts or a helper microbenchmark as D60 acceptance. M1.2 and M3 performance rows stay OPEN until their own required actual evidence passes.

M4 receives the qualified capability matrix, exact font/provider/host inputs, fixture references, known restrictions, recovery results and actual performance records. M3 completion requires all four packages' advertised behavior; a missing required IME, script or accessibility row is not silently removed from the scope.

## 8. Community contribution boundaries

Keep #57 as the parent and retain the four linked work-package issues #87–#90, M3.1–M3.4. Each issue owns the complete outcome above, proposed paths, dependencies, acceptance and evidence limits; it is not a list of unowned microtasks.

M3.1 and M3.2 can start independently. M3.3 can develop its state machine and browser bridge against the declared layout/text contracts while those implementations proceed. M3.4 joins their executable slices; final acceptance is integrated rather than four unrelated demos.

Contributors can submit small reviewable PRs within one package. Before changing a shared contract, update the owning issue and both languages together. Preserve current T1/TF1/MI1 behavior and historical evidence; a new profile gets explicit admission and provenance rather than rewriting old acceptance.

Third-party text algorithms, Unicode data and fonts require exact source/version/license attribution and redistribution review. Community contributors can provide fixtures, platform runs and accessibility review without being required to claim results for hardware or languages they have not tested.

## 9. Design alternatives and non-goals

Growing the explicit-line/mouse/planner APIs into a complete UI in place would erase their narrow compatibility contracts. A separate DOM application would split application state, clipping and mixed rendering. The recommended design is the layered optional UI owner above the existing scene/resource system, with native editing and semantic adapters at the browser boundary.

This plan does not add another framework, promise arbitrary CSS, rebuild an entire browser text engine without provenance, implement a full rich-text editor, or claim complete EUI/EXML compatibility. None of the design, source inspection or referenced standards establishes native acceptance by itself.

## Delivered slices and contribution continuity

Current UI, paragraph, font/theme, shared-effect and input contracts are linked in [core capabilities](core-progress.md). PR #127's contributed movement/action state is exported through @egret/engine/ui; it owns at most one contact per control, has explicit logical radius/dead-zone and terminal/error cleanup, and does not add competing native listeners. Keep its [accepted source review](https://github.com/cnedwin/Egret_rebuild/pull/127#pullrequestreview-5796600093), exact closure/diagnostic history and contributor credit.

Keyboard/example wiring, drag/pan/pinch, popup/modal arbitration, full native-editor qualification, semantic projection and full M3.4/device acceptance remain work in the existing packages. CPU/UNIT, browser, injected-device and human-input evidence stay distinct. Do not repeat the already merged controls or interpret their state-machine tests as full phone acceptance.
