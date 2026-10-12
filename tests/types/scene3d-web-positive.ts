import { createEngine } from '@egret/engine';
import type { RenderFrame2D } from '@egret/engine';
import { createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
import { createSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';
import type { SceneWebGPUHost, SceneWebGPUHostOptions, SceneWebGPUHostStatus } from '@egret/engine/webgpu/scene3d';
import type { WebGPUHost, WebGPUHostOptions, WebGPUHostStatus } from '@egret/engine/webgpu';
declare const canvas: HTMLCanvasElement;
declare const device: GPUDevice;
const options: SceneWebGPUHostOptions = {canvas,device:{kind:'borrow',device},enableReadback:true};
const baseOptions: WebGPUHostOptions = options;
const host: SceneWebGPUHost = createSceneWebGPUHost(options);
const base: WebGPUHost = host;
const status: SceneWebGPUHostStatus = host.getSceneStatus();
const nested: WebGPUHostStatus = status.host;
const scene = createSceneFrame3D({projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:0,far:2},draws:[{geometry:createMeshGeometry3D({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]}),modelView:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}]});
declare const overlay: RenderFrame2D;
const result: undefined = host.renderSceneFrame(scene,overlay);
const started: Promise<void> = host.start();
const idle: Promise<void> = host.whenIdle();
const engine = createEngine({host});
void engine; void started; void idle; void result; void base; void baseOptions; void nested;

// Combined-host consumer: original prefix above stays byte exact.
import { createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';
import type { TexturedSceneWebGPUHost, TexturedWebGPUHostOptions as CombinedRouteOptions } from '@egret/engine/webgpu/scene3d';
import type { TexturedWebGPUHost, TexturedWebGPUHostOptions as CanonicalTexturedOptions, TexturedWebGPUHostStatus } from '@egret/engine/webgpu';
import {
  createEngineForProfile, TEXTURED_FRAME_PROFILE_2D, createImageData2D,
  createTexture, createAssetType, createAssetRef, isTexture, createTexturedGeometry2D, Mesh2D,
} from '@egret/engine';
import type { RenderHostAdapter, TexturedRenderHostAdapter, TexturedRenderFrame2D } from '@egret/engine';
import type { SceneFrame3D } from '@egret/engine/scene3d';

type CombinedEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type CombinedAssert<T extends true> = T;
type CombinedExactOptions = CombinedAssert<CombinedEqual<CombinedRouteOptions, CanonicalTexturedOptions>>;
type CombinedExactFactory = CombinedAssert<CombinedEqual<typeof createTexturedSceneWebGPUHost, (options: CombinedRouteOptions) => TexturedSceneWebGPUHost>>;
type CombinedExactPort = CombinedAssert<CombinedEqual<TexturedSceneWebGPUHost['renderSceneTexturedFrame'], (scene: SceneFrame3D, overlay: TexturedRenderFrame2D) => undefined>>;

const combinedOptions: CombinedRouteOptions = {canvas,device:{kind:'borrow',device},enableReadback:true,maxFrameGeometryBytes:204,maxPendingGeometryBytes:408};
const combinedHost: TexturedSceneWebGPUHost = createTexturedSceneWebGPUHost(combinedOptions);
const combinedSceneHost: SceneWebGPUHost = combinedHost;
const combinedTexturedHost: TexturedWebGPUHost = combinedHost;
const combinedLegacyPort: RenderHostAdapter = combinedHost;
const combinedProfilePort: TexturedRenderHostAdapter = combinedHost;
const combinedSceneStatus: SceneWebGPUHostStatus = combinedHost.getSceneStatus();
const combinedTextureStatus: TexturedWebGPUHostStatus = combinedHost.getTexturedStatus();
const combinedBaseStatus: WebGPUHostStatus = combinedHost.getStatus();
const combinedCanonicalOptions: CanonicalTexturedOptions = combinedOptions;

async function consumeCombinedPublicHost(): Promise<void> {
  const combinedEngine = await createEngineForProfile({host:combinedHost},TEXTURED_FRAME_PROFILE_2D);
  const combinedType = createAssetType('combined-public-type-consumer',isTexture);
  const combinedRef = createAssetRef(combinedType,'one');
  const combinedTexture = createTexture(createImageData2D({width:1,height:1,pixels:new Uint8Array([255,0,0,255])}));
  combinedEngine.assets.register(combinedType,{load:async()=>combinedTexture,dispose:value=>value.dispose()});
  const combinedLease = await combinedEngine.assets.acquire(combinedRef);
  const combinedGeometry = createTexturedGeometry2D({positions:new Float64Array([1,1,5,1,1,5]),uvs:new Float64Array(6).fill(.5),lightColors:new Float64Array(12).fill(1),indices:new Uint32Array([0,1,2])});
  const combinedMesh = new Mesh2D(combinedLease,combinedGeometry);
  combinedEngine.stage.addChild(combinedMesh);
  const combinedOverlay: TexturedRenderFrame2D = combinedEngine.captureTexturedFrame({width:8,height:8,clearAlpha:1});
  const combinedTicket = combinedHost.requestReadback();
  const combinedResult: undefined = combinedHost.renderSceneTexturedFrame(scene,combinedOverlay);
  const combinedIdle: Promise<void> = combinedHost.whenIdle();
  const combinedPixels = await combinedTicket;
  const combinedBytes: Uint8Array = combinedPixels.bytes;
  void [combinedResult,combinedIdle,combinedBytes];
  await combinedIdle;
  combinedMesh.dispose(); combinedLease.release(); await combinedEngine.dispose();
}
void [combinedSceneHost,combinedTexturedHost,combinedLegacyPort,combinedProfilePort,combinedSceneStatus,combinedTextureStatus,combinedBaseStatus,combinedCanonicalOptions,consumeCombinedPublicHost];
export type {CombinedExactOptions,CombinedExactFactory,CombinedExactPort};
