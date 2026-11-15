import type { KeyboardInput } from '@egret/engine/web/keyboard';
import type { UiRoot } from '@egret/engine/ui';
import type { UiTextEditor, UiTextEditorTarget } from '@egret/engine/ui/editing';
import type { BrowserEditorFontSet } from './editorFonts.js';
export interface BrowserTextEditorOptions {
    readonly editor: UiTextEditor;
    readonly root: UiRoot;
    readonly target: UiTextEditorTarget;
    readonly canvas: HTMLCanvasElement;
    readonly fonts: BrowserEditorFontSet;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly label: string;
    readonly keyboard?: KeyboardInput;
    readonly zIndex?: number;
    readonly onError?: (cause: unknown) => void;
    /** Schedule the application's existing frame path when native/canvas visibility changes. */
    readonly onInvalidate?: () => void;
}
export interface BrowserTextEditorSnapshot {
    readonly state: 'inactive' | 'editing' | 'composing' | 'settling' | 'closed';
    readonly interactive: boolean;
    readonly contentRevision: number;
    readonly layoutRevision: number;
    readonly nativeElement: boolean;
    readonly fontKey: string;
}
export interface BrowserTextEditor {
    /** Logical scene point uses the committed paragraph hit result, not character widths. */
    activate(point?: Readonly<{
        x: number;
        y: number;
    }>): void;
    finish(): void;
    cancel(): void;
    /** Call after every UI commit and before rendering the corresponding shared frame. */
    sync(viewport?: Readonly<{
        width: number;
        height: number;
    }>): void;
    setFontSet(fonts: BrowserEditorFontSet): void;
    /** Modal/surface owners suspend this adapter explicitly; resume never fabricates focus. */
    setInteractive(value: boolean): void;
    snapshot(): BrowserTextEditorSnapshot;
    dispose(): void;
}
/** One visible native editor over an authenticated committed UI binding. Importing performs no host work. */
export declare function createBrowserTextEditor(options: BrowserTextEditorOptions): BrowserTextEditor;
//# sourceMappingURL=BrowserTextEditor.d.ts.map