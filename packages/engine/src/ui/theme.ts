// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { captureUiLayout } from '@egret/runtime/ui';
import type { UiLayoutTree, UiLayoutNode } from '@egret/runtime/ui';

export interface UiThemeTypography {
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly lineHeight: number;
}
/** Skin names resolve through application-owned, typed asset references, never URLs. */
export interface UiThemeSkin {
    readonly default: string;
    readonly hover?: string;
    readonly pressed?: string;
    readonly disabled?: string;
    readonly focus?: string;
    readonly checked?: string;
    readonly selected?: string;
    readonly expanded?: string;
}
export interface UiThemeDescriptor {
    readonly id: string;
    readonly colors?: Readonly<Record<string, number>>;
    readonly spacing?: Readonly<Record<string, number>>;
    readonly typography?: Readonly<Record<string, UiThemeTypography>>;
    readonly skins?: Readonly<Record<string, UiThemeSkin>>;
}
declare const themeBrand: unique symbol;
/** Every factory result is a distinct immutable generation, including equal descriptors. */
export interface UiTheme {
    readonly [themeBrand]: true;
    readonly id: string;
    readonly colors: Readonly<Record<string, number>>;
    readonly spacing: Readonly<Record<string, number>>;
    readonly typography: Readonly<Record<string, UiThemeTypography>>;
    readonly skins: Readonly<Record<string, UiThemeSkin>>;
}
export interface UiThemeNode {
    readonly fill?: string;
    readonly padding?: string;
    readonly gap?: string;
}
const themes = new WeakMap<object, string>();
const freeze = Object.freeze;
function invalid(): never { throw new EgretError('UI_THEME_INVALID'); }
function record(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
    if (value === null || typeof value !== 'object') invalid();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalid();
    const keys = Reflect.ownKeys(value);
    if (keys.length > 64) throw new EgretError('UI_THEME_LIMIT');
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
        if (typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)
            || allowed !== undefined && !allowed.includes(key)) invalid();
        // Data-only descriptors prevent hidden getter work during admission.
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in descriptor)) invalid();
        result[key] = descriptor.value;
    }
    return result;
}
function name(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value)) invalid();
    return value;
}
function numeric(value: unknown, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid();
    return value === 0 ? 0 : value;
}
function tokens<T>(value: unknown, capture: (value: unknown) => T): Readonly<Record<string, T>> {
    const input = value === undefined ? {} : record(value), result = Object.create(null) as Record<string, T>;
    for (const key of Object.keys(input).sort()) result[key] = capture(input[key]);
    return freeze(result);
}
export function createUiTheme(descriptor: UiThemeDescriptor): UiTheme {
    const raw = record(descriptor, ['id', 'colors', 'spacing', 'typography', 'skins']);
    const result = freeze({ id: name(raw.id),
        colors: tokens(raw.colors, value => { const n = numeric(value, 0, 0xffffff); if (!Number.isInteger(n)) invalid(); return n; }),
        spacing: tokens(raw.spacing, value => numeric(value, 0, 4096)),
        typography: tokens(raw.typography, value => {
            const t = record(value, ['fontFamily', 'fontSize', 'lineHeight']);
            if (typeof t.fontFamily !== 'string' || !t.fontFamily.length || t.fontFamily.length > 256 || /[\x00-\x1f\x7f]/.test(t.fontFamily)) invalid();
            return freeze({ fontFamily: t.fontFamily, fontSize: numeric(t.fontSize, 1, 512), lineHeight: numeric(t.lineHeight, 1, 2048) });
        }),
        skins: tokens(raw.skins, value => {
            const rawSkin = record(value, ['default', 'hover', 'pressed', 'disabled', 'focus', 'checked', 'selected', 'expanded']);
            const skin: Record<string, string> = Object.create(null) as Record<string, string>;
            skin.default = name(rawSkin.default);
            for (const key of Object.keys(rawSkin)) skin[key] = name(rawSkin[key]);
            return freeze(skin) as unknown as UiThemeSkin;
        })
    }) as UiTheme;
    themes.set(result, JSON.stringify([result.spacing, result.typography]));
    return result;
}
/** The states of a control that a skin may have a name for. */
export type UiSkinStateName = Exclude<keyof UiThemeSkin, 'default'>;
export type UiSkinState = { readonly [Name in UiSkinStateName]?: boolean };
const skinStates: readonly UiSkinStateName[] = freeze(['disabled', 'pressed', 'checked', 'selected', 'expanded', 'focus', 'hover']);
/**
 * The name a skin gives to the state of a control: of the states that hold, the first in `order`
 * that the skin has a name for, and `default` when it has none. The usual order is the one a player
 * reads a control in: unavailable, held, set, focused, pointed at. A state left out of `order` is
 * never chosen.
 */
export function selectUiSkin(skin: UiThemeSkin, state: UiSkinState = {}, order: readonly UiSkinStateName[] = skinStates): string {
    const asked: readonly UiSkinStateName[] = order;
    if (skin === null || typeof skin !== 'object' || typeof skin.default !== 'string' || state === null || typeof state !== 'object' || !Array.isArray(order)
        || asked.some((entry, index) => !skinStates.includes(entry) || asked.indexOf(entry) !== index)) invalid();
    for (const entry of skinStates) if (state[entry] !== undefined && typeof state[entry] !== 'boolean') invalid();
    for (const entry of asked) {
        const named = skin[entry];
        if (state[entry] === true && named !== undefined) return named;
    }
    return skin.default;
}
export function requireUiTheme(value: UiTheme | undefined): void {
    if (value !== undefined && !themes.has(value)) invalid();
}
export function sameThemeMetrics(a: UiTheme | undefined, b: UiTheme | undefined): boolean {
    return (a === undefined ? '[{},{}]' : themes.get(a)) === (b === undefined ? '[{},{}]' : themes.get(b));
}
export function captureThemeNode(value: unknown): UiThemeNode {
    const raw = record(value, ['fill', 'padding', 'gap']), result: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const key of Object.keys(raw)) result[key] = name(raw[key]);
    return freeze(result);
}
/** Resolve a captured numeric tree without callbacks or resource acquisition. */
export function applyUiTheme(tree: UiLayoutTree, bindings: ReadonlyMap<string, UiThemeNode>, theme: UiTheme | undefined): UiLayoutTree {
    if (theme === undefined || bindings.size === 0) return tree;
    function resolve(group: Readonly<Record<string, number>>, key: string): number {
        const value = group[key];
        if (value === undefined) throw new EgretError('UI_THEME_TOKEN_MISSING');
        return value;
    }
    function copy(node: UiLayoutNode): UiLayoutNode {
        const binding = bindings.get(node.id);
        return { ...node,
            ...(binding?.fill === undefined ? {} : { fill: { color: resolve(theme!.colors, binding.fill), alpha: node.fill?.alpha ?? 1 } }),
            ...(binding?.padding === undefined ? {} : { padding: resolve(theme!.spacing, binding.padding) }),
            ...(binding?.gap === undefined ? {} : { gap: resolve(theme!.spacing, binding.gap) }),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) }) };
    }
    return captureUiLayout(copy(tree.root));
}
