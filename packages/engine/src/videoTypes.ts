// SPDX-License-Identifier: Apache-2.0
import type { AssetManager, DisplayObjectContainer } from '@egret/runtime';
import type { ImageData2D } from '@egret/contracts';

/** Where a source is: still opening, able to show a frame, playing, paused, at its end, or unable to play. */
export type VideoSourceState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'failed';
export type VideoState = VideoSourceState | 'closed';

/** One picture of a video, the time of the video it shows. */
export interface VideoFrame {
  readonly image: ImageData2D;
  readonly time: number;
}

/**
 * What a video player reads its pictures from and is driven through. The browser video entry makes one from a video
 * element of the page; a game or a test may give its own.
 */
export interface VideoSource {
  readonly state: VideoSourceState;
  /** The size of the pictures it gives, which is 0 by 0 until it knows. */
  readonly width: number;
  readonly height: number;
  /** Seconds; Infinity for a stream, NaN until it knows. */
  readonly duration: number;
  readonly currentTime: number;
  loop: boolean;
  muted: boolean;
  volume: number;
  /** The newest picture not yet read, or undefined when it has not changed since the last read. */
  readFrame(): VideoFrame | undefined;
  /** Resolves when it plays; rejects when the page does not let it, as a browser does with sound before a press. */
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  dispose(): void;
}

export interface VideoOptions {
  /** The Engine's assets, which lease each picture as a texture. */
  readonly assets: AssetManager;
  readonly source: VideoSource;
}

export interface VideoSnapshot {
  readonly state: VideoState;
  /** Pictures shown since it was made. */
  readonly frames: number;
  /** Times a newer picture was waiting while the last was still being made a texture, and was taken next time instead. */
  readonly skipped: number;
  readonly currentTime: number;
  /** The time of the picture shown, or NaN before the first. */
  readonly shownTime: number;
}

/** A video shown as a display object: each new picture of its source becomes the texture of one Bitmap. */
export interface Video {
  readonly state: VideoState;
  /** Holds the Bitmap once there is a first picture. */
  readonly display: DisplayObjectContainer;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly currentTime: number;
  loop: boolean;
  muted: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  /**
   * Shows the newest picture of the source, if there is one: call it once a frame. Resolves true when a new picture is
   * shown; false when there was none, or one is still being made a texture.
   */
  update(): Promise<boolean>;
  /** Called when the source reaches its end without looping. Returns a function that stops it. */
  onEnded(listener: () => void): () => void;
  snapshot(): VideoSnapshot;
  dispose(): void;
}
