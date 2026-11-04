// SPDX-License-Identifier: Apache-2.0
// Core performs animation semantics; Egret owns time admission and publication.
import * as Core from '@esotericsoftware/spine-core';
import { EgretError } from '@egret/engine';
import type { GameClockTick, Scope } from '@egret/engine';
import type { SpineAsset } from './types.js';
import type { SpineInstance, SpineInstanceOptions, SpineInstanceSnapshot, SpinePlaybackEvent, SpinePlaybackEventKind, SpineAnimationOptions, SpineQueuedAnimationOptions } from './instanceTypes.js';
import { requireSpineAsset } from './assetAuthority.js';
import { registerSpineRender } from './renderAuthority.js';
import type { SpineDrawSink, SpineDrawCandidate } from './renderAuthority.js';

const freeze = Object.freeze;
const MAX_COMMANDS = 256, MAX_ENTRIES = 128, MAX_TRACKS = 16;
type Command = { kind: 'animation'; track: number; name: string; loop: boolean; plays: number | undefined; mix: number; delay: number; append: boolean }
  | { kind: 'clear'; track: number } | { kind: 'skin'; names: readonly string[] }
  | { kind: 'transform'; x: number; y: number; scaleX: number; scaleY: number }
  | { kind: 'rate'; value: number } | { kind: 'paused'; value: boolean };
function fault(code: string, cause?: unknown): EgretError { return new EgretError('SPINE_INSTANCE_' + code, { cause }); }
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
  const settings = options === undefined ? {} : record(options, ['maxSegments', 'maxEvents', 'onEvent'], () => { port.assertOpen(); port.authenticate(scope); });
  const maxSegments = settings.maxSegments ?? 8, maxEvents = settings.maxEvents ?? 1024;
  if (!Number.isSafeInteger(maxSegments) || !number(maxSegments, 1, 120) || !Number.isSafeInteger(maxEvents) || !number(maxEvents, 1, 8192)
    || settings.onEvent !== undefined && typeof settings.onEvent !== 'function') throw fault('OPTIONS_INVALID');
  const eventLimit = maxEvents as number;
  let listener = settings.onEvent as ((event: SpinePlaybackEvent) => void) | undefined;
  port.assertOpen(); port.authenticate(scope);
  const info = port.getSetup().info;
  let skeleton: Core.Skeleton | undefined = new Core.Skeleton(port.getSetup().data);
  let state: Core.AnimationState | undefined = new Core.AnimationState(new Core.AnimationStateData(skeleton.data));
  let disposed = false, faulted = false, busy = false, admitting = false, dispatching = false, paused = false, rate = 1;
  let revision = 0, tickId = 0, elapsedSeconds = 0, clockElapsed = 0;
  let unown: (() => void) | undefined;
  let drawSink: SpineDrawSink | undefined;
  let commands: Command[] = [], events: SpinePlaybackEvent[] = [];
  let skins: readonly string[] = freeze([]);
  const entries = new Set<Core.TrackEntry>();
  const playback = new Map<Core.TrackEntry, { plays: number | null; completed: number; finite: boolean; duration: number; nextBoundary: number; nextPlay: number; restart: boolean }>();
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
    if (disposed || faulted) return;
    if (kind === 'dispose') { entries.delete(entry); playback.delete(entry); }
    if (kind === 'complete') { const policy = playback.get(entry); if (policy) policy.completed++; }
    if (events.length >= eventLimit) throw fault('EVENT_LIMIT');
    if (event && !Number.isSafeInteger(event.intValue)) throw fault('OUTPUT_INVALID');
    const row: SpinePlaybackEvent = freeze({ kind, track: entry.trackIndex, animation: text(entry.animation?.name ?? ''), trackTime: finite(entry.trackTime),
      ...(event ? { event: freeze({ name: text(event.data.name), time: finite(event.time), intValue: event.intValue, floatValue: finite(event.floatValue), stringValue: event.stringValue === null ? null : text(event.stringValue) }) } : {}) });
    events.push(row);
  }
  state.addListener({ start: entry => capture('start', entry), interrupt: entry => capture('interrupt', entry), end: entry => capture('end', entry),
    dispose: entry => capture('dispose', entry), complete: entry => capture('complete', entry), event: (entry, event) => capture('event', entry, event) });
  skeleton.updateWorldTransform(Core.Physics.reset);
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
  function dispose(): void {
    if (disposed) return;
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
      const segments = delta === 0 ? 0 : Math.ceil(delta * 60);
      if (!Number.isFinite(delta) || segments > maxSegments || elapsedSeconds + delta > Number.MAX_SAFE_INTEGER) throw fault('STEP_LIMIT');
      // Prevalidation above leaves both the pending commands and committed state intact.
      busy = true;
      const pending = commands; commands = []; events = [];
      let candidate: SpineDrawCandidate | undefined;
      try {
        for (const command of pending) apply(command);
        const current = skeleton!, animation = state!;
        if ([...playback.values()].some(policy => policy.finite)) advanceFinite(delta);
        else if (segments === 0) { animation.update(0); animation.apply(current); current.updateWorldTransform(Core.Physics.pose); }
        else for (let index = 0; index < segments; index++) {
          const step = Math.min(1 / 60, delta - index / 60);
          current.update(step); animation.update(step); animation.apply(current); current.updateWorldTransform(Core.Physics.update);
        }
        revision++; tickId = value.tickId; clockElapsed = value.elapsedSeconds; elapsedSeconds += delta;
        committed = publish();
      } catch (cause) {
        faulted = true; commands.length = 0; events = []; busy = false;
        throw fault('ADVANCE_FAILED', cause);
      }
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
    },
  });
  try { unown = port.own(scope, instance); port.assertOpen(); }
  catch (cause) { dispose(); throw cause; }
  registerSpineRender(instance,{asset:port,attach(displayScope,sink){
    assertOpen();if(busy||admitting||drawSink)throw fault('DISPLAY_ACTIVE');port.authenticate(displayScope,false);
    const candidate=sink.prepare(skeleton!);
    try{assertOpen();candidate.commit();drawSink=sink;candidate.retire?.();}catch(cause){candidate.abort();throw cause;}
    return ()=>{if(drawSink===sink)drawSink=undefined;};
  }});
  return instance;
}
