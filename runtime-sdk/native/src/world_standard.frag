// SPDX-License-Identifier: Apache-2.0
precision highp float;
in highp vec3 worldPosition;
in highp vec3 worldNormal;
uniform vec3 eye, toSun, sun, sky, ground, ambient;
uniform vec3 albedo;
in highp vec2 uv;
uniform highp sampler2D baseMap;
uniform bool hasMap;
#ifdef EGRET_SKIN_FRAME
in highp vec3 tint;
uniform highp sampler2D metalRoughMap, normalMap;
uniform bool hasMetalRough, hasNormal;
uniform vec2 normalScale;
uniform vec3 emissive;

// The source GLB has no tangents. Derive the same cotangent frame as the
// browser material, with a finite fallback for a degenerate UV chart.
vec3 mappedNormal(vec3 n) {
    vec2 a = dFdx(uv), b = dFdy(uv);
    vec3 x = cross(dFdy(worldPosition), n), y = cross(n, dFdx(worldPosition));
    vec3 t = x * a.x + y * b.x, bitangent = x * a.y + y * b.y;
    float length2 = max(dot(t,t), dot(bitangent,bitangent));
    if (length2 == 0.0) return n;
    vec3 sampleNormal = texture(normalMap, uv).xyz * 2.0 - 1.0;
    vec2 xy = sampleNormal.xy * normalScale * inversesqrt(length2);
    return normalize(t * xy.x + bitangent * xy.y + n * sampleNormal.z);
}
#endif
uniform vec2 surface; // roughness, metallic
out vec4 pixel;


#ifdef EGRET_LIT_FRAME
uniform vec3 fillDirection, fillColor, fogColor;
uniform float fogDensity;
uniform int pointCount;
uniform vec4 pointAt[8];
uniform vec3 pointColor[8];
uniform mat4 lightMatrix;
uniform vec3 shadowParams; // depth bias, normal bias, filter radius in tile UVs
uniform bool receiveShadow;
uniform highp sampler2DShadow shadowDepth;

float moonVisibility(vec3 n) {
    if (!receiveShadow) return 1.0;
    vec4 clip = lightMatrix * vec4(worldPosition + n * shadowParams.y, 1.0);
    vec3 at = clip.xyz / clip.w * 0.5 + 0.5;
    if (clip.w <= 0.0 || any(lessThan(at,vec3(0.0))) || any(greaterThan(at,vec3(1.0)))) return 1.0;
    float lit = 0.0, radius = shadowParams.z;
    for (int y=-1; y<=1; ++y) for (int x=-1; x<=1; ++x) {
        vec2 tap = clamp(at.xy + vec2(float(x),float(y))*radius, vec2(radius), vec2(1.0-radius));
        lit += texture(shadowDepth, vec3(tap, at.z-shadowParams.x));
    }
    return lit / 9.0;
}
#endif
vec3 directLight(vec3 base, vec3 diffuse, float roughness, float metallic, vec3 n, vec3 v, vec3 towards, vec3 radiance) {
    float nl = max(dot(n, towards), 0.0);
    if (nl > 0.0) {
        // The standard World3D material uses GGX visibility/distribution and
        // Schlick Fresnel. Light units match its linear WebGL2 color pass.
        vec3 h = normalize(towards + v);
        float nv = max(dot(n, v), 0.0001);
        float nh = max(dot(n, h), 0.0);
        float vh = max(dot(v, h), 0.0);
        float a = roughness * roughness, a2 = a * a;
        float term = nh * nh * (a2 - 1.0) + 1.0;
        const float pi = 3.141592653589793;
        float distribution = a2 / (pi * term * term);
        float visibility = 0.5 / max(nl * sqrt(nv * nv * (1.0-a2) + a2)
                                   + nv * sqrt(nl * nl * (1.0-a2) + a2), 0.0001);
        vec3 f0 = mix(vec3(0.04), base, metallic);
        vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
        return (diffuse * (1.0 - fresnel) + distribution * visibility * fresnel * pi) * radiance * nl;
    }
    return vec3(0.0);
}

void main() {
    // A glTF base-color texture supplies linear albedo after the GPU sRGB lookup.
    vec3 base = albedo;
    if (hasMap) base *= texture(baseMap, uv).rgb;
    vec3 n = normalize(worldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec2 factors = surface;
#ifdef EGRET_SKIN_FRAME
    base *= tint;
    if (hasMetalRough) factors *= texture(metalRoughMap, uv).gb;
    if (hasNormal) n = mappedNormal(n);
#endif
    vec3 v = normalize(eye - worldPosition);
    float roughness = clamp(factors.x, 0.045, 1.0);
    float metallic = factors.y;
    vec3 diffuse = base * (1.0 - metallic);
    vec3 result = diffuse * (ambient + mix(ground, sky, n.y * 0.5 + 0.5));
    vec3 moon = directLight(base, diffuse, roughness, metallic, n, v, toSun, sun);
#ifdef EGRET_LIT_FRAME
    result += moon * moonVisibility(n);
    result += directLight(base, diffuse, roughness, metallic, n, v, fillDirection, fillColor);
    for (int i=0; i<pointCount; ++i) {
        vec3 delta = pointAt[i].xyz - worldPosition;
        float dist = length(delta), range = pointAt[i].w;
        float w = range > 0.0 ? clamp(1.0-pow(dist/range,4.0),0.0,1.0) : 1.0;
        result += directLight(base, diffuse, roughness, metallic, n, v, delta / max(dist,0.0001),
                              pointColor[i] * (w*w/max(dist*dist,0.0001)));
    }
#else
    result += moon;
#endif
#ifdef EGRET_SKIN_FRAME
    result += emissive;
#endif
#ifdef EGRET_LIT_FRAME
    if (fogDensity > 0.0) {
        vec3 delta = eye-worldPosition;
        float visibility = exp(-fogDensity*fogDensity*dot(delta,delta));
        result = mix(fogColor, result, visibility);
    }
#endif
    // Mobile low uses ACES at unit exposure. The shared sRGB attachment encodes
    // this linear result exactly once before compositing the existing 2D HUD.
    vec3 mapped = (result * (2.51 * result + 0.03)) / (result * (2.43 * result + 0.59) + 0.14);
    pixel = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
