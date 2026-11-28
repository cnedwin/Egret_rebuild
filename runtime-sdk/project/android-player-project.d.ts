// SPDX-License-Identifier: Apache-2.0
// Include this file in the game's tsconfig. The Android exporter supplies this module at bundle time.
declare module '@egret/android-player-project' {
  import type { AssetLease, CancellationSignal, Engine, ImageData2D, Scope, Texture } from '@egret/engine';
  import type { SaveStorage } from '@egret/engine/kit';

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
    readonly fontFamily?: string;
    readonly italic?: boolean;
  }

  export interface PlayerPaintedRun extends PlayerTextRun {
    readonly x: number;
    /** Top of the run's ascent box in texture pixels. */
    readonly y: number;
    readonly maxWidth: number;
    /** A six-digit RGB color such as #fff0c9. */
    readonly color: string;
    /** Outline radius in texture pixels. Zero draws only the fill. */
    readonly strokeWidth?: number;
    readonly strokeColor?: string;
  }

  export interface PlayerRaster {
    loadPng(path: string, width: number, height: number, signal?: Pick<AbortSignal, 'aborted' | 'reason'>): Promise<ImageData2D>;
    measureText(runs: readonly PlayerTextRun[]): readonly number[];
    measureTextInk(runs: readonly PlayerTextRun[]): readonly Readonly<{
      width: number; ascent: number; descent: number; left: number; top: number; right: number; bottom: number;
    }>[];
    graphemes(text: string): readonly string[];
    drawText(width: number, height: number, runs: readonly PlayerPaintedRun[]): ImageData2D;
    /** Equal text pages share one published texture until the final lease is released. */
    acquireText(width: number, height: number, runs: readonly PlayerPaintedRun[]): Promise<AssetLease<Texture>>;
    textPageUsage(): Readonly<{
      occupied: number; bytes: number; hits: number; rasterizations: number; releases: number; refusals: number;
      maxSlots: number; maxBytes: number;
    }>;
  }

  export interface PlayerChunkReader extends AsyncIterableIterator<Uint8Array> {
    /** Release a reader early, including a pull that is still pending. */
    return(value?: unknown): Promise<IteratorReturnResult<unknown>>;
    [Symbol.asyncIterator](): PlayerChunkReader;
  }

  export interface PlayerAssets {
    /** Read a UTF-8 file listed in project.json assets. A closed view cancels all outstanding reads. */
    readText(path: string, signal?: CancellationSignal): Promise<string>;
    /** Read the exact packaged bytes into a new mutable array, up to 256 KiB per file. */
    readBytes(path: string, signal?: CancellationSignal): Promise<Uint8Array>;
    /** Pull owned blocks of at most 64 KiB from one listed file. Break or return releases the native reader. */
    readChunks(path: string, signal?: CancellationSignal): PlayerChunkReader;
  }

  export interface PlayerServices {
    /** Native renderer support reported by the installed player archive. */
    readonly capabilities: { readonly subtreeEffects: boolean };
    readonly assets: PlayerAssets;
    /** Calls a named Activity provider with JSON. Closing the project cancels pending requests. */
    readonly host: { call(action: string, value: unknown, signal?: AbortSignal): Promise<unknown> };
    readonly engine: Engine;
    /** App-private saves for this game. Writes return after commit. Older hosts throw on use. */
    readonly storage: SaveStorage;
    readonly raster?: PlayerRaster;
    readonly scope: Scope;
    readonly signal: AbortSignal;
    publishPage(id: number, image: ImageData2D): { release(): boolean };
    readonly music: {
      play(path: string, options?: {loop?: boolean; signal?: AbortSignal}): Promise<boolean>;
      stop(): Promise<boolean>;
    };
    /** Claim the next system Back once. A newer overlay resolves the previous wait with false. */
    waitForBack(signal?: AbortSignal): Promise<boolean>;
    edit(text: string): void;
    editText(options?: {text?: string; multiline?: boolean; inputMode?: 'text' | 'tel'; maxLength?: number;
      digitsOnly?: boolean; onFocus?: () => void; onChange?: (value: string) => void}, signal?: AbortSignal): Promise<
      {status: 'confirmed'; text: string} | {status: 'canceled'}>;
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
    /** The host may acknowledge its last completed draw. Omitting the epoch produces a replayable full frame. */
    frame(elapsedMs: number, epoch?: number, previousFrameId?: number): Uint8Array;
    hostResult(id: number, ok: boolean): void;
    textResult(id: number, errorName: string): void;
  }

  export interface NativePlayer {
    /** Absent on player archives released before EGR6. */
    projectFrameVersion?(): number;
    /** Replies are retrieved once by request ID. */
    hostStart?(id: number, action: string, json: string): boolean;
    hostCancel?(id: number): void;
    hostTake?(id: number): string | null;
    /** A synchronous JSON reply containing either {value: string | null} or {error: string}. */
    saveRead?(key: string): string;
    /** True acknowledges a completed write or removal in this project's namespace. */
    saveWrite?(key: string, value: string): boolean;
    saveRemove?(key: string): boolean;
    readText?(id: number, path: string): boolean;
    /** Shares cancellation, completion and single-use result retrieval with readText. */
    readBytes?(id: number, path: string): boolean;
    /** Open a lazy stream and request its first block. Later pulls reuse its request ID. */
    openChunks?(id: number, path: string): boolean;
    nextChunk?(id: number): boolean;
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

declare module '@egret/android-player-world3d' {
  import type {Camera3D, Scene3D, GltfAsset3D} from '@egret/engine/world3d';
  import type {NativePlayerSession, PlayerDefinition, PlayerGame, PlayerServices} from '@egret/android-player-project';

  export interface World3DPlayerGame extends PlayerGame {
    /** Return the live scene and camera after the game advances. The existing stage supplies the 2D overlay. */
    world3D(): {
      readonly scene: Scene3D;
      readonly camera: Camera3D;
      /** Opt into a single directional shadow tile, 64–2048 texels per side (power of two). */
      readonly shadows?: { readonly mapSize: number };
    };
  }

  export interface World3DPlayerServices extends PlayerServices {
    /** Load a declared binary glTF with embedded JPEG or PNG images. The scope retires its pages and meshes. */
    loadGlb(path: string, options: {
      readonly firstPage: number;
      readonly signal?: AbortSignal;
      /** Cumulative container bytes copied and total size from the GLB header, before decoding. */
      readonly onProgress?: (bytesRead: number, totalBytes: number) => void;
    }): Promise<GltfAsset3D>;
  }

  export interface World3DPlayerDefinition extends Omit<PlayerDefinition, 'create'> {
    create(services: World3DPlayerServices): World3DPlayerGame | Promise<World3DPlayerGame>;
  }

  export interface NativeWorld3DPlayerSession extends NativePlayerSession {
    /** Reissue the last rejected delta as a complete packet for the same device epoch and game tick. */
    recoverWorldFrame(epoch: number, frameId: number): Uint8Array;
  }

  /** Install a trusted game using the opaque Standard-material GLES3 profile. */
  export function installWorld3DPlayerProject(definition: World3DPlayerDefinition): NativeWorld3DPlayerSession;
}

/** Embedded Android V8 only. Groups are ordered classic scripts from project.json.v8Scripts. */
declare var EgretRuntimeScripts: {
  /** Concurrent requests share one result. Open a new view to retry partly executed code. */
  loadGroup(name: string): Promise<void>;
} | undefined;
