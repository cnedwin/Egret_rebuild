// SPDX-License-Identifier: Apache-2.0
// How a browser game's canvas fills the element it is in: sized now and whenever the element changes size, centred,
// and, with the fits that follow the plan of the screen, given that plan with the page's safe-area insets.
import type { ScreenFit, ScreenInsets, ScreenPlan, ScreenSize } from './screen.js';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * The safe-area insets a tool's `globalThis.__egretAgent.insets` gives, in the window's CSS pixels, to fit the game as
 * a phone with a notch would; undefined where a page has none, or none of 0 or more on each side.
 */
function agentInsets(): ScreenInsets | undefined {
  const agent = (globalThis as { readonly __egretAgent?: { readonly insets?: unknown } }).__egretAgent;
  const insets = agent?.insets as Partial<ScreenInsets> | undefined;
  if (insets === null || typeof insets !== 'object') return undefined;
  const sides = [insets.top, insets.right, insets.bottom, insets.left];
  if (!sides.every(side => typeof side === 'number' && Number.isFinite(side) && side >= 0)) return undefined;
  return { top: insets.top!, right: insets.right!, bottom: insets.bottom!, left: insets.left! };
}

/** What a game's canvas is fitted by. */
export interface GameCanvasFit {
  readonly canvas: HTMLCanvasElement;
  /** The element the canvas fills: the game's `fitTo`, or the canvas's parent. */
  readonly holder: HTMLElement | null;
  readonly fit: 'none' | 'cover' | 'stretch' | ScreenFit;
  /** The design size of the stage. */
  readonly width: number;
  readonly height: number;
  readonly wholeScale: boolean;
  /** The insets the game was given; without them the page's own are read. */
  readonly insets: ScreenInsets | undefined;
  /** The plan of the screen for a box and insets. */
  readonly plan: (box: ScreenSize, insets?: ScreenInsets) => ScreenPlan;
  /** The plan the stage follows now. */
  readonly current: () => ScreenPlan;
  /** Makes the stage follow a new plan, before the canvas is placed by it. */
  readonly follow: (next: ScreenPlan) => void;
  /** Tells of a plan that moved the stage, after the canvas is placed by it. */
  readonly movedTo: (next: ScreenPlan) => void;
}

/** Fits the canvas now and on every change of its element's size; the result ends the watching. */
export function fitGameCanvas(input: GameCanvasFit): () => void {
  const { canvas, holder, fit, width, height, wholeScale, plan, current, follow, movedTo } = input;
  let watcher: ResizeObserver | undefined, probe: HTMLElement | undefined;
  // The page's safe-area insets, read from an element that is padded by them and shows nothing.
  const pageInsets = (): ScreenInsets | undefined => {
    if (input.insets !== undefined) return input.insets;
    const page = canvas.ownerDocument as Document | undefined,
      view = page?.defaultView;
    if (
      page === undefined ||
      page === null ||
      view === null ||
      view === undefined ||
      typeof view.getComputedStyle !== 'function' ||
      typeof page.createElement !== 'function' ||
      page.body === null ||
      page.body === undefined
    )
      return undefined;
    if (probe === undefined) {
      probe = page.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText =
        'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      page.body.appendChild(probe);
    }
    const style = view.getComputedStyle(probe),
      read = (value: string): number => (Number.isFinite(parseFloat(value)) ? Math.max(0, parseFloat(value)) : 0);
    // A tool may stand in for a phone's notch and home bar, which a headless browser does not have.
    const standIn = agentInsets(),
      edges = standIn ?? {
        top: read(style.paddingTop),
        right: read(style.paddingRight),
        bottom: read(style.paddingBottom),
        left: read(style.paddingLeft)
      };
    // Insets are of the window; the element may be anywhere in it.
    const box = (holder ?? canvas).getBoundingClientRect(),
      across = view.innerWidth,
      down = view.innerHeight;
    return {
      top: Math.max(0, edges.top - box.top),
      left: Math.max(0, edges.left - box.left),
      right: Math.max(0, edges.right - (finite(across) ? across - box.right : 0)),
      bottom: Math.max(0, edges.bottom - (finite(down) ? down - box.bottom : 0))
    };
  };
  if (fit !== 'none' && holder !== null) {
    const place = (): void => {
      const projected = holder.getBoundingClientRect();
      // CSS dimensions are set in the holder's layout space. A transformed bounding box is
      // measured in page space and would multiply the ancestor scale a second time.
      const box = { width: holder.clientWidth || projected.width, height: holder.clientHeight || projected.height };
      const style = canvas.style;
      if (fit === 'cover' || fit === 'stretch') {
        const wide = box.width / width,
          tall = box.height / height;
        const scaleX = fit === 'stretch' ? wide : Math.max(wide, tall),
          scaleY = fit === 'stretch' ? tall : scaleX;
        style.width = width * scaleX + 'px';
        style.height = height * scaleY + 'px';
        // Centred in its element; with "cover" what does not fit is outside it, for the element to cut off.
        style.marginLeft = (box.width - width * scaleX) / 2 + 'px';
        style.marginTop = (box.height - height * scaleY) / 2 + 'px';
        return;
      }
      if (!(box.width > 0 && box.height > 0)) return;
      const next = plan({ width: box.width, height: box.height }, pageInsets()),
        before = current();
      follow(next);
      style.width = next.width * next.scale + 'px';
      style.height = next.height * next.scale + 'px';
      // Whole steps are enlarged as they are, a canvas pixel to a square of the device's.
      if (wholeScale) style.imageRendering = 'pixelated';
      style.marginLeft = next.left + 'px';
      style.marginTop = next.top + 'px';
      const moved =
        next.width !== before.width ||
        next.height !== before.height ||
        next.scale !== before.scale ||
        next.orientation !== before.orientation ||
        (['x', 'y', 'width', 'height'] as const).some(key => next.safe[key] !== before.safe[key]);
      if (moved) movedTo(next);
    };
    place();
    watcher = new ResizeObserver(place);
    watcher.observe(holder);
  }
  return () => {
    watcher?.disconnect();
    probe?.remove();
  };
}
