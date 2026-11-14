# Native plain-text editing

English | [简体中文](../../Cns/docs/native-text-editing.md)

M3.3 now provides an optional single-line/multiline editing slice inside existing managed UI. A real browser input or textarea owns active editing, selection, native undo/redo and composition. The existing paragraph renderer resumes the same committed source after UI publication. This slice does not close the complete M3.3, IME, phone or accessibility requirements.

## Entries and ownership

| Entry | Responsibility |
| --- | --- |
| @egret/runtime/ui/editing | createTextEditState and source/selection/session types; DOM/Node-free bounded state |
| @egret/engine/ui/editing | createUiTextEditor and UI types; genuine Engine/Scope, existing ParagraphCache and prepared UI bindings |
| @egret/engine/web/editing | createBrowserEditorFontProvider and createBrowserTextEditor; explicit browser registration, native elements/listeners and placement |

The default Engine, Canvas, UI and keyboard entries keep their existing public surfaces. No new renderer, shaping engine, asset manager, contact route or frame scheduler is introduced. Private root/control identity prevents structural copies or foreign Engine/Scope values from gaining native editing authority. Source and current dependency records retain exact historical predecessors.

## Source and transactions

Committed text is well-formed UTF-16, bounded to 8192 units (or a smaller configured maxLength), with source-based anchor/focus and upstream/downstream affinity. Positions cannot split a surrogate pair. Multiline sources normalize CRLF/CR to LF; offsets apply to the normalized source. Single-line sources reject newlines. Invalid source, controls or selection refuse before publication. Grapheme deletion and native editing remain host operations, never estimated character widths.

One opaque activation identifies an edit session. A native update carries the expected committed revision; stale sessions/revisions cannot overwrite newer intent. Composition keeps one provisional draft and commits the observed final native value once; duplicate equal final input is idempotent. Programmatic value/selection changes during composition refuse. Explicit setValue(..., {cancelComposition:true}) cancels the old session, publishes the supplied intent and rejects late detached native events. Native undo history is preserved by avoiding equal DOM value writes; an explicit divergent programmatic replacement may reset host history. No second undo stack is supplied.

cancel() discards provisional composition and retains already committed ordinary edits. finish(), single-line Enter and blur commit the observed native source. Multiline Enter stays inside the textarea. Composing Enter/Escape and Process/229 events remain with the host. Without a keyboard option, native Tab follows browser behavior; with a genuine keyboard option it restores the logical target captured at activation and uses existing forward/backward focus order. Suspension never fabricates focus on resume. Terminal input/composition callbacks after session-token retirement are ignored; active-session reentry still refuses.

## Managed UI and rendering

Create a control with engine, scope, cache, mode and a style containing the paired fontSet key/families, fontSize, locale, direction and fillColor. Optional lineHeight, textAlign, backgroundColor, padding, minHeight and visibleLines describe its readonly presentation. The default readonly limit is one line for single-line controls and six for multiline controls; the native element edits the complete admitted source. The control exposes content for a normal leaf and prepare(context) for an existing virtual source. Natural paragraph height drives layout, within the configured minimum.

Only value/style changes advance content.revision. Selection and provisional composition do not reraster text. An onChange callback stages a new existing tree/source revision. Run the normal root.prepare()/commit(), then bridge.sync(), then the application's existing shared capture/render path. onInvalidate requests that same path when native/canvas visibility changes; it never starts a loop. Callback errors preserve the committed model and close native ownership; applications must retry their UI publication explicitly.

The native bridge authenticates the committed leaf ID or virtual list ID/stable key, using the real paragraph hit/selection geometry and captured display transforms. At most eight live/staged presentations are held per control. While editing, only the readonly paragraph is hidden; its background and wrapper remain managed. Native display is removed only when the committed UI content revision and source match. Failed or cancelled preparation keeps the previous committed UI and native presentation. After finish, a pending handoff is readonly until a matching paragraph can publish. A missing-glyph refusal never silently substitutes a different committed source; supply a qualified font or explicitly replace the value to recover.

An active virtual editor borrows the existing row-retention accounting and caps. Its private token retains stable row identity while allowing its readonly content, font metrics, width and density to republish; existing public focus/composition tokens continue to lock their original binding. A row cannot be deleted under either token; finish/dispose the editor before deleting the key. Fully clipping a row ends native editing and releases its token. Scope, root or Engine closure removes the native element, listeners/observers, provisional state and row/font leases; repeated cleanup is harmless.

## Fonts and placement

createBrowserEditorFontProvider loads the same immutable FontContentLoader roots through the existing paragraph font-set provider and resource groups. It creates binary FontFace registrations under generated CSS aliases, waits for actual load completion and returns a genuine handle whose key is the paragraph font-set key. Readiness in CanvasKit alone is insufficient. No network font URL or second asset cache is used. Retired sets cancel active native users before their CSS registrations are removed. Failed/cancelled candidates leave the previous handle usable. setFontSet accepts a ready paired handle outside composition; callers coordinate multiple fields and retire prior sets after their readonly handoff.

The browser provider admits eight pending/ready sets, 64 MiB of admitted font-source bytes and 64 native-editor leases per set, with a 30-second default native-load deadline (maximum 120 seconds). These are logical limits, not measured native/Wasm memory. Closing/cancelling demand does not pretend to abort an unsettled browser font parse: jobs remain counted until actual settlement. The provider borrows, and does not close, the existing paragraph provider.

The initial placement profile supports horizontal text, positive axis-aligned display/CSS scaling and rectangular clipping. Logical scene size is explicit and independent of backing pixels/DPR. Call sync after every UI publication; browser resize/scroll and visual viewport notifications update placement. Unsupported rotations, perspective, effects/alpha on the editor path, nonrectangular clips, clip-ancestor border/padding, CSS zoom, transformed/contained document roots, rounded clips, shadow-tree ancestry and pinched visual viewports refuse explicitly. Surface/modal owners use setInteractive(false) to end ownership before exclusion. Native and readonly fonts share admitted identities, but their shaping/wrapping/ink may differ; no pixel-equivalence claim is made.

## Verification and remaining qualification

The [runnable form](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/README.md) uses a responsive preview with bounded startup DPR and a separate fixed verification preset. True width changes replace a separately scoped view while retaining models/fonts and the visible stable-key anchor; keyboard-only height changes keep native editing. Actual DPR changes require reopening the preview.

The original [summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/verification-summary.json) retains its 20 desktop checks per backend. The [Android follow-up](android-native-text-editing.md) records the final 21 fixed plus eight responsive checks per desktop backend, actual Samsung software-keyboard observations on predecessor example bytes with the same final core, and exact-final-source Android lifecycle checks on both backends. Source reuse, event trust and controlled injection are explicit.

A CPU-level case, [`tests/ui-editor-row-integration.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-editor-row-integration.test.mjs), holds the focus on an editor row of a virtual list while its font arrives late, the theme changes, or both happen together with a new value. Four cases check that the heights and places of the rows, the logical and keyboard focus, the editor's text geometry and the [semantic tree](ui-semantics.md) with a text box inside the row stay in step: nothing committed moves until the font has arrived, a theme change binds every row again and moves nothing a reader is told of, and an overtaken preparation is refused with `UI_STALE`. A literal paragraph provider stands for the fonts. The native element, real fonts and the browser projection are not in that file; that part of the integrated case remains a browser run.

Other CJK/dead-key IMEs, iPhone, human-finger qualification, system clipboard and assistive technology remain open. The bundled Noto set has no qualified emoji fallback; deletion/value recovery does not qualify emoji rendering. Native SDK/mini-game hosts need their own adapters. M1.2's 10.3 ms versus 8 ms target and full M3/M4 remain OPEN. The existing touch contributor's scope is unchanged.

The protocol was developed independently against [Input Events Level 2](https://www.w3.org/TR/input-events-2/), [UI Events](https://www.w3.org/TR/uievents/), [HTML text-control selection](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection) and [CSS Font Loading](https://drafts.csswg.org/css-font-loading/). Existing attributed CanvasKit/Noto artifacts and licenses remain unchanged; standards references are not browser/IME acceptance.
