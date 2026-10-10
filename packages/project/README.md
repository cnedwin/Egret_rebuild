# Project transaction core

[简体中文](README.zh-CN.md) | English

## Current local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](../../knowledge-base/en/docs/legacy-movieclip-contract.md), [evidence](../../knowledge-base/en/docs/legacy-movieclip-evidence.md) and [compact record](../../knowledge-base/evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](../../knowledge-base/en/docs/3d-cpu-scene-contract.md), [mesh](../../knowledge-base/en/docs/3d-webgpu-mesh-contract.md), [Host](../../knowledge-base/en/docs/b1-host-contract.md), [sequence](../../knowledge-base/en/docs/sequence-clip-contract.md) and [RES intents](../../knowledge-base/en/docs/legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](../../knowledge-base/en/docs/b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical local engineering preview: 0.16.0

The current additive scope covers accepted bounded image source/mock logic, CPU texture reference formulas, CPU 3D math/geometry/packing, and legacy RES declaration analysis. Read [core progress](../../knowledge-base/en/docs/core-progress.md), [3D CPU foundation](../../knowledge-base/en/docs/3d-foundation.md) and [legacy RES declarations](../../knowledge-base/en/docs/legacy-res-declarations.md) for contracts, exact historical evidence and open work. The label is an engineering preview; package 0.0.0 and protocol 1.0 remain unchanged. Final independent public review, prepush and this preview's GitHub delivery remain pending.

Earlier 0.13.0/0.14.0/0.15.0 sections are historical checkpoints with their own source identities and results. Their rectangle/browser observations do not validate current image or 3D native pixels. Task 5a provides CPU formulas/bounds only; A2 Task 5b/Task 6, P0–P7, device/text/animation/Native, V003 and complete R008/V006 migration remain open or UNRUN.

The 0.14.0 engineering preview provides a synchronous headless project transaction core. The private workspace package remains `@egret/project` 0.0.0; project/history/tool protocols remain `1.0`. This preview supports immutable authored snapshots, atomic edits, retained-target restore, durable retry through canonical journals and bounded admission. It does not complete editor, legacy migration or target delivery acceptance.

## Public API

The root exports exactly `DEFAULT_PROJECT_LIMITS`, `parseProjectSnapshot`, `serializeProjectSnapshot`, `parseProjectTransaction`, `createProjectStore` and `openProjectHistory`, plus 29 type-only declarations. A store exposes `limits`, `earliestRevision`, `getSnapshot`, `commit` and `exportHistory`. Expected failures return bounded diagnostics; committed and replayed results include immutable receipts. These experimental interfaces do not assert API stability.

The [complete contract](../../knowledge-base/en/docs/project-transaction-core-contract.md) defines every field, operation, diagnostic, limit and public signature. The [implementation evidence](../../knowledge-base/en/docs/project-transaction-core-evidence.md) separates historical scoped reviews, current oracle checks and memory observations. Import from the package root; private helpers and deep imports are unsupported.

## Authored authority and limits

The single authored format authority is [project-format.schema.json](../contracts/schema/project-format.schema.json). The closed generator emits readonly contract types and private ordered descriptors with source-pointer/hash provenance. Run `node tools/generate-project-format.mjs --check` from the repository root to check drift; normal generation follows schema edits. Structural schema agreement alone does not establish semantic validity.

Strict text adapters reject decoded duplicate keys, lone surrogates and trailing input; exact mathematical tokens control integer validation before Number rounding. Live adapters inspect checked own data descriptors, never getters, and charge every expanded shared alias. General finite data -0 becomes 0. Custom canonical bytes use UTF-16 key ordering, retain authored roots/references/operations, and normalize identity sets. No RFC8785 certification is claimed.

Known canonical retries precede CAS and add no journal entry or replay work. Fresh commands publish coupled head/command/receipt state only after final validation and full byte/count/work admission. Restore recovers authored target content while advancing revision and preserving identity retirement knowledge. Export persists only baseline and successful commands; reopening rebuilds receipts and retry indices before exposing a store. Standalone snapshots start a new history boundary. Journals have no authenticated tamper evidence or crash-safe persistence.

Configured limits are admission bounds, not RAM promises. In one Windows x64/Node 24.19.0 observation, 100000 small entities reached sampled heap 1071184632/RSS 1501483008 bytes. A 10ms polling interval still had a maximum 7058.9561 ms observation gap across the measured cases; synchronous API work blocks polling. Observations and GC can miss transient peaks. No RAM threshold, production performance or universal OOM guarantee follows.

## Dependency and delivery scope

First-party adapters, generated-schema tooling and project semantics were independently authored with Codex assistance. Exact `jsonc-parser` 3.3.1 by Microsoft Corporation, MIT, supplies only public-root `createScanner`/`visit` in a private adapter. Preserve its [unchanged MIT notice](../../third-party/jsonc-parser-3.3.1.LICENSE), [NOTICE](../../NOTICE) and [source record](../../source-origin.json). Installation remains script-disabled under the existing pinned tool/lock policy.

Native Node bare-root imports interoperate with the dependency's shipped CommonJS entry. Direct native import of its shipped ESM entry fails on extensionless internal imports; actual bundler/browser delivery remains unaccepted. The denied-host VM/CJS bridge is simulated module integration evidence. Its known Experimental VM Modules warning remains explicitly retained, with exact-warning and unexpected-stderr controls; it is not a production-runtime requirement. Pure eager dependency caches are allowed and are not zero-memory evidence.

Unknown entity kinds/domain data schemas and actual file content/digests/authorization remain unchecked or unverified. Proxy side effects cannot be isolated by reflection; recoverable OOM, phones/Native SDK, production performance, editor/V003 and complete R008/V006 migration remain pending. At this documentation-authoring checkpoint, final independent preview review and public delivery remain pending; subsequent review and delivery evidence are tracked separately; this label does not publish npm or certify a complete engine.
