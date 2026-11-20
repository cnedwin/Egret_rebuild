// SPDX-License-Identifier: Apache-2.0
// Explicit WebGPU entry for the world3d scene graph. It shares the orbit
// controls, browser loaders and Engine clock binding with the WebGL2 entry
// and loads no WebGL2 module.
export { WebGPURenderer3D, createWebGPURenderer3D } from './WebGPURenderer3D.js';
export type { WebGPURenderer3DOptions } from './WebGPURenderer3D.js';
export type { Renderer3D, Renderer3DInfo, ToneMapping3D } from './frame3D.js';
export { OrbitControls3D, createOrbitControls3D } from './OrbitControls3D.js';
export type { OrbitControlsOptions3D } from './OrbitControls3D.js';
export { loadTexture3D, loadCubeTexture3D, loadGltfFromUrl3D } from './loaders3D.js';
export type { LoadOptions3D, TextureLoadOptions3D, GltfUrlLoadOptions3D } from './loaders3D.js';
export {
  GLTF_ASSET_3D,
  TEXTURE_ASSET_3D,
  CUBE_TEXTURE_ASSET_3D,
  SCENE_ASSET_3D,
  registerWorld3DAssets
} from './assets3D.js';
export type { World3DAssetOptions } from './assets3D.js';
export { World3DView, createWorld3DView } from './World3DView.js';
export type { World3DClockSource, World3DViewOptions } from './World3DView.js';
export { createWorld3DHost, startWorld3DLoop } from './host3D.js';
export type { World3DLoopSource } from './host3D.js';
export { POST3D_LIMITS, createPostProcessSettings3D, createCustomPost3D } from './post3D.js';
export type { PostProcessSettings3D, CustomPost3D } from './post3D.js';
export { FlyControls3D, createFlyControls3D } from './FlyControls3D.js';
export type { FlyControlsOptions3D, FlyControlsKeys3D } from './FlyControls3D.js';
export { AudioListener3D, PositionalAudio3D, createAudioListener3D, createPositionalAudio3D } from './Audio3D.js';
export type { AudioListenerOptions3D, PositionalAudioOptions3D } from './Audio3D.js';
export { captureCubeTexture3D } from './probe3D.js';
export type { CubeCaptureOptions3D } from './probe3D.js';
export { TransformControls3D, createTransformControls3D } from './TransformControls3D.js';
export { FollowControls3D, createFollowControls3D } from './FollowControls3D.js';
export type { FollowControlsOptions3D } from './FollowControls3D.js';
export { Atmosphere3D, createAtmosphere3D } from './atmosphere3D.js';
export type { AtmosphereOptions3D } from './atmosphere3D.js';
export { createCanvasFont3D } from './canvasFont3D.js';
export type { CanvasFontOptions3D } from './canvasFont3D.js';
export {
  WORLD3D_QUALITY_PRESETS,
  createDynamicResolution3D,
  createWorld3DApp,
  pickWorld3DBackend,
  pickWorld3DQuality,
  isSoftwareRendered3D
} from './app3D.js';
export type {
  DynamicResolution3D,
  DynamicResolutionOptions3D,
  World3DApp,
  World3DAppOptions,
  World3DBackend,
  World3DDeviceHints,
  World3DQuality,
  World3DQualityPreset,
  World3DShowOptions
} from './app3D.js';
export { createScreenMarkers3D } from './markers3D.js';
export type { ScreenMarker3D, ScreenMarkerOptions3D, ScreenMarkers3D, ScreenMarkersOptions3D } from './markers3D.js';
export { createWorld3DStats } from './stats3D.js';
export type { World3DStats, World3DStatsOptions } from './stats3D.js';
export { createWorld3DOverlay } from './overlay3D.js';
export type { World3DOverlay, World3DOverlayOptions } from './overlay3D.js';
