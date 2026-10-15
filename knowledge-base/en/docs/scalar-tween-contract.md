# Scope-owned scalar Tween

English | [简体中文](../../Cns/docs/标量补间契约.md) · [Game clock](game-clock-contract.md)

Engineering preview **0.26.0**: one-shot scalar transitions in game seconds. Private manifests: **0.0.0**. Results/delivery are separate.

## Public entry and use

Built `@egret/engine` adds `engine.createTween(scope, options): Tween` and four **type-only** names: `Tween`, `TweenState`, `TweenOptions`, `TweenEasing`. The frozen opaque handle has no runtime constructor/static `get`, factory or subpath.

Readonly options: `from`, `to`, `durationSeconds`, required `onUpdate: (value: number) => undefined`, optional `easing`, `onComplete: () => undefined`. Easing: `linear` (default), `quadIn`, `quadOut`, `quadInOut`. Readonly observations: `state`, `isDisposed`, `elapsedSeconds`, raw `progress` in [0,1], `value`. Controls: `start/pause/resume/stop/dispose(): void`.

Use a HostAdapter; acquire writer resources first:

```ts
import { createEngine, Sprite } from '@egret/engine';
import type { HostAdapter } from '@egret/engine';

async function movePanel(host: HostAdapter): Promise<void> {
  const engine = await createEngine({ host });
  try {
    const scope = engine.createScope();
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(0x2753a1).drawRect(0, 0, 2, 2);
    engine.stage.addChild(sprite);
    const tween = engine.createTween(scope, {
      from: sprite.x, to: 100, durationSeconds: 1,
      onUpdate(value) { sprite.x = value; return undefined; },
    });
    tween.start(); // no write
    engine.advanceTime(0); // baseline; no write
    for (const t of [0.25, 0.5, 0.75, 1]) engine.advanceTime(t);
    // offers 25, 50, 75, 100; then completed
    engine.captureFrame({ width: 128, height: 8 });
  } finally {
    await engine.dispose();
  }
}
```

`from: sprite.x` runs before entry; Engine never discovers/rereads properties. The callback adapts the scalar. Capture/render never advances time; advancement never renders. After building: `node --test tests/tween.test.mjs`.

## Admission and states

Check open Engine, authentic same-Engine Scope, intrinsic open Scope state; public Scope/clock overrides cannot replace authority. Options must be a non-null non-array object. Read `from`, `to`, `durationSeconds`, `easing`, `onUpdate`, `onComplete` once in order; each success rechecks those lifetimes. Shape/read throws, including revoked Proxy errors, stop with exact cause in `TWEEN_OPTIONS_INVALID`. Successful reads closing a lifetime get its refusal first. Refusal publishes nothing.

Require finite endpoints (-0 becomes +0), finite binary64 `to-from`, finite positive duration without a day cap, callable callbacks. Invalid values: `TWEEN_OPTIONS_INVALID`; nonfinite difference: `TWEEN_RANGE_INVALID`. Ignore extra keys; retain scalars/callbacks, not options. Scope adopts idle without writing/subscribing; elapsed/progress start at 0, value at `from`. Same-Scope use deduplicates; takeover gives `OWNERSHIP_CONFLICT`.

Start admits a subscription before running/anchor; refusal leaves idle for retry. Idle pause/resume: `TWEEN_NOT_STARTED`; running/paused start: `TWEEN_ALREADY_STARTED`. Pause freezes the last offer; resume carries offered elapsed and anchors at current game elapsed. Repeated pause/resume is inert.

States: `idle`, `running`, `paused`, `completed`, `stopped`, `failed`. The last three are terminal (`isDisposed=true`); their start/pause/resume gives `TWEEN_TERMINAL`. Stop/dispose synchronously/idempotently stops unfinished work and preserves terminal results, without reset, final write or completion.

Receivers are checked (`TWEEN_INVALID`). Engine precedes callback reentry/state for start/pause/resume (`ENGINE_CLOSED` while closing/closed). Cached observations and stop/dispose survive closure.

## Time and interpolation

Running/paused each occupy one of **256 mixed clock registrations**; idle occupies none. No separate Tween/history bound. Start, paused and fresh-anchor ticks offer nothing.

Elapsed is fixed carried base plus whole `tick.elapsedSeconds-anchor`. Require finite delta; compare remaining duration before adding, selecting exact duration at the endpoint. Nonterminal elapsed must be finite/strictly increasing (`TWEEN_TIME_RANGE`). Offer once at most per reached running tick. Pause before its turn freezes the offer; resume discards unobserved time. After an earlier listener skips it by failing, sample current game elapsed next time without replay. Global pause/source/delta/hitch rules follow the [clock contract](game-clock-contract.md).

For raw `p=elapsed/duration`, easing is `p`, `p*p`, `p*(2-p)`, `p<0.5 ? 2*p*p : 1-2*(1-p)*(1-p)`, in listed order. Interior `from+(to-from)*easedP` must be finite before commit (`TWEEN_RANGE_INVALID`); endpoint is exact `to`. Equal endpoints update/complete over positive duration. No epsilon, custom easing, colors/vectors or angle wrapping.

Elapsed/progress/value commit **before** writing. Value records the offer, not setter success; errors preserve observations/side effects. Equal source never replays.

## Callbacks and lifetime

Callbacks are synchronous, returning only **undefined**. Throws keep exact cause in `TWEEN_UPDATE_FAILED`/`TWEEN_COMPLETE_FAILED`; other returns nest `TWEEN_CALLBACK_RETURN_INVALID` under that same Tween code. Promise/thenable rejections are observed, never awaited/accepted/cancelled. Observation/diagnostic-observer failure cannot replace the cause. Clock adds `CLOCK_CALLBACK_FAILED`, one engine/error diagnostic and stops later candidates; no extra Tween diagnostic.

Own callback start/pause/resume: `TWEEN_REENTRANT` after Engine guard; stop/dispose is allowed. Newly created/started Tweens wait for a later snapshot. Same-Engine time/frame reentry retains `CLOCK_REENTRANT`.

Final writer success requires running/open Engine/Scope to commit completed. Retire callbacks/subscription before local completion once; its failure preserves completed/final observations. Writer/arithmetic failure becomes failed unless already terminal. Terminal never revives. Final-writer stop/Scope/Engine close suppresses completion; Scope-closing ticks stop before writing.

Cleanup releases borrows, not targets. Synchronous Scope disposal may release resources before an own-Scope-closing writer returns; stop using them. Engine disposal shares one Promise, immediately stops idle/running/paused Tweens, then waits existing clock/frame barriers before Scope → Stage → assets → host cleanup. Forbidden Promises add no barrier. Stored borrows clear; active calls/history may remain, without GC/heap guarantees.

Forged/foreign Scope gives `TWEEN_SCOPE_INVALID`; authentic closing/closed gives `SCOPE_CLOSED`. Ownership/clock registration errors, including `CLOCK_CALLBACK_LIMIT`, retain their rules.

AI-assisted first-party work uses Egret contracts/scalar mathematics under [Apache-2.0](https://github.com/cnedwin/Egret_rebuild/blob/main/LICENSE) and retains the existing dependency set. Discovery/arbitration, chains/wait/call/loops, scheduling, full UI/skeletons/Spine, legacy compatibility and production performance remain separate. Convert legacy milliseconds to seconds.
