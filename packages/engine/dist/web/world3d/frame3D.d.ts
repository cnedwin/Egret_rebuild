import type { Disposable } from '@egret/contracts';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { Light3D } from '../../rendering/world3d/Light3D.js';
import type { Mesh3D } from '../../rendering/world3d/Mesh3D.js';
import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import type { RenderList3D } from '../../rendering/world3d/RenderList3D.js';
import type { PostProcessSettings3D } from './post3D.js';
import type { CompressedFormat3D, RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
export type ToneMapping3D = 'none' | 'reinhard' | 'aces';
export interface Renderer3DInfo {
    frame: number;
    drawCalls: number;
    triangles: number;
    visited: number;
    culled: number;
    shadowMaps: number;
    programs: number;
    geometries: number;
    textures: number;
}
/** What both world3d backends provide; views and tools depend on this only. */
export interface Renderer3D extends Disposable {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly info: Renderer3DInfo;
    toneMapping: ToneMapping3D;
    exposure: number;
    shadowsEnabled: boolean;
    /** Bloom, color grading and FXAA; set `enabled` to turn the chain on. */
    readonly postProcess: PostProcessSettings3D;
    /**
     * Part of the output to draw into, as [x, y, width, height] in 0 to 1 with
     * the origin at the bottom left; undefined draws everywhere. Set the
     * camera's aspect to match. Used for split screens and inset views.
     */
    viewport: readonly [number, number, number, number] | undefined;
    /**
     * Clear the whole output to the scene background before drawing. Turn it
     * off for the second and later views of one frame; depth is always cleared.
     */
    autoClear: boolean;
    /** Draw to the canvas, or into `target`. Returns false when the device is lost. */
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean;
    setSize(width: number, height: number, pixelRatio?: number): void;
    resizeToDisplaySize(pixelRatio?: number): boolean;
    /** True when textures in this compressed format can be used on this device. */
    supportsCompressedFormat(format: CompressedFormat3D): boolean;
    /** RGBA8 pixels of a render target, top row first, in the sRGB encoding. */
    readRenderTargetPixels(target: RenderTarget3D): Promise<Uint8Array>;
}
/** Size in floats of the Frame uniform block. */
export declare const FRAME_BLOCK_FLOATS_3D = 352;
/** Offsets, in floats, of the Frame block members. */
export declare const FRAME_OFFSETS_3D: Readonly<{
    readonly viewProjection: 0;
    readonly view: 16;
    readonly cameraPosition: 32;
    readonly fogColor: 36;
    readonly fogParams: 40;
    readonly ambient: 44;
    readonly hemisphereSky: 48;
    readonly hemisphereGround: 52;
    readonly lightCounts: 56;
    readonly directionalDirection: 60;
    readonly directionalColor: 76;
    readonly pointPosition: 92;
    readonly pointColor: 124;
    readonly spotPosition: 156;
    readonly spotDirection: 172;
    readonly spotColor: 188;
    readonly spotCone: 204;
    readonly shadowMatrix: 220;
    readonly shadowRect: 284;
    readonly shadowParams: 300;
    readonly output: 316;
    readonly cascadeSplits: 320;
    readonly cascadeInfo: 324;
    readonly pointShadow: 328;
    readonly clipPlanes: 332;
    readonly clipInfo: 348;
}>;
export interface FrameOutput3D {
    readonly exposure: number;
    readonly toneMapping: ToneMapping3D;
    /** Highest mip level of the bound environment cube, or 0 without one. */
    readonly environmentMaxMip: number;
}
/** Fill camera, fog, light and output members. Shadow members are written by planShadows3D. */
export declare function writeFrameBlock3D(data: Float32Array, scene: Scene3D, camera: Camera3D, list: RenderList3D, shadowSlots: ReadonlyMap<Light3D, number>, output: FrameOutput3D): void;
export interface ShadowPlan3D {
    readonly light: Light3D;
    readonly slot: number;
    /** Tile origin and edge in atlas texels; the origin is the lower-left corner in GL conventions. */
    readonly x: number;
    readonly y: number;
    readonly tile: number;
    /** Light view-projection with OpenGL clip conventions (z in [-1, 1]). */
    readonly matrix: Float32Array;
    /** Casters whose bounds intersect this light's volume. */
    readonly casters: Mesh3D[];
}
/** View-space far distance of each cascade, blending uniform and logarithmic spacing. */
export declare function cascadeSplits3D(near: number, far: number, count: number, lambda: number): number[];
/**
 * Assign shadow-casting lights to quarter tiles of a square atlas, compute
 * their matrices and caster lists, and write the shadow members of the block.
 * A cascaded directional light takes one tile per cascade, each fitted to a
 * slice of the camera frustum. `flipY` selects top-left atlas addressing for
 * backends whose texture origin is the top row.
 */
export declare function planShadows3D(data: Float32Array, list: RenderList3D, atlasSize: number, enabled: boolean, flipY: boolean, slots: Map<Light3D, number>, camera?: Camera3D): ShadowPlan3D[];
//# sourceMappingURL=frame3D.d.ts.map