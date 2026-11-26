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
   * of the stage on two sides. The other four fill the space too, and are the stage scale modes of Egret 5:
   * `'fixedWidth'` scales the design's width to the space's and the stage's height follows the space, more or less
   * than the design's; `'fixedHeight'` is the same with height; `'fixedNarrow'` is `'expand'`; `'fixedWide'` scales
   * the design until it covers the space and the stage is what the space shows of it, less than the design on one side.
   */
  readonly fit?: ScreenFit;
  /** What covers the edges of the space, in its pixels. None unless given. */
  readonly insets?: ScreenInsets;
  /**
   * When true, a stage unit covers a whole number of the device's pixels wherever the space holds the design at one or
   * more of them: the scale is rounded down to the step below, and what that leaves of the space is bars, for pixel
   * art. Below one device pixel a unit the scale is as the fit makes it. False unless given.
   */
  readonly wholeScale?: boolean;
  /** The device's pixels in a pixel of the space (`devicePixelRatio` on a page), for `wholeScale`. 1 unless given. */
  readonly pixelRatio?: number;
}

/** How a stage fills a space: see `ScreenPlanOptions.fit`. */
export type ScreenFit = 'contain' | 'expand' | 'fixedWidth' | 'fixedHeight' | 'fixedNarrow' | 'fixedWide';
const FITS: readonly ScreenFit[] = ['contain', 'expand', 'fixedWidth', 'fixedHeight', 'fixedNarrow', 'fixedWide'];

/** Where the stage goes, and what of it is shown and safe to touch. */
export interface ScreenPlan {
  /** `'portrait'` while the space is taller than it is wide, `'landscape'` otherwise. */
  readonly orientation: 'landscape' | 'portrait';
  /** The design that applies: `portrait` while the space is taller than wide and one was given, `design` otherwise. */
  readonly design: ScreenSize;
  /**
   * The size of the stage, in stage units, whole numbers: the design's with `'contain'`, at least the design's with
   * `'expand'`, and on one side less than the design's with `'fixedWide'`, or with `'fixedWidth'` and `'fixedHeight'`
   * where the space is of the other shape.
   */
  readonly width: number;
  readonly height: number;
  /** The screen's pixels in a stage unit. */
  readonly scale: number;
  /** Where the stage's top left corner is in the space, in its pixels: above 0 where bars are left. */
  readonly left: number;
  readonly top: number;
  /**
   * Where the design lies on the stage, centred: all of it with `'contain'`, its middle with `'expand'`, and reaching
   * past the stage where the stage is smaller than the design, which is then not all shown.
   */
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
 * Fits a stage to a space on a screen. With `'contain'` and `'expand'` the scale keeps the whole design in the space
 * whatever its shape; with `'expand'` the stage takes the rest of the space, so an edge of the screen is at `0` or
 * `width` of the stage and the design lies in its middle. The fixed modes choose the scale from one side and fill the
 * space as Egret 5 did. `safe` is the stage less what the insets cover. Recompute it whenever the space or the insets
 * change, as they do when a phone turns.
 */
export function planScreen(options: ScreenPlanOptions): ScreenPlan {
  if (options === null || typeof options !== 'object') throw invalid();
  const { box, design: landscape, portrait, insets } = options,
    fit = options.fit ?? 'contain',
    wholeScale = options.wholeScale ?? false,
    pixelRatio = options.pixelRatio ?? 1;
  if (
    !size(box) ||
    !size(landscape) ||
    !whole(landscape) ||
    (portrait !== undefined && (!size(portrait) || !whole(portrait))) ||
    !FITS.includes(fit) ||
    typeof wholeScale !== 'boolean' ||
    !positive(pixelRatio) ||
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
  const across = box.width / design.width,
    down = box.height / design.height;
  let scale =
    fit === 'fixedWidth'
      ? across
      : fit === 'fixedHeight'
        ? down
        : fit === 'fixedWide'
          ? Math.max(across, down)
          : Math.min(across, down);
  // A whole number of device pixels a unit, where there is room for one or more.
  if (wholeScale && scale * pixelRatio >= 1) scale = Math.floor(scale * pixelRatio + 1e-9) / pixelRatio;
  // As many whole units as the space holds: never fewer than the design with 'expand', and as the space makes them
  // with the fixed modes; the design itself with 'contain'.
  const fill = (space: number): number => Math.max(1, Math.floor(space / scale + 1e-6)),
    grows = fit === 'expand' || fit === 'fixedNarrow';
  const width =
      fit === 'contain' || fit === 'fixedWidth'
        ? design.width
        : grows
          ? Math.max(design.width, fill(box.width))
          : fill(box.width),
    height =
      fit === 'contain' || fit === 'fixedHeight'
        ? design.height
        : grows
          ? Math.max(design.height, fill(box.height))
          : fill(box.height);
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

/**
 * Where a box is held in an area: on each axis a distance in from one edge, or from the middle. `left`, `right` and
 * `centerX` place it across, `top`, `bottom` and `centerY` down; at most one of each three, and an axis with none is
 * left as it is. A distance in from an edge is 0 or more for the box to be inside.
 */
export interface ScreenPin {
  readonly left?: number;
  readonly right?: number;
  readonly centerX?: number;
  readonly top?: number;
  readonly bottom?: number;
  readonly centerY?: number;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const rect = (value: unknown): value is ScreenRect =>
  value !== null &&
  typeof value === 'object' &&
  finite((value as ScreenRect).x) &&
  finite((value as ScreenRect).y) &&
  finite((value as ScreenRect).width) &&
  finite((value as ScreenRect).height) &&
  (value as ScreenRect).width >= 0 &&
  (value as ScreenRect).height >= 0;
const PIN_KEYS = ['left', 'right', 'centerX', 'top', 'bottom', 'centerY'];

/** Whether `pin` is a pin: only its six names, finite numbers, and at most one of each axis. */
export function isScreenPin(pin: unknown): pin is ScreenPin {
  if (pin === null || typeof pin !== 'object') return false;
  const given = Object.entries(pin as Record<string, unknown>).filter(([, value]) => value !== undefined);
  if (given.some(([key, value]) => !PIN_KEYS.includes(key) || !finite(value))) return false;
  const named = new Set(given.map(([key]) => key));
  const count = (keys: readonly string[]): number => keys.filter(key => named.has(key)).length;
  return count(['left', 'right', 'centerX']) <= 1 && count(['top', 'bottom', 'centerY']) <= 1;
}

/**
 * Where `box` goes in `area` by `pin`: the place of its top left corner, in the units of both. The rectangle of the
 * safe part of a plan, or of the whole stage, held against its edges: a score at `{ right: 16, top: 16 }`, a bar at
 * `{ bottom: 0, centerX: 0 }`. Place again whenever the area or the box's size changes, as `onScreenChange` tells.
 */
export function pinBox(area: ScreenRect, box: ScreenRect, pin: ScreenPin): { readonly x: number; readonly y: number } {
  if (!rect(area) || !rect(box) || !isScreenPin(pin)) throw invalid();
  const x =
    pin.left !== undefined
      ? area.x + pin.left
      : pin.right !== undefined
        ? area.x + area.width - pin.right - box.width
        : pin.centerX !== undefined
          ? area.x + (area.width - box.width) / 2 + pin.centerX
          : box.x;
  const y =
    pin.top !== undefined
      ? area.y + pin.top
      : pin.bottom !== undefined
        ? area.y + area.height - pin.bottom - box.height
        : pin.centerY !== undefined
          ? area.y + (area.height - box.height) / 2 + pin.centerY
          : box.y;
  return Object.freeze({ x, y });
}
