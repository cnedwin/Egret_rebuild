# Design Philosophy and Positioning

English | [简体中文](../../Cns/docs/设计理念与定位.md)

Egret aims to make a game understandable and maintainable throughout its life: from a first playable idea to repeated changes, publication and updates. Natural language, visual tools and code work on the same project. New creators need a clear route to a working game; experienced mobile developers also need familiar APIs, resource practices and diagnostics. Their learning paths are evaluated separately.

The earlier AS3-style objects, display lists and events helped Flash teams move to H5. That history explains the value of a familiar domain model; it does not predetermine today's implementation, platforms or performance.

## Confirmed directions

R001 defines the audience; R002/R004 cover complex 2D UI and lightweight 3D; R003 makes rendering and Runtime foundational; R008 requires complete legacy migration; R009 establishes public knowledge and community participation. The [requirements register](../../Cns/registry/需求.json) preserves the formal scope.

Lightweight 3D needs an explicit gameplay, content, image-quality, host, device and resource budget. A label alone fixes no model count, material specification or physics scope. Broad PC compatibility and large native-3D priorities remain separate decisions.

## Candidate product positioning

The product direction combines a game engine with creation tools whose results remain editable and verifiable. Complex UI and lightweight 3D share project identity, resources and delivery workflows, with execution strategies appropriate to each workload.

Three potential benefits require evidence: sustained efficiency for mixed rendering, dependable AI changes to existing works, and low-intervention migration of legacy Egret assets. Market value, creator completion and comparative performance remain [hypotheses](../../Cns/registry/假设.json), rather than claims established by package delivery.

## Design principles

- **Creator control:** locate, preview and undo changes across natural language, visual editing and code; maintain the resulting game over time.
- **Player experience:** evaluate first interaction, sustained frame time, latency, memory and power together, with equivalent content and quality.
- **Focused capabilities:** share foundations, separate workload execution, and trim optional modules, backends, diagnostics and compatibility.
- **Durable interfaces:** version project formats, resources, protocols and APIs separately, with migration rules and regression evidence.
- **Evidence-based engineering:** explain design tradeoffs and reference mechanisms, preserve attribution, and evaluate applicable versions and maintenance costs.
- **Delivery continuity:** connect resources, builds, host adaptation, tests and updates; qualify each platform through actual host acceptance.
- **Open development:** make documents, rationale, sources, failures and unresolved boundaries available for community review while respecting asset rights.

## Evaluation criteria for this stage

Use the same creation task to compare first playability, preservation after successive edits, human takeovers, change cost and actual-device publication. Observe experienced developers' API, resource and debugging needs alongside newcomer learning. [Verification methods](core-advantages-and-verification.md) and the [technical architecture](technical-architecture.md) connect those outcomes to engineering choices.
