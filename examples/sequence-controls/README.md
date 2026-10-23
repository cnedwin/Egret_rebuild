# Sequence controls

English | [简体中文](README.zh-CN.md)

This original finite example uses the optional public `@egret/engine/animation` entry. A and B share one genuine content-built four-color texture and clip, with distinct Bitmaps, Scopes and controllers. Engine Sprites provide the title strip, white overlays and clipping. DOM buttons drive public methods; they do not draw the animated content.

Use the repository's pinned Node 26.7.0 runtime after its normal dependency setup and build. Create the ignored parent `work/sequence-controls`, then run from the repository root:

```text
node examples/sequence-controls/author.mjs --parent ABSOLUTE_REPOSITORY/work/sequence-controls
node tools/serve-example.mjs
```

The author prints a new retained run directory. Open `/examples/sequence-controls/index.html?backend=webgpu&config=/work/sequence-controls/run-XXXXXX/browser-config.json` on the loopback server, replacing the run name. Use `backend=webgl2` for WebGL2. Every run retains its project, strict recipe, source pins, candidate, receipt, manifest and artifacts. The page verifies candidate and manifest bytes and follows the genuine generation selector before loading resources through ManifestByteSource, ManifestTextureProvider and a manifest group. The metadata is synthetic Aseprite 1.3.18.6 profile input, not a qualified exporter result.

A starts at rate 1 for two total plays; B loops at rate 2. All four frames last exactly 0.25 seconds. Authored markers are zero@0, half@0.5, halfAgain@0.5 and end@1, in that order. The collector freezes the independent 11-phase table in [fixture.mjs](fixture.mjs), including pause B/set A rate 2, finite yellow completion and B's silent backward seek/resume. It compares complete recorded event envelopes and state/sample fields at every row, opaque RGBA samples for both instances, background, overlays and clip edges. It retains the initial immutable shared frame, advances both controllers, replays the saved frame and checks exact original full pixels with unchanged clocks/events. A separate listener failure and disposed-target case checks continuation and bounded diagnostics. The two-frame decimal clip also freezes five adjacent binary64 boundary literals and forward replay.

For a finite real-browser collection with installed Playwright 1.62.1 and default Edge:

```text
node examples/sequence-controls/verify.mjs --playwright ABSOLUTE_PLAYWRIGHT_PACKAGE --output NEW_ABSOLUTE_DIRECTORY_OUTSIDE_REPOSITORY
```

The collector never builds. It creates genuine content artifacts, snapshots the literal reference, exact browser import closure, corresponding source/type closure and authoring inputs before launch, then serves only those captured routes. It runs default headless Edge WebGPU and WebGL2 without extra flags, saves full unaltered RGBA and PNG frames, all records and failures, and verifies snapshot/source identities after cleanup. Native availability and failures are recorded separately. Earlier output is never overwritten.

Cleanup evidence consists of genuine Scope/Bitmap/controller retirement, released group leases checked through their public refusal, disposed texture, native source/provider current counters, host idle/close and application errors. After all controllers retire, 256 real GameClock subscriptions must fit and a 257th must refuse; all probe handles are then disposed. This observes full public slot capacity rather than inventing a coordinator counter. It does not prove physical memory collection.

Source/oracle checks: `node --test examples/sequence-controls/fixture.test.mjs`. These are source-contract and independent literal checks, not browser or SDK behavior acceptance. No browser pass is implied by this README; an actual saved collection supplies that evidence. Phone inputs, performance, complete M2.1, Spine, long-run and migration acceptance remain outside this example.
