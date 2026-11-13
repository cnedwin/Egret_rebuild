// SPDX-License-Identifier: Apache-2.0
// The Host an example page draws with: WebGPU where the browser offers it, WebGL2 otherwise.
// `?backend=webgpu` or `?backend=webgl2` in the page address chooses one.

/** The backend a page asked for, or the one this browser suggests. */
export function chooseBackend(search = globalThis.location?.search ?? '', gpu = globalThis.navigator?.gpu) {
  const asked = new URLSearchParams(search).get('backend');
  if (asked === 'webgpu' || asked === 'webgl2') return asked;
  if (asked !== null) throw new Error('Choose ?backend=webgpu or ?backend=webgl2');
  return gpu ? 'webgpu' : 'webgl2';
}

/**
 * A shared Host takes two frames at a time and refuses a third with a BACKPRESSURE error. A game that
 * draws once per display frame never meets that. An example draws when something happens, which can be
 * several times before the Host has presented anything. This keeps the latest frame the Host refused and
 * submits it once the Host is free; a refused frame that a later one replaces is never drawn.
 */
export function paceExampleHost(host) {
  let waiting, scheduled = false, closed = false;
  const submit = frame => {
    try { return host.renderSharedFrame(frame); }
    catch (error) {
      if (closed || !/_BACKPRESSURE$/.test(String(error?.code))) throw error;
      waiting = frame;
      if (!scheduled) { scheduled = true; host.whenIdle().then(flush, flush); }
      return undefined;
    }
  };
  const flush = () => {
    scheduled = false;
    const frame = waiting; waiting = undefined;
    if (frame === undefined || closed) return;
    try { submit(frame); } catch { /* The Host states its own failure; the page reads it from the Host. */ }
  };
  const own = {
    renderSharedFrame: submit,
    async whenIdle() { do { await host.whenIdle(); } while (waiting !== undefined || scheduled); },
    close() { closed = true; waiting = undefined; return host.close(); },
  };
  // Every other member is the Host's own, called on the Host.
  const paced = {}, names = new Set(Object.keys(own));
  for (let owner = host; owner !== null && owner !== Object.prototype; owner = Object.getPrototypeOf(owner))
    for (const name of Object.getOwnPropertyNames(owner)) if (name !== 'constructor') names.add(name);
  for (const name of names) Object.defineProperty(paced, name, Object.hasOwn(own, name)
    ? { enumerable: true, value: own[name] }
    : { enumerable: true, get() { const value = host[name]; return typeof value === 'function' ? value.bind(host) : value; } });
  return Object.freeze(paced);
}

/** The Host factory of the chosen backend, paced for an example. Only the chosen backend's module is loaded. */
export async function loadExampleHostFactory(backend = chooseBackend()) {
  const factory = backend === 'webgpu'
    ? (await import('@egret/engine/webgpu')).createSharedWebGPUHost
    : (await import('@egret/engine/webgl2')).createSharedWebGL2Host;
  return options => paceExampleHost(factory(options));
}

/** A shared Host of the chosen backend. */
export async function createExampleHost(options, backend = chooseBackend()) {
  return (await loadExampleHostFactory(backend))(options);
}
