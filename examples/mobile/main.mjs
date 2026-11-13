// SPDX-License-Identifier: Apache-2.0
import {measureViewport, createMountQueue, describePreview} from './viewport.mjs';
const parameters = new URL(location.href).searchParams;
const kind = parameters.get('scene') ?? 'resources', backend = parameters.get('backend') ?? 'webgl2';
if (!['resources','pointers','ui','paragraph'].includes(kind) || !['webgl2','webgpu'].includes(backend)) throw Error('EXAMPLE_PROFILE');
const canvas = document.querySelector('#scene'), surface = document.querySelector('#surface'), controls = document.querySelector('#controls');
const status = document.querySelector('#status'), phase = document.querySelector('#phase'), closeButton = document.querySelector('#close');
const fixed = {resources:'resource-scene',pointers:'multi-pointer',ui:'ui-data-panel',paragraph:'paragraph-panel'}[kind];
document.querySelector('#fixed').href = '../'+fixed+'/index.html'+(['ui','paragraph','pointers','resources'].includes(kind)?'?backend='+backend:'');
for (const link of document.querySelectorAll('#backend a')) link.href = '?scene='+kind+'&backend='+link.textContent.toLowerCase();
document.querySelector('#backend').hidden = !['ui','paragraph','pointers','resources'].includes(kind);
let lastViewport, latest, stopped = false, media, mediaListener, cancelled = false;
function describe() {
  const snapshot = queue.inspect(), view = describePreview(snapshot, cancelled);
  status.textContent = JSON.stringify({...snapshot, errors:view.diagnostics, viewport:lastViewport, observations:latest},null,2);
  phase.textContent = view.text; phase.dataset.state = view.state;
  document.querySelector('#failure-details').textContent = view.diagnostics.join('\n');
  closeButton.disabled = stopped;
  closeButton.textContent = ['starting','resizing'].includes(snapshot.state) ? 'Cancel loading / 取消加载' : 'Close example / 关闭示例';
}
const queue = createMountQueue(async (viewport,signal,model) => {
  controls.replaceChildren(); latest = undefined;
  canvas.style.width = viewport.width+'px'; canvas.style.height = viewport.height+'px';
  const module = kind === 'resources' ? await import('./resources.mjs') : kind === 'pointers' ? await import('./pointers.mjs') : await import('./panels.mjs');
  return module.mount({canvas,controls,viewport,signal,model,kind,backend,report(value){ if (!signal.aborted) { latest=value; describe(); } }});
}, describe);
function measure() {
  if (stopped) return;
  const next = measureViewport(surface.getBoundingClientRect().width,window.devicePixelRatio,kind);
  if (JSON.stringify(next) === JSON.stringify(lastViewport)) return;
  lastViewport = next;
  void queue.request(next).catch(() => { describe(); });
}
function watchDensity() {
  media?.removeEventListener('change',mediaListener);
  media = matchMedia('(resolution: '+window.devicePixelRatio+'dppx)');
  mediaListener = () => { measure(); watchDensity(); };
  media.addEventListener('change',mediaListener);
}
const observer = new ResizeObserver(measure); observer.observe(surface);
function visibility(){if(!document.hidden){measure();watchDensity();}}
document.addEventListener('visibilitychange',visibility);
window.addEventListener('resize',measure); window.addEventListener('pagehide',requestClose);
watchDensity(); measure();
export async function whenIdle() { await queue.whenIdle(); }
export function readSnapshot() { return {...queue.inspect(),viewport:lastViewport,observations:latest}; }
export async function readback() { return queue.readback(); }
export async function close() {
  if (!stopped) {
    stopped=true; observer.disconnect(); media?.removeEventListener('change',mediaListener);
    document.removeEventListener('visibilitychange',visibility);
    window.removeEventListener('resize',measure); window.removeEventListener('pagehide',requestClose);
    closeButton.removeEventListener('click',requestClose); closeButton.disabled=true;
  }
  await queue.close(); describe();
}
function requestClose(event) {
  if (event?.type === 'click') cancelled = ['starting','resizing'].includes(queue.inspect().state);
  void close().catch(() => { describe(); });
}
closeButton.addEventListener('click',requestClose);
