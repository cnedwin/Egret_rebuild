// Resolve the profile declarations through the engine's existing dependency.
// The type-only test bridge keeps one opaque frame brand across Windows aliases.
export type {
    TexturedFrameProfile2D as ContractsProfileType,
    TexturedMeshCommand2D as ContractsProfileMesh,
    TexturedRenderCommand2D as ContractsProfileCommand,
    TexturedRenderFrame2D as ContractsProfileFrame,
    TexturedRenderHostAdapter as ContractsProfileHost,
} from '@egret/contracts';
