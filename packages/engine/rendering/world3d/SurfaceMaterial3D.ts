// SPDX-License-Identifier: Apache-2.0
// Materials with a surface drawn by the shader: wood grain, stone, brick courses, plaster, brushed metal, woven cloth
// and bark, as fine as the pixels and not as the mesh. A model made in code carries its colours in its vertices, which
// cannot hold a line finer than its triangles; these add the detail between them, in colour and in relief, with no
// texture to load and no texture coordinates to lay out. The pattern is laid in world space and projected from the
// three axes, so it suits models that stay where they are put (buildings, props, scenery): on one that moves, the
// pattern stays in the world while the model moves through it.
import { World3DError } from './core3D.js';
import { createCustomShader3D, createStandardMaterial3D } from './Material3D.js';
import type { Material3D, StandardMaterialOptions3D } from './Material3D.js';

/** The surfaces the shader can draw. */
export type SurfaceKind3D = 'wood' | 'stone' | 'brick' | 'plaster' | 'metal' | 'cloth' | 'bark';

/** A material with a surface: the standard material's options and how the surface looks. */
export interface SurfaceMaterialOptions3D extends StandardMaterialOptions3D {
  readonly surface: SurfaceKind3D;
  /** How many of the pattern's units fit in one world unit; each surface has its own unless given. */
  readonly scale?: number;
  /** How much the pattern darkens and lightens the colour, 0 to 1; 0.5 unless given. */
  readonly strength?: number;
  /** How deep the relief looks under light, 0 to 1; 0.5 unless given. */
  readonly bump?: number;
}

const KINDS: Readonly<Record<SurfaceKind3D, { scale: number; roughness: number; metallic: number }>> = {
  wood: { scale: 4, roughness: 0.7, metallic: 0 },
  stone: { scale: 2, roughness: 0.9, metallic: 0 },
  brick: { scale: 3, roughness: 0.85, metallic: 0 },
  plaster: { scale: 2, roughness: 0.95, metallic: 0 },
  metal: { scale: 3, roughness: 0.35, metallic: 0.8 },
  cloth: { scale: 20, roughness: 0.9, metallic: 0 },
  bark: { scale: 4, roughness: 0.95, metallic: 0 }
};

// The height of each surface at a point p already scaled, with the world normal n for surfaces laid in a plane. The
// same function, in each shading language, gives the colour (low is darker) and the relief (its slope bends the
// normal). Heights are about 0 to 1.
const HEIGHT_GLSL: Readonly<Record<SurfaceKind3D, string>> = {
  wood: 'float r = (p.x + p.z) * 3.0 + egsFbm(p * vec3(1.5, 0.12, 1.5)) * 6.0; return 0.5 + 0.5 * sin(r);',
  stone:
    'float cracks = smoothstep(0.015, 0.06, abs(egsNoise(p * 1.3) - 0.5)); return mix(0.15, 0.55 + 0.45 * egsFbm(p * 2.0), cracks);',
  brick:
    'vec2 q = egsPlane(p, n) * vec2(1.0, 2.0); q.x += 0.5 * mod(floor(q.y), 2.0); vec2 f = abs(fract(q) - 0.5) * vec2(1.0, 0.5);' +
    ' float joint = min(0.5 - f.x, 0.25 - f.y); return smoothstep(0.0, 0.035, joint) * (0.8 + 0.2 * egsNoise(p * 6.0));',
  plaster: 'return 0.45 + 0.55 * egsFbm(p * 1.5 + egsFbm(p * 4.0));',
  metal: 'return 0.55 + 0.45 * egsNoise(p * vec3(1.0, 60.0, 1.0)) * egsNoise(p * 2.0 + 3.0);',
  cloth:
    'vec2 q = egsPlane(p, n); return 0.5 + 0.25 * (sin(q.x * 6.2832) * sin(q.y * 3.1416) + sin(q.y * 6.2832) * sin(q.x * 3.1416));',
  bark: 'float ridges = egsNoise(p * vec3(3.0, 0.35, 3.0)); return smoothstep(0.25, 0.75, ridges) * (0.7 + 0.3 * egsNoise(p * 8.0));'
};
const HEIGHT_WGSL: Readonly<Record<SurfaceKind3D, string>> = {
  wood: 'let r = (p.x + p.z) * 3.0 + egsFbm(p * vec3f(1.5, 0.12, 1.5)) * 6.0; return 0.5 + 0.5 * sin(r);',
  stone:
    'let cracks = smoothstep(0.015, 0.06, abs(egsNoise(p * 1.3) - 0.5)); return mix(0.15, 0.55 + 0.45 * egsFbm(p * 2.0), cracks);',
  brick:
    'var q = egsPlane(p, n) * vec2f(1.0, 2.0); q.x = q.x + 0.5 * (floor(q.y) - 2.0 * floor(floor(q.y) / 2.0)); let f = abs(fract(q) - vec2f(0.5)) * vec2f(1.0, 0.5);' +
    ' let joint = min(0.5 - f.x, 0.25 - f.y); return smoothstep(0.0, 0.035, joint) * (0.8 + 0.2 * egsNoise(p * 6.0));',
  plaster: 'return 0.45 + 0.55 * egsFbm(p * 1.5 + vec3f(egsFbm(p * 4.0)));',
  metal: 'return 0.55 + 0.45 * egsNoise(p * vec3f(1.0, 60.0, 1.0)) * egsNoise(p * 2.0 + vec3f(3.0));',
  cloth:
    'let q = egsPlane(p, n); return 0.5 + 0.25 * (sin(q.x * 6.2832) * sin(q.y * 3.1416) + sin(q.y * 6.2832) * sin(q.x * 3.1416));',
  bark: 'let ridges = egsNoise(p * vec3f(3.0, 0.35, 3.0)); return smoothstep(0.25, 0.75, ridges) * (0.7 + 0.3 * egsNoise(p * 8.0));'
};

const NOISE_GLSL = `
float egsHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float egsNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(egsHash(i), egsHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(egsHash(i + vec3(0.0, 1.0, 0.0)), egsHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(egsHash(i + vec3(0.0, 0.0, 1.0)), egsHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(egsHash(i + vec3(0.0, 1.0, 1.0)), egsHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float egsFbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * egsNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / 0.9375; }
vec2 egsPlane(vec3 p, vec3 n) { vec3 a = abs(n); return a.x > a.y && a.x > a.z ? p.zy : (a.z > a.y ? p.xy : p.xz); }
`;
const NOISE_WGSL = `
fn egsHash(p0: vec3f) -> f32 { var p = fract(p0 * 0.3183099 + vec3f(0.1)); p = p * 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
fn egsNoise(x: vec3f) -> f32 {
  let i = floor(x); var f = fract(x); f = f * f * (vec3f(3.0) - 2.0 * f);
  return mix(mix(mix(egsHash(i), egsHash(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(egsHash(i + vec3f(0.0, 1.0, 0.0)), egsHash(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(egsHash(i + vec3f(0.0, 0.0, 1.0)), egsHash(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(egsHash(i + vec3f(0.0, 1.0, 1.0)), egsHash(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
fn egsFbm(p0: vec3f) -> f32 { var s = 0.0; var a = 0.5; var p = p0; for (var i = 0; i < 4; i = i + 1) { s = s + a * egsNoise(p); p = p * 2.03 + vec3f(1.7, 9.2, 3.1); a = a * 0.5; } return s / 0.9375; }
fn egsPlane(p: vec3f, n: vec3f) -> vec2f { let a = abs(n); if (a.x > a.y && a.x > a.z) { return p.zy; } if (a.z > a.y) { return p.xy; } return p.xz; }
`;

/** The shader sources of a surface: its height, the colour it gives and the relief it gives, in GLSL and WGSL. */
export function surfaceShaderSources3D(kind: SurfaceKind3D): {
  glsl: string;
  wgsl: string;
  glslNormal: string;
  wgslNormal: string;
} {
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new World3DError('WORLD3D_INPUT_INVALID', 'surface');
  // custom[0]: scale, strength, bump. The slope of the height is taken across about a fiftieth of a pattern unit.
  const glslHeight = `${NOISE_GLSL}float egsHeight(vec3 p, vec3 n) { ${HEIGHT_GLSL[kind]} }\n`;
  const wgslHeight = `${NOISE_WGSL}fn egsHeight(p: vec3f, n: vec3f) -> f32 { ${HEIGHT_WGSL[kind]} }\n`;
  return {
    glsl:
      glslHeight +
      `vec4 customFragment(vec4 color, vec3 worldPosition, vec3 normal, vec2 uv) {
  float h = egsHeight(worldPosition * uCustom[0].x, normal);
  return vec4(color.rgb * mix(1.0 - 0.6 * uCustom[0].y, 1.0 + 0.15 * uCustom[0].y, h), color.a);
}`,
    wgsl:
      wgslHeight +
      `fn customFragment(color: vec4f, worldPosition: vec3f, normal: vec3f, uv: vec2f) -> vec4f {
  let h = egsHeight(worldPosition * material.custom[0].x, normal);
  return vec4f(color.rgb * mix(1.0 - 0.6 * material.custom[0].y, 1.0 + 0.15 * material.custom[0].y, h), color.a);
}`,
    // The engine places the fragment hook before the normal hook in both languages, so the normal hook uses the
    // height and noise the fragment hook defines rather than defining them twice.
    glslNormal: `vec3 customNormal(vec3 normal, vec3 worldPosition, vec2 uv) {
  float s = uCustom[0].x; float e = 0.02;
  vec3 p = worldPosition * s;
  vec3 g = vec3(egsHeight(p + vec3(e, 0.0, 0.0), normal) - egsHeight(p - vec3(e, 0.0, 0.0), normal),
                egsHeight(p + vec3(0.0, e, 0.0), normal) - egsHeight(p - vec3(0.0, e, 0.0), normal),
                egsHeight(p + vec3(0.0, 0.0, e), normal) - egsHeight(p - vec3(0.0, 0.0, e), normal)) / (2.0 * e);
  g -= normal * dot(g, normal);
  return normal - g * (0.06 * uCustom[0].z);
}`,
    wgslNormal: `fn customNormal(normal: vec3f, worldPosition: vec3f, uv: vec2f) -> vec3f {
  let s = material.custom[0].x; let e = 0.02;
  let p = worldPosition * s;
  var g = vec3f(egsHeight(p + vec3f(e, 0.0, 0.0), normal) - egsHeight(p - vec3f(e, 0.0, 0.0), normal),
                egsHeight(p + vec3f(0.0, e, 0.0), normal) - egsHeight(p - vec3f(0.0, e, 0.0), normal),
                egsHeight(p + vec3f(0.0, 0.0, e), normal) - egsHeight(p - vec3f(0.0, 0.0, e), normal)) / (2.0 * e);
  g = g - normal * dot(g, normal);
  return normal - g * (0.06 * material.custom[0].z);
}`
  };
}

/**
 * A standard material with a surface drawn by the shader, over its colour or its vertex colours (on unless
 * `vertexColors: false`): `createSurfaceMaterial3D({ surface: 'wood' })` for a crate made in code.
 */
export function createSurfaceMaterial3D(options: SurfaceMaterialOptions3D): Material3D {
  if (options === null || typeof options !== 'object')
    throw new World3DError('WORLD3D_INPUT_INVALID', 'surface options');
  const kind = options.surface;
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new World3DError('WORLD3D_INPUT_INVALID', 'surface');
  const defaults = KINDS[kind];
  const amount = (value: unknown, fallback: number, what: string, max = 1): number => {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)
      throw new World3DError('WORLD3D_INPUT_INVALID', what);
    return value;
  };
  const scale = amount(options.scale, defaults.scale, 'surface scale', 1000);
  if (scale === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'surface scale');
  const strength = amount(options.strength, 0.5, 'surface strength'),
    bump = amount(options.bump, 0.5, 'surface bump');
  const { surface: _surface, scale: _scale, strength: _strength, bump: _bump, ...rest } = options;
  const material = createStandardMaterial3D({
    roughness: defaults.roughness,
    metallic: defaults.metallic,
    vertexColors: true,
    ...rest
  });
  material.shader = createCustomShader3D({
    key: 'surface-' + kind,
    ...surfaceShaderSources3D(kind),
    uniforms: [scale, strength, bump, 0]
  });
  return material;
}
