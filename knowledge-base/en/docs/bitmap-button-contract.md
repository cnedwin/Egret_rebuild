# Bitmap buttons

English | [简体中文](../../Cns/docs/位图按钮契约.md)

Engineering preview 0.54.0 adds optional `createBitmapButton` and three erased types to `@egret/engine/web/input`, alongside the existing MouseInput API. Default Engine, Canvas, WebGPU and Runtime entries gain no Button API. Independently authored first-party code is Apache-2.0; no dependency or Host protocol is added.

## Ownership and options

Supply a genuine started engine, its open Scope, genuine open same-Engine input, borrowed textureLease, equal-size up/pressed/disabled skin regions, and onActivate. The input may use another open Scope of the same Engine. A private SpriteSheet and genuine Bitmap belong to the control; the original lease and input keep their existing owners. Attach display to the genuine Engine Stage. Its explicit hit area matches the skin dimensions. The factory never attaches, advances time or renders.

The frozen exact-receiver facade exposes readonly display/state, writable boolean enabled, and dispose(). Options are read once in engine/scope/input/textureLease/skins/enabled/onActivate order. Skins are read up/pressed/disabled, then each x/y/width/height, once. Lifetimes are rechecked after successful user callouts. Throwing getters retain the original cause, including undefined. A single enabled read yielding undefined defaults to true; every other result must be boolean, so null is invalid. The TypeScript optional property retains the repository's exact-optional-property policy.

## Input and retirement

States are up, pressed, disabled and terminal disposed. Genuine native primary input arms before the public begin route; release/cancel restores up before routing. onActivate runs after the complete activate route only while the same gesture, enabled state, lifetime, attachment, display settings and final same-point pick remain valid. Synthetic SDK events cannot arm a control. Disable/re-enable invalidates the gesture; assigning the same enabled value preserves a valid press after checks. Raw MouseInput behavior stays unchanged.

Asynchronous or throwing activation callbacks follow existing event/callback diagnostics and retire controls associated with the failed input. Explicit disposal, Scope/input/Engine closure or original Bitmap disposal is terminal. Logical retirement severs callbacks/associations before cleanup callouts; cleanup attempts all owned resources and retains causes. Borrowed lease and shared input are never disposed by the control. Engine owns the cached Host-close chain.

Hover, keyboard, touch, accessibility and complete EUI remain separate. Under the selected five-file design, unbundled Engine eagerly reaches the Button module through input assembly; optional API placement establishes no zero-loading, bundle, mobile, energy or performance advantage. Read the [evidence](bitmap-button-evidence.md), [remaining plan](bitmap-button-implementation-plan.md) and [example](../../../examples/bitmap-button/README.md).
