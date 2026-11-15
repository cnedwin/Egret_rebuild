import type { SharedPreparationOptions2D } from '../rendering/prepareSharedDraws2D.js';
import type { SharedStorageLimits2D } from './sharedSubmissionStorage2D.js';
import type { WebGL2HostDiagnostic } from './webgl2Types.js';
export interface SharedWebGL2Configuration extends SharedPreparationOptions2D, SharedStorageLimits2D {
    /** Distinct regions one frame may name; at most the profile's 4,096. */
    readonly maxFrameRegions: number;
    /** Bytes of distinct pages one frame may name; at most the profile's 64 MiB. */
    readonly maxFramePageBytes: number;
    /** Bytes of page textures kept ready between frames; at most 128 MiB. */
    readonly maxReadyPageBytes: number;
    readonly maxBackingPixels: number;
    readonly enableReadback: boolean;
    readonly enableEffects: boolean;
    readonly outputAlpha: 'premultiplied' | 'opaque';
    readonly restoreTimeoutMs: number;
}
export interface SharedWebGL2HostOptions extends Partial<SharedWebGL2Configuration> {
    readonly canvas: HTMLCanvasElement;
    readonly onDiagnostic?: (diagnostic: WebGL2HostDiagnostic) => unknown;
    /** Collect bounded CPU elapsed timings for shared frames. Defaults to false. */
    readonly measureSharedFrames?: boolean;
}
/** Capture all successful reads before semantics; preserve the first thrown getter value. */
export declare function admitSharedWebGL2Options(input: SharedWebGL2HostOptions): {
    surface: HTMLCanvasElement;
    configuration: SharedWebGL2Configuration;
    callback: ((diagnostic: WebGL2HostDiagnostic) => unknown) | undefined;
    measureSharedFrames: boolean;
};
//# sourceMappingURL=sharedWebGL2Options.d.ts.map