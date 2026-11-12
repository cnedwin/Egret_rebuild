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
import {colorFromHex, quatFromRotationMatrix} from './math3D.js';

/** Anything that can draw a scene into a render target: both first-party renderers qualify. */
export interface ReflectionRenderer3D {
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean;
    /** When present, post-processing is switched off while the mirror image is drawn. */
    readonly postProcess?: {enabled: boolean};
}

/**
 * A mirror camera and the target it draws into. Each frame, before the main
 * view, call `render` with the plane of the mirror; assign `texture` to a
 * standard material's `reflectionMap`. Whatever lies behind the plane is cut
 * away, so the ground under a lake does not show up in its reflection.
 */
export class PlanarReflection3D {
    readonly target: RenderTarget3D;
    readonly camera = new Camera3D();
    /** Moves the cutting plane back by this distance so geometry touching the mirror leaves no gap. */
    clipBias = 0.05;
    readonly #projection = new Float32Array(16);
    readonly #basis = new Float32Array(16);

    constructor(options: {readonly width?: number; readonly height?: number} = {}) {
        const width = requireCount3D(options.width ?? 512, 'reflection width', TEXTURE3D_LIMITS.maxEdge), height = requireCount3D(options.height ?? 512, 'reflection height', TEXTURE3D_LIMITS.maxEdge);
        this.target = new RenderTarget3D(width, height, {name: 'planar-reflection'});
        this.camera.name = 'reflection-camera';
    }
    get texture(): RenderTarget3D['texture'] { return this.target.texture; }
    /**
     * Place the mirror camera for a viewing camera and a world plane given as
     * [nx, ny, nz, d] with unit normal, where n . p + d = 0 and the normal
     * points to the side the viewer is on. Returns false when the viewer is
     * behind the plane and there is nothing to reflect.
     */
    update(camera: Camera3D, plane: ArrayLike<number>): boolean {
        const nx = requireFinite3D(plane[0], 'plane'), ny = requireFinite3D(plane[1], 'plane'), nz = requireFinite3D(plane[2], 'plane'), d = requireFinite3D(plane[3], 'plane');
        if (Math.abs(Math.hypot(nx, ny, nz) - 1) > 1e-3) throw new World3DError('WORLD3D_INPUT_INVALID', 'plane normal must have unit length');
        camera.updateViewMatrices();
        const from = camera.matrixWorld, mirror = this.camera, basis = this.#basis;
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
        // The mirror uses the viewer's projection as it stands, whatever kind it is.
        const p = this.#projection;
        p.set(camera.projectionMatrix);
        mirror.customProjection = p;
        mirror.updateViewMatrices();
        if (camera.projectionKind === 'perspective' && p[11] === -1 && p[15] === 0) {
            // Slant the near plane onto the mirror (Lengyel's oblique frustum).
            const world = mirror.matrixWorld;
            const cx = world[0]! * nx + world[1]! * ny + world[2]! * nz, cy = world[4]! * nx + world[5]! * ny + world[6]! * nz, cz = world[8]! * nx + world[9]! * ny + world[10]! * nz;
            const cw = world[12]! * nx + world[13]! * ny + world[14]! * nz + d + this.clipBias;
            if (cw < 0) {
                const qx = (Math.sign(cx) + p[8]!) / p[0]!, qy = (Math.sign(cy) + p[9]!) / p[5]!, qw = (1 + p[10]!) / p[14]!;
                const scale = 2 / (cx * qx + cy * qy - cz + cw * qw);
                p[2] = cx * scale; p[6] = cy * scale; p[10] = cz * scale + 1; p[14] = cw * scale;
                mirror.updateViewMatrices();
            }
        }
        return true;
    }
    /**
     * Update the mirror camera and draw the scene into the target. Objects in
     * `hidden`, normally the mirror itself, are left out of the image.
     */
    render(renderer: ReflectionRenderer3D, scene: Scene3D, camera: Camera3D, plane: ArrayLike<number>, hidden: readonly Object3D[] = []): boolean {
        if (!this.update(camera, plane)) return false;
        const shown = hidden.map((object) => object.visible);
        for (const object of hidden) object.visible = false;
        // The mirror image is plain; the main view's post-processing reaches it with everything else.
        const post = renderer.postProcess, processed = post?.enabled ?? false;
        if (post) post.enabled = false;
        try { return renderer.render(scene, this.camera, this.target); }
        finally {
            if (post) post.enabled = processed;
            hidden.forEach((object, i) => { object.visible = shown[i]!; });
        }
    }
    dispose(): void { this.target.dispose(); }
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
}

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
    /** Release the geometry, the material and the mirror image. */
    dispose(): void {
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
    material.attenuationColor.set(tint);
    material.shader = createCustomShader3D({
        key: 'world3d-water', glslVertex: GLSL_VERTEX, wgslVertex: WGSL_VERTEX, glslNormal: GLSL_NORMAL, wgslNormal: WGSL_NORMAL,
        uniforms: [0, amplitude, wavelength, speed, dx / length, dz / length, steepness, ripple, rippleLength, 0.03, 0, 0],
    });
    return material;
}
