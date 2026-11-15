// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const roots = new WeakMap();
/** The genuine root installs all ports once; structural copies grant no authority. */
export function registerUiRoot(root, engine, port) {
    const listeners = new Set(), interactions = new Set();
    let closed = false, layerOwner, dismiss;
    function open() {
        if (closed || port.state() !== 'open')
            throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');
    }
    const access = Object.freeze({
        ...port,
        onClose(callback) {
            open();
            if (listeners.size >= 128)
                throw new EgretError('UI_LIMIT');
            listeners.add(callback);
            return () => {
                listeners.delete(callback);
            };
        },
        onInteractionChange(callback) {
            open();
            if (interactions.size >= 128)
                throw new EgretError('UI_LIMIT');
            interactions.add(callback);
            return () => {
                interactions.delete(callback);
            };
        },
        editorInteractive() {
            const value = port.layerState();
            return !closed && port.state() === 'open' && value.visible && value.keyboardEnabled;
        },
        notifyInteraction(policy) {
            if (!port.layerState().lifetimeOpen)
                return Object.freeze([]);
            const errors = [], active = access.editorInteractive();
            for (const callback of [...interactions]) {
                if (closed)
                    break;
                if (!interactions.has(callback))
                    continue;
                try {
                    callback(active, policy);
                }
                catch (cause) {
                    errors.push(cause);
                }
            }
            return Object.freeze(errors);
        },
        claimLayer(owner, callback) {
            open();
            if (layerOwner !== undefined)
                throw new EgretError('UI_LAYER_ROOT_OWNED');
            layerOwner = owner;
            dismiss = callback;
            port.layerOwnership(true);
            return () => {
                if (layerOwner === owner) {
                    port.layerOwnership(false);
                    layerOwner = undefined;
                    dismiss = undefined;
                }
            };
        },
        requestDismiss() {
            return !closed && dismiss !== undefined ? dismiss() : false;
        }
    });
    roots.set(root, { engine, access });
    return () => {
        if (closed)
            return Object.freeze([]);
        closed = true;
        port.layerOwnership(false);
        layerOwner = undefined;
        dismiss = undefined;
        interactions.clear();
        const current = [...listeners];
        listeners.clear();
        const errors = [];
        for (const callback of current)
            try {
                callback();
            }
            catch (cause) {
                errors.push(cause);
            }
        return Object.freeze(errors);
    };
}
export function requireUiRoot(root, engine) {
    const record = roots.get(root);
    if (record === undefined || record.engine !== engine)
        throw new EgretError('UI_TEXT_EDITOR_ROOT_INVALID');
    if (record.access.state() !== 'open')
        throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');
    return record.access;
}
//# sourceMappingURL=uiRootState.js.map