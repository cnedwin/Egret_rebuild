// SPDX-License-Identifier: Apache-2.0
import {createLinearLayoutSession} from './session.mjs';

const query = new URL(location.href).searchParams;
const backend = query.get('backend') === 'webgpu' ? 'webgpu' : 'canvas';
const preset = query.get('preset') === 'verification' ? 'verification' : 'preview';
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const selector = document.querySelector('#backend');
const actions = ['horizontal', 'vertical', 'filter', 'reinsert', 'disabled', 'enabled', 'invalid', 'replay', 'live'];
export let session;
export let renderHost;
const readbacks = [];
/** Every original WebGPU ticket, including the helper's ancillary first frame. */
export function getReadbacks() { return Object.freeze([...readbacks]); }
function verificationHost(original) {
  return Object.freeze({
    surface: original.surface,
    start: () => original.start(), stop: () => original.stop(), close: () => original.close(),
    setTimeout: (callback, delay) => original.setTimeout(callback, delay),
    renderFrame(frame) {
      // requestReadback applies to the NEXT frame; arm before every submission.
      // Retain all real promises rather than selecting only desired checkpoints.
      const ticket = original.requestReadback();
      readbacks.push(ticket);
      void ticket.catch(() => {});
      return original.renderFrame(frame);
    },
  });
}
function waitForStartupReadback() {
  // Keep the original promise identity. Awaiting it propagates any real failure;
  // its earlier observer prevents unhandled rejection without replacing it.
  if (readbacks.length !== 1 || !readbacks[0]) {
    const error = new Error('EXAMPLE_STARTUP_READBACK_REQUIRED');
    error.code = 'EXAMPLE_STARTUP_READBACK_REQUIRED';
    throw error;
  }
  return readbacks[0];
}
let closeRequested = false, closePromise;
function refresh() {
  if (!session) return;
  const view = session.inspect(), active = view.state === 'ready';
  for (const id of actions) document.querySelector('#' + id).disabled = !active;
  document.querySelector('#close').disabled = view.state === 'closing' || view.state === 'closed';
  status.dataset.state = view.state;
  status.dataset.mode = view.mode;
  status.dataset.axis = view.axis;
  status.dataset.presentation = view.presentation;
  status.dataset.firstState = view.buttons.buttonStates[0];
  status.dataset.secondState = view.buttons.buttonStates[1];
  status.dataset.firstActivations = String(view.buttons.activations[0]);
  status.dataset.secondActivations = String(view.buttons.activations[1]);
  status.dataset.lastRejectedCode = view.lastRejectedCode ?? '';
  const size = view.currentPlan ? view.currentPlan.width + ' × ' + view.currentPlan.height : '—';
  const labels = {starting: '启动中', ready: '就绪', closing: '关闭中', closed: '已关闭'};
  status.textContent = [
    view.state + ' / ' + labels[view.state],
    'Mode / 模式: ' + view.mode + '; axis / 方向: ' + view.axis,
    'Plan extent / 计划范围: ' + size + '; order / 顺序: ' + view.order.join(', '),
    'First / 第一个: ' + view.buttons.buttonStates[0] + '; activations / 激活: ' + view.buttons.activations[0],
    'Second / 第二个: ' + view.buttons.buttonStates[1] + '; activations / 激活: ' + view.buttons.activations[1],
    'Presented / 显示: ' + view.presentation,
    'Atlas loads / 图集加载: ' + view.buttons.loads + '; disposals / 释放: ' + view.buttons.disposals,
    view.lastRejectedCode ? 'Expected refusal; scene retained / 预期拒绝，场景保持: ' + view.lastRejectedCode : '',
  ].filter(Boolean).join('\n');
}
function close() {
  closeRequested = true;
  if (closePromise) return closePromise;
  let resolve, reject;
  closePromise = new Promise((yes, no) => { resolve = yes; reject = no; });
  void closePromise.catch(() => {});
  if (!session) {
    status.dataset.state = 'closed';
    status.textContent = 'Closed / 已关闭';
    document.querySelector('#close').disabled = true;
    resolve();
  } else {
    try {
      const retirement = session.close();
      refresh();
      void retirement.then(() => { refresh(); resolve(); }, cause => { refresh(); reject(cause); });
    } catch (cause) { reject(cause); }
  }
  return closePromise;
}
function failed(error) {
  refresh();
  status.textContent += '\nUnavailable or failed / 不可用或失败: ' + (error?.code ?? 'EXAMPLE_FAILURE');
}
function operationFailed(error) {
  void close().then(() => failed(error), cleanup => {
    failed(error);
    status.textContent += '\nCleanup failed / 清理失败: ' + (cleanup?.code ?? 'EXAMPLE_CLEANUP_FAILURE');
  });
}
selector.value = backend;
selector.addEventListener('change', () => {
  const next = new URL(location.href);
  next.searchParams.set('backend', selector.value);
  selector.disabled = true;
  // A fresh page starts only after the original Engine/Host has settled.
  void close().then(() => { location.href = next.href; }, cause => {
    selector.disabled = false; selector.value = backend; failed(cause);
  });
});
document.querySelector('#close').addEventListener('click', () => { void close().catch(failed); });
window.addEventListener('pagehide', () => { void close().catch(() => {}); }, {once: true});
try {
  const entry = backend === 'webgpu'
    ? await import('@egret/engine/webgpu') : await import('@egret/engine/web');
  if (!closeRequested) {
    canvas.width = canvas.height = 24;
    canvas.style.width = canvas.style.height = '192px';
    const host = backend === 'webgpu'
      ? entry.createWebGPUHost({canvas, pixelRatio: 1, enableReadback: preset === 'verification'})
      : entry.createCanvasHost({canvas, pixelRatio: 1});
    renderHost = host;
    const admittedHost = preset === 'verification' && backend === 'webgpu' ? verificationHost(host) : host;
    session = createLinearLayoutSession({
      host: admittedHost, preset, onUpdate: refresh,
      waitForStartupIdle: preset === 'verification' && backend === 'webgpu'
        ? waitForStartupReadback : undefined,
    });
    const operations = {
      horizontal: () => session.horizontal(), vertical: () => session.vertical(),
      filter: () => session.filterFirst(), reinsert: () => session.reinsertFirst(),
      disabled: () => session.disableFirst(), enabled: () => session.enableFirst(), invalid: () => session.rejectInvalidPlan(),
      replay: () => session.replaySavedHorizontal(), live: () => session.showLive(),
    };
    for (const [id, operation] of Object.entries(operations)) {
      document.querySelector('#' + id).addEventListener('click', () => {
        try { operation(); refresh(); } catch (cause) { operationFailed(cause); }
      });
    }
    refresh();
    await session.ready;
    refresh();
  }
} catch (cause) {
  try { await close(); } catch { /* Keep the original startup cause visible. */ }
  failed(cause);
}
