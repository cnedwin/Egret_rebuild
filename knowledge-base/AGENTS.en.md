# Egret public collaboration agreement

English | [简体中文](AGENTS.md)

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](docs/WebGPU矩形执行合同.en.md), [implementation plan](docs/WebGPU矩形实施计划.en.md) and [bounded evidence](docs/WebGPU矩形实现证据.en.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](evidence/webgpu-verification.json) and [review](evidence/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match this metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.

This project uses public collaboration from early development. Before contributing, read the [public communication policy](docs/开源协作与公开表达规范.en.md), [contribution guide](CONTRIBUTING.en.md), [implementation and dependency policy](docs/独立实现与第三方依赖规范.en.md), and [current version](当前版本.en.json).

- Explain changes through Egret's target scenarios, independent design, explicit interfaces, and reproducible results.
- Retain references and acknowledgements. Distinguish mechanism research, experimental dependencies, product dependencies, and development tools; actual third-party capabilities retain their original attribution.
- Use professional, objective, and friendly language. Tie technical comparisons to material versions and test conditions; record performance goals and measured conclusions separately.
- Build reviewable design records from questions, options, evidence, counterexamples, and conclusions. State the scope of AI-assisted contributions and review sources, behavior, and verification.
- Protect private information, business information, unauthorized original projects, credentials, and private configuration in public materials. Workbench scheduling and unedited chats are excluded from release content.
- When editing evidence, organize only its presentation and publishable scope. Preserve data, results, source identity, failures, and revision records; identify projection relationships in public copies.
- Retain Egret domain naming. Module boundaries, APIs, and code style follow existing candidate policies; actual acceptance status is governed by registries and verification records.
- This file applies to code, documentation, comments, Issues, and PRs. It grants no account permissions and expands no authorization for external publication, message sending, or asset use.

Before every push, follow the [bilingual documentation and pre-push checks](docs/双语文档与推送前检查.en.md), synchronize Chinese and English reading versions and shared registered statuses, and add English comments to critical code.

Current 0.12.0 V011 covers only the display/frame and desktop Canvas rectangle prototype; full-product acceptance remains separate. Rendering changes require the real-browser gate documented by the example in addition to default prepush.

## Browser gates and publication inventory

`node tools/prepush.mjs` remains mandatory before every push and checks publication structure, core/type/boundaries, headless behavior and KB structure. It does not launch a browser. Rendering changes additionally use `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` and the separate `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` as affected. Use the accepted pinned dependencies; preserve default browser launch with no extra flags. Recorded unchanged-build evidence may be retained with explicit identity comparison.

Discovery and registered inventory paths exclude private execution/dependency/generated trees case-insensitively on Windows. Listings cannot override exclusions. Public AGENTS documents remain valid. Only the exact two sealed Three r186 research build paths/hashes remain exceptions. Structural checks do not create translation meaning or public review approval.
