// SPDX-License-Identifier: Apache-2.0
// Independently authored private F1 experiment. The external Spine runtime keeps
// its original license; this bridge is not a public SDK or full Spine support.
import {
  AssetLease, DisplayObject, DisplayObjectContainer, EgretError, Engine,
  Mesh2D, Scope, TEXTURED_FRAME_PROFILE_2D, Texture, createEngineForProfile,
  createTexturedGeometry2D, isTexture,
} from '@egret/engine';
import type {
  AssetGroup, AssetRef, EngineOptions, GameClock, GameClockHandler, GameClockState,
  GameClockSubscription, GameClockTick, ImageData2D, ScopeState, TexturedGeometry2D,
  TextureRegion2D,
} from '@egret/engine';
import {
  AnimationState, AnimationStateData, AtlasAttachmentLoader, BlendMode,
  Physics, RegionAttachment, Skeleton, SkeletonJson, SkeletonRendererCore,
  Texture as CoreTexture, TextureAtlas, TextureFilter, TextureWrap, TranslateTimeline,
} from '@esotericsoftware/spine-core';
import type { RenderCommand, SkeletonData } from '@esotericsoftware/spine-core';

export interface F1Resources {
  createInstance(scope: Scope): F1Instance;
  dispose(): void;
}
export interface F1Instance {
  readonly display: DisplayObjectContainer;
  readonly elapsedSeconds: number;
  step(deltaSeconds: number): void;
  bindClock(subscriptionScope: Scope): GameClockSubscription;
  dispose(): void;
}
export interface F1ResourceRefs {
  readonly skeleton: AssetRef<string>;
  readonly atlas: AssetRef<string>;
  readonly page: AssetRef<Texture>;
}
export interface F1ClockSession {
  readonly engine: Engine;
  createResources(scope: Scope, refs: F1ResourceRefs): Promise<F1Resources>;
}

// Retain genuine SDK operations, rather than replaceable public instance fields.
const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const CREATE_GROUP = Engine.prototype.createAssetGroup;
const ENGINE_DISPOSE = Engine.prototype.dispose;
const LEASE_VALUE = Object.getOwnPropertyDescriptor(AssetLease.prototype, 'value')!.get!;
const TEXTURE_IMAGE = Object.getOwnPropertyDescriptor(Texture.prototype, 'imageData')!.get!;
const TEXTURE_RECT = Object.getOwnPropertyDescriptor(Texture.prototype, 'sourceRect')!.get!;
const ROOT_DISPOSE = DisplayObjectContainer.prototype.dispose;
const MESH_DISPOSE = Mesh2D.prototype.dispose;
const ADD_CHILD = DisplayObjectContainer.prototype.addChild;
const SET_CONTENT = Mesh2D.prototype.setContent;
const SET_X = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'x')!.set!;
const SET_Y = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'y')!.set!;
const DISPLAY_DISPOSED = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'isDisposed')!.get!;
const ATLAS_DISPOSE = TextureAtlas.prototype.dispose;
const ENCODER = new TextEncoder();

function scopeState(scope: Scope): ScopeState {
  return APPLY(SCOPE_STATE, scope, []) as ScopeState;
}
function requireScopeOpen(scope: Scope): void {
  if (scopeState(scope) !== 'open') throw new EgretError('F1_SCOPE_CLOSED');
}
function requireCoreProfile(): void {
  // Never modify the upstream global orientation to make an observation pass.
  if (Skeleton.yDown !== false) throw new EgretError('F1_Y_UP_REQUIRED');
  const theta = 90 * (3.1415927 / 180);
  if (Math.cos(0) !== 1 || Math.sin(0) !== 0 ||
      Math.abs(Math.cos(theta)) > 2.4e-8 ||
      Math.abs(Math.sin(theta) - 1) > 2 ** -48) {
    throw new EgretError('F1_HOST_PRECISION_PREMISE_FAILED');
  }
}

interface RetainedGroup<T> {
  readonly group: AssetGroup<T>;
  readonly ready: Promise<readonly AssetLease<T>[]>;
  state(): string;
  dispose(): void;
}
function retainGroup<T>(group: AssetGroup<T>): RetainedGroup<T> {
  // Engine returns a frozen genuine facade with a receiver-authenticated getter.
  const readState = Object.getOwnPropertyDescriptor(group, 'state')!.get!;
  const readReady = Object.getOwnPropertyDescriptor(group, 'ready')!.get!;
  const dispose = group.dispose;
  return Object.freeze({
    group,
    ready: APPLY(readReady, group, []) as Promise<readonly AssetLease<T>[]>,
    state: (): string => APPLY(readState, group, []) as string,
    dispose: (): void => { APPLY(dispose, group, []); },
  });
}
function leaseValue<T>(lease: AssetLease<T>): T {
  return APPLY(LEASE_VALUE, lease, []) as T;
}
function header(lease: AssetLease<string> | undefined): string {
  if (lease === undefined) throw new EgretError('F1_HEADER_LEASE_REQUIRED');
  const text = leaseValue(lease);
  if (typeof text !== 'string' || ENCODER.encode(text).byteLength > 65536) {
    throw new EgretError('F1_HEADER_PROFILE_INVALID');
  }
  return text;
}
function collectCleanup(action: () => void, errors: unknown[]): void {
  try { action(); } catch (cause) { errors.push(cause); }
}

interface RetainedClock {
  state(): GameClockState;
  onTick(scope: Scope, handler: GameClockHandler): GameClockSubscription;
}

/** Capture only the Clock returned by our own genuine Engine construction. */
function retainClock(clock: GameClock): RetainedClock {
  const readState = Object.getOwnPropertyDescriptor(clock, 'state')!.get!;
  const readMaximum = Object.getOwnPropertyDescriptor(clock, 'maxDeltaSeconds')!.get!;
  const onTick = clock.onTick;
  // A larger valid Engine profile has already started. The factory must await
  // actual Engine cleanup before it refuses this finite animation experiment.
  const maximum = APPLY(readMaximum, clock, []) as number;
  if (maximum > 0.25) throw new EgretError('F1_CLOCK_PROFILE_UNSUPPORTED');
  APPLY(readState, clock, []);
  return Object.freeze({
    state: (): GameClockState => APPLY(readState, clock, []) as GameClockState,
    onTick: (scope: Scope, handler: GameClockHandler): GameClockSubscription =>
      APPLY(onTick, clock, [scope, handler]) as GameClockSubscription,
  });
}

interface ClockBinding {
  readonly scope: Scope;
  readonly handle: GameClockSubscription;
  isDisposed(): boolean;
  dispose(): void;
}
function retainBinding(scope: Scope, handle: GameClockSubscription): ClockBinding {
  const readDisposed = Object.getOwnPropertyDescriptor(handle, 'isDisposed')!.get!;
  const dispose = handle.dispose;
  return Object.freeze({
    scope, handle,
    isDisposed: (): boolean => APPLY(readDisposed, handle, []) as boolean,
    dispose: (): void => { APPLY(dispose, handle, []); },
  });
}

function isKnownOwnerTermination(cause: unknown): boolean {
  return cause instanceof EgretError && (
    cause.code === 'F1_RESOURCES_TERMINAL' || cause.code === 'F1_SCOPE_CLOSED' ||
    cause.code === 'F1_INSTANCE_TERMINAL' || cause.code === 'ASSET_LEASE_RELEASED' ||
    cause.code === 'TEXTURE_DISPOSED'
  );
}

type Dimensions = Readonly<{ width: number; height: number }>;
class PageWrapper extends CoreTexture {
  readonly #dimensions: Dimensions;
  #retired = false;
  public constructor() {
    const dimensions = Object.freeze({ width: 16, height: 16 });
    super(dimensions);
    this.#dimensions = dimensions;
  }
  public override getImage(): Dimensions {
    if (this.#retired) throw new EgretError('F1_PAGE_WRAPPER_RETIRED');
    return this.#dimensions;
  }
  public override setFilters(min: TextureFilter, mag: TextureFilter): void {
    if (this.#retired || min !== TextureFilter.Nearest || mag !== TextureFilter.Nearest) {
      throw new EgretError('F1_NEAREST_FILTER_REQUIRED');
    }
  }
  public override setWraps(u: TextureWrap, v: TextureWrap): void {
    if (this.#retired || u !== TextureWrap.ClampToEdge || v !== TextureWrap.ClampToEdge) {
      throw new EgretError('F1_CLAMP_WRAP_REQUIRED');
    }
  }
  public override dispose(): void {
    // This wrapper owns no Egret lease or Texture. Groups retain that ownership.
    this.#retired = true;
  }
}

function assertPage(lease: AssetLease<Texture>): void {
  const texture = leaseValue(lease);
  if (!isTexture(texture)) throw new EgretError('F1_GENUINE_TEXTURE_REQUIRED');
  const image = APPLY(TEXTURE_IMAGE, texture, []) as ImageData2D;
  const rect = APPLY(TEXTURE_RECT, texture, []) as TextureRegion2D;
  if (image.width !== 16 || image.height !== 16 || image.byteLength !== 1024 ||
      image.format !== 'rgba8unorm' || image.colorSpace !== 'srgb' ||
      image.alphaMode !== 'straight' || image.origin !== 'top-left' ||
      rect.x !== 0 || rect.y !== 0 || rect.width !== 16 || rect.height !== 16) {
    throw new EgretError('F1_WHOLE_PAGE_PROFILE_REQUIRED');
  }
}
function assertDataProfile(data: SkeletonData): void {
  const skin = data.defaultSkin, animation = data.animations[0];
  if (data.version !== '4.3.13' || data.bones.length !== 2 ||
      data.slots.length !== 2 || data.skins.length !== 1 || skin === null ||
      data.constraints.length !== 0 || data.events.length !== 0 ||
      data.animations.length !== 1 || animation?.name !== 'slide' ||
      animation.duration !== 1) throw new EgretError('F1_SKELETON_PROFILE_REQUIRED');
  const attachments = skin.getAttachments();
  if (attachments.length !== 2) throw new EgretError('F1_REGION_PROFILE_REQUIRED');
  const timeline = animation.timelines[0];
  if (animation.timelines.length !== 1 || !(timeline instanceof TranslateTimeline) || timeline.boneIndex !== 1) {
    throw new EgretError('F1_TRANSLATION_TIMELINE_REQUIRED');
  }
  for (const slot of data.slots) {
    if (slot.blendMode !== BlendMode.Normal || slot.setupPose.darkColor !== null) {
      throw new EgretError('F1_NORMAL_LIGHT_TINT_REQUIRED');
    }
  }
  for (const entry of attachments) {
    const attachment = entry.attachment;
    if (!(attachment instanceof RegionAttachment) || attachment.sequence.regions.length !== 1) {
      throw new EgretError('F1_REGION_PROFILE_REQUIRED');
    }
  }
}

/** Copy only active canonical commands while their pooled ranges are still valid. */
function materialize(
  head: RenderCommand | undefined,
  pages: WeakMap<object, AssetLease<Texture>>,
): readonly TexturedGeometry2D[] {
  const seen = new Set<RenderCommand>(), commands: RenderCommand[] = [];
  let vertices = 0, indices = 0;
  for (let command = head; command !== undefined; command = command.next) {
    if (seen.has(command) || commands.length >= 32) throw new EgretError('F1_COMMAND_TRAVERSAL_INVALID');
    seen.add(command);
    const count = command.numVertices, indexCount = command.numIndices;
    const texture: unknown = command.texture;
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(indexCount) || indexCount < 0 ||
        command.positions.length < count * 2 || command.uvs.length < count * 2 ||
        command.colors.length < count || command.darkColors.length < count || command.indices.length < indexCount ||
        command.blendMode !== BlendMode.Normal || typeof texture !== 'object' || texture === null || !pages.has(texture)) {
      throw new EgretError('F1_COMMAND_PROFILE_INVALID');
    }
    vertices += count; indices += indexCount;
    if (vertices > 4096 || indices > 12288) throw new EgretError('F1_COMMAND_CAPACITY_EXCEEDED');
    commands.push(command);
  }
  // This is the separately observed exact F1 protocol, not a general batching rule.
  if (commands.length !== 2 || commands.some(command => command.numVertices !== 4 || command.numIndices !== 6)) {
    throw new EgretError('F1_TWO_QUAD_PROTOCOL_REQUIRED');
  }
  const geometries: TexturedGeometry2D[] = [];
  for (const command of commands) {
    const positions = new Float64Array(command.numVertices * 2);
    const uvs = new Float64Array(command.numVertices * 2);
    const lightColors = new Float64Array(command.numVertices * 4);
    const ownedIndices = new Uint16Array(command.numIndices);
    for (let vertex = 0; vertex < command.numVertices; vertex++) {
      positions[vertex * 2] = command.positions[vertex * 2]!;
      positions[vertex * 2 + 1] = -command.positions[vertex * 2 + 1]!;
      uvs[vertex * 2] = command.uvs[vertex * 2]!;
      uvs[vertex * 2 + 1] = command.uvs[vertex * 2 + 1]!;
      if (command.darkColors[vertex] !== 0) throw new EgretError('F1_DARK_TINT_UNSUPPORTED');
      const packed = command.colors[vertex]!;
      // Interop for the pinned core's numeric AARRGGBB protocol. Float64 preserves
      // exact integer-channel / 255 values; no second Float32 quantization occurs.
      lightColors[vertex * 4] = ((packed >>> 16) & 255) / 255;
      lightColors[vertex * 4 + 1] = ((packed >>> 8) & 255) / 255;
      lightColors[vertex * 4 + 2] = (packed & 255) / 255;
      lightColors[vertex * 4 + 3] = (packed >>> 24) / 255;
    }
    for (let index = 0; index < command.numIndices; index++) ownedIndices[index] = command.indices[index]!;
    geometries.push(createTexturedGeometry2D({ positions, uvs, lightColors, indices: ownedIndices }));
  }
  return Object.freeze(geometries);
}

class ManualInstance implements F1Instance {
  readonly #root = new DisplayObjectContainer();
  readonly #meshes: Mesh2D[] = [];
  readonly #scope: Scope;
  readonly #page: AssetLease<Texture>;
  readonly #pages: WeakMap<object, AssetLease<Texture>>;
  readonly #assertResources: () => void;
  readonly #onRetired: () => void;
  readonly #clock: RetainedClock | undefined;
  #binding: ClockBinding | undefined;
  #skeleton: Skeleton | undefined;
  #animation: AnimationState | undefined;
  #renderer: SkeletonRendererCore | undefined;
  #lifetime: 'live' | 'failed' | 'closed' = 'live';
  #elapsed = 0;
  #stepping = false;

  public constructor(
    scope: Scope, data: SkeletonData, page: AssetLease<Texture>,
    pages: WeakMap<object, AssetLease<Texture>>, assertResources: () => void,
    onRetired: () => void, clock: RetainedClock | undefined,
  ) {
    this.#scope = scope; this.#page = page; this.#pages = pages;
    this.#assertResources = assertResources; this.#onRetired = onRetired; this.#clock = clock;
    try {
      this.#assertLive(); requireCoreProfile();
      const skeleton = new Skeleton(data), mix = new AnimationStateData(data);
      mix.defaultMix = 0;
      const animation = new AnimationState(mix), renderer = new SkeletonRendererCore();
      this.#skeleton = skeleton; this.#animation = animation; this.#renderer = renderer;
      animation.setAnimation(0, 'slide', false);
      animation.apply(skeleton); skeleton.updateWorldTransform(Physics.none);
      const geometries = materialize(renderer.render(skeleton, false, undefined, 2), pages);
      APPLY(SET_X, this.#root, [24]); APPLY(SET_Y, this.#root, [24]);
      for (const geometry of geometries) {
        this.#assertLive();
        const mesh = new Mesh2D(page, geometry);
        this.#meshes.push(mesh);
        APPLY(ADD_CHILD, this.#root, [mesh]);
        this.#assertLive();
      }
      // The bound root authenticates Engine affinity, including foreign Scopes.
      APPLY(SCOPE_USE, scope, [this.#root]); this.#assertLive();
      Object.freeze(this);
      // Cleanup is registered last, after the entire original owned subtree.
      APPLY(SCOPE_USE, scope, [this]); this.#assertLive();
    } catch (cause) {
      const cleanupErrors: unknown[] = [];
      collectCleanup(() => this.#retire(), cleanupErrors);
      if (cleanupErrors.length !== 0) {
        throw new EgretError(cause instanceof EgretError ? cause.code : 'F1_INSTANCE_CREATE_FAILED', { cause, cleanupErrors });
      }
      throw cause;
    }
  }
  public get display(): DisplayObjectContainer { return this.#root; }
  public get elapsedSeconds(): number { return this.#elapsed; }

  #assertLive(): void {
    this.#assertResources(); requireScopeOpen(this.#scope);
    if (this.#lifetime !== 'live' || APPLY(DISPLAY_DISPOSED, this.#root, []) ||
        this.#meshes.some(mesh => APPLY(DISPLAY_DISPOSED, mesh, []))) {
      throw new EgretError('F1_INSTANCE_TERMINAL');
    }
  }

  #assertBindingReleased(): void {
    const binding = this.#binding;
    if (binding === undefined) return;
    const state = scopeState(binding.scope);
    // Retain the closing tombstone even if an abort callback already retired the
    // genuine handle. Manual movement cannot precede Scope ownership cleanup.
    if (state === 'closing') throw new EgretError('F1_CLOCK_SCOPE_CLOSED');
    if (state === 'closed' || binding.isDisposed()) { this.#binding = undefined; return; }
    throw new EgretError('F1_CLOCK_BOUND');
  }

  #retireBinding(): void {
    const binding = this.#binding;
    if (binding === undefined) return;
    binding.dispose();
    if (scopeState(binding.scope) !== 'closing') this.#binding = undefined;
  }

  #onTick(tick: GameClockTick): undefined {
    const binding = this.#binding;
    if (binding === undefined) return undefined;
    try {
      // A real Scope abort can reenter advanceTime before reverse cleanup reaches
      // this handle. Check its intrinsic state before any animation core work.
      if (binding.isDisposed() || scopeState(binding.scope) !== 'open' || this.#clock!.state() !== 'running') {
        this.#retireBinding(); return undefined;
      }
      try { this.#assertLive(); }
      catch (cause) {
        if (!isKnownOwnerTermination(cause)) throw cause;
        this.#retireBinding(); return undefined;
      }
      requireCoreProfile();
      // Exactly the delivered delta, exactly once: no seek, subdivision or debt.
      this.#advancePositive(tick.deltaSeconds);
      return undefined;
    } catch (cause) {
      // Retained genuine disposal is synchronous and invokes no external code.
      // Preserve the exact advance failure for the Clock's own diagnostic/cause.
      this.#retireBinding();
      throw cause;
    }
  }

  public bindClock(subscriptionScope: Scope): GameClockSubscription {
    this.#assertLive(); requireCoreProfile(); this.#assertBindingReleased();
    const clock = this.#clock;
    if (clock === undefined) throw new EgretError('F1_CLOCK_CONTEXT_REQUIRED');
    // Authentic affinity, Scope state and capacity admission belong to Clock.
    // A refused registration publishes no mode, time or geometry change.
    const handle = clock.onTick(subscriptionScope, (tick: GameClockTick): undefined => this.#onTick(tick));
    const dispose = handle.dispose;
    try {
      this.#binding = retainBinding(subscriptionScope, handle);
      return handle;
    } catch (cause) {
      APPLY(dispose, handle, []);
      throw cause;
    }
  }

  public readonly step = (deltaSeconds: number): void => {
    this.#assertLive(); requireCoreProfile(); this.#assertBindingReleased();
    if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 0.25) {
      throw new EgretError('F1_DELTA_INVALID');
    }
    if (this.#stepping) throw new EgretError('F1_STEP_REENTRANT');
    // Zero is a true no-op: it preserves both time and existing geometry slots.
    if (deltaSeconds === 0) return;
    this.#advancePositive(deltaSeconds);
  };

  #advancePositive(deltaSeconds: number): void {
    if (this.#stepping) throw new EgretError('F1_STEP_REENTRANT');
    const nextElapsed = this.#elapsed + deltaSeconds;
    if (!Number.isFinite(nextElapsed)) throw new EgretError('F1_ELAPSED_INVALID');
    this.#stepping = true;
    let advanced = false;
    try {
      this.#assertLive();
      const skeleton = this.#skeleton!, animation = this.#animation!, renderer = this.#renderer!;
      advanced = true;
      skeleton.update(deltaSeconds); animation.update(deltaSeconds);
      animation.apply(skeleton); skeleton.updateWorldTransform(Physics.none);
      const geometries = materialize(renderer.render(skeleton, false, undefined, 2), this.#pages);
      this.#assertLive();
      // Admit all owned geometries before publishing any leaf content. Existing
      // display operations still provide their own Engine/lifetime admission.
      for (let index = 0; index < this.#meshes.length; index++) {
        this.#assertLive();
        APPLY(SET_CONTENT, this.#meshes[index]!, [this.#page, geometries[index]!]);
        this.#assertLive();
      }
      this.#elapsed = nextElapsed;
    } catch (cause) {
      // No rollback claim: a partially advanced core becomes permanently inert.
      // Completed staging failures leave prior display geometry untouched.
      if (advanced && this.#lifetime === 'live') this.#lifetime = 'failed';
      throw cause;
    } finally { this.#stepping = false; }
  }
  #retire(): void {
    if (this.#lifetime === 'closed') return;
    this.#lifetime = 'closed';
    const errors: unknown[] = [];
    // Own driving retires before core references, leaves or the shared page.
    collectCleanup(() => this.#retireBinding(), errors);
    this.#binding = undefined;
    this.#onRetired();
    this.#skeleton = undefined; this.#animation = undefined; this.#renderer = undefined;
    for (let index = this.#meshes.length - 1; index >= 0; index--) {
      collectCleanup(() => { APPLY(MESH_DISPOSE, this.#meshes[index]!, []); }, errors);
    }
    collectCleanup(() => { APPLY(ROOT_DISPOSE, this.#root, []); }, errors);
    if (errors.length !== 0) throw new EgretError('F1_INSTANCE_CLEANUP_FAILED', { cause: errors[0], cleanupErrors: errors.slice(1) });
  }
  public readonly dispose = (): void => { this.#retire(); };
}

class ManualResources implements F1Resources {
  readonly #scope: Scope;
  readonly #headers: RetainedGroup<string>;
  readonly #pageGroup: RetainedGroup<Texture>;
  readonly #page: AssetLease<Texture>;
  readonly #atlas: TextureAtlas;
  readonly #data: SkeletonData;
  readonly #pages: WeakMap<object, AssetLease<Texture>>;
  readonly #clock: RetainedClock | undefined;
  readonly #instances = new Set<ManualInstance>();
  #live = true;
  public constructor(
    scope: Scope, headers: RetainedGroup<string>, pageGroup: RetainedGroup<Texture>,
    page: AssetLease<Texture>, atlas: TextureAtlas, data: SkeletonData,
    pages: WeakMap<object, AssetLease<Texture>>, clock: RetainedClock | undefined,
  ) {
    this.#scope = scope; this.#headers = headers; this.#pageGroup = pageGroup;
    this.#page = page; this.#atlas = atlas; this.#data = data; this.#pages = pages; this.#clock = clock;
    Object.freeze(this);
  }
  #assertReady(): void {
    if (!this.#live || this.#headers.state() !== 'ready' || this.#pageGroup.state() !== 'ready') {
      throw new EgretError('F1_RESOURCES_TERMINAL');
    }
    requireScopeOpen(this.#scope);
    assertPage(this.#page);
  }
  public createInstance(scope: Scope): F1Instance {
    this.#assertReady(); requireCoreProfile();
    if (this.#instances.size >= 2) throw new EgretError('F1_INSTANCE_CAPACITY_EXCEEDED');
    let instance: ManualInstance | undefined;
    try {
      instance = new ManualInstance(scope, this.#data, this.#page, this.#pages,
        () => this.#assertReady(), () => { if (instance !== undefined) this.#instances.delete(instance); }, this.#clock);
      this.#instances.add(instance);
      this.#assertReady();
      return instance;
    } catch (cause) {
      const cleanupErrors: unknown[] = [];
      if (instance !== undefined) collectCleanup(instance.dispose, cleanupErrors);
      if (cleanupErrors.length !== 0) throw new EgretError('F1_INSTANCE_CREATE_FAILED', { cause, cleanupErrors });
      throw cause;
    }
  }
  public readonly dispose = (): void => {
    if (!this.#live) return;
    // Terminal state precedes every callback and every shared borrow release.
    this.#live = false;
    const errors: unknown[] = [];
    for (const instance of [...this.#instances].reverse()) collectCleanup(instance.dispose, errors);
    this.#instances.clear();
    collectCleanup(() => { APPLY(ATLAS_DISPOSE, this.#atlas, []); }, errors);
    collectCleanup(this.#pageGroup.dispose, errors);
    collectCleanup(this.#headers.dispose, errors);
    if (errors.length !== 0) throw new EgretError('F1_RESOURCE_CLEANUP_FAILED', { cause: errors[0], cleanupErrors: errors.slice(1) });
  };
}

/** Real public SDK acquisition and private official-core assembly for original F1. */
export async function createF1ManualResources(
  engine: Engine, resourceScope: Scope, refs: F1ResourceRefs,
): Promise<F1Resources> {
  // This legacy entry deliberately has no authenticated Clock context.
  return acquireResources(engine, resourceScope, refs, undefined);
}

async function acquireResources(
  engine: Engine, resourceScope: Scope, refs: F1ResourceRefs, clock: RetainedClock | undefined,
): Promise<F1Resources> {
  let headers: RetainedGroup<string> | undefined, pageGroup: RetainedGroup<Texture> | undefined;
  let atlas: TextureAtlas | undefined, wrapper: PageWrapper | undefined, resources: ManualResources | undefined;
  try {
    requireCoreProfile(); requireScopeOpen(resourceScope);
    const skeletonRef = refs.skeleton, atlasRef = refs.atlas, pageRef = refs.page;
    requireScopeOpen(resourceScope);
    headers = retainGroup(APPLY(CREATE_GROUP, engine,
      [resourceScope, [skeletonRef, atlasRef], { concurrency: 2 }]) as AssetGroup<string>);
    const headerLeases = await headers.ready;
    requireScopeOpen(resourceScope);
    if (headers.state() !== 'ready' || headerLeases.length !== 2) throw new EgretError('F1_HEADERS_NOT_READY');
    const skeletonText = header(headerLeases[0]), atlasText = header(headerLeases[1]);
    atlas = new TextureAtlas(atlasText);
    const actualPage = atlas.pages[0];
    if (atlas.pages.length !== 1 || actualPage === undefined || actualPage.name !== 'egret-original-page.png' ||
        actualPage.width !== 16 || actualPage.height !== 16 || actualPage.pma ||
        atlas.regions.length !== 2 || atlas.regions.some(region => region.degrees !== 0 ||
          region.offsetX !== 0 || region.offsetY !== 0 || region.width !== region.originalWidth ||
          region.height !== region.originalHeight)) throw new EgretError('F1_ATLAS_PROFILE_REQUIRED');
    requireScopeOpen(resourceScope);
    if (headers.state() !== 'ready') throw new EgretError('F1_HEADERS_NOT_READY');
    pageGroup = retainGroup(APPLY(CREATE_GROUP, engine,
      [resourceScope, [pageRef], { concurrency: 1 }]) as AssetGroup<Texture>);
    const pageLeases = await pageGroup.ready;
    requireScopeOpen(resourceScope);
    const page = pageLeases[0];
    if (headers.state() !== 'ready' || pageGroup.state() !== 'ready' || pageLeases.length !== 1 || page === undefined) {
      throw new EgretError('F1_PAGE_NOT_READY');
    }
    assertPage(page);
    wrapper = new PageWrapper(); actualPage.setTexture(wrapper);
    const pages = new WeakMap<object, AssetLease<Texture>>(); pages.set(wrapper, page);
    const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(skeletonText);
    assertDataProfile(data);
    resources = new ManualResources(resourceScope, headers, pageGroup, page, atlas, data, pages, clock);
    // The ready facade is registered after both groups, giving reverse Scope
    // cleanup the required instance-before-wrapper-before-borrow ordering.
    APPLY(SCOPE_USE, resourceScope, [resources]);
    requireScopeOpen(resourceScope);
    if (headers.state() !== 'ready' || pageGroup.state() !== 'ready') throw new EgretError('F1_RESOURCES_TERMINAL');
    return resources;
  } catch (cause) {
    const cleanupErrors: unknown[] = [];
    if (resources !== undefined) collectCleanup(resources.dispose, cleanupErrors);
    else {
      if (wrapper !== undefined) collectCleanup(() => wrapper!.dispose(), cleanupErrors);
      if (atlas !== undefined) collectCleanup(() => { APPLY(ATLAS_DISPOSE, atlas!, []); }, cleanupErrors);
      if (pageGroup !== undefined) collectCleanup(pageGroup.dispose, cleanupErrors);
      if (headers !== undefined) collectCleanup(headers.dispose, cleanupErrors);
    }
    throw new EgretError('F1_RESOURCE_LOAD_FAILED', { cause, cleanupErrors });
  }
}

/** Experiment-only trusted construction; callers supply no Clock or context. */
export async function createF1ClockSession(options: EngineOptions): Promise<F1ClockSession> {
  // Preserve SDK option/port/startup admission and its own startup cleanup.
  const engine = await createEngineForProfile(options, TEXTURED_FRAME_PROFILE_2D);
  try {
    const clock = retainClock(engine.clock);
    return Object.freeze({
      engine,
      createResources: (scope: Scope, refs: F1ResourceRefs): Promise<F1Resources> =>
        acquireResources(engine, scope, refs, clock),
    });
  } catch (cause) {
    // Construction succeeded, so capture/profile refusal must observe genuine
    // host shutdown. Unsafe or timed-out cleanup cannot become successful refusal.
    try { await (APPLY(ENGINE_DISPOSE, engine, []) as Promise<void>); }
    catch (cleanupError) {
      throw new EgretError('F1_CLOCK_SESSION_CLEANUP_FAILED', { cause, cleanupErrors: [cleanupError] });
    }
    throw cause;
  }
}
