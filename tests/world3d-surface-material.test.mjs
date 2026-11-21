// SPDX-License-Identifier: Apache-2.0
// Materials whose surface (wood, stone, brick, plaster, metal, cloth, bark) is drawn by the shader in both languages.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSurfaceMaterial3D, surfaceShaderSources3D } from '@egret/engine/world3d';

const KINDS = ['wood', 'stone', 'brick', 'plaster', 'metal', 'cloth', 'bark'];

// Break caught: a surface with no source for one language, a hook missing, or helpers defined twice in one shader.
test('SU01 every surface has both hooks in GLSL and WGSL, each helper defined once', () => {
  for (const kind of KINDS) {
    const s = surfaceShaderSources3D(kind);
    assert.match(s.glsl, /vec4 customFragment\(vec4 color, vec3 worldPosition, vec3 normal, vec2 uv\)/, kind);
    assert.match(
      s.wgsl,
      /fn customFragment\(color: vec4f, worldPosition: vec3f, normal: vec3f, uv: vec2f\) -> vec4f/,
      kind
    );
    assert.match(s.glslNormal, /vec3 customNormal\(vec3 normal, vec3 worldPosition, vec2 uv\)/, kind);
    assert.match(s.wgslNormal, /fn customNormal\(normal: vec3f, worldPosition: vec3f, uv: vec2f\) -> vec3f/, kind);
    // The engine joins the fragment and the normal hook into one shader: the helpers live in the fragment hook only.
    for (const name of ['egsHash', 'egsNoise', 'egsFbm', 'egsPlane', 'egsHeight']) {
      const glsl = s.glsl + s.glslNormal,
        wgsl = s.wgsl + s.wgslNormal;
      assert.equal(glsl.match(new RegExp('(float|vec2) ' + name + '\\(', 'g'))?.length, 1, kind + ' GLSL ' + name);
      assert.equal(wgsl.match(new RegExp('fn ' + name + '\\(', 'g'))?.length, 1, kind + ' WGSL ' + name);
    }
    // The parameters are read the same way in both.
    for (const source of [s.glsl, s.glslNormal]) assert.ok(source.includes('uCustom[0]'));
    for (const source of [s.wgsl, s.wgslNormal]) assert.ok(source.includes('material.custom[0]'));
  }
});

// Break caught: a material that does not carry its surface, its parameters, or the defaults of its kind.
test('SU02 createSurfaceMaterial3D sets the shader, its parameters and the kind of surface', () => {
  const wood = createSurfaceMaterial3D({ surface: 'wood' });
  assert.equal(wood.shader.key, 'surface-wood');
  assert.deepEqual(Array.from(wood.shader.uniforms.slice(0, 4)), [4, 0.5, 0.5, 0]);
  assert.equal(wood.vertexColors, true);
  assert.equal(wood.roughness, 0.7);
  const metal = createSurfaceMaterial3D({
    surface: 'metal',
    color: 0x9aa3ad,
    scale: 6,
    strength: 0.2,
    bump: 1,
    vertexColors: false
  });
  assert.equal(metal.metallic, 0.8);
  assert.equal(metal.vertexColors, false);
  assert.deepEqual(
    Array.from(metal.shader.uniforms.slice(0, 3)).map(v => +v.toFixed(3)),
    [6, 0.2, 1]
  );
  // Materials of one kind share the compiled program; each keeps its own parameters.
  assert.equal(createSurfaceMaterial3D({ surface: 'wood', scale: 9 }).shader.key, wood.shader.key);
  const bad = { code: 'WORLD3D_INPUT_INVALID' };
  assert.throws(() => createSurfaceMaterial3D({ surface: 'marble' }), bad);
  assert.throws(() => createSurfaceMaterial3D({ surface: 'wood', strength: 2 }), bad);
  assert.throws(() => createSurfaceMaterial3D({ surface: 'wood', scale: 0 }), bad);
  assert.throws(() => createSurfaceMaterial3D(null), bad);
  assert.throws(() => surfaceShaderSources3D('toString'), bad);
});
