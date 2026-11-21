// SPDX-License-Identifier: Apache-2.0
import type { ImageData2D } from '@egret/contracts';
import type { ProjectionPlan2D } from './imageProjections2D.js';
import type { OwnedWebGPUTexture } from './webgpuLifetime.js';

// READY metadata never retains an image, frame, projection, record or callback.
export interface ImageResidencyEntry {
  format: 'rgba8unorm' | 'rgba8unorm-srgb';
  identity: object;
  epoch: object;
  bucket: Map<string, ImageResidencyEntry>;
  cropKey: string;
  bytes: number;
  resource: OwnedWebGPUTexture | undefined;
  view: GPUTextureView | undefined;
  pinCount: number;
  previous: ImageResidencyEntry | undefined;
  next: ImageResidencyEntry | undefined;
  state: 'cold' | 'submitted' | 'ready' | 'detached';
  /** Producer error scopes, held only while an immutable page is lent before its fence. */
  validation?: Promise<void>;
}
export interface ImageResidencyCandidate {
  image: ImageData2D;
  viewIndex: number;
  entry: ImageResidencyEntry;
  transferred: boolean;
}
// Rectangles have no sampled-page demand and need no synthetic vertex count.
export type ImageResidencyDraw =
  | { readonly kind: 'rect' }
  | {
      readonly kind: 'image' | 'mesh';
      readonly packed: { readonly vertexCount: number };
      readonly viewIndex: number;
    };
export interface ImageResidencyPlan {
  epoch: object;
  revision: object;
  victims: ImageResidencyEntry[];
  bytes: number;
  use: ImageResidencyUse;
}
export interface ImageResidencyUse {
  epoch: object;
  hits: Map<number, ImageResidencyEntry>;
  candidates: Map<number, ImageResidencyCandidate>;
  reserved: number;
  pinned: boolean;
  finished: boolean;
  touchedQueue: boolean;
  producerValidations?: Set<Promise<void>>;
}

/** Accumulates demand into the submission's existing maps without taking ownership of any native resources. */
export function collectWebGPUImageDemand(
  projectionPlan: ProjectionPlan2D,
  draws: readonly ImageResidencyDraw[],
  shared: boolean,
  directory: WeakMap<ImageData2D, Map<string, ImageResidencyEntry>>,
  enabled: boolean,
  epoch: object,
  hits: Map<number, ImageResidencyEntry>,
  candidates: Map<number, ImageResidencyCandidate>,
  borrowSubmitted: boolean
): number {
  const buckets = new Map<ImageData2D, Map<string, ImageResidencyEntry>>();
  let bytes = 0;
  for (const draw of draws) {
    if (
      draw.kind === 'rect' ||
      draw.packed.vertexCount === 0 ||
      hits.has(draw.viewIndex) ||
      candidates.has(draw.viewIndex)
    )
      continue;
    const view = projectionPlan.views[draw.viewIndex]!,
      region = view.region;
    const cropKey =
      (shared ? 'shared:egret.alpha8-capped-srgb-pma8/1:rgba8unorm-srgb:' : '') +
      `${region.x},${region.y},${region.width},${region.height}` +
      // A page kept with one level cannot serve a draw that samples its smaller copies.
      ((view.levels ?? 1) === 1 ? '' : `:levels=${view.levels}`);
    let bucket = directory.get(view.image) ?? buckets.get(view.image);
    if (!bucket) {
      bucket = new Map();
      buckets.set(view.image, bucket);
    }
    const entry = bucket.get(cropKey);
    if (
      enabled &&
      entry?.epoch === epoch &&
      (entry.state === 'ready' || (borrowSubmitted && entry.state === 'submitted'))
    )
      hits.set(draw.viewIndex, entry);
    else {
      candidates.set(draw.viewIndex, {
        image: view.image,
        viewIndex: draw.viewIndex,
        transferred: false,
        entry: {
          format: shared ? 'rgba8unorm-srgb' : 'rgba8unorm',
          identity: {},
          epoch,
          bucket,
          cropKey,
          bytes: view.byteLength,
          resource: undefined,
          view: undefined,
          pinCount: 0,
          previous: undefined,
          next: undefined,
          state: 'cold'
        }
      });
      bytes += view.byteLength;
    }
  }
  return bytes;
}

/** Reads the ready list in eviction order. The Host retains all mutation and retirement authority. */
export function selectWebGPUImageVictims(
  oldest: ImageResidencyEntry | undefined,
  epoch: object,
  available: number,
  count: number,
  maxReadyBytes: number,
  bytes: number,
  candidateCount: number,
  hits: ReadonlyMap<number, ImageResidencyEntry>
): ImageResidencyEntry[] {
  const protectedHits = new Set(hits.values()),
    victims: ImageResidencyEntry[] = [];
  for (let entry = oldest; entry; entry = entry.next) {
    if (available + bytes <= maxReadyBytes && count + candidateCount <= 256) break;
    if (entry.epoch !== epoch || entry.state !== 'ready' || entry.pinCount !== 0 || protectedHits.has(entry)) continue;
    victims.push(entry);
    available -= entry.bytes;
    count--;
  }
  return victims;
}
