// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { captureUiLayout } from '@egret/runtime/ui';
const themes = new WeakMap();
const freeze = Object.freeze;
function invalid() {
    throw new EgretError('UI_THEME_INVALID');
}
function record(value, allowed) {
    if (value === null || typeof value !== 'object')
        invalid();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        invalid();
    const keys = Reflect.ownKeys(value);
    if (keys.length > 64)
        throw new EgretError('UI_THEME_LIMIT');
    const result = Object.create(null);
    for (const key of keys) {
        if (typeof key !== 'string' ||
            !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) ||
            (allowed !== undefined && !allowed.includes(key)))
            invalid();
        // Data-only descriptors prevent hidden getter work during admission.
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!('value' in descriptor))
            invalid();
        result[key] = descriptor.value;
    }
    return result;
}
function name(value) {
    if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value))
        invalid();
    return value;
}
function numeric(value, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        invalid();
    return value === 0 ? 0 : value;
}
function tokens(value, capture) {
    const input = value === undefined ? {} : record(value), result = Object.create(null);
    for (const key of Object.keys(input).sort())
        result[key] = capture(input[key]);
    return freeze(result);
}
export function createUiTheme(descriptor) {
    const raw = record(descriptor, ['id', 'colors', 'spacing', 'typography', 'skins']);
    const result = freeze({
        id: name(raw.id),
        colors: tokens(raw.colors, value => {
            const n = numeric(value, 0, 0xffffff);
            if (!Number.isInteger(n))
                invalid();
            return n;
        }),
        spacing: tokens(raw.spacing, value => numeric(value, 0, 4096)),
        typography: tokens(raw.typography, value => {
            const t = record(value, ['fontFamily', 'fontSize', 'lineHeight']);
            if (typeof t.fontFamily !== 'string' ||
                !t.fontFamily.length ||
                t.fontFamily.length > 256 ||
                /[\x00-\x1f\x7f]/.test(t.fontFamily))
                invalid();
            return freeze({
                fontFamily: t.fontFamily,
                fontSize: numeric(t.fontSize, 1, 512),
                lineHeight: numeric(t.lineHeight, 1, 2048)
            });
        }),
        skins: tokens(raw.skins, value => {
            const rawSkin = record(value, [
                'default',
                'hover',
                'pressed',
                'disabled',
                'focus',
                'checked',
                'selected',
                'expanded'
            ]);
            const skin = Object.create(null);
            skin.default = name(rawSkin.default);
            for (const key of Object.keys(rawSkin))
                skin[key] = name(rawSkin[key]);
            return freeze(skin);
        })
    });
    themes.set(result, JSON.stringify([result.spacing, result.typography]));
    return result;
}
const skinStates = freeze([
    'disabled',
    'pressed',
    'checked',
    'selected',
    'expanded',
    'focus',
    'hover'
]);
/**
 * The name a skin gives to the state of a control: of the states that hold, the first in `order`
 * that the skin has a name for, and `default` when it has none. The usual order is the one a player
 * reads a control in: unavailable, held, set, focused, pointed at. A state left out of `order` is
 * never chosen.
 */
export function selectUiSkin(skin, state = {}, order = skinStates) {
    const asked = order;
    if (skin === null ||
        typeof skin !== 'object' ||
        typeof skin.default !== 'string' ||
        state === null ||
        typeof state !== 'object' ||
        !Array.isArray(order) ||
        asked.some((entry, index) => !skinStates.includes(entry) || asked.indexOf(entry) !== index))
        invalid();
    for (const entry of skinStates)
        if (state[entry] !== undefined && typeof state[entry] !== 'boolean')
            invalid();
    for (const entry of asked) {
        const named = skin[entry];
        if (state[entry] === true && named !== undefined)
            return named;
    }
    return skin.default;
}
export function requireUiTheme(value) {
    if (value !== undefined && !themes.has(value))
        invalid();
}
export function sameThemeMetrics(a, b) {
    return (a === undefined ? '[{},{}]' : themes.get(a)) === (b === undefined ? '[{},{}]' : themes.get(b));
}
export function captureThemeNode(value) {
    const raw = record(value, ['fill', 'padding', 'gap']), result = Object.create(null);
    for (const key of Object.keys(raw))
        result[key] = name(raw[key]);
    return freeze(result);
}
/** Resolve a captured numeric tree without callbacks or resource acquisition. */
export function applyUiTheme(tree, bindings, theme) {
    if (theme === undefined || bindings.size === 0)
        return tree;
    function resolve(group, key) {
        const value = group[key];
        if (value === undefined)
            throw new EgretError('UI_THEME_TOKEN_MISSING');
        return value;
    }
    function copy(node) {
        const binding = bindings.get(node.id);
        return {
            ...node,
            ...(binding?.fill === undefined
                ? {}
                : { fill: { color: resolve(theme.colors, binding.fill), alpha: node.fill?.alpha ?? 1 } }),
            ...(binding?.padding === undefined ? {} : { padding: resolve(theme.spacing, binding.padding) }),
            ...(binding?.gap === undefined ? {} : { gap: resolve(theme.spacing, binding.gap) }),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) })
        };
    }
    return captureUiLayout(copy(tree.root));
}
//# sourceMappingURL=theme.js.map