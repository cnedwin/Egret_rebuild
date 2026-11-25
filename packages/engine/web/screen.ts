// SPDX-License-Identifier: Apache-2.0
// The optional entry @egret/engine/web/screen. Where a stage goes on a screen of any shape: which design applies, how large a stage unit is, how much stage the
// screen shows and which part of it no notch, rounded corner or home bar covers. Pure arithmetic: the caller gives
// the size of the space on the screen and what covers it, and places the canvas and its content from the answer.
import { EgretError } from '@egret/runtime';

/** A width and a height above 0. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** How far in from each edge a notch, rounded corners or a home bar reach, in the pixels of the space given. */
export interface ScreenInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** A rectangle in stage units. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What to fit: the space on the screen, the designs, how they fit and what covers the edges. */
export interface ScreenPlanOptions {
  /** The space the stage may take, in the screen's pixels (CSS pixels on a page). */
  readonly box: ScreenSize;
  /** The stage that is always shown whole: the design. */
  readonly design: ScreenSize;
  /** The design while the space is taller than it is wide. `design` unless given. */
  readonly portrait?: ScreenSize;
  /**
   * `'contain'` unless given: the stage is the design, scaled to fit and centred, with bars where the shapes differ.
   * `'expand'`: the same scale, and the stage grows to fill the space, so the screen shows the design whole and more
   * of the stage on two sides.
   */
  readonly fit?: 'contain' | 'expand';
  /** What covers the edges of the space, in its pixels. None unless given. */
  readonly insets?: ScreenInsets;
}

/** Where the stage goes, and what of it is shown and safe to touch. */
export interface ScreenPlan {
  /** `'portrait'` while the space is taller than it is wide, `'landscape'` otherwise. */
  readonly orientation: 'landscape' | 'portrait';
  /** The design that applies: `portrait` while the space is taller than wide and one was given, `design` otherwise. */
  readonly design: ScreenSize;
  /** The size of the stage, in stage units: whole numbers, the design's or, with `'expand'`, at least the design's. */
  readonly width: number;
  readonly height: number;
  /** The screen's pixels in a stage unit. */
  readonly scale: number;
  /** Where the stage's top left corner is in the space, in its pixels: above 0 where bars are left. */
  readonly left: number;
  readonly top: number;
  /** Where the design lies on the stage: all of it with `'contain'`, its middle with `'expand'`. */
  readonly designRect: ScreenRect;
  /** The part of the stage that is shown and that nothing covers, in stage units. */
  readonly safe: ScreenRect;
}

const invalid = (): EgretError => new EgretError('UI_SCREEN_OPTIONS_INVALID');
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const size = (value: unknown): value is ScreenSize =>
  value !== null &&
  typeof value === 'object' &&
  positive((value as ScreenSize).width) &&
  positive((value as ScreenSize).height);
const whole = (value: ScreenSize): boolean => Number.isSafeInteger(value.width) && Number.isSafeInteger(value.height);

/**
 * Fits a stage to a space on a screen. The scale keeps the whole design in the space whatever its shape; with
 * `'expand'` the stage takes the rest of the space, so an edge of the screen is at `0` or `width` of the stage and
 * the design lies in its middle. `safe` is the stage less what the insets cover. Recompute it whenever the space or
 * the insets change, as they do when a phone turns.
 */
export function planScreen(options: ScreenPlanOptions): ScreenPlan {
  if (options === null || typeof options !== 'object') throw invalid();
  const { box, design: landscape, portrait, insets } = options,
    fit = options.fit ?? 'contain';
  if (
    !size(box) ||
    !size(landscape) ||
    !whole(landscape) ||
    (portrait !== undefined && (!size(portrait) || !whole(portrait))) ||
    (fit !== 'contain' && fit !== 'expand') ||
    (insets !== undefined &&
      (insets === null ||
        typeof insets !== 'object' ||
        [insets.top, insets.right, insets.bottom, insets.left].some(
          edge => typeof edge !== 'number' || !Number.isFinite(edge) || edge < 0
        )))
  )
    throw invalid();
  const orientation = box.height > box.width ? 'portrait' : 'landscape',
    design = orientation === 'portrait' && portrait !== undefined ? portrait : landscape;
  const scale = Math.min(box.width / design.width, box.height / design.height);
  // With 'expand' the stage is as many whole units as the space holds, and never less than the design.
  const width = fit === 'expand' ? Math.max(design.width, Math.floor(box.width / scale + 1e-6)) : design.width,
    height = fit === 'expand' ? Math.max(design.height, Math.floor(box.height / scale + 1e-6)) : design.height;
  const left = (box.width - width * scale) / 2,
    top = (box.height - height * scale) / 2;
  const designRect = Object.freeze({
    x: (width - design.width) / 2,
    y: (height - design.height) / 2,
    width: design.width,
    height: design.height
  });
  // What the insets leave of the space, as stage units, and within the stage.
  const edge = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const x0 = Math.max(0, (edge.left - left) / scale),
    y0 = Math.max(0, (edge.top - top) / scale),
    x1 = Math.min(width, (box.width - edge.right - left) / scale),
    y1 = Math.min(height, (box.height - edge.bottom - top) / scale);
  const safe = Object.freeze({ x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) });
  return Object.freeze({
    orientation,
    design: Object.freeze({ width: design.width, height: design.height }),
    width,
    height,
    scale,
    left,
    top,
    designRect,
    safe
  });
}
