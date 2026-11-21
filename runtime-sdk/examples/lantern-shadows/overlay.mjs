// SPDX-License-Identifier: Apache-2.0
import { Mesh2D, Sprite, createSharedGeometry2D } from '@egret/engine';
import { makeLanternLettering } from './assets-lettering.mjs';

const book = { x: 280, y: 198, w: 400, h: 210 };
const choices = ['start-boss', 'start-act2', 'start-erlang', 'start-act3', 'start-laozi'];
const pads = [
  ['left', 48, 448, 66, 64, '◀'],
  ['right', 122, 448, 66, 64, '▶'],
  ['special', 606, 448, 66, 64, '变'],
  ['dash', 692, 448, 66, 64, '云'],
  ['attack', 775, 423, 70, 74, '棍'],
  ['jump', 856, 448, 66, 64, '跳']
];
const contains = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const clamp = (n, max) => Math.max(0, Math.min(max, n));

/** The logical landscape stage and all input commands belong to the game model.
 * Only the browser's DOM playbill and HUD are replaced here. */
export async function createLanternOverlay(services, model) {
  const { engine, scope } = services;
  const { label, flag } = await makeLanternLettering(services);
  const sprite = (parent, x = 0, y = 0) => {
    const node = parent.addChild(scope.use(new Sprite()));
    node.x = x;
    node.y = y;
    return node;
  };
  const root = sprite(engine.stage);
  const fill = (node, x, y, w, h, rgb, alpha = 1) =>
    node.graphics.beginFill(rgb, alpha).drawRect(x, y, w, h).endFill();
  function button(parent, x, y, w, h, title) {
    const node = sprite(parent, x, y);
    fill(node, 0, 0, w, h, 0x4b1810, 0.89);
    fill(node, 0, h - 2, w, 2, 0xd19646);
    const write = label(node, 8, (h - 25) / 2, 18, w - 13);
    write(title);
    return { node, write, x, y, w, h };
  }
  const text = (id) => model.node(id)?.textContent.trim() ?? '';
  const visible = (id) => model.node(id)?.hidden === false;
  const menu = sprite(root),
    hud = sprite(root),
    results = sprite(root),
    pause = sprite(root);
  const controls = new Map();
  fill(menu, 0, 0, 960, 540, 0x641711);
  for (let x = 0; x < 960; x += 48) fill(menu, x, 0, 18, 540, 0x812019);
  fill(menu, 0, 532, 960, 8, 0xc98a2a);
  label(menu, 306, 30, 46, 440)('灯影 · 闹天宫');
  label(menu, 310, 103, 19, 420)('南天门　　蟠桃园　　兜率宫');
  const begin = button(menu, 390, 137, 180, 50, text('start'));
  const view = sprite(menu, book.x, book.y);
  view.clipRect = { x: 0, y: 0, width: book.w, height: book.h };
  const list = sprite(view);
  const rows = choices.map((id, i) => ({ id, ...button(list, 0, i * 54, book.w, 48, text(id)) }));
  const records = label(menu, 280, 432, 18, 490);
  const flagShape = createSharedGeometry2D({
    // Keep the original landscape CSS polygon, including the inward-facing tip.
    positions: new Float32Array([0, 0, 32, 0, 32, 116, 16, 104, 0, 116]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0.5, 0.9, 0, 1]),
    lightColors: new Float32Array(20).fill(1),
    darkColors: new Float32Array(15),
    indices: new Uint16Array([0, 1, 3, 1, 2, 3, 0, 3, 4])
  });
  const binding = scope.use(Mesh2D.createBinding(flag, flagShape));
  const banner = hud.addChild(binding.node);
  banner.x = 42;
  banner.y = 24;
  const marks = [0, 1, 2, 3].map((i) => label(hud, 47, 35 + 22 * i, 19, 26));
  const dark = sprite(hud, 93, 35);
  fill(dark, 0, 0, 154, 43, 0x29160f, 0.76);
  const peaches = Array.from({ length: 5 }, (_, i) => {
    const pip = sprite(dark, 7 + i * 19, 7);
    fill(pip, 0, 0, 12, 11, 0xf09373);
    return pip;
  });
  const hair = sprite(dark, 48, 28);
  label(dark, 5, 21, 12, 40)('毫毛');
  fill(hair, 0, 0, 93, 5, 0xd2aa4a);
  const countBox = sprite(hud, 365, 38);
  fill(countBox, 0, 0, 220, 29, 0x29160f, 0.65);
  const count = label(countBox, 6, 3, 16, 208);
  const bossBox = sprite(hud, 347, 80);
  fill(bossBox, 0, 0, 268, 32, 0x29160f, 0.82);
  const bossName = label(bossBox, 6, 2, 16, 254),
    bossBar = sprite(bossBox, 5, 24);
  fill(bossBar, 0, 0, 258, 4, 0xee8247);
  const noticeBox = sprite(hud, 242, 114);
  fill(noticeBox, 0, 0, 476, 32, 0x351b11, 0.78);
  const notice = label(noticeBox, 5, 2, 17, 466);
  const pauseButton = button(hud, 851, 18, 85, 46, text('pause-play'));
  for (const [id, x, y, w, h, title] of pads) controls.set(id, button(hud, x, y, w, h, title));
  fill(pause, 0, 0, 960, 540, 0x110908, 0.7);
  const resume = button(pause, 392, 242, 176, 56, text('paused'));
  fill(results, 0, 0, 960, 540, 0x62130d, 0.98);
  const heading = label(results, 284, 41, 28, 510);
  const grade = label(results, 430, 104, 52, 190);
  const tally = label(results, 160, 205, 20, 750);
  const replay = label(results, 175, 270, 18, 708);
  const again = button(results, 276, 363, 124, 54, text('again'));
  const next = button(results, 419, 363, 124, 54, text('next'));
  const back = button(results, 555, 363, 136, 54, text('playbill-back'));

  let mode,
    offset = 0,
    closed = false;
  const active = new Map();
  const setOffset = (n) => {
    offset = clamp(n, choices.length * 54 - 6 - book.h);
    list.y = -offset;
  };
  function cancel() {
    for (const [pointer, press] of active) if (press.pad) model.control(press.pad, 'cancel', pointer);
    active.clear();
  }
  function update() {
    if (closed) return;
    const current = visible('result')
      ? 'result'
      : !model.node('curtain').classList.contains('is-up')
        ? 'menu'
        : visible('paused')
          ? 'pause'
          : 'play';
    if (mode !== current) {
      cancel();
      mode = current;
      if (mode === 'menu') setOffset(0);
    }
    menu.visible = mode === 'menu';
    results.visible = mode === 'result';
    hud.visible = mode === 'play' || mode === 'pause';
    pause.visible = mode === 'pause';
    if (menu.visible) {
      records(visible('show-records') ? text('show-records') : '');
      return;
    }
    if (results.visible) {
      heading(text('result-title'));
      grade(text('rank'));
      tally(text('tally'));
      replay(visible('replay') ? model.node('replay').firstElementChild?.textContent : '');
      next.node.visible = visible('next');
      return;
    }
    const name = Array.from(text('act-banner'));
    marks.forEach((write, i) => write(name[i] ?? ''));
    model.node('peaches').children.forEach((item, i) => {
      if (peaches[i]) peaches[i].alpha = item.classList.contains('is-eaten') ? 0.22 : 1;
    });
    hair.scaleX = clamp(parseFloat(model.node('hairs-fill').style.width) || 0, 100) / 100;
    count(text('soldiers') + '   ' + text('clock'));
    bossBox.visible = visible('boss');
    if (bossBox.visible) {
      bossName(text('boss-name'));
      bossBar.scaleX = clamp(parseFloat(model.node('boss-health').style.width) || 0, 100) / 100;
    }
    noticeBox.visible = visible('notice');
    if (noticeBox.visible) notice(text('notice'));
    for (const [action, pad] of controls) {
      pad.node.alpha = [...active.values()].some((press) => press.pad === action)
        ? 1
        : action === 'special' && !model.node('hairs').classList.contains('is-ready')
          ? 0.43
          : 0.82;
    }
  }
  function hit(x, y) {
    if (mode === 'menu') {
      if (contains(begin, x, y)) return { id: 'start' };
      if (contains(book, x, y)) {
        const row = rows.find((row) => contains(row, x - book.x, y - book.y + offset));
        return { id: row?.id, scrolling: true };
      }
    } else if (mode === 'pause' && contains(resume, x, y)) return { id: 'paused' };
    else if (mode === 'result') {
      for (const [id, box] of [
        ['again', again],
        ['next', next],
        ['playbill-back', back]
      ]) {
        if (box.node.visible && contains(box, x, y)) return { id };
      }
    } else if (mode === 'play') {
      if (contains(pauseButton, x, y)) return { id: 'pause-play' };
      for (const [pad, box] of controls) if (contains(box, x, y)) return { pad };
    }
    return {};
  }
  function input(e) {
    if (closed) return;
    if (e.type === 'scroll' && mode === 'menu' && contains(book, e.x, e.y)) {
      setOffset(offset + e.dy);
      return;
    }
    if (e.type === 'down') {
      if (active.has(e.id)) return;
      const press = hit(e.x, e.y);
      if (!press.pad && !press.id && !press.scrolling) return;
      active.set(e.id, { ...press, y: e.y, offset });
      if (press.pad) model.control(press.pad, 'down', e.id);
      return;
    }
    const press = active.get(e.id);
    if (!press) return;
    if (press.scrolling && e.type !== 'cancel' && (press.drag || Math.abs(e.y - press.y) >= 5)) {
      press.drag = true;
      setOffset(press.offset + press.y - e.y);
    }
    if (e.type === 'up' || e.type === 'cancel') {
      active.delete(e.id);
      if (press.pad) model.control(press.pad, e.type, e.id);
      else if (e.type === 'up' && !press.drag && press.id && hit(e.x, e.y).id === press.id)
        model.onClick(press.id);
      update();
    }
  }
  update();
  return {
    input,
    update,
    cancel,
    close() {
      if (!closed) {
        cancel();
        root.visible = false;
        closed = true;
      }
    }
  };
}
