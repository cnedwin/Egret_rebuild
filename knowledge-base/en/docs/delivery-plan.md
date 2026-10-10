# Delivery Plan

English | [简体中文](../../Cns/docs/交付计划.md)

## Requirement amendment — 2026-10-10: Spine

Complete Spine support is mandatory under R020. V020 is a planned capability work package, implementation not_started, acceptance not_run, with V001 as its registered prerequisite. Integration also requires the relevant resource/render/project/host interfaces to be ready. V002/V004/V005/V006 each gain the applicable Spine acceptance obligations without changing their final dependency sets. Documentation, upstream capability statements and basic playback do not complete delivery. See the [Spine acceptance gates](spine-animation-support-and-acceptance.md).

The historical 0.13.0 rectangle checkpoint has its own [implementation and verification record](webgpu-rectangle-implementation-evidence.md). Its source identities, results and pending work retain their recorded scope; they do not establish current product acceptance.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](display-and-frame-execution-contract.md) and [implementation plan](display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Updated: 2026-10-08, knowledge base 0.8.0. Delivery follows dependency order. The initial host order, team, schedule, budget, and numerical performance thresholds remain undecided. The [delivery register](../../Cns/registry/交付.json) is the authority for status; this page explains why each stage exists. Research and the knowledge base are design inputs; product capabilities require runnable artifacts and acceptance evidence.

[Knowledge base home](../README.md) · [Technical white paper](technical-white-paper.md) · [Product requirements document](product-requirements.md) · [Engineering plan](engineering-plan.md) · [Round-two verification record](../archive/round-2-research.md#execution) · [Round-two audit](../archive/round-2-research.md#audit) · [Historical round-one verification](../archive/round-1-research.md#execution) · [Round-one research review](../archive/round-1-research.md#research)

| Stage | Required deliverables | Conditions for entering the next stage |
| --- | --- | --- |
| Shared samples and baseline V001 | Complex UI, mixed 2D/3D, and legacy-project samples; host/device configurations; behavioral and performance measurement definitions | Samples are authorized, functionality and image quality are fixed, measurements are repeatable, and the initial scope is clear |
| Rendering runtime prototype V002 | UI update, mixed rendering, and loading/scheduling/recovery prototypes | Correctness, frame time, memory, time to first interaction, and sustained-run results can support or refute technical candidates |
| AI engineering interfaces V003 | Object/resource IDs, project format, commands, transactions, diagnostics, versions, and undo | Consecutive changes can locate objects, preserve gameplay, receive feedback, and recover; a single generation demo is insufficient |
| Resource and animation pipeline V004 | 2D/3D import, font atlases, skeletal and frame animations, target resources, and build manifests | Consistent runtime semantics, locatable errors, and traceable source assets and dependencies |
| Workbench and platform delivery V005 | A complete loop for creation, editing, playtesting, repair, packaging, real-host execution, and updates | Key workflows complete on the declared hosts/devices; interface documentation agrees with the support matrix |
| One-click migration tools V006 | Project inventory, conversion, AI repair, old/new verification, independent artifacts, difference reports, and recovery | Behavioral, visual, animation, resource, state, platform, and performance comparisons complete within the declared support scope, with human and AI costs measured |
| Knowledge base and community foundations V007 | Requirements, candidate architecture, evidence, deliverables, maintenance rules, and contribution templates | Documents, the knowledge base, and design discussions are public from day one; every later change continues to be checked; the public repository, license, and release information are explicitly registered |
| Candidate design document package V008 | R011's technical white paper, PRD, and engineering plan in the 0.7 candidate version, linked to actual verification, research review, and independent audit | Documents agree, boundaries and failure evidence are traceable, and the package is open to further review; document delivery does not approve technical candidates or count as implementation of the engine product |

V003, V004, and migration prototypes should participate in interface design alongside the core prototype, avoiding the addition of legacy semantics only after the new kernel is finished. Q002 determines the platform delivery order for V005. V006 ultimately depends on V001–V005, including continued editing and actual platform publication. R008/V006 always remains a formal part of the first complete release objective; small initial samples, prototype limits, or completed documents do not make it optional.

## What every acceptance review must leave behind

Linked requirements and technical decisions, artifact versions, environment, test inputs, actual results, tolerances or thresholds, issue lists, reproduction instructions, and conclusions. Performance comparisons require equivalent functionality and image quality; migration success requires the agreed old/new comparison. Use the [experiment and acceptance template](../templates/experiment-and-acceptance.md) for specific records.

The implementation repository owns code facts, acceptance reports own test facts, and registers own summaries and pointers. Documents cannot replace either type of evidence. The research portion of V001 is in_progress. Two rounds have run bounded contract models and local mixed-graphics research programs, but authorized product samples, devices, and performance baselines are still incomplete. V002 has a local independent headless core; product implementation for V003–V006 has not started. V007 is the knowledge base and community foundation, and V008 is the candidate design document package. The complete engine, production hosts, performance, creator tasks, and migration have not passed acceptance.

R011 requires continuous cycles of research, deliberation, verification, and self-audit. Independent audits of contract models previously found defects. Related fixes, revalidation, failure history, and actual execution counts are authoritative in the [round-two verification record](../archive/round-2-research.md#execution); the first-round record is retained. D001–D016 are still all proposed, and H001–H008 are still all untested. Local program execution does not change these statuses. Complete baseline snapshots from 0.1.0 through 0.7.0 are stored in internal history; changes to this candidate do not overwrite historical records.

## Roles of mature implementations and verification

R012 is part of the formal plan: prioritize foundational mechanisms documented in mature source code, then separately verify Egret adaptation regressions and benefits on real devices. The first 3D asset chain, text providers, shared frame state, and resource/animation ownership can continue as engineering research in the current environment; the absence of phones is no reason to suspend all work. The [adoption plan](open-source-reference-implementations-and-adoption.md) records versions and precise mechanisms. Runnable code exists for the first real asset reference chain, and V002/V004 record bounded researchProgress. The [round-three record](../archive/round-3-research.md#execution) and [audit](../archive/round-3-research.md#audit) retain verification boundaries. Complete product implementation and acceptance keep their existing statuses; the final R008/V006 obligation is unchanged.

## The continuing role of research

Competitor and host research continues to inform requirements and experiments. The [round-one research review](../archive/round-1-research.md#research) rechecks key versions and mechanisms, while retaining the unverified dates of the Laya IDE/old webpages and conflicting dates in official sources. Read-only static review of legacy source has produced interim materials; a complete build, dependency license review, and reuse verification remain unfinished. Numerical targets for core leading indicators, automatic migration proportion, and creation completion rate will be jointly set after the sample baseline is established.

## First independent core implementation slice

R017 initiates the [first implementation slice](core-framework-implementation-record.md). V009 is a local CPU/headless core artifact. V002 is in_progress, and complete acceptance remains not_run. Cases in this slice do not replace real V001 samples, complete V002 rendering, or V006 migration acceptance. Further inputs will fill the [evidence gaps](core-framework-evidence-gaps.md).
