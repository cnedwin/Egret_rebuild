// SPDX-License-Identifier: Apache-2.0
// Deterministic World3D scenes rendered by tools/verify-world3d.mjs on both backends.
// Each case returns a scene and camera built only from the public world3d entry.
export async function verifyTextureSourceReplacement(W, renderer) {
  const camera = W.createOrthographicCamera3D({height: 2, aspect: 1, near: 0.1, far: 10});
  camera.setPosition(0, 0, 3).lookAt(0, 0, 0);
  const geometry = W.createPlaneGeometry3D({width: 1, height: 1});
  const source = new W.RenderTarget3D(16, 16);
  const output = new W.RenderTarget3D(16, 16);
  const pixels = {width: 1, height: 1, data: new Uint8Array([255, 0, 0, 128])};
  const mutable = new W.Texture3D(pixels, {mipmaps: false});
  const sourceMaterial = W.createUnlitMaterial3D({color: 0xff0000, opacity: 0.5, toneMapped: false});
  const material = W.createUnlitMaterial3D({map: mutable, alphaMode: 'blend', toneMapped: false});
  const inputScene = new W.Scene3D();
  const outputScene = new W.Scene3D();
  outputScene.background = [0, 0, 1];
  inputScene.addChild(new W.Mesh3D(geometry, sourceMaterial));
  outputScene.addChild(new W.Mesh3D(geometry, material));

  async function verifyPixel(label) {
    if (!renderer.render(outputScene, camera, output)) throw new Error('Renderer lost during ' + label);
    const data = await renderer.readRenderTargetPixels(output);
    const offset = (8 * output.width + 8) * 4;
    const rgba = data.subarray(offset, offset + 4);
    const expected = [188, 0, 188, 255];
    if (rgba.some((value, index) => Math.abs(value - expected[index]) > 2)) {
      throw new Error('Unexpected composite after ' + label + ': ' + rgba.join(','));
    }
  }

  try {
    if (!renderer.render(inputScene, camera, source)) throw new Error('Renderer lost before texture replacement');
    await verifyPixel('initial pixel source');
    mutable.setSource(source);
    await verifyPixel('texture source changed to render target');
    mutable.setSource(pixels);
    await verifyPixel('texture source changed back to pixels');
    material.map = source.texture;
    await verifyPixel('material map changed to render target');
    material.map = mutable;
    await verifyPixel('material map changed back to pixels');
  } finally {
    material.dispose(); sourceMaterial.dispose(); mutable.dispose();
    output.dispose(); source.dispose(); geometry.dispose();
  }
}

export function buildCases(W) {
  const checker = (size, cells, a, b) => { const data = new Uint8Array(size * size * 4); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set([...(((Math.floor(x * cells / size) + Math.floor(y * cells / size)) & 1) ? b : a), 255], (y * size + x) * 4); return new W.Texture3D({width: size, height: size, data}); };
  const dot = size => { const data = new Uint8Array(size * size * 4); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const d = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2; data.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - d) ** 2)], (y * size + x) * 4); } return new W.Texture3D({width: size, height: size, data}, {wrapS: 'clamp', wrapT: 'clamp'}); };
  const base = (bg = [0.05, 0.08, 0.12]) => { const scene = new W.Scene3D(); scene.background = bg; const camera = W.createPerspectiveCamera3D({aspect: 1.6, fov: 50, near: 0.1, far: 100}); camera.setPosition(3, 2.5, 5).lookAt(0, 0.4, 0); scene.addChild(camera); return {scene, camera}; };
  const lights = (scene, shadow = false) => { scene.addChild(W.createAmbientLight3D({intensity: 0.15})); const sun = W.createDirectionalLight3D({intensity: 1.8, castShadow: shadow}); sun.setPosition(4, 7, 3).lookAt(0, 0, 0); Object.assign(sun.shadow, {extent: 6, near: 1, far: 20}); scene.addChild(sun); return sun; };
  const floor = scene => { const m = new W.Mesh3D(W.createPlaneGeometry3D({width: 12, height: 12}), W.createStandardMaterial3D({color: 0xbbbbbb, roughness: 0.9})); m.setRotation(-Math.PI / 2, 0, 0); m.castShadow = false; scene.addChild(m); return m; };
  return {
    unlitTexture() { const s = base(); const t = checker(64, 8, [230, 60, 60], [40, 60, 220]); t.repeat.set([2, 1]); t.rotation = 0.3; t.offset.set([0.1, 0.2]); s.scene.addChild(new W.Mesh3D(W.createBoxGeometry3D({width: 2, height: 2, depth: 2}), W.createUnlitMaterial3D({map: t}))); return s; },
    shadings() { const s = base(); lights(s.scene); floor(s.scene); const mats = [W.createLambertMaterial3D({color: 0xcc5544}), W.createPhongMaterial3D({color: 0x44aa55, shininess: 40, specular: 0x888888}), W.createStandardMaterial3D({color: 0x4466dd, roughness: 0.35, metallic: 0.2}), W.createStandardMaterial3D({color: 0xdddddd, roughness: 0.6, flatShading: true})]; mats.forEach((m, i) => { const mesh = new W.Mesh3D(W.createSphereGeometry3D({radius: 0.6, widthSegments: i === 3 ? 8 : 32, heightSegments: i === 3 ? 6 : 20}), m); mesh.setPosition(-2.1 + i * 1.4, 0.6, 0); s.scene.addChild(mesh); }); const p = W.createPointLight3D({color: 0xff8844, intensity: 6, range: 6}); p.setPosition(0, 1.5, 2); s.scene.addChild(p); return s; },
    shadows() { const s = base(); lights(s.scene, true); floor(s.scene); const spot = W.createSpotLight3D({color: 0x88aaff, intensity: 40, range: 15, angle: 0.5, penumbra: 0.3, castShadow: true}); spot.setPosition(-3, 5, 2).lookAt(0, 0, 0); s.scene.addChild(spot); [[-1, 0.5, 0], [1, 0.75, -0.5], [0, 0.3, 1.5]].forEach((p, i) => { const mesh = new W.Mesh3D(i === 1 ? W.createCylinderGeometry3D({radiusTop: 0.4, radiusBottom: 0.4, height: 1.5}) : W.createBoxGeometry3D({width: 1, height: p[1] * 2, depth: 1}), W.createStandardMaterial3D({color: [0xdd6655, 0x55bb77, 0x6677dd][i], roughness: 0.5})); mesh.setPosition(...p); mesh.setRotation(0, i * 0.5, 0); s.scene.addChild(mesh); }); return s; },
    environment() { const s = base(); const sky = W.createGradientCubeTexture3D([70, 120, 210], [200, 215, 235], [70, 66, 62], 32); s.scene.background = sky; s.scene.environment = sky; s.scene.fog = {kind: 'exponential', color: [0.6, 0.7, 0.8], density: 0.05}; lights(s.scene); floor(s.scene); [0.1, 0.5, 0.9].forEach((r, i) => { const mesh = new W.Mesh3D(W.createSphereGeometry3D({radius: 0.7, widthSegments: 40, heightSegments: 24}), W.createStandardMaterial3D({color: 0xdddddd, metallic: 1, roughness: r})); mesh.setPosition(-1.7 + i * 1.7, 0.7, 0); s.scene.addChild(mesh); }); return s; },
    instancing() { const s = base(); lights(s.scene, true); floor(s.scene); const im = new W.InstancedMesh3D(W.createBoxGeometry3D({width: 0.3, height: 1, depth: 0.3}), W.createLambertMaterial3D({color: 0xffffff}), 64); for (let i = 0; i < 64; i++) { const h = 0.3 + (i * 37 % 11) / 10; im.setTransformAt(i, [(i % 8) * 0.5 - 1.75, h / 2, Math.floor(i / 8) * 0.5 - 1.75], [0, 0, 0, 1], [1, h, 1]); im.setColorAt(i, (i % 8) / 8, 0.5, Math.floor(i / 8) / 8); } s.scene.addChild(im); return s; },
    skinMorph() { const s = base(); lights(s.scene, true); floor(s.scene); const h = 2.4, n = 3; const g = W.createCylinderGeometry3D({radiusTop: 0.25, radiusBottom: 0.3, height: h, radialSegments: 16, heightSegments: 16}); const pos = g.getAttribute('position').data; const j = new Uint16Array(pos.length / 3 * 4), w = new Float32Array(pos.length / 3 * 4); for (let i = 0; i < pos.length / 3; i++) { const t = (pos[i * 3 + 1] / h + .5) * (n - 1), lo = Math.min(Math.floor(t), n - 2), k = t - lo; j.set([lo, lo + 1, 0, 0], i * 4); w.set([1 - k, k, 0, 0], i * 4); } g.setAttribute('joints', new W.Attribute3D(j, 4)); g.setAttribute('weights', new W.Attribute3D(w, 4)); const mesh = new W.Mesh3D(g, W.createStandardMaterial3D({color: 0x44bbaa, roughness: 0.5})); mesh.setPosition(-1.2, h / 2, 0); const bones = []; for (let i = 0; i < n; i++) { const b = new W.Bone3D(); b.setPosition(0, i ? h / (n - 1) : -h / 2, 0); (i ? bones[i - 1] : mesh).addChild(b); bones.push(b); } s.scene.addChild(mesh); mesh.updateWorldMatrices(); mesh.bind(new W.Skeleton3D(bones)); bones[1].setRotation(0, 0, 0.5); bones[2].setRotation(0, 0, 0.5); const sg = W.createSphereGeometry3D({radius: 0.7, widthSegments: 24, heightSegments: 16}); const sp = sg.getAttribute('position').data, d = new Float32Array(sp.length); for (let i = 0; i < sp.length; i += 3) { d[i] = sp[i] * 0.5; d[i + 1] = -sp[i + 1] * 0.6; d[i + 2] = sp[i + 2] * 0.5; } sg.setMorphTargets([{name: 'squash', position: d}]); const m2 = new W.Mesh3D(sg, W.createPhongMaterial3D({color: 0xeeaa33})); m2.setPosition(1.2, 0.7, 0); m2.morphWeights[0] = 0.7; s.scene.addChild(m2); return s; },
    spritesLines() { const s = base(); lights(s.scene); floor(s.scene); s.scene.addChild(W.createGridHelper3D(6, 6, 0x4466aa)).setPosition(0, 0.01, 0); s.scene.addChild(W.createAxesHelper3D(1.5)).setPosition(0, 0.02, 0); const t = dot(32); const sprite = W.createSprite3D({map: t, color: 0x99ffaa}); sprite.setPosition(0, 1.5, 0).setScale(1.2); s.scene.addChild(sprite); const fire = W.createParticleEmitter3D({capacity: 200, rate: 100, lifetime: [0.8, 1.2], speed: [0.8, 1.5], spread: 0.4, startSize: 0.4, endSize: 0.1, startColor: [1, 0.5, 0.1], endColor: [0.9, 0.1, 0], startOpacity: 0.6, map: t, seed: 3}); fire.setPosition(1.5, 0.1, 0); s.scene.addChild(fire); for (let i = 0; i < 40; i++) fire.update(1 / 30); const glass = new W.Mesh3D(W.createBoxGeometry3D(), W.createStandardMaterial3D({color: 0x66aaff, opacity: 0.45})); glass.setPosition(-1.5, 0.5, 0.5); s.scene.addChild(glass); const mask = checker(32, 4, [255, 255, 255], [0, 0, 0]); const md = mask.source.data; for (let i = 0; i < md.length; i += 4) md[i + 3] = md[i]; const cut = new W.Mesh3D(W.createPlaneGeometry3D({width: 1.5, height: 1.5}), W.createUnlitMaterial3D({map: mask, color: 0xffcc44, alphaMode: 'mask', side: 'double'})); cut.setPosition(0, 0.8, -1.5); s.scene.addChild(cut); const wire = new W.Mesh3D(W.createTorusGeometry3D({radius: 0.5, tube: 0.2}), W.createUnlitMaterial3D({color: 0xffffff})); wire.material.wireframe = true; wire.setPosition(-0.2, 0.9, 1.6); s.scene.addChild(wire); return s; },
  };
}
