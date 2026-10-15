# Core engineering progress

English | [简体中文](../../Cns/docs/core-progress.md)

The core is developed through executable increments that connect display, resources, animation, input and host execution. This page summarizes the current interfaces and remaining product work; each linked contract contains the exact behavior and verification scope.

## Current integrated version

Engineering preview **0.54.0** was merged through [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42). Main is efd2a9c91fb6cfe633214b50b82cf7952941452a, tree 2b39b8439a5b30ce3572edc162e8a7a916a76185. Workspace packages remain private 0.0.0; host protocol remains 1.0.

## Implemented scope and boundaries

| Area | Available engineering scope | Reference |
| --- | --- | --- |
| Display and input | DisplayObject/Container, transforms and pivots, coordinates/bounds, authored hit areas, primary mouse routing and bitmap buttons. | [Contract and scope](bitmap-button-contract.md) |
| Resources | Typed references, shared acquisition, leases, Scope cleanup, acquisition groups, textures, named SpriteSheet crops and an optional PNG provider. | [Contract and scope](resource-acquisition-groups.md) |
| Animation | Explicit game time, scalar Tween, atlas sequence sampling and Engine-clock sequence playback. | [Contract and scope](sequence-playback-contract.md) |
| 2D presentation | Immutable frame capture, Canvas/WebGPU paths, textured geometry/Mesh2D and NineSliceBitmap within their declared profiles. | [Contract and scope](textured-geometry-and-mesh2d-contract.md) |
| Text | Text-raster orchestration, a noneditable TextField and a selected Canvas text integration. | [Contract and scope](text-field-tf1-contract.md) |
| 3D | CPU geometry/matrices, owned scene frames and selected explicit browser mesh/scene routes. | [Contract and scope](public-scene3d-contract.md) |
| Spine | Import and mesh source planning, a linear source profile and an experimental official Core manual bridge. | [Contract and scope](spine-core-manual-bridge.md) |
| Engineering and migration | Owned binary readers/writers, project transaction contracts and bounded legacy RES/MovieClip analysis. | [Contract and scope](legacy-project-migration.md) |

The default core is DOM/Node-free. Canvas and WebGPU are explicit browser entries. Display assembly, time advancement, capture and submission have distinct contracts. Resource leases and Scope/Engine ownership make cancellation and retirement explicit.

## Current verification

The recorded 0.54 work completed all nine local code phases, Core **3218/3218**, retained Spine Source **160/160**, and focused Button checks **163/163**. The Button type positive produced **0** diagnostics and its negative consumer matched **19** diagnostics. The normal prepush and mandatory commit/push hooks completed, and the merged tree was compared with the reviewed files.

Desktop Edge **155.0.4283.45** Canvas/WebGPU verification completed **38** main readbacks and **87552** channel comparisons at tolerance **0**, with no mismatches. A separate fresh Canvas control recorded **2** readbacks and an intentionally wrong expectation differing by **48** pixels and **96** channels; it contributes no main-case credit. See [the Button verification record](bitmap-button-evidence.md). These counts describe different scopes and are not added together.

GitHub reported no statuses or check runs for PR #42. The local verification above is recorded separately from remote CI. Desktop pixels do not establish target-phone performance, energy use, font coverage or complete host support.

## Next work and contributions

- Reusable layout and richer UI composition, followed by touch, keyboard, focus, accessibility and editing.
- Resource-backed visual replacement with cancellation, stale-result suppression and recoverable publication.
- Complete versioned Spine support under **R020/V020**, including its feature/backend/host matrix.
- Extended 3D scenes, characters and effects, with asset and lifetime integration.
- Production browser/mini-game/native hosts and target-device typography and performance.
- Creation tools and Agent/project interfaces, plus complete old-project migration under **R008/V006**.

These remain engineering and acceptance obligations. The [engineering plan](engineering-plan.md), [delivery plan](delivery-plan.md) and registries track their scope.

## CPU reference formulas

The historical A2 Task5a oracle uses tools/texture-oracle.mjs. expectedUploadRGBA selects floor((C*A+127)/255) for integer straight channels. expectedEncodedOver computes binary64 source-over in the premultiplied encoded domain with explicit opacity, without UNORM quantization or color-transfer conversion. assertTexturePixel requires four explicit absolute channel bounds. Device calibration is separate.

## Historical engineering evidence

The [Changelog](../CHANGELOG.md) records the purpose of each increment. Detailed earlier results, failures and preparation cutoffs are preserved in subsystem evidence and the [versioned progress record](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/docs/core-progress.md). Historical counts and hashes continue to identify their original source; a later reading edit does not rerun or expand them.

The [contribution guide](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) describes reproducible changes and review. First-party implementation, external dependencies and research references retain their own attribution and licenses.
