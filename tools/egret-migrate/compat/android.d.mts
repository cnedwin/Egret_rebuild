// SPDX-License-Identifier: Apache-2.0
import type { PlayerGame, PlayerServices } from '@egret/android-player-project';

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
  readonly sheets?: readonly Readonly<Record<string, unknown>>[];
  readonly moviePages?: readonly Readonly<Record<string, unknown>>[];
  readonly nativeBones?: boolean;
  readonly onError?: (error: unknown) => void;
}
export function openLegacyAndroid(services: PlayerServices, options: LegacyAndroidOptions): Promise<PlayerGame>;
