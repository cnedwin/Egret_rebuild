# From source to motion

English | [简体中文](README.zh-CN.md)

This finite example builds a two-frame red/green atlas and an unrelated blue image from original Apache-2.0 synthetic sources. Its metadata follows the fixed Aseprite 1.3.18.6 profile; it is not a real exporter qualification.

After the repository's standard dependency setup and build, run with the pinned Node 26.7.0 runtime from the repository root:

```text
node tools/content/author-example.mjs
```

Each invocation creates a fresh `work/content-build-example/run-*` directory and prints its location. The helper retains earlier runs, creates the source snapshot and four-resource recipe, invokes the same finite CLI, and saves `candidate.json`, `receipt.json` and `browser-config.json`. Generated caches and output belong to this ignored work directory.

For a reproducible browser check, use an installed Playwright 1.62.1 package and Microsoft Edge with the existing finite collector:

```text
node tools/verify-content-build.mjs --playwright ABSOLUTE_PLAYWRIGHT_PACKAGE --output NEW_ABSOLUTE_DIRECTORY_OUTSIDE_REPOSITORY
```

The collector creates its own run, serves only the captured example and its declared dependencies on loopback, then records full-frame pixels and cleanup. It closes the page and server when finished. The standard example server does not currently expose this generated content example; no general repository server is needed for this check.

The generated configuration pins candidate.json as well as the manifest. The page first verifies the committed candidate bytes, follows its e_generation selector and checks the target, generation, resource references and manifest file record against the configuration. Only that selected manifest is fetched, SHA-256 checked and admitted through the public contracts API. A finite example validator checks this specific first revision; it is not a general project parser. The public createManifestContentLoader factory then reads all four primary artifacts through the existing verified byte source and PNG provider. Its Scope-owned group validates and assembles the dependencies before ready, then exposes getImage/getAtlas/getSequence. The page does not register custom metadata loaders, parse artifact JSON or manually construct sheets/clips. Applications still own their display/playback objects and explicit clock. No handwritten runtime manifest is used. The initial red square becomes green at 0.125 seconds while the blue square stays blue.

For finite local browser collection, `window.contentBuildExample` exposes `ready`, `advance(seconds)`, `readSnapshot()`, `replace(configUrl)`, `cancelReplacement()` and idempotent `close()`. Time is monotonic and limited to ten seconds. Replacement prepares a separately admitted generation and switches only when its complete group is ready; failed/cancelled attempts are recorded in snapshots and keep the active display. The fixture explicitly starts the replacement at its first frame. Shutdown cancels pending work immediately, retires display/playback before data groups, and awaits loader close. Snapshots include actual Canvas pixel samples, separate source/provider counters, diagnostics and retirement evidence.

The existing collector builds a second generation with the same resource IDs and reversed authored frame order. Its finite Canvas schedule covers ordinary playback, corrupt bytes, a held HTTP response cancelled before late completion, failed/cancelled replacement preserving the old pixels, successful replacement and complete cleanup. Earlier snapshots and failed runs are retained. The collector is not a WebGPU/WebGL2, phone, physical-memory or performance qualification. This source package alone does not establish a browser pass; each independent run records its own result. See the [runtime ownership contract](../../knowledge-base/en/docs/content-build-pipeline.md#loading-build-artifacts-at-runtime).

## Explicit CLI

```text
node tools/build-content.mjs --root ABSOLUTE_PROJECT_OWNER --project project.json --recipe recipe.json --cache ABSOLUTE_CACHE_DIRECTORY --output ABSOLUTE_OUTPUT_DIRECTORY --snapshot-out candidate.json --receipt receipt.json --selector e_generation --transaction t_build
```

All nine flags are required exactly once. Directories must already exist. Project, recipe, snapshot and receipt names are canonical owner-relative paths; new output files must not exist. Configuration reads are bounded to 4 MiB and fatal UTF-8; recipes are strict JSON with no duplicate keys, comments or trailing commas, and at most 32 levels. The CLI authenticates source pins even on warm cache hits.

The CLI commits to a local in-memory ProjectStore and exclusively writes a **new candidate snapshot**. This is **not an atomic replacement of an on-disk current project**, and there is no independent current pointer. A ready-but-unadopted generation is recorded with its actual status and a nonzero exit code; no adopted candidate is exported. Existing source snapshots and output files are never overwritten.

For tests or a collector that owns another directory, the helper accepts only `--parent ABSOLUTE_EXISTING_DIRECTORY`. Its configuration uses a base relative to its own URL, so a server may mount that generated run at an explicit local path.
