// SPDX-License-Identifier: Apache-2.0
precision highp float;
in highp vec3 worldPosition;
in highp vec3 worldNormal;
uniform vec3 eye, toSun, sun, sky, ground, ambient;
uniform vec3 albedo;
uniform vec2 surface; // roughness, metallic
out vec4 pixel;

void main() {
    vec3 n = normalize(worldNormal);
    vec3 v = normalize(eye - worldPosition);
    float roughness = clamp(surface.x, 0.045, 1.0);
    float metallic = surface.y;
    vec3 diffuse = albedo * (1.0 - metallic);
    vec3 result = diffuse * (ambient + mix(ground, sky, n.y * 0.5 + 0.5));
    float nl = max(dot(n, toSun), 0.0);
    if (nl > 0.0) {
        // The standard World3D material uses GGX visibility/distribution and
        // Schlick Fresnel. Light units match its linear WebGL2 color pass.
        vec3 h = normalize(toSun + v);
        float nv = max(dot(n, v), 0.0001);
        float nh = max(dot(n, h), 0.0);
        float vh = max(dot(v, h), 0.0);
        float a = roughness * roughness, a2 = a * a;
        float term = nh * nh * (a2 - 1.0) + 1.0;
        const float pi = 3.141592653589793;
        float distribution = a2 / (pi * term * term);
        float visibility = 0.5 / max(nl * sqrt(nv * nv * (1.0-a2) + a2)
                                   + nv * sqrt(nl * nl * (1.0-a2) + a2), 0.0001);
        vec3 f0 = mix(vec3(0.04), albedo, metallic);
        vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
        result += (diffuse * (1.0 - fresnel) + distribution * visibility * fresnel * pi) * sun * nl;
    }
    // Mobile low uses ACES at unit exposure. The shared sRGB attachment encodes
    // this linear result exactly once before compositing the existing 2D HUD.
    vec3 mapped = (result * (2.51 * result + 0.03)) / (result * (2.43 * result + 0.59) + 0.14);
    pixel = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
