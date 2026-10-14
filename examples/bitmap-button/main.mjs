// SPDX-License-Identifier: Apache-2.0
import {createBitmapButtonSession} from './session.mjs';

const query = new URL(location.href).searchParams;
const backend = query.get('backend') === 'webgpu' ? 'webgpu' : 'canvas';
const preset = query.get('preset') === 'verification' ? 'verification' : 'preview';
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const selector = document.querySelector('#backend');
const actions = ['enabled', 'recreate', 'layout', 'replay', 'live'];
selector.value = backend;
selector.addEventListener('change', () => {
  const next = new URL(location.href);
  next.searchParams.set('backend', selector.value);
  selector.disabled = true;
  // Retire the current Engine/Host before starting the other backend.
  void close().then(() => { location.href = next.href; }, error => {
    selector.disabled = false;
    selector.value = backend;
    failed(error);
  });
});
export let session;
export let renderHost;
const readbacks = [];
/** Example-local verification view of original public WebGPU readback promises. */
export function getReadbacks() { return Object.freeze([...readbacks]); }
function verificationHost(original) {
  return Object.freeze({
    surface: original.surface,
    start: () => original.start(),
    stop: () => original.stop(),
    close: () => original.close(),
    setTimeout: (callback, delay) => original.setTimeout(callback, delay),
    renderFrame(frame) {
      // Arm before submission, including the first saved-up presentation.
      const ticket = original.requestReadback();
      readbacks.push(ticket);
      void ticket.catch(() => {});
      return original.renderFrame(frame);
    },
  });
}
let closeRequested = false;
function refresh() {
  if (!session) return;
  const view = session.inspect(), active = view.state === 'ready';
  for (const id of actions) document.querySelector('#' + id).disabled = !active;
  document.querySelector('#enabled').disabled = !active || view.buttonStates[0] === 'disposed';
  document.querySelector('#enabled').textContent = view.buttonEnabled[0]
    ? 'Disable first / 禁用第一个' : 'Enable first / 启用第一个';
  document.querySelector('#recreate').textContent = view.buttonStates[0] === 'disposed'
    ? 'Recreate first / 重建第一个' : 'Dispose first / 释放第一个';
  document.querySelector('#layout').textContent = view.layout === 'isolated'
    ? 'Show two buttons / 显示两个按钮' : 'Isolate first / 单独显示第一个';
  document.querySelector('#close').disabled = view.state === 'closing' || view.state === 'closed';
  status.dataset.state = view.state;
  status.dataset.firstState = view.buttonStates[0];
  status.dataset.secondState = view.buttonStates[1];
  status.dataset.firstActivations = String(view.activations[0]);
  status.dataset.secondActivations = String(view.activations[1]);
  status.dataset.presentation = view.presentation;
  status.dataset.layout = view.layout;
  const translations = {starting: '启动中', ready: '就绪', closing: '关闭中', closed: '已关闭'};
  status.textContent = [
    view.state + ' / ' + translations[view.state],
    'First / 第一个: ' + view.buttonStates[0] + '; activations / 激活: ' + view.activations[0],
    'Second / 第二个: ' + view.buttonStates[1] + '; activations / 激活: ' + view.activations[1],
    'Input / 输入: ' + view.inputState + '; presented / 显示: ' + view.presentation,
    'Atlas loads / 图集加载: ' + view.loads + '; disposals / 释放: ' + view.disposals,
  ].join('\n');
}
async function close() {
  closeRequested = true;
  if (!session) {
    status.dataset.state = 'closed';
    status.textContent = 'Closed / 已关闭';
    document.querySelector('#close').disabled = true;
    return;
  }
  const retirement = session.close();
  refresh();
  try { await retirement; }
  finally { refresh(); }
}
function failed(error) {
  refresh();
  status.textContent += '\nUnavailable or failed / 不可用或失败: ' + (error?.code ?? error?.message ?? String(error));
}
function operationFailed(error) {
  void close().then(() => failed(error), cleanup => {
    failed(error);
    status.textContent += '\nCleanup failed / 清理失败: ' + (cleanup?.code ?? cleanup?.message ?? String(cleanup));
  });
}
document.querySelector('#close').addEventListener('click', () => { void close().catch(failed); });
window.addEventListener('pagehide', () => { void close().catch(() => {}); }, {once: true});
try {
  const entry = backend === 'webgpu'
    ? await import('@egret/engine/webgpu') : await import('@egret/engine/web');
  if (!closeRequested) {
    const width = preset === 'verification' ? 24 : 192;
    const height = preset === 'verification' ? 24 : 128;
    canvas.width = width;
    canvas.height = height;
    // Border/padding stay zero; CSS and input use these same logical dimensions.
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const host = backend === 'webgpu'
      ? entry.createWebGPUHost({canvas, pixelRatio: 1, enableReadback: preset === 'verification'})
      : entry.createCanvasHost({canvas, pixelRatio: 1});
    renderHost = host;
    const sessionHost = preset === 'verification' && backend === 'webgpu' ? verificationHost(host) : host;
    session = createBitmapButtonSession({host: sessionHost, preset, onUpdate: refresh});
    const operations = {
      enabled: () => session.toggleEnabled(),
      recreate: () => session.disposeOrRecreateFirst(),
      layout: () => session.toggleLayout(),
      replay: () => session.replaySavedUp(),
      live: () => session.showLive(),
    };
    for (const [id, operation] of Object.entries(operations)) {
      document.querySelector('#' + id).addEventListener('click', () => {
        try { operation(); refresh(); } catch (error) { operationFailed(error); }
      });
    }
    refresh();
    await session.ready;
    refresh();
  }
} catch (error) {
  try { await close(); } catch { /* Keep the original startup cause visible. */ }
  failed(error);
}
