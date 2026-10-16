// SPDX-License-Identifier: Apache-2.0
// Main loads this optional composition only for the textured-scene profile.
import { Bitmap, Mesh2D, EgretError, createTexturedGeometry2D, TEXTURED_FRAME_PROFILE_2D } from '@egret/engine';
import { createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
export { createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PROJECTION = Object.freeze({ kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9 });
const INDICES = Object.freeze([0, 1, 2, 0, 2, 3]);
const RED = Object.freeze([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
const BLUE = Object.freeze([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

function quad(extent, z, colors) {
  return createMeshGeometry3D({
    positions: [-extent, extent, z, extent, extent, z, extent, -extent, z, -extent, -extent, z],
    colors, indices: INDICES,
  });
}

function sceneFor(first, second) {
  return createSceneFrame3D({ projection: PROJECTION, draws: [
    { geometry: first, modelView: IDENTITY }, { geometry: second, modelView: IDENTITY },
  ] });
}

/** Compose after session.ready, before input or presentation work is admitted. */
export function createResourceSceneGPU({ session }) {
  if (session?.inspect?.()?.state !== 'ready') throw new EgretError('RESOURCE_SCENE_GPU_NOT_READY');
  const { engine, badgeLease, badge: ordinary } = session.scene;
  if (engine.texturedFrameProfile !== TEXTURED_FRAME_PROFILE_2D) {
    throw new EgretError('RESOURCE_SCENE_GPU_PROFILE_REQUIRED');
  }
  if (!(ordinary instanceof Bitmap) || ordinary.isDisposed || ordinary.parent !== engine.stage
      || ordinary.textureLease !== badgeLease) throw new EgretError('RESOURCE_SCENE_GPU_BADGE_REQUIRED');
  const index = engine.stage.getChildIndex(ordinary);

  const red = quad(0.5, -3, RED), blue = quad(0.75, -7, BLUE);
  const scene = sceneFor(red, blue), sceneWithReversedDrawOrder = sceneFor(blue, red);
  const sceneWithWrongDepth = sceneFor(quad(0.5, -7, RED), quad(0.75, -3, BLUE));
  const geometry = createTexturedGeometry2D({
    positions: new Float32Array([0, 0, 16, 0, 16, 8, 0, 8]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    lightColors: new Float32Array(16).fill(1), indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  // The session retains the exact lease; this scope owns only the new leaf.
  const badge = new Mesh2D(badgeLease, geometry);
  let badgeScope;
  try {
    badgeScope = engine.createScope(); badgeScope.use(badge);
    badge.x = 8; badge.y = 8;
    // Insert before detaching the old leaf, retaining its original painter index.
    engine.stage.addChildAt(badge, index);
    engine.stage.removeChild(ordinary); ordinary.dispose();
    return Object.freeze({ scene, badge, sceneWithReversedDrawOrder, sceneWithWrongDepth });
  } catch (cause) {
    const cleanupErrors = [];
    try { badgeScope?.dispose(); } catch (error) { cleanupErrors.push(error); }
    try { badge.dispose(); } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length !== 0) throw new EgretError('RESOURCE_SCENE_GPU_COMPOSITION_FAILED', { cause, cleanupErrors });
    throw cause;
  }
}
