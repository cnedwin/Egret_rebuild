// SPDX-License-Identifier: Apache-2.0
// Core performs animation semantics; Egret owns time admission and publication.
import * as Core from '@esotericsoftware/spine-core';
import { EgretError } from '@egret/engine';
import type { GameClockTick, Scope } from '@egret/engine';
import type { SpineAsset } from './types.js';
import type { SpineInstance, SpineInstanceOptions, SpineInstanceSnapshot, SpinePlaybackEvent, SpinePlaybackEventKind, SpineAnimationOptions, SpineQueuedAnimationOptions, SpineSeekRequest, SpineSeekState, SpineSeekTicket } from './instanceTypes.js';
import { requireSpineAsset } from './assetAuthority.js';
import { registerSpineRender } from './renderAuthority.js';
import type { SpineDrawSink, SpineDrawCandidate, SpinePreservedEntry, SpinePreservedPlayback } from './renderAuthority.js';

const freeze = Object.freeze;
const MAX_COMMANDS = 256, MAX_ENTRIES = 128, MAX_TRACKS = 16;
type Command = { kind: 'animation'; track: number; name: string; loop: boolean; plays: number | undefined; mix: number; delay: number; append: boolean }
  | { kind: 'clear'; track: number } | { kind: 'skin'; names: readonly string[] }
  | { kind: 'transform'; x: number; y: number; scaleX: number; scaleY: number }
  | { kind: 'rate'; value: number } | { kind: 'paused'; value: boolean };
/** What one accepted advance applied: the commands it took, then the animation time it added. */
type HistoryRecord = { readonly kind: 'advance' | 'reset'; readonly delta: number; readonly commands: readonly Command[] };
type Policy = { plays: number | null; completed: number; finite: boolean; duration: number; nextBoundary: number; nextPlay: number; restart: boolean };
/** One playback: Core's objects and what this adapter keeps beside them. */
interface World {
  readonly skeleton: Core.Skeleton; readonly state: Core.AnimationState;
  readonly entries: Set<Core.TrackEntry>; readonly playback: Map<Core.TrackEntry, Policy>;
  readonly skins: readonly string[]; readonly rate: number; readonly paused: boolean; readonly events: SpinePlaybackEvent[];
}
const segmentsOf = (delta: number): number => delta === 0 ? 0 : Math.ceil(delta * 60);
function fault(code: string, cause?: unknown): EgretError { return new EgretError('SPINE_INSTANCE_' + code, { cause }); }
function refuse(code: string): EgretError { return new EgretError('SPINE_RESET_PRESERVE_' + code); }
// Every scalar of a track entry's position. Links between entries and the mixing tables are rebuilt, not copied.
const ENTRY_VALUES = ['loop', 'additive', 'reverse', 'shortestRotation', 'keepHold', 'eventThreshold', 'mixAttachmentThreshold', 'alphaAttachmentThreshold', 'mixDrawOrderThreshold',
  'animationStart', 'animationEnd', 'animationLast', 'nextAnimationLast', 'delay', 'trackTime', 'trackLast', 'nextTrackLast', 'trackEnd', 'timeScale', 'alpha', 'mixTime', 'mixDuration', 'totalAlpha'] as const;
/** The authored events of an animation in order, as time and name alternating. */
function eventSchedule(animation: Core.Animation): (number | string)[] {
  const schedule: (number | string)[] = [];
  for (const timeline of animation.timelines) if (timeline instanceof Core.EventTimeline) for (const event of timeline.events) schedule.push(finite(event.time), text(event.data.name));
  return schedule;
}
function number(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
// Vendor JSON fields remain untrusted until copied into the public primitive-only view.
function text(value: unknown): string { if (typeof value !== 'string') throw fault('OUTPUT_INVALID'); return value; }
function finite(value: number): number { if (!Number.isFinite(value)) throw fault('OUTPUT_INVALID'); return value; }
function record(value: unknown, keys: readonly string[], open: () => void): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw fault('OPTIONS_INVALID');
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const names = Reflect.ownKeys(value); open();
  for (const key of names) {
    if (typeof key !== 'string' || !keys.includes(key)) throw fault('OPTIONS_INVALID');
    const descriptor = Object.getOwnPropertyDescriptor(value, key); open();
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw fault('OPTIONS_INVALID');
    result[key] = descriptor.value;
  }
  return result;
}

/** Independent semantic playback over a genuine, live setup asset. No render authority escapes. */
export function createSpineInstance(asset: SpineAsset, scope: Scope, options?: SpineInstanceOptions): SpineInstance {
  const port = requireSpineAsset(asset);
  port.authenticate(scope);
  const reopen = (): void => { port.assertOpen(); port.authenticate(scope); };
  const settings = options === undefined ? {} : record(options, ['maxSegments', 'maxEvents', 'onEvent', 'seek'], reopen);
  const seekSettings = settings.seek === undefined ? {} : record(settings.seek, ['maxSegments', 'sliceSegments', 'maxEvents', 'historyAdvances', 'historyCommands'], reopen);
  // Checked just below, before any of them is used as the number it is declared to be.
  const seekSegments = (seekSettings.maxSegments ?? 3600) as number, sliceSegments = (seekSettings.sliceSegments ?? 120) as number, seekEvents = (seekSettings.maxEvents ?? 1024) as number;
  const historyAdvances = (seekSettings.historyAdvances ?? 3600) as number, historyCommandLimit = (seekSettings.historyCommands ?? 1024) as number;
  for (const [value, most] of [[seekSegments, 36000], [sliceSegments, 3600], [seekEvents, 8192], [historyAdvances, 36000], [historyCommandLimit, 8192]] as const)
    if (!Number.isSafeInteger(value) || !number(value, 1, most)) throw fault('OPTIONS_INVALID');
  const maxSegments = settings.maxSegments ?? 8, maxEvents = settings.maxEvents ?? 1024;
  if (!Number.isSafeInteger(maxSegments) || !number(maxSegments, 1, 120) || !Number.isSafeInteger(maxEvents) || !number(maxEvents, 1, 8192)
    || settings.onEvent !== undefined && typeof settings.onEvent !== 'function') throw fault('OPTIONS_INVALID');
  const eventLimit = maxEvents as number;
  let listener = settings.onEvent as ((event: SpinePlaybackEvent) => void) | undefined;
  port.assertOpen(); port.authenticate(scope);
  const info = port.getSetup().info;
  let skeleton: Core.Skeleton | undefined, state: Core.AnimationState | undefined;
  let disposed = false, faulted = false, busy = false, admitting = false, dispatching = false, paused = false, rate = 1;
  let revision = 0, tickId = 0, elapsedSeconds = 0, clockElapsed = 0;
  let unown: (() => void) | undefined;
  let drawSink: SpineDrawSink | undefined;
  let commands: Command[] = [], events: SpinePlaybackEvent[] = [];
  let skins: readonly string[] = freeze([]);
  let entries = new Set<Core.TrackEntry>();
  let playback = new Map<Core.TrackEntry, Policy>();
  // A seek prepares a second playback beside this one. The functions below act on whichever is entered.
  // 'quiet' keeps no event while history is replayed; 'collect' gathers the events a forward seek asked for.
  let capturing: 'live' | 'quiet' | 'collect' = 'live';
  // What was applied, in order, from the setup pose. Dropped for good once it outgrows its bounds.
  let history: HistoryRecord[] | undefined = [], historyCommands = 0;
  let seeking: { cancel(): void } | undefined;
  function alive(): void { if (disposed) throw fault('DISPOSED'); port.assertOpen(); }
  function assertOpen(): void { if (disposed) throw fault('DISPOSED'); if (faulted) throw fault('FAULTED'); port.assertOpen(); }
  function admit(): void { assertOpen(); if (admitting || busy && !dispatching) throw fault('REENTRANT'); }
  function inputRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (admitting) throw fault('REENTRANT');
    admitting = true;
    try { return record(value, keys, assertOpen); }
    finally { admitting = false; }
  }
  function enqueue(command: Command): void { admit(); if (commands.length >= MAX_COMMANDS) throw fault('COMMAND_LIMIT'); commands.push(command); }
  function track(value: number): void { if (!Number.isSafeInteger(value) || value < 0 || value >= MAX_TRACKS) throw fault('TRACK_INVALID'); }
  function capture(kind: SpinePlaybackEventKind, entry: Core.TrackEntry, event?: Core.Event): void {
    // A playback that a seek is preparing is not the one that faulted.
    if (disposed || faulted && capturing === 'live') return;
    if (kind === 'dispose') { entries.delete(entry); playback.delete(entry); }
    if (kind === 'complete') { const policy = playback.get(entry); if (policy) policy.completed++; }
    if (capturing === 'quiet') return;
    if (capturing === 'collect' ? events.length >= seekEvents : events.length >= eventLimit) throw fault(capturing === 'collect' ? 'SEEK_EVENT_LIMIT' : 'EVENT_LIMIT');
    if (event && !Number.isSafeInteger(event.intValue)) throw fault('OUTPUT_INVALID');
    const row: SpinePlaybackEvent = freeze({ kind, track: entry.trackIndex, animation: text(entry.animation?.name ?? ''), trackTime: finite(entry.trackTime),
      ...(event ? { event: freeze({ name: text(event.data.name), time: finite(event.time), intValue: event.intValue, floatValue: finite(event.floatValue), stringValue: event.stringValue === null ? null : text(event.stringValue) }) } : {}) });
    events.push(row);
  }
  const coreListener = { start: (entry: Core.TrackEntry) => capture('start', entry), interrupt: (entry: Core.TrackEntry) => capture('interrupt', entry), end: (entry: Core.TrackEntry) => capture('end', entry),
    dispose: (entry: Core.TrackEntry) => capture('dispose', entry), complete: (entry: Core.TrackEntry) => capture('complete', entry), event: (entry: Core.TrackEntry, event: Core.Event) => capture('event', entry, event) };
  /** A playback at the setup pose, at time zero. */
  function createWorld(): World {
    const fresh = new Core.Skeleton(port.getSetup().data), animation = new Core.AnimationState(new Core.AnimationStateData(fresh.data));
    animation.addListener(coreListener);
    fresh.updateWorldTransform(Core.Physics.reset);
    return { skeleton: fresh, state: animation, entries: new Set(), playback: new Map(), skins: freeze([]), rate: 1, paused: false, events: [] };
  }
  function hold(): World { return { skeleton: skeleton!, state: state!, entries, playback, skins, rate, paused, events }; }
  function enter(world: World): void { ({ skeleton, state, entries, playback, skins, rate, paused, events } = world); }
  function discard(world: World): void { world.state.clearListeners(); world.state.clearTracks(); world.entries.clear(); world.playback.clear(); }
  enter(createWorld());
  function publish(): SpineInstanceSnapshot {
    const current = skeleton!, animation = state!;
    const bones = current.bones.map(bone => {
      const pose = bone.appliedPose;
      const values = [pose.x, pose.y, pose.rotation, pose.a, pose.b, pose.c, pose.d, pose.worldX, pose.worldY];
      if (!values.every(Number.isFinite)) throw fault('NONFINITE_POSE');
      return freeze({ name: text(bone.data.name), x: pose.x, y: pose.y, rotation: pose.rotation, a: pose.a, b: pose.b, c: pose.c, d: pose.d, worldX: pose.worldX, worldY: pose.worldY });
    });
    const tracks = animation.tracks.flatMap((entry, index) => {
      if (!entry) return [];
      let queued = 0; for (let next = entry.next; next; next = next.next) if (++queued > MAX_ENTRIES) throw fault('ENTRY_LIMIT');
      return [freeze({ index, animation: text(entry.animation?.name ?? ''), trackTime: finite(entry.trackTime), animationTime: finite(entry.getAnimationTime()), loop: entry.loop || (playback.get(entry)?.restart ?? false), plays: playback.get(entry)?.plays ?? null, completedPlays: playback.get(entry)?.completed ?? 0, queued })];
    });
    return freeze({ state: paused ? 'paused' : 'running', revision, tickId, elapsedSeconds, rate, skin: skins.length === 1 ? skins[0]! : null, skins, pendingCommands: commands.length,
      bones: freeze(bones), slots: freeze(current.slots.map(slot => freeze({ name: text(slot.data.name), attachment: slot.appliedPose.attachment ? text(slot.appliedPose.attachment.name) : null }))), tracks: freeze(tracks), events: freeze([...events]) });
  }
  let committed = publish();
  function animation(trackIndex: number, name: string, options: SpineQueuedAnimationOptions | undefined, append: boolean): void {
    admit(); track(trackIndex);
    if (typeof name !== 'string' || !info.animations.some(row => row.name === name)) throw fault('ANIMATION_INVALID');
    const row = options === undefined ? {} : inputRecord(options, append ? ['loop', 'plays', 'mixSeconds', 'delaySeconds'] : ['loop', 'plays', 'mixSeconds']);
    const plays = row.plays, loop = plays === undefined ? row.loop ?? false : (plays as number) > 1, mix = row.mixSeconds ?? 0, delay = row.delaySeconds ?? 0;
    const duration = info.animations.find(row => row.name === name)!.duration;
    if (plays !== undefined && (!Number.isSafeInteger(plays) || !number(plays, 1, 1024) || row.loop !== undefined
      || duration === 0 && plays !== 1 || !number(duration * plays, 0, Number.MAX_SAFE_INTEGER))) throw fault('OPTIONS_INVALID');
    if (typeof loop !== 'boolean' || !number(mix, 0, 3600) || !number(delay, 0, 86400)) throw fault('OPTIONS_INVALID');
    enqueue({ kind: 'animation', track: trackIndex, name, loop, plays: plays as number | undefined, mix, delay, append });
  }
  function apply(command: Command): void {
    const current = skeleton!, animation = state!;
    switch (command.kind) {
      case 'animation': {
        if (entries.size >= MAX_ENTRIES) throw fault('ENTRY_LIMIT');
        const entry = command.append ? animation.addAnimation(command.track, command.name, command.loop, command.delay)
          : animation.setAnimation(command.track, command.name, command.loop);
        if (command.append) entry.setMixDuration(command.mix, command.delay);
        else entry.mixDuration = command.mix;
        if (command.append && command.delay === 0 && entry.previous) {
          const previous = playback.get(entry.previous);
          if (previous?.finite) entry.delay = Math.max(Math.max(previous.duration * previous.plays!, entry.previous.trackTime) - command.mix, 0);
        }
        playback.set(entry, { plays: command.plays ?? (command.loop ? null : 1), completed: 0, finite: command.plays !== undefined, duration: entry.animationEnd - entry.animationStart, nextBoundary: entry.animationEnd - entry.animationStart, nextPlay: 1, restart: false });
        entries.add(entry);
        break;
      }
      case 'clear': animation.clearTrack(command.track); break;
      case 'skin': {
        // Composition owns its map, while Core retains authored attachment/bone/constraint
        // references. Never add entries to a shared setup skin or restart track state.
        let selected: Core.Skin;
        if (command.names.length === 1) selected = current.data.findSkin(command.names[0]!)!;
        else {
          selected = new Core.Skin('egret-composite');
          for (const name of command.names) selected.addSkin(current.data.findSkin(name)!);
        }
        current.setSkin(selected); current.setupPoseSlots(); skins = command.names;
        break;
      }
      case 'transform': current.setPosition(command.x, command.y); current.setScale(command.scaleX, command.scaleY); break;
      case 'rate': rate = command.value; break;
      case 'paused': paused = command.value; break;
    }
  }
  // A finite entry keeps its Core identity, track time and mixing chain. Boundary
  // sampling prevents short loops from losing events or a queued successor's residual time.
  function advanceFinite(delta: number): void {
    const current = skeleton!, animation = state!;
    let remaining = delta, steps = 0;
    const limit = eventLimit + MAX_ENTRIES + (maxSegments as number) + 1;
    function active(): Core.TrackEntry[] {
      const result: Core.TrackEntry[] = [];
      for (const track of animation.tracks) for (let entry = track; entry; entry = entry.mixingFrom!) result.push(entry);
      return result;
    }
    function sample(step: number): void {
      if (++steps > limit) throw fault('PLAYBACK_STEP_LIMIT');
      if (step > 0) for (const entry of active()) {
        const policy = playback.get(entry);
        if (policy?.restart) { entry.loop = true; entry.setAnimationLast(-1); policy.restart = false; }
      }
      current.update(step); animation.update(step);
      for (const entry of active()) {
        const policy = playback.get(entry);
        if (policy?.finite && entry.loop && entry.trackTime >= policy.nextBoundary) {
          // Apply the end before wrapping. Equal modulo positions otherwise hide
          // all intervening authored events when a whole short loop fits one step.
          entry.loop = false;
          policy.restart = policy.nextPlay < policy.plays!;
          policy.nextBoundary = policy.duration * ++policy.nextPlay;
        }
      }
      animation.apply(current); current.updateWorldTransform(step === 0 ? Core.Physics.pose : Core.Physics.update);
    }
    sample(0);
    for (;;) {
      // Core switches queues using the last applied position. Apply the boundary
      // first, then switch at zero elapsed time so no successor delta is discarded.
      const ready = animation.tracks.some(entry => entry?.next && entry.delay <= 0 && entry.nextTrackLast >= entry.next.delay
        && (playback.get(entry)?.finite || playback.get(entry.next)?.finite));
      if (ready) { sample(0); continue; }
      if (remaining <= 0) break;
      let step = Math.min(1 / 60, remaining);
      for (const entry of active()) {
        const policy = playback.get(entry);
        if (policy?.finite && policy.completed < policy.plays! && policy.duration > 0) {
          const until = Math.max(0, entry.delay) + policy.nextBoundary - entry.trackTime;
          if (until > 0) step = Math.min(step, until);
        }
        if (entry.next && (policy?.finite || playback.get(entry.next)?.finite)) {
          const until = Math.max(0, entry.delay) + entry.next.delay - entry.trackTime;
          if (until > 0) step = Math.min(step, until);
        }
      }
      if (!(step > 0) || remaining - step === remaining) throw fault('PLAYBACK_STEP_LIMIT');
      sample(step); remaining = Math.max(0, remaining - step);
      // Subtracting many exact boundaries may leave a rounding-only tail. It
      // must not start a new loop after the requested endpoint.
      if (remaining <= Number.EPSILON * delta * (steps + 1)) remaining = 0;
    }
  }
  /** One accepted step of a playback: its commands, then its time. */
  function run(kind: HistoryRecord['kind'], pending: readonly Command[], delta: number): void {
    for (const command of pending) apply(command);
    const current = skeleton!, animation = state!, segments = segmentsOf(delta);
    if (kind === 'reset') { animation.update(0); animation.apply(current); current.updateWorldTransform(Core.Physics.reset); }
    else if ([...playback.values()].some(policy => policy.finite)) advanceFinite(delta);
    else if (segments === 0) { animation.update(0); animation.apply(current); current.updateWorldTransform(Core.Physics.pose); }
    else for (let index = 0; index < segments; index++) {
      const step = Math.min(1 / 60, delta - index / 60);
      current.update(step); animation.update(step); animation.apply(current); current.updateWorldTransform(Core.Physics.update);
    }
  }
  function remember(kind: HistoryRecord['kind'], pending: readonly Command[], delta: number): void {
    if (history === undefined) return;
    if (history.length >= historyAdvances || historyCommands + pending.length > historyCommandLimit) { history = undefined; historyCommands = 0; return; }
    history.push(freeze({ kind, delta, commands: freeze([...pending]) })); historyCommands += pending.length;
  }
  /** What follows a committed change of playback: the picture, then the events, each failure kept apart. */
  function deliver(): SpineInstanceSnapshot {
    let candidate: SpineDrawCandidate | undefined;
    // Only committed transitions reach callers. Reentrant commands wait until the next tick.
    const delivered = committed.events; events = []; const errors: unknown[] = [];
    // Graphics is a separate commit domain: keep semantic time/events after a draw refusal.
    let renderingFailed = false;
    try { candidate = drawSink?.prepare(skeleton!); candidate?.commit(); }
    catch (cause) {
      renderingFailed = true; errors.push(cause);
      try { candidate?.abort(); } catch (cleanup) { errors.push(cleanup); }
      candidate = undefined;
    }
    dispatching = true;
    let cleanupFailed = false;
    try { try { candidate?.retire?.(); } catch (cause) { cleanupFailed = true; errors.push(cause); }
      for (const event of delivered) { if (disposed) break; try { listener?.(event); } catch (cause) { errors.push(cause); } } }
    finally { dispatching = false; busy = false; }
    if (errors.length) throw new EgretError(renderingFailed ? 'SPINE_INSTANCE_RENDER_FAILED' : cleanupFailed ? 'SPINE_INSTANCE_POSTCOMMIT_FAILED' : 'SPINE_INSTANCE_LISTENER_FAILED', { cause: errors[0], cleanupErrors: errors.slice(1) });
    return instance.getSnapshot();
  }
  function dispose(): void {
    if (disposed) return;
    seeking?.cancel();
    disposed = true; commands.length = 0; events.length = 0; listener = undefined;
    // No upstream disposal events are exposed after the instance lifetime ends.
    try { const sink=drawSink; drawSink=undefined; try { sink?.dispose(); } finally { state?.clearListeners(); state?.clearTracks(); } }
    finally { entries.clear(); playback.clear(); state = undefined; skeleton = undefined; const release = unown; unown = undefined; release?.(); }
  }
  const instance: SpineInstance = freeze({
    get isDisposed() { return disposed; },
    setAnimation(trackIndex: number, name: string, options?: SpineAnimationOptions) { animation(trackIndex, name, options, false); },
    addAnimation(trackIndex: number, name: string, options?: SpineQueuedAnimationOptions) { animation(trackIndex, name, options, true); },
    clearTrack(trackIndex: number) { admit(); track(trackIndex); enqueue({ kind: 'clear', track: trackIndex }); },
    setSkin(name: string) { admit(); if (typeof name !== 'string' || !info.skins.includes(name)) throw fault('SKIN_INVALID'); enqueue({ kind: 'skin', names: freeze([name]) }); },
    setSkins(names: readonly string[]) {
      admit();
      const selected: string[] = [];
      admitting = true;
      try {
        if (!Array.isArray(names)) throw fault('SKINS_INVALID');
        // Read own data descriptors, not an overridable iterator or accessor. Every
        // proxy boundary rechecks ownership before any command can be published.
        const size = Object.getOwnPropertyDescriptor(names, 'length'); assertOpen();
        const count: unknown = size?.value;
        if (!size || !Object.hasOwn(size, 'value') || !Number.isSafeInteger(count) || !number(count, 1, 32)) throw fault('SKINS_INVALID');
        for (let index = 0; index < count; index++) {
          const row = Object.getOwnPropertyDescriptor(names, String(index)); assertOpen();
          if (!row || !Object.hasOwn(row, 'value') || typeof row.value !== 'string' || !info.skins.includes(row.value) || selected.includes(row.value)) throw fault('SKINS_INVALID');
          selected.push(row.value);
        }
      } finally { admitting = false; }
      enqueue({ kind: 'skin', names: freeze(selected) });
    },
    setTransform(x: number, y: number, scaleX = 1, scaleY = 1) { admit(); if (![x, y, scaleX, scaleY].every(value => number(value, -1000000, 1000000))) throw fault('TRANSFORM_INVALID'); enqueue({ kind: 'transform', x, y, scaleX, scaleY }); },
    setRate(value: number) { admit(); if (!number(value, 0, 16)) throw fault('RATE_INVALID'); enqueue({ kind: 'rate', value }); },
    setPaused(value: boolean) { admit(); if (typeof value !== 'boolean') throw fault('PAUSED_INVALID'); enqueue({ kind: 'paused', value }); },
    getSnapshot() { return freeze({ ...committed, state: disposed ? 'disposed' : faulted ? 'faulted' : committed.state, pendingCommands: commands.length }); },
    dispose,
    advance(tick: GameClockTick) {
      assertOpen(); if (busy || admitting) throw fault('REENTRANT');
      const value = inputRecord(tick, ['tickId', 'elapsedSeconds', 'deltaSeconds']);
      if (!Number.isSafeInteger(value.tickId) || !number(value.tickId, tickId + 1, Number.MAX_SAFE_INTEGER)
        || !number(value.elapsedSeconds, clockElapsed, Number.MAX_SAFE_INTEGER) || !number(value.deltaSeconds, 0, Number.MAX_SAFE_INTEGER)) throw fault('TICK_INVALID');
      let nextRate = rate, nextPaused = paused;
      for (const command of commands) { if (command.kind === 'rate') nextRate = command.value; if (command.kind === 'paused') nextPaused = command.value; }
      const delta = nextPaused ? 0 : value.deltaSeconds * nextRate;
      if (!Number.isFinite(delta) || segmentsOf(delta) > maxSegments || elapsedSeconds + delta > Number.MAX_SAFE_INTEGER) throw fault('STEP_LIMIT');
      // Prevalidation above leaves both the pending commands and committed state intact.
      busy = true;
      const pending = commands; commands = []; events = [];
      try {
        run('advance', pending, delta);
        revision++; tickId = value.tickId; clockElapsed = value.elapsedSeconds; elapsedSeconds += delta;
        committed = publish();
      } catch (cause) {
        faulted = true; commands.length = 0; events = []; busy = false;
        throw fault('ADVANCE_FAILED', cause);
      }
      remember('advance', pending, delta);
      // The seek was planned against the playback this advance has just left behind.
      seeking?.cancel();
      return deliver();
    },
    seek(request: SpineSeekRequest): SpineSeekTicket {
      // A faulted instance may seek: rebuilding from its history is how it is brought back.
      alive(); if (busy || admitting) throw fault('REENTRANT');
      admitting = true;
      let value: Record<string, unknown>;
      try { value = record(request, ['elapsedSeconds', 'events'], alive); } finally { admitting = false; }
      const target = value.elapsedSeconds, mode = value.events ?? 'suppress';
      if (!number(target, 0, Number.MAX_SAFE_INTEGER) || (mode !== 'suppress' && mode !== 'replay')) throw fault('SEEK_INVALID');
      if (seeking) throw fault('SEEK_ACTIVE');
      if (history === undefined) throw fault('SEEK_HISTORY');
      // Events are never played backward.
      if (mode === 'replay' && target < elapsedSeconds) throw fault('SEEK_BACKWARD_EVENTS');
      // The plan: every accepted step that had ended by the target, a part of the step the target
      // falls inside, and beyond the present, steps as long as an ordinary advance may be. A step
      // that begins exactly at the target is not taken: its commands were applied after that moment.
      const plan: HistoryRecord[] = [];
      // Sums of the same deltas may differ in their last bits. A target that close to the end of a
      // step is that end: otherwise rounding alone would decide whether the next commands are applied.
      const slack = (): number => Number.EPSILON * Math.max(1, target) * (plan.length + 2);
      let reached = 0;
      for (const step of history) {
        if (reached + step.delta > target + slack()) {
          if (target - reached > slack()) { plan.push(freeze({ kind: step.kind, delta: target - reached, commands: step.commands })); reached = target; }
          break;
        }
        plan.push(step); reached += step.delta;
      }
      const known = plan.length;
      const stride = (maxSegments as number) / 60, none: readonly Command[] = freeze([]);
      // A remainder that is only rounding is not a step of its own.
      while (target - reached > slack()) {
        const delta = Math.min(stride, target - reached);
        plan.push(freeze({ kind: 'advance', delta, commands: none })); reached += delta;
      }
      const totalSegments = plan.reduce((sum, step) => sum + segmentsOf(step.delta), 0);
      if (totalSegments > seekSegments || plan.length > historyAdvances) throw fault('SEEK_LIMIT');
      const from = revision;
      let world: World | undefined = createWorld(), phase: SpineSeekState = 'staged', next = 0, completedSegments = 0;
      function end(result: SpineSeekState): void {
        phase = result;
        if (world) { discard(world); world = undefined; }
        if (seeking === ticket) seeking = undefined;
      }
      /** The instance must be as it was when the seek was planned. */
      function current(): void {
        if (phase !== 'staged' && phase !== 'ready') throw fault('SEEK_' + (phase === 'committed' ? 'COMMITTED' : phase === 'cancelled' ? 'CANCELLED' : 'FAILED'));
        try { alive(); } catch (cause) { end('cancelled'); throw cause; }
        if (busy || admitting) throw fault('REENTRANT');
      }
      const ticket: SpineSeekTicket & { cancel(): void } = freeze({
        get state() { return phase; },
        targetSeconds: target, totalSegments,
        get completedSegments() { return completedSegments; },
        step() {
          current();
          if (phase === 'ready') return true;
          const live = hold();
          busy = true; enter(world!);
          try {
            for (let budget = sliceSegments, first = true; next < plan.length; first = false) {
              const step = plan[next]!, cost = segmentsOf(step.delta);
              // A slice always moves, and never past its budget otherwise.
              if (!first && cost > budget) break;
              capturing = mode === 'replay' && next >= known ? 'collect' : 'quiet';
              run(step.kind, step.commands, step.delta);
              next++; budget -= cost; completedSegments += cost;
            }
            world = hold();
          } catch (cause) {
            world = hold(); enter(live); capturing = 'live'; busy = false;
            end('failed');
            throw cause instanceof EgretError && cause.code === 'SPINE_INSTANCE_SEEK_EVENT_LIMIT' ? cause : fault('SEEK_FAILED', cause);
          }
          enter(live); capturing = 'live'; busy = false;
          if (next === plan.length) phase = 'ready';
          return phase === 'ready';
        },
        commit() {
          current();
          if (phase !== 'ready') throw fault('SEEK_NOT_READY');
          const live = hold(), before = elapsedSeconds;
          busy = true; enter(world!);
          try { revision++; elapsedSeconds = target; committed = publish(); }
          catch (cause) {
            // Nothing was replaced: the instance stands where it stood.
            enter(live); revision = from; elapsedSeconds = before; busy = false;
            end('failed');
            throw fault('SEEK_FAILED', cause);
          }
          world = undefined; discard(live);
          // A playback rebuilt from history carries no fault of the one it replaces.
          faulted = false;
          history = plan; historyCommands = plan.reduce((sum, step) => sum + step.commands.length, 0);
          end('committed');
          return deliver();
        },
        cancel() { if (phase === 'staged' || phase === 'ready') end('cancelled'); },
      });
      seeking = ticket;
      return ticket;
    },
  });
  try { unown = port.own(scope, instance); port.assertOpen(); }
  catch (cause) { dispose(); throw cause; }
  /** The animation of this asset that continues a carried entry: the same name, length and events. */
  function continuation(row: SpinePreservedEntry): Core.Animation {
    const found = skeleton!.data.findAnimation(row.name);
    if (!found || found.duration !== row.duration) throw refuse('ANIMATION');
    const schedule = eventSchedule(found);
    if (schedule.length !== row.events.length || schedule.some((value, index) => value !== row.events[index])) throw refuse('ANIMATION');
    return found;
  }
  function checkPreserve(source: SpinePreservedPlayback): void {
    assertOpen();
    for (const name of source.skins) if (!info.skins.includes(name)) throw refuse('SKIN');
    for (const chain of [...source.tracks, ...source.mixing]) if (chain) for (const row of chain) continuation(row);
  }
  /** Gives an entry the position of the one it continues. */
  function place(entry: Core.TrackEntry, row: SpinePreservedEntry): void {
    const values = entry as unknown as Record<string, number | boolean>;
    for (const key of ENTRY_VALUES) values[key] = row.values[key]!;
    const rotations = entry.timelinesRotation;
    rotations.length = 0;
    for (const [index, value] of row.rotations.entries()) if (value !== undefined) rotations[index] = value;
    rotations.length = row.rotations.length;
    // Core works these out again from the chain, except the holds of an entry that was told to keep them.
    entry.timelineMode.length = 0;
    entry.timelineMode.push(...row.modes);
  }
  registerSpineRender(instance,{asset:port,exportPlayback(){
    // Between two advances only: a command not yet applied is not a position to continue from.
    if (disposed || faulted || busy || admitting || commands.length) throw refuse('STATE');
    port.assertOpen();
    const current = skeleton!, tracks: (readonly SpinePreservedEntry[] | undefined)[] = [], mixing: (readonly SpinePreservedEntry[])[] = [];
    let carried = 0;
    const record = (entry: Core.TrackEntry): SpinePreservedEntry => {
      if (++carried > MAX_ENTRIES || !entry.animation) throw refuse('STATE');
      const values: Record<string, number | boolean> = {};
      for (const key of ENTRY_VALUES) { const value = entry[key]; if (typeof value === 'number' && !Number.isFinite(value) && key !== 'trackEnd') throw refuse('STATE'); values[key] = value; }
      const policy = playback.get(entry);
      return freeze({ name: text(entry.animation.name), duration: finite(entry.animation.duration), events: freeze(eventSchedule(entry.animation)), values: freeze(values),
        rotations: freeze(Array.from(entry.timelinesRotation as (number | undefined)[])), modes: freeze([...entry.timelineMode]), policy: policy ? freeze({ ...policy }) : undefined });
    };
    for (const head of state!.tracks) {
      if (!head) { tracks.push(undefined); mixing.push(freeze([])); continue; }
      // A mix under way is carried: what the current entry is mixing out of, back to the oldest.
      const out: SpinePreservedEntry[] = [], chain: SpinePreservedEntry[] = [];
      for (let entry = head.mixingFrom; entry; entry = entry.mixingFrom) out.unshift(record(entry));
      for (let entry: Core.TrackEntry | null = head; entry; entry = entry.next) chain.push(record(entry));
      tracks.push(freeze(chain)); mixing.push(freeze(out));
    }
    return freeze({ tracks: freeze(tracks), mixing: freeze(mixing), skins, transform: freeze([current.x, current.y, current.scaleX, current.scaleY] as const), rate, paused, revision, tickId, clockElapsed, elapsedSeconds });
  },checkPreserve,initializePreserve(source){
    // Private fresh-candidate initialization, as for reset: no clock identity is invented, no listener
    // runs, and the candidate's first advance continues from the tick the source last took.
    assertOpen();if(busy||admitting||revision!==0||tickId!==0||drawSink||commands.length)throw fault('RESET_NOT_PRISTINE');
    checkPreserve(source);
    busy=true;
    try{
      const current=skeleton!,animation=state!,rebuilt:[Core.TrackEntry,SpinePreservedEntry][]=[];
      if(source.skins.length)apply({kind:'skin',names:source.skins});
      current.setPosition(source.transform[0],source.transform[1]);current.setScale(source.transform[2],source.transform[3]);
      for(const [index,chain] of source.tracks.entries()){
        if(!chain)continue;
        // The entries being mixed out of are set first, the oldest first, and then the current one: Core
        // makes each a mix from the one before it. Queued entries follow the current one.
        const out=source.mixing[index]??[];
        for(const [position,row] of [...out,...chain].entries()){
          if(entries.size>=MAX_ENTRIES)throw fault('ENTRY_LIMIT');
          const found=continuation(row),entry=position>out.length?animation.addAnimation(index,found,false,0):animation.setAnimation(index,found,false);
          // Placed before the next is set: Core replaces an entry it takes for never applied instead of mixing from it.
          place(entry,row);
          entries.add(entry);rebuilt.push([entry,row]);
        }
      }
      // Setting an entry began its mix anew and cleared the rotations the one before it remembered.
      for(const [entry,row] of rebuilt)place(entry,row);
      // This application poses the new skeleton. It finds again what the source's last one found, and Core
      // announced the start of each rebuilt entry: all of that was delivered by the source when it happened,
      // and is dropped here. Each entry receives its policy only afterwards, so that no play is counted twice.
      animation.apply(current);current.updateWorldTransform(Core.Physics.reset);
      for(const [entry,row] of rebuilt)if(row.policy)playback.set(entry,{...row.policy});
      // This playback did not begin at the setup pose: there is nothing to replay it from.
      history=undefined;historyCommands=0;
      events=[];rate=source.rate;paused=source.paused;tickId=source.tickId;clockElapsed=source.clockElapsed;elapsedSeconds=source.elapsedSeconds;
      revision=source.revision+1;committed=publish();
    }catch(cause){faulted=true;commands=[];events=[];throw fault('RESET_FAILED',cause);}
    finally{busy=false;}
  },initializeReset(){
    // Private fresh-candidate initialization: no synthetic clock identity, listener or
    // history replay. Core consumes its time-zero cursor before any public advance.
    assertOpen();if(busy||admitting||revision!==0||tickId!==0||drawSink)throw fault('RESET_NOT_PRISTINE');
    busy=true;
    try{
      const pending=commands;commands=[];events=[];
      run('reset',pending,0);
      events=[];revision++;committed=publish();remember('reset',pending,0);
    }catch(cause){faulted=true;commands=[];events=[];throw fault('RESET_FAILED',cause);}
    finally{busy=false;}
  },attach(displayScope,sink){
    assertOpen();if(busy||admitting||drawSink)throw fault('DISPLAY_ACTIVE');port.authenticate(displayScope,false);
    const candidate=sink.prepare(skeleton!);
    try{assertOpen();candidate.commit();drawSink=sink;candidate.retire?.();}catch(cause){candidate.abort();throw cause;}
    return ()=>{if(drawSink===sink)drawSink=undefined;};
  }});
  return instance;
}
