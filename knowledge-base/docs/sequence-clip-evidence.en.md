# Sequence clip CPU verification evidence

[简体中文](sequence-clip-evidence.zh-CN.md) · [Contract](sequence-clip-contract.en.md)

The current `packages/runtime/src/sequenceClip.ts` passed a build and **25/25 focused tests**, with zero failures or skips, in `tests/sequence-clip.test.mjs`. The saved fixed-runtime Node.js run exited zero, closed its direct process and ended both output streams; selected source/test identities remained stable. These are CPU results from the actual adopted tests, not predicted counts or a performance benchmark.

The tests cover input and identity admission; own-field capture order and exact source causes; independent atlas dimensions and safe region bounds; dense-array and 1024-frame limits; finite, strictly increasing binary64 totals; once/loop boundaries and large times; explicit stop behavior; negative-zero normalization; fresh frozen samples and source mutation independence. The implementation's upper-bound search has at most eleven comparisons for 1024 frame ends; this is an algorithmic bound, not measured device latency.

Construction and sampling previously failed behavioral expectations against a compilable stub. The current focused result verifies the implemented contract without treating that earlier failure as a missing-module test.

## Combined repository verification

The verified combined source set passed `tools/verify.mjs`: build, boundary checks over 282 source/build/declaration files, type checks and **901/901 tests**. Failures, cancellations, skips and todos were all zero. Saved supervision records show zero exit, complete stdout/stderr, the owned Job reaching active-zero and closing, and stable selected source identities. This is evidence for that selected source/runtime invocation, not a universal operating-system ancestry or resource guarantee.

An earlier default repository attempt produced **900/901 passes, one failure**. The Host test's default Node24.19 worker-argument guard failed before any of its thirteen direct drivers launched. That failure is retained as history. After the guard correction, the default Host focused run passed all thirteen cases and the full successor above passed; the earlier successful isolation-none Host run is a distinct invocation, not a substitute for this repair.

## Source identity

| Subject | Bytes | SHA-256 |
| --- | ---: | --- |
| Sequence source | 8,258 | `0471afcb27d11ea35cd8a7a987656a09010a9daca54f38d330a73576c5ee0451` |
| Focused test | 28,761 | `66cf3e6333c2a9813f2cbeab4e9574f57dc0e0c0f26b2a88003a2a02583dcfc5` |

The [local compact evidence index](../evidence/sequence-clip-cpu-evidence.json) contains the reconciled actual source/run projection. GitHub publication remains pending.

## Open verification

The internal functions are not exposed through the runtime package barrel. The focused sequence run does not load real atlas images, render animation pixels, measure animation throughput or establish playback/event integration or target-device behavior; whole-repository regression success does not establish those capabilities either. Native graphics and device/performance validation remain unrun/unverified; fonts, DragonBones and complete legacy-project migration remain unverified. The first-party implementation establishes a small timing component that can later be integrated and tested with those systems.
