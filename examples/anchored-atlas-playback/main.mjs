// SPDX-License-Identifier: Apache-2.0
import {createAnchoredAtlasSession} from './session.mjs';

const query = new URL(location.href).searchParams;
const backend = query.get('backend') === 'webgpu' ? 'webgpu' : 'canvas';
const preset = query.get('preset') === 'verification' ? 'verification' : 'preview';
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const selector = document.querySelector('#backend');
selector.value = backend;
selector.addEventListener('change', () => {
  const next = new URL(location.href);
  next.searchParams.set('backend', selector.value);
  location.href = next.href;
});
const actions = ['step', 'pause', 'resume', 'replay', 'live'];
export let session;
export let renderHost;
const readbacks = [];
/** Verification retains the original host ticket without an additional render. */
export function getReadbacks() { return Object.freeze([...readbacks]); }
function verificationHost(original) {
  return Object.freeze({
    surface: original.surface,
    start: () => original.start(),
    stop: () => original.stop(),
    close: () => original.close(),
    setTimeout: (callback, delay) => original.setTimeout(callback, delay),
    renderFrame(frame) {
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
  document.querySelector('#pause').disabled = !active || view.playbackState !== 'running';
  document.querySelector('#resume').disabled = !active || view.playbackState !== 'paused';
  document.querySelector('#close').disabled = view.state === 'closing' || view.state === 'closed';
  status.dataset.state = view.state;
  status.dataset.liveColor = view.liveColor ?? '';
  status.dataset.presentedColor = view.presentedColor ?? '';
  status.textContent = [
    view.state + ' / ' + ({starting: '启动中', ready: '就绪', closing: '关闭中', closed: '已关闭'}[view.state]),
    'Game time / 游戏时间: ' + view.sourceSeconds.toFixed(3) + ' s',
    'Animation / 动画: ' + view.playbackState,
    'Presented / 显示: ' + (view.presentedColor ?? '—') + '; live / 当前: ' + (view.liveColor ?? '—'),
    'Atlas loads / 图集加载: ' + view.loads + '; disposals / 释放: ' + view.disposals,
  ].join('\n');
}
async function close() {
  closeRequested = true;
  if (!session) {
    status.dataset.state = "closed";
    status.textContent = "Closed / 已关闭";
    document.querySelector("#close").disabled = true;
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
document.querySelector("#close").addEventListener("click", () => { void close().catch(failed); });
window.addEventListener("pagehide", () => { void close().catch(() => {}); }, {once: true});
try {
  const entry = backend === 'webgpu'
    ? await import('@egret/engine/webgpu') : await import('@egret/engine/web');
  if (!closeRequested) {
  const host = backend === 'webgpu' ? entry.createWebGPUHost({canvas, enableReadback: preset === 'verification'}) : entry.createCanvasHost({canvas});
  const edge = preset === 'verification' ? 24 : 192;
  canvas.style.width = edge + 'px';
  canvas.style.height = edge + 'px';
  renderHost = host;
  const sessionHost = preset === 'verification' && backend === 'webgpu' ? verificationHost(host) : host;
  session = createAnchoredAtlasSession({host: sessionHost, preset});
  const operations = {
    step: () => session.step(), pause: () => session.pause(), resume: () => session.resume(),
    replay: () => session.replayBaseline(), live: () => session.showLive(),
  };
  for (const [id, operation] of Object.entries(operations)) {
    document.querySelector('#' + id).addEventListener('click', () => {
      try { operation(); refresh(); }
      catch (error) {
        void close().then(() => failed(error), cleanup => {
          failed(error);
          status.textContent += "\nCleanup failed / 清理失败: " + (cleanup?.code ?? cleanup?.message ?? String(cleanup));
        });
      }
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
