# Multi-pointer example

English | [简体中文](README.zh-CN.md)

This small Canvas example uses the public `@egret/engine`, `@egret/engine/web` and `@egret/engine/web/pointer` entries. Two authored `Sprite.hitArea` rectangles show independent mouse, touch and pen contacts, including non-primary fingers. Each contact retains its down target while moving outside the canvas. White markers and the contact list show current logical coordinates; each terminal event clears that contact's state.

After building the repository with the pinned tools, run the example server and open `/examples/multi-pointer/index.html`. The module exports `ready`, `readSnapshot()` and `close()` for bounded browser observation. Snapshots contain scalar contact observations only. No external assets are used.

## Interaction and lifecycle

- Hold two fingers, one in each region, and move either independently. A mouse or pen uses the same Pointer Events path.
- Ending one contact leaves the other active. Native cancellation, capture loss, blur, page hiding and pagehide cancel the affected contacts.
- Changing the viewport rectangle, scrolling, resizing, orientation changes or visual viewport changes cancels active contacts before incrementing the viewport revision. Only fresh downs start contacts in the new mapping.
- The Suspend button cancels active contacts and refuses new ones. Resume starts from no held contacts. Closing disposes input through its genuine Engine/Scope ownership.

The browser adapter requires a connected same-realm canvas with finite positive bounds. The canvas and its ordinary ancestors must have no CSS transform, perspective or individual translate/rotate/scale, and zoom must be `normal` or `1`. Canvas border and padding must be zero and `object-fit` must be `fill`. Unsupported profiles are refused rather than approximated. CSS client coordinates map once to configured logical dimensions; render pixel ratio does not enter input mapping.

The adapter installs `touch-action: none` on the canvas before the first contact, saves the original inline value and priority, and restores both on cleanup. Page scrolling outside the canvas stays available. It uses native Pointer Events and per-pointer native capture, with no Touch Events fallback or compatibility mouse listeners. A second live multi-pointer bridge on the same canvas is refused. Combining this adapter with the older primary-mouse adapter on the same canvas is unsupported.

A `webglcontextlost` event suspends input. `webglcontextrestored` does not automatically resume it: the application must confirm that the renderer and relevant scene resources are ready, then call `input.setInteractive(true)`. Hosts whose device loss is reported through another channel, including WebGPU, must explicitly call `input.setInteractive(false)` when lost and `input.setInteractive(true)` only after readiness is established. This Canvas example does not exercise GPU recovery.

## Scope and verification

The example demonstrates the initial multi-pointer input foundation. It is not a reusable joystick, gesture recognizer, full UI system, IME integration or mobile-device qualification. Controlled browser-port tests in `tests/browser-pointer.test.mjs` use real public Engine/Scope/display objects, but native browser and physical touch/pen acceptance require separate evidence.

Reference: [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/) defines pointer capture, implicit release, primary-pointer semantics and the timing of `touch-action`. The implementation is independently authored; the reference is not a product dependency.
