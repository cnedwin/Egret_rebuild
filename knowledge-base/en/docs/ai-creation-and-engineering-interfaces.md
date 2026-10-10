# AI Creation and Engineering Interfaces

English | [简体中文](../../Cns/docs/AI创作与工程接口.md)

The candidate objective is to let AI understand the current work, make local changes, receive feedback, and keep iterating. R006 requires integration with the Agent, Skills, and MCP ecosystems. The specific engineering protocols and tools remain to be implemented; connecting a model must not be equated with reliable creation.

## Shared engineering semantics

Objects and resources use stable IDs; their paths, names, and scene positions may change. The project, resource format, engine version, and target host configuration each have separately pinned versions. Visual interfaces, code tools, and AI operations share the same reference checks, change commands, builds, and diagnostics.

The runtime scene is authoritative state; GPU or native mirrors can be rebuilt. The editable project records the facts of creation. Temporary playtest state must not be written back to the project without an explicit choice. Developer-generated business code is still a program that must be compiled, run, and verified; structured editing cannot replace gameplay tests.

## The change loop

1. Read the target objects, references, versions, capabilities, and performance budgets; define this operation's intent and completion conditions.
2. Generate a clearly scoped diff and list the potential effects on resources, rules, and interactions.
3. Apply the change under a version precondition; reread on conflicts and retain a snapshot from before the change.
4. Wait for resource import and builds to finish, then obtain diagnostics that identify the object, resource, code, and stage.
5. Playtest and replay key inputs, checking expected behavior, existing gameplay, visuals, and performance budgets.
6. Repair within a bounded number of attempts and cost; report results or remaining issues and support undo and retry.

Tool responses should include the task ID, project version, status, diff, diagnostics, artifacts, and acceptance results. Asynchronous import, build, and test operations need query, cancellation, timeout, and recovery semantics; retries must state their idempotency. Chat text without locatable context must not be the sole machine feedback.

## Candidate capability groups

| Capability | Typical use | Verification focus |
| --- | --- | --- |
| Project queries and location | Find a character, button, gameplay rule, or resource reference | Correct location after repeated renaming and moving |
| Structure and code changes | Change UI layout, character properties, events, and business logic | Local scope, types/references, and gameplay preservation |
| Resource import and build | Import skeletal assets, models, and audio; generate target resources | Source asset preservation, licensing, asynchronous completion, and errors |
| Playtesting and diagnostics | Input replay, object state, screenshots, and frame-time analysis | Repeatable results, object origins, and measurement definitions |
| Versions and recovery | Undo, compare, continue repairs, and update old projects | Conflicts, cancellation, failure recovery, and data consistency |

Skills provide task knowledge and operating procedures; MCP provides tool discovery and invocation; engine interfaces own project semantics and correctness. Different models and clients should be supported. Model selection, cost, and hosting remain undecided. For the protocol basis, see the [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

## Acceptance approach

Run multiple consecutive rounds of changes on the same work and record requirements met, preservation of unrelated functionality, successful undo, human takeover, waiting time, and cost. Test new creators separately from people with mobile-game experience. Diagnostics can guide optimization but do not prove that it works; AI changes require behavioral and visual revalidation. H005 and V003 correspond to the [hypotheses](../../Cns/registry/假设.json) and [deliverables](../../Cns/registry/交付.json). For bringing old projects into the same loop, see the [migration requirements](legacy-project-migration.md).
