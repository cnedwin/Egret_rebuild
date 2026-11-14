// SPDX-License-Identifier: Apache-2.0
import {createMixedBackground} from './mixed-background.mjs';

const overlayLost = {webgpu:'WEBGPU_DEVICE_LOST',webgl2:'WEBGL2_CONTEXT_LOST'};

/** One Studio epoch coordinates independent renderer lifetimes and frame receipts. */
export function createMixedPreview({canvas,backend,signal,onLost}) {
  let background, epoch = 1, backgroundSubmitted = 0, overlayCompleted = 0, partialSubmissions = 0;
  let lastFrame, retiredBackground, frameEpoch = new AbortController();
  const losses = [];
  function lost(layer, reason) {
    if (signal.aborted) return;
    epoch++;
    const previous = frameEpoch;
    frameEpoch = new AbortController();
    previous.abort(Object.assign(new Error('Studio mixed frame expired'), {code:'STUDIO_MIXED_INTERRUPTED'}));
    losses.push({layer,epoch,code:reason?.code ?? reason?.name ?? 'GRAPHICS_LOST'});
    if (losses.length > 16) losses.shift();
    onLost();
  }

  return {
    get epoch() { return epoch; },
    async start() {
      background = await createMixedBackground({canvas,backend,signal,onLost:reason => lost('background',reason)});
      signal.throwIfAborted();
    },
    onOverlayDiagnostic(reason) {
      if (reason.code === overlayLost[backend]) lost('overlay',reason);
    },
    // A lost surface retires the caller's wait without taking ownership of the shared load.
    wait(pending) {
      const boundary = AbortSignal.any([signal,frameEpoch.signal]);
      return new Promise((resolve,reject) => {
        const stop = () => reject(boundary.reason);
        if (boundary.aborted) stop();
        else boundary.addEventListener('abort',stop,{once:true});
        Promise.resolve(pending).then(resolve,reject)
          .finally(() => boundary.removeEventListener('abort',stop));
      });
    },
    resize({width,height,ratio}) {
      background.resize(width,height,ratio);
    },
    begin(layoutRevision, overlayGeneration) {
      if (!background.submit()) throw Object.assign(new Error('World3D background did not submit'), {code:'STUDIO_MIXED_INTERRUPTED'});
      backgroundSubmitted++;
      return {epoch,layoutRevision,backgroundGeneration:background.inspect().generation,overlayGeneration};
    },
    complete(receipt) {
      overlayCompleted++;
      lastFrame = receipt;
    },
    partial() { partialSubmissions++; },
    async restore(host) {
      const overlay = backend === 'webgpu' && host.getSessionStatus().state === 'lost'
        ? host.recover() : host.whenReady();
      await Promise.all([background.restore(),overlay]);
    },
    close() {
      if (!background) return;
      try { background.close(); }
      finally { retiredBackground = background.inspect(); background = undefined; }
    },
    inspect(state, overlayGeneration) {
      const back = background?.inspect() ?? retiredBackground;
      return {state,epoch,backgroundGeneration:back?.generation,overlayGeneration,
        backgroundSubmitted,overlayCompleted,partialSubmissions,losses:[...losses],lastFrame,background:back};
    }
  };
}
