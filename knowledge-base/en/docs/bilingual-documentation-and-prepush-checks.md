# Bilingual documentation and pre-push checks

English | [简体中文](../../Cns/docs/双语文档与推送前检查.md)

Egret maintains complete English and Chinese readings for its global community. R019 applies to documentation, code and evidence updates: prepare both editions, source attribution and critical English comments before every GitHub push.

## Reading versions and shared status

Knowledge-base readings live in en/ and Cns/. English paths use English names; default repository/package/example documents are English, with .zh-CN.md companions. Each pair links to its counterpart. Keep API names, IDs, versions, numbers, sources and acceptance conditions consistent.

Chinese registries are authoritative. English JSON views record their Chinese source and digest while preserving IDs, states, dates, dependencies and numbers. They express one shared product state. Code, original logs, sealed evidence, assets and upstream legal notices retain their own identities.

## English code comments

Use English comments for responsibilities and contracts that are easy to misunderstand: ownership, cancellation, cleanup, reentrancy, errors and host lifetime. Explain the reason for an invariant rather than restating each line. Comments and specifications must agree with implementation.

## Checks for every push

1. Review the contribution's public scope, sources, dependencies and attribution.
2. Complete both reading editions and synchronize registry views, links and current identities.
3. Complete critical English comments and review their technical meaning.
4. Run affected local feedback while editing. Complete node tools/prepush.mjs --integrated on the final merge candidate; it retains publication, build, boundaries, types, behavior, examples and knowledge-base checks.
5. Commit the reviewed files with the repository hooks enabled. The pre-commit hook checks staged raw bytes; the pre-push hook runs node tools/check-push.mjs --committed for environment, clean bytes, source/bilingual publication and knowledge-base structure. It does not repeat engine merge checks.
6. Verify the pushed commit, PR and merged content as actual remote actions.

Enable hooks with git config --local core.hooksPath .githooks. Checks use exact bytes and the [repository path and line-ending policy](repository-identity-and-line-endings.md).

## Translation and review

Use the [glossary](glossary.md) for consistent terminology. Translate complete technical statements, including their conditions and uncertainty. Keep goals, partial implementation and verified results distinct. Inventory and hash checks verify coverage and identity; contributors and reviewers remain responsible for meaning.

## Browser gates and publication inventory

The normal prepush does not launch a browser. Rendering changes require the affected actual-browser gates in [AGENTS](https://github.com/cnedwin/Egret_rebuild/blob/main/AGENTS.md), with recorded dependencies and default launch settings. Reuse earlier results only with explicit comparison of the relevant unchanged source/build identities.

Keep dependency caches, generated outputs, private configuration, credentials and unedited internal discussions outside the public inventory. Shared evidence and legal originals retain their provenance; reading updates do not rewrite their results.
