# Seeking a Spine instance

English | [简体中文](../../Cns/docs/spine-seek.md)

`instance.seek` moves the playback of a Spine instance to another elapsed time, backward or forward. It belongs to M2.2, [#84](https://github.com/cnedwin/Egret_rebuild/issues/84), and follows the staged-operation contract of the [M2 plan](m2-spine-content-plan.md).

## Public flow

```js
const ticket = instance.seek({ elapsedSeconds: 1.5 });
function slice() {
  if (!ticket.step()) return later(slice);   // your own scheduling; nothing runs by itself
  ticket.commit();
}
slice();
```

`seek` plans the move and returns a ticket. `step()` does one bounded slice of the work and returns true when the seek is ready. `commit()` replaces the playback of the instance and returns its new snapshot. Until then the instance is untouched: its snapshot, its display and its events are those of the playback it has. `cancel()` discards the prepared playback.

`elapsedSeconds` is the animation time the instance counts in `SpineInstanceSnapshot.elapsedSeconds`: the sum of every delta it accepted, after rate and pause.

## How the playback is rebuilt

The instance keeps what each accepted advance applied: its commands, then the time it added. A seek builds a second, private playback at the setup pose and time zero and applies those steps again, with the same segments of at most 1/60 second. Nothing is copied from the live pose, so tracks, mixes, queued entries, finite plays, skins, transform, rate and pause are all those of an honest run.

Which steps are replayed decides which moment the seek stands at:

- Every step that had ended by the target is replayed whole. At the end of a step the result equals, value for value, what that advance published.
- When the target falls inside a step, that step's commands are applied and it is advanced only as far as the target.
- A step that begins exactly at the target is not taken. Its commands were applied after that moment was published.
- When several steps ended at the same moment, for example ticks while paused, the seek stands where the last of them stood.
- Beyond the present there is no history. The seek advances in steps as long as an ordinary advance may be (`maxSegments` sixtieths, 8 by default) with no commands.

Time zero of an instance created directly is therefore its setup pose: its first commands were applied by its first advance. An instance made by the [reset slot](spine-reset-slot.md) had its animation applied at time zero, and seeks back to that.

A target within rounding of the end of a step is that end. Sums of the same deltas may differ in their last bits, and rounding alone must not decide whether the next commands are applied.

## Events

A seek delivers no event by default, backward or forward.

`events: 'replay'` asks a forward seek for the events after the current time up to the target, in the order the runtime queued them. They are collected while the seek is prepared and delivered only after it has succeeded: in the snapshot `commit()` returns and through `onEvent`. More than the limit fails the whole seek with `SPINE_INSTANCE_SEEK_EVENT_LIMIT`; no part of the batch is delivered. Events are never played backward: a backward seek with `'replay'` is refused.

## Bounds

The limits are fixed when the instance is created, under `seek` in its options. They are limits of work and memory, not measured performance.

| Option | Default | Most | Meaning |
| --- | ---: | ---: | --- |
| `maxSegments` | 3600 | 36000 | Segments one seek may replay in all. A plan beyond it is refused with `SPINE_INSTANCE_SEEK_LIMIT` before anything is staged. |
| `sliceSegments` | 120 | 3600 | Segments one `step()` replays. A slice ends before the step that would exceed it, and always takes at least one step. |
| `maxEvents` | 1024 | 8192 | Events one forward seek may replay. |
| `historyAdvances` | 3600 | 36000 | Advances kept as history. |
| `historyCommands` | 1024 | 8192 | Commands kept as history. |

When the history outgrows either bound it is dropped for good. Playback goes on, and every later seek is refused with `SPINE_INSTANCE_SEEK_HISTORY`. There is no checkpoint from which to rebuild a later moment. An instance that kept the playback of another through `requestPreserving` did not begin at the setup pose and has no history either.

## After the commit

- `elapsedSeconds` is the target and `revision` is one more. `tickId` and the clock time are unchanged: the next advance needs a later tick, as before.
- The history is the plan that was replayed. What came after a backward target is no longer the past of the instance.
- Commands issued and not yet applied still wait, and the next advance applies them.
- An attached display draws the new pose. A failure to draw or a failing listener is reported as for an advance, with the playback already committed.

One seek is prepared at a time: a second is refused with `SPINE_INSTANCE_SEEK_ACTIVE`. An advance of the instance cancels a seek in progress, because the seek was planned against the playback the advance left behind. Disposal cancels it too.

## Bringing back a faulted instance

A failure in the middle of an advance faults the instance, and it refuses to advance. Its history holds only the advances that succeeded, so a seek to the time it last published rebuilds that playback, and committing it clears the fault:

```js
const last = instance.getSnapshot();          // state: 'faulted'
const ticket = instance.seek({ elapsedSeconds: last.elapsedSeconds });
while (!ticket.step()) {}
ticket.commit();                              // state: 'running'
```

The commands of the failed advance are gone; issue them again if they are still wanted.

## Refusals

| Code | When |
| --- | --- |
| `SPINE_INSTANCE_SEEK_INVALID` | The target is not a finite time of zero or more, or `events` is not one of its two values |
| `SPINE_INSTANCE_SEEK_BACKWARD_EVENTS` | `events: 'replay'` with a target before the present |
| `SPINE_INSTANCE_SEEK_ACTIVE` | Another seek is in progress |
| `SPINE_INSTANCE_SEEK_HISTORY` | The history was dropped, or never began at the setup pose |
| `SPINE_INSTANCE_SEEK_LIMIT` | The plan needs more segments or more steps than the limits allow |
| `SPINE_INSTANCE_SEEK_EVENT_LIMIT` | A forward seek passed more events than it may replay |
| `SPINE_INSTANCE_SEEK_NOT_READY` | `commit()` before `step()` returned true |
| `SPINE_INSTANCE_SEEK_FAILED` | The replay or the publication failed; the cause is attached. The instance is as it was. |
| `SPINE_INSTANCE_SEEK_COMMITTED`, `_CANCELLED` | The ticket was used after it ended |

## Physics

A physics constraint makes the pose depend on every step that was simulated, not on the time alone: one loop of an animation later a bone that physics drags is somewhere else. The simulation also depends on how time is cut. An advance is cut into whole sixtieths with the short remainder last, so an advance of 0.04 second is exactly three advances of 1/60, 1/60 and the rest, and it is not three equal thirds. A seek is therefore only right if it cuts time as the run did, and it does: it replays the recorded steps under the same rule.

- A seek to the end of a step, or to a moment inside one, equals a straight run that stopped there, physics included. The run that continues from the seek equals the straight run.
- Beyond the present the seek advances in whole steps of sixtieths. A run that advanced in the same whole sixtieths stands in the same place.
- A paused instance simulates nothing: what physics drags hangs where it was, and no time passes.
- A new playback starts from rest. An instance made by the reset slot therefore starts as an instance created directly does, and a seek back to its time zero rebuilds exactly that.

## What was checked

[`packages/spine/test/seek.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/test/seek.test.mjs) has 20 cases on original numerical fixtures. A seek to the end of each step of two scripts, one of mixed commands and one of finite plays and queues, equals the straight run value for value. So does every seek of twelve random scripts, and the run that continues after it. The other cases cover a target inside a step, forward seeks with and without their events, slices, both budgets, the bounds of the history, cancellation, pending commands, fault recovery, the reset slot, and a display that follows the commit.

[`packages/spine/test/physics.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/test/physics.test.mjs) has six cases on an original fixture with one physics constraint: a tail that lags a swinging root. They show that the constraint is simulated and remembers what came before, pin the rule that cuts an advance, and compare seeks with straight runs: to the end of every step with the cut-off steps applied again, to a moment inside every step, forward beyond the present with its events, and through an instance made by the reset slot.

Forty-two faults were written into the built code one at a time and the seek tests caught thirty-eight. Two of the others release objects nobody can reach. One differs only at an exact coincidence of rounding. The last replays a reset step as an ordinary one.

Fourteen further faults were written into the lines that step physics. The seek tests alone caught three of them; the physics tests catch eight. The other six change nothing that can be observed: four replace the physics reset of a playback that is new and so already at rest, among them the last fault of the paragraph above, and two change the length of the whole steps a forward seek advances in, which the rule that cuts every advance into sixtieths makes immaterial.

## Open

- The physics fixture is original and has one constraint on one bone. No Editor export with physics and no independent reference renderer was used, so what is established is that a seek equals a straight run of this runtime, not that either matches the Editor.
- Official or authorized Spine exports were not used. The fixtures are original and numerical.
- A long-lived instance loses its history after 3600 advances by default. Checkpoints that would let it seek within a recent window are not implemented.
- Seeking is not connected to the sequence controls or to an editor timeline.
