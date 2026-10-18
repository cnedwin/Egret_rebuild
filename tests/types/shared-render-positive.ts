// SPDX-License-Identifier: Apache-2.0
// Strict public consumers; negative statements intentionally retain real compiler errors.
import * as engineFacade from '@egret/engine';
import {
  Mesh2D, createSharedGeometry2D, createTexturedGeometry2D, createSharedMaterial2D,
  createTextureView, createEngineForProfile, SHARED_FRAME_PROFILE_2D,
  type AssetLease, type Texture, type Engine, type HostAdapter,
  type TexturedGeometry2D, type SharedGeometry2D, type SharedGeometryInput2D,
  type SharedMaterial2D, type SharedMaterialInput2D,
  type ImageData2D, type TextureViewRegionInput2D, type TextureViewRegion2D,
  type SharedFrameProfile2D, type SharedOutputAlpha2D, type SharedFrameOptions2D,
  type SharedRenderFrame2D, type SharedRenderHostAdapter,
  type RenderFrame2D, type TexturedRenderFrame2D,
} from '@egret/engine';
import {
  isSharedGeometry2D, isSharedMaterial2D,
  type SharedGeometry2D as ContractsGeometry,
  type SharedMaterial2D as ContractsMaterial,
  type SharedRenderFrame2D as ContractsFrame,
  type SharedRenderHostAdapter as ContractsHost,
} from '@egret/contracts';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
      ? true : false
    : false;
type Assert<T extends true> = T;

export type DefaultGetter = Assert<Equal<Mesh2D['geometry'], TexturedGeometry2D | undefined>>;
export type SharedGetter = Assert<Equal<Mesh2D<SharedGeometry2D>['geometry'], SharedGeometry2D | undefined>>;
export type DefaultReplacement = Assert<Equal<Parameters<Mesh2D['setContent']>[1], TexturedGeometry2D>>;
export type SharedReplacement = Assert<Equal<Parameters<Mesh2D<SharedGeometry2D>['setContent']>[1], SharedGeometry2D>>;
export type DefaultIsOldInstantiation = Assert<Equal<Mesh2D, Mesh2D<TexturedGeometry2D>>>;
export type OneGeometryDefinition = Assert<Equal<SharedGeometry2D, ContractsGeometry>>;
export type OneMaterialDefinition = Assert<Equal<SharedMaterial2D, ContractsMaterial>>;
export type OneFrameDefinition = Assert<Equal<SharedRenderFrame2D, ContractsFrame>>;
export type OneHostDefinition = Assert<Equal<SharedRenderHostAdapter, ContractsHost>>;
export type GuardsRemainOffEngine = Assert<Equal<
  Extract<keyof typeof engineFacade, 'isSharedGeometry2D' | 'isSharedMaterial2D'>, never
>>;
export type ExactProfile = Assert<Equal<SharedFrameProfile2D, typeof SHARED_FRAME_PROFILE_2D>>;
export type ExactOutputAlpha = Assert<Equal<SharedOutputAlpha2D, 'premultiplied' | 'opaque'>>;
export type ExactPort = Assert<Equal<SharedRenderHostAdapter['renderSharedFrame'],
  (frame: SharedRenderFrame2D) => undefined>>;
export type ExactAdvertisement = Assert<Equal<SharedRenderHostAdapter['sharedFrameProfile'], 'egret.shared-frame2d/1'>>;
export type ExactCapture = Assert<Equal<Engine['captureSharedFrame'],
  (options: SharedFrameOptions2D) => SharedRenderFrame2D>>;
export type ExactRender = Assert<Equal<Engine['renderSharedFrame'],
  (options: SharedFrameOptions2D) => SharedRenderFrame2D>>;
export type ExactOptions = Assert<Equal<SharedFrameOptions2D, {
  readonly width: number;
  readonly height: number;
  readonly clearColor?: number;
  readonly clearAlpha?: number;
  readonly outputAlpha?: 'premultiplied' | 'opaque';
}>>;
export type DistinctOldFrame = Assert<Equal<SharedRenderFrame2D extends RenderFrame2D ? true : false, false>>;
export type DistinctTexturedFrame = Assert<Equal<SharedRenderFrame2D extends TexturedRenderFrame2D ? true : false, false>>;

export function authenticInputs(source: ImageData2D): {
  texture: Texture; material: SharedMaterial2D; shared: SharedGeometry2D; legacy: TexturedGeometry2D;
} {
  const view: TextureViewRegionInput2D = {
    packed: { x: 0, y: 0, width: 1, height: 1 },
    logicalWidth: 2, logicalHeight: 2, trimX: 1, trimY: 1, quarterTurn: 3,
  };
  const materialInput: SharedMaterialInput2D = {
    light: [1, .5, .25, .5], dark: [0, .25, .5], samplingDomain: 'page',
    blend: 'screen', filter: 'linear', minFilter: 'linear', magFilter: 'linear',
    addressU: 'repeat', addressV: 'mirror-repeat', regionIsolation: 'bounded',
    mipLevel: 0, maxAnisotropy: 1,
  };
  const input: SharedGeometryInput2D = {
    positions: new Float32Array([0, 0, 1, 0, 0, 1]),
    uvs: new Float64Array([-.25, 0, 1.25, 0, 0, 1]),
    lightColors: new Float32Array(12).fill(1),
    darkColors: new Float64Array(9),
    indices: new Uint16Array([0, 1, 2]),
  };
  const shared = createSharedGeometry2D(input);
  const legacy = createTexturedGeometry2D({
    positions: new Float64Array([0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(12).fill(1),
    indices: new Uint32Array([0, 1, 2]),
  });
  const texture = createTextureView(source, view);
  const metadata: TextureViewRegion2D | null = texture.viewRegion;
  const material = createSharedMaterial2D(materialInput);
  const light: readonly [number, number, number, number] = material.light;
  const dark: readonly [number, number, number] = material.dark;
  void [metadata, light, dark];
  return { texture, material, shared, legacy };
}

export function meshCompatibility(lease: AssetLease<Texture>, legacy: TexturedGeometry2D, shared: SharedGeometry2D) {
  // This annotation is a historical consumer: default G must remain old geometry.
  const oldConsumer: Mesh2D = new Mesh2D(lease, legacy);
  oldConsumer.setContent(lease, legacy);
  const oldMaybe: TexturedGeometry2D | undefined = oldConsumer.geometry;
  if (oldMaybe !== undefined) {
    const oldRequired: TexturedGeometry2D = oldMaybe;
    void oldRequired;
  }

  const inferred = new Mesh2D(lease, shared);
  const explicit: Mesh2D<SharedGeometry2D> = inferred;
  type ExactInference = Assert<Equal<typeof inferred, Mesh2D<SharedGeometry2D>>>;
  const checkInference: ExactInference = true;
  inferred.setContent(lease, shared);
  const newMaybe: SharedGeometry2D | undefined = inferred.geometry;
  if (newMaybe !== undefined) {
    const required: SharedGeometry2D = newMaybe;
    const colors: readonly number[] = required.darkColors;
    void colors;
  }
  inferred.clear();
  const afterClear: SharedGeometry2D | undefined = inferred.geometry;
  explicit.dispose();
  const afterDispose: SharedGeometry2D | undefined = explicit.geometry;
  return { oldConsumer, explicit, checkInference, afterClear, afterDispose };
}

export function contractsGuardsNarrowUnknown(value: unknown): ContractsGeometry | ContractsMaterial | undefined {
  if (isSharedGeometry2D(value)) {
    const shared: SharedGeometry2D = value;
    return shared;
  }
  if (isSharedMaterial2D(value)) {
    const material: SharedMaterial2D = value;
    return material;
  }
  return undefined;
}

export function publicHost(base: HostAdapter, observe: (frame: SharedRenderFrame2D) => void): SharedRenderHostAdapter {
  return {
    ...base,
    sharedFrameProfile: SHARED_FRAME_PROFILE_2D,
    renderSharedFrame(frame) { observe(frame); return undefined; },
  };
}

export function sharedEngine(host: SharedRenderHostAdapter): Promise<Engine> {
  return createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D);
}

export function completeFrames(engine: Engine, host: SharedRenderHostAdapter) {
  const transparent: SharedFrameOptions2D = { width: 32, height: 24 };
  const opaque: SharedFrameOptions2D = { width: 32, height: 24, outputAlpha: 'opaque', clearAlpha: 1 };
  const saved: SharedRenderFrame2D = engine.captureSharedFrame(transparent);
  const rendered: SharedRenderFrame2D = engine.renderSharedFrame(opaque);
  const done: undefined = host.renderSharedFrame(saved);
  const profile: SharedFrameProfile2D = saved.profile;
  const contractFrame: ContractsFrame = saved;
  for (const command of saved.commands) {
    const ordinal: number = command.ordinal;
    const occurrence: number = command.occurrenceId;
    if (command.kind === 'barrier') {
      const boundary: number = command.boundaryId;
      void [boundary, command.reason];
    } else {
      const opacity: number = command.opacity;
      const material: SharedMaterial2D | undefined = saved.materials[command.materialIndex];
      if (command.kind === 'rect') {
        const fill: number = command.fillAlpha;
        void [fill, command.fillColor, command.rect];
      } else {
        const region = saved.regions[command.regionIndex];
        if (region !== undefined) {
          const page = saved.pages[region.pageIndex];
          const source: ImageData2D | undefined = page?.source;
          void source;
        }
        if (command.kind === 'mesh') {
          const geometry: TexturedGeometry2D | SharedGeometry2D | undefined = saved.geometries[command.geometryIndex];
          void geometry;
        }
      }
      void [opacity, material];
    }
    void [ordinal, occurrence];
  }
  return { saved, rendered, done, profile, contractFrame };
}
