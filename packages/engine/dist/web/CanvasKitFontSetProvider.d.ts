import type { Scope } from '@egret/runtime';
import type { FontContentLoader } from '@egret/engine/resources';
import type { ParagraphProvider } from '@egret/engine/paragraph';
import type { CanvasKitParagraphModule } from './CanvasKitParagraphProvider.js';
export interface ParagraphFontSet {
    readonly key: string;
    readonly fontFamilies: readonly string[];
    readonly isDisposed: boolean;
    /** Retires new demand immediately; native cleanup waits for in-flight shaping. */
    dispose(): void;
    readonly closed: Promise<void>;
}
export interface CanvasKitFontSetProvider extends ParagraphProvider {
    load(scope: Scope, loader: FontContentLoader, roots: readonly string[]): Promise<ParagraphFontSet>;
    getStatus(): Readonly<{
        closed: boolean;
        sets: number;
        fontBytes: number;
        pendingJobs: number;
    }>;
    close(): Promise<void>;
}
export interface CanvasKitFontSetProviderOptions {
    readonly canvasKit: CanvasKitParagraphModule;
    readonly buildIdentity?: string;
}
/** A stable cache provider routes immutable generations; it never mutates a live native font table. */
export declare function createCanvasKitFontSetProvider(options: CanvasKitFontSetProviderOptions): CanvasKitFontSetProvider;
//# sourceMappingURL=CanvasKitFontSetProvider.d.ts.map