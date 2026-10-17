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

There are 24 ordinary pin declarations across the original and additional owners, three policy links, and two separately represented Host pair declarations. Counts identify the implemented registry, not an exhaustive list of repository obligations. JSON duplicate keys, including escaped spellings of the same key, malformed selectors/pins and duplicate paths within a declaration are refused. New JSON fields are not recursively harvested. The additional selectors accept only the documented workspace configuration, four-package source/emission/type-test and tests/types configuration domains; dependency/private paths are refused. In this single-repository reader, Atlas inputPins, compiler fields and jsoncPins remain bound only by the JSON file bytes. The separate registered compiler workflow below reads selected dependency inputs; neither workflow grants acceptance.

The four oldRootPins/oldEngineDeclarationPin groups have comparison: transformed-baseline-raw-observation. Their real gates remove selected additions before comparing historical content. A raw difference here does not recommend updating the old pin; inspect the original transformation and prove the intended interface separately. Missing required JSON owners refuse preparation, while missing declared targets remain visible in rows.

The two imageResidencySuccessors declarations retain each path's base and successor identities beside its current file identity. Row labels are base, current, both, neither or missing. These are raw observations only: the real Host gates require compatible whole-group versions, so mixed row matches do not grant admission. Pair arms cannot introduce another path. Hard-coded Atlas package successors and inverse transformations are not evaluated by this tool.

references is a path-sorted reverse index of every supported pin occurrence. For a changed full logical path, inspect its owner, binding, branch, comparison mode and expected identity together. The same file can have several historical/current expectations; none is collapsed into a single replacement hash. graphCoverage now includes Atlas sourcePolicy.modules as a separate complete code graph. This index helps find shared maintenance obligations; it does not select fewer checks, discover all dynamic imports or describe every policy dependency.

Resource-scene and atlas-frame source collectors use their existing multi-owner snapshot procedures. They include external package ownership, dynamic module closures and original asset evidence, so they are not folded into the single-repository pin reader. Continue using the [advanced browser workflow](getting-started.md) and [resource browser workflow](resource-browser-workflow.md) for their supported suites, and the owner-specific source tools where applicable. Keep original snapshots and oracles intact. Compiler/dependency migration, conditional admission, semantic/types/native checks, human/fork onboarding and device/performance acceptance remain separate work. Every publication still requires independent review, actual controls, bilingual checks and the complete local/push/PR gates.

## Multi-owner snapshot maintenance

Use tools/prepare-snapshot-maintenance.mjs for the existing resource-scene and atlas-frame source collectors. The wrapper collects the current SDK and selected application, compares an optional prior snapshot or proposal, and prints review material to stdout. It never installs a new baseline or changes a collector. Existing emitted artifacts and exact installed dependencies are prerequisites; run the documented setup/build separately. No build, browser, server or product/compiler module is executed by this workflow. Trusted collector and identity-helper code is executed to read the existing source closure.

PowerShell 7 examples (keep artifacts outside the checkout):

~~~powershell
node tools/prepare-snapshot-maintenance.mjs --family resource-scene > ../resource-snapshot.json
node tools/prepare-snapshot-maintenance.mjs --check "$(Resolve-Path ../resource-snapshot.json)"
node tools/prepare-snapshot-maintenance.mjs --family resource-scene --baseline "$(Resolve-Path ../resource-snapshot.json)" > ../resource-comparison.json
node tools/prepare-snapshot-maintenance.mjs --family atlas-frame > ../atlas-snapshot.json
~~~

Without a baseline, the proposal explicitly reports comparison: not-provided. With one, changes are keyed by owner plus complete logical path. Added, removed and changed rows preserve both records, including resource-scene roles. Identical paths from different owners remain separate. Owner-root spelling or relocation appears separately; it is never normalized into a replacement fingerprint. structureChanges identifies other changed top-level fields, including module edges, routes, closures, aliases, build resolutions and acceptance metadata; the complete current snapshot remains available for inspection.

The wrapper supports the current resource-scene SDK/application/foundation owners and Atlas repository/compiler/compiler-native/project-json/foundation owners. Resource application defaults to the current SDK checkout. Use --application-root with an absolute directory to select a separate application; the original collector still requires its exact application layout, original assets and matching collector implementation. This is support for that existing resource-scene layout, not arbitrary game projects. Atlas uses the ordinary collection selector and retains the original Windows x64 compiler limitation. A historical Atlas snapshot has no scenario discriminator: structural compatibility does not authenticate its scenario or provenance. This command does not add cross-platform compiler admission or change other compiler/source-boundary rules.

For a split application, --check also requires the explicit --application-root argument. Before collecting, its canonical directory must match the saved application label; omission, a different root or a forged label is refused. The selected path is resolved again after collection, and the collected application owner must agree. The caller supplies read authority; saved owner labels do not.

~~~powershell
node tools/prepare-snapshot-maintenance.mjs --family resource-scene --application-root "$(Resolve-Path ../application)" > ../split-snapshot.json
node tools/prepare-snapshot-maintenance.mjs --check "$(Resolve-Path ../split-snapshot.json)" --application-root "$(Resolve-Path ../application)"
~~~

Only the explicitly supplied baseline JSON file is read. Its historical owner roots and any nested baseline reference are data, never read targets. A prior proposal supplies its saved snapshot only; a saved success or review label grants no authority. Duplicate decoded JSON keys, unsupported top-level schemas/owner sets, duplicate inventory keys, invalid paths and undeclared module owners are refused. Artifact inputs are limited to 16 MiB. Comparison uses the saved record ordering conservatively; harmless reordering can still require review. These checks are bounded structural validation, not full semantic validation of historical module/route metadata.

--check rereads the selected baseline artifact, re-runs the current source collector and compares the entire regenerated proposal, including its differences and implementation pins. Generator, parser, identity helper, collector and baseline bytes are bound and rechecked during collection; collection and recheck are private to a fresh direct Node CLI invocation with empty execArgv, NODE_OPTIONS and NODE_PATH. Exported helpers only compare or parse data; they do not collect. This execution contract does not isolate a caller that manipulates process globals. A changed input, added collected file or edited proposal requires regeneration and review. This is freshness checking within the existing collector scope, not hostile-process isolation or a repository-wide dependency map. A current-inputs result still has acceptance: none. Native execution continues through the existing advanced/resource browser workflows and their separate reviewed inputs, controls, cleanup and device requirements.

## Registered compiler input maintenance

Use the read-only tools/prepare-compiler-maintenance.mjs entry to inspect explicitly registered compiler declarations. It does not import strict gates, compiler or dependency modules, or rewrite diagnostics and baselines. Build the existing outputs and install the pinned dependencies through the normal setup first.

~~~powershell
node tools/prepare-compiler-maintenance.mjs > ../compiler-proposal.json
node tools/prepare-compiler-maintenance.mjs --check "$(Resolve-Path ../compiler-proposal.json)"
~~~

The schemaVersion 3 proposal covers selected fields in all 17 current tests/types diagnostic-expectations JSON records. It registers 11 inputPins inventories: Atlas import/frame, BitmapResourceSlot, BitmapBindingTicket, LinearLayout, BitmapButton, display anchor offsets, the three container operations and nine-slice Bitmap. Atlas sourcePolicy.jsoncPins remains separate. Explicit legacy adapters cover browser PNG, SpriteSheet, sequence playback, ByteWriter, nine-slice and scene3d. These adapters read their registered compiler/configuration/product/fixture pins; the three final families bind tools/check-types.mjs as their strict actor. This catalog does not include every inline compiler policy or separate experiment.

Eight nativeLibraryPins lists belong exclusively to compiler-native, using their original lib/lib.es*.d.ts and decorator declaration paths. Their saved win32/x64 package identity and fixed metadata/binary pins are checked separately. Sequence playback and legacy nine-slice use their own explicit native pin spellings. A matching basename or matching bytes in the wrapper package never substitutes for native ownership. The reader accepts only these registered layouts; another platform or layout needs an explicitly reviewed adapter. Version metadata is observed, not newly admitted.

The installed typescript, @typescript/typescript-win32-x64 and jsonc-parser packages have separate canonical owners and complete raw file inventories. Repository-direct and wrapper-relative native resolution must agree. Selected owners, file inventories and diagnostic catalog membership are rechecked after reading. Added dependency files invalidate a proposal even when no historical pin mentions them. Internal links, nonregular files, case aliases, duplicate JSON keys, malformed registered selectors and unsupported input paths are refused. The Windows x64 bundle must be installed; reading it on another host establishes no compiler compatibility.

Each expected pin remains attached to its declaration and full path. references groups owner-relative inputs with every expected identity and comparison mode. scene3d digest-only expectations use sha256-only; expected byte counts are never invented. Other registered pins compare both bytes and SHA-256. Missing declared files remain explicit, while missing required owners, metadata or gate/JSON files refuse preparation. A fresh proposal can contain historical mismatches: preparation does not decide gate admission or suggest automatic replacement.

Container currentInputIdentitySuccessor.rows and sequence currentDeclarationSuccessor source/fixture/config pins remain separate claims beside original inputs. They do not replace historical rows or prove revised diagnostic semantics. Other successor observations, stdout, diagnostic tuples, closures and private receipt/runtime paths stay opaque and byte-bound to the owning JSON. No recursive pin discovery follows those historical paths. Original gates continue to validate all semantic, compiler, conditional and version boundaries.

coverage lists the registered filenames and future unregistered matching filenames. Unknown files are not parsed or followed; their appearance invalidates an old proposal and identifies a review gap. This is filename coverage, not complete policy coverage or authentication of unknown file contents. --check regenerates and compares the entire proposal, including implementation/gate/JSON bytes, selected owners and dependency membership. SchemaVersion 1 and 2 proposals must be regenerated. A current-inputs result always has acceptance: none.

Review changed or missing rows with the original strict actor before making any separate baseline change. Keep original evidence, complete local/push/PR gates and independent review. Human/fork onboarding (#52), remaining policy workflows (#53) and device/host/full-Spine/performance acceptance (#54) stay open. This workflow reduces manual comparison work; no measured check-time speedup is claimed.

## Inline compiler policies and conditional relationships

Add --inline-policies to the existing compiler command when maintaining its registered inline policies. Repeat the flag on --check; a saved proposal never enables a mode by itself. Both default and inline proposals now use schemaVersion 3, so regenerate older artifacts. The default command remains available without authenticating the additional inline source registry.

~~~powershell
node tools/prepare-compiler-maintenance.mjs --inline-policies > ../inline-policy-proposal.json
node tools/prepare-compiler-maintenance.mjs --check "$(Resolve-Path ../inline-policy-proposal.json)" --inline-policies
~~~

The opt-in registry covers 14 data adapters in ten original gate files:

| Adapter | Review output | Still required from the original gate |
| --- | --- | --- |
| Mouse input and Spine import inline inventories (2) | Compiler/fixture digest-only comparisons, saved/installed version equality and authenticated literal spans | Complete schema, suppression, named-case, diagnostic and compiler execution checks |
| Saved native-host relations (8) | Reader/saved platform and architecture equality, exact branch span and metadata/binary selector links | Current-host native owner/version/executable checks, unconditional library comparisons and replay |
| Container declaration successors (3) | Historical and successor pins kept separately; agreement with the corresponding JSON claims | Kind, product-review hash, full input membership, fallback rules and diagnostic successor checks |
| Sequence playback successor (1) | Source-pin agreement and the registered negative-lane relationship | Successor provenance, fixture/configuration, original output, named tuples and actual diagnostic selection |

Complete gate byte counts and SHA-256 identities are authenticated before reading any initializer. Only the reviewed JSON literals are decoded; source spans use UTF-8 byte offsets with an exclusive end, never UTF-16 character positions. The tool does not import the gates, evaluate JavaScript or parse arbitrary conditions. Source edits outside a literal, comment lookalikes and changed condition expressions all require a new reviewed source registration. Their refusal establishes source authentication, not general JavaScript parser coverage.

Native host equality describes only the saved metadata/binary branch. It neither skips nor passes the rest of the gate. The reader still observes the fixed Windows x64 bundle; a different reader host does not change the selected compiler owner or establish compatibility. Historical and inline expectations share the reverse-reference index while retaining their own origins and comparison strength. A data disagreement is reported without selecting an effective input or replacing history. Every conditional record has admission: not-evaluated, and the complete proposal retains acceptance: none.

For a target-file or JSON-claim change, regenerate the proposal and review its differences alongside the unchanged strict gate. For a gate-source change, review that gate and its tests first, then explicitly update the fixed source registration and adapters as needed; there is no automatic pin refresh or fallback parser. Update the English/Chinese explanation, run actual controls, obtain independent review and retain full local/push/PR checks. This bounded registry does not migrate arbitrary inline expressions, other source-policy transformations or the complete acceptance system. Human/fork and device/performance limits remain open.

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
