# Engine-owned explicit game clock

English | [简体中文](../../Cns/docs/游戏时间核心契约.md) · [Recorded evidence](game-clock-evidence.md)

Engineering preview **0.25.0** adds one Engine-owned clock for explicit game updates in seconds. The caller submits absolute source time; rendering remains a separate explicit operation. Construction, subscription and observation do not start a timer. The [evidence](game-clock-evidence.md) separates CPU behavior, types, source controls, complete core verification and delivery cutoffs. This timing foundation does not implement Tween, MovieClip, automatic sequence playback, browser background detection or complete animation.

## Public entry and ownership

Use the existing `@egret/engine` root and its two existing Engine factories. `EngineOptions.clock` is optional; `engine.clock` is a readonly service and `engine.advanceTime(sourceSeconds)` returns a tick or undefined. There is no public clock factory, constructor, dispose service, owner port or new package subpath.

The root adds six **type-only** names: `GameClockOptions`, `GameClockState`, `GameClockTick`, `GameClockHandler`, `GameClock` and `GameClockSubscription`. The clock and subscription types are opaque; structural lookalikes and proxies do not acquire runtime authority.

| Surface | Contract |
| --- | --- |
| `GameClockOptions.maxDeltaSeconds?` | Readonly finite number greater than 0 and at most 1; default 0.25. |
| `clock.state` | Readonly `running`, `paused` or `closed`. |
| `clock.elapsedSeconds`, `clock.tickId`, `clock.maxDeltaSeconds` | Readonly cached scalar observations; elapsed time and ID start at 0. |
| `clock.onTick(scope, handler)` | Authentic same-Engine Scope; distinct Scope-owned subscription. |
| `GameClockHandler` | `(tick: GameClockTick) => undefined`; synchronous only. |
| `clock.pause()`, `clock.resume()` | Explicit pause and fresh-baseline recovery. |
| `subscription.isDisposed`, `subscription.dispose()` | Readonly terminal observation and synchronous idempotent disposal. |
| `GameClockTick` | Fresh frozen record with readonly `tickId`, `elapsedSeconds`, `deltaSeconds`; no owner reference. |

Both factories preserve existing profile/renderer/diagnostic/timeout admission before new clock options, then validate the clock before surface reservation or startup. Unsupported profiles inspect no options. Read `options.clock` once and, for a non-null non-array object, read `maxDeltaSeconds` once. Undefined selects defaults; unrelated fields are ignored. The clock keeps its own frozen scalar snapshot. Invalid values or reads produce `CLOCK_OPTIONS_INVALID`, retaining a thrown cause, including a revoked Proxy's native error.

## Explicit use

An application supplies its existing HostAdapter. This example uses independently chosen source seconds; no wall clock or animation frame is read by the core.

```ts
import { createEngine } from '@egret/engine';
import type { HostAdapter } from '@egret/engine';

async function updateExplicitly(host: HostAdapter): Promise<void> {
  const engine = await createEngine({ host, clock: { maxDeltaSeconds: 0.25 } });
  try {
    const scope = engine.createScope();
    let gameSeconds = 0;
    engine.clock.onTick(scope, tick => {
      gameSeconds = tick.elapsedSeconds;
      return undefined;
    });
    engine.advanceTime(10); // baseline; no callback
    engine.advanceTime(10.125); // gameSeconds = 0.125
    engine.captureFrame({ width: 8, height: 8 }); // separate operation
    engine.clock.pause();
    engine.clock.resume();
    engine.advanceTime(20); // fresh baseline; gap excluded
    engine.advanceTime(20.125); // gameSeconds = 0.25
    void gameSeconds;
  } finally {
    await engine.dispose();
  }
}
```

## Source admission, pause and hitch recovery

A source sample must be a finite number greater than or equal to 0; -0 is normalized to +0. Engine lifetime and same-Engine phase guards precede numeric validation. Invalid or backward samples change no accepted floor, anchor, time, ID or listener. The first sample and an equal sample return undefined and invoke no callback.

While running, use ordinary binary64 `sourceSeconds - anchor`. Delta equal to the ceiling is accepted; a larger delta fails `CLOCK_DELTA_LIMIT` atomically. There is no clamp, subdivision, catch-up, rate scaling or implicit rebase. A positive accepted update prepares its tick/candidate snapshot and commits source, elapsed time and ID **before** callbacks. All reached callbacks and the caller see the same tick object. A later failure preserves that commit.

| Action | Outcome |
| --- | --- |
| `advanceTime(10)` | Baseline; elapsed 0, ID 0; no callback. |
| `advanceTime(10.125)` | ID 1, elapsed 0.125, delta 0.125. |
| `advanceTime(11)`; then `advanceTime(11.125)` | Both fail; the anchor stays 10.125. |
| `resume()` while running; `advanceTime(11.25)` | Resume is inert; oversized delta still fails. |
| `pause(); resume(); advanceTime(11)` | Fresh baseline; elapsed remains 0.125. |
| `advanceTime(11.125)` | ID 2, elapsed 0.25, delta 0.125. |

Paused samples still validate/update the accepted monotonic source floor, but produce no game update. Repeated pause/resume is inert. A resumed clock requires a fresh nondecreasing baseline; it does not erase the source floor. A caller that resets its source domain must maintain monotonic input or create another Engine. Host timeout milliseconds retain their existing lifecycle meaning and are not game seconds.

## Subscription order and cleanup

The fixed limit is **256 live subscriptions** per clock. Each registration is independent, including repeated use of the same handler. Admission checks Engine lifetime, same-Engine Scope identity, captured intrinsic Scope state, callable handler and capacity before publishing a handle. Public Scope overrides cannot replace that authority. The returned frozen handle is already owned by the supplied Scope; repeated same-Scope use deduplicates, while another Scope receives the existing ownership refusal.

A tick fixes candidates in registration order. A disposed candidate is skipped; a new registration waits for another tick. Reusing an empty slot cannot run the new handle through an old candidate. Handle disposal removes only that callback. Scope disposal uses its existing reverse cleanup order and never pauses the whole clock. Historical disposed handles can remain in Scope bookkeeping until Scope close; this is not a physical memory or heap bound.

A callback may pause or dispose the Engine. Pause stops later candidates without undoing the tick. `resume()` during active dispatch fails `CLOCK_REENTRANT`, even while still running. Same-Engine nested time advancement or time/frame crossing fails before reading new payloads; old frame-in-frame remains `FRAME_REENTRANT`. Another Engine is independent.

Engine disposal caches its shared Promise, enters closing and immediately closes the clock/retire handles. Scope → Stage → AssetManager → host cleanup waits until the active synchronous callback's finally barrier completes, in addition to the existing frame barrier. A forbidden callback Promise is not awaited. Cached time/state and handle disposal observations remain readable after shutdown; authentic clock mutators fail `ENGINE_CLOSED`. Synchronous user work cannot be preempted by the host-close deadline.

## Errors and explicit animation consumers

A thrown callback value stops later candidates, reports one engine/error diagnostic with `CLOCK_CALLBACK_FAILED` and retains the exact cause in the outer EgretError. A non-undefined return uses that outer code with a `CLOCK_CALLBACK_RETURN_INVALID` cause. Native Promise/thenable rejection observation is handled without awaiting; observation or diagnostic-observer failure cannot replace the primary error. Resubmitting the committed source does not replay failed candidates. A failing subscription remains until disposed.

Other named refusals include `CLOCK_SOURCE_INVALID`, `CLOCK_SOURCE_BACKWARDS`, `CLOCK_SCOPE_INVALID`, `CLOCK_HANDLER_INVALID`, `CLOCK_CALLBACK_LIMIT`, `CLOCK_INVALID` and `CLOCK_SUBSCRIPTION_INVALID`. Authentic closing/closed Scopes retain `SCOPE_CLOSED`; existing ownership refusals remain. Arithmetic and safe-sequence admission uses `CLOCK_TIME_RANGE`, `CLOCK_TICK_ID_EXHAUSTED` and `CLOCK_SUBSCRIPTION_ID_EXHAUSTED`; unreachable exhaustion is source-reviewed, not established by fabricated public state.

SequencePlayer remains an explicit consumer: a Scope may own the player and a subscription whose handler calls `player.applyAt(tick.elapsedSeconds)`, then returns undefined. The caller still owns the Bitmap and its exact resource lease. A separate backward `player.applyAt(0)` remains valid. Advance does not acquire resources or render, and capture/render does not advance the clock. See the [existing player contract](sequence-player-contract.md).

This first-party, AI-assisted timing slice follows Egret's recorded contracts without adding an external scheduler dependency. Code and documentation retain [Apache-2.0](https://github.com/cnedwin/Egret_rebuild/blob/main/LICENSE); existing dependencies keep their notices. Browser/OS drivers, full UI/Tween/skeletons/Spine, phones, Native SDKs, performance and complete legacy migration remain separate work.