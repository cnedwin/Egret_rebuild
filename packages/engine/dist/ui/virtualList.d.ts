import type { UiHeightView } from '@egret/runtime/ui';
import type { VirtualDataSource, VirtualRecord, VirtualListRevealOptions } from './types.js';
export interface CapturedSource {
    readonly identity: object;
    readonly revision: number;
    readonly records: readonly VirtualRecord<unknown>[];
    readonly byKey: ReadonlyMap<string, VirtualRecord<unknown>>;
    readonly bind: VirtualDataSource<unknown>['bind'];
    readonly unbind: VirtualDataSource<unknown>['unbind'];
}
export declare function captureSource(source: VirtualDataSource<unknown>): CapturedSource;
export interface RevealIntent {
    readonly key: string;
    readonly align: NonNullable<VirtualListRevealOptions['align']>;
}
/** Capture caller-controlled options before the owner mutates any pending intent. */
export declare function captureReveal(key: string | undefined, options?: VirtualListRevealOptions): RevealIntent | undefined;
/** Resolve against each staged height view, without a second index or hidden row retention. */
export declare function revealScroll(view: UiHeightView, intent: RevealIntent, current: number, height: number): number;
//# sourceMappingURL=virtualList.d.ts.map