// SPDX-License-Identifier: Apache-2.0
declare module '@egret/android-player-network' {
  import type { PlayerServices } from '@egret/android-player-project';

  export interface PlayerHttpOptions {
    readonly method?: 'GET' | 'POST';
    readonly bytes?: Uint8Array;
    readonly contentType?: string;
    readonly signal?: AbortSignal;
  }

  export interface PlayerSocket {
    send(bytes: Uint8Array, signal?: AbortSignal): Promise<null>;
    receive(signal?: AbortSignal): Promise<
      { readonly done: true; readonly code: number } | { readonly done: false; readonly bytes: Uint8Array }
    >;
    close(): Promise<null>;
  }

  /** Available to applications built with an explicit HTTPS and WSS origin profile. */
  export function createPlayerNetwork(host: PlayerServices['host']): {
    request(url: string, options?: PlayerHttpOptions): Promise<{ readonly status: number; readonly bytes: Uint8Array }>;
    connect(url: string, signal?: AbortSignal): Promise<PlayerSocket>;
  };
}
