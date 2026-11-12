// SPDX-License-Identifier: Apache-2.0
// Fog that is lit: every pixel's view ray is walked through the air, and at
// each step the fog there scatters the light that reaches it. The sun's
// shadow map is consulted on the way, so shafts of light and shadow stand in
// the fog wherever something blocks the sun, whether or not the sun is in
// view; spot and point lights glow in it too. DOM-free: it is a mesh drawn in
// front of the camera, with shader hooks in both languages.
import {World3DError, requireFinite3D} from './core3D.js';
import type {Camera3D} from './Camera3D.js';
import {type ColorInput3D, type CustomShader3D, createCustomShader3D, createLambertMaterial3D, setColor3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import {quatFromRotationMatrix} from './math3D.js';
import {createQuadGeometry3D} from './primitives3D.js';

export interface VolumetricFogOptions3D {
    readonly color?: ColorInput3D;
    /** Fog thickness per world unit at `height`. Default 0.02. */
    readonly density?: number;
    /** World height at which the fog has its stated density. Default 0. */
    readonly height?: number;
    /** How quickly the fog thins with height, per world unit; 0 gives uniform fog. Default 0.1. */
    readonly falloff?: number;
    /** The fog is walked no further than this from the camera. Default 120. */
    readonly distance?: number;
    /** -1 to 1: above 0 the fog glows toward each light, as haze around the sun does. Default 0.6. */
    readonly anisotropy?: number;
    /** How strongly directional lights, ambient light, and spot and point lights light the fog. Defaults: 0.3, 0.5 and 1. */
    readonly sunStrength?: number;
    readonly ambientStrength?: number;
    readonly lightStrength?: number;
}

// uniforms: [0] color, density; [1] falloff, height, distance, anisotropy; [2] sun, ambient and local light strength.
const GLSL = /* glsl */`
float fogPhase(float cosine, float g) { return (1.0 - g * g) / pow(max(1.0 + g * g - 2.0 * g * cosine, 0.0001), 1.5); }
vec4 customFragment(vec4 color, vec3 worldPosition, vec3 normal, vec2 uv) {
    vec4 fog = uCustom[0], shape = uCustom[1], strength = uCustom[2];
    vec3 eye = uCameraPosition.xyz, ray = normalize(worldPosition - eye);
    // How far the ray runs before it meets solid geometry, capped.
    float reach = min(sceneDistance / max(dot(ray, -vec3(uView[0].z, uView[1].z, uView[2].z)), 0.05), shape.z);
    float stride = reach / 24.0, jitter = fract(52.9829189 * fract(dot(surfacePixel, vec2(0.06711056, 0.00583715))));
    vec3 ambient = (uAmbient.rgb + 0.5 * (uHemisphereSky.rgb + uHemisphereGround.rgb)) * strength.y, light = vec3(0.0);
    float clear = 1.0;
    int directionalCount = int(uLightCounts.x), pointCount = int(uLightCounts.y), spotCount = int(uLightCounts.z);
    for (int i = 0; i < 24; i++) {
        vec3 at = eye + ray * ((float(i) + jitter) * stride);
        float through = exp(-fog.a * exp(-shape.x * (at.y - shape.y)) * stride);
        vec3 lit = ambient;
        for (int d = 0; d < directionalCount; d++) {
            float visible = 1.0;
            #ifdef RECEIVE_SHADOW
            if (uDirectionalDirection[d].w >= 0.0) visible = volumeShadow(int(uDirectionalDirection[d].w), at, float(d) == uCascadeInfo.x);
            #endif
            lit += uDirectionalColor[d].rgb * (visible * fogPhase(dot(ray, -uDirectionalDirection[d].xyz), shape.w) * strength.x);
        }
        for (int s = 0; s < spotCount; s++) {
            vec3 toLight = uSpotPosition[s].xyz - at;
            float dist = length(toLight);
            float cone = smoothstep(uSpotCone[s].x, uSpotCone[s].y, dot(-toLight / max(dist, 0.0001), uSpotDirection[s].xyz));
            if (cone <= 0.0) continue;
            float visible = 1.0;
            #ifdef RECEIVE_SHADOW
            if (uSpotDirection[s].w >= 0.0) visible = volumeShadow(int(uSpotDirection[s].w), at, false);
            #endif
            lit += uSpotColor[s].rgb * (rangeFalloff(dist, uSpotPosition[s].w) * cone * visible * strength.z);
        }
        for (int p = 0; p < pointCount; p++) lit += uPointColor[p].rgb * (rangeFalloff(max(distance(uPointPosition[p].xyz, at), 0.5), uPointPosition[p].w) * strength.z);
        light += lit * (clear * (1.0 - through));
        clear *= through;
    }
    float cover = 1.0 - clear;
    return vec4(fog.rgb * light / max(cover, 0.0001), cover);
}
`;
const WGSL = /* wgsl */`
fn fogPhase(cosine: f32, g: f32) -> f32 { return (1.0 - g * g) / pow(max(1.0 + g * g - 2.0 * g * cosine, 0.0001), 1.5); }
fn customFragment(color: vec4f, worldPosition: vec3f, normal: vec3f, uv: vec2f) -> vec4f {
    let fog = material.custom[0];
    let shape = material.custom[1];
    let strength = material.custom[2];
    let eye = frame.cameraPosition.xyz;
    let ray = normalize(worldPosition - eye);
    // How far the ray runs before it meets solid geometry, capped.
    let reach = min(sceneDistance / max(dot(ray, -vec3f(frame.view[0].z, frame.view[1].z, frame.view[2].z)), 0.05), shape.z);
    let stride = reach / 24.0;
    let jitter = fract(52.9829189 * fract(dot(surfacePixel, vec2f(0.06711056, 0.00583715))));
    let ambient = (frame.ambient.rgb + 0.5 * (frame.hemisphereSky.rgb + frame.hemisphereGround.rgb)) * strength.y;
    var light = vec3f(0.0);
    var clear = 1.0;
    let directionalCount = i32(frame.lightCounts.x);
    let pointCount = i32(frame.lightCounts.y);
    let spotCount = i32(frame.lightCounts.z);
    for (var i = 0; i < 24; i++) {
        let at = eye + ray * ((f32(i) + jitter) * stride);
        let through = exp(-fog.a * exp(-shape.x * (at.y - shape.y)) * stride);
        var lit = ambient;
        for (var d = 0; d < directionalCount; d++) {
            var visible = 1.0;
            if (frame.directionalDirection[d].w >= 0.0) { visible = volumeShadow(i32(frame.directionalDirection[d].w), at, f32(d) == frame.cascadeInfo.x); }
            lit += frame.directionalColor[d].rgb * (visible * fogPhase(dot(ray, -frame.directionalDirection[d].xyz), shape.w) * strength.x);
        }
        for (var s = 0; s < spotCount; s++) {
            let toLight = frame.spotPosition[s].xyz - at;
            let dist = length(toLight);
            let cone = smoothstep(frame.spotCone[s].x, frame.spotCone[s].y, dot(-toLight / max(dist, 0.0001), frame.spotDirection[s].xyz));
            if (cone <= 0.0) { continue; }
            var visible = 1.0;
            if (frame.spotDirection[s].w >= 0.0) { visible = volumeShadow(i32(frame.spotDirection[s].w), at, false); }
            lit += frame.spotColor[s].rgb * (rangeFalloff(dist, frame.spotPosition[s].w) * cone * visible * strength.z);
        }
        for (var p = 0; p < pointCount; p++) { lit += frame.pointColor[p].rgb * (rangeFalloff(max(distance(frame.pointPosition[p].xyz, at), 0.5), frame.pointPosition[p].w) * strength.z); }
        light += lit * (clear * (1.0 - through));
        clear *= through;
    }
    let cover = 1.0 - clear;
    return vec4f(fog.rgb * light / max(cover, 0.0001), cover);
}
`;

/**
 * Add one to the scene's root and keep `receiveShadow` on. Before each draw
 * it places itself in front of whichever camera is rendering. It asks the
 * renderer for the depth of the solid scene, so the walk stops at walls, and
 * it replaces `scene.fog` and the atmosphere post hook rather than adding to
 * them. Each pixel takes 24 steps, each reading every light.
 */
export class VolumetricFog3D extends Mesh3D {
    readonly #uniforms: Float32Array;
    readonly #basis = new Float32Array(16);

    constructor(options: VolumetricFogOptions3D = {}) {
        const material = createLambertMaterial3D({color: 0x000000, alphaMode: 'blend', depthTest: false, depthWrite: false, fog: false, side: 'double'});
        const shader: CustomShader3D = createCustomShader3D({key: 'world3d-volumetric-fog', glsl: GLSL, wgsl: WGSL});
        material.shader = shader;
        // Asks for the depth image; next to the camera the fade it also brings is always complete.
        material.softness = 1e-3;
        super(createQuadGeometry3D(), material);
        this.name = 'volumetric-fog';
        this.castShadow = false; this.receiveShadow = true; this.frustumCulled = false; this.pickable = false;
        this.renderOrder = 1000;
        this.#uniforms = shader.uniforms;
        setColor3D(this.#uniforms.subarray(0, 3) as Float32Array, options.color ?? 0xc8d4e0);
        this.density = options.density ?? 0.02; this.height = options.height ?? 0; this.falloff = options.falloff ?? 0.1;
        this.distance = options.distance ?? 120; this.anisotropy = options.anisotropy ?? 0.6;
        this.sunStrength = options.sunStrength ?? 0.3; this.ambientStrength = options.ambientStrength ?? 0.5; this.lightStrength = options.lightStrength ?? 1;
        this.beforeRender = (camera: Camera3D) => this.face(camera);
    }
    get density(): number { return this.#uniforms[3]!; }
    set density(value: number) { this.#uniforms[3] = this.amount(value, 'density'); }
    get falloff(): number { return this.#uniforms[4]!; }
    set falloff(value: number) { this.#uniforms[4] = this.amount(value, 'falloff'); }
    get height(): number { return this.#uniforms[5]!; }
    set height(value: number) { this.#uniforms[5] = requireFinite3D(value, 'height'); }
    get distance(): number { return this.#uniforms[6]!; }
    set distance(value: number) { this.#uniforms[6] = this.amount(value, 'distance'); }
    get anisotropy(): number { return this.#uniforms[7]!; }
    set anisotropy(value: number) { if (!(Math.abs(requireFinite3D(value, 'anisotropy')) < 1)) throw new World3DError('WORLD3D_INPUT_INVALID', 'anisotropy'); this.#uniforms[7] = value; }
    get sunStrength(): number { return this.#uniforms[8]!; }
    set sunStrength(value: number) { this.#uniforms[8] = this.amount(value, 'sunStrength'); }
    get ambientStrength(): number { return this.#uniforms[9]!; }
    set ambientStrength(value: number) { this.#uniforms[9] = this.amount(value, 'ambientStrength'); }
    get lightStrength(): number { return this.#uniforms[10]!; }
    set lightStrength(value: number) { this.#uniforms[10] = this.amount(value, 'lightStrength'); }
    /** Linear RGB fog color. */
    setColor(color: ColorInput3D): void { setColor3D(this.#uniforms.subarray(0, 3) as Float32Array, color); }
    /** Release the geometry and the material. */
    dispose(): void { this.geometry.dispose(); if (!Array.isArray(this.material)) this.material.dispose(); }
    /** Stand just beyond the camera's near plane, turned as it is and large enough to cover its view. */
    private face(camera: Camera3D): void {
        camera.updateWorldMatrix();
        const eye = camera.matrixWorld, basis = this.#basis, p = camera.projectionMatrix;
        for (let column = 0; column < 3; column++) {
            const x = eye[column * 4]!, y = eye[column * 4 + 1]!, z = eye[column * 4 + 2]!, length = Math.hypot(x, y, z) || 1;
            basis[column * 4] = x / length; basis[column * 4 + 1] = y / length; basis[column * 4 + 2] = z / length;
        }
        quatFromRotationMatrix(this.quaternion, basis);
        // Twice the near distance keeps clear of the near plane; the projection's scale terms say how wide the view is there.
        const perspective = p[15] === 0, away = perspective ? Math.max(camera.near * 2, 1e-3) : camera.near + (camera.far - camera.near) * 0.01;
        const halfWidth = (perspective ? away : 1) * (1 + Math.abs(p[8]!)) / Math.max(Math.abs(p[0]!), 1e-6), halfHeight = (perspective ? away : 1) * (1 + Math.abs(p[9]!)) / Math.max(Math.abs(p[5]!), 1e-6);
        this.setPosition(eye[12]! - basis[8]! * away, eye[13]! - basis[9]! * away, eye[14]! - basis[10]! * away);
        this.setScale(halfWidth * 2.2, halfHeight * 2.2, 1);
        this.markTransformDirty();
        this.updateWorldMatrix();
    }
    private amount(value: number, field: string): number {
        if (requireFinite3D(value, field) < 0) throw new World3DError('WORLD3D_INPUT_INVALID', field);
        return value;
    }
}
export function createVolumetricFog3D(options: VolumetricFogOptions3D = {}): VolumetricFog3D { return new VolumetricFog3D(options); }
