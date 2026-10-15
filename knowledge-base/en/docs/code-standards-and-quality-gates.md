# Code standards and quality gates

English | [简体中文](../../Cns/docs/代码规范与质量门禁.md)

Quality rules protect observable behavior, resource ownership and maintainable change. A useful implementation has explicit authority, understandable failure paths and independently checkable results. R015 covers independent core origins and third-party attribution; R016 covers engineering standards with familiar Egret domain naming.

The standards apply to core code, platform adapters, tools and community contributions. Some are enforced by current repository tools; wider native, performance and complete-product gates remain design requirements. [Core progress](core-progress.md) and each acceptance record distinguish configured checks from planned ones. [Engineering architecture](engineering-architecture-and-project-structure.md) and [API contracts](public-api-design-and-naming.md) supply the module and behavioral boundaries.

## Rule levels and changes

Required rules protect public behavior, ownership, sources, reproducible builds, and real error handling. Recommended rules improve readability and maintenance. Exceptions must state reasons, scope, verification, and withdrawal conditions. Semantic exceptions require review; a one-line lint suppression cannot establish a new fact. Fixed tools normalize formatting automatically, without manual aesthetic review. Generated files follow their generators; third-party files retain upstream formatting.

Before changing a public contract, update schema/API documentation, list behavioral differences and affected samples, then implement. Submit implementation and affected regressions together. Code tasks identify requirements, design decisions, sources and completion criteria so that modernization has a concrete behavioral purpose. Module READMEs briefly describe responsibilities, inputs/outputs, dependencies, state authority, extension points, and verification entry points.

## State and lifecycle

Persistent projects, running game state, GPU/native projections, and derived caches each have a single authority. runtime owns business properties. GPU mirrors are rebuildable and must not become a second implicit game state. Object IDs are not pointers, paths, or names. resource generation is not deviceEpoch; gameplay event sessions do not reset during device recovery.

Name detach, dispose, task cancel, lease.release, and physical resource reclamation separately. Shared resources require explicit leases; borrowers do not silently become owners. Shutdown order follows API contracts. Reclaim in-flight GPU resources against completion conditions; SDKs must not destroy borrowed devices/surfaces. Failures, repeated cleanup, cancellation/completion races, full queues, late results, and reentrancy during shutdown require explicit terminal states.

All queues have capacity, backpressure, and overflow handling. Retries are bounded, with idempotent tasks identified. Background recovery resets the clock baseline; unlimited catch-up frames are prohibited. State coalescing must not swallow event order. Long tasks support taskId, queries, cancellation, timeouts, and source versions. Old build or resource results cannot overwrite new projects.

## Errors and diagnostics

Expected loading, capability, cancellation, and shutdown failures use EgretError and stable codes, retaining cause. Illegal calls may throw synchronously. Batch project validation returns Diagnostic collections; cancellation is a distinct terminal state. Diagnostics include phase, object/resource/effect, task or project version, profile, and locatable source positions, without matching error strings.

Empty catches, silent placeholders, and reporting success after removing necessary effects are prohibited. Adapters may offer explicit alternatives or placeholders and state whether acceptance is affected. finally and Scope execute all cleanup and aggregate cleanup errors. Later cleanup exceptions must not silently replace the original failure. Production diagnostics remove credentials and personal network information; development mappings may be trimmed at release. Assertions check internal invariants and do not replace external input validation.

## TypeScript and modules

| Aspect | Candidate requirement |
| --- | --- |
| Type checking | Enable strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, and verbatimModuleSyntax in the core. Public signatures have explicit return types; validate external input entering as unknown. Unexplained any/non-null assertions are prohibited. |
| Module targets | Browser bundle entries use module configurations matching the bundler; Node CLI uses configurations matching Node. Share a strict baseline without masking environment differences through one combined DOM/Node configuration. |
| Imports | Explicitly use import type/export type for types. Resolve packages through workspace and exports; TS paths are not runtime package mappings. Deep imports into another package's src/internal/dist are prohibited. |
| Data models | Model state with discriminated unions. undefined means absence; null is used only when schema explicitly allows it. Permanent IDs, instance handles, resource generations, device epochs, and task IDs use distinct types. |
| Classes and components | Separate familiar object APIs from compact execution data. Use private/protected fields and narrow interfaces for cross-module operations. New main paths use explicit defineComponent/registration, without global reflection or import side effects. |
| Enums and exports | Public protocols use validatable stable string/numeric domains. Do not expose const enum requiring consumers to use the same compilation mode. Adapt existing legacy enums for compatibility without rewriting history. |
| Concurrency | Every Promise is awaited, returned, or explicitly handed to a task manager; no floating Promises. Synchronous event handlers must not produce unhandled Promises. Bind asynchronous results to input versions and handle cancellation/failure. |

Official TypeScript documentation explains that type-only exports can be removed from JS output, paths does not rewrite output paths, and workspaces more closely match consumers' real package resolution. These mechanisms inform checks; they do not prove package-size benefits. [Module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

Candidate formatting uses UTF-8, LF, two-space TS indentation, double quotes, semicolons, and trailing commas; a recommended line width of 100 is enforced by the formatter. Rust uses rustfmt. Type names use PascalCase, members camelCase, directories kebab-case; main-class files retain Egret PascalCase names. Comments explain reasons, invariants, units, boundaries, and sources rather than restating actions. Public API notes and examples prioritize English versions usable by the community; design explanations may remain Chinese. Internationalized text is not hardcoded into logic.

File line counts, class counts, abstraction-layer counts, 100% coverage, or universal zero-allocation policies are not quality gates. Prioritize function responsibility and independently understandable module boundaries. Hot-path allocation, SoA, pools, and moving work into native code need end-to-end evidence; standards cannot prohibit all ordinary business allocations.

## Graphics shaders and numerical rules

Record 2D/3D coordinates, units, matrix conventions, clip depth, UV, texture formats, color spaces, and alphaMode consistently. The default modern profile composites in linear light with explicit premultiplication boundaries. Compare legacy nonlinear blending or alpha behavior through compatibility profiles. Avoid division by zero at zero alpha; decode color and data textures separately. Do not mix 2D pixel density with 3D world units.

WGSL/GLSL implementations each declare capabilities and variants. Concentrate backend differences in adapters; avoid backend-name branches throughout business logic. Effects declare inputs, passes, intermediate texture sizes, sampling, mask order, and capability fallbacks. Do not promise automatic equivalent translation of arbitrary WGSL to WebGL. Map compilation errors to effectId, variant, original shader location, and project version. Missing capabilities block necessary effects or use previously declared and compared simplifications; they must not silently change gameplay.

Ensure layout, event, skeleton-slot, and transparent-compositing order before optimizing batches, pipelines, and passes. Fewer DrawCalls do not directly imply faster execution or lower power. Dynamic 3D resolution must not reduce screen-UI clarity. Check numerical inputs for NaN/infinity, invalid dimensions, and capacity. Define tolerances from intended use, golden samples, and device conditions; do not loosen them ad hoc after failures.

## Rust native SDK and cross-language boundaries

Rust is a candidate awaiting comparison in D014. If adopted, safe code is the default, with unsafe concentrated in narrow FFI/GPU boundaries. Each SAFETY explanation covers pointer length, alignment, lifetime, thread, aliasing, and ownership. Safe wrappers validate before calls rather than requiring business logic everywhere to know unsafe preconditions. [Unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html)

Return errors through Result; do not casually unwrap external inputs or use panic for normal business failures. C ABI exposes fixed-width values, versioned structures, opaque handles, and slot/generation, not Rust Vec/String or unpromised layouts. Buffers distinguish copy, borrowed, and transferred, stating allocator pairing and invalidation times. Reacquire views after WASM memory growth.

panic and C++ exceptions must not cross the default ABI. When the build strategy permits, narrow entries may catch unwind and mark invalidation. catch_unwind cannot catch panic=abort and does not isolate native crashes. Convert C++ exceptions to explicit errors on the C++ side. Command protocols check versions, lengths, endianness, overflow, object generations, and thread ownership. Invalid packets must not partially alter current state. [Rust FFI](https://doc.rust-lang.org/nomicon/ffi.html), [catch_unwind](https://doc.rust-lang.org/std/panic/fn.catch_unwind.html)

CPU logic, GPU submission, and IO/decoding threads have explicit owners and result-commit queues. Background tasks do not write directly to TS game state. Establish a Cargo workspace sharing versions and lint baselines; create specific crates only when actual responsibilities emerge. [Cargo workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)

## Project and Agent commits

Editors, CLI, MCP, and automated migration call the same project service. Commands carry baseRevision, transactionId, stable target IDs, preconditions, and differences; after validation, commit atomically or roll back completely. Reject concurrent conflicts and reread; query first when state is unknown. Do not overwrite others' changes through “last write wins.” Project commits do not promise global transactions across external services. Resource import, build, and publication side effects each have tasks, result versions, and permission boundaries.

AI-assisted development uses project specifications and behavior samples, producing change scope, sources, diagnostics, actual execution results, and remaining issues, while retaining model/tool versions and participation scope. Write Egret core independently from its own specifications. Explicitly register third-party dependencies, versions, patches, and release notices under the [independent implementation policy](independent-implementation-and-dependency-policy.md). Automated scans provide review clues; source and license checks still require specific files and dependencies.

Modify source files through the code-patch service and structured scenes through schema commands. Both enter project transactions, validation, and undo. Do not pretend arbitrary business code can be expressed as JSON fields. For generated files, modify only authoritative sources and generators; protect manual edits from updates. Inspect reviewable diffs and verification results before release. Release qualification follows the reviewed artifacts and their actual verification.

## Automated quality gates

The initial candidate tooling baseline is one workspace package manager, one TS formatter, one TS lint stack, one test runner, and Rust's built-in checks. pnpm, Prettier, and ESLint/typescript-eslint are recommended, with versions fixed when actually selected. Type checking follows D013's separation of fast transpilation, incremental diagnostics, and full release checks. Candidate Vite use is limited to suitable Web development entries. The complete proposed stack is separate from configured tools. At the first-slice cutoff, pnpm/TS and Node's built-in test runner were fixed; Prettier/ESLint, Rust and CI were not configured. Current tooling is determined by the repository and its package records.

| Gate | What it must demonstrate | Execution boundary |
| --- | --- | --- |
| Formatting and types | Automatic formatting, strict types, external input validation, no floating Promises | Fast checks for affected packages; complete release checks, without hiding first-party contract issues through skipLibCheck. |
| Dependencies and API | Allowed package-dependency DAG, exports/API declaration snapshots, pure core free of DOM/Node pollution | Import actual build and release directories; resolving source-directory aliases alone is insufficient. |
| Semantics and failures | Capture/bubble/once, dimension order, cancellation, late Scope values, leases, transactions, recovery | Independent assertions/own golden samples; retain counterexamples and failures rather than repeating helpers to prove themselves. |
| Targets and budgets | 2D/mixed/Native package composition, first interaction, frame-time percentiles, peak memory, preview and diagnostic latency | Fixed scenes/versions/profiles/devices/quality; real hosts establish support, real devices establish power consumption. |
| Sources and release | Independently written scope, third-party inventory, patches, asset rights, generation sources | Update with changes and review before release; do not label the research chain an independent core. |

Behavior tests prioritize costly failure contracts: changes/reentrancy during dispatch, final-lease release, old-epoch fences, packet loss/backpressure, cancellation/completion races, concurrent conflicts/rollback, device recovery, and critical migration paths. Simple comment/format revisions need no new tests restating implementation. Expand only affected verification after changes, broadening scope when new failures or uncertainty arise.

Performance records include cold preview, hot feedback, complete diagnostics, release builds, resource conversion, first shader, CPU/GPU frame-time percentiles, peak memory, first interaction, and Agent repair cost. Register specific product thresholds after establishing representative samples and target devices. Old research-fixture capacities are not product budgets. State the scope of type checks, contract models, desktop-browser results, and real-device results separately.

## Submissions and community review

Each submission addresses one understandable problem and describes its trigger, before/after behavior, design rationale, affected contracts, and actual verification. API/format changes include migration information. PR checklists cover lifecycle, cross-host assumptions, sources, diagnostics, and required regressions. Contributors may submit documents or failure golden samples first; they must not be required to read private original packages.

Exception records use stable IDs, owner, reason, scope, and expiry or withdrawal conditions; do not invent names for unappointed owners. Record dependency upgrades and affected regressions separately, reviewing versions and lockfiles together. Public package versions, schemas, bridges, tool protocols, and test samples remain traceable. Retain history when withdrawing conclusions.

Documented rules and automated enforcement have separate evidence. Actual implementation and acceptance remain established by code, reproducible artifacts, and the [delivery registry](../registry/deliverables.json).

## Browser gates and publication inventory

`node tools/prepush.mjs` remains mandatory before every push and checks publication structure, core/type/boundaries, headless behavior and KB structure. It does not launch a browser. Rendering changes additionally use `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` and the separate `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>` as affected. Use the accepted pinned dependencies; preserve default browser launch with no extra flags. Recorded unchanged-build evidence may be retained with explicit identity comparison.

Discovery and registered inventory paths exclude private execution/dependency/generated trees case-insensitively on Windows. Listings cannot override exclusions. Public AGENTS documents remain valid. Only the exact two sealed Three r186 research build paths/hashes remain exceptions. Structural checks do not create translation meaning or public review approval.

## Historical evidence and policy baseline

The original policy is version 0.1, knowledge base 0.9.0, October 8, 2026. The [first core record](core-framework-implementation-record.md) contains its limited compilation/type/boundary checks. The [0.12 contract](display-and-frame-execution-contract.md), [plan](display-and-frame-implementation-plan.md), [record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json) retain 97/97 behavior checks, 25 negative diagnostics and desktop Canvas/pointer evidence after cross-realm correction; the [0.13 rectangle record](webgpu-rectangle-implementation-evidence.md) remains distinct. These cutoffs did not establish complete texture/text/animation/UI/3D, Native/device, editor/Agent or migration acceptance.

Independent literal geometry oracles, deeply immutable snapshots, reentrancy/shutdown counterexamples and actual pixel checks test different obligations. A pixel check must detect a no-op backend and state browser/automation versions. Headless or prepush success alone supplies no browser coverage; final evidence binds the source and document bytes actually reviewed.
