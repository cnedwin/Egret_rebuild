# Clock-driven sequence playback

English | [简体中文](../../Cns/docs/时钟驱动序列动画契约.md)

Status: design and product source, build, public CPU behavior, standalone and complete strict types, source-policy controls, the CPU example and the bounded native Canvas/WebGPU opaque subset have accepted records for the 0.44.0 work package. At that original acceptance cutoff, internal injected-runtime fault controls, full prepush and delivery were pending. See the [verification record](sequence-playback-evidence.md) for each lane's scope.

Use the public headless example (`examples/sequence-playback-headless.mjs`) after the normal build: `node examples/sequence-playback-headless.mjs`. It demonstrates explicit-clock command capture; browser rendering is verified separately.

## Purpose and public API

`Engine.createSequencePlayback` connects an existing `SequenceClip` and `Bitmap` to the Engine's explicit game clock. It reuses `SequencePlayer` for frame selection, crop admission and exact resource binding. The caller continues to load resources, submit source time and render frames.

The `@egret/engine` root adds three type-only names and one Engine instance method. It adds no standalone factory, runtime class, package entry or dependency.

```ts
type SequencePlaybackState = 'idle' | 'running' | 'paused'
  | 'completed' | 'stopped' | 'failed';
interface SequencePlaybackOptions {
  readonly mode?: SequencePlaybackMode;
}
interface SequencePlayback extends Disposable {
  readonly state: SequencePlaybackState;
  readonly isDisposed: boolean;
  readonly elapsedSeconds: number;
  readonly lastSample: SequenceSample | undefined;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}
// Member of Engine; the actual declaration also carries a private nominal brand.
createSequencePlayback(scope: Scope, bitmap: Bitmap, clip: SequenceClip,
  options?: SequencePlaybackOptions): SequencePlayback;
```

Use a genuine Scope from the same Engine and a Bitmap holding a manager-issued lease for a full-image Texture. Clip atlas dimensions must match the image. Construction produces a frozen idle handle with elapsed time zero and no sample; it does not change the crop, subscribe, acquire an asset or render. The default mode is `once`; `loop` uses the existing sampler's binary64 wrapping behavior.

Options accept undefined or a non-null, non-array object. Mode is read once; inherited mode is allowed and unrelated fields are ignored. The options object is not retained. Existing player validation still determines Bitmap, lease, Texture, mode, clip and atlas errors in its established order.

## State and time

| Operation | Behavior |
| --- | --- |
| `start()` | Idle only. Reserve a real clock subscription, then apply time zero. Capacity refusal leaves the handle idle and the crop unchanged. Successful application enters running. |
| `pause()` | Running becomes paused and releases its live clock subscription. Time and sample stay at the last successful application. Repeated pause is inert; idle refuses. |
| `resume()` | Paused reserves a fresh subscription and reapplies the held time, rechecking the exact resource binding. Success anchors a new running segment at current game time. Capacity refusal leaves it paused. Repeated resume while running is inert; idle refuses. |
| Clock tick | Apply at most once at the current playback time. Crossed frames are not replayed. Commit handle time and sample only after the existing player successfully commits the crop. |
| Once completion | Apply the exact clip duration and retain the final frame. Enter completed, release the subscription and retire internal borrows. |
| `stop()` / `dispose()` | Synchronous, idempotent and terminal. Preserve the crop and last owned sample. Completed and failed identities stay unchanged. |

Terminal states report `isDisposed === true`. Observations remain readable after shutdown; start, pause and resume cannot revive a terminal handle. Replaying requires a new handle. Explicit seeking, including backward application, remains available through the separate `SequencePlayer.applyAt` API.

Running segments use a fixed held-time base plus elapsed game time since the segment's anchor. They do not add the full anchored interval repeatedly. Local pauses exclude the pause gap even while other clock consumers continue. Whole-clock pause/resume retains the game clock's fresh source-baseline rule. The default 0.25-second clock ceiling and configurable maximum of 1 second remain unchanged; playback does not clamp or subdivide source deltas.

Clock dispatch keeps its existing candidate snapshot and registration order. A handle started or resumed during a tick waits for a later tick. An earlier callback may pause a later playback candidate before it executes; resume does not replay that omitted update. Equal source time invokes no tick. Capturing, rendering and replaying a saved frame do not advance animation.

## Ownership, capacity and cleanup

A Scope owns the control handle and one internal authentic player. Register caller-owned resources in lease → Bitmap → playback order so reverse cleanup stops playback first. Playback borrows the existing exact lease; it never acquires or releases that lease, disposes the Bitmap or Texture, invalidates the asset manager, or restores an earlier crop.

Each Engine allows at most 256 live idle/running/paused handles and one live playback per Bitmap. These are explicit engineering limits, not measured memory or UI-scale claims. Idle and paused handles retain their target claim. Running handles also consume the game clock's shared 256 live subscription slots. Stop, completion and failure release the target claim and owner slot; old historical Scope cleanup cannot remove a newer handle's claim.

Engine closing synchronously retires all live playbacks before its existing clock and cleanup barriers finish. Scope cancellation prevents a still-pending playback callback from applying another crop. Retired records drop the internal player, target, clip, subscription and live-owner borrows; the last immutable sample contains only regions and scalars. Scope bookkeeping and lifecycle authority may remain. This is not a claim of physical GC, bounded historical records or immediate GPU retirement.

The internal player receives a sealed own cleanup operation before Scope adoption. Later replacement of public `SequencePlayer` prototype methods cannot substitute the private player's application or historical cleanup path. Public player instances and the original Scope/player algorithms remain unchanged. Pre-import replacement of language intrinsics and arbitrary process isolation are outside this boundary.

## Failures

Handle observations and methods authenticate their receiver. Start/pause/resume then check Engine lifetime, authentic Scope state, operation reentry, terminal state and allowed state. Stop/dispose remain usable during closing and an active operation; terminalization wins over later return or failure.

New refusals include `SEQ_PLAYBACK_INVALID`, `SEQ_PLAYBACK_SCOPE_INVALID`, `SEQ_PLAYBACK_OPTIONS_INVALID`, `SEQ_PLAYBACK_CREATION_REENTRANT`, `SEQ_PLAYBACK_REENTRANT`, `SEQ_PLAYBACK_LIMIT`, `SEQ_PLAYBACK_TARGET_BUSY`, `SEQ_PLAYBACK_NOT_STARTED`, `SEQ_PLAYBACK_ALREADY_STARTED`, `SEQ_PLAYBACK_TERMINAL` and `SEQ_PLAYBACK_TIME_RANGE`. Existing Scope, Engine, clock, player and resource errors retain their codes and original causes.

Successful options reads recheck lifetime; a throwing getter retains its wrapped exact cause, including undefined, before its lifecycle side effects are considered. Recursive creation by the same owner refuses before reading the recursive payload. A changed or cleared Bitmap lease refuses even if a replacement lease names the same Texture.

Start/resume application failure retires the handle and throws the original player cause. Tick application failure retires it first; the existing clock reports its single `CLOCK_CALLBACK_FAILED` diagnostic and wrapper. Already committed game time is not rolled back and an equal source sample does not replay the failed update. Secondary cleanup errors do not replace an existing primary refusal. No new application callback or Promise-return contract is introduced.

## Verification and scope

The independent oracle uses an original 6×2 atlas: red 2×2, green 1×2 and blue 3×1 crops with durations 0.125, 0.25 and 0.125 seconds. Literal boundaries, paused gaps, real capacities, resource identity, dispatch order, prototype capture and cleanup are separate controls. Missing aliases, modules or host setup cannot qualify as the named missing-capability test.

The paired verification record holds actual counts and environment identities at each execution cutoff. Existing explicit-player browser evidence is historical and does not accept this new controller. New browser observations must exercise genuine clock-driven once/loop playback, pause recovery and saved-frame replay through public Canvas/WebGPU entries.

Labels, frame events, playback rate, finite loop counts, seek/reset, trimmed or rotated atlases, complete UI, skeleton integration, full Spine support and complete legacy MovieClip migration retain separate contracts and acceptance. No performance, phone, native SDK or third-party license conclusion follows from this work package.

This is first-party, AI-assisted Egret code and documentation under Apache-2.0, developed against the project's existing clip, player, resource, clock and lifecycle contracts. Existing dependency notices and research attribution remain applicable to the reused materials.
