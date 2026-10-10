import {
  createTexturedWebGPUHost, createWebGPUHost,
  type TexturedWebGPUHost, type TexturedWebGPUHostOptions,
  type TexturedWebGPUHostStatus, type WebGPUHost, type WebGPUHostOptions,
  type WebGPUHostStatus, type WebGPUHostFailure,
} from '@egret/engine/webgpu';
import {
  TEXTURED_FRAME_PROFILE_2D,
  type TexturedFrameProfile2D, type TexturedRenderFrame2D,
  type TexturedRenderHostAdapter, type RenderHostAdapter,
} from '@egret/engine';
// This existing type-only bridge resolves the Engine's single opaque frame brand.
import type { ContractsProfileFrame, ContractsProfileHost } from '../../packages/engine/tests/profile-contract-types.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type ReadonlyKeys<T> = { [K in keyof T]-?: Equal<Pick<T, K>, Mutable<Pick<T, K>>> extends true ? never : K }[keyof T];
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];
type NewKeys = Exclude<keyof TexturedWebGPUHostOptions, keyof WebGPUHostOptions>;
type ExpectedKeys = 'maxSourceTriangles' | 'maxFrameGeometryBytes' | 'maxPendingGeometryBytes' | 'maxTupleComparisons';
type NewOptions = Pick<TexturedWebGPUHostOptions, NewKeys>;
type ExpectedOptions = {
  readonly maxSourceTriangles?: number;
  readonly maxFrameGeometryBytes?: number;
  readonly maxPendingGeometryBytes?: number;
  readonly maxTupleComparisons?: number;
};
type ExactKeys = Assert<Equal<NewKeys, ExpectedKeys>>;
type ExactNewOptions = Assert<Equal<NewOptions, ExpectedOptions>>;
type AllNewOptional = Assert<Equal<OptionalKeys<NewOptions>, ExpectedKeys>>;
type AllNewReadonly = Assert<Equal<ReadonlyKeys<NewOptions>, ExpectedKeys>>;
type UnchangedBase = Assert<Equal<Pick<TexturedWebGPUHostOptions, keyof WebGPUHostOptions>, WebGPUHostOptions>>;
type OptionsExtendOld = Assert<TexturedWebGPUHostOptions extends WebGPUHostOptions ? true : false>;
type ExactFactory = Assert<Equal<typeof createTexturedWebGPUHost, (options: TexturedWebGPUHostOptions) => TexturedWebGPUHost>>;
type OldFactory = Assert<Equal<typeof createWebGPUHost, (options: WebGPUHostOptions) => WebGPUHost>>;
type ExactSyncPort = Assert<Equal<TexturedWebGPUHost['renderTexturedFrame'], (frame: TexturedRenderFrame2D) => undefined>>;
type ExactAdvertisement = Assert<Equal<TexturedWebGPUHost['texturedFrameProfile'], 'egret.textured-frame2d/1'>>;
type ReadonlyAdvertisement = Assert<Equal<ReadonlyKeys<Pick<TexturedWebGPUHost, 'texturedFrameProfile'>>, 'texturedFrameProfile'>>;
type LiteralIdentity = Assert<Equal<TexturedFrameProfile2D, typeof TEXTURED_FRAME_PROFILE_2D>>;
type BridgeFrame = Assert<Equal<TexturedRenderFrame2D, ContractsProfileFrame>>;
type BridgeHost = Assert<Equal<TexturedRenderHostAdapter, ContractsProfileHost>>;
type ExactStatusMethod = Assert<Equal<TexturedWebGPUHost['getTexturedStatus'], () => TexturedWebGPUHostStatus>>;
type ExactStatus = Assert<Equal<TexturedWebGPUHostStatus, {
  readonly host: WebGPUHostStatus;
  readonly pendingGeometryBytes: number;
}>>;
type ExactStatusReadonly = Assert<Equal<ReadonlyKeys<TexturedWebGPUHostStatus>, 'host' | 'pendingGeometryBytes'>>;
type NestedStatusReadonly = Assert<Equal<ReadonlyKeys<TexturedWebGPUHostStatus['host']>, keyof WebGPUHostStatus>>;
type OldStatus = Assert<Equal<WebGPUHostStatus, {
  readonly state: 'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
  readonly lastSerial: number;
  readonly pendingFrames: number;
  readonly pendingUploadBytes: number;
  readonly pendingReadbackBytes: number;
  readonly firstFailure: WebGPUHostFailure | null;
  readonly callbackFailureCount: number;
  readonly lastCallbackFailure: WebGPUHostFailure | null;
  readonly cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe';
}>>;

declare const canvas: HTMLCanvasElement;
declare const gpuDevice: GPUDevice;
const device = { kind: 'borrow', device: gpuDevice } as const;
declare const frame: TexturedRenderFrame2D;
const options: TexturedWebGPUHostOptions = { canvas, device, maxSourceTriangles: 1, maxFrameGeometryBytes: 204, maxPendingGeometryBytes: 408, maxTupleComparisons: 64 };
const host: TexturedWebGPUHost = createTexturedWebGPUHost(options);
const old: WebGPUHost = createWebGPUHost({ canvas, device });
const legacyPort: RenderHostAdapter = host;
const texturedPort: TexturedRenderHostAdapter = host;
const result: undefined = host.renderTexturedFrame(frame);
const status: TexturedWebGPUHostStatus = host.getTexturedStatus();
const inherited: WebGPUHostStatus = host.getStatus();
const nested: WebGPUHostStatus = status.host;
void [old, legacyPort, texturedPort, result, inherited, nested];
export type {
  ExactKeys, ExactNewOptions, AllNewOptional, AllNewReadonly, UnchangedBase,
  OptionsExtendOld, ExactFactory, OldFactory, ExactSyncPort, ExactAdvertisement,
  ReadonlyAdvertisement, LiteralIdentity, BridgeFrame, BridgeHost, ExactStatusMethod, ExactStatus,
  ExactStatusReadonly, NestedStatusReadonly, OldStatus,
};
