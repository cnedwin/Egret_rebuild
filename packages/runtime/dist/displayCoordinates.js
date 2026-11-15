import { isDisplayNode, assertLive, parentOf } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { finite, visualOf } from './displayVisualState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { invertCoordinatePoint } from './coordinateInverse.js';
import { EgretError } from './EgretError.js';
function live(node) {
    assertLive(node);
    engineOf(node)?.assertOpen();
}
function budgetOf(node, options) {
    let requested;
    if (options !== undefined) {
        if (options === null || typeof options !== 'object')
            throw new EgretError('COORDINATE_INPUT_INVALID');
        let array;
        // Admission can itself throw for a revoked Proxy; semantic rejection stays
        // outside the source catch so it is never mistaken for an adapter failure.
        try {
            array = Array.isArray(options);
        }
        catch (cause) {
            throw new EgretError('COORDINATE_INPUT_INVALID', { cause });
        }
        if (array)
            throw new EgretError('COORDINATE_INPUT_INVALID');
        try {
            requested = options.maxNodes;
        }
        catch (cause) {
            throw new EgretError('COORDINATE_INPUT_INVALID', { cause });
        }
    }
    // A successful caller read may mutate, reparent, dispose or close the node.
    // Throwing reads preserve their exact cause without this later recheck.
    live(node);
    const maxNodes = requested === undefined ? 4096 : requested;
    if (!finite(maxNodes) || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 65536) {
        throw new EgretError('COORDINATE_INPUT_INVALID');
    }
    return maxNodes;
}
/** Private identity/state authority excludes getters and subclass hooks. */
export function queryDisplayPoint(receiver, x, y, options, inverse) {
    if (!isDisplayNode(receiver))
        throw new EgretError('COORDINATE_RECEIVER_INVALID');
    const node = receiver;
    live(node);
    const px = x === undefined ? 0 : x, py = y === undefined ? 0 : y;
    if (!finite(px) || !finite(py))
        throw new EgretError('COORDINATE_INPUT_INVALID');
    const maxNodes = budgetOf(node, options);
    const path = [], seen = new Set();
    for (let current = node; current !== undefined; current = parentOf(current)) {
        if (path.length >= maxNodes)
            throw new EgretError('COORDINATE_TREE_LIMIT');
        if (seen.has(current))
            throw new EgretError('DISPLAY_TREE_INVARIANT');
        live(current);
        seen.add(current);
        path.push(current);
    }
    let world = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    for (let i = path.length - 1; i >= 0; i--) {
        world = composeDisplayTransform(world, visualOf(path[i]));
        if (!Object.values(world).every(finite))
            throw new EgretError('COORDINATE_ARITHMETIC_RANGE');
    }
    const result = inverse
        ? invertCoordinatePoint(world, px, py)
        : {
            x: world.a * px + world.c * py + world.tx,
            y: world.b * px + world.d * py + world.ty
        };
    if (!finite(result.x) || !finite(result.y))
        throw new EgretError('COORDINATE_ARITHMETIC_RANGE');
    for (const current of path)
        live(current);
    return Object.freeze({ x: result.x === 0 ? 0 : result.x, y: result.y === 0 ? 0 : result.y });
}
//# sourceMappingURL=displayCoordinates.js.map