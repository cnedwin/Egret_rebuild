# M0 community development foundations

English | [中文](../../Cns/docs/m0-community-foundations.md)

## Delivery scope

This first M0 increment implements environment and contribution foundations. Engine package source, public behavior and dependency versions are unchanged. Node moves to 26.7.0; pnpm 11.25.0 and TypeScript 7.0.2 remain pinned; complete Windows tooling uses PowerShell 7.6.5. Existing engineering preview 0.61.0 remains distinct from this infrastructure delivery.

| Package | This increment | Remaining M0 acceptance |
| --- | --- | --- |
| A Independent onboarding | Read-only doctor, repeatable setup, local visual example, bilingual guide | Independent human newcomer rehearsal and supported-environment timing targets |
| B Practical contributions | Templates, quick/full checks, current configuration requalification, public CI definition | Full ledger decoupling, risk-based selection and external-fork rehearsal |
| C Sustained collaboration | Discussions, Topics, five public Milestones, linked public Project, scoped Issues and maintainer routing | Human participation and staffed response targets; API Project automation still lacks permission |

## Environment and verification

The workspace declares hoisted installation because current source collectors require physical third-party owners. Setup generates the renderer's exact package-local dependency alias and checks ownership; Windows also checks the native compiler alias. No contributor must create aliases manually. A previous incompatible installation may be refused instead of silently overwritten; reproduce from a fresh clone when changing layouts.

Changing root development scripts invalidated embedded configuration pins. Live configuration references and their dependent policy identities are revised and reverified; product source pins, historical source snapshots and original receipts remain intact. This is a bounded transition, not complete dependency-closure decoupling. The current B1 verifier admission and emitted-host test profile now require Node 26.7.0; CLI refusal and all 13 emitted-host cases pass. Actual B1 browser requalification on Node 26 remains OPEN. Other fixed-Node browser collectors retain their original profiles pending migration. The VM host-denial harness now rejects recorded access even when a VM proxy swallows the getter exception; the negative controls remain mandatory.

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

M0 remains open for architecture/scenario/budget freezing, human rehearsal, full metadata decoupling and remaining host/tool migration. Use the [getting-started guide](getting-started.md) and [public milestones](https://github.com/cnedwin/Egret_rebuild/milestones).

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
| Controlled metadata integration and risk selection | Engineering remains open in #53; current hooks still require full checks and maintainer metadata preparation. Do not call this a permission/device blocker |
| Active browser-tool migration | B1 CLI/CPU admission has moved; actual Node 26 browser requalification and other active collectors remain engineering work in #53 |
| Scenario/Spine/device/budget freeze | #54 requires authorized representative assets, exact version/feature decisions and target tiers. No connected target-phone session; unavailable device rows stay unexecuted; do not invent numerical budgets |
| API Project automation | Scoped token query is denied; manual/browser maintenance of the public board works. No wider token was issued |
| Staffing | @cnedwin is the integration contact; no second human reviewer or response SLA is presumed |

Full M0 stays open. This increment adds community infrastructure, reproducibility evidence and release-handoff criteria; it does not implement new engine features or certify product performance.

The diagnostic repair is confined to verification tooling. TypeScript renders non-ASCII UTF-16 units as Unicode escapes inside quoted import types. The converter now derives accepted spellings only from the complete known checkout owner and requires a following path separator; a sibling owner such as sdk-other cannot match sdk. The original message suffix, logical file keys, raw file bytes and frozen expected diagnostic tuples remain unchanged. Focused controls first failed for the escaped owner, sibling prefix and case-sensitive foreign path, then all nine onboarding tests passed. This does not authorize arbitrary diagnostic decoding or path normalization for hashes.

The second repaired converter handles BitmapBindingTicket diagnostics: it authenticates the selected declaration before replacing either the literal or compiler-escaped spelling of that exact quoted namespace. The real Chinese/space-path checkout subsequently passed the complete type gate (including NS1 and BitmapBindingTicket), not only the extracted-function tests. Independent AI review found no actionable code issues and independently passed the four new diagnostic tests; its full-file run was restricted by sandbox loopback/symlink permissions, so the author-run nine-test result is recorded separately. Human newcomer/fork acceptance is still open.

The subsequent committed-snapshot push gate in the Chinese/space checkout passed the main suite but exposed a third escaped-owner conversion in the F2 Spine experiment verifier. The push was refused and its failure retained. A new focused control failed before the repair; all ten onboarding controls then passed, and the actual Unicode checkout passed the complete F2 source/profile consumer lanes against the original frozen tuples. The remaining diagnostic converters were inspected; the ordinary full type stage had already passed in that checkout. Final complete candidate gates and remote integration are recorded in the PR; this repair adds no Spine runtime feature.
