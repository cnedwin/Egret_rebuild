# M3: complex UI, paragraph text and input

English | [中文](../../Cns/docs/m3-ui-text-input-plan.md)

Design proposal, 2026-10-23. Parent tracking issue: #57. This document proposes four contribution packages; it reports no new implementation, benchmark, browser, IME or assistive-technology result.

M3 delivers a usable UI system on the existing Engine, display tree, Scope and resource owners. It includes automatic layout, variable-height virtual lists, styled paragraph text, pointer/keyboard input, focus, basic native text editing and browser accessibility. It does not complete legacy EUI/EXML migration, all platform integrations or M4 production acceptance.

M1.2/D60 remains OPEN after the valid sequence-6 formal timing failure. Existing rendering/resource results are prerequisites and regression references, not M3 acceptance. Independent M3 work may proceed without representing that performance gap as closed.

## 1. Current implementation and the intended change

The following is source inspection, not a claim that every platform behavior has been tested.

| Area | Implemented now | Preserve / extend / replace |
| --- | --- | --- |
| Layout | `packages/engine/src/layout.ts` implements `planLinearLayout`: at most 4,096 explicitly sized numeric items, padding/gap/alignment and immutable placements. | Preserve its admission, arithmetic and errors. Add automatic measure/arrange and invalidation above it; do not change the planner into a scene owner. |
| Display and events | `packages/runtime/src/Event.ts`, `EventDispatcher.ts` and display input operations provide typed descriptor identity, synchronous capture/target/bubble routing, cancellation and stable dispatch snapshots. | Reuse these semantics. UI actions must not introduce an asynchronous parallel event bus or dispatch into a stale route. |
| Lifetime | `packages/runtime/src/Scope.ts` cancels first and attempts reverse-order cleanup; display parentage is separate from resource ownership. | Every UI root, row binding and browser bridge has an explicit existing Scope owner. Reparenting is not disposal. |
| Mouse/button | `packages/engine/web/MouseInput.ts` admits primary mouse input on a restricted ordinary Canvas CSS profile; `bitmapButton.ts` implements up/pressed/disabled skins and guarded activation. | Keep these compatibility entries. New pointer/focus/control behavior uses a new opt-in UI entry, with explicitly qualified host coordinates. |
| Text display | TF1 is a noneditable explicit-line leaf with desired/committed revisions, explicit asynchronous preparation and genuine texture leases. | Keep `createTextField`, requests, limits, old-visible-until-success behavior and source ownership. Paragraph/editable text is a distinct target profile. |
| Text cache/provider | T1 has bounded jobs, demand, generations and leases; WC1 measures and paints complete explicit lines through Canvas and checks font readiness. | Retain the ownership machinery; add font identity, paragraph plans and separate layout/raster keys. Readiness is not font identity, coverage or shaping proof. |
| Missing coordinated UI | No automatic layout owner, virtual-list component, general focus manager, IME editor or semantic DOM bridge was found in the inspected implementation. | Implement these as cooperating modules rather than reinterpret the existing limited entries as complete UI. |

The current text contracts explicitly exclude automatic wrapping, rich text, editing, caret/selection/IME and shaping guarantees. `packages/project/src/text-input.ts` parses project JSON; it is not an IME implementation.

Related contracts: [architecture and stage acceptance](architecture-and-engineering-plan.md), [linear layout](local-linear-layout-spec.md), [T1](text-raster-t1-contract.md), [TF1](text-field-tf1-contract.md), [WC1](canvas-text-wc1-canvas.md), [primary mouse input](primary-mouse-input-contract.md), [shared rendering](shared-render-profile-contract.md), [resource recovery](resource-recovery-contract.md).

## 2. One UI state, four cooperating modules

Keep the existing four-package split. DOM-free layout, paragraph/edit state and semantic descriptions belong in runtime-facing modules; public orchestration belongs in optional Engine entries; browser APIs stay under Engine web entries. New module paths below are proposed locations, not existing exports.

| Target concept — not an existing API | Responsibility and boundary |
| --- | --- |
| UI root / committed layout | Owns component state, dirty queues, measure/arrange and one published layout revision. It writes the existing display tree before capture. |
| Paragraph plan / text provider | Owns source-range mapping, line layout and provider-qualified shaping geometry; raster output remains an ordinary owned image/texture resource. |
| Input/focus/edit bridge | Converts host input into synchronous typed actions and revisioned edit transactions; owns native listeners and native editable elements. |
| Semantic projection | Projects the same control state into browser roles, names, states and focus targets. It is not a second application model. |

The update boundary is: apply synchronous actions → resolve dirty measurement → arrange → publish layout/interaction/semantic revision → capture/render. Host submission does not start layout or font work. Reentrant mutations during preparation queue a later UI revision; a failed or stale preparation cannot partly publish a new layout.

This transaction belongs to the new UI owner; it does not retroactively make arbitrary existing display-object setters transactional. UI-owned geometry is written only by its owner, and external overrides require an explicit escape hatch/invalidation policy.

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

The target layered acceptance slice includes nested rectangular clips, one authored alpha-mask composition and one bounded offscreen blur group, interleaved with ordinary UI/content. Alpha-mask and offscreen execution are shared-renderer capabilities to deliver/qualify with its owner, not capabilities inferred from the current clip API. Until available, that integration row stays blocked.

The UI owns effect parameters and invalidation; the renderer owns render targets, device-generation handles, pixel-area/scratch/in-flight budgets and physical retirement. A bounded declared kernel and fixed reference determine the blur fixture. Effects cannot silently disappear on Canvas or another unsupported backend; required capabilities are rejected at startup/load.

Hit testing uses the control's explicit committed geometry and clips. An alpha image mask does not automatically enable pixel-accurate hit testing; where the example requires a masked hit shape, it supplies a corresponding admitted geometric hit region. Blurred pixels never enlarge a control's hit area implicitly.

Accept nested popup/modal ordering, scrollbar drag, clipping and hit behavior, theme/font changes, effect invalidation and recovery using fixed layer/pixel/interaction references. Later scope includes arbitrary shader/filter graphs, general vector-mask authoring, unrestricted CSS, theme editors, docking/tree-grid controls and legacy EUI skins; none is hidden inside the first control-set claim.

### Coherent asynchronous updates and shared effects

M3.1 owns a committed UI update domain: the smallest subtree plus dependent ancestors, popup anchors, focus/editor and semantic projections that must change together. An asynchronous font/skin result stages its complete affected layout, paint bindings and interaction geometry; it cannot publish one of them alone. While pending or failed, that domain keeps its prior committed presentation and geometry; unrelated domains remain interactive. If a size change affects parent/sibling layout, enlarge the domain before commitment. For an initial domain with no prior version, publish an explicit placeholder with matching hit/semantic behavior. Do not wait for GPU recovery on the global animation clock.

M3.2 supplies readiness, cancellation and revision identity; M3.3 consumes only committed geometry. M3.1 commits through its UI owner at a documented frame boundary without invoking user callbacks between partial writes. Reentrant changes queue for the next revision. Direct scene setters outside the UI owner must either be rejected for managed geometry or enter an explicit invalidation path; they cannot silently bypass the transaction. Test a late font result changing a focused virtual row's height while a newer skin arrives, cancellation/disposal, and an unaffected sibling. Assert scroll anchor, hit target, editor position and semantic revision together. The retained focused/composition row counts toward the scenario's declared live-container cap.

M3.4 contains an explicit shared-renderer deliverable, reviewed by the rendering maintainer before the UI integrates it. Specify effect inputs/outputs, pass order, target extent/format, alpha/color convention, parent clipping and nested-effect admission. The renderer owns pooled targets, overlapping-generation and scratch budgets, completion-based retirement and loss/recovery. M2.3 owns Spine color conversion and reviews the common color boundary; it does not inherit UI effect implementation. Qualify the selected mask and blur kernel on both WebGPU and WebGL2, including nested clipping, budget refusal and device loss. Reuse existing execution paths; neither a general render graph nor a new shared-frame version is a prerequisite. An incompatible representation requires a specific reviewed extension before consumers merge.

## 3. M3.1 — automatic layout and variable-height virtualization

**Outcome:** a resizable, scrollable data panel with stable variable-height recycling, not a collection of disconnected layout helpers. Difficulty: high. Start: ready for bounded implementation; final text integration joins M3.2.

1. Define explicit/min/max sizes, content measurement, padding/gap, horizontal/vertical arrangement and alignment. Resolve constraints in deterministic measure then arrange phases; reject unsatisfied dependency cycles instead of iterating until a timing-dependent result appears.
2. Separate measurement, placement, paint, interaction and semantic dirtiness. A paint-only change must not trigger measurement; a local width/text change invalidates only the required ancestor/descendant dependencies. Unchanged UI performs no new measure or raster work.
3. Publish immutable layout results by revision. Stage component changes before display writes; validate the complete proposal and all admitted numeric values before publication. Retain the previous committed revision on failure.
4. Implement scrolling and a 50,000-record variable-height list with stable item keys, a prefix-height index and logarithmic offset/update lookup. Data records are not display nodes. Instantiate visible rows plus a fixed configured overscan region.
5. A row binding owns its listeners, text/image demand and asynchronous generation. Recycling cancels the old binding before reuse; late results cannot populate a different item. Detach does not release another owner's resource.
6. Preserve a scroll anchor as stable item key plus within-row offset when heights or data change. If the anchor is removed, use the documented next-survivor/predecessor rule and clamp once to the new range. Do not equate index with identity.
7. Keep keyboard focus/composition on a bounded explicitly retained row, or complete an explicit focus transfer before recycling. Report retained rows separately from overscan; never grow an unbounded hidden row cache.
8. Reflow after viewport/density/font changes is a single revisioned transaction; scrolling and picking never combine old clips with new row geometry.

Proposed paths: existing `packages/engine/src/layout*.ts` compatibility surface; new optional `packages/engine/src/ui/` and `packages/runtime/src/ui/`; focused existing-style tests and an example under `examples/`. No new package is required.

Deliver one end-to-end data-panel example, a component/layout contract, bounded memory accounting, deterministic small reference fixtures and the large stress fixture. Dependencies are existing display/Scope/input primitives; paragraph measurement and focus connect through the contracts above.

Acceptance is executable: compare small layouts and virtual ranges against an independent simple reference; test conflicting constraints/cycles, signed zero/nonfinite admission, insertion/deletion/reorder, changing heights above the viewport, empty data and extreme scroll offsets. Test cancellation, reentry, disposal and late results during recycling.

Use counters to prove unchanged UI does not measure/raster again, local invalidation does not become an unexplained full traversal, and retained rows/resources remain within configured bounds. Large-fixture counts and time must be recorded separately; no fixed time result is claimed by this design.

## 4. M3.2 — paragraph text, font identity and recoverable text caches

**Outcome:** styled, wrapped, aligned and truncated paragraphs with reproducible font inputs, source mapping and resource recovery. Difficulty: expert text/rendering. Start: ready; layout and editing consume its declared plan contract.

1. Introduce a new paragraph profile with immutable attributed source, explicit language/base direction, wrapping constraints, alignment, truncation and density. Preserve UTF-16 source offsets at public/native boundaries; retain cluster boundaries and visual-order/affinity mappings separately.
2. Distinguish segmentation, bidi resolution, line-break opportunities and shaping. Pin a Unicode data version for any engine-owned algorithm; do not claim that grapheme boundaries alone produce glyphs, caret geometry or line fitting. [UAX #29](https://www.unicode.org/reports/tr29/), [UAX #9](https://www.unicode.org/reports/tr9/), [UAX #14](https://www.unicode.org/reports/tr14/).
3. Keep WC1's existing native complete-line measurement/raster path. For the new paragraph profile, the recommended first implementation is an optional CPU/Wasm provider: ICU for boundary/bidi services, HarfBuzz for shaping, and FreeType for glyph rasterization from the same owned font bytes. Exact builds/data/licenses freeze at implementation qualification; no dependency is added by this plan. [ICU boundary analysis](https://unicode-org.github.io/icu/userguide/boundaryanalysis/), [ICU bidi](https://unicode-org.github.io/icu/userguide/transforms/bidi/).
4. Itemize by script, bidi level, language and shaping style/font; paint-only changes do not split shaping. Pass full paragraph context with an item range to HarfBuzz, retain UTF-16 cluster mapping and glyph advances/offsets, select breaks from admitted opportunities, then reshape final lines and apply line bidi ordering. Fallback replaces an unsupported cluster/context run, never arbitrary UTF-16 units. [HarfBuzz context](https://harfbuzz.github.io/adding-text-to-the-buffer.html), [clusters](https://harfbuzz.github.io/clusters.html).
5. Rasterize those exact glyph IDs/positions with FreeType using the same face/variation/size/load policy; derive bounds from that plan, not Canvas prefix widths. First font formats cover qualified outlines and embedded-color/COLRv0 fonts; SVG/COLRv1 require a later rendering extension and are explicitly refused, not silently rendered monochrome. Specify premultiplied-BGRA conversion to the existing image policy. A glyph atlas remains optional; whole-run/line images are the baseline. [FreeType glyph retrieval](https://freetype.org/freetype2/docs/reference/ft2-glyph_retrieval.html).
6. A font manifest identifies exact bytes, face/variation settings, licensing/provenance, ordered fallback and generation. Application-owned/system fonts require an explicitly named environment profile; `FontFaceSet` readiness alone does not prove which glyph source was used. [CSS Font Loading](https://www.w3.org/TR/css-font-loading-3/).
7. Separate font/shape/layout/raster keys. Keys include exact text and attributed runs, font/fallback identity and generation, provider/profile version, language/direction/features/variation settings, constraints/line policy and raster density/paint. Reuse only the stages whose inputs are unchanged.
8. Bound source length, runs, lines, metadata, queued work, caller leases, image bytes and scratch bytes independently. Preserve T1's existing limits unchanged; new limits belong to the new profile and must be declared before allocation and tested at the boundary.
9. Publish layout, bounds and raster together only for the latest accepted revision. Old visible text remains until replacement succeeds; font cancellation, failed fallback or late completion cannot partially change the displayed paragraph or its hit geometry.
10. Use existing asset leases and device recovery. Font-generation change invalidates affected CPU plans and rasters; GPU-generation change rebuilds GPU materialization without inventing new text, selection or font identities. Retain CPU data or an explicit reload recipe.

Proposed paths: extend beside `packages/runtime/src/text/`, `packages/engine/src/text*.ts` and `packages/engine/web/CanvasTextRasterProvider.ts`; keep current T1/TF1/WC1 entry behavior and tests. Add a paragraph provider through optional entries, not DOM imports into runtime.

Paint ranges that bisect one shaped cluster use that cluster's leading-source paint in the first profile; font/size changes remain explicit shaping boundaries with surrounding context. Freeze this rule in references instead of claiming arbitrary CSS inline-text equivalence. Cluster maps do not invent internal ligature caret positions: basic editing uses the native editor while active, then publishes the committed paragraph on handoff. Load the same authored fonts into that editor, but record native editor layout/raster separately rather than asserting pixel identity with FreeType.

Deliver a paragraph example and independent fixed font references covering CJK/Latin, RTL with numbers, combining marks, ligatures, emoji/ZWJ, fallback, style boundaries, trailing spaces, overhang, wrap/truncate and density. Use Unicode conformance data, authored glyph/cluster/line expectations and a separately captured native browser reference with declared metric/pixel differences; an upstream HarfBuzz run alone is a dependency-integration check, not an independent shaping oracle. Include third-party bundle/startup/CPU-memory costs in the M4 handoff.

Acceptance includes exact source/cluster/line mappings, recorded metric/pixel tolerances per qualified font/backend, failed-font and stale-generation controls, eviction under live leases, recovery and absence of repeat static layout/raster. Every advertised script/style combination needs real provider evidence; missing combinations remain OPEN.

M3.2 qualifies the proposed ICU/HarfBuzz/FreeType combination before making it a fixed implementation dependency: retain exact build/data/font identities and measure required transfer, initialization and owned CPU/Wasm storage in the early M4.1 slice. Compare those observations to M4's proposed budgets before completing all controls. A failed budget requires an explicit implementation/design decision and preserved results, not removal of required languages or delayed loading past a claimed ready marker. Keep the existing native whole-line route and optional package boundary; the proposal itself is not evidence of feasibility.

M3.3 owns the native-editor handoff contract with M3.2. While editing, the native editor is authoritative for composition/selection and its visible editing geometry; prevent a duplicate engine-painted editable value or duplicate semantic node. On activation retain source selection and a stable control/scroll anchor while adopting native caret/line geometry. On deactivation, commit the final text only after composition settles under the declared policy, then publish matching paragraph/layout geometry. Preserve the source caret/selection for later activation. Declare and test font-specific allowed reflow and anchor displacement before acceptance; do not promise pixel-identical line breaks. Cover CJK/RTL/emoji, delayed fonts, keyboard viewport resizing, scrolling and stale composition callbacks. Synthetic input does not qualify actual IME usability.

## 5. M3.3 — pointer routing, focus and native text editing

**Outcome:** a keyboard- and pointer-operable form inside scrolling/clipped UI, with real composition and predictable lifetime. Difficulty: expert browser/input. Start: ready against the declared contracts; integration depends on M3.1/M3.2.

1. Add an opt-in pointer bridge covering mouse/touch/pen, capture/lost-capture/cancel, hover and wheel/scroll policy. Preserve the old primary-mouse contract. Admit an explicit CSS/viewport profile; unsupported transforms must be refused, not guessed.
2. Convert coordinates from host viewport to committed logical geometry once. Recheck the target/owner at dispatch; capture is logical routing authority, not permanent entitlement after disposal. Backgrounding, lost focus and lost native capture terminate the corresponding gesture exactly once.
3. Declare browser default-action policy, including `touch-action`, scrolling and cancelable events. Use Pointer Events behavior as the host contract; synthetic events cannot establish real touch/capture behavior. [Pointer Events](https://www.w3.org/TR/pointerevents3/).
4. Focus is a logical control identity independent of recycled display instances. Define tab traversal, directional navigation for composites, focus-visible state, disabled/hidden removal, modal containment and restoration to a surviving target.
5. Use one native `input`/`textarea` for the active basic editor as the authority for browser selection/composition while editing. It must remain an actual focusable native editor, with a qualified position/clip/scale profile; a `display:none` element is not an IME solution.
6. The engine edit model owns committed value/revision and source ranges. Composition is a distinct provisional session; browser value/selection events enter one ordered transaction stream. Do not transform committed value in the middle of an active composition.
7. Handle `beforeinput`, `input` and composition events without duplicate commits; noncancelable IME changes are reconciled from the native value. Reject stale revision writes and define programmatic changes, blur, submit, cancel, undo/redo and disposal during composition. [Input Events Level 2](https://www.w3.org/TR/input-events-2/).
8. Native offsets remain UTF-16; application delete/navigation behavior uses admitted cluster boundaries and affinity. Do not infer a caret from sums of individually measured characters. Native editable presentation and committed canvas text have an explicit handoff, not two competing visible values.
9. M3 basic editing supports single-line and multiline plain text. Rich-text display belongs to M3.2; a full rich-text document editor is a separate scope. Unsupported editor rotations/nonrectangular clips require a visible capability restriction, not silent coordinate loss.
10. Clipboard and virtual-keyboard interactions stay under host/user permissions. Do not persist typed personal text in diagnostics; input evidence uses authored fixtures. Scope disposal removes listeners/native elements and ends captures/composition without resurrecting controls.

Proposed paths: optional UI input/focus modules beside `packages/engine/src/mouseInput*.ts`, browser adapters under `packages/engine/web/`, DOM-free edit/focus state under `packages/runtime/src/ui/`. Existing events retain synchronous semantics and first-error/cleanup behavior.

Acceptance includes state-machine cases and actual host sessions: pointer cancellation outside the surface, simultaneous contacts, scroll versus activation, reparent/dispose during callbacks, focus restoration, CJK composition commit/cancel, dead keys, RTL selection, emoji deletion, paste, scaling and background return. Record exact browser/OS/IME; automation alone cannot close IME or mobile keyboard rows.

## 6. M3.4 — accessible controls, skins and the integrated UI scenario

**Outcome:** a complete reusable control set and an inspectable complex UI example. Difficulty: high, with accessibility review. Start: blocked for integration until M3.1–M3.3 contracts and executable slices are available; fixture/design contributions can begin earlier.

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
