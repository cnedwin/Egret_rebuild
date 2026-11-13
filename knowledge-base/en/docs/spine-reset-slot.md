# Spine asset RESET slot

English | [中文](../../Cns/docs/spine-reset-slot.md)

This bounded M2.4 increment replaces one Spine display with a new asset version using an explicit **reset** policy. Loading, semantic preparation and cancellation keep the active player and display intact. CPU publication uses the existing genuine prepared-subtree transaction. GPU staging, submission and completion remain separate application operations. A second request, [`requestPreserving`](#keeping-the-playback), keeps the playback across the replacement. This is not complete M2.4 or recovery.

## Public flow

The optional built `@egret/spine` entry adds `createSpineResetSlot` and six erased types: `SpineResetInitial`, `SpineResetRequest`, `SpineResetState`, `SpineResetActive`, `SpineResetTicket` and `SpineResetSlot`. Default Engine imports and the DOM/Node-free dependency direction remain unchanged.

~~~js
const slot = createSpineResetSlot(engine, owner, target, {
  version: 'first', instance: oldPlayer, display: oldDisplay,
});
const request = slot.request({
  policy: 'reset', version: 'second', loader: nextLoader,
  assetId: 'e_character', animation: 'walk', skins: ['default'], plays: 2,
  onEvent: event => consumeGameplayEvent(event),
});
await request.ready; // CPU assets and reset pose, not upload readiness
const frame = request.capture({width: 640, height: 360});
const upload = host.stageSharedFrame(frame);
try {
  await upload.ready;
  request.commit(); // CPU publication; owned predecessor retires here
  const submitted = upload.submit();
  await submitted.completed;
} catch (error) {
  upload.dispose();
  request.dispose(); // inert after commit; cannot roll back issued drawing
  throw error;
}
// The application passes subsequent genuine Engine ticks explicitly.
slot.getActive().instance.advance(tick);
~~~

Target is a genuine ordinary same-Engine container attached to Stage, directly Scope-owned, with exactly the initial genuine display node as its sole child. Initial display and instance must match and be live. Put shared placement/clip/opacity on target; reset does not copy old display-node transforms or playback controls. Only one slot may claim a target. External topology changes refuse subsequent use. The underlying prepared-subtree admission remains authoritative, including its managed UI, overlap and ownership restrictions.

A request requires the literal policy `reset`, an application version label of 1–128 characters, a genuine same-Engine loader, an asset ID of 1–512 characters and an exact animation name of 1–1024 characters. Both the root loader and the genuine browser loader are admitted; structural facades are refused. The label is only display metadata: it never identifies a cache entry, grants resource ownership or substitutes for a Host generation. Genuine loader/asset identities determine resources.

This fixed profile starts track zero with the requested animation. Optional `skins` contains 1–32 distinct exact names; omission selects implicit default setup. `loop` and `plays` retain existing playback admission; plays is 1–1024, cannot be combined with loop, and zero-duration animations accept one play. Unknown names are refused after loading and before active publication. No other controls, track history, queues, rate, pause or seek state are preserved. Newly created players retain the ordinary default segment/event limits. Options use own data descriptors; malformed or reentrant admission does not supersede a valid accepted request.

## Time, events and the final window

Private pristine-instance initialization applies selected skins and the animation at time zero, evaluates the reset pose and consumes Core's initial cursor. It supplies no synthetic GameClockTick and installs no clock subscription. Start and any authored event or completion at preparation time zero are suppressed and never replayed. A zero-duration one-play candidate has already consumed its completion. Finite positive-duration playback starts with zero completed plays. The first later explicit advance accepts a higher caller tick ID and consumes that tick's delta normally; no old time is consumed and no catch-up delta is invented. Existing ordinary instance playback/event behavior is unchanged.

`ready` means the candidate group, semantic pose and detached display are ready. The old target can continue ticking during slow loading. `capture` opens the bounded final window by calling `Engine.prepareDisplaySubtree` and `Engine.capturePreparedDisplaySharedFrame`. It returns a genuine immutable shared frame and may succeed only once per request. Candidate preparation emits no gameplay callbacks. Old target content/animation or recorded ancestry changes after capture invalidate CPU commit; unrelated sibling content may continue. The application chooses the brief target-specific clock policy for this window. There is no automatic global pause.

A failed capture closes the candidate; a stale commit leaves the old active content intact and the request prepared until disposed. Cancel and request again to obtain a fresh snapshot. Captured frames remain ordinary snapshots, including after cancellation or retirement. The slot never promises that a later live sibling pose matches an earlier captured frame.

## Ownership and cancellation

The slot borrows target, initial player/display/group, supplied Scope and every supplied loader. It never disposes any of those borrowed objects. Each accepted candidate gets a fresh Engine Scope containing its newly loaded group, instance, display and CPU ticket. There is at most one current pending candidate per slot. A newly accepted intent cancels the previous candidate; invalid admission preserves it. Late asynchronous settlement can clean only its own candidate and cannot publish over the latest intent. Existing loader group, instance, source and asset-manager capacity limits still bound shared demand; there is no second manager or scheduler.

After a successful CPU commit, the new active reference and ticket state become committed before cleanup callbacks. A previous slot-owned Scope closes automatically. The initial borrowed predecessor remains live for its caller to retire. Shared consumers retain their own group leases; existing immutable frame/page and Host retention permit retained-frame replay after owned retirement. No public retired-generation queue accumulates.

Ordinary provider or listener cleanup failures follow existing Engine cleanup diagnostics; they do not roll back the committed active state. A diagnostic observer may dispose the slot; reentrant replacement admission during publication/cleanup is refused. An unexpected escaping postcommit cleanup failure reports `SPINE_RESET_POSTCOMMIT_FAILED` while the ticket remains committed. Do not retry that CPU commit or replay gameplay events. Asynchronous precommit cleanup failures retain the original cause and settle readiness without leaving an ignored rejected promise.

Ticket states are loading, ready, prepared, committed, cancelled and failed. Ticket disposal is idempotent, cancels only an uncommitted request and never cancels a separate Host upload. Slot/owner closure cancels pending demand and retires current owned content; the initial borrowed content stays caller-owned. Closing a borrowed loader/group separately still has its original authority to retire its instances.

## Keeping the playback

`slot.requestPreserving({version, loader, assetId, onEvent?})` replaces the asset and keeps what the player is doing. The ticket is the same as for `request`: `ready`, one `capture`, `commit`, `dispose`. Everything in this page about loading, the final window, ownership, cancellation and the Host applies unchanged. Only what the candidate starts with differs.

**What is carried.** On every track, the animation that is playing, the animations it is still mixing out of, and the animations queued behind it, each with its position, loop or remaining plays, delay and mix duration. A mix under way goes on from where it stands: how far it has come, the direction each mixed rotation turns, and what an entry holds against the one that follows it. Also the selected skins, the rate, pause, the placement set by `setTransform`, and the tick the player last took. The new player's snapshot has the tracks, skins, rate, state, tick and elapsed time of the old one. Its revision is the old one's plus one, and its events are empty.

**What the new asset must match.** Each carried animation, including one that is only being mixed out of, must exist under the same name, with the same length and the same events at the same times under the same names. Each selected skin must exist under its name. Nothing else is compared: bones, slots, attachments, the motion itself, the values an event carries and every animation that is not playing or queued may differ. An asset that cannot continue the playback fails the request with `SPINE_RESET_PRESERVE_ANIMATION` or `SPINE_RESET_PRESERVE_SKIN`, and the active player stays.

**When the playback is taken.** In the final window, at `capture`. The player may advance, and change what it plays, while the candidate loads; the candidate takes up where the player stands when it is captured. An asset is judged against the playback twice: when it has loaded, so that a hopeless request fails early, and again at `capture`, which decides. A failed `capture` closes the candidate, as for reset.

**When playback cannot be carried.** Between two advances only. A player with a command that has not been applied, or a fault, refuses the request with `SPINE_RESET_PRESERVE_STATE` before it is accepted, and an accepted request fails with it at `capture` if the player is in such a state then. A refused request does not replace a pending one. Request again after the next advance.

**Events.** Nothing the old player delivered is delivered again: not the start of an animation that is already playing, not an event behind its position, not a completed loop. The new player's first advance continues from the carried position and delivers what lies ahead, to the listener of the request. An event carries the values the new asset authored for it. The old player's listener receives nothing more unless the application keeps advancing that player.

**Not carried.** Physics constraints start from their reset pose. What an animation that has ended left on a bone or a slot is not carried: the new player is posed by what is playing and mixing. The mixing tables of an entry are rebuilt by the runtime for the new skeleton, except the holds an entry was told to keep, which are carried.

The preserved player is checked against the player it replaces. `packages/spine/test/preserve.test.mjs` advances both with the same ticks and commands, the original on the old asset and the copy on the new one, and requires equal tracks and equal events at every tick: after a replacement at each of 28 positions around events and loop ends, and across 16 random runs of 260 steps with repeated replacement in both directions, mixes included. An equal asset must also give the original's bone and slot poses. For mixes that is checked tick by tick: seven kinds of mix (one, one that interrupted another, three at once, a turn the long way round, two tracks with a queue, a hold kept after the oldest entry has gone, a mix to nothing), each replaced at nine moments from its first tick to after its end, with 50 ticks compared after each and another mix begun on the way; and a mix replaced at every one of 40 ticks, each copy made from the copy before it. Twenty faults written into the built code of this path: nineteen caught, and the other drops a value the pose application works out again. [`examples/spine-reset`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/spine-reset/README.md) has the action in a page; its `verify-preserve.mjs` passed nine checks on WebGL2 in headless Chromium 153 with software rendering on 2026-11-14, among them that the new version is drawn where a body that kept its time is, and not where one that began again would be. **WebGPU, a hardware GPU and phones have not been run for this path**: the software WebGPU adapter of that machine loses its device when this example starts, with or without this change.

## Host cutoff and verification

Only a genuine Host upload ticket proves its own readiness and actual device generation. Neither CPU readiness nor CPU commit presents pixels. Native submit may throw after issuing draws, so no rollback-on-any-submit-failure guarantee exists. The application disposes unused uploads and distinguishes upload readiness, CPU commit, submit and completion. The bounded [application recovery flow](spine-recovery-integration.md) now coordinates actual Host loss and replacement intent without resetting the active CPU player. The CPU slot itself owns no device recovery or cross-domain atomicity. Atomic multi-slot replacement and complete M2.4 remain OPEN. State-preserving replacement is [available](#keeping-the-playback) for playback that is not mixing.

The [ordinary two-version example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/spine-reset/README.md) uses original programmatic geometry and native transport/PNG decoding. On 2026-11-04, 22 new public behavior cases cover lifecycle, exact-name refusal, latest intent, old pose/event retention, shared siblings, stale snapshots, silent zero-time/finite initialization and cleanup reentry. Five unsuppressed strict ES-only type refusals retain their exact diagnostic positions/codes after fresh positive baselines. Default headed Edge 156.0.4314.58, Playwright 1.62.1 and Node 26.7.0 passed both WebGPU and WebGL2: five literal pixel points per image, one-channel-value tolerance, cancellation/failure/staleness, separate CPU/Host publication, owned retirement, retained replay, wrong-version refusal and complete logical cleanup. See the portable example summary for artifact identities and actual counts.

Earlier browser attempts remain recorded: default heading margins produced a fractional canvas origin and a 49-pixel screenshot instead of 48; explicit integer layout fixed the example. The initial stale demonstration awaited Host idle while holding an upload, causing its genuine ten-second expiry. It now advances CPU only, observes stale refusal, disposes the upload, then presents. These are retained failed observations, not passing results.

Source, focused execution, actual browser evidence, independent review, complete protected CI and main delivery are separate. Stable licensed Editor exports, complete physics/constraint/event qualification, native/phone acceptance and M1.2 performance remain OPEN. M1.2's 10.3 ms against the 8 ms target is unchanged. Adapter, checks, docs and geometric fixtures are independently authored with AI assistance under Apache-2.0; the existing separately licensed Core 4.3.13 and original license remain unchanged.

## Application recovery integration

The [ordinary recovery flow](spine-recovery-integration.md) now coordinates this CPU-only slot with existing genuine Host generation tickets. This adds bounded application recovery without extending the slot or promising cross-domain rollback; complete M2.4 remains OPEN.
