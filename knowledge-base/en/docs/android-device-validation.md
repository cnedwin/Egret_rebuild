# Android component validation

English | [简体中文](../../Cns/docs/android-device-validation.md)

2026-11-06 · One SM-F966U1, Android 17, Chrome 156.0.8078.79 · Component evidence, full M4 remains OPEN

The current rendering, UI, paragraph and animation examples were exercised on one USB-connected Android phone. The run retained 21 existing browser targets and used separately owned targets with exact URL/backend binding. Compiled SDK inputs matched main `081b98ef81154730a87bdf38decddc153ced786b`; the equipment-font correction is identified separately below. Hardware DPR was 2.625. Authored Host ratios and paragraph density are separate controls.

Follow-up native single/multiline keyboard observations, cancellation repair and the responsive form are recorded in [Android native editing](android-native-text-editing.md); they do not rewrite the component results on this page.

## Results and comparison domains

| Scenario | Observed scope | Result |
| --- | --- | --- |
| Startup | Existing exact-target UI startup plus contributor's independent corrected binding | Both WebGL2 and WebGPU reach ready. Earlier last-match collector regression claims were withdrawn; historical Chrome 155/Intent conditions are not reproduced by this Chrome 156 profile. |
| Readonly paragraphs/fonts | Latin, Arabic and CJK; wrapping, line height, alignment, line limits, density; independent article/list font generations; failed/pending/superseded preparation | 22 finite scenario assertions per backend. Article changes while independently committed list pixels remain unchanged. |
| UI | Frozen literal pixels, anchors, measured rows, recycling, themes and lifecycle | 27 finite assertions per backend, including one terminal unbind for each entered binding. This run does not execute the mouse-hit matrix as a touch matrix. |
| Sequence RESET | Pending cancellation, paused time-zero CPU publication, old image before Host submit, resume markers, version retirement and retained replay | 25 finite assertions per backend; literal readbacks and four compositor crops distinguish CPU publication from submitted image. |
| Spine RESET/recovery | Original geometry, independent sibling, nonzero player state, four controlled native losses at running/precommit/owned/postcommit boundaries | 23 WebGL2 / 24 WebGPU assertions. Current CPU player state and consumed events survive replay; stale-generation publication/submission refuses. |
| Shared effects | Literal rectangle/mask/linear-blur oracle, clips, nesting, transforms, retained frames, staging, cancellation and recovery at authored ratios 1 and 3 | 16 assertions per backend/ratio; independent offline comparison of 48 RGBA frames has maximum channel error 1 (allowed 4). |
| Font transport faults | Target-local HTTP 503, held/cancelled request and superseded candidate | Five assertions for each of three modes on each backend; committed content and resource cleanup follow the declared outcome. These are controlled faults, not radio-loss tests. |
| Equipment with replacement fonts | Exact formerly failing state, repeated switches and virtual rows using the selected font group | Five focused assertions per backend after the example correction. Core/font budgets and font bytes are unchanged. |
| Sustained equipment UI | 1801.1 s, 60 checkpoints, 359 UI actions and 47451 passive callbacks | Completed after the example-only fix; no unexpected example errors, bounded font groups and final font/Scope/input cleanup recorded. This sparse component schedule is not the M4 mixed acceptance workload. |

Assertion counts describe the recorded finite schedules. They are not a combined acceptance score. [Machine-readable summary](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/android-device/2026-11-06.json) preserves the source identities, comparison scopes, failure records and limits.

## Equipment font correction

The first sustained attempt stopped at its first font switch after about five minutes with `ASSET_LOAD_FAILED`. A short replay reproduced the cause, `PARAGRAPH_FONT_NOT_REGISTERED`: an equipment style explicitly requested `Noto Sans CJK SC`, while the selected alternate group registered the same bundled CJK face under `Noto Sans`. The provider correctly refused the unknown family. The failure is retained rather than converted into a long-run pass.

The example now constructs each style from its captured `ParagraphFontSet.fontFamilies`. It keeps the original named CJK choice when registered and otherwise uses that group's declared fallback stack. Article and virtual-row requests capture the group before asynchronous preparation, and the stack is copied/frozen. Default/fixed-font output remains unchanged. No core renderer, provider admission, resource manager, manifest, font file, byte budget or SDK API changes are involved. Adding a duplicate CJK alias could exceed the existing 64 MiB limit during three-set overlap, so the fixture uses the already selected group.

## Cadence and timing

Six foreground Spine windows, eight seconds each across the two backends, contained 482–483 passive rAF callbacks. Median interval was 16.6 ms and p95 16.7 ms before RESET, after the reported action order and after replaying the initial frame. Engine clock/player and Host status remain unchanged during those passive windows: this example advances explicitly, so callback rate is not animation or render FPS. The reported action order also calls `stale` outside its required staged phase; its `STAGE_FIRST` refusal is recorded.

The longer, sparsely updated paragraph scene also exhibited about 41.4 ms passive intervals. A contemporaneous read-only display dump reported `renderFrameRate=24.000002` in the active device/base-display metadata and `60.000004` in the app override. These are system metadata, not a physical scan-rate measurement. Their association with rAF does not prove a RESET/renderer fault or a particular platform policy. [Android's frame-rate guidance](https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate) describes content and interaction-dependent policies; this device's dump reports `hasArrSupport=false`, so support for that particular ARR feature is not inferred.

Twenty interleaved warm completion samples per action type reported static p50/p95 45.5/51.6 ms and width-reflow p50/p95 48.8/79.3 ms. Each measurement includes public UI/cache work, capture, render/readback and example diagnostics. These end-to-end completion times are not pure rendering CPU/GPU, touch latency, or M1.2 budget results.

A separate engine-free HTML target ran passive/CSS-animation/passive phases for 90/30/90 seconds. All three had median 16.6 ms and p95 16.7 ms. It did not reproduce the paragraph page's slower callbacks; the difference remains scenario-bound and its cause is unproven.

Reported diagnostic quantiles use the upper-order index floor(n × p), capped to the sample. Brightness was not held fixed: readback changed from 64 to 46 without a brightness command. No display-power or comparative thermal qualification follows.

The sustained schedule uses one UI action every five seconds, font replacement every five minutes and density changes every two minutes, with continuous passive rAF timestamps and named thermal samples. It exercises a changing readonly UI, not a continuous 60 fps game or heavy-GPU workload. The historical performance.memory reading increased from approximately 56.8 MB to 103 MB; the follow-up below qualifies that cached, bucketized indicator. Engine allocations, example histories, collection buffers and garbage awaiting collection were not isolated, so the increase is retained without attributing a leak or declaring zero growth. USB charging and thermal sensors do not establish whole-device energy use. GPU timestamps, physical memory and display presentation timing were unavailable; no zero-leak or universal thermal claim follows.

## Device control and evidence boundaries

The local controller uses documented ADB and [CDP Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/) APIs. A dedicated DOM fixture observed an injected click, swipe, two simultaneous contacts and release, a real Samsung software-key input, keyboard appearance/dismissal, and separately labeled Unicode CDP insertion. The latter replaced the active composing text; it is not an append or native Chinese-candidate acceptance test. This fixture validates control primitives, not Egret's unfinished native editor SDK or another contributor's touch controls.

Only newly owned targets/mappings were removed, and the original USB stay-awake value was restored. A showing keyguard disappeared on a normal wake without credentials. Foldable capture selects the active default physical display by its 64-bit ID. Missing/ambiguous native security fields refuse input. Initial dozing windows with no rAF and a screenshot deadline remain incomplete observations. Two effects cases also retain a collector's redundant second-close refusal after the first successful close; no engine fix or duplicate pixel rerun is inferred from that collector error.

Successful decoded browser responses for frozen paths match their recorded files. The Spine recovery collector changes only the HTML main-script launch order to install the existing native observer before Host startup; original/executed hashes are distinct. Favicon 404s, controlled HTTP 503s and intentionally aborted requests are not successful frozen-body observations. CDP decoded bodies are not compressed wire bytes. SDK inputs, the example correction, evolving local collector revisions, cleanup counters and independent review are recorded separately.

Remaining acceptance includes the selected complete Spine Editor-export/reference corpus and license conditions, Android/iPhone hardware and human-input coverage, native editor/IME and accessibility, spontaneous driver/OS termination, mixed M4 workloads, and physical performance/energy budgets. M1.2 remains OPEN at 10.3 ms against 8 ms. Original programmatic Spine fixtures and bundled Noto/CanvasKit sources retain their existing notices.

## Cadence, memory and lifecycle follow-up — 2026-11-07

This follow-up uses the same phone and Chrome version with published application base `0d1bce5`. All selected SDK, third-party and authoring inputs were rechecked against the preceding snapshot; only PR #129's already-reviewed example source/guides differ from the original base. The fixed pixel/functional matrices and original 30-minute receipts are reused. No engine, example, dependency, budget or touch implementation changed in this follow-up. [Sanitized observations](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/android-device/2026-11-07.json) preserve each scope and source identity.

### Callback cadence

On each backend, four 20-second windows cover passive callbacks, an owned injected tap, a browser-native transform animation, and passive callbacks after cancellation. All have approximately 16.6/16.7 ms p50/p95. A separate paired probe repeats the original five warm-up actions and twenty interleaved static/reflow pairs, then samples for 60 seconds: both backends again have approximately 16.6/16.7 ms. The post-replacement sample is retained separately.

The old approximately 41.4 ms observation is **not reproduced** in these current runs. Browser processes had restarted during bootstrap, so their prior scheduling state was not preserved. The historical trigger remains unresolved; these results establish neither its cause nor a renderer fix. No refresh rate or brightness was forced. Passive callback intervals still do not measure animation FPS, Engine CPU, GPU time or physical presentation.

### Memory accounting

The old field came from `performance.memory`; it was not a live pure-JavaScript-heap curve. In the new target, it remains at 47.4 MB while precise counters change substantially, including after application close. At [Chromium commit abe0507666c40](https://chromium.googlesource.com/chromium/src/+/abe0507666c40/third_party/blink/renderer/core/timing/memory_info.cc), bucketized readings have a 20-minute cache and the underlying calculation includes V8 external memory. This corroborates the measurement limitation; the exact installed Chrome 156 source tag was not retrieved. The original 56.8→103 MB values remain in the historical receipt and cannot by themselves establish a leak.

Target-local diagnostic garbage collection separates `Runtime.getHeapUsage`'s JS-used, embedder and backing-storage fields. It runs outside timing windows. After 123 public actions with independently retained article/list font sets, JS used is approximately 4.29→5.70 MB on WebGPU and 4.37→5.65 MB on WebGL2. Private heap paths identify managed font source bytes, native font borrows and shared-face comparison bytes, alongside raster/Host residence and saved readback. Native snapshots also list a 32 MiB CanvasKit WASM backing store. These observations are separate accounting domains, not a physical-memory sum.

A second probe synchronizes both roots to the selected font generation after every replacement and performs twenty matched replacement cycles:

| Observation | WebGPU | WebGL2 |
| --- | --- | --- |
| Live font set at recorded checkpoints | 1 | 1 |
| Paragraph cache at cycles 8–20 | 32 entries; 12,178,336 image bytes | 32 entries; 12,178,336 image bytes |
| Backing storage at recorded late checkpoints | 68,263,155 bytes at cycles 8–20 | 89,271,072 bytes at cycles 18 and 20 |
| JS used after cycle 20 | 5,867,072 bytes | 5,837,976 bytes |
| Backing storage after close and diagnostic GC | 5,207,199 bytes | 5,214,060 bytes |

WebGL2 separately retains ready source pages under the existing 32 MiB/256-page Host limit; that policy is consistent with its larger backing-storage plateau and is not the paragraph-cache ledger. Final font/source/cache logical owners drain. Small JS changes also include warm compilation and growing example diagnostic histories. Network-domain disable and console-result release do not reduce the retained backing counter in the first probe. None of this proves universal zero leakage, normal-workload GC timing, physical RAM/VRAM return or full M4 memory acceptance; no Engine memory repair was justified by this bounded investigation.

### Existing-feature lifecycle and recovery

| Example | Added actual-device coverage on each backend | Recorded assertions |
| --- | --- | --- |
| Paragraph/UI | Android Home/foreground; screen sleep/wake; OS-requested viewport rotation and exact setting restoration; pending provider across background, supersession and independent-list pixels; close with pending work; actual document reload and clean second close | 17 each |
| Sequence RESET | Delayed and staged replacement across Home/foreground; cancellation retains old/sibling playback; resumed RESET publishes paused time zero and changes only the intended instance; transport/controller cleanup | 8 each |
| Spine recovery | Controlled native loss requested while the page is hidden; restore after foreground preserves nonzero player/sibling/clock/consumed events and RGBA within the original tolerance; staged cancellation; native observer/Host cleanup | WebGPU 11; WebGL2 10 |

These are finite extensions of the existing examples. The Spine request is deliberately controlled native device destruction/context loss, not spontaneous driver failure; its completion is checked after foreground. The fixed logical paragraph canvas does not qualify the complete responsive touch/hit matrix. All twelve diagnostic/lifecycle cases preserve their fresh prior target sets and mappings, close owned targets and release the phone lease.

### Retained failures and remaining qualification

Optional HTTP protocol discovery during bootstrap coincided with native Chrome SIGTRAP/PID changes. Its native cause was not isolated. The endpoint was omitted from subsequent collection; later bootstrap records kept the browser PID. No browser force-stop, reset or cache clear was used. This remains a browser-native collection failure, not an engine regression. Ordinary non-credential keyguard dismissal was requested only with explicit unlocked credential state; platform authentication remained enforced.

At final readback, the original 21 target IDs, forward/reverse mappings, rotation, refresh, stay-awake and brightness values are retained. The last observed prior component was restored and the screen returned to sleep. Exact internal tab/activity state is not certified. Raw heap snapshots, screen/account/device identifiers and native dumps remain private.

The historical cadence trigger, full mixed M4/X-MTouch/1 campaign, native editing/CJK IME/accessibility, iPhone/device matrix, complete authorized Spine corpus and unavailable physical GPU/presentation/energy rows remain open. Actual OS termination of the shared browser was not attempted because existing tabs must be preserved; physical fold/sensor and radio-network interruption are separate from programmatic rotation and controlled transport. M1.2 remains **10.3 ms against 8 ms**, OPEN.
