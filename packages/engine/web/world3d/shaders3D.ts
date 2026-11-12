// SPDX-License-Identifier: Apache-2.0
// First-party GLSL ES 3.00 shader library for the WebGL2 world3d renderer.
// One vertex and one fragment source are specialized through #define lists,
// so every material variant shares the same attribute and uniform contract.

/** Fixed vertex attribute locations shared by every program and vertex array. */
export const ATTRIBUTE_LOCATIONS_3D = Object.freeze({
    position: 0, normal: 1, uv: 2, tangent: 3, color: 4, joints: 5, weights: 6, uv1: 7,
    instanceMatrix: 8, instanceColor: 12,
} as const);

/** Fixed texture units; samplers are assigned once when a program is linked. */
export const TEXTURE_UNITS_3D = Object.freeze({
    map: 0, normalMap: 1, metallicRoughnessMap: 2, occlusionMap: 3, emissiveMap: 4,
    environment: 5, shadow: 6, bones: 7, morph: 8, lightMap: 9,
} as const);

export const MAX_MORPH_INFLUENCES_3D = 8;

const FRAME_BLOCK = /* glsl */`
layout(std140) uniform Frame {
    mat4 uViewProjection;
    mat4 uView;
    vec4 uCameraPosition;
    vec4 uFogColor;
    vec4 uFogParams;       // x: 0 none, 1 linear, 2 exponential; y: near or density; z: far
    vec4 uAmbient;
    vec4 uHemisphereSky;
    vec4 uHemisphereGround;
    vec4 uLightCounts;     // directional, point, spot
    vec4 uDirectionalDirection[4]; // xyz: travel direction; w: shadow slot or -1
    vec4 uDirectionalColor[4];
    vec4 uPointPosition[8];        // w: range, 0 = unbounded
    vec4 uPointColor[8];
    vec4 uSpotPosition[4];         // w: range
    vec4 uSpotDirection[4];        // w: shadow slot or -1
    vec4 uSpotColor[4];
    vec4 uSpotCone[4];             // x: cos(outer), y: cos(inner)
    mat4 uShadowMatrix[4];
    vec4 uShadowRect[4];           // atlas uv offset (xy) and scale (zw)
    vec4 uShadowParams[4];         // x: depth bias, y: normal bias, z: filter radius in atlas uv
    vec4 uOutput;                  // x: environment intensity, y: environment max mip, z: exposure, w: tone mapping
    vec4 uCascadeSplits;           // view-space far distance of each cascade
    vec4 uCascadeInfo;             // x: cascaded directional light index or -1, y: cascade count, z: blend fraction
    vec4 uPointShadow;             // x: shadowed point light index or -1, y: first of its four slots
    vec4 uClipPlanes[4];           // world-space planes; the negative side is discarded
    vec4 uClipInfo;                // x: plane count
};
`;

const VERTEX_SOURCE = /* glsl */`
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 3) in vec4 aTangent;
layout(location = 4) in vec4 aColor;
layout(location = 5) in uvec4 aJoints;
layout(location = 6) in vec4 aWeights;
layout(location = 7) in vec2 aUv1;
layout(location = 8) in mat4 aInstanceMatrix;
layout(location = 12) in vec4 aInstanceColor;
${FRAME_BLOCK}
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
uniform mat3 uUvTransform;
#ifdef DEPTH_ONLY
uniform mat4 uDepthViewProjection;
#endif
#ifdef USE_SKINNING
uniform highp sampler2D uBoneTexture;
uniform mat4 uBindMatrix;
#endif
#ifdef USE_MORPH
uniform highp sampler2D uMorphTexture;
uniform ivec3 uMorphLayout;      // vertex count, texture width, attributes per target
uniform int uMorphCount;
uniform int uMorphIndices[${MAX_MORPH_INFLUENCES_3D}];
uniform float uMorphWeights[${MAX_MORPH_INFLUENCES_3D}];
#endif
#ifdef BILLBOARD
uniform vec4 uSprite;            // x: rotation, y: size attenuation flag
#endif
#ifdef POINTS
uniform vec2 uPointSize;         // x: size in pixels, y: size attenuation flag
#endif
out vec3 vWorldPosition;
out vec3 vNormal;
out vec2 vUv;
out vec2 vUv1;
out vec4 vTangent;
out vec4 vColor;

#ifdef USE_SKINNING
mat4 boneMatrix(uint index) {
    int row = int(index);
    return mat4(texelFetch(uBoneTexture, ivec2(0, row), 0), texelFetch(uBoneTexture, ivec2(1, row), 0),
        texelFetch(uBoneTexture, ivec2(2, row), 0), texelFetch(uBoneTexture, ivec2(3, row), 0));
}
#endif
#ifdef USE_MORPH
vec3 morphDelta(int targetIndex, int channel) {
    int texel = (targetIndex * uMorphLayout.z + channel) * uMorphLayout.x + gl_VertexID;
    return texelFetch(uMorphTexture, ivec2(texel % uMorphLayout.y, texel / uMorphLayout.y), 0).xyz;
}
#endif

#ifdef CUSTOM_VERTEX
uniform vec4 uCustom[4];
/*CUSTOM_VERTEX*/
#endif
void main() {
    vec3 position = aPosition;
    vec3 normal = aNormal;
    #ifdef USE_MORPH
    for (int i = 0; i < uMorphCount; i++) {
        position += morphDelta(uMorphIndices[i], 0) * uMorphWeights[i];
        #ifdef USE_MORPH_NORMALS
        normal += morphDelta(uMorphIndices[i], 1) * uMorphWeights[i];
        #endif
    }
    #endif
    mat4 model = uModel;
    mat3 normalMatrix = uNormalMatrix;
    #ifdef USE_SKINNING
    mat4 skin = aWeights.x * boneMatrix(aJoints.x) + aWeights.y * boneMatrix(aJoints.y)
        + aWeights.z * boneMatrix(aJoints.z) + aWeights.w * boneMatrix(aJoints.w);
    model = skin * uBindMatrix;
    normalMatrix = mat3(model);
    #endif
    #ifdef USE_INSTANCING
    model = model * aInstanceMatrix;
    normalMatrix = normalMatrix * mat3(aInstanceMatrix);
    #endif
    vec4 world = model * vec4(position, 1.0);
    #ifdef CUSTOM_VERTEX
    #ifdef USE_VERTEX_COLOR
    world.xyz = customVertex(world.xyz, position, normal, aUv, aColor);
    #else
    world.xyz = customVertex(world.xyz, position, normal, aUv, vec4(1.0));
    #endif
    #endif
    #ifdef DEPTH_ONLY
    mat4 viewProjection = uDepthViewProjection;
    #else
    mat4 viewProjection = uViewProjection;
    #endif
    #ifdef SCREEN_SPACE
    // Positions are already in normalized device coordinates.
    world = vec4(uCameraPosition.xyz, 1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
    #elif defined(BILLBOARD)
    // Expand the quad in view space around the transformed node origin.
    vec4 center = uView * (model * vec4(0.0, 0.0, 0.0, 1.0));
    vec2 scale = vec2(length(model[0].xyz), length(model[1].xyz));
    if (uSprite.y < 0.5) scale *= -center.z;
    float c = cos(uSprite.x), s = sin(uSprite.x);
    vec2 corner = position.xy * scale;
    center.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
    world = inverse(uView) * center;
    gl_Position = viewProjection * world;
    normal = vec3(0.0, 0.0, 1.0);
    normalMatrix = transpose(mat3(uView));
    #else
    gl_Position = viewProjection * world;
    #endif
    #ifdef POINTS
    gl_PointSize = uPointSize.y > 0.5 ? uPointSize.x / max(gl_Position.w, 0.0001) : uPointSize.x;
    #endif
    vWorldPosition = world.xyz;
    vNormal = normalMatrix * normal;
    vUv = (uUvTransform * vec3(aUv, 1.0)).xy;
    vUv1 = aUv1;
    vTangent = vec4(mat3(model) * aTangent.xyz, aTangent.w);
    vColor = vec4(1.0);
    #ifdef USE_VERTEX_COLOR
    vColor = aColor;
    #endif
    #ifdef USE_INSTANCE_COLOR
    vColor *= aInstanceColor;
    #endif
}
`;

const FRAGMENT_SOURCE = /* glsl */`
${FRAME_BLOCK}
uniform vec4 uColor;             // linear rgb and opacity
uniform vec3 uEmissive;
uniform vec4 uSurface;           // metallic, roughness, normal scale, occlusion strength
uniform vec4 uSpecular;          // rgb and shininess
uniform float uAlphaCutoff;
uniform vec2 uClearcoat;         // strength and roughness
uniform float uEnvironmentScale;
uniform sampler2D uMap;
uniform sampler2D uNormalMap;
uniform sampler2D uMetallicRoughnessMap;
uniform sampler2D uOcclusionMap;
uniform sampler2D uEmissiveMap;
uniform sampler2D uLightMap;
uniform vec4 uSheen;             // color scaled by strength, roughness
uniform vec2 uExtra;             // light map intensity, transmission
uniform samplerCube uEnvironment;
uniform highp sampler2DShadow uShadowMap;
in vec3 vWorldPosition;
in vec3 vNormal;
in vec2 vUv;
in vec2 vUv1;
in vec4 vTangent;
in vec4 vColor;
out vec4 outColor;

const float PI = 3.141592653589793;

#ifndef DEPTH_ONLY
vec3 surfaceNormal() {
    #if defined(FLAT_SHADED) || !defined(USE_NORMAL)
    vec3 n = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    #else
    vec3 n = normalize(vNormal);
    #ifdef DOUBLE_SIDED
    if (!gl_FrontFacing) n = -n;
    #endif
    #endif
    #ifdef USE_NORMAL_MAP
    vec3 mapped = texture(uNormalMap, vUv).xyz * 2.0 - 1.0;
    mapped.xy *= uSurface.z;
    #ifdef USE_TANGENT
    vec3 t = normalize(vTangent.xyz);
    vec3 b = cross(n, t) * vTangent.w;
    #else
    // Derive a cotangent frame from screen-space derivatives.
    vec3 dp1 = dFdx(vWorldPosition), dp2 = dFdy(vWorldPosition);
    vec2 duv1 = dFdx(vUv), duv2 = dFdy(vUv);
    vec3 dp2perp = cross(dp2, n), dp1perp = cross(n, dp1);
    vec3 t = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 b = dp2perp * duv1.y + dp1perp * duv2.y;
    float invmax = inversesqrt(max(dot(t, t), dot(b, b)));
    t *= invmax; b *= invmax;
    #endif
    n = normalize(mat3(t, b, n) * mapped);
    #endif
    return n;
}

#ifdef RECEIVE_SHADOW
float shadowFactor(int slot, vec3 normal) {
    vec4 params = uShadowParams[slot];
    vec4 clip = uShadowMatrix[slot] * vec4(vWorldPosition + normal * params.y, 1.0);
    vec3 ndc = clip.xyz / clip.w * 0.5 + 0.5;
    if (clip.w <= 0.0 || any(lessThan(ndc, vec3(0.0))) || any(greaterThan(ndc, vec3(1.0)))) return 1.0;
    vec4 rect = uShadowRect[slot];
    float depth = ndc.z - params.x;
    vec2 lower = rect.xy + params.z, upper = rect.xy + rect.zw - params.z;
    float lit = 0.0;
    // 3x3 taps on top of hardware 2x2 comparison filtering.
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 uv = clamp(rect.xy + ndc.xy * rect.zw + vec2(float(x), float(y)) * params.z, lower, upper);
            lit += texture(uShadowMap, vec3(uv, depth));
        }
    }
    return lit / 9.0;
}
float pointShadowFactor(int slot, vec3 fromLight, vec3 normal) {
    // Faces of the tetrahedron the four maps were rendered through.
    const float k = 0.5773502691896258;
    float d0 = dot(fromLight, vec3(k, k, k)), d1 = dot(fromLight, vec3(-k, -k, k)), d2 = dot(fromLight, vec3(-k, k, -k)), d3 = dot(fromLight, vec3(k, -k, -k));
    int face = 0; float best = d0;
    if (d1 > best) { best = d1; face = 1; }
    if (d2 > best) { best = d2; face = 2; }
    if (d3 > best) face = 3;
    return shadowFactor(slot + face, normal);
}
float cascadedShadowFactor(int slot, vec3 normal) {
    float viewDepth = -(uView * vec4(vWorldPosition, 1.0)).z;
    int count = int(uCascadeInfo.y), cascade = 0;
    for (int c = 0; c < 3; c++) if (c < count - 1 && viewDepth > uCascadeSplits[c]) cascade = c + 1;
    float edge = uCascadeSplits[cascade];
    if (viewDepth >= edge) return 1.0;
    float visible = shadowFactor(slot + cascade, normal);
    // Blend into the next cascade, or out to unshadowed past the last one.
    float t = smoothstep(edge * (1.0 - uCascadeInfo.z), edge, viewDepth);
    if (t > 0.0) visible = mix(visible, cascade < count - 1 ? shadowFactor(slot + cascade + 1, normal) : 1.0, t);
    return visible;
}
#endif

float rangeFalloff(float dist, float range) {
    float inverseSquare = 1.0 / max(dist * dist, 0.0001);
    if (range <= 0.0) return inverseSquare;
    float ratio = dist / range;
    float window = clamp(1.0 - ratio * ratio * ratio * ratio, 0.0, 1.0);
    return inverseSquare * window * window;
}

struct Surface {
    vec3 albedo;
    vec3 normal;
    vec3 view;
    vec3 f0;
    float roughness;
    float metallic;
};

// Radiance leaving the surface for one light of unit-normalized direction l.
vec3 shade(Surface s, vec3 l, vec3 radiance) {
    float nl = max(dot(s.normal, l), 0.0);
    if (nl <= 0.0) return vec3(0.0);
    #if defined(SHADING_LAMBERT)
    return s.albedo * radiance * nl;
    #elif defined(SHADING_TOON)
    // uSpecular.w carries the band count for toon shading.
    return s.albedo * radiance * (ceil(nl * uSpecular.w - 0.001) / max(uSpecular.w, 1.0));
    #elif defined(SHADING_PHONG)
    vec3 h = normalize(l + s.view);
    float specular = pow(max(dot(s.normal, h), 0.0), max(uSpecular.w, 1.0));
    return (s.albedo + uSpecular.rgb * specular) * radiance * nl;
    #else
    vec3 h = normalize(l + s.view);
    float nv = max(dot(s.normal, s.view), 0.0001), nh = max(dot(s.normal, h), 0.0), vh = max(dot(s.view, h), 0.0);
    float a = s.roughness * s.roughness, a2 = a * a;
    float d = nh * nh * (a2 - 1.0) + 1.0;
    float distribution = a2 / (PI * d * d);
    float visibility = 0.5 / max(nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2), 0.0001);
    vec3 fresnel = s.f0 + (1.0 - s.f0) * pow(1.0 - vh, 5.0);
    vec3 diffuse = s.albedo * (1.0 - s.metallic) * (1.0 - fresnel);
    // Light units are scaled by PI so a unit white light fully lights a white diffuse surface.
    vec3 lit = diffuse + distribution * visibility * fresnel * PI;
    if (uSheen.r + uSheen.g + uSheen.b > 0.0) {
        // Cloth lobe: an inverted Gaussian that brightens toward grazing angles.
        float inverse = 1.0 / max(uSheen.w, 0.07);
        lit += uSheen.rgb * ((2.0 + inverse) * pow(max(1.0 - nh * nh, 0.0), inverse * 0.5) / (2.0 * PI)) / (4.0 * (nl + nv - nl * nv)) * PI;
    }
    if (uClearcoat.x > 0.0) {
        // A second, dielectric lobe on top; the base layer loses what the coat reflects.
        float ca = max(uClearcoat.y, 0.045); ca *= ca;
        float ca2 = ca * ca, cd = nh * nh * (ca2 - 1.0) + 1.0;
        float coatFresnel = (0.04 + 0.96 * pow(1.0 - vh, 5.0)) * uClearcoat.x;
        lit = lit * (1.0 - coatFresnel) + ca2 / (PI * cd * cd) * (0.25 / max(vh * vh, 0.0001)) * coatFresnel * PI;
    }
    return lit * radiance * nl;
    #endif
}

#ifdef CUSTOM_FRAGMENT
uniform vec4 uCustom[4];
/*CUSTOM_FRAGMENT*/
#endif

vec3 toneMap(vec3 color) {
    color *= uOutput.z;
    if (uOutput.w > 1.5) {
        // Filmic curve fit commonly used for ACES-like output.
        color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    } else if (uOutput.w > 0.5) color = color / (1.0 + color);
    return color;
}
vec3 encodeSrgb(vec3 color) {
    color = clamp(color, 0.0, 1.0);
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}
#endif

void main() {
    #ifndef DEPTH_ONLY
    for (int i = 0; i < int(uClipInfo.x); i++) if (dot(vWorldPosition, uClipPlanes[i].xyz) + uClipPlanes[i].w < 0.0) discard;
    #endif
    vec4 base = uColor * vColor;
    #ifdef USE_MAP
    vec4 mapColor = texture(uMap, vUv);
    #ifdef MAP_FROM_TARGET
    // Target pixels carry alpha-weighted RGB. Material shading uses straight color.
    mapColor.rgb = mapColor.a > 0.0 ? mapColor.rgb / mapColor.a : vec3(0.0);
    #endif
    base *= mapColor;
    #endif
    #ifdef POINTS
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    #endif
    #ifdef ALPHA_MASK
    if (base.a < uAlphaCutoff) discard;
    #endif
    #ifdef DEPTH_ONLY
    #ifdef ALPHA_BLEND
    if (base.a < 0.5) discard;
    #endif
    outColor = vec4(1.0);
    #else
    vec3 color;
    #ifdef SHADING_UNLIT
    color = base.rgb;
    #elif defined(SHADING_MATCAP)
    vec3 viewNormal = normalize(mat3(uView) * surfaceNormal());
    color = base.rgb * texture(uEmissiveMap, viewNormal.xy * 0.5 + 0.5).rgb;
    #else
    Surface s;
    s.normal = surfaceNormal();
    s.view = normalize(uCameraPosition.xyz - vWorldPosition);
    s.albedo = base.rgb;
    s.metallic = uSurface.x;
    s.roughness = uSurface.y;
    #ifdef USE_MR_MAP
    vec4 mr = texture(uMetallicRoughnessMap, vUv);
    s.metallic *= mr.b;
    s.roughness *= mr.g;
    #endif
    s.roughness = clamp(s.roughness, 0.045, 1.0);
    s.f0 = mix(vec3(0.04), s.albedo, s.metallic);
    float occlusion = 1.0;
    #ifdef USE_AO_MAP
    #ifdef AO_UV1
    occlusion = mix(1.0, texture(uOcclusionMap, vUv1).r, uSurface.w);
    #else
    occlusion = mix(1.0, texture(uOcclusionMap, vUv).r, uSurface.w);
    #endif
    #endif

    // Indirect light: ambient, hemisphere and optional environment map.
    vec3 diffuseAlbedo = s.albedo;
    #ifdef SHADING_STANDARD
    diffuseAlbedo *= 1.0 - s.metallic;
    #endif
    vec3 irradiance = uAmbient.rgb + mix(uHemisphereGround.rgb, uHemisphereSky.rgb, s.normal.y * 0.5 + 0.5);
    #ifdef USE_ENVIRONMENT
    irradiance += textureLod(uEnvironment, s.normal, uOutput.y).rgb * uOutput.x * uEnvironmentScale;
    #endif
    #ifdef USE_LIGHT_MAP
    #ifdef LIGHT_UV1
    irradiance += texture(uLightMap, vUv1).rgb * uExtra.x;
    #else
    irradiance += texture(uLightMap, vUv).rgb * uExtra.x;
    #endif
    #endif
    #ifdef SHADING_STANDARD
    // Transmission: light passes straight through where the surface faces the viewer.
    base.a *= 1.0 - uExtra.y * (1.0 - s.metallic) * (1.0 - pow(1.0 - max(dot(s.normal, s.view), 0.0), 5.0));
    #endif
    color = diffuseAlbedo * irradiance * occlusion;
    #if defined(USE_ENVIRONMENT) && defined(SHADING_STANDARD)
    {
        vec3 reflected = reflect(-s.view, s.normal);
        float nv = max(dot(s.normal, s.view), 0.0);
        vec3 prefiltered = textureLod(uEnvironment, reflected, s.roughness * uOutput.y).rgb * uOutput.x * uEnvironmentScale;
        // Analytic approximation of the split-sum environment BRDF.
        vec4 r = s.roughness * vec4(-1.0, -0.0275, -0.572, 0.022) + vec4(1.0, 0.0425, 1.04, -0.04);
        float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
        vec2 scaleBias = vec2(-1.04, 1.04) * a004 + r.zw;
        color += prefiltered * (s.f0 * scaleBias.x + scaleBias.y) * occlusion;
    }
    #endif

    int directionalCount = int(uLightCounts.x), pointCount = int(uLightCounts.y), spotCount = int(uLightCounts.z);
    for (int i = 0; i < directionalCount; i++) {
        float visible = 1.0;
        #ifdef RECEIVE_SHADOW
        if (uDirectionalDirection[i].w >= 0.0) {
            visible = float(i) == uCascadeInfo.x ? cascadedShadowFactor(int(uDirectionalDirection[i].w), s.normal) : shadowFactor(int(uDirectionalDirection[i].w), s.normal);
        }
        #endif
        if (visible > 0.0) color += shade(s, -uDirectionalDirection[i].xyz, uDirectionalColor[i].rgb) * visible;
    }
    for (int i = 0; i < pointCount; i++) {
        vec3 toLight = uPointPosition[i].xyz - vWorldPosition;
        float dist = length(toLight);
        float visible = 1.0;
        #ifdef RECEIVE_SHADOW
        if (float(i) == uPointShadow.x) visible = pointShadowFactor(int(uPointShadow.y), -toLight, s.normal);
        #endif
        color += shade(s, toLight / max(dist, 0.0001), uPointColor[i].rgb * rangeFalloff(dist, uPointPosition[i].w)) * visible;
    }
    for (int i = 0; i < spotCount; i++) {
        vec3 toLight = uSpotPosition[i].xyz - vWorldPosition;
        float dist = length(toLight);
        vec3 l = toLight / max(dist, 0.0001);
        float cone = smoothstep(uSpotCone[i].x, uSpotCone[i].y, dot(-l, uSpotDirection[i].xyz));
        if (cone <= 0.0) continue;
        float visible = 1.0;
        #ifdef RECEIVE_SHADOW
        if (uSpotDirection[i].w >= 0.0) visible = shadowFactor(int(uSpotDirection[i].w), s.normal);
        #endif
        color += shade(s, l, uSpotColor[i].rgb * rangeFalloff(dist, uSpotPosition[i].w) * cone) * visible;
    }
    #endif

    #ifndef SHADING_MATCAP
    vec3 emissive = uEmissive;
    #ifdef USE_EMISSIVE_MAP
    #ifdef EMISSIVE_UV1
    emissive *= texture(uEmissiveMap, vUv1).rgb;
    #else
    emissive *= texture(uEmissiveMap, vUv).rgb;
    #endif
    #endif
    color += emissive;
    #endif

    #ifdef CUSTOM_FRAGMENT
    vec4 customized = customFragment(vec4(color, base.a), vWorldPosition, normalize(vNormal), vUv);
    color = customized.rgb; base.a = customized.a;
    #endif
    #ifdef USE_FOG
    if (uFogParams.x > 0.5) {
        float dist = length(uCameraPosition.xyz - vWorldPosition);
        float fog = uFogParams.x > 1.5 ? 1.0 - exp(-uFogParams.y * uFogParams.y * dist * dist)
            : smoothstep(uFogParams.y, uFogParams.z, dist);
        color = mix(color, uFogColor.rgb, clamp(fog, 0.0, 1.0));
    }
    #endif
    #ifdef TONE_MAPPED
    color = toneMap(color);
    #endif
    #ifdef LINEAR_OUTPUT
    // sRGB render targets encode on write; hand them linear values. Fixed-point
    // targets clamp by themselves, and half-float targets must keep values above 1.
    color = max(color, vec3(0.0));
    #else
    color = encodeSrgb(color);
    #endif
    #ifdef ALPHA_BLEND
    #ifdef PREMULTIPLIED_ALPHA
    color *= base.a;
    #endif
    outColor = vec4(color, base.a);
    #else
    outColor = vec4(color, 1.0);
    #endif
    #endif
}
`;

export interface ShaderSources3D {
    readonly vertex: string;
    readonly fragment: string;
}
/** Specialize the material shader pair with a list of preprocessor symbols. */
export function buildMaterialShader3D(defines: readonly string[], customFragment = '', customVertex = ''): ShaderSources3D {
    const header = '#version 300 es\nprecision highp float;\nprecision highp int;\n' + defines.map(name => '#define ' + name + '\n').join('');
    return {vertex: header + VERTEX_SOURCE.replace('/*CUSTOM_VERTEX*/', () => customVertex), fragment: header + FRAGMENT_SOURCE.replace('/*CUSTOM_FRAGMENT*/', () => customFragment)};
}

/** Full-screen triangle that samples a cube map along the view ray; drawn at the far plane. */
export const SKYBOX_SHADER_3D: ShaderSources3D = Object.freeze({
    vertex: /* glsl */`#version 300 es
precision highp float;
uniform mat4 uInverseViewProjection;
out vec3 vDirection;
void main() {
    vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
    vec4 far = uInverseViewProjection * vec4(corner, 1.0, 1.0);
    vec4 near = uInverseViewProjection * vec4(corner, -1.0, 1.0);
    vDirection = far.xyz / far.w - near.xyz / near.w;
    gl_Position = vec4(corner, 1.0, 1.0);
}
`,
    fragment: /* glsl */`#version 300 es
precision highp float;
uniform samplerCube uEnvironment;
uniform vec4 uOutput; // x: intensity, y: 1 keeps linear output, z: exposure, w: tone mapping
in vec3 vDirection;
out vec4 outColor;
void main() {
    vec3 color = texture(uEnvironment, normalize(vDirection)).rgb * uOutput.x * uOutput.z;
    if (uOutput.w > 1.5) color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    else if (uOutput.w > 0.5) color = color / (1.0 + color);
    color = clamp(color, 0.0, 1.0);
    if (uOutput.y < 0.5) color = mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
    outColor = vec4(color, 1.0);
}
`,
});
