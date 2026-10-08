# Agent collaboration agreement

English | [简体中文](AGENTS.md)

This repository contains an independently developed core slice and a public knowledge base. Read README, CONTRIBUTING, source-origin.json, and the relevant specifications first. Complete work within the current scope authorized by the user.

- Design the independent core from the specifications. Record sources, versions, and verification separately for research, third-party dependencies, Egret adapters, and independent code.
- engine depends on runtime/contracts; runtime depends only on contracts; contracts has no package dependencies. Public examples and behavioral tests use built artifacts through the `@egret/engine` entry point. Preserve package exports, strict configuration, and the core boundary that excludes DOM/Node environment globals.
- Update specifications, source records, and necessary regressions when public behavior changes. State the actual execution environment and unverified items, and retain counterexamples and repair records.
- Disclose AI participation according to the materials actually used, the generated scope, and author review. Retain only the necessary publishable summaries of private materials; credentials and personal data must not enter the repository.
- Use fixed tools and the lockfile; disable lifecycle scripts during installation. Explain the reasons and effects of changes to versions, dependencies, licenses, or publication settings separately.
- Continue using Apache-2.0 for first-party code and documentation. Retain third-party copyright, licenses, NOTICE files, and asset attribution. Do not rewrite historical identity hashes for a public projection.
- Pushes, releases, deployments, and repository administration require actual user authorization. Local file generation or verification does not establish that remote publication is complete.

The prototype's 44/44 behavioral checks and 11 negative type assertions are a recorded headless baseline. GPU, Native, real hosts, performance, and CI require their own acceptance. The Three execution chain in the knowledge base is third-party research and does not replace verification of the independent core.

## Bilingual and public-content checks before every push

Before every push to GitHub, organize all publishable documentation and knowledge-base content, maintain complete Chinese and English reading versions, and add English comments to critical code. Generate English registry views from the authoritative Chinese records, keeping IDs, statuses, numbers, and sources consistent; retain the original identity of raw evidence, code snapshots, and upstream licenses. After reviewing sources, attribution, publishable content, and translation meaning, run `node tools/prepush.mjs`, which includes bilingual checks and core verification. Machine checks do not replace the author's review of publication authorization and translation meaning.

After cloning locally, run `git config --local core.hooksPath .githooks` to enable the repository's push hook; it runs the same checks. CI and contributors must run this command, and must fix failures rather than bypass the hook. This agreement applies to all subsequent pushes. See the [bilingual policy](knowledge-base/docs/双语文档与推送前检查.en.md).
