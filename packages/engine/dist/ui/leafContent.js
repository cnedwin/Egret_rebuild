// SPDX-License-Identifier: Apache-2.0
import { captureThemeNode } from './theme.js';
import { EgretError } from '@egret/runtime';
import { captureUiLayout } from '@egret/runtime/ui';
const fields = [
    'id',
    'kind',
    'explicitWidth',
    'explicitHeight',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'padding',
    'gap',
    'crossAlign',
    'children',
    'measure',
    'fill',
    'source',
    'initialScrollOffset',
    'content',
    'theme'
];
/** Content authority remains in Engine; the runtime tree contains numbers and callbacks only. */
export function captureUiTree(input) {
    const themes = new Map();
    const contents = new Map(), seen = new Set(), ids = new Set();
    let lists = 0;
    function copy(value, depth) {
        if (depth > 64 || seen.size >= 4096)
            throw new EgretError('UI_LIMIT');
        if (value === null || typeof value !== 'object')
            throw new EgretError('UI_INVALID');
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null)
            throw new EgretError('UI_INVALID');
        if (seen.has(value))
            throw new EgretError('UI_LAYOUT_CYCLE');
        seen.add(value);
        const raw = Object.create(null);
        let content, theme;
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string' || !fields.includes(key))
                throw new EgretError('UI_INVALID');
            const captured = value[key];
            if (key === 'content')
                content = captured;
            else if (key === 'theme' && captured !== undefined)
                theme = captureThemeNode(captured);
            else if (key === 'theme')
                continue;
            else
                raw[key] = captured;
        }
        // Validate the parent before reading descendants. The frozen shallow result
        // also snapshots fill descriptors once before the final complete-tree capture.
        const container = raw.kind === 'row' || raw.kind === 'column';
        const shallow = captureUiLayout((container && Array.isArray(raw.children) ? { ...raw, children: [] } : raw)).root;
        if (ids.has(shallow.id))
            throw new EgretError('UI_DUPLICATE_ID');
        ids.add(shallow.id);
        if (theme !== undefined) {
            if ((theme.fill !== undefined && shallow.kind !== 'leaf') ||
                ((theme.padding !== undefined || theme.gap !== undefined) && shallow.kind === 'virtualList'))
                throw new EgretError('UI_THEME_INVALID');
            themes.set(shallow.id, theme);
        }
        if (shallow.kind === 'virtualList' && ++lists > 1)
            throw new EgretError('UI_LIMIT');
        if (content !== undefined) {
            if (raw.kind !== 'leaf' ||
                raw.measure !== undefined ||
                typeof raw.id !== 'string' ||
                content === null ||
                typeof content !== 'object')
                throw new EgretError('UI_CONTENT_INVALID');
            const source = content, revision = source.revision, prepare = source.prepare;
            if (!Number.isSafeInteger(revision) || revision < 0 || typeof prepare !== 'function')
                throw new EgretError('UI_CONTENT_INVALID');
            contents.set(raw.id, Object.freeze({ identity: source, revision, prepare }));
        }
        if (container) {
            if (!Array.isArray(raw.children))
                throw new EgretError('UI_INVALID');
            const count = raw.children.length;
            if (!Number.isInteger(count) || count < 0 || count > 4096)
                throw new EgretError('UI_LIMIT');
            const children = [];
            for (let index = 0; index < count; index++)
                children.push(copy(raw.children[index], depth + 1));
            return { ...shallow, children };
        }
        return shallow;
    }
    return Object.freeze({ tree: captureUiLayout(copy(input, 1)), contents, themes });
}
/** Constraint discovery never invokes an authored measure or publishes provisional geometry. */
export function leafConstraintTree(tree, contents, widths) {
    function copy(node) {
        if (node.kind === 'leaf') {
            const { explicitHeight: ignored, ...rest } = node;
            return {
                ...rest,
                measure: input => {
                    if (contents.has(node.id))
                        widths.set(node.id, input.availableWidth);
                    return { width: 0, height: 0, dependencyRevision: 0 };
                }
            };
        }
        return {
            ...node,
            ...(node.kind === 'row' && node.crossAlign === 'stretch' ? { crossAlign: 'start' } : {}),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) })
        };
    }
    return captureUiLayout(copy(tree.root));
}
/** The callback captures only frozen numeric metrics, never a Scope, source or display node. */
export function fixedLeafMeasurement(width, height, revision) {
    const measurement = Object.freeze({ width, height, dependencyRevision: revision });
    return () => measurement;
}
export function leafMeasuredTree(tree, measures) {
    function copy(node) {
        const measure = measures.get(node.id);
        return {
            ...node,
            ...(measure === undefined ? {} : { measure }),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) })
        };
    }
    return captureUiLayout(copy(tree.root));
}
//# sourceMappingURL=leafContent.js.map