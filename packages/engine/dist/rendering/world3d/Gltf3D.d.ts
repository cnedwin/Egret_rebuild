import { AnimationClip3D } from './Animation3D.js';
import { Camera3D } from './Camera3D.js';
import { Geometry3D } from './Geometry3D.js';
import { Material3D } from './Material3D.js';
import { Object3D } from './Object3D.js';
import type { Ktx2Options3D } from './Ktx23D.js';
import { Texture3D } from './Texture3D.js';
import type { TextureSource3D } from './Texture3D.js';
export interface GltfImageRequest3D {
    readonly index: number;
    readonly mimeType: string | undefined;
    /** Encoded image bytes when embedded in a buffer or data URI. */
    readonly bytes: Uint8Array | undefined;
    /** Relative or absolute URI when the image is external. */
    readonly uri: string | undefined;
}
export interface GltfLoadOptions3D {
    /** Decode an encoded image into pixels or a host image object. */
    readonly decodeImage?: (request: GltfImageRequest3D) => Promise<TextureSource3D>;
    /** Fetch an external .bin buffer referenced by a .gltf file. */
    readonly loadBuffer?: (uri: string) => Promise<Uint8Array>;
    /** Transcode KTX2 payloads the built-in reader cannot use directly (Basis Universal, supercompressed). */
    readonly transcodeKtx2?: Ktx2Options3D['transcode'];
    /**
     * Decode one EXT_meshopt_compression buffer view into `count * stride`
     * bytes, with the view's filter already applied.
     */
    readonly decodeMeshopt?: (request: GltfMeshoptRequest3D) => Uint8Array;
    /** Decode one KHR_draco_mesh_compression primitive. */
    readonly decodeDraco?: (request: GltfDracoRequest3D) => Promise<GltfDracoResult3D> | GltfDracoResult3D;
}
export interface GltfMeshoptRequest3D {
    readonly source: Uint8Array;
    readonly count: number;
    readonly stride: number;
    readonly mode: 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES';
    readonly filter: 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL';
}
export interface GltfDracoRequest3D {
    readonly bytes: Uint8Array;
    /** glTF semantic (POSITION, NORMAL, ...) to Draco attribute id. */
    readonly attributes: Readonly<Record<string, number>>;
    /** glTF component type (5120 to 5126) each semantic's accessor asks for. */
    readonly componentTypes: Readonly<Record<string, number>>;
    /** glTF component type of the index accessor, when the primitive is indexed. */
    readonly indexComponentType: number | undefined;
}
export interface GltfDracoResult3D {
    /** Decoded arrays by glTF semantic, in the component type of the matching accessor. */
    readonly attributes: Readonly<Record<string, Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array>>;
    readonly indices?: Uint32Array | Uint16Array;
}
export interface GltfAsset3D {
    /** Root of the default scene (or the first one). */
    readonly scene: Object3D;
    readonly scenes: readonly Object3D[];
    readonly animations: readonly AnimationClip3D[];
    readonly cameras: readonly Camera3D[];
    readonly materials: readonly Material3D[];
    readonly textures: readonly Texture3D[];
    readonly geometries: readonly Geometry3D[];
    /** Release every geometry, material and texture created for this asset. */
    dispose(): void;
}
/** Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. */
export declare function loadGltf3D(data: Uint8Array | object, options?: GltfLoadOptions3D): Promise<GltfAsset3D>;
//# sourceMappingURL=Gltf3D.d.ts.map