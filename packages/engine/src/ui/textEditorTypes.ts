// SPDX-License-Identifier: Apache-2.0
import type { Scope } from '@egret/runtime';
import type { TextEditSelection, TextEditSnapshot } from '@egret/runtime/ui/editing';
import type { ParagraphCache, ParagraphTextGeometry } from '@egret/runtime/paragraph';
import type { Engine } from '../Engine.js';
import type { UiLeafContent, UiLeafPrepareContext, RowBinding, UiRoot } from './types.js';

/** How a text editor's text looks: its fonts and size, line height, locale and direction, colors and alignment. */
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
/** Fonts for an editor as a font provider gives them, such as a set of `createBrowserEditorFontProvider`. */
export interface UiTextEditorFontSet {
  /** The key of the paragraph font set. */
  readonly key: string;
  readonly fontFamilies: readonly string[];
}
/**
 * A style to give an editor: as its style, but `fontSet` may be the font set itself, whose key is taken, and whose
 * families are taken unless `fontFamilies` is given. With a key alone, `fontFamilies` is needed.
 */
export interface UiTextEditorStyleInput extends Omit<UiTextEditorStyle, 'fontSet' | 'fontFamilies'> {
  readonly fontSet: string | UiTextEditorFontSet;
  readonly fontFamilies?: readonly string[];
}
/** A change to a text editor's content or selection, and what made it. */
export interface UiTextEditorChange {
  readonly kind: 'value' | 'style';
  readonly source: 'native' | 'programmatic';
  readonly revision: number;
  readonly contentRevision: number;
  readonly value: string;
  readonly selection: Required<TextEditSelection>;
}
/** A text editor to make: its engine, scope and cache, its mode, value and limits, its style and size, and what it calls. */
export interface UiTextEditorOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly cache: ParagraphCache;
  readonly mode: 'single-line' | 'multiline';
  readonly value?: string;
  readonly selection?: TextEditSelection;
  readonly maxLength?: number;
  readonly style: UiTextEditorStyleInput;
  readonly padding?: number;
  /** Minimum inner content height, independent from natural paragraph metrics. */
  readonly minHeight?: number;
  /** Readonly display limit; the native control still edits the complete source. */
  readonly visibleLines?: number;
  /** Stage a new existing UI tree/source revision; never run another frame loop. */
  readonly onChange?: (change: UiTextEditorChange) => void;
}
/** What a text editor is drawn in: a leaf of the tree, or a row of a list. */
export type UiTextEditorTarget =
  | Readonly<{ kind: 'leaf'; id: string }>
  | Readonly<{ kind: 'row'; listId: string; key: string }>;
/** A text editor as it is now: its content revision, style, and whether the native editor shows. */
export interface UiTextEditorSnapshot extends Omit<TextEditSnapshot, 'session'> {
  readonly contentRevision: number;
  readonly style: UiTextEditorStyle;
  readonly nativeVisible: boolean;
  readonly livePresentations: number;
}
/** How a value is set: the selection after it, the revision it expects, and whether a composition is cancelled. */
export interface UiTextEditorSetOptions {
  readonly selection?: TextEditSelection;
  readonly expectedRevision?: number;
  readonly cancelComposition?: boolean;
}
declare const editorBrand: unique symbol;
/** A text editor: its content, the calls that set its value, selection and style, and the geometry of its text. */
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
  setStyle(style: UiTextEditorStyleInput): void;
  /** This is the actual committed readonly source geometry, possibly preceding pending text. */
  getTextGeometry(root: UiRoot, target: UiTextEditorTarget): ParagraphTextGeometry | undefined;
  dispose(): void;
}
export type { TextEditSelection } from '@egret/runtime/ui/editing';
