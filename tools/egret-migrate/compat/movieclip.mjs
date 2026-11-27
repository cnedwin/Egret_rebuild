// SPDX-License-Identifier: Apache-2.0
const frameLabel = 'frame_label';
const maximumFrames = 1048576;

function positiveFrame(value, limit = maximumFrames) {
  if (!Number.isInteger(value) || value < 1 || value > limit)
    throw new RangeError('MovieClip frame number is outside its range.');
  return value;
}

function boundedRate(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 240) throw new RangeError('Invalid MovieClip frame rate.');
  return value;
}

function frameData(sdk, source, regions, lease) {
  if (!Array.isArray(source.frames) || !source.frames.length || source.frames.length > 1024)
    throw new RangeError('Expected 1 to 1024 authored MovieClip holds.');
  const rate = boundedRate(source.frameRate ?? 24);
  const frames = [],
    holds = [];
  let count = 0;
  for (const frame of source.frames) {
    const duration = positiveFrame(frame.duration ?? 1);
    count = positiveFrame(count + duration);
    const crop = typeof frame.res === 'string' && Object.hasOwn(regions, frame.res) && regions[frame.res];
    if (!crop || !Number.isFinite(frame.x ?? 0) || !Number.isFinite(frame.y ?? 0))
      throw new RangeError('Expected a named MovieClip region and finite offsets.');
    frames.push({ x: crop.x, y: crop.y, width: crop.w, height: crop.h, durationSeconds: duration / rate });
    // A sample from the middle of the hold avoids boundary rounding at non-integral rates.
    holds.push({
      crop: frames[frames.length - 1],
      end: count,
      sample: (count - duration / 2) / rate,
      x: frame.x ?? 0,
      y: frame.y ?? 0
    });
  }
  const clip = sdk.createSequenceClip({
    atlasWidth: lease.tiles ? lease.width : lease.value.width,
    atlasHeight: lease.tiles ? lease.height : lease.value.height,
    frames
  });
  const labels = new Map(),
    events = new Map();
  if (!Array.isArray(source.labels ?? []) || !Array.isArray(source.events ?? []))
    throw new TypeError('Expected MovieClip label and event arrays.');
  for (const label of source.labels ?? []) {
    const start = positiveFrame(label.frame, count),
      end = positiveFrame(label.end ?? count, count);
    if (end < start || typeof label.name !== 'string' || !label.name || labels.has(label.name))
      throw new RangeError('Invalid or duplicate MovieClip label.');
    labels.set(label.name, { start, end });
  }
  for (const event of source.events ?? []) {
    const frame = positiveFrame(event.frame, count);
    if (typeof event.name !== 'string') throw new TypeError('Expected a MovieClip event name.');
    const at = events.get(frame) ?? [];
    at.push(event.name);
    events.set(frame, at);
  }
  return { count, rate, holds, labels, events, clip, lease };
}

/** A crop may meet several pages. All pieces share the original crop origin and one parent transform. */
export function createPagedBitmap(sdk, page) {
  const display = new sdk.DisplayObjectContainer();
  const pieces = new Map();
  function apply(crop) {
    for (const tile of page.tiles) {
      const x = Math.max(tile.x, crop.x),
        y = Math.max(tile.y, crop.y);
      const right = Math.min(tile.x + tile.width, crop.x + crop.width);
      const bottom = Math.min(tile.y + tile.height, crop.y + crop.height);
      let part = pieces.get(tile);
      if (right <= x || bottom <= y) {
        if (part) part.visible = false;
        continue;
      }
      if (!part) {
        part = new sdk.Bitmap(tile.lease);
        part.touchEnabled = false;
        display.addChild(part);
        pieces.set(tile, part);
      }
      part.sourceRect = { x: tile.left + x - tile.x, y: tile.top + y - tile.y, width: right - x, height: bottom - y };
      part.x = x - crop.x;
      part.y = y - crop.y;
      part.visible = true;
    }
  }
  return { display, apply };
}

/** Map classic single-page RES animations onto Egret 7 texture leases, sequence crops and the game clock. */
export function createLegacyMovieClips({ sdk, game, Container, LegacyEvent, textures }) {
  const records = new WeakMap();

  class MovieClipDataFactory {
    #source;
    #texture;
    #cache = new Map();

    constructor(data, texture) {
      this.mcDataSet = data;
      this.texture = texture;
    }
    get mcDataSet() {
      return this.#source;
    }
    set mcDataSet(value) {
      this.#source = value;
      this.clearCache();
    }
    get texture() {
      return this.#texture;
    }
    set texture(value) {
      this.#texture = value;
      this.clearCache();
    }
    clearCache() {
      this.#cache.clear();
    }

    generateMovieClipData(name = '') {
      const source = this.#source;
      if (!source?.mc || !source.res) return null;
      if (!name) name = Object.keys(source.mc)[0];
      if (typeof name !== 'string' || !Object.hasOwn(source.mc, name)) return null;
      if (this.#cache.has(name)) return this.#cache.get(name);
      const page = textures.get(this.#texture);
      if (!page || page.sheet) throw new TypeError('MovieClip requires a full texture page loaded by RES.');
      const record = frameData(sdk, source.mc[name], source.res, page);
      const data = Object.freeze({ numFrames: record.count, frameRate: record.rate });
      records.set(data, record);
      this.#cache.set(name, data);
      return data;
    }
  }

  class MovieClip extends Container {
    #data;
    #record;
    #bitmap;
    #player;
    #paged;
    #tick;
    #active = false;
    #frame = 0;
    #rate = 24;
    #fraction = 0;
    #from = 1;
    #to = 0;
    #repeats = 1;
    #hold;

    constructor(data) {
      super();
      this.addEventListener('addedToStage', this.#subscribe, this);
      this.addEventListener('removedFromStage', this.#unsubscribe, this);
      if (data) this.movieClipData = data;
    }
    #subscribe() {
      if (this.#tick || !this.#active || !this.stage) return;
      this.#tick = game.engine.clock.onTick(game.scope, tick => this.#advance(tick.deltaSeconds));
    }
    #unsubscribe() {
      this.#tick?.dispose();
      this.#tick = undefined;
    }
    #render(frame) {
      this.#frame = frame;
      const holds = this.#record.holds;
      let left = 0,
        right = holds.length - 1;
      while (left < right) {
        const middle = (left + right) >>> 1;
        if (frame > holds[middle].end) left = middle + 1;
        else right = middle;
      }
      const hold = holds[left];
      if (hold !== this.#hold) {
        if (this.#paged) this.#paged.apply(hold.crop);
        else this.#player.applyAt(hold.sample);
        this.#bitmap.x = hold.x;
        this.#bitmap.y = hold.y;
        this.#hold = hold;
      }
    }
    #emitFrame() {
      for (const name of this.#record?.events.get(this.#frame) ?? []) {
        const event = new LegacyEvent(frameLabel);
        event.frameLabel = name;
        this.dispatchEvent(event);
      }
    }
    #advance(seconds) {
      this.#fraction += seconds * this.#rate;
      const steps = Math.floor(this.#fraction);
      this.#fraction -= steps;
      let looped = false,
        finished = false;
      for (let i = 0; i < steps && this.#active; i++) {
        if (this.#frame === this.#to) {
          if (this.#repeats === 1) {
            this.stop();
            finished = true;
            break;
          }
          if (this.#repeats > 1) this.#repeats--;
          this.#render(this.#from);
          this.#emitFrame();
          looped = true;
        } else {
          this.#render(this.#frame + 1);
          this.#emitFrame();
        }
      }
      if (looped) this.dispatchEventWith('loopComplete');
      if (finished) this.dispatchEventWith('complete');
    }
    #range(value) {
      if (typeof value === 'string') {
        const label = this.#record.labels.get(value);
        if (!label) throw new RangeError('Unknown MovieClip label.');
        return { frame: label.start, from: label.start, to: label.end };
      }
      if (!Number.isSafeInteger(value)) throw new RangeError('Expected a frame number or label.');
      return { frame: Math.max(1, Math.min(value, this.totalFrames)), from: 1, to: this.totalFrames };
    }
    get movieClipData() {
      return this.#data;
    }
    set movieClipData(data) {
      if (data === this.#data) return;
      const record = data == null ? undefined : records.get(data);
      if (data != null && !record) throw new TypeError('Expected MovieClipData from this host.');
      // Prepare the new binding before retiring the old one; a stale/newly released page may fail.
      let bitmap, player, paged;
      if (record?.lease.tiles) {
        paged = createPagedBitmap(sdk, record.lease);
        bitmap = paged.display;
      } else if (record) {
        bitmap = new sdk.Bitmap(record.lease);
        try {
          player = new sdk.SequencePlayer(bitmap, record.clip, 'once');
        } catch (error) {
          bitmap.dispose();
          throw error;
        }
      }
      this.stop();
      this.#player?.dispose();
      this.#bitmap?.dispose();
      this.#data = data;
      this.#record = record;
      this.#bitmap = bitmap;
      this.#player = player;
      this.#paged = paged;
      this.#hold = undefined;
      this.#frame = 0;
      this.#from = 1;
      this.#to = record?.count ?? 0;
      if (record) {
        bitmap.touchEnabled = false;
        this.addChild(bitmap);
        this.#rate = record.rate;
        this.#render(1);
        this.#emitFrame();
      }
    }
    get currentFrame() {
      return this.#frame;
    }
    get totalFrames() {
      return this.#record?.count ?? 0;
    }
    get currentFrameLabel() {
      for (const [name, label] of this.#record?.labels ?? []) if (label.start === this.#frame) return name;
      return null;
    }
    get currentLabel() {
      let start = 0,
        result = null;
      for (const [name, label] of this.#record?.labels ?? []) {
        if (start < label.start && label.start <= this.#frame) {
          start = label.start;
          result = name;
        }
      }
      return result;
    }
    get frameRate() {
      return this.#rate;
    }
    set frameRate(value) {
      this.#rate = boundedRate(value);
    }
    get isPlaying() {
      return this.#active;
    }
    play(playTimes = 0) {
      if (!this.#record) return;
      if (!Number.isSafeInteger(playTimes)) throw new RangeError('Invalid MovieClip play count.');
      if (playTimes !== 0) this.#repeats = playTimes < 0 ? -1 : playTimes;
      this.#active = true;
      this.#subscribe();
    }
    stop() {
      this.#active = false;
      this.#fraction = 0;
      this.#unsubscribe();
    }
    gotoAndPlay(value, playTimes = 0) {
      if (!this.#record) return;
      const range = this.#range(value);
      this.#from = range.from;
      this.#to = range.to;
      this.#fraction = 0;
      const changed = this.#frame !== range.frame;
      this.#render(range.frame);
      this.play(playTimes);
      if (changed) this.#emitFrame();
    }
    gotoAndStop(value) {
      if (!this.#record) return;
      const range = this.#range(value);
      this.stop();
      this.#from = range.from;
      this.#to = range.to;
      if (this.#frame !== range.frame) {
        this.#render(range.frame);
        this.#emitFrame();
      }
    }
    prevFrame() {
      this.gotoAndStop(Math.max(1, this.#frame - 1));
    }
    nextFrame() {
      this.gotoAndStop(Math.min(this.totalFrames, this.#frame + 1));
    }
    dispose() {
      if (this.isDisposed) return;
      this.stop();
      this.#player?.dispose();
      this.#record = this.#data = this.#player = this.#paged = this.#hold = this.#bitmap = undefined;
      super.dispose();
    }
  }

  return { MovieClipDataFactory, MovieClip, MovieClipEvent: Object.freeze({ FRAME_LABEL: frameLabel }) };
}
