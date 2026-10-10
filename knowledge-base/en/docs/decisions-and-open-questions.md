# Decisions and open questions

English | [简体中文](../../Cns/docs/决策与开放问题.md)

This stage has clarified whom to serve, what to support, and what to deliver ultimately. Engineering choices remain candidates; entry into the knowledge base does not make them approved or implemented. The [requirements registry](../registry/requirements.json) stores confirmed project requirements; the [decisions registry](../registry/decisions.json) stores sixteen technical candidates and their verification gates.

## Current technical candidates

D001–D016 cover incremental data extraction, UI/3D execution lists, a small frame graph, a mobile forward baseline, graphics-backend abstraction, cross-language bridging, complex UI, animation, resource builds, scheduling and sustained performance, diagnostics, and interface versions. D013 covers build separation, D014 a modular native Runtime, D015 optional GPU AI, and D016 engineering structure/API and code standards. All statuses are proposed; owners and approval dates are empty.

Accepting a technical decision requires requirements, alternatives, performance and correctness evidence, invalidation conditions, migration costs, and fallback methods. A prototype approach adopted temporarily does not automatically become the long-term choice. D005 has not specified a native GPU implementation; D006 has not determined which kernels require Rust, C++, or WASM.

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

These questions organize research; they do not require all answers at once. The first four take priority in forming executable verification boundaries. The project is built as open source from day one. Q007 continues reviewing authorization for specific public assets, repository information, licenses, and maintenance governance.

## Proposals and replacement

Use the [RFC template](../templates/rfc-proposal.md) to propose approaches and the [ADR template](../templates/adr-decision-record.md) to record reasons for acceptance, rejection, or replacement. Record requirement changes and technical choices separately. When replacing a decision, retain the old record and applicable versions, and update deliverables and regression tests accordingly.
