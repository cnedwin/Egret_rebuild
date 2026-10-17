# M0 community development foundations

English | [中文](../../Cns/docs/m0-community-foundations.md)

## Delivery scope

M0 increments implement environment, contribution and community foundations. Engine package source, public behavior and dependency versions are unchanged. Node moves to 26.7.0; pnpm 11.25.0 and TypeScript 7.0.2 remain pinned; complete Windows tooling uses PowerShell 7.6.5. Existing engineering preview 0.61.0 remains distinct from this infrastructure delivery.

| Package | This increment | Remaining M0 acceptance |
| --- | --- | --- |
| A Independent onboarding | Read-only doctor, repeatable setup, local visual example, bilingual guide | Independent human newcomer rehearsal and supported-environment timing targets |
| B Practical contributions | Templates, quick/full checks, current-ledger generation, risk-selected local feedback, eight browser entries, three resource families, five additional literal-scene profiles and public CI | Historical profile migration and external-fork rehearsal; full merge gates retained |
| C Sustained collaboration | Discussions, Topics, five public Milestones, linked public Project, scoped Issues and maintainer routing | Human participation and staffed response targets; API Project automation still lacks permission |

## Environment and verification

The workspace declares hoisted installation because current source collectors require physical third-party owners. Setup generates the renderer's exact package-local dependency alias and checks ownership; Windows also checks the native compiler alias. No contributor must create aliases manually. A previous incompatible installation may be refused instead of silently overwritten; reproduce from a fresh clone when changing layouts.

Changing root development scripts invalidated embedded configuration pins. Live configuration references and their dependent policy identities are revised and reverified; product source pins, historical source snapshots and original receipts remain intact. This is a bounded transition, not complete dependency-closure decoupling. The current B1 verifier admission and emitted-host test profile now require Node 26.7.0; CLI refusal and all 13 emitted-host cases pass. The later tooling increment below completes actual B1 browser requalification on Node 26. Other fixed-Node experimental collectors retain explicitly historical profiles; advanced domains require separate migration. The VM host-denial harness now rejects recorded access even when a VM proxy swallows the getter exception; the negative controls remain mandatory.

Local verification and remote CI have separate results. Windows runs the full existing prepush gate plus onboarding tests. Linux/macOS run build, matrix4, display-tree and headless checks only; excluded compiler-owner, publication and actual-browser gates remain explicit. The final `M0 / merge-ready` job refuses failed, cancelled or skipped required jobs. It does not certify graphics or mobile performance.

## GitHub execution and acceptance

| Order | Execution | Acceptance |
| --- | --- | --- |
| G1 | Record baseline, permissions and roles | Preserve existing settings; identify actual maintainers |
| G2 | Deliver setup, guides and templates | Clean clone and documented visible example work |
| G3 | Run public CI on the PR | All declared jobs report results for the final candidate |
| G4 | Enable Main rules after CI is verified | Required PR/checks, resolved discussions, no force push/deletion; read back effective rules |
| G5 | Enable community entry points | Discussions and M0–M4 Milestones discoverable; board status explicit |
| G6 | Human newcomer run/change/PR/review | Uninvolved human completes the sequence; otherwise OPEN |
| G7 | Define website/preview release handoff | No Pages or installable-package publication claim without validation |

The repository API token still lacks `read:project`/`project`; the read query returned `INSUFFICIENT_SCOPES` on 2026-10-17. The existing authenticated browser session successfully created and configured the public Project without changing token permissions. API automation remains unavailable; the board itself is operational. No personal tasks are assigned. A single current CODEOWNER routes review without implying a second human approval. Independent AI technical review is recorded as AI review, not GitHub human approval.

## Validation record

The first public Windows CI run exposed a temporary-directory fixture issue: ordinary synchronous realpath preserved a Windows 8.3 short spelling while the asynchronous gate expanded it. The differing synchronous/native path spellings were observed locally with a real short path, but the original fixture suite still passed locally; the public runner remains the decisive reproduction environment. The fixture now obtains its complete physical owner and repository root through native realpath; CI also selects canonical TEMP/TMP before checks. No byte normalization, case folding of logical keys, or alias acceptance was added. The failed CI run remains visible in PR #51.

Independent AI review identified and repaired four issues: file allowlist aliases, foreign dependency ownership, conflicting installation steps and missing pnpm diagnostics. Regression tests cover the failures.

Initial onboarding tests reproduced missing tools before implementation, then passed diagnostics and HTTP access checks. Clean setup exposed a hardcoded old-Node pnpm wrapper and implicit dependency layout; the documented selected runtime and explicit setup address these causes. The Canvas example was actually opened in the in-app browser, with ready resources/frame/input, blue outfit replacement and a 0.125-second animation step observed. This is an onboarding smoke test, not the fixed-browser graphics acceptance matrix. Full local gates, independent review and remote CI must pass before integration; PR checks carry their exact candidate results.

M0 remains open for architecture/scenario/budget freezing, human rehearsal, broader dependency-aware engine-test selection and remaining host/tool migration. Use the [getting-started guide](getting-started.md) and [public milestones](https://github.com/cnedwin/Egret_rebuild/milestones).

The [architecture and engineering plan](architecture-and-engineering-plan.md) retains the complete M0–M4 scope and acceptance criteria. This increment implements only the foundation subset above.

## Community follow-up — 2026-10-17

The [public Project](https://github.com/users/cnedwin/projects/2) is linked from the repository Projects tab. Its Delivery view shows Status, Milestone and labels. Backlog means unscheduled, Ready means scoped for participation, In Progress means active work, In Review means a candidate awaiting checks/review, Blocked requires a named dependency, and Done requires acceptance evidence. Issue bodies define scope/dependencies/acceptance and the integration contact; Milestones identify M0–M4. Use the board as the live status source rather than copying mutable progress into every document. No assignees, dates or additional maintainers are invented.

The newcomer entry is [#52](https://github.com/cnedwin/Egret_rebuild/issues/52), labeled `good first issue` and `help wanted`, with file entry, expected result, verification and review contact. [#53](https://github.com/cnedwin/Egret_rebuild/issues/53) retains contribution-gate/ledger engineering; [#54](https://github.com/cnedwin/Egret_rebuild/issues/54) retains scenario, Spine and device-budget freezing. M1–M4 are coherent planned work packages in [#55](https://github.com/cnedwin/Egret_rebuild/issues/55), [#56](https://github.com/cnedwin/Egret_rebuild/issues/56), [#57](https://github.com/cnedwin/Egret_rebuild/issues/57) and [#58](https://github.com/cnedwin/Egret_rebuild/issues/58), not authorization to start engine work before M0 acceptance. The merged foundation [PR #51](https://github.com/cnedwin/Egret_rebuild/pull/51) supplies the completed infrastructure evidence.

### Technical newcomer rehearsal

Baseline: Main `26136df66a493eb721e0780148de4bdc8ed4fb87`. Windows x64, Node 26.7.0, pnpm 11.25.0, TypeScript 7.0.2, PowerShell 7.6.5 and Git 2.53.0.windows.3. Two new public clones used directory names containing Chinese characters and spaces. Tool prerequisites were already installed; pnpm was separately installed at the pinned version without changing global tools. No old node_modules or compiled outputs were copied.

| Observation | Actual result and limit |
| --- | --- |
| First clone and warm-store setup | Clone 5.19 s, setup 3.36 s, quick 4.34 s; package log reused four entries, so this was not a cold-cache run |
| Separate cold-store clone | New store selected with pnpm 11's `pnpm_config_store_dir`; reused 0/downloaded 4; setup 4.08 s, quick 4.04 s; unchanged tracked files after setup |
| Repeat after local heading edit | Setup 2.26 s; edited-file SHA unchanged; quick passed; no manual aliases |
| Visible browser result | In-app browser Canvas: two pilots, fixed text, resources/frame/input ready; outfit C fulfilled and rendered; 0.125-second tick; edited bilingual heading visible after reload |
| Full-gate discovery | Quick passed; the complete type gate rejected compiler-escaped Chinese checkout paths. Focused regression controls reproduce this; known full-owner spelling recognition fixes it. The actual Chinese-path type gate is rerun separately; current-ledger integration remains a distinct engineering obligation |
| Participant and host boundary | Executed by the implementation agent, not an uninvolved human; no external fork approval, phone, mini-game, thermal/power or general Chinese-font benchmark result |

These single-machine observations exclude initial Node/Git/PowerShell installation, package-manager installation and human learning/review time. Installation time includes dependency download; download is not separately timed. The first cache-isolation attempt used the obsolete `npm_config_store_dir` prefix and still reused the default cache; the actual package log exposed this, and a second clone with the correct pnpm prefix established the cold-store result. Do not generalize these numbers to slow networks or first-time users. The public guide defines provisional thresholds for subsequent rehearsals, not retroactive acceptance of these observations.

PR #51 passed all four declared [CI jobs](https://github.com/cnedwin/Egret_rebuild/actions/runs/38999228653), then merged with an identical Git tree. [Main rules](https://github.com/cnedwin/Egret_rebuild/rules/25288511) require PR integration, resolved discussions and the GitHub Actions `M0 / merge-ready` result; force push/deletion are prohibited and no bypass actors are configured. Zero mandatory GitHub approvals reflects the single-maintainer situation, not independent human approval. Equivalent temporary-branch rules actually rejected direct update, force push and deletion before Main activation. This follow-up's final candidate checks and integration receipt belong to its PR; historical results are not promoted to new-candidate proof.

### G7 presentation and release handoff

M0 defines the handoff; no website or installable preview package is claimed. A later documentation-site change must build both languages from a reviewed commit, preserve relative links and attribution, include current capability limits, and prove navigation and asset loading at the actual deployed base URL. Any online example must use the reviewed build, display backend limitations, and verify real input/resources plus unsupported-backend handling. Deploy from a trusted reviewed branch with only deployment-scoped credentials; untrusted PR jobs receive no publication credentials. Keep the last accepted deployment available for rollback and record the artifact/commit and actual URL.

Preview-package publication requires explicit release scope, export/type/import checks in a separate consumer, source/license and asset audit, reproducible artifacts and archive contents, installation/run validation and a versioned compatibility/limitations note in both languages. The existing private 0.0.0 workspace packages are not a published SDK. Release/site work waits for capability maturity and authorized publication; a green CPU gate alone is insufficient.

### Remaining M0 exit obligations

| Obligation | Current boundary and next action |
| --- | --- |
| Independent human and external fork | No uninvolved participant is available in this run. Keep #52 open; a volunteer completes the public checklist and maintainer handles first-run CI approval |
| Controlled metadata integration and risk selection | Current ledgers and conservative local selection are implemented. Full push/merge gates remain; broader risk-based engine test selection requires separate dependency and refusal evidence |
| Active browser-tool migration | Eight current suites, three resource families and five additional literal-scene profiles have recorded Node 26 results. Historical texture/sequence/SpriteSheet domains retain separate migration acceptance in #53 |
| Scenario/Spine/device/budget freeze | #54 requires authorized representative assets, exact version/feature decisions and target tiers. No connected target-phone session; unavailable device rows stay unexecuted; do not invent numerical budgets |
| API Project automation | Scoped token query is denied; manual/browser maintenance of the public board works. No wider token was issued |
| Staffing | @cnedwin is the integration contact; no second human reviewer or response SLA is presumed |

Full M0 stays open. This increment adds community infrastructure, reproducibility evidence and release-handoff criteria; it does not implement new engine features or certify product performance.

The diagnostic repair is confined to verification tooling. TypeScript renders non-ASCII UTF-16 units as Unicode escapes inside quoted import types. The converter now derives accepted spellings only from the complete known checkout owner and requires a following path separator; a sibling owner such as sdk-other cannot match sdk. The original message suffix, logical file keys, raw file bytes and frozen expected diagnostic tuples remain unchanged. Focused controls first failed for the escaped owner, sibling prefix and case-sensitive foreign path, then all nine onboarding tests passed. This does not authorize arbitrary diagnostic decoding or path normalization for hashes.

The second repaired converter handles BitmapBindingTicket diagnostics: it authenticates the selected declaration before replacing either the literal or compiler-escaped spelling of that exact quoted namespace. The real Chinese/space-path checkout subsequently passed the complete type gate (including NS1 and BitmapBindingTicket), not only the extracted-function tests. Independent AI review found no actionable code issues and independently passed the four new diagnostic tests; its full-file run was restricted by sandbox loopback/symlink permissions, so the author-run nine-test result is recorded separately. Human newcomer/fork acceptance is still open.

The subsequent committed-snapshot push gate in the Chinese/space checkout passed the main suite but exposed a third escaped-owner conversion in the F2 Spine experiment verifier. The push was refused and its failure retained. A new focused control failed before the repair; all ten onboarding controls then passed, and the actual Unicode checkout passed the complete F2 source/profile consumer lanes against the original frozen tuples. The remaining diagnostic converters were inspected; the ordinary full type stage had already passed in that checkout. Final complete candidate gates and remote integration are recorded in the PR; this repair adds no Spine runtime feature.

## Contribution tooling increment — 2026-10-17

Baseline: Main `8dd587517c93cd3767551731564f6aa93feb38b7` (PR #59). This increment changes verification, contribution metadata and reading documents only. Engine package source, exported APIs and dependency versions are unchanged.

The [contribution workflow](getting-started.md#contribution-metadata-and-browser-checks) separates contributor content/new-file declarations from maintainer generation of three current ledgers. A named Git base determines changed files; generation is deterministic and check mode is read-only. Normal full prepush uses derived publication metadata without requiring branch authors to edit shared ledgers. Maintainer integration and Windows CI require the saved ledgers to equal the generated candidate. CI reads the PR base with complete Git history and retains read-only permissions. Full committed push hooks, all existing checks and the required merge-ready job remain in force. The risk label is informational; it does not skip tests.

Nine focused tests pass on Node 26.7.0. Real Git fixtures in a Chinese/space directory merge two unrelated content branches without ledger edits, compare deterministic outputs, reject later input changes and retain historical objects. Other controls reject altered history, missing declarations, private/generated registrations, inherited Node loader configuration and missing/wrong browser completion receipts. Raw CRLF changes remain different identities. The private-input refusal first failed, then passed after implementation. Initial Git fixtures required sandbox permission for temporary repositories; that restriction was distinct from test failures.

Independent AI review found a browser-entry acceptance defect: an inherited preload could make a collector exit zero without running it. The repaired entry rejects NODE_OPTIONS/NODE_PATH and requires the selected suite's completion receipt. Four real suites were rerun after that repair with Windows 10.0.26300 x64, Node 26.7.0, Playwright/core 1.62.1 and Edge 155.0.4283.45, default headless launch and no extra flags:

| Suite | Observed result | Boundary |
| --- | --- | --- |
| Canvas | PASS; pointer changes pixels, fixed pixel assertions and no-op counterexample pass | Desktop Canvas fixture only |
| WebGPU | PASS; 42 frames, 1709 raw checks, 6808 composition checks, 8 counterexamples, no required fixture failure | Declared fixed fixtures, not device performance |
| B1 | PASS; 7 positive frames, 5 counterexamples, 11 submitted frames; no cleanup failure | Fixed 3D/composition domain, not general 3D completeness |
| Text | PASS_WC1_CANVAS_SUBSET; stable identities and exit 0 | Fixed font/raster subset; no general Chinese-font benchmark |

Logs, original screenshots/results and failure attempts are retained outside the public repository. The new wrapper records selected script/matrix/package metadata identities and child completion; it does not establish the complete transitive input closure or independent OS-level process retirement. Those stronger existing collector contracts remain separate. The matrix and three bilingual collector READMEs distinguish current, advanced and historical profiles; no historical evidence is regenerated to claim migration. Four current suites do not close resource-scene, bitmap-slot, prepared-group, atlas, PNG, picking/input or older texture/sequence/spritesheet domains.

Final local full gates, behavioral/dependency refusal controls, independent final review, PR checks and the merged tree are recorded against the delivered candidate in its PR. Review findings and passing structural checks do not constitute human newcomer, external-fork or phone acceptance. #53 remains open for incremental selection and advanced domains; #52/#54 retain human/fork and scenario/device obligations.

The first actual committed push was refused: Git hook-local environment variables redirected a temporary Git fixture to the integration checkout metadata. No push completed and source files were unchanged. The tested commit and index were restored while preserving the erroneous fixture commit separately. Git operations now remove inherited repository-local configuration and resolve their explicitly selected owner; fixtures also isolate global/system configuration. A two-repository control first reproduced the failure, then proved the foreign HEAD/index stayed unchanged and metadata reads belonged to the requested fixture. All nine focused tests pass. Final delivery requires the complete real push hook again; the earlier author-run full pass alone is insufficient.

## Advanced collectors and local risk selection — 2026-10-17

Baseline: Main c2356af49133a0b32477b21a48c93f2b9f738c3b (PR #60). This increment changes contributor tooling and bilingual readings; engine source, public APIs, dependencies, hooks and required CI jobs are unchanged. The current [guide](getting-started.md) describes explicit snapshot preparation/review and conservative local selection. Complete push and merge checks remain mandatory.

Real Node 26.7.0 / Playwright-core 1.62.1 / Edge 155.0.4283.45 runs used Windows x64, default headless launch and no extra flags:

| Current suite | Observed scope |
| --- | --- |
| hit-test | Accepted desktop HT1 Canvas subset; 6 contexts including 5 assigned controls |
| mouse-input | Accepted desktop primary mouse Canvas subset; 7 contexts including 6 assigned controls |
| resource-scene | Accepted finite Canvas/WebGPU scene; 2 ordinary and 5 negative contexts, 64 retained raw frames; fixed font reference only |
| bitmap-slot | Accepted bounded Canvas/WebGPU composition; 4 contexts, 28 ordinary and 28 control checkpoints, 30 ordinary and 30 control raw frames |

Preparation separately checked 407 resource-scene and 227 bitmap-slot inventory records, then supplied reviewed raw snapshot identities for native execution. Preparation itself reports reviewed=false and browserRun=false. Source review was performed by AI; it is not human approval. Wrapper identities are bounded; original complete closure, pixel/control and cleanup checks still run inside each collector.

The initial mouse run failed before browser launch because its exact historical module allowlist omitted ten current transitive public-root modules: atlas placement/layout, ByteWriter, nine-slice geometry/bitmap, SpriteSheet, bitmap resource slot/binding ticket/button and sequence playback. The migration adds only those exact emitted paths. It does not add wildcard imports, change product behavior, alter reference pixels or remove the six controls. The repaired native run passed; the failed collection remains retained.

Local selector controls cover committed/staged/unstaged reading edits, untracked files, unknown paths, metadata/policy, renames and invalid/unrelated bases. An initial temporary Git fixture was blocked by sandbox metadata permissions; the authorized isolated run distinguishes that environment limit from assertions. The orphan-branch fixture was corrected because git switch --orphan already clears tracked files. Both failures remain in execution logs. Selection does not cache or authorize merge acceptance.

At this increment's cutoff, prepared-resource-groups, atlas and PNG configuration/fixture admission migration remained engineering work; the following resource increment records their delivery. Historical texture/sequence/SpriteSheet profiles remain separate. Independent human/fork onboarding, phones, mini-game hosts, general Chinese-font performance, full Spine and scenario/device budgets remain unverified. Final full gates, independent AI review and actual protected integration are recorded in this increment's PR.

Independent AI review identified two additional wrapper/selection gaps. Opposing staged and working-tree edits could hide a risky file in a net diff; the selector now keeps base-to-HEAD, HEAD-to-index and index-to-worktree records separately. A truncated native receipt could retain a success headline while omitting controls or failing its baseline; completion now requires the exact context/control schedule and a clean baseline. Both focused regressions failed before the repairs and passed afterwards. Wrong snapshot digest, modified snapshot closure and reused snapshot output were also refused; a digest mismatch created no output directory. These repairs do not change the original collectors' pixel or control rules.

The first PR #61 Windows CI attempt stopped before project checks: the public PowerShell release metadata request exceeded the anonymous GitHub API limit. Linux and macOS CPU jobs passed; merge-ready correctly failed. The install step now authenticates only that metadata request with the existing read-only job token, scoped to the install step. The archive download receives no authorization header; exact version and SHA-256 verification remain mandatory. No job, required check or branch protection was removed. Remote acceptance requires a successful new run; the earlier failure is retained in Actions run 39008127523.

## Resource-family workflow — 2026-10-17

Baseline: Main 0ebf183540ab1b58a91b36df7b9df4b8aa052cf9 (PR #61). The [resource guide](resource-browser-workflow.md) provides complete-family preparation, independent review and execution for prepared groups, atlas and BIP1 PNG. Preparation reports reviewed=false and browserRun=false. Contributors use original producers instead of hand-authoring configuration; PNG evidence remains maintainer-assisted. No engine package, API or dependency version changes.

Actual final collections used Windows x64, Node 26.7.0, Playwright/core 1.62.1 and Edge 155.0.4283.45, default headless launch without extra flags:

| Family | Recorded result |
| --- | --- |
| prepared-groups | All six cases passed across Canvas and WebGPU; 54 raw readbacks, both stale-layer controls and complete collector retirement |
| atlas | All eight cases passed across Canvas and WebGPU; 34 raw readbacks, both assigned geometry controls and both importer compositions; 12 genuine disposable builds |
| BIP1 PNG | Six submitted/raw readbacks: four new captures and two saved replays; both wrong-oracle controls passed; no pending tickets or cleanup errors |

Seven tool tests cover exact arguments/schedules, incomplete receipts, copied dependency drift, raw JSON reserialization, changed returned read bytes and dependency-owner boundaries. PNG CPU tests include all 99 public/behavior/lifecycle/assets/terminal cases; 22 policy controls and 39 observer units also passed. Build and strict-type checks passed separately. The policy suite validates the existing product boundary, not the new graph-owner repair; that repair has its own focused controls and actual preparation/native evidence. Missing PNG review roles and an incorrect manifest digest were refused before browser launch.

Independent AI source review found and repaired a truncated-receipt gap and raw-identity gaps between admission, individual child launches and final completion. Reviewed reads now hash the returned bytes; each case is rechecked before its child and all cases before family completion. Actual PNG preparation also exposed an old isolated dependency-owner assumption; admission now requires the exact current hoisted physical owner, keeping version, manifest, route and raw-byte checks. The old layout and foreign nested owner are refused. Source review was AI review, not human approval.

Earlier failures remain retained: Windows sandbox denial of disposable package links, a preparation that refused changed source, a policy run that refused a changing Git inventory, and the original PNG layout refusal. Successful retries use fresh output owners; no failed receipt or historical source identity was rewritten. Raw native artifacts and reviews remain outside the public tree; final full local gates, actual push, PR checks and protected Main integration are recorded in the delivered PR.

The BIP1 result does not requalify the five additional PNG profiles or historical texture/sequence/SpriteSheet domains. Independent human onboarding, external-fork approval, phones/mini-game hosts, general Chinese-font performance, full Spine and scenario/device budgets remain open. Current automation does not certify independent OS-level process retirement. Full M0 is not complete; #52, #53 and #54 retain their stated remaining obligations.


## Additional PNG-entry profiles — 2026-10-17

Baseline: Main cf038de9ec75901188b8f8a3d3b70f5b6c4bb7e4 (PR #62). Five existing literal scenes now use the explicit prepare/review/run suites in the [resource verification guide](resource-browser-workflow.md). The adapter preserves original source/actual evidence, schedules, exact pixel oracles and cleanup. Engine source, APIs, dependencies and original collectors are unchanged. These scenes do not decode PNG images despite sharing its collector entry.

Actual Windows x64 execution used Node 26.7.0, Playwright/core 1.62.1 and Edge 155.0.4283.45, with default launch settings:

| Profile | Actual result |
| --- | --- |
| Nine-slice bitmap | One WebGPU main case; three full raw reads; two Canvas refusals; no positive Canvas acceptance |
| Remove children | Two main backend cases; six full raw reads |
| Child index | Two main backend cases; six full raw reads |
| Indexed insertion | Two main backend cases; ten main raw reads plus two separate Canvas control reads |
| Anchor offsets | Two main backend cases; ten main raw reads plus two separate Canvas control reads |

Total: nine main backend cases, 35 main and four additional control reads. All original 24 × 24 comparisons use zero channel tolerance. Main/context/control retirement completed without pending tickets or cleanup errors. Source and actual-evidence review was performed independently by AI; it is not human approval. Historical missing-entry RED was qualified by its original pinned execution, not rerun or rewritten as a current failure.

Ten adapter regression tests passed, including profile selection, exact evidence options, truncated counts, missing controls and unsafe control retirement. The newly added tests first failed against the previous adapter. All 11 prelaunch controls refused missing roles, wrong manifest digests and cross-profile evidence. Current build, 66 focused API/behavior tests, complete strict-type checks and package/source boundaries passed separately. The first preparation exposed the distinct original Playwright entries: BIP1 uses index.js, while these five profiles use index.mjs. The adapter now preserves each exact entry and refuses the other or a foreign owner. The first native attempt was blocked by Windows sandbox Edge profile/pipe access before rendering. The successful retry used a fresh reviewed owner and authorized browser execution, without extra launch flags or relaxed assertions. Native artifacts, source/evidence reviews and failed attempts remain outside the public tree. Final complete local gates, actual push, protected CI and Main integration are recorded in the PR.

The maintained guide separates routine contributor steps from maintainer-assisted evidence preparation. It identifies the eight roles and current source/build bindings without asking newcomers to fabricate approvals or modify historical ledgers. Full push and merge gates remain required. This delivery does not close historical texture/sequence/SpriteSheet migration, independent human/fork onboarding (#52), target-phone/mini-game validation, general Chinese-font performance, full Spine or scenario/device budgets (#54). No new engine feature was developed, and full M0 remains open.

## Texture and animation tooling migration — 2026-10-17

The five existing texture/animation domains now have an explicit Node 26.7.0 [prepare/review/run workflow](historical-browser-workflow.md). Current source/emission snapshots replace implicit historical product cutoffs; compiler owners match the exact hoisted setup. Playback/SpriteSheet have a stock-build facts producer that leaves review pending. Original finite oracles, review roles, raw historical records and external Windows Job retirement remain separate requirements. This increment changes tooling and bilingual onboarding only. Actual suite outcomes, independent review, full local gates and protected delivery are recorded in its PR; preparation alone earns no native or human/device acceptance. #52 and #54 remain open, as do broader M0 risk-selection and external-owner obligations.
