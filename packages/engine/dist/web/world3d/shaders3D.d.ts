/** Fixed vertex attribute locations shared by every program and vertex array. */
export declare const ATTRIBUTE_LOCATIONS_3D: Readonly<{
    readonly position: 0;
    readonly normal: 1;
    readonly uv: 2;
    readonly tangent: 3;
    readonly color: 4;
    readonly joints: 5;
    readonly weights: 6;
    readonly uv1: 7;
    readonly instanceMatrix: 8;
    readonly instanceColor: 12;
    readonly instanceAnimation: 13;
    readonly instanceAnimation2: 14;
    readonly instanceLook: 15;
}>;
/** Fixed texture units; samplers are assigned once when a program is linked. */
export declare const TEXTURE_UNITS_3D: Readonly<{
    readonly map: 0;
    readonly normalMap: 1;
    readonly metallicRoughnessMap: 2;
    readonly occlusionMap: 3;
    readonly emissiveMap: 4;
    readonly environment: 5;
    readonly shadow: 6;
    readonly bones: 7;
    readonly morph: 8;
    readonly lightMap: 9;
    readonly sceneColor: 10;
    readonly reflectionMap: 11;
    readonly sceneDepth: 12;
}>;
export declare const MAX_MORPH_INFLUENCES_3D = 8;
export interface ShaderSources3D {
    readonly vertex: string;
    readonly fragment: string;
}
/** Specialize the material shader pair with a list of preprocessor symbols. */
export declare function buildMaterialShader3D(defines: readonly string[], customFragment?: string, customVertex?: string, customNormal?: string): ShaderSources3D;
/** Full-screen triangle that samples a cube map along the view ray; drawn at the far plane. */
export declare const SKYBOX_SHADER_3D: ShaderSources3D;
//# sourceMappingURL=shaders3D.d.ts.map