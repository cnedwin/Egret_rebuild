# Managed sequence RESET replacement

English | [简体中文](../../Cns/docs/序列动画RESET替换.md)

The optional `@egret/engine/animation` entry exports `createSequenceResetSlot(engine, scope, target, initial)`. It replaces one ordinary attached container's sole Bitmap with a fresh immutable ContentGroup generation. Existing SequencePlayer exact-lease binding, legacy playback, controller events and the Engine clock remain unchanged. This is a bounded M2.4 increment; it does not complete M2.4.

## Ownership and admission

The initial version label, Bitmap and genuine SequenceController are borrowed. The controller must originate from that Engine and that exact Bitmap. The target cannot be the Stage and can have only one RESET slot. Keep its shape and controller under application control; managed UI is not a replacement target.

Each RESET request supplies `policy: 'reset'`, a version label, genuine same-Engine ContentLoader, exact image/sequence IDs and ordinary SequenceControllerOptions in `playback`. The image must be the selected sequence's single atlas page. Labels are application descriptions, never resource or device generation authority. The slot borrows the loader and owns only its fresh Scope, group, Bitmap, controller and prepared ticket. Place persistent layout on the target container: a candidate Bitmap starts with ordinary default display properties.

Only the latest accepted request remains pending. Descriptor/identity/relationship/capacity refusal preserves an already accepted pending request. Content load or clip-dependent marker/duration failure after admission fails that candidate and keeps the active generation. A newly accepted request cancels its predecessor; late provider completion cannot publish and follows existing asset cleanup. Each request checks the existing 256-controller and shared target-claim limits before admission and again at controller creation. Admission is not a reservation; overlapping active/candidate controllers count toward those limits.

## Separate readiness, capture, CPU publication and presentation

1. `ticket.ready` means CPU content is ready. The active sequence and independent siblings continue while loading. The candidate initializes with rate zero, starts silently, then stores its configured rate while remaining paused. Initialization zero-time markers are consumed in the controller count without invoking the application listener. They are not replayed by resume; subsequent loop-zero markers retain ordinary semantics.
2. `ticket.capture(frameOptions)` opens a short final window and returns a genuine immutable candidate frame without changing the live tree. It pauses only a running affected predecessor. Complete this window promptly with commit or cancellation; there is no automatic deadline or global-clock pause. Host upload uses the separate existing `stageSharedFrame` API.
3. `ticket.commit()` validates the genuine prepared subtree and publishes the new active generation **paused at time zero**. It retires only an owned predecessor. An initial borrowed predecessor remains caller-owned and is left paused if it was running; the caller may dispose it and its resources when appropriate. A topology/content change or caller command after the slot's pause refuses publication. No active-controller rebind occurs.
4. Submit the separately staged Host ticket and await its completion. CPU publication, upload readiness, submission and settlement remain distinct. Post-publication cleanup or Host failure cannot roll back CPU publication. Read `ticket.state` to distinguish a committed candidate after a cleanup failure.
5. Explicitly call `slot.getActive().controller.resume()` to advance the new sequence. A configured zero rate must first be changed to a positive supported rate.

Cancellation or pre-publication failure disposes all candidate owners. It restores an old running controller only if the slot paused it and no later caller command changed its opaque command revision. An explicit caller pause, resume, seek, rate change or stop always retains authority. Already-paused initial controllers remain paused. Closing only the orchestration Scope still undoes its unchanged pause when the borrowed controller’s own Scope and Engine remain open. Refused reentrant stop/dispose calls do not invalidate a prepared candidate. Slot/Scope/Engine closure retires owned resources; borrowed initial content is never disposed by the slot. Cleanup attempts all independent owners even when a provider callback throws. Callbacks can close the slot, but request/capture/commit reentry is refused.

A completed, stopped or faulted controller retains only its weak original-target provenance for RESET admission. If its Bitmap and content remain valid, another RESET can replace it without restarting or rebinding that terminal controller. Cancellation can be called repeatedly. A captured frame retains the ordinary immutable-frame lifetime contract even after candidate cancellation or predecessor retirement.

## Compatible playback preservation

`slot.requestPreserving({version, loader, imageId, sequenceId})` carries a live sequence into a new resource generation. Both clips must originate from genuine ContentLoaders and have identical ordered frame boundaries. The images and regions can differ. Source provenance is checked before accepting a request. An untracked source or a different schedule fails with `SEQUENCE_RESET_PRESERVE_TIMELINE`, even when both clips have the same total duration. A controller must be running or paused with no pending commands. An ineligible playback state fails with `SEQUENCE_RESET_PRESERVE_STATE`.

At capture, the candidate samples its own image at the predecessor’s exact playback position. It inherits elapsed time, play index, rate, repeat count, marker definitions, listener and committed event count. Capture and publication emit no replacement events. Future markers and finite completion continue the event sequence. A running successor continues from the commit time on the Engine clock. A paused successor stays paused. The existing cancellation, command revision and resource ownership rules apply.

## Verification and limits

[Public behavior tests](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/sequence-reset.test.mjs) cover independent clocks, same-ID generations, silent zero markers, malformed/mismatched/foreign admission, content failure, cancellation, supersession, late completion, stale captures, caller-command ownership, shared capacity and cleanup. Strict positive/negative declaration fixtures use the built public entry; the default root exports no RESET factory.

The compatible replacement check ran on desktop Edge 157.0.4341.42 with six pixel checks on each of WebGPU and WebGL2. The fixture changes the atlas colors while keeping its frame schedule. It checks the old frame during loading, an independent clock advance while the candidate is staged, the preserved sample at presentation, the next marker’s original event sequence and resource retirement.

The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/sequence-reset/README.md) builds two real generations from original four-color PNG/atlas sources with different pixels and durations. Its finite collector uses genuine WebGPU and WebGL2 Hosts, exact RGBA endpoint references, canvas screenshots, separate staging/publication/submission and retained frame replay. Saved local results and final publication records are separate. No phone, IME, performance, physical memory, device recovery, preserve-path browser coverage or full M2.4 acceptance is implied.
