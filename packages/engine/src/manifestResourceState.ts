// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
import { createAssetRef, EgretError } from '@egret/runtime';
import type { AssetRef, AssetType } from '@egret/runtime';
import type { ManifestAssetBinding } from './manifestResourceTypes.js';

const APPLY = Reflect.apply;
const GET = WeakMap.prototype.get;
const SET = WeakMap.prototype.set;
const FREEZE = Object.freeze;
const bindingStates = new WeakMap<object, ManifestBindingState>();
const refStates = new WeakMap<object, ManifestBindingState>();
const typeTokens = new WeakMap<object, number>();
let lastTypeToken = 0;

/** Private immutable metadata, shared only through the exact assembly alias. */
export interface ManifestBindingState {
  readonly manifest: AdmittedResourceManifest;
  readonly entry: ResourceManifestEntry;
  readonly ref: AssetRef<unknown>;
}

/** Authentication never reads a structural lookalike or proxy property. */
export function requireManifestBinding(value: unknown): ManifestBindingState {
  const state = APPLY(GET, bindingStates, [value]) as ManifestBindingState | undefined;
  if (state === undefined) throw new EgretError('MANIFEST_BINDING_INVALID');
  return state;
}

/** A matching ref ID alone cannot turn caller metadata into a verified source. */
export function requireManifestAssetRef(value: unknown): ManifestBindingState {
  const state = APPLY(GET, refStates, [value]) as ManifestBindingState | undefined;
  if (state === undefined) throw new EgretError('MANIFEST_BINDING_REF_INVALID');
  return state;
}

export function createManifestAssetBinding<T>(manifest: AdmittedResourceManifest, assetId: string, type: AssetType<T>): ManifestAssetBinding<T> {
  if (!isAdmittedResourceManifest(manifest)) throw new EgretError('MANIFEST_BINDING_MANIFEST_INVALID');
  if (typeof assetId !== 'string') throw new EgretError('MANIFEST_BINDING_ASSET_INVALID');
  let entry: ResourceManifestEntry | undefined;
  for (const candidate of manifest.entries) {
    if (candidate.id === assetId) { entry = candidate; break; }
  }
  if (entry === undefined) throw new EgretError('MANIFEST_BINDING_ASSET_INVALID');

  const known = APPLY(GET, typeTokens, [type]) as number | undefined;
  const token = known ?? lastTypeToken + 1;
  if (!Number.isSafeInteger(token)) throw new EgretError('MANIFEST_BINDING_ID_EXHAUSTED');
  // createAssetRef authenticates the type without reading its name/predicate.
  // Publish a new token only after that succeeds. No manager registration occurs.
  const ref = createAssetRef(type, 'egret.resource:' + entry.runtimeIdentity + ':type:' + token);
  if (known === undefined) {
    APPLY(SET, typeTokens, [type, token]);
    lastTypeToken = token;
  }
  const state: ManifestBindingState = FREEZE({ manifest, entry, ref: ref as unknown as AssetRef<unknown> });
  const binding = FREEZE({ ref }) as unknown as ManifestAssetBinding<T>;
  APPLY(SET, bindingStates, [binding, state]);
  APPLY(SET, refStates, [ref, state]);
  return binding;
}
export type { ManifestBinding } from './manifestResourceTypes.js';
