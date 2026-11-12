// SPDX-License-Identifier: Apache-2.0
// Water: a wavy, refracting, reflecting surface, and the mirror camera that
// gives any flat surface a true reflection of the scene. DOM-free; the same
// wave formula runs in both shading languages and on the CPU, so objects can
// float on what the player sees.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {Camera3D} from './Camera3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import {Material3D, createCustomShader3D, createStandardMaterial3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import type {Object3D, Scene3D} from './Object3D.js';
import {RenderTarget3D, TEXTURE3D_LIMITS} from './Texture3D.js';
import {colorFromHex, mat4Invert, quatFromRotationMatrix} from './math3D.js';

/** Anything that can draw a scene into a render target: both first-party renderers qualify. */
export interface ReflectionRenderer3D {
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean;
    /** When present, post-processing is switched off while the mirror image is drawn. */
    readonly postProcess?: {enabled: boolean};
    /** When present, shadows can be left out of the mirror image. */
    shadowsEnabled?: boolean;
}

/**
 * A mirror camera and the target it draws into. Each frame, before the main
 * view, call `render` with the plane of the mirror; assign `texture` to a
 * standard material's `reflectionMap`. Whatever lies behind the plane is cut
 * away, so the ground under a lake does not show up in its reflection.
 */
export class PlanarReflection3D {
    readonly target: RenderTarget3D;
    readonly #perspectiveCamera = new Camera3D();
    readonly #orthographicCamera = new Camera3D('orthographic');
    #camera = this.#perspectiveCamera;
    get camera(): Camera3D { return this.#camera; }
    /** Moves the cutting plane back by this distance so geometry touching the mirror leaves no gap. */
    clipBias = 0.05;
    /** Draw the mirror image on every Nth call only; in between, the last image is kept. 1 draws every time. */
    interval = 1;
    /** Only objects on these layers appear in the mirror image: leave small or distant things out to save time. */
    layerMask = 0xffffffff;
    /** false leaves shadows out of the mirror image, which saves the shadow passes for it. */
    shadows = true;
    #calls = 0;
    #drawn: {renderer: ReflectionRenderer3D; scene: Scene3D; version: number} | undefined;
    readonly #projection = new Float32Array(16);
    readonly #perspectiveProjection = new Float32Array(16);
    readonly #orthographicProjection = new Float32Array(16);
    readonly #inverseProjection = new Float64Array(16);
    readonly #basis = new Float32Array(16);

    constructor(options: {readonly width?: number; readonly height?: number} = {}) {
        const width = requireCount3D(options.width ?? 512, 'reflection width', TEXTURE3D_LIMITS.maxEdge), height = requireCount3D(options.height ?? 512, 'reflection height', TEXTURE3D_LIMITS.maxEdge);
        this.target = new RenderTarget3D(width, height, {name: 'planar-reflection'});
        this.#perspectiveCamera.name = this.#orthographicCamera.name = 'reflection-camera';
    }
    get texture(): RenderTarget3D['texture'] { return this.target.texture; }
    /**
     * Place the mirror camera for a viewing camera and a world plane given as
     * [nx, ny, nz, d] with unit normal, where n . p + d = 0 and the normal
     * points to the side the viewer is on. Returns false when the viewer is
     * behind the plane or the projection cannot represent a forward clip.
     */
    update(camera: Camera3D, plane: ArrayLike<number>): boolean {
        const nx = requireFinite3D(plane[0], 'plane'), ny = requireFinite3D(plane[1], 'plane'), nz = requireFinite3D(plane[2], 'plane'), d = requireFinite3D(plane[3], 'plane');
        if (Math.abs(Math.hypot(nx, ny, nz) - 1) > 1e-3) throw new World3DError('WORLD3D_INPUT_INVALID', 'plane normal must have unit length');
        camera.updateViewMatrices();
        const from = camera.matrixWorld, basis = this.#basis;
        const orthographic = camera.projectionKind === 'orthographic';
        const mirror = orthographic ? this.#orthographicCamera : this.#perspectiveCamera;
        const height = from[12]! * nx + from[13]! * ny + from[14]! * nz + d;
        if (height <= 0) return false;
        // Reflect the camera's axes and position; flipping its X axis as well keeps it a proper rotation.
        for (let column = 0; column < 3; column++) {
            const x = from[column * 4]!, y = from[column * 4 + 1]!, z = from[column * 4 + 2]!, length = Math.hypot(x, y, z) || 1, along = 2 * (x * nx + y * ny + z * nz), sign = (column === 0 ? -1 : 1) / length;
            basis[column * 4] = (x - along * nx) * sign; basis[column * 4 + 1] = (y - along * ny) * sign; basis[column * 4 + 2] = (z - along * nz) * sign;
        }
        quatFromRotationMatrix(mirror.quaternion, basis);
        mirror.setQuaternion(mirror.quaternion[0]!, mirror.quaternion[1]!, mirror.quaternion[2]!, mirror.quaternion[3]!);
        mirror.setPosition(from[12]! - 2 * height * nx, from[13]! - 2 * height * ny, from[14]! - 2 * height * nz);
        mirror.fov = camera.fov; mirror.aspect = camera.aspect; mirror.near = camera.near; mirror.far = camera.far; mirror.zoom = camera.zoom;
        mirror.orthographicHeight = camera.orthographicHeight; mirror.layerMask = camera.layerMask;
        const p = this.#projection, inverse = this.#inverseProjection;
        p.set(camera.projectionMatrix);
        if (!mat4Invert(inverse, p)) return false;
        mirror.updateWorldMatrix();
        const world = mirror.matrixWorld;
        const cx = world[0]! * nx + world[1]! * ny + world[2]! * nz, cy = world[4]! * nx + world[5]! * ny + world[6]! * nz, cz = world[8]! * nx + world[9]! * ny + world[10]! * nz;
        const cw = world[12]! * nx + world[13]! * ny + world[14]! * nz + d + requireFinite3D(this.clipBias, 'clipBias');
        if (cw < 0 || orthographic) {
            // Transform the plane to clip space. Its furthest kept corner sets the scale;
            // replacing z + w clips against the plane while preserving the projected x and y.
            const clip = (column: number): number => cx * inverse[column]! + cy * inverse[column + 1]! + cz * inverse[column + 2]! + cw * inverse[column + 3]!;
            const depth = clip(8), farSide = Math.abs(clip(0)) + Math.abs(clip(4)) + Math.abs(depth) + clip(12);
            if (depth === 0 || !Number.isFinite(farSide) || farSide <= 0) return false;
            // Orthographic rays share a direction. A tangent or backward plane
            // would make the replacement depth singular or reverse depth order.
            if (orthographic && depth / farSide <= 1e-7) return false;
            const scale = 2 / farSide;
            p[2] = cx * scale - p[3]!; p[6] = cy * scale - p[7]!;
            p[10] = cz * scale - p[11]!; p[14] = cw * scale - p[15]!;
        }
        const projection = orthographic ? this.#orthographicProjection : this.#perspectiveProjection;
        projection.set(p);
        mirror.customProjection = projection;
        mirror.updateViewMatrices();
        this.#camera = mirror;
        return true;
    }
    /**
     * Update the mirror camera and draw the scene into the target. Objects in
     * `hidden`, normally the mirror itself, are left out of the image.
     */
    render(renderer: ReflectionRenderer3D, scene: Scene3D, camera: Camera3D, plane: ArrayLike<number>, hidden: readonly Object3D[] = []): boolean {
        const interval = requireCount3D(this.interval, 'reflection interval', Number.MAX_SAFE_INTEGER);
        if (interval === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'reflection interval');
        if (this.target.isDisposed || !this.update(camera, plane)) { this.#drawn = undefined; return false; }
        this.camera.layerMask = camera.layerMask & this.layerMask;
        const scheduled = this.#calls === 0;
        this.#calls = (this.#calls + 1) % interval;
        const drawn = this.#drawn;
        if (!scheduled && drawn?.renderer === renderer && drawn.scene === scene && drawn.version === this.target.version) return true;
        this.#drawn = undefined;

        const shadowsEnabled = renderer.shadowsEnabled, post = renderer.postProcess, postEnabled = post?.enabled;
        const disableShadows = !this.shadows && shadowsEnabled !== undefined;
        const shown = hidden.map(object => object.visible);
        let touchedShadows = false, touchedPost = false, touchedHidden = 0;
        let result = false, primary: {cause: unknown} | undefined, cleanupErrors: unknown[] | undefined;
        try {
            if (disableShadows) { touchedShadows = true; renderer.shadowsEnabled = false; }
            for (const object of hidden) { touchedHidden++; object.visible = false; }
            if (post) { touchedPost = true; post.enabled = false; }
            result = renderer.render(scene, this.camera, this.target);
        } catch (cause) { primary = {cause}; }

        // Restore every owned setting, even when setup, rendering or another restoration fails.
        const restore = (action: () => void): void => {
            try { action(); } catch (cause) { (cleanupErrors ??= []).push(cause); }
        };
        if (post && touchedPost) restore(() => { post.enabled = postEnabled!; });
        for (let i = touchedHidden - 1; i >= 0; i--) restore(() => { hidden[i]!.visible = shown[i]!; });
        if (touchedShadows) restore(() => { renderer.shadowsEnabled = shadowsEnabled!; });
        if (cleanupErrors) {
            const causes = primary ? [primary.cause, ...cleanupErrors] : cleanupErrors;
            if (causes.length === 1) throw causes[0];
            throw new AggregateError(causes, 'WORLD3D_REFLECTION_FAILED');
        }
        if (primary) throw primary.cause;
        if (result) this.#drawn = {renderer, scene, version: this.target.version};
        return result;
    }
    dispose(): void { this.#drawn = undefined; this.target.dispose(); }
}

// Four waves share one formula: each is turned from the main direction,
// shorter and lower than the one before. Deep-water waves travel at
// sqrt(g * wavelength / 2 pi), so the short ones run slower.
const WAVE_TURN = [0, 0.63, -0.94, 1.71], WAVE_LENGTH = [1, 0.62, 0.37, 0.23], WAVE_HEIGHT = [1, 0.55, 0.3, 0.16];
const GLSL_WAVES = /* glsl */`
const float WATER_TURN[4] = float[4](0.0, 0.63, -0.94, 1.71);
const float WATER_LENGTH[4] = float[4](1.0, 0.62, 0.37, 0.23);
const float WATER_HEIGHT[4] = float[4](1.0, 0.55, 0.3, 0.16);
// Returns the sideways pull in xz and the height in y; writes the surface slope.
vec3 waterWaves(vec2 p, out vec2 slope) {
    vec4 a = uCustom[0], b = uCustom[1];
    vec3 moved = vec3(0.0);
    slope = vec2(0.0);
    float heading = atan(b.y, b.x);
    for (int i = 0; i < 4; i++) {
        float angle = heading + WATER_TURN[i], wavelength = a.z * WATER_LENGTH[i], k = 6.2831853 / wavelength, height = a.y * WATER_HEIGHT[i];
        vec2 d = vec2(cos(angle), sin(angle));
        float phase = k * dot(d, p) - sqrt(9.81 * k) * a.w * a.x;
        moved.y += height * sin(phase);
        moved.xz -= d * (b.z * height * cos(phase));
        slope += d * (height * k * cos(phase));
    }
    return moved;
}
`;
const GLSL_VERTEX = GLSL_WAVES + /* glsl */`
vec3 customVertex(vec3 worldPosition, vec3 localPosition, vec3 normal, vec2 uv, vec4 color) {
    vec2 slope;
    vec3 moved = waterWaves(worldPosition.xz, slope);
    return worldPosition + vec3(moved.x, moved.y, moved.z);
}
`;
const GLSL_NORMAL = GLSL_WAVES + /* glsl */`
vec3 customNormal(vec3 normal, vec3 worldPosition, vec2 uv) {
    vec2 slope;
    waterWaves(worldPosition.xz, slope);
    // Fine ripples: short waves that fade with distance so they do not shimmer far away.
    vec4 a = uCustom[0], b = uCustom[1], c = uCustom[2];
    float fade = b.w / (1.0 + distance(uCameraPosition.xyz, worldPosition) * c.y);
    for (int i = 0; i < 5; i++) {
        float angle = 1.3 + float(i) * 2.399963, k = 6.2831853 / (c.x * (1.0 + float(i) * 0.37));
        vec2 d = vec2(cos(angle), sin(angle));
        slope += d * (fade * cos(k * dot(d, worldPosition.xz) - sqrt(9.81 * k) * a.w * a.x + float(i) * 1.7));
    }
    return vec3(-slope.x, 1.0, -slope.y);
}
`;
const WGSL_VERTEX = /* wgsl */`
struct WaterWaves { moved: vec3f, slope: vec2f }
fn waterWaves(p: vec2f) -> WaterWaves {
    var turn = array<f32, 4>(0.0, 0.63, -0.94, 1.71);
    var lengths = array<f32, 4>(1.0, 0.62, 0.37, 0.23);
    var heights = array<f32, 4>(1.0, 0.55, 0.3, 0.16);
    let a = material.custom[0];
    let b = material.custom[1];
    var out: WaterWaves;
    out.moved = vec3f(0.0);
    out.slope = vec2f(0.0);
    let heading = atan2(b.y, b.x);
    for (var i = 0; i < 4; i++) {
        let angle = heading + turn[i];
        let k = 6.2831853 / (a.z * lengths[i]);
        let height = a.y * heights[i];
        let d = vec2f(cos(angle), sin(angle));
        let phase = k * dot(d, p) - sqrt(9.81 * k) * a.w * a.x;
        out.moved.y += height * sin(phase);
        let pull = d * (b.z * height * cos(phase));
        out.moved.x -= pull.x;
        out.moved.z -= pull.y;
        out.slope += d * (height * k * cos(phase));
    }
    return out;
}
fn customVertex(worldPosition: vec3f, localPosition: vec3f, normal: vec3f, uv: vec2f, color: vec4f) -> vec3f {
    return worldPosition + waterWaves(worldPosition.xz).moved;
}
`;
const WGSL_NORMAL = /* wgsl */`
fn customNormal(normal: vec3f, worldPosition: vec3f, uv: vec2f) -> vec3f {
    var slope = waterWaves(worldPosition.xz).slope;
    let a = material.custom[0];
    let b = material.custom[1];
    let c = material.custom[2];
    let fade = b.w / (1.0 + distance(frame.cameraPosition.xyz, worldPosition) * c.y);
    for (var i = 0; i < 5; i++) {
        let angle = 1.3 + f32(i) * 2.399963;
        let k = 6.2831853 / (c.x * (1.0 + f32(i) * 0.37));
        let d = vec2f(cos(angle), sin(angle));
        slope += d * (fade * cos(k * dot(d, worldPosition.xz) - sqrt(9.81 * k) * a.w * a.x + f32(i) * 1.7));
    }
    return vec3f(-slope.x, 1.0, -slope.y);
}
`;

const GLSL_FRAGMENT = /* glsl */`
vec4 customFragment(vec4 color, vec3 worldPosition, vec3 normal, vec2 uv) {
    vec4 a = uCustom[0], look = uCustom[3];
    float gap = sceneDistance - surfaceDistance;
    // Without a depth image there is no telling how deep the water is here.
    if (gap > 1.0e8 || gap < 0.0) return vec4(color.rgb, 1.0);
    float clock = a.x * a.w;
    // Foam: a band along the shore, broken up by two crossing ripples that drift.
    float edge = 1.0 - smoothstep(0.0, max(look.x, 0.0001), gap);
    float broken = 0.5 + 0.5 * sin(dot(worldPosition.xz, vec2(1.7, 2.3)) * 2.0 + clock * 1.5) * sin(dot(worldPosition.xz, vec2(-2.1, 1.3)) * 1.6 - clock);
    float foam = smoothstep(0.35, 0.8, edge * (0.6 + 0.8 * broken)) * look.y;
    // Caustics: light gathered by the waves, drawn on the bottom where it is seen through shallow water.
    vec3 ray = normalize(worldPosition - uCameraPosition.xyz);
    float facing = max(dot(ray, -vec3(uView[0].z, uView[1].z, uView[2].z)), 0.05);
    vec3 bottom = worldPosition + ray * (gap / facing);
    float web = sin(bottom.x * 2.1 + sin(bottom.z * 1.7 + clock)) + sin(bottom.z * 2.3 + sin(bottom.x * 1.9 - clock * 1.3));
    float light = pow(1.0 - abs(web) * 0.5, 6.0) * look.z * exp(-gap / max(look.w, 0.0001));
    vec3 lit = color.rgb + vec3(0.85, 1.0, 0.9) * light;
    return vec4(mix(lit, vec3(0.92), foam), 1.0 - foam);
}
`;
const WGSL_FRAGMENT = /* wgsl */`
fn customFragment(color: vec4f, worldPosition: vec3f, normal: vec3f, uv: vec2f) -> vec4f {
    let a = material.custom[0];
    let look = material.custom[3];
    let gap = sceneDistance - surfaceDistance;
    // Without a depth image there is no telling how deep the water is here.
    if (gap > 1.0e8 || gap < 0.0) { return vec4f(color.rgb, 1.0); }
    let clock = a.x * a.w;
    // Foam: a band along the shore, broken up by two crossing ripples that drift.
    let edge = 1.0 - smoothstep(0.0, max(look.x, 0.0001), gap);
    let broken = 0.5 + 0.5 * sin(dot(worldPosition.xz, vec2f(1.7, 2.3)) * 2.0 + clock * 1.5) * sin(dot(worldPosition.xz, vec2f(-2.1, 1.3)) * 1.6 - clock);
    let foam = smoothstep(0.35, 0.8, edge * (0.6 + 0.8 * broken)) * look.y;
    // Caustics: light gathered by the waves, drawn on the bottom where it is seen through shallow water.
    let ray = normalize(worldPosition - frame.cameraPosition.xyz);
    let facing = max(dot(ray, -vec3f(frame.view[0].z, frame.view[1].z, frame.view[2].z)), 0.05);
    let bottom = worldPosition + ray * (gap / facing);
    let web = sin(bottom.x * 2.1 + sin(bottom.z * 1.7 + clock)) + sin(bottom.z * 2.3 + sin(bottom.x * 1.9 - clock * 1.3));
    let light = pow(1.0 - abs(web) * 0.5, 6.0) * look.z * exp(-gap / max(look.w, 0.0001));
    let lit = color.rgb + vec3f(0.85, 1.0, 0.9) * light;
    return vec4f(mix(lit, vec3f(0.92), foam), 1.0 - foam);
}
`;

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

interface UnderwaterFogOverride3D {
    readonly scene: Scene3D;
    readonly previous: Scene3D['fog'];
    readonly installed: NonNullable<Scene3D['fog']>;
}
// A scene has one fog slot; another water node waits until its owner releases it.
const underwaterFogOwners = new WeakMap<Scene3D, UnderwaterFogOverride3D>();

/**
 * A horizontal water surface. Waves move its vertices and its shading
 * normal; what is under the surface is seen bent through it; the sky reflects
 * from the scene's environment map, and the scene itself after each
 * `renderReflection`. Keep the mesh unrotated: the mirror plane is its world
 * height.
 */
export class Water3D extends Mesh3D {
    readonly reflection: PlanarReflection3D | undefined;
    readonly #uniforms: Float32Array;
    readonly #plane = [0, 1, 0, 0];
    #fogOverride: UnderwaterFogOverride3D | undefined;

    constructor(options: WaterOptions3D = {}) {
        const width = requirePositive3D(options.width ?? 100, 'width'), depth = requirePositive3D(options.depth ?? 100, 'depth'), segments = requireCount3D(options.segments ?? 96, 'segments', 1024);
        if (segments < 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'segments');
        const side = segments + 1, positions = new Float32Array(side * side * 3), normals = new Float32Array(side * side * 3), uvs = new Float32Array(side * side * 2), indices = new Uint32Array(segments * segments * 6);
        for (let iz = 0, at = 0; iz < side; iz++) {
            for (let ix = 0; ix < side; ix++, at++) {
                positions[at * 3] = (ix / segments - 0.5) * width; positions[at * 3 + 2] = (iz / segments - 0.5) * depth;
                normals[at * 3 + 1] = 1; uvs[at * 2] = ix / segments; uvs[at * 2 + 1] = iz / segments;
            }
        }
        for (let iz = 0, at = 0; iz < segments; iz++) {
            for (let ix = 0; ix < segments; ix++) {
                const a = iz * side + ix, b = a + 1, d = a + side, e = d + 1;
                indices[at++] = a; indices[at++] = d; indices[at++] = b; indices[at++] = b; indices[at++] = d; indices[at++] = e;
            }
        }
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(positions, 3));
        geometry.setAttribute('normal', new Attribute3D(normals, 3));
        geometry.setAttribute('uv', new Attribute3D(uvs, 2));
        geometry.setIndex(side * side > 65535 ? indices : Uint16Array.from(indices));
        const material = createWaterMaterial3D(options);
        super(geometry, material);
        this.name = 'water';
        this.castShadow = false;
        this.#uniforms = material.shader!.uniforms;
        const size = requireCount3D(options.reflectionSize ?? 512, 'reflectionSize', TEXTURE3D_LIMITS.maxEdge);
        if (size > 0) {
            this.reflection = new PlanarReflection3D({width: size, height: size});
            material.reflectionMap = this.reflection.texture;
        }
    }
    /** Seconds the waves have been running; set it to keep several clients in step. */
    get time(): number { return this.#uniforms[0]!; }
    set time(value: number) { this.#uniforms[0] = requireFinite3D(value, 'time'); }
    get amplitude(): number { return this.#uniforms[1]!; }
    set amplitude(value: number) { this.#uniforms[1] = requireFinite3D(value, 'amplitude'); }
    /** Advance the waves by a time step in seconds. */
    update(deltaSeconds: number): void { this.#uniforms[0] = this.#uniforms[0]! + requireFinite3D(deltaSeconds, 'deltaSeconds'); }
    /**
     * World height of the surface at a world point now, for floating objects.
     * It ignores the sideways pull of steep waves, so it is exact at steepness 0
     * and close otherwise.
     */
    heightAt(x: number, z: number): number {
        const u = this.#uniforms, heading = Math.atan2(u[5]!, u[4]!);
        let height = this.matrixWorld[13]!;
        for (let i = 0; i < 4; i++) {
            const angle = heading + WAVE_TURN[i]!, k = Math.PI * 2 / (u[2]! * WAVE_LENGTH[i]!);
            height += u[1]! * WAVE_HEIGHT[i]! * Math.sin(k * (Math.cos(angle) * x + Math.sin(angle) * z) - Math.sqrt(9.81 * k) * u[3]! * u[0]!);
        }
        return height;
    }
    /**
     * Draw the scene's mirror image for this frame; call it before rendering
     * the main view. Returns false, and draws nothing, when the camera is under
     * the surface or true reflections are disabled.
     */
    renderReflection(renderer: ReflectionRenderer3D, scene: Scene3D, camera: Camera3D): boolean {
        if (!this.reflection) return false;
        this.updateWorldMatrix();
        this.#plane[3] = -this.matrixWorld[13]!;
        return this.reflection.render(renderer, scene, camera, this.#plane, [this]);
    }
    /** Test the horizontal wave height at a point, including beyond the rendered mesh edges. */
    isUnderwater(point: ArrayLike<number>): boolean {
        this.updateWorldMatrix();
        return point[1]! < this.heightAt(point[0]!, point[2]!);
    }
    /**
     * Give the scene the look of being under water while the camera is below
     * the surface: thick fog in the water's color. The scene's own fog is put
     * back when the camera comes up. Call it each frame; it returns whether the
     * camera is under water, where there is no mirror image to draw.
     */
    updateUnderwater(scene: Scene3D, camera: Camera3D, density = 0.06): boolean {
        camera.updateWorldMatrix();
        const eye = camera.matrixWorld, under = this.isUnderwater([eye[12]!, eye[13]!, eye[14]!]);
        if (!under || this.#fogOverride?.scene !== scene) this.restoreUnderwaterFog();
        if (under && !this.#fogOverride && !underwaterFogOwners.has(scene)) {
            density = requireFinite3D(density, 'density');
            if (density < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'density');
            const tint = (this.material as Material3D).attenuationColor;
            const installed: NonNullable<Scene3D['fog']> = {kind: 'exponential', color: [tint[0]! * 1.6, tint[1]! * 1.6, tint[2]! * 1.6], density};
            const override = {scene, previous: scene.fog, installed};
            scene.fog = installed;
            underwaterFogOwners.set(scene, override);
            this.#fogOverride = override;
        }
        return under;
    }
    private restoreUnderwaterFog(): void {
        const override = this.#fogOverride;
        this.#fogOverride = undefined;
        if (!override || underwaterFogOwners.get(override.scene) !== override) return;
        underwaterFogOwners.delete(override.scene);
        // A later scene edit has already superseded our temporary value.
        if (override.scene.fog === override.installed) override.scene.fog = override.previous;
    }
    /** Release the geometry, the material and the mirror image. */
    dispose(): void {
        this.restoreUnderwaterFog();
        this.geometry.dispose();
        (this.material as Material3D).dispose();
        this.reflection?.dispose();
    }
}
export function createWater3D(options: WaterOptions3D = {}): Water3D { return new Water3D(options); }

/**
 * The material Water3D uses, for a water surface on your own geometry: a
 * standard material that refracts, with the wave hooks attached. Advance
 * `material.shader.uniforms[0]`, the time in seconds, every frame.
 */
export function createWaterMaterial3D(options: WaterOptions3D = {}): Material3D {
    const amplitude = requireFinite3D(options.amplitude ?? 0.15, 'amplitude'), wavelength = requirePositive3D(options.wavelength ?? 9, 'wavelength'), speed = requireFinite3D(options.speed ?? 1, 'speed');
    const direction = options.direction ?? [1, 0.35], dx = requireFinite3D(direction[0], 'direction'), dz = requireFinite3D(direction[1], 'direction'), length = Math.hypot(dx, dz);
    if (length < 1e-6) throw new World3DError('WORLD3D_INPUT_INVALID', 'direction');
    const steepness = requireFinite3D(options.steepness ?? 0.5, 'steepness'), ripple = requireFinite3D(options.rippleStrength ?? 0.12, 'rippleStrength'), rippleLength = requirePositive3D(options.rippleLength ?? 0.9, 'rippleLength');
    const clarity = requireFinite3D(options.clarity ?? 0.85, 'clarity');
    if (steepness < 0 || steepness > 1 || clarity < 0 || clarity > 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'steepness and clarity are 0 to 1');
    const material = createStandardMaterial3D({color: options.color ?? 0x2f7f9f, roughness: options.roughness ?? 0.06, metallic: 0});
    material.transmission = clarity;
    material.ior = 1.33;
    material.thickness = requireFinite3D(options.thickness ?? 0.5, 'thickness');
    const tint = colorFromHex(new Float32Array(3), options.color ?? 0x2f7f9f);
    if (options.deepColor === undefined) { material.attenuationColor[0] = tint[0]! * 0.25; material.attenuationColor[1] = tint[1]! * 0.35; material.attenuationColor[2] = tint[2]! * 0.45; }
    else colorFromHex(material.attenuationColor, options.deepColor);
    const depthFade = requirePositive3D(options.depthFade ?? 6, 'depthFade'), foamWidth = requireFinite3D(options.foamWidth ?? 0.5, 'foamWidth'), caustics = requireFinite3D(options.caustics ?? 0.35, 'caustics');
    material.attenuationDistance = depthFade;
    // Asking for the depth of the solid scene: shore, foam and caustics all depend on how deep the water is.
    material.softness = 1;
    // The underside is drawn too, for a camera below the surface.
    material.side = 'double';
    material.shader = createCustomShader3D({
        key: 'world3d-water', glslVertex: GLSL_VERTEX, wgslVertex: WGSL_VERTEX, glslNormal: GLSL_NORMAL, wgslNormal: WGSL_NORMAL, glsl: GLSL_FRAGMENT, wgsl: WGSL_FRAGMENT,
        uniforms: [0, amplitude, wavelength, speed, dx / length, dz / length, steepness, ripple, rippleLength, 0.03, 0, 0, foamWidth, foamWidth > 0 ? 1 : 0, caustics, depthFade * 0.5],
    });
    return material;
}
