# Bilingual documentation and pre-push checks

English | [简体中文](../../Cns/docs/双语文档与推送前检查.md)

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](webgpu-rectangle-execution-contract.md), [implementation plan](webgpu-rectangle-implementation-plan.md) and [bounded evidence](webgpu-rectangle-implementation-evidence.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](../../evidence/webgpu-verification.json) and [review](../../evidence/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](display-and-frame-execution-contract.md) and [implementation plan](display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json).

Register complete Chinese/English pairs for the new contract, plan and implementation record. Record real-browser acceptance separately rather than infer it from existing prepush checks. Historical English-comment restoration proofs retain original code identities; changed core and web sources use new current digests. Refresh localization after all document, registry and origin edits, then run final gates and freeze the export.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Version: 0.1 · Knowledge base 0.10.0 · October 8, 2026.

Egret collaborates publicly with developers worldwide. Before every push to GitHub, organize public documentation and knowledge-base content, complete Chinese and English reading versions and English comments for critical code, then run checks. This requirement applies to code, documentation, and evidence updates and is registered as R019.

## Reading versions and shared status

All knowledge-base reading documents use `knowledge-base/Cns/` for Chinese and `knowledge-base/en/` for English. English documents use meaningful English filenames; Chinese filenames may retain their established names. Outside the knowledge base, default documentation basenames provide the English reading version, and complete Chinese companions use `.zh-CN.md`. The repository README introduces the project in English first, followed by a Chinese introduction and a link to the complete Chinese companion. Language counterparts link to each other, and navigation changes are synchronized. API identifiers, requirement and decision IDs, original URLs, technical versions and shared statuses remain consistent. Language-neutral data, source code, raw evidence, file digests and original license notices retain their paths and identities. Translations distinguish proposals, partial implementations and acceptance, preserving conditions, unknowns and failed-attempt history.

The requirements, decisions, hypotheses, delivery, and source registries have one authoritative status set. English JSON files are read-only projections of the Chinese registries, retaining the same IDs, statuses, dependencies, dates, and numerical values, and recording the Chinese source and its digest. Contributors first maintain shared status and Chinese descriptions, then synchronize English. The two language versions must not become independently evolving product plans.

Test data, source snapshots, execution-log excerpts, file digests, and original upstream licenses are shared evidence and retain their original identity. Reading documents provide bilingual explanations and entry points. Translation does not rewrite embedded source, test inputs, or old report results. Chinese explanations of existing English upstream licenses are informational translations; original license notices remain applicable.

## English code comments

Describe public interfaces and critical internal boundaries in English: responsibilities, ownership, cancellation and cleanup order, reentrancy protection, error propagation, and host-shutdown limitations. Comments explain easily misunderstood contracts and reasons, without line-by-line restatement. Comments on display trees, events, Scope, and Engine lifecycle must match implementation and existing tests.

The historical 0.10.0 round added comments only, without changing runtime behavior. The 0.12.0 successor adds display/frame and Canvas behavior with separately bound evidence. Record explanatory edits and actual implementation changes separately; core code changes still require corresponding specifications and regressions. Source records retain previously reviewed versions; the current commented version uses its own digests and actual verification.

## Checks for every push

1. Review public scope; remove communication unsuitable for publication, credentials, personal data, and unauthorized assets. Retain research references, actual dependencies, and acknowledgements. Use the [public communication policy](open-source-collaboration-and-public-communication.md) and [independent implementation policy](independent-implementation-and-dependency-policy.md).
2. Update Chinese documents and registries and complete corresponding English versions. Check language inventory, source-version digests, links, numbers, sources, and registered status. Confirm that English does not describe goals or hypotheses as delivered capabilities.
3. Complete English comments for critical code and check consistency with public contracts and current implementation.
4. Run repository pre-push checks. Core checks include build, package resolution and boundaries, type samples, behavioral tests, and the headless example. Record knowledge-base structural and bilingual check results separately.
5. Select files for commit against an explicit public inventory. Retain applicable licenses and third-party notices; exclude dependency caches, build artifacts, private original packages, and internal execution materials.
6. After checks pass, push the branch and submit for review. Record actual remote commits, PRs, merges, and releases according to their respective statuses.

The repository provides an installable pre-push hook and a standalone checking entry. See the [repository contribution guide](../CONTRIBUTING.md) for hook installation and commands. Machine checks verify coverage, digests, structure, and declared conditions. Contributors and reviewers still check technical meaning, publication authorization, and English expression.

## Translation and review

See the [glossary](glossary.md) for consistent terminology. Understand contracts in complete paragraphs before translating. Do not replace bounded facts with unverified promotional conclusions. Keep sources near supported conclusions; acknowledgements do not replace actual dependency identity or release notices.

Synchronize language inventories and source digests after adding documents, moving paths, or changing text. Original historical digests remain bound to old versions; English companions are explicitly reading translations. Both Chinese and English accept community revisions. Changes to critical facts must synchronize both reading versions and shared registered status.

Rendering changes also require the separate real-browser command documented in the Canvas example README. Default `node tools/prepush.mjs` remains structural/headless; assets are checked separately with `node examples/assets.mjs`.

## Browser gates and publication inventory

`node tools/prepush.mjs` remains mandatory before every push and checks publication structure, core/type/boundaries, headless behavior and KB structure. It does not launch a browser. Rendering changes additionally use `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` and the separate `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` as affected. Use the accepted pinned dependencies; preserve default browser launch with no extra flags. Recorded unchanged-build evidence may be retained with explicit identity comparison.

Discovery and registered inventory paths exclude private execution/dependency/generated trees case-insensitively on Windows. Listings cannot override exclusions. Public AGENTS documents remain valid. Only the exact two sealed Three r186 research build paths/hashes remain exceptions. Structural checks do not create translation meaning or public review approval.
