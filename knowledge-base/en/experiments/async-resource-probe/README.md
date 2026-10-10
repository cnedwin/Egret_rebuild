# Asynchronous Resource Contract Probe

English | [简体中文](../../../Cns/experiments/async-resource-probe/README.md)

Research prototype, dated 2026-10-08. It validates manually interleaved callback order/resource states. It runs no historical Egret source, real CPU decoding, or GPU operations and is not a complete engine implementation or production-selection acceptance.

## Actual results

- Audit-corrected new model: all 25 cases pass, in `../../evidence/async-resource-probe-results.json`.
- Old-policy counterexamples: all seven fail, in `../../evidence/async-resource-probe-legacy-red-results.json`. This expected research failure exits 1; do not report it as a new-implementation failure or pass.
- Tests preceded the failing stage, then a test-side adapter directly called the previous round's actual `ResourceModel` in `../contract-probe/model.mjs`. The adapter only maps observation interfaces, preserving the actual old owner Set, combined complete, and synchronous rebuild policies. The new model followed. The other 17 extended cases validate new-model boundaries; no claim says all 17 also ran/failed against the old model.
- JSON records actual environment/time, case results, observations, source SHA256, and limits. Initial 24/24 remains in `async-resource-probe-pre-fence-audit-results.json`, with source in `history/pre-fence-audit/`. Old-policy failure reports now point test-source references to that archive without changing digests/raw observations. There is no unified package-test command; the probe uses its own entry point.
- Independent review found defaulting fence to current epoch misrecognized old callbacks omitting device generation. The new counterexample actually produced 24 passes/1 failure, retained in `async-resource-probe-audit-red-results.json`, with pre-fix model/new tests in `history/fence-audit-red/`. Removing the default and explicitly capturing generations at normal call sites yielded 25/25.

Actual legacy counterexample: two acquires for one `scene` produce only one owner Set entry. After success, releasing the first handle deletes the resource and use through the second throws `Resource unavailable`. Two acquisitions by the same scene therefore require independent leases.

## Candidate contract

| Aspect | Model convention |
| --- | --- |
| Resource identity | Rebuilding after destruction increments resourceGeneration for the same ID. Reacquiring while a fence retains the record keeps resource identity but gets a new leaseId. |
| Retention identity | Each acquire has a separate leaseId; one owner can have multiple leases. use, task start, release/cancel verify the lease remains valid. |
| CPU task | decodeStart returns a separate taskId. CPU tasks depend on resource/task identities without deviceEpoch. completeDecode remains possible during loss; success creates decoded data only. |
| GPU task | uploadStart requires a valid lease, decoded CPU data, and available device. Tokens include resourceGeneration/taskId/deviceEpoch. Only current-task success sets resident. |
| Shared task | Leases share current decode/upload tasks. Cancellation of the initiating lease still permits commit while another exists; final release invalidates unfinished tasks. |
| Device recovery | loseDevice sets GPU lost/invalidate upload tokens, retaining CPU data/unfinished decode. restoreDevice permits new submissions without synchronous resident; uploadStart/completeUpload must run again. |
| Errors/retry | complete returning `true` means the current result was accepted, including failure. Errors record stage/code/taskId/resourceGeneration and upload deviceEpoch. OOM/ordinary upload failure never become resident; CPU data supports explicit retry, and new task IDs reject late old success. |
| Final release | Handles invalidate immediately. Retain records until a fence if current-device use remains unfinished; otherwise delete. Old release/cancel/use cannot affect reacquired leases. |
| fence | use takes an unfinished positive integer frame. fence requires explicit nonnegative integer frame/positive integer deviceEpoch; omitted epoch throws without mutation. Reject old-device fences; each device starts completed frame 0. Capture generation at submission/callback registration, never read current generation in late callbacks. |
| Device-loss boundary | Model assumes loss invalidates all old GPU allocations/use and clears old lastUse. Actual driver destruction notifications, synchronization, or deferred reclamation remain unverified. |

CPU states: `empty → decoding → decoded/decode_failed`, with explicit decode retry. GPU states: `empty/lost/upload_failed → uploading → resident/upload_failed`. Any loss moves to `lost`; restoration itself does not change it. Invalid/duplicate callbacks must not replace current data/errors.

## Interface and rerun

`acquire(id, owner)` returns a lease. `decodeStart(lease)`/`uploadStart(lease)` return tokens, sharing current ones or returning null if completed. Completion accepts `{ ok: true, data }` for decode, `{ ok: true }` for upload, or `{ ok: false, code }`. `release(lease)`/`cancel(lease)` release only that lease. `snapshot(id)` exposes lease counts, per-owner counts, both states, task identity, device generation, frame watermark, and latest error.

Use existing Node from this experiment directory without installing dependencies:

```powershell
node 'run.mjs' --legacy-red
node 'run.mjs'
```

Each command rewrites its own red/green JSON without modifying old probes. Before later test/old-model edits, retain current JSON/corresponding source, then rerun red so historical digests remain bound to source.

## Unknown boundaries

This is not a real asynchronous executor. Tests explicitly call success/failure/device events. Twenty-five cases do not establish all interleavings, complete thread safety, locking, cross-language serialization, or resource ABA safety. Lease/token fields are local lifecycle identities, not authorization credentials across trust boundaries.

CPU data is string fixtures only. Decode formats, sizes, cache budgets, compressed assets, asset versions, GPU replicas, or real OOM/driver upload failures are absent. Recovery scheduling, concurrency limits, background policies, CPU lifetime during upload, timeouts, and retry backoff are unimplemented. A resource retains the latest error only, not an error-history register.

Fences are explicitly injected; no real graphics API is used. This cannot establish hardware release timing, mobile/mini-app/native behavior, performance gains, or visual quality. Evidence supports further candidate-lifecycle refinement only.

Documentation location changed on October 10, 2026. Run the recorded experiment commands from the unchanged shared directory `knowledge-base/experiments/async-resource-probe` relative to the repository root. This reading-file relocation does not rerun the experiment or alter its original evidence.
