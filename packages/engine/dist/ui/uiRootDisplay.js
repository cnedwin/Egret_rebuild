// SPDX-License-Identifier: Apache-2.0
import { Sprite } from '@egret/runtime';
const freeze = Object.freeze;
export function createUiRootDisplayDraft(pool, shells, finalKeys) {
    const updates = [], nextBindings = new Map(), nextShells = new Map(), freshShells = [], fillScopes = [], rows = [];
    const available = [...pool, ...[...shells].filter(([key]) => !finalKeys.includes(key)).map(([, s]) => s)];
    const childWrappers = [];
    return { updates, nextBindings, nextShells, freshShells, fillScopes, rows, available, childWrappers };
}
/** Append detached display updates in the root transaction's original paint order. */
export function stageUiRootDisplay(draft, preparation) {
    const { updates, nextBindings, nextShells, freshShells, fillScopes, rows, available, childWrappers } = draft;
    const { w, finalKeys, view, shells, port, display, tree, listWrapper, listId, rootWrapper, layerOrigin, position, size, layerVisible, layerPointer } = preparation;
    let priorIndex = -2, priorEnd = 0;
    for (const key of finalKeys) {
        const b = w.bindings.get(key), i = view.indexOf(key), top = i === priorIndex + 1 ? priorEnd : view.prefix(i), y = top - w.scroll, h = view.heightAt(i), visible = y + h > 0 && y < w.height;
        priorIndex = i;
        priorEnd = top + h;
        const shell = shells.get(key) ??
            available.shift() ??
            (() => {
                const scope = port.scope(port.createScope());
                const item = {
                    scope,
                    wrapper: display.createWrapper(scope.scope)
                };
                freshShells.push(item);
                return item;
            })();
        nextBindings.set(key, b);
        nextShells.set(key, shell);
        childWrappers.push(shell.wrapper);
        updates.push({
            wrapper: shell.wrapper,
            x: 0,
            y,
            visible,
            children: [b.wrapper],
            touchEnabled: false,
            touchChildren: true
        });
        updates.push({
            wrapper: b.wrapper,
            x: 0,
            y: 0,
            visible,
            children: [b.content],
            hitArea: {
                x: 0,
                y: 0,
                width: w.width,
                height: h
            },
            touchEnabled: visible,
            touchChildren: false
        });
        rows.push(freeze({
            key,
            index: i,
            bindingGeneration: b.generation,
            contentVersion: b.version,
            box: freeze({
                x: w.box.innerX,
                y: w.box.innerY + y,
                width: w.width,
                height: h
            }),
            visible
        }));
    }
    const rootChildren = [], paintOrder = new Map();
    for (const [paintIndex, box] of w.plan.boxes.entries()) {
        const node = tree.nodes.get(box.id);
        if (node.kind === 'leaf' && node.fill !== undefined) {
            const scope = port.scope(port.createScope());
            fillScopes.push(scope);
            const shape = new Sprite();
            scope.use(shape);
            const color = node.fill;
            shape.graphics
                .beginFill(color.color, color.alpha ?? 1)
                .drawRect(0, 0, box.width, box.height)
                .endFill();
            const wrapper = display.createWrapper(scope.scope);
            updates.push({
                wrapper,
                x: box.x,
                y: box.y,
                children: [shape],
                touchEnabled: false,
                touchChildren: false
            });
            rootChildren.push(wrapper);
            paintOrder.set(wrapper, paintIndex);
        }
    }
    for (const [paintIndex, box] of w.plan.boxes.entries()) {
        const binding = w.leafBindings.get(box.id);
        if (binding === undefined)
            continue;
        updates.push({
            wrapper: binding.wrapper,
            x: box.innerX,
            y: box.innerY,
            children: [binding.content],
            hitArea: { x: 0, y: 0, width: box.innerWidth, height: box.innerHeight },
            touchEnabled: false,
            touchChildren: true
        });
        rootChildren.push(binding.wrapper);
        paintOrder.set(binding.wrapper, paintIndex);
    }
    if (w.box !== undefined && listWrapper !== undefined) {
        rootChildren.push(listWrapper);
        paintOrder.set(listWrapper, w.plan.boxes.findIndex(box => box.id === listId));
        updates.push({
            wrapper: listWrapper,
            x: w.box.innerX,
            y: w.box.innerY,
            clipRect: {
                x: 0,
                y: 0,
                width: w.width,
                height: w.height
            },
            children: childWrappers,
            touchEnabled: false,
            touchChildren: true
        });
    }
    updates.push({
        wrapper: rootWrapper,
        x: layerOrigin?.x ?? position.x,
        y: layerOrigin?.y ?? position.y,
        clipRect: {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height
        },
        children: rootChildren,
        visible: layerVisible,
        touchEnabled: false,
        touchChildren: layerPointer
    });
    rootChildren.sort((a, b) => paintOrder.get(a) - paintOrder.get(b));
}
//# sourceMappingURL=uiRootDisplay.js.map