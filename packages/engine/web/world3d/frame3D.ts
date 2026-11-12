// SPDX-License-Identifier: Apache-2.0
// Backend-neutral renderer contract and the per-frame uniform block shared by
// the WebGL2 and WebGPU world3d backends. The block uses only mat4 and vec4
// members, so its std140 (GLSL) and WGSL uniform layouts are identical.
import type {Disposable} from '@egret/contracts';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {LIGHT3D_LIMITS} from '../../rendering/world3d/Light3D.js';
import type {Light3D} from '../../rendering/world3d/Light3D.js';
import {frustumFromMatrix, frustumIntersectsSphere, mat4Invert, mat4LookAt, mat4Multiply, mat4Orthographic, mat4Perspective} from '../../rendering/world3d/math3D.js';
import type {Mesh3D} from '../../rendering/world3d/Mesh3D.js';
import type {Scene3D} from '../../rendering/world3d/Object3D.js';
import type {RenderList3D} from '../../rendering/world3d/RenderList3D.js';
import type {CompressedFormat3D, RenderTarget3D} from '../../rendering/world3d/Texture3D.js';

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
export const FRAME_BLOCK_FLOATS_3D = 320;
/** Offsets, in floats, of the Frame block members. */
export const FRAME_OFFSETS_3D = Object.freeze({
    viewProjection: 0, view: 16, cameraPosition: 32, fogColor: 36, fogParams: 40, ambient: 44, hemisphereSky: 48, hemisphereGround: 52,
    lightCounts: 56, directionalDirection: 60, directionalColor: 76, pointPosition: 92, pointColor: 124, spotPosition: 156,
    spotDirection: 172, spotColor: 188, spotCone: 204, shadowMatrix: 220, shadowRect: 284, shadowParams: 300, output: 316,
} as const);
const F = FRAME_OFFSETS_3D;

export interface FrameOutput3D {
    readonly exposure: number;
    readonly toneMapping: ToneMapping3D;
    /** Highest mip level of the bound environment cube, or 0 without one. */
    readonly environmentMaxMip: number;
}
/** Fill camera, fog, light and output members. Shadow members are written by planShadows3D. */
export function writeFrameBlock3D(data: Float32Array, scene: Scene3D, camera: Camera3D, list: RenderList3D,
    shadowSlots: ReadonlyMap<Light3D, number>, output: FrameOutput3D): void {
    data.set(camera.viewProjectionMatrix, F.viewProjection);
    data.set(camera.viewMatrix, F.view);
    data.set(camera.matrixWorld.subarray(12, 15), F.cameraPosition);
    const fog = scene.fog;
    data.fill(0, F.fogColor, F.fogParams + 4);
    if (fog) {
        data.set(fog.color, F.fogColor);
        if (fog.kind === 'linear') { data[F.fogParams] = 1; data[F.fogParams + 1] = fog.near; data[F.fogParams + 2] = fog.far; }
        else { data[F.fogParams] = 2; data[F.fogParams + 1] = fog.density; }
    }
    data.set(list.ambient, F.ambient); data.set(list.hemisphereSky, F.hemisphereSky); data.set(list.hemisphereGround, F.hemisphereGround);
    data[F.lightCounts] = list.directionalLights.length; data[F.lightCounts + 1] = list.pointLights.length; data[F.lightCounts + 2] = list.spotLights.length;
    const direction = (light: Light3D, offset: number): void => {
        // Lights shine along their local negative Z axis.
        const m = light.matrixWorld, x = -m[8]!, y = -m[9]!, z = -m[10]!, length = Math.hypot(x, y, z) || 1;
        data[offset] = x / length; data[offset + 1] = y / length; data[offset + 2] = z / length;
    };
    const color = (light: Light3D, offset: number): void => {
        data[offset] = light.color[0]! * light.intensity; data[offset + 1] = light.color[1]! * light.intensity; data[offset + 2] = light.color[2]! * light.intensity;
    };
    list.directionalLights.forEach((light, i) => {
        direction(light, F.directionalDirection + i * 4);
        data[F.directionalDirection + i * 4 + 3] = shadowSlots.get(light) ?? -1;
        color(light, F.directionalColor + i * 4);
    });
    list.pointLights.forEach((light, i) => {
        data.set(light.matrixWorld.subarray(12, 15), F.pointPosition + i * 4);
        data[F.pointPosition + i * 4 + 3] = light.range;
        color(light, F.pointColor + i * 4);
    });
    list.spotLights.forEach((light, i) => {
        data.set(light.matrixWorld.subarray(12, 15), F.spotPosition + i * 4);
        data[F.spotPosition + i * 4 + 3] = light.range;
        direction(light, F.spotDirection + i * 4);
        data[F.spotDirection + i * 4 + 3] = shadowSlots.get(light) ?? -1;
        color(light, F.spotColor + i * 4);
        const outer = Math.min(Math.max(light.angle, 0.001), Math.PI / 2), inner = outer * (1 - Math.min(Math.max(light.penumbra, 0), 1));
        data[F.spotCone + i * 4] = Math.cos(outer);
        // Keep the inner cosine strictly above the outer one so smoothstep stays defined.
        data[F.spotCone + i * 4 + 1] = Math.max(Math.cos(inner), Math.cos(outer) + 1e-4);
    });
    data[F.output] = scene.environmentIntensity; data[F.output + 1] = output.environmentMaxMip; data[F.output + 2] = output.exposure;
    data[F.output + 3] = output.toneMapping === 'aces' ? 2 : output.toneMapping === 'reinhard' ? 1 : 0;
}

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
const UP = [0, 1, 0], FORWARD_UP = [0, 0, 1];
const scratchWorld = new Float32Array(16), scratchView = new Float32Array(16), scratchProjection = new Float32Array(16), scratchFrustum = new Float32Array(24);

/**
 * Assign shadow-casting lights to quarter tiles of a square atlas, compute
 * their matrices and caster lists, and write the shadow members of the block.
 * `flipY` selects top-left atlas addressing for backends whose texture origin
 * is the top row.
 */
export function planShadows3D(data: Float32Array, list: RenderList3D, atlasSize: number, enabled: boolean, flipY: boolean,
    slots: Map<Light3D, number>): ShadowPlan3D[] {
    slots.clear();
    const plans: ShadowPlan3D[] = [];
    if (!enabled || list.shadowCasters.length === 0) return plans;
    const lights = [...list.directionalLights, ...list.spotLights].filter(light => light.castShadow).slice(0, LIGHT3D_LIMITS.maxShadows);
    const tile = atlasSize >> 1;
    lights.forEach((light, slot) => {
        slots.set(light, slot);
        const shadow = light.shadow, m = light.matrixWorld;
        const eye = [m[12]!, m[13]!, m[14]!], target = [m[12]! - m[8]!, m[13]! - m[9]!, m[14]! - m[10]!];
        // Pick an up vector that is not parallel to the light direction.
        const up = Math.abs(m[9]!) > 0.99 * Math.hypot(m[8]!, m[9]!, m[10]!) ? FORWARD_UP : UP;
        mat4LookAt(scratchWorld, eye, target, up);
        mat4Invert(scratchView, scratchWorld);
        if (light.lightType === 'spot') {
            const far = light.range > 0 ? Math.min(light.range, shadow.far) : shadow.far;
            mat4Perspective(scratchProjection, Math.min(light.angle * 2, Math.PI * 0.98), 1, shadow.near, far);
        } else mat4Orthographic(scratchProjection, -shadow.extent, shadow.extent, -shadow.extent, shadow.extent, shadow.near, shadow.far);
        const matrix = mat4Multiply(new Float32Array(16), scratchProjection, scratchView) as Float32Array;
        frustumFromMatrix(scratchFrustum, matrix);
        const x = (slot & 1) * tile, y = (slot >> 1) * tile;
        data.set(matrix, F.shadowMatrix + slot * 16);
        data[F.shadowRect + slot * 4] = x / atlasSize; data[F.shadowRect + slot * 4 + 1] = y / atlasSize;
        data[F.shadowRect + slot * 4 + 2] = tile / atlasSize; data[F.shadowRect + slot * 4 + 3] = (flipY ? -tile : tile) / atlasSize;
        if (flipY) data[F.shadowRect + slot * 4 + 1] = (y + tile) / atlasSize;
        data[F.shadowParams + slot * 4] = shadow.bias; data[F.shadowParams + slot * 4 + 1] = shadow.normalBias;
        data[F.shadowParams + slot * 4 + 2] = Math.max(shadow.radius, 0) / atlasSize; data[F.shadowParams + slot * 4 + 3] = 0;
        const casters: Mesh3D[] = [];
        for (const mesh of list.shadowCasters) {
            const sphere = mesh.worldBoundingSphere;
            if (mesh.frustumCulled && sphere[3]! >= 0 && !frustumIntersectsSphere(scratchFrustum, sphere)) continue;
            casters.push(mesh);
        }
        plans.push({light, slot, x, y, tile, matrix, casters});
    });
    return plans;
}
