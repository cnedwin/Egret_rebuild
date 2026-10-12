# ByteWriter BW1 evidence

English | [简体中文](../../Cns/docs/字节写入器BW1证据.md)

This record binds the first-party BW1 implementation to independently saved actual results. The implementation is original work from Egret specifications and ECMAScript intrinsics under Apache-2.0, with no added product dependency. Byte order reuses the existing ByteReader type. Curation reads saved facts and performs no new product execution.

## Engineering preview 0.40.0 — owned ByteWriter

**S093 / V044. Finite CPU, type and assigned boundary results accepted; final publication gates and delivery remain PENDING.** ByteWriter supplies fixed-capacity strict binary appends, native IEEE floating conversion and independent snapshots of the committed prefix, reusing the original ByteOrder and Scope lifetime.

The build and 37/37 public/regression cases passed: 8 BW groups, 23 ByteReader cases and 6 Scope cases. Separately, 2/2 process-isolated fault test files passed. BW has 24 internal observations and 22 controlled fault hits; these are not extra test cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/16 diagnostics, with 57 exact located/code inventory entries. Strict-type gate and boundary guard exited 0; assigned boundary controls passed 17/17.

Retained complete boundary suite: PENDING_AT_SOURCE_CURATION. This is separate from the finite assigned controls and the pending final complete prepush.

Recorded 0.39.0 delivery successor: textured scene composition was merged through [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26), with Main `ac490f90b7467164e461112a9f572a3269107c02` and tree `c137666681de663360a9bc153d85e6e71f48bd42` read back locally and remotely. The mandatory push hook completed with exit code 0. Remote statuses and check runs were both zero; remote CI PASS is not claimed. Earlier pending cutoffs and the first failed prepush remain historical records.

Read the [contract](byte-writer-bw1-contract.md) and [evidence](byte-writer-bw1-evidence.md). This original first-party utility increment establishes no file format, legacy ByteArray compatibility, full Spine, migration, native SDK or device/performance acceptance. Historical failures, preparation cutoffs and open work remain visible.


## Actual RED and GREEN boundaries

The old SDK completed genuine Engine, Scope and literal ByteReader setup and cleanup before the BW1_PUBLIC_WRITER_REQUIRED missing-API assertion. The original positive type consumer produced 4 missing-export diagnostics and 13 secondary unresolved-type assertion diagnostics; these are not the new negative inventory. The earlier ENOENT remains a separately classified preparation failure.

The separate fault file restores ambient descriptors before arming captured faithful native wrappers: two construction allocations, two snapshot failures, before/after faults for all eight scalar setters, and bulk-copy before/after faults. Actual observations cover exact thrown identity, length and the whole committed prefix, retry literals, ambient restoration and disposal. They establish no physical OOM recovery, arbitrary modified-realm isolation, reentry protection, zeroization or physical reclamation.

The initial boundary-control failure and exact test-target correction are retained in the shared record. Source review, observation collection, actual strict-type gating, boundary controls and complete prepush remain distinct stages; earlier failures are never rewritten as success.

## Reproduction and open work

Run the following in an environment with the installed project toolchain. These are reproduction instructions, not another execution or new acceptance record by this document.

```sh
node tools/build.mjs
node --test --test-reporter=tap tests/byte-writer.test.mjs tests/byte-reader.test.mjs tests/cancellation-scope.test.mjs
node --test --test-reporter=tap tests/byte-writer-allocation.test.mjs tests/byte-reader-allocation.test.mjs
node tools/check-types.mjs
node tools/check-boundaries.mjs
node --test --test-reporter=tap tests/byte-writer-boundaries.test.mjs
node tools/prepush.mjs
```

Exact current source, emission, type inventory and witness identities are in the [shared verification record](../../evidence/byte-writer-bw1-verification.json). Final full gates, mandatory push and BW1 PR/Main delivery remain PENDING at this curation cutoff. Full Spine R020/V020 and migration R008/V006 remain OPEN; no new GPU/host, phone, performance or complete-product acceptance is established.
