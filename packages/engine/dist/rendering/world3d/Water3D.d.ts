import { Camera3D } from './Camera3D.js';
import { Material3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import type { Object3D, Scene3D } from './Object3D.js';
import { RenderTarget3D } from './Texture3D.js';
/** Anything that can draw a scene into a render target: both first-party renderers qualify. */
export interface ReflectionRenderer3D {
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean;
    /** Allows renderers to label mirror draws separately in application-frame metrics. */
    renderReflection?(scene: Scene3D, camera: Camera3D, target: RenderTarget3D): boolean;
    /** Allows the renderer to verify and record reuse of the previous mirror result. */
    reuseReflection?(target: RenderTarget3D): boolean;
    /** When present, post-processing is switched off while the mirror image is drawn. */
    readonly postProcess?: {
        enabled: boolean;
    };
    /** When present, shadows can be left out of the mirror image. */
    shadowsEnabled?: boolean;
}
/**
 * A mirror camera and the target it draws into. Each frame, before the main
 * view, call `render` with the plane of the mirror; assign `texture` to a
 * standard material's `reflectionMap`. Whatever lies behind the plane is cut
 * away, so the ground under a lake does not show up in its reflection.
 */
export declare class PlanarReflection3D {
    #private;
    readonly target: RenderTarget3D;
    get camera(): Camera3D;
    /** Moves the cutting plane back by this distance so geometry touching the mirror leaves no gap. */
    clipBias: number;
    /** Draw the mirror image on every Nth call only; in between, the last image is kept. 1 draws every time. */
    interval: number;
    /** Only objects on these layers appear in the mirror image: leave small or distant things out to save time. */
    layerMask: number;
    /** false leaves shadows out of the mirror image, which saves the shadow passes for it. */
    shadows: boolean;
    constructor(options?: {
        readonly width?: number;
        readonly height?: number;
    });
    get texture(): RenderTarget3D['texture'];
    /**
     * Place the mirror camera for a viewing camera and a world plane given as
     * [nx, ny, nz, d] with unit normal, where n . p + d = 0 and the normal
     * points to the side the viewer is on. Returns false when the viewer is
     * behind the plane or the projection cannot represent a forward clip.
     */
    update(camera: Camera3D, plane: ArrayLike<number>): boolean;
    /**
     * Update the mirror camera and draw the scene into the target. Objects in
     * `hidden`, normally the mirror itself, are left out of the image.
     */
    render(renderer: ReflectionRenderer3D, scene: Scene3D, camera: Camera3D, plane: ArrayLike<number>, hidden?: readonly Object3D[]): boolean;
    dispose(): void;
}
export interface WaterOptions3D {
    /** Size of the surface along X and Z. Defaults: 100 each. */
    readonly width?: number;
    readonly depth?: number;
    /** Grid cells per side; waves need vertices to move. Default 96. */
    readonly segments?: number;
    /** Tint of the water, 0xRRGGBB. */
    readonly color?: number;
    /** Height of the largest wave above and below the rest level. Default 0.15. */
    readonly amplitude?: number;
    /** Crest-to-crest distance of the largest wave. Default 9. */
    readonly wavelength?: number;
    /** Multiplies how fast the waves travel. Default 1. */
    readonly speed?: number;
    /** Direction the main wave travels in, as [x, z]. */
    readonly direction?: readonly [number, number];
    /** 0 gives rounded swells, 1 pulls crests into sharper peaks. Default 0.5. */
    readonly steepness?: number;
    /** Strength of the fine surface ripples. Default 0.12. */
    readonly rippleStrength?: number;
    /** Length of the shortest ripple. Default 0.9. */
    readonly rippleLength?: number;
    readonly roughness?: number;
    /** How strongly the view through the water is bent, as a travelled distance. Default 0.5. */
    readonly thickness?: number;
    /** 0 to 1: how much of what is under the water shows through. Default 0.85. */
    readonly clarity?: number;
    /** Edge of the square mirror image in pixels; 0 disables true reflections and leaves the sky's. Default 512. */
    readonly reflectionSize?: number;
    /** Color the water takes on where it is deep, 0xRRGGBB. Default: a darker shade of `color`. */
    readonly deepColor?: number;
    /** Depth over which the view through the water fades to the deep color. Default 6. */
    readonly depthFade?: number;
    /** Width of the foam band along shores, as water depth; 0 for none. Default 0.5. */
    readonly foamWidth?: number;
    /** Strength of the light patterns on the bottom of shallow water, 0 for none. Default 0.5. */
    readonly caustics?: number;
}
/**
 * A horizontal water surface. Waves move its vertices and its shading
 * normal; what is under the surface is seen bent through it; the sky reflects
 * from the scene's environment map, and the scene itself after each
 * `renderReflection`. Keep the mesh unrotated: the mirror plane is its world
 * height.
 */
export declare class Water3D extends Mesh3D {
    #private;
    readonly reflection: PlanarReflection3D | undefined;
    constructor(options?: WaterOptions3D);
    /** Seconds the waves have been running; set it to keep several clients in step. */
    get time(): number;
    set time(value: number);
    get amplitude(): number;
    set amplitude(value: number);
    /** Advance the waves by a time step in seconds. */
    update(deltaSeconds: number): void;
    /**
     * World height of the surface at a world point now, for floating objects.
     * It ignores the sideways pull of steep waves, so it is exact at steepness 0
     * and close otherwise.
     */
    heightAt(x: number, z: number): number;
    /**
     * Draw the scene's mirror image for this frame; call it before rendering
     * the main view. Returns false, and draws nothing, when the camera is under
     * the surface or true reflections are disabled.
     */
    renderReflection(renderer: ReflectionRenderer3D, scene: Scene3D, camera: Camera3D): boolean;
    /** Test the horizontal wave height at a point, including beyond the rendered mesh edges. */
    isUnderwater(point: ArrayLike<number>): boolean;
    /**
     * Give the scene the look of being under water while the camera is below
     * the surface: thick fog in the water's color. The scene's own fog is put
     * back when the camera comes up. Call it each frame; it returns whether the
     * camera is under water, where there is no mirror image to draw.
     */
    updateUnderwater(scene: Scene3D, camera: Camera3D, density?: number): boolean;
    private restoreUnderwaterFog;
    /** Release the geometry, the material and the mirror image. */
    dispose(): void;
}
export declare function createWater3D(options?: WaterOptions3D): Water3D;
/**
 * The material Water3D uses, for a water surface on your own geometry: a
 * standard material that refracts, with the wave hooks attached. Advance
 * `material.shader.uniforms[0]`, the time in seconds, every frame.
 */
export declare function createWaterMaterial3D(options?: WaterOptions3D): Material3D;
//# sourceMappingURL=Water3D.d.ts.map