import { createEngine, Sprite } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const contactList = document.querySelector('#contacts');
const leftState = document.querySelector('#left-state');
const rightState = document.querySelector('#right-state');
const interactiveButton = document.querySelector('#interactive');
const closeButton = document.querySelector('#close');
const frame = Object.freeze({ width: 320, height: 160, clearColor: 0x172033, clearAlpha: 1 });
const active = new Map(), markers = new Map(), notifications = [], diagnostics = [];
let engine, scope, input, root, left, right;
let closing = false, closePromise, renders = 0, maximumContacts = 0;

function render() {
  if (!engine || closing || scope?.state !== 'open') return;
  engine.renderFrame(frame); renders++;
}
function describe() {
  const contacts = [...active.values()];
  leftState.textContent = 'Left / 左：' + contacts.filter(value => value.region === 'left').length;
  rightState.textContent = 'Right / 右：' + contacts.filter(value => value.region === 'right').length;
  contactList.replaceChildren(...contacts.map(value => {
    const item = document.createElement('li');
    item.textContent = value.pointerType + ' #' + value.pointerId + ' · ' + value.region + ' · (' + value.globalX.toFixed(1) + ', ' + value.globalY.toFixed(1) + ')';
    return item;
  }));
  if (closing) status.textContent = 'Closed / 已关闭';
  else if (input?.state === 'suspended') status.textContent = 'Suspended; resume only when ready / 已暂停；准备就绪后恢复';
  else status.textContent = 'Active contacts / 活跃触点：' + contacts.length;
}
function contact(notification) {
  const { kind, contact: value, target, reason } = notification;
  const { session } = value;
  const key = session.generation + ':' + session.id;
  const region = target === left ? 'left' : target === right ? 'right' : 'outside';
  const sample = Object.freeze({ kind, ...(reason === undefined ? {} : { reason }), region, id: session.id, generation: session.generation, pointerId: session.pointerId, pointerType: session.pointerType, globalX: value.globalX, globalY: value.globalY, sequence: value.sequence, viewportRevision: value.viewportRevision });
  notifications.push(sample); if (notifications.length > 64) notifications.shift();
  if (kind === 'begin' || kind === 'move') {
    active.set(key, sample);
    if (!markers.has(key)) {
      const marker = root.addChild(new Sprite());
      marker.graphics.beginFill(0xffffff).drawRect(-4, -4, 8, 8).endFill(); markers.set(key, marker);
    }
    const marker = markers.get(key); marker.x = value.globalX; marker.y = value.globalY;
    maximumContacts = Math.max(maximumContacts, active.size);
  } else {
    active.delete(key); markers.get(key)?.dispose(); markers.delete(key);
  }
  describe(); render();
}
export const ready = (async () => {
  try {
    engine = await createEngine({ host: createCanvasHost({ canvas, pixelRatio: window.devicePixelRatio || 1 }), onDiagnostic: value => { diagnostics.push(String(value.code ?? value)); status.textContent = 'Input diagnostic / 输入诊断：' + diagnostics.at(-1); } });
    if (closing) { await engine.dispose(); return; }
    scope = engine.createScope(); root = scope.use(new Sprite()); engine.stage.addChild(root);
    function region(x, color) {
      const node = root.addChild(new Sprite()); node.x = x; node.y = 20;
      node.touchEnabled = true; node.hitArea = { x: 0, y: 0, width: 130, height: 120 };
      node.graphics.beginFill(color).drawRect(0, 0, 130, 120).endFill(); return node;
    }
    left = region(20, 0x087e8b); right = region(170, 0xc45233);
    input = createBrowserPointerInput({ engine, scope, width: 320, height: 160, capacity: 10, onContact: contact });
    interactiveButton.disabled = false; describe(); render();
  } catch (cause) {
    status.textContent = 'Failed / 启动失败：' + String(cause?.code ?? cause);
    await engine?.dispose(); throw cause;
  }
})();

function toggleInteractive() {
  if (!input || closing) return;
  input.setInteractive(input.state === 'suspended');
  interactiveButton.textContent = input.state === 'suspended' ? 'Resume when ready / 就绪后恢复' : 'Suspend / 暂停';
  describe();
}
/** Scalar observations only; display targets and input authority stay local. */
export function readSnapshot() {
  return Object.freeze({ state: input?.state ?? (closing ? 'closed' : 'starting'), active: Object.freeze([...active.values()]), notifications: Object.freeze(notifications.slice()), diagnostics: Object.freeze(diagnostics.slice()), maximumContacts, renders, viewportRevision: input?.viewportRevision ?? 0 });
}
export function close() {
  if (closePromise) return closePromise;
  closing = true; interactiveButton.disabled = true; closeButton.disabled = true;
  interactiveButton.removeEventListener('click', toggleInteractive); closeButton.removeEventListener('click', requestClose); window.removeEventListener('pagehide', requestClose);
  closePromise = (async () => { await ready.catch(() => {}); await engine?.dispose(); active.clear(); markers.clear(); describe(); })();
  return closePromise;
}
function requestClose() { void close(); }
interactiveButton.addEventListener('click', toggleInteractive); closeButton.addEventListener('click', requestClose); window.addEventListener('pagehide', requestClose);
