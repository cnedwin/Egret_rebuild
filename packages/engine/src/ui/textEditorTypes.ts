// SPDX-License-Identifier: Apache-2.0
import type { Scope } from '@egret/runtime';
import type { TextEditSelection, TextEditSnapshot } from '@egret/runtime/ui/editing';
import type { ParagraphCache, ParagraphTextGeometry } from '@egret/runtime/paragraph';
import type { Engine } from '../Engine.js';
import type { UiLeafContent, UiLeafPrepareContext, RowBinding, UiRoot } from './types.js';

export interface UiTextEditorStyle {
    readonly fontSet: string;
    readonly fontFamilies: readonly string[];
    readonly fontSize: number;
    readonly lineHeight?: number;
    readonly locale: string;
    readonly direction: 'ltr' | 'rtl';
    readonly fillColor: number;
    readonly backgroundColor?: number;
    readonly textAlign?: 'left' | 'right' | 'center' | 'start' | 'end';
}
export interface UiTextEditorChange {
    readonly kind: 'value' | 'style';
    readonly source: 'native' | 'programmatic';
    readonly revision: number;
    readonly contentRevision: number;
    readonly value: string;
    readonly selection: Required<TextEditSelection>;
}
export interface UiTextEditorOptions {
    readonly engine: Engine;
    readonly scope: Scope;
    readonly cache: ParagraphCache;
    readonly mode: 'single-line' | 'multiline';
    readonly value?: string;
    readonly selection?: TextEditSelection;
    readonly maxLength?: number;
    readonly style: UiTextEditorStyle;
    readonly padding?: number;
    /** Minimum inner content height, independent from natural paragraph metrics. */
    readonly minHeight?: number;
    /** Readonly display limit; the native control still edits the complete source. */
    readonly visibleLines?: number;
    /** Stage a new existing UI tree/source revision; never run another frame loop. */
    readonly onChange?: (change: UiTextEditorChange) => void;
}
export type UiTextEditorTarget = Readonly<{ kind: 'leaf'; id: string }> | Readonly<{ kind: 'row'; listId: string; key: string }>;
export interface UiTextEditorSnapshot extends Omit<TextEditSnapshot, 'session'> {
    readonly contentRevision: number;
    readonly style: UiTextEditorStyle;
    readonly nativeVisible: boolean;
    readonly livePresentations: number;
}
export interface UiTextEditorSetOptions {
    readonly selection?: TextEditSelection;
    readonly expectedRevision?: number;
    readonly cancelComposition?: boolean;
}
declare const editorBrand: unique symbol;
export interface UiTextEditor {
    readonly [editorBrand]: true;
    readonly mode: UiTextEditorOptions['mode'];
    readonly maxLength: number;
    readonly content: UiLeafContent;
    /** A virtual source may use the same preparation through its RowBindContext. */
    prepare(context: UiLeafPrepareContext): Promise<RowBinding>;
    snapshot(): UiTextEditorSnapshot;
    setValue(value: string, options?: UiTextEditorSetOptions): void;
    setSelection(selection: TextEditSelection, expectedRevision?: number): void;
    setStyle(style: UiTextEditorStyle): void;
    /** This is the actual committed readonly source geometry, possibly preceding pending text. */
    getTextGeometry(root: UiRoot, target: UiTextEditorTarget): ParagraphTextGeometry | undefined;
    dispose(): void;
}
export type { TextEditSelection } from '@egret/runtime/ui/editing';
