# Legacy RES planner CPU verification evidence

[简体中文](legacy-res-plan-evidence.zh-CN.md) · [Contract](legacy-res-plan-contract.en.md)

The current `packages/project/src/legacy-res-plan.ts` passed a build and **14/14 focused tests**, with zero failures or skips, in `tests/legacy-res-plan.test.mjs`. The saved fixed-runtime Node.js run exited zero, closed its direct process and ended both output streams; selected source/test identities remained stable. An independent source-only review also found no issues; that review did not execute tests and is distinct from the actual run.

The focused tests cover first-occurrence file deduplication, aliases and type preservation, resource/group order and repeated references, a recognized empty manifest, fresh deeply frozen results, primitive input refusal, strict JSON and path precedence, nested prefixes, Unicode/collision rules, unsupported schemas and formats, unresolved keys, warning order and late-invalid paths. A synchronous fault injected into `JSON.parse`, restored afterward, checks an `incomplete` result with no plan. These tests operate on text and declarations, not real asset files.

The planner preserves the analyzer report and its diagnostics. A planned result is a complete set of conversion intentions for the admitted subset; it is not a successful migration or content certificate. File existence, decoding, execution and migration remain `unverified` in that report.

## Combined repository verification

The verified combined source set passed `tools/verify.mjs`: build, boundary checks over 282 source/build/declaration files, type checks and **901/901 tests**. Failures, cancellations, skips and todos were all zero. Saved supervision records show zero exit, complete stdout/stderr, the owned Job reaching active-zero and closing, and stable selected source identities. This is evidence for that selected source/runtime invocation, not a universal operating-system ancestry or resource guarantee.

An earlier default repository attempt produced **900/901 passes, one failure**. The Host test's default Node24.19 worker-argument guard failed before any of its thirteen direct drivers launched. That failure is retained as history. After the guard correction, the default Host focused run passed all thirteen cases and the full successor above passed; the earlier successful isolation-none Host run is a distinct invocation, not a substitute for this repair.

## Source identity

| Subject | Bytes | SHA-256 |
| --- | ---: | --- |
| Planner source | 3,782 | `b1149868f617583ae74860405fbe468e70b32b51940e308741962891eed789a7` |
| Focused test | 12,345 | `d1e8d5247396f624b718aeaf4cd7715ac70c91341f47c1cd84e9dd60dbbdef6e` |

The [local compact evidence index](../evidence/legacy-res-plan-cpu-evidence.json) contains the reconciled actual source/run projection. GitHub publication remains pending.

## Open verification

The internal planner is not exposed through the project package barrel. The planner and its focused mapping tests perform no actual legacy-asset copying/decoding; whole-repository regression success does not establish complete legacy-game conversion, runtime equivalence or platform delivery. Native-pixel and device/performance validation remain unrun/unverified; font and DragonBones validation remain unverified. Egret's first-party implementation keeps legacy declaration compatibility scoped to explicit semantics so later execution can be validated separately.
