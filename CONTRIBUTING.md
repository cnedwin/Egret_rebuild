# Contribution guide

English | [简体中文](CONTRIBUTING.zh-CN.md)

Egret welcomes contributions to the engine, examples, tools, design and documentation. Start with the [capability overview](knowledge-base/en/docs/core-progress.md) and the contract for the subsystem being changed. The public repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild).

## Contributions you can make now

- Improve display, resource, animation, input and host behavior through documented public contracts and meaningful regressions.
- Develop the creation, project-editing and migration workflows in the engineering plan.
- Supply authorized game/UI/animation samples and real-host or target-device verification.
- Improve documentation, translation and reproducibility, with sources supporting technical conclusions.

Use the [RFC template](knowledge-base/en/templates/rfc-proposal.md) for changes that need a design discussion and the [ADR template](knowledge-base/en/templates/adr-decision-record.md) for reviewed decisions.

## Submission and review

Keep each contribution focused. Explain the problem, resulting behavior, affected contracts and compatibility, sources and verification. Include reproduction steps for a bug and explain any remaining limitations. Public API changes require synchronized specifications and appropriate regressions.

Use Issues and PRs for repository contributions. A proposal's recorded status changes only after review; a draft or successful build is not a completed product feature. Maintain technical discussion around the problem, evidence and tradeoffs.

## Reproducing existing core checks

Use Node.js 26.7.0, pnpm 11.25.0 and TypeScript 7.0.2. From the repository root:

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

During development, use `node tools/check-incremental.mjs --base origin/main` for affected behavioral feedback. Before pushing, review sources, both reading editions and critical English comments. The commit hook checks text bytes; the push hook runs `node tools/check-push.mjs --committed` on the clean committed snapshot. Complete `pnpm check:merge` / integrated CI, independent review and affected actual-browser evidence remain required before merge. See the delivery tiers in the [engineering plan](knowledge-base/en/docs/architecture-and-engineering-plan.md).

## Engineering and API policies

Follow the [project structure](knowledge-base/en/docs/engineering-architecture-and-project-structure.md), [API conventions](knowledge-base/en/docs/public-api-design-and-naming.md) and [quality policy](knowledge-base/en/docs/code-standards-and-quality-gates.md). Preserve package boundaries, explicit resource ownership and the DOM/Node-free core. Use the [path and raw-byte policy](knowledge-base/en/docs/repository-identity-and-line-endings.md) for exact identities and canonical first-party text.

## Sources, AI, and public content

First-party code and documentation use Apache-2.0. Keep third-party notices and asset attribution. Record implementation materials, dependencies, AI assistance and review using the [origin record](knowledge-base/en/templates/implementation-origin-record.md). Contributors remain responsible for the submitted behavior, source rights and verification.

Public documents describe the project in a coherent, neutral voice: purpose, constraints, reasoning, contracts and results. Cite relevant work without presenting the product as a response to a conversation or a sequence of instructions. Retain substantive decision history and sources in their records. Do not attribute unrecorded thoughts to individuals.

Exclude credentials, private configuration, unauthorized original projects and unedited private discussions. Research and dependency use follow the [implementation policy](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md).

## Bilingual checks and push hook

Maintain complete English and Chinese readings. Keep knowledge-base editions in en/ and Cns/, default repository readings in English, and Chinese companions in .zh-CN.md. Review meaning in both languages before refreshing current identities and registry views. Critical code comments are English. See the [bilingual checks](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) and [layout policy](knowledge-base/en/docs/documentation-layout.md).

## Browser gates and publication inventory

The prepush checks do not start a browser. Select the documented Canvas/WebGPU gates according to the change and retain their actual environments and results. Earlier results can be reused only for explicitly compared unchanged identities. Source publication, browser behavior, target-device performance and remote CI have separate records.

Private execution, dependency caches and generated files are excluded from the public inventory. Raw evidence, historical source identities and upstream legal originals retain their provenance. [The publication guide](PUBLICATION.md) describes remote delivery.

## M0 onboarding and collaboration

Use the [getting-started guide](knowledge-base/en/docs/getting-started.md) for current environment, contribution responsibilities and review boundaries. Install pinned PowerShell 7.6.5. Drafts may use one language; maintainers help complete both editions and current metadata. Final publication and Main integration still require full gates.

Follow the [public board](https://github.com/users/cnedwin/projects/2) for live status and [Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52) for a first contribution. Each available item must name its entry point, expected result, checks and review contact. Blocked items record the missing dependency and next action. Maintainers update status after reviewing evidence; an Issue/PR label alone never certifies acceptance. The [newcomer checklist](knowledge-base/en/docs/getting-started.md#rehearse-the-first-contribution) explains the contributor declaration and maintainer integration workflow.

Classify review scope using the [architecture plan](knowledge-base/en/docs/architecture-and-engineering-plan.md): wording-only changes need content/link/bilingual review; setup/CI/verification changes need clean-environment and refusal-path evidence; rendering/resource/animation changes additionally need affected actual-browser checks. These review additions do not replace the mandatory complete merge gate. No external-fork, human or device result may be inferred from maintainer-account CI.
