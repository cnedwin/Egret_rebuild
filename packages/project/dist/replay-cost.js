// Restore charges the retained target's complete prefix, never the target's
// local snapshot cost. This single termwise rule serves live and journal replay;
// reconstruction does not recursively recalculate accounting.
export function nextPrefixCost(previous, commandNodes, snapshotNodes, targetCost, limit) {
    const ceiling = limit + 1;
    let cost = 0;
    for (const term of [previous, commandNodes, snapshotNodes, targetCost ?? 0]) {
        if (term >= ceiling - cost)
            return ceiling;
        cost += term;
    }
    return cost;
}
//# sourceMappingURL=replay-cost.js.map