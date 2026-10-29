// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { AssetProvider, AssetType, Scope } from '@egret/runtime';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestAssetGroup, ManifestBinding, ManifestGroupOptions } from '../manifestResourceTypes.js';

export interface ContentEngineOperations {
  assertOpen(): void;
  isScope(value: unknown): value is Scope;
  register<T>(type: AssetType<T>, provider: AssetProvider<T>): void;
  group(scope: Scope, manifest: AdmittedResourceManifest, roots: readonly string[], bindings: readonly ManifestBinding[], options?: ManifestGroupOptions): ManifestAssetGroup;
  own(dispose: () => void): () => void;
}
const engines = new WeakMap<object, ContentEngineOperations>();
/** Only genuine Engine construction installs captured manager and Scope authority. */
export function registerContentEngine(engine: object, operations: ContentEngineOperations): void { engines.set(engine, Object.freeze(operations)); }
export function requireContentEngine(engine: unknown): ContentEngineOperations {
  const value = engines.get(engine as object);
  if (value === undefined) throw new EgretError('CONTENT_ENGINE_INVALID');
  value.assertOpen();
  return value;
}
