# Sequence playback verification

English | [简体中文](../../Cns/docs/时钟驱动序列动画证据.md)

This record covers the 0.44.0 clock-driven sequence playback work package. Product source, build, public CPU behavior, standalone and complete strict types, source-policy controls, the CPU example and the bounded native Canvas/WebGPU opaque subset have accepted records. Internal injected-runtime fault controls, full prepush and remote delivery remain pending. These are the original recorded acceptance and pending cutoffs, not a fresh assessment of later delivery.

Reading date: 2026-10-13 (Asia/Kuala_Lumpur). Saved execution timestamps remain UTC on 2026-10-12. S097/V048 are proposed metadata identifiers; registration is pending at this draft cutoff.

Read the [contract](sequence-playback-contract.md) for API, time, ownership and failure rules. The [shared verification projection](../../evidence/sequence-playback-verification.json) binds relative source subjects and named witness byte counts/SHA-256 digests. Full original receipts, streams and reviews remain private; the projection is a summary, not the original proof or a cryptographic attestation.

## Status by lane

| Lane | Recorded result | Acceptance boundary |
| --- | --- | --- |
| Source | Accepted product and paired contract source reviews | Four product paths; three erased root types and one Engine instance method. No new standalone factory, runtime class, entry or dependency. |
| Build | Accepted actual build, exit 0 | Frozen SDK inventory: 159 source files and 318 emitted files. Inventory counts are separate from behavior coverage. |
| Public CPU | Accepted 41/41 Node cases; fail/cancelled/skipped/todo all 0 | Genuine API control plus two behavior/lifecycle files, including nested cases. The 25 source behavior families are a different inventory. |
| Strict types | Accepted actual standalone and complete retained/new driver | Positive 0; negative 27; import-negative 13. All 40 complete five-field tuples and unique markers match, including three continuation lines. The complete driver also records 16 retained PASS summaries; old diagnostic totals are not inferred. |
| Source policy | Accepted source and independent actual reviews; actor exits 0/0 | Current-root policy and 5/5 tests: one root baseline plus four paired genuine-copy mutation classes, each with restored full-copy baseline. These are source/emission controls. |
| CPU example | Accepted syntax/run exits 0/0 | Five explicit-clock command-capture observations, one atlas load and one provider disposal after awaited Engine close. No native renderer submission. |
| Native opaque subset | Accepted independent actual review | 18 submissions: 16 new captures and 2 original-frame replays, covering 576 pixels/2,304 channels with zero mismatch at tolerance 0. One owned default-Edge Windows attempt only. |
| Internal injected-runtime faults | Pending | Source-policy copies and public prototype-replacement behavior do not qualify internal fault injection or physical GPU retirement. |
| Complete gates and delivery | Pending | Complete types are separately accepted; whole integrated verification, full prepush/push hook, push, PR and 0.44.0 Main delivery remain pending. |

Recorded build/type witnesses use the pinned TypeScript 7.0.2 Windows x64 compiler owner. Other-host tuple equality, other devices and hardware performance are unverified.

## What the accepted CPU and type lanes establish

The API control (`tests/sequence-playback-api.test.mjs`), behavior tests (`tests/sequence-playback.test.mjs`) and lifecycle tests (`tests/sequence-playback-lifecycle.test.mjs`) consume the built public entry. Genuine Engine, Scope, resource lease, Bitmap, clip, existing player and clock controls precede the new factory assertion, and teardown completes. The original expected missing-factory check qualified only that absent Engine instance method before implementation. Module setup or cleanup failure cannot qualify a missing-capability refusal.

The CPU cases cover explicit once/loop time, pause gaps, dispatch order, resource identity, capacity, receiver/reentry authority, terminal states and cleanup against an original literal atlas. They do not measure physical GC, GPU retirement or throughput.

The standalone type gate (`tools/sequence-playback-types.mjs`) compares complete file/line/column/code/message tuples against the actual diagnostic table (`tests/types/sequence-playback-diagnostic-expectations.json`). Its one successful outer actor verifies child exits 0/1/1; the two expected compiler refusals are accepted only for their exact assigned diagnostics. A separate accepted actor ran the complete retained/new type driver with exit 0 and empty stderr. It retained the whole 92,201-byte old prefix and 155-byte delegation, checked the same new 40 tuples and recorded all 16 retained PASS summaries. Neither type actor accepts full prepush.

## Accepted source-policy controls

The named policy (`tools/sequence-playback-boundary.mjs`) checks source/emitted interfaces, erased type JavaScript, private assembly/export exclusions and host/timing/dependency boundaries. Its copy controls (`tests/sequence-playback-boundaries.test.mjs`) use fresh complete genuine four-package snapshots. Before each paired source/emission mutation they require a passing baseline; afterwards they require the assigned private-owner, type-runtime-value, non-Engine-type or automatic-time refusal, whole-file inverse, full snapshot equality and restored baseline. Setup or owned cleanup failure cannot count as that refusal.

The complete saved output reports five tests, five passes and zero failures, cancellations, skips or todos. Independent actual review accepts this source/emission policy scope; it confers no internal injected-runtime fault or numerical behavior acceptance. The mandatory verification driver (`tools/verify.mjs`) keeps the old boundary checker and the new policy as separate required stages; complete driver/prepush acceptance remains pending.

## Accepted native opaque subset

The paired browser verifier (`tools/sequence-playback/README.md`) uses genuine public Engine/Canvas/WebGPU entries and the original literal atlas. Each backend produced eight new captures and replayed the saved original frame once: 18 submissions total, each an 8×4 RGBA buffer. Independent review compared every channel against literal opaque rectangles and the zero exterior: 576 pixels, 2,304 channels, zero mismatch at tolerance 0. Each backend dispatched five explicit ticks, using a configured 0.5-second ceiling; capturing and replay did not advance time.

The saved attempt used Node 24.19.0, Playwright/core 1.62.1 and default headless Microsoft Edge 155.0.4283.45 (`msedge`) on Windows x64 release 10.0.26300, with no added browser flags or environment/profile overrides. WebGPU reported vendor `nvidia` and architecture `blackwell`; those are adapter metadata, not hardware-acceleration or scanout proof.

Paused/resumed held samples retained identity; saved frames/samples stayed frozen and the original image remained identical. Playback Scope close retained the caller's Bitmap and lease. Each backend loaded/disposed its provider once, and the caller retired its own resources. Replay used a distinct host and a distinct WebGPU device without resampling. Four hosts closed safely; two devices were destroyed after fulfilled safe host close and their destroyed-loss promises settled. Ordering is source-bound with saved retirement snapshots, not independent per-device timestamp traces.

Both fixtures and contexts completed; browser/server closed; pending startup/native/GPU work, upload/readback bytes, quarantine, cleanup errors and fixture diagnostics/events were zero. Exact selected inputs and compiler-owner records matched before/after; the closed Canvas/WebGPU module graph admitted only selected routes. The owned Windows Job was assigned before membership acknowledgement, retained its worker handle, reached natural active zero and closed; worker/collector/actor exited 0, with complete raw EOF, no overflow, forced termination, fallback or late work. This qualifies that owned attempt's closure, not physical memory peaks or a general process scan.

The accepted scope is this opaque once/loop/pause/replay matrix. It does not accept alpha calibration, full A2, 3D/UI/fonts, phones, other hosts, hardware performance, physical scanout, physical GPU retirement, license entitlement or remote CI. Internal injected-runtime fault controls remain pending.

## Public example

After the normal build, run `node examples/sequence-playback-headless.mjs` from the repository root. The example (`examples/sequence-playback-headless.mjs`) records these five observations:

| Observation marker | State | Playback seconds | Sample frame index |
| --- | --- | ---: | ---: |
| started-red | running | 0 | 0 |
| green | running | 0.125 | 1 |
| paused-green | paused | 0.125 | 1 |
| resumed-blue | running | 0.375 | 2 |
| completed-blue | completed | 0.5 | 2 |

The final immutable sample remains readable after close. Empty game-diagnostic checks come from assertions in the accepted unchanged example; diagnostics are not a field in its output JSON. The load/disposal observations are logical provider lifecycle counts.

## Open scope and provenance

Full Spine integration **R020/V020** and complete MovieClip migration **R008/V006** remain **OPEN**. Labels/frame events, playback rate, finite loop counts, controller seek/reset, trimmed/rotated atlases, complete UI and skeleton integration have separate contracts. No phone/native SDK, performance, physical-retirement or third-party entitlement conclusion follows.

This is first-party, AI-assisted Egret source and documentation under Apache-2.0. No third-party animation implementation is incorporated; existing dependency notices remain applicable. Prior source-only cutoffs and original records are retained. R1's prior pending cutoff remains immutable. R2 binds separately accepted policy, complete-type and native records; later internal-fault, complete-gate and delivery observations require another reviewed scope extension.
