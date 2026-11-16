import type { ImageData2D } from '@egret/contracts';
import type { ProjectionPlan2D } from './imageProjections2D.js';
import type { OwnedWebGPUTexture } from './webgpuLifetime.js';
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
    state: 'cold' | 'ready' | 'detached';
}
export interface ImageResidencyCandidate {
    image: ImageData2D;
    viewIndex: number;
    entry: ImageResidencyEntry;
    transferred: boolean;
}
export type ImageResidencyDraw = {
    readonly kind: 'rect';
} | {
    readonly kind: 'image' | 'mesh';
    readonly packed: {
        readonly vertexCount: number;
    };
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
}
/** Accumulates demand into the submission's existing maps without taking ownership of any native resources. */
export declare function collectWebGPUImageDemand(projectionPlan: ProjectionPlan2D, draws: readonly ImageResidencyDraw[], shared: boolean, directory: WeakMap<ImageData2D, Map<string, ImageResidencyEntry>>, enabled: boolean, epoch: object, hits: Map<number, ImageResidencyEntry>, candidates: Map<number, ImageResidencyCandidate>): number;
/** Reads the ready list in eviction order. The Host retains all mutation and retirement authority. */
export declare function selectWebGPUImageVictims(oldest: ImageResidencyEntry | undefined, epoch: object, available: number, count: number, maxReadyBytes: number, bytes: number, candidateCount: number, hits: ReadonlyMap<number, ImageResidencyEntry>): ImageResidencyEntry[];
//# sourceMappingURL=webgpuImageResidency.d.ts.map