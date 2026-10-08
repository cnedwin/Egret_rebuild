# Contribution guide

English | [简体中文](CONTRIBUTING.md)

Start with the [README](README.en.md), [knowledge base](knowledge-base/README.en.md), and [source record](source-origin.json). At this stage, you can improve the three headless packages, submit lifecycle, display-tree, or event counterexamples and fixes, correct documentation, add sources, propose interface designs, and provide migration and text samples that you own or are authorized to share.

This candidate is a development preview. Its remote is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild); consult repository branches and PRs for submission and review status. No npm packages have been published. Issues, PRs, and maintenance responsibilities follow the repository's actual configuration. First-party code and documentation use the existing Apache-2.0 license; third-party notices stay with their files. Individual contributors and review responsibilities still need public registration.

## Change descriptions

Each contribution should explain the problem, scope, related specifications, implementation sources, and verification results. Update design and migration documentation when public interfaces change. Register a candidate design as a decision only after review. Discuss technical effects, evidence, and reproduction steps, and retain attribution and versions for upstream projects.

Design and write the independent core from Egret specifications. Record third-party libraries as explicit dependencies, including versions, applicable licenses, and modifications. Code contributions must include an [implementation source record](knowledge-base/templates/实现来源记录.en.md), describing the materials actually used, AI participation, generated scope, and author review. Resolve source questions against the specific inputs and implementation, and limit conclusions to the scope actually checked.

## Verification

Use fixed Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2. After `pnpm install --frozen-lockfile --ignore-scripts`, run `node tools/verify.mjs` and `node examples/headless.mjs`. Select meaningful regressions appropriate to the change; record the environment, commands, inputs, outputs, and uncovered items.

The existing prototype baseline consists of 44/44 behavioral checks and 11 negative type assertions, limited to CPU and a simulated host. Verify real GPU, Native, hosts, performance, and CI separately. Package manifest `private: true`, version 0.0.0, exports, and dependency direction belong to the current checking contract; explain the effects of upgrades or publication-setting changes separately.

## Publishable materials

Submit distributable code, samples, and technical summaries. Contributions must exclude private original packages, credentials, personal data, and content lacking publication authorization. Present historical research through necessary source categories and technical conclusions. See the [knowledge-base contribution guide](knowledge-base/CONTRIBUTING.en.md) and [independent implementation policy](knowledge-base/docs/独立实现与第三方依赖规范.en.md) for details.

## Bilingual and public-content checks before every push

Before every push to GitHub, organize all publishable documentation and knowledge-base content, maintain complete Chinese and English reading versions, and add English comments to critical code. Generate English registry views from the authoritative Chinese records, keeping IDs, statuses, numbers, and sources consistent; retain the original identity of raw evidence, code snapshots, and upstream licenses. After reviewing sources, attribution, publishable content, and translation meaning, run `node tools/prepush.mjs`, which includes bilingual checks and core verification. Machine checks do not replace the author's review of publication authorization and translation meaning.

After cloning locally, run `git config --local core.hooksPath .githooks` to enable the repository's push hook; it runs the same checks. CI and contributors must run this command, and must fix failures rather than bypass the hook. This agreement applies to all subsequent pushes. See the [bilingual policy](knowledge-base/docs/双语文档与推送前检查.en.md).
