// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createImageData2D } from '@egret/contracts';
import { createVideo } from '@egret/engine/video';
import type { Video, VideoFrame, VideoSource, VideoSourceState } from '@egret/engine/video';
import type { AssetManager } from '@egret/runtime';

export interface BrowserVideoOptions {
  /** The Engine's assets, which lease each picture as a texture. */
  readonly assets: AssetManager;
  /** A file to play, or a stream such as a canvas's or a camera's, or a video element of the page's own. One of the three. */
  readonly src?: string;
  readonly stream?: MediaStream;
  readonly element?: HTMLVideoElement;
  readonly loop?: boolean;
  /** Defaults to true: a page plays a muted video without waiting for a press. */
  readonly muted?: boolean;
  readonly volume?: number;
  /** Pictures wider than this are scaled down to it before they become textures, to keep each upload small. Defaults to 1280. */
  readonly maxWidth?: number;
  /** For a file from another origin that allows it. */
  readonly crossOrigin?: 'anonymous' | 'use-credentials';
}
export interface BrowserVideo extends Video {
  /** The page's video element the pictures are read from. */
  readonly element: HTMLVideoElement;
}

const invalid = (): EgretError => new EgretError('VIDEO_OPTIONS_INVALID');

/**
 * A video played by a page's video element and shown as a display object. Each picture the element presents is drawn
 * into a canvas of the size it is shown at, read back, and leased as a texture; a picture not yet changed is not read.
 */
export function createBrowserVideo(options: BrowserVideoOptions): BrowserVideo {
  if (options === null || typeof options !== 'object') throw invalid();
  const { assets, src, stream, element: given, loop = false, muted = true, volume = 1, maxWidth = 1280, crossOrigin } = options;
  const kinds = [src, stream, given].filter(value => value !== undefined).length;
  if (kinds !== 1 || (src !== undefined && (typeof src !== 'string' || src.length === 0)) || (stream !== undefined && (typeof MediaStream === 'undefined' || !(stream instanceof MediaStream)))
    || (given !== undefined && !(given instanceof HTMLVideoElement)) || typeof loop !== 'boolean' || typeof muted !== 'boolean' || typeof volume !== 'number' || !(volume >= 0 && volume <= 1)
    || !Number.isSafeInteger(maxWidth) || maxWidth < 1 || maxWidth > 4096 || (crossOrigin !== undefined && crossOrigin !== 'anonymous' && crossOrigin !== 'use-credentials')) throw invalid();
  const element = given ?? document.createElement('video');
  element.playsInline = true; element.preload = 'auto'; element.loop = loop; element.muted = muted; element.volume = volume;
  if (crossOrigin !== undefined) element.crossOrigin = crossOrigin;

  let state: VideoSourceState = 'loading', fresh = false, frameTime = NaN, callback: number | undefined, closed = false;
  const surface = document.createElement('canvas'), context = surface.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new EgretError('VIDEO_UNAVAILABLE');
  /** Where the element presents a new picture: each presented frame where the browser says so, otherwise each change of time. */
  const presented = typeof element.requestVideoFrameCallback === 'function';
  const watchFrames = (): void => {
    if (closed || !presented) return;
    callback = element.requestVideoFrameCallback((_now, metadata) => { fresh = true; frameTime = metadata.mediaTime; watchFrames(); });
  };
  const size = (): { width: number; height: number } => {
    const w = element.videoWidth, h = element.videoHeight;
    if (w === 0 || h === 0) return { width: 0, height: 0 };
    const scale = Math.min(1, maxWidth / w);
    return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
  };
  const events: [string, () => void][] = [
    ['loadeddata', () => { if (state === 'loading') state = element.paused ? 'ready' : 'playing'; fresh = true; frameTime = element.currentTime; }],
    ['playing', () => { state = 'playing'; }],
    ['pause', () => { if (state !== 'ended' && state !== 'failed') state = 'paused'; }],
    ['ended', () => { state = 'ended'; }],
    ['error', () => { state = 'failed'; }],
    ['seeked', () => { fresh = true; frameTime = element.currentTime; }],
    ['timeupdate', () => { if (!presented) { fresh = true; frameTime = element.currentTime; } }],
  ];
  for (const [name, listener] of events) element.addEventListener(name, listener);
  if (src !== undefined) element.src = src; else if (stream !== undefined) element.srcObject = stream;
  if (element.readyState >= 2) { state = element.paused ? 'ready' : 'playing'; fresh = true; frameTime = element.currentTime; }
  watchFrames();

  const source: VideoSource = {
    get state() { return state; },
    get width() { return size().width; },
    get height() { return size().height; },
    get duration() { return element.duration; },
    get currentTime() { return element.currentTime; },
    get loop() { return element.loop; }, set loop(value: boolean) { element.loop = value; },
    get muted() { return element.muted; }, set muted(value: boolean) { element.muted = value; },
    get volume() { return element.volume; }, set volume(value: number) { element.volume = value; },
    readFrame(): VideoFrame | undefined {
      if (!fresh || element.readyState < 2) return undefined;
      const { width, height } = size();
      if (width === 0) return undefined;
      fresh = false;
      if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
      context.drawImage(element, 0, 0, width, height);
      const data = context.getImageData(0, 0, width, height).data;
      return { image: createImageData2D({ width, height, pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) }), time: frameTime };
    },
    async play(): Promise<void> { if (state === 'ended') state = 'paused'; await element.play(); },
    pause(): void { element.pause(); },
    seek(seconds: number): void { if (state === 'ended') state = 'paused'; element.currentTime = seconds; },
    dispose(): void {
      closed = true;
      if (callback !== undefined && typeof element.cancelVideoFrameCallback === 'function') element.cancelVideoFrameCallback(callback);
      for (const [name, listener] of events) element.removeEventListener(name, listener);
      element.pause();
      // A page's own element is left as it was given; one made here lets go of what it was playing.
      if (given === undefined) { element.removeAttribute('src'); element.srcObject = null; element.load(); }
      surface.width = 0; surface.height = 0;
    },
  };
  const video = createVideo({ assets, source });
  return Object.freeze(Object.create(video, { element: { value: element, enumerable: true } })) as BrowserVideo;
}
