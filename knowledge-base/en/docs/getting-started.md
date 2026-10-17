# Getting started and contributing

English | [中文](../../Cns/docs/getting-started.md)

This repository is an engineering preview for complex 2D interfaces, animation and later lightweight 3D. Complete Spine, automatic UI layout and native SDKs remain unfinished.

## Prepare the environment

Install Node **26.7.0**, pnpm **11.25.0**, Git and PowerShell **7.6.5**. TypeScript **7.0.2** is installed from the lockfile; no global compiler is needed. Windows is the complete development/merge profile. Linux/macOS CI runs only the explicitly named portable CPU suite; it does not certify their browser or full publication toolchain.

After selecting Node, install the pinned package manager with `npm install --global pnpm@11.25.0 --ignore-scripts` if needed. This optional command changes your global pnpm installation; a separately installed pinned pnpm is also supported. Clone the repository into your preferred directory, then run:

```text
node --version
pnpm --version
node tools/doctor.mjs --preinstall
pnpm setup:dev
pnpm check:quick
pnpm example:browser
```

Open the local URL printed by the server. The server binds only to 127.0.0.1 and exposes the example and its declared modules/assets. Stop it with Ctrl+C. Installation requires access to the package registry, disables lifecycle scripts and uses the frozen lockfile. Repeated setup preserves source changes; it installs dependencies, builds outputs and configures repository-local hooks, without replacing global Node or PowerShell. An existing different hooksPath is reported rather than overwritten.

Doctor is read-only. It reports the actual parent/child Node versions, required tools and local package ownership. A terminal can show the correct Node while a pnpm wrapper starts an older one: diagnose that wrapper and install/select pnpm under Node 26.7.0. Do not bypass version checks or edit old evidence. Missing packages require setup; an occupied port can be changed with `pnpm example:browser --port 4174`.

## First visible result

The existing resource scene shows two animated pilots, clothing, labels and selection controls. Choose Canvas 2D first; WebGPU remains an explicit experimental profile. Select a pilot, change clothing, pause playback, step time or change rotation and observe the corresponding change. The example uses fixed font subsets; it does not establish general Chinese typography or mobile performance.

For a first code edit, change a displayed heading in `examples/resource-scene/index.html`, reload and verify only the heading changed. Submit a useful, focused improvement rather than an arbitrary demonstration edit. Keep English/Chinese reading documentation in the paired directories and critical code comments in English.

## First contribution

1. Check the [public board](https://github.com/users/cnedwin/projects/2), milestones and Issues. [Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52) is the bounded newcomer entry. Before claiming a `good first issue`, confirm it has a code entry, expected result, verification command and reviewer.
2. Fork, create a branch and make a focused change. Questions, reproduction samples, translations and device testing are welcome.
3. Run `pnpm check:quick` during iteration. It builds, checks actual package boundaries, exercises onboarding tools and runs the headless example; it is not the merge gate.
4. Open a draft PR with the problem, behavior, verification, compatibility and sources/AI assistance. English or Chinese drafts are accepted. Maintainers help complete bilingual content and current ledgers; historical evidence is never regenerated.
5. Before public delivery/Main merge, complete `pnpm check:merge`, bilingual review and any affected real-browser verification. Existing hooks still enforce the full gate; this first M0 delivery does not remove that obligation.

## Review and current boundaries

Edwin (`@cnedwin`) is the current integration contact. CODEOWNERS routes review requests; it is not evidence of independent approval. AI reviews are labeled separately from human approval. Core changes without independent technical review remain pending. Triage happens as maintainer capacity permits; if delayed, the maintainer records the blocker and next step instead of promising an unstaffed response time.

Contributors may request translation/metadata assistance in the PR. The final integrated tree must be checked after those updates. Public CI runs without repository write permission; initial fork contributions may need maintainer approval to run. Missing/failed/cancelled required jobs cannot produce the final `M0 / merge-ready` pass.

M0 remains open for independent human/fork rehearsal, scenario/device budgets and separately admitted historical profiles. Current ledger generation, local risk-selected feedback and eight browser entries are available below; complete merge checks remain mandatory.

## Rehearse the first contribution

Use your own fork for an actual contribution. On GitHub choose Fork, copy that fork's clone URL, clone it and create a branch such as `docs/onboarding-note`. Record `git rev-parse HEAD` before editing. Keep the upstream repository as the PR base and your fork/branch as the head; do not push directly to upstream main. A local clone using the maintainer account does not validate an external fork's first-run approval path.

Follow the environment and example steps above, then record this compact checklist in [Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52) or the draft PR:

| Step | Record and expected result |
| --- | --- |
| Environment | OS, Node/pnpm/PowerShell/Git versions and parent/child Node from doctor; redact personal paths |
| Install | Base commit, whether the dependency store was empty, exit result, download time and setup time; no manual package aliases |
| Run | Resources Ready, Frame Completed, Input Ready; two pilots, fixed text, successful outfit change and 0.125-second step |
| Edit | Change only the local heading, reload, observe the change; repeat setup preserves that edit; use a useful correction for the real PR |
| Check | Quick result and full merge result separately; include the first failure and its repair, not just the final success |
| Submit and review | Fork/head/base, PR and CI links, any approval wait, reviewer role and integration outcome; AI and human review are distinct |

Provisional process targets for the next rehearsals are five minutes for setup on a prepared Windows machine, one minute for quick checks, and thirty minutes for the full merge job. Record downloads, initial tool installation, user work and review queues separately; these are investigation thresholds, not a speed guarantee or permission to skip checks. No review-response deadline is promised without staffed coverage.

## Contribution metadata and browser checks

Existing-file contributions edit content, not shared hashes. New files add a uniquely named `contributions/<change-name>.json` declaration with `schemaVersion: 1`, a `files` array of `path`/`originRole` entries (`criticalComment: true` for critical code), and a `documents` array of `{en, zh}` pairs for new reading documents. Declare both document paths in files. Use complete repository-relative paths and explain authorship, license, references and AI assistance. The existing `contributions/m0-tooling.json` is a structural example, not a source statement to copy. Choose a separate filename for each contribution; do not edit another contribution's declaration.

The normal full prepush derives current publication metadata read-only from the Git merge base with origin/main. It does not require contributors to edit localization.json, source-origin.json or documentation-layout.json. Keep origin/main available and current; in a fork, add/fetch the upstream repository and set EGRET_METADATA_BASE to the exact target-base commit for validation. A one-language draft may be discussed, but the push hook still requires paired final readings. Ask for translation help before delivery if needed.

After content, source and bilingual review, the integrator selects the final base and runs:

```text
node tools/contribution-metadata.mjs --base <target-base-commit> --write
node tools/contribution-metadata.mjs --base <target-base-commit> --check
node tools/prepush.mjs --integrated
```

Set EGRET_METADATA_BASE to that same commit when running prepush if its default merge base differs. Commit the integrated ledgers with the reviewed content. CI uses the PR base SHA and refuses stale integrated metadata; it never writes back to contributor branches. Any new content, declaration or base requires regeneration and fresh checks. The generator changes only current derived fields and registered additions; unrelated old source rows and all historical objects are retained. Deletions, renames, provenance changes to existing rows and historical/schema changes need a separate reviewed migration. Byte hashing remains exact. Generation does not certify translation quality, source rights or behavior.

For current browser checks, install Playwright and playwright-core **1.62.1** in a separate tool directory and use Windows x64, Node **26.7.0** and installed Edge:

```text
node tools/browser-verify.mjs --suite canvas --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository>
```

Direct suites are canvas, webgpu, b1, text, hit-test and mouse-input. Resource-scene and bitmap-slot additionally require a reviewed source snapshot:

```text
node tools/browser-prepare.mjs --suite resource-scene --output <absolute-new-snapshot-file-outside-repository>
node tools/browser-verify.mjs --suite resource-scene --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository> --snapshot <absolute-reviewed-snapshot-file> --snapshot-sha256 <reviewed-raw-sha256>
```

Use bitmap-slot in both commands for that suite. Build with the selected toolchain before preparation. Preparation does not launch a browser or approve its output: review the complete source closure, owners, imports and original oracle first, then provide the reviewed raw digest explicitly. The collector recomputes its complete closure before native execution; changed source/build inputs require a new snapshot and review. Do not automatically pipe an unreviewed generated digest into execution. Resource-scene retains its fixed Edge 155.0.4283.45/font reference; another browser version is not automatically accepted.

Output parents must already exist and selected files/directories must be new and outside input owners. The entry refuses extra Node flags, NODE_OPTIONS/NODE_PATH, wrong versions, changed snapshots and missing completion receipts. It records failures, does not download browsers and preserves original pixel/control assertions. Desktop subsets do not prove mobile, general Chinese-font performance or complete engine capability. Consult tools/browser-tool-matrix.json: prepared-group, atlas, BIP1 PNG and five separately admitted literal-scene profiles use the [resource-family workflow](resource-browser-workflow.md) with separate fixture/configuration admission; fixed Node 24.19.0 experiments retain historical status and cannot be replaced by these suites. Rendering changes still require their affected domains. Independent OS process retirement is not certified by the wrapper.

## Risk-selected local feedback

```text
node tools/check-incremental.mjs --base origin/main --explain
node tools/check-incremental.mjs --base origin/main
```

The first command prints paths, reasons and the selected profile without running checks. In a fork, fetch upstream and use its target ref instead. The base must resolve to an ancestor of HEAD; missing/unrelated refs fail. Omitting --base uses the merge base of HEAD and origin/main. Committed, staged, unstaged and nonignored untracked inputs are all considered.

Only modified existing README/CONTRIBUTING reading editions or Markdown files directly under knowledge-base/en/docs and knowledge-base/Cns/docs select documentation feedback. That runs doctor, raw-byte hygiene, derived publication/bilingual checks, selector controls and read-only knowledge-base validation. Additions, deletions, renames, policy, source metadata, code, tests, dependencies, configuration, unknown paths and an empty change set select the full prepush. This conservative first version does not select individual engine tests or cache previous acceptance. It is most useful before maintainer ledger integration, which itself selects the full gate.

pnpm check:quick remains available for build/boundary/onboarding feedback. Neither local feedback command replaces the complete committed push hook, integrated merge gate, affected browser acceptance or independent source/bilingual review. A local PASS is not a merge receipt.

If an example never becomes Ready, report backend, failed step and sanitized diagnostics. Missing human participation, phones, mini-game hosts and font workloads remain unexecuted in the [M0 result record](m0-community-foundations.md).

Texture, frame-animation and SpriteSheet changes use the [current historical-domain workflow](historical-browser-workflow.md). Start with setup/headless results; ask maintainers to prepare original review evidence and external process-retirement validation.
