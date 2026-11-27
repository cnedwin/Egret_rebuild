// SPDX-License-Identifier: Apache-2.0
/** Index sparse cells once. A viewport selects only authored cells in row-major order. */
export function createLegacyTileIndex(cells, tileWidth, tileHeight = tileWidth) {
  if (![tileWidth, tileHeight].every(n => Number.isSafeInteger(n) && n > 0))
    throw new RangeError('Expected positive tile dimensions.');
  const grid = new Map(),
    ordered = [],
    names = new Set();
  for (const { column, row, id, asset } of cells) {
    if (
      ![column, row, column * tileWidth, row * tileHeight].every(Number.isSafeInteger) ||
      typeof id !== 'string' ||
      !id ||
      names.has(id) ||
      typeof asset !== 'string' ||
      !asset
    )
      throw new RangeError('Invalid or duplicate tile.');
    const coord = row + ',' + column;
    if (grid.has(coord)) throw new RangeError('Duplicate cell.');
    const item = Object.freeze({ id, asset, x: column * tileWidth, y: row * tileHeight });
    grid.set(coord, item);
    ordered.push({ row, column, item });
    names.add(id);
  }
  ordered.sort((a, b) => a.row - b.row || a.column - b.column);
  return Object.freeze({
    visible({ x, y, width, height }) {
      if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0)
        throw new RangeError('Expected a finite viewport.');
      if (width === 0 || height === 0) return [];
      const left = Math.floor(x / tileWidth),
        top = Math.floor(y / tileHeight);
      const right = Math.ceil((x + width) / tileWidth),
        bottom = Math.ceil((y + height) / tileHeight);
      if (![left, top, right, bottom].every(Number.isSafeInteger)) throw new RangeError('Viewport exceeds the grid.');
      const result = [];
      if ((right - left) * (bottom - top) > ordered.length) {
        for (const cell of ordered)
          if (cell.column >= left && cell.column < right && cell.row >= top && cell.row < bottom)
            result.push(cell.item);
      } else {
        for (let row = top; row < bottom; ++row)
          for (let column = left; column < right; ++column) {
            const item = grid.get(row + ',' + column);
            if (item) result.push(item);
          }
      }
      return result;
    }
  });
}

/**
 * Draw requested tiles or actor parts in caller order, even when their atlas pages arrive out of order.
 * acquire(asset, signal) returns an owned texture lease from the existing asset manager.
 */
export function createLegacySceneLayer({ sdk, game, acquire, concurrency = 4 }) {
  if (
    game.scope.signal.aborted ||
    typeof acquire !== 'function' ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 16
  )
    throw new TypeError('Expected an open game, texture acquisition and concurrency from 1 to 16.');
  const display = new sdk.DisplayObjectContainer();
  const clockOwner = game.engine.createScope();
  const slots = new Map(),
    running = new Set();
  let queue = [],
    tick,
    phase = 0,
    closed = false;

  function syncClock() {
    const animated = [...slots.values()].some(slot => slot.clip && slot.status !== 'failed');
    if (animated && !tick)
      tick = game.engine.clock.onTick(clockOwner, delta => {
        phase += delta.deltaSeconds;
        for (const slot of slots.values()) slot.player?.applyAt(phase);
      });
    if (!animated && tick) {
      tick.dispose();
      tick = undefined;
    }
  }
  function retire(slot) {
    slot.owner?.dispose();
    slot.holder.dispose();
  }
  async function install(slot) {
    const owner = game.engine.createScope();
    slot.owner = owner;
    try {
      const lease = await acquire(slot.asset, owner.signal);
      // A provider may finish after cancellation. Release that returned lease before any scene mutation.
      if (owner.signal.aborted) {
        lease.release();
        return;
      }
      owner.use(lease);
      const bitmap = owner.use(new sdk.Bitmap(lease));
      if (slot.clip) {
        slot.player = owner.use(new sdk.SequencePlayer(bitmap, slot.clip, 'loop'));
        slot.player.applyAt(phase);
      }
      bitmap.touchEnabled = false;
      slot.holder.addChild(bitmap);
      slot.status = 'ready';
      syncClock();
    } catch (error) {
      if (owner.signal.aborted) return;
      slot.status = 'failed';
      slot.error = error;
      slot.player = undefined;
      owner.dispose();
      syncClock();
    }
  }
  function pump() {
    while (!closed && running.size < concurrency && queue.length) {
      const slot = queue.pop();
      slot.status = 'loading';
      const promise = install(slot).finally(() => {
        running.delete(promise);
        pump();
      });
      running.add(promise);
    }
  }
  async function settled() {
    while (running.size) await Promise.all([...running]);
  }
  function dispose() {
    if (closed) return;
    closed = true;
    game.scope.signal.removeEventListener('abort', dispose);
    queue = [];
    for (const slot of slots.values()) retire(slot);
    slots.clear();
    clockOwner.dispose();
    display.dispose();
  }
  game.scope.signal.addEventListener('abort', dispose, { once: true });

  return Object.freeze({
    display,
    /** Each refresh also retries failed items. A retained id and source keep their bitmap and lease. */
    update(items) {
      if (closed) throw new Error('Scene layer is closed.');
      if (!Array.isArray(items)) throw new TypeError('Expected an ordered list of visible parts.');
      const desired = new Map();
      for (const { id, asset, x = 0, y = 0, clip } of items) {
        if (
          typeof id !== 'string' ||
          !id ||
          desired.has(id) ||
          typeof asset !== 'string' ||
          !asset ||
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        )
          throw new TypeError('Invalid visible part.');
        desired.set(id, { id, asset, x, y, clip });
      }
      for (const [id, slot] of slots) {
        const next = desired.get(id);
        if (!next || slot.asset !== next.asset || slot.clip !== next.clip || slot.status === 'failed') {
          slots.delete(id);
          retire(slot);
        }
      }
      queue = [];
      let index = 0;
      for (const item of desired.values()) {
        let slot = slots.get(item.id);
        if (!slot) {
          const holder = new sdk.DisplayObjectContainer();
          slot = { ...item, holder, status: 'queued' };
          slots.set(item.id, slot);
          display.addChildAt(holder, index);
        } else if (display.getChildAt(index) !== slot.holder) display.setChildIndex(slot.holder, index);
        slot.holder.x = item.x;
        slot.holder.y = item.y;
        if (slot.status === 'queued') queue.push(slot);
        index++;
      }
      queue.reverse();
      syncClock();
      pump();
    },
    /** Align streamed actor layers to an existing action clock, including layers that arrive later. */
    seek(seconds) {
      if (closed || !Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid scene time.');
      phase = seconds;
      for (const slot of slots.values()) slot.player?.applyAt(phase);
    },
    async settled() {
      await settled();
      return [...slots.values()].map(({ id, status, error }) => (error ? { id, status, error } : { id, status }));
    },
    async close() {
      dispose();
      await settled();
    }
  });
}
