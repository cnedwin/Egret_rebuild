// SPDX-License-Identifier: Apache-2.0
/** Source offsets are UTF-16, never glyph indices or guessed advance widths. */
export interface TextEditSelection {
    readonly anchor: number;
    readonly focus: number;
    readonly affinity?: 'upstream' | 'downstream';
}
export interface TextEditSample {
    readonly value: string;
    readonly selection: TextEditSelection;
}
declare const sessionBrand: unique symbol;
export interface TextEditSession { readonly [sessionBrand]: true; }
export interface TextEditSnapshot {
    readonly state: 'idle' | 'editing' | 'composing' | 'closed';
    readonly revision: number;
    readonly value: string;
    readonly selection: Required<TextEditSelection>;
    readonly session: TextEditSession | undefined;
    readonly draft: TextEditSample | undefined;
}
export type TextEditResult = 'changed' | 'unchanged' | 'stale';
export interface TextEditStateOptions {
    readonly mode: 'single-line' | 'multiline';
    readonly value?: string;
    readonly selection?: TextEditSelection;
    /** At most the existing paragraph profile's 8192 UTF-16 units. */
    readonly maxLength?: number;
}
/** Pure bounded state. The host owns actual composition, selection and undo. */
export interface TextEditState {
    readonly mode: TextEditStateOptions['mode'];
    readonly maxLength: number;
    snapshot(): TextEditSnapshot;
    setValue(value: string, selection?: TextEditSelection, expectedRevision?: number, cancelComposition?: boolean): TextEditResult;
    setSelection(selection: TextEditSelection, expectedRevision?: number): TextEditResult;
    begin(): TextEditSession;
    observe(session: TextEditSession, expectedRevision: number, sample: TextEditSample): TextEditResult;
    beginComposition(session: TextEditSession, expectedRevision: number): boolean;
    updateComposition(session: TextEditSession, expectedRevision: number, sample: TextEditSample): boolean;
    endComposition(session: TextEditSession, expectedRevision: number, sample: TextEditSample): TextEditResult;
    /** Cancel drops provisional composition, retaining ordinary committed edits. */
    end(session: TextEditSession, expectedRevision: number, mode: 'commit' | 'cancel', sample?: TextEditSample): TextEditResult;
    dispose(): void;
}
