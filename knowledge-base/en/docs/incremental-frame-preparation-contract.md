# Incremental ordered frame preparation contract

English | [简体中文](../../Cns/docs/incremental-frame-preparation-contract.md)

M1.2 reduces repeated capture and preparation work and combines adjacent compatible 2D draws. The display tree, committed resource bindings and existing submission owner remain authoritative. This contract defines the candidate's behavior and limits; it does not report measured speed or complete M1 acceptance.

## Public behavior and immutable values

Existing Engine capture/render methods, frame profiles, Host options, package entries and resource ownership remain unchanged. Ordinary frames keep their structural input contract; textured submission still requires a genuine registered frame. No new public cache token, completion hook or bypass is introduced. Canvas retains its existing capabilities, and scene rendering uses the optimization only in its established 2D overlay stage.

A successful capture creates a fresh frame and commands array, with the existing frame-ID rules. Present image and geometry tables are also newly constructed; an ordinary empty image table may remain absent. Safe immutable matrix, rectangle and clip records may be shared. Subrecord identity stability is not an API guarantee: eviction or an ineligible key may produce equal new records. Mutable authoring state and upload arrays never become saved-frame backing storage.

Saved frames retain their values after later transforms, reparenting, binding replacement, resource release and producer disposal, under the existing replay contract. Each new capture revalidates current resource entitlement and constructs current first-use image and geometry tables. It assigns indexes from those tables, even when a matrix or clip record is reused. Host preparation resolves actual image and geometry identities from the submitted frame; an old ordinal or index never identifies a cross-frame resource.

## Capture, revisions and traversal

Private revisions record successful structural, transform, appearance/clip, content and binding changes. Validation and caller-field reads retain their original order before publication. Equality checks preserve signed zero. Committed Bitmap, Mesh/NineSlice and TextField changes use their existing authoritative writers; an uncommitted text request does not replace the displayed content. Counter restart invalidates both profile entries before reusing small revision values.

A node/profile candidate must match those revisions and the complete current parent matrix, alpha and ordered clip context. Parent references, child lists and subtrees are not cached. Traversal still reads the authoritative tree in painter order. Textured capture performs its full all-tree admission pass on every call, including hidden and suppressed descendants: node/edge identity, lifecycle, Engine affinity, authored contributions, triangle occurrences and unique geometry storage remain checked. This pass requires O(nodes) traversal; total work also depends on authored geometry and clips. Capture is not promised to run in O(changed nodes). Ordinary capture keeps its own established traversal and refusal order.

A node/profile with two consecutive replacement misses and no intervening hit temporarily retains a scalar-only admission probe. Initial cold capture still seeds the next static hit. Continuing changes reuse this bounded metadata instead of rebuilding payload storage. A successful stable probe observation permits a cold rebuild; only a complete result published after the normal final open check can supply a later hit. The probe is charged to the same owner and retains no clip graph. Its revision and parent-number hint does not authorize reuse: complete keys still decide every hit, including clip-only changes. Failed capture, eviction, revision restart and termination discard probes through the same lifetime path.

Visible contributions check their exact leases, live Texture authority and TextField Scope at the original positions. A cache hit cannot turn a released lease or closing Scope into valid input. Original distinctions between geometry checking, opacity suppression, emission charging and resource reads remain intact. The legacy rectangle-only collector remains uncached.

Only complete candidates become reusable after the collector's final Engine-open check. Failed or partial candidates are discarded. Later Engine frame-ID, freeze and registration steps remain separate; failure there need not roll back valid disposable derived values and cannot grant a frame identity. Node termination invalidates its entries, and genuine Stage termination clears its cache. The ordinary disposed-Stage behavior remains compatible, without opening a new cache after termination.

## Bounded CPU retention

| Owner | Combined limit | Retained scope |
| --- | ---: | --- |
| Genuine Engine Stage, ordinary and textured capture together | 65,536 entries and 16,777,216 logical bytes | Recent derived numeric records or scalar probes per node/profile, including pending candidates |
| WebGPU Host, geometry and packing together | 4,096 entries and 16,777,216 logical bytes | Complete keys, successful private results and stage costs, or resource-free numeric probes |
| WebGPU Host, extra batch concatenation | 8,388,608 bytes | Reserved and accepted concatenation backing storage |

Both entry and byte limits apply. Cache metadata has a 256-byte base per entry, with one additional 8-byte capture replacement marker; retained records, arrays and typed payloads receive explicit logical charges. Records cost 32 bytes plus 8 per field; arrays cost 24 bytes plus 8 per element; typed backing uses its actual byte length. A capture probe retains 408 logical bytes; a minimal complete capture entry with one matrix retains 616. Capture retention deduplicates identity within an entry. Host geometry and packing own separate copies and receive separate charges, even when their source records share an identity; aliases within one stage are counted once. The measured charge of an unchanged owned stage is retained without recursively rescanning it. Host keys that retain immutable image or geometry identities also charge their retained data. Capture entries hold neither those resources nor leases, Textures, Scopes, frames or strong references back to display nodes. Weak node indexes do not keep detached nodes alive; empty weak-index bookkeeping is not a physical heap bound.

An oversized or unavailable cache falls back to the original computation. Capacity pressure may evict older results. Optional cache allocation failure does not add a public refusal; required snapshot, geometry, packing and upload-copy failures retain their original behavior. Host close and terminal failure clear preparation retention. These logical allowances are separate from GPU residence, submission charges, caller-retained snapshots and other temporary allocations. They do not establish a process-memory or garbage-collection bound.

## Preparation equivalence and charging

Host lifecycle/reentry checks and ordinary input copying or textured frame admission precede reuse. A command ordinal and profile select a bounded candidate slot, but equality requires the complete numerical and identity key: backing dimensions, pixel ratio, preparation settings, command kind and attributes, transforms, ordered clips, crop, opacity/color, and current image/geometry identity. Numerical comparison uses Object.is semantics, including +0 versus −0. Resource equality is exact identity, not equal pixels or a content hash. Current command and projection-view indexes are rebound after a hit.

Continuously changing candidates stop retaining geometry and packing results after two replacement misses without an accepted hit. A bounded numeric probe reuses its existing number storage and holds no image, geometry or stage payload. Geometry and packing within one preparation call count as one observation. Only successful stage publication confirms an observation; a superseded or failed observation cannot rearm the cache. A later stable numeric observation permits fresh cold computation, never a cache hit. Exact current resource identities and the complete key remain necessary for reuse. A sequence-length change discards the probe and suppresses retention for that slot. The probe costs 256 + 72 + 24 + 8 × N logical bytes for N numbers, within the same Host limits.

Geometry reuse follows the original command stages. Rectangle packing is cached as a complete original consecutive rectangle run, preserving the order in which all represented positions, orientation checks, fees and payload allocations are processed. Splitting a run cannot create additional budget. Image and mesh packing remain at their original command positions. Failed computations are not cached.

A successful stage records its logical costs. A hit replays that stage's complete prepared-vertex, predicate and tuple-comparison charges only if every applicable remaining allowance fits. Replay is atomic: any insufficient dimension selects the original computation at that position, without a partial debit, so the original operation determines the first refusal and cause. Source-triangle admission and all frame-wide projection, upload, pending, device, readback and serial checks still run. Suppressed coverage, Float32 collapse and fewer native draws do not create new logical refunds.

Profile-specific precedence remains unchanged. Ordinary submission and ordinary scene overlays retain their original packing-before-pending/readback ordering. Textured and combined submission retain storage admission before payload packing, copying and uniform creation. Required per-submission copies remain at those positions; cached typed payloads are never passed directly to queue callbacks.

## Adjacent batches and submission retirement

Batch planning occurs after the original logical admission, packing and uniform allocations. It preserves logical-command provenance and painter order. Sampled draws merge only when adjacent and compatible within the same submission stage: pipeline/kind, current image view and crop, opacity, ordered clips and the stage's sampling, blend and color interpretation must agree. Image and mesh pipelines remain separate. Compatible consecutive rectangle ranges can merge in their existing buffer, retaining per-vertex color and opacity.

A–B–A stays in that order. Material/clip changes, empty image or mesh contributions and the scene-to-overlay boundary interrupt merging. Unsupported states retain their existing refusal. No new material, blend profile, texture page or global texture sorting is implied.

Each logical unit first meets its original upload and device limits. Optional concatenation then respects the device buffer limit and available scratch, splitting only at original logical draw boundaries. If capacity or the optional concatenation allocation/copy is unavailable, submission uses unmerged payloads. This fallback does not catch original packing/uniform failures or native GPU errors. Original logical costs remain charged even when execution uses fewer buffers, bindings, uniforms or draws.

Scratch is reserved before allocation and includes both active candidates and accepted submissions. An unaccepted plan releases its reservation; an accepted plan retains it until the existing submission retirement completes. Queue fences alone do not release it. Error scopes, readback/map obligations, cleanup success, mixed buffer-return order, loss and unsafe close retain the M1.1 ownership rules. Failed cleanup keeps the original ledger responsibility. A cache hit never certifies old GPU buffer contents: each submission still uploads its own payload.

## Acceptance boundary

The complete prior SDK is the independent recomputation reference for equivalent operation sequences. The implementation adds no public debug switch or permanent second rendering authority. Correctness, actual native operation reduction, browser pixels, timing, memory observations and delivery status require separate evidence. There is no dirty-percentage threshold or promised speedup.

The M1 static, sparse and fully dirty workloads and their declared desktop conditions remain acceptance targets. Fully dirty comparison includes update work in the continuous span from update start through render return; the median of five per-run p95 values must remain within the declared 1.10 candidate/baseline ratio. A diagnostic Host elapsed span can bound preparation only within that diagnostic window; an excessive upper bound does not establish excessive preparation time. Unmeasured GPU time, physical memory, unavailable devices and incomplete environment conditions remain explicit. Full Spine support, texture pages, backend recovery and the remaining M1 packages retain their separate scope and acceptance.

## Reproducing the desktop comparison

Use Windows x64, Node **26.7.0**, **PowerShell 7**, the installed **Playwright 1.62.1** package (including matching playwright-core), and Microsoft Edge. The verifier uses headed Edge through the msedge channel, with its default launch and no caller-added flags. Invoke Node without extra execution arguments; nonempty NODE_OPTIONS or NODE_PATH, in any letter case, are refused. Keep AC power connected, the tested browser in the foreground, and the power scheme, browser executable and recorded device/driver inventory stable across paired trials. Do not run suites concurrently.

The fixed rendering surface is CSS/viewport/backing **1024 × 768**, with explicit Host pixel ratio **1**. The actual window DPR is preserved, must be finite and positive, must stay exactly stable per frame, and must match exactly across each pair. It is not rounded to one. Earlier profile-1 INCOMPLETE reports remain unchanged.

Choose two distinct, normally installed SDK roots: the complete M1.1 reference and the M1.2 candidate for this acceptance recipe. Set these PowerShell variables to absolute paths: $baselineRoot and $candidateRoot; an existing empty private $records directory for new raw build records; a new $prepared directory for snapshots; an existing private $runs directory for new mode outputs; $playwright for the installed package directory; and $powershell for the PowerShell 7 executable. Output directories must be outside the SDK roots, verifier checkout and installed runtime owners. Start from the checkout containing the reviewed verifier; all per-mode outputs must be new.

Build the two roots normally and save each raw log and exit record. This step runs the existing build command; the later preparation action does not build anything. Run the following in PowerShell 7 with Node 26.7.0 selected:

~~~powershell
foreach ($role in 'baseline','candidate') {
  $sdkRoot = if ($role -eq 'baseline') { $baselineRoot } else { $candidateRoot }
  Push-Location $sdkRoot
  try { node tools/build.mjs *> (Join-Path $records "$role-build.log"); $buildCode = $LASTEXITCODE }
  finally { Pop-Location }
  [IO.File]::WriteAllText((Join-Path $records "$role-build.exit"), [string]$buildCode, [Text.UTF8Encoding]::new($false))
  if ($buildCode -ne 0) { throw "Build failed: $role" }
}
node tools/verify-incremental-rendering.mjs --prepare --baseline $baselineRoot --candidate $candidateRoot --baseline-build-log (Join-Path $records 'baseline-build.log') --baseline-build-exit (Join-Path $records 'baseline-build.exit') --candidate-build-log (Join-Path $records 'candidate-build.log') --candidate-build-exit (Join-Path $records 'candidate-build.exit') --output $prepared
if ($LASTEXITCODE -ne 0) { throw 'Preparation incomplete; inspect its private receipt' }
~~~

The seven-pair preparation action creates baseline and candidate copies plus recipe.json. It copies only the bounded core SDK sources, emissions, configuration/manifests and installed original robust-predicates 3.0.3 files; three package aliases point inside each copy. It verifies complete membership, exact bytes and link targets. Each manifest has the built-sdk role and FROZEN_BUILT_SDK_SNAPSHOT status. Baseline/candidate are comparison positions, not merge or review claims. The supplied successful log/exit records are bound to these bytes; the tool does not observe the earlier build runtime or independently prove source-to-emission equivalence. It performs no install, Git operation or SDK execution.

Run the five modes serially against the same snapshots and exact generated recipe. Stop on any failure or incomplete result; preserve that output and use a fresh directory for a later attempt. Changing tool, profile or SDK bytes requires a new preparation/recipe.

~~~powershell
foreach ($mode in 'preflight','correctness','counts','diagnostic','timing') {
  node tools/verify-incremental-rendering.mjs --baseline (Join-Path $prepared 'baseline') --candidate (Join-Path $prepared 'candidate') --recipe (Join-Path $prepared 'recipe.json') --playwright $playwright --powershell $powershell --mode $mode --output (Join-Path $runs $mode)
  if ($LASTEXITCODE -ne 0) { throw "Mode did not complete successfully: $mode" }
}
~~~

| Mode | Fixed scope and duration |
| --- | --- |
| preflight | One fresh browser trial per SDK, 12 frames and two RGBA readbacks each. Checks runnable, nonempty, paired byte-equal output and cleanup; no timing acceptance. |
| correctness | Three states per SDK, 994 frames and seven full RGBA readbacks per SDK; exact paired pixels and public values/fees. |
| counts | Separate native method wrappers, four frames per state: 12 per SDK. Records actual forwarded operations and checks the fixed 991 baseline / 155 candidate draw prediction; wrappers are restored. |
| diagnostic | Six fresh trials, each 30 seconds warm-up plus 60 seconds measurement: at least nine minutes plus setup/cleanup. Capture and Host spans are retained separately. |
| timing | Thirty fresh trials: five pairs for each of three states, each 30 seconds warm-up plus 60 seconds measurement. At least 45 minutes plus setup/cleanup; fixed alternating pair order and rotated states. |

For diagnostic and timing trials, recipe schema 4 first submits exactly two initial-state fresh frames without advancing or awaiting between them, then waits once for retirement before the full warm-up. These initialization records and the first four warm attempts are retained separately. The two-frame in-flight limit, deadlines, complete measurement windows and thresholds stay unchanged. An initialization or later backpressure refusal stops the trial; there is no retry, skipped frame or substituted sample. Earlier schema-3 failures remain incomplete. Passing a later initialized-start window cannot establish that cold startup was the sole cause of those failures.

Timing retains every bounded raw sample, uses nearest-rank quantiles and compares the medians of five per-trial p95 values. The full-dirty ratio uses the continuous span from update start through render return and must be at most 1.10. Host diagnostic elapsed time is only an upper bound on preparation within that separate window. GPU time remains UNMEASURED and overall D60 remains INCOMPLETE even when measured CPU targets pass. Results cover the actual recorded browser/adapter and workload; they do not establish acceptance on unavailable physical devices, physical memory/VRAM retirement, continuous foreground visibility or unobstructed scanout.

Keep preparation.json, manifests, recipe, comparison.json, trial report.json, raw samples/RGBA and OS observation records in private local evidence. They can contain machine paths, process IDs, command lines and device/driver details. Share the tool-generated public-summary.json projection instead. Partial/failed runs and cleanup limits remain evidence, and copying or a successful preflight cannot be presented as formal timing PASS.
