import type { DisplayObject } from '@egret/runtime';
import type { PointerInput } from '../pointerInputTypes.js';
/**
 * The state of a text field an application draws itself: its text, and whether it is being edited.
 *
 * The control types nothing. A completed press, a key or a request of assistive technology begins
 * an edit, and the control asks an editor to show a field over the place the application names.
 * The platform text input of the browser is such an editor, so an input method, an on-screen
 * keyboard and paste are the platform's own. When the editor commits, the control has the text.
 */
export interface TextFieldRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface TextFieldChange {
    readonly value: string;
    /** True while an input method still holds provisional text. */
    readonly composing: boolean;
}
/** What the control adds to the presentation of a field when it opens one. */
export interface TextFieldSession {
    readonly value: string;
    readonly multiline: boolean;
    readonly password: boolean;
    readonly maxLength?: number;
    readonly placeholder?: string;
    readonly label?: string;
    readonly onChange: (change: TextFieldChange) => void;
    readonly onCommit: (value: string) => void;
    readonly onCancel: () => void;
}
/**
 * Shows one field at a time. Opening a field while another is open cancels that one first, and
 * every session ends with exactly one `onCommit` or `onCancel`.
 */
export interface TextFieldEditor<Request> {
    open(request: Request): void;
    commit(): void;
    cancel(): void;
    setValue(value: string): void;
}
export interface TextFieldControlOptions<Presentation extends TextFieldRectangle> {
    readonly input: PointerInput;
    /** The surface of the field. A completed press on it begins an edit. */
    readonly target: DisplayObject;
    readonly editor: TextFieldEditor<Presentation & TextFieldSession>;
    /**
     * Where the field is on the stage and how its text looks, asked each time an edit begins.
     * Whatever else the editor's request has (a font, a colour) is passed through.
     */
    readonly field: () => Presentation;
    /** The text it starts with. Defaults to the empty string. */
    readonly value?: string;
    readonly multiline?: boolean;
    /** Hidden characters. A password is a single line. */
    readonly password?: boolean;
    /** Most characters, counted as code points: one Chinese character or one emoji counts once. */
    readonly maxLength?: number;
    readonly placeholder?: string;
    /** The accessible name the editor gives its field. */
    readonly label?: string;
    /** The text changed: an edit was committed with other text, or `setValue` set other text. */
    readonly onChange?: (value: string, previous: string) => void;
    /** The text in the open field changed. It is not the value until the edit is committed. */
    readonly onInput?: (change: TextFieldChange) => void;
    readonly onEditingChange?: (editing: boolean) => void;
    readonly onPressChange?: (pressed: boolean) => void;
}
export interface TextFieldControl {
    /** The committed text. */
    readonly value: string;
    /** The text of the open field, and the value when none is open. */
    readonly draft: string;
    readonly composing: boolean;
    readonly editing: boolean;
    readonly pressed: boolean;
    readonly enabled: boolean;
    /** Begins an edit, as a completed press does. Returns whether one began. */
    edit(): boolean;
    /** Ends the edit and keeps its text. Nothing happens when no edit is open. */
    commit(): void;
    /** Ends the edit and keeps the text from before it. */
    cancel(): void;
    /** Sets the text without an edit. While a field is open its text is replaced as well. */
    setValue(value: string): void;
    /** Keyboard or scripted equivalents share the pointer activation path. */
    press(): void;
    release(): void;
    /** Disabling cancels an open edit. */
    setEnabled(enabled: boolean): void;
    dispose(): void;
}
export declare function createTextFieldControl<Presentation extends TextFieldRectangle>(options: TextFieldControlOptions<Presentation>): TextFieldControl;
//# sourceMappingURL=textFieldControl.d.ts.map