// SPDX-License-Identifier: Apache-2.0
// A model made from a distance field in a few levels of detail: the full mesh near the camera and simpler ones further
// off, each simplified from the one before, so a scene of many models draws far fewer triangles. The levels share
// one material and switch as the camera moves, through Lod3D.
import { World3DError } from './core3D.js';
import { Lod3D } from './helpers3D.js';
import { createStandardMaterial3D, type Material3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import { createSdfGeometry3D, SdfShape3D, type SdfMeshOptions3D } from './Sdf3D.js';
import { simplifyGeometry3D } from './Simplify3D.js';

/** How a model is made in levels: the mesh options, its material, and each level's triangles and distance. */
export interface SdfLodOptions3D extends SdfMeshOptions3D {
  /**
   * Each level as [triangles, distance]: shown once the camera is at least that far. The first is the full model and
   * its distance is 0. Unless given: the model's `triangles` (8000) up close, a quarter of them beyond 12 times the
   * model's size, and a sixteenth beyond 30 times.
   */
  readonly levels?: readonly (readonly [triangles: number, distance: number])[];
  /** The material of every level; a standard one with vertex colours unless given. */
  readonly material?: Material3D;
}

function invalid(what: string): World3DError {
  return new World3DError('WORLD3D_INPUT_INVALID', what);
}

/** The model in levels of detail, as a Lod3D whose children are the meshes of the levels, nearest first. */
export function createSdfLod3D(shape: SdfShape3D, options: SdfLodOptions3D = {}): Lod3D {
  if (!(shape instanceof SdfShape3D)) throw invalid('lod shape');
  if (options === null || typeof options !== 'object') throw invalid('lod options');
  const b = shape.bounds,
    size = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  const top = options.triangles === undefined || options.triangles === 0 ? 8000 : options.triangles;
  const levels =
    options.levels ??
    ([
      [top, 0],
      [Math.max(64, Math.round(top / 4)), size * 12],
      [Math.max(32, Math.round(top / 16)), size * 30]
    ] as const);
  if (!Array.isArray(levels) || levels.length === 0 || levels.length > 8) throw invalid('lod levels');
  let last = Infinity,
    lastDistance = -1;
  for (const level of levels) {
    if (!Array.isArray(level) || level.length !== 2) throw invalid('lod level');
    const [triangles, distance] = level;
    if (!Number.isInteger(triangles) || triangles <= 0 || triangles >= last) throw invalid('lod level triangles');
    if (typeof distance !== 'number' || !(distance > lastDistance) || !Number.isFinite(distance))
      throw invalid('lod level distance');
    last = triangles;
    lastDistance = distance;
  }
  if (levels[0]![1] !== 0) throw invalid('lod level distance');
  const material = options.material ?? createStandardMaterial3D({ vertexColors: true, roughness: 0.75 });
  const lod = new Lod3D();
  let geometry = createSdfGeometry3D(shape, { ...options, triangles: levels[0]![0] });
  levels.forEach(([triangles, distance], i) => {
    if (i > 0) geometry = simplifyGeometry3D(geometry, { triangles }).geometry;
    const mesh = new Mesh3D(geometry, material);
    mesh.name = 'lod' + i;
    lod.addLevel(mesh, distance);
  });
  return lod;
}
