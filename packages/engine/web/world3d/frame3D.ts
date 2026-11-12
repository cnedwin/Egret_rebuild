// SPDX-License-Identifier: Apache-2.0
// Backend-neutral renderer contract and the per-frame uniform block shared by
// the WebGL2 and WebGPU world3d backends. The block uses only mat4 and vec4
// members, so its std140 (GLSL) and WGSL uniform layouts are identical.
import type {Disposable} from '@egret/contracts';
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {LIGHT3D_LIMITS} from '../../rendering/world3d/Light3D.js';
import type {Light3D} from '../../rendering/world3d/Light3D.js';
import {frustumFromMatrix, frustumIntersectsSphere, mat4Invert, mat4LookAt, mat4Multiply, mat4Orthographic, mat4Perspective, vec3TransformMat4} from '../../rendering/world3d/math3D.js';
import type {Mesh3D} from '../../rendering/world3d/Mesh3D.js';
import type {Scene3D} from '../../rendering/world3d/Object3D.js';
import type {RenderList3D} from '../../rendering/world3d/RenderList3D.js';
import type {PostProcessSettings3D} from './post3D.js';
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
export const FRAME_BLOCK_FLOATS_3D = 352;
/** Offsets, in floats, of the Frame block members. */
export const FRAME_OFFSETS_3D = Object.freeze({
    viewProjection: 0, view: 16, cameraPosition: 32, fogColor: 36, fogParams: 40, ambient: 44, hemisphereSky: 48, hemisphereGround: 52,
    lightCounts: 56, directionalDirection: 60, directionalColor: 76, pointPosition: 92, pointColor: 124, spotPosition: 156,
    spotDirection: 172, spotColor: 188, spotCone: 204, shadowMatrix: 220, shadowRect: 284, shadowParams: 300, output: 316, cascadeSplits: 320, cascadeInfo: 324, pointShadow: 328, clipPlanes: 332, clipInfo: 348,
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
    // What a shader needs to turn stored depth back into distance: two projection terms and whether the view is orthographic.
    data[F.lightCounts + 3] = camera.projectionMatrix[15] === 1 ? 1 : 0;
    data[F.pointShadow + 2] = camera.projectionMatrix[10]!; data[F.pointShadow + 3] = camera.projectionMatrix[14]!;
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
    const planes = scene.clippingPlanes, planeCount = Math.min(planes.length, 4);
    for (let i = 0; i < planeCount; i++) data.set(planes[i]!, F.clipPlanes + i * 4);
    data[F.clipInfo] = planeCount;
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
const UP = [0, 1, 0], FORWARD_UP = [0, 0, 1], ORIGIN = [0, 0, 0];
const scratchWorld = new Float32Array(16), scratchView = new Float32Array(16), scratchProjection = new Float32Array(16), scratchFrustum = new Float32Array(24);
const scratchInverse = new Float32Array(16), scratchCorners = new Float32Array(24), scratchPoint = new Float32Array(3), scratchCenter = new Float32Array(3);
const NDC_CORNERS = [-1, -1, 1, -1, -1, 1, 1, 1];
const K = 1 / Math.sqrt(3);
/** Outward face directions of a regular tetrahedron; the shaders pick the face a direction is closest to. */
const TETRAHEDRON_FACES = [[K, K, K], [-K, -K, K], [-K, K, -K], [K, -K, -K]];
// Each face's region reaches 70.53 degrees from its axis; a little more leaves room for filtering.
const TETRAHEDRON_FOV = 144 * Math.PI / 180;

/** View-space far distance of each cascade, blending uniform and logarithmic spacing. */
export function cascadeSplits3D(near: number, far: number, count: number, lambda: number): number[] {
    const splits: number[] = [], blend = Math.min(Math.max(lambda, 0), 1);
    for (let i = 1; i <= count; i++) {
        const fraction = i / count, uniform = near + (far - near) * fraction, logarithmic = near * Math.pow(far / near, fraction);
        splits.push(uniform + (logarithmic - uniform) * blend);
    }
    return splits;
}

/**
 * Assign shadow-casting lights to quarter tiles of a square atlas, compute
 * their matrices and caster lists, and write the shadow members of the block.
 * A cascaded directional light takes one tile per cascade, each fitted to a
 * slice of the camera frustum. `flipY` selects top-left atlas addressing for
 * backends whose texture origin is the top row.
 */
export function planShadows3D(data: Float32Array, list: RenderList3D, atlasSize: number, enabled: boolean, flipY: boolean,
    slots: Map<Light3D, number>, camera?: Camera3D): ShadowPlan3D[] {
    slots.clear();
    // The last two floats of pointShadow belong to the camera, written with the rest of the frame.
    data.fill(0, F.cascadeSplits, F.pointShadow + 2);
    data[F.cascadeInfo] = -1; data[F.pointShadow] = -1;
    const plans: ShadowPlan3D[] = [];
    if (!enabled || list.shadowCasters.length === 0) return plans;
    const tile = atlasSize >> 1;
    let cascaded = false;
    const emit = (light: Light3D, matrix: Float32Array, normalBiasScale: number): void => {
        const slot = plans.length, shadow = light.shadow;
        frustumFromMatrix(scratchFrustum, matrix);
        const x = (slot & 1) * tile, y = (slot >> 1) * tile;
        data.set(matrix, F.shadowMatrix + slot * 16);
        data[F.shadowRect + slot * 4] = x / atlasSize; data[F.shadowRect + slot * 4 + 1] = y / atlasSize;
        data[F.shadowRect + slot * 4 + 2] = tile / atlasSize; data[F.shadowRect + slot * 4 + 3] = (flipY ? -tile : tile) / atlasSize;
        if (flipY) data[F.shadowRect + slot * 4 + 1] = (y + tile) / atlasSize;
        data[F.shadowParams + slot * 4] = shadow.bias; data[F.shadowParams + slot * 4 + 1] = shadow.normalBias * normalBiasScale;
        data[F.shadowParams + slot * 4 + 2] = Math.max(shadow.radius, 0) / atlasSize; data[F.shadowParams + slot * 4 + 3] = 0;
        const casters: Mesh3D[] = [];
        for (const mesh of list.shadowCasters) {
            const sphere = mesh.worldBoundingSphere;
            if (mesh.frustumCulled && sphere[3]! >= 0 && !frustumIntersectsSphere(scratchFrustum, sphere)) continue;
            casters.push(mesh);
        }
        plans.push({light, slot, x, y, tile, matrix, casters});
    };
    const lights = [...list.directionalLights, ...list.spotLights].filter(light => light.castShadow);
    // One point light may cast shadows. It needs all four tiles: one per face of a
    // tetrahedron around it, which covers every direction with ordinary perspective maps.
    const point = list.pointLights.find(light => light.castShadow);
    if (point && lights.length === 0) {
        const m = point.matrixWorld, eye = [m[12]!, m[13]!, m[14]!], shadow = point.shadow, far = point.range > 0 ? Math.min(point.range, shadow.far) : shadow.far;
        slots.set(point, 0);
        mat4Perspective(scratchProjection, TETRAHEDRON_FOV, 1, shadow.near, far);
        for (const face of TETRAHEDRON_FACES) {
            mat4LookAt(scratchWorld, eye, [eye[0]! + face[0]!, eye[1]! + face[1]!, eye[2]! + face[2]!], Math.abs(face[1]!) > 0.9 ? FORWARD_UP : UP);
            mat4Invert(scratchView, scratchWorld);
            emit(point, mat4Multiply(new Float32Array(16), scratchProjection, scratchView) as Float32Array, 1);
        }
        data[F.pointShadow] = list.pointLights.indexOf(point); data[F.pointShadow + 1] = 0;
        return plans;
    }
    for (const light of lights) {
        const remaining = LIGHT3D_LIMITS.maxShadows - plans.length;
        if (remaining <= 0) break;
        const shadow = light.shadow, m = light.matrixWorld;
        // Pick an up vector that is not parallel to the light direction.
        const up = Math.abs(m[9]!) > 0.99 * Math.hypot(m[8]!, m[9]!, m[10]!) ? FORWARD_UP : UP;
        const cascades = Math.min(Math.max(Math.floor(shadow.cascades) || 1, 1), remaining);
        if (light.lightType === 'directional' && cascades > 1 && !cascaded && camera && mat4Invert(scratchInverse, camera.viewProjectionMatrix)) {
            cascaded = true;
            slots.set(light, plans.length);
            const length = Math.hypot(m[8]!, m[9]!, m[10]!) || 1, dx = -m[8]! / length, dy = -m[9]! / length, dz = -m[10]! / length;
            const near = camera.near, far = Math.max(Math.min(camera.far, shadow.cascadeDistance), near * 1.001);
            // Frustum corners on the near and far planes; any slice plane is a linear blend of the two.
            for (let i = 0; i < 4; i++) {
                for (let side = 0; side < 2; side++) {
                    scratchPoint[0] = NDC_CORNERS[i * 2]!; scratchPoint[1] = NDC_CORNERS[i * 2 + 1]!; scratchPoint[2] = side === 0 ? -1 : 1;
                    vec3TransformMat4(scratchPoint, scratchPoint, scratchInverse);
                    scratchCorners.set(scratchPoint, (side * 4 + i) * 3);
                }
            }
            const splits = camera.projectionKind === 'orthographic'
                ? cascadeSplits3D(near, far, cascades, 0) : cascadeSplits3D(near, far, cascades, shadow.cascadeLambda);
            // Rotation-only light frame used to snap cascade centers to whole texels.
            mat4LookAt(scratchWorld, ORIGIN, [dx, dy, dz], up);
            mat4Invert(scratchView, scratchWorld);
            const rotation = scratchWorld.slice(), inverseRotation = scratchView.slice(), range = camera.far - near;
            let firstRadius = 0, sliceNear = near;
            splits.forEach((sliceFar, index) => {
                const slice: number[] = [];
                scratchCenter.fill(0);
                for (const distance of [sliceNear, sliceFar]) {
                    const t = (distance - near) / range;
                    for (let i = 0; i < 4; i++) {
                        for (let axis = 0; axis < 3; axis++) {
                            const a = scratchCorners[i * 3 + axis]!, b = scratchCorners[(4 + i) * 3 + axis]!, value = a + (b - a) * t;
                            slice.push(value); scratchCenter[axis] = scratchCenter[axis]! + value / 8;
                        }
                    }
                }
                let radius = 0;
                for (let i = 0; i < 8; i++) radius = Math.max(radius, Math.hypot(slice[i * 3]! - scratchCenter[0]!, slice[i * 3 + 1]! - scratchCenter[1]!, slice[i * 3 + 2]! - scratchCenter[2]!));
                // A bounding sphere keeps the volume size constant while the camera turns;
                // rounding its radius and snapping its center stop shadow edges from crawling.
                radius = Math.ceil(radius * 16) / 16;
                const texel = radius * 2 / tile;
                vec3TransformMat4(scratchCenter, scratchCenter, inverseRotation);
                scratchCenter[0] = Math.floor(scratchCenter[0]! / texel) * texel; scratchCenter[1] = Math.floor(scratchCenter[1]! / texel) * texel;
                vec3TransformMat4(scratchCenter, scratchCenter, rotation);
                // Pull the eye back so casters between the light and the slice are still drawn.
                const back = Math.max(shadow.far, radius) + radius;
                const eye = [scratchCenter[0]! - dx * back, scratchCenter[1]! - dy * back, scratchCenter[2]! - dz * back];
                mat4LookAt(scratchWorld, eye, scratchCenter, up);
                mat4Invert(scratchView, scratchWorld);
                mat4Orthographic(scratchProjection, -radius, radius, -radius, radius, 0, back + radius);
                if (index === 0) firstRadius = radius;
                data[F.cascadeSplits + index] = sliceFar;
                emit(light, mat4Multiply(new Float32Array(16), scratchProjection, scratchView) as Float32Array, radius / firstRadius);
                sliceNear = sliceFar;
            });
            data[F.cascadeInfo] = list.directionalLights.indexOf(light); data[F.cascadeInfo + 1] = cascades;
            // Fraction of each cascade's far end that blends into the next one.
            data[F.cascadeInfo + 2] = 0.1;
            continue;
        }
        slots.set(light, plans.length);
        const eye = [m[12]!, m[13]!, m[14]!], target = [m[12]! - m[8]!, m[13]! - m[9]!, m[14]! - m[10]!];
        mat4LookAt(scratchWorld, eye, target, up);
        mat4Invert(scratchView, scratchWorld);
        if (light.lightType === 'spot') {
            const far = light.range > 0 ? Math.min(light.range, shadow.far) : shadow.far;
            mat4Perspective(scratchProjection, Math.min(light.angle * 2, Math.PI * 0.98), 1, shadow.near, far);
        } else mat4Orthographic(scratchProjection, -shadow.extent, shadow.extent, -shadow.extent, shadow.extent, shadow.near, shadow.far);
        emit(light, mat4Multiply(new Float32Array(16), scratchProjection, scratchView) as Float32Array, 1);
    }
    return plans;
}
