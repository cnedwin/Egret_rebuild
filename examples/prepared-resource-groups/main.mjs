// SPDX-License-Identifier: Apache-2.0
import { createPreparedResourceApplication } from './application.mjs';

const element = id => document.getElementById(id);
const profile = new URL(location.href).searchParams.get('profile') ?? 'canvas-2d';
const application = createPreparedResourceApplication({ canvas: element('scene'), profile });
let seconds = 0;
const target = () => application.session.inspect().selectedId;
function refresh() {
  const view = application.inspect(), open = view.state === 'ready';
  const selected = view.session?.selectedId;
  for (const button of document.querySelectorAll('[data-scene-action]')) button.disabled = !open;
  element('close').disabled = view.state === 'closing' || view.state === 'closed';
  element('selected').textContent = selected === 'pilot-right' ? 'Right pilot / 右侧角色' : 'Left pilot / 左侧角色';
}
async function action(work, message) {
  try { await application.ready; await work(); await application.present(); element('status').textContent = message; }
  catch { element('status').textContent = 'Action unavailable. Select a live pilot and try again. / 操作未完成，请选择场景中的角色后重试。'; }
  finally { refresh(); }
}
for (const [button, id] of [['select-left', 'pilot-left'], ['select-right', 'pilot-right']]) {
  element(button).addEventListener('click', () => void action(() => {
    const actor = application.session.scene.actors[id];
    if (!actor || !application.session.selectTarget(actor.root)) throw new Error('Pilot is absent / 角色已移除');
  }, 'Pilot selected / 已选择角色'));
}
element('replace').addEventListener('click', () => void action(() =>
  application.session.replaceOutfit(target(), element('outfit').value), 'Outfit updated / 换装完成'));
element('step').addEventListener('click', () => void action(() => {
  seconds += 0.125; application.session.advanceTo(seconds);
}, 'Animation advanced / 动画已步进'));
element('cancel').addEventListener('click', () => void action(() =>
  application.session.cancelOutfit(target()), 'Pending outfit cancelled / 已取消待定换装'));
element('remove').addEventListener('click', () => void action(() =>
  application.session.remove(target()), 'Pilot removed / 角色已移除'));
element('scene').addEventListener('pointerup', () => {
  void application.whenIdle().then(refresh, () => refresh());
});
element('close').addEventListener('click', () => {
  const original = application.close(); refresh();
  void original.then(() => { element('status').textContent = 'Scene closed / 场景已关闭'; }, () => {
    element('status').textContent = 'Scene cleanup incomplete. Close this page to leave. / 场景清理未完成，请关闭本页面。';
  }).finally(refresh);
});
window.addEventListener('pagehide', () => { void application.close().catch(() => undefined); }, { once: true });
refresh();
void application.ready.then(() => { element('status').textContent = 'Ready / 已就绪'; refresh(); }, () => {
  element('status').textContent = 'Scene unavailable. Try another rendering profile. / 场景不可用，请尝试其他渲染模式。'; refresh();
});
