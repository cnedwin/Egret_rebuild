# Sequence controls and committed events

English | [中文](../../Cns/docs/sequence-controls.md)

This profile extends sequence animation within M2.2. It adds independently controlled instances over the existing immutable clips, shared texture leases and Engine clock. Complete Spine playback, animation replacement and the complete M2.2 milestone remain open. The bounded sequence implementation has behavioral and actual desktop browser results described below; these do not establish performance or phone qualification.

## Use and ownership

The optional `@egret/engine/animation` entry exports `createSequenceController` and its TypeScript contracts. Create a controller from an authentic Engine, its open Scope, a genuine Bitmap and SequenceClip, with `profile: 'egret.sequence-control/1'`. Existing `SequencePlayer.applyAt`, `Engine.createSequencePlayback` and root exports retain their contracts. The optional controller and numerical implementation are absent from the default entry's runtime dependency graph.

Each controller owns playback state and borrows its exact target binding. Creation is idle and does not alter the Bitmap. New and legacy playback profiles share target claims: one live claim per Bitmap and at most 256 combined claims per Engine. A historical stopped handle cannot release a later claim. Direct Bitmap writes and independent SequencePlayer instances remain possible; the shared claims govern the two cooperating playback profiles only.

One lazy coordinator uses the genuine Engine clock for at most 64 new controllers. Its internal Scope belongs to the Engine, independently of application Scopes. Closing one application's Scope cannot remove another controller's clock registration. The last live controller releases that registration and internal Scope. Scope cancellation and Engine shutdown revoke pending delivery before ordinary reverse cleanup.

Terminal cleanup releases the claim, player borrow, callback, markers, queue and active owner references. The Bitmap and texture remain application-owned. Terminal handles retain only inert status and sample data. Scope may retain historical adopted handles until it closes; logical release does not prove physical garbage collection.

## Playback and seek

Use `start()`, `pause()`, `resume()`, `setRate(rate)`, `seek(request)`, `stop()`, `dispose()` and `getStatus()`. Methods require their original receiver. Status and event envelopes are immutable snapshots.

- `start()` applies time zero once. A positive rate enters running; zero enters paused. There is no restart operation on an existing handle.
- Rate is finite from 0 through 16, default 1. Setting zero pauses after settling the old running interval. Setting a positive rate while paused does not resume implicitly; call `resume()` afterward. Resuming with rate zero is refused.
- `totalPlays` defaults to 1 and counts all plays. It accepts an integer from 1 through 1,000,000, or `'infinite'`. Finite completion shows the final frame of the final play and releases the controller's active borrows.
- `seek({timeSeconds})` silently replaces absolute sequence time, resets the clock baseline and emits no events, including when it completes. Backward silent seek is supported.
- `seek({timeSeconds, replayEvents: true})` allows forward movement only and emits occurrences after the previous time through the requested time. A request beyond a finite endpoint is refused rather than clamped.
- Stop and dispose are immediate and idempotent. Completion, stop and fault are terminal; create another controller to replay. Stop does not invent final markers or completion events.

Ordinary running controls settle any interval since the last observed genuine clock time. This preserves an interval that an earlier public clock callback prevented the coordinator from receiving. Paused time and background wall time are not inferred. The public GameClock's own first-error and maximum-delta behavior remain unchanged.

## Events and callback ordering

Markers are separately authored controller metadata; they do not change the `egret.sequence/1` content format. Each marker has a unique ASCII ID matching `[A-Za-z][A-Za-z0-9_.-]{0,63}` and a finite time from zero through clip duration. At most 64 markers are retained. Equal-time markers preserve authored order and report their original index.

Start emits initial zero markers once. Ordinary movement emits occurrences in `(oldTime, newTime]`. At a shared cycle boundary, end markers from the ending play precede zero markers from the next play. At final finite completion, omit the nonexistent next play's zero markers and append one completion event. A silent seek consumes its destination boundary; a later advance cannot repeat that boundary's events.

The coordinator first prepares and commits all eligible controllers in creation order, then dispatches their committed event batches in that order. An invalid binding or listener on one new-profile controller does not stop unrelated new-profile controllers. This isolation does not suppress an error from an earlier unrelated public or legacy clock callback.

During any genuine clock callback or this profile's event/diagnostic delivery, ordinary controls enter a bounded queue. They become eligible strictly after the current clock tick. At that boundary, settle the old running interval first, then apply queued commands in order, publishing one final target sample. A queued pause therefore takes effect at the next boundary; use stop/dispose for immediate cancellation. Argument-getter reentry is refused rather than treated as a callback command.

Outside delivery, ordinary controls are synchronous. They cannot overtake queued commands: only a silent seek may replace that pending intent, with an `ANIMATION_COMMANDS_REPLACED` diagnostic. Stop/dispose discard pending work immediately. If normal advancement completes before queued controls, completion wins and reports `ANIMATION_TERMINAL_COMMAND`; the handle is never revived.

The listener must return `undefined`. Throws and other returns do not roll back committed pixels, time or delivered events. Remaining events continue unless disposal or cancellation revokes them. Rejected asynchronous returns are observed without awaiting. Diagnostic callbacks run after commitment under the same delivery guard; the first callback failure is reported once per affected controller boundary.

## Numeric and work limits

For duration D, cycle boundaries are the binary64 values `B(k) = k * D`. Bounded integer searches select the cycle and count marker occurrences. Exact computed boundaries map to local zero, except finite completion, which maps to the final play at local D. The profile never uses raw remainder or division as the cycle authority; it does not change the original loop sampler.

For example, with D = 0.2, time 1 is B(5) and selects play 5 at local zero. Literal 0.6 is less than B(3) = 0.6000000000000001 and remains inside play 2. There is no epsilon snapping. Unrepresentable interior positions or marker occurrences refuse before publication. Positive subnormal durations remain valid for representable admitted requests; a request beyond the cycle bound is refused before event expansion.

| Bound | Value |
| --- | --- |
| New controllers / combined target claims per Engine | 64 / 256 |
| Markers / copied ID bytes per controller | 64 / 4,096 |
| Rate | Finite 0–16 |
| Finite total plays | 1–1,000,000 |
| Clip duration and elapsed sequence time | Positive duration and nonnegative time, each at most 2 ** 32 seconds |
| Nonfinal cycle index | Less than 1,000,000 |
| Queued scalar commands per controller | 16 |
| Events per whole transition, including completion | 1,024 |
| Controllers / events per coordinator boundary | 64 / 65,536 |

Finite total duration must be positive, representable and within the time bound. Preflight safe event-sequence arithmetic even when no listener exists. Event counts are checked before allocation or target writes. The extreme admitted compound transition can perform 43,520 marker-search and 340 cycle-search iterations per controller, or 2,807,040 combined iterations across 64 controllers. These are finite work limits, not measured performance guarantees.

## Failure and publication

Pure planning stages the whole elapsed interval plus eligible commands. A successful transition writes the target once, then publishes status and its event batch. Prevalidation refusal changes neither the previous live presentation nor committed time/events; pending commands remain available for explicit recovery or replacement. The latest issue may change.

An invalid borrowed binding is terminal `faulted` with `ANIMATION_BINDING_INVALID`. An unexpected target apply failure is terminal `faulted` with `ANIMATION_APPLY_FAILED`. Neither publishes the failed transition's events or new controller time. Cleanup attempts all remaining releases and records its own failure separately. A retained sample does not restore a released texture, disposed Bitmap or externally replaced binding; those failures do not promise renderable old pixels. Previously captured immutable render frames retain their separate rendering contract.

## Verification and scope

The behavioral reference uses an original four-color shared atlas and two independently controlled instances. The acceptance matrix covers literal frame/time/event order, canonical non-binary duration boundaries, rate/pause/seek, old/new target claims, limits, cancellation, callback ordering and failure isolation. Actual WebGPU and WebGL2 checks additionally compare pixels, clipping and retained-frame replay without advancing playback. Current execution and result evidence must establish each claim before acceptance.

The [runnable example](../../../examples/sequence-controls/README.md) builds its original PNG/atlas/sequence inputs through the real content pipeline. The [saved result summary](../../../examples/sequence-controls/verification-summary.json) records Node 26.7.0, default headless Edge 155.0.4283.62 and Playwright 1.62.1 on Windows. WebGPU and WebGL2 each passed 15 fixed checks and 185 exact pixel comparisons across 11 scheduled transitions, with complete event records, decimal-boundary controls, failure isolation and a 96,000-byte retained-frame comparison. The collection retained 40 original RGBA and 28 PNG artifacts, frozen identities for 677 actual inputs, and successful source/snapshot integrity and cleanup observations. After controller retirement, all 256 public clock subscription slots were available and the 257th refused; all five owned leases were released. These are observed logical lifecycle and finite browser results, not physical memory or speed measurements.

This profile provides sequence controls. It does not qualify complete Spine, a universal animation scheduler, physical memory behavior, native phone input or frame-time targets. M1.2 full-dirty 10.3 ms against 8 ms remains open. See the [M2 plan](m2-spine-content-plan.md), [original playback contract](sequence-playback-contract.md), [clock contract](game-clock-contract.md) and [content build contract](content-build-pipeline.md).
