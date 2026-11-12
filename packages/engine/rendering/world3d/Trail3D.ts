// SPDX-License-Identifier: Apache-2.0
// A ribbon left behind by a moving point: sword swings, tracers, exhaust.
// Points are recorded in world space and age out; before each draw the ribbon
// is rebuilt to face the camera. DOM-free and backend-independent: it is an
// ordinary mesh with a dynamic geometry.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import type {Camera3D} from './Camera3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import {type Blending3D, type ColorInput3D, createUnlitMaterial3D, setColor3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import type {Object3D} from './Object3D.js';
import type {Texture3D} from './Texture3D.js';

export const TRAIL3D_LIMITS = Object.freeze({maxPoints: 4096} as const);

export interface TrailOptions3D {
    /** The object whose world position the trail follows. Without one, feed points with `push`. */
    readonly target?: Object3D;
    /** Seconds a point of the trail stays visible. Default 0.6. */
    readonly lifetime?: number;
    /** Most points kept; older ones drop off the end. Default 64. */
    readonly points?: number;
    /** A new point is recorded once the head has moved this far. Default 0.05. */
    readonly minDistance?: number;
    /** Width at the head and at the tail. Defaults: 0.3 and 0. */
    readonly width?: number;
    readonly endWidth?: number;
    readonly color?: ColorInput3D;
    readonly endColor?: ColorInput3D;
    /** Opacity at the head and at the tail. Defaults: 1 and 0. */
    readonly opacity?: number;
    readonly endOpacity?: number;
    /** Sampled with u running from head to tail and v across the ribbon. */
    readonly map?: Texture3D;
    readonly blending?: Blending3D;
}

/**
 * Add the trail to the scene itself, not under the object it follows: its
 * vertices are world positions. Call `update(deltaSeconds)` once per frame.
 */
export class Trail3D extends Mesh3D {
    target: Object3D | undefined;
    lifetime: number;
    minDistance: number;
    width: number;
    endWidth: number;
    opacity: number;
    endOpacity: number;
    readonly color = new Float32Array([1, 1, 1]);
    readonly endColor = new Float32Array([1, 1, 1]);
    readonly capacity: number;
    // Recorded points, newest first: x, y, z and age in seconds.
    readonly #points: Float32Array;
    #count = 0;
    readonly #positions: Attribute3D;
    readonly #colors: Attribute3D;
    readonly #uvs: Attribute3D;
    readonly #head = [0, 0, 0];
    #hasHead = false;

    constructor(options: TrailOptions3D = {}) {
        const capacity = requireCount3D(options.points ?? 64, 'points', TRAIL3D_LIMITS.maxPoints);
        if (capacity < 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'a trail needs at least 2 points');
        const geometry = new Geometry3D(), vertices = capacity * 2, indices = new Uint16Array((capacity - 1) * 6);
        for (let i = 0; i < capacity - 1; i++) indices.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
        const positions = new Attribute3D(new Float32Array(vertices * 3), 3), colors = new Attribute3D(new Float32Array(vertices * 4), 4), uvs = new Attribute3D(new Float32Array(vertices * 2), 2);
        positions.dynamic = colors.dynamic = uvs.dynamic = true;
        geometry.setAttribute('position', positions); geometry.setAttribute('color', colors); geometry.setAttribute('uv', uvs);
        geometry.setIndex(indices);
        const material = createUnlitMaterial3D({
            alphaMode: 'blend', blending: options.blending ?? 'additive', depthWrite: false, side: 'double', vertexColors: true, fog: false,
            ...(options.map === undefined ? {} : {map: options.map}),
        });
        super(geometry, material);
        this.name = 'trail';
        this.pickable = false;
        this.castShadow = false;
        this.frustumCulled = false;
        this.capacity = capacity;
        this.#points = new Float32Array(capacity * 4);
        this.#positions = positions; this.#colors = colors; this.#uvs = uvs;
        this.target = options.target;
        this.lifetime = requirePositive3D(options.lifetime ?? 0.6, 'lifetime');
        this.minDistance = requireFinite3D(options.minDistance ?? 0.05, 'minDistance');
        this.width = requireFinite3D(options.width ?? 0.3, 'width');
        this.endWidth = requireFinite3D(options.endWidth ?? 0, 'endWidth');
        this.opacity = requireFinite3D(options.opacity ?? 1, 'opacity');
        this.endOpacity = requireFinite3D(options.endOpacity ?? 0, 'endOpacity');
        if (options.color !== undefined) setColor3D(this.color, options.color);
        setColor3D(this.endColor, options.endColor ?? options.color ?? 0xffffff);
        this.beforeRender = (camera: Camera3D) => this.build(camera);
    }
    /** Points currently in the trail, the moving head included. */
    get pointCount(): number { return this.#count + (this.#hasHead ? 1 : 0); }
    /** Age every point, drop the expired ones, and follow the target. */
    update(deltaSeconds: number): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), points = this.#points;
        for (let i = 0; i < this.#count; i++) points[i * 4 + 3] = points[i * 4 + 3]! + dt;
        while (this.#count > 0 && points[(this.#count - 1) * 4 + 3]! >= this.lifetime) this.#count--;
        const target = this.target;
        if (target) {
            target.updateWorldMatrix();
            this.push(target.matrixWorld[12]!, target.matrixWorld[13]!, target.matrixWorld[14]!);
        }
    }
    /** Move the head of the trail to a world position; a point is recorded once it has moved far enough. */
    push(x: number, y: number, z: number): void {
        const points = this.#points, head = this.#head;
        head[0] = requireFinite3D(x, 'x'); head[1] = requireFinite3D(y, 'y'); head[2] = requireFinite3D(z, 'z');
        this.#hasHead = true;
        if (this.#count > 0 && Math.hypot(x - points[0]!, y - points[1]!, z - points[2]!) < this.minDistance) return;
        // The newest point goes first; the oldest falls off when the buffer is full.
        const kept = Math.min(this.#count, this.capacity - 2);
        points.copyWithin(4, 0, kept * 4);
        points[0] = x; points[1] = y; points[2] = z; points[3] = 0;
        this.#count = kept + 1;
    }
    /** Remove every point, as after teleporting the target. */
    clear(): void { this.#count = 0; this.#hasHead = false; }
    /** Release the geometry and the material. */
    dispose(): void { this.geometry.dispose(); if (!Array.isArray(this.material)) this.material.dispose(); }
    private build(camera: Camera3D): void {
        const positions = this.#positions.data as Float32Array, colors = this.#colors.data as Float32Array, uvs = this.#uvs.data as Float32Array;
        const points = this.#points, head = this.#head, live = this.#hasHead ? this.#count + 1 : 0, eye = camera.matrixWorld;
        // Point k of the ribbon: the head first, then the recorded points.
        const px = (k: number): number => k === 0 ? head[0]! : points[(k - 1) * 4]!, py = (k: number): number => k === 0 ? head[1]! : points[(k - 1) * 4 + 1]!, pz = (k: number): number => k === 0 ? head[2]! : points[(k - 1) * 4 + 2]!;
        let lastX = 0, lastY = 0, lastZ = 0;
        for (let i = 0; i < this.capacity; i++) {
            const k = Math.min(i, live - 1), o = i * 2;
            if (live < 2) { positions.fill(0, o * 3, o * 3 + 6); colors.fill(0, o * 4, o * 4 + 8); continue; }
            const age = k === 0 ? 0 : Math.min(points[(k - 1) * 4 + 3]! / this.lifetime, 1), x = px(k), y = py(k), z = pz(k);
            // Across the ribbon: perpendicular to its direction and to the line of sight.
            let a = Math.max(k - 1, 0), b = Math.min(k + 1, live - 1);
            let tx = px(a) - px(b), ty = py(a) - py(b), tz = pz(a) - pz(b);
            // The head sits on the newest recorded point right after it is recorded; look further along for a direction.
            while (tx * tx + ty * ty + tz * tz < 1e-12 && (b < live - 1 || a > 0)) {
                if (b < live - 1) b++; else a--;
                tx = px(a) - px(b); ty = py(a) - py(b); tz = pz(a) - pz(b);
            }
            const vx = eye[12]! - x, vy = eye[13]! - y, vz = eye[14]! - z;
            let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
            const length = Math.hypot(sx, sy, sz);
            if (length > 1e-9) { sx /= length; sy /= length; sz /= length; lastX = sx; lastY = sy; lastZ = sz; } else { sx = lastX; sy = lastY; sz = lastZ; }
            const half = (this.width + (this.endWidth - this.width) * age) / 2, alpha = i < live ? this.opacity + (this.endOpacity - this.opacity) * age : 0;
            positions[o * 3] = x + sx * half; positions[o * 3 + 1] = y + sy * half; positions[o * 3 + 2] = z + sz * half;
            positions[o * 3 + 3] = x - sx * half; positions[o * 3 + 4] = y - sy * half; positions[o * 3 + 5] = z - sz * half;
            for (let side = 0; side < 2; side++) {
                const c = (o + side) * 4;
                colors[c] = this.color[0]! + (this.endColor[0]! - this.color[0]!) * age; colors[c + 1] = this.color[1]! + (this.endColor[1]! - this.color[1]!) * age;
                colors[c + 2] = this.color[2]! + (this.endColor[2]! - this.color[2]!) * age; colors[c + 3] = alpha;
                uvs[(o + side) * 2] = age; uvs[(o + side) * 2 + 1] = side;
            }
        }
        this.#positions.touch(); this.#colors.touch(); this.#uvs.touch();
        this.geometry.invalidateBounds();
    }
}
export function createTrail3D(options: TrailOptions3D = {}): Trail3D { return new Trail3D(options); }
