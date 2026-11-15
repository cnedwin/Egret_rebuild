import type { Scope } from '@egret/runtime';
import type { FontContentLoader } from '@egret/engine/resources';
import type { Engine } from '@egret/engine';
import type { ParagraphFontSet } from './CanvasKitFontSetProvider.js';
export interface EditorParagraphFontLoader {
    load(scope: Scope, loader: FontContentLoader, roots: readonly string[]): Promise<ParagraphFontSet>;
}
export interface BrowserEditorFontProviderOptions {
    readonly engine: Engine;
    readonly scope: Scope;
    readonly paragraphProvider: EditorParagraphFontLoader;
    readonly deadlineMs?: number;
}
declare const fontSetBrand: unique symbol;
export interface BrowserEditorFontSet {
    readonly [fontSetBrand]: true;
    /** The same key is consumed by the existing paragraph provider. */
    readonly key: string;
    readonly fontFamilies: readonly string[];
    readonly identities: readonly string[];
    readonly isDisposed: boolean;
    readonly closed: Promise<void>;
    dispose(): void;
}
export interface BrowserEditorFontProvider {
    load(scope: Scope, loader: FontContentLoader, roots: readonly string[]): Promise<BrowserEditorFontSet>;
    getStatus(): Readonly<{
        closed: boolean;
        sets: number;
        fontBytes: number;
        pendingJobs: number;
        editorLeases: number;
    }>;
    /** Retire new demand; actual registration/source cleanup waits for native loads and editor leases. */
    close(): Promise<void>;
}
export interface EditorFontLease {
    readonly key: string;
    readonly document: Document;
    readonly isDisposed: boolean;
    families(names: readonly string[]): string;
    release(): void;
}
/** Private host admission: CSS aliases are never caller-provided or inferred from a family name. */
export declare function borrowEditorFonts(set: BrowserEditorFontSet, engine: object, retired: () => void): EditorFontLease;
export declare function assertEditorFonts(set: BrowserEditorFontSet, engine: object): void;
/** CSS registration is a consumer of existing immutable font resources, not another asset cache. */
export declare function createBrowserEditorFontProvider(options: BrowserEditorFontProviderOptions): BrowserEditorFontProvider;
export {};
//# sourceMappingURL=editorFonts.d.ts.map