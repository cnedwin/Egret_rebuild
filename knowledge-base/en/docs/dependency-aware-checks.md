# Dependency-aware local checks

English | [简体中文](../../Cns/docs/dependency-aware-checks.md)

Use local selection to get relevant feedback while editing an existing package. Push hooks and protected merge CI still run the complete gate. No previous PASS is cached or reused, and local success never authorizes merging or claims browser/device acceptance.

## Run and explain

~~~text
node tools/check-incremental.mjs --base origin/main --explain
node tools/check-incremental.mjs --base origin/main
~~~

Fetch the target branch first; fork contributors can use upstream/main. The base must be an ancestor of HEAD. Committed, staged and working changes are considered separately, including opposing edits; untracked files also participate. The explanation reports the profile, reasons, changed/affected packages and selected/shared/omitted test files. Missing or unrelated bases fail rather than guessing. A clean tree selects complete checks rather than assuming an earlier pass.

| Change | Local feedback |
| --- | --- |
| Existing reading Markdown only | Environment, text hygiene, publication/bilingual derivation, selector regressions and read-only knowledge-base checks |
| Existing TypeScript source under the four packages' src directories or engine web/rendering | Propagate changed packages to reverse dependents, then select reviewed test owners and all shared tests |
| Contracts or any change affecting every test | Complete gate |
| New/deleted/renamed files, tests/helpers, metadata/policy, tool/CI changes, package/lock/config changes, unknown paths | Complete gate |
| Stale catalog, changed package owners, unsupported graph, missing test member or hidden/sparse Git index flags | Complete gate with a reason |

The dependency profile keeps the complete build, strict-type lanes and all existing source/dependency-boundary scripts. It also retains environment, hygiene, publication, selector, Spine source, headless examples and knowledge-base checks. Only the top-level behavioral test-file schedule narrows. Rendering changes still need their affected real-browser gates separately.

## Package and test ownership

The declared graph is contracts → runtime → engine, with contracts also consumed directly by engine and project. Impact follows consumers, not prerequisites: a runtime change affects runtime and engine; a project change does not imply engine source changes. Complete builds and boundary/type checks still cover cross-package contracts.

The reviewed tools/incremental-test-catalog.json binds exact package manifests, complete-gate schedules, all 190 top-level behavioral test files and support-module bytes. Of these, 110 are shared. Tests with source inspection, subprocesses, privileged hooks or unclear dependency closure stay shared; they are always selected. Explicit package ownership is based on reviewed imports and support closures, not test filenames or an automatic coverage claim. The original test code and assertions are unchanged.

For this catalog, a project-only change selects 114 files and omits 76; engine selects 184 and omits six; runtime selects 187 and omits three. These are scheduling counts, not speed or coverage measurements. Shared source-bound tests can dominate elapsed time, so a small code edit may still take minutes. No universal acceleration factor is promised.

The existing SpriteSheet boundary freezes the complete source and emitted-file identities of all four packages. Even a source comment can require a separately reviewed successor baseline before final PASS. Dependency feedback runs the complete build and generic dependency boundary, then selected behavior tests, before the unchanged specialized source and type checks. This gives earlier diagnostics; it does not authorize new source identities or make ordinary source edits automatically pass. Shared source-bound behavior tests may also refuse changed identities.

An end-to-end positive control uses an isolated history with a deliberately faulty ancestor and the exact accepted source restored in the current snapshot. This verifies healthy-snapshot execution and selection from a real committed source delta; it does not demonstrate acceptance of an unreviewed source edit. Separate current-source behavioral and forbidden-dependency controls must fail, and their exact diagnostics and restoration must be retained. The earlier comment-only attempt failed at immutable source admission and is retained as a limitation, not counted as a positive pass.

## Maintaining the catalog

Contributors do not have to edit a shared catalog when adding or changing tests: stale or new inputs select the complete gate. Maintainers may restore narrower feedback after independent review of package ownership, helper imports, exact membership and raw bytes. Refresh only reviewed current test/support and package identities; never modify historical evidence. Review the resulting selection and rerun representative positive and negative controls. A changed catalog itself selects full checks until integrated.

The runner binds HEAD, index entries, tracked raw file identities and untracked membership before and after the dependency run. Persistent input drift refuses the final local PASS. This is a consistency check for one run, not a reusable receipt, a hostile-process isolation guarantee or execution of an older staged file: checks execute the current working tree. The committed push gate separately verifies the actual submitted snapshot.

## Acceptance and limits

Regression controls exercise reverse dependencies, shared tests, raw catalog drift, missing members, unknown/configuration/new files, independent Git layers and hidden index flags. Release evidence must additionally include a genuine selected positive run and separate observed behavioral and forbidden-dependency failures, followed by restoration. Record exact commands, environment, scope and failures; final delivery evidence belongs to the PR.

The existing full local gate, real committed push hook and protected M0 / merge-ready job remain mandatory. The selector does not change CI permissions or branch protection. Independent AI review is not human approval. Independent newcomer/external-fork validation (#52), target devices/hosts, full Spine and scenario/performance budgets (#54) remain open; this tooling increment does not complete all of M0.

Maintainers can prepare raw baseline differences and conservative catalog candidates with the [check maintenance workflow](check-maintenance.md). Proposals remain review-required and do not replace current source admission or full gates.
