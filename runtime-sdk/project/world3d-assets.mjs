// SPDX-License-Identifier: Apache-2.0
import { loadGltf3D } from '@egret/engine/world3d';

const MAX_GLB_BYTES = 8 * 1024 * 1024;

// Accumulate directly into the size declared by the GLB header. Android backs
// this iterator with one bounded read at a time, and return() releases it early.
async function readContainer(assets, path, signal) {
  const header = new Uint8Array(12);
  let total = 0,
    bytes;
  for await (const chunk of assets.readChunks(path, signal)) {
    if (!bytes) {
      const take = Math.min(chunk.length, header.length - total);
      header.set(chunk.subarray(0, take), total);
      if (total + take < header.length) {
        total += take;
        continue;
      }
      const view = new DataView(header.buffer);
      const size = view.getUint32(8, true);
      if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || size < 20 || size > MAX_GLB_BYTES)
        throw new RangeError('Invalid packaged GLB header or size');
      bytes = new Uint8Array(size);
      bytes.set(header);
    }
    if (chunk.length > bytes.length - total) throw new RangeError('GLB exceeds its declared size');
    bytes.set(chunk, total);
    total += chunk.length;
  }
  if (!bytes || total !== bytes.length) throw new RangeError('Incomplete packaged GLB');
  return bytes;
}

// Run every owner's cleanup even if another resource's listener throws.
function retireAll(resources) {
  const failures = [];
  for (const resource of resources) {
    try {
      if (resource.dispose) resource.dispose();
      else resource.release();
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length) throw new AggregateError(failures, 'GLB cleanup failed');
}

export function createProjectGlbLoader(services, pageInUse) {
  // One scope registration owns only the assets which are still live. Games may
  // retire a model early or load a new generation on the same page numbers.
  const live = new Set(),
    pending = new Set();
  let closed = false;
  services.scope.use({
    dispose() {
      closed = true;
      for (const controller of pending) controller.abort();
      retireAll(live);
    }
  });
  return async function loadGlb(path, { firstPage, signal } = {}) {
    if (closed) throw new Error('GLB scope closed');
    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort);
    pending.add(controller);
    try {
      return await acquire(path, firstPage, controller.signal);
    } finally {
      pending.delete(controller);
      signal?.removeEventListener('abort', abort);
    }
  };

  async function acquire(path, firstPage, signal) {
    if (!Number.isInteger(firstPage) || firstPage < 1 || firstPage > 255)
      throw new RangeError('Invalid first texture page');
    function checkOpen() {
      if (services.signal.aborted) throw services.signal.reason;
      if (signal?.aborted) throw signal.reason;
    }
    checkOpen();
    const bytes = await readContainer(services.assets, path, signal);
    checkOpen();
    const asset = await loadGltf3D(bytes, {
      async decodeImage({ bytes: image, mimeType }) {
        checkOpen();
        if (!image || image.buffer !== bytes.buffer || (mimeType !== 'image/jpeg' && mimeType !== 'image/png'))
          throw new Error('Expected an embedded JPEG or PNG in the packaged GLB');
        const raster = services.raster;
        const decode = mimeType === 'image/jpeg' ? raster?.decodeEmbeddedJpeg : raster?.decodeEmbeddedPng;
        if (!decode) throw new Error('Android GLB image decoding is unavailable');
        return decode.call(raster, path, image.byteOffset - bytes.byteOffset, image.byteLength);
      }
    });
    const handles = [];
    try {
      checkOpen();
      const sources = [...new Set(asset.textures.map((texture) => texture.source))];
      for (let i = 0; i < sources.length; i++) {
        const id = firstPage + i;
        if (id > 255 || pageInUse(id)) throw new RangeError('Texture page range unavailable for ' + path);
      }
      for (let i = 0; i < sources.length; i++) {
        handles.push(services.publishPage(firstPage + i, sources[i]));
      }
      const owned = Object.freeze({
        ...asset,
        dispose() {
          if (!live.delete(owned)) return;
          retireAll([asset, ...handles]);
        }
      });
      live.add(owned);
      return owned;
    } catch (error) {
      try {
        retireAll([asset, ...handles]);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'GLB binding and cleanup failed');
      }
      throw error;
    }
  }
}
