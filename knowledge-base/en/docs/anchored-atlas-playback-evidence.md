# Anchored atlas playback — evidence

English | [简体中文](../../Cns/docs/锚点图集播放证据.md)

Engineering preview 0.53.0 · S107 / V058 · 2026-10-15. Source, original execution, independent acceptance and delivery have separate scopes. The example composes existing public APIs; Engine exports, runtime code, dependencies and host protocol are unchanged.

## Current Source and CPU/code

Four adopted files contain the session, page controller, HTML and independent public-consumer fixture. Before execution, Source review corrected a fixture's assumed target-space bounds overload: Bitmap.getBounds() measures its own local content; Stage.getBounds() measures the transformed child. The preserved first draft is a fixture correction, not a product defect or missing-API RED.

Setup/build and 16 focused public consumers were independently accepted under review 61137 bytes / 43167f47e50c0191f0fddabde646c0a8be180be8fbdb13fa46de2010553515d6. Its earlier HTML/code cutoff remains historical. After the narrow HTML import-map repair, fresh review 31002 bytes / b6ac19f6542e2346b2c6e94beda53ee9caea74029142a1f94f30c22e3af771da accepted all 9 current code phases, Core 3147/3147 and retained Spine Source 160/160, with zero failures/cancellations/skips. These are distinct scopes, not an added test total or complete Spine acceptance.

The consumers qualify genuine Engine/Scope/lease/Bitmap identities, literal atlas/crops, both hand-calculated presets, clock/pause relations, exact same-live saved-frame identity through a recording host, stable Close Promise, pending initialization/preparation and original failure/cleanup behavior. Cancellation before Texture creation has one attempted load and zero Texture disposals; Close waits for every actually started task.

## Preserved browser failure and bounded successor

The first browser attempt timed out waiting for Canvas readiness and accepted no pixels; its metadata preflight passed 16 cases. The original failure remains bound by review 32407 bytes / 998779f6198c458fe76b5370c4e0803257625b09ec001db995e95bfef81ca686. Source diagnosis identified one missing private import-map alias used by both host paths. The reviewed HTML successor adds that alias. The original timeout and the later successful page/pixel result retain separate cutoffs.

Desktop Edge 155.0.4283.45 Canvas/WebGPU acceptance covers 14 main readbacks and 32256 channels with zero mismatches at tolerance 0; the separate fresh Canvas control contributes 0 main cases.

Independent review 64966 bytes / cbb5df5f7487aa2d34564aef01185218fa1d83a49e1a4504518c753a9a0fe533, verdict PASS_ACTUAL_NATIVE_DOM_ONLY, accepts only the saved bounded desktop DOM/page result. Its separate metadata preflight passed 16 cases with no pixel credit. The separate Canvas C1 has 2 additional raw readbacks, 48 differing pixels and 96 channels, with 0 main credit. All 3 sessions closed safely with one load/one disposal each, closed Scopes/Bitmap/Texture, 64 outer tickets and 0 pending work; original actor snapshots were byte-stable before/after, and the later reviewer separately authenticated 368 graph files and 175 runtime files. All 16 original pixel files are raw RGBA; no PNG was saved.

The Source-bound schedule has 12 captures and 2 saved replays across the two backends. The browser result has no observed capture counter or host-input object ledger: those numbers are schedule facts, not instrumented capture/identity counts. The CPU recording-host identity proof is separate. Browser qualification adds no physical GPU, hardware/device, font, phone/native SDK, performance/energy or GC acceptance.

## Publication and delivery cutoff

The preceding 0.52 package was delivered through PR #40 to Main d1debacedcbc068dc4c3b26fa9876181e23c4864, tree 33adba3e1ea744091adc623ea1398102e54a9b43. Its independent delivery review is 48911 bytes / e2ce215c1610db2aa4749e5ad96103d28eab6a50ca64dfdfa31b6ac30891bd20. Earlier PENDING cutoffs stay historical in their original records and exact raw README archives.

Current public Source/bilingual review, normal full prepush, mandatory hooks and new 0.53 commit/push/PR/Main remain PENDING; no remote CI PASS is claimed. Full Spine R020/V020, migration R008/V006, complete V002/V004/V005, EUI/layout, advanced3D/AI, fonts, devices and performance remain OPEN or unverified. See the [shared record](../../evidence/anchored-atlas-playback-verification.json) and [remaining plan](anchored-atlas-playback-implementation-plan.md).

## Publication prerequisite successor — 2026-10-15

The prior 32-file Source/bilingual review passed with no open findings (40942 bytes / 409672e5e3b4b9337fb83c6b3bc13ea8c5713fd6fc784e0cbff76a019b3bdaa8). The first normal prepush then stopped at the knowledge-base validator: exit 1, no timeout, empty stderr; records209, Markdown339, links2789, references1460 and issues8. All eight issues were links to the new paired example guides, which were outside the validator's seven literal repository reading targets. Later prepush phases were not attempted. The independent original-failure qualification is 15909 bytes / 7f8b52748919e545bb1e6a41f79739698be3919e32e8eedebe5e5e2b6662c476.

The bounded successor registers those two exact guide files and changes the count comment to nine; path/containment and other guards remain intact. The same process now explicitly emits UTF-8 diagnostics. The separate default-output label encoding observation does not remove or create any of the eight real link issues; original saved text log bytes remain unchanged; those logs are not an original raw binary pipe capture. File input and raw hashing policy are unchanged.

The current public scope is 33 files (22 tracked modifications and 11 additions). This Source-only repair and a fresh normal full prepush remain pending independent review/execution; mandatory hooks and new delivery are also pending. Accepted Core 3147/3147, Spine Source 160/160 and Native 14 main readbacks / 32256 channels retain their prior scopes and identities. The original R1 public record and failed prepush are not overwritten.
