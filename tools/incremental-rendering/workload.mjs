// SPDX-License-Identifier: Apache-2.0
// Fixed M1.2 input fixture; no browser access, private SDK import,
// native instrumentation, scheduling, readback, or timing is performed here.
// Inject the namespace from built public @egret/engine and a caller-created Host:
//   const fixture = await createWorkload({ sdk, host, variant: 'scale' });
// The caller owns any GPU device borrowed by that Host. This fixture owns the
// Engine it creates; close() follows Engine -> Scope/assets -> Host close.
//
// Actual public signatures checked against current source/public exports:
// sdk.createEngineForProfile({ host, shutdownTimeoutMs }, profile): Promise<Engine>
// engine.createScope(): Scope; scope.use(value): value; scope.signal
// sdk.createAssetType(name, isValue); sdk.createAssetRef(type, id)
// engine.assets.register(type, { async load(ref, context), dispose(value) })
// engine.assets.acquire(ref, { signal }): Promise<AssetLease<Texture>>
// sdk.createImageData2D({ width, height, pixels }): ImageData2D
// sdk.createTexture(image, sourceRect?): Texture
// sdk.createTexturedGeometry2D({ positions, uvs, lightColors, indices })
// new sdk.DisplayObjectContainer(); new sdk.Sprite(); new sdk.Bitmap(lease)
// new sdk.Mesh2D(lease, geometry); container.addChild(node)
// sprite.graphics.beginFill(color, alpha).drawRect(x,y,width,height).endFill()
// engine.captureTexturedFrame(options): frozen frame
// engine.renderTexturedFrame(options): frozen frame (Host called synchronously)
// engine.dispose(): Promise<void>
// This is a recipe, not an assertion that GPU work or performance was observed.

export const FRAME_OPTIONS = Object.freeze({ width: 1024, height: 768, clearColor: 0, clearAlpha: 1 });
export const SAMPLE_CAPACITY = 65536;
const SCALE_LEAVES = 9991, VISIBLE_LEAVES = 991, STRUCTURAL_NODES = 9;
const DELTA = 0.125;
// Bound the deterministic integer products comfortably below MAX_SAFE_INTEGER.
// This is a fixture guard, not a new product limit or measured frame count.
const MAX_UPDATE_STEPS = 1000000000;

function imagePixels(r, g, b, a) {
  const pixels = new Uint8Array(64);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = r; pixels[offset + 1] = g; pixels[offset + 2] = b; pixels[offset + 3] = a;
  }
  return pixels;
}

function basePosition(ordinal) {
  const bounded = ordinal % VISIBLE_LEAVES, slot = bounded % 32;
  const tile = slot < 8 ? slot : slot < 16 ? slot - 8 : slot < 24 ? slot - 16 : slot < 28 ? slot - 24 : slot - 28;
  return { x: tile * 128, y: 12 + Math.floor(bounded / 32) * 24 };
}

/** Setup and inventory allocate freely; neither belongs in a timed frame. */
export async function createWorkload({ sdk, host, variant = 'scale' }) {
  if (variant !== 'scale' && variant !== 'preflight') throw new Error('WORKLOAD_VARIANT');
  const leafCount = variant === 'scale' ? SCALE_LEAVES : 32;
  const engine = await sdk.createEngineForProfile({ host, shutdownTimeoutMs: 20000 }, sdk.TEXTURED_FRAME_PROFILE_2D);
  try {
    const scope = engine.createScope();
    const images = Object.freeze([
      sdk.createImageData2D({ width: 4, height: 4, pixels: imagePixels(255, 64, 32, 128) }),
      sdk.createImageData2D({ width: 4, height: 4, pixels: imagePixels(32, 96, 255, 192) }),
    ]);
    const geometry = sdk.createTexturedGeometry2D({
      positions: new Float32Array([0, 0, 128, 0, 128, 24, 0, 24]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      lightColors: new Float32Array(16).fill(1),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    });
    const textures = [];
    const type = sdk.createAssetType('m1-2-fixed-texture', sdk.isTexture);
    const refs = [sdk.createAssetRef(type, 'A'), sdk.createAssetRef(type, 'B')];
    engine.assets.register(type, {
      async load(ref) {
        if (ref.id !== 'A' && ref.id !== 'B') throw new Error('WORKLOAD_ASSET');
        const texture = sdk.createTexture(images[ref.id === 'A' ? 0 : 1]);
        textures.push(texture);
        return texture;
      },
      dispose(texture) { texture.dispose(); },
    });
    // Leases enter the Scope before nodes; reverse cleanup retires borrowers
    // before releasing their exact leases. The asset provider owns Textures.
    const leases = [
      scope.use(await engine.assets.acquire(refs[0], { signal: scope.signal })),
      scope.use(await engine.assets.acquire(refs[1], { signal: scope.signal })),
    ];
    const nodes = [engine.stage];
    let parent = engine.stage;
    for (let j = 1; j <= 8; j++) {
      const container = scope.use(new sdk.DisplayObjectContainer());
      container.clipRect = { x: 2*j, y: 2*j, width: 1024-4*j, height: 768-4*j };
      parent.addChild(container); nodes.push(container); parent = container;
    }
    for (let i = 0; i < leafCount; i++) {
      const slot = i % 32;
      let node;
      if (slot < 8) {
        node = scope.use(new sdk.Sprite());
        node.graphics.beginFill(0x405060, 1).drawRect(0, 0, 128, 24).endFill();
      } else if (slot >= 16 && slot < 24) {
        node = scope.use(new sdk.Mesh2D(leases[0], geometry)); node.alpha = 0.75;
      } else {
        node = scope.use(new sdk.Bitmap(leases[slot >= 24 && slot < 28 ? 1 : 0]));
        node.scaleX = 32; node.scaleY = 6; node.alpha = 0.75;
      }
      const position = basePosition(i);
      node.x = position.x; node.y = position.y; node.visible = i < VISIBLE_LEAVES;
      parent.addChild(node); nodes.push(node);
    }
    Object.freeze(nodes); Object.freeze(textures);
    const bases = Float64Array.from(nodes, node => node.x);
    const phases = new Uint8Array(nodes.length);
    let mode = variant === 'scale' ? 'static' : 'preflight', step = 0, closed = false, closePromise;

    function assertOpen() { if (closed) throw new Error('WORKLOAD_CLOSED'); }
    function reset(nextMode = variant === 'scale' ? 'static' : 'preflight') {
      assertOpen();
      if (variant === 'scale' ? !['static', 'sparse', 'full'].includes(nextMode) : nextMode !== 'preflight') throw new Error('WORKLOAD_MODE');
      for (let i = 0; i < nodes.length; i++) nodes[i].x = bases[i];
      phases.fill(0); mode = nextMode; step = 0;
    }
    function toggleSparse(index) {
      const phase = phases[index] ^ 1;
      nodes[index].x = bases[index] + (phase ? DELTA : 0);
      phases[index] = phase;
    }
    // The hot update path allocates no arrays or resources. The caller invokes
    // one fresh render after each advance; it must not replay a saved frame.
    function advance() {
      assertOpen();
      if (step >= MAX_UPDATE_STEPS) throw new Error('WORKLOAD_STEP_CAPACITY');
      let writes = 0;
      if (mode === 'preflight') {
        if (step >= 12) throw new Error('PREFLIGHT_COMPLETE');
        if (step >= 4) {
          const index = step < 8 ? STRUCTURAL_NODES + 8 : 4;
          nodes[index].x = bases[index] + (step % 2 === 0 ? DELTA : -DELTA); writes = 1;
        }
      } else if (mode === 'sparse') {
        for (let j = 0; j < 10; j++) toggleSparse(STRUCTURAL_NODES + ((37*step + 97*j) % 991));
        for (let j = 0; j < 90; j++) toggleSparse(STRUCTURAL_NODES + 991 + ((91*step + 101*j) % 9000));
        writes = 100;
      } else if (mode === 'full') {
        for (let i = 0; i < nodes.length; i++) {
          const phase = phases[i] ^ 1;
          nodes[i].x = bases[i] + (phase ? DELTA : -DELTA); phases[i] = phase;
        }
        writes = nodes.length;
      }
      step++; return writes;
    }

    // Public-value inventory, outside timing. Logical admission work is still
    // O(nodes); this inspection promises no sublinear collector or GPU cost.
    function inspect(frame) {
      assertOpen();
      let logicalNodes = 0, effectiveVisibleNodes = 0, structuralNodes = 0;
      let spriteNodes = 0, bitmapNodes = 0, meshNodes = 0, sourceTriangles = 0;
      const stack = [{ node: engine.stage, visible: true, alpha: 1 }];
      while (stack.length) {
        const entry = stack.pop(), node = entry.node, clip = node.clipRect;
        const alpha = entry.alpha * node.alpha;
        const visible = entry.visible && node.visible && alpha > 0 && (!clip || clip.width > 0 && clip.height > 0);
        logicalNodes++; if (visible) effectiveVisibleNodes++;
        if (node instanceof sdk.Sprite) spriteNodes++;
        else if (node instanceof sdk.Bitmap) bitmapNodes++;
        else if (node instanceof sdk.Mesh2D) { meshNodes++; sourceTriangles += node.geometry.triangleCount; }
        else structuralNodes++;
        if (node instanceof sdk.DisplayObjectContainer) {
          for (let i = node.numChildren - 1; i >= 0; i--) stack.push({ node: node.getChildAt(i), visible, alpha });
        }
      }
      let rectangles = 0, imageCommands = 0, meshes = 0, clipReferences = 0, visibleTriangles = 0, projectionBytes = 0;
      const views = new Set();
      for (const command of frame.commands) {
        clipReferences += command.clips.length;
        if (command.kind === 'rect') { rectangles++; continue; }
        if (command.kind === 'image') imageCommands++;
        else { meshes++; visibleTriangles += frame.geometries[command.geometryIndex].triangleCount; }
        const crop = command.sourceRect, key = `${command.imageIndex}:${crop.x},${crop.y},${crop.width},${crop.height}`;
        if (!views.has(key)) { views.add(key); projectionBytes += crop.width * crop.height * 4; }
      }
      return Object.freeze({
        logicalNodes, effectiveVisibleNodes, structuralNodes, spriteNodes, bitmapNodes, meshNodes,
        contentNodes: spriteNodes + bitmapNodes + meshNodes, sourceTriangles,
        commands: frame.commands.length, rectangles, images: imageCommands, meshes, clipReferences, visibleTriangles,
        uniqueImages: frame.images.length, imageBytes: frame.images.reduce((sum, image) => sum + image.byteLength, 0),
        uniqueGeometries: frame.geometries.length, geometryBytes: frame.geometries.reduce((sum, value) => sum + value.logicalByteLength, 0),
        distinctViews: views.size, projectionBytes,
      });
    }
    function close() {
      if (closePromise === undefined) { closed = true; closePromise = engine.dispose(); }
      return closePromise;
    }
    return Object.freeze({
      variant, engine, scope, nodes, images, geometry, textures,
      get step() { return step; }, get mode() { return mode; },
      reset, advance, inspect, close,
      capture() { assertOpen(); return engine.captureTexturedFrame(FRAME_OPTIONS); },
      render() { assertOpen(); return engine.renderTexturedFrame(FRAME_OPTIONS); },
    });
  } catch (cause) {
    try { await engine.dispose(); }
    catch (cleanup) { throw new AggregateError([cause, cleanup], 'WORKLOAD_SETUP_AND_CLEANUP_FAILED', { cause }); }
    throw cause;
  }
}

/** Fixed storage only. Callers supply actual timestamps; no samples are invented. */
export function createSampleStore() {
  const ordinal = new Float64Array(SAMPLE_CAPACITY), rafTimestamp = new Float64Array(SAMPLE_CAPACITY);
  const updateStart = new Float64Array(SAMPLE_CAPACITY), updateEnd = new Float64Array(SAMPLE_CAPACITY);
  const renderStart = new Float64Array(SAMPLE_CAPACITY), renderEnd = new Float64Array(SAMPLE_CAPACITY);
  const flags = new Uint8Array(SAMPLE_CAPACITY);
  let length = 0;
  const columns = Object.freeze({ ordinal, rafTimestamp, updateStart, updateEnd, renderStart, renderEnd, flags });
  return Object.freeze({
    capacity: SAMPLE_CAPACITY, byteLength: SAMPLE_CAPACITY * (6*8 + 1), columns,
    get length() { return length; },
    // Flag bit 0: page visible; bit 1: document has focus. These are page-level
    // observations, not proof of OS foreground, lack of occlusion, or scanout.
    append(frameOrdinal, raf, beforeUpdate, afterUpdate, beforeRender, afterRender, visible, focused) {
      if (length === SAMPLE_CAPACITY) throw new Error('SAMPLE_CAPACITY');
      if (frameOrdinal !== length || !Number.isFinite(raf) || !Number.isFinite(beforeUpdate) || !Number.isFinite(afterUpdate) ||
          !Number.isFinite(beforeRender) || !Number.isFinite(afterRender) || raf < 0 || beforeUpdate < raf ||
          afterUpdate < beforeUpdate || beforeRender < afterUpdate || afterRender < beforeRender ||
          (length > 0 && raf <= rafTimestamp[length - 1]) || typeof visible !== 'boolean' || typeof focused !== 'boolean') throw new Error('SAMPLE_INVALID');
      ordinal[length] = frameOrdinal; rafTimestamp[length] = raf;
      updateStart[length] = beforeUpdate; updateEnd[length] = afterUpdate;
      renderStart[length] = beforeRender; renderEnd[length] = afterRender;
      flags[length] = (visible ? 1 : 0) | (focused ? 2 : 0); length++;
    },
  });
}
