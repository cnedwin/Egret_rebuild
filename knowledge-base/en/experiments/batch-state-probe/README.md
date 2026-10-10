# Independent Batch State Experiment

English | [简体中文](../../../Cns/experiments/batch-state-probe/README.md)

Run `node run.mjs` in this directory; results go to knowledge-base `evidence/batch-state-probe-results.json`. The full per-pixel reference reads individual command state, while an independent batch consumer actually reads texture/pipeline/clip from batch headers. They share no composition function.

The deliberately texture-only initial implementation actually ran eight cases: five passes/three failures, exposing missed clipping/blending boundaries and invalid-input acceptance. Failing source: `history/red/`; results: `evidence/batch-state-probe-red-results.json`, relative to knowledge-base root. Current implementation establishes adjacent boundaries by bounded state, splits at geometry capacity, and preserves input order.

Reference scope: rectangles, single texels, straight/additive alpha. Random generation maps high xorshift bits to avoid simple least-significant-bit correlations. Arbitrary masks, filters, stencil, complete materials, GPU timing, and performance comparisons are absent. Actual graphics are in the [second-round validation record](../../docs/round-2-validation-record.md); model passes are not complete-engine batching correctness.

Independent audit also found sparse color arrays bypassing Array.every. A new counterexample produced seven passes/one failure; dense own-index checks yielded eight passes. Intermediate eight-pass and 7/1-counterexample source: `history/pre-audit/`, `history/audit-red/`. Corresponding results: `evidence/batch-state-probe-pre-audit-results.json`, `evidence/batch-state-probe-audit-red-results.json`, relative to knowledge-base root.

Documentation location changed on October 10, 2026. Run the recorded experiment commands from the unchanged shared directory `knowledge-base/experiments/batch-state-probe` relative to the repository root. This reading-file relocation does not rerun the experiment or alter its original evidence.
