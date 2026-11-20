// SPDX-License-Identifier: Apache-2.0
// The engine's own 2D interface over a World3D scene: menus, bars, buttons,
// text and dialogs drawn by the 2D stage on a transparent canvas laid exactly
// over the 3D one. A touch or click that lands on 2D content goes to the 2D
// stage; one that lands where the interface is empty goes on to the 3D canvas
// below, so the scene can still be orbited, aimed at and picked.
import { EgretError } from '@egret/runtime';
import { createBrowserGame } from '../game.js';
import type { BrowserGame, BrowserGameBackend } from '../game.js';

/** A 2D overlay to make over a 3D view: its size, backend, pixel ratio, update, and whether it lets input through. */
export interface World3DOverlayOptions {
  /** The stage size, in the interface's own units. */
  readonly width: number;
  readonly height: number;
  /** The 2D backend; WebGL2 by default, so the 3D renderer keeps WebGPU for itself where it uses it. */
  readonly backend?: 'auto' | BrowserGameBackend;
  /** Canvas pixels per unit of the canvas width; the device's ratio, at most 2, by default. */
  readonly pixelRatio?: number;
  /** One step of the interface, called before each 2D frame. */
  readonly update?: (deltaSeconds: number) => void;
  readonly onError?: (error: unknown) => void;
  /** How translucent interface draws mix: `linear` light unless given, or the stored `srgb` codes, as a 2D canvas does. */
  readonly blendSpace?: 'linear' | 'srgb';
  /** Send presses on empty parts of the interface to the 3D canvas. On by default. */
  readonly passThrough?: boolean;
  /**
   * How the stage of `width` × `height` is laid over the 3D canvas when their shapes differ, as a phone turns:
   * `stretch` (the default) fills the canvas and squashes the interface; `contain` keeps its shape, as large as fits,
   * centred, with the scene showing at the sides; `cover` keeps its shape and fills the canvas, its edges cut off by the
   * canvas's parent. Read `overlay.box` for where it is.
   */
  readonly fit?: 'stretch' | 'contain' | 'cover';
}
/** A 2D game drawn on a canvas over a 3D view. */
export interface World3DOverlay {
  /** The 2D game on the overlay: its stage, scope, pointer, keyboard, loop and textures. */
  readonly game: BrowserGame;
  readonly canvas: HTMLCanvasElement;
  /** Where the stage is now, in CSS pixels from the 3D canvas's top left corner, and its scale: CSS pixels per unit. */
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  };
  /** Ends the 2D game and takes the overlay canvas away. The 3D canvas is left as it was. */
  dispose(): Promise<void>;
}

const FORWARDED = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'click',
  'wheel',
  'contextmenu',
  'dblclick'
] as const;

/**
 * Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it.
 * Give interface nodes hit areas as usual; presses elsewhere fall through to the 3D canvas.
 */
export async function createWorld3DOverlay(
  canvas: HTMLCanvasElement,
  options: World3DOverlayOptions
): Promise<World3DOverlay> {
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function' || !canvas.parentElement)
    throw new EgretError('WORLD3D_OVERLAY_OPTIONS_INVALID');
  if (!options || !(options.width > 0) || !(options.height > 0))
    throw new EgretError('WORLD3D_OVERLAY_OPTIONS_INVALID');
  const fit = options.fit ?? 'stretch';
  if (fit !== 'stretch' && fit !== 'contain' && fit !== 'cover')
    throw new EgretError('WORLD3D_OVERLAY_OPTIONS_INVALID');
  let placed = { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  const doc = canvas.ownerDocument;
  const overlay = doc.createElement('canvas');
  overlay.className = 'egret-world3d-overlay';
  overlay.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;touch-action:none;background:transparent';
  canvas.parentElement.appendChild(overlay);
  // The overlay follows the 3D canvas's box, wherever the page lays it out.
  const place = (): void => {
    const parent = canvas.parentElement!.getBoundingClientRect(),
      box = canvas.getBoundingClientRect();
    let width = box.width,
      height = box.height;
    if (fit !== 'stretch' && width > 0 && height > 0) {
      const wide = width / options.width,
        tall = height / options.height,
        scale = fit === 'contain' ? Math.min(wide, tall) : Math.max(wide, tall);
      width = options.width * scale;
      height = options.height * scale;
    }
    const x = (box.width - width) / 2,
      y = (box.height - height) / 2;
    placed = Object.freeze({ x, y, width, height, scale: width / options.width });
    overlay.style.left = `${box.left - parent.left + canvas.parentElement!.scrollLeft + x}px`;
    overlay.style.top = `${box.top - parent.top + canvas.parentElement!.scrollTop + y}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
  };
  place();
  const Resize = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const observer = Resize ? new Resize(place) : undefined;
  observer?.observe(canvas);
  const win = doc.defaultView ?? (globalThis as unknown as Window);
  win.addEventListener('resize', place);

  let game: BrowserGame;
  try {
    game = await createBrowserGame({
      canvas: overlay,
      width: options.width,
      height: options.height,
      backend: options.backend ?? 'webgl2',
      clearColor: 0,
      clearAlpha: 0,
      effects: true,
      ...(options.blendSpace === undefined ? {} : { blendSpace: options.blendSpace }),
      ...(options.pixelRatio === undefined ? {} : { pixelRatio: options.pixelRatio }),
      ...(options.update ? { update: options.update } : {}),
      ...(options.onError ? { onError: options.onError } : {})
    });
  } catch (cause) {
    observer?.disconnect();
    win.removeEventListener('resize', place);
    overlay.remove();
    throw cause;
  }

  // Pointers that started on an empty part of the interface belong to the 3D canvas until they lift.
  const passing = new Set<number>();
  let pendingClick: { id: number; x: number; y: number } | undefined;
  const empty = (event: MouseEvent): boolean => {
    const box = overlay.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) return true;
    const x = ((event.clientX - box.left) / box.width) * options.width,
      y = ((event.clientY - box.top) / box.height) * options.height;
    try {
      return game.stage.hitTest(x, y) === undefined;
    } catch {
      return true;
    }
  };
  const forward = (event: Event): void => {
    if (options.passThrough === false || event.target !== overlay) return;
    const pointer = event as PointerEvent;
    const id = typeof pointer.pointerId === 'number' ? pointer.pointerId : -1;
    let send: boolean;
    if (event.type === 'pointerdown') {
      if (pointer.isPrimary) pendingClick = undefined;
      send = empty(pointer);
      if (send) passing.add(id);
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      send = passing.delete(id);
      if (pointer.isPrimary) {
        // Native click is separate from the pointer pair. A drag out of UI cannot acquire scene click ownership.
        pendingClick =
          send && event.isTrusted && event.type === 'pointerup' && pointer.button === 0 && empty(pointer)
            ? { id, x: pointer.clientX, y: pointer.clientY }
            : undefined;
      }
    } else if (event.type === 'click') {
      const claimed = pendingClick;
      if (event.isTrusted) pendingClick = undefined;
      // Older browsers can report a trusted click as MouseEvent without an identifier.
      send =
        event.isTrusted &&
        pointer.detail > 0 &&
        claimed !== undefined &&
        (id === claimed.id ||
          (id === -1 && Math.abs(pointer.clientX - claimed.x) <= 1 && Math.abs(pointer.clientY - claimed.y) <= 1));
    } else if (event.type === 'pointermove') {
      // A drag that began on the scene stays with it; a hover goes where the interface is empty.
      send = passing.has(id) || (pointer.buttons === 0 && empty(pointer));
    } else send = empty(pointer);
    if (!send) return;
    event.stopImmediatePropagation();
    if (event.type !== 'pointermove' || passing.has(id)) event.preventDefault();
    const Kind = (event.constructor as typeof Event) ?? Event;
    const copy = new (Kind as unknown as new (type: string, init: object) => Event)(event.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: pointer.detail,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      screenX: pointer.screenX,
      screenY: pointer.screenY,
      button: pointer.button,
      buttons: pointer.buttons,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType,
      isPrimary: pointer.isPrimary,
      pressure: pointer.pressure,
      ctrlKey: pointer.ctrlKey,
      shiftKey: pointer.shiftKey,
      altKey: pointer.altKey,
      metaKey: pointer.metaKey,
      deltaX: (event as WheelEvent).deltaX,
      deltaY: (event as WheelEvent).deltaY,
      deltaMode: (event as WheelEvent).deltaMode
    });
    canvas.dispatchEvent(copy);
  };
  // Capturing on the window runs before the 2D game's own listeners on the overlay.
  for (const type of FORWARDED) win.addEventListener(type, forward, { capture: true, passive: false });

  return {
    game,
    canvas: overlay,
    get box() {
      return placed;
    },
    async dispose(): Promise<void> {
      for (const type of FORWARDED) win.removeEventListener(type, forward, { capture: true });
      observer?.disconnect();
      win.removeEventListener('resize', place);
      await game.dispose();
      overlay.remove();
    }
  };
}
