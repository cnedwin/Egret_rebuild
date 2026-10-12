// Original NS1 compiler consumer: root forwards retain one exact CPU factory
// signature and the existing branded geometry without host or ambient globals.
import { createNineSliceGeometry2D } from "@egret/engine";
import { createNineSliceGeometry2D as createRuntimeNineSlice } from "@egret/runtime";
import type { NineSliceInsets2D, NineSliceGeometry2DOptions, TexturedGeometry2D as EngineGeometry } from "@egret/engine";
import type { NineSliceInsets2D as RuntimeInsets, NineSliceGeometry2DOptions as RuntimeOptions } from "@egret/runtime";
import type { TexturedGeometry2D } from "@egret/contracts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type InsetsShape = Assert<Equal<NineSliceInsets2D, {
  readonly left: number; readonly top: number; readonly right: number; readonly bottom: number;
}>>;
type OptionsShape = Assert<Equal<NineSliceGeometry2DOptions, {
  readonly sourceWidth: number; readonly sourceHeight: number;
  readonly targetWidth: number; readonly targetHeight: number;
  readonly insets: NineSliceInsets2D;
}>>;
type InsetsForward = Assert<Equal<NineSliceInsets2D, RuntimeInsets>>;
type OptionsForward = Assert<Equal<NineSliceGeometry2DOptions, RuntimeOptions>>;
type FactoryForward = Assert<Equal<typeof createNineSliceGeometry2D, typeof createRuntimeNineSlice>>;
type FactorySignature = Assert<Equal<typeof createNineSliceGeometry2D,
  (options: NineSliceGeometry2DOptions) => TexturedGeometry2D>>;
type RuntimeSignature = Assert<Equal<typeof createRuntimeNineSlice,
  (options: RuntimeOptions) => TexturedGeometry2D>>;
type RequiredParameter = Assert<Equal<Parameters<typeof createNineSliceGeometry2D>,
  [options: NineSliceGeometry2DOptions]>>;
type CanonicalResult = Assert<Equal<ReturnType<typeof createNineSliceGeometry2D>, TexturedGeometry2D>>;
type ExistingEngineResult = Assert<Equal<EngineGeometry, TexturedGeometry2D>>;
type ReadonlyPayload = Assert<Equal<Pick<TexturedGeometry2D, "positions" | "uvs" | "lightColors" | "indices">, {
  readonly positions: readonly number[]; readonly uvs: readonly number[];
  readonly lightColors: readonly number[]; readonly indices: readonly number[];
}>>;

const insets: NineSliceInsets2D = { left: 2, top: 2, right: 2, bottom: 2 };
const options: NineSliceGeometry2DOptions = {
  sourceWidth: 8, sourceHeight: 8, targetWidth: 16, targetHeight: 12, insets,
};
const runtimeOptions: RuntimeOptions = options;
const runtimeInsets: RuntimeInsets = insets;
const engineFactory: typeof createNineSliceGeometry2D = createRuntimeNineSlice;
const runtimeFactory: typeof createRuntimeNineSlice = createNineSliceGeometry2D;
const engineGeometry: TexturedGeometry2D = createNineSliceGeometry2D(options);
const runtimeGeometry: EngineGeometry = createRuntimeNineSlice(runtimeOptions);
const zeroInsets: RuntimeInsets = { left: 0, top: 0, right: 0, bottom: 0 };
const zeroBorderGeometry: TexturedGeometry2D = createRuntimeNineSlice({
  sourceWidth: 8, sourceHeight: 8, targetWidth: 1, targetHeight: 1, insets: zeroInsets,
});
const zeroCenterGeometry: TexturedGeometry2D = createNineSliceGeometry2D({
  sourceWidth: 8, sourceHeight: 8, targetWidth: 4, targetHeight: 4, insets,
});
const vertexCount: number = engineGeometry.vertexCount;
const indexCount: number = engineGeometry.indexCount;
const triangleCount: number = engineGeometry.triangleCount;
const logicalByteLength: number = engineGeometry.logicalByteLength;
const positions: readonly number[] = engineGeometry.positions;
const uvs: readonly number[] = engineGeometry.uvs;
const lightColors: readonly number[] = engineGeometry.lightColors;
const indices: readonly number[] = engineGeometry.indices;
const firstPosition: number | undefined = positions[0];
void runtimeInsets; void engineFactory; void runtimeFactory; void runtimeGeometry;
void zeroBorderGeometry; void zeroCenterGeometry; void vertexCount; void indexCount;
void triangleCount; void logicalByteLength; void uvs; void lightColors; void indices; void firstPosition;
export type { InsetsShape, OptionsShape, InsetsForward, OptionsForward, FactoryForward,
  FactorySignature, RuntimeSignature, RequiredParameter, CanonicalResult, ExistingEngineResult, ReadonlyPayload };
