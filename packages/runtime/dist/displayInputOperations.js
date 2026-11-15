import { dispatchDisplayInputEvent } from "./EventDispatcher.js";
import { EgretError } from "./EgretError.js";
import { queryDisplayHit } from "./displayHitTest.js";
import { assertLive, isDisplayNode, isStageRoot, isTerminated, parentOf } from "./displayTreeState.js";
import { engineOf } from "./ownership.js";
/** Bind only a genuine Stage and its existing private Engine affinity. */
export function createDisplayInputOperations(stage) {
    if (!isStageRoot(stage))
        throw new EgretError("HIT_TEST_RECEIVER_INVALID");
    assertLive(stage);
    const context = engineOf(stage);
    if (context === undefined || parentOf(stage) !== undefined)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    const engine = context;
    engine.assertOpen();
    function routeToStage(target, maxNodes) {
        // Root and Engine failures retain their existing identity before target refusal.
        assertLive(stage);
        engine.assertOpen();
        if (engineOf(stage) !== engine || parentOf(stage) !== undefined)
            throw new EgretError("DISPLAY_TREE_INVARIANT");
        if (!Number.isFinite(maxNodes) || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 65536) {
            throw new EgretError("HIT_TEST_INPUT_INVALID");
        }
        if (!isDisplayNode(target))
            throw new EgretError("DISPLAY_TREE_INVARIANT");
        if (isStageRoot(target) || isTerminated(target) || engineOf(target) !== engine)
            return undefined;
        const seen = new Set();
        const route = [];
        let current = target;
        for (;;) {
            if (seen.size >= maxNodes)
                throw new EgretError("HIT_TEST_TREE_LIMIT");
            if (!isDisplayNode(current) || seen.has(current))
                throw new EgretError("DISPLAY_TREE_INVARIANT");
            if (isTerminated(current) || engineOf(current) !== engine)
                return undefined;
            seen.add(current);
            route.push(current);
            if (current === stage)
                return route;
            if (isStageRoot(current))
                return undefined;
            // The target and captured Stage both count; debit before reading a parent.
            if (seen.size >= maxNodes)
                throw new EgretError("HIT_TEST_TREE_LIMIT");
            const parent = parentOf(current);
            if (parent === undefined)
                return undefined;
            current = parent;
        }
    }
    return Object.freeze({
        pick(x, y, maxNodes) {
            // Reuse HT1's complete structural and arithmetic admission unchanged.
            return queryDisplayHit(stage, x, y, { maxNodes });
        },
        isAttached(target, maxNodes) {
            return routeToStage(target, maxNodes) !== undefined;
        },
        dispatch(target, event, maxNodes) {
            const route = routeToStage(target, maxNodes);
            if (route === undefined)
                return false;
            // No public dispatch, lifetime, parent or candidate hook is input authority.
            return dispatchDisplayInputEvent(target, event, route.slice(1));
        }
    });
}
//# sourceMappingURL=displayInputOperations.js.map