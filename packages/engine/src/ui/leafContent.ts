// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { captureUiLayout } from '@egret/runtime/ui';
import type { UiLayoutNode, UiLayoutTree, UiMeasurement } from '@egret/runtime/ui';
import type { LayoutNode, UiLeafContent } from './types.js';
const fields = ['id', 'kind', 'explicitWidth', 'explicitHeight', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'padding', 'gap', 'crossAlign', 'children', 'measure', 'fill', 'source', 'initialScrollOffset', 'content'];

export interface CapturedLeafContent {
    readonly identity: UiLeafContent;
    readonly revision: number;
    readonly prepare: UiLeafContent['prepare'];
}
export interface CapturedUiTree {
    readonly tree: UiLayoutTree;
    readonly contents: ReadonlyMap<string, CapturedLeafContent>;
}
/** Content authority remains in Engine; the runtime tree contains numbers and callbacks only. */
export function captureUiTree(input: LayoutNode): CapturedUiTree {
    const contents = new Map<string, CapturedLeafContent>(), seen = new Set<object>(), ids = new Set<string>();
    let lists = 0;
    function copy(value: unknown, depth: number): UiLayoutNode {
        if (depth > 64 || seen.size >= 4096) throw new EgretError('UI_LIMIT');
        if (value === null || typeof value !== 'object') throw new EgretError('UI_INVALID');
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) throw new EgretError('UI_INVALID');
        if (seen.has(value)) throw new EgretError('UI_LAYOUT_CYCLE');
        seen.add(value);
        const raw = Object.create(null) as Record<string, unknown>;
        let content: unknown;
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string' || !fields.includes(key)) throw new EgretError('UI_INVALID');
            const captured = (value as Record<string, unknown>)[key];
            if (key === 'content') content = captured;
            else raw[key] = captured;
        }
        // Validate the parent before reading descendants. The frozen shallow result
        // also snapshots fill descriptors once before the final complete-tree capture.
        const container = raw.kind === 'row' || raw.kind === 'column';
        const shallow = captureUiLayout((container && Array.isArray(raw.children)
            ? { ...raw, children: [] } : raw) as unknown as UiLayoutNode).root;
        if (ids.has(shallow.id)) throw new EgretError('UI_DUPLICATE_ID');
        ids.add(shallow.id);
        if (shallow.kind === 'virtualList' && ++lists > 1) throw new EgretError('UI_LIMIT');
        if (content !== undefined) {
            if (raw.kind !== 'leaf' || raw.measure !== undefined || typeof raw.id !== 'string'
                || content === null || typeof content !== 'object') throw new EgretError('UI_CONTENT_INVALID');
            const source = content as UiLeafContent, revision = source.revision, prepare = source.prepare;
            if (!Number.isSafeInteger(revision) || revision < 0 || typeof prepare !== 'function') throw new EgretError('UI_CONTENT_INVALID');
            contents.set(raw.id, Object.freeze({ identity: source, revision, prepare }));
        }
        if (container) {
            if (!Array.isArray(raw.children)) throw new EgretError('UI_INVALID');
            const count = raw.children.length;
            if (!Number.isInteger(count) || count < 0 || count > 4096) throw new EgretError('UI_LIMIT');
            const children: UiLayoutNode[] = [];
            for (let index = 0; index < count; index++) children.push(copy(raw.children[index], depth + 1));
            return { ...shallow, children };
        }
        return shallow;
    }
    return Object.freeze({ tree: captureUiLayout(copy(input, 1)), contents });
}

/** Constraint discovery never invokes an authored measure or publishes provisional geometry. */
export function leafConstraintTree(tree: UiLayoutTree, contents: ReadonlyMap<string, CapturedLeafContent>,
    widths: Map<string, number>): UiLayoutTree {
    function copy(node: UiLayoutNode): UiLayoutNode {
        if (node.kind === 'leaf') {
            const { explicitHeight: ignored, ...rest } = node;
            return { ...rest, measure: input => {
                if (contents.has(node.id)) widths.set(node.id, input.availableWidth);
                return { width: 0, height: 0, dependencyRevision: 0 };
            } };
        }
        return { ...node, ...(node.kind === 'row' && node.crossAlign === 'stretch' ? { crossAlign: 'start' as const } : {}),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) }) };
    }
    return captureUiLayout(copy(tree.root));
}
/** The callback captures only frozen numeric metrics, never a Scope, source or display node. */
export function fixedLeafMeasurement(width: number, height: number, revision: number): NonNullable<UiLayoutNode['measure']> {
    const measurement: UiMeasurement = Object.freeze({ width, height, dependencyRevision: revision });
    return () => measurement;
}
export function leafMeasuredTree(tree: UiLayoutTree, measures: ReadonlyMap<string, NonNullable<UiLayoutNode['measure']>>): UiLayoutTree {
    function copy(node: UiLayoutNode): UiLayoutNode {
        const measure = measures.get(node.id);
        return { ...node, ...(measure === undefined ? {} : { measure }),
            ...(node.children === undefined ? {} : { children: node.children.map(copy) }) };
    }
    return captureUiLayout(copy(tree.root));
}
