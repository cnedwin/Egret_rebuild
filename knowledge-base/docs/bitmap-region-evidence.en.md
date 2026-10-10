# Bitmap region: bounded CPU evidence

[简体中文](bitmap-region-evidence.zh-CN.md) · [Region contract](bitmap-region-contract.en.md) · [Compact record](../evidence/bitmap-region-cpu.json)

The first-party `Bitmap.sourceRect` implementation passed the existing build, **113/113 focused CPU checks** and the selected type checks. Independent review of the three changed sources and saved CPU observations recorded **PASS_SOURCE_AND_SAVED_CPU_EVIDENCE**, with no actionable P1/P2 findings in that scope. This is a local **0.19.0** engineering increment; package **0.0.0** and protocol **1.0** remain unchanged.

## Observed checks

The build exited zero and its project-format check covered **21 definitions**. The focused Node.js **v24.19.0** run used `--test-isolation=none`; 113 checks passed with zero failures, cancellations, skips or todos. The schedule includes B01–B23 in `tests/bitmap-region.test.mjs` and the existing texture, saved-frame, integration, type-shape, oracle and CPU sequence suites.

The type command exited zero, admitted the positive fixture and checked **76 expected negative diagnostics**: **43 core + 5 web + 28 project**. The new member's negative fixtures produced TS2322 for string width, TS2322 for null reset and TS2540 for assigning readonly x. Expected negative diagnostics are successful refusal evidence, not compiler defects.

These observations exercise absolute crop containment, immutable owned metadata, shared lease/crop mutation protection, read/error ordering, reset and same-lease replacement, saved-crop capture, accounting and ownership. A full-atlas CPU sample can select a crop without acquiring or releasing an asset on every sample. This does not establish visible animated output.

## Preserved RED history

Before implementation, the fixed region suite registered **23 failing groups**. B01 reached a real capture mismatch: it requested x=2/width=1 but captured the original x=0/width=6. The absent-setter and cleanup consequences do **not** establish 23 independently reached behavioral counterexamples. The positive type fixture separately produced **3 TS2339** missing-member diagnostics. Both failures were retained before the passing successor.

## Bound source identities

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| `packages/runtime/src/Bitmap.ts` | 7397 | `21b209ee6809e8645e2920b3680eac0eb91f481edf9ad07f961b638624ebfffe` |
| `packages/runtime/src/frameCapture.ts` | 5066 | `23ebe914a57f165ecd210fa31d28ae4681508b684ec68895d3bbfb58a81f9fa1` |
| `packages/runtime/src/imageFrameBudget.ts` | 1968 | `591700c47a2ec78a5a2e11b9b380386e6d79fd0bc09a5d37c0a637bbc4d5b19e` |

Capture changes its saved crop to the authenticated Bitmap selection; the runtime image budget's algorithm is unchanged and its authority comment was updated. The saved commands own their crop and immutable image values, while Bitmap keeps a borrowed lease. Source/code review, saved CPU execution and browser pixels are separate evidence classes. Document integration did not rerun the checks.

This evidence curation contains no successor complete prepush; a fresh prepush must pass before any push. Visible region-sequence browser validation remains **UNRUN** at this checkpoint. Prior texture collection and bounded B1 browser results retain their own case/source scope; neither proves an animated Bitmap sequence. No clock/player, decoder, skeleton, Native SDK, phone/performance, full A2 or complete migration is accepted. R008/V006 and V003 retain their wider obligations.
