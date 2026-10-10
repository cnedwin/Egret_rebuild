# B1 scene Host verification evidence

[简体中文](b1-host-evidence.zh-CN.md) · [Contract](b1-host-contract.en.md)

The corrected default Node test route passed the complete focused schedule in `tests/webgpu-mesh-host.test.mjs`: **13 cases passed, zero failed, none unattempted**, using Node.js **v24.19.0** and emitted modules with mock GPU objects. This default focused successor, FOCUSED_8, uses the ordinary process-isolated Node test route rather than `--test-isolation=none`. Saved observations record zero exit status, direct process close, both output streams ending, all thirteen attempts joined to their receipts and stable selected source identities. Its verified test revision is 85,984 bytes/`9ac77c5090c1739602fd09c69f9c1a42131573dc02d3f349b73dbc95b7b3eba9`.

The same verified combined source set then passed `tools/verify.mjs`: build, boundary checks over 282 source/build/declaration files, type checks and **901/901 tests**, with zero failures, cancellations, skips or todos. The actual full run includes the complete thirteen-case Host schedule. Saved supervision records show complete stdout/stderr, zero exit, the owned Job reaching active-zero and closing, and stable selected source identities. This establishes the selected verification result, not universal operating-system ancestry or resource behavior.

## Preserved history

The earlier FOCUSED_6 passed thirteen cases using `--test-isolation=none`, bound to the 84,270-byte test/`b4e02cdc48bf59c2cd706a8e7fedb2290736f98d50a9215a1b228b0d4180d2bb`. That remains a valid historical focused result. A later default whole-repository attempt produced **900/901 passes, one failure**: its default Node24.19 worker-argument guard failed before any of the thirteen direct drivers launched. It was a harness/setup failure, not thirteen failed driver cases. After the parent guard was corrected, FOCUSED_8 and the full 901/901 successor above passed. The old isolation-none result is not substituted for these default-route results.

| Cases | Observed scope |
| --- | --- |
| S01 | Node `SourceTextModule` construction without linking or evaluation plus a bounded first-party import scan, including nine exact division-expression witnesses. |
| N01–N05 | Core/Canvas loading and ordinary WebGPU import, startup, render, readback and close without loading the B1 scene modules. |
| P01–P02 | Explicit B1 with cached and cold loading; the cold positive loads unchanged emitted target bytes. Scene/UI mock behavior includes H01–H18. |
| R01 | Synthetic loader rejection and startup failure propagation. |
| C01–C04 | Stop/close while loading settles successfully or rejects; cancelled startup performs no new GPU work. |

H01–H18 are named assertions within the positive cases, covering authentic admission, identity sharing, combined upload/readback budgets, two-pass order, reentrant getters, attempted-write fences, quarantine and accounting. They are not eighteen extra case schedules. Rejected unsafe cleanup is an expected tested outcome in designated fault cases; passing does not mean every mock host closes safely.

The revision also exercises two technical regressions: shared CPU image projection remains outside the GPU-only dependency classification, and repeated B1 `start()` preserves its pending promise after stop/close until startup settles.

## Source identity

| Subject | Bytes | SHA-256 |
| --- | ---: | --- |
| `packages/engine/web/WebGPUHost.ts` | 66,888 | `ecc99075132e2bd546d50da8d96ff096ba8e6ca33630d192bec66500ccca3bc8` |
| `packages/engine/web/b1.ts` | 2,366 | `9b3e02b47e9328a106783f2ea88baca2066f5bf66b6c66113dd5952872c833b7` |
| Verified default/full test | 85,984 | `9ac77c5090c1739602fd09c69f9c1a42131573dc02d3f349b73dbc95b7b3eba9` |
| Historical FOCUSED_6 test | 84,270 | `b4e02cdc48bf59c2cd706a8e7fedb2290736f98d50a9215a1b228b0d4180d2bb` |
| Current formatting-only test successor | 85,983 | `0680a9c10f290e6104b150fbd85df805d1e03882292ce8745d22f817e1ee6783` |

After the completed runs, exactly the test's final LF was removed; all preceding 85,983 bytes, driver source and executable statements are identical. The current formatting-only successor has no new test rerun claim. The default 13-case/full 901-test receipts remain bound to the 85,984-byte verified revision, and the historical FOCUSED_6 receipt retains its original binding.

The [local compact evidence index](../evidence/b1-host-mock-evidence.json) contains the reconciled actual source/run projection. GitHub publication remains pending.

## Open verification

Mock shader/pipeline creation does not compile WGSL. Mock readback validates ordering, sizes and ownership rather than rendered pixels. Fresh-process loading traces apply to the selected Node runtime and source set; they do not prove browser bundling, prefetch, network size, hostile-loader security or complete operating-system ancestry. Native shader/pixel, target-device and performance validation remain unrun/unverified. Fonts, DragonBones and complete migration have no acceptance from these runs. B1 remains an internal API without package-barrel exposure.
