// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import type { Scope } from '@egret/engine';
import type { Skeleton } from '@esotericsoftware/spine-core';
import type { SpineInstance } from './instanceTypes.js';
import type { SpineAssetPort } from './assetAuthority.js';
export interface SpineDrawCandidate { commit(): void; abort(): void; retire?(): void; }
export interface SpineDrawSink { prepare(skeleton: Skeleton): SpineDrawCandidate; dispose(): void; }
export interface SpineRenderPort { readonly asset: SpineAssetPort; initializeReset(): void; attach(scope: Scope, sink: SpineDrawSink): () => void; }
const ports = new WeakMap<object, SpineRenderPort>();
/** Private genuine-instance capability; copied snapshots never authorize rendering. */
export function registerSpineRender(instance: SpineInstance, port: SpineRenderPort): void { ports.set(instance, port); }
export function requireSpineRender(instance: SpineInstance): SpineRenderPort {
  const port = ports.get(instance); if (!port) throw new EgretError('SPINE_DISPLAY_INSTANCE_INVALID'); return port;
}
