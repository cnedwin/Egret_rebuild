// SPDX-License-Identifier: Apache-2.0
// Height fog and light shafts as one post-processing hook. Fog thickens with
// distance and thins with height, in closed form along each view ray; shafts
// are the open sky around the sun smeared toward the viewer, so anything that
// stands in front of the sun cuts dark streaks into the haze.
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError, requireFinite3D} from '../../rendering/world3d/core3D.js';
import {colorFromHex} from '../../rendering/world3d/math3D.js';
import {type CustomPost3D, createCustomPost3D} from './post3D.js';

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

// uniforms: [0] fog rgb, density; [1] falloff, base height, sky distance, shaft intensity;
//           [2] sun uv, sun visibility, shaft length; [3] the camera's world Y axis in view space, camera height.
const GLSL = /* glsl */`
vec3 customPost(vec3 color, vec2 uv) {
    vec4 fog = uPostCustom[0], shape = uPostCustom[1], sun = uPostCustom[2], up = uPostCustom[3];
    vec3 view = unprojectDepth(uv, rawDepth(uv));
    float reach = length(view);
    if (fog.a > 0.0) {
        // Density falls off exponentially with height; its integral along the ray has a closed form.
        float rise = dot(up.xyz, view), slope = shape.x * rise;
        float thin = abs(slope) > 0.0001 ? (1.0 - exp(-slope)) / slope : 1.0;
        float depth = fog.a * exp(-shape.x * (up.w - shape.y)) * reach * thin;
        color = mix(fog.rgb, color, exp(-max(depth, 0.0)));
    }
    if (shape.w > 0.0 && sun.z > 0.0) {
        // March from the pixel toward the sun, gathering how much open sky lies on the way.
        vec2 stride = (sun.xy - uv) * (sun.w / 24.0);
        // Counted from the top row, as the other backend does, so both dither alike.
        vec2 pixel = vec2(uv.x, 1.0 - uv.y) * vec2(textureSize(uDepth, 0));
        float jitter = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
        vec2 at = uv + stride * jitter;
        float light = 0.0, weight = 1.0;
        for (int i = 0; i < 24; i++) {
            at += stride;
            float open = step(shape.z, sceneDepth(clamp(at, vec2(0.001), vec2(0.999))));
            float nearSun = 1.0 - smoothstep(0.0, 0.7, distance(at, sun.xy));
            light += open * nearSun * weight;
            weight *= 0.95;
        }
        color += vec3(1.0, 0.93, 0.78) * (light / 24.0 * shape.w * sun.z);
    }
    return color;
}
`;
const WGSL = /* wgsl */`
fn customPost(color: vec3f, uv: vec2f) -> vec3f {
    let fog = params.custom[0];
    let shape = params.custom[1];
    // Texture rows run top-down here, so the sun's height on screen is flipped.
    let sun = vec4f(params.custom[2].x, 1.0 - params.custom[2].y, params.custom[2].zw);
    let up = params.custom[3];
    var result = color;
    let view = unprojectDepth(uv, rawDepth(uv));
    let reach = length(view);
    if (fog.a > 0.0) {
        // Density falls off exponentially with height; its integral along the ray has a closed form.
        let rise = dot(up.xyz, view);
        let slope = shape.x * rise;
        var thin = 1.0;
        if (abs(slope) > 0.0001) { thin = (1.0 - exp(-slope)) / slope; }
        let depth = fog.a * exp(-shape.x * (up.w - shape.y)) * reach * thin;
        result = mix(fog.rgb, result, exp(-max(depth, 0.0)));
    }
    if (shape.w > 0.0 && sun.z > 0.0) {
        // March from the pixel toward the sun, gathering how much open sky lies on the way.
        let size = vec2f(textureDimensions(depthTexture));
        let stride = (sun.xy - uv) * (sun.w / 24.0);
        let jitter = fract(52.9829189 * fract(dot(uv * size, vec2f(0.06711056, 0.00583715))));
        var at = uv + stride * jitter;
        var light = 0.0;
        var weight = 1.0;
        for (var i = 0; i < 24; i++) {
            at += stride;
            let open = step(shape.z, sceneDepth(clamp(at, vec2f(0.001), vec2f(0.999))));
            let nearSun = 1.0 - smoothstep(0.0, 0.7, distance(at, sun.xy));
            light += open * nearSun * weight;
            weight *= 0.95;
        }
        result += vec3f(1.0, 0.93, 0.78) * (light / 24.0 * shape.w * sun.z);
    }
    return result;
}
`;

/**
 * Height fog and light shafts for `renderer.postProcess.custom`. Call
 * `update(camera, sunDirection)` every frame before rendering: the hook needs
 * to know where the camera and the sun are.
 */
export class Atmosphere3D {
    readonly post: CustomPost3D;
    readonly #scratch = [0, 0, 0];

    constructor(options: AtmosphereOptions3D = {}) {
        this.post = createCustomPost3D({key: 'world3d-atmosphere', glsl: GLSL, wgsl: WGSL});
        colorFromHex(this.post.uniforms, options.fogColor ?? 0xb4c4d4);
        this.fogDensity = options.fogDensity ?? 0.01;
        this.fogHeight = options.fogHeight ?? 0;
        this.fogFalloff = options.fogFalloff ?? 0.08;
        this.shaftIntensity = options.shaftIntensity ?? 0.6;
        this.shaftLength = options.shaftLength ?? 0.6;
    }
    get fogDensity(): number { return this.post.uniforms[3]!; }
    set fogDensity(value: number) { this.post.uniforms[3] = this.amount(value, 'fogDensity'); }
    get fogFalloff(): number { return this.post.uniforms[4]!; }
    set fogFalloff(value: number) { this.post.uniforms[4] = this.amount(value, 'fogFalloff'); }
    get fogHeight(): number { return this.post.uniforms[5]!; }
    set fogHeight(value: number) { this.post.uniforms[5] = requireFinite3D(value, 'fogHeight'); }
    get shaftIntensity(): number { return this.post.uniforms[7]!; }
    set shaftIntensity(value: number) { this.post.uniforms[7] = this.amount(value, 'shaftIntensity'); }
    get shaftLength(): number { return this.post.uniforms[11]!; }
    set shaftLength(value: number) { const length = this.amount(value, 'shaftLength'); if (length > 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'shaftLength'); this.post.uniforms[11] = length; }
    /** Linear RGB fog color. */
    setFogColor(r: number, g: number, b: number): void { this.post.uniforms[0] = requireFinite3D(r, 'color'); this.post.uniforms[1] = requireFinite3D(g, 'color'); this.post.uniforms[2] = requireFinite3D(b, 'color'); }
    /**
     * Refresh the camera and sun data. `sunDirection` is the direction the
     * sunlight travels in, as a directional light's world direction; pass
     * undefined when there is no sun, which leaves only the fog.
     */
    update(camera: Camera3D, sunDirection?: ArrayLike<number>): void {
        camera.updateViewMatrices();
        const u = this.post.uniforms, world = camera.matrixWorld;
        // World up expressed in view space is the second row of the camera's rotation.
        const sx = Math.hypot(world[0]!, world[1]!, world[2]!) || 1, sy = Math.hypot(world[4]!, world[5]!, world[6]!) || 1, sz = Math.hypot(world[8]!, world[9]!, world[10]!) || 1;
        u[12] = world[1]! / sx; u[13] = world[5]! / sy; u[14] = world[9]! / sz; u[15] = world[13]!;
        u[6] = camera.far * 0.98;
        u[10] = 0;
        if (!sunDirection) return;
        const dx = requireFinite3D(sunDirection[0], 'sunDirection'), dy = requireFinite3D(sunDirection[1], 'sunDirection'), dz = requireFinite3D(sunDirection[2], 'sunDirection'), length = Math.hypot(dx, dy, dz);
        if (length < 1e-9) return;
        // The sun sits far away against the light's travel; project that point to the screen.
        const far = camera.far * 0.5, at = this.#scratch;
        at[0] = world[12]! - dx / length * far; at[1] = world[13]! - dy / length * far; at[2] = world[14]! - dz / length * far;
        const forward = -(world[8]! * -dx + world[9]! * -dy + world[10]! * -dz) / (length * sz);
        if (forward <= 0.05) return;
        camera.worldToScreenPoint(at, at);
        u[8] = at[0]! * 0.5 + 0.5; u[9] = at[1]! * 0.5 + 0.5;
        // Fade the shafts out as the sun leaves the view.
        const off = Math.max(Math.abs(at[0]!), Math.abs(at[1]!));
        u[10] = Math.min(1, forward * 2) * Math.max(0, Math.min(1, (1.8 - off) / 0.8));
    }
    private amount(value: number, field: string): number {
        if (requireFinite3D(value, field) < 0) throw new World3DError('WORLD3D_INPUT_INVALID', field);
        return value;
    }
}
export function createAtmosphere3D(options: AtmosphereOptions3D = {}): Atmosphere3D { return new Atmosphere3D(options); }
