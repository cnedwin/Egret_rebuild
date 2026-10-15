# AI Creation and Engineering Interfaces

English | [简体中文](../../Cns/docs/AI创作与工程接口.md)

AI creation is useful when a tool can understand an existing game, make a bounded change and verify the result without erasing unrelated work. Egret therefore exposes project operations, build tasks and runtime diagnostics through the same semantics used by visual and code tools. R006 includes Agent, Skills and MCP integration; reliable end-to-end creation remains an implementation and acceptance goal.

## Shared engineering semantics

Stable object and resource IDs survive renaming, moves and scene rearrangement. Project schemas, resource formats, engine versions and target-host configurations are pinned separately. All editing clients share reference validation, commands, builds and diagnostics, so a change means the same thing regardless of the interface that requested it.

The editable project owns persistent creation data. A running instance owns temporary gameplay state; GPU and native projections are rebuildable. Playtest changes enter the project only through an explicit application. Generated business code follows ordinary compilation, runtime and gameplay verification; structured editing supplies useful constraints but cannot establish behavior by itself.

## The change loop

A change begins with the target objects, references, versions, capabilities, budgets and completion conditions. The tool produces a scoped diff, explains effects on resources and interactions, and applies it against a version precondition. A conflict requires a fresh read. The pre-change snapshot remains available for recovery.

Import and build tasks then produce diagnostics tied to the original object, asset, code and stage. Playtesting replays key inputs and checks intended behavior, existing gameplay, visuals and applicable performance budgets. Repairs have bounded attempts and cost. The result includes remaining issues and an actionable undo or retry path.

Every task response carries its task ID, input/output project versions, status, diff, diagnostics, artifacts and actual acceptance results. Long tasks expose query, cancellation, timeout and recovery; retries declare idempotency. Late results cannot overwrite a newer project. Locatable structured feedback complements explanations.

## Candidate capability groups

| Capability | Typical use | Verification focus |
| --- | --- | --- |
| Project queries and location | Find a character, button, gameplay rule, or resource reference | Correct location after repeated renaming and moving |
| Structure and code changes | Change UI layout, character properties, events, and business logic | Local scope, types/references, and gameplay preservation |
| Resource import and build | Import skeletal assets, models, and audio; generate target resources | Source asset preservation, licensing, asynchronous completion, and errors |
| Playtesting and diagnostics | Input replay, object state, screenshots, and frame-time analysis | Repeatable results, object origins, and measurement definitions |
| Versions and recovery | Undo, compare, continue repairs, and update old projects | Conflicts, cancellation, failure recovery, and data consistency |

Skills carry task knowledge and operating procedures. MCP supplies tool discovery and invocation, while project services own editing semantics and correctness. Different models and clients can use that boundary; model, cost and hosting choices remain undecided. The [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) is the protocol reference.

## Acceptance approach

Evaluate consecutive changes to the same work: whether requirements are met, unrelated behavior survives, undo succeeds, and failures permit human takeover. Record waiting, repair attempts and cost. Test new creators and experienced mobile developers separately. Optimization suggestions require behavioral, visual and measured revalidation.

H005 and V003 are tracked in the [hypotheses](../../Cns/registry/假设.json) and [deliverables](../../Cns/registry/交付.json). [Legacy migration](legacy-project-migration.md) brings converted projects into this same editable, verifiable loop. Current core progress provides prerequisites; it does not establish completion of these interfaces.
