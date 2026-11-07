# UI popup and modal layers

English | [简体中文](../../Cns/docs/ui-layers.md)

M3.4 supplies optional root composition through @egret/engine/ui. The first-party implementation reuses Engine display ownership, Scope, pointer routing, keyboard focus, paragraph/font resources and the existing native editor. It introduces no scheduler, renderer, resource manager or host input listener.

## Public contract

createUiLayerManager({engine, scope, input, keyboard?, viewport, maxLayers?, editorPolicy?, onInvalidate?}) borrows a genuine Engine, Scope and input channels. The viewport is an explicit positive Stage-space rectangle. There is at most one layer manager per Engine and one owner per registered root. The default registration bound is16, the hard maximum32; native/root interaction subscriptions retain the existing bounded lifetime. Default editorPolicy is commit; cancel cancels provisional composition, while ordinary committed edits remain in their model.

register({id, root, kind, anchor?, initialFocus?, closeOnEscape?, closeOnOutside?, backdropColor?, backdropAlpha?}) returns an idempotent disposable registration. Roots must be genuine, live and created against the same Engine and exact pointer/optional keyboard channels. Structural copies and foreign roots are rejected. kind is base, popup or modal. Bases remain visible; overlays start hidden after the first sync. The caller retains root ownership. While registered, a root cannot switch its shared pointer channel. Register, sync and viewport publication run outside routed input/frame callbacks; lifetime revocation remains legal during routed input or Scope/Engine shutdown.

open(id), close(id) and setViewport(rect) stage intent. Closing an overlay also closes every overlay above it. A base cannot be opened/closed. After the caller prepares/commits participating roots, sync() publishes layer poses/order and interaction eligibility before native editor sync and frame capture. It returns committed, unchanged, pending or closed, a committed intent revision and postCommitErrors. onInvalidate requests this same caller-owned publication path. Reentrant invalidation is not recursively delivered; at most64 observer failures are retained until the next result. A notification failure, including a thrown undefined, is not a rollback of published state.

## Geometry and publication

An anchor names another registered root and a committed leaf or visible stable-key row. Bounds are intersected with root/list clipping; hidden, recycled, deleted and fully clipped anchors are unavailable. Registration identity prevents an old anchor from reviving after id reuse. A popup prefers below (default gap4 logical units) or above, flips when the alternative fits and clamps to the supplied viewport. Unanchored overlays are centered. An oversized overlay rejects with UI_LAYER_VIEWPORT_TOO_SMALL, preserving the previous publication; the caller must provide a fitting layout/viewport.

Overlay roots are ordered at Stage level, outside the anchor's scrolling clip. Content still retains its own clip. This profile inherits managed UI's identity Stage transform. Layers do not infer CSS transforms, rotate a native editor or resize paragraph content to make it fit.

Opening a new overlay waits for ready committed content. Closing an already published overlay does not wait for unrelated or pending content. Layer presentation has a separate epoch from content layout: an older prepared content token becomes stale rather than restoring an obsolete visible/hit pose. Placement, hiding and focus eligibility reuse committed rows without rerunning their measure/bind path. UiSnapshot.layerRevision is present only after managed layer publication; content revisions retain their original meaning.

Validate before cancelling contacts, then revalidate after cancellation callbacks. A changed intent/root/content revision makes that continuation pending. Callback-free root/backdrop publication precedes native/focus notifications. The caller commits the next content candidate and calls sync again; no hidden retry loop or fake transactional rollback is added.

## Pointer, keyboard and native editing

The existing pointer channel supplies picking, capture and cancellation. A scoped backdrop lies behind its overlay and consumes an outside contact, including the first contact that dismisses a popup. It never forwards that activation to the underlying scene. Popups close on outside end by default; modals do not. Roots below the highest modal are pointer-inactive. Active contacts are cancelled before a changed layer publication. Movement/action controls and their contribution ownership are unchanged.

The top overlay contains logical keyboard/native focus. Tab and Shift+Tab wrap only among eligible targets inside its genuine root, excluding unrelated channel registrations. A private sentinel preserves Escape when there are no tabbable children. initialFocus uses an existing realized list row; otherwise the existing channel chooses a valid target. Escape dismisses only the top eligible overlay; IME composition retains its own Escape behavior.

Background native sessions settle under editorPolicy and retire their DOM control, font lease and row retention. Resumption or logical focus restoration never opens the native keyboard. On close, restore the saved target only if it remains eligible; otherwise select a valid target in the surviving layer. A removed/hidden/recycled target cannot be resurrected by a saved id. This is logical containment, not a complete browser semantic/inertness or assistive-technology implementation.

## Lifetime and example

Each registered overlay owns one backdrop in its own Scope. Repeated open/close reuses it; unregister, root close and manager close retire listeners, target registrations and that scope. Manager disposal preserves borrowed roots/input, resumes bases and leaves overlays hidden. Applications dispose the view outside routed callbacks, then their roots/scopes through the normal lifetime path. A true example width change retires its view and recreates the layers against the same models/fonts/cache, preserving stack, draft and selection; height-only keyboard changes preserve the current view.

The existing [native editing form](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/README.md) offers an opt-in layers=1 mode: list → profile details → rename → details/list. The rename model is a draft; Save updates the original field, Cancel leaves it intact. Both UI roots and the native editor share the existing font replacement and lifecycle. Default/fixed fixtures remain separately declared.

## Evidence and remaining work

The [bounded summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/layer-verification-summary.json) records actual source identities and checks. CPU SDK/type results, desktop WebGL2/WebGPU integration, emulated responsive sizes and physical-device results are distinct. The current Android attempt was refused after wake because keyguard remained showing/restricted; no phone layer or IME pass is claimed. Restore the previous sleep/settings state and retain the refusal receipt.

Complete controls, gesture arbitration, semantic projection, actual IME/iPhone/accessibility rows, full M3.4/#90 and M4 campaigns remain OPEN. M1.2 remains10.3ms versus8ms. The existing eleven packages and contributor scope are unchanged. This increment independently implements Egret's contracts and incorporates no new third-party code/assets; existing fonts/provider/runtime notices and historical receipts remain intact.
