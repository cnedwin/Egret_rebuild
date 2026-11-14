// SPDX-License-Identifier: Apache-2.0
import { AssetManager, Bitmap, DisplayObjectContainer, EgretError, createAssetRef, createAssetType, createTexture, isTexture } from '@egret/runtime';
import type { AssetLease, Texture } from '@egret/runtime';
import type { Video, VideoOptions, VideoSnapshot, VideoSource, VideoState } from './videoTypes.js';

const invalid = (): EgretError => new EgretError('VIDEO_OPTIONS_INVALID');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
let made = 0;

function sourceOk(source: unknown): source is VideoSource {
  if (source === null || typeof source !== 'object') return false;
  const s = source as Record<string, unknown>;
  return ['readFrame', 'play', 'pause', 'seek', 'dispose'].every(name => typeof s[name] === 'function');
}

/** A video as a display object: each new picture its source gives becomes, through the Engine's assets, the texture of one Bitmap. */
export function createVideo(options: VideoOptions): Video {
  if (options === null || typeof options !== 'object') throw invalid();
  const { assets, source } = options;
  if (!(assets instanceof AssetManager) || !sourceOk(source)) throw invalid();
  // Each picture is an asset of this video's own type, leased while it is shown and let go when the next one is.
  // Asset names are shared by all types of an Engine, so each video names its pictures under its own name.
  const name = 'egret.video.' + ++made, waiting = new Map<string, Texture>(), type = createAssetType<Texture>(name, value => isTexture(value));
  assets.register(type, {
    load: async ref => { const texture = waiting.get(ref.id); if (texture === undefined) throw new EgretError('VIDEO_FRAME_INVALID'); return texture; },
    dispose: texture => { texture.dispose(); },
  });
  const display = new DisplayObjectContainer(), listeners = new Set<() => void>();
  let bitmap: Bitmap | undefined, shown: AssetLease<Texture> | undefined, busy = false, closed = false, frames = 0, skipped = 0, count = 0, shownTime = NaN, endedTold = false;

  const open = (): void => { if (closed) throw new EgretError('VIDEO_CLOSED'); };
  /** Tells of the end once each time the source comes to it. */
  function watchEnd(): void {
    const ended = source.state === 'ended';
    if (ended && !endedTold) {
      endedTold = true;
      const failures: unknown[] = [];
      for (const listener of [...listeners]) try { listener(); } catch (cause) { failures.push(cause); }
      if (failures.length > 0) throw new EgretError('VIDEO_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    } else if (!ended) endedTold = false;
  }

  return Object.freeze({
    get state(): VideoState { return closed ? 'closed' : source.state; },
    display,
    get width(): number { return source.width; },
    get height(): number { return source.height; },
    get duration(): number { return source.duration; },
    get currentTime(): number { return source.currentTime; },
    get loop(): boolean { return source.loop; },
    set loop(value: boolean) { if (typeof value !== 'boolean') throw invalid(); open(); source.loop = value; },
    get muted(): boolean { return source.muted; },
    set muted(value: boolean) { if (typeof value !== 'boolean') throw invalid(); open(); source.muted = value; },
    get volume(): number { return source.volume; },
    set volume(value: number) { if (!finite(value) || value < 0 || value > 1) throw invalid(); open(); source.volume = value; },
    async play(): Promise<void> {
      open();
      endedTold = false;
      try { await source.play(); } catch (cause) { throw new EgretError('VIDEO_PLAY_REFUSED', { cause }); }
    },
    pause(): void { open(); source.pause(); },
    seek(seconds: number): void { if (!finite(seconds) || seconds < 0) throw invalid(); open(); source.seek(seconds); },
    async update(): Promise<boolean> {
      open();
      // A picture still on its way to a texture: the next update takes whatever is newest then.
      if (busy) { skipped++; return false; }
      const frame = source.readFrame();
      if (frame === undefined) { watchEnd(); return false; }
      if (frame === null || typeof frame !== 'object' || !finite(frame.time)) throw new EgretError('VIDEO_FRAME_INVALID');
      let texture: Texture;
      try { texture = createTexture(frame.image); } catch (cause) { throw new EgretError('VIDEO_FRAME_INVALID', { cause }); }
      const id = name + '/frame-' + ++count;
      waiting.set(id, texture);
      busy = true;
      let lease: AssetLease<Texture>;
      try { lease = await assets.acquire(createAssetRef(type, id)); }
      finally { waiting.delete(id); busy = false; }
      if (closed) { lease.release(); return false; }
      if (bitmap === undefined) { bitmap = new Bitmap(lease); display.addChild(bitmap); }
      else bitmap.textureLease = lease;
      const previous = shown;
      shown = lease;
      previous?.release();
      frames++; shownTime = frame.time;
      watchEnd();
      return true;
    },
    onEnded(listener: () => void): () => void {
      if (typeof listener !== 'function') throw invalid();
      open();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    snapshot(): VideoSnapshot { return Object.freeze({ state: closed ? 'closed' : source.state, frames, skipped, currentTime: source.currentTime, shownTime }); },
    dispose(): void {
      if (closed) return;
      closed = true;
      listeners.clear();
      const failures: unknown[] = [];
      for (const step of [() => bitmap?.dispose(), () => shown?.release(), () => display.dispose(), () => source.dispose()]) try { step(); } catch (cause) { failures.push(cause); }
      bitmap = undefined; shown = undefined;
      if (failures.length > 0) throw new EgretError('VIDEO_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
