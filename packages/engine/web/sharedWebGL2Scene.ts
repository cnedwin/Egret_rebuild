// SPDX-License-Identifier: Apache-2.0
import { createSceneFrame3D, isSceneFrame3D, getScene3DErrorOrigin } from '../rendering/sceneFrame3D.js';
import type { SceneFrame3D } from '../rendering/sceneFrame3D.js';
import { packSharedMeshGeometry3D, getSharedMeshPacking3DErrorOrigin } from '../rendering/packSharedMeshGeometry3D.js';
import type { PackedMeshGeometry3D } from '../rendering/packSharedMeshGeometry3D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import { packSharedSceneCardUniform3D, packSharedSceneLambertUniform3D } from './sharedSubmissionStorage2D.js';

// These are the genuine existing CPU references, not a second scene registry.
// The Host imports this fixed module namespace; callers cannot inject a plugin.
export { createSceneFrame3D, isSceneFrame3D, getScene3DErrorOrigin };

export type SharedGLScenePreparationReason = 'frame' | 'budget' | 'precision' | 'backing';
export class SharedGLScenePreparationError extends Error {
    public constructor(public readonly reason: SharedGLScenePreparationReason, cause?: unknown) {
        super('Shared GL scene ' + reason, { cause });
    }
}
function fail(reason: SharedGLScenePreparationReason, cause?: unknown): never {
    throw noteOwnedPreparationFailure(new SharedGLScenePreparationError(reason, cause));
}

const LIMITS = Object.freeze({ draws: 64, geometries: 64, cpu: 8388608,
    scene: 4194304, uniform: 4096, depth: 16777216 });

export interface SharedGLSceneAdmission {
    readonly frame: SceneFrame3D;
    readonly sceneBytes: number;
    readonly uniformBytes: number;
    readonly depthBytes: number;
    /** Geometry vertex/index byte pairs in frame.geometries order; no UBO arena padding. */
    readonly bufferBytes: readonly number[];
}
export interface SharedGLSceneDraw {
    readonly mesh: PackedMeshGeometry3D;
    readonly uniform: Float32Array<ArrayBuffer>;
    readonly pageIndex?: number;
    readonly lambert?: true;
}
export interface SharedGLSceneCardDraw {
    readonly pageIndex: number;
    readonly uniform: Float32Array<ArrayBuffer>;
}
export interface PreparedSharedGLScene extends SharedGLSceneAdmission {
    readonly meshes: readonly PackedMeshGeometry3D[];
    readonly draws: readonly SharedGLSceneDraw[];
    readonly cards: readonly SharedGLSceneCardDraw[];
    /** Mesh uniforms followed by card uniforms, each in its authored draw order. */
    readonly uniforms: readonly Float32Array<ArrayBuffer>[];
}

/** Metadata only. Host validates backing first, then combines these fees with its overlay. */
export function admitSharedGLScene(input: unknown, width: number, height: number): SharedGLSceneAdmission {
    // Identity precedes every input property read, including for proxies and lookalikes.
    if (!isSceneFrame3D(input)) fail('frame');
    const frame = input, count = frame.draws.length, distinct = frame.geometries.length;
    const cards = frame.cards?.length ?? 0;
    if (count + cards > LIMITS.draws || distinct > LIMITS.geometries) fail('budget');
    let cpuBytes = 0, sceneBytes = 0;
    const uniformBytes = frame.draws.reduce((bytes, draw) => bytes + (draw.lambert ? 128 : 64), 112 * cards);
    const bufferBytes: number[] = [];
    const componentsByGeometry = new Map(frame.draws.map(draw => [draw.geometry, draw.lambert ? 11 : draw.texture ? 8 : 6]));
    for (const geometry of frame.geometries) {
        const components = componentsByGeometry.get(geometry)!;
        const vertexBytes = 4 * components * geometry.vertexCount, indexBytes = 4 * geometry.indexCount;
        cpuBytes += 8 * (components * geometry.vertexCount + geometry.indexCount);
        sceneBytes += vertexBytes + indexBytes;
        bufferBytes.push(vertexBytes, indexBytes);
    }
    if (![cpuBytes, sceneBytes, uniformBytes].every(Number.isSafeInteger)
        || cpuBytes > LIMITS.cpu || sceneBytes > LIMITS.scene || uniformBytes > LIMITS.uniform) fail('budget');
    if (cpuBytes !== frame.cpuLogicalBytes || sceneBytes !== frame.sceneBytes || uniformBytes !== frame.uniformBytes) fail('frame');
    const depthBytes = 4 * width * height;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0
        || !Number.isSafeInteger(depthBytes)) fail('backing');
    // The 16 MiB depth cap belongs to the later joint fee check, after overlay preparation.
    // No fake maxBufferSize or native capability is invented at this CPU boundary.
    return { frame, sceneBytes, uniformBytes, depthBytes, bufferBytes };
}

/** Call only after joint logical, native-limit and pending admission; never as that preflight. */
export function prepareSharedGLScene(
    input: unknown, width: number, height: number, cardViews: readonly number[] = [],
    textureViews?: ReadonlyMap<SceneFrame3D["geometries"][number], number>,
): PreparedSharedGLScene {
    // Repeating finite metadata over a genuine immutable frame keeps this private entry self-contained.
    const admission = admitSharedGLScene(input, width, height);
    if (admission.depthBytes > LIMITS.depth) fail('budget');
    if ((admission.frame.cards?.length ?? 0) !== cardViews.length) fail('frame');
    const meshes: PackedMeshGeometry3D[] = [];
    const draws: SharedGLSceneDraw[] = [];
    const uniforms: Float32Array<ArrayBuffer>[] = [];
    const byGeometry = new Map<SceneFrame3D['geometries'][number], PackedMeshGeometry3D>();
    const byDrawGeometry = new Map(admission.frame.draws.map(draw => [draw.geometry, draw]));
    for (const geometry of admission.frame.geometries) {
        let mesh: PackedMeshGeometry3D;
        const sample = byDrawGeometry.get(geometry)!;
        try { mesh = packSharedMeshGeometry3D(geometry, sample.texture?.texcoords, sample.lambert?.normals); }
        catch (cause) {
            // Only this imported packer's private origin predicate authenticates its failure.
            const origin = getSharedMeshPacking3DErrorOrigin(cause);
            const reason = origin === 'budget' ? 'budget'
                : origin === 'validation' && (cause as { code: string }).code === 'MESH3D_PACK_F32_UNSUPPORTED'
                    ? 'precision' : 'frame';
            fail(reason, cause);
        }
        byGeometry.set(geometry, mesh);
        meshes.push(mesh);
    }
    for (const draw of admission.frame.draws) {
        const mesh = byGeometry.get(draw.geometry);
        if (!mesh) fail('frame');
        // Preserve the existing 16-number, column-major float32 ABI, including empty draws.
        // Clip depth remapping occurs in the vertex shader; no CPU transpose, divide or Y flip.
        const uniform = draw.lambert ? packSharedSceneLambertUniform3D(draw) : new Float32Array(draw.mvp);
        const pageIndex = textureViews?.get(draw.geometry);
        if (draw.texture && mesh.indexCount !== 0 && pageIndex === undefined) fail("frame");
        draws.push(draw.lambert && pageIndex !== undefined ? {mesh, uniform, pageIndex, lambert: true}
            : pageIndex === undefined ? {mesh, uniform} : {mesh, uniform, pageIndex});
        uniforms.push(uniform);
    }
    const cards = (admission.frame.cards ?? []).map((card, index) => {
        const pageIndex = cardViews[index]!;
        const uniform = packSharedSceneCardUniform3D(card);
        uniforms.push(uniform);
        return { pageIndex, uniform };
    });
    return { ...admission, meshes, draws, cards, uniforms };
}

/** Fixed metadata for linked ABI verification and native setup owned entirely by the Host. */
export const SHARED_GL_SCENE_LAYOUT = Object.freeze({
    vertexStride: 24,
    attributes: Object.freeze([
        Object.freeze({ location: 0, name: 'aPosition', components: 3, type: 'float32', normalized: false, byteOffset: 0, divisor: 0 }),
        Object.freeze({ location: 1, name: 'aLinearColor', components: 3, type: 'float32', normalized: false, byteOffset: 12, divisor: 0 }),
    ]),
    indexType: 'uint32', indexElementBytes: 4,
    uniformBlock: 'SceneDraw', uniformMember: 'uMVP', uniformBytes: 64,
    uniformOffset: 0, uniformMatrixStride: 16, uniformIsRowMajor: false,
    primitive: 'triangles', frontFace: 'ccw', cull: false,
    depthFormat: 'DEPTH_COMPONENT32F', clearDepth: 0, depthCompare: 'greater', depthWrite: true,
    blend: false, samples: 1,
} as const);

// First-party B1 equations: RGB was decoded before float32 packing and interpolates linearly.
// Existing CPU clip depth is zero-to-one reverse depth; GL requires minus-one-to-one clip z.
export const SHARED_GL_SCENE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aLinearColor;
layout(std140) uniform SceneDraw {
    mat4 uMVP;
};
out highp vec3 vLinearColor;
void main() {
    vec4 clip = uMVP * vec4(aPosition, 1.0);
    gl_Position = vec4(clip.xy, 2.0 * clip.z - clip.w, clip.w);
    vLinearColor = aLinearColor;
}
`;

// Linear opaque RGB is encoded by the SRGB8_ALPHA8 working attachment on each write.
// Final canvas transfer is the Host's single shared resolve, never another scene resolve.
export const SHARED_GL_SCENE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in highp vec3 vLinearColor;
layout(location = 0) out vec4 outColor;
void main() {
    outColor = vec4(vLinearColor, 1.0);
}
`;

// Cards share the opaque depth attachment; only admitted coverage writes depth.
const SCENE_CARD_UNIFORM = `layout(std140) uniform SceneCard {
    mat4 uCardMVP;
    vec4 uCardBounds;
    vec4 uCardRegion;
    vec4 uCardCutoff;
};
`;

export const SHARED_GL_SCENE_CARD_VERTEX = `#version 300 es
precision highp float;
precision highp int;
${SCENE_CARD_UNIFORM}
out highp vec2 vCardUV;
const vec2 corners[6] = vec2[6](vec2(0, 0), vec2(0, 1), vec2(1, 0), vec2(1, 0), vec2(0, 1), vec2(1, 1));
void main() {
    vCardUV = corners[gl_VertexID];
    // Select the same endpoints and triangle diagonal as WebGPU.
    vec2 position = vec2(vCardUV.x == 0.0 ? uCardBounds.x : uCardBounds.z,
        vCardUV.y == 0.0 ? uCardBounds.w : uCardBounds.y);
    vec4 clip = uCardMVP * vec4(position, 0.0, 1.0);
    gl_Position = vec4(clip.xy, 2.0 * clip.z - clip.w, clip.w);
}
`;

export const SHARED_GL_SCENE_CARD_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
${SCENE_CARD_UNIFORM}
uniform highp sampler2D uCardPage;
in highp vec2 vCardUV;
layout(location = 0) out vec4 outColor;
void main() {
    // Canonical atlas upload keeps top-left source rows and does no automatic sRGB decode.
    vec2 local = clamp(floor(vCardUV * uCardRegion.zw), vec2(0.0), uCardRegion.zw - vec2(1.0));
    vec4 texel = texelFetch(uCardPage, ivec2(uCardRegion.xy) + ivec2(local), 0);
    if (floor(texel.a * 255.0 + 0.5) < floor(uCardCutoff.x * 255.0 + 0.5)) discard;
    vec3 premultiplied = mix(texel.rgb / 12.92, pow((texel.rgb + vec3(0.055)) / 1.055, vec3(2.4)),
        greaterThan(texel.rgb, vec3(0.04045)));
    outColor = vec4(clamp(premultiplied / texel.a, vec3(0.0), vec3(1.0)), 1.0);
}
`;

export const SHARED_GL_SCENE_TEXTURE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aLinearColor;
layout(location = 2) in vec2 aUV;
layout(std140) uniform SceneDraw {
    mat4 uMVP;
};
out highp vec3 vLinearColor;
out highp vec2 vUV;
void main() {
    vec4 clip = uMVP * vec4(aPosition, 1.0);
    gl_Position = vec4(clip.xy, 2.0 * clip.z - clip.w, clip.w);
    vLinearColor = aLinearColor;
    vUV = aUV;
}
`;

export const SHARED_GL_SCENE_TEXTURE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uScenePage;
in highp vec3 vLinearColor;
in highp vec2 vUV;
layout(location = 0) out vec4 outColor;
void main() {
    // Shared GL pages hold encoded color in top-left row order. Decode once before modulation.
    ivec2 dimensions = textureSize(uScenePage, 0);
    ivec2 pixel = min(ivec2(clamp(vUV, 0.0, 1.0) * vec2(dimensions)), dimensions - 1);
    vec3 encoded = texelFetch(uScenePage, pixel, 0).rgb;
    vec3 linear = mix(encoded / 12.92, pow((encoded + vec3(0.055)) / 1.055, vec3(2.4)),
        greaterThan(encoded, vec3(0.04045)));
    outColor = vec4(linear * vLinearColor, 1.0);
}
`;

const SCENE_LAMBERT_UNIFORM = `layout(std140) uniform SceneLambert {
    mat4 uMVP;
    vec4 uNormal0;
    vec4 uNormal1;
    vec4 uNormal2;
    vec4 uLight;
};
`;
export const SHARED_GL_SCENE_LAMBERT_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aLinearColor;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec3 aNormal;
${SCENE_LAMBERT_UNIFORM}
out highp vec3 vLinearColor;
out highp vec2 vUV;
out highp vec3 vNormal;
void main() {
    vec4 clip = uMVP * vec4(aPosition, 1.0);
    gl_Position = vec4(clip.xy, 2.0 * clip.z - clip.w, clip.w);
    vLinearColor = aLinearColor;
    vUV = aUV;
    vNormal = mat3(uNormal0.xyz, uNormal1.xyz, uNormal2.xyz) * aNormal;
}
`;
export const SHARED_GL_SCENE_LAMBERT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
${SCENE_LAMBERT_UNIFORM}
uniform highp sampler2D uScenePage;
in highp vec3 vLinearColor;
in highp vec2 vUV;
in highp vec3 vNormal;
layout(location = 0) out vec4 outColor;
void main() {
    ivec2 dimensions = textureSize(uScenePage, 0);
    ivec2 pixel = min(ivec2(clamp(vUV, 0.0, 1.0) * vec2(dimensions)), dimensions - 1);
    vec3 encoded = texelFetch(uScenePage, pixel, 0).rgb;
    vec3 linear = mix(encoded / 12.92, pow((encoded + vec3(0.055)) / 1.055, vec3(2.4)),
        greaterThan(encoded, vec3(0.04045)));
    // Mirrored model transforms reverse native winding. Light the authored side.
    bool front = gl_FrontFacing != (uNormal1.w < 0.0);
    vec3 oriented = front ? vNormal : -vNormal;
    vec3 absolute = abs(oriented);
    float scale = max(absolute.x, max(absolute.y, absolute.z));
    float directional = 0.0;
    if (scale >= 1.17549435e-38) directional = max(0.0, dot(normalize(oriented / scale), uLight.xyz));
    outColor = vec4(linear * vLinearColor * (uNormal0.w + uLight.w * directional), 1.0);
}
`;
