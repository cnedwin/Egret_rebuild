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
 * What a draw writes to its target. A target that mixes light takes the linear premultiplied colour as it is; one
 * that mixes the stored codes, as a 2D canvas does, takes the colour encoded and then multiplied by its alpha.
 * Light added with no alpha, as an additive draw may give, is encoded as it is.
 */
const finished = (srgb: boolean): string =>
  srgb
    ? `vec4 finished(vec4 c) {
    float a = clamp(c.a, 0.0, 1.0);
    vec3 u = clamp(a > 0.0 ? c.rgb / a : c.rgb, vec3(0.0), vec3(1.0));
    vec3 e = mix(12.92 * u, 1.055 * pow(u, vec3(1.0 / 2.4)) - vec3(0.055), greaterThan(u, vec3(0.0031308)));
    return vec4(a > 0.0 ? a * e : e, a);
}
`
    : `vec4 finished(vec4 c) { return c; }
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

/** The fragment stage of a draw without a region, for a target that mixes light or one that mixes codes. */
export const sharedWebGL2SolidFragment = (srgb: boolean): string => `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORM}
in vec2 vertexUV;
in vec4 vertexLight;
in vec3 vertexDark;
flat in float drawOpacity;
layout(location = 0) out vec4 fragmentColor;

${TINTED}
${finished(srgb)}
void main() { fragmentColor = finished(tinted(vec4(1.0))); }
`;
export const sharedWebGL2SolidFragmentSource = sharedWebGL2SolidFragment(false);

/**
 * A draw whose material asks for smaller copies reads them when it is drawn smaller than its texels: `rho` is
 * how many texels one pixel spans. Level 0 is the sample as it is without them; a deeper level is read with the
 * same bilinear rule on that level's texels, and two levels next to each other are blended. Word 9 of the
 * block is the deepest level the draw may read and word 10 how it finds its texels there: by the size of the
 * level (1), or, for a region on a page shared with others, by halving every edge of the region (0).
 */
const MIPMAPPED = `vec4 levelPage(vec2 q, int level, uvec2 modes) {
    ivec2 size = max(ivec2(1), ivec2(pageOfRegion.yz) >> level);
    vec2 shifted = q * vec2(size) / vec2(pageOfRegion.yz) - vec2(0.5);
    ivec2 base = ivec2(floor(shifted));
    vec2 weight = fract(shifted);
    vec4 taps[4];
    for (int i = 0; i < 4; i++) {
        ivec2 at = base + ivec2(i & 1, i >> 1);
        taps[i] = decodedLevelTap(ivec2(addressed(at.x, size.x, modes.x), addressed(at.y, size.y, modes.y)), level);
    }
    return mix(mix(taps[0], taps[1], weight.x), mix(taps[2], taps[3], weight.x), weight.y);
}

vec4 levelRegionTap(ivec2 logical, int level) {
    ivec2 extent = ivec2(logicalTrim.xy) >> level;
    ivec2 index = clamp(logical, ivec2(0), extent - ivec2(1));
    ivec2 local = index - (ivec2(logicalTrim.zw) >> level);
    ivec2 size = ivec2(contentOrigin.xy) >> level;
    if (any(lessThan(local, ivec2(0))) || any(greaterThanEqual(local, size))) { return vec4(0.0); }
    ivec2 packedCoordinate = local;
    switch (quarterTurn) {
        case 1u: packedCoordinate = ivec2(size.y - 1 - local.y, local.x); break;
        case 2u: packedCoordinate = size - ivec2(1) - local; break;
        case 3u: packedCoordinate = ivec2(local.y, size.x - 1 - local.x); break;
        default: break;
    }
    return decodedLevelTap((ivec2(contentOrigin.zw) >> level) + packedCoordinate, level);
}

vec4 atLevel(vec2 coordinate, int level) {
    if (domain.w == 1u) { return levelPage(coordinate * vec2(pageOfRegion.yz), level, samplerPolicy.xy); }
    vec2 extent = vec2(logicalTrim.xy);
    vec2 q = clamp(coordinate * extent, vec2(0.0), extent);
    if (domain.z == 1u) { return levelPage(q, level, uvec2(0u)); }
    vec2 shifted = q / float(1 << level) - vec2(0.5);
    ivec2 base = ivec2(floor(shifted));
    vec2 weight = fract(shifted);
    return mix(mix(levelRegionTap(base, level), levelRegionTap(base + ivec2(1, 0), level), weight.x),
        mix(levelRegionTap(base + ivec2(0, 1), level), levelRegionTap(base + ivec2(1, 1), level), weight.x), weight.y);
}

vec4 mipmapped(vec4 top, vec2 coordinate, float rho) {
    int deepest = int(domain.y);
    float lod = clamp(log2(max(rho, 1e-6)), 0.0, float(deepest));
    if (lod <= 0.0) { return top; }
    int level = int(floor(lod));
    float blend = lod - float(level);
    vec4 near = level == 0 ? top : atLevel(coordinate, level);
    if (level >= deepest || blend == 0.0) { return near; }
    return mix(near, atLevel(coordinate, level + 1), blend);
}`;

/**
 * The fragment stage of a sampled draw. The program of a batch of one page has one page sampler and reads it
 * directly; the program of a batch of several pages has eight and selects by the unit of the region's page.
 */
/** The fragment stage of a sampled draw, of one page or several, for a target that mixes light or codes. */
export const sampledFragmentSource = (paged: boolean, srgb: boolean): string => `#version 300 es
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

vec4 decodedLevelTap(ivec2 index, int level) {
    // Canonical rows retain their CPU order on upload. RGBA8 performs no sRGB decode.
    // Every read of a page is this one fetch${paged ? " from the unit that holds the region's page" : ''}.
${
  paged
    ? `    vec4 value;
    switch (pageOfRegion.x) {
${[1, 2, 3, 4, 5, 6, 7].map(unit => `        case ${unit}u: value = texelFetch(page${unit}, index, level); break;`).join('\n')}
        default: value = texelFetch(page0, index, level); break;
    }`
    : '    vec4 value = texelFetch(page, index, level);'
}
    return vec4(decoded(value.rgb), value.a);
}

vec4 decodedPageTap(ivec2 index) { return decodedLevelTap(index, 0); }

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

${MIPMAPPED}
${TINTED}
${finished(srgb)}
void main() {
    // Derivatives are taken here, where every fragment of the draw runs: the block is the same for all of them.
    vec2 extent = domain.w == 1u ? vec2(pageOfRegion.yz) : vec2(logicalTrim.xy);
    vec2 texels = vertexUV * extent;
    float rho = max(length(dFdx(texels)), length(dFdy(texels)));
    vec4 value = sampled(vertexUV);
    if (domain.x == 1u) { value = mipmapped(value, vertexUV, rho); }
    fragmentColor = finished(tinted(value));
}
`;
export const sharedWebGL2FragmentSource = sampledFragmentSource(false, false);
export const sharedWebGL2PagedFragmentSource = sampledFragmentSource(true, false);

export const sharedWebGL2ResolveVertexSource = `#version 300 es
precision highp float;
precision highp int;
void main() {
    vec2 position = gl_VertexID == 0 ? vec2(-1.0, -1.0) :
        (gl_VertexID == 1 ? vec2(3.0, -1.0) : vec2(-1.0, 3.0));
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * Writes the working target to the canvas as it stores colour there: light encoded at the end, or, for a target
 * that mixes codes, the codes as they are.
 */
export const sharedWebGL2ResolveFragment = (srgb: boolean): string => `#version 300 es
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
    // SRGB8_ALPHA8 integer fetch already decodes RGB; an RGBA8 target holds codes. Both targets use the same GL row.
    vec4 value = texelFetch(workingTexture, ivec2(gl_FragCoord.xy), 0);
    if (opaque) {
        fragmentColor = vec4(${srgb ? 'clamp(value.rgb, vec3(0.0), vec3(1.0))' : 'encoded(clamp(value.rgb, vec3(0.0), vec3(1.0)))'}, 1.0);
        return;
    }
    float a = clamp(value.a, 0.0, 1.0);
    vec3 c = clamp(value.rgb, vec3(0.0), vec3(a));
    if (a == 0.0) { fragmentColor = vec4(0.0); }
    else { fragmentColor = ${srgb ? 'vec4(c, a)' : 'vec4(a * encoded(c / a), a)'}; }
}
`;
export const sharedWebGL2ResolveFragmentSource = sharedWebGL2ResolveFragment(false);

/** FUNC_ADD for RGB and alpha; admission separately restricts add-preserve to opaque output. */
export function sharedWebGL2BlendFactors(blend: SharedMaterial2D['blend']): readonly [number, number, number, number] {
  switch (blend) {
    case 'normal':
      return [1, 771, 1, 771];
    case 'add-accumulate':
      return [1, 1, 1, 1];
    case 'add-preserve':
      return [1, 1, 0, 1];
    case 'multiply-factor':
      return [774, 771, 1, 771];
    case 'screen':
      return [1, 769, 1, 771];
    // What is drawn takes away from what is there, by its alpha, and adds nothing.
    case 'erase':
      return [0, 771, 0, 771];
    default:
      throw new TypeError('Unsupported shared blend');
  }
}
