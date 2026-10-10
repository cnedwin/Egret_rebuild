# Agent collaboration agreement

English | [简体中文](AGENTS.zh-CN.md)

This agreement applies across the repository, including shared knowledge-base experiments, tools, evidence, comments, Issues and PRs. Read [README](README.md), [CONTRIBUTING](CONTRIBUTING.md), [source records](source-origin.json) and the relevant specifications. Work within the user's existing authorization.

## Architecture and implementation

- Implement Egret's core independently from its specifications. Retain familiar Egret domain names and follow the documented module, API and code conventions. Record research references, third-party dependencies, Egret adapters and first-party implementation separately, with sources and versions.
- Preserve the package DAG: engine depends on runtime/contracts; runtime depends only on contracts; contracts has no package dependencies. Preserve package exports, strict configuration and the DOM/Node-free core. Public examples and behavioral tests consume built artifacts through the `@egret/engine` public entry.
- Keep `@egret/engine/web` Canvas-only; it requests no WebGPU or robust-predicates modules. WebGPU is an explicit `@egret/engine/webgpu` entry. The DOM-free rendering composite references contracts only; engine's exact external `robust-predicates` 3.0.3 import is restricted to rendering through the package root/public `orient2d`, under Unlicense, and is checked separately from the internal package DAG and project references.
- Private geometry unit tests may import built `engine/dist/rendering` helpers directly. This does not permit private imports in public behavior tests.
- The experimental `tools/verify-webgpu-b1.mjs` may load only its fixed emitted graph: `packages/engine/dist/web/b1.js`, `packages/engine/dist/rendering/meshGeometry3D.js`, `packages/engine/dist/rendering/matrix4.js`, `packages/engine/dist/web/webgpuMeshPass.js`, `packages/contracts/dist/ImageData2D.js`, and its bounded literal-import closure and fixed aliases. This exception adds no stable exports and permits no arbitrary private imports in ordinary examples or behavioral tests.
- When public behavior changes, update its specifications, source records and necessary regressions. Record actual environments, unverified items, counterexamples and repairs. Third-party research and historical tests do not replace independent product acceptance.

## Public contributions and evidence

Use professional, objective and friendly language. Explain changes through Egret's target scenarios, independent design, interfaces and reproducible results. Design records connect questions, options, evidence, counterexamples and conclusions. Technical comparisons identify material versions and test conditions; performance goals and measured results remain separate.

State the actual scope of AI assistance, source material and author review. Retain references and acknowledgements; distinguish mechanism research, experimental dependencies, product dependencies and development tools. Preserve third-party attribution, copyright, licenses, NOTICE files and asset provenance. First-party code and documentation remain Apache-2.0.

Use fixed tools and the lockfile; disable lifecycle scripts during installation. Explain the reasons and effects of changes to versions, dependencies, licenses or publication settings. Protect personal and business information, unauthorized original projects, credentials and private configuration; publish only necessary authorized summaries. Workbench scheduling and unedited chats remain outside release content.

Organizing evidence may change presentation and publishable scope, while preserving data, results, source identity, failures and revision history. Identify projection relationships without rewriting historical hashes. Registered status and version-bound verification determine acceptance. Browser results, Native SDKs, hosts, CI, target-device performance and complete migration have separate acceptance obligations.

## Documentation and verification

Public introductions are English first, followed by Chinese. Maintain complete reading editions in `knowledge-base/en/` and `knowledge-base/Cns/`, using English filenames in the English tree. Generate read-only English registry views from the authoritative Chinese records; IDs, statuses, numbers and sources must match. Shared experiment code, original evidence, historical source identities and upstream legal originals retain their provenance.

Before every GitHub push, review source attribution, public content and both language editions, complete critical English code comments, update current document identities and run `node tools/prepush.mjs`. It checks publication structure, core/type/package boundaries, headless behavior and knowledge-base structure; it does not launch a browser. Structural checks do not establish translation quality or publication approval.

After cloning, contributors and CI must enable the same push hook with `git config --local core.hooksPath .githooks`. Fix failures instead of bypassing the hook. See the [bilingual policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) and [layout policy](knowledge-base/en/docs/documentation-layout.md).

Affected rendering changes additionally require the corresponding real-browser gates:

```text
node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"
```

The B1 command applies to affected B1 scene rendering; see its [bounded verifier](knowledge-base/en/docs/b1-browser-verifier.md). Use accepted pinned dependencies and default browser launch without extra flags. Retained unchanged-build evidence requires explicit identity comparison; a fresh complete prepush is still required before pushing.

Discovery and registered inventory paths exclude private execution, dependency and generated trees case-insensitively on Windows; listings cannot override exclusions. Public AGENTS files remain valid. Only the two exact sealed Three r186 research build paths/hashes retain their documented exceptions.

## Authorization

Pushes, releases, deployments and repository administration require actual user authorization. Existing authorization remains applicable to its scope; local generation or verification does not prove remote publication. This agreement grants no account permissions and expands no authorization for external publication, message sending or asset use.
