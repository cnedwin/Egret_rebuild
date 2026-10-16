# Prepared resource groups

English | [简体中文](README.zh-CN.md)

Two animated pilots share an atlas and keep independent two-layer outfits. A new outfit becomes visible only after both textures are ready and a single binding ticket commits both layers. Failed, cancelled or obsolete requests leave the previous outfit in place.

After the normal repository build, serve the repository over localhost and open this directory's `index.html`. Canvas 2D is the default. The optional experimental WebGPU profile places the same textured display content above a small opaque 3D background; it requires a supported browser.

Select a pilot by clicking it or using the selection buttons. Choose Classic, Summer or Mix, then change its outfit. Advance the animation in 0.125-second steps, cancel a pending change, remove a pilot or close the scene. Removing one pilot retains the other pilot's resources. The controls use real public Engine, Scope, asset, animation, text and input APIs.

The reusable `createPreparedResourceApplication` in `application.mjs` owns its canvas, Host, session and source/dependency adapters. Its original `ready` promise resolves after the first presentation. `present` queues one presentation; `whenIdle` returns the latest completed original presentation, including native selection. After `ready`, consumers can subscribe through the genuine `input.events` descriptors and the session's `inputScope.signal`. The application remains responsible for closing that input owner.

`session.mjs` composes the scene, `coordinator.mjs` manages outfit publication, and `source.mjs` and `dependencies.mjs` adapt genuine image/font operations. Group members remain borrowed by their binding ticket. Cancellation ends publication demand; original fetch/decode work keeps its own reservation until it actually settles. Close waits for those original operations and retires a GPU surface only after safe Host cleanup.

The example reuses the recorded PNG, Ahem and Noto Sans SC assets from the resource-scene example, with their original source and license records. Fixed Chinese labels exercise one recorded font subset. These labels do not establish general typography, mobile performance, a production host, complete UI or full Spine support.

Read the [contract](../../knowledge-base/en/docs/prepared-resource-groups-spec.md) for lifecycle, ownership and finite resource limits. Verification records distinguish source review, CPU behavior, real browser results, full repository checks and Git delivery.
