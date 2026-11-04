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
type Command = { kind: 'animation'; track: number; name: string; loop: boolean; mix: number; delay: number; append: boolean }
  | { kind: 'clear'; track: number } | { kind: 'skin'; name: string }
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
  const entries = new Set<Core.TrackEntry>();
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
    if (kind === 'dispose') entries.delete(entry);
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
      return [freeze({ index, animation: text(entry.animation?.name ?? ''), trackTime: finite(entry.trackTime), animationTime: finite(entry.getAnimationTime()), loop: entry.loop, queued })];
    });
    return freeze({ state: paused ? 'paused' : 'running', revision, tickId, elapsedSeconds, rate, skin: current.skin ? text(current.skin.name) : null, pendingCommands: commands.length,
      bones: freeze(bones), slots: freeze(current.slots.map(slot => freeze({ name: text(slot.data.name), attachment: slot.appliedPose.attachment ? text(slot.appliedPose.attachment.name) : null }))), tracks: freeze(tracks), events: freeze([...events]) });
  }
  let committed = publish();
  function animation(trackIndex: number, name: string, options: SpineQueuedAnimationOptions | undefined, append: boolean): void {
    admit(); track(trackIndex);
    if (typeof name !== 'string' || !info.animations.some(row => row.name === name)) throw fault('ANIMATION_INVALID');
    const row = options === undefined ? {} : inputRecord(options, append ? ['loop', 'mixSeconds', 'delaySeconds'] : ['loop', 'mixSeconds']);
    const loop = row.loop ?? false, mix = row.mixSeconds ?? 0, delay = row.delaySeconds ?? 0;
    if (typeof loop !== 'boolean' || !number(mix, 0, 3600) || !number(delay, 0, 86400)) throw fault('OPTIONS_INVALID');
    enqueue({ kind: 'animation', track: trackIndex, name, loop, mix, delay, append });
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
        entries.add(entry);
        break;
      }
      case 'clear': animation.clearTrack(command.track); break;
      case 'skin': current.setSkin(command.name); current.setupPoseSlots(); break;
      case 'transform': current.setPosition(command.x, command.y); current.setScale(command.scaleX, command.scaleY); break;
      case 'rate': rate = command.value; break;
      case 'paused': paused = command.value; break;
    }
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true; commands.length = 0; events.length = 0; listener = undefined;
    // No upstream disposal events are exposed after the instance lifetime ends.
    try { const sink=drawSink; drawSink=undefined; try { sink?.dispose(); } finally { state?.clearListeners(); state?.clearTracks(); } }
    finally { entries.clear(); state = undefined; skeleton = undefined; const release = unown; unown = undefined; release?.(); }
  }
  const instance: SpineInstance = freeze({
    get isDisposed() { return disposed; },
    setAnimation(trackIndex: number, name: string, options?: SpineAnimationOptions) { animation(trackIndex, name, options, false); },
    addAnimation(trackIndex: number, name: string, options?: SpineQueuedAnimationOptions) { animation(trackIndex, name, options, true); },
    clearTrack(trackIndex: number) { admit(); track(trackIndex); enqueue({ kind: 'clear', track: trackIndex }); },
    setSkin(name: string) { admit(); if (typeof name !== 'string' || !info.skins.includes(name)) throw fault('SKIN_INVALID'); enqueue({ kind: 'skin', name }); },
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
        if (segments === 0) { animation.update(0); animation.apply(current); current.updateWorldTransform(Core.Physics.pose); }
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
