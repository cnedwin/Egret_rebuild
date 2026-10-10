# Project transaction core

English | [简体中文](README.zh-CN.md)

`@egret/project` provides a synchronous headless project transaction core: immutable authored snapshots, atomic edits, retained-target restore, durable retry through canonical journals and bounded admission. The private workspace package remains version `0.0.0`; project/history/tool protocols remain `1.0`. It depends on `@egret/contracts` and the exact parser dependency described below. Editor, legacy migration and target delivery acceptance remain separate.

## Public API

The root exports exactly `DEFAULT_PROJECT_LIMITS`, `parseProjectSnapshot`, `serializeProjectSnapshot`, `parseProjectTransaction`, `createProjectStore` and `openProjectHistory`, plus 29 type-only declarations. A store exposes `limits`, `earliestRevision`, `getSnapshot`, `commit` and `exportHistory`. Expected failures return bounded diagnostics; committed and replayed results include immutable receipts. These experimental interfaces do not assert API stability.

The [complete contract](../../knowledge-base/en/docs/project-transaction-core-contract.md) defines every field, operation, diagnostic, limit and public signature. The [implementation evidence](../../knowledge-base/en/docs/project-transaction-core-evidence.md) separates historical scoped reviews, current oracle checks and memory observations. Import from the package root; private helpers and deep imports are unsupported.

## Authored authority and limits

The single authored format authority is [project-format.schema.json](../contracts/schema/project-format.schema.json). The closed generator emits readonly contract types and private ordered descriptors with source-pointer/hash provenance. Run `node tools/generate-project-format.mjs --check` from the repository root to check drift; normal generation follows schema edits. Structural schema agreement alone does not establish semantic validity.

Strict text adapters reject decoded duplicate keys, lone surrogates and trailing input; exact mathematical tokens control integer validation before Number rounding. Live adapters inspect checked own data descriptors, never getters, and charge every expanded shared alias. General finite data -0 becomes 0. Custom canonical bytes use UTF-16 key ordering, retain authored roots/references/operations, and normalize identity sets. No RFC8785 certification is claimed.

Known canonical retries precede CAS and add no journal entry or replay work. Fresh commands publish coupled head/command/receipt state only after final validation and full byte/count/work admission. Restore recovers authored target content while advancing revision and preserving identity retirement knowledge. Export persists only baseline and successful commands; reopening rebuilds receipts and retry indices before exposing a store. Standalone snapshots start a new history boundary. Journals have no authenticated tamper evidence or crash-safe persistence.

Configured limits are admission bounds, not RAM promises. Synchronous API work blocks polling; observations and GC can miss transient peaks. Version-bound memory observations are preserved in the implementation evidence, without establishing a RAM threshold, production performance or universal OOM guarantee.

## Dependency and delivery scope

First-party adapters, generated-schema tooling and project semantics were independently authored with Codex assistance. Exact `jsonc-parser` 3.3.1 by Microsoft Corporation, MIT, supplies only public-root `createScanner`/`visit` in a private adapter. Preserve its [unchanged MIT notice](../../third-party/jsonc-parser-3.3.1.LICENSE), [NOTICE](../../NOTICE) and [source record](../../source-origin.json). Installation remains script-disabled under the existing pinned tool/lock policy.

Native Node bare-root imports interoperate with the dependency's shipped CommonJS entry. Direct native import of its shipped ESM entry fails on extensionless internal imports; actual bundler/browser delivery remains unaccepted. The denied-host VM/CJS bridge is simulated module integration evidence. Its known Experimental VM Modules warning remains explicitly retained, with exact-warning and unexpected-stderr controls; it is not a production-runtime requirement. Pure eager dependency caches are allowed and are not zero-memory evidence.

Unknown entity kinds/domain data schemas and actual file content/digests/authorization remain unchecked or unverified. Proxy side effects cannot be isolated by reflection; recoverable OOM, phones/Native SDK, production performance, editor/V003 and complete R008/V006 migration remain pending. Verification and publication are recorded separately; this guide does not publish npm or certify a complete engine.

## Verification

From the repository root, run `node tools/verify.mjs` and `node tools/generate-project-format.mjs --check`. See the [knowledge base](../../knowledge-base/en/README.md) for design and historical checkpoints. The package remains `private: true`; first-party code and this document use [Apache-2.0](../../LICENSE).
