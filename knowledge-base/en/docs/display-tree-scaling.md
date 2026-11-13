# Display-tree scaling

English | [简体中文](../../Cns/docs/显示树扩展性.md)

Engineering preview **0.27.2** is a bounded CPU display-tree bugfix. It changes attachment validation and direct child-list access without adding public exports or dependencies. Packages remain private `0.0.0`; protocol pins remain `1.0`. S080 and V031 record its separate acceptance status.

## Source diagnosis and baseline

At source base `d58e624942ec485d66003ec9bb48e5edab6a6374`, `addChild` preflight and final validation traverse the receiver's existing descendants, then commit binding across that tree again. Repeatedly appending one child to an already bound flat container therefore revisits its older siblings, producing quadratic cumulative traversal. `numChildren` and `getChildAt` copy the child-list snapshot; detach searches with `indexOf` even for the last child.

A stock built-source local Node.js 24.19.0 observation recorded these elapsed milliseconds. Hardware is unidentified and this single observation is not a comparative benchmark.

| Children | Construction | Capture | Tail cleanup |
| --- | --- | --- | --- |
| 2,000 | 199.83 ms | 2.49 ms | 1.08 ms |
| 4,000 | 976.23 ms | 2.32 ms | 2.46 ms |
| 8,000 | 4,315.14 ms | 12.87 ms | 13.25 ms |

A **separate** 8,000-child subclass probe observed 32,012,000 usability-hook calls, exactly `N(N+3)/2`. The timing and hook-count scopes are separate and are not added. No successor speedup is projected from this baseline.

## Attachment boundary

For an already bound receiver, attachment checks the receiver and the **entire incoming subtree**, retaining the receiver's own bindable callback after its initial usability check. It does not rerun usability hooks on unrelated descendants already under that receiver. An open-engine check precedes the receiver bindable callback, preserving `ENGINE_CLOSED` priority if an incoming hook closes the Engine. This narrower callback boundary is intentional. An **initially unbound** receiver retains whole-tree preflight and final binding validation, including existing descendants, even if a hook binds it during preflight.

Subclass hooks may reenter and change either tree. After callback-capable preflight, attachment must re-read current engine and internal tree state, then perform callback-free liveness, Stage-root, cycle and full incoming-subtree affinity checks. Cross-engine and mismatched bindings remain refusals. Binding and internal detach/attach follow only successful final validation; refusal adds no partial binding or reparenting by the operation. Hook side effects retain their own callback scope. Disposal and cleanup ownership follow the existing lifecycle contract.

## Cost limits

| Operation | Bounded change and retained cost |
| --- | --- |
| Append to an already bound receiver | Avoid revisiting unrelated old siblings; incoming-subtree and ancestor cycle checks still cost work. |
| `numChildren` / `getChildAt` | Direct constant-time count/index access without cloning the list. |
| Detach the last child | Direct last-element check and removal. |
| Remove an arbitrary middle child | Search and array shifting remain linear in sibling count. |
| Append to an initially unbound tree | Whole-tree discovery/binding may still rescan existing descendants. |

There is no global O(N) guarantee for tree construction, arbitrary reparenting, disposal, traversal or rendering. This increment does not establish performance leadership.

## Verification and provenance

The focused pre-fix regression snapshot has **8 tests: 7 passed, 1 failed**, exposing the unrelated existing-sibling hook. Actual successor checks/probe, complete current verification, independent finite source/bilingual review, mandatory prepush and remote delivery remain **PENDING** at this preparation cutoff. The shared [verification record](../../evidence/display-tree-scaling-verification.json) binds results to their source and fixture identities; overlapping scopes must not be summed. Earlier checkpoints retain their original cutoffs.

The actual corrected-source successor build and targeted display/scaling/cancellation/textured-capture harness passed **71/71**, including **9 scaling tests**. The closing-hook regression first failed with `OBJECT_DISPOSED` instead of `ENGINE_CLOSED`; the added open-engine guard repaired that priority. C06's exact 65,536-node/65,537-node-overflow subtest passed in **501.1715 ms**; its enclosing C06 group took **644.454 ms**, within the complete targeted harness's **1,946.6674 ms**. These nested durations and test scopes overlap and are not added. They are local fixture observations, not target-device performance acceptance.

An earlier whole-core run passed **2,227/2,227**, before the ninth closing-hook test and corrected guard; it is intermediate evidence, not final-source verification. Final complete current verification/prepush and affected browser regression gates remain **PENDING**, as do independent finite review and delivery. The baseline failures and preparation cutoff above remain preserved.

The change uses AI-assisted independent first-party diagnosis, specifications, implementation and separately authored fixtures under Apache-2.0. The implementation retains the existing dependency set. Browser, device, GPU, phone, performance leadership, complete Spine and full migration acceptance are excluded.

## Observed corrected workload and desktop successor

The same fixed local stock-node probe recorded corrected construction times of **4.37, 14.13 and 28.63 ms** for 2,000, 4,000 and 8,000 children. A separate corrected subclass probe recorded **16,000 hooks** for 8,000 children. These are single local observations with unrecorded hardware; no speedup ratio or production performance is inferred. The shared record projects actual observed fields only, excluding retained private baseline-estimate counters.

Fresh default Edge Canvas, WebGPU and B1 desktop regression commands exited **0**. WebGPU reported zero failed required fixtures and zero unexpected errors; B1 covered **7 positive frames, 5 counterexamples and 11 submitted frames**, with cooperative browser/context/server cleanup observed. These are fixed regression scopes; they do not validate new text/fonts, phone performance or complete 3D. Textured/sequence regressions, final complete prepush, bilingual meaning review and remote delivery remain pending at this successor cutoff.

The remaining desktop successor completed on 2026-10-11: textured WebGPU passed **11 calibration cases, 10 held-out cases and 16 control windows**; opaque SequencePlayer passed **8 captures / 1,024 channel comparisons**. These counts belong to different verification scopes and are not added. All five affected existing browser gates have now passed on the corrected display source; final complete prepush and remote delivery remain separate.

## Complete final-source verification

On 2026-10-11, the complete mandatory prepush command passed with **2,228/2,228 core tests**, **52/52 publication tests**, complete build/type/boundary checks, closed headless ownership and zero pending timers. Knowledge-base validation reported **153 records, 237 Markdown files and zero issues**. All three reviewed source/test identities remained unchanged. Independent finite source, English/Chinese meaning and saved-evidence review reported zero open findings; its original cutoff remains separate. This factual documentation successor changes no product code. The Git push hook must still repeat the mandatory checks; remote delivery and full product acceptance are not inferred.

## Fixed 2D workloads

`node tools/bench-2d.mjs` runs fixed 2D workloads in Node against the built SDK, with no browser and no GPU. It times the CPU work of a frame before anything reaches the graphics API, in the order a host performs it: capturing the display list into a shared frame record, then preparing that record as clipped geometry, vertex rows and draw batches. It also times edits to a container among 1,000, 4,000 and 16,000 siblings, and the creation, attachment, property access, event dispatch and disposal of display objects. `--json` prints the records as JSON and `--quick` runs a shorter pass.

One run on the development machine, before any of the changes this tool was written to measure, recorded these figures. They describe that machine and that run; they are not acceptance thresholds.

| Workload | Capture | Clipped geometry | Vertex rows | Draw batches | Draws |
| --- | --- | --- | --- | --- | --- |
| 1,000 filled rectangles | 3.80 ms | 12.11 ms | 5.25 ms | 1.51 ms | 1 |
| 5,000 filled rectangles | 13.11 ms | 25.17 ms | 23.17 ms | 2.73 ms | 1 |
| 20,000 filled rectangles | 81.85 ms | 83.08 ms | 69.62 ms | 9.26 ms | 1 |
| 5,000 bitmaps showing 100 frames of one atlas | 23.69 ms | 19.43 ms | 18.62 ms | 0.65 ms | 5,000 |

Capture cost the same whether every rectangle moved or none did. 5,000 bitmaps showing 200 frames of one atlas were refused with `FRAME_IMAGE_BUDGET`. `addChildAt(child, 0)` cost about 0.5 ms among 1,000 siblings, 1.7 ms among 4,000 and 7.7 ms among 16,000, while `addChild`, `setChildIndex` and `removeChild` stayed between 1 and 5 microseconds.

## First round of 2D cost reductions

Four changes reduce the CPU cost measured above. None changes a public interface, a frame record, a vertex, a uniform block, a logical charge, a refusal or the order of refusals.

- **Indexed insertion.** `addChildAt` used to walk the receiver's whole tree on every call. A bound receiver whose whole tree one insertion has walked, and left bound to that Engine, is now remembered; later insertions into it walk only the incoming tree, because every record the repeated walk would produce is valid and carries that Engine. A node enters a remembered tree only through `addChild` or `addChildAt`, both of which bind the whole incoming tree to the receiver's Engine; detaching or disposing a node takes it out of the tree, and affinity does not change. The private UI commit and prepared-subtree list replacements drop the memory of every tree that contains their target, so the next insertion walks that receiver in full again. The incoming tree and the source direct edges are captured and validated on every call, as the [insertion contract](container-add-child-at-contract.md) requires, and a receiver without an Engine is still walked every time. The insertion still copies the receiver's child list twice, because it prepares a complete replacement list before it publishes, so the remaining cost grows with the number of siblings at a far smaller rate.
- **Frame capture.** The shared capture walked the tree twice: once to admit every node, once to emit the commands of the nodes that are drawn. It now walks once. A refusal of visible content is held until the rest of the tree has been admitted, because an admission refusal anywhere outranks it, so the reported refusal is the same. Materials and regions are found by object and by number before any text key is built, and draws under one clip chain share one frozen clip list.
- **Clipped geometry.** The corners of a draw are created once and moved to backing space where they are, instead of being copied at each step. A step that leaves a polygon unchanged returns it instead of a copy. The predicates, comparisons and their charges are the same calls in the same order.
- **Vertex rows.** The rows of one frame are written straight into one allocation, and its uniform blocks into another; each draw's `data` and `uniform` are views of its own range, with the same length and bytes as the separate arrays they replace.

`tests/shared-frame-golden.test.mjs` holds digests of the captured frame, the clipped geometry with its logical charges, the vertex rows and the draw batches of fixed scenes, recorded before these changes; the changed paths reproduce them. The same comparison over 5,952 further generated frames, run once against a build of the earlier code, found no difference. `tests/display-container-add-child-at-verified.test.mjs` runs random sequences of tree edits twice, once remembering and once walking every time, and compares every result, order and affinity.

The same tool on the same machine, earlier code first:

| Workload | Capture | Clipped geometry | Vertex rows | Draw batches |
| --- | --- | --- | --- | --- |
| 5,000 filled rectangles, all moving | 13.87 → 6.37 ms | 22.98 → 9.03 ms | 19.28 → 4.94 ms | 2.30 → 1.35 ms |
| 20,000 filled rectangles, all moving | 74.81 → 27.92 ms | 93.52 → 31.13 ms | 59.70 → 16.44 ms | 7.98 → 6.60 ms |
| 5,000 bitmaps showing 100 frames of one atlas | 17.99 → 8.83 ms | 24.54 → 10.70 ms | 24.85 → 6.93 ms | 0.69 → 0.36 ms |

| `addChildAt(new child, 0)` among | Before | After |
| --- | --- | --- |
| 1,000 siblings | 552.5 µs | 48.9 µs |
| 4,000 siblings | 1,579.3 µs | 120.8 µs |
| 16,000 siblings | 7,381.9 µs | 499.1 µs |

These figures describe one machine and one pair of runs; they are not acceptance thresholds. Two limits recorded above were not changed by that round: bitmaps that show different frames of one atlas are still separate draws, and a frame admitted at most 128 distinct regions. The region bound has since been raised to 4,096 in the [shared render profile](shared-render-profile-contract.md), and the separate draws are gone: the next section.

## Batching across regions

Consecutive draws of one page with one material now share one batch whatever their regions and opacities. A draw's region and opacity used to be in its 128-byte uniform block, so every bitmap that showed another frame of an atlas, or had another opacity, was a draw of its own. Each vertex now carries the place of its region in a table and the opacity of its draw, and the table of the frame's regions is uploaded once; the [shared render profile](shared-render-profile-contract.md) states both layouts. A batch still ends at another page, material or kind of draw, at a barrier, and where the next region is in another window of 341 regions of the table. No public interface, frame record or refusal changed. The vertex grew from 44 to 52 bytes, and a frame is charged 48 bytes for each of its regions.

The same tool on the same machine, earlier code first:

| Workload | Draws |
| --- | --- |
| 5,000 bitmaps showing 100 frames of one atlas | 5,000 → 1 |
| 5,000 bitmaps showing 200 frames of one atlas | 5,000 → 1 |
| 5,000 filled rectangles | 1 → 1 |

The step that forms the batches took 0.4 ms before and 1.0 ms after for the two atlas workloads, because the rows of a merged batch are copied into one array; the other steps were within the variation between runs.

What the output is was checked in three ways. `tests/shared-frame-golden.test.mjs` shows that the captured frame, the clipped geometry and the first eleven values of every vertex row are what they were. `tests/shared-batching.test.mjs` states which draws share a batch and what the new values hold. And 46 scenes were drawn by the build before this change and by the build with it, through both Hosts, in a headless Chromium with software rendering, and the bytes read back were compared: all 92 pairs are identical. The scenes are the 26 two-dimensional cases of `tools/shared-rendering/native-cases.json` and twenty generated ones with 120 to 1,500 sprites of one or two atlases, with trimmed and turned regions, fractional opacities, four sampling policies, four blends, clip rectangles, solid rectangles, meshes and nine-slices, and up to 804 regions in one frame. In the generated scenes of one atlas and one material the WebGL2 draw calls of a frame fell from about 390 to about 60; what remains is the clip rectangles of those scenes, each of which is a barrier. This comparison establishes equal pixels under one software renderer. It is not a run on a hardware GPU, and the saved native evidence of `tools/shared-rendering` was not collected again.

## Batching across pages

Consecutive draws now share one batch whatever their pages, up to eight pages in a batch. The page used to be part of what a batch has in common, so bitmaps that took two atlases in turn were each a draw of their own. The row of a region in the region table now names the region's page and that page's size, and the block of a batch names the page each of eight texture units holds; the [shared render profile](shared-render-profile-contract.md) states both. A batch of one page is drawn as before, by a pipeline with one page texture. A batch of several pages is drawn by a second pipeline with eight. A batch still ends at another material or kind of draw, at a barrier, at a ninth page, and where the next region is in another window of the table. No public interface, frame record, vertex, logical charge or refusal changed. A Host now requires eight texture units of its device or context.

The graphics-device tool below, in a quick pass in a headless Chromium with software rendering, earlier code first:

| Workload | Draws | Submit, WebGPU | Submit, WebGL2 |
| --- | --- | --- | --- |
| 5,000 bitmaps taking 8 atlases in turn, all moving | 5,001 → 2 | 79.33 → 10.99 ms | 37.52 → 15.32 ms |

The time that software renderer itself spent on the frame rose, in WebGPU from 278 to 432 ms. It runs the fragment stage on the CPU, and the second pipeline selects among eight textures at every read of a page. Frames of one page are drawn by the first pipeline, and their time did not change: 148 ms before and 158 ms after for 5,000 bitmaps of one atlas. What a hardware GPU does with the second pipeline has not been measured.

Seven scenes of 3 to 20 pages of different sizes, with 160 to 600 sprites, three sampling policies, page-domain materials and four blends, were drawn by the build before this change and by the build with it, through both Hosts, in the same software renderer. All 14 pairs of readbacks are identical, as are the 92 pairs of the earlier comparison. In those seven scenes the WebGL2 draw calls of a frame fell from between 135 and 570 to between 2 and 69. This establishes equal pixels between two builds under one software renderer. It is not a run on a hardware GPU, and it does not compare the two Hosts with each other: in that renderer their readbacks of the generated scenes differ in one to three pixels of a hundred, where the two rasterizers interpolate differently, before and after this change.

## Records kept between frames

A frame used to be captured and prepared in full, whatever had changed since the frame before. Each display node now keeps the records the capture derived from it, and each Host keeps the prepared draws of its last frame. The [shared render profile](shared-render-profile-contract.md#kept-records) states what is kept and when it is used again. A frame made with kept records is the frame made without them: every value, charge and refusal. No public interface changed.

`tools/bench-2d.mjs` on the development machine. "Kept" is the same frame again; for capture it is a frame in which nothing moved, against one in which everything did:

| Workload | Stage | Every frame anew | Kept |
| --- | --- | --- | --- |
| 5,000 filled rectangles | Capture | 6.93 ms | 3.53 ms |
| | Clipped geometry | 7.71 ms | 0.87 ms |
| | Vertex rows | 4.64 ms | 2.96 ms |
| 20,000 filled rectangles | Capture | 37.75 ms | 22.98 ms |
| | Clipped geometry | 39.98 ms | 3.20 ms |
| | Vertex rows | 15.42 ms | 11.10 ms |
| 5,000 bitmaps showing 200 frames of one atlas | Clipped geometry | 6.98 ms | 1.00 ms |
| | Vertex rows | 3.49 ms | 1.86 ms |

In another run, of 240 frames of 5,000 bitmaps, a tenth of them moving in each frame, the geometry took 1.8 ms against 6.0 ms and the rows 1.9 ms against 3.7 ms. With all of them moving, where nothing kept can be used, a Host that keeps draws took about 4 percent longer over the geometry than one that keeps none.

What was still done for every frame at that point: every node is counted, checked and charged, and every resource read; the rows of every draw are copied into the frame's buffer, batches are joined, and everything is uploaded. [Packed records and batches kept between frames](#packed-records-and-batches-kept-between-frames) states what became of the rows and the batches.

Two tests capture and prepare every frame both ways and require equal results, refusals included, for stated changes and for scenes changed at random: 640 captured frames and more than 250 prepared ones. Fifty-seven scenes of the pixel comparisons were each drawn three times by one Host, through both Hosts, in a headless Chromium with software rendering: once with some nodes moved, faded or hidden, and twice as they are. The third frame of all 114 runs is identical to the single frame of the build before this change. This is not a run on a hardware GPU.

## Packed records and batches kept between frames

A Host that kept the geometry and the rows of a draw still copied those rows into the frame's buffer for every frame, wrote a 128-byte block for every draw, compared every draw with the one before it, and copied all rows once more to join them into batches. Now a draw at rest is packed once, into a record the Host keeps, and a batch is joined once: after that, only the rows of the draws that changed are written, into the array the Host keeps for the batch. Draws next to each other with one material, page and kind of draw share one block. The [shared render profile](shared-render-profile-contract.md#kept-records) states the conditions. A frame is the same frame, batch for batch and row for row. No public interface changed.

`tools/bench-2d.mjs` on the development machine, the median of 40 frames, a Host that keeps records before this change and after it:

| Workload | Stage | Before | After |
| --- | --- | --- | --- |
| 5,000 filled rectangles, the same frame again | Vertex rows | 1.56 ms | 0.27 ms |
| | Draw batches | 0.82 ms | 0.03 ms |
| 20,000 filled rectangles, the same frame again | Vertex rows | 9.67 ms | 1.34 ms |
| | Draw batches | 3.63 ms | 0.12 ms |
| 5,000 bitmaps showing 100 frames of one atlas, the same frame again | Vertex rows | 1.62 ms | 0.29 ms |
| | Draw batches | 0.84 ms | 0.04 ms |
| The same bitmaps, one of them moving in every frame | Geometry, rows and batches | 2.83 ms | 0.90 ms |
| The same bitmaps, a tenth of them moving in every frame | Geometry, rows and batches | 5.62 ms | 3.20 ms |

The clipped geometry of a kept draw takes what it took. In another run, of 300 frames of the same bitmaps all moving, where no record can be given again, the rows took about a fifth less, because neighbouring draws share a block, and the batches took the same.

A kept bitmap counts 1,136 bytes for its geometry and rows, 240 for its packed record and 328 in a kept batch, by the logical measure of the profile. The bound on what a Host keeps is therefore 48 MiB, up from 32 MiB, and a frame the largest limits admit still keeps less.

What is still done for every frame: every node is counted, checked and charged, and every resource read, which is now most of the time of a frame in which nothing moved; every row of every batch is uploaded, changed or not. A draw whose number of rows changes, such as a sprite crossing the edge of the screen, has its batch joined anew for that frame.

The test that prepares every frame both ways now packs and batches it both ways as well, and requires the same batches with the same rows, for stated changes and for scenes changed at random, some of them with little room for joined rows. A frame whose upload is staged reads its rows after later frames are prepared, so it is given batches of its own; one test for each Host draws a changed scene between the staging and the upload and requires the staged frame to upload the rows of its own scene. The 57 scenes of the pixel comparisons were drawn through both Hosts in a headless Chromium with software rendering in two ways. Drawn twice, then changed, then twice more as they are, the last frame of all 114 runs is identical to the single frame of the build before this change. Drawn three times and then changed, the changed frame of all 114 runs is identical to the changed scene drawn alone by the build before this change. This is not a run on a hardware GPU.

## Fixed 2D workloads on a graphics device

`node tools/bench-2d-gpu.mjs` draws seven fixed workloads through the shared WebGPU Host and the shared WebGL2 Host in a browser, at 1280 by 720. `tools/bench-2d.mjs` stops where the graphics API begins; this tool measures from there. It prints an address. Opening that address in a browser on the machine to be measured runs the workloads, and the tool prints the table when the page finishes. With `--playwright <installed module>` the tool opens the browser itself: `--channel msedge` names an installed browser, and the window is visible unless `--headless` is given, because a hidden window may not use the graphics card. `--quick` runs a shorter pass, `--json` prints the whole report, and `--backends` and `--only` narrow the run.

Each workload is drawn first as fast as the Host finishes frames, then once per display frame. The table states, per frame:

- **draws**: the draw calls the Host issued, the final copy to the canvas included.
- **capture**: the Engine turning the display list into a frame record.
- **submit**: the Host preparing, uploading and encoding that record.
- **settle**: from the end of submit until the Host reports the frame finished.
- **gpu**: the time the device spent in the render passes of the frame.
- **interval** and **p95**: the median and the 95th percentile of the time between display frames, and **refused**: the frames the Host refused because two were still pending.

The device time comes from WebGPU timestamp queries, which need the `timestamp-query` feature, and from `EXT_disjoint_timer_query_webgl2`. Browsers round both to about 0.1 ms, and a browser that offers neither leaves the column empty. To read them, the tool lends the WebGPU Host a device whose command encoders it has wrapped, and wraps the WebGL2 context the Host obtains. The Hosts are unchanged, and the CPU figures include that wrapping.

No run on a hardware GPU is recorded here. A quick pass in a headless Chromium with software rendering, on two shared cores, completed all fourteen rows. Its device times describe the software renderer and are not kept. Its draw counts and Host CPU times are the starting point of the WebGPU work:

| Workload | Draws | Submit, WebGPU | Submit, WebGL2 |
| --- | --- | --- | --- |
| 5,000 bitmaps of one atlas, all moving | 2 | 24.03 ms | 17.35 ms |
| 5,000 bitmaps of one atlas, none moving | 2 | 11.19 ms | 16.98 ms |
| 5,000 bitmaps taking 8 atlases in turn, all moving | 5,001 | 79.33 ms | 37.52 ms |
| 20,000 bitmaps of one atlas, all moving | 2 | 77.01 ms | 60.39 ms |

Bitmaps that take their atlases in turn are not batched, and a frame in which nothing moved is captured and prepared again in full.
