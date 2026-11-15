import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import { CubeTexture3D } from '../../rendering/world3d/Texture3D.js';
import type { Renderer3D } from './frame3D.js';
export interface CubeCaptureOptions3D {
    /** Edge of each face in texels. */
    readonly size?: number;
    readonly near?: number;
    readonly far?: number;
    /** Camera layer mask, to leave the reflecting object itself out. */
    readonly layerMask?: number;
}
/** Render six 90-degree views from `position` and return them as a cube texture with mipmaps. */
export declare function captureCubeTexture3D(renderer: Renderer3D, scene: Scene3D, position: ArrayLike<number>, options?: CubeCaptureOptions3D): Promise<CubeTexture3D>;
//# sourceMappingURL=probe3D.d.ts.map