# Reproduce the bounded B1 WebGPU checks

[简体中文](../../Cns/docs/b1-browser-verifier.md) · [B1 Host contract](b1-host-contract.md)

`tools/verify-webgpu-b1.mjs` is a first-party, experimental browser verifier for the current B1 mesh Host. It uses real WebGPU compilation and raw pixel readback. Its fixture and independent literal oracle are in `tools/b1-webgpu/`; it needs no private execution helper or operating-system Job wrapper. The selected internal B1/geometry modules remain outside the stable package exports.

## Run the command

Use Node.js **v24.19.0** without added execution flags, the repository's **pnpm 11.25.0 / TypeScript 7.0.2** configuration and an installed **Playwright 1.62.1 / playwright-core 1.62.1** package pair. Install Microsoft Edge separately for the **msedge** channel. These are the current reproducibility profile, not a latest-version recommendation. The tool installs no dependencies.

Build the repository with its existing `node tools/build.mjs`, then run from the repository root:

```text
node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"
```

Replace both placeholders with your own absolute paths. `--playwright` points to the installed package directory containing `package.json` and `index.mjs`; its corresponding core package is resolved from there, supporting nested or sibling installation layouts. Exactly these three option/value pairs are required, in any order. There are no case selectors, added browser flags or implicit installs. Launch is headless with a fresh browser context and DPR 1.

Choose an absent output child outside the repository. Its parent must already exist; the path and all existing ancestors must be canonical directories without symlinks or junctions. Existing output files/directories are refused. CLI, path and installed metadata admission precede output creation and Playwright import. The selected installed tool code is trusted by the caller; admission is not a sandbox for hostile modules. The verifier never overwrites or deletes caller files.

## What it checks

The fixed fixture is **64×64**, opaque and single-sampled. It compares normalized RGBA bytes against independently authored literals, using no screenshots or PNG decoder.

| Baselines | Expected behavior |
| --- | --- |
| F1–F2 | Reverse-depth visibility remains correct in both draw orders. |
| F3 | Two MVP transforms share geometry while retaining distinct placements. |
| F4–F5 | Rectangle and image UI preserve painter order above the scene. |
| F6 | A subsequent frame resets to black. |
| F7 | Geometry behind the camera is homogeneously clipped. |

Five negative cases change disposable emitted-module copies, leaving the originals unchanged: N1 reverses the depth comparison; N2 reuses the first MVP; N3 reverses UI order; N4 supplies invalid mesh WGSL; N5 takes the absolute clip-w. N1/N2/N3/N5 require the named real readback failure and exact wrong-color literal. **N4 requires an actual WGSL compilation error, asynchronous validation rejection and Host startup failure, with zero submitted frames.** Only its matching console-error diagnostics are expected; page errors, request failures and HTTP errors remain failures.

A complete browser PASS requires **7 baseline frames, 5 intended negatives, 11 renders and 8214 baseline literal RGBA comparisons**. No shortened schedule, retry or animation loop counts as success. The bounded source-specific module scan serves only captured emitted bytes through selected loopback routes: at most 128 modules, 1 MiB each and 4 MiB total. It is not a general JavaScript parser or a browser/bundler loading guarantee.

## Read the result

The output records include `result.json`, `inputs.json`, `requests.json`, raw `.rgba` frames and copied-module patch receipts when those stages complete. An emergency exit may leave `hard-abort.json` and incomplete artifacts instead; missing evidence cannot count as PASS. The report records actual `browser.version()`, installed Playwright metadata and before/after source, tool and emitted-build hashes. Local reports may contain installation/output paths; review and sanitize them before sharing.

| Exit | Meaning |
| --- | --- |
| 0 / PASS | The complete selected checks and observed cooperative API cleanup succeeded. |
| 2 / UNSUPPORTED | A required capability was actually unavailable and cleanup completed. |
| 1 | Setup refusal, or FAIL / INCOMPLETE after admission: a check failed, evidence could not be saved, or execution/cleanup remained incomplete. |

The fixture owns the real GPU device and lends it to the Host. It observes native promises, closes and drains the Host before destroying that device, and observes intentional device loss. The CLI observes page/context/browser/server cleanup and records unsettled operations. A timeout does not cancel work or prove retirement; cleanup failure prevents PASS or a clean UNSUPPORTED result.

**Internal budgets begin after setup admission and exclusive output creation.** The operation deadline is 70 seconds, cooperative close deadline 85 seconds, and emergency direct exit is reserved at 89 seconds within the declared 90-second budget. This is not an end-to-end guarantee for setup plus execution.

The channel-resolved browser executable identity and operating-system descendant retirement remain **UNBOUND**. Observed browser version and API cleanup do not establish an exact browser binary, full process ancestry, hardware acceleration or performance.

## Current evidence

As of **2026-10-10**, `tests/b1-webgpu-verifier.test.mjs` passed **30/30** checks in both a private candidate layout and the adopted public repository. These are 18 CLI refusal checks and 12 independent literal-oracle checks; neither run launched a browser or verified GPU pixels.

The adopted public command subsequently recorded **PASS** in Microsoft Edge **154.0.4258.62**: **7 baselines, 5 negatives, 11 renders and 8214 literal comparisons**. All **6 Hosts** returned safely with zero pending ledger values; the raw frames, source-bound records and before/after identities were saved. Independent saved-artifact review recorded **PASS_SAVED_PUBLIC_B1_ARTIFACT_INTEGRITY**, with no actionable P1/P2 findings; the bounded saved result is accepted. See the [compact public-run record](../../evidence/b1-public-browser.json).

The original collector's earlier accepted desktop result remains historical and is not substituted for this fresh public-entry run. The standalone CLI still has **UNBOUND** channel-binary identity and OS descendant retirement. This recorded run additionally had an external process owner whose Job reached active-zero and closed; that observation belongs to this attempt and is not a requirement or universal promise of the standalone tool. Timings are execution guards, not performance measurements. This evidence curation contains no successor complete prepush; a fresh prepush must pass before any push.

This verifier does not establish phone coverage, a Native app/SDK, physical display output, device performance, A2 alpha-texture completion, fonts, DragonBones, complete migration or whole-engine acceptance. Default prepush remains browser-free.
