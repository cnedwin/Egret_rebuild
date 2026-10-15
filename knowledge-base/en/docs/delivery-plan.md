# Delivery Plan

English | [简体中文](../../Cns/docs/交付计划.md)

Delivery connects a runnable engine to a complete creation and publication workflow. Shared samples define the target; Runtime and asset capabilities supply execution; project services support safe changes; the workbench joins these into real publication and continued maintenance. Complete legacy migration belongs to that same first full-release outcome.

The current bounded preview has reached 0.54; [core progress](core-progress.md) and [package records](../README.md) identify delivered capabilities. The stages below describe the larger product, not release dates. Initial hosts, staffing, schedule, budget and numerical performance thresholds remain unresolved. The [delivery register](../../Cns/registry/交付.json) keeps status and the [engineering plan](engineering-plan.md) explains executable work packages.

[Technical white paper](technical-white-paper.md) · [Product requirements](product-requirements.md) · [Knowledge base home](../README.md)

## Delivery stages and dependencies

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

## Full Spine acceptance

R020 requires complete, version-correct Spine integration. V020's registered prerequisite is V001, with applicable resources, render, project and host interfaces needed for integration. V002/V004/V005/V006 include corresponding Spine acceptance obligations without changing their final dependency sets. Documentation, upstream capabilities, import planning and basic playback remain intermediate outputs. [Spine gates](spine-animation-support-and-acceptance.md) define completion; the whole capability remains open.

## What every acceptance review must leave behind

A review links requirements and decisions to artifact versions, environment, inputs, actual results, tolerances, unresolved issues and reproduction. Equivalent functionality and image quality govern comparisons; migration uses agreed old/new workflows. The [acceptance template](../templates/experiment-and-acceptance.md) provides the record shape.

Source artifacts establish implemented behavior, execution reports establish observed results, and registers summarize their scope. A failed gate remains a failed observation until a genuine successor passes; a new narrative cannot replace that evidence. R011 makes research, reasoning, verification and review a continuous engineering loop.

## Roles of mature implementations and verification

R012 makes established algorithms and versioned mechanism research engineering inputs. Egret's core follows independent specifications; explicit public dependencies retain attribution. The [adoption record](open-source-reference-implementations-and-adoption.md) and [round-three integration](../archive/round-3-research.md#execution)/[audit](../archive/round-3-research.md#audit) describe the executed reference chain and bounded V002/V004 research progress. Device measurements remain separate; missing phones do not stop GPU-free prerequisites.

## The continuing role of research

Host and technical comparison studies determine useful experiments, not product superiority. The [round-one research](../archive/round-1-research.md#research) preserves unverified Laya IDE/old-webpage dates and official-source date conflicts. Legacy source review has not established every old build, license or reuse path. Quantitative efficiency, automatic-migration and creator-completion targets follow the sample baseline.

## First independent core implementation slice

The [first core record](core-framework-implementation-record.md) captures R017's verifiable increment and V009 local CPU/headless artifact. It contributes to V002 without replacing V001's actual samples, complete rendering or V006 migration. [Evidence gaps](core-framework-evidence-gaps.md) connect remaining inputs to concrete acceptance.

## Historical evidence and original cutoffs

The October 8, 2026 knowledge-base 0.8.0 cutoff recorded V001 research in progress, V002 with a local headless core and V003–V006 product implementation not started. D001–D016 remained proposed and H001–H008 untested. V007/V008 described knowledge/community and candidate documents. Complete 0.1.0–0.7.0 snapshots remain historical; later narrow deliveries do not retrospectively change them.

[Round-one execution](../archive/round-1-research.md#execution), [round-two execution](../archive/round-2-research.md#execution) and [audit](../archive/round-2-research.md#audit) retain bounded contract/pixel programs, defects and fixes. The original [0.12 display/frame contract](display-and-frame-execution-contract.md), [plan](display-and-frame-implementation-plan.md), [record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json) preserve 97/97 core tests, 25 diagnostics and desktop Canvas interaction after the cross-realm correction. The separate [0.13 record](webgpu-rectangle-implementation-evidence.md) has its own scope. Neither accepted whole UI/3D/devices/editor/migration. R020's October 10 V020 registration was planned / not_started / not_run; partial work has not closed its complete scope.

The following original preview records retain their own failures and PENDING cutoffs; they are not the current version index.

<!-- BIP1-0.46.0-BEGIN -->
## Engineering preview 0.46.0 — Optional browser PNG textures

**R004 / R012 / R015 / R016 / R019 / R021 · S100 / V051.** The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. Complete current repository/prepush gates, this increment's push/PR/Main and remote CI acceptance remain PENDING.

Support is bounded to 8-bit RGB/RGBA noninterlaced still PNG, with browser-normalized straight sRGB RGBA8 output. This is not lossless decoding of every PNG: Canvas may lose hidden RGB and translucent precision. The adapter preserves existing engine.assets lease, Texture, SpriteSheet, Bitmap and clock ownership. Application shutdown retires Engine/manager demand and separately awaits provider.close(). Default core entries remain DOM-free; the sole optional factory and four erased interfaces add no runtime dependency. Four occupied jobs, 8 MiB per input and 32 MiB occupied encoded-byte budget remain the explicit limits. Full Spine R020/V020 and legacy migration R008/V006 remain OPEN.

Read the [contract](browser-png-contract.md) · [implementation plan](browser-png-implementation-plan.md) · [native schedule and CLI](browser-png-native-plan.md) · [evidence and retained repairs](browser-png-evidence.md).

Previous completed delivery: [PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) merged 0.45.1 into Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`, tree `56e49e879d93fae351c948375e0ec12f21c739ab`. Its separate mandatory-hook suites passed 137/137 publication, 2,909/2,909 core and 160/160 experimental tests; knowledge-base issues were 0. This successor does not rewrite earlier PENDING cutoffs or claim remote CI acceptance.
<!-- BIP1-0.46.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Next: complete public Clock replay and gates before adoption; then continue resources/animation/UI, 3D integration, browser and mini-game/native hosts, utilities and AI creator tools. Full legacy migration R008/V006 remains open.

Read [Clock guide](../experiments/spine-f1/README.md), [saved verification](../../evidence/spine-f1-clock-verification.json) and [pending public projection](../../evidence/spine-f1-clock-public-projection.json).
A subsequent actual replay of the public source in an independent clone passed manual **12/12** with **6** original controls and full Clock **10/10** with **3** assigned controls; the named fault actually executed, with **0** skipped accepted cases. Separate default-headless WebGPU execution passed **10+1** readbacks, **30** positive samples and **120** channels at tolerance **0**, retaining original full-byte relations and bounded cleanup. Cold import/help observed **280** modules and **0** Core/GPU/host accesses. The saved CPU collection retains its earlier native-pending cutoff; the separate native receipt is the actual successor. Original source and input identities remained unchanged. Independent saved-result review, final repository gates and delivery remain PENDING here; full Spine **R020/V020 remains OPEN**. See the current successor in the linked Clock verification/projection records.
<!-- F1C-DOC-0.37.0-END -->
