// Resolve contract declarations through engine's declared workspace dependency.
// This type-only test bridge preserves one opaque brand across Windows aliases.
export type {
    TexturedFloatArray2D as ContractsGeometryFloat,
    TexturedIndexArray2D as ContractsGeometryIndex,
    TexturedGeometry2DInput as ContractsGeometryInput,
    TexturedGeometry2D as ContractsGeometry,
} from '@egret/contracts';
