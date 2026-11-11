// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { AssetProvider, AssetType, Scope, SequenceClip, SequenceFrameInput } from '@egret/runtime';
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

/** Private loader identity and catalog relationship; no structural loader grants authority. */
const contentLoaders = new WeakMap<object, (scope: Scope, imageId: string, sequenceId: string) => void>();
export function registerContentLoader(loader: object, authenticate: (scope: Scope, imageId: string, sequenceId: string) => void): void {
  contentLoaders.set(loader, authenticate);
}
export function authenticateContentLoader(loader: unknown, scope: Scope, imageId: string, sequenceId: string): void {
  const authenticate = contentLoaders.get(loader as object);
  if (!authenticate) throw new EgretError('SEQUENCE_RESET_LOADER_INVALID');
  authenticate(scope, imageId, sequenceId);
}

/** Retain only the authored frame boundaries of genuine ContentLoader clips. */
const sequenceTimelines = new WeakMap<SequenceClip, readonly number[]>();
export function registerSequenceTimeline(clip: SequenceClip, frames: readonly SequenceFrameInput[]): void {
  let end = 0;
  sequenceTimelines.set(clip, Object.freeze(frames.map(frame => end += frame.durationSeconds)));
}
export function hasSequenceTimeline(clip: SequenceClip): boolean { return sequenceTimelines.has(clip); }
export function hasMatchingSequenceTimeline(source: SequenceClip, candidate: SequenceClip): boolean {
  const first = sequenceTimelines.get(source), second = sequenceTimelines.get(candidate);
  return first !== undefined && second !== undefined && first.length === second.length
    && first.every((end, index) => end === second[index]);
}
