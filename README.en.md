# Egret Rebuild

English | [简体中文](README.md)

Egret Rebuild serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, continuously editable projects, Agent collaboration tools, and complete migration of legacy projects form the product direction. Code, bilingual documentation, tests, and publishable verification records are maintained throughout development.

This is the local 0.11.0 development preview, targeting the public repository [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild). Remote submission status for this preview is recorded separately; no npm packages have been published. First-party code and documentation use the repository's original [Apache-2.0](LICENSE); third-party notices remain applicable. Packages retain `private: true`, and interfaces are experimental.

## Implemented core

| Package | Current responsibilities | Dependencies |
| --- | --- | --- |
| `@egret/contracts` | Cancellation, synchronous cleanup, diagnostics, and headless host ports | None |
| `@egret/runtime` | Scope, display tree, typed synchronous events, CPU asset references/shared acquisition/independent leases | contracts |
| `@egret/engine` | Instance and asset-service assembly, surface reservation, startup, and bounded shutdown | contracts, runtime |

The public entry is `@egret/engine`. Core code does not depend on DOM/Node globals, and importing it does not start a host. The new `engine.assets` separates cancellation of a wait from the lifetime of a delivered lease: canceling one caller does not affect other waiters; generation invalidation changes future acquisition while old leases remain usable until release or manager shutdown. Scope and Engine manage cleanup during exit. See the [asset contract](knowledge-base/docs/资源核心合同.en.md) and [implementation record](knowledge-base/docs/资源核心实现记录.en.md).

This service manages CPU values returned by providers; appropriate providers supply networking and decoding. GPU upload/in-flight reclamation, rendering backends, production text/animation/3D execution, real mini-game/Native hosts, migrators, editors, and Agent services remain unfinished. Third-party graphics research chains and independently authored product code are recorded separately.

## Running and verifying

Fixed tools: Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2. Run from the root:

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

Use the [current asset-core verification](verification/asset-core-verification.json) as the acceptance record. The earlier [44 headless checks](verification/headless-verification.json) and [bilingual revision record](verification/bilingual-publication-verification.json) retain their historical versions and scopes. Current verification does not establish GPU, device performance, CI, or full-product acceptance.

Before every push, run the [bilingual and public-content checks](knowledge-base/docs/双语文档与推送前检查.en.md), synchronizing Chinese/English reading versions, registry state, and English comments in critical code. New core code is independently authored from first-party contracts. Historical source/specification hashes and current revision identities are preserved separately in the [source record](source-origin.json).

[Knowledge base](knowledge-base/README.en.md) · [All bilingual documents](DOCUMENTATION.en.md) · [Contribution guide](CONTRIBUTING.en.md) · [Acknowledgements](ACKNOWLEDGEMENTS.en.md) · [Publication notes](PUBLICATION.en.md)
