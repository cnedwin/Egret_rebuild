// SPDX-License-Identifier: Apache-2.0
// Procedural geometry builders. All produce counter-clockwise triangles with
// outward normals and UVs whose V axis points up.
import {World3DError, requireCount3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';

const MAX_SEGMENTS = 512;

class Builder {
    readonly positions: number[] = [];
    readonly normals: number[] = [];
    readonly uvs: number[] = [];
    readonly indices: number[] = [];
    get vertexCount(): number { return this.positions.length / 3; }
    vertex(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number, v: number): void {
        this.positions.push(px, py, pz); this.normals.push(nx, ny, nz); this.uvs.push(u, v);
    }
    /** Index a (columns + 1) x (rows + 1) vertex grid starting at `base`. */
    grid(base: number, columns: number, rows: number, flip = false): void {
        const stride = columns + 1;
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const a = base + row * stride + column, b = a + stride, c = b + 1, d = a + 1;
                if (flip) this.indices.push(a, d, b, b, d, c); else this.indices.push(a, b, d, b, c, d);
            }
        }
    }
    build(): Geometry3D {
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(new Float32Array(this.positions), 3));
        geometry.setAttribute('normal', new Attribute3D(new Float32Array(this.normals), 3));
        geometry.setAttribute('uv', new Attribute3D(new Float32Array(this.uvs), 2));
        geometry.setIndex(this.vertexCount > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices));
        return geometry;
    }
}
function segments(value: number | undefined, fallback: number, min: number, field: string): number {
    const count = requireCount3D(value ?? fallback, field, MAX_SEGMENTS);
    if (count < min) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return count;
}

export interface BoxGeometryOptions3D {
    readonly width?: number; readonly height?: number; readonly depth?: number;
    readonly widthSegments?: number; readonly heightSegments?: number; readonly depthSegments?: number;
}
/** Axis-aligned box centered on the origin with one material group per face (+X, -X, +Y, -Y, +Z, -Z). */
export function createBoxGeometry3D(options: BoxGeometryOptions3D = {}): Geometry3D {
    const width = requirePositive3D(options.width ?? 1, 'width'), height = requirePositive3D(options.height ?? 1, 'height'), depth = requirePositive3D(options.depth ?? 1, 'depth');
    const ws = segments(options.widthSegments, 1, 1, 'widthSegments'), hs = segments(options.heightSegments, 1, 1, 'heightSegments'), ds = segments(options.depthSegments, 1, 1, 'depthSegments');
    const builder = new Builder();
    const groups: [number, number][] = [];
    // Each face maps (u, v) across two axes while the third stays at +-half.
    const face = (uAxis: number, vAxis: number, wAxis: number, uDir: number, vDir: number, w: number, uSize: number, vSize: number, uSeg: number, vSeg: number): void => {
        const base = builder.vertexCount, start = builder.indices.length;
        for (let iy = 0; iy <= vSeg; iy++) {
            for (let ix = 0; ix <= uSeg; ix++) {
                const p = [0, 0, 0], n = [0, 0, 0];
                p[uAxis] = (ix / uSeg - 0.5) * uSize * uDir; p[vAxis] = (0.5 - iy / vSeg) * vSize * vDir; p[wAxis] = w;
                n[wAxis] = Math.sign(w);
                builder.vertex(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!, ix / uSeg, 1 - iy / vSeg);
            }
        }
        builder.grid(base, uSeg, vSeg);
        groups.push([start, builder.indices.length - start]);
    };
    face(2, 1, 0, -1, 1, width / 2, depth, height, ds, hs);
    face(2, 1, 0, 1, 1, -width / 2, depth, height, ds, hs);
    face(0, 2, 1, 1, -1, height / 2, width, depth, ws, ds);
    face(0, 2, 1, 1, 1, -height / 2, width, depth, ws, ds);
    face(0, 1, 2, 1, 1, depth / 2, width, height, ws, hs);
    face(0, 1, 2, -1, 1, -depth / 2, width, height, ws, hs);
    const geometry = builder.build();
    groups.forEach(([start, count], index) => geometry.addGroup(start, count, index));
    return geometry;
}

export interface PlaneGeometryOptions3D {
    readonly width?: number; readonly height?: number;
    readonly widthSegments?: number; readonly heightSegments?: number;
}
/** Plane in the XY plane facing +Z. Rotate -90 degrees about X for a floor. */
export function createPlaneGeometry3D(options: PlaneGeometryOptions3D = {}): Geometry3D {
    const width = requirePositive3D(options.width ?? 1, 'width'), height = requirePositive3D(options.height ?? 1, 'height');
    const ws = segments(options.widthSegments, 1, 1, 'widthSegments'), hs = segments(options.heightSegments, 1, 1, 'heightSegments');
    const builder = new Builder();
    for (let iy = 0; iy <= hs; iy++) {
        for (let ix = 0; ix <= ws; ix++) builder.vertex((ix / ws - 0.5) * width, (0.5 - iy / hs) * height, 0, 0, 0, 1, ix / ws, 1 - iy / hs);
    }
    builder.grid(0, ws, hs);
    return builder.build();
}

export interface SphereGeometryOptions3D {
    readonly radius?: number; readonly widthSegments?: number; readonly heightSegments?: number;
}
/** UV sphere with poles on the Y axis. */
export function createSphereGeometry3D(options: SphereGeometryOptions3D = {}): Geometry3D {
    const radius = requirePositive3D(options.radius ?? 0.5, 'radius');
    const ws = segments(options.widthSegments, 32, 3, 'widthSegments'), hs = segments(options.heightSegments, 16, 2, 'heightSegments');
    const builder = new Builder();
    for (let iy = 0; iy <= hs; iy++) {
        const v = iy / hs, phi = v * Math.PI, sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
        for (let ix = 0; ix <= ws; ix++) {
            const u = ix / ws, theta = u * Math.PI * 2;
            const nx = -Math.cos(theta) * sinPhi, ny = cosPhi, nz = Math.sin(theta) * sinPhi;
            builder.vertex(nx * radius, ny * radius, nz * radius, nx, ny, nz, u, 1 - v);
        }
    }
    builder.grid(0, ws, hs);
    return builder.build();
}

export interface CylinderGeometryOptions3D {
    readonly radiusTop?: number; readonly radiusBottom?: number; readonly height?: number;
    readonly radialSegments?: number; readonly heightSegments?: number; readonly openEnded?: boolean;
}
/** Cylinder or truncated cone along Y. A zero radius at one end produces a cone. */
export function createCylinderGeometry3D(options: CylinderGeometryOptions3D = {}): Geometry3D {
    const top = options.radiusTop ?? 0.5, bottom = options.radiusBottom ?? 0.5;
    if (!(top >= 0) || !(bottom >= 0) || (top === 0 && bottom === 0) || !Number.isFinite(top + bottom)) throw new World3DError('WORLD3D_INPUT_INVALID', 'radius');
    const height = requirePositive3D(options.height ?? 1, 'height');
    const rs = segments(options.radialSegments, 32, 3, 'radialSegments'), hs = segments(options.heightSegments, 1, 1, 'heightSegments');
    const builder = new Builder();
    const slope = (bottom - top) / height;
    for (let iy = 0; iy <= hs; iy++) {
        const v = iy / hs, radius = top + (bottom - top) * v, y = (0.5 - v) * height;
        for (let ix = 0; ix <= rs; ix++) {
            const u = ix / rs, theta = u * Math.PI * 2, sin = Math.sin(theta), cos = Math.cos(theta);
            const length = Math.hypot(1, slope);
            builder.vertex(radius * sin, y, radius * cos, sin / length, slope / length, cos / length, u, 1 - v);
        }
    }
    builder.grid(0, rs, hs);
    if (!options.openEnded) {
        const cap = (radius: number, y: number, normalY: number): void => {
            if (radius === 0) return;
            const center = builder.vertexCount;
            builder.vertex(0, y, 0, 0, normalY, 0, 0.5, 0.5);
            for (let ix = 0; ix <= rs; ix++) {
                const theta = ix / rs * Math.PI * 2, sin = Math.sin(theta), cos = Math.cos(theta);
                builder.vertex(radius * sin, y, radius * cos, 0, normalY, 0, sin * 0.5 + 0.5, cos * 0.5 * normalY + 0.5);
            }
            for (let ix = 0; ix < rs; ix++) {
                const a = center + 1 + ix, b = a + 1;
                if (normalY > 0) builder.indices.push(center, a, b); else builder.indices.push(center, b, a);
            }
        };
        cap(top, height / 2, 1);
        cap(bottom, -height / 2, -1);
    }
    return builder.build();
}
export function createConeGeometry3D(options: {readonly radius?: number; readonly height?: number; readonly radialSegments?: number} = {}): Geometry3D {
    return createCylinderGeometry3D({
        radiusTop: 0, radiusBottom: options.radius ?? 0.5, height: options.height ?? 1,
        ...(options.radialSegments === undefined ? {} : {radialSegments: options.radialSegments}),
    });
}

export interface TorusGeometryOptions3D {
    readonly radius?: number; readonly tube?: number; readonly radialSegments?: number; readonly tubularSegments?: number;
}
/** Torus around the Z axis. */
export function createTorusGeometry3D(options: TorusGeometryOptions3D = {}): Geometry3D {
    const radius = requirePositive3D(options.radius ?? 0.5, 'radius'), tube = requirePositive3D(options.tube ?? 0.2, 'tube');
    const rs = segments(options.radialSegments, 16, 3, 'radialSegments'), ts = segments(options.tubularSegments, 48, 3, 'tubularSegments');
    const builder = new Builder();
    for (let j = 0; j <= rs; j++) {
        const v = j / rs * Math.PI * 2, cosV = Math.cos(v), sinV = Math.sin(v);
        for (let i = 0; i <= ts; i++) {
            const u = i / ts * Math.PI * 2, cosU = Math.cos(u), sinU = Math.sin(u);
            builder.vertex((radius + tube * cosV) * cosU, (radius + tube * cosV) * sinU, tube * sinV, cosV * cosU, cosV * sinU, sinV, i / ts, j / rs);
        }
    }
    builder.grid(0, ts, rs, true);
    return builder.build();
}

export interface CapsuleGeometryOptions3D {
    readonly radius?: number; readonly height?: number; readonly capSegments?: number; readonly radialSegments?: number;
}
/** Capsule along Y; `height` is the length of the cylindrical middle section. */
export function createCapsuleGeometry3D(options: CapsuleGeometryOptions3D = {}): Geometry3D {
    const radius = requirePositive3D(options.radius ?? 0.5, 'radius'), height = requirePositive3D(options.height ?? 1, 'height');
    const cs = segments(options.capSegments, 8, 1, 'capSegments'), rs = segments(options.radialSegments, 24, 3, 'radialSegments');
    const builder = new Builder();
    const rows = cs * 2 + 1, total = Math.PI * radius + height;
    for (let iy = 0; iy <= rows; iy++) {
        // Rows 0..cs sweep the top hemisphere, the rest sweep the bottom one.
        const upper = iy <= cs, ring = upper ? iy : iy - 1, phi = ring / (cs * 2) * Math.PI;
        const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), offset = upper ? height / 2 : -height / 2;
        const arc = phi * radius + (upper ? 0 : height);
        for (let ix = 0; ix <= rs; ix++) {
            const u = ix / rs, theta = u * Math.PI * 2;
            const nx = -Math.cos(theta) * sinPhi, nz = Math.sin(theta) * sinPhi;
            builder.vertex(nx * radius, cosPhi * radius + offset, nz * radius, nx, cosPhi, nz, u, 1 - arc / total);
        }
    }
    builder.grid(0, rs, rows);
    return builder.build();
}

/** Unit quad in XY used by sprites: corners at +-0.5, facing +Z. */
export function createQuadGeometry3D(): Geometry3D {
    return createPlaneGeometry3D({width: 1, height: 1});
}
