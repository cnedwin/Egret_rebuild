// SPDX-License-Identifier: Apache-2.0
// This optional experiment borrows a page through genuine public Egret owners.
import { AssetLease, Engine, EgretError, Scope, Texture, copyImageData2DPixels, isImageData2D, isTexture } from '@egret/engine';
import type { AssetGroup, AssetGroupState, AssetRef, ImageData2D } from '@egret/engine';
import type { SpineImportInput } from '@egret/project/spine';
import {
  AtlasAttachmentLoader, BlendMode, DeformTimeline, Inherit, MeshAttachment,
  RegionAttachment, Skeleton, SkeletonJson, Texture as CoreTexture, TextureAtlas,
  TextureFilter, TextureWrap, TranslateTimeline,
} from '@esotericsoftware/spine-core';
import type { SkeletonData } from '@esotericsoftware/spine-core';
import { createF2MeshProfilePlan } from '../../spine-f2/dist/index.js';
import type { F2MeshProfilePlan } from '../../spine-f2/dist/index.js';
import type { F2CoreCreateOptions, F2CoreInstance, F2CoreResources } from './types.js';
import { createF2CoreInstance } from './instance.js';
import type { InstanceRetirement } from './instance.js';

const APPLY = Reflect.apply;
const GET_PROTOTYPE = Object.getPrototypeOf;
const OWN_KEYS = Reflect.ownKeys;
const DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_PROTOTYPE = Object.prototype;
const FREEZE = Object.freeze;
const SCOPE_STATE = DESCRIPTOR(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const CREATE_GROUP = Engine.prototype.createAssetGroup;
const LEASE_VALUE = DESCRIPTOR(AssetLease.prototype, 'value')!.get!;
const TEXTURE_IMAGE = DESCRIPTOR(Texture.prototype, 'imageData')!.get!;
const TEXTURE_RECT = DESCRIPTOR(Texture.prototype, 'sourceRect')!.get!;
const TEXTURE_DISPOSED = DESCRIPTOR(Texture.prototype, 'isDisposed')!.get!;
const ATLAS_DISPOSE = TextureAtlas.prototype.dispose;

interface GroupOwner {
  readonly value: AssetGroup<Texture>;
  readonly state: () => AssetGroupState;
  readonly ready: Promise<readonly AssetLease<Texture>[]>;
  readonly dispose: () => void;
}

/** Retained only while ready; no Core data or lease escapes the public facade. */
interface ReadyBundle {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly group: GroupOwner;
  readonly lease: AssetLease<Texture>;
  readonly profile: F2MeshProfilePlan;
  readonly wrapper: DimensionTexture;
  readonly atlas: TextureAtlas;
  readonly data: SkeletonData;
}

interface ResourceOwner {
  scope: Scope | undefined;
  group: GroupOwner | undefined;
  wrapper: DimensionTexture | undefined;
  atlas: TextureAtlas | undefined;
  bundle: ReadyBundle | undefined;
  readonly instances: Set<InstanceRetirement>;
  creatingInstance: boolean;
  retired: boolean;
  cleanupAttempted: boolean;
}

// This is a dimension descriptor, never a DOM image, Texture lease or GPU owner.
class DimensionTexture extends CoreTexture {
  #retired = false;

  public constructor(width: number, height: number) {
    super(FREEZE({ width, height }));
  }

  public override setFilters(min: TextureFilter, mag: TextureFilter): void {
    if (this.#retired || min !== TextureFilter.Nearest || mag !== TextureFilter.Nearest) {
      throw new EgretError('F2C_CORE_COMPATIBILITY');
    }
  }

  public override setWraps(u: TextureWrap, v: TextureWrap): void {
    if (this.#retired || u !== TextureWrap.ClampToEdge || v !== TextureWrap.ClampToEdge) {
      throw new EgretError('F2C_CORE_COMPATIBILITY');
    }
  }

  public override dispose(): void { this.#retired = true; }
}

const WRAPPER_DISPOSE = DimensionTexture.prototype.dispose;

function requireOpenScope(scope: unknown): asserts scope is Scope {
  let state: unknown;
  try { state = APPLY(SCOPE_STATE, scope, []); }
  catch (cause) { throw new EgretError('F2C_SCOPE_INVALID', { cause }); }
  if (state !== 'open') throw new EgretError('F2C_SCOPE_CLOSED');
}

/** Even a thrown undefined is subordinate to the original Scope state. */
function scopeRead<T>(scope: Scope, read: () => T, code: string): T {
  let value!: T;
  let failed = false;
  let cause: unknown;
  try { value = read(); }
  catch (error) { failed = true; cause = error; }
  requireOpenScope(scope);
  if (failed) throw new EgretError(code, { cause });
  return value;
}

function requireReady(owner: ResourceOwner): void {
  const scope = owner.scope;
  if (scope === undefined || owner.retired) throw new EgretError('F2C_RESOURCES_TERMINAL');
  requireOpenScope(scope);
  if (owner.group === undefined || owner.group.state() !== 'ready') {
    throw new EgretError('F2C_RESOURCES_TERMINAL');
  }
}

/** Recheck both terminal gates after Core/public calls, including their throws. */
function readyRead<T>(owner: ResourceOwner, read: () => T, code: string): T {
  requireReady(owner);
  const scope = owner.scope!;
  let value!: T;
  let failed = false;
  let cause: unknown;
  try { value = read(); }
  catch (error) { failed = true; cause = error; }
  // A late Scope.use can retire this owner while reporting closure. Keep the
  // genuine original Scope reference so closure still outranks that callback.
  requireOpenScope(scope);
  requireReady(owner);
  if (failed) throw new EgretError(code, { cause });
  return value;
}

function ownOptions(scope: Scope, options: unknown): { input: SpineImportInput; pageRef: AssetRef<Texture> } {
  if (options === null || typeof options !== 'object') throw new EgretError('F2C_INPUT_INVALID');
  const prototype = scopeRead(scope, () => GET_PROTOTYPE(options), 'F2C_INPUT_INVALID');
  if (prototype !== OBJECT_PROTOTYPE && prototype !== null) throw new EgretError('F2C_INPUT_INVALID');
  const keys = scopeRead(scope, () => OWN_KEYS(options), 'F2C_INPUT_INVALID');
  if (keys.length !== 2 || !keys.includes('input') || !keys.includes('pageRef')) {
    throw new EgretError('F2C_INPUT_INVALID');
  }
  const input = scopeRead(scope, () => DESCRIPTOR(options, 'input'), 'F2C_INPUT_INVALID');
  if (input === undefined || !('value' in input)) throw new EgretError('F2C_INPUT_INVALID');
  const pageRef = scopeRead(scope, () => DESCRIPTOR(options, 'pageRef'), 'F2C_INPUT_INVALID');
  if (pageRef === undefined || !('value' in pageRef)) throw new EgretError('F2C_INPUT_INVALID');
  return { input: input.value as SpineImportInput, pageRef: pageRef.value as AssetRef<Texture> };
}

function requirePageId(scope: Scope, pageRef: unknown, expectedId: string): asserts pageRef is AssetRef<Texture> {
  if (pageRef === null || typeof pageRef !== 'object') throw new EgretError('F2C_INPUT_INVALID');
  const descriptor = scopeRead(scope, () => DESCRIPTOR(pageRef, 'id'), 'F2C_INPUT_INVALID');
  if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'string') {
    throw new EgretError('F2C_INPUT_INVALID');
  }
  if (descriptor.value !== expectedId) throw new EgretError('F2C_PAGE_BINDING');
  // ID comparison grants no ref/Engine/provider authority. The original group
  // operation below is the sole membership and acquisition admission boundary.
}

function capturedGroup(group: AssetGroup<Texture>): GroupOwner {
  // This frozen facade came directly from the captured genuine Engine operation.
  // Its accessors are retained as operations, not invented ownership evidence.
  const state = DESCRIPTOR(group, 'state')!.get!;
  const ready = DESCRIPTOR(group, 'ready')!.get!;
  const dispose = DESCRIPTOR(group, 'dispose')!.value as () => void;
  return FREEZE({ value: group,
    state: () => APPLY(state, group, []) as AssetGroupState,
    ready: APPLY(ready, group, []) as Promise<readonly AssetLease<Texture>[]>,
    dispose: () => { APPLY(dispose, group, []); },
  });
}

function qualifiedPage(owner: ResourceOwner, lease: AssetLease<Texture>, profile: F2MeshProfilePlan): ImageData2D {
  return readyRead(owner, () => {
    const texture: unknown = APPLY(LEASE_VALUE, lease, []);
    if (!isTexture(texture) || APPLY(TEXTURE_DISPOSED, texture, []) !== false) {
      throw new EgretError('F2C_PAGE_PROFILE');
    }
    const image = APPLY(TEXTURE_IMAGE, texture, []) as ImageData2D;
    const rect = APPLY(TEXTURE_RECT, texture, []) as Texture['sourceRect'];
    if (!isImageData2D(image) || image.width !== profile.page.width || image.height !== profile.page.height
      || rect.x !== 0 || rect.y !== 0 || rect.width !== image.width || rect.height !== image.height
      || image.format !== 'rgba8unorm' || image.colorSpace !== 'srgb' || image.alphaMode !== 'straight'
      || image.origin !== 'top-left' || image.bytesPerRow !== image.width * 4
      || image.byteLength !== image.width * image.height * 4) throw new EgretError('F2C_PAGE_PROFILE');
    // The public copy operation authenticates owned pixels and exact tight bytes.
    if (copyImageData2DPixels(image).byteLength !== image.byteLength) throw new EgretError('F2C_PAGE_PROFILE');
    return image;
  }, 'F2C_PAGE_PROFILE');
}

function compatible(condition: boolean): asserts condition {
  if (!condition) throw new EgretError('F2C_CORE_COMPATIBILITY');
}

function white(color: { r: number; g: number; b: number; a: number }): boolean {
  return color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1;
}

interface OwnedAttachment {
  readonly name?: string;
  readonly vertices?: readonly number[];
  readonly uvs?: readonly number[];
  readonly triangles?: readonly number[];
}
interface OwnedSkeleton {
  readonly skins: readonly { readonly attachments: Readonly<Record<string, Readonly<Record<string, OwnedAttachment>>>> }[];
}

function sameFloatArray(actual: ArrayLike<number>, source: readonly number[] | undefined): boolean {
  if (source === undefined || actual.length !== source.length) return false;
  for (let index = 0; index < source.length; index++) {
    if (actual[index] !== Math.fround(source[index]!)) return false;
  }
  return true;
}

/** Compare admitted source metadata and original topology; do not evaluate poses. */
function qualifyCore(profile: F2MeshProfilePlan, wrapper: DimensionTexture, atlas: TextureAtlas, data: SkeletonData): void {
  const expectedPage = profile.sourcePlan.sp1.pages[0];
  const page = atlas.pages[0];
  compatible(expectedPage !== undefined && page !== undefined && atlas.pages.length === 1);
  compatible(page.name === profile.page.pageName && page.width === profile.page.width && page.height === profile.page.height
    && page.minFilter === TextureFilter.Nearest && page.magFilter === TextureFilter.Nearest
    && page.uWrap === TextureWrap.ClampToEdge && page.vWrap === TextureWrap.ClampToEdge
    && page.pma === false && page.texture === wrapper);
  compatible(atlas.regions.length === profile.page.regionCount && page.regions.length === atlas.regions.length);
  for (let index = 0; index < expectedPage.regions.length; index++) {
    const source = expectedPage.regions[index]!;
    const actual = atlas.regions[index];
    compatible(actual !== undefined && actual.page === page && page.regions[index] === actual
      && actual.texture === wrapper && actual.name === source.name
      && actual.x === source.x && actual.y === source.y && actual.width === source.width && actual.height === source.height
      && actual.degrees === source.rotation && actual.offsetX === source.offsetLeft && actual.offsetY === source.offsetBottom
      && actual.originalWidth === source.originalWidth && actual.originalHeight === source.originalHeight
      && actual.index === source.index && actual.names === null && actual.values === null
      && actual.u === source.x / page.width && actual.v === source.y / page.height
      && actual.u2 === (source.x + source.width) / page.width && actual.v2 === (source.y + source.height) / page.height);
  }
  compatible(data.version === '4.3.13' && data.bones.length === profile.bones.length
    && data.slots.length === profile.slots.length && data.animations.length === profile.animations.length
    && data.constraints.length === 0 && data.events.length === 0
    && data.skins.length === 1 && data.defaultSkin !== null && data.skins[0] === data.defaultSkin
    && data.defaultSkin.name === 'default');
  for (let index = 0; index < profile.bones.length; index++) {
    const source = profile.bones[index]!;
    const actual = data.bones[index];
    compatible(actual !== undefined && actual.index === index && actual.name === source.name
      && actual.parent === (source.parentIndex === -1 ? null : data.bones[source.parentIndex])
      && actual.setupPose.x === source.x && actual.setupPose.y === source.y
      && actual.setupPose.rotation === 0 && actual.setupPose.scaleX === 1 && actual.setupPose.scaleY === 1
      && actual.setupPose.shearX === 0 && actual.setupPose.shearY === 0
      && actual.setupPose.inherit === Inherit.Normal && actual.skinRequired === false);
  }
  const skin = data.defaultSkin;
  compatible(skin !== null && skin.bones.length === 0 && skin.constraints.length === 0);
  const entries = skin.getAttachments();
  compatible(entries.length === profile.attachments.length);
  // This second JSON read only accesses already-owned admitted topology. It
  // supplies no new source admission or caller-plan authority to the Core reader.
  const original = JSON.parse(profile.ownedInput.skeleton.text) as OwnedSkeleton;
  for (const source of profile.attachments) {
    const matching = entries.filter(entry => entry.slotIndex === source.slotIndex && entry.placeholder === source.attachmentName);
    compatible(matching.length === 1);
    const actual = matching[0]!.attachment;
    const slotName = profile.slots[source.slotIndex]!.name;
    const sourceAttachment = original.skins[0]?.attachments[slotName]?.[source.attachmentName];
    compatible(sourceAttachment !== undefined && actual.name === (sourceAttachment.name ?? source.attachmentName));
    if (source.kind === 'mesh') {
      compatible(actual instanceof MeshAttachment && actual.bones === null && actual.getSourceMesh() === null
        && actual.worldVerticesLength === source.vertexCount * 2 && actual.vertices.length === source.vertexCount * 2
        && actual.triangles.length === source.indexCount && sameFloatArray(actual.vertices, sourceAttachment.vertices)
        && sameFloatArray(actual.regionUVs, sourceAttachment.uvs));
      const triangles = sourceAttachment.triangles;
      compatible(triangles !== undefined && triangles.length === actual.triangles.length);
      for (let index = 0; index < triangles.length; index++) compatible(actual.triangles[index] === triangles[index]);
    } else compatible(actual instanceof RegionAttachment && source.vertexCount === 4 && source.indexCount === 6);
    compatible(actual instanceof MeshAttachment || actual instanceof RegionAttachment);
    compatible(actual.path === source.path && white(actual.color) && actual.sequence.regions.length === 1
      && actual.sequence.regions[0] === atlas.findRegion(source.path)
      && actual.sequence.hasPathSuffix() === false && actual.sequence.setupIndex === 0);
  }
  let setupVertices = 0;
  let setupIndices = 0;
  let setupAttachments = 0;
  for (let index = 0; index < profile.slots.length; index++) {
    const source = profile.slots[index]!;
    const actual = data.slots[index];
    compatible(actual !== undefined && actual.index === index && actual.name === source.name
      && actual.boneData === data.bones[source.boneIndex] && actual.blendMode === BlendMode.Normal
      && white(actual.setupPose.color) && actual.setupPose.darkColor === null);
    if (source.attachmentPointer === null) compatible(actual.attachmentName === null);
    else {
      const attachment = profile.attachments.find(item => item.pointer === source.attachmentPointer);
      compatible(attachment !== undefined && attachment.slotIndex === index
        && actual.attachmentName === attachment.attachmentName
        && skin.getAttachment(index, attachment.attachmentName) !== null);
      setupVertices += attachment.vertexCount;
      setupIndices += attachment.indexCount;
      setupAttachments++;
    }
  }
  compatible(setupVertices === profile.sourcePlan.setup.vertexCount && setupIndices === profile.sourcePlan.setup.indexCount
    && setupAttachments === profile.sourcePlan.setup.attachmentCount);
  for (let index = 0; index < profile.animations.length; index++) {
    const source = profile.animations[index]!;
    const actual = data.animations[index];
    compatible(actual !== undefined && actual.name === source.name && actual.duration === Math.fround(source.duration)
      && actual.timelines.length === source.timelineCount);
    // Source object field order need not equal Core's timeline grouping order.
    const remaining = [...source.timelines];
    for (const timeline of actual.timelines) {
      const matched = remaining.findIndex(expected => expected.kind === 'translate'
        ? timeline instanceof TranslateTimeline && timeline.boneIndex === expected.boneIndex
        : timeline instanceof DeformTimeline && timeline.slotIndex === expected.slotIndex
          && profile.attachments.some(attachment => attachment.pointer === expected.attachmentPointer
            && skin.getAttachment(attachment.slotIndex, attachment.attachmentName) === timeline.attachment));
      compatible(matched >= 0);
      const expected = remaining.splice(matched, 1)[0]!;
      compatible(timeline.getFrameCount() === expected.keyframeCount && timeline.frames[0] === Math.fround(expected.firstTime)
        && timeline.getDuration() === Math.fround(expected.lastTime));
    }
    compatible(remaining.length === 0);
  }
}

/** Terminal admission and cleanup-attempt state are distinct; collect actual
 * instances before clearing the Core bundle or releasing shared page demand. */
function retire(owner: ResourceOwner): readonly unknown[] {
  owner.retired = true;
  if (owner.cleanupAttempted) return [];
  owner.cleanupAttempted = true;
  const wrapper = owner.wrapper;
  const atlas = owner.atlas;
  const group = owner.group;
  const instances = [...owner.instances];
  owner.instances.clear();
  owner.creatingInstance = false;
  owner.bundle = undefined;
  owner.wrapper = undefined;
  owner.atlas = undefined;
  owner.group = undefined;
  owner.scope = undefined;
  const cleanupErrors: unknown[] = [];
  for (const instance of instances) {
    try { cleanupErrors.push(...instance.retire()); }
    catch (cause) { cleanupErrors.push(cause); }
  }
  // The Core descriptor owns no lease. Page demand is released last, and the
  // genuine group's disposer keeps provider/manager cleanup authority intact.
  if (wrapper !== undefined) {
    try { APPLY(WRAPPER_DISPOSE, wrapper, []); }
    catch (cause) { cleanupErrors.push(cause); }
  }
  if (atlas !== undefined) {
    try { APPLY(ATLAS_DISPOSE, atlas, []); }
    catch (cause) { cleanupErrors.push(cause); }
    try {
      for (const page of atlas.pages) page.texture = null;
      for (const region of atlas.regions) region.texture = null;
    } catch (cause) { cleanupErrors.push(cause); }
  }
  if (group !== undefined) {
    try { group.dispose(); }
    catch (cause) { cleanupErrors.push(cause); }
  }
  return cleanupErrors;
}

function facadeFor(owner: ResourceOwner): F2CoreResources {
  return FREEZE({
    get isDisposed(): boolean {
      return owner.retired || owner.scope === undefined || APPLY(SCOPE_STATE, owner.scope, []) !== 'open'
        || owner.group === undefined || owner.group.state() !== 'ready';
    },
    createInstance(instanceScope: Scope, animationName: string): F2CoreInstance {
      requireReady(owner);
      requireOpenScope(instanceScope);
      if (owner.creatingInstance) throw new EgretError('F2C_SAMPLE_REENTRANT');
      owner.creatingInstance = true;
      try {
        const bundle = owner.bundle!;
        // Only admitted source counts/names cross this private experiment port.
        // The ready bundle, Core data and shared lease never reach a caller.
        return createF2CoreInstance(FREEZE({ lease: bundle.lease, wrapper: bundle.wrapper, data: bundle.data,
          counts: FREEZE({ vertices: bundle.profile.sourcePlan.setup.vertexCount,
            indices: bundle.profile.sourcePlan.setup.indexCount }), animations: bundle.profile.animations }),
        instanceScope, animationName, FREEZE({
          requireReady: () => requireReady(owner),
          reserve(instance: InstanceRetirement): void {
            requireReady(owner);
            if (owner.instances.size >= 2) throw new EgretError('F2C_INSTANCE_CAPACITY');
            owner.instances.add(instance);
          },
          release(instance: InstanceRetirement): void { owner.instances.delete(instance); },
        }));
      } finally { owner.creatingInstance = false; }
    },
    dispose(): void {
      const cleanupErrors = retire(owner);
      if (cleanupErrors.length !== 0) {
        throw new EgretError('F2C_RESOURCE_CLEANUP_FAILED', { cause: cleanupErrors[0], cleanupErrors: cleanupErrors.slice(1) });
      }
    },
  });
}

/** Source -> authentic page group -> whole page -> official Core -> Scope owner. */
export async function createF2CoreResources(engine: Engine, resourceScope: Scope, options: F2CoreCreateOptions): Promise<F2CoreResources> {
  const owner: ResourceOwner = { scope: resourceScope, group: undefined, wrapper: undefined, atlas: undefined,
    bundle: undefined, instances: new Set(), creatingInstance: false, retired: false, cleanupAttempted: false };
  try {
    requireOpenScope(resourceScope);
    const snapshot = ownOptions(resourceScope, options);
    const result = scopeRead(resourceScope, () => createF2MeshProfilePlan(snapshot.input), 'F2C_SOURCE_REFUSED');
    if (!result.ok) throw new EgretError('F2C_SOURCE_REFUSED', { cause: result });
    const profile = result.value;
    requirePageId(resourceScope, snapshot.pageRef, profile.page.assetId);
    let group!: AssetGroup<Texture>;
    let failed = false;
    let groupCause: unknown;
    try { group = APPLY(CREATE_GROUP, engine, [resourceScope, [snapshot.pageRef], { concurrency: 1 }]) as AssetGroup<Texture>; }
    catch (cause) { failed = true; groupCause = cause; }
    requireOpenScope(resourceScope);
    if (failed) throw groupCause;
    owner.group = capturedGroup(group);
    requireOpenScope(resourceScope);
    let leases!: readonly AssetLease<Texture>[];
    let readyFailed = false;
    let readyCause: unknown;
    try { leases = await owner.group.ready; }
    catch (cause) { readyFailed = true; readyCause = cause; }
    // A canceled ready promise must not revive a bundle or mask Scope closure.
    requireOpenScope(resourceScope);
    if (owner.group.state() === 'disposed') throw new EgretError('F2C_RESOURCES_TERMINAL', { cause: readyCause });
    if (readyFailed) throw readyCause;
    requireReady(owner);
    if (leases.length !== 1 || leases[0] === undefined) throw new EgretError('F2C_PAGE_PROFILE');
    const lease = leases[0];
    const image = qualifiedPage(owner, lease, profile);
    if (readyRead(owner, () => Skeleton.yDown, 'F2C_CORE_PREMISE') !== false) throw new EgretError('F2C_CORE_PREMISE');
    const wrapper = readyRead(owner, () => {
      const value = new DimensionTexture(image.width, image.height);
      owner.wrapper = value;
      return value;
    }, 'F2C_CORE_COMPATIBILITY');
    const atlas = readyRead(owner, () => {
      const value = new TextureAtlas(profile.ownedInput.atlas.text);
      owner.atlas = value;
      return value;
    }, 'F2C_CORE_COMPATIBILITY');
    const page = atlas.pages[0];
    if (atlas.pages.length !== 1 || page === undefined) throw new EgretError('F2C_CORE_COMPATIBILITY');
    readyRead(owner, () => page.setTexture(wrapper), 'F2C_CORE_COMPATIBILITY');
    const data = readyRead(owner, () => new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(profile.ownedInput.skeleton.text), 'F2C_CORE_COMPATIBILITY');
    readyRead(owner, () => qualifyCore(profile, wrapper, atlas, data), 'F2C_CORE_COMPATIBILITY');
    owner.bundle = { engine, scope: resourceScope, group: owner.group, lease, profile, wrapper, atlas, data };
    const facade = facadeFor(owner);
    // Register after the already-owned group so reverse Scope cleanup retires
    // this bundle before releasing the shared original page demand.
    readyRead(owner, () => APPLY(SCOPE_USE, resourceScope, [facade]), 'F2C_RESOURCE_LOAD_FAILED');
    requireReady(owner);
    return facade;
  } catch (cause) {
    const cleanupErrors = retire(owner);
    throw new EgretError('F2C_RESOURCE_LOAD_FAILED', { cause, cleanupErrors });
  }
}
