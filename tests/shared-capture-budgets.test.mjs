// SPDX-License-Identifier: Apache-2.0
// Public capture-budget controls. No renderer, private imports or product hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const FRAME = Object.freeze({ width: 64, height: 48 });
const hasCode = code => error => error instanceof egret.EgretError && error.code === code;

function image(width = 1, height = 1) {
  return egret.createImageData2D({ width, height, pixels: new Uint8Array(width * height * 4) });
}
function rectangles(node, count) {
  node.graphics.beginFill(0x204060);
  for (let index = 0; index < count; index++) node.graphics.drawRect(0, 0, 1, 1);
  node.graphics.endFill();
}
function oldGeometry(vertices, triangles) {
  // Repeated authored triangles are legal input. This suite tests capture metadata,
  // not robust geometry preparation or a copied product-budget algorithm.
  const positions = new Float64Array(vertices * 2), uvs = new Float64Array(vertices * 2);
  const lightColors = new Float64Array(vertices * 4).fill(1);
  if (vertices >= 3) { positions[2] = 1; positions[5] = 1; }
  const indices = new Uint32Array(triangles * 3);
  for (let triangle = 0; triangle < triangles; triangle++) indices.set([0, 1, 2], 3 * triangle);
  return egret.createTexturedGeometry2D({ positions, uvs, lightColors, indices });
}
async function scene(body) {
  const port = host(), diagnostics = [], resources = new Map();
  const engine = await egret.createEngine({ host: port.adapter,
    onDiagnostic: value => diagnostics.push(value) });
  const scope = engine.createScope();
  const type = egret.createAssetType('shared-capture-budget-textures', egret.isTexture);
  let nextId = 0;
  engine.assets.register(type, {
    async load(ref) { return resources.get(ref.id).texture; },
    dispose(texture) {
      const record = [...resources.values()].find(value => value.texture === texture);
      assert.ok(record); record.disposals++; texture.dispose();
    },
  });
  const f = {
    engine, scope,
    capture() {
      assert.equal(typeof engine.captureSharedFrame, 'function', 'Shared capture availability is required');
      return engine.captureSharedFrame(FRAME);
    },
    own(node) { return scope.use(node); },
    add(node, parent = engine.stage) { scope.use(node); parent.addChild(node); return node; },
    sprite(parent = engine.stage) { return f.add(new egret.Sprite(), parent); },
    async resource(source = image(), view) {
      const texture = view === undefined ? egret.createTexture(source) : egret.createTextureView(source, view);
      const id = 'shared-capture-budget-' + (++nextId), record = { texture, source, disposals: 0 };
      resources.set(id, record);
      record.lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, id), { signal: scope.signal }));
      return record;
    },
  };
  try { return await body(f); }
  finally {
    scope.dispose(); await engine.dispose();
    assert.equal(scope.state, 'closed');
    assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
    for (const record of resources.values()) {
      assert.equal(record.disposals, 1); assert.equal(record.texture.isDisposed, true);
    }
    assert.deepEqual(diagnostics, []);
  }
}
function baseline(f, inspect = frame => assert.equal(frame.commands.length, 0)) {
  const frame = f.capture(); inspect(frame); return frame.frameId;
}
function refusedThenRestored(f, previousId, code, restore, inspect = frame => assert.equal(frame.commands.length, 0)) {
  assert.throws(() => f.capture(), hasCode(code));
  restore();
  const frame = f.capture();
  assert.equal(frame.frameId, previousId + 1, 'Failed capture must not spend a completion ID');
  inspect(frame);
}
function oneView(x, logicalWidth = 1) {
  return { packed: { x, y: 0, width: 1, height: 1 },
    logicalWidth, logicalHeight: 1, trimX: 0, trimY: 0, quarterTurn: 0 };
}

test('CAPTURE B01 hidden all-tree node count accepts 65536 and rejects the next node', async () => {
  await scene(async f => {
    // Stage + 255 parents + 255*256 leaves = 65536. Bounded sibling groups
    // avoid quadratic fixture insertion at a single 65535-child parent.
    for (let group = 0; group < 255; group++) {
      const parent = f.sprite(); parent.visible = false;
      for (let child = 0; child < 256; child++) f.sprite(parent);
    }
    const before = baseline(f);
    const extra = f.sprite(); extra.visible = false;
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose());
  });
});

test('CAPTURE B02 hidden authoring units accept 65536 and reject one extra primitive', async () => {
  await scene(async f => {
    const parent = f.sprite(); parent.visible = false;
    rectangles(parent, 65536);
    const before = baseline(f);
    const extra = f.sprite(parent); rectangles(extra, 1);
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose());
  });
});

test('CAPTURE B03 hidden triangle occurrences charge shared geometry each time and keep resource non-use', async () => {
  await scene(async f => {
    const item = await f.resource(), repeated = oldGeometry(3, 32768), one = oldGeometry(3, 1);
    const parent = f.sprite(); parent.visible = false;
    f.add(new egret.Mesh2D(item.lease, repeated), parent);
    f.add(new egret.Mesh2D(item.lease, repeated), parent);
    const extra = f.own(new egret.Mesh2D(item.lease, one));
    // Hidden geometry remains qualified/charged, while hidden lease use stays skipped.
    item.lease.release();
    const before = baseline(f, frame => {
      assert.equal(frame.commands.length, 0); assert.equal(frame.geometries.length, 0);
      assert.equal(frame.pages.length, 0);
    });
    parent.addChild(extra);
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose());
  });
});

test('CAPTURE B04 hidden unique geometry identities accept 128 plus an identity reuse, then reject 129', async () => {
  await scene(async f => {
    const item = await f.resource(), parent = f.sprite(); parent.visible = false;
    const owned = [];
    for (let index = 0; index < 128; index++) {
      const value = oldGeometry(0, 0); owned.push(value);
      f.add(new egret.Mesh2D(item.lease, value), parent);
    }
    f.add(new egret.Mesh2D(item.lease, owned[0]), parent);
    const before = baseline(f);
    const extra = f.add(new egret.Mesh2D(item.lease, oldGeometry(0, 0)), parent);
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose());
  });
});

test('CAPTURE B05 hidden unique geometry payload accepts exactly 16 MiB and rejects four more bytes', async () => {
  await scene(async f => {
    const item = await f.resource(), parent = f.sprite(); parent.visible = false;
    const owned = [oldGeometry(65536, 1), oldGeometry(65536, 1),
      oldGeometry(65536, 1), oldGeometry(65533, 13)];
    // 3*(64*65536+12) + (64*65533+12*13) = 16777216.
    assert.deepEqual(owned.map(value => value.logicalByteLength), [4194316, 4194316, 4194316, 4194268]);
    const meshes = owned.map(value => f.add(new egret.Mesh2D(item.lease, value), parent));
    f.add(new egret.Mesh2D(item.lease, owned[0]), parent);
    const before = baseline(f);
    const over = oldGeometry(65534, 8);
    assert.equal(over.logicalByteLength, 4194272);
    meshes[3].setContent(item.lease, over);
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED',
      () => meshes[3].setContent(item.lease, owned[3]));
  });
});

test('CAPTURE B06 source identity admits 64 equal-byte images plus true source reuse and refuses 65', async () => {
  await scene(async f => {
    const items = [];
    for (let index = 0; index < 64; index++) {
      const item = await f.resource(); items.push(item);
      f.add(new egret.Bitmap(item.lease));
    }
    const reused = await f.resource(items[0].source); f.add(new egret.Bitmap(reused.lease));
    const inspect = frame => {
      assert.equal(frame.commands.length, 65); assert.equal(frame.pages.length, 64);
      assert.equal(frame.regions.length, 64);
      for (let index = 0; index < 64; index++) assert.equal(frame.pages[index].source, items[index].source);
    };
    const before = baseline(f, inspect);
    const extraItem = await f.resource(), extra = f.add(new egret.Bitmap(extraItem.lease));
    refusedThenRestored(f, before, 'FRAME_IMAGE_BUDGET', () => extra.dispose(), inspect);
  });
});

test('CAPTURE B07 source payload admits exactly 16 MiB with source reuse and rejects one more pixel', async () => {
  await scene(async f => {
    const items = [];
    for (let index = 0; index < 4; index++) {
      const item = await f.resource(image(1024, 1024)); items.push(item);
      assert.equal(item.source.byteLength, 4194304);
      f.add(new egret.Bitmap(item.lease));
    }
    const reused = await f.resource(items[0].source); f.add(new egret.Bitmap(reused.lease));
    const inspect = frame => { assert.equal(frame.pages.length, 4); assert.equal(frame.commands.length, 5); };
    const before = baseline(f, inspect);
    const extraItem = await f.resource(image()), extra = f.add(new egret.Bitmap(extraItem.lease));
    refusedThenRestored(f, before, 'FRAME_IMAGE_BUDGET', () => extra.dispose(), inspect);
    // Both source and canonical projection currently debit 4WH. This public
    // boundary does not claim to selectively trip each of those equal ledgers.
  });
});

test('CAPTURE B08 region values admit 128 plus an equal view and reject a changed logical extent', async () => {
  await scene(async f => {
    const source = image(128, 1);
    for (let index = 0; index < 128; index++) {
      const item = await f.resource(source, oneView(index)); f.add(new egret.Bitmap(item.lease));
    }
    const duplicate = await f.resource(source, oneView(0)); f.add(new egret.Bitmap(duplicate.lease));
    const inspect = frame => {
      assert.equal(frame.pages.length, 1); assert.equal(frame.pages[0].source, source);
      assert.equal(frame.regions.length, 128); assert.equal(frame.commands.length, 129);
      assert.equal(frame.commands[128].regionIndex, 0);
    };
    const before = baseline(f, inspect);
    // Same packed texel; a different logical extent is still a distinct complete region.
    const changed = await f.resource(source, oneView(0, 2)), extra = f.add(new egret.Bitmap(changed.lease));
    refusedThenRestored(f, before, 'FRAME_IMAGE_BUDGET', () => extra.dispose(), inspect);
  });
});

test('CAPTURE B09 complete material values admit 256 plus a distinct equal object and refuse 257', async () => {
  await scene(async f => {
    const materials = [];
    for (let index = 0; index < 256; index++) {
      const material = egret.createSharedMaterial2D({ light: [index / 255, 0, 0, 1] });
      materials.push(material);
      const node = f.sprite(); node.sharedMaterial = material; rectangles(node, 1);
    }
    const duplicate = f.sprite();
    duplicate.sharedMaterial = egret.createSharedMaterial2D({ light: [0, 0, 0, 1] });
    assert.notEqual(duplicate.sharedMaterial, materials[0]); rectangles(duplicate, 1);
    const inspect = frame => {
      assert.equal(frame.materials.length, 256); assert.equal(frame.commands.length, 257);
      assert.equal(frame.materials[0], materials[0]); assert.equal(frame.commands[256].materialIndex, 0);
    };
    const before = baseline(f, inspect);
    const extra = f.sprite();
    extra.sharedMaterial = egret.createSharedMaterial2D({ light: [0, 1, 0, 1] }); rectangles(extra, 1);
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose(), inspect);
  });
});

test('CAPTURE B10 combined draw and boundary count accepts 65536 and rejects one more draw', async () => {
  await scene(async f => {
    const node = f.sprite(); node.renderBoundary = 'isolate'; rectangles(node, 65534);
    const inspect = frame => {
      assert.equal(frame.commands.length, 65536);
      assert.equal(frame.commands[0].reason, 'explicit-enter');
      assert.equal(frame.commands[65535].reason, 'explicit-exit');
      assert.equal(frame.commands[65535].ordinal, 65535);
    };
    const before = baseline(f, inspect);
    const extra = f.sprite(); rectangles(extra, 1);
    // Authoring units are only 65535, so this exceeds commands, not authoring.
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose(), inspect);
  });
});

test('CAPTURE B11 ordered draw clip references accept 262144 and reject one more reference', async () => {
  await scene(async f => {
    let parent = f.engine.stage;
    for (let depth = 0; depth < 64; depth++) {
      parent = f.sprite(parent); parent.clipRect = { x: 0, y: 0, width: 8, height: 8 };
    }
    rectangles(parent, 4096);
    const inspect = frame => {
      assert.equal(frame.commands.length, 4224);
      const draws = frame.commands.filter(command => command.kind !== 'barrier');
      assert.equal(draws.length, 4096);
      assert.ok(draws.every(command => command.clips.length === 64));
    };
    const before = baseline(f, inspect);
    const extra = f.sprite(); extra.clipRect = { x: 0, y: 0, width: 8, height: 8 }; rectangles(extra, 1);
    // This independent one-clip draw adds exactly one reference, well below all other caps.
    refusedThenRestored(f, before, 'FRAME_BUDGET_EXCEEDED', () => extra.dispose(), inspect);
  });
});
