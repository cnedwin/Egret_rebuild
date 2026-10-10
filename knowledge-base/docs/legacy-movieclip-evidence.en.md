# Legacy MovieClip CPU conversion evidence

[简体中文](legacy-movieclip-evidence.zh-CN.md) · [Contract](legacy-movieclip-contract.en.md) · [Compact record](../evidence/legacy-movieclip-focused.json)

The converter is a first-party internal CPU component. Actual compilation and focused tests establish the bounded contract described here; they do not establish an image/player pipeline or complete migration.

## Subjects and observed tests

| Subject | Bytes | SHA-256 |
| --- | ---: | --- |
| packages/project/src/legacy-movieclip-plan.ts | 17420 | a6cd539126753989fb0f79cdfa0bf674d83d62e8c713ad173c3aca0e8d4117bb |
| tests/legacy-movieclip-plan.test.mjs | 27671 | 59a695124ce26d051eb4d2d165b7285f2825c1345bcf13cfb3038cd36b717933 |

The fixed environment used Node v24.19.0 and the installed TypeScript 7.0.2 compiler chain. Focused argv was `--test --test-isolation=none --test-reporter=tap tests/legacy-movieclip-plan.test.mjs`.

| Stage | Existing build exit | Focus exit | Tests | Pass | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| Compilable missing-behavior port (RED) | 0 | 1 | 28 | 0 | 28 |
| Strict implementation (GREEN) | 0 | 0 | 28 | 28 | 0 |

Each stage ran its build and focus once, without retries or changing the fixed tests. Both focused runs had zero skipped, cancelled or todo tests. All 28 RED test bodies reached the emitted converter and failed on its deliberately unimplemented behavior; they were not missing-module/setup failures. Later table assertions and fault-injection branches in those bodies were not all reached during RED. GREEN executed those groups successfully; neither stage proves exhaustive branch coverage.

The GREEN checks include literal crop/offset/logical-span results; real sequence-factory re-admission and sampling; defaults and fractional rates; the distinct 0.3/0.30000000000000004 time boundaries; positive subnormal retention and overflow refusal; primitive/Unicode/strict JSON handling; parser-once and foreign-fault handling with restoration; portable paths; own prototype-looking names and JSON pointer escaping; invalid-before-unsupported precedence; selected-scope limits; frame/tick/dictionary budget pairs; and fresh frozen output. The absorbed-increment branch has no admitted test witness under the chosen tick budget. Test durations are not a device-performance benchmark.

Direct observed processes closed with both stdout/stderr EOF, without timeout, stream overflow or observer/spawn errors. Before/after records bound the source/test/observer and seven runtime/compiler inputs; the five selected focused emit identities were unchanged. This is finite direct-process/recorded-source evidence, without a claim of complete import closure, OS process ancestry or retirement of every compiler descendant.

Independent specification/quality review completed with status `SPEC_QUALITY_REVIEW_COMPLETE_NO_ACTIONABLE_P1_P2` and zero findings within the source and recorded focused scope. That review did not rerun the product. Source review and actual focused observation remain distinct evidence types.

## Reference provenance and acknowledgements

The reviewed reference snapshot's package manifest declares **Egret 5.4.1**. These finite identities anchor the historical declaration observations; the declaration does not prove equivalence to every file in an official release tag or that this was the latest version:

| Reference | Bytes | SHA-256 |
| --- | ---: | --- |
| MovieClipDataFactory.ts | 6034 | 0145d604476b633d115c5ded167cc8227a301f98b0b58d1ab4ab4358fe7b2b3c |
| MovieClipData.ts | 9149 | 82a778d66ec2da8327f4947b3bfd0cb758b49c36085f0863ab6bb4b06db9c41c |
| Package manifest | 16207 | fb434c743952d6fa389733a44c56bc691dde11eb7782e8d21d3d0f87ede99431 |

Public reference links are [MovieClipDataFactory](https://raw.githubusercontent.com/egret-labs/egret-core/master/src/extension/game/display/MovieClipDataFactory.ts) and [MovieClipData](https://raw.githubusercontent.com/egret-labs/egret-core/master/src/extension/game/display/MovieClipData.ts). They are mutable master references; a remote commit or byte equivalence to the selected snapshot was not established. Reference source copyright credit belongs to Egret Technology and contributors; the reviewed files retain their original three-condition BSD-style headers. Applicable original copyright/license notices accompany any redistribution of those reference sources.

That source study established named mc/global res access, repeated duration spanning the declared number of logical frames, and separate display offsets versus atlas crop values. FrameLabel/player clock and dispatch semantics were outside the finite source study. The converter has its own strict numeric and authored-hold timing contract, with independently authored fixtures.

## Remaining validation

Default-worker and whole-repository regression for this subject remain UNRUN. Atlas reads/decoding, actual exporter/project coverage, renderer offset placement, labels/events/blank-frame playback, native pixels, device performance and complete migration remain UNRUN. Separate renderer evidence cannot certify this converter's image/playback path. The API remains internal, and its acceptance fields stay unverified even after focused CPU success.
