// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '../EgretError.js';
import type { TextEditState, TextEditStateOptions, TextEditSelection, TextEditSample, TextEditSession, TextEditSnapshot, TextEditResult } from './textEditTypes.js';

const fail = (code: string): never => { throw new EgretError('TEXT_EDIT_' + code); };
const freeze = Object.freeze;
function integer(value: unknown, maximum: number): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) return fail('SELECTION');
    return value === 0 ? 0 : value;
}
function selection(input: TextEditSelection, value: string): Required<TextEditSelection> {
    if (input === null || typeof input !== 'object') return fail('SELECTION');
    const anchor = integer(input.anchor, value.length), focus = integer(input.focus, value.length), affinity = input.affinity ?? 'downstream';
    if (affinity !== 'upstream' && affinity !== 'downstream') return fail('SELECTION');
    for (const offset of [anchor, focus]) {
        const left = value.charCodeAt(offset - 1), right = value.charCodeAt(offset);
        if (left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff) return fail('SELECTION');
    }
    return freeze({ anchor, focus, affinity });
}
function source(input: string, mode: TextEditStateOptions['mode'], maximum: number, provisional = false): string {
    if (typeof input !== 'string' || input.length > 8192) return fail('VALUE');
    const value = mode === 'multiline' ? input.replace(/\r\n?/gu, '\n') : input;
    if (value.length > maximum || mode === 'single-line' && /[\r\n]/u.test(value)
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) return fail('VALUE');
    // IME preedit may be incomplete. Only committed sources require well-formed UTF-16.
    if (!provisional) for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) { const low = value.charCodeAt(++index); if (!(low >= 0xdc00 && low <= 0xdfff)) return fail('VALUE'); }
        else if (unit >= 0xdc00 && unit <= 0xdfff) return fail('VALUE');
    }
    return value;
}
function equal(a: Required<TextEditSelection>, b: Required<TextEditSelection>): boolean {
    return a.anchor === b.anchor && a.focus === b.focus && a.affinity === b.affinity;
}
/** One committed value, one provisional composition and one opaque activation. No history or host globals. */
export function createTextEditState(options: TextEditStateOptions): TextEditState {
    if (options === null || typeof options !== 'object') return fail('OPTIONS');
    const mode = options.mode, maxLength = options.maxLength ?? 8192;
    if (!['single-line', 'multiline'].includes(mode) || !Number.isSafeInteger(maxLength) || maxLength < 1 || maxLength > 8192) return fail('OPTIONS');
    let value = source(options.value ?? '', mode, maxLength);
    let selected = selection(options.selection ?? { anchor: value.length, focus: value.length }, value);
    let revision = 0, closed = false, session: TextEditSession | undefined, draft: TextEditSample | undefined;
    const live = (): void => { if (closed) fail('CLOSED'); };
    const expect = (expected: number | undefined): number => {
        live(); if (expected !== undefined && expected !== revision) fail('STALE'); return revision;
    };
    const matches = (token: TextEditSession, expected: number): boolean => !closed && session !== undefined && token === session && expected === revision;
    function sample(input: TextEditSample, provisional = false): { value: string; selection: Required<TextEditSelection> } {
        if (input === null || typeof input !== 'object') return fail('VALUE');
        const nextValue = source(input.value, mode, provisional ? 8192 : maxLength, provisional);
        return freeze({ value: nextValue, selection: selection(input.selection, nextValue) });
    }
    function publish(next: { value: string; selection: Required<TextEditSelection> }): TextEditResult {
        if (next.value === value && equal(next.selection, selected)) return 'unchanged';
        if (!Number.isSafeInteger(revision + 1)) return fail('REVISION_EXHAUSTED');
        value = next.value; selected = next.selection; revision++; return 'changed';
    }
    const state: TextEditState = freeze({
        mode, maxLength,
        snapshot(): TextEditSnapshot { return freeze({ state: closed ? 'closed' : draft ? 'composing' : session ? 'editing' : 'idle', revision, value, selection: selected, session, draft }); },
        setValue(input: string, inputSelection?: TextEditSelection, expectedRevision?: number, cancelComposition = false) {
            const base = expect(expectedRevision), nextValue = source(input, mode, maxLength);
            const nextSelection = inputSelection === undefined ? nextValue === value ? selected : selection({ anchor: nextValue.length, focus: nextValue.length }, nextValue) : selection(inputSelection, nextValue);
            if (closed || revision !== base) return fail('STALE');
            if (draft !== undefined && !cancelComposition) return fail('COMPOSING');
            if (draft !== undefined) { session = undefined; draft = undefined; }
            return publish({ value: nextValue, selection: nextSelection });
        },
        setSelection(input: TextEditSelection, expectedRevision?: number) {
            const base = expect(expectedRevision), next = selection(input, value);
            if (closed || revision !== base) return fail('STALE');
            if (draft !== undefined) return fail('COMPOSING');
            return publish({ value, selection: next });
        },
        begin() {
            live(); if (session !== undefined) return fail('ACTIVE');
            session = freeze({}) as TextEditSession; return session;
        },
        observe(token: TextEditSession, expected: number, input: TextEditSample) {
            if (!matches(token, expected)) return 'stale';
            if (draft !== undefined) return fail('COMPOSING');
            const next = sample(input); if (!matches(token, expected)) return 'stale'; return publish(next);
        },
        beginComposition(token: TextEditSession, expected: number) {
            if (!matches(token, expected)) return false;
            if (draft !== undefined) return false;
            draft = freeze({ value, selection: selected }); return true;
        },
        updateComposition(token: TextEditSession, expected: number, input: TextEditSample) {
            if (!matches(token, expected) || draft === undefined) return false;
            const next = sample(input, true); if (!matches(token, expected) || draft === undefined) return false;
            draft = next; return true;
        },
        endComposition(token: TextEditSession, expected: number, input: TextEditSample) {
            if (!matches(token, expected) || draft === undefined) return 'stale';
            const next = sample(input); if (!matches(token, expected) || draft === undefined) return 'stale';
            draft = undefined; return publish(next);
        },
        end(token: TextEditSession, expected: number, how: 'commit' | 'cancel', input?: TextEditSample) {
            if (closed || session === undefined || token !== session) return 'stale';
            if (how !== 'commit' && how !== 'cancel') return fail('OPTIONS');
            if (expected !== revision) { session = undefined; draft = undefined; return 'stale'; }
            let result: TextEditResult = 'unchanged';
            if (how === 'commit') {
                if (input === undefined) return fail('VALUE');
                const next = sample(input); if (!matches(token, expected)) return 'stale'; result = publish(next);
            }
            session = undefined; draft = undefined; return result;
        },
        dispose() { if (closed) return; closed = true; session = undefined; draft = undefined; value = ''; selected = freeze({ anchor: 0, focus: 0, affinity: 'downstream' }); },
    });
    return state;
}
