// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createActionControl } from './controls.js';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
/** The first `limit` code points of a text. A pair of surrogates is never split. */
function clip(text, limit) {
    if (limit === undefined || text.length <= limit)
        return text;
    let count = 0, index = 0;
    for (const character of text) {
        if (count === limit)
            break;
        count++;
        index += character.length;
    }
    return text.slice(0, index);
}
export function createTextFieldControl(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target, editor, field, multiline = false, password = false, maxLength, placeholder, label, onChange, onInput, onEditingChange, onPressChange } = options;
    const initial = options.value ?? '';
    if (editor === null ||
        typeof editor !== 'object' ||
        typeof editor.open !== 'function' ||
        typeof editor.commit !== 'function' ||
        typeof editor.cancel !== 'function' ||
        typeof editor.setValue !== 'function' ||
        typeof field !== 'function' ||
        typeof initial !== 'string' ||
        typeof multiline !== 'boolean' ||
        typeof password !== 'boolean' ||
        (password && multiline) ||
        (maxLength !== undefined && (!Number.isSafeInteger(maxLength) || maxLength < 1)) ||
        (placeholder !== undefined && typeof placeholder !== 'string') ||
        (label !== undefined && typeof label !== 'string') ||
        [onChange, onInput, onEditingChange, onPressChange].some(callback => callback !== undefined && typeof callback !== 'function'))
        throw new EgretError('UI_CONTROL_OPTIONS');
    let value = clip(initial, maxLength), draft = value, composing = false, closed = false;
    /** The open session. A callback of an earlier one finds another token here and does nothing. */
    let session, announced = false;
    function assign(next) {
        if (next === value)
            return;
        const previous = value;
        value = next;
        onChange?.(next, previous);
    }
    /** The one end of a session: the field is gone, and then the text is the application's. */
    function finish(token, committed) {
        if (session !== token)
            return;
        session = undefined;
        composing = false;
        const next = committed === undefined ? value : clip(committed, maxLength);
        draft = next;
        let failure, failed = false;
        // An edit that was never reported as begun is not reported as ended.
        if (announced) {
            announced = false;
            try {
                onEditingChange?.(false);
            }
            catch (cause) {
                failure = cause;
                failed = true;
            }
        }
        // The text is kept even when the listener of the edit failed.
        if (!closed)
            assign(next);
        if (failed)
            throw failure;
    }
    function begin() {
        if (closed)
            throw new EgretError('UI_CONTROL_CLOSED');
        if (!action.enabled || session !== undefined)
            return false;
        const presentation = field();
        if (presentation === null ||
            typeof presentation !== 'object' ||
            !finite(presentation.x) ||
            !finite(presentation.y) ||
            !finite(presentation.width) ||
            !finite(presentation.height) ||
            presentation.width <= 0 ||
            presentation.height <= 0)
            throw new EgretError('UI_CONTROL_OPTIONS');
        const token = {};
        // Between edits the draft is the value and nothing is being composed.
        session = token;
        try {
            editor.open({
                ...presentation,
                value,
                multiline,
                password,
                ...(maxLength === undefined ? {} : { maxLength }),
                ...(placeholder === undefined ? {} : { placeholder }),
                ...(label === undefined ? {} : { label }),
                onChange(change) {
                    if (session !== token || change === null || typeof change !== 'object' || typeof change.value !== 'string')
                        return;
                    draft = change.value;
                    composing = change.composing === true;
                    onInput?.(Object.freeze({ value: draft, composing }));
                },
                onCommit(committed) {
                    finish(token, typeof committed === 'string' ? committed : draft);
                },
                onCancel() {
                    finish(token, undefined);
                }
            });
        }
        catch (cause) {
            // An editor that refused shows nothing: the field is as it was before the press.
            if (session === token)
                session = undefined;
            throw cause;
        }
        // An editor may end the session before it returns. Only one that is still open is reported.
        if (session !== token)
            return false;
        announced = true;
        onEditingChange?.(true);
        return session === token;
    }
    const action = createActionControl({
        input,
        target,
        onActivate: () => {
            begin();
        },
        ...(onPressChange === undefined ? {} : { onPressChange })
    });
    /** Ends an open session through its editor, which answers with the callback of that session. */
    function end(keep) {
        const token = session;
        if (token === undefined)
            return;
        let failure, failed = false;
        try {
            if (keep)
                editor.commit();
            else
                editor.cancel();
        }
        catch (cause) {
            failure = cause;
            failed = true;
        }
        // An editor that did not answer, or failed, is not waited for: the control is no longer editing.
        try {
            finish(token, keep && !failed ? draft : undefined);
        }
        catch (cause) {
            if (!failed) {
                failure = cause;
                failed = true;
            }
        }
        if (failed)
            throw failure;
    }
    return Object.freeze({
        get value() {
            return value;
        },
        get draft() {
            return draft;
        },
        get composing() {
            return composing;
        },
        get editing() {
            return session !== undefined;
        },
        get pressed() {
            return action.pressed;
        },
        get enabled() {
            return action.enabled;
        },
        edit: begin,
        commit() {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            end(true);
        },
        cancel() {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            end(false);
        },
        setValue(next) {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (typeof next !== 'string')
                throw new EgretError('UI_CONTROL_OPTIONS');
            const clipped = clip(next, maxLength);
            if (session !== undefined) {
                draft = clipped;
                editor.setValue(clipped);
            }
            else
                draft = clipped;
            assign(clipped);
        },
        press() {
            action.press();
        },
        release() {
            action.release();
        },
        setEnabled(next) {
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            let failure, failed = false;
            if (!next)
                try {
                    end(false);
                }
                catch (cause) {
                    failure = cause;
                    failed = true;
                }
            action.setEnabled(next);
            if (failed)
                throw failure;
        },
        dispose() {
            if (closed)
                return;
            let failure, failed = false;
            try {
                end(false);
            }
            catch (cause) {
                failure = cause;
                failed = true;
            }
            closed = true;
            try {
                action.dispose();
            }
            catch (cause) {
                if (!failed) {
                    failure = cause;
                    failed = true;
                }
            }
            if (failed)
                throw failure;
        }
    });
}
//# sourceMappingURL=textFieldControl.js.map