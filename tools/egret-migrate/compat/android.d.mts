// SPDX-License-Identifier: Apache-2.0
import type { PlayerGame, PlayerServices } from '@egret/android-player-project';
import type { LegacyThemeHost } from './theme-factories.mjs';

/** Structural so an offline game can type-check without installing the optional network provider. */
export interface LegacyAndroidNetwork {
  request(
    url: string,
    options?: { method?: 'GET' | 'POST'; bytes?: Uint8Array; contentType?: string; signal?: AbortSignal }
  ): Promise<{ status: number; bytes: Uint8Array }>;
  connect(url: string, signal?: AbortSignal): Promise<{
    send(bytes: Uint8Array, signal?: AbortSignal): Promise<unknown>;
    receive(signal?: AbortSignal): Promise<{ done: true; code: number } | { done: false; bytes: Uint8Array }>;
    close(): Promise<unknown>;
  }>;
}

export interface LegacyAndroidOptions {
  readonly projectId: string;
  readonly width: number;
  readonly height: number;
  readonly scriptGroup: string;
  /** Inject createPlayerNetwork(services.host) after enabling the bounded network provider in the APK. */
  readonly network?: LegacyAndroidNetwork;
  /** Project-owned outbound SDK names mapped to registered handlers and optional legacy reply callbacks. */
  readonly channelActions?: Readonly<Record<string, { readonly action: string; readonly callback?: string }>>;
  readonly entry: string;
  readonly images?: readonly { readonly url: string; readonly width: number; readonly height: number; readonly page: number }[];
  readonly resources?: {
    readonly configUrl: string; readonly root: string;
    readonly resources: readonly { readonly name: string; readonly type: 'image' | 'json' | 'text' | 'bin'; readonly url: string }[];
    readonly groups: readonly { readonly name: string; readonly keys: readonly string[] }[];
  };
  /** The compiled EXML theme, sheet and repaged atlas descriptors from the conversion, if present. */
  readonly theme?: Readonly<Record<string, unknown>>;
  /** Called with the installed EUI host before loading the business group or constructing the entry. */
  readonly prepareTheme?: (api: { readonly eui: LegacyThemeHost; readonly egret: object; readonly RES: object }) => void | Promise<void>;
  readonly sheets?: readonly Readonly<Record<string, unknown>>[];
  readonly moviePages?: readonly Readonly<Record<string, unknown>>[];
  readonly nativeBones?: boolean;
  readonly projectMethods?: readonly { readonly namespace: 'egret'|'eui'|'RES'|'dragonBones'; readonly name: string }[];
  /** Add project-owned operations to admitted namespaces before the first business script runs. */
  readonly provideBindings?: (base: Readonly<Record<'egret'|'eui'|'RES'|'dragonBones', object | undefined>>, scope: import('@egret/engine').Scope) => Partial<Record<'egret'|'eui'|'RES'|'dragonBones', Readonly<Record<string, unknown>>>>;
  readonly logger?: { log(...args: unknown[]): void; warn(...args: unknown[]): void; error(...args: unknown[]): void };
  /** Keep the last 32 formatted messages in the local close receipt. Default records counts only. */
  readonly captureLogs?: boolean;
  readonly onError?: (error: unknown) => void;
}
/** One classic game owns one V8 player view. To restart the whole game, create another view with the same storage identity. */
export function openLegacyAndroid(services: PlayerServices, options: LegacyAndroidOptions): Promise<PlayerGame>;
