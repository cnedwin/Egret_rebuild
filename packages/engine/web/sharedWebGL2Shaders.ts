import type { SharedMaterial2D } from '@egret/contracts';

// A framebuffer has its first row at the bottom; frame destinations start at the top.
export const sharedWebGL2LayerVertexSource = `#version 300 es
precision highp float;
uniform vec2 origin, extent, viewportSize;
out vec2 layerUV;
const vec2 corners[6] = vec2[6](vec2(0,0), vec2(0,1), vec2(1,0), vec2(1,0), vec2(0,1), vec2(1,1));
void main() {
    vec2 corner = corners[gl_VertexID];
    vec2 position = (origin + extent * corner) / viewportSize;
    gl_Position = vec4(2.0 * position.x - 1.0, 1.0 - 2.0 * position.y, 0.0, 1.0);
    layerUV = vec2(corner.x, 1.0 - corner.y);
}`;

// Sampling an sRGB attachment recovers its linear premultiplied values.
export const sharedWebGL2LayerFragmentSource = `#version 300 es
precision highp float;
uniform sampler2D layerTexture;
in vec2 layerUV;
out vec4 color;
void main() { color = texture(layerTexture, layerUV); }`;


export const sharedWebGL2LayerEffectFragmentSource = `#version 300 es
precision highp float;
uniform sampler2D layerTexture;
uniform vec2 viewportSize, effectMin, effectMax, multiplyRG, multiplyBAddR, addGB;
in vec2 layerUV;
out vec4 color;
void main() {
    color = texture(layerTexture, layerUV);
    vec2 center = vec2(gl_FragCoord.x, viewportSize.y - gl_FragCoord.y);
    if (all(greaterThanEqual(center, effectMin)) && all(lessThan(center, effectMax))) {
        vec3 scale = vec3(multiplyRG, multiplyBAddR.x);
        vec3 add = vec3(multiplyBAddR.y, addGB);
        // Add light in linear premultiplied space and preserve coverage.
        color.rgb = min(color.rgb * scale + color.a * add, vec3(color.a));
    }
}`;

// The 128-byte payload is three float vectors followed by five uint vectors, and holds what is the same
// for every draw of a batch. `pageUnits0` and `pageUnits1` name the pages of the eight texture units: the
// index of the page in the frame, or 0xffffffff for a unit without one. The last two values of `viewport`,
// the first three of `domain` and the first two of `pageExecution` are zero: the opacity is in each vertex,
// the region in the region table, and the page's size in the region's row.
// Keep this identical in both stages; the Host verifies active offsets and block size.
const DRAW_UNIFORM = `layout(std140) uniform DrawUniform {
    vec4 viewport;
    vec4 materialLight;
    vec4 materialDark;
    uvec4 pageUnits0;
    uvec4 pageUnits1;
    uvec4 domain;
    uvec4 samplerPolicy;
    uvec4 pageExecution;
};
`;
// One window of the region table: three uvec4 for each of 341 regions.
const REGION_WINDOW = `layout(std140) uniform RegionWindow {
    uvec4 regions[1023];
};
`;
const POSITION = `    // Prepared positions use top-left backing pixels; the GL viewport starts at (0, 0).
    gl_Position = vec4(2.0 * position.x / viewport.x - 1.0,
        1.0 - 2.0 * position.y / viewport.y, 0.0, 1.0);
    vertexUV = uv;
    vertexLight = light;
    vertexDark = dark;
    drawOpacity = slotOpacity.y;
`;
const TINTED = `vec4 tinted(vec4 value) {
    float a = clamp(value.a, 0.0, 1.0);
    // A numerical guard after sampling, never a per-tap recipe change.
    vec3 p = clamp(value.rgb, vec3(0.0), vec3(a));
    vec3 v = p * vertexLight.rgb + (vec3(a) - p) * vertexDark;
    float factor = drawOpacity * vertexLight.a * materialLight.a;
    return vec4(factor * (v * materialLight.rgb + (vec3(a) - v) * materialDark.rgb), factor * a);
}
`;

/**
 * Native objects, compilation, linking and all state remain owned by the Host.
 * The vertex stage of a sampled draw reads its region from the bound window of the region table and
 * hands it to every fragment of the triangle unchanged.
 */
export const sharedWebGL2VertexSource = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
${REGION_WINDOW}
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 uv;
layout(location = 2) in vec4 light;
layout(location = 3) in vec3 dark;
layout(location = 4) in vec2 slotOpacity;
out vec2 vertexUV;
out vec4 vertexLight;
out vec3 vertexDark;
flat out float drawOpacity;
flat out uvec4 logicalTrim;
flat out uvec4 contentOrigin;
flat out uint quarterTurn;
// The texture unit that holds the page of the region, and the page's width and height.
flat out uvec3 pageOfRegion;
void main() {
${POSITION}
    int row = 3 * int(slotOpacity.x);
    logicalTrim = regions[row];
    contentOrigin = regions[row + 1];
    uvec4 last = regions[row + 2];
    quarterTurn = last.x;
    uint unit = 0u;
    for (int i = 1; i < 4; i++) { if (pageUnits0[i] == last.y) { unit = uint(i); } }
    for (int i = 0; i < 4; i++) { if (pageUnits1[i] == last.y) { unit = uint(i + 4); } }
    pageOfRegion = uvec3(unit, last.zw);
}
`;

/** A draw without a region has no region table to read. */
export const sharedWebGL2SolidVertexSource = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 uv;
layout(location = 2) in vec4 light;
layout(location = 3) in vec3 dark;
layout(location = 4) in vec2 slotOpacity;
out vec2 vertexUV;
out vec4 vertexLight;
out vec3 vertexDark;
flat out float drawOpacity;
void main() {
${POSITION}
}
`;

export const sharedWebGL2SolidFragmentSource = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
in vec2 vertexUV;
in vec4 vertexLight;
in vec3 vertexDark;
flat in float drawOpacity;
layout(location = 0) out vec4 fragmentColor;

${TINTED}
void main() { fragmentColor = tinted(vec4(1.0)); }
`;

/**
 * The fragment stage of a sampled draw. The program of a batch of one page has one page sampler and reads it
 * directly; the program of a batch of several pages has eight and selects by the unit of the region's page.
 */
const sampledFragmentSource = (paged: boolean): string => `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
${paged ? [0, 1, 2, 3, 4, 5, 6, 7].map(unit => `uniform highp sampler2D page${unit};`).join('\n') : 'uniform highp sampler2D page;'}
in vec2 vertexUV;
in vec4 vertexLight;
in vec3 vertexDark;
flat in float drawOpacity;
flat in uvec4 logicalTrim;
flat in uvec4 contentOrigin;
flat in uint quarterTurn;
flat in uvec3 pageOfRegion;
layout(location = 0) out vec4 fragmentColor;

vec3 decoded(vec3 value) {
    return mix(value / 12.92, pow((value + vec3(0.055)) / 1.055, vec3(2.4)),
        greaterThan(value, vec3(0.04045)));
}

vec4 decodedPageTap(ivec2 index) {
    // Canonical rows retain their CPU order on upload. RGBA8 performs no sRGB decode.
    // Every read of a page is this one fetch${paged ? ' from the unit that holds the region\'s page' : ''}.
${paged ? `    vec4 value;
    switch (pageOfRegion.x) {
${[1, 2, 3, 4, 5, 6, 7].map(unit => `        case ${unit}u: value = texelFetch(page${unit}, index, 0); break;`).join('\n')}
        default: value = texelFetch(page0, index, 0); break;
    }` : '    vec4 value = texelFetch(page, index, 0);'}
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
    return decodedPageTap(ivec2(addressed(index.x, int(pageOfRegion.y), modes.x),
        addressed(index.y, int(pageOfRegion.z), modes.y)));
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
    switch (quarterTurn) {
        case 1u: packedCoordinate = ivec2(size.y - 1 - local.y, local.x); break;
        case 2u: packedCoordinate = size - ivec2(1) - local; break;
        case 3u: packedCoordinate = ivec2(local.y, size.x - 1 - local.x); break;
        default: break;
    }
    return decodedPageTap(ivec2(contentOrigin.zw) + packedCoordinate);
}

vec4 sampled(vec2 coordinate) {
    if (domain.w == 1u) {
        // Existing preparation bounds these interpolated texel coordinates to 8192 or 2^20.
        vec2 q = coordinate * vec2(pageOfRegion.yz);
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
    switch (quarterTurn) {
        case 1u: packedCoordinate = vec2(size.y - local.y, local.x); break;
        case 2u: packedCoordinate = size - local; break;
        case 3u: packedCoordinate = vec2(local.y, size.x - local.x); break;
        default: break;
    }
    return linearPage(vec2(contentOrigin.zw) + packedCoordinate, uvec2(0u)) * (coverage.x * coverage.y);
}

${TINTED}
void main() { fragmentColor = tinted(sampled(vertexUV)); }
`;
export const sharedWebGL2FragmentSource = sampledFragmentSource(false);
export const sharedWebGL2PagedFragmentSource = sampledFragmentSource(true);

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
