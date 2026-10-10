# Contribution guide

English | [简体中文](CONTRIBUTING.zh-CN.md)

The historical 0.13.0 rectangle checkpoint has its own [implementation and verification record](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md). Its source identities, results and pending work retain their recorded scope; they do not establish current product acceptance.

Start with the [README](README.md), [knowledge base](knowledge-base/en/README.md), and [source record](source-origin.json). At this stage, you can improve the three headless packages, submit lifecycle, display-tree, or event counterexamples and fixes, correct documentation, add sources, propose interface designs, and provide migration and text samples that you own or are authorized to share.

This candidate is a development preview. Its remote is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild); consult repository branches and PRs for submission and review status. No npm packages have been published. Issues, PRs, and maintenance responsibilities follow the repository's actual configuration. First-party code and documentation use the existing Apache-2.0 license; third-party notices stay with their files. Individual contributors and review responsibilities still need public registration.

## Change descriptions

Each contribution should explain the problem, scope, related specifications, implementation sources, and verification results. Update design and migration documentation when public interfaces change. Register a candidate design as a decision only after review. Discuss technical effects, evidence, and reproduction steps, and retain attribution and versions for upstream projects.

Design and write the independent core from Egret specifications. Record third-party libraries as explicit dependencies, including versions, applicable licenses, and modifications. Code contributions must include an [implementation source record](knowledge-base/en/templates/implementation-origin-record.md), describing the materials actually used, AI participation, generated scope, and author review. Resolve source questions against the specific inputs and implementation, and limit conclusions to the scope actually checked.

## Verification

Use fixed Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2. After `pnpm install --frozen-lockfile --ignore-scripts`, run `node tools/verify.mjs` and `node examples/headless.mjs`. Select meaningful regressions appropriate to the change; record the environment, commands, inputs, outputs, and uncovered items.

The existing prototype baseline consists of 44/44 behavioral checks and 11 negative type assertions, limited to CPU and a simulated host. Verify real GPU, Native, hosts, performance, and CI separately. Package manifest `private: true`, version 0.0.0, exports, and dependency direction belong to the current checking contract; explain the effects of upgrades or publication-setting changes separately.

## Publishable materials

Submit distributable code, samples, and technical summaries. Contributions must exclude private original packages, credentials, personal data, and content lacking publication authorization. Present historical research through necessary source categories and technical conclusions. See the [knowledge-base contribution guide](knowledge-base/en/CONTRIBUTING.md) and [independent implementation policy](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md) for details.

## Bilingual and public-content checks before every push

Before every push to GitHub, organize all publishable documentation and knowledge-base content, maintain complete Chinese and English reading versions, and add English comments to critical code. Generate English registry views from the authoritative Chinese records, keeping IDs, statuses, numbers, and sources consistent; retain the original identity of raw evidence, code snapshots, and upstream licenses. After reviewing sources, attribution, publishable content, and translation meaning, run `node tools/prepush.mjs`, which includes bilingual checks and core verification. Machine checks do not replace the author's review of publication authorization and translation meaning.

After cloning locally, run `git config --local core.hooksPath .githooks` to enable the repository's push hook; it runs the same checks. CI and contributors must run this command, and must fix failures rather than bypass the hook. This agreement applies to all subsequent pushes. See the [bilingual policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md).

## Browser gates and publication inventory

`node tools/prepush.mjs` remains mandatory before every push and checks publication structure, core/type/boundaries, headless behavior and KB structure. It does not launch a browser. Rendering changes additionally use `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` and the separate `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` as affected. Use the accepted pinned dependencies; preserve default browser launch with no extra flags. Recorded unchanged-build evidence may be retained with explicit identity comparison.

Discovery and registered inventory paths exclude private execution/dependency/generated trees case-insensitively on Windows. Listings cannot override exclusions. Public AGENTS documents remain valid. Only the exact two sealed Three r186 research build paths/hashes remain exceptions. Structural checks do not create translation meaning or public review approval.

For affected B1 scene-rendering changes, also run `node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"` with your own installed-package and fresh repository-external output paths. See the [bounded B1 browser verifier](knowledge-base/en/docs/b1-browser-verifier.md). Keep the default prepush browser-free; a fresh complete prepush must separately pass before pushing.

## International community documentation

Public introductions are English first, followed by Chinese. Keep complete knowledge-base reading editions under `knowledge-base/en/` and `knowledge-base/Cns/`, with English filenames in the English tree. Shared experiment code, raw evidence, historical source identities and upstream legal originals keep their provenance. Record design choices with questions, options, sources, counterexamples and conclusions; use professional, respectful public wording. Review source attribution, publishable content and both language editions, complete critical English code comments, and run the full prepush before every GitHub push. See the [layout policy](knowledge-base/en/docs/documentation-layout.md).
