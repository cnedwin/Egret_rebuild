// SPDX-License-Identifier: Apache-2.0
// Private absolute sampling borrows the shared page and owns no clock or lease.
import { DisplayObject, DisplayObjectContainer, EgretError, Mesh2D, Scope } from '@egret/engine';
import type { AssetLease, Texture, TexturedGeometry2D } from '@egret/engine';
import { MixFrom, Physics, Skeleton, SkeletonRendererCore } from '@esotericsoftware/spine-core';
import type { Animation, SkeletonData, Texture as CoreTexture } from '@esotericsoftware/spine-core';
import { copyF2CoreCommand } from './geometry.js';
import type { F2CoreInstance, F2CoreInstanceState } from './types.js';

const APPLY = Reflect.apply;
const DESCRIPTOR = Object.getOwnPropertyDescriptor;
const FREEZE = Object.freeze;
const FINITE = Number.isFinite;
const SCOPE_STATE = DESCRIPTOR(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const ROOT_ADD = DisplayObjectContainer.prototype.addChild;
const ROOT_CHILD = DisplayObjectContainer.prototype.getChildAt;
const ROOT_COUNT = DESCRIPTOR(DisplayObjectContainer.prototype, 'numChildren')!.get!;
const ROOT_DISPOSE = DisplayObjectContainer.prototype.dispose;
const MESH_DISPOSE = Mesh2D.prototype.dispose;
const MESH_CONTENT = Mesh2D.prototype.setContent;
const MESH_GEOMETRY = DESCRIPTOR(Mesh2D.prototype, 'geometry')!.get!;
const MESH_LEASE = DESCRIPTOR(Mesh2D.prototype, 'textureLease')!.get!;
const DISPLAY_PARENT = DESCRIPTOR(DisplayObject.prototype, 'parent')!.get!;
const DISPLAY_DISPOSED = DESCRIPTOR(DisplayObject.prototype, 'isDisposed')!.get!;
const CHILD_VISUALS = FREEZE([
  ['x', 0], ['y', 0], ['scaleX', 1], ['scaleY', 1], ['rotation', 0],
  ['alpha', 1], ['visible', true], ['clipRect', undefined],
  ['touchEnabled', false], ['hitArea', undefined],
].map(([name, value]) => FREEZE({ getter: DESCRIPTOR(DisplayObject.prototype, name as string)!.get!, value })));

/** Private ports are consumed only by the resource/instance modules in this experiment. */
export interface InstanceBundle {
  readonly lease: AssetLease<Texture>;
  readonly wrapper: CoreTexture;
  readonly data: SkeletonData;
  readonly counts: Readonly<{ vertices: number; indices: number }>;
  readonly animations: readonly Readonly<{ name: string; duration: number }>[];
}
export interface InstanceRetirement { retire(): readonly unknown[]; }
export interface InstanceResourcePort {
  requireReady(): void;
  reserve(instance: InstanceRetirement): void;
  release(instance: InstanceRetirement): void;
}

interface InstanceOwner {
  readonly scope: Scope;
  readonly requireResourcesReady: () => void;
  bundle: InstanceBundle | undefined;
  resources: InstanceResourcePort | undefined;
  reservation: InstanceRetirement | undefined;
  skeleton: Skeleton | undefined;
  renderer: SkeletonRendererCore | undefined;
  animation: Animation | undefined;
  root: DisplayObjectContainer | undefined;
  mesh: Mesh2D | undefined;
  geometry: TexturedGeometry2D | undefined;
  state: F2CoreInstanceState;
  time: number;
  duration: number;
  sampling: boolean;
}

function requireOpenScope(scope: unknown): asserts scope is Scope {
  let state: unknown;
  try { state = APPLY(SCOPE_STATE, scope, []); }
  catch (cause) { throw new EgretError('F2C_SCOPE_INVALID', { cause }); }
  if (state !== 'open') throw new EgretError('F2C_SCOPE_CLOSED');
}

/** Resource/Scope termination always wins over stale display or sample errors. */
function requireLifetime(owner: InstanceOwner): void {
  owner.requireResourcesReady();
  requireOpenScope(owner.scope);
  if (owner.state !== 'live') {
    throw new EgretError('F2C_INSTANCE_TERMINAL');
  }
}

/** A winning terminal gate retains the observed call's cause/cleanup ledger. */
function recheckLifetime(owner: InstanceOwner, cause: unknown): void {
  try { requireLifetime(owner); }
  catch (terminal) {
    if (!(terminal instanceof EgretError)) throw terminal;
    throw new EgretError(terminal.code, { cause,
      cleanupErrors: cause instanceof EgretError ? cause.cleanupErrors : [] });
  }
}

function requireDisplay(owner: InstanceOwner): void {
  const root = owner.root;
  const mesh = owner.mesh;
  let valid = root !== undefined && mesh !== undefined && owner.bundle !== undefined;
  let cause: unknown;
  if (valid) {
    try {
      valid = APPLY(DISPLAY_DISPOSED, root, []) === false && APPLY(DISPLAY_DISPOSED, mesh, []) === false
        && APPLY(ROOT_COUNT, root, []) === 1 && APPLY(ROOT_CHILD, root, [0]) === mesh
        && APPLY(DISPLAY_PARENT, mesh, []) === root
        && APPLY(MESH_GEOMETRY, mesh, []) === owner.geometry
        && APPLY(MESH_LEASE, mesh, []) === owner.bundle!.lease;
      for (const visual of CHILD_VISUALS) valid = valid && APPLY(visual.getter, mesh, []) === visual.value;
    } catch (error) { valid = false; cause = error; }
  }
  requireLifetime(owner);
  if (!valid) throw new EgretError('DISPLAY_MUTATED', { cause });
}

/** Recheck lifetime after each official call, including a thrown undefined. */
function coreRead<T>(owner: InstanceOwner, read: () => T): T {
  let value!: T;
  let failed = false;
  let cause: unknown;
  try { value = read(); }
  catch (error) { failed = true; cause = error; }
  if (failed) recheckLifetime(owner, cause);
  else requireLifetime(owner);
  if (failed) throw cause;
  return value;
}

function requirePremise(owner: InstanceOwner): void {
  const yDown = coreRead(owner, () => Skeleton.yDown);
  if (yDown !== false) throw new EgretError('F2C_CORE_PREMISE');
}

/** This exact 4.3.13 public sequence is the entire pose evaluator. */
function prepareGeometry(owner: InstanceOwner, seconds: number): TexturedGeometry2D {
  const skeleton = owner.skeleton!;
  const renderer = owner.renderer!;
  const animation = owner.animation!;
  const bundle = owner.bundle!;
  coreRead(owner, () => skeleton.setupPose());
  coreRead(owner, () => animation.apply(skeleton, -1, seconds, false, null, 1,
    MixFrom.setup, false, false, false));
  coreRead(owner, () => skeleton.updateWorldTransform(Physics.none));
  const command = coreRead(owner, () => renderer.render(skeleton, false, undefined, 2));
  return coreRead(owner, () => copyF2CoreCommand(command, bundle.wrapper, bundle.counts));
}

/** Publish terminal references before any display cleanup can reenter the facade. */
function retire(owner: InstanceOwner): readonly unknown[] {
  if (owner.state === 'disposed') return [];
  const root = owner.root;
  const mesh = owner.mesh;
  const resources = owner.resources;
  const reservation = owner.reservation;
  owner.state = 'disposed';
  // Keep only Scope/resource admission gates for terminal precedence. The owned
  // display, Core data, renderer, animation and page associations all drop now.
  owner.bundle = undefined;
  owner.resources = undefined;
  owner.reservation = undefined;
  owner.skeleton = undefined;
  owner.renderer = undefined;
  owner.animation = undefined;
  owner.root = undefined;
  owner.mesh = undefined;
  owner.geometry = undefined;
  if (reservation !== undefined) resources?.release(reservation);
  const cleanupErrors: unknown[] = [];
  if (root !== undefined) {
    try { APPLY(ROOT_DISPOSE, root, []); }
    catch (cause) { cleanupErrors.push(cause); }
  }
  // The captured Mesh disposer also reaches a mesh detached or reparented by a caller.
  if (mesh !== undefined) {
    try { APPLY(MESH_DISPOSE, mesh, []); }
    catch (cause) { cleanupErrors.push(cause); }
  }
  return cleanupErrors;
}

function sampleAt(owner: InstanceOwner, seconds: number): void {
  requireLifetime(owner);
  // An active admission refuses nesting before the original getChildAt can
  // reach a caller's validateIndex shadow. Terminal and Scope gates stay first.
  if (owner.sampling) throw new EgretError('F2C_SAMPLE_REENTRANT');
  owner.sampling = true;
  let touchedCore = false;
  try {
    // Idle admissions retain display-before-time precedence under the guard.
    requireDisplay(owner);
    if (typeof seconds !== 'number' || !FINITE(seconds) || seconds < 0 || seconds > owner.duration) {
      throw new EgretError('F2C_TIME_INVALID');
    }
    requirePremise(owner);
    touchedCore = true;
    const geometry = prepareGeometry(owner, seconds);
    requireLifetime(owner);
    requireDisplay(owner);
    const mesh = owner.mesh!;
    const lease = owner.bundle!.lease;
    // The genuine original operation commits atomically without callbacks. Only
    // after it returns may the facade publish its new geometry identity and time.
    APPLY(MESH_CONTENT, mesh, [lease, geometry]);
    owner.geometry = geometry;
    owner.time = seconds;
  } catch (cause) {
    // Closure still wins. Display/time/premise refusals before Core preserve the
    // live state and old commit; only a still-live post-Core failure marks failed.
    recheckLifetime(owner, cause);
    if (!touchedCore) throw cause;
    owner.state = 'failed';
    throw new EgretError('F2C_SAMPLE_FAILED', { cause });
  } finally { owner.sampling = false; }
}

function withCleanup(cause: unknown, cleanupErrors: readonly unknown[]): unknown {
  if (cleanupErrors.length === 0) return cause;
  // Keep the initiating error as the cause; cleanup never takes its primary code.
  return new EgretError(cause instanceof EgretError ? cause.code : 'F2C_SAMPLE_FAILED', { cause, cleanupErrors });
}

/** Initial Core preparation, genuine Engine binding, then root/facade ownership. */
export function createF2CoreInstance(
  bundle: InstanceBundle, instanceScope: Scope, animationName: string, resources: InstanceResourcePort,
): F2CoreInstance {
  resources.requireReady();
  requireOpenScope(instanceScope);
  if (typeof animationName !== 'string') throw new EgretError('F2C_ANIMATION_INVALID');
  const source = bundle.animations.find(animation => animation.name === animationName);
  if (source === undefined) throw new EgretError('F2C_ANIMATION_INVALID');
  const animation = bundle.data.animations.find(value => value.name === animationName);
  if (animation === undefined) throw new EgretError('F2C_CORE_COMPATIBILITY');
  const owner: InstanceOwner = { scope: instanceScope, requireResourcesReady: resources.requireReady,
    bundle, resources, reservation: undefined,
    skeleton: undefined, renderer: undefined, animation, root: undefined, mesh: undefined, geometry: undefined,
    state: 'live', time: 0, duration: source.duration, sampling: true };
  const reservation: InstanceRetirement = FREEZE({ retire: () => retire(owner) });
  resources.reserve(reservation);
  owner.reservation = reservation;
  let touchedCore = false;
  let corePrepared = false;
  try {
    requireLifetime(owner);
    requirePremise(owner);
    touchedCore = true;
    coreRead(owner, () => { owner.skeleton = new Skeleton(bundle.data); });
    coreRead(owner, () => { owner.renderer = new SkeletonRendererCore(); });
    const geometry = prepareGeometry(owner, 0);
    corePrepared = true;
    requireLifetime(owner);
    const mesh = coreRead(owner, () => { const value = new Mesh2D(bundle.lease, geometry); owner.mesh = value; return value; });
    const root = coreRead(owner, () => { const value = new DisplayObjectContainer(); owner.root = value; return value; });
    // Mesh already carries the lease's genuine Engine affinity. Original addChild
    // binds its plain root before Scope.use can claim or clean a late owner.
    coreRead(owner, () => APPLY(ROOT_ADD, root, [mesh]));
    owner.geometry = geometry;
    coreRead(owner, () => APPLY(SCOPE_USE, instanceScope, [root]));
    requireDisplay(owner);
    const facade: F2CoreInstance = FREEZE({
      get display(): DisplayObjectContainer | undefined { return owner.root; },
      get state(): F2CoreInstanceState { return owner.state; },
      get sampleTimeSeconds(): number { return owner.time; },
      sampleAt(seconds: number): void { sampleAt(owner, seconds); },
      dispose(): void {
        const cleanupErrors = retire(owner);
        if (cleanupErrors.length !== 0) {
          throw new EgretError('F2C_INSTANCE_CLEANUP_FAILED', { cause: cleanupErrors[0], cleanupErrors: cleanupErrors.slice(1) });
        }
      },
    });
    coreRead(owner, () => APPLY(SCOPE_USE, instanceScope, [facade]));
    requireLifetime(owner);
    requireDisplay(owner);
    owner.sampling = false;
    return facade;
  } catch (cause) {
    let primary = cause;
    // Closure/group retirement outranks the error observed during preparation.
    try { recheckLifetime(owner, cause); }
    catch (terminal) { primary = terminal; }
    if (primary === cause && touchedCore && !corePrepared) {
      primary = new EgretError('F2C_SAMPLE_FAILED', { cause });
    }
    const cleanupErrors = retire(owner);
    throw withCleanup(primary, cleanupErrors);
  }
}
