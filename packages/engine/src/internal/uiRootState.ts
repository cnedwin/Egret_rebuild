// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import type { UiRoot, UiSnapshot, RowRetention } from '../ui/types.js';

export type UiRootTarget = Readonly<{ kind: 'leaf'; id: string }> | Readonly<{ kind: 'row'; listId: string; key: string }>;
export interface UiRootContent {
    readonly content: DisplayObjectContainer;
    readonly visible: boolean;
    readonly bindingGeneration?: number;
    readonly contentVersion?: number;
}
export interface UiRootAccess {
    readonly wrapper: DisplayObjectContainer;
    state(): 'open' | 'closed';
    snapshot(): UiSnapshot;
    lookup(target: UiRootTarget): UiRootContent | undefined;
    retain(listId: string, key: string): RowRetention;
    onClose(callback: () => void): () => void;
}
const roots = new WeakMap<object, { engine: object; access: UiRootAccess }>();
/** Root construction installs identity once. This is not a public structural root adapter. */
export function registerUiRoot(root: UiRoot, engine: object, port: Omit<UiRootAccess, 'onClose'>): () => readonly unknown[] {
    const listeners = new Set<() => void>(); let closed = false;
    const access: UiRootAccess = Object.freeze({ ...port, onClose(callback: () => void) {
        if (closed || port.state() !== 'open') throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');
        if (listeners.size >= 128) throw new EgretError('UI_LIMIT');
        listeners.add(callback); return () => { listeners.delete(callback); };
    } });
    roots.set(root, { engine, access });
    return () => {
        if (closed) return Object.freeze([]);
        closed = true; const errors: unknown[] = [], current = [...listeners]; listeners.clear();
        for (const callback of current) try { callback(); } catch (cause) { errors.push(cause); }
        return Object.freeze(errors);
    };
}
export function requireUiRoot(root: unknown, engine: object): UiRootAccess {
    const record = roots.get(root as object);
    if (record === undefined || record.engine !== engine) throw new EgretError('UI_TEXT_EDITOR_ROOT_INVALID');
    if (record.access.state() !== 'open') throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');
    return record.access;
}
