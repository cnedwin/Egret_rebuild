# Nested UI Invalidation and Rectangular Hit Testing Research Model

English | [简体中文](README.md)

An actually executed pure-Node model with an independent test-side full oracle. It adds ancestor dimensions, sibling positions, structural edits, and hit relationships absent from the first fixed-eight-region model. This is not complete EUI, real text, or engine-performance acceptance.

## Reproduction

Run from the knowledge-base directory without dependency installation:

```powershell
node 'experiments/nested-ui-probe/run.mjs'
node 'experiments/nested-ui-probe/run.mjs' --unsafe-isolation
```

The first overwrites current passing results; the second runs a deliberately broken test-side isolation policy, writes a separate failure report, and expects exit 1. Do not overwrite historical red baselines using current-source `--red`/`--audit-red`. Reports include UTC execution time, environment, per-case results, limits, model/run SHA256. Initial red, initial green, audit red, and incorrect-isolation reports also embed their execution-time source for hash review. No historical zip needs retention/execution.

## Bounded semantics

- Nodes have unique string IDs and vertically ordered children. Each width/height is a nonnegative finite fixed value, `content`, or a same-axis reference `{ref: '节点ID', factor: 非负数}`. Defaults are content/factor 1. No arbitrary percentages, constraint solver, flex/grid, anchors, rotation, or scaling.
- Research budgets: 128 nodes; fixed dimensions/padding/gap/glyph advances/wrapWidth/lineHeight≤1e6; reference factor≤8; glyphWidths≤4096, with an own numeric value at every index. Candidate validation atomically rejects excess/sparse arrays. Two 1e308 heights are unsupported despite individual finiteness; arbitrary finite input does not guarantee finite layout. For a128-node acyclic dimension graph, conservative bound `B(d) <= 128*B(d-1)+1e10` with depth≤128 keeps dimension/world-coordinate sums below JS numeric limits, avoiding hidden full dimension solving per transaction. Current fixtures are integers; arbitrary fractional error, scale, and deep recursion are not proven.
- Uniform padding applies on all sides. Content width is maximum visible direct-child width plus twice padding. Content height sums visible direct-child heights, gaps between adjacent visible children, and twice padding. Fixed dimensions do not automatically stretch/shrink/clip children. World coordinates accumulate ancestor translations; root is(0,0).
- Hidden nodes/descendants cannot hit. Hidden direct children occupy no parent flow space but retain measured sizes/tree identity. Hide/restore, insert/delete, and reparent update relevant size dependencies/positions. Same-parent reparent index addresses the list after removal.
- Same-axis dependencies include content children/explicit references. Validate the complete graph before commit; reject reverse-descendant references creating content-ancestor cycles, tree cycles, self/descendant reparenting, duplicate IDs, missing references, and invalid fixtures. Edit a candidate copy before validation/commit. Rejection preserves source tree, cached dimensions, world rectangles; diagnostics still count actual attempted work and do not promise rollback.
- clip is the node's world rectangle intersected with every ancestor clip. Unclipped parents do not implicitly clip overflow. Hit testing reverses depth-first display order, returning the first visible ID inside bounds/effective clip. Left/top inclusive, right/bottom exclusive; containers also hit. Call `flush()` before `hit()` after changes. No bubbling, pointer capture, arbitrary masks, or spatial index.
- Text accepts external `glyphWidths`, fixed `wrapWidth`/`lineHeight` only. Greedy fixture-width wrapping never splits an advance wider than wrapWidth; empty fixtures still have one line. Content dimensions use line widths/counts plus padding; fixed dimensions remain independent of fixture wrapping. No font loading, fallback discovery, Unicode segmentation, shaping, CJK, emoji, or IME; do not claim these were verified.

## Incremental algorithm and oracle independence

`model.mjs` keeps same-axis caches/reverse dependency tables and marks related dimensions along the union of old/new dependencies. flush recalculates dirty dimensions while reusing unchanged branches. Relevant containers update direct-child local positions, then world rectangles/visibility/clips propagate. Fixed ancestors stop dimension-value dependencies, but child positioning still depends on changes: they are not a legal whole-subtree propagation boundary.

All current structural/property transactions clone/validate the entire source tree/dependency graph. Changed frames still traverse every node for world state. Incrementality applies only to dimension caching/some direct-child arrangement, not complete local world updates. Stationary flush skips dimension/world solving but copies N snapshot records. These fallbacks/serialization costs cannot be hidden in speed claims.

`run.mjs` oracle reads only source, builds a flat index from scratch, independently resolves complete dimensions by axis using pending sets, and computes rectangles directly from world cursors. Hits use separate clipped-boundary checks. It imports no model helpers or caches. Hand-calculated constants independently anchor root height 75→85, sibling coordinate 19→29, reparenting, text lines, and clip edges to reduce shared semantic mistakes.

## Actual results and counterexamples

Current 18 passes/0 failures include stationary/sparse/full invalidation, fixed ancestors, hide/restore, insert/delete, reparenting, taller external text fixtures, explicit size references, atomic rejection of two cycle types, rectangle clipping/half-open hits, invalid input, sparse glyph arrays/numeric budgets, and 100 seeded mixed edits. Each edit adds 12 hit comparisons, totaling 1,200, plus six fixed hits per oracle comparison.

Initial red: 1 pass/15 failures. Unimplemented model returned empty real rectangles, failing oracle layouts; embedded source remains. Its pass was an independent negative control, not model success. Initial implementation then passed 16, with separate results/source. Independent review found sparse-array bypass of Array.some and finite-sum overflow. Two new cases actually yielded 16 passes/2 failures. Audit red was retained before dense-index/budget fixes produced 18 passes.

After correction, actual incorrect-isolation run produced 16 passes/2 failures. Test-side policy discarded dimension/arrangement invalidation outside subtree a after a1 changed; sparse/seeded-edit cases diverged from oracle. Sparse example incorrectly keeps root height 75 instead of 85, b.y39 instead of 49, tail.y66 instead of 76. Current green reports also retain per-node incorrect/correct rectangle comparisons. Arbitrary “isolated subtree” labels miss ancestor dimensions/sibling positions.

## Operation observations

Eight-node hand-built tree uses 16 dimension calculations initially/full-invalidated, counting width/height separately; taller sparse a1 uses six versus oracle 16. Sparse edits still clone eight nodes, validate eight nodes/16 dimension-dependency nodes, and traverse eight world states. Stationary uses zero dimension/world evaluations but copies eight outputs.

Per-case reports list source-copy nodes, edit-search visits, tree/dependency nodes/edges, invalidation visits, dimension evaluation/dependency reads, direct-child arrangement, world evaluations/actual writes, clip intersections, and snapshot copies. Fixed hits separately record actual boundary scans. Different counting units cannot be summed into CPU time. Array/JSON costs are not counted by bytes; oracle/test assertions are not production-cost comparisons.

No timing, FPS, speed multipliers, browser, or GPU image-quality checks. Complete EUI, actual fonts, asynchronous measurement, numbers/scales outside budgets, extreme recursion, list virtualization, runtime-object reuse, and real host devices remain uncovered.100 fixed-seed steps do not exhaust the state space. Conclusions support dependency-contract research only.

## Evidence files

- [Current results](../../evidence/nested-ui-probe-results.json)
- [Initial red/source](../../evidence/nested-ui-probe-red-results.json)
- [Initial 16 passes/source](../../evidence/nested-ui-probe-initial-green-results.json)
- [Audit counterexample failures/source](../../evidence/nested-ui-probe-audit-red-results.json)
- [Incorrect-isolation failures/source](../../evidence/nested-ui-probe-unsafe-isolation-results.json)
