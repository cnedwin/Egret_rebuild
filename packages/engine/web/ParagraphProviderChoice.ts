// SPDX-License-Identifier: Apache-2.0
// Picks the paragraph provider a device can afford: CanvasKit where WebAssembly runs and there is memory for it, the
// canvas provider elsewhere. A WeChat mini game has no WebAssembly global (WXWebAssembly stands in its place, for a
// package that ships its own compressed module), so it is given the canvas provider unless CanvasKit is asked for.
import { EgretError } from '@egret/runtime';
import {
  createCanvasKitParagraphProvider,
  type CanvasKitParagraphProvider,
  type CanvasKitParagraphProviderOptions
} from './CanvasKitParagraphProvider.js';
import {
  createCanvasParagraphProvider,
  type CanvasParagraphProvider,
  type CanvasParagraphProviderOptions
} from './CanvasParagraphProvider.js';

/** The two paragraph providers of `@egret/engine/web/paragraph`. */
export type ParagraphBackend = 'canvaskit' | 'canvas';

/**
 * Why a provider was chosen. `asked`: the caller named it. `no-loader`: no way to load CanvasKit was given.
 * `no-webassembly`, `mini-game`, `low-memory`: the device was judged unable to afford CanvasKit. `loaded`: CanvasKit
 * loaded. `load-failed`: loading or starting CanvasKit failed, and the canvas provider took its place.
 */
export type ParagraphBackendReason =
  | 'asked'
  | 'no-loader'
  | 'no-webassembly'
  | 'mini-game'
  | 'low-memory'
  | 'loaded'
  | 'load-failed';

/** What the choice reads of the device. Each field left out is read from the global object. */
export interface ParagraphDevice {
  /** Whether a `WebAssembly` global with `instantiate` exists. */
  readonly webAssembly?: boolean;
  /** Whether the code runs in a WeChat mini game: a `wx` global with `getSystemInfoSync`. */
  readonly miniGame?: boolean;
  /** `navigator.deviceMemory`, in gigabytes, where the browser gives it. */
  readonly deviceMemory?: number;
}

/** How to choose: which provider is wanted, how to load CanvasKit, and the canvas provider's options. */
export interface ParagraphProviderChoiceOptions {
  /** Which provider to use: CanvasKit, the canvas, or (the default) whichever the device can afford. */
  readonly prefer?: 'auto' | ParagraphBackend;
  /**
   * Loads CanvasKit and the font bytes, and returns the options of `createCanvasKitParagraphProvider`. Called only
   * when CanvasKit is chosen, so a device given the canvas provider downloads neither the module nor the fonts.
   */
  readonly loadCanvasKit?: () => Promise<CanvasKitParagraphProviderOptions>;
  /** Options of `createCanvasParagraphProvider`, used when the canvas provider is chosen. */
  readonly canvas?: CanvasParagraphProviderOptions;
  /** At or below this many gigabytes of device memory the canvas provider is chosen. 2 when not given. */
  readonly lowMemory?: number;
  /** What is known of the device, in place of what the global object says. */
  readonly device?: ParagraphDevice;
}

/** The provider chosen, which of the two it is, and why. */
export interface ParagraphProviderChoice {
  readonly backend: ParagraphBackend;
  readonly reason: ParagraphBackendReason;
  readonly provider: CanvasKitParagraphProvider | CanvasParagraphProvider;
  /** For `load-failed`, what loading or starting CanvasKit threw. */
  readonly cause?: unknown;
}

function read(device: ParagraphDevice | undefined): Required<Pick<ParagraphDevice, 'webAssembly' | 'miniGame'>> & {
  readonly deviceMemory: number | undefined;
} {
  const global = globalThis as {
    readonly WebAssembly?: { readonly instantiate?: unknown };
    readonly wx?: { readonly getSystemInfoSync?: unknown };
    readonly navigator?: { readonly deviceMemory?: unknown };
  };
  const memory = device?.deviceMemory ?? global.navigator?.deviceMemory;
  return {
    webAssembly:
      device?.webAssembly ??
      (typeof global.WebAssembly === 'object' && typeof global.WebAssembly?.instantiate === 'function'),
    miniGame: device?.miniGame ?? (typeof global.wx === 'object' && typeof global.wx?.getSystemInfoSync === 'function'),
    deviceMemory: typeof memory === 'number' && Number.isFinite(memory) && memory > 0 ? memory : undefined
  };
}

/**
 * Creates the paragraph provider the device can afford. Both providers take the same requests and give the same
 * metrics and geometry; the canvas provider needs no WebAssembly, refuses right-to-left text, and lays out with the
 * fonts the page or the mini game has registered.
 */
export async function chooseParagraphProvider(
  options: ParagraphProviderChoiceOptions = {}
): Promise<ParagraphProviderChoice> {
  if (options === null || typeof options !== 'object') throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const prefer = options.prefer ?? 'auto';
  if (prefer !== 'auto' && prefer !== 'canvaskit' && prefer !== 'canvas')
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  if (options.loadCanvasKit !== undefined && typeof options.loadCanvasKit !== 'function')
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const lowMemory = options.lowMemory ?? 2;
  if (typeof lowMemory !== 'number' || !Number.isFinite(lowMemory) || lowMemory < 0)
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const canvas = (reason: ParagraphBackendReason, cause?: unknown): ParagraphProviderChoice =>
    Object.freeze({
      backend: 'canvas' as const,
      reason,
      provider: createCanvasParagraphProvider(options.canvas),
      ...(cause === undefined ? {} : { cause })
    });
  const canvasKit = async (): Promise<ParagraphProviderChoice> => {
    const loaded = await options.loadCanvasKit!();
    return Object.freeze({
      backend: 'canvaskit' as const,
      reason: prefer === 'canvaskit' ? ('asked' as const) : ('loaded' as const),
      provider: createCanvasKitParagraphProvider(loaded)
    });
  };
  if (prefer === 'canvas') return canvas('asked');
  if (options.loadCanvasKit === undefined) {
    if (prefer === 'canvaskit')
      throw new EgretError('PARAGRAPH_REQUEST_INVALID', { cause: 'CanvasKit was asked for with no loadCanvasKit' });
    return canvas('no-loader');
  }
  if (prefer === 'canvaskit') return canvasKit();
  const device = read(options.device);
  if (!device.webAssembly) return canvas('no-webassembly');
  if (device.miniGame) return canvas('mini-game');
  if (device.deviceMemory !== undefined && device.deviceMemory <= lowMemory) return canvas('low-memory');
  try {
    return await canvasKit();
  } catch (cause) {
    return canvas('load-failed', cause);
  }
}
