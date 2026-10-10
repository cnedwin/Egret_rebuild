// Restore charges the retained target's complete prefix, never the target's
// local snapshot cost. This single termwise rule serves live and journal replay;
// reconstruction does not recursively recalculate accounting.
export function nextPrefixCost(previous: number, commandNodes: number, snapshotNodes: number, targetCost: number | undefined, limit: number): number {
  const ceiling = limit + 1;
  let cost = 0;
  for (const term of [previous, commandNodes, snapshotNodes, targetCost ?? 0]) {
    if (term >= ceiling - cost) return ceiling;
    cost += term;
  }
  return cost;
}
