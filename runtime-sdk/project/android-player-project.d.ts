// SPDX-License-Identifier: Apache-2.0
// Include this file in the game's tsconfig. The Android exporter supplies this module at bundle time.
declare module '@egret/android-player-project' {
  import type { Engine, ImageData2D, Scope } from '@egret/engine';

  export interface PlayerInput {
    readonly type: 'down' | 'move' | 'up' | 'cancel' | 'scroll' | 'text' | 'submit';
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly dx: number;
    readonly dy: number;
    readonly text?: string;
  }

  export interface PlayerServices {
    readonly engine: Engine;
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

  export interface NativePlayer {
    page(id: number, width: number, height: number, rgbaBase64: string): void;
    releasePage(id: number): void;
    edit(initialText: string): void;
    state(json: string): void;
    playSound(assetPath: string): void;
  }

  export function createPlayerProject(definition: PlayerDefinition, native: NativePlayer): PlayerSession;
  export function installPlayerProject(definition: PlayerDefinition): PlayerSession;
}
