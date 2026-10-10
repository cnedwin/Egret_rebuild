# Design Philosophy and Positioning

English | [简体中文](../../Cns/docs/设计理念与定位.md)

The Egret rebuild should continue its past ability to help developers cross technological eras. Previously, familiar AS3 objects, display lists, and event models helped Flash teams enter H5. This time, creative intent should become game projects that can be continually changed, verified, and delivered. The primary audience is new creators who mainly use AI to make games, including mobile-game developers beginning to rely on AI. Learning paths for these two groups require separate testing; a single set of beginner assumptions cannot substitute for both.

## Confirmed directions

R001 defines the audience; R002 and R004 define the combination of complex 2D UI and lightweight 3D; R003 establishes rendering/runtime as the core; R008 establishes legacy-project migration as a final deliverable; R009 establishes continuing knowledge-base and community participation. The [requirements register](../../Cns/registry/需求.json) is authoritative for the complete original intent.

“Lightweight 3D” does not yet imply a particular model count, material specification, or physics capability. Initial gameplay, scale, image quality, hosts, devices, and performance budgets must be defined together. Priorities for broad PC compatibility and large native 3D have not been newly decided; historical tradeoffs cannot directly become promises for the new version.

## Candidate product positioning

Provide AI-oriented new creators with a game engine and creation tools that have clear budgets for complex UI and lightweight 3D, letting the same work progress from first playability to continuous changes, multiplatform delivery, and long-term updates.

This definition contains three differentiators awaiting verification: sustained efficiency for complex UI and mixed rendering; reliability of AI changes to existing works; and low-intervention migration of legacy Egret assets into the new system. Market value, creator completion rates, and leading performance all remain [verification hypotheses](../../Cns/registry/假设.json).

## Design principles

1. **Preserve creator control.** Natural language, visual editing, and code operate on the same project. Changes can be located, previewed, and undone; successful works remain maintainable.
2. **Measure performance by player experience.** Time to first interaction, sustained frame time, input latency, memory, and power jointly determine experience. Empty-package size and average FPS alone do not establish superiority.
3. **Keep the core lean and capabilities on demand.** UI, 3D, and animation share necessary foundations while each uses suitable execution strategies. Modules, backends, diagnostics, and legacy compatibility layers can be trimmed.
4. **Keep interfaces stable and internals replaceable.** Objects, resources, projects, and protocols have separate version management. Upgrades must carry migration rules and regression evidence.
5. **Study mature implementations by problem.** Record how third parties solve problems, their applicability conditions, and maintenance costs. Retain source acknowledgements, then choose approaches suitable for Egret workloads. Comparisons use pinned versions and actual evidence.
6. **Treat delivery as part of creation.** Resources, builds, host adaptation, tests, and updates form a loop. Specific platform commitments come from acceptance on real hosts.
7. **Open design and verification.** Build as open source from day one, publishing documents, the knowledge base, design questions, and rationale. The community can review sources, failure records, and unverified boundaries.

## Evaluation criteria for this stage

Compare first playability, gameplay preservation after consecutive changes, human takeovers, change cost, and successful publication on actual devices using the same creation task. Have experienced mobile-game developers complete the same task and observe the API, resource, and debugging practices they need to retain. See [core advantages and verification](core-advantages-and-verification.md) for measurement methods and [technical architecture](technical-architecture.md) for technical candidates.
