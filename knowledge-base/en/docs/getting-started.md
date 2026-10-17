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

1. Check the public milestones and Issues. Before claiming a `good first issue`, confirm it has a code entry, expected result, verification command and reviewer.
2. Fork, create a branch and make a focused change. Questions, reproduction samples, translations and device testing are welcome.
3. Run `pnpm check:quick` during iteration. It builds, checks actual package boundaries, exercises onboarding tools and runs the headless example; it is not the merge gate.
4. Open a draft PR with the problem, behavior, verification, compatibility and sources/AI assistance. English or Chinese drafts are accepted. Maintainers help complete bilingual content and current ledgers; historical evidence is never regenerated.
5. Before public delivery/Main merge, complete `pnpm check:merge`, bilingual review and any affected real-browser verification. Existing hooks still enforce the full gate; this first M0 delivery does not remove that obligation.

## Review and current boundaries

Edwin (`@cnedwin`) is the current integration contact. CODEOWNERS routes review requests; it is not evidence of independent approval. AI reviews are labeled separately from human approval. Core changes without independent technical review remain pending. Triage happens as maintainer capacity permits; if delayed, the maintainer records the blocker and next step instead of promising an unstaffed response time.

Contributors may request translation/metadata assistance in the PR. The final integrated tree must be checked after those updates. Public CI runs without repository write permission; initial fork contributions may need maintainer approval to run. Missing/failed/cancelled required jobs cannot produce the final `M0 / merge-ready` pass.

This delivery does not close M0: human newcomer rehearsal, full device/budget decisions, risk-based incremental checks, comprehensive ledger decoupling and legacy fixed-Node browser-tool migration remain open. Historical Node 24.19.0 collectors retain their original profiles; use them only with the recorded environment, never as proof of Node 26 compatibility.
