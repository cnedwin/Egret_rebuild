# Product Components

English | [简体中文](../../Cns/docs/产品组成.md)

Egret connects creation, execution and publication through a shared project model. Rendering and Runtime provide the runnable foundation; project services, asset processing and creator tools make that foundation editable and deliverable. The following responsibility map describes the full product direction. Current bounded core packages are tracked in [core progress](core-progress.md); the [requirements](../../Cns/registry/需求.json) and [deliverables](../../Cns/registry/交付.json) distinguish formal scope from completed work. A private SDK preview is not a complete installable creator product.

| Component | Responsibilities and main outputs | Key boundary | Related deliverable |
| --- | --- | --- | --- |
| Rendering engine and runtime | Scenes, UI, animation, resource execution, input, scheduling, GPU backends, and recovery | Manages per-frame execution; AI inference stays outside the frame loop | V002 |
| Project model and development interfaces | Stable object identity, scene/resource structure, versions, references, commands, and diagnostics | Shared semantics for code, AI, and visual editing | V003 |
| Resource and animation pipeline | Import, processing, dependencies, atlases, fonts, skeletal animation, frame animation, 3D assets, and target builds | Preserves source assets and licensing information; runtime artifacts are tailored to hosts | V004 |
| Creation workbench | Creative intent, scene/UI editing, code, playtesting, diagnostics, repair, and undo | Every change maps to explicit objects and a project diff | V005 |
| Agent Skills and MCP interfaces | Read projects, propose and apply changes, invoke builds and tests, and explain feedback | Tool calls share project commands; protocol integration alone does not guarantee task success | V003, V005 |
| Platform adaptation and publishing tools | Host capability configurations, SDK services, packaging, release checks, and version updates | Graphics APIs, host services, and channel review are accepted separately | V005 |
| Legacy Egret project migration tools | Inventory, deterministic conversion, AI repair, comparison tests, difference reports, and rollback | Successful startup does not replace complete migration acceptance | V006 |
| Sample and quality infrastructure | Performance baselines, behavioral replay, visual comparisons, device matrices, and regression assets | Test-sample authorization, versions, and repeatability are explicit | V001 |
| Knowledge base and community collaboration | Shared entry point for requirements, proposals, evidence, deliverables, and changes | Documents, the knowledge base, and design discussions are public from day one; restricted assets retain authorization boundaries | V007 |

## Current component delivery

The engineering preview delivers four foundation packages and optional Spine. The public examples cover SharedFrame2D rendering and resources, animation, managed UI and native editing, opt-in canvas text entry and standalone World3D. [Current capabilities](core-progress.md) Byte readers/writers, events, Scope, coordinates and explicit time are reusable core tools; they do not imply complete production coverage.

No integrated editor application, Agent/MCP service, plugin marketplace, native Runtime SDK or complete migrator is delivered. The current native-looking @egret/runtime name denotes the host-free TypeScript core. The [capability overview](core-progress.md) and [engineering plan](engineering-plan.md) separate current interfaces from future tool products.

## One integrated tool platform

The creation workbench joins coding/debugging, main canvas, UI/animation, 3D scene/effect, world/character editing and target packaging/publication. These are cooperating views over one project, not independent document/resource systems. Shared surfaces are chosen around editing workflows.

Its Agent harness accepts selected model APIs, Skills, MCP and plugins, with a plugin marketplace, visible token/cost accounting and configurable limits. Natural-language generation/editing and advanced manual editing share commands, version preconditions, diffs, preview and undo. Runtime remains independent of model credentials, inference and billing. These platform components are requirements awaiting their own complete implementation/creator acceptance.

## How a change passes through these components

Replacing a character while preserving its outfit interface starts with stable references to the character, animation, materials and UI rules. Project services check resources and target capabilities, prepare a local diff, then apply import and edits to a known version. The real Runtime previews the result and replays outfit interactions. Rendering, events and relevant budgets are checked before export; failure returns to an editable version.

AI, visual tools and publishing use the same location, version and diagnostic contracts. Components can arrive incrementally while editor-framework, cloud-service and commercial-model choices remain open. The plugin marketplace remains a required future platform component; its operation and commercial terms require separate decisions.

## Boundaries between independent development and integration

Egret owns consistency across Runtime semantics, persistent projects and migration. Fonts, codecs and specialist libraries may be explicit dependencies when their quality, size, platform, version, license and maintenance costs are understood. Component selection follows requirements and technical evidence.

Community work starts with reviewable interfaces and acceptance examples, then implementations within selected boundaries. Proposals and replacements retain their reasoning in the [decision record](decisions-and-open-questions.md).

## Independent core and public dependencies

R015 requires scene/UI semantics, scheduling/composition, resource lifecycle, animation contracts, project transactions and migration rules to follow independently authored Egret specifications. General-purpose dependencies keep their identities. The [implementation policy](independent-implementation-and-dependency-policy.md) records source origins, third-party capabilities and license obligations separately, including AI-assisted work under ordinary review and verification.
