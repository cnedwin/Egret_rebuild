// SPDX-License-Identifier: Apache-2.0
// Include this file in the game's tsconfig. The Android exporter supplies this module at bundle time.
declare module '@egret/android-player-project' {
  import type { CancellationSignal, Engine, ImageData2D, Scope } from '@egret/engine';

  export interface PlayerInput {
    readonly type: 'down' | 'move' | 'up' | 'cancel' | 'scroll' | 'text' | 'submit';
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly dx: number;
    readonly dy: number;
    readonly text?: string;
  }

  export interface PlayerTextRun {
    readonly text: string;
    /** Font size in texture pixels, 1–256. */
    readonly size: number;
    readonly weight?: number;
  }

  export interface PlayerPaintedRun extends PlayerTextRun {
    readonly x: number;
    /** Top of the run's ascent box in texture pixels. */
    readonly y: number;
    readonly maxWidth: number;
    /** A six-digit RGB color such as #fff0c9. */
    readonly color: string;
  }

  export interface PlayerRaster {
    loadPng(path: string, width: number, height: number, signal?: Pick<AbortSignal, 'aborted' | 'reason'>): Promise<ImageData2D>;
    measureText(runs: readonly PlayerTextRun[]): readonly number[];
    drawText(width: number, height: number, runs: readonly PlayerPaintedRun[]): ImageData2D;
  }

  export interface PlayerAssets {
    /** Read a UTF-8 file listed in project.json assets. A closed view cancels all outstanding reads. */
    readText(path: string, signal?: CancellationSignal): Promise<string>;
  }

  export interface PlayerServices {
    readonly assets: PlayerAssets;
    readonly engine: Engine;
    readonly raster?: PlayerRaster;
    readonly scope: Scope;
    readonly signal: AbortSignal;
    publishPage(id: number, image: ImageData2D): { release(): boolean };
    edit(text: string): void;
    state(value: unknown): void;
    playSound(assetPath: string): void;
  }

  export interface PlayerGame {
    update?(elapsedMs: number): void;
    input?(event: PlayerInput): void;
    pause?(): void;
    resume?(): void;
    close?(): void | Promise<void>;
    closedSnapshot?(): Record<string, unknown>;
  }

  export interface PlayerDefinition {
    readonly width: number;
    readonly height: number;
    readonly clearColor?: number;
    create(services: PlayerServices): PlayerGame | Promise<PlayerGame>;
  }

  export interface PlayerSession {
    start(): Promise<void>;
    frame(elapsedMs: number): Uint8Array;
    input(event: PlayerInput): void;
    pause(): void;
    resume(): void;
    close(): Promise<Record<string, unknown>>;
  }

  /** Native completion channel returned by both project factories. */
  export interface NativePlayerSession extends PlayerSession {
    textResult(id: number, errorName: string): void;
  }

  export interface NativePlayer {
    readText?(id: number, path: string): boolean;
    cancelReadText?(id: number): void;
    takeTextResult?(id: number): string | null;
    raster?(request: string): string;
    page(id: number, width: number, height: number, rgbaBase64: string): void;
    releasePage(id: number): void;
    edit(initialText: string): void;
    state(json: string): void;
    playSound(assetPath: string): void;
  }

  export function createPlayerProject(definition: PlayerDefinition, native: NativePlayer): NativePlayerSession;
  export function installPlayerProject(definition: PlayerDefinition): NativePlayerSession;
}
