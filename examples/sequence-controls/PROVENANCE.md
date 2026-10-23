# Provenance

English | [简体中文](PROVENANCE.zh-CN.md)

All example code, literal schedules, four-color pixels, synthetic metadata and documentation are original first-party Apache-2.0 work, authored with AI assistance and subject to source/result review. No third-party image, animation or game asset is included.

The 4×1 RGBA8 PNG is exactly red [255,0,0,255], green [0,255,0,255], blue [0,0,255,255], yellow [255,255,0,255]. Its 77 raw bytes have SHA-256 `93dbeb3c32fd10af3fdc12de5991dab542534b64adbe5d6cb2919a16adfff0b6`. [sources/generate-png.mjs](sources/generate-png.mjs) reproduces its original PNG chunks and refuses different existing bytes. Atlas inputs and the strict recipe are under [sources](sources/recipe.json). Aseprite 1.3.18.6 names only the existing finite importer schema; Aseprite was not used to export these assets. Main frame durations are four literal 250 ms values; the decimal reference uses the first two authored cells at 100 ms each.

The existing content-build CLI, public contracts/resource admission, SDK resource providers, sequence clip/sprite-sheet APIs and shared hosts are reused. The collector follows the repository's existing finite UI-panel/content-build collection pattern and restricted literal import reader. This is declared first-party mechanism reuse, not copied external application code. Development dependencies retain their existing repository license/provenance records; robust-predicates 3.0.3 remains a rendering dependency under Unlicense. No Spine runtime, data or license is involved.

Generated artifact identities come from actual content-build receipts. Browser evidence is collected separately from source and source-contract checks; no unexecuted outcome is represented as PASS. Failure attempts and retained output remain distinct from later successful runs.
