// SPDX-License-Identifier: Apache-2.0
// Ropes and simple cloth: points joined by links of fixed length, moved by their
// own momentum and gravity and then pulled back to their link lengths. They are
// for dressing a scene - a flag, a cape, a hanging cable - not for carrying loads:
// points follow bodies they are pinned to and slide off simple colliders, but they
// do not push anything back. DOM-free and backend-independent.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import type {Material3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import type {RigidBody3D} from './Physics3D.js';

export const CLOTH3D_LIMITS = Object.freeze({maxPoints: 16384, maxColliders: 32} as const);

export interface StrandOptions3D {
    /** Pull on every point, as an acceleration. Defaults to 9.81 downward. */
    readonly gravity?: readonly [number, number, number];
    /** Share of a point's speed lost per second to the air. Defaults to 0.6. */
    readonly damping?: number;
    /** Passes over the links per update; more keeps them closer to their lengths. Defaults to 8. */
    readonly iterations?: number;
    /** Distance kept between a point and a collider's surface. */
    readonly thickness?: number;
    /** Spheres, capsules, boxes and planes the points stay out of. Other shapes are ignored. */
    readonly colliders?: readonly RigidBody3D[];
    /** Share of a point's sliding speed lost where it touches a collider. Defaults to 0.3. */
    readonly friction?: number;
}

interface Pin { index: number; body: RigidBody3D | undefined; x: number; y: number; z: number }

/** Points and links shared by ropes and cloth. */
class Strands3D {
    /** World positions, three numbers per point. Read them freely; write through setPoint(). */
    readonly points: Float32Array;
    readonly gravity = new Float32Array([0, -9.81, 0]);
    /** A steady push on every free point, as an acceleration: wind. */
    readonly wind = new Float32Array(3);
    damping: number;
    iterations: number;
    thickness: number;
    friction: number;
    readonly colliders: RigidBody3D[] = [];
    readonly #previous: Float32Array;
    readonly #free: Uint8Array;
    readonly #pins: Pin[] = [];
    #links = new Int32Array(0);
    #lengths = new Float32Array(0);
    #linkCount = 0;

    constructor(count: number, options: StrandOptions3D) {
        requireCount3D(count, 'points', CLOTH3D_LIMITS.maxPoints);
        this.points = new Float32Array(count * 3); this.#previous = new Float32Array(count * 3); this.#free = new Uint8Array(count).fill(1);
        if (options.gravity) this.gravity.set(options.gravity);
        this.damping = requireFinite3D(options.damping ?? 0.6, 'damping');
        this.iterations = Math.min(Math.max(Math.floor(options.iterations ?? 8), 1), 64);
        this.thickness = requireFinite3D(options.thickness ?? 0.02, 'thickness');
        this.friction = requireFinite3D(options.friction ?? 0.3, 'friction');
        if (this.damping < 0 || this.thickness < 0 || this.friction < 0 || this.friction > 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'strand options');
        if (options.colliders) {
            if (options.colliders.length > CLOTH3D_LIMITS.maxColliders) throw new World3DError('WORLD3D_BUDGET', 'colliders');
            this.colliders.push(...options.colliders);
        }
    }
    get pointCount(): number { return this.points.length / 3; }
    get linkCount(): number { return this.#linkCount; }
    /** @internal Place a point and forget its motion. */
    protected place(index: number, x: number, y: number, z: number): void {
        const o = index * 3;
        this.points[o] = this.#previous[o] = x; this.points[o + 1] = this.#previous[o + 1] = y; this.points[o + 2] = this.#previous[o + 2] = z;
    }
    /** @internal Join two points at the distance they are apart now. */
    protected link(a: number, b: number): void {
        if (this.#linkCount * 2 >= this.#links.length) {
            const links = new Int32Array(Math.max(64, this.#links.length * 2)), lengths = new Float32Array(links.length / 2);
            links.set(this.#links); lengths.set(this.#lengths);
            this.#links = links; this.#lengths = lengths;
        }
        const p = this.points;
        this.#links[this.#linkCount * 2] = a; this.#links[this.#linkCount * 2 + 1] = b;
        this.#lengths[this.#linkCount++] = Math.hypot(p[a * 3]! - p[b * 3]!, p[a * 3 + 1]! - p[b * 3 + 1]!, p[a * 3 + 2]! - p[b * 3 + 2]!);
    }
    private check(index: number): number {
        if (!Number.isInteger(index) || index < 0 || index >= this.pointCount) throw new World3DError('WORLD3D_INPUT_INVALID', 'point index');
        return index;
    }
    /** Move a point and stop it; a pinned point is held at the new place. */
    setPoint(index: number, x: number, y: number, z: number): void {
        this.place(this.check(index), requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z'));
        for (const pin of this.#pins) if (pin.index === index && !pin.body) { pin.x = x; pin.y = y; pin.z = z; }
    }
    /**
     * Hold a point where it is now. With a body, the point keeps its place on
     * that body and follows it as the body moves and turns.
     */
    pinPoint(index: number, body?: RigidBody3D): void {
        this.check(index);
        this.unpinPoint(index);
        const o = index * 3, p = this.points;
        let x = p[o]!, y = p[o + 1]!, z = p[o + 2]!;
        if (body) {
            const r = body.rotation, dx = x - body.position[0]!, dy = y - body.position[1]!, dz = z - body.position[2]!;
            x = r[0]! * dx + r[3]! * dy + r[6]! * dz; y = r[1]! * dx + r[4]! * dy + r[7]! * dz; z = r[2]! * dx + r[5]! * dy + r[8]! * dz;
        }
        this.#pins.push({index, body, x, y, z}); this.#free[index] = 0;
    }
    unpinPoint(index: number): void {
        this.check(index);
        const at = this.#pins.findIndex(pin => pin.index === index);
        if (at >= 0) this.#pins.splice(at, 1);
        this.#free[index] = 1;
    }
    isPinned(index: number): boolean { return this.#free[this.check(index)] === 0; }
    /** @internal Advance the points by one update. */
    protected advance(deltaSeconds: number): void {
        const dt = Math.min(Math.max(requireFinite3D(deltaSeconds, 'deltaSeconds'), 0), 1 / 20);
        if (dt === 0) return;
        const p = this.points, previous = this.#previous, free = this.#free, count = this.pointCount, keep = Math.max(1 - this.damping * dt, 0);
        const ax = (this.gravity[0]! + this.wind[0]!) * dt * dt, ay = (this.gravity[1]! + this.wind[1]!) * dt * dt, az = (this.gravity[2]! + this.wind[2]!) * dt * dt;
        for (let i = 0; i < count; i++) {
            if (!free[i]) continue;
            const o = i * 3, x = p[o]!, y = p[o + 1]!, z = p[o + 2]!;
            // Each point carries on as it was going, slowed a little, and falls.
            p[o] = x + (x - previous[o]!) * keep + ax; p[o + 1] = y + (y - previous[o + 1]!) * keep + ay; p[o + 2] = z + (z - previous[o + 2]!) * keep + az;
            previous[o] = x; previous[o + 1] = y; previous[o + 2] = z;
        }
        for (const pin of this.#pins) {
            const o = pin.index * 3, body = pin.body;
            if (body) {
                const r = body.rotation;
                p[o] = body.position[0]! + r[0]! * pin.x + r[1]! * pin.y + r[2]! * pin.z; p[o + 1] = body.position[1]! + r[3]! * pin.x + r[4]! * pin.y + r[5]! * pin.z; p[o + 2] = body.position[2]! + r[6]! * pin.x + r[7]! * pin.y + r[8]! * pin.z;
            } else { p[o] = pin.x; p[o + 1] = pin.y; p[o + 2] = pin.z; }
            previous[o] = p[o]!; previous[o + 1] = p[o + 1]!; previous[o + 2] = p[o + 2]!;
        }
        const links = this.#links, lengths = this.#lengths, linkCount = this.#linkCount;
        for (let iteration = 0; iteration < this.iterations; iteration++) {
            for (let i = 0; i < linkCount; i++) {
                const a = links[i * 2]!, b = links[i * 2 + 1]!, fa = free[a]!, fb = free[b]!;
                if (!fa && !fb) continue;
                const oa = a * 3, ob = b * 3, dx = p[ob]! - p[oa]!, dy = p[ob + 1]! - p[oa + 1]!, dz = p[ob + 2]! - p[oa + 2]!, length = Math.hypot(dx, dy, dz);
                if (length < 1e-9) continue;
                // Bring the pair back to its length; a held end leaves all of the move to the other.
                const error = (length - lengths[i]!) / length / (fa + fb);
                if (fa) { p[oa]! += dx * error; p[oa + 1]! += dy * error; p[oa + 2]! += dz * error; }
                if (fb) { p[ob]! -= dx * error; p[ob + 1]! -= dy * error; p[ob + 2]! -= dz * error; }
            }
            if (this.colliders.length > 0) for (let i = 0; i < count; i++) if (free[i]) this.collide(i);
        }
    }
    private collide(index: number): void {
        const p = this.points, previous = this.#previous, o = index * 3, gap = this.thickness;
        for (const body of this.colliders) {
            const shape = body.shape, c = body.position, r = body.rotation;
            let nx = 0, ny = 0, nz = 0, depth = 0;
            const x = p[o]! - c[0]!, y = p[o + 1]! - c[1]!, z = p[o + 2]! - c[2]!;
            if (shape.type === 'plane') {
                nx = r[1]!; ny = r[4]!; nz = r[7]!;
                depth = gap - (x * nx + y * ny + z * nz);
            } else if (shape.type === 'sphere' || shape.type === 'capsule') {
                // The nearest place on the capsule's core line, or the sphere's center.
                let along = 0;
                if (shape.type === 'capsule') along = Math.min(Math.max(x * r[1]! + y * r[4]! + z * r[7]!, -shape.halfHeight), shape.halfHeight);
                const dx = x - r[1]! * along, dy = y - r[4]! * along, dz = z - r[7]! * along, distance = Math.hypot(dx, dy, dz);
                depth = shape.radius + gap - distance;
                if (depth > 0) { if (distance > 1e-9) { nx = dx / distance; ny = dy / distance; nz = dz / distance; } else ny = 1; }
            } else if (shape.type === 'box') {
                const h = shape.halfExtents, lx = r[0]! * x + r[3]! * y + r[6]! * z, ly = r[1]! * x + r[4]! * y + r[7]! * z, lz = r[2]! * x + r[5]! * y + r[8]! * z;
                const ex = h[0] + gap - Math.abs(lx), ey = h[1] + gap - Math.abs(ly), ez = h[2] + gap - Math.abs(lz);
                if (ex > 0 && ey > 0 && ez > 0) {
                    // Leave through the nearest face.
                    let fx = 0, fy = 0, fz = 0;
                    if (ex <= ey && ex <= ez) { depth = ex; fx = Math.sign(lx) || 1; } else if (ey <= ez) { depth = ey; fy = Math.sign(ly) || 1; } else { depth = ez; fz = Math.sign(lz) || 1; }
                    nx = r[0]! * fx + r[1]! * fy + r[2]! * fz; ny = r[3]! * fx + r[4]! * fy + r[5]! * fz; nz = r[6]! * fx + r[7]! * fy + r[8]! * fz;
                }
            } else continue;
            if (!(depth > 0)) continue;
            p[o]! += nx * depth; p[o + 1]! += ny * depth; p[o + 2]! += nz * depth;
            // Rubbing against the surface takes away some of the slide.
            const grip = this.friction;
            previous[o] = previous[o]! + (p[o]! - previous[o]!) * grip; previous[o + 1] = previous[o + 1]! + (p[o + 1]! - previous[o + 1]!) * grip; previous[o + 2] = previous[o + 2]! + (p[o + 2]! - previous[o + 2]!) * grip;
        }
    }
}

export interface RopeOptions3D extends StrandOptions3D {
    readonly start: readonly [number, number, number];
    readonly end: readonly [number, number, number];
    /** Number of links. Defaults to 16. */
    readonly segments?: number;
    /** Extra length as a share of the straight distance, so the rope hangs in a curve. Defaults to 0. */
    readonly slack?: number;
    /** Hold the first or the last point in place, or on a body. Both ends are free unless pinned. */
    readonly pinStart?: boolean | RigidBody3D;
    readonly pinEnd?: boolean | RigidBody3D;
}
/** A rope or cable. Call update() once per frame, after the bodies it is pinned to have moved. */
export class Rope3D extends Strands3D {
    readonly segments: number;
    /** Total length along the links at rest. */
    readonly length: number;
    #mesh: Mesh3D | undefined;
    #radius = 0;
    #sides = 0;
    constructor(options: RopeOptions3D) {
        if (!options || !options.start || !options.end) throw new World3DError('WORLD3D_INPUT_INVALID', 'rope ends');
        const segments = Math.floor(options.segments ?? 16);
        if (!(segments >= 1)) throw new World3DError('WORLD3D_INPUT_INVALID', 'rope segments');
        super(segments + 1, options);
        this.segments = segments;
        const [ax, ay, az] = options.start, [bx, by, bz] = options.end, slack = requireFinite3D(options.slack ?? 0, 'slack');
        if (slack < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'slack');
        // Lay the points out at the link length, then bring them between the ends; a slack rope starts bunched and falls into its curve.
        const straight = Math.hypot(bx - ax, by - ay, bz - az), spread = 1 + slack;
        for (let i = 0; i <= segments; i++) { const t = i / segments * spread; this.place(i, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t); }
        for (let i = 0; i < segments; i++) this.link(i, i + 1);
        this.length = straight * spread;
        for (let i = 0; i <= segments; i++) { const t = i / segments; this.place(i, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t); }
        if (options.pinStart) this.pinPoint(0, options.pinStart === true ? undefined : options.pinStart);
        if (options.pinEnd) this.pinPoint(segments, options.pinEnd === true ? undefined : options.pinEnd);
    }
    /**
     * A tube along the rope, rebuilt by update(). `radius` is its thickness and
     * `sides` the number of faces around it.
     */
    createMesh(material: Material3D, radius = 0.03, sides = 6): Mesh3D {
        requirePositive3D(radius, 'radius');
        if (!Number.isInteger(sides) || sides < 3 || sides > 32) throw new World3DError('WORLD3D_INPUT_INVALID', 'sides');
        const rings = this.pointCount, geometry = new Geometry3D(), positions = new Attribute3D(new Float32Array(rings * sides * 3), 3), normals = new Attribute3D(new Float32Array(rings * sides * 3), 3);
        positions.dynamic = true; normals.dynamic = true;
        const uvs = new Float32Array(rings * sides * 2), indices: number[] = [];
        for (let ring = 0; ring < rings; ring++) for (let s = 0; s < sides; s++) { uvs[(ring * sides + s) * 2] = s / sides; uvs[(ring * sides + s) * 2 + 1] = ring / (rings - 1); }
        for (let ring = 0; ring < rings - 1; ring++) for (let s = 0; s < sides; s++) {
            const a = ring * sides + s, b = ring * sides + (s + 1) % sides, c = a + sides, d = b + sides;
            indices.push(a, c, b, b, c, d);
        }
        geometry.setAttribute('position', positions); geometry.setAttribute('normal', normals); geometry.setAttribute('uv', new Attribute3D(uvs, 2));
        geometry.setIndex(rings * sides > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices));
        this.#mesh = new Mesh3D(geometry, material); this.#radius = radius; this.#sides = sides;
        // The points are in world space, so the mesh must not be moved by a parent.
        this.#mesh.frustumCulled = true;
        this.rebuild();
        return this.#mesh;
    }
    get mesh(): Mesh3D | undefined { return this.#mesh; }
    update(deltaSeconds: number): void { this.advance(deltaSeconds); this.rebuild(); }
    private rebuild(): void {
        const mesh = this.#mesh;
        if (!mesh) return;
        const p = this.points, rings = this.pointCount, sides = this.#sides, radius = this.#radius;
        const position = mesh.geometry.getAttribute('position')!, normal = mesh.geometry.getAttribute('normal')!, out = position.data, n = normal.data;
        // A side direction carried from ring to ring, turned as little as the rope bends, keeps the tube from twisting.
        let ux = 0, uy = 0, uz = 0;
        for (let ring = 0; ring < rings; ring++) {
            const before = Math.max(ring - 1, 0) * 3, after = Math.min(ring + 1, rings - 1) * 3;
            let tx = p[after]! - p[before]!, ty = p[after + 1]! - p[before + 1]!, tz = p[after + 2]! - p[before + 2]!;
            const size = Math.hypot(tx, ty, tz) || 1;
            tx /= size; ty /= size; tz /= size;
            if (ring === 0) { if (Math.abs(ty) < 0.9) { ux = 0; uy = 1; uz = 0; } else { ux = 1; uy = 0; uz = 0; } }
            const along = ux * tx + uy * ty + uz * tz;
            ux -= tx * along; uy -= ty * along; uz -= tz * along;
            const length = Math.hypot(ux, uy, uz) || 1;
            ux /= length; uy /= length; uz /= length;
            const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux, o = ring * 3;
            for (let s = 0; s < sides; s++) {
                const angle = s / sides * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle), at = (ring * sides + s) * 3;
                const nx = ux * cos + vx * sin, ny = uy * cos + vy * sin, nz = uz * cos + vz * sin;
                n[at] = nx; n[at + 1] = ny; n[at + 2] = nz;
                out[at] = p[o]! + nx * radius; out[at + 1] = p[o + 1]! + ny * radius; out[at + 2] = p[o + 2]! + nz * radius;
            }
        }
        position.touch(); normal.touch(); mesh.geometry.invalidateBounds();
    }
}

export interface ClothOptions3D extends StrandOptions3D {
    /** Number of points across and down; at least two each. */
    readonly columns: number;
    readonly rows: number;
    /** World position of the first point of the first row. */
    readonly origin: readonly [number, number, number];
    /** Vectors along a full row and down a full column. */
    readonly right: readonly [number, number, number];
    readonly down: readonly [number, number, number];
    /** Add links that skip a point, which makes the cloth resist folding. Defaults to true. */
    readonly stiff?: boolean;
}
/** A rectangular sheet. Call update() once per frame, after the bodies it is pinned to have moved. */
export class Cloth3D extends Strands3D {
    readonly columns: number;
    readonly rows: number;
    #mesh: Mesh3D | undefined;
    constructor(options: ClothOptions3D) {
        const columns = Math.floor(options?.columns ?? 0), rows = Math.floor(options?.rows ?? 0);
        if (!(columns >= 2) || !(rows >= 2) || !options.origin || !options.right || !options.down) throw new World3DError('WORLD3D_INPUT_INVALID', 'cloth grid');
        super(columns * rows, options);
        this.columns = columns; this.rows = rows;
        const o = options.origin, r = options.right, d = options.down;
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            const u = column / (columns - 1), v = row / (rows - 1);
            this.place(row * columns + column, o[0] + r[0] * u + d[0] * v, o[1] + r[1] * u + d[1] * v, o[2] + r[2] * u + d[2] * v);
        }
        const stiff = options.stiff ?? true;
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            const i = row * columns + column;
            // Along the weave, across the diagonals, and - for stiffness - to the next point but one.
            if (column + 1 < columns) this.link(i, i + 1);
            if (row + 1 < rows) this.link(i, i + columns);
            if (column + 1 < columns && row + 1 < rows) { this.link(i, i + columns + 1); this.link(i + 1, i + columns); }
            if (stiff && column + 2 < columns) this.link(i, i + 2);
            if (stiff && row + 2 < rows) this.link(i, i + columns * 2);
        }
    }
    /** Index of the point at a column and row. */
    indexOf(column: number, row: number): number {
        if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= this.columns || row >= this.rows) throw new World3DError('WORLD3D_INPUT_INVALID', 'cloth point');
        return row * this.columns + column;
    }
    /** Hold the point at a column and row where it is, or on a body. */
    pin(column: number, row: number, body?: RigidBody3D): void { this.pinPoint(this.indexOf(column, row), body); }
    unpin(column: number, row: number): void { this.unpinPoint(this.indexOf(column, row)); }
    /** A mesh of the sheet, rebuilt by update(). Draw it with a double-sided material to see both faces. */
    createMesh(material: Material3D): Mesh3D {
        const columns = this.columns, rows = this.rows, count = columns * rows, geometry = new Geometry3D();
        const positions = new Attribute3D(new Float32Array(count * 3), 3), normals = new Attribute3D(new Float32Array(count * 3), 3), uvs = new Float32Array(count * 2), indices: number[] = [];
        positions.dynamic = true; normals.dynamic = true;
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { uvs[(row * columns + column) * 2] = column / (columns - 1); uvs[(row * columns + column) * 2 + 1] = row / (rows - 1); }
        for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
            const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
        geometry.setAttribute('position', positions); geometry.setAttribute('normal', normals); geometry.setAttribute('uv', new Attribute3D(uvs, 2));
        geometry.setIndex(count > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices));
        this.#mesh = new Mesh3D(geometry, material);
        this.rebuild();
        return this.#mesh;
    }
    get mesh(): Mesh3D | undefined { return this.#mesh; }
    update(deltaSeconds: number): void { this.advance(deltaSeconds); this.rebuild(); }
    private rebuild(): void {
        const mesh = this.#mesh;
        if (!mesh) return;
        const p = this.points, columns = this.columns, rows = this.rows;
        const position = mesh.geometry.getAttribute('position')!, normal = mesh.geometry.getAttribute('normal')!, n = normal.data;
        (position.data as Float32Array).set(p);
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            // The normal at a point is across its neighbours along the row and down the column.
            const left = (row * columns + Math.max(column - 1, 0)) * 3, right = (row * columns + Math.min(column + 1, columns - 1)) * 3;
            const up = (Math.max(row - 1, 0) * columns + column) * 3, below = (Math.min(row + 1, rows - 1) * columns + column) * 3;
            const ax = p[right]! - p[left]!, ay = p[right + 1]! - p[left + 1]!, az = p[right + 2]! - p[left + 2]!, bx = p[below]! - p[up]!, by = p[below + 1]! - p[up + 1]!, bz = p[below + 2]! - p[up + 2]!;
            let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
            const size = Math.hypot(nx, ny, nz) || 1, at = (row * columns + column) * 3;
            nx /= size; ny /= size; nz /= size;
            n[at] = nx; n[at + 1] = ny; n[at + 2] = nz;
        }
        position.touch(); normal.touch(); mesh.geometry.invalidateBounds();
    }
}

export function createRope3D(options: RopeOptions3D): Rope3D { return new Rope3D(options); }
export function createCloth3D(options: ClothOptions3D): Cloth3D { return new Cloth3D(options); }
