// SPDX-License-Identifier: Apache-2.0
// Navigation for characters that walk: a navigation mesh built from the
// walkable triangles of level geometry, shortest paths across it, straight
// line-of-sight checks, movement that slides along its edges, a small crowd
// that steers agents along paths while keeping them apart, and A* on a grid
// for tile maps. Everything is plain data and arithmetic: no physics world
// and no DOM is needed.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import {Geometry3D, createGeometry3D} from './Geometry3D.js';
import type {Object3D} from './Object3D.js';
import {createMeshShape3D} from './PhysicsMesh3D.js';

export const NAVIGATION3D_LIMITS = Object.freeze({maxTriangles: 1048576, maxAgents: 4096, maxGridCells: 16777216} as const);
export type NavPoint3D = [number, number, number];
export interface NavMeshOptions3D {
    /** Steepest walkable slope in radians. Defaults to 45 degrees. */
    readonly slopeLimit?: number;
    /** Corners closer than this are treated as one, which joins triangles that only touch. Defaults to 0.001. */
    readonly weldTolerance?: number;
}
export interface NavLocation3D {
    /** Index of the triangle the point lies on. */
    readonly triangle: number;
    readonly point: NavPoint3D;
}
export interface NavPathOptions3D {
    /** Keeps the path this far from the mesh edges at corners, and rules out gaps narrower than twice this. */
    readonly agentRadius?: number;
    /** Add a point wherever the path crosses from one triangle to the next, so it follows slopes. Defaults to false. */
    readonly followSurface?: boolean;
    /** How far the start and end may lie from the mesh. Defaults to 2. */
    readonly snapDistance?: number;
}
export interface NavPath3D {
    readonly points: NavPoint3D[];
    /** False when the end could not be reached and the path stops at the closest reachable place. */
    readonly complete: boolean;
    /** Length of the path. */
    readonly length: number;
}

/** Twice the signed area of a triangle seen from above; the sign tells which side of a-b the point c lies on. */
const side = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number => (cx - ax) * (bz - az) - (bx - ax) * (cz - az);

/** Binary heap of numbers ordered by a score array. */
class Heap {
    readonly #items: number[] = [];
    constructor(private readonly score: Float64Array | Float32Array) {}
    get size(): number { return this.#items.length; }
    push(item: number): void {
        const items = this.#items, score = this.score;
        let i = items.length;
        items.push(item);
        while (i > 0) { const parent = (i - 1) >> 1; if (score[items[parent]!]! <= score[item]!) break; items[i] = items[parent]!; i = parent; }
        items[i] = item;
    }
    pop(): number {
        const items = this.#items, score = this.score, top = items[0]!, last = items.pop()!;
        if (items.length > 0) {
            let i = 0;
            for (;;) {
                let child = i * 2 + 1;
                if (child >= items.length) break;
                if (child + 1 < items.length && score[items[child + 1]!]! < score[items[child]!]!) child++;
                if (score[items[child]!]! >= score[last]!) break;
                items[i] = items[child]!; i = child;
            }
            items[i] = last;
        }
        return top;
    }
}

export class NavMesh3D {
    /** Welded corner positions, three floats each. */
    readonly vertices: Float32Array;
    /** Corner indices, three per triangle, counter-clockwise seen from above. */
    readonly triangles: Uint32Array;
    /** For each triangle edge (corner i to corner i + 1), the triangle on the other side or -1. */
    readonly neighbors: Int32Array;
    readonly triangleCount: number;
    /** Connected region of each triangle; two points can reach each other only within one region. */
    readonly regions: Int32Array;
    readonly #cost: Float32Array;
    readonly #enabled: Uint8Array;
    readonly #cellSize: number;
    readonly #minX: number; readonly #minZ: number; readonly #columns: number; readonly #rows: number;
    readonly #cellStart: Uint32Array; readonly #cellItems: Uint32Array;

    /** @param positions Triangle corners in world space; @param indices three per triangle, or none for a plain list. */
    constructor(positions: ArrayLike<number>, indices: ArrayLike<number> | undefined, options: NavMeshOptions3D = {}) {
        const walkable = Math.cos(options.slopeLimit ?? Math.PI / 4), tolerance = requirePositive3D(options.weldTolerance ?? 0.001, 'weldTolerance');
        const count = (indices ? indices.length : positions.length / 3) / 3;
        if (!Number.isInteger(count) || count > NAVIGATION3D_LIMITS.maxTriangles) throw new World3DError(count > NAVIGATION3D_LIMITS.maxTriangles ? 'WORLD3D_BUDGET' : 'WORLD3D_INPUT_INVALID', 'navigation triangles');
        const welded = new Map<string, number>(), vertices: number[] = [], triangles: number[] = [];
        const corner = (i: number): number => {
            const at = (indices ? indices[i]! : i) * 3, x = requireFinite3D(positions[at], 'navigation position'), y = requireFinite3D(positions[at + 1], 'navigation position'), z = requireFinite3D(positions[at + 2], 'navigation position');
            const key = Math.round(x / tolerance) + ',' + Math.round(y / tolerance) + ',' + Math.round(z / tolerance);
            let index = welded.get(key);
            if (index === undefined) { index = vertices.length / 3; welded.set(key, index); vertices.push(x, y, z); }
            return index;
        };
        for (let t = 0; t < count; t++) {
            const a = corner(t * 3), b = corner(t * 3 + 1), c = corner(t * 3 + 2);
            if (a === b || b === c || a === c) continue;
            const ux = vertices[b * 3]! - vertices[a * 3]!, uy = vertices[b * 3 + 1]! - vertices[a * 3 + 1]!, uz = vertices[b * 3 + 2]! - vertices[a * 3 + 2]!;
            const vx = vertices[c * 3]! - vertices[a * 3]!, vy = vertices[c * 3 + 1]! - vertices[a * 3 + 1]!, vz = vertices[c * 3 + 2]! - vertices[a * 3 + 2]!;
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz);
            // Keep faces that point up and are flat enough to walk on.
            if (length < 1e-12 || ny / length < walkable) continue;
            triangles.push(a, b, c);
        }
        if (triangles.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'the geometry has no walkable triangles');
        this.vertices = Float32Array.from(vertices); this.triangles = Uint32Array.from(triangles);
        const total = this.triangleCount = triangles.length / 3;
        // Two triangles are neighbors when they share an edge walked in opposite directions.
        this.neighbors = new Int32Array(total * 3).fill(-1);
        const edges = new Map<number, number>(), vertexCount = vertices.length / 3;
        for (let t = 0; t < total; t++) for (let e = 0; e < 3; e++) edges.set(triangles[t * 3 + e]! * vertexCount + triangles[t * 3 + (e + 1) % 3]!, t * 3 + e);
        for (const [key, slot] of edges) {
            const from = Math.floor(key / vertexCount), to = key % vertexCount, other = edges.get(to * vertexCount + from);
            if (other !== undefined) this.neighbors[slot] = Math.floor(other / 3);
        }
        this.#cost = new Float32Array(total).fill(1); this.#enabled = new Uint8Array(total).fill(1);
        this.regions = new Int32Array(total).fill(-1);
        for (let t = 0, region = 0; t < total; t++) {
            if (this.regions[t] !== -1) continue;
            const stack = [t];
            this.regions[t] = region;
            while (stack.length > 0) { const current = stack.pop()!; for (let e = 0; e < 3; e++) { const next = this.neighbors[current * 3 + e]!; if (next >= 0 && this.regions[next] === -1) { this.regions[next] = region; stack.push(next); } } }
            region++;
        }
        // A grid over the ground plan finds the triangles near a point quickly.
        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < vertices.length; i += 3) { minX = Math.min(minX, vertices[i]!); maxX = Math.max(maxX, vertices[i]!); minZ = Math.min(minZ, vertices[i + 2]!); maxZ = Math.max(maxZ, vertices[i + 2]!); }
        const cell = this.#cellSize = Math.max(Math.sqrt((maxX - minX + 1e-6) * (maxZ - minZ + 1e-6) / total) * 1.5, 1e-3);
        this.#minX = minX; this.#minZ = minZ;
        const columns = this.#columns = Math.min(Math.max(Math.ceil((maxX - minX) / cell), 1), 2048), rows = this.#rows = Math.min(Math.max(Math.ceil((maxZ - minZ) / cell), 1), 2048);
        const counts = new Uint32Array(columns * rows + 1), spans: number[] = [];
        for (let t = 0; t < total; t++) {
            let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
            for (let e = 0; e < 3; e++) { const v = triangles[t * 3 + e]! * 3; x0 = Math.min(x0, vertices[v]!); x1 = Math.max(x1, vertices[v]!); z0 = Math.min(z0, vertices[v + 2]!); z1 = Math.max(z1, vertices[v + 2]!); }
            const c0 = this.column(x0), c1 = this.column(x1), r0 = this.row(z0), r1 = this.row(z1);
            spans.push(c0, c1, r0, r1);
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) counts[r * columns + c + 1]!++;
        }
        for (let i = 1; i < counts.length; i++) counts[i]! += counts[i - 1]!;
        this.#cellStart = counts.slice(); this.#cellItems = new Uint32Array(counts[counts.length - 1]!);
        const fill = counts.slice(0, counts.length - 1);
        for (let t = 0; t < total; t++) for (let r = spans[t * 4 + 2]!; r <= spans[t * 4 + 3]!; r++) for (let c = spans[t * 4]!; c <= spans[t * 4 + 1]!; c++) this.#cellItems[fill[r * columns + c]!++] = t;
    }
    private column(x: number): number { return Math.min(Math.max(Math.floor((x - this.#minX) / this.#cellSize), 0), this.#columns - 1); }
    private row(z: number): number { return Math.min(Math.max(Math.floor((z - this.#minZ) / this.#cellSize), 0), this.#rows - 1); }
    /** Travel cost multiplier of a triangle (mud, shallow water); 1 by default. */
    setCost(triangle: number, cost: number): void { this.#cost[this.checked(triangle)] = requirePositive3D(cost, 'cost'); }
    /** Close or reopen a triangle, as for a door or a collapsed bridge. Paths and movement avoid closed triangles. */
    setEnabled(triangle: number, enabled: boolean): void { this.#enabled[this.checked(triangle)] = enabled ? 1 : 0; }
    isEnabled(triangle: number): boolean { return this.#enabled[this.checked(triangle)] === 1; }
    private checked(triangle: number): number {
        if (!Number.isInteger(triangle) || triangle < 0 || triangle >= this.triangleCount) throw new World3DError('WORLD3D_INPUT_INVALID', 'navigation triangle');
        return triangle;
    }
    /** Middle of a triangle. */
    center(triangle: number, out: NavPoint3D = [0, 0, 0]): NavPoint3D {
        const v = this.vertices, t = this.triangles, a = t[triangle * 3]! * 3, b = t[triangle * 3 + 1]! * 3, c = t[triangle * 3 + 2]! * 3;
        out[0] = (v[a]! + v[b]! + v[c]!) / 3; out[1] = (v[a + 1]! + v[b + 1]! + v[c + 1]!) / 3; out[2] = (v[a + 2]! + v[b + 2]! + v[c + 2]!) / 3;
        return out;
    }
    /** Closest point of one triangle to a point, written to `out`; returns the squared distance. */
    private closestOn(triangle: number, px: number, py: number, pz: number, out: NavPoint3D): number {
        const v = this.vertices, t = this.triangles, a = t[triangle * 3]! * 3, b = t[triangle * 3 + 1]! * 3, c = t[triangle * 3 + 2]! * 3;
        const ax = v[a]!, ay = v[a + 1]!, az = v[a + 2]!, abx = v[b]! - ax, aby = v[b + 1]! - ay, abz = v[b + 2]! - az, acx = v[c]! - ax, acy = v[c + 1]! - ay, acz = v[c + 2]! - az;
        const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
        let u = 0, w = 0;   // point = a + ab * u + ac * w
        if (!(d1 <= 0 && d2 <= 0)) {
            const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
            if (d3 >= 0 && d4 <= d3) u = 1;
            else {
                const vc = d1 * d4 - d3 * d2;
                if (vc <= 0 && d1 >= 0 && d3 <= 0) u = d1 / (d1 - d3);
                else {
                    const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
                    if (d6 >= 0 && d5 <= d6) w = 1;
                    else {
                        const vb = d5 * d2 - d1 * d6;
                        if (vb <= 0 && d2 >= 0 && d6 <= 0) w = d2 / (d2 - d6);
                        else {
                            const va = d3 * d6 - d5 * d4;
                            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { w = (d4 - d3) / (d4 - d3 + d5 - d6); u = 1 - w; }
                            else { const scale = 1 / (va + vb + vc); u = vb * scale; w = vc * scale; }
                        }
                    }
                }
            }
        }
        out[0] = ax + abx * u + acx * w; out[1] = ay + aby * u + acy * w; out[2] = az + abz * u + acz * w;
        return (out[0] - px) ** 2 + (out[1] - py) ** 2 + (out[2] - pz) ** 2;
    }
    /** Nearest place on the open part of the mesh within `maxDistance`, or undefined. */
    findNearest(point: ArrayLike<number>, maxDistance = 2): NavLocation3D | undefined {
        const px = point[0]!, py = point[1]!, pz = point[2]!, columns = this.#columns, candidate: NavPoint3D = [0, 0, 0], bestPoint: NavPoint3D = [0, 0, 0];
        let best = -1, bestDistance = maxDistance * maxDistance;
        const c0 = this.column(px - maxDistance), c1 = this.column(px + maxDistance), r0 = this.row(pz - maxDistance), r1 = this.row(pz + maxDistance);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            for (let i = this.#cellStart[r * columns + c]!; i < this.#cellStart[r * columns + c + 1]!; i++) {
                const triangle = this.#cellItems[i]!;
                if (!this.#enabled[triangle]) continue;
                const distance = this.closestOn(triangle, px, py, pz, candidate);
                if (distance <= bestDistance && (distance < bestDistance || best < 0)) { bestDistance = distance; best = triangle; bestPoint[0] = candidate[0]; bestPoint[1] = candidate[1]; bestPoint[2] = candidate[2]; }
            }
        }
        return best < 0 ? undefined : {triangle: best, point: bestPoint};
    }
    /** Height of a triangle's plane at a ground position. */
    private heightAt(triangle: number, x: number, z: number): number {
        const v = this.vertices, t = this.triangles, a = t[triangle * 3]! * 3, b = t[triangle * 3 + 1]! * 3, c = t[triangle * 3 + 2]! * 3;
        const ux = v[b]! - v[a]!, uy = v[b + 1]! - v[a + 1]!, uz = v[b + 2]! - v[a + 2]!, vx = v[c]! - v[a]!, vy = v[c + 1]! - v[a + 1]!, vz = v[c + 2]! - v[a + 2]!;
        const ny = uz * vx - ux * vz;
        return Math.abs(ny) < 1e-12 ? v[a + 1]! : v[a + 1]! - ((uy * vz - uz * vy) * (x - v[a]!) + (ux * vy - uy * vx) * (z - v[a + 2]!)) / ny;
    }
    /** True when the two places can reach each other across open triangles. */
    isReachable(a: NavLocation3D, b: NavLocation3D): boolean { return this.search(a.triangle, b.triangle, b.point, 0) !== undefined && this.#reached; }
    #reached = false;
    /** A* over triangles. Returns the chain of triangles from start to the end, or to the open triangle nearest the end. */
    private search(start: number, end: number, target: NavPoint3D, radius: number): number[] | undefined {
        const total = this.triangleCount, g = new Float64Array(total).fill(Infinity), f = new Float64Array(total).fill(Infinity), from = new Int32Array(total).fill(-1), closed = new Uint8Array(total);
        // Each triangle is entered at a point: the start itself, or the middle of the edge crossed.
        const entry = new Float32Array(total * 3), v = this.vertices, tri = this.triangles, heap = new Heap(f), center: NavPoint3D = [0, 0, 0];
        this.center(start, center);
        entry[start * 3] = center[0]; entry[start * 3 + 1] = center[1]; entry[start * 3 + 2] = center[2];
        g[start] = 0; f[start] = Math.hypot(center[0] - target[0], center[1] - target[1], center[2] - target[2]);
        heap.push(start);
        let nearest = start, nearestDistance = f[start]!;
        this.#reached = false;
        while (heap.size > 0) {
            const current = heap.pop();
            if (closed[current]) continue;
            closed[current] = 1;
            if (current === end) { this.#reached = true; nearest = end; break; }
            const here = f[current]! - g[current]!;
            if (here < nearestDistance) { nearestDistance = here; nearest = current; }
            for (let e = 0; e < 3; e++) {
                const next = this.neighbors[current * 3 + e]!;
                if (next < 0 || closed[next] || !this.#enabled[next]) continue;
                const a = tri[current * 3 + e]! * 3, b = tri[current * 3 + (e + 1) % 3]! * 3;
                // A gap narrower than the agent cannot be passed.
                if (radius > 0 && Math.hypot(v[b]! - v[a]!, v[b + 1]! - v[a + 1]!, v[b + 2]! - v[a + 2]!) < radius * 2) continue;
                const mx = (v[a]! + v[b]!) / 2, my = (v[a + 1]! + v[b + 1]!) / 2, mz = (v[a + 2]! + v[b + 2]!) / 2;
                const step = Math.hypot(mx - entry[current * 3]!, my - entry[current * 3 + 1]!, mz - entry[current * 3 + 2]!) * this.#cost[current]!, cost = g[current]! + step;
                if (cost >= g[next]!) continue;
                g[next] = cost; from[next] = current;
                entry[next * 3] = mx; entry[next * 3 + 1] = my; entry[next * 3 + 2] = mz;
                f[next] = cost + Math.hypot(mx - target[0], my - target[1], mz - target[2]);
                heap.push(next);
            }
        }
        const chain: number[] = [];
        for (let t = nearest; t >= 0; t = from[t]!) chain.push(t);
        return chain.reverse();
    }
    /**
     * Shortest walkable path between two points. The points are snapped onto
     * the mesh first; undefined is returned when either lies too far from it.
     */
    findPath(start: ArrayLike<number>, end: ArrayLike<number>, options: NavPathOptions3D = {}): NavPath3D | undefined {
        const snap = options.snapDistance ?? 2, radius = Math.max(options.agentRadius ?? 0, 0), from = this.findNearest(start, snap), to = this.findNearest(end, snap);
        if (!from || !to) return undefined;
        const chain = this.search(from.triangle, to.triangle, to.point, radius)!, complete = this.#reached;
        // When the end cannot be reached, head for the closest point of the last reachable triangle.
        const goal: NavPoint3D = [to.point[0], to.point[1], to.point[2]];
        if (!complete) this.closestOn(chain[chain.length - 1]!, to.point[0], to.point[1], to.point[2], goal);
        // Portals: the shared edges crossed in order, with their left and right ends as seen while walking.
        const v = this.vertices, tri = this.triangles, portals: number[] = [from.point[0], from.point[1], from.point[2], from.point[0], from.point[1], from.point[2]], middle: NavPoint3D = [0, 0, 0];
        for (let i = 0; i + 1 < chain.length; i++) {
            const current = chain[i]!, next = chain[i + 1]!;
            let e = 0;
            while (e < 3 && this.neighbors[current * 3 + e] !== next) e++;
            let a = tri[current * 3 + e]! * 3, b = tri[current * 3 + (e + 1) % 3]! * 3;
            this.center(current, middle);
            // Order the two ends so that "left" really is on the walker's left.
            if (side(middle[0], middle[2], v[b]!, v[b + 2]!, v[a]!, v[a + 2]!) >= 0) { const swap = a; a = b; b = swap; }
            let lx = v[a]!, ly = v[a + 1]!, lz = v[a + 2]!, rx = v[b]!, ry = v[b + 1]!, rz = v[b + 2]!;
            if (radius > 0) {
                // Pull both ends inward so corners are passed at arm's length.
                const length = Math.hypot(rx - lx, ry - ly, rz - lz), inset = Math.min(radius / length, 0.5), dx = (rx - lx) * inset, dy = (ry - ly) * inset, dz = (rz - lz) * inset;
                lx += dx; ly += dy; lz += dz; rx -= dx; ry -= dy; rz -= dz;
            }
            portals.push(lx, ly, lz, rx, ry, rz);
        }
        portals.push(goal[0], goal[1], goal[2], goal[0], goal[1], goal[2]);
        // String pulling: keep a funnel from the last corner and tighten it portal by portal.
        const count = portals.length / 6, corners: number[] = [0], cornerPoints: NavPoint3D[] = [[from.point[0], from.point[1], from.point[2]]];
        let apex: NavPoint3D = [portals[0]!, portals[1]!, portals[2]!], left: NavPoint3D = [...apex], right: NavPoint3D = [...apex], apexIndex = 0, leftIndex = 0, rightIndex = 0;
        const same = (p: NavPoint3D, q: NavPoint3D): boolean => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[2] - q[2]) < 1e-9;
        for (let i = 1; i < count; i++) {
            const nl: NavPoint3D = [portals[i * 6]!, portals[i * 6 + 1]!, portals[i * 6 + 2]!], nr: NavPoint3D = [portals[i * 6 + 3]!, portals[i * 6 + 4]!, portals[i * 6 + 5]!];
            if (side(apex[0], apex[2], right[0], right[2], nr[0], nr[2]) <= 0) {
                if (same(apex, right) || side(apex[0], apex[2], left[0], left[2], nr[0], nr[2]) > 0) { right = nr; rightIndex = i; }
                else {
                    // The right side crossed over the left: the left end is a corner of the path.
                    cornerPoints.push(left); corners.push(leftIndex);
                    apex = left; apexIndex = leftIndex; left = [...apex]; right = [...apex]; rightIndex = apexIndex; i = apexIndex;
                    continue;
                }
            }
            if (side(apex[0], apex[2], left[0], left[2], nl[0], nl[2]) >= 0) {
                if (same(apex, left) || side(apex[0], apex[2], right[0], right[2], nl[0], nl[2]) < 0) { left = nl; leftIndex = i; }
                else {
                    cornerPoints.push(right); corners.push(rightIndex);
                    apex = right; apexIndex = rightIndex; left = [...apex]; right = [...apex]; leftIndex = apexIndex; i = apexIndex;
                    continue;
                }
            }
        }
        cornerPoints.push(goal); corners.push(count - 1);
        // The corridor of triangles found above is not always the straightest one, so the pulled string can
        // still bend where it need not. Skip every corner that can be passed in a straight walk.
        let points: NavPoint3D[] = [cornerPoints[0]!];
        for (let i = 0; i + 1 < cornerPoints.length;) {
            const here = this.findNearest(cornerPoints[i]!, 0.5);
            let next = i + 1;
            if (here) for (let j = cornerPoints.length - 1; j > i + 1; j--) if (this.clearWalk(here, cornerPoints[j]!, radius)) { next = j; break; }
            points.push(cornerPoints[next]!);
            i = next;
        }
        if (options.followSurface) {
            // Add a point wherever a straight piece crosses from one triangle to the next, so the path hugs slopes.
            const detailed: NavPoint3D[] = [points[0]!];
            for (let k = 0; k + 1 < points.length; k++) {
                const here = this.findNearest(points[k]!, 0.5);
                if (here) this.raycast(here, points[k + 1]![0], points[k + 1]![2], detailed);
                detailed.push(points[k + 1]!);
            }
            points = detailed;
        }
        // Drop repeated points.
        const result: NavPoint3D[] = [];
        let length = 0;
        for (const p of points) {
            const last = result[result.length - 1];
            if (last && Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) < 1e-6) continue;
            if (last) length += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
            result.push([p[0], p[1], p[2]]);
        }
        return {points: result, complete, length};
    }
    /**
     * Walk from a place toward a ground position, staying on open triangles
     * and sliding along the mesh edge when the way is blocked. `blocked`
     * tells whether an edge stopped the move.
     */
    moveAlong(from: NavLocation3D, x: number, z: number): NavLocation3D & {readonly blocked: boolean} {
        const v = this.vertices, tri = this.triangles;
        let triangle = this.checked(from.triangle), px = from.point[0], pz = from.point[2], tx = x, tz = z, blocked = false, slides = 0;
        for (let guard = 0; guard < 256; guard++) {
            // Find the edge the remaining move leaves through, if any.
            let exit = -1, exitAt = Infinity;
            for (let e = 0; e < 3; e++) {
                const a = tri[triangle * 3 + e]! * 3, b = tri[triangle * 3 + (e + 1) % 3]! * 3, ax = v[a]!, az = v[a + 2]!, bx = v[b]!, bz = v[b + 2]!;
                const target = side(ax, az, bx, bz, tx, tz);
                if (target >= -1e-12) continue;   // the target is on the inner side of this edge
                const here = side(ax, az, bx, bz, px, pz), along = here <= 0 ? 0 : here / (here - target);
                if (along < exitAt) { exitAt = along; exit = e; }
            }
            if (exit < 0) { px = tx; pz = tz; break; }
            const next = this.neighbors[triangle * 3 + exit]!;
            if (next >= 0 && this.#enabled[next]) {
                px += (tx - px) * exitAt; pz += (tz - pz) * exitAt;
                triangle = next;
                continue;
            }
            // Blocked: keep only the part of the move that runs along the edge, and carry on from where it was met.
            px += (tx - px) * exitAt; pz += (tz - pz) * exitAt;
            if (++slides > 4) break;
            blocked = true;
            const a = tri[triangle * 3 + exit]! * 3, b = tri[triangle * 3 + (exit + 1) % 3]! * 3, ex = v[b]! - v[a]!, ez = v[b + 2]! - v[a + 2]!, size = Math.hypot(ex, ez) || 1;
            const along = ((tx - v[a]!) * ex + (tz - v[a + 2]!) * ez) / (size * size);
            // Aim a hair inside the edge (its inner side is to the left of a-to-b seen from above) so the walk does not leave through it again.
            tx = v[a]! + ex * along + ez / size * 1e-4; tz = v[a + 2]! + ez * along - ex / size * 1e-4;
        }
        return {triangle, point: [px, this.heightAt(triangle, px, pz), pz], blocked};
    }
    /** True when an agent of the given radius can walk straight from a place to a point. */
    private clearWalk(from: NavLocation3D, to: NavPoint3D, radius: number): boolean {
        // A shortcut must not cut across ground the search priced differently, or it would undo a detour.
        if (this.trace(from, to[0], to[2], undefined, true) < 1) return false;
        if (!(radius > 0)) return true;
        // The agent's two shoulders must get through as well.
        const dx = to[0] - from.point[0], dz = to[2] - from.point[2], length = Math.hypot(dx, dz);
        if (length < 1e-9) return true;
        const sx = -dz / length * radius, sz = dx / length * radius;
        for (const sign of [1, -1]) {
            const shoulder = this.moveAlong(from, from.point[0] + sx * sign, from.point[2] + sz * sign);
            if (shoulder.blocked || this.trace(shoulder, to[0] + sx * sign, to[2] + sz * sign, undefined, true) < 1) return false;
        }
        return true;
    }
    /**
     * Line of sight along the ground: how far a straight walk from a place
     * toward a ground position gets, as a share from 0 to 1. A value of 1
     * means nothing is in the way. When `crossings` is given, the points
     * where the walk passes from one triangle to the next are appended to it.
     */
    raycast(from: NavLocation3D, x: number, z: number, crossings?: NavPoint3D[]): number { return this.trace(from, x, z, crossings, false); }
    private trace(from: NavLocation3D, x: number, z: number, crossings: NavPoint3D[] | undefined, plainGroundOnly: boolean): number {
        const v = this.vertices, tri = this.triangles, px = from.point[0], pz = from.point[2];
        let triangle = this.checked(from.triangle), previous = -1;
        for (let guard = 0; guard < 4096; guard++) {
            let exit = -1, exitAt = Infinity;
            for (let e = 0; e < 3; e++) {
                if (this.neighbors[triangle * 3 + e] === previous && previous >= 0) continue;
                const a = tri[triangle * 3 + e]! * 3, b = tri[triangle * 3 + (e + 1) % 3]! * 3, target = side(v[a]!, v[a + 2]!, v[b]!, v[b + 2]!, x, z);
                if (target >= -1e-12) continue;
                const here = side(v[a]!, v[a + 2]!, v[b]!, v[b + 2]!, px, pz), along = here <= 0 ? 0 : here / (here - target);
                if (along < exitAt) { exitAt = along; exit = e; }
            }
            if (exit < 0) return 1;
            const next = this.neighbors[triangle * 3 + exit]!;
            if (next < 0 || !this.#enabled[next] || (plainGroundOnly && this.#cost[next] !== this.#cost[triangle])) return Math.min(Math.max(exitAt, 0), 1);
            if (crossings) { const cx = px + (x - px) * exitAt, cz = pz + (z - pz) * exitAt; crossings.push([cx, this.heightAt(triangle, cx, cz), cz]); }
            previous = triangle; triangle = next;
        }
        return 0;
    }
    /** A place chosen evenly over the open area; pass a random function for repeatable results. */
    randomPoint(random: () => number = Math.random): NavLocation3D {
        const v = this.vertices, tri = this.triangles, areas = new Float64Array(this.triangleCount);
        let total = 0;
        for (let t = 0; t < this.triangleCount; t++) {
            if (!this.#enabled[t]) continue;
            const a = tri[t * 3]! * 3, b = tri[t * 3 + 1]! * 3, c = tri[t * 3 + 2]! * 3;
            total += areas[t] = Math.abs(side(v[a]!, v[a + 2]!, v[b]!, v[b + 2]!, v[c]!, v[c + 2]!));
        }
        let pick = random() * total, triangle = 0;
        for (let t = 0; t < this.triangleCount; t++) { if (areas[t]! <= 0) continue; triangle = t; pick -= areas[t]!; if (pick <= 0) break; }
        let s = random(), w = random();
        if (s + w > 1) { s = 1 - s; w = 1 - w; }
        const a = tri[triangle * 3]! * 3, b = tri[triangle * 3 + 1]! * 3, c = tri[triangle * 3 + 2]! * 3;
        return {triangle, point: [v[a]! + (v[b]! - v[a]!) * s + (v[c]! - v[a]!) * w, v[a + 1]! + (v[b + 1]! - v[a + 1]!) * s + (v[c + 1]! - v[a + 1]!) * w, v[a + 2]! + (v[b + 2]! - v[a + 2]!) * s + (v[c + 2]! - v[a + 2]!) * w]};
    }
    /** Line geometry of every triangle edge, for drawing the mesh while tuning a level. */
    createDebugGeometry(lift = 0.02): Geometry3D {
        const v = this.vertices, tri = this.triangles, positions: number[] = [];
        for (let t = 0; t < this.triangleCount; t++) for (let e = 0; e < 3; e++) {
            const other = this.neighbors[t * 3 + e]!;
            if (other > t) continue;   // shared edges are drawn once
            const a = tri[t * 3 + e]! * 3, b = tri[t * 3 + (e + 1) % 3]! * 3;
            positions.push(v[a]!, v[a + 1]! + lift, v[a + 2]!, v[b]!, v[b + 1]! + lift, v[b + 2]!);
        }
        return createGeometry3D({positions, topology: 'lines'});
    }
}

/**
 * Build a navigation mesh from level geometry: a geometry, or an object whose
 * meshes are merged with their world transforms. Faces steeper than
 * `slopeLimit` and faces pointing down are left out.
 */
export function createNavMesh3D(source: Geometry3D | Object3D | {readonly positions: ArrayLike<number>; readonly indices?: ArrayLike<number>}, options: NavMeshOptions3D = {}): NavMesh3D {
    if (source instanceof Geometry3D || (typeof source === 'object' && source !== null && 'traverse' in source)) {
        const shape = createMeshShape3D(source as Geometry3D | Object3D);
        return new NavMesh3D(shape.positions, shape.indices, options);
    }
    if (!source || !('positions' in source)) throw new World3DError('WORLD3D_INPUT_INVALID', 'navigation source');
    return new NavMesh3D(source.positions, source.indices, options);
}

// ---- crowd -----------------------------------------------------------------------
export interface NavAgentOptions3D {
    readonly position: ArrayLike<number>;
    readonly radius?: number;
    /** Walking speed in units per second. Defaults to 3.5. */
    readonly speed?: number;
    /** How quickly the agent reaches its speed, in units per second squared. Defaults to 20. */
    readonly acceleration?: number;
    /** Scene node moved with the agent; it must not have a transformed parent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export class NavAgent3D {
    readonly position: NavPoint3D = [0, 0, 0];
    readonly velocity: NavPoint3D = [0, 0, 0];
    radius: number;
    speed: number;
    acceleration: number;
    node: Object3D | undefined;
    userData: unknown;
    /** True once the agent has reached its target, or has none. */
    arrived = true;
    /** False when the last path request could not reach the target. */
    reachable = true;
    /** @internal */ triangle = 0;
    /** @internal */ corners: NavPoint3D[] = [];
    /** @internal */ target: NavPoint3D | undefined;
    /** @internal */ stale = false;
    /** @internal */ stalled = 0;
    /** @internal */ closest = Infinity;
    constructor(options: NavAgentOptions3D) {
        this.radius = requirePositive3D(options.radius ?? 0.35, 'agent radius');
        this.speed = requirePositive3D(options.speed ?? 3.5, 'agent speed');
        this.acceleration = requirePositive3D(options.acceleration ?? 20, 'agent acceleration');
        this.node = options.node; this.userData = options.userData;
    }
    /** Walk to a point; the path is worked out on the next crowd update. */
    setTarget(point: ArrayLike<number>): void { this.target = [requireFinite3D(point[0], 'target'), requireFinite3D(point[1], 'target'), requireFinite3D(point[2], 'target')]; this.stale = true; this.arrived = false; this.closest = Infinity; this.stalled = 0; }
    /** Stop where the agent stands. */
    stop(): void { this.target = undefined; this.corners = []; this.arrived = true; this.stale = false; }
    /** Remaining path corners, the next one first. */
    get path(): readonly NavPoint3D[] { return this.corners; }
}
/**
 * Agents walking on one navigation mesh. Each follows its own path and
 * steers away from neighbors it would otherwise walk into.
 */
export class NavCrowd3D {
    readonly navMesh: NavMesh3D;
    readonly agents: NavAgent3D[] = [];
    /** How strongly agents push apart when they overlap; 0 lets them pass through each other. */
    separation = 1;
    constructor(navMesh: NavMesh3D) {
        if (!(navMesh instanceof NavMesh3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'navigation mesh');
        this.navMesh = navMesh;
    }
    addAgent(options: NavAgentOptions3D): NavAgent3D {
        if (this.agents.length >= NAVIGATION3D_LIMITS.maxAgents) throw new World3DError('WORLD3D_BUDGET', 'agents');
        const agent = new NavAgent3D(options), place = this.navMesh.findNearest(options.position, 10);
        if (!place) throw new World3DError('WORLD3D_INPUT_INVALID', 'the agent is not near the navigation mesh');
        agent.triangle = place.triangle; agent.position[0] = place.point[0]; agent.position[1] = place.point[1]; agent.position[2] = place.point[2];
        this.agents.push(agent);
        this.sync(agent);
        return agent;
    }
    removeAgent(agent: NavAgent3D): void { const index = this.agents.indexOf(agent); if (index >= 0) this.agents.splice(index, 1); }
    private sync(agent: NavAgent3D): void { const node = agent.node; if (node) { node.position.set(agent.position); node.markTransformDirty(); } }
    /** Advance every agent by `deltaSeconds`. */
    update(deltaSeconds: number): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), agents = this.agents, mesh = this.navMesh;
        if (!(dt > 0)) return;
        // Neighbors are found through a coarse grid so large crowds stay cheap.
        let reach = 0;
        for (const agent of agents) reach = Math.max(reach, agent.radius);
        const cell = Math.max(reach * 4, 0.5), buckets = new Map<number, NavAgent3D[]>(), key = (x: number, z: number): number => Math.floor(x / cell) * 73856093 + Math.floor(z / cell) * 19349663;
        for (const agent of agents) { const k = key(agent.position[0], agent.position[2]); let list = buckets.get(k); if (!list) buckets.set(k, list = []); list.push(agent); }
        for (const agent of agents) {
            const p = agent.position, v = agent.velocity;
            if (agent.stale && agent.target) {
                const path = mesh.findPath(p, agent.target, {agentRadius: agent.radius, snapDistance: 10});
                agent.stale = false;
                agent.reachable = path?.complete === true;
                agent.corners = path ? path.points.slice(1) : [];
                if (agent.corners.length === 0) agent.arrived = true;
            }
            // Wanted velocity: toward the next corner, slowing down for the last one.
            let wx = 0, wz = 0;
            while (agent.corners.length > 0) {
                const corner = agent.corners[0]!, dx = corner[0] - p[0], dz = corner[2] - p[2], distance = Math.hypot(dx, dz), last = agent.corners.length === 1;
                if (distance < (last ? Math.max(agent.radius * 0.25, 0.05) : agent.radius)) { agent.corners.shift(); continue; }
                const speed = last ? Math.min(agent.speed, Math.sqrt(2 * agent.acceleration * distance)) : agent.speed;
                wx = dx / distance * speed; wz = dz / distance * speed;
                break;
            }
            // In a crowd the exact spot may be taken: standing still close to it counts as arriving.
            const remaining = agent.corners.length === 1 ? Math.hypot(agent.corners[0]![0] - p[0], agent.corners[0]![2] - p[2]) : Infinity;
            if (remaining < agent.closest - 0.05) { agent.closest = remaining; agent.stalled = 0; }
            else if (remaining < agent.radius * 20) {
                agent.stalled += dt;
                // Right beside the spot a short wait is enough; farther back in the queue it takes longer to give up.
                if (agent.stalled > (remaining < agent.radius * 6 ? 0.75 : 2)) { agent.corners = []; wx = 0; wz = 0; }
            }
            if (agent.corners.length === 0 && agent.target) { agent.arrived = true; agent.target = undefined; }
            // Keep clear of neighbors: a push away from each one that is too close.
            if (this.separation > 0) {
                for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
                    const list = buckets.get(key(p[0] + cx * cell, p[2] + cz * cell));
                    if (!list) continue;
                    for (const other of list) {
                        if (other === agent) continue;
                        const dx = p[0] - other.position[0], dz = p[2] - other.position[2], distance = Math.hypot(dx, dz), room = agent.radius + other.radius;
                        if (distance >= room * 1.5 || Math.abs(p[1] - other.position[1]) > 2) continue;
                        // Agents standing on the same spot part along a direction of their own.
                        const away = distance > 1e-6 ? 1 / distance : 0, ax = away ? dx * away : Math.cos(agents.indexOf(agent)), az = away ? dz * away : Math.sin(agents.indexOf(agent));
                        const push = (room * 1.5 - distance) / (room * 1.5) * agent.speed * this.separation * 1.5;
                        wx += ax * push; wz += az * push;
                    }
                }
            }
            const ax = wx - v[0], az = wz - v[2], change = Math.hypot(ax, az), most = agent.acceleration * dt;
            if (change <= most) { v[0] = wx; v[2] = wz; } else { v[0] += ax / change * most; v[2] += az / change * most; }
            if (v[0] === 0 && v[2] === 0) continue;
            const moved = mesh.moveAlong({triangle: agent.triangle, point: p}, p[0] + v[0] * dt, p[2] + v[2] * dt);
            // Report the speed really made, so an agent pressed against an edge reads as slow.
            v[0] = (moved.point[0] - p[0]) / dt; v[1] = (moved.point[1] - p[1]) / dt; v[2] = (moved.point[2] - p[2]) / dt;
            agent.triangle = moved.triangle; p[0] = moved.point[0]; p[1] = moved.point[1]; p[2] = moved.point[2];
        }
        // Agents that still overlap are moved apart, half the overlap each, staying on the mesh.
        if (this.separation > 0) {
            for (let i = 0; i < agents.length; i++) {
                const agent = agents[i]!, p = agent.position;
                for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
                    const list = buckets.get(key(p[0] + cx * cell, p[2] + cz * cell));
                    if (!list) continue;
                    for (const other of list) {
                        if (other === agent || Math.abs(p[1] - other.position[1]) > 2) continue;
                        const dx = p[0] - other.position[0], dz = p[2] - other.position[2], distance = Math.hypot(dx, dz), overlap = agent.radius + other.radius - distance;
                        if (overlap <= 0 || distance < 1e-6) continue;
                        const moved = mesh.moveAlong({triangle: agent.triangle, point: p}, p[0] + dx / distance * overlap * 0.5, p[2] + dz / distance * overlap * 0.5);
                        agent.triangle = moved.triangle; p[0] = moved.point[0]; p[1] = moved.point[1]; p[2] = moved.point[2];
                    }
                }
            }
        }
        for (const agent of agents) this.sync(agent);
    }
}
export function createNavCrowd3D(navMesh: NavMesh3D): NavCrowd3D { return new NavCrowd3D(navMesh); }

// ---- grids -----------------------------------------------------------------------
export interface GridPathOptions3D {
    /** Allow diagonal steps (never cutting a blocked corner). Defaults to true. */
    readonly diagonal?: boolean;
    /** Give up after visiting this many cells. Defaults to every cell. */
    readonly maxVisited?: number;
}
/**
 * Shortest path on a grid of cells, for tile maps. `cost(x, y)` returns the
 * price of entering a cell (1 for plain ground, more for rough ground) or a
 * value of 0 or less for a blocked cell. Returns the cells from start to end
 * inclusive, or undefined when there is no way.
 */
export function findGridPath3D(width: number, height: number, cost: (x: number, y: number) => number, start: readonly [number, number], end: readonly [number, number],
    options: GridPathOptions3D = {}): [number, number][] | undefined {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'grid size');
    if (width * height > NAVIGATION3D_LIMITS.maxGridCells) throw new World3DError('WORLD3D_BUDGET', 'grid size');
    const inside = (x: number, y: number): boolean => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
    if (!inside(start[0], start[1]) || !inside(end[0], end[1])) throw new World3DError('WORLD3D_INPUT_INVALID', 'grid cell');
    if (!(cost(end[0], end[1]) > 0)) return undefined;
    const total = width * height, g = new Float32Array(total).fill(Infinity), f = new Float32Array(total).fill(Infinity), from = new Int32Array(total).fill(-1), closed = new Uint8Array(total), heap = new Heap(f);
    const diagonal = options.diagonal ?? true, limit = options.maxVisited ?? total, goal = end[1] * width + end[0], first = start[1] * width + start[0];
    // Distance with diagonal steps costing the square root of two; plain steps otherwise.
    const estimate = (x: number, y: number): number => { const dx = Math.abs(x - end[0]), dy = Math.abs(y - end[1]); return diagonal ? Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) : dx + dy; };
    g[first] = 0; f[first] = estimate(start[0], start[1]);
    heap.push(first);
    for (let visited = 0; heap.size > 0 && visited < limit;) {
        const current = heap.pop();
        if (closed[current]) continue;
        closed[current] = 1; visited++;
        if (current === goal) {
            const path: [number, number][] = [];
            for (let cell = goal; cell >= 0; cell = from[cell]!) path.push([cell % width, Math.floor(cell / width)]);
            return path.reverse();
        }
        const x = current % width, y = Math.floor(current / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if ((dx === 0 && dy === 0) || (!diagonal && dx !== 0 && dy !== 0)) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const next = ny * width + nx;
            if (closed[next]) continue;
            const price = cost(nx, ny);
            if (!(price > 0)) continue;
            // A diagonal step needs both cells beside it open.
            if (dx !== 0 && dy !== 0 && (!(cost(x + dx, y) > 0) || !(cost(x, y + dy) > 0))) continue;
            const reached = g[current]! + price * (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
            if (reached >= g[next]!) continue;
            g[next] = reached; from[next] = current; f[next] = reached + estimate(nx, ny);
            heap.push(next);
        }
    }
    return undefined;
}
