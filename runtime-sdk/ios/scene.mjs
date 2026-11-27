// SPDX-License-Identifier: Apache-2.0
import {PROJECT_FRAME_MAGIC, createCapturedProjectEncoder} from '../scene/project-frame.mjs';

const dimension = value => Number.isInteger(value) && value > 0 && value <= 16384;

function bindGame(game) {
  if (!game || !dimension(game.width) || !dimension(game.height) || !Array.isArray(game.pages)
      || typeof game.capture !== 'function' || typeof game.close !== 'function') throw Error('Invalid iOS game contract');
  const bindings = new Map();
  const slots = new Set();
  const pages = [];
  let total = 0;
  for (const page of game.pages) {
    if (!page || !Number.isInteger(page.slot) || page.slot < 1 || page.slot > 255 || slots.has(page.slot)
        || !page.source || bindings.has(page.source) || !dimension(page.width) || !dimension(page.height)
        || page.width * page.height * 4 > 16*1024*1024 || typeof page.pixels !== 'function') throw Error('Invalid iOS atlas page');
    total += page.width * page.height * 4;
    if (total > 64*1024*1024) throw Error('iOS atlas set exceeds 64 MiB');
    pages.push({slot:page.slot,width:page.width,height:page.height,pixels:() => page.pixels()});
    slots.add(page.slot);
    bindings.set(page.source,page.slot);
  }
  return {bindings,pages,width:game.width,height:game.height};
}

// The game owns the immutable atlas set for this open. Recoveries fetch its bytes again after GPU loss.
export function createIosScene(bridge, openGame) {
  const host = Object.freeze({
    surface: {}, close: async () => {},
    setTimeout(callback, delay) {
      const id = globalThis.setTimeout(callback,delay);
      return () => globalThis.clearTimeout(id);
    }
  });
  const encoder = createCapturedProjectEncoder();
  let opening, game, closing, layout;

  async function start() {
    if (closing) throw new Error('iOS scene closed');
    opening ??= Promise.resolve().then(() => openGame(host)).then(async created => {
      try { layout = bindGame(created); }
      catch (error) { await created?.close?.(); throw error; }
      game = created;
      return {width:layout.width,height:layout.height};
    });
    return opening;
  }
  function publish() {
    if (!game || closing) throw new Error('iOS scene unavailable');
    for (const page of layout.pages) {
      const data = page.pixels();
      if (!(data instanceof Uint8Array) || data.byteLength !== page.width*page.height*4) throw Error('Invalid iOS atlas pixels');
      const owned = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength ? data.buffer : data.slice().buffer;
      if (!bridge.upload(page.slot,page.width,page.height,owned)) return false;
    }
    return true;
  }
  return Object.freeze({
    start, publish,
    frame(index) {
      if (!game || closing) throw new Error('iOS scene unavailable');
      const captured = game.capture(index);
      if (captured.width !== layout.width || captured.height !== layout.height) throw Error('iOS frame and stage dimensions differ');
      const bytes = encoder.encode(captured,index,layout.bindings);
      if (new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true) !== PROJECT_FRAME_MAGIC || bytes[16] !== 255) throw Error('iOS requires opaque normal EGR2 quads');
      return bytes.buffer;
    },
    close() {
      closing ??= (async () => {
        try {
          if (opening) await opening;
          return game ? await game.close() : {releases:0};
        } finally { encoder.clear(); layout = undefined; game = undefined; }
      })();
      return closing;
    }
  });
}
