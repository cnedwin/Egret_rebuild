// SPDX-License-Identifier: Apache-2.0
// Further procedural geometries (discs, knots, polyhedra, lathes, tubes,
// flat and extruded outlines) and geometry utilities (edges, wireframe,
// merging, welding, baking a transform). Triangles are counter-clockwise
// with outward normals, like the basic primitives.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {Curve3D, Shape3D, signedArea2D, triangulateShape3D} from './Curves3D.js';
import type {Point2D, Point3D} from './Curves3D.js';
import {Attribute3D, Geometry3D, createGeometry3D} from './Geometry3D.js';
import type {AttributeArray3D} from './Geometry3D.js';
import {mat3NormalFromMat4} from './math3D.js';

const MAX_SEGMENTS = 2048;
function count(value: number | undefined, fallback: number, min: number, field: string): number {
    const n = requireCount3D(value ?? fallback, field, MAX_SEGMENTS);
    if (n < min) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return n;
}
interface Lists { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }
const lists = (): Lists => ({positions: [], normals: [], uvs: [], indices: []});
const build = (l: Lists): Geometry3D => createGeometry3D({positions: l.positions, normals: l.normals, uvs: l.uvs, indices: l.indices});
/** Index a (columns + 1) x (rows + 1) vertex grid. */
function grid(l: Lists, base: number, columns: number, rows: number): void {
    const stride = columns + 1;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const a = base + row * stride + column, b = a + stride;
        l.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
}

export interface CircleGeometryOptions3D { readonly radius?: number; readonly segments?: number; readonly thetaStart?: number; readonly thetaLength?: number }
/** Flat disc or sector in the XY plane, facing +Z. */
export function createCircleGeometry3D(options: CircleGeometryOptions3D = {}): Geometry3D {
    return createRingGeometry3D({innerRadius: 0, outerRadius: options.radius ?? 0.5, thetaSegments: options.segments ?? 32, phiSegments: 1,
        ...(options.thetaStart === undefined ? {} : {thetaStart: options.thetaStart}), ...(options.thetaLength === undefined ? {} : {thetaLength: options.thetaLength})});
}
export interface RingGeometryOptions3D {
    readonly innerRadius?: number; readonly outerRadius?: number; readonly thetaSegments?: number; readonly phiSegments?: number;
    readonly thetaStart?: number; readonly thetaLength?: number;
}
/** Flat ring in the XY plane, facing +Z. An inner radius of 0 gives a disc. */
export function createRingGeometry3D(options: RingGeometryOptions3D = {}): Geometry3D {
    const inner = Math.max(requireFinite3D(options.innerRadius ?? 0.25, 'innerRadius'), 0), outer = requirePositive3D(options.outerRadius ?? 0.5, 'outerRadius');
    if (inner >= outer) throw new World3DError('WORLD3D_INPUT_INVALID', 'innerRadius');
    const ts = count(options.thetaSegments, 32, 3, 'thetaSegments'), ps = count(options.phiSegments, 1, 1, 'phiSegments');
    const start = options.thetaStart ?? 0, length = options.thetaLength ?? Math.PI * 2, l = lists();
    for (let j = 0; j <= ps; j++) {
        const radius = inner + (outer - inner) * j / ps;
        for (let i = 0; i <= ts; i++) {
            const angle = start + length * i / ts, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
            l.positions.push(x, y, 0); l.normals.push(0, 0, 1); l.uvs.push(x / outer * 0.5 + 0.5, y / outer * 0.5 + 0.5);
        }
    }
    const stride = ts + 1;
    for (let j = 0; j < ps; j++) for (let i = 0; i < ts; i++) { const a = j * stride + i, b = a + stride; l.indices.push(a, b, a + 1, b, b + 1, a + 1); }
    return build(l);
}

export interface TorusKnotGeometryOptions3D {
    readonly radius?: number; readonly tube?: number; readonly tubularSegments?: number; readonly radialSegments?: number;
    /** Windings around the axis of symmetry and around the inside of the torus; coprime values give a knot. */
    readonly p?: number; readonly q?: number;
}
export function createTorusKnotGeometry3D(options: TorusKnotGeometryOptions3D = {}): Geometry3D {
    const radius = requirePositive3D(options.radius ?? 0.5, 'radius'), tube = requirePositive3D(options.tube ?? 0.15, 'tube');
    const ts = count(options.tubularSegments, 96, 3, 'tubularSegments'), rs = count(options.radialSegments, 12, 3, 'radialSegments');
    const p = options.p ?? 2, q = options.q ?? 3, l = lists();
    const at = (u: number): Point3D => { const cu = Math.cos(u), su = Math.sin(u), quOverP = q / p * u, cs = Math.cos(quOverP); return [radius * (2 + cs) * 0.5 * cu, radius * (2 + cs) * su * 0.5, radius * Math.sin(quOverP) * 0.5]; };
    for (let i = 0; i <= ts; i++) {
        const u = i / ts * p * Math.PI * 2, p1 = at(u), p2 = at(u + 0.01);
        const t: Point3D = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], n0: Point3D = [p2[0] + p1[0], p2[1] + p1[1], p2[2] + p1[2]];
        const b = unit(cross(t, n0)), n = unit(cross(b, t));
        for (let j = 0; j <= rs; j++) {
            const v = j / rs * Math.PI * 2, cx = -tube * Math.cos(v), cy = tube * Math.sin(v);
            const x = p1[0] + cx * n[0] + cy * b[0], y = p1[1] + cx * n[1] + cy * b[1], z = p1[2] + cx * n[2] + cy * b[2];
            const normal = unit([x - p1[0], y - p1[1], z - p1[2]]);
            l.positions.push(x, y, z); l.normals.push(...normal); l.uvs.push(i / ts, j / rs);
        }
    }
    grid(l, 0, rs, ts);
    return build(l);
}
function cross(a: Point3D, b: Point3D): Point3D { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a: Point3D): Point3D { const length = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / length, a[1] / length, a[2] / length]; }

/**
 * Project a convex solid's triangles onto a sphere, subdividing each `detail`
 * times. Vertices are not shared, so the result is faceted unless
 * `smooth` is set, which uses the sphere normal.
 */
export function createPolyhedronGeometry3D(vertices: ArrayLike<number>, indices: ArrayLike<number>, options: {readonly radius?: number; readonly detail?: number; readonly smooth?: boolean} = {}): Geometry3D {
    const radius = requirePositive3D(options.radius ?? 0.5, 'radius'), detail = requireCount3D(options.detail ?? 0, 'detail', 6), smooth = options.smooth ?? detail > 0;
    if (!vertices || vertices.length % 3 !== 0 || !indices || indices.length % 3 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'polyhedron');
    const l = lists(), divisions = detail + 1;
    const corner = (i: number): Point3D => unit([vertices[i * 3]!, vertices[i * 3 + 1]!, vertices[i * 3 + 2]!]);
    const emit = (a: Point3D, b: Point3D, c: Point3D): void => {
        const flat = unit(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
        for (const p of [a, b, c]) {
            l.positions.push(p[0] * radius, p[1] * radius, p[2] * radius);
            l.normals.push(...(smooth ? p : flat));
            l.uvs.push(Math.atan2(p[2], -p[0]) / (Math.PI * 2) + 0.5, Math.asin(Math.min(Math.max(p[1], -1), 1)) / Math.PI + 0.5);
        }
    };
    for (let f = 0; f < indices.length; f += 3) {
        const a = corner(indices[f]!), b = corner(indices[f + 1]!), c = corner(indices[f + 2]!);
        // Barycentric rows of points, pushed out to the unit sphere.
        const rows: Point3D[][] = [];
        for (let i = 0; i <= divisions; i++) {
            const row: Point3D[] = [], left = mix(a, c, i / divisions), right = mix(b, c, i / divisions), steps = divisions - i;
            for (let j = 0; j <= steps; j++) row.push(unit(steps === 0 ? left : mix(left, right, j / steps)));
            rows.push(row);
        }
        for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions - i; j++) {
            emit(rows[i]![j]!, rows[i]![j + 1]!, rows[i + 1]![j]!);
            if (j < divisions - i - 1) emit(rows[i]![j + 1]!, rows[i + 1]![j + 1]!, rows[i + 1]![j]!);
        }
    }
    return createGeometry3D({positions: l.positions, normals: l.normals, uvs: l.uvs});
}
function mix(a: Point3D, b: Point3D, t: number): Point3D { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
const PHI = (1 + Math.sqrt(5)) / 2, INVERSE_PHI = 1 / PHI;
export interface PolyhedronOptions3D { readonly radius?: number; readonly detail?: number; readonly smooth?: boolean }
export function createTetrahedronGeometry3D(options: PolyhedronOptions3D = {}): Geometry3D {
    return createPolyhedronGeometry3D([1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1], [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1], options);
}
export function createOctahedronGeometry3D(options: PolyhedronOptions3D = {}): Geometry3D {
    return createPolyhedronGeometry3D([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1], [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2], options);
}
export function createIcosahedronGeometry3D(options: PolyhedronOptions3D = {}): Geometry3D {
    return createPolyhedronGeometry3D([-1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, 0, 0, -1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, PHI, 0, -1, PHI, 0, 1, -PHI, 0, -1, -PHI, 0, 1],
        [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1], options);
}
export function createDodecahedronGeometry3D(options: PolyhedronOptions3D = {}): Geometry3D {
    const r = INVERSE_PHI, t = PHI;
    return createPolyhedronGeometry3D([-1, -1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1, 0, -r, -t, 0, -r, t, 0, r, -t, 0, r, t, -r, -t, 0, -r, t, 0, r, -t, 0, r, t, 0, -t, 0, -r, t, 0, -r, -t, 0, r, t, 0, r],
        [3, 11, 7, 3, 7, 15, 3, 15, 13, 7, 19, 17, 7, 17, 6, 7, 6, 15, 17, 4, 8, 17, 8, 10, 17, 10, 6, 8, 0, 16, 8, 16, 2, 8, 2, 10, 0, 12, 1, 0, 1, 18, 0, 18, 16, 6, 10, 2, 6, 2, 13, 6, 13, 15, 2, 16, 18, 2, 18, 3, 2, 3, 13,
            18, 1, 9, 18, 9, 11, 18, 11, 3, 4, 14, 12, 4, 12, 0, 4, 0, 8, 11, 9, 5, 11, 5, 19, 11, 19, 7, 19, 5, 14, 19, 14, 4, 19, 4, 17, 1, 12, 14, 1, 14, 5, 1, 5, 9], options);
}

export interface LatheGeometryOptions3D { readonly segments?: number; readonly phiStart?: number; readonly phiLength?: number }
/** Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. */
export function createLatheGeometry3D(profile: readonly (readonly [number, number])[], options: LatheGeometryOptions3D = {}): Geometry3D {
    if (!Array.isArray(profile) || profile.length < 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'lathe profile');
    const segments = count(options.segments, 24, 3, 'segments'), start = options.phiStart ?? 0, length = options.phiLength ?? Math.PI * 2, l = lists(), rows = profile.length;
    // Profile normals: perpendicular to the neighbouring edges, pointing away from the axis.
    const profileNormals: Point2D[] = profile.map((_, i) => {
        const a = profile[Math.max(i - 1, 0)]!, b = profile[Math.min(i + 1, rows - 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], size = Math.hypot(dx, dy) || 1;
        return [dy / size, -dx / size];
    });
    for (let i = 0; i <= segments; i++) {
        const phi = start + length * i / segments, sin = Math.sin(phi), cos = Math.cos(phi);
        for (let j = 0; j < rows; j++) {
            const [x, y] = profile[j]!, [nx, ny] = profileNormals[j]!;
            l.positions.push(x * sin, y, x * cos); l.normals.push(nx * sin, ny, nx * cos); l.uvs.push(i / segments, j / (rows - 1));
        }
    }
    grid(l, 0, rows - 1, segments);
    return build(l);
}

export interface TubeGeometryOptions3D { readonly tubularSegments?: number; readonly radius?: number; readonly radialSegments?: number; readonly closed?: boolean }
/** Sweep a circle along a curve, using twist-free frames. */
export function createTubeGeometry3D(curve: Curve3D, options: TubeGeometryOptions3D = {}): Geometry3D {
    if (!(curve instanceof Curve3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'curve');
    const ts = count(options.tubularSegments, 64, 1, 'tubularSegments'), rs = count(options.radialSegments, 8, 3, 'radialSegments');
    const radius = requirePositive3D(options.radius ?? 0.1, 'radius'), closed = options.closed ?? false, frames = curve.computeFrames(ts, closed), l = lists();
    for (let i = 0; i <= ts; i++) {
        const center = curve.getPointAt(i / ts), n = frames.normals[i]!, b = frames.binormals[i]!;
        for (let j = 0; j <= rs; j++) {
            const v = j / rs * Math.PI * 2, sin = Math.sin(v), cos = -Math.cos(v), nx = cos * n[0] + sin * b[0], ny = cos * n[1] + sin * b[1], nz = cos * n[2] + sin * b[2];
            l.positions.push(center[0] + radius * nx, center[1] + radius * ny, center[2] + radius * nz); l.normals.push(nx, ny, nz); l.uvs.push(i / ts, j / rs);
        }
    }
    grid(l, 0, rs, ts);
    return build(l);
}

function shapeList(shapes: Shape3D | readonly Shape3D[]): readonly Shape3D[] {
    const list = shapes instanceof Shape3D ? [shapes] : shapes;
    if (!Array.isArray(list) || list.length === 0 || !list.every(shape => shape instanceof Shape3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'shapes');
    return list;
}
/** Fill one or more outlines in the XY plane, facing +Z. UVs equal the XY coordinates. */
export function createShapeGeometry3D(shapes: Shape3D | readonly Shape3D[]): Geometry3D {
    const l = lists();
    for (const shape of shapeList(shapes)) {
        const base = l.positions.length / 3, {vertices, indices} = triangulateShape3D(shape.contour(), shape.holes.map(hole => hole.contour()));
        for (const [x, y] of vertices) { l.positions.push(x, y, 0); l.normals.push(0, 0, 1); l.uvs.push(x, y); }
        for (const index of indices) l.indices.push(base + index);
    }
    return build(l);
}
export interface ExtrudeGeometryOptions3D {
    /** Thickness along +Z. Ignored when `path` is given. */
    readonly depth?: number;
    /** Subdivisions along the extrusion. */
    readonly steps?: number;
    /** Sweep the outline along this curve instead of straight along Z. */
    readonly path?: Curve3D;
}
/**
 * Give an outline thickness. The result has two material groups: 0 for the
 * front and back caps, 1 for the side walls. Edges are sharp; bevels are not
 * generated.
 */
export function createExtrudeGeometry3D(shapes: Shape3D | readonly Shape3D[], options: ExtrudeGeometryOptions3D = {}): Geometry3D {
    const steps = count(options.steps, options.path ? 32 : 1, 1, 'steps'), depth = requireFinite3D(options.depth ?? 1, 'depth'), path = options.path;
    const caps = lists(), sides = lists(), frames = path?.computeFrames(steps, false);
    // Map an outline point at step `s` into 3D.
    const place = (x: number, y: number, s: number): Point3D => {
        if (!path || !frames) return [x, y, depth * s / steps];
        const center = path.getPointAt(s / steps), n = frames.normals[s]!, b = frames.binormals[s]!;
        return [center[0] + n[0] * x + b[0] * y, center[1] + n[1] * x + b[1] * y, center[2] + n[2] * x + b[2] * y];
    };
    for (const shape of shapeList(shapes)) {
        const contour = shape.contour(), holes = shape.holes.map(hole => hole.contour());
        if (signedArea2D(contour) < 0) contour.reverse();
        for (const hole of holes) if (signedArea2D(hole) > 0) hole.reverse();
        const {vertices, indices} = triangulateShape3D(contour, holes);
        for (const front of [false, true]) {
            const base = caps.positions.length / 3, s = front ? steps : 0;
            const a = place(0, 0, s), ex = place(1, 0, s), ey = place(0, 1, s);
            const facing = unit(cross([ex[0] - a[0], ex[1] - a[1], ex[2] - a[2]], [ey[0] - a[0], ey[1] - a[1], ey[2] - a[2]])), sign = front ? 1 : -1;
            for (const [x, y] of vertices) { caps.positions.push(...place(x, y, s)); caps.normals.push(facing[0] * sign, facing[1] * sign, facing[2] * sign); caps.uvs.push(x, y); }
            for (let i = 0; i < indices.length; i += 3) {
                if (front) caps.indices.push(base + indices[i]!, base + indices[i + 1]!, base + indices[i + 2]!);
                else caps.indices.push(base + indices[i]!, base + indices[i + 2]!, base + indices[i + 1]!);
            }
        }
        for (const ring of [contour, ...holes]) {
            let travelled = 0;
            for (let i = 0; i < ring.length; i++) {
                const p = ring[i]!, q = ring[(i + 1) % ring.length]!, edge = Math.hypot(q[0] - p[0], q[1] - p[1]);
                // Each wall quad strip has its own vertices so corners stay sharp.
                const base = sides.positions.length / 3;
                for (let s = 0; s <= steps; s++) {
                    const a = place(p[0], p[1], s), b = place(q[0], q[1], s), next = place(p[0], p[1], Math.min(s + 1, steps)), previous = place(p[0], p[1], Math.max(s - 1, 0));
                    const normal = unit(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]]));
                    sides.positions.push(...a, ...b); sides.normals.push(...normal, ...normal); sides.uvs.push(travelled, s / steps, travelled + edge, s / steps);
                }
                for (let s = 0; s < steps; s++) { const a = base + s * 2; sides.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
                travelled += edge;
            }
        }
    }
    const capVertices = caps.positions.length / 3;
    const geometry = createGeometry3D({
        positions: [...caps.positions, ...sides.positions], normals: [...caps.normals, ...sides.normals], uvs: [...caps.uvs, ...sides.uvs],
        indices: [...caps.indices, ...sides.indices.map(index => index + capVertices)],
    });
    geometry.addGroup(0, caps.indices.length, 0); geometry.addGroup(caps.indices.length, sides.indices.length, 1);
    return geometry;
}

// ---- utilities ------------------------------------------------------------------
function triangleIndices(geometry: Geometry3D): ArrayLike<number> {
    if (!(geometry instanceof Geometry3D) || geometry.topology !== 'triangles') throw new World3DError('WORLD3D_INPUT_INVALID', 'triangle geometry');
    const position = geometry.getAttribute('position');
    if (!position) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry positions');
    return geometry.index ? geometry.index.data : Array.from({length: position.count}, (_, i) => i);
}
const lineGeometry = (positions: number[]): Geometry3D => createGeometry3D({positions, topology: 'lines'});
/** Line segments for every triangle edge, each drawn once. */
export function createWireframeGeometry3D(geometry: Geometry3D): Geometry3D {
    const indices = triangleIndices(geometry), p = geometry.getAttribute('position')!.data, seen = new Set<number>(), positions: number[] = [], total = p.length / 3;
    for (let i = 0; i < indices.length; i += 3) for (let e = 0; e < 3; e++) {
        const a = indices[i + e]!, b = indices[i + (e + 1) % 3]!, key = Math.min(a, b) * total + Math.max(a, b);
        if (seen.has(key)) continue;
        seen.add(key);
        positions.push(p[a * 3]!, p[a * 3 + 1]!, p[a * 3 + 2]!, p[b * 3]!, p[b * 3 + 1]!, p[b * 3 + 2]!);
    }
    return lineGeometry(positions);
}
/**
 * Line segments for outline and crease edges only: edges with one face, or
 * whose two faces meet at more than `thresholdAngle` radians.
 */
export function createEdgesGeometry3D(geometry: Geometry3D, thresholdAngle = Math.PI / 180): Geometry3D {
    const indices = triangleIndices(geometry), p = geometry.getAttribute('position')!.data, limit = Math.cos(thresholdAngle), positions: number[] = [];
    // Weld by position so faces that only share coordinates still count as neighbours.
    const ids = new Map<string, number>(), welded: number[] = [];
    for (let i = 0; i < p.length / 3; i++) {
        const key = Math.round(p[i * 3]! * 1e4) + ',' + Math.round(p[i * 3 + 1]! * 1e4) + ',' + Math.round(p[i * 3 + 2]! * 1e4);
        let id = ids.get(key);
        if (id === undefined) ids.set(key, id = ids.size);
        welded.push(id);
    }
    const edges = new Map<string, {a: number; b: number; normal: Point3D; shared: boolean; sharp: boolean}>();
    for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i]!, ib = indices[i + 1]!, ic = indices[i + 2]!;
        const normal = unit(cross([p[ib * 3]! - p[ia * 3]!, p[ib * 3 + 1]! - p[ia * 3 + 1]!, p[ib * 3 + 2]! - p[ia * 3 + 2]!], [p[ic * 3]! - p[ia * 3]!, p[ic * 3 + 1]! - p[ia * 3 + 1]!, p[ic * 3 + 2]! - p[ia * 3 + 2]!]));
        for (const [a, b] of [[ia, ib], [ib, ic], [ic, ia]] as const) {
            const wa = welded[a]!, wb = welded[b]!;
            if (wa === wb) continue;
            const key = wa < wb ? wa + '_' + wb : wb + '_' + wa, existing = edges.get(key);
            if (!existing) edges.set(key, {a, b, normal, shared: false, sharp: false});
            else { existing.shared = true; if (existing.normal[0] * normal[0] + existing.normal[1] * normal[1] + existing.normal[2] * normal[2] <= limit) existing.sharp = true; }
        }
    }
    for (const edge of edges.values()) {
        if (edge.shared && !edge.sharp) continue;
        positions.push(p[edge.a * 3]!, p[edge.a * 3 + 1]!, p[edge.a * 3 + 2]!, p[edge.b * 3]!, p[edge.b * 3 + 1]!, p[edge.b * 3 + 2]!);
    }
    return lineGeometry(positions);
}
function cloneArray(data: AttributeArray3D, length: number): AttributeArray3D {
    return new (data.constructor as new (length: number) => AttributeArray3D)(length);
}
/** Copy with every triangle owning its vertices, as needed for per-face data. */
export function toNonIndexedGeometry3D(geometry: Geometry3D): Geometry3D {
    if (!(geometry instanceof Geometry3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry');
    const index = geometry.index?.data, out = new Geometry3D();
    out.topology = geometry.topology; out.name = geometry.name;
    for (const [name, attribute] of geometry.attributes) {
        if (!index) { out.setAttribute(name, new Attribute3D(attribute.data.slice(), attribute.itemSize, attribute.normalized)); continue; }
        const size = attribute.itemSize, data = cloneArray(attribute.data, index.length * size);
        for (let i = 0; i < index.length; i++) for (let k = 0; k < size; k++) data[i * size + k] = attribute.data[index[i]! * size + k]!;
        out.setAttribute(name, new Attribute3D(data, size, attribute.normalized));
    }
    for (const group of geometry.groups) out.addGroup(group.start, group.count, group.materialIndex);
    return out;
}
/**
 * Join geometries that share the same attribute set into one. With
 * `useGroups`, each input becomes a material group in order.
 */
export function mergeGeometries3D(geometries: readonly Geometry3D[], useGroups = false): Geometry3D {
    if (!Array.isArray(geometries) || geometries.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometries');
    const first = geometries[0]!, names = [...first.attributes.keys()], out = new Geometry3D();
    out.topology = first.topology;
    let vertexTotal = 0, indexTotal = 0;
    for (const geometry of geometries) {
        if (geometry.topology !== first.topology || geometry.attributes.size !== names.length || (geometry.index === undefined) !== (first.index === undefined)) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometries differ in layout');
        for (const name of names) { const a = geometry.getAttribute(name), b = first.getAttribute(name)!; if (!a || a.itemSize !== b.itemSize || a.data.constructor !== b.data.constructor) throw new World3DError('WORLD3D_INPUT_INVALID', 'attribute ' + name); }
        vertexTotal += geometry.getAttribute('position')!.count; indexTotal += geometry.index?.data.length ?? 0;
    }
    for (const name of names) {
        const model = first.getAttribute(name)!, data = cloneArray(model.data, vertexTotal * model.itemSize);
        let offset = 0;
        for (const geometry of geometries) { const source = geometry.getAttribute(name)!.data; data.set(source, offset); offset += source.length; }
        out.setAttribute(name, new Attribute3D(data, model.itemSize, model.normalized));
    }
    let vertexOffset = 0, drawOffset = 0;
    const index = first.index ? (vertexTotal > 65535 ? new Uint32Array(indexTotal) : new Uint16Array(indexTotal)) : undefined;
    for (const geometry of geometries) {
        const vertices = geometry.getAttribute('position')!.count, source = geometry.index?.data, drawCount = source ? source.length : vertices;
        if (index && source) for (let i = 0; i < source.length; i++) index[drawOffset + i] = source[i]! + vertexOffset;
        if (useGroups) out.addGroup(drawOffset, drawCount, geometries.indexOf(geometry));
        vertexOffset += vertices; drawOffset += drawCount;
    }
    if (index) out.setIndex(index);
    return out;
}
/** Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. */
export function mergeVertices3D(geometry: Geometry3D, tolerance = 1e-4): Geometry3D {
    if (!(geometry instanceof Geometry3D) || !(tolerance > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry');
    const position = geometry.getAttribute('position');
    if (!position) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry positions');
    const attributes = [...geometry.attributes], source = geometry.index?.data, total = source ? source.length : position.count;
    const ids = new Map<string, number>(), remap: number[] = [], kept: number[] = [], scale = 1 / tolerance;
    for (let i = 0; i < position.count; i++) {
        let key = '';
        for (const [, attribute] of attributes) for (let k = 0; k < attribute.itemSize; k++) key += Math.round(attribute.data[i * attribute.itemSize + k]! * scale) + ',';
        let id = ids.get(key);
        if (id === undefined) { ids.set(key, id = kept.length); kept.push(i); }
        remap.push(id);
    }
    const out = new Geometry3D();
    out.topology = geometry.topology; out.name = geometry.name;
    for (const [name, attribute] of attributes) {
        const size = attribute.itemSize, data = cloneArray(attribute.data, kept.length * size);
        kept.forEach((from, to) => { for (let k = 0; k < size; k++) data[to * size + k] = attribute.data[from * size + k]!; });
        out.setAttribute(name, new Attribute3D(data, size, attribute.normalized));
    }
    const index = kept.length > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    for (let i = 0; i < total; i++) index[i] = remap[source ? source[i]! : i]!;
    out.setIndex(index);
    for (const group of geometry.groups) out.addGroup(group.start, group.count, group.materialIndex);
    return out;
}
/** Bake a 4x4 transform into positions, normals and tangents, in place. */
export function transformGeometry3D(geometry: Geometry3D, matrix: ArrayLike<number>): Geometry3D {
    if (!(geometry instanceof Geometry3D) || !matrix || matrix.length !== 16) throw new World3DError('WORLD3D_INPUT_INVALID', 'transform');
    const m = matrix, position = geometry.getAttribute('position');
    if (position) {
        const d = position.data;
        for (let i = 0; i < d.length; i += 3) {
            const x = d[i]!, y = d[i + 1]!, z = d[i + 2]!;
            d[i] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!; d[i + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!; d[i + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
        }
        position.touch();
    }
    const n = mat3NormalFromMat4(new Float32Array(9), m);
    for (const name of ['normal', 'tangent']) {
        const attribute = geometry.getAttribute(name);
        if (!attribute) continue;
        // Normals use the inverse transpose; tangents follow the surface, so they use the matrix itself.
        const d = attribute.data, size = attribute.itemSize, k = name === 'normal' ? n : [m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!];
        for (let i = 0; i < d.length; i += size) {
            const x = d[i]!, y = d[i + 1]!, z = d[i + 2]!, nx = k[0]! * x + k[3]! * y + k[6]! * z, ny = k[1]! * x + k[4]! * y + k[7]! * z, nz = k[2]! * x + k[5]! * y + k[8]! * z, length = Math.hypot(nx, ny, nz) || 1;
            d[i] = nx / length; d[i + 1] = ny / length; d[i + 2] = nz / length;
        }
        attribute.touch();
    }
    geometry.invalidateBounds();
    return geometry;
}
