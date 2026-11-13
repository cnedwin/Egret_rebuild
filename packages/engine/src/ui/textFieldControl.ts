// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { PointerInput } from '../pointerInputTypes.js';
import { createActionControl } from './controls.js';
import type { ActionControl } from './controls.js';

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

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The first `limit` code points of a text. A pair of surrogates is never split. */
function clip(text: string, limit: number | undefined): string {
    if (limit === undefined || text.length <= limit) return text;
    let count = 0, index = 0;
    for (const character of text) {
        if (count === limit) break;
        count++; index += character.length;
    }
    return text.slice(0, index);
}

export function createTextFieldControl<Presentation extends TextFieldRectangle>(options: TextFieldControlOptions<Presentation>): TextFieldControl {
    if (options === null || typeof options !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target, editor, field, multiline = false, password = false, maxLength, placeholder, label, onChange, onInput, onEditingChange, onPressChange } = options;
    const initial = options.value ?? '';
    if (editor === null || typeof editor !== 'object' || typeof editor.open !== 'function' || typeof editor.commit !== 'function' || typeof editor.cancel !== 'function'
        || typeof editor.setValue !== 'function' || typeof field !== 'function' || typeof initial !== 'string' || typeof multiline !== 'boolean' || typeof password !== 'boolean'
        || (password && multiline) || (maxLength !== undefined && (!Number.isSafeInteger(maxLength) || maxLength < 1))
        || (placeholder !== undefined && typeof placeholder !== 'string') || (label !== undefined && typeof label !== 'string')
        || [onChange, onInput, onEditingChange, onPressChange].some(callback => callback !== undefined && typeof callback !== 'function')) throw new EgretError('UI_CONTROL_OPTIONS');
    let value = clip(initial, maxLength), draft = value, composing = false, closed = false;
    /** The open session. A callback of an earlier one finds another token here and does nothing. */
    let session: object | undefined, announced = false;

    function assign(next: string): void {
        if (next === value) return;
        const previous = value;
        value = next;
        onChange?.(next, previous);
    }
    /** The one end of a session: the field is gone, and then the text is the application's. */
    function finish(token: object, committed: string | undefined): void {
        if (session !== token) return;
        session = undefined; composing = false;
        const next = committed === undefined ? value : clip(committed, maxLength);
        draft = next;
        let failure: unknown, failed = false;
        // An edit that was never reported as begun is not reported as ended.
        if (announced) { announced = false; try { onEditingChange?.(false); } catch (cause) { failure = cause; failed = true; } }
        // The text is kept even when the listener of the edit failed.
        if (!closed) assign(next);
        if (failed) throw failure;
    }
    function begin(): boolean {
        if (closed) throw new EgretError('UI_CONTROL_CLOSED');
        if (!action.enabled || session !== undefined) return false;
        const presentation = field();
        if (presentation === null || typeof presentation !== 'object' || !finite(presentation.x) || !finite(presentation.y) || !finite(presentation.width) || !finite(presentation.height)
            || presentation.width <= 0 || presentation.height <= 0) throw new EgretError('UI_CONTROL_OPTIONS');
        const token = {};
        // Between edits the draft is the value and nothing is being composed.
        session = token;
        try {
            editor.open({
                ...presentation, value, multiline, password,
                ...(maxLength === undefined ? {} : { maxLength }), ...(placeholder === undefined ? {} : { placeholder }), ...(label === undefined ? {} : { label }),
                onChange(change: TextFieldChange): void {
                    if (session !== token || change === null || typeof change !== 'object' || typeof change.value !== 'string') return;
                    draft = change.value; composing = change.composing === true;
                    onInput?.(Object.freeze({ value: draft, composing }));
                },
                onCommit(committed: string): void { finish(token, typeof committed === 'string' ? committed : draft); },
                onCancel(): void { finish(token, undefined); },
            });
        } catch (cause) {
            // An editor that refused shows nothing: the field is as it was before the press.
            if (session === token) session = undefined;
            throw cause;
        }
        // An editor may end the session before it returns. Only one that is still open is reported.
        if (session !== token) return false;
        announced = true;
        onEditingChange?.(true);
        return session === token;
    }
    const action: ActionControl = createActionControl({ input, target, onActivate: () => { begin(); }, ...(onPressChange === undefined ? {} : { onPressChange }) });
    /** Ends an open session through its editor, which answers with the callback of that session. */
    function end(keep: boolean): void {
        const token = session;
        if (token === undefined) return;
        let failure: unknown, failed = false;
        try { if (keep) editor.commit(); else editor.cancel(); } catch (cause) { failure = cause; failed = true; }
        // An editor that did not answer, or failed, is not waited for: the control is no longer editing.
        try { finish(token, keep && !failed ? draft : undefined); } catch (cause) { if (!failed) { failure = cause; failed = true; } }
        if (failed) throw failure;
    }

    return Object.freeze({
        get value() { return value; },
        get draft() { return draft; },
        get composing() { return composing; },
        get editing() { return session !== undefined; },
        get pressed() { return action.pressed; },
        get enabled() { return action.enabled; },
        edit: begin,
        commit() { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); end(true); },
        cancel() { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); end(false); },
        setValue(next: string) {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (typeof next !== 'string') throw new EgretError('UI_CONTROL_OPTIONS');
            const clipped = clip(next, maxLength);
            if (session !== undefined) { draft = clipped; editor.setValue(clipped); }
            else draft = clipped;
            assign(clipped);
        },
        press() { action.press(); },
        release() { action.release(); },
        setEnabled(next: boolean) {
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            let failure: unknown, failed = false;
            if (!next) try { end(false); } catch (cause) { failure = cause; failed = true; }
            action.setEnabled(next);
            if (failed) throw failure;
        },
        dispose() {
            if (closed) return;
            let failure: unknown, failed = false;
            try { end(false); } catch (cause) { failure = cause; failed = true; }
            closed = true;
            try { action.dispose(); } catch (cause) { if (!failed) { failure = cause; failed = true; } }
            if (failed) throw failure;
        },
    });
}
