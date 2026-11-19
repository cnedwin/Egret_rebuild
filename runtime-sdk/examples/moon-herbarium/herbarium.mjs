// SPDX-License-Identifier: Apache-2.0
// A small inventory game in the spirit of examples/ui-inventory: combine the requested ingredients
// to fill a prescription. Stock, selection, payment and shopkeeper name live in this project.
import { Bitmap, Sprite, createAssetRef, createAssetType, createTexture, isTexture } from '@egret/engine';
import { hudRuns, herbariumRaster } from './lettering.mjs';

const HERBS = [
  ['月露草', '溪谷采摘'], ['银叶薄荷', '山间清香'], ['紫苏花', '林下野生'], ['桃枝', '初夏新采'],
  ['金盏花', '日晒留香'], ['绯莓', '深林果实'], ['苍兰', '幽谷兰叶'], ['琥珀根', '山石根茎'],
  ['星叶藤', '岩壁藤蔓'], ['白芍', '春分入窖']
];
const ORDERS = [
  ['月露清饮', [0, 1]], ['花间晚茶', [2, 4]], ['山野莓露', [3, 5]], ['幽谷清汤', [6, 7]], ['星河花酿', [8, 9]]
];
const LIST = { x: 16, y: 296, width: 328, height: 214, row: 47 };
const COLORS = { ink: '#f4eacf', faded: '#a6b6a3', gold: '#dbbe82' };
const range = (v, hi) => Math.max(0, Math.min(hi, v));
function staticText() {
  return [
    ['title', '月下药铺', 25, COLORS.ink, 700], ['open', '山间夜市  ·  营业中', 12, COLORS.gold, 500],
    ['cabinet', '药材柜', 18, COLORS.ink, 700], ['scroll', '上下滑动选药', 12, COLORS.faded],
    ['edit', '掌柜署名', 12, COLORS.faded], ['brew', '开炉煎药', 17, '#202c24', 700],
    ['change', '修改', 12, COLORS.gold], ['add', '选入', 13, COLORS.faded], ['added', '已选', 13, '#f3d28b', 700],
    ...HERBS.flatMap(([name, origin], i) => [
      ['herb' + i, name, 15, COLORS.ink, 600], ['origin' + i, origin, 10, COLORS.faded]
    ]),
    ...Array.from({ length: 5 }, (_, i) => ['qty' + i, '× ' + i, 13, COLORS.gold])
  ];
}
export async function createHerbarium(context, raster = herbariumRaster(context.raster)) {
  const { engine, scope, signal, publishPage, edit, state, playSound } = context;
  const stock = HERBS.map(() => 4), chosen = new Set();
  let order = 0, filled = 0, name = '小掌柜', message = '照药方选入两味药材，再开炉煎药。';
  let offset = 0, pointer, characterPose = 0, stopped = false, loads = 0, releases = 0;
  let hudError, latestLease, pending, revision = 0, painted = 0, slot = 0;
  const labels = raster.makeLabels(staticText());
  function hudText() {
    const [title, needed] = ORDERS[order];
    return {
      order: '今夜药方  ·  ' + title,
      ingredients: needed.map(i => HERBS[i][0]).join('  ＋  '),
      message, signature: name || '未署名', score: '已交付  ' + filled + '  帖'
    };
  }
  const type = createAssetType('moon-herbarium-texture', isTexture);
  const sources = new Map([
    ['moon-workshop', signal => raster.loadPng('assets/workshop.png', 328, 164, signal)],
    ['moon-botanicals', signal => raster.loadPng('assets/botanicals.png', 240, 60, signal)],
    ['moon-labels', () => labels.image],
    ['moon-initial-hud', () => raster.makeHud(hudText())]
  ]);
  const publications = new WeakMap();
  function bindPage(id, texture) {
    publications.set(texture, publishPage(id, texture.imageData));
  }
  engine.assets.register(type, {
    async load(ref, context) {
      const image = await sources.get(ref.id)(context.signal);
      const texture = createTexture(image);
      loads++;
      return texture;
    },
    dispose(texture) {
      try { publications.get(texture)?.release(); }
      finally { texture.dispose(); releases++; }
    }
  });
  const permanent = ['moon-workshop', 'moon-botanicals', 'moon-labels'];
  const group = engine.createAssetGroup(scope, permanent.map(key => createAssetRef(type, key)));
  const staticLeases = await group.ready;
  latestLease = scope.use(await engine.assets.acquire(createAssetRef(type, 'moon-initial-hud'), { signal }));
  const leases = [...staticLeases, latestLease];
  leases.forEach((lease, i) => bindPage(i + 1, lease.value));
  function sprite(parent, x = 0, y = 0) {
    const item = parent.addChild(scope.use(new Sprite()));
    item.x = x; item.y = y;
    return item;
  }
  function rectangle(item, x, y, w, h, color, alpha = 1) {
    item.graphics.beginFill(color, alpha).drawRect(x, y, w, h).endFill();
  }
  function bitmap(parent, lease, region, x, y, scale = 1) {
    const item = parent.addChild(scope.use(new Bitmap(lease)));
    if (region) item.sourceRect = region;
    item.x = x; item.y = y;
    item.scaleX = item.scaleY = scale;
    return item;
  }
  const root = sprite(engine.stage);
  const label = (parent, id, x, y) => bitmap(parent, leases[2], labels.runs.get(id), x, y, 0.5);
  const hud = new Map();
  function hudLine(parent, key, x, y) {
    hud.set(key, bitmap(parent, leases[3], hudRuns[key], x, y, 0.5));
  }
  label(root, 'title', 16, 10);
  label(root, 'open', 226, 24);
  rectangle(root, 16, 48, 328, 1, 0x516050);
  bitmap(root, leases[0], undefined, 16, 56);
  const character = bitmap(root, leases[1], { x: 0, y: 24, width: 24, height: 36 }, 135, 150, 1.25);
  const prescription = sprite(root, 16, 171);
  rectangle(prescription, 0, 0, 328, 76, 0x192f2c, 0.86);
  rectangle(prescription, 0, 0, 3, 76, 0xc59b55);
  hudLine(prescription, 'order', 14, 10);
  hudLine(prescription, 'ingredients', 14, 43);
  label(root, 'cabinet', 16, 259);
  label(root, 'scroll', 259, 268);
  const viewport = sprite(root, LIST.x, LIST.y);
  viewport.clipRect = { x: 0, y: 0, width: LIST.width, height: LIST.height };
  const contents = sprite(viewport);
  const rows = HERBS.map((_, i) => {
    const node = sprite(contents, 0, i * LIST.row);
    const bg = sprite(node);
    bitmap(node, leases[1], { x: i * 24, y: 0, width: 24, height: 24 }, 8, 6, 1.5);
    label(node, 'herb' + i, 54, 3);
    label(node, 'origin' + i, 54, 24);
    const amount = label(node, 'qty4', 218, 15), check = label(node, 'add', 276, 15);
    return { bg, amount, check };
  });
  const track = sprite(root, 341, LIST.y), thumb = sprite(track);
  rectangle(track, 0, 0, 3, LIST.height, 0x273d36);
  const thumbHeight = Math.round(LIST.height ** 2 / (HERBS.length * LIST.row));
  rectangle(thumb, 0, 0, 3, thumbHeight, 0xb99f6d);
  const maxOffset = HERBS.length * LIST.row - LIST.height;
  function scroll(next) {
    offset = Math.round(range(next, maxOffset));
    contents.y = -offset;
    thumb.y = Math.round(offset / maxOffset * (LIST.height - thumbHeight));
  }
  function drawRows() {
    rows.forEach(({ bg, amount, check }, i) => {
      const active = chosen.has(i);
      bg.graphics.clear();
      rectangle(bg, 0, 0, 328, LIST.row - 1, active ? 0x39503d : (i % 2 ? 0x213831 : 0x263c34));
      if (active) rectangle(bg, 0, 0, 3, LIST.row - 1, 0xe1ba75);
      amount.sourceRect = labels.runs.get('qty' + stock[i]);
      check.sourceRect = labels.runs.get(active ? 'added' : 'add');
    });
  }
  drawRows();
  hudLine(root, 'message', 16, 518);
  rectangle(root, 16, 547, 328, 40, 0x20362f);
  label(root, 'edit', 26, 560);
  hudLine(root, 'signature', 94, 556);
  label(root, 'change', 303, 560);
  rectangle(root, 16, 598, 214, 34, 0xdaba7d);
  label(root, 'brew', 85, 602);
  hudLine(root, 'score', 249, 607);

  function report(event) {
    state({ event, name, recipe: ORDERS[order][0], selected: [...chosen].map(i => HERBS[i][0]),
      stock: [...stock], filled, scroll: offset, message, characterPose });
  }
  // Alternate two stable asset keys. Prepare the next immutable text page before changing the
  // borrowed bitmaps, then release its predecessor. Rapid edits collapse into the latest revision.
  async function paintHud() {
    while (!stopped && painted !== revision) {
      const target = revision, key = 'moon-hud-' + (slot ^= 1), values = hudText();
      sources.set(key, () => raster.makeHud(values));
      const next = await engine.assets.acquire(createAssetRef(type, key), { signal });
      if (stopped) { next.release(); return; }
      try {
        bindPage(4, next.value);
        for (const [line, object] of hud) {
          object.textureLease = next;
          object.sourceRect = hudRuns[line];
        }
      } catch (error) { next.release(); throw error; }
      latestLease?.release();
      latestLease = next;
      painted = target;
    }
  }
  function refresh(event) {
    revision++;
    if (!pending) pending = paintHud().catch(error => { hudError = error; }).finally(() => { pending = undefined; });
    drawRows();
    report(event);
  }
  function choose(i) {
    if (chosen.has(i)) chosen.delete(i);
    else if (stock[i] > 0 && chosen.size < 2) chosen.add(i);
    else { message = stock[i] ? '药方只需两味，请先移出一味。' : '这味药材已经用完。'; refresh('selection'); return; }
    message = chosen.size ? '已选  ' + [...chosen].map(n => HERBS[n][0]).join('、') : '照药方选入两味药材，再开炉煎药。';
    refresh('selection');
  }
  function brew() {
    if (ORDERS[order][1].every(i => chosen.has(i))) {
      for (const i of chosen) stock[i]--;
      filled++;
      order = (order + 1) % ORDERS.length;
      message = '煎药完成，已交付客人。下一张药方已送达。';
      if (filled % (ORDERS.length * 4) === 0) {
        stock.fill(4);
        message = '本季药方全部交付，新一季药材已入柜。';
      }
      chosen.clear();
      playSound('assets/chime.wav');
      refresh('brewed');
    } else {
      message = '药材尚未配齐，请核对药方。';
      refresh('mismatch');
    }
  }
  function insideList(x, y) {
    return x >= LIST.x && x < LIST.x + LIST.width && y >= LIST.y && y < LIST.y + LIST.height;
  }
  function action(x, y) {
    if (insideList(x, y)) choose(Math.floor((y - LIST.y + offset) / LIST.row));
    else if (x >= 16 && x < 344 && y >= 547 && y < 587) { edit(name); report('edit'); }
    else if (x >= 16 && x < 230 && y >= 598 && y < 632) brew();
  }
  report('ready');
  return {
    update(time) {
      if (hudError) throw hudError;
      const pose = Math.floor(time / 190) % 4;
      if (pose !== characterPose) {
        characterPose = pose;
        character.sourceRect = { x: pose * 24, y: 24, width: 24, height: 36 };
      }
      character.x = 132 + Math.round((1 - Math.cos(time / 1200)) * 19);
      character.y = 127 + (pose % 2);
    },
    input(e) {
      if (stopped) return;
      if (e.type === 'text' || e.type === 'submit') {
        name = Array.from(String(e.text ?? '').replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 16).join('');
        refresh(e.type);
        return;
      }
      if (e.type === 'cancel') { if (pointer?.id === e.id || e.id === undefined) pointer = undefined; return; }
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
      if (e.type === 'scroll' && insideList(e.x, e.y) && Number.isFinite(e.dy)) {
        scroll(offset + e.dy); report('scroll'); return;
      }
      if (e.type === 'down' && !pointer) {
        pointer = { id: e.id, x: e.x, y: e.y, offset, list: insideList(e.x, e.y), drag: false };
      } else if (pointer && e.id === pointer.id) {
        if (Math.hypot(e.x - pointer.x, e.y - pointer.y) > 5) pointer.drag = true;
        if ((e.type === 'move' || e.type === 'up') && pointer.drag && pointer.list) scroll(pointer.offset + pointer.y - e.y);
        if (e.type === 'up') {
          const down = pointer;
          pointer = undefined;
          if (down.drag && down.list) report('scroll');
          else if (!down.drag) action(e.x, e.y);
        }
      }
    },
    pause() { pointer = undefined; report('paused'); },
    resume() { report('resumed'); },
    async close() {
      stopped = true; pointer = undefined;
      await pending;
      latestLease?.release();
      sources.clear();
    },
    closedSnapshot: () => ({ texturesLoaded: loads, texturesReleased: releases, filled, name })
  };
}
