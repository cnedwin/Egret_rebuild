# Independent implementation and third-party dependency policy

English | [简体中文](../../Cns/docs/独立实现与第三方依赖规范.md)

Version: 1.1 · Knowledge base: 0.9.0 · Updated: October 8, 2026.

Egret Rebuild organizes engineering through public collaboration from its first development day. Source, design, documentation, the knowledge base, tests, and publishable verification records enter the open-source repository together so contributors can understand designs, reproduce results, and improve them. The designated public repository is cnedwin/Egret_rebuild, continuing its existing Apache-2.0 configuration. Maintenance responsibilities are being clarified. The public-development strategy is confirmed; actual repositories and release records determine publication status.

Egret designs its core against its own requirements, contracts, and acceptance conditions, using mature open-source projects, public standards, and maintenance experience as research foundations. General-purpose libraries enter through explicit third-party dependencies. Each module describes its design basis, implementation scope, dependency identity, and verification status, making technical contribution and third-party attribution equally clear.

Apply this policy together with the research principle of prioritizing mature implementations. See [research and verification responsibilities](open-source-research-and-validation-roles.md), [reference adoption plan](open-source-reference-implementations-and-adoption.md), [contribution guide](../CONTRIBUTING.md), and [project acknowledgements](../ACKNOWLEDGEMENTS.md).

## Implementation roles and attribution

| Role | Working method | Required attribution records |
| --- | --- | --- |
| Egret independent core | Research problems, mechanisms, constraints, and counterexamples; form Egret specifications, then design data organization, interfaces, and implementation | Own specifications, authors and changes, research basis, actual implementation scope, and verification |
| Explicit third-party dependency | Integrate through public library interfaces; retain package/directory identity, fix versions, and manage upgrades/patches | Upstream repository, version or commit, applicable licenses/notices, modifications, and integration responsibility |
| Research execution dependency | Build reference chains with mature implementations and verify assets and interface handoffs | Third-party execution modules, Egret adapter modules, experimental conditions, and result scope |
| Mechanism research | Read source, documentation, tests, and maintenance records; produce mechanism summaries and design evidence | Files read, fixed versions, source facts, Egret design inferences, and uncovered scope |
| Standards or tool generation | Implement public standards or generate code/data with registered tools | Standard versions, generator versions, inputs/configuration, generated scope, and applicable notices |
| Historical authorized materials | Check naming, behavior, formats, and migration needs within existing authorization | Source categories, authorized scope, public summaries, and distributable samples; verify publication rights separately |

The independent core includes Egret-defined scene and UI semantics, frame scheduling and compositing, resource lifecycle, animation events and sampling organization, project transactions, and legacy-project migration rules. General infrastructure such as GPU API implementations, script VMs, font shaping, or texture transcoding may use public libraries. Module descriptions clearly distinguish Egret-implemented layers from dependency-provided layers.

Three.js, Babylon.js, PlayCanvas, PixiJS, and other projects may hold multiple roles simultaneously; register each actual module separately. When a complete renderer or GUI is a dependency, its internal capabilities retain third-party attribution. Record Egret interface wrappers, adapters, and tests separately. Maintain research status, integration status, and production selection independently.

## Turning research into independent design

1. **Record research foundations.** Bind repositories, versions, files, and reading scope. Summarize mechanisms, invariants, error paths, and maintenance experience. Separate source facts from Egret inferences.
2. **Write Egret specifications.** Define problems, inputs/outputs, lifecycle, failure behavior, budgets, compatibility requirements, and alternatives. Explain design tradeoffs and expected improvements.
3. **Implement from specifications.** The independent core uses specifications, public standards, explicit dependency interfaces, and owned or authorized samples as inputs, organizing code independently. Copying, translating, or mechanically rewriting competitor source must be treated as actual third-party material and cannot be registered as an independent core.
4. **Maintain sources with changes.** Submit an [implementation source record](../templates/implementation-origin-record.md), listing independent code, dependencies, research references, generated content, and materials actually encountered.
5. **Review sources and contracts.** Review interfaces, data structures, dependency declarations, and similar fragments requiring further confirmation. Retain review grounds and resolution records. Source declarations and similarity checks provide review clues; conclusions remain limited to the scope actually checked.
6. **Verify design improvements.** Test correctness, cost, and maintainability under comparable function, quality, asset, and device conditions; retain failures and uncovered items. Novel design alone is not a performance conclusion.

Current implementation source records are limited-scope engineering evidence, not comprehensive proof of originality. Describe ordinary source research and independent implementation according to the actual process. Claim a strictly isolated development process only when it was actually performed and recorded.

## Dependencies, licenses, and release records

Dependency records include at least purpose, upstream URL, complete version or commit, files actually obtained and their hashes, applicable licenses and copyright notices, local modifications, interface boundaries, upgrade responsibilities, and verification executed. Third-party patches retain original attribution and are maintained separately from Egret adapters.

Register source, documentation, fonts, sample assets, shaders, transcoders, and generated content under their respective licenses. First-party source and documentation continue to use the designated repository's existing Apache-2.0 license; existing third-party licenses and notices stay with their files. The top-level license covers only explicitly declared content. Before release, organize actual distribution inventories, third-party notices, and required attribution; update rights-review status with versions.

Public repositories retain necessary source categories, research scope, and technical conclusions for historical private materials. Contributions exclude private original packages, credentials, personal information, and cooperation materials lacking publication authorization. Public summaries concerning them retain only information required for technical review.

## AI participation and author responsibility

AI may assist retrieval, mechanism explanation, specification drafting, coding, and review. Authors record tool participation, materials actually supplied or prompt summaries, generated scope, and review results; they are responsible for submitted content, sources, and sample-use permissions. Core implementation tasks define specifications and dependency boundaries; outputs follow the same code and source review process.

When sources need confirmation or fragments are clearly similar, review against specifications, input materials, implementation, and upstream versions, then complete records before entering the independent core. AI declarations describe actual work processes and do not guarantee model-training materials or the sources of every output.

## Existing implementation and research chain

The existing core prototype contains three headless packages: `@egret/contracts`, `@egret/runtime`, and `@egret/engine`. See the [core framework implementation record](core-framework-implementation-record.md) and [prototype source record](../../evidence/core-framework-implementation.json) for implementation scope, tooling sources, and records. Existing 44/44 behavioral checks and 11 negative type assertions are limited to the CPU and simulated-host slice. GPU, Native, real hosts, and CI await acceptance.

The Three r186 research chain actually executes third-party WebGLRenderer, GLTFLoader, AnimationMixer, and SkeletonUtils and uses native Canvas text. Vendor files, adapter code, fixed sources, and license notices are retained separately with the role of research reference. Existing 17 checks remain limited to original experimental conditions. Rendering and animation execution capabilities belong to Three.js and do not count as Egret's independent rendering core. See the [third-party notices](../experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) and [third-round integration record](../archive/round-3-research.md#execution).

Later independent modules may reuse research-derived test questions and Egret specifications, then compare against reference chains. Production dependency choices separately record module roles, costs, support matrices, and verification. Historical research evidence retains its original versions; corresponding source records establish current design and implementation.

## Directions for verifying Egret improvements

Prioritize complex-UI/3D cooperation, sparse updates, resource recovery, small packages, first interaction, compilation/debug feedback, continuous Agent modifications, and complete legacy-project migration. Code review also examines interface clarity, error handling, diagnosability, and maintenance burden.

First complete specifications and correctness that current environments can establish. Frame times, memory, power, heat, and target-host behavior require measurements in corresponding environments. Advantage conclusions include reproducible conditions, results, and limitations and evolve with implementation versions.
