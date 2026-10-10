// First-party Apache-2.0 prospective Task3 fixtures. No product imports.
export const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
export const FRAME_OPTIONS = Object.freeze({ pixelRatio: 1, maxBackingPixels: 16777216,
  maxCommands: 65536, maxClipRectangles: 262144, maxSourceTriangles: 65536,
  maxFrameGeometryBytes: 16777216 });
export const PREPARATION_OPTIONS = Object.freeze({ pixelRatio: 1,
  maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304 });
export const LEDGER_LIMITS = Object.freeze({ maxSourceTriangles: 65536,
  maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxTupleComparisons: 1048576 });
export const STORAGE_OPTIONS = Object.freeze({ maxUploadBytes: 33554432,
  maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864,
  maxPendingGeometryBytes: 33554432 });
export const HARDWARE = Object.freeze({ maxBufferSize: 33554432, maxTextureDimension2D: 4096 });
export const OWNER = Object.freeze({ pendingFrames: 0, pendingUploadBytes: 0,
  pendingReadbackBytes: 0, pendingTextureBytes: 0, pendingGeometryBytes: 0, serial: 0 });
export const ZERO_COUNTERS = Object.freeze({ authoredDegenerateTriangles: 0,
  singularSuppressedTriangles: 0, transformedCollapsedTriangles: 0,
  clippedCollapsedTriangles: 0, packedCollapsedTriangles: 0 });
export const ORACLE = Object.freeze({ triangleGeometryBytes: 204,
  meshTriangleVertexBytes: 96, meshTriangleUploadBytes: 112,
  twoTrianglesOneCommandUploadBytes: 208, twoMeshCommandsUploadBytes: 224,
  mixedQuadQuadTriangleUploadBytes: 368,
  rowPitch8: 256, staging8: 2048, output8: 256, totalReadback8: 2304,
  geometryCap: 128, imageCap: 64, viewCap: 128,
  textureCap: 33554432, geometryTableCap: 16777216 });

// Private trusted structural records: deliberately NOT registered/authentic frames.
export function unitFrame(overrides = {}) {
  return Object.freeze({ profile: 'egret.textured-frame2d/1', frameId: 1,
    width: 8, height: 8, clearColor: 0, clearAlpha: 0,
    commands: Object.freeze([]), images: Object.freeze([]), geometries: Object.freeze([]), ...overrides });
}
export function meshCommand(overrides = {}) {
  return Object.freeze({ kind: 'mesh', matrix: IDENTITY, alpha: 1,
    clips: Object.freeze([]), imageIndex: 0,
    sourceRect: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }), geometryIndex: 0, ...overrides });
}
export function rectCommand(overrides = {}) {
  return Object.freeze({ kind: 'rect', matrix: IDENTITY, alpha: 1,
    clips: Object.freeze([]), color: 0x112233,
    rect: Object.freeze({ x: 2, y: 2, width: 4, height: 4 }), ...overrides });
}
export function imageCommand(overrides = {}) {
  return Object.freeze({ kind: 'image', matrix: IDENTITY, alpha: 1,
    clips: Object.freeze([]), imageIndex: 0,
    sourceRect: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
    rect: Object.freeze({ x: 2, y: 2, width: 4, height: 4 }), ...overrides });
}

// Length/index poison is reachable only through the private trusted helper seam.
// It cannot pass a public port's owned-frame lookup. No identity/brand is forged.
export function lengthUnit(length, label, log = []) {
  return new Proxy([], { get(_target, key) {
    if (key === 'length') { log.push(label + '.length'); return length; }
    if (key === Symbol.iterator) throw new Error(label + ': iterator must not be used');
    log.push(label + '[' + String(key) + ']');
    throw new Error(label + ': index poison');
  } });
}
