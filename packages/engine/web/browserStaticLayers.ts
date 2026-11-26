// SPDX-License-Identifier: Apache-2.0
// Bind the explicit WebGL2 layer cache to the ordinary Engine host transaction.
// No canvas readback, texture conversion, or replacement display tree.
import { EgretError } from '@egret/runtime';
import type { SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/contracts';
/**
 * Structural public surface of a genuine retained layer. Kept here so the
 * BrowserGame entry does not depend on the optional WebGL2 module/types.
 */
export interface BrowserGameStaticLayer {
  readonly state: 'empty' | 'ready' | 'stale' | 'disposed';
  update(frame: SharedRenderFrame2D): Promise<void>;
  dispose(): void;
}
type RGB = readonly [number, number, number];
export interface BrowserGameStaticLayerEffect {
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly multiply?: RGB;
  readonly add?: RGB;
}
export interface BrowserGameStaticLayerPlacement {
  readonly layer: BrowserGameStaticLayer;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly effect?: BrowserGameStaticLayerEffect;
}
export interface BrowserGameStaticLayerStatus {
  readonly residentBytes: number;
  readonly readyLayers: number;
  readonly pendingLayers: number;
}
interface StaticLayerHost extends SharedRenderHostAdapter {
  start(): Promise<void>;
  stop(): void;
  whenReady(): Promise<void>;
  createSharedLayer2D(): BrowserGameStaticLayer;
  getSharedLayerStatus(): BrowserGameStaticLayerStatus;
  renderSharedFrameWithLayers(
    frame: SharedRenderFrame2D,
    placements: readonly BrowserGameStaticLayerPlacement[]
  ): undefined;
}

export interface BrowserGameStaticLayers {
  /** A genuine WebGL2 layer. Await its first update before placing it. */
  createLayer(): BrowserGameStaticLayer;
  /**
   * Replace the background placements, in stage coordinates and painter order.
   * A successful call, including after a replacement bake, requests a new image.
   */
  setPlacements(placements: readonly BrowserGameStaticLayerPlacement[]): void;
  /** Logical retained target bytes, and ready/pending layer counts. */
  getStatus(): BrowserGameStaticLayerStatus;
  /** Resolves when the Host can accept a rebake after context restoration. */
  whenReady(): Promise<void>;
  /** Changes when placements are explicitly replaced; on-demand Play observes it. */
  readonly revision: number;
}
const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function rgb(
  value: readonly [number, number, number] | undefined,
  max: number
): readonly [number, number, number] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== 3) throw invalid();
  const row = [value[0], value[1], value[2]] as const;
  if (!row.every(v => finite(v) && v >= 0 && v <= max)) throw invalid();
  return Object.freeze(row);
}
function effect(input: BrowserGameStaticLayerEffect | undefined): BrowserGameStaticLayerEffect | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object') throw invalid();
  const { bounds, multiply: scale, add: emission } = input;
  if (!bounds || typeof bounds !== 'object') throw invalid();
  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every(finite) || width <= 0 || height <= 0) throw invalid();
  const multiply = rgb(scale, 4),
    add = rgb(emission, 1);
  return Object.freeze({
    bounds: Object.freeze({ x, y, width, height }),
    ...(multiply === undefined ? {} : { multiply }),
    ...(add === undefined ? {} : { add })
  });
}
/** Keep the original Host's surface, lifecycle and profile; only select its explicit renderer. */
export function createBrowserStaticLayers(host: StaticLayerHost): {
  readonly api: BrowserGameStaticLayers;
  readonly adapter: SharedRenderHostAdapter;
} {
  const owned = new WeakSet<BrowserGameStaticLayer>();
  let placements: readonly BrowserGameStaticLayerPlacement[] = Object.freeze([]),
    revision = 0,
    closed = false,
    setting = false;
  const api: BrowserGameStaticLayers = Object.freeze({
    createLayer() {
      if (closed || setting) throw invalid();
      const layer = host.createSharedLayer2D();
      owned.add(layer);
      return layer;
    },
    setPlacements(input: readonly BrowserGameStaticLayerPlacement[]) {
      if (closed || setting || !Array.isArray(input)) throw invalid();
      setting = true;
      try {
        const next: BrowserGameStaticLayerPlacement[] = [];
        const count = input.length;
        if (!Number.isSafeInteger(count) || count < 0 || count > 512) throw invalid();
        for (let index = 0; index < count; index++) {
          const item = input[index];
          if (!item || typeof item !== 'object') throw invalid();
          const { layer, x, y, width, height } = item,
            light = effect(item.effect);
          if (
            !owned.has(layer) ||
            layer.state !== 'ready' ||
            ![x, y, width, height].every(finite) ||
            width <= 0 ||
            height <= 0
          )
            throw invalid();
          next.push(Object.freeze({ layer, x, y, width, height, ...(light === undefined ? {} : { effect: light }) }));
        }
        // A later input getter may dispose a previous layer or the game.
        if (closed || next.some(row => row.layer.state !== 'ready') || revision === Number.MAX_SAFE_INTEGER)
          throw invalid();
        placements = Object.freeze(next);
        revision++;
      } finally {
        setting = false;
      }
    },
    getStatus: () => host.getSharedLayerStatus(),
    whenReady: () => host.whenReady(),
    get revision() {
      return revision;
    }
  });
  const adapter: SharedRenderHostAdapter = Object.freeze({
    surface: host.surface,
    sharedFrameProfile: host.sharedFrameProfile,
    ...(host.sharedBlendSpace === undefined ? {} : { sharedBlendSpace: host.sharedBlendSpace }),
    start: () => host.start(),
    stop: () => host.stop(),
    close() {
      closed = true;
      placements = Object.freeze([]);
      return host.close();
    },
    setTimeout(callback: () => void, delayMs: number) {
      return host.setTimeout(callback, delayMs);
    },
    renderSharedFrame(frame: SharedRenderFrame2D) {
      // A readable replacement keeps its previous revision; stale/disposed
      // placements are not secretly drawn as transparent substitutes.
      return placements.length === 0
        ? host.renderSharedFrame(frame)
        : host.renderSharedFrameWithLayers(frame, placements);
    }
  });
  return Object.freeze({ api, adapter });
}
