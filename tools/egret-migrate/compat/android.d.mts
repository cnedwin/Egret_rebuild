// SPDX-License-Identifier: Apache-2.0
import type { PlayerGame, PlayerServices } from '@egret/android-player-project';
import type { LegacyThemeHost } from './theme-factories.mjs';

export interface LegacyAndroidOptions {
  readonly projectId: string;
  readonly width: number;
  readonly height: number;
  readonly scriptGroup: string;
  readonly entry: string;
  readonly images?: readonly { readonly url: string; readonly width: number; readonly height: number; readonly page: number }[];
  readonly resources?: {
    readonly configUrl: string; readonly root: string;
    readonly resources: readonly { readonly name: string; readonly type: 'image' | 'json'; readonly url: string }[];
    readonly groups: readonly { readonly name: string; readonly keys: readonly string[] }[];
  };
  /** The compiled EXML theme, sheet and repaged atlas descriptors from the conversion, if present. */
  readonly theme?: Readonly<Record<string, unknown>>;
  /** Called with the installed EUI host before loading the business group or constructing the entry. */
  readonly prepareTheme?: (api: { readonly eui: LegacyThemeHost; readonly egret: object; readonly RES: object }) => void | Promise<void>;
  readonly sheets?: readonly Readonly<Record<string, unknown>>[];
  readonly moviePages?: readonly Readonly<Record<string, unknown>>[];
  readonly nativeBones?: boolean;
  readonly onError?: (error: unknown) => void;
}
/** One classic game owns one V8 player view. To restart the whole game, create another view with the same storage identity. */
export function openLegacyAndroid(services: PlayerServices, options: LegacyAndroidOptions): Promise<PlayerGame>;
