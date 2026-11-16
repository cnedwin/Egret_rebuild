import type { SharedWebGL2Configuration } from './sharedWebGL2Options.js';
import type { GLNativeOwner, GLNativeSession } from './webgl2Native.js';
import type { SharedWebGL2LayerEffect2D } from './webgl2Types.js';
export declare const MAX_LAYER_HANDLES = 512;
export declare const MAX_LAYER_EXTENT = 2048;
export declare const MAX_LAYER_BYTES: number;
export interface LayerRevision {
    readonly owner: GLNativeOwner;
    readonly native: GLNativeSession;
    pins: number;
    retained: boolean;
}
interface LayerEffect {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly scale: readonly [number, number, number];
    readonly emission: readonly [number, number, number];
}
export interface LayerRead {
    readonly revision: LayerRevision;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly effect: LayerEffect | undefined;
}
export interface LayerProgram {
    readonly program: WebGLProgram;
    readonly origin: WebGLUniformLocation | null;
    readonly extent: WebGLUniformLocation | null;
    readonly viewport: WebGLUniformLocation | null;
    readonly texture: WebGLUniformLocation | null;
    readonly effect: {
        readonly min: WebGLUniformLocation | null;
        readonly max: WebGLUniformLocation | null;
        readonly scaleRG: WebGLUniformLocation | null;
        readonly scaleBAddR: WebGLUniformLocation | null;
        readonly addGB: WebGLUniformLocation | null;
    } | undefined;
}
/** Apply the original logical-to-physical clipping and RGB bounds. */
export declare function readWebGL2LayerEffect(options: Pick<SharedWebGL2Configuration, 'enableEffects' | 'pixelRatio'>, input: SharedWebGL2LayerEffect2D, frameWidth: number, frameHeight: number): LayerEffect | undefined;
/** Convert one verified revision's placement after the Host's lifecycle checks. */
export declare function readWebGL2LayerPlacement(revision: LayerRevision, x: unknown, y: unknown, width: unknown, height: unknown, ratio: number, light: LayerEffect | undefined): LayerRead;
/** Build program bindings; the Host owns generation invalidation and cache publication. */
export declare function createWebGL2LayerProgram(native: GLNativeSession, effect: boolean): LayerProgram;
export {};
//# sourceMappingURL=webgl2LayerState.d.ts.map