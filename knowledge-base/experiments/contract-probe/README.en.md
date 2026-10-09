# First Round Architecture Contract Research Prototype

English | [简体中文](README.md)

These programs validate executable contracts for local layout, draw order, mirror protocol, and resource lifecycle. They are research code, not Egret product implementation, actual cross-language bridging, or GPU performance.

Run `node run.mjs` here. `../../evidence/contract-probe-results.json` contains seeds, environment, cases, and source digests. Layout uses independent full calculation. Adjacent batches are expanded through the same per-command CPU compositor to check ordering; no independent batch-state consumer exists yet. Deliberately wrong-strategy counterexamples are included. Node counts are algorithmic work, not FPS/speed multipliers.

Fixed experiment parameters: eight independent layout regions,128 objects each,200 seeded change rounds; command-queue capacity three. These support reproduction, not final engine scale/ABI/queue/performance commitments.

After 17 initial passes, independent audit found omissions. Seven first-group cases initially failed, then 24 passed after correction. Two second-group lease cases initially failed, then 26 passed. Initial/first failure/intermediate correction/second failure source is in `history/initial/`, `history/audit-red/`, `history/audit-green-1/`, `history/audit-red-2/`. Corresponding JSON is in knowledge-base-root `evidence/`; see [validation record](../../docs/技术验证记录.en.md). For historical reproduction, place both source files in an equivalent temporary directory structure to avoid relative outputs overwriting current results.

Mirror event represents consumed graphics notifications only, without must-deliver-event recovery. Resource complete simulates combined load/upload callbacks; owners are a set, without full per-lease counts, separate decode, or real asynchronous GPU reconstruction. Current passes cover only reported model behaviors.
