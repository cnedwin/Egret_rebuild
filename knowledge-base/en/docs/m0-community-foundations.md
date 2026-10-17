# M0 community development foundations

English | [中文](../../Cns/docs/m0-community-foundations.md)

## Delivery scope

This first M0 increment implements environment and contribution foundations. Engine package source, public behavior and dependency versions are unchanged. Node moves to 26.7.0; pnpm 11.25.0 and TypeScript 7.0.2 remain pinned; complete Windows tooling uses PowerShell 7.6.5. Existing engineering preview 0.61.0 remains distinct from this infrastructure delivery.

| Package | This increment | Remaining M0 acceptance |
| --- | --- | --- |
| A Independent onboarding | Read-only doctor, repeatable setup, local visual example, bilingual guide | Independent human newcomer rehearsal and supported-environment timing targets |
| B Practical contributions | Templates, quick/full checks, current configuration requalification, public CI definition | Full ledger decoupling, risk-based selection and external-fork rehearsal |
| C Sustained collaboration | Discussions, Topics, five public Milestones, maintainer routing | Project board permission and staffed response targets |

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

The authenticated repository connection lacks Project permissions. Discussions, Topics and Milestones are independent of that limitation; the Project board remains blocked until its required permission is available. No personal tasks are assigned. A single current CODEOWNER routes review without implying a second human approval. Independent AI technical review is recorded as AI review, not GitHub human approval.

## Validation record

Independent AI review identified and repaired four issues: file allowlist aliases, foreign dependency ownership, conflicting installation steps and missing pnpm diagnostics. Regression tests cover the failures.

Initial onboarding tests reproduced missing tools before implementation, then passed diagnostics and HTTP access checks. Clean setup exposed a hardcoded old-Node pnpm wrapper and implicit dependency layout; the documented selected runtime and explicit setup address these causes. The Canvas example was actually opened in the in-app browser, with ready resources/frame/input, blue outfit replacement and a 0.125-second animation step observed. This is an onboarding smoke test, not the fixed-browser graphics acceptance matrix. Full local gates, independent review and remote CI must pass before integration; PR checks carry their exact candidate results.

M0 remains open for architecture/scenario/budget freezing, human rehearsal, full metadata decoupling and remaining host/tool migration. Use the [getting-started guide](getting-started.md) and [public milestones](https://github.com/cnedwin/Egret_rebuild/milestones).

The [architecture and engineering plan](architecture-and-engineering-plan.md) retains the complete M0–M4 scope and acceptance criteria. This increment implements only the foundation subset above.
