import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { type CustomPost3D } from './post3D.js';
export interface AtmosphereOptions3D {
    /** Fog color, 0xRRGGBB. Default a pale blue-grey. */
    readonly fogColor?: number;
    /** Fog thickness per world unit at `fogHeight`; 0 turns fog off. Default 0.01. */
    readonly fogDensity?: number;
    /** World height at which the fog has its stated density. Default 0. */
    readonly fogHeight?: number;
    /** How quickly the fog thins with height, per world unit; 0 gives uniform fog. Default 0.08. */
    readonly fogFalloff?: number;
    /** Brightness of the light shafts; 0 turns them off. Default 0.6. */
    readonly shaftIntensity?: number;
    /** How far the shafts reach across the screen, 0 to 1. Default 0.6. */
    readonly shaftLength?: number;
}
/**
 * Height fog and light shafts for `renderer.postProcess.custom`. Call
 * `update(camera, sunDirection)` every frame before rendering: the hook needs
 * to know where the camera and the sun are.
 */
export declare class Atmosphere3D {
    #private;
    readonly post: CustomPost3D;
    constructor(options?: AtmosphereOptions3D);
    get fogDensity(): number;
    set fogDensity(value: number);
    get fogFalloff(): number;
    set fogFalloff(value: number);
    get fogHeight(): number;
    set fogHeight(value: number);
    get shaftIntensity(): number;
    set shaftIntensity(value: number);
    get shaftLength(): number;
    set shaftLength(value: number);
    /** Linear RGB fog color. */
    setFogColor(r: number, g: number, b: number): void;
    /**
     * Refresh the camera and sun data. `sunDirection` is the direction the
     * sunlight travels in, as a directional light's world direction; pass
     * undefined when there is no sun, which leaves only the fog.
     */
    update(camera: Camera3D, sunDirection?: ArrayLike<number>): void;
    private amount;
}
export declare function createAtmosphere3D(options?: AtmosphereOptions3D): Atmosphere3D;
//# sourceMappingURL=atmosphere3D.d.ts.map