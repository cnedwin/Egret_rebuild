# Preparing check maintenance

English | [简体中文](../../Cns/docs/check-maintenance.md)

Contributors can continue with the complete gate when a source baseline or test catalog needs attention. Maintaining these records is a maintainer task; a newcomer does not need to invent review receipts or update historical hashes to submit useful work.

The maintenance tool prepares review inputs from current files. It reduces manual transcription and discovery across supported declarations. It never edits a baseline, installs a catalog, runs product code or grants acceptance. Original hooks, CI and source/strict/behavior obligations remain required.

## Prepare and recheck

Use the pinned Node 26.7.0 environment and a complete build before preparing source/emission records. Keep generated proposals outside the checkout. The following redirection assumes UTF-8 output, including the documented PowerShell 7.6.5 environment.

~~~text
pnpm build
node tools/prepare-check-maintenance.mjs --baselines > ../baseline-proposal.json
node tools/prepare-check-maintenance.mjs --catalog > ../catalog-proposal.json
node tools/prepare-check-maintenance.mjs --check ../baseline-proposal.json
node tools/prepare-check-maintenance.mjs --check ../catalog-proposal.json
~~~

A proposal has status review-required. A successful recheck reports current-inputs and acceptance: none. It proves that the supported inputs and proposal content still agree; it does not prove correctness, review, fresh compilation or a passing gate. A build is a separate recorded action. Rechecking re-reads inventories and raw bytes rather than trusting a saved PASS. Changed generator/helper/owner bytes, targets, test membership or proposal content invalidate the prior proposal. Persistent drift during preparation is refused; this is not hostile-process isolation.

## Source baseline scope

| Owner | Registered declarations |
| --- | --- |
| SpriteSheet | graphPins, configurationPins, ss1AtlasGraphSuccessor |
| Browser PNG | acceptedSnapshot.graph, acceptedSnapshot.stablePins, atlasGraphSuccessor |
| Sequence playback | seqpbPackages, seqpbStableEntries, seqpbConfigurations |

Each declaration keeps its own expected and current pin for every path, with same/different/missing identity labels. The owner bytes and declaration selector remain explicit. These are declaration-versus-current raw comparisons, not diagnoses of gate failure: retained historical values may differ from an already-admitted successor. Never flatten alternatives or replace all different rows. The complete current .ts/.js inventory under the four packages' src/dist and engine web/rendering directories is captured, including ignored build outputs, to expose new files as well as changed ones. graphCoverage lists current pins absent from each supported complete graph and its named successor. This means unlisted by those declarations, not unaccepted by policy; base and successor rows remain separate. Configuration-only lists are not treated as complete code graphs. Missing required directories require a build/setup repair; missing declared files are visible in rows. Wrong spelling, links and nonregular paths are errors, not missing files.

The initial reader supports a restricted declaration format: one registered top-level const with a single-line JSON initializer. It reads the preceding ordinary strings/comments and balanced brackets without importing or evaluating boundary modules. Ambiguous raw const-name occurrences (including harmless comment/string decoys), templates, regex/division or escaped identifiers in that prefix, unclosed or mismatched delimiters, missing or unsupported declarations, invalid pins and duplicate paths within a list are refused. An unsupported owner format requires manual review; this is not a general JavaScript parser. Pin identity compares path, bytes and SHA-256, independent of JSON field order. It excludes compiler dependency owners, Host base/current pair evaluation, other BRS/BBT/resource/atlas policies and semantic/API/type/native acceptance. Owners outside this scope still need their established procedures. A proposal does not automatically explain conditional successor admission or provide an exhaustive dependency map.

## Test catalog scope

The proposed catalog enumerates the complete current top-level tests/*.test.mjs membership. Unchanged tests retain their reviewed package ownership only while their declared support, all four package manifests/graph and full-runner schedules remain unchanged. Changed or new tests and changed/missing support become shared. Manifest or schedule changes conservatively make all tests shared. Removed tests are listed; missing support stays explicit in unavailable inputs, and available support is retained. Existing shared tests are never automatically promoted to a narrower package.

The proposal binds the old catalog, generator, identity helper, manifests, schedules, tests and declared helpers. It does not infer new import closures. Maintainers independently review the proposed changes, source ownership and actual selected behavior before installing the catalog through the canonical repository writer and refreshing current provenance. A generated catalog is review material even when its bytes equal the existing one. It is never automatically consumed by the selector. The complete publication lane and all shared tests remain required; narrowing or caching expensive shared checks is outside this increment.

## Review and delivery

1. Build and prepare proposals; inspect changed/missing rows and the supported scope.
2. Review each affected source/semantic boundary and old-versus-current alternative. Keep original evidence intact; design any new admission explicitly.
3. Review catalog ownership and helper closure. Install only reviewed current metadata, with English comments and paired English/Chinese documentation.
4. Run actual positive and negative controls, then complete local and committed push checks and protected PR CI. Recheck proposals after any input edit.
5. Record actual delivery and remaining limitations separately. AI review is not human approval.

The initial controls cover proposal freshness, raw owner/target identity, added output files, missing versus aliased paths, non-executing declaration parsing and conservative catalog changes. Actual commands, failed attempts, independent reviews and final delivery belong to the PR record. This work reduces preparation effort; it does not claim a measured check-time speedup or complete source-baseline migration. Human/external-fork onboarding (#52), other policy-owner workflows (#53), devices/hosts, full Spine and scenario/performance budgets (#54) remain open.
