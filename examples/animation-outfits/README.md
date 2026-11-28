# Editable animation and outfit reference

English | [简体中文](README.zh-CN.md)

At startup, one Engine renders 20 independent Spine players sharing one parsed setup and two atlas pages, plus 200 independent sequence controllers sharing one clip and one texture. Four rows interleave Spine displays, sequence Bitmaps and Engine graphics. The DOM contains only the controls, canvas and status shell. This original geometric example is reusable M3/M4 content, not complete M2.4 acceptance.

## Run and edit

With the repository's pinned Node 26.7.0, pnpm 11.25.0 and TypeScript 7.0.2 dependencies prepared:

The root development dependency on @egret/spine lets pnpm install the public-entry link used by this example and its tests. It does not add Spine to the default Engine dependency graph; a manually created local link is not an installation requirement or substitute for the declared dependency.

    node tools/build.mjs
    node examples/animation-outfits/author.mjs
    node tools/serve-example.mjs --port 4173

Open [WebGPU](http://127.0.0.1:4173/examples/animation-outfits/index.html?backend=webgpu) or [WebGL2](http://127.0.0.1:4173/examples/animation-outfits/index.html?backend=webgl2). Select a character, outfit, animation, loop/two plays, rate and pause state, then apply. Apply advances one shared 1/60-second tick so queued Spine commands become visible. Step advances 0.1 seconds. Preview advances a fixed 1/60 simulation second after each completed frame; it is not wall-clock playback or a performance measurement. Reload/retry reconstructs the scene after complete retirement. Close also cancels an in-flight load.

Edit original geometry, skins, events and sequence frames in [content.mjs](content.mjs), then rerun the author. The author writes reproducible source/artifact bytes and an admitted public resource manifest under ignored work/animation-outfits. This finite manifest author is not the planned general Spine content importer, cache, incremental build or Editor project exporter.

## Ownership and limits

The existing manifest Spine loader owns metadata, integrity-checked PNG pages and one parsed setup. The sequence manifest group uses the same Engine AssetManager and existing byte/texture providers. There is no additional resource manager or rendering host. The selected character and spark share a replacement Scope; the other instances keep their individual Scopes. 20 Spine subscriptions and one sequence coordinator use the Engine clock. Scene cleanup retires displays/controllers before data, loader, providers and Host. Repeated opens coalesce; a subsequent close revokes a not-yet-started open. Pending frame operations are serialized through Host completion.

The scene uses the existing optional Spine API, including setSkins and plays, without new SDK exports. Its explicit 16-segment player budget admits the exposed 0.1-second step at rate 2. The sequence-controller ceiling grows from 64 to the existing combined 256-target ceiling; both enforcement sites and exact admission/refusal/reuse tests change. Per-controller limits remain unchanged. Derived maximum work per coordinator boundary is 262,144 events and 11,228,160 search iterations, not measured timing or an acceptable frame budget. See the [sequence contract](../../knowledge-base/en/docs/sequence-controls.md).

## Replacing one character and one spark

**Swap fifth character and first spark** loads a second Spine setup with two pages and a second sequence clip and image. The two objects are adjacent in painter order. The application stages a single replacement subtree and its GPU uploads while the original pair remains visible. This operation uses RESET. The new character starts in its default outfit and animation and the spark starts at frame zero. The other 19 characters and 199 sparks keep their state and event history.

Cancel or close during loading to discard both candidates. A failed asset request also leaves the original pair visible. A later click can retry. After CPU publication the scene owns the new pair. If presentation then fails, the caller receives `PAIR_POSTCOMMIT_FAILED` with its cause. The next **Step** draws the active pair on a ready device. **Reload** rebuilds the scene from its original contents.

Windows Edge 158 checked WebGL2 and WebGPU with 242 original pixel witnesses per backend. Holding the alternate spark response, cancelling, and returning HTTP 503 kept the original pair. Retry changed the two intended witnesses together and preserved a neighboring character and spark. Replacing them with the originals restored the original pixels. Closing with a replacement in flight released every Spine instance, setup, group and sequence controller.

### Visible Windows measurements

Each backend used a fresh browser context, loopback HTTP and a 640 × 400 backing store. The first open was the initial navigation's automatic open; the second reused the page and fetched the content again. Each open ran 240 focused foreground steps. The last four columns report p95 milliseconds after reopening.

| Backend | First open / reopen (ms) | Animation | Capture | Render | Settle |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGL2, ANGLE D3D11 on RTX 5090 Laptop | 1993.1 / 44.7 | 0.6 | 0.2 | 1.2 | 6.3 |
| WebGPU, same PC | 394.9 / 48.7 | 0.8 | 0.3 | 0.8 | 3.4 |

Open ends after the first CPU render submission. Render captures the frame again. Settle measures the elapsed wait for host completion. These are fixed simulation steps; watching the clock advance does not measure presentation intervals, GPU execution time or a network cold start. The existing `verify.mjs` and `measure.mjs` commands below produce the full reports. [Measured phases, cleanup and source identities](pair-hardware-summary.json)

## Verification and boundaries

    node --test tests/animation-outfits.test.mjs tests/sequence-controller.test.mjs tests/sequence-controller-lifecycle.test.mjs tests/sequence-controller-integration.test.mjs
    node examples/animation-outfits/verify.mjs <absolute-playwright-index.mjs> <absolute-evidence-directory>

The collector uses default headed Edge with pinned Playwright 1.62.1, no extra launch flags, both backends, frozen input fingerprints, native RGBA and screenshots. It checks all 20 bodies/heads and 200 sequences at 242 literal initial points per backend, composite outfit pixels against an intentionally wrong default-color expectation, finite completion, independent pause/rate, exact counts, close/reload, a transport refusal, held-source cancel/late settlement and retry. It observes logical cleanup; it does not measure physical memory. The original geometric fixture supplies authored expectations, not independent certification of official Core algorithms. See [verification-summary.json](verification-summary.json) for the bounded collected result and repairs.

Broader incremental content adoption, compatible replacement of the whole scene, recovery of this pair after real device loss, full Spine features, Editor-export qualification, phone inputs and formal performance remain open. M1.2's earlier 10.3 ms versus 8 ms performance failure is not changed by this example. Full M2.4 and Issue #86 remain open. Runtime and artwork rights are separate; see [provenance](PROVENANCE.md).

## What a step costs

    node examples/animation-outfits/measure.mjs <absolute path to Playwright index.mjs> <new output directory> [software]

`measure.mjs` opens the scene in a new browser context, opens it again in the same page, and times 240 steps of 1/60 second after each. It reports each part of a step by itself: `animation` is the Engine advancing the 20 Spine instances and 200 sequence controllers; `capture` is taking the shared frame; `render` is taking it again and the Host preparing and submitting it; `settle` is the wait until the Host has nothing in flight. Without `software` it uses installed Edge with a window, as the collector does. It writes `measurement.json`.

Two runs on 16 November 2026, of the scene as it is in this change. Milliseconds; the second of the two measurements in each run.

| Where | Part | p50 | p95 | max |
| --- | --- | ---: | ---: | ---: |
| WebGPU, RTX 5090 Laptop, Chrome 156 in the Claude desktop app, pane hidden | animation | 0.5 | 1.3 | 6.7 |
| | capture | 0.2 | 0.5 | 2.8 |
| | render | 0.5 | 2.1 | 9.4 |
| | settle | 3.2 | 4.8 | 6.7 |
| WebGL2 drawn on the processor (SwiftShader), Chromium 153, Linux container | animation | 1.3 | 2.5 | 9.5 |
| | capture | 0.4 | 0.7 | 6.3 |
| | render | 5.9 | 10.8 | 20.0 |
| | settle | 45.3 | 65.3 | 73.7 |

- The first row is a graphics card; the second is not, and says nothing about one. Neither is a budget acceptance: one run each, no fixed windows, other programs running.
- In the container the scene opened in 165 ms in a new context and in 266 ms the second time. The second is not faster, because the content is fetched with `no-store` both times and only the modules are already loaded. On the graphics card it opened in 78 ms and 82 ms, with the content coming from a CDN, so those two are not comparable with the container's.
- The JavaScript heap went from 19.6 MB to 26.6 MB over the 240 steps in the container and from 27.9 MB to 25.2 MB on the graphics card. These are single readings around a garbage collector, not a trend.
- After closing, no Spine instance and no sequence controller was left.

Not run in those November 16 measurements: WebGL2 on the graphics card. In the hidden pane the WebGL2 Host's wait for the GPU ended in `WEBGL2_SYNC_TIMEOUT`, so that row needs a visible window. Not run either: installed Edge, a phone, a cold HTTP cache against a real server, and content build invalidation.
