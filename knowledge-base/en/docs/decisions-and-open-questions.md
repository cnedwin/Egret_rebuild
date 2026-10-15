# Decisions and open questions

English | [简体中文](../../Cns/docs/决策与开放问题.md)

Technical choices turn product constraints into a maintainable implementation. Each choice needs a reason, alternatives, measurable consequences and conditions for replacement. Product requirements and technical decisions therefore have separate records: the [requirements registry](../registry/requirements.json) defines scope, while the [decisions registry](../registry/decisions.json) retains candidate tradeoffs and their evidence.

## Current technical candidates

The D001–D016 design portfolio covers incremental extraction, ordered UI/3D execution, frame planning, forward rendering, backends, bridging, UI, animation, resources, scheduling, diagnostics and versions. D013 addresses build separation, D014 modular native Runtime, D015 optional GPU AI and D016 engineering/API/quality structure. The portfolio's recorded status is proposed, with no approval owner/date; later bounded package implementation does not approve every wider choice. Other experiment-specific records retain their own scope.

Acceptance considers correctness and performance evidence, invalidation conditions, migration and maintenance costs, and a fallback. Temporary prototype choices can be replaced. D005 leaves the native graphics implementation open; D006 leaves actual Rust/C++/WASM hotspots to measurement.

## Open questions ordered by dependencies

| Question | Required basis | Effects |
| --- | --- | --- |
| Q001 Benchmark gameplay and scale for lightweight 3D | Inventory of scenes, characters, effects, animation, UI, and interactions | Frame time, memory, rendering features, and asset budgets |
| Q002 Initial hosts and minimum devices | Creator needs, publication scenarios, and capability detection | Backends, compatibility floor, and release order |
| Q003 Acceptable efficiency and quality thresholds | Equivalent-quality baselines, devices, and sustained tests | Quantitative acceptance for H001–H004 |
| Q004 Supported legacy-project versions and samples | Owned or authorized projects, external dependencies, and historical behavior baselines | V006 scope, automation targets, and cost |
| Q005 Creator modification paths | Task tests for people without development experience and those with mobile-game experience | Editor, code visibility, and Agent tools |
| Q006 Team, budget, and delivery dates | Module scope, verification results, and personnel capabilities | Milestone commitments and responsibility allocation |
| Q007 Public repository, authorization, and governance | Proposed public asset inventory, third-party component licenses, and maintenance responsibilities | Community code access, licenses, and publication methods |
| Q009 Native SDK device and VM ownership | App/SDK hosts, actual VM builds, owned/borrowed devices, and whether D3D11 integration is necessary | Native graphics libraries, FFI, and release scope |
| Q010 Compilation feedback and AI-enhancement budgets | Representative projects, timing phases, model/SDK hardware requirements, and equivalent-quality cost | H008 and optional D015 tradeoffs |
| Q008 Business model and service boundaries | Creator value, cost, export needs, and ongoing maintenance needs | Local/cloud responsibilities, pricing, and ecosystem services |

Q001–Q004 establish the content, host, budget and legacy-sample boundary needed for executable verification. Other questions converge as their dependencies become concrete. Open-source development is established; Q007 continues to qualify individual assets, repository information, licenses and maintenance governance rather than suspending all engineering.

## Proposals and replacement

The [RFC template](../templates/rfc-proposal.md) records a proposed approach. The [ADR template](../templates/adr-decision-record.md) records acceptance, rejection or replacement with applicable versions and evidence. A changed requirement is recorded separately from a technical choice. Supersession preserves the old record and updates affected deliverables and regressions.
