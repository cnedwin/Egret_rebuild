# Contribution guide

English | [简体中文](CONTRIBUTING.md)

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](docs/WebGPU矩形执行合同.en.md), [implementation plan](docs/WebGPU矩形实施计划.en.md) and [bounded evidence](docs/WebGPU矩形实现证据.en.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](evidence/webgpu-verification.json) and [review](evidence/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.

Version: 1.1 · Knowledge base 0.10.0 · Updated: October 8, 2026.

Egret Rebuild uses public collaboration from its first development day. Source code, design, documentation, the knowledge base, tests, and publishable verification records are maintained together. Start with the [README](README.en.md), [current version](当前版本.en.json), and [requirements registry](registry/需求.en.json), then read the [core framework implementation record](docs/核心框架实现记录.en.md). Design documents explain technical approaches; registries and verification records establish current status.

The project repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild). First-party code and documentation continue to use its existing Apache-2.0 license; third-party materials retain their respective notices. The three existing headless core packages are a development preview. Maintenance responsibilities and contribution review are being clarified progressively; npm packages have not been published.

## Contributions you can make now

- Improve lifecycle, display-tree, typed-event, and headless interfaces in `@egret/contracts`, `@egret/runtime`, and `@egret/engine`; add meaningful behavioral counterexamples and fixes within the existing slice.
- Correct design, API, and knowledge-base documents, adding verifiable official sources, fixed versions, and evidence boundaries.
- Submit complex-UI, lightweight-3D, text, and legacy-project migration samples that you own or are authorized to provide; explain what may be published and the expected results.
- Discuss interface and design tradeoffs with the [RFC template](templates/RFC提案.en.md); record reviewed technical choices with the [ADR template](templates/ADR决策记录.en.md).
- Extend research references, integration regressions, or real-host verification, stating third-party dependencies, experimental inputs, and result scope.

The core prototype is described in the [core framework implementation record](docs/核心框架实现记录.en.md). Its public entry point is `@egret/engine`, with experimental interface support. Existing 44/44 behavioral checks and 11 negative type assertions are limited to CPU and a simulated host; GPU, Native, real browser/mini-game hosts, performance, and CI await acceptance. Complete rendering, text, animation, migration, editors, and Agent services proceed through their respective work packages; slice verification does not replace those deliverables.

## Submission and review

Proposals can currently be stored in the [pending-proposals directory](proposals/README.en.md), named by date and topic, with scope, related requirements, sources, changes, and verification. Directory entries remain pending until maintainers are appointed. Once the remote workflow is enabled, use Issues and PRs and publish review responsibilities and merge rules. Existing local proposals can enter that process while retaining their versions and evidence.

Each code contribution must describe public behavior, dependency direction, lifecycle, compatibility effects, and sources. Contract changes require synchronized specifications, migration information, and verification. Review records distinguish research suggestions, candidate designs, implementation revisions, and formal decisions. Keep communication focused on problems, evidence, and reproducible steps; describe technical effects and respect authors and upstream communities.

## Reproducing existing core checks

Fixed development tools are Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2; see [tool evidence](evidence/core-framework-tooling.json) and [prototype source record](evidence/core-framework-implementation.json). Run in the prototype directory:

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
```

`verify` checks build, actual package resolution and dependency boundaries, positive and negative type samples, and Node behavioral tests in order. Select regressions based on actual change effects, and state commands, environment, inputs, outputs, and unverified items. Explain reasons and effects for fixed-tool and lockfile upgrades separately. Register remote execution results after CI integration.

## Engineering and API policies

See [engineering structure](docs/工程技术架构与项目结构.en.md), [public API and naming](docs/公共API设计与命名规范.en.md), and [code standards and gates](docs/代码规范与质量门禁.en.md). Retain Egret domain names and discuss modern implementation against explicit contracts. Label implemented packages and candidate designs separately; tools and gates not yet executed remain pending configuration.

## Sources, AI, and public content

Follow the [independent implementation and third-party dependency policy](docs/独立实现与第三方依赖规范.en.md). Design and write the independent core from Egret specifications; retain research sources and design rationale with changes. Register third-party libraries as explicit dependencies with versions, applicable notices, and modifications. Their internal capabilities retain upstream attribution. The existing Three r186 experiment is a third-party research chain; Egret adapter code is recorded separately.

Attach an [implementation source record](templates/实现来源记录.en.md) to code contributions, covering specifications, independent scope, materials read, dependencies, generation tools, AI participation, source review, and verification. Authors review AI output, sample permissions, and notices, and retain reversible changes. Resolve source questions requiring confirmation in review and retain the basis.

Public contributions use distributable materials. Private original packages, credentials, personal data, and content lacking publication authorization must not enter the repository; necessary historical research is expressed through source categories and technical summaries. First-party source and documentation continue to use the designated repository's existing Apache-2.0 license. Third-party notices, asset attribution, and applicable licenses remain with their files. See [ACKNOWLEDGEMENTS](ACKNOWLEDGEMENTS.en.md), [community participation](docs/社区参与.en.md), and [knowledge-base maintenance](docs/知识库维护.en.md).

Before every push, follow the [bilingual documentation and pre-push checks](docs/双语文档与推送前检查.en.md), synchronize Chinese and English reading versions and shared registered statuses, and add English comments to critical code.

## Bilingual checks and push hook

Run `node tools/prepush.mjs` from the repository root to complete bilingual and core checks. Install the recorded Node, pnpm, and dependencies, and provide PowerShell 7 (`pwsh`). The command also runs the existing knowledge-base structural check. Run `git config --local core.hooksPath .githooks` to enable the push hook for a local clone.

Maintain document pairs and current digests in `localization.json`; register new files as well. Updating digests records file identity only and cannot replace complete translation, public-scope review, or semantic review. English registry JSON records the Chinese source and digest, keeping machine statuses, IDs, dates, dependencies, and numbers consistent. Document language entry points are in this directory's README; do not rewrite raw experimental evidence or upstream licenses.

## Browser gates and publication inventory

`node tools/prepush.mjs` remains mandatory before every push and checks publication structure, core/type/boundaries, headless behavior and KB structure. It does not launch a browser. Rendering changes additionally use `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` and the separate `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` as affected. Use the accepted pinned dependencies; preserve default browser launch with no extra flags. Recorded unchanged-build evidence may be retained with explicit identity comparison.

Discovery and registered inventory paths exclude private execution/dependency/generated trees case-insensitively on Windows. Listings cannot override exclusions. Public AGENTS documents remain valid. Only the exact two sealed Three r186 research build paths/hashes remain exceptions. Structural checks do not create translation meaning or public review approval.
