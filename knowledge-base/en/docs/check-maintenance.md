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

The initial reader supports a restricted declaration format: one registered top-level const with a single-line JSON initializer. It reads the preceding ordinary strings/comments and balanced brackets without importing or evaluating boundary modules. Ambiguous raw const-name occurrences (including harmless comment/string decoys), templates, regex/division or escaped identifiers in that prefix, unclosed or mismatched delimiters, missing or unsupported declarations, invalid pins and duplicate paths within a list are refused. An unsupported owner format requires manual review; this is not a general JavaScript parser. Pin identity compares path, bytes and SHA-256, independent of JSON field order. The additional registered JSON owners and raw Host pair observations are described below. Compiler/dependency owners, conditional admission, multi-owner resource/atlas snapshots and semantic/API/type/native acceptance remain outside this reader. Owners outside this scope still need their established procedures. A proposal does not automatically explain conditional successor admission or provide an exhaustive dependency map.


## Additional policy owners and shared references

The same --baselines command also reads the following registered JSON fields. It records each boundary's policyPin/inventoryPin expected and current identity in policyLinks, requires the exact registered target path, and binds both files. A changed policy file is visible as a raw difference; generation does not authenticate or admit that new policy.

| JSON owner | Registered fields |
| --- | --- |
| tools/bitmap-resource-slot-policy.json | packages, configurations, stableEntries, oldRootPins, oldEngineDeclarationPin, workspacePins |
| tools/bitmap-binding-ticket-policy.json | The six fields above, plus selectedProductPins |
| tests/types/atlas-import-diagnostic-expectations.json | sourcePolicy.modules, sourcePolicy.configurationPins |

There are 24 ordinary pin declarations across the original and additional owners, three policy links, and two separately represented Host pair declarations. Counts identify the implemented registry, not an exhaustive list of repository obligations. JSON duplicate keys, including escaped spellings of the same key, malformed selectors/pins and duplicate paths within a declaration are refused. New JSON fields are not recursively harvested. The additional selectors accept only the documented workspace configuration, four-package source/emission/type-test and tests/types configuration domains; dependency/private paths are refused. Atlas inputPins, compiler fields and jsoncPins remain bound as part of the JSON file's raw bytes but are not read as dependency-owned files or interpreted as acceptance evidence.

The four oldRootPins/oldEngineDeclarationPin groups have comparison: transformed-baseline-raw-observation. Their real gates remove selected additions before comparing historical content. A raw difference here does not recommend updating the old pin; inspect the original transformation and prove the intended interface separately. Missing required JSON owners refuse preparation, while missing declared targets remain visible in rows.

The two imageResidencySuccessors declarations retain each path's base and successor identities beside its current file identity. Row labels are base, current, both, neither or missing. These are raw observations only: the real Host gates require compatible whole-group versions, so mixed row matches do not grant admission. Pair arms cannot introduce another path. Hard-coded Atlas package successors and inverse transformations are not evaluated by this tool.

references is a path-sorted reverse index of every supported pin occurrence. For a changed full logical path, inspect its owner, binding, branch, comparison mode and expected identity together. The same file can have several historical/current expectations; none is collapsed into a single replacement hash. graphCoverage now includes Atlas sourcePolicy.modules as a separate complete code graph. This index helps find shared maintenance obligations; it does not select fewer checks, discover all dynamic imports or describe every policy dependency.

Resource-scene and atlas-frame source collectors use their existing multi-owner snapshot procedures. They include external package ownership, dynamic module closures and original asset evidence, so they are not folded into the single-repository pin reader. Continue using the [advanced browser workflow](getting-started.md) and [resource browser workflow](resource-browser-workflow.md) for their supported suites, and the owner-specific source tools where applicable. Keep original snapshots and oracles intact. Compiler/dependency migration, conditional admission, semantic/types/native checks, human/fork onboarding and device/performance acceptance remain separate work. Every publication still requires independent review, actual controls, bilingual checks and the complete local/push/PR gates.

## Multi-owner snapshot maintenance

Use tools/prepare-snapshot-maintenance.mjs for the existing resource-scene and atlas-frame source collectors. The wrapper collects the current checkout, compares an optional prior snapshot or proposal, and prints review material to stdout. It never installs a new baseline or changes a collector. Existing emitted artifacts and exact installed dependencies are prerequisites; run the documented setup/build separately. No build, browser, server or product/compiler module is executed by this workflow. Trusted collector and identity-helper code is executed to read the existing source closure.

PowerShell 7 examples (keep artifacts outside the checkout):

~~~powershell
node tools/prepare-snapshot-maintenance.mjs --family resource-scene > ../resource-snapshot.json
node tools/prepare-snapshot-maintenance.mjs --check "$(Resolve-Path ../resource-snapshot.json)"
node tools/prepare-snapshot-maintenance.mjs --family resource-scene --baseline "$(Resolve-Path ../resource-snapshot.json)" > ../resource-comparison.json
node tools/prepare-snapshot-maintenance.mjs --family atlas-frame > ../atlas-snapshot.json
~~~

Without a baseline, the proposal explicitly reports comparison: not-provided. With one, changes are keyed by owner plus complete logical path. Added, removed and changed rows preserve both records, including resource-scene roles. Identical paths from different owners remain separate. Owner-root spelling or relocation appears separately; it is never normalized into a replacement fingerprint. structureChanges identifies other changed top-level fields, including module edges, routes, closures, aliases, build resolutions and acceptance metadata; the complete current snapshot remains available for inspection.

The wrapper supports the current resource-scene SDK/application/foundation owners and Atlas repository/compiler/compiler-native/project-json/foundation owners. Resource application and SDK both use the current checkout; split application roots remain with the original collector. Atlas uses the ordinary collection selector and retains the original Windows x64 compiler limitation. A historical Atlas snapshot has no scenario discriminator: structural compatibility does not authenticate its scenario or provenance. This command does not add cross-platform compiler admission or migrate other compiler/source-boundary rules.

Only the explicitly supplied baseline JSON file is read. Its historical owner roots and any nested baseline reference are data, never read targets. A prior proposal supplies its saved snapshot only; a saved success or review label grants no authority. Duplicate decoded JSON keys, unsupported top-level schemas/owner sets, duplicate inventory keys, invalid paths and undeclared module owners are refused. Artifact inputs are limited to 16 MiB. Comparison uses the saved record ordering conservatively; harmless reordering can still require review. These checks are bounded structural validation, not full semantic validation of historical module/route metadata.

--check rereads the selected baseline artifact, re-runs the current source collector and compares the entire regenerated proposal, including its differences and implementation pins. Generator, parser, identity helper, collector and baseline bytes are bound and rechecked during collection; collection and recheck are private to a fresh direct Node CLI invocation with empty execArgv, NODE_OPTIONS and NODE_PATH. Exported helpers only compare or parse data; they do not collect. This execution contract does not isolate a caller that manipulates process globals. A changed input, added collected file or edited proposal requires regeneration and review. This is freshness checking within the existing collector scope, not hostile-process isolation or a repository-wide dependency map. A current-inputs result still has acceptance: none. Native execution continues through the existing advanced/resource browser workflows and their separate reviewed inputs, controls, cleanup and device requirements.

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
