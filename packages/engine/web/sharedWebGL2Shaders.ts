import type { SharedMaterial2D } from '@egret/contracts';

// The original 128-byte payload is three float vectors followed by five uint vectors.
// Keep this identical in both stages; the Host verifies active offsets and block size.
const DRAW_UNIFORM = `layout(std140) uniform DrawUniform {
    vec4 viewportOpacity;
    vec4 materialLight;
    vec4 materialDark;
    uvec4 logicalTrim;
    uvec4 contentOrigin;
    uvec4 packedTurnDomain;
    uvec4 samplerPolicy;
    uvec4 pageExecution;
};
`;

/** Native objects, compilation, linking and all state remain owned by the Host. */
export const sharedWebGL2VertexSource = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 uv;
layout(location = 2) in vec4 light;
layout(location = 3) in vec3 dark;
out vec2 vertexUV;
out vec4 vertexLight;
out vec3 vertexDark;
void main() {
    // Prepared positions use top-left backing pixels; the GL viewport starts at (0, 0).
    gl_Position = vec4(2.0 * position.x / viewportOpacity.x - 1.0,
        1.0 - 2.0 * position.y / viewportOpacity.y, 0.0, 1.0);
    vertexUV = uv;
    vertexLight = light;
    vertexDark = dark;
}
`;

export const sharedWebGL2FragmentSource = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
uniform highp sampler2D page;
in vec2 vertexUV;
in vec4 vertexLight;
in vec3 vertexDark;
layout(location = 0) out vec4 fragmentColor;

vec3 decoded(vec3 value) {
    return mix(value / 12.92, pow((value + vec3(0.055)) / 1.055, vec3(2.4)),
        greaterThan(value, vec3(0.04045)));
}

vec4 decodedPageTap(ivec2 index) {
    // Canonical rows retain their CPU order on upload. RGBA8 performs no sRGB decode.
    vec4 value = texelFetch(page, index, 0);
    return vec4(decoded(value.rgb), value.a);
}

int wrapped(int value, int period) {
    // GLSL ES leaves negative integer remainder undefined. Both % operands stay non-negative.
    return value < 0 ? period - 1 - ((-1 - value) % period) : value % period;
}

int addressed(int value, int extent, uint mode) {
    if (mode == 0u) { return clamp(value, 0, extent - 1); }
    if (mode == 1u) { return wrapped(value, extent); }
    int period = 2 * extent;
    int index = wrapped(value, period);
    return index >= extent ? period - 1 - index : index;
}

vec4 pageTap(ivec2 index, uvec2 modes) {
    return decodedPageTap(ivec2(addressed(index.x, int(pageExecution.x), modes.x),
        addressed(index.y, int(pageExecution.y), modes.y)));
}

vec4 linearPage(vec2 positionInTexels, uvec2 modes) {
    vec2 shifted = positionInTexels - vec2(0.5);
    ivec2 base = ivec2(floor(shifted));
    vec2 weight = fract(shifted);
    // Decode each integer tap before interpolation, including at repeat/mirror seams.
    return mix(mix(pageTap(base, modes), pageTap(base + ivec2(1, 0), modes), weight.x),
        mix(pageTap(base + ivec2(0, 1), modes), pageTap(base + ivec2(1, 1), modes), weight.x), weight.y);
}

vec4 regionTap(ivec2 logical) {
    ivec2 index = clamp(logical, ivec2(0), ivec2(logicalTrim.xy) - ivec2(1));
    ivec2 local = index - ivec2(logicalTrim.zw);
    ivec2 size = ivec2(contentOrigin.xy);
    if (any(lessThan(local, ivec2(0))) || any(greaterThanEqual(local, size))) { return vec4(0.0); }
    ivec2 packedCoordinate = local;
    switch (packedTurnDomain.z) {
        case 1u: packedCoordinate = ivec2(size.y - 1 - local.y, local.x); break;
        case 2u: packedCoordinate = size - ivec2(1) - local; break;
        case 3u: packedCoordinate = ivec2(local.y, size.x - 1 - local.x); break;
        default: break;
    }
    return decodedPageTap(ivec2(contentOrigin.zw) + packedCoordinate);
}

vec4 sampled(vec2 coordinate) {
    if (packedTurnDomain.w == 1u) {
        // Existing preparation bounds these interpolated texel coordinates to 8192 or 2^20.
        vec2 q = coordinate * vec2(pageExecution.xy);
        if (samplerPolicy.z == 1u) { return linearPage(q, samplerPolicy.xy); }
        return pageTap(ivec2(floor(q)), samplerPolicy.xy);
    }
    vec2 extent = vec2(logicalTrim.xy);
    // Clamp after fragment interpolation, before integer conversion.
    vec2 q = clamp(coordinate * extent, vec2(0.0), extent);
    if (samplerPolicy.z == 0u) { return regionTap(ivec2(floor(q))); }
    if (samplerPolicy.w == 1u) {
        vec2 shifted = q - vec2(0.5);
        ivec2 base = ivec2(floor(shifted));
        vec2 weight = fract(shifted);
        return mix(mix(regionTap(base), regionTap(base + ivec2(1, 0)), weight.x),
            mix(regionTap(base + ivec2(0, 1)), regionTap(base + ivec2(1, 1)), weight.x), weight.y);
    }
    vec2 r = clamp(q, vec2(0.5), extent - vec2(0.5));
    vec2 trim = vec2(logicalTrim.zw);
    vec2 size = vec2(contentOrigin.xy);
    vec2 c = clamp(r, trim + vec2(0.5), trim + size - vec2(0.5));
    vec2 coverage = min(vec2(1.0), min(max(vec2(0.0), r - trim + vec2(0.5)),
        max(vec2(0.0), trim + size + vec2(0.5) - r)));
    vec2 local = c - trim;
    vec2 packedCoordinate = local;
    switch (packedTurnDomain.z) {
        case 1u: packedCoordinate = vec2(size.y - local.y, local.x); break;
        case 2u: packedCoordinate = size - local; break;
        case 3u: packedCoordinate = vec2(local.y, size.x - local.x); break;
        default: break;
    }
    return linearPage(vec2(contentOrigin.zw) + packedCoordinate, uvec2(0u)) * (coverage.x * coverage.y);
}

vec4 tinted(vec4 value) {
    float a = clamp(value.a, 0.0, 1.0);
    // A numerical guard after sampling, never a per-tap recipe change.
    vec3 p = clamp(value.rgb, vec3(0.0), vec3(a));
    vec3 v = p * vertexLight.rgb + (vec3(a) - p) * vertexDark;
    float factor = viewportOpacity.z * vertexLight.a * materialLight.a;
    return vec4(factor * (v * materialLight.rgb + (vec3(a) - v) * materialDark.rgb), factor * a);
}

void main() {
    // One fixed program: a solid draw takes this branch without fetching a page.
    if (pageExecution.z == 0u) { fragmentColor = tinted(vec4(1.0)); }
    else { fragmentColor = tinted(sampled(vertexUV)); }
}
`;

export const sharedWebGL2ResolveVertexSource = `#version 300 es
precision highp float;
precision highp int;
void main() {
    vec2 position = gl_VertexID == 0 ? vec2(-1.0, -1.0) :
        (gl_VertexID == 1 ? vec2(3.0, -1.0) : vec2(-1.0, 3.0));
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const sharedWebGL2ResolveFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D workingTexture;
uniform bool opaque;
layout(location = 0) out vec4 fragmentColor;
vec3 encoded(vec3 value) {
    return mix(12.92 * value, 1.055 * pow(value, vec3(1.0 / 2.4)) - vec3(0.055),
        greaterThan(value, vec3(0.0031308)));
}
void main() {
    // SRGB8_ALPHA8 integer fetch already decodes RGB. Both targets use the same GL row.
    vec4 value = texelFetch(workingTexture, ivec2(gl_FragCoord.xy), 0);
    if (opaque) {
        fragmentColor = vec4(encoded(clamp(value.rgb, vec3(0.0), vec3(1.0))), 1.0);
        return;
    }
    float a = clamp(value.a, 0.0, 1.0);
    vec3 c = clamp(value.rgb, vec3(0.0), vec3(a));
    if (a == 0.0) { fragmentColor = vec4(0.0); }
    else { fragmentColor = vec4(a * encoded(c / a), a); }
}
`;

/** FUNC_ADD for RGB and alpha; admission separately restricts add-preserve to opaque output. */
export function sharedWebGL2BlendFactors(blend: SharedMaterial2D['blend']): readonly [number, number, number, number] {
    switch (blend) {
        case 'normal': return [1, 771, 1, 771];
        case 'add-accumulate': return [1, 1, 1, 1];
        case 'add-preserve': return [1, 1, 0, 1];
        case 'multiply-factor': return [774, 771, 1, 771];
        case 'screen': return [1, 769, 1, 771];
        default: throw new TypeError('Unsupported shared blend');
    }
}
