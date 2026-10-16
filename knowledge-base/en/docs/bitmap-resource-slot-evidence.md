# Bitmap resource slot verification

English | [简体中文](../../Cns/docs/位图资源槽核验.md)

Engineering preview 0.56.0 adds recoverable Texture replacement for a persistent Bitmap. This record covers the [binding contract](bitmap-resource-slot-spec.md), deterministic public behavior, source boundaries and a bounded desktop browser composition. Overall rendering, animation and production-host readiness have separate acceptance.

## Recorded checks

| Area | Recorded result |
| --- | --- |
| Focused behavior | 115/115 checks across nine test modules; zero failures, cancellations, skips or todos |
| New strict consumers | The genuine positive consumer compiles cleanly; 30 unsuppressed negative diagnostics match exact files, lines, columns, codes and complete messages |
| Compiler inputs | Stock TypeScript 7.0.2; each new consumer uses 57 repository declarations and 57 ES2022/decorators library files, with no DOM or Node ambient types |
| Source policy | One Engine method and two erased root types; unchanged default runtime export names; no added package entry, dependency or Host protocol change |
| Refusal controls | 13 genuine isolated source-copy baselines and 13 assigned single-file refusals against the unchanged policy driver; current product-source admission is checked separately |
| Browser composition | Canvas and WebGPU ordinary runs, plus a fresh wrong-color control for each backend |
| Existing desktop Host checks | The ordinary Canvas and WebGPU verification commands passed at this source cutoff; device and performance acceptance remain separate |
| Complete local verification | All ten prototype verification phases passed; core tests 3358/3358 and separate Spine source-experiment tests 160/160, with zero failures, cancellations, skips or todos |
| Publication cutoff | This record ends before public-document acceptance and Git delivery. Final paired-document review, pre-push and hooks have no outcome recorded here; subsequent delivery is recorded in repository history. |

An earlier complete run stopped at two retained-fixture failures (3,347 passes out of 3,349 tests). One isolated copy list omitted the new strict driver; two fault fixtures retained an older Bitmap emission identity. A three-file fixture-only successor preserved assertions and fault controls; its focused replay passed 41/41. The complete result above is a separate fresh run after that repair.

The public behavior suite covers admission, latest accepted intent, failed/cancelled requests, retries, shared acquisitions, late lease delivery, manual binding changes, reentrant cleanup and intrinsic Scope/Engine closure. Custom-context runtime assembly unit checks are separate from genuine Engine behavior. Saved frames and fresh capture have distinct entitlement checks.

A targeted regression combines a successful manual binding change with subsequent lease release or Texture disposal. The changed token must win as a binding conflict. Revocation of an unchanged token retains its resource-failure semantics. Both successful and failed provider reactions, as well as direct controls, are covered. Independent source review accepted the five selected production sources and their declarations after these cases passed.

## Actual browser scope

The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md) uses a 32×24 rendering surface at device scale factor 1. It combines a persistent target, transformed parent clipping, independent bitmap Buttons, literal Texture providers and native pointer input. The recorded environment is Edge 155.0.4283.45 with Playwright 1.62.1, a fresh context per run and no additional launch flags.

| Observation | Ordinary cases | Sensitivity controls |
| --- | --- | --- |
| Backend/context count | 2: Canvas and WebGPU | 2: fresh Canvas and WebGPU |
| Checkpoints | 28, 14 per backend | 28, the same complete schedule |
| Raw RGBA frames | 30 including two startup barriers | 30 including two startup barriers |
| Compared point channels | 672 | 672 |
| Point mismatches | 0 | Exactly one intentional startup mismatch per control |

Each checkpoint compares six independently specified RGBA points at tolerance zero. The collector first saves the complete original readback, then derives point offsets in Node from those saved bytes. All 60 raw frames, 184,320 bytes, were independently authenticated. This establishes original-byte retention and the specified point checks; it does not establish correctness of every pixel. Four screenshots are ancillary. The four startup barriers and the sensitivity controls are excluded from ordinary-checkpoint counts.

The schedule exercises A retained while B loads/fails, C cancellation and ignored-cancel completion, C superseding B, late obsolete B, explicit B success, owned-binding disposal, recreation from a borrowed A, and an independent manual binding surviving slot disposal. Every run records the six exact request outcomes, four target activations and the native Button route/callback sequence. The seven provider-disposal attempts are checked as a multiset, without promising a global disposal order.

All 30 original WebGPU readback Promises fulfilled. Recorded closure has no pending provider jobs, timers or readbacks; the WebGPU Host reports safe closure with no pending frames/upload/readback bytes. Static module reachability and actual requests remain distinct: the WebGPU case requested 97 modules within its 104-module allowed closure. Its seven lazy 3D/b1 modules were not exercised. Canvas requested its 73 allowed modules.

Independent saved-result review rechecked the source snapshot, original process records, raw artifacts, request/event outcomes and strict compiler inputs. An intentionally wrong authored import-map target is rejected before browser startup and before snapshot creation. Source review, actual runtime results and repository delivery each retain their own scope.

## Reproduce and extend

Run the ordinary core verification and the example collector commands in the [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md). The collector requires a separately captured current input snapshot and an external fresh output directory. It preserves the original readbacks and refuses input drift. The source policy executes no product modules; strict checks invoke the stock compiler rather than simulating diagnostics.

This case uses literal Texture providers. Network image decoding, shared real atlases, text/font integration, multi-resource switching and animation retargeting are subsequent integration work. Mobile devices, platform SDKs, physical presentation, memory/power/thermal benchmarks, full Spine, complete UI and general 3D rendering are outside this case's acceptance. Those requirements remain open.
