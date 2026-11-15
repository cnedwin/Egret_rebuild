import type { RenderCommand } from '@esotericsoftware/spine-core';
import { EgretError } from '@egret/engine';
import type { AssetLease, Texture, SharedGeometry2D, SharedMaterial2D } from '@egret/engine';
import type { SpineAssetPort } from './assetAuthority.js';
export interface SpineDrawLimits {
    commands: number;
    vertices: number;
    indices: number;
}
export interface SpineDrawRow {
    lease: AssetLease<Texture>;
    geometry: SharedGeometry2D;
    material: SharedMaterial2D;
}
export declare function drawFault(code: string): EgretError;
/** Premultiplied shared-frame output over straight pages; no reinterpretation of shared-frame/1. */
export declare function copySpineDraws(head: RenderCommand | undefined, asset: SpineAssetPort, limits: SpineDrawLimits, materials: Map<string, SharedMaterial2D>): SpineDrawRow[];
//# sourceMappingURL=drawGeometry.d.ts.map