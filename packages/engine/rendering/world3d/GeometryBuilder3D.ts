// SPDX-License-Identifier: Apache-2.0
// Puts many placed, coloured parts into one geometry: models made in code (a
// truck from boxes, a soldier from tapered limbs) and static scenery that
// should draw in one call. Each part is a copy of a geometry moved by a
// position, rotation and scale or by a matrix, with one colour written into the
// vertex colours. Colours are given the way they look on screen and stored as
// the linear values the renderer lights.
import { World3DError } from './core3D.js';
import { Attribute3D, Geometry3D } from './Geometry3D.js';
import { colorFromHex, mat3NormalFromMat4, mat4Compose, quatFromEuler, srgbToLinear } from './math3D.js';
import type { ColorInput3D } from './Material3D.js';

/** One geometry added to a builder: where, turned and scaled how, and its color. */
export interface GeometryPart3D {
  /** Where the part goes; [0, 0, 0] by default. */
  readonly position?: readonly [number, number, number];
  /** Euler angles in radians, applied X then Y then Z, as `quatFromEuler`. Ignored when `quaternion` is given. */
  readonly rotation?: readonly [number, number, number];
  readonly quaternion?: readonly [number, number, number, number];
  /** One number for all three axes, or one per axis. */
  readonly scale?: number | readonly [number, number, number];
  /** A 4 x 4 column-major matrix that places the part, instead of position, rotation and scale. */
  readonly matrix?: ArrayLike<number>;
  /** A hex colour as seen on screen, or linear RGB; white by default. */
  readonly color?: ColorInput3D;
  /** Multiplies each vertex colour already in the part, as for shading baked into it. */
  readonly keepColors?: boolean;
}

/** Joins many geometries, each placed, into one. */
export interface GeometryBuilder3D {
  /** Parts added so far. */
  readonly parts: number;
  /** Vertices added so far. */
  readonly vertexCount: number;
  /** Adds a placed, coloured copy of `geometry`; the geometry itself is not changed. */
  add(geometry: Geometry3D, part?: GeometryPart3D): this;
  /** One geometry with position, normal, uv (when every part has one) and colour; the builder is emptied. */
  build(): Geometry3D;
}

interface Piece {
  positions: Float32Array;
  normals: Float32Array | undefined;
  uvs: Float32Array | undefined;
  colors: Float32Array;
  indices: Uint32Array;
}

const UP_LIMIT = 4294967295;

function color3(input: ColorInput3D | undefined): Float32Array {
  const out = new Float32Array([1, 1, 1]);
  if (input === undefined) return out;
  if (typeof input === 'number') return colorFromHex(out, input) as Float32Array;
  if (Array.isArray(input) && input.length === 3 && input.every(Number.isFinite)) {
    out.set(input);
    return out;
  }
  throw new World3DError('WORLD3D_INPUT_INVALID', 'part color');
}

function triple(value: unknown, fallback: number, what: string): [number, number, number] {
  if (value === undefined) return [fallback, fallback, fallback];
  if (typeof value === 'number' && Number.isFinite(value)) return [value, value, value];
  if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite))
    return value as [number, number, number];
  throw new World3DError('WORLD3D_INPUT_INVALID', what);
}

function placement(part: GeometryPart3D): Float32Array {
  const m = new Float32Array(16);
  if (part.matrix !== undefined) {
    if (!part.matrix || part.matrix.length !== 16 || !Array.from(part.matrix).every(Number.isFinite))
      throw new World3DError('WORLD3D_INPUT_INVALID', 'part matrix');
    m.set(Array.from(part.matrix));
    return m;
  }
  const t = triple(part.position, 0, 'part position');
  const s = triple(part.scale, 1, 'part scale');
  let q: ArrayLike<number>;
  if (part.quaternion !== undefined) {
    if (!Array.isArray(part.quaternion) || part.quaternion.length !== 4 || !part.quaternion.every(Number.isFinite))
      throw new World3DError('WORLD3D_INPUT_INVALID', 'part quaternion');
    q = part.quaternion;
  } else {
    const r = triple(part.rotation, 0, 'part rotation');
    q = quatFromEuler(new Float32Array(4), r[0], r[1], r[2]);
  }
  return mat4Compose(m, t, q, s) as Float32Array;
}

/** A builder that merges placed, coloured parts into one geometry. */
export function createGeometryBuilder3D(): GeometryBuilder3D {
  let pieces: Piece[] = [],
    vertices = 0;
  const builder: GeometryBuilder3D = {
    get parts() {
      return pieces.length;
    },
    get vertexCount() {
      return vertices;
    },
    add(geometry: Geometry3D, part: GeometryPart3D = {}): GeometryBuilder3D {
      if (!(geometry instanceof Geometry3D) || geometry.isDisposed)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry');
      if (geometry.topology !== 'triangles') throw new World3DError('WORLD3D_INPUT_INVALID', 'part topology');
      if (typeof part !== 'object' || part === null) throw new World3DError('WORLD3D_INPUT_INVALID', 'part');
      const position = geometry.getAttribute('position');
      if (!position || position.itemSize !== 3) throw new World3DError('WORLD3D_INPUT_INVALID', 'part position data');
      const count = position.count;
      if (vertices + count > UP_LIMIT) throw new World3DError('WORLD3D_BUDGET', 'vertices');
      const m = placement(part);
      const n = mat3NormalFromMat4(new Float32Array(9), m);
      const tint = color3(part.color);
      const src = position.data;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const x = src[i * 3]!,
          y = src[i * 3 + 1]!,
          z = src[i * 3 + 2]!;
        positions[i * 3] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
        positions[i * 3 + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
        positions[i * 3 + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
      }
      let normals: Float32Array | undefined;
      const normal = geometry.getAttribute('normal');
      if (normal && normal.itemSize === 3) {
        normals = new Float32Array(count * 3);
        const d = normal.data;
        for (let i = 0; i < count; i++) {
          const x = d[i * 3]!,
            y = d[i * 3 + 1]!,
            z = d[i * 3 + 2]!;
          const nx = n[0]! * x + n[3]! * y + n[6]! * z,
            ny = n[1]! * x + n[4]! * y + n[7]! * z,
            nz = n[2]! * x + n[5]! * y + n[8]! * z;
          const length = Math.hypot(nx, ny, nz) || 1;
          normals[i * 3] = nx / length;
          normals[i * 3 + 1] = ny / length;
          normals[i * 3 + 2] = nz / length;
        }
      }
      let uvs: Float32Array | undefined;
      const uv = geometry.getAttribute('uv');
      if (uv && uv.itemSize === 2) uvs = Float32Array.from(uv.data as ArrayLike<number>);
      const colors = new Float32Array(count * 3);
      const own = part.keepColors ? geometry.getAttribute('color') : undefined;
      for (let i = 0; i < count; i++)
        for (let c = 0; c < 3; c++)
          colors[i * 3 + c] = tint[c]! * (own ? (own.data[i * own.itemSize + c] as number) : 1);
      // A mirrored placement turns triangles inside out; their winding is flipped back.
      const det =
        m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) -
        m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) +
        m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!);
      const index = geometry.index;
      const indices = index
        ? Uint32Array.from(index.data as ArrayLike<number>)
        : Uint32Array.from({ length: count }, (_, i) => i);
      if (det < 0)
        for (let i = 0; i + 2 < indices.length; i += 3) {
          const a = indices[i + 1]!;
          indices[i + 1] = indices[i + 2]!;
          indices[i + 2] = a;
        }
      pieces.push({ positions, normals, uvs, colors, indices });
      vertices += count;
      return builder;
    },
    build(): Geometry3D {
      if (pieces.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'no parts');
      const withNormals = pieces.every(piece => piece.normals),
        withUvs = pieces.every(piece => piece.uvs);
      const indexTotal = pieces.reduce((sum, piece) => sum + piece.indices.length, 0);
      const positions = new Float32Array(vertices * 3),
        colors = new Float32Array(vertices * 3),
        normals = withNormals ? new Float32Array(vertices * 3) : undefined,
        uvs = withUvs ? new Float32Array(vertices * 2) : undefined,
        indices = vertices > 65535 ? new Uint32Array(indexTotal) : new Uint16Array(indexTotal);
      let v = 0,
        k = 0;
      for (const piece of pieces) {
        positions.set(piece.positions, v * 3);
        colors.set(piece.colors, v * 3);
        if (normals) normals.set(piece.normals!, v * 3);
        if (uvs) uvs.set(piece.uvs!, v * 2);
        for (let i = 0; i < piece.indices.length; i++) indices[k + i] = piece.indices[i]! + v;
        v += piece.positions.length / 3;
        k += piece.indices.length;
      }
      const geometry = new Geometry3D();
      geometry.setAttribute('position', new Attribute3D(positions, 3));
      if (normals) geometry.setAttribute('normal', new Attribute3D(normals, 3));
      if (uvs) geometry.setAttribute('uv', new Attribute3D(uvs, 2));
      geometry.setAttribute('color', new Attribute3D(colors, 3));
      geometry.setIndex(indices);
      if (!normals) geometry.computeNormals();
      pieces = [];
      vertices = 0;
      return geometry;
    }
  };
  return builder;
}

/** A hex colour as seen on screen in the linear RGB the renderer lights, for vertex colours written by hand. */
export function linearColor3D(hex: number): [number, number, number] {
  if (!Number.isInteger(hex) || hex < 0 || hex > 0xffffff) throw new World3DError('WORLD3D_INPUT_INVALID', 'hex');
  return [
    srgbToLinear(((hex >> 16) & 255) / 255),
    srgbToLinear(((hex >> 8) & 255) / 255),
    srgbToLinear((hex & 255) / 255)
  ];
}

/** Where a world point falls in a viewport, for labels, markers and pointers drawn over the picture. */
export interface ViewportPoint3D {
  /** Pixels from the viewport's left and top edges. */
  x: number;
  y: number;
  /** Normalized depth, -1 at the near plane and 1 at the far plane. */
  depth: number;
  /** False when the point is behind the camera; x and y then point the way it lies, mirrored back. */
  inFront: boolean;
  /** True when the point is in front of the camera and inside the viewport. */
  onScreen: boolean;
}

/**
 * Projects a world point into a viewport of `width` by `height` pixels through `camera`. Call
 * `camera.updateViewMatrices()` first, or use it after the frame was drawn.
 */
export function projectToViewport3D(
  camera: { readonly viewProjectionMatrix: ArrayLike<number> },
  point: ArrayLike<number>,
  width: number,
  height: number,
  out: ViewportPoint3D = { x: 0, y: 0, depth: 0, inFront: false, onScreen: false }
): ViewportPoint3D {
  if (!camera?.viewProjectionMatrix || !(width > 0) || !(height > 0))
    throw new World3DError('WORLD3D_INPUT_INVALID', 'viewport');
  const m = camera.viewProjectionMatrix,
    x = point[0]!,
    y = point[1]!,
    z = point[2]!;
  const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    cz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
    cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  const inFront = cw > 1e-6;
  // Behind the camera the division flips the point; dividing by |w| keeps it on the side where it lies.
  const w = Math.abs(cw) > 1e-6 ? Math.abs(cw) : 1e-6;
  const nx = cx / w,
    ny = cy / w;
  out.x = (nx * 0.5 + 0.5) * width;
  out.y = (0.5 - ny * 0.5) * height;
  out.depth = cz / w;
  out.inFront = inFront;
  out.onScreen = inFront && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1 && out.depth <= 1;
  return out;
}
