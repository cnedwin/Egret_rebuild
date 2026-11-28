// SPDX-License-Identifier: Apache-2.0
// Actual bundled font bytes exercise build/lifetime/layout; this is not a font sanitizer or device benchmark.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createProjectStore } from '@egret/project';
import { inspectFontArtifact } from '@egret/contracts/resources';
import { createEngine, CancellationController, copyImageData2DPixels } from '@egret/engine';
import { createFontContentLoader } from '@egret/engine/resources';
import { createParagraphCache, createParagraph } from '@egret/engine/paragraph';
import { createCanvasKitFontSetProvider, createCanvasKitParagraphProvider } from '@egret/engine/web/paragraph';
import { createUiRoot } from '@egret/engine/ui';
import { buildContentProject } from '../tools/content/build.mjs';
import { openContentStore } from '../tools/content/store.mjs';
import { host, deferred, flush } from './helpers.mjs';
const vendor = new URL('../examples/paragraph-panel/vendor/', import.meta.url),
  vm = JSON.parse(fs.readFileSync(new URL('manifest.json', vendor), 'utf8'));
const tempParent = fs.realpathSync(os.tmpdir()),
  root = fs.mkdtempSync(path.join(tempParent, 'egret-font-pipeline-'));
const sha = b => createHash('sha256').update(b).digest('hex'),
  get = r => {
    assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
    return r.value;
  };
for (const name of ['sources', 'cache', 'build']) fs.mkdirSync(path.join(root, name));
const definitions = [
  ['latin', 'NotoSans-Regular.ttf', 'truetype'],
  ['cjk', 'NotoSansCJKsc-Regular.otf', 'opentype']
];
const originals = new Map(),
  files = [],
  recipes = [];
for (const [id, name, flavor] of definitions) {
  const bytes = fs.readFileSync(new URL('fonts/' + name, vendor));
  originals.set('e_' + id, bytes);
  fs.writeFileSync(path.join(root, 'sources', name), bytes);
  files.push({
    id: 'f_' + id,
    path: 'sources/' + name,
    role: 'source',
    mediaType: flavor === 'truetype' ? 'font/ttf' : 'font/otf',
    sha256: sha(bytes),
    byteLength: bytes.length
  });
  recipes.push({
    resourceId: 'e_' + id,
    sourceFileId: 'f_' + id,
    importer: { id: 'egret.font', version: '1.0.0' },
    settings: { family: 'Example', flavor },
    artifactFormatVersion: 'egret.font/1',
    dependencies: [],
    provenance: {
      origin: 'Bundled unmodified Noto fonts',
      license: 'OFL-1.1',
      notice: 'See paragraph-panel vendor manifest and notices',
      sha256: sha(bytes)
    }
  });
}
const snapshot = {
  projectSchemaVersion: '1.0',
  projectId: 'p_fonts_test',
  revision: 0,
  name: 'Fonts',
  versions: { engineVersion: '0.0.0', resourceFormatVersion: '1.0', toolProtocolVersion: '1.0' },
  roots: [],
  entities: [],
  files,
  retiredEntityIds: [],
  retiredFileIds: []
};
const store = get(createProjectStore(snapshot)),
  options = {
    projectStore: store,
    projectRoot: root,
    recipe: { format: 'egret.content-build-recipe/1', targetProfile: 'web-shared/1', recipes },
    cacheRoot: path.join(root, 'cache'),
    outputRoot: path.join(root, 'build'),
    selectorId: 'e_fonts',
    transactionId: 't_first'
  };
const built = await buildContentProject(options),
  manifest = built.manifest;
const cjs = path.join(root, 'native.cjs');
fs.copyFileSync(new URL(vm.runtime.glue, vendor), cjs);
const ck = await createRequire(import.meta.url)(cjs)({
  locateFile: () => fileURLToPath(new URL(vm.runtime.wasm, vendor))
});
test.after(() => {
  assert.equal(path.dirname(root), tempParent);
  assert.ok(path.basename(root).startsWith('egret-font-pipeline-'));
  fs.rmSync(root, { recursive: true });
});
const request = (key, extra = {}) => ({
  fontSet: key,
  text: 'Variable line heights: office ABC 123 with a longer paragraph.',
  width: 150,
  fontFamilies: ['Example'],
  fontSize: 24,
  locale: 'en',
  direction: 'ltr',
  fillColor: 0xffffff,
  density: 1,
  textGeometry: true,
  ...extra
});
function loaderFor(engine, hook) {
  return createFontContentLoader(engine, manifest, rows => {
    const ids = new Map(rows.map(row => [row.binding.ref, row.id]));
    return {
      load: async (ref, ctx) => (hook ? hook(ids.get(ref), ctx) : Uint8Array.from(originals.get(ids.get(ref)))),
      dispose() {}
    };
  });
}
async function setup(t, hook) {
  const engine = await createEngine({ host: host().adapter }),
    loader = loaderFor(engine, hook),
    provider = createCanvasKitFontSetProvider({ canvasKit: ck, buildIdentity: vm.runtime.buildIdentity }),
    cache = createParagraphCache(engine.assets, { provider });
  t.after(async () => {
    engine.dispose();
    await provider.close();
  });
  return { engine, loader, provider, cache };
}

test('font build preserves source bytes, provenance, adoption and deterministic warm records including a >8MiB CJK face', async () => {
  assert.equal(built.status, 'adopted');
  assert.equal(store.getSnapshot().revision, 1);
  for (const entry of manifest.entries) {
    const original = originals.get(entry.id);
    assert.deepEqual(fs.readFileSync(path.join(root, entry.artifact.path)), original);
    assert.equal(entry.artifact.sha256, sha(original));
    assert.equal(entry.provenance.license, 'OFL-1.1');
    assert.equal(inspectFontArtifact(original).format, entry.settings.options.flavor);
  }
  const warm = await buildContentProject({ ...options, transactionId: 't_warm' });
  assert.ok(warm.receipt.resources.every(row => row.cache === 'hit'));
  assert.equal(warm.generationId, built.generationId);
  // An ordinary store holds one blob of at most 16 MiB, which the CJK face is under; one byte more is refused there and admitted by the font profile.
  const ordinary = openContentStore(path.join(root, 'cache')),
    above = new Uint8Array(16777217);
  try {
    assert.equal(originals.get('e_cjk').length < 16777216, true);
    assert.throws(
      () => ordinary.putBlob(above),
      e => e.code === 'CONTENT_STORE_INPUT'
    );
  } finally {
    ordinary.close();
  }
  const profiled = openContentStore(path.join(root, 'cache'), { profile: 'font-sfnt/1' });
  try {
    assert.equal(profiled.putBlob(above).byteLength, 16777217);
  } finally {
    profiled.close();
  }
  const malformed = Uint8Array.from(originals.get('e_latin'));
  malformed[0] = 0x77;
  assert.throws(() => inspectFontArtifact(malformed));
  assert.throws(() => inspectFontArtifact(new Uint16Array(100)));
  assert.throws(() => inspectFontArtifact(new Uint8Array(new SharedArrayBuffer(100))));
});
test('managed fonts coalesce groups, return detached bytes and retire on genuine scopes', async t => {
  const { engine, loader } = await setup(t);
  const a = engine.createScope(),
    b = engine.createScope(),
    g1 = loader.load(a, ['e_latin']),
    g2 = loader.load(b, ['e_latin']);
  await Promise.all([g1.ready, g2.ready]);
  assert.equal(loader.getStatus().sourceBytes, originals.get('e_latin').length);
  const asset = g1.getFonts()[0],
    copy = asset.copyBytes();
  copy.fill(0);
  assert.notEqual(asset.copyBytes()[0] + asset.copyBytes()[1], 0);
  a.dispose();
  await g1.closed;
  assert.throws(() => asset.copyBytes());
  assert.equal(g2.getFonts()[0].identity, sha(originals.get('e_latin')));
  b.dispose();
  await g2.closed;
  assert.deepEqual(loader.getStatus(), { groups: 0, sourceBytes: 0 });
  assert.throws(
    () => loader.load(engine.createScope(), ['e_latin', 'e_cjk']),
    e => e.code === 'FONT_CONTENT_LIMIT'
  );
  const foreign = await createEngine({ host: host().adapter });
  try {
    assert.throws(() => loader.load(foreign.createScope(), ['e_latin']));
  } finally {
    foreign.dispose();
  }
});
test('cancel and failed font candidates cannot publish or poison the next group', async t => {
  const gate = deferred();
  let mode = 'delay';
  const { engine, loader, provider } = await setup(t, async id => {
    if (mode === 'delay') await gate.promise;
    if (mode === 'fail') throw Error('font-fetch-failed');
    return Uint8Array.from(originals.get(id));
  });
  const scope = engine.createScope(),
    pending = provider.load(scope, loader, ['e_latin']);
  void pending.catch(() => {});
  scope.dispose();
  await assert.rejects(pending);
  gate.resolve();
  await flush();
  assert.equal(provider.getStatus().sets, 0);
  mode = 'fail';
  await assert.rejects(provider.load(engine.createScope(), loader, ['e_cjk']));
  mode = 'ready';
  const next = await provider.load(engine.createScope(), loader, ['e_latin']);
  assert.ok(provider.hasFontSet(next.key));
  next.dispose();
  await next.closed;
  assert.equal(provider.hasFontSet(next.key), false);
});
test('two real font generations share one cache; warm retired keys refuse but borrowed rasters survive', async t => {
  const { engine, loader, provider, cache } = await setup(t),
    a = await provider.load(engine.createScope(), loader, ['e_latin']),
    b = await provider.load(engine.createScope(), loader, ['e_cjk']);
  const x = await cache.acquire(request(a.key)),
    y = await cache.acquire(request(b.key));
  assert.notDeepEqual(x.metrics, y.metrics);
  assert.notDeepEqual(copyImageData2DPixels(x.lease.value.imageData), copyImageData2DPixels(y.lease.value.imageData));
  const fixed = createCanvasKitParagraphProvider({
    canvasKit: ck,
    fonts: [{ family: 'Example', identity: sha(originals.get('e_cjk')), data: originals.get('e_cjk') }]
  });
  try {
    const ref = await fixed.prepare(request(undefined), { signal: new CancellationController().signal });
    assert.deepEqual(y.metrics, ref.metrics);
    assert.deepEqual(copyImageData2DPixels(y.lease.value.imageData), copyImageData2DPixels(ref.image));
  } finally {
    fixed.dispose();
  }
  a.dispose();
  await a.closed;
  await assert.rejects(cache.acquire(request(a.key)), e => e.code === 'PARAGRAPH_FONT_SET_RETIRED');
  assert.ok(x.lease.value.imageData.width > 0);
  x.lease.release();
  y.lease.release();
  const later = await provider.load(engine.createScope(), loader, ['e_latin']);
  assert.notEqual(later.key, a.key);
  b.dispose();
  later.dispose();
  await Promise.all([b.closed, later.closed]);
  assert.equal(provider.getStatus().fontBytes, 0);
});
test('UI stages font layout and geometry together; closed candidate preserves the old committed paragraph', async t => {
  const { engine, loader, provider, cache } = await setup(t),
    scope = engine.createScope(),
    a = await provider.load(engine.createScope(), loader, ['e_latin']),
    b = await provider.load(engine.createScope(), loader, ['e_cjk']);
  const tree = (font, version) => ({
    kind: 'column',
    id: 'column',
    explicitWidth: 150,
    children: [
      {
        kind: 'leaf',
        id: 'paragraph',
        content: {
          revision: version,
          async prepare(ctx) {
            const node = createParagraph(engine, ctx.scope, cache);
            node.setRequest(request(font.key, { width: ctx.width }));
            const metrics = await node.prepare();
            return { content: node, measuredHeight: metrics.height };
          }
        }
      },
      { kind: 'leaf', id: 'footer', explicitHeight: 10 }
    ]
  });
  const ui = createUiRoot({
    engine,
    scope,
    id: 'font-ui',
    viewport: { width: 150, height: 800 },
    density: 1,
    tree: tree(a, 1)
  });
  ui.commit(await ui.prepare());
  const old = ui.snapshot();
  ui.setTree(tree(b, 2));
  const prepared = await ui.prepare();
  assert.deepEqual(ui.snapshot().boxes, old.boxes);
  ui.commit(prepared);
  assert.notEqual(ui.snapshot().boxes.find(x => x.id === 'footer').y, old.boxes.find(x => x.id === 'footer').y);
  const good = ui.snapshot();
  a.dispose();
  ui.setTree(tree(a, 3));
  await assert.rejects(ui.prepare());
  assert.deepEqual(ui.snapshot().boxes, good.boxes);
});
test('closing the source during external byte disposal cannot publish or leak accounting', async t => {
  const engine = await createEngine({ host: host().adapter });
  t.after(() => engine.dispose());
  let loader;
  loader = createFontContentLoader(engine, manifest, () => ({
    load: async () => Uint8Array.from(originals.get('e_latin')),
    dispose() {
      loader.dispose();
    }
  }));
  const group = loader.load(engine.createScope(), ['e_latin']);
  await assert.rejects(group.ready);
  await flush();
  assert.deepEqual(loader.getStatus(), { groups: 0, sourceBytes: 0 });
});
test('fixed legacy providers refuse explicit font sets before allocating any request', async t => {
  const engine = await createEngine({ host: host().adapter });
  t.after(() => engine.dispose());
  let calls = 0;
  const cache = createParagraphCache(engine.assets, {
    provider: {
      identity: 'legacy',
      async prepare() {
        calls++;
        throw Error('not reached');
      }
    }
  });
  await assert.rejects(cache.acquire(request('foreign')), e => e.code === 'PARAGRAPH_FEATURE_UNSUPPORTED');
  assert.equal(calls, 0);
  assert.equal(cache.getStatus().entries, 0);
});

test('retiring a font set waits for its pending native result but refuses all new demand immediately', async t => {
  const { engine, loader, provider } = await setup(t),
    set = await provider.load(engine.createScope(), loader, ['e_latin']);
  const pending = provider.prepare(request(set.key), { signal: new CancellationController().signal });
  set.dispose();
  assert.equal(provider.hasFontSet(set.key), false);
  assert.equal(provider.getStatus().pendingJobs, 1);
  assert.equal(provider.getStatus().sets, 1);
  await assert.rejects(pending, e => e.code === 'PARAGRAPH_FONT_SET_CANCELLED');
  await set.closed;
  assert.equal(provider.getStatus().sets, 0);
  assert.equal(provider.getStatus().fontBytes, 0);
});
test('font liveness callbacks cannot exceed the existing 256-caller cache limit by reentry', async t => {
  const engine = await createEngine({ host: host().adapter });
  t.after(() => engine.dispose());
  const gate = deferred();
  let nested = [],
    entered = false,
    cache;
  cache = createParagraphCache(engine.assets, {
    provider: {
      identity: 'reentrant-font-set',
      capabilities: { fontSets: true },
      hasFontSet() {
        if (!entered) {
          entered = true;
          for (let i = 0; i < 256; i++) {
            const p = cache.acquire(request('set', { textGeometry: undefined }));
            void p.catch(() => {});
            nested.push(p);
          }
        }
        return true;
      },
      async prepare() {
        await gate.promise;
        throw Error('finish');
      }
    }
  });
  await assert.rejects(
    cache.acquire(request('set', { textGeometry: undefined })),
    e => e.code === 'PARAGRAPH_CACHE_BUDGET'
  );
  assert.equal(cache.getStatus().callerLeases, 256);
  gate.resolve();
  await Promise.allSettled(nested);
  assert.equal(cache.getStatus().callerLeases, 0);
});
test('reentrant font roots cannot admit a ninth group', async t => {
  const { engine, loader } = await setup(t),
    scope = engine.createScope(),
    nested = [];
  let entered = false;
  const roots = new Proxy(['e_latin'], {
    getOwnPropertyDescriptor(target, key) {
      if (key === '0' && !entered) {
        entered = true;
        for (let i = 0; i < 8; i++) nested.push(loader.load(scope, ['e_latin']));
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  assert.throws(
    () => loader.load(scope, roots),
    e => e.code === 'FONT_CONTENT_LIMIT'
  );
  await Promise.all(nested.map(group => group.ready));
  assert.equal(loader.getStatus().groups, 8);
  scope.dispose();
  assert.equal(loader.getStatus().groups, 0);
});
test('native zero-allocation refusal preserves the heap and later fixed-font work', () => {
  const module = Object.create(ck),
    head = Uint8Array.from(ck.HEAPU8.subarray(0, 64));
  module._malloc = () => 0;
  const fonts = [{ family: 'Example', identity: 'latin', data: originals.get('e_latin') }];
  assert.throws(
    () => createCanvasKitParagraphProvider({ canvasKit: module, fonts }),
    e => e.code === 'PARAGRAPH_FONT_ALLOCATION_REFUSED'
  );
  assert.deepEqual(ck.HEAPU8.subarray(0, 64), head);
  const live = createCanvasKitParagraphProvider({ canvasKit: ck, fonts });
  live.dispose();
});
test('concurrent font generations share one native face and release independent ownership', async t => {
  const engine = await createEngine({ host: host().adapter }),
    loader = loaderFor(engine);
  let decodes = 0;
  const module = Object.create(ck);
  module.Typeface = {
    MakeTypefaceFromData: ck.Typeface.MakeTypefaceFromData,
    _MakeTypefaceFromData(pointer, length) {
      decodes++;
      return ck.Typeface._MakeTypefaceFromData(pointer, length);
    }
  };
  const provider = createCanvasKitFontSetProvider({ canvasKit: module });
  t.after(async () => {
    engine.dispose();
    await provider.close();
  });
  const a = await provider.load(engine.createScope(), loader, ['e_latin']),
    b = await provider.load(engine.createScope(), loader, ['e_latin']);
  assert.equal(decodes, 1);
  assert.notEqual(a.key, b.key);
  a.dispose();
  await a.closed;
  const result = await provider.prepare(request(b.key), { signal: new CancellationController().signal });
  assert.ok(result.metrics.height > 0);
  b.dispose();
  await b.closed;
  assert.equal(provider.getStatus().sets, 0);
});

test('failed alias allocation releases its borrowed native face before later generations retire', async t => {
  const engine = await createEngine({ host: host().adapter }),
    loader = loaderFor(engine);
  let refuse = false,
    deleted = 0,
    decoded = 0;
  const module = Object.create(ck);
  module._malloc = n => (refuse && n < 256 ? 0 : ck._malloc(n));
  module.Typeface = {
    MakeTypefaceFromData: ck.Typeface.MakeTypefaceFromData,
    _MakeTypefaceFromData(pointer, length) {
      decoded++;
      const face = ck.Typeface._MakeTypefaceFromData(pointer, length),
        dispose = face.delete.bind(face);
      face.delete = () => {
        deleted++;
        dispose();
      };
      return face;
    }
  };
  const provider = createCanvasKitFontSetProvider({ canvasKit: module });
  t.after(async () => {
    engine.dispose();
    await provider.close();
  });
  const first = await provider.load(engine.createScope(), loader, ['e_latin']);
  refuse = true;
  await assert.rejects(
    provider.load(engine.createScope(), loader, ['e_latin']),
    e => e.code === 'PARAGRAPH_FONT_ALLOCATION_REFUSED'
  );
  assert.equal(decoded, 1);
  assert.equal(deleted, 0);
  first.dispose();
  await first.closed;
  assert.equal(deleted, 1);
  assert.equal(provider.getStatus().fontBytes, 0);
  refuse = false;
  const later = await provider.load(engine.createScope(), loader, ['e_latin']);
  assert.equal(decoded, 2);
  later.dispose();
  await later.closed;
  assert.equal(deleted, 2);
});

// Repack a temporary copy of the existing OFL font with independently authored color tables.
// Directory entries and the head checksum follow the OpenType file layout; no vendor bytes are edited on disk.
function fontWithTables(extra) {
  const source = originals.get('e_latin');
  const tables = new Map();
  for (let i = 0; i < source.readUInt16BE(4); i++) {
    const row = 12 + i * 16;
    const offset = source.readUInt32BE(row + 8),
      length = source.readUInt32BE(row + 12);
    tables.set(source.toString('ascii', row, row + 4), Buffer.from(source.subarray(offset, offset + length)));
  }
  for (const [tag, bytes] of Object.entries(extra)) tables.set(tag, bytes);
  const align = n => Math.ceil(n / 4) * 4;
  const directoryEnd = 12 + tables.size * 16;
  const result = Buffer.alloc(directoryEnd + [...tables.values()].reduce((sum, table) => sum + align(table.length), 0));
  source.copy(result, 0, 0, 4);
  const power = Math.floor(Math.log2(tables.size));
  result.writeUInt16BE(tables.size, 4);
  result.writeUInt16BE(16 * 2 ** power, 6);
  result.writeUInt16BE(power, 8);
  result.writeUInt16BE(tables.size * 16 - 16 * 2 ** power, 10);
  function checksum(start, length) {
    let sum = 0;
    for (let i = 0; i < length; i += 4) sum = (sum + result.readUInt32BE(start + i)) >>> 0;
    return sum;
  }
  let row = 12,
    offset = directoryEnd,
    head;
  for (const tag of [...tables.keys()].sort()) {
    const bytes = tables.get(tag);
    bytes.copy(result, offset);
    if (tag === 'head') {
      head = offset;
      result.writeUInt32BE(0, head + 8);
    }
    result.write(tag, row, 4, 'ascii');
    result.writeUInt32BE(checksum(offset, align(bytes.length)), row + 4);
    result.writeUInt32BE(offset, row + 8);
    result.writeUInt32BE(bytes.length, row + 12);
    row += 16;
    offset += align(bytes.length);
  }
  result.writeUInt32BE((0xb1b0afba - checksum(0, result.length)) >>> 0, head + 8);
  return result;
}

// U+0041 is glyph 36 in the pinned Noto Sans. Each color fixture assigns green to that glyph.
const cpal = Buffer.from('0000 0001 0001 0001 0000000e 0000 00ff00ff'.replaceAll(' ', ''), 'hex');
const colr0 = Buffer.from('0000 0001 0000000e 00000014 0001 0024 0000 0001 0024 0000'.replaceAll(' ', ''), 'hex');
const colr1 = Buffer.from(
  // v1 header, one BaseGlyphPaintRecord, PaintGlyph(36), PaintSolid(palette 0).
  (
    '0001 0000 00000000 00000000 0000 00000022 00000000 00000000 00000000 00000000 ' +
    '00000001 0024 0000000a 0a 000006 0024 02 0000 4000'
  ).replaceAll(' ', ''),
  'hex'
);
const drawing = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path id="glyph36" fill="lime" d="M0 0H800V800H0Z"/></svg>'
);
const svgTable = Buffer.alloc(24 + drawing.length);
svgTable.writeUInt32BE(10, 2); // Offset to the document list.
svgTable.writeUInt16BE(1, 10);
svgTable.writeUInt16BE(36, 12);
svgTable.writeUInt16BE(36, 14);
svgTable.writeUInt32BE(14, 16);
svgTable.writeUInt32BE(drawing.length, 20);
drawing.copy(svgTable, 24);

// An authored green PNG represents A at the 32 ppem strike of the pinned test face.
function bitmapStrike() {
  const source = originals.get('e_latin');
  let glyphCount;
  for (let i = 0; i < source.readUInt16BE(4); i++) {
    const entry = 12 + 16 * i;
    if (source.toString('ascii', entry, entry + 4) === 'maxp') {
      glyphCount = source.readUInt16BE(source.readUInt32BE(entry + 8) + 4);
      break;
    }
  }
  assert(glyphCount > 36);
  const { PNG } = createRequire(import.meta.url)('pngjs');
  const image = new PNG({ width: 16, height: 16 });
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i + 1] = 255;
    image.data[i + 3] = 255;
  }
  const png = PNG.sync.write(image);
  const strike = 12,
    dataOffset = 4 + 4 * (glyphCount + 1);
  const table = Buffer.alloc(strike + dataOffset + 8 + png.length);
  table.writeUInt16BE(1); // version
  table.writeUInt16BE(1, 2); // bitmap only
  table.writeUInt32BE(1, 4); // one strike
  table.writeUInt32BE(strike, 8);
  table.writeUInt16BE(32, strike);
  table.writeUInt16BE(72, strike + 2);
  for (let i = 0; i <= glyphCount; i++)
    table.writeUInt32BE(i <= 36 ? dataOffset : dataOffset + 8 + png.length, strike + 4 + 4 * i);
  table.write('png ', strike + dataOffset + 4);
  png.copy(table, strike + dataOffset + 8);
  return table;
}

test('CanvasKit paragraphs explicitly refuse SVG and v1 color paints before a fallback outline can render', async () => {
  const fixed = bytes =>
    createCanvasKitParagraphProvider({
      canvasKit: ck,
      fonts: [{ family: 'Example', identity: sha(bytes), data: bytes }]
    });
  for (const table of [{ 'SVG ': svgTable }, { COLR: colr1, CPAL: cpal }]) {
    const bytes = fontWithTables(table);
    assert.equal(inspectFontArtifact(bytes).format, 'truetype');
    assert.throws(
      () => fixed(bytes),
      e => e.code === 'PARAGRAPH_FONT_COLOR_UNSUPPORTED'
    );
  }
  for (const tables of [{ COLR: colr0, CPAL: cpal }, { sbix: bitmapStrike() }]) {
    const valid = fixed(fontWithTables(tables));
    try {
      const rendered = await valid.prepare(request(undefined, { text: 'A', fillColor: 0xff0000 }), {
        signal: new CancellationController().signal
      });
      const pixels = copyImageData2DPixels(rendered.image);
      assert(
        pixels.some((value, i) => i % 4 === 1 && value > 128 && pixels[i - 1] === 0 && pixels[i + 1] === 0),
        'supported color layers and bitmap strikes preserve their authored green'
      );
    } finally {
      valid.dispose();
    }
  }
});

test('a rejected color font generation releases its group and preserves the previous paragraph face', async t => {
  const bytes = fontWithTables({ 'SVG ': svgTable });
  const colorFile = {
    ...files[0],
    id: 'f_colored',
    path: 'sources/colored.ttf',
    sha256: sha(bytes),
    byteLength: bytes.length
  };
  fs.writeFileSync(path.join(root, colorFile.path), bytes);
  const colorRecipe = {
    ...recipes[0],
    resourceId: 'e_colored',
    sourceFileId: colorFile.id,
    provenance: {
      ...recipes[0].provenance,
      origin: 'Temporary Noto derivative with an authored SVG table',
      sha256: sha(bytes)
    }
  };
  const colorBuild = await buildContentProject({
    ...options,
    projectStore: get(createProjectStore({ ...snapshot, files: [files[0], colorFile] })),
    recipe: { ...options.recipe, recipes: [recipes[0], colorRecipe] },
    selectorId: 'e_color_test',
    transactionId: 't_color_test'
  });
  assert.equal(colorBuild.status, 'adopted');
  const engine = await createEngine({ host: host().adapter });
  const loader = createFontContentLoader(engine, colorBuild.manifest, rows => {
    const sources = new Map(
      rows.map(row => [row.binding.ref, row.id === 'e_colored' ? bytes : originals.get('e_latin')])
    );
    return { load: async ref => Uint8Array.from(sources.get(ref)), dispose() {} };
  });
  const scope = engine.createScope(),
    provider = createCanvasKitFontSetProvider({ canvasKit: ck });
  t.after(async () => {
    engine.dispose();
    await provider.close();
  });
  const original = await provider.load(scope, loader, ['e_latin']);
  const before = provider.getStatus();
  await assert.rejects(provider.load(scope, loader, ['e_colored']), e => e.code === 'PARAGRAPH_FONT_COLOR_UNSUPPORTED');
  assert.deepEqual(provider.getStatus(), before);
  assert.equal(loader.getStatus().groups, 1);
  assert.ok(provider.hasFontSet(original.key));
  assert(
    (await provider.prepare(request(original.key, { text: 'A' }), { signal: new CancellationController().signal }))
      .image
  );
  original.dispose();
  await original.closed;
  assert.deepEqual(loader.getStatus(), { groups: 0, sourceBytes: 0 });
  assert.equal(provider.getStatus().sets, 0);
});
