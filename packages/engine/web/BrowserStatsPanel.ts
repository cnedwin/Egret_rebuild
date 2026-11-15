// SPDX-License-Identifier: Apache-2.0
// A small panel over a game's canvas with what a developer otherwise prints: frames a second, the time between
// frames, what a frame holds, and how busy the Host is. It reads what it is given; it starts no timer of its own.
import { EgretError } from '@egret/runtime';
import type { SharedRenderFrame2D } from '@egret/engine';

/** What a game knows at one frame of the display. Every part may be left out; its line then shows a dash. */
export interface BrowserStatsSample {
  /** The time of the display's frame in milliseconds; `performance.now()` unless given. */
  readonly now?: number;
  /** The frame that was drawn since the last sample, if one was. */
  readonly frame?: SharedRenderFrame2D;
  /** Frames the Host holds that it has not finished: `host.getStatus().pendingFrames`. */
  readonly pendingFrames?: number;
  /** Frames drawn and frames skipped so far, as a frame loop's `snapshot()` gives them. */
  readonly frames?: number;
  readonly skipped?: number;
}
/** The numbers the panel shows, as of its last refresh. */
export interface BrowserStatsSnapshot {
  /** Frames of the display a second, and the longest time between two of them, in milliseconds, since the refresh before. */
  readonly fps: number;
  readonly longestFrameMs: number;
  /** Of the last frame drawn: its commands, the triangles they draw, its different geometries and its pages. */
  readonly commands: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly pages: number;
  readonly pendingFrames: number;
  readonly frames: number;
  readonly skipped: number;
}
export interface BrowserStatsPanelOptions {
  /** The canvas the panel lies over: it is placed at the canvas's top left corner. */
  readonly canvas: HTMLCanvasElement;
  /** A line at the top of the panel, such as the backend's name. */
  readonly label?: string;
  /** How often the text changes, in milliseconds. 500 unless given; at least 100. */
  readonly intervalMs?: number;
}
export interface BrowserStatsPanel {
  /** The panel's element, a child of the page's body. */
  readonly element: HTMLElement;
  /** Called once for each frame of the display. */
  sample(sample?: BrowserStatsSample): void;
  snapshot(): BrowserStatsSnapshot;
  /** Removes the panel from the page. */
  dispose(): void;
}

const invalid = (): EgretError => new EgretError('BROWSER_STATS_OPTIONS_INVALID');
const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

/** The triangles a frame's commands draw: two for a rectangle or an image, and a mesh's own. */
function trianglesOf(frame: SharedRenderFrame2D): number {
  let triangles = 0;
  for (const command of frame.commands) {
    if (command.kind === 'mesh') triangles += frame.geometries[command.geometryIndex]?.triangleCount ?? 0;
    else if (command.kind !== 'barrier') triangles += 2;
  }
  return triangles;
}

export function createBrowserStatsPanel(options: BrowserStatsPanelOptions): BrowserStatsPanel {
  if (options === null || typeof options !== 'object') throw invalid();
  const { canvas, label } = options,
    interval = options.intervalMs ?? 500,
    page = canvas?.ownerDocument;
  if (
    canvas === null ||
    typeof canvas !== 'object' ||
    typeof canvas.getBoundingClientRect !== 'function' ||
    page === null ||
    typeof page !== 'object' ||
    typeof page.createElement !== 'function' ||
    page.body === null ||
    typeof page.body !== 'object' ||
    (label !== undefined && typeof label !== 'string') ||
    typeof interval !== 'number' ||
    !(interval >= 100) ||
    !Number.isFinite(interval)
  )
    throw invalid();
  const element = page.createElement('div');
  // Over the page and out of the way of the pointer: what is under the panel is still pressed.
  element.setAttribute(
    'style',
    'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;margin:0;padding:4px 6px;background:rgba(0,0,0,0.72);color:#7CFC8A;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre'
  );
  element.setAttribute('aria-hidden', 'true');
  page.body.appendChild(element);
  let closed = false,
    last: number | undefined,
    since: number | undefined,
    seen = 0,
    longest = 0,
    shown = false;
  let commands = -1,
    triangles = -1,
    geometries = -1,
    pages = -1,
    pending = -1,
    frames = -1,
    skipped = -1;
  let current: BrowserStatsSnapshot = Object.freeze({
    fps: 0,
    longestFrameMs: 0,
    commands: 0,
    triangles: 0,
    geometries: 0,
    pages: 0,
    pendingFrames: 0,
    frames: 0,
    skipped: 0
  });
  const text = (value: number): string => (value < 0 ? '-' : String(value));
  function refresh(now: number): void {
    const elapsed = now - since!,
      fps = elapsed > 0 ? Math.round((10000 * seen) / elapsed) / 10 : 0;
    current = Object.freeze({
      fps,
      longestFrameMs: Math.round(10 * longest) / 10,
      commands: Math.max(0, commands),
      triangles: Math.max(0, triangles),
      geometries: Math.max(0, geometries),
      pages: Math.max(0, pages),
      pendingFrames: Math.max(0, pending),
      frames: Math.max(0, frames),
      skipped: Math.max(0, skipped)
    });
    const box = canvas.getBoundingClientRect();
    element.style.left = box.left + 'px';
    element.style.top = box.top + 'px';
    element.textContent =
      (label === undefined ? '' : label + '\n') +
      'fps ' +
      fps.toFixed(1) +
      '  longest ' +
      current.longestFrameMs.toFixed(1) +
      ' ms\n' +
      'commands ' +
      text(commands) +
      '  triangles ' +
      text(triangles) +
      '\n' +
      'geometries ' +
      text(geometries) +
      '  pages ' +
      text(pages) +
      '\n' +
      'pending ' +
      text(pending) +
      '  drawn ' +
      text(frames) +
      '  skipped ' +
      text(skipped);
    since = now;
    seen = 0;
    longest = 0;
    shown = true;
  }
  return Object.freeze({
    element,
    sample(sample: BrowserStatsSample = {}): void {
      if (closed) return;
      if (sample === null || typeof sample !== 'object') throw invalid();
      const now = sample.now ?? performance.now();
      if (typeof now !== 'number' || !Number.isFinite(now)) throw invalid();
      if (sample.frame !== undefined) {
        const frame = sample.frame;
        commands = frame.commands.length;
        triangles = trianglesOf(frame);
        geometries = frame.geometries.length;
        pages = frame.pages.length;
      }
      pending = count(sample.pendingFrames, pending);
      frames = count(sample.frames, frames);
      skipped = count(sample.skipped, skipped);
      if (last !== undefined && now > last) {
        seen++;
        longest = Math.max(longest, now - last);
      }
      last = now;
      if (since === undefined) since = now;
      if (!shown || now - since >= interval) refresh(now);
    },
    snapshot: () => current,
    dispose(): void {
      if (closed) return;
      closed = true;
      element.remove();
    }
  });
}
