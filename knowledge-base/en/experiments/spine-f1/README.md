# Original F1 Spine experiment

English | [简体中文](../../../Cns/experiments/spine-f1/README.md)

Engineering preview **0.36.0**, source **S089**, bounded deliverable **V040**, curated **2026-10-12**. This opt-in experiment connects an independently authored animation fixture to genuine Egret resource groups, asset leases, immutable Mesh2D geometry and the existing textured-frame port. Complete Spine **R020/V020 remains OPEN**. Final publication gates and 0.36.0 delivery are **PENDING** at this cutoff.

## Profile and ownership

The external official runtime is exactly `@esotericsoftware/spine-core@4.3.13`, revision `b7beb2ccbbce667a12c02f44d070644f59b04968`. F1 contains two untrimmed, unrotated region attachments, one translating bone, one non-looping `slide` animation and a 16×16 whole-page nearest/clamp texture. The logical `.png` atlas name is explicitly bound to 1024 original raw RGBA bytes; this does not implement PNG decoding or establish an Editor-export workflow.

`createF1ManualResources` loads two text headers and one Texture through genuine homogeneous groups. Each instance has its own Skeleton, AnimationState, renderer and retained display root. A private wrapper authenticates the core's unknown texture identity against the real lease. Immutable geometry copies only actual active command ranges before the core reuses its pools; Y is inverted once and the root is `(24,24)`. Float64 admission retains exact integer-channel/255 tint. The fixed observed protocol is two normal/light-tint commands, each four vertices and six indices.

`step` accepts finite deltas from **0 to 0.25 seconds**. Zero, capture and render do not advance animation or the Engine clock. Two active instances are an explicit F1 experiment limit. Scope/group and retained node lifetime checks precede advancement and follow callback-capable operations. Closing one instance preserves shared resources; closing the resource owner terminates instances before wrapper/group cleanup. Wrappers do not release group-owned leases. A failure after positive advancement makes that instance inert; no rollback or general scene transaction is promised. Unsupported F1 features are refused.

## Reproduce the CPU subset

Build the normal repository using its existing guide. Use Node **24.19.0** and the clone's TypeScript **7.0.2**. Independently obtain the exact official runtime, subject to the linked terms, outside the checkout. The runner never downloads, installs or adds a default dependency.

```text
node knowledge-base/experiments/spine-f1/run.mjs --help
node knowledge-base/experiments/spine-f1/run.mjs --spine-core <absolute official package directory> --output <absolute fresh external directory>
```

The output parent must exist and the output must be new and outside all admitted input roots. Every retry uses another directory. The runner validates all **137** official package files, compiles only original first-party sources using a generated strict local ES2022/DOM configuration, qualifies the current host and preserves raw process logs, hashes and owned-copy inverses. Current clone snapshots remain distinct from historical Main identities.

Actual portable CPU execution passed **12/12** original tests, including eleven child contracts. Each of **6** controls first passed a fresh **12/12** baseline: additive-profile refusal; wrong Y; double positive update; reversed actual command order; omitted instance-Scope admission; and a deliberately injected exception after actual advancement. The last proves inert error handling only. The reported before/after identities retain **737** SDK source/dist files, **40** dependency/helper files and **137** core files. Independent source/saved-receipt review has **0** open findings. Cold import/help separately observed **280** resolved modules, **0** core imports, **0** GPU-entry imports and **0** host accesses; it is not a full default test/prepush run.

CPU positions use the independently reviewed fixed absolute bound **2^-20** on this original shallow fixture and hosts satisfying the unchanged trigonometric premises. UVs, channels, indices, identity and time are exact. Original pixel tolerance remains **0**. The initial exact-coordinate equality failure and the initial `RENDERER_REQUIRED` setup failure remain historical; the finite successors qualify floating precision and negotiate the existing textured profile. Neither setup failure counted as animation acceptance.

## Separate browser evidence and pending public successor

A separately executed original desktop harness passed **8** positive WebGPU submissions with **22** exact literal pixel samples, full-byte repeats, B-instance independence and shared-resource cleanup. Its one double-update control failed the original midpoint `(25,19)` witness as assigned. A separate classification actor used **3** readbacks to verify `PIXEL_FAIL`, exit **1** and retained cleanup. These counts are not added together. Saved browser/classification review has **0** open findings.

That saved run used ordinary Edge **155.0.4283.45**, Playwright **1.62.1**, DPR **1** and the default adapter/device. API adapter information reported `nvidia`/`blackwell`; this does not independently establish physical device identity, hardware acceleration, energy/performance or OS descendant retirement. Borrowed-device closure and owning `device.destroy` are recorded API lifetime evidence.

The prepared public CPU/browser reproduction tool was actually executed in a new clone: CPU **12/12** and **6** fresh-baseline controls, then browser **8+1**, **22** exact positive samples, full repeats, the original midpoint control and bounded cleanup passed. The runner reported **1651** input identities unchanged. This successor is separate from the immutable CPU collection cutoff `REQUESTED_PENDING_SEPARATE_ENTRY` and from the earlier recorded browser/classification runs; it adds no wider feature coverage. Its finite independent source/saved-receipt review passed with **0** open findings. The public checkout also passed the same CPU/browser profile; its phase receipts are a separate successor. Final gates and delivery remain **PENDING** at this cutoff. The optional reproduction command is:

```text
node knowledge-base/experiments/spine-f1/run.mjs --spine-core <absolute official package directory> --output <absolute fresh external directory> --webgpu --playwright <absolute existing Playwright index.mjs>
```

Missing browser verification inputs or setup return `INCOMPLETE`. The CPU-only command remains valid. Exit codes are **0** `PASS_F1_CPU_SUBSET`, **1** `FAIL_F1_CPU_SUBSET`, **2** `INCOMPLETE`, and **3** for a separately requested `UNSUPPORTED_DEFAULT_ENVIRONMENT`. Inspect each phase's own receipt. See [verification](../../../evidence/spine-f1-manual-verification.json) and [public projection](../../../evidence/spine-f1-public-projection.json).

## Sources, rights and remaining work

Original bridge, tests and art are first-party Apache-2.0 work. The official runtime keeps its own [Runtime License](https://esotericsoftware.com/spine-runtimes-license), updated **2025-04-05**; it is neither bundled nor relicensed here. The [Editor Agreement](https://esotericsoftware.com/spine-editor-license#s2), pinned [spine-ts README](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/README.md) and [licensing FAQ](https://esotericsoftware.com/spine-purchase) distinguish evaluation, licensed integration, toolkit users creating/modifying runtime-containing products and redistribution notices. Editor Trial is not runtime-integration authority. External acquisition, source availability and successful execution establish no exemption or individual entitlement. Integration/distribution qualification remains **unverified**.

Canvas currently refuses this Engine-owned textured profile; Canvas/WebGL acceptance, automatic GameClock integration, other art/export versions, binary input, PNG decoding, PMA/dark tint/blends/mesh/deform/clipping/mixing/events/constraints/physics, complex UI/3D composition, phones/Native SDKs and performance/energy remain open. Continue [complete Spine acceptance](../../docs/spine-animation-support-and-acceptance.md) and the [engineering plan](../../docs/engineering-plan.md), including the broader UI/runtime, AI creator and legacy-migration obligations.

The preceding **0.35.0** was delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22), Main `d16f91c7ef41c9143469b21f4b3ef8b4efd1868e`, tree `a46b03f314b0f9b6c5c45a74affef498db97a7d6`. Its mandatory push gate passed **2678/2678** core and **63/63** publication tests, **148** document pairs and **177** critical sources. GitHub returned **0** statuses and **0** check runs; no remote CI PASS is claimed. Earlier pending cutoffs remain historical.

Commit whitespace validation later refused one extra terminal LF in the browser runner. The format-only successor removes that LF and rebinds its manifest identity; every other source byte and all original oracles remain unchanged. Current CPU **12/12**, **6** controls and browser **8+1** passed again. Earlier source and execution identities remain historical; see the format-only successor in [projection provenance](../../../evidence/spine-f1-public-projection.json). Final gate and delivery still require their own records.
