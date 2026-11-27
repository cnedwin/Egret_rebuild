// SPDX-License-Identifier: Apache-2.0
declare module '@egret/android-original5' {
  import type { PlayerServices, PlayerGame, NativePlayerSession } from '@egret/android-player-project';
  export interface Original5Options {
    width: number;
    height: number;
    entryClass: string;
    frameRate?: number;
    clearColor?: number;
    /** Each group contains unchanged classic scripts in their original manifest order. */
    coreGroup?: string;
    moduleGroup?: string | null;
    gameGroup?: string;
    images?: readonly {path: string; width: number; height: number}[];
    /** The application supplies its approved transport for HTTPS; local RES reads use the game manifest. */
    remoteRequest?(request: {url:string; method:string; headers:Record<string,string>; body:unknown;
      responseType:'text'|'arraybuffer'; signal:AbortSignal}): Promise<string | ArrayBuffer>;
    /** Register the project's native channel and plugin bindings before EUI, RES and business scripts execute. */
    installHost?(context:{egret:unknown; services:PlayerServices; defineGlobal(name:string,value:unknown):void}):void | Promise<void>;
    onReady?(context:{egret:unknown; stage:unknown; root:unknown; services:PlayerServices}): void | Promise<void>;
  }
  export function openOriginal5Project(services: PlayerServices, options: Original5Options): Promise<PlayerGame>;
  export function installOriginal5Project(options: Original5Options): NativePlayerSession;
}
