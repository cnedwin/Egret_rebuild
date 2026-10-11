import { EgretError } from '../EgretError.js';
import type { TextRasterRequest, TextRasterRequestInput } from './types.js';

declare const invocationBrand: unique symbol;
declare const snapshotBrand: unique symbol;
declare const summaryBrand: unique symbol;

/** Private operation identity; a public error code never supplies this authority. */
export interface TextValueInvocation { readonly [invocationBrand]: true; }
export type TextValueFailureCode =
    | 'TEXT_REQUEST_INVALID' | 'TEXT_REQUEST_LIMIT'
    | 'TEXT_PLAN_INVALID' | 'TEXT_PLAN_ALREADY_CREATED' | 'TEXT_PLAN_SCOPE_CLOSED'
    | 'TEXT_CACHE_BUDGET' | 'TEXT_COUNTER_EXHAUSTED';
export interface TextValueFailure {
    readonly code: TextValueFailureCode;
    readonly error: EgretError;
}
export interface TextRasterRequestSnapshot { readonly [snapshotBrand]: true; }
/** A transient scalar proposal. The cache must admit its charge before owned creation. */
export interface TextRasterRequestSummary {
    readonly [summaryBrand]: true;
    readonly sourceCodeUnits: number;
    readonly lineCount: number;
    readonly metadataBytes: number;
}

interface InvocationState { open: boolean; }
interface FailureState { readonly invocation: TextValueInvocation; readonly note: TextValueFailure; }
interface Fields {
    readonly text: unknown; readonly fontFamily: unknown; readonly fontSize: unknown;
    readonly fontWeight: unknown; readonly fontStyle: unknown; readonly lineHeight: unknown;
    readonly locale: unknown; readonly direction: unknown; readonly density: unknown;
    readonly fillColor: unknown;
}
interface Normalized extends TextRasterRequestInput {
    readonly providerIdentity: string;
    readonly fontGeneration: number;
    readonly lineCount: number;
    readonly metadataBytes: number;
}
interface OwnedRequest { readonly data: Normalized; readonly request: TextRasterRequest; }

const apply = Reflect.apply;
const freeze = Object.freeze;
const TypeFault = TypeError;
const RangeFault = RangeError;
const finite = Number.isFinite;
const safeInteger = Number.isSafeInteger;
const Lines = Array;
const charCodeAt = String.prototype.charCodeAt;
const regexpExec = RegExp.prototype.exec;
const providerPattern = /^[A-Za-z0-9._-]{1,64}$/;
const localePattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const weakHas = WeakMap.prototype.has;
const weakDelete = WeakMap.prototype.delete;
const invocations = new WeakMap<object, InvocationState>();
const failures = new WeakMap<object, FailureState>();
const snapshots = new WeakMap<object, Fields>();
const summaries = new WeakMap<object, Normalized>();
const requests = new WeakMap<object, OwnedRequest>();

function codeAt(text: string, index: number): number { return apply(charCodeAt, text, [index]) as number; }
function matches(pattern: RegExp, text: string): boolean {
    const result = apply(regexpExec, pattern, [text]) as RegExpExecArray | null;
    // JavaScript's $ can precede a terminal line break; the admitted subset consumes every code unit.
    return result !== null && result[0]!.length === text.length;
}

function invocationState(value: TextValueInvocation): InvocationState {
    const state = apply(weakGet, invocations, [value]) as InvocationState | undefined;
    if (state === undefined) throw new TypeFault('Authentic private text invocation required');
    return state;
}
function openInvocation(value: TextValueInvocation): void {
    if (!invocationState(value).open) throw new TypeFault('Private text invocation is closed');
}

export function createTextValueInvocation(): TextValueInvocation {
    const value = freeze({}) as TextValueInvocation;
    apply(weakSet, invocations, [value, { open: true }]);
    return value;
}
export function closeTextValueInvocation(value: TextValueInvocation): void {
    invocationState(value).open = false;
}
/** Only fresh first-party creation attaches a note; closed notes cannot be consumed. */
export function createTextValueFailure(
    invocation: TextValueInvocation, code: TextValueFailureCode, cause?: unknown,
): EgretError {
    invocationState(invocation);
    const error = freeze(new EgretError(code, { cause }));
    const note = freeze({ code, error });
    apply(weakSet, failures, [error, { invocation, note }]);
    return error;
}
/** Exact active operation and one consumption; no instanceof/code/cause inspection. */
export function takeTextValueFailure(
    invocation: TextValueInvocation, cause: unknown,
): TextValueFailure | undefined {
    const state = invocationState(invocation);
    if (!state.open || typeof cause !== 'object' || cause === null) return undefined;
    const failure = apply(weakGet, failures, [cause]) as FailureState | undefined;
    if (failure === undefined || failure.invocation !== invocation) return undefined;
    apply(weakDelete, failures, [cause]);
    return failure.note;
}

function invalid(invocation: TextValueInvocation, message: string): never {
    throw createTextValueFailure(invocation, 'TEXT_REQUEST_INVALID', new TypeFault(message));
}
function limit(invocation: TextValueInvocation, message: string): never {
    throw createTextValueFailure(invocation, 'TEXT_REQUEST_LIMIT', new RangeFault(message));
}

/** Snapshot all ten fields first. The cache performs its post-read lifecycle check next. */
export function snapshotTextRasterRequest(
    input: TextRasterRequestInput, invocation: TextValueInvocation,
): TextRasterRequestSnapshot {
    openInvocation(invocation);
    if (typeof input !== 'object' || input === null) invalid(invocation, 'Text request must be a record');
    let text: unknown, fontFamily: unknown, fontSize: unknown, fontWeight: unknown;
    let fontStyle: unknown, lineHeight: unknown, locale: unknown, direction: unknown;
    let density: unknown, fillColor: unknown;
    try {
        text = input.text;
        fontFamily = input.fontFamily;
        fontSize = input.fontSize;
        fontWeight = input.fontWeight;
        fontStyle = input.fontStyle;
        lineHeight = input.lineHeight;
        locale = input.locale;
        direction = input.direction;
        density = input.density;
        fillColor = input.fillColor;
    } catch (cause) {
        throw createTextValueFailure(invocation, 'TEXT_REQUEST_INVALID', cause);
    }
    // Native allocation faults stay outside the descriptor-read wrapper.
    const value = freeze({}) as TextRasterRequestSnapshot;
    apply(weakSet, snapshots, [value, { text, fontFamily, fontSize, fontWeight, fontStyle,
        lineHeight, locale, direction, density, fillColor }]);
    return value;
}

function stringField(value: unknown, max: number, label: string, invocation: TextValueInvocation): string {
    if (typeof value !== 'string') invalid(invocation, label + ' must be a string');
    if (value.length > max) limit(invocation, label + ' code-unit limit');
    return value;
}
function validateCharacters(text: string, allowLineBreaks: boolean, invocation: TextValueInvocation): void {
    for (let i = 0; i < text.length; i++) {
        const code = codeAt(text, i);
        if ((code < 32 && !(allowLineBreaks && (code === 10 || code === 13)))
            || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
            || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) {
            invalid(invocation, 'Unsupported text control character');
        }
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = codeAt(text, i + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) invalid(invocation, 'Unpaired UTF-16 surrogate');
            i++;
        } else if (code >= 0xdc00 && code <= 0xdfff) invalid(invocation, 'Unpaired UTF-16 surrogate');
    }
}
function numeric(
    value: unknown, min: number, max: number, integer: boolean, label: string,
    invocation: TextValueInvocation,
): number {
    if (typeof value !== 'number') invalid(invocation, label + ' must be numeric');
    if (!finite(value) || value < min || value > max || (integer && !safeInteger(value))) {
        invalid(invocation, label + ' range');
    }
    return value === 0 ? 0 : value;
}
function sourceLineCount(text: string, invocation: TextValueInvocation): number {
    let count = 1;
    for (let i = 0; i < text.length; i++) {
        const code = codeAt(text, i);
        if (code !== 10 && code !== 13) continue;
        if (code === 13 && codeAt(text, i + 1) === 10) i++;
        count++;
        if (count > 64) limit(invocation, 'Text source line limit');
    }
    return count;
}

/** No source-line array, serialized key or resource identity is created here. */
export function summarizeTextRasterRequest(
    snapshot: TextRasterRequestSnapshot, providerIdentity: string, fontGeneration: number,
    invocation: TextValueInvocation,
): TextRasterRequestSummary {
    openInvocation(invocation);
    const fields = apply(weakGet, snapshots, [snapshot]) as Fields | undefined;
    if (fields === undefined) throw new TypeFault('Authentic private request snapshot required');
    // These are already admitted cache scalars, not a new structural provider port.
    if (typeof providerIdentity !== 'string' || !matches(providerPattern, providerIdentity)
        || !safeInteger(fontGeneration) || fontGeneration <= 0) {
        throw new TypeFault('Admitted text provider identity and generation required');
    }
    const text = stringField(fields.text, 8192, 'Text source', invocation);
    validateCharacters(text, true, invocation);
    const lineCount = sourceLineCount(text, invocation);
    const fontFamily = stringField(fields.fontFamily, 256, 'Font family', invocation);
    if (fontFamily.length === 0) invalid(invocation, 'Font family must be nonempty');
    validateCharacters(fontFamily, false, invocation);
    const fontSize = numeric(fields.fontSize, 1, 512, false, 'Font size', invocation);
    const fontWeight = numeric(fields.fontWeight, 1, 1000, true, 'Font weight', invocation);
    if (fields.fontStyle !== 'normal' && fields.fontStyle !== 'italic') invalid(invocation, 'Font style');
    const fontStyle = fields.fontStyle;
    const lineHeight = numeric(fields.lineHeight, 1, 1024, false, 'Line height', invocation);
    const locale = stringField(fields.locale, 64, 'Locale', invocation);
    if (!matches(localePattern, locale)) invalid(invocation, 'Locale subset');
    if (fields.direction !== 'ltr' && fields.direction !== 'rtl') invalid(invocation, 'Text direction');
    const direction = fields.direction;
    const density = numeric(fields.density, 0.5, 4, false, 'Raster density', invocation);
    const fillColor = numeric(fields.fillColor, 0, 0xffffff, true, 'Fill color', invocation);
    const metadataBytes = 512 + 2 * (text.length + fontFamily.length + locale.length + providerIdentity.length)
        + 128 * lineCount;
    const data: Normalized = { text, fontFamily, fontSize, fontWeight, fontStyle, lineHeight,
        locale, direction, density, fillColor, providerIdentity, fontGeneration, lineCount, metadataBytes };
    const value = freeze({ sourceCodeUnits: text.length, lineCount, metadataBytes }) as TextRasterRequestSummary;
    apply(weakSet, summaries, [value, data]);
    return value;
}

/** Project validated field scalars without granting cache request/plan authority. */
export function createTextFieldRequestInput(
    summary: TextRasterRequestSummary, invocation: TextValueInvocation,
): TextRasterRequestInput {
    openInvocation(invocation);
    const data = apply(weakGet, summaries, [summary]) as Normalized | undefined;
    if (data === undefined) throw new TypeFault('Authentic private request summary required');
    // Plain validated scalars only: no cache-owned source-line array or plan identity.
    return freeze({ text: data.text, fontFamily: data.fontFamily, fontSize: data.fontSize,
        fontWeight: data.fontWeight, fontStyle: data.fontStyle, lineHeight: data.lineHeight,
        locale: data.locale, direction: data.direction, density: data.density, fillColor: data.fillColor });
}

/** Call only after the cache commits the summary's exact generation metadata charge. */
export function createOwnedTextRasterRequest(
    summary: TextRasterRequestSummary, invocation: TextValueInvocation,
): TextRasterRequest {
    openInvocation(invocation);
    const data = apply(weakGet, summaries, [summary]) as Normalized | undefined;
    if (data === undefined) throw new TypeFault('Authentic private request summary required');
    const lines = new Lines<{ readonly start: number; readonly end: number; readonly breakEnd: number }>(data.lineCount);
    let line = 0, start = 0;
    for (let i = 0; i < data.text.length; i++) {
        const code = codeAt(data.text, i);
        if (code !== 10 && code !== 13) continue;
        const end = i;
        if (code === 13 && codeAt(data.text, i + 1) === 10) i++;
        const breakEnd = i + 1;
        lines[line++] = freeze({ start, end, breakEnd });
        start = breakEnd;
    }
    lines[line] = freeze({ start, end: data.text.length, breakEnd: data.text.length });
    const sourceLines = freeze(lines);
    const value = freeze({
        text: data.text, fontFamily: data.fontFamily, fontSize: data.fontSize,
        fontWeight: data.fontWeight, fontStyle: data.fontStyle, lineHeight: data.lineHeight,
        locale: data.locale, direction: data.direction, density: data.density, fillColor: data.fillColor,
        profile: 'canvas-explicit-lines-v1', providerIdentity: data.providerIdentity,
        fontGeneration: data.fontGeneration, sourceLines,
    }) as TextRasterRequest;
    apply(weakSet, requests, [value, { data, request: value }]);
    return value;
}
export function isOwnedTextRasterRequest(value: unknown): value is TextRasterRequest {
    return typeof value === 'object' && value !== null && (apply(weakHas, requests, [value]) as boolean);
}
export function requireOwnedTextRasterRequest(
    value: unknown, invocation: TextValueInvocation,
): TextRasterRequest {
    openInvocation(invocation);
    const owned = typeof value === 'object' && value !== null
        ? apply(weakGet, requests, [value]) as OwnedRequest | undefined : undefined;
    if (owned === undefined) invalid(invocation, 'Authentic owned text request required');
    return owned.request;
}

/** Bounded route lookup compares authenticated normalized scalars without allocating a key. */
export function matchesTextRasterRequestSummary(
    request: TextRasterRequest, summary: TextRasterRequestSummary,
    providerIdentity: string, fontGeneration: number,
): boolean {
    const owned = apply(weakGet, requests, [request]) as OwnedRequest | undefined;
    const candidate = apply(weakGet, summaries, [summary]) as Normalized | undefined;
    if (owned === undefined || candidate === undefined) throw new TypeFault('Authentic request and summary required');
    const current = owned.data;
    return current.providerIdentity === providerIdentity && candidate.providerIdentity === providerIdentity
        && current.fontGeneration === fontGeneration && candidate.fontGeneration === fontGeneration
        && current.text === candidate.text && current.fontFamily === candidate.fontFamily
        && current.fontSize === candidate.fontSize && current.fontWeight === candidate.fontWeight
        && current.fontStyle === candidate.fontStyle && current.lineHeight === candidate.lineHeight
        && current.locale === candidate.locale && current.direction === candidate.direction
        && current.density === candidate.density && current.fillColor === candidate.fillColor;
}
