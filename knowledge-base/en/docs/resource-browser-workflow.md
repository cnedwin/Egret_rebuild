# Resource browser verification

English | [中文](../../Cns/docs/resource-browser-workflow.md)

This M0 workflow prepares, reviews and runs existing resource collectors. It changes no engine feature or pixel oracle. Use Windows x64, Node 26.7.0, the repository's pinned compiler, installed Edge and Playwright/core 1.62.1. Complete setup and build first. The separate Playwright package must already be installed; these commands download nothing. PNG admission uses the current exact hoisted dependency owner established by setup; old isolated layouts require a fresh current installation.

## Choose a family

| Family | Complete run | Preparation |
| --- | --- | --- |
| prepared-groups | Canvas and WebGPU scene-textured, each with ordinary, old-A-outer and old-B-trim cases: six cases | Original configuration producer, then complete source snapshots |
| atlas | Canvas and WebGPU textured-2D, each with ordinary, rotation-sign, trim-y-constant and atlas-import-v1: eight cases | Disposable healthy/assigned copies, actual compiler receipts and snapshots; importer also records the actual public planner call |
| png | BIP1 Canvas/WebGPU PNG decoding, composition, saved replay and two wrong-oracle controls | Original source/actual evidence, complete module graph and admission |

These resource families complement the eight existing browser suites. A family completes only after every listed case passes. Historical texture/sequence/SpriteSheet collectors and additional PNG-based nine-slice/container/anchor profiles retain their own schemas and acceptance obligations. BIP1 does not silently certify those profiles.

## Prepare and review

Create an external parent directory, then choose a new child for each attempt. Do not reuse failed or partial output directories.

~~~text
node tools/browser-resources.mjs prepare --suite prepared-groups --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory>
node tools/browser-resources.mjs prepare --suite atlas --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory>
~~~

Preparation prints the manifest path, raw SHA-256 and case count. It reports reviewed=false and browserRun=false. Atlas preparation compiles disposable copies and needs permission to create their package directory links. It never modifies the development checkout. A denied link or failed compiler is a preparation failure, not a rendering failure; retain its logs and retry in a new authorized directory.

Before running, review the complete manifest and each original config/snapshot, finite oracle, source owner and dependency closure. For atlas, include the genuine healthy/assigned build records and importer input/plan/receipt. A digest identifies bytes; generating it does not perform source review. Record reviewer identity and scope separately, distinguishing AI review from human approval. Do not pipe an unreviewed digest directly into execution.

~~~text
node tools/browser-resources.mjs run --manifest <absolute-reviewed-manifest.json> --sha256 <reviewed-raw-sha256>
~~~

The entry checks the complete family before starting, rechecks each case's reviewed raw bytes immediately before its child, and rechecks all cases before recording family completion. It also hashes the actual bytes returned by each reviewed read. Each original collector recomputes its complete snapshot or admission before launching its browser. Modified sources, imports, configuration, build inputs or runtime identities require new preparation and review. The run preserves per-case stdout, stderr, process results and native artifacts; the final result.json exists only after the complete family passes. A successful process exit without the expected native receipt does not pass. Original strict pixels, assigned controls and resource retirement remain mandatory.

## PNG evidence input

PNG preparation is a maintainer-assisted workflow. New contributors can request evidence preparation/review in their PR; they should not invent review receipts or manually edit historical ledgers. Use this command only after the required evidence exists:

~~~text
node tools/browser-resources.mjs prepare --suite png --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory> --evidence <absolute-original-evidence.json> --evidence-sha256 <reviewed-evidence-sha256>
~~~

The input contains schemaVersion=1, sourceFilesRoot, graphInputs, reviewPins, proofBindings and runtime. sourceFilesRoot and graphInputs.repositoryRoot select the current checkout. graphInputs lists the exact collector roles/routes, encoded fixture pins and literal schedule pin. runtime names and pins the actual Node executable, installed Playwright entry, Edge executable and its declared package inventory. Paths are absolute or complete owner-relative paths as required by the original collector; basename matching and byte normalization are forbidden.

reviewPins contains exactly eleven roles:

| Source review | Actual evidence review |
| --- | --- |
| plan, productSource, observerSource, collectorSource | missingEntryRed, cpu, build, strictTypes, policy, observerUnits, fixtures |

Each role points to its original file, bytes and SHA-256. proofBindings explicitly maps accepted JSON pointers to current graph files, including their original owner pointer or candidate owner-manifest pointer. The producer creates the graph and admission, then runs the original admission validator; it does not create any PASS_SOURCE or PASS_ACTUAL verdict. Missing, stale or unaccepted evidence blocks preparation before browser launch.

The build review must bind the current checkout, a genuinely executed successful stock build and exactly four current image/BrowserTextureProvider JS/declaration pins. Historical missing-entry RED remains historical. Unchanged original source, fixture or test evidence may be retained only after complete raw-byte/owner verification; newly executed commands and changed files need their own records. A copied old build review is not current build qualification.

## Troubleshooting and acceptance

- Wrong digest, noncanonical path, reused output, missing family cases or changed inputs: correct the input and prepare a new directory; never edit an already reviewed manifest to make it pass.
- Preparation fails: inspect the retained prepare/snapshot process and stderr logs. Do not launch the collector manually to bypass admission.
- Browser unavailable, missing WebGPU or native cleanup failure: preserve the incomplete/failing result. Record the actual environment; do not turn an unavailable capability into a pass.
- Full push hooks and protected merge CI remain required. The standard structural/headless gate does not run these browsers; attach applicable family evidence to the PR separately.

Desktop results do not establish human onboarding, external-fork approval, phone/mini-game behavior, full Spine, general Chinese-font performance, power or performance budgets, or independent OS process-retirement acceptance. Those obligations remain explicit in the M0 record and public issues.
