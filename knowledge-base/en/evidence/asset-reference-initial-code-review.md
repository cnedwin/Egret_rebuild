# Phase 3 independent code review — initial

**Spec compliance: changes required. Quality: changes required.** Two bounded lifecycle defects need correction before accepting this reference chain. The existing 12 / 12 green result remains valid for its actual cases; those cases omit the affected demo and initialization-failure paths.

## Necessary corrections

1. **R1 / P2 — pending demo ownership is missing.** `experiments/asset-reference-probe/probe.js:12` assigns `demoChain` after awaiting creation. Two clicks before resolution both start a renderer and schedule a frame loop; the second owner overwrites the first without disposal, and both loops overwrite the single `raf` ID. Stopping cancels only one loop and the other can read a null owner. `pagehide` at line 13 during loading likewise cannot dispose or invalidate the late result. Add a pending-start guard and abort/generation ownership, dispose stale results, bind the sole frame loop to the active owner, and restore the button on failure. Test the actual demo handler with a delayed real load, double-start and pagehide before resolution.

2. **R2 / P2 — initialization failure does not unwind adapter resources.** `reference-chain.mjs:27` calls `createUIPass` after parsing and creating the renderer, before any cleanup path exists. A UI compile/link/initial-text failure rejects creation while leaving the renderer and its canvas listeners alive, with no returned chain to dispose. `ui-pass.mjs:6`, `:15`, and `:37` also lack rollback for partial shaders/program/VAO/texture. Add bounded exception-safe ownership cleanup around initialization, preserving the original error; delete partial UI allocations and dispose a successfully constructed renderer and parsed bundle. Validate one controlled UI failure after real parsing/render allocation plus failed-shader cleanup. This asks for cleanup of this adapter's acquisitions, not an exhaustive upstream failure framework.

## Evidence independently checked

- Inspected actual eight authored modules/docs, implementation requirements and report, source/license audit, browser reports and mutation evidence.
- Recomputed the current run's 17 source hashes: all match. Current integration replay `352277fd-10d5-499e-80c4-dbe024495e5c` reports 12 executed / 12 passed / 0 failed, no page errors or console diagnostics.
- Recomputed 12 historical report hashes and 202 snapshot source hashes: zero mismatches. Four mutations are rejected by their intended behavioral tests. The no-reset mutation fails on GL error 1282; the restore mutation fails on missing/different Canvas text pixels.
- This reviewer ran read-only Node metadata checks only, not browser or third-party code. Runtime observations come from the inspected reports, including the fresh integration replay. The detailed JSON records the exact reviewed file hashes.

## Accepted behavior and boundaries

The real loader/clone/mixer/renderer chain, shared bundle lifetime, independent instance pose, explicit UI/renderer handoff, raw-text epoch cache and actual context-loss recovery are supported by code and relevant oracles. Restore requires nonblank 3D pixels and bright native-text pixels in addition to equality; blank frames cannot satisfy those assertions. Lost-context geometry/skeleton disposal invalidates GPU allocations while keeping the CPU bundle and shared ownership alive; final `releaseShared` is a separate operation. No heap/GC proof is claimed.

The loopback server uses an exact whitelist, random write token, fixed report path and request-size cap. The runner preserves individual run reports and records their source hashes. A nonblocking evidence concern is that it writes JSON before demo startup, so subsequent demo errors influence process exit without being serialized back to that JSON. R1 regression evidence should explicitly cover the demo.

`requiredProfile` describes the configured allowlist, not tested extension compatibility; the executed real asset has no required extensions. Font caching does not prove font coverage. Current recovery evidence concerns the untextured test asset and a small Canvas UI. Phones, timing/power, full UI, 2D bones, KTX2, font/IME acceptance and full migration remain outside scope. Neither Gate D/H nor product completion follows from this review.
