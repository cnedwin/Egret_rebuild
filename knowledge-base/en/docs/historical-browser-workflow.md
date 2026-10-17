# Texture, frame animation and SpriteSheet verification

English | [简体中文](../../Cns/docs/historical-browser-workflow.md)

Use Node 26.7.0, the repository's pinned installation, installed Playwright/core 1.62.1 and default Microsoft Edge on Windows x64. These are explicit tools for five existing observation domains. They add no engine feature and do not replace the normal full push/merge gate. Previous Node 24 receipts remain historical; their bytes, failures and review cutoffs are not rewritten.

## Choose the affected domain

| Suite | Required original comparison domain |
| --- | --- |
| textured-webgpu | 11 calibration + 10 held-out cases, 27 positive observations; 16 control windows / 19 observations, all 12 controls sensitive |
| textured-scene | Two combined 3D/texture observations, 12 selected pixels each; assigned wrong-oracle rejection |
| sequence-player | Canvas/WebGPU explicit-time player; eight submissions, 1,024 channels including saved replay |
| sequence-playback | Canvas/WebGPU clock-driven once/loop/pause/resume; 18 submissions, 16 new captures + two replays, 2,304 channels |
| spritesheet | Canvas/WebGPU named actor/static icon plus clock playback; 18 submissions, 16 new captures + two replays, 2,304 channels |

These counts specify completeness, not measured performance. The original fixtures, numerical oracles, tolerances and retirement checks remain authoritative. A successful process exit or prepared digest alone never qualifies the domain.

## Contributor path

1. Complete [setup and headless validation](getting-started.md). State the affected suite in the PR. Contributors without the Windows/Edge rig can submit source and headless results with native validation pending; a maintainer must arrange the affected native gate before claiming acceptance.
2. Build current sources with node tools/build.mjs. For playback/SpriteSheet, use the actual-build producer below and request independent review of its evidence. Do not create PASS reviews yourself or edit historical ledgers.
3. Prepare a fresh external directory. Read the manifest, source/build inventories and original admission with an independent reviewer. Record who reviewed which bytes; AI review is not human approval. Only then run the reviewed digest.
4. Retain raw artifacts and failed attempts. Attach the precise suite outcome, raw manifest/result identities, review and outstanding external-owner facts to the PR. Full push hooks and protected CI still run.

~~~text
node tools/browser-history.mjs prepare --suite sequence-player --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory>
node tools/browser-history.mjs run --manifest <absolute-reviewed-manifest.json> --sha256 <reviewed-raw-sha256>
~~~

Replace sequence-player with textured-webgpu or textured-scene for texture domains. Texture preparation performs a real bounded stock build and freezes its complete inputs, shader and assigned control recipes in the new directory. No previous freeze is overwritten. Mixed-scene preparation records current products instead of accepting a historical hardcoded product fingerprint. Its reviewer must bind those products and emissions to the actual successful current build; preparation is not approval. All paths must be absolute; quote paths containing spaces. The output parent must already exist, and each attempt uses a new child directory outside the checkout and installed tools.

## Playback and SpriteSheet admission

~~~text
node tools/browser-history-build.mjs --suite spritesheet --output <absolute-new-build-directory>
~~~

The producer records actual command/executable/cwd, raw stdout/stderr, exit/timeout, timestamps, complete SDK source/emissions, twenty configuration rows, seven compiler/runtime owners and four workspace aliases for SpriteSheet. It produces admission.pending.json with PENDING_INDEPENDENT_REVIEW, empty reviews; the command summary reports browserRun false. This file cannot pass the original collector. Failed builds retain their raw attempt and do not produce accepted admission.

A maintainer assembles a separate admission after independent review, preserving every original producer pin. Set status ROOT_FROZEN_REVIEWED_CURRENT_BUILD only after review, and provide the original review roles and JSON pointers described in the `tools/sequence-playback/README.md` or `tools/spritesheet/README.md`. Playback needs plan/product/build; SpriteSheet additionally needs actual cpu/types/policy/units/example and nativeSource. The original build inventory remains pending its independent actual review where that schema requires it; the review qualifies those unchanged bytes. Missing roles, stale sources, another checkout, wrong compiler owners or unmatched build logs fail admission.

~~~text
node tools/browser-history.mjs prepare --suite spritesheet --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory> --admission <absolute-reviewed-admission.json> --admission-sha256 <reviewed-raw-sha256>
~~~

Use sequence-playback for the other original admission schema. The current exact dependency owners are hoisted node_modules/typescript, node_modules/@typescript/typescript-win32-x64 and node_modules/robust-predicates. Logical paths remain distinct from physical paths; raw hashes are never normalized. Before/after compiler and workspace owner observations remain mandatory.

## Results and limits

The runner rechecks current source membership, raw identities, installed runtime, original admission and freeze inputs before launch and after collection. Modified inputs require fresh preparation and review. It saves complete child logs and process status. Its PASS_BOUNDED_COLLECTOR means only the complete selected collector passed; native assertions still determine pixel, replay and resource-lifetime acceptance.

An independent external Windows Job owner remains necessary for OS-level process retirement: assigned ownership, raw stream EOF, active-zero and Job closure must be recorded separately with a watchdog no longer than 300 seconds. This wrapper is not that owner and never upgrades cooperative browser closure into OS retirement. Missing external-owner evidence remains open even when pixels pass. Human onboarding, external-fork approval, phones/mini-game hosts, general Chinese-font performance, power/budgets, full Spine and complete migration remain separate open obligations (#52/#54). M0 is not declared complete by this migration.
