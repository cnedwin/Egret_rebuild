# Project transaction core implementation evidence

[简体中文](../../Cns/docs/工程事务核心实现证据.md) | English

The local 0.14.0 engineering-preview candidate implements the [headless project contract](project-transaction-core-contract.md). Historical independent normative draft PASS is separate from implementation results. Six implementation checkpoints received scoped independent SPEC-compliant / QUALITY-approved reviews; this author-written audit/memory/documentation milestone still requires fresh independent immutable review and a whole-branch review. Public delivery remains pending at this documentation-authoring checkpoint; subsequent delivery evidence is tracked separately. The preview neither establishes API stability nor completes editor/migration/native/production acceptance.

## Implementation and verification scope

First-party code was authored with Codex assistance. Schema generation, descriptor-safe input, exact integer-token checks, canonical bytes, generated-node ordered semantics, portable path validation, atomic edits/retries, explicit-stack restore and sequential journal admission remain first-party responsibilities. Microsoft `jsonc-parser` 3.3.1/MIT supplies public-root scanner/visitor only. The source record (repository-root `source-origin.json`) retains the exact historical specification identity and dependency artifact SHA256 4a0315b8671e7463bae7af7c142cdf19e9aa7ba39eb36dc2df383b8648e3cbc9; NOTICE (repository-root `NOTICE`) and the unchanged Microsoft notice (repository-root `third-party/jsonc-parser-3.3.1.LICENSE`) preserve attribution. Apache-2.0 remains the first-party license.

Accepted Task5 checkpoint 43c66101bf5791ff9039162eabd980d248e2b8c0 recorded276/276 tests, generator21, boundary207 and28 expected compiler negatives. Accepted Task6 checkpoint fafbe32d1601b5b230dcb4a38e5fdeb50a657b4f recorded312/312 full tests,36/36 focused integration checks and56 expected negative diagnostics:23 core+5 web+28 project. All29 public type names and six runtime values are checked separately from those diagnostic counts. Actual built-root denied-host evidence reaches25 project and six shipped dependency modules with zero trapped host accesses; a separately disclosed four-entry instrumented mode observes no store-authority calls during import. Pure constant/cache initialization is permitted. These historical checks were not browser or production-performance tests.

Current `node --test tests/project-oracles.test.mjs` passed 20/20: 10 public behavior checks plus 10 isolated sensitivity cases. Handwritten complete snapshot/diff/receipt/journal literals and arithmetic are independent of production serializer/validator/diff/replay helpers. Copied real build artifacts and copied installed dependency bytes detect reversed UTF-16 order, getter evaluation, Number-only integer acceptance, CAS-before-retry, omitted empty-history admission, duplicate journal retry, retirement rewind, local target P, recursive target-P omission and premature head publication. Every mutated child must fail a named assertion; restored-copy checks pass and active artifact hashes remain equal. Early inherited test-context and copied-dependency setup failures are retained privately and are not credited as meaningful mutation REDs. No product behavior was changed in this milestone.

The exact tool/a fixtures have baseline238 bytes/B27, empty history298 bytes, edit393 bytes/C1=48, restore212 bytes/C2=25, one-command history691 and two-command history904. S1=S2=27; P1=102 and P2=181; public checks pin181/180 and nested564/563. The complete empty wrapper33 nodes is distinct from B27. Earlier creator/t fixtures retain396/215/694 bytes with the same node/work counts, and the roots-only40-node fixture remains distinct. Equal counts do not establish equal bytes or retry identities. Root/reference/operation order remains authored; identity collection/scope permutations normalize. Selected numeric, malformed-identity, local unknown-field, collection and sequential-history error order remain contractual.

## Separate process memory observations

Command: `node --expose-gc tools/measure-project-memory.mjs --output <private-memory.json>`. Nine separate child processes used actual public APIs on Node 24.19.0/win32/x64, Windows build10.0.26300, Intel Core Ultra9 275HX,24 logical CPUs, total RAM68050006016 bytes. Defaults are used, except the alias case sets maxSnapshotUtf8Bytes1024. Each result records exact environment/config/fixture/outcomes/wall time and samples. Raw results and account/device paths remain private.

| Case | Recorded fixture bytes | Wall ms | Sampled heap bytes | Sampled RSS bytes | Largest observation gap ms |
|---|---:|---:|---:|---:|---:|
| baseline-only | 238 | 6.962 | 6449336 | 52047872 | 1.8359 |
| small-entity-count | 9189127 | 8332.281 | 1071184632 | 1501483008 | 3849.7498 |
| small-file-count | 8328017 | 3907.578 | 471532200 | 624578560 | 1837.0103 |
| near-snapshot-bytes | 16777216 | 312.372 | 77405232 | 151232512 | 177.5440 |
| near-history-bytes | 66070214 | 5864.571 | 670633448 | 935874560 | 3237.4693 |
| shared-live-alias-rejection | 1155 | 4.784 | 5879472 | 51810304 | 1.8976 |
| long-edit-journal | 407680 | 14295.576 | 116783736 | 291381248 | 7058.9561 |
| nested-restore-journal | 3905 | 3084.358 | 34012056 | 106831872 | 1016.7305 |
| adversarial-text | {"depth":40001,"exponent":4335,"duplicate":253} | 6.381 | 6106968 | 52318208 | 1.9245 |

The baseline creates/exports/reopens. Default100000 small entities and50000 small files create/export/reopen; count+1 rejects. Snapshot16777216 bytes accepts and16777217 rejects. History66070214 bytes exports/reopens after16 large edits; command17 rejects. The three-occurrence shared alias expands to1155 bytes and rejects under1024. Plain edits1024 commit,1025 rejects; nested restores accept through P5046220 and reject P10092492, then export/reopen. Adversarial depth40001-byte text,4096-digit exponent4335-byte text and decoded-duplicate253-byte text reject with bounded diagnostics. No prescribed case is missing from this observation run.

Configured caps are admission bounds, not RAM guarantees. The100000-entity case sampled heap 1071184632/RSS 1501483008 bytes; OS-reported lifetime maxRSS was1639364KiB and includes imports/fixtures. The nominal interval is10ms, but the maximum measured gap is7058.9561ms because synchronous calls block polling. Before/after-call and GC samples can miss transient heap/RSS peaks; OS lifetime RSS is separate from sampled values and does not localize an API peak. The table's wall time includes fixture allocation and final GC; it is not a production benchmark or target budget. No true peak-memory completeness, performance acceptance, RAM threshold or universal OOM guarantee is certified.

## Module and product limits

Native Node bare-root `@egret/project` import and scanner/visitor named imports interoperate with shipped CommonJS without VM flags. Direct native import of the dependency's shipped ESM entry fails on extensionless internal imports. The VM linker/CJS bridge is simulated integration evidence; real bundler/browser delivery, worker/native SDK and tree shaking remain unaccepted. Known Experimental VM Modules warnings are retained exactly, with successful unexpected-stderr rejection controls; the runs are warning-qualified, not warning-free.

Unknown kinds/domain schemas, file content/digest/authorization, authenticated history, crash-safe storage, actual filesystem aliases/containment and Proxy side-effect isolation remain unchecked or unsupported. Final integrated prepush is pending at this evidence-authoring checkpoint; structural hashes/links/compiler/knowledge-base checks cannot replace manual bilingual meaning or release authorization. No browser rerun is implied. Historical 0.13 WebGPU identities/results remain unchanged. V003/editor, phones/native/3D/production performance and complete R008/V006 import→independent editable project→equivalent gameplay→continued visual/code/AI editing→real target publication/update remain pending.
