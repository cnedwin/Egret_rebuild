// SPDX-License-Identifier: Apache-2.0
// Three buttons that light up under a mouse or a pen, and a list the wheel scrolls. Hover and wheel
// come from `@egret/engine/web/hover`; presses come from `@egret/engine/web/pointer`. Both adapters
// listen on the same canvas.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 300, ROW = 28, ROWS = 12, VIEW = { x: 40, y: 120, width: 400, height: 140 };
const COLORS = { idle: 0x3d4a63, hover: 0x6f8fd6, pressed: 0x2a3550, rowA: 0x2b2f3a, rowB: 0x343a48, rowHover: 0x57658a };
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), state = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x161a22, clearAlpha: 1 });
let renders = 0, failure;
function render() { if (scope.state === 'open') { engine.renderSharedFrame(frame); renders++; } }
function fail(cause) { failure = String(cause?.code ?? cause); status.textContent = 'Failed / 失败：' + failure; }

/** A rectangle that can be pointed at. `paint` fills it again in another colour. */
function region(parent, name, x, y, width, height, color) {
  const sprite = parent.addChild(scope.use(new Sprite()));
  sprite.x = x; sprite.y = y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width, height };
  const paint = value => { sprite.graphics.clear(); sprite.graphics.beginFill(value).drawRect(0, 0, width, height).endFill(); };
  paint(color);
  return { name, sprite, paint };
}
const root = engine.stage.addChild(scope.use(new Sprite()));
const buttons = ['north', 'east', 'south'].map((name, index) => ({ ...region(root, name, 40 + index * 140, 40, 120, 48, COLORS.idle), hovered: false, pressed: false, presses: 0 }));
// The list: a clipped viewport whose content moves under it. The viewport is what the wheel is over when no row is.
const viewport = region(root, 'list', VIEW.x, VIEW.y, VIEW.width, VIEW.height, 0x20242e);
viewport.sprite.clipRect = { x: 0, y: 0, width: VIEW.width, height: VIEW.height };
const content = viewport.sprite.addChild(scope.use(new Sprite()));
const rows = Array.from({ length: ROWS }, (_, index) => {
  const row = region(content, 'row ' + (index + 1), 0, index * ROW, VIEW.width, ROW - 2, index % 2 ? COLORS.rowB : COLORS.rowA);
  // A mark that tells the rows apart without text: one more pip on each row.
  const pips = row.sprite.addChild(scope.use(new Sprite()));
  for (let pip = 0; pip <= index; pip++) pips.graphics.beginFill(0x9aa7c4).drawRect(8 + pip * 10, 10, 6, 6).endFill();
  return { ...row, index };
});
const limit = ROWS * ROW - VIEW.height;
let offset = 0, hovering = 'nothing', wheels = 0, consumed = 0, entered = 0, left = 0, lastLeave;
const named = new Map([...buttons, ...rows, viewport].map(item => [item.sprite, item]));

function paintButton(button) { button.paint(button.pressed ? COLORS.pressed : button.hovered ? COLORS.hover : COLORS.idle); }
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Over / 指向：' + hovering;
  state.textContent = JSON.stringify(readSnapshot(), null, 2);
  render();
}

const hover = createBrowserHoverInput({
  engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail,
  // Every enter and leave passes here, whatever it is over; the buttons listen for themselves below.
  onHover({ kind, target, reason }) {
    const item = named.get(target);
    if (kind === 'enter') { entered++; hovering = item?.name ?? 'something'; }
    if (kind === 'leave') { left++; lastLeave = reason; hovering = 'nothing'; }
    if (item?.index !== undefined && kind !== 'move') item.paint(kind === 'enter' ? COLORS.rowHover : item.index % 2 ? COLORS.rowB : COLORS.rowA);
  },
  // After the target path: count what the list took, and leave the rest to the page.
  onWheel(notification) { wheels++; if (notification.consumed) consumed++; },
});
for (const button of buttons) {
  button.sprite.on(hover.events.enter, () => { button.hovered = true; paintButton(button); });
  button.sprite.on(hover.events.leave, () => { button.hovered = false; paintButton(button); });
}
// The viewport hears the wheel of its rows as it bubbles. It takes the wheel only while the list can still move that way.
viewport.sprite.on(hover.events.wheel, event => {
  const { deltaY, unit } = event.payload, step = unit === 'pixel' ? deltaY : unit === 'line' ? deltaY * ROW : deltaY * VIEW.height;
  const next = Math.max(0, Math.min(limit, offset + step));
  if (next === offset) return;
  offset = next; content.y = -offset;
  event.preventDefault();
  // The rows moved under a pointer that did not: pick again where it rests.
  queueMicrotask(() => { hover.sync(); show(); });
});

const press = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
for (const button of buttons) {
  button.sprite.on(press.events.begin, () => { button.pressed = true; paintButton(button); show(); });
  button.sprite.on(press.events.end, () => { if (button.pressed) button.presses++; button.pressed = false; paintButton(button); show(); });
  button.sprite.on(press.events.cancel, () => { button.pressed = false; paintButton(button); show(); });
}
hover.onClose(() => { hovering = 'nothing'; });
canvas.addEventListener('pointermove', () => queueMicrotask(show));
canvas.addEventListener('pointerleave', () => queueMicrotask(show));
canvas.addEventListener('pointerup', () => queueMicrotask(show));
canvas.addEventListener('wheel', () => queueMicrotask(show), { passive: true });

/** What a check reads: plain values only. */
export function readSnapshot() {
  return {
    state: hover.state, hovering, entered, left, lastLeave, wheels, consumed, offset, limit, renders, failure,
    hovers: hover.hovers.map(({ point, target }) => ({ pointerType: point.pointerType, x: Math.round(point.globalX), y: Math.round(point.globalY), target: named.get(target)?.name })),
    buttons: Object.fromEntries(buttons.map(button => [button.name, { hovered: button.hovered, pressed: button.pressed, presses: button.presses }])),
    contacts: press.contacts.length, viewportRevision: hover.viewportRevision,
  };
}
globalThis.__egretPointerHoverExample = { readSnapshot, suspend: () => hover.setInteractive(false), resume: () => hover.setInteractive(true), dispose: () => scope.dispose() };
show();
