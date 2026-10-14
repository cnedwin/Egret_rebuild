# Bitmap buttons — verification

English | [简体中文](../../Cns/docs/位图按钮核验.md)

This record separates specified behavior, independent Source review, actual local checks, browser acceptance and delivery. Engineering preview 0.54.0 remains a bounded development increment.

## Accepted local code

The complete normal run finished at 2026-10-14 22:01:04 UTC on fixed Node 24.19.0 and TypeScript/native 7.0.2. All nine phases completed: build, package boundaries, SpriteSheet boundaries, sequence playback boundaries, browser PNG boundaries, strict types, browser PNG types, core tests and Spine F2 source checks.

Core passed 3218/3218; retained Spine Source passed 160/160, each with zero failures, cancellations, skips or TODOs. Earlier focused public consumers passed 163/163: 65 new Button checks plus all 98 retained input regressions. These overlapping checks are not added. The separate and integrated strict Button lanes passed positive 0 and matched all 19 complete unsuppressed negative tuples, including the forbidden default-root import. Current inputs cover 25 adopted code files, 5 product files and 10 real JS/declaration emissions; strict reproducibility binds 80 inputs, 63 declarations and 57 standard libraries.

The independent complete-code review is 78069 bytes, SHA256 edc12594ca2de0c65c891bf6b6f8e4ee718c28207ccf0ec3a3116fc252527b53. This identifies a privately retained review and does not distribute private logs or personal paths.

## Counterexamples and repairs

The initial genuine API baseline failed only at the missing factory assertion, after real Engine/resource/input/display setup and cleanup. Independent Source review found the distinction between foreign genuine Scope and forged Scope; the repaired admission preserves ENGINE_MISMATCH. Fixture review also corrected nested listener accounting and added mutation during the complete activate route to qualify the Button-specific final repick.

Actual complete-check attempts preserved three finite support findings: missing optional emitted alias permission, one missing private declaration sender, and three stale sequence-checker entry identities. Reviewed exact successors retained all other policy code and old raw evidence. No wildcard exemption or failed-result relabeling was used. The final complete run accepts the repaired current code only.

## Accepted browser execution and delivery cutoff

Independent review accepted the bounded desktop Edge 155.0.4283.45 run with default headless launch and no custom flags. Canvas and WebGPU each supplied 19 full 24×24 DPR-1 readbacks: 38 main readbacks and 87552 compared channels, tolerance 0 and no differences. All 40 raw RGBA originals and 40 metadata packets were qualified; no PNG originals were saved. The separate fresh Canvas control has 2 additional readbacks and main credit 0. Omitting down left actual red pixels; the deliberately wrong blue expectation differed by 48 pixels and 96 channels.

N9 replayed the same saved-up handle and red pixels while the live control remained disabled gray; WebGPU reported frameId 1, matching N1. Three sessions retired safely, each with one atlas load and one provider disposal, closed controls/input/Scopes/Stage/Texture, the original released-lease refusal and the cached close Promise. All 19 original WebGPU readbacks and 161 outer operation tickets fulfilled, with no pending retirement work. Those operation tickets are not captures. The run recorded 252 allowed requests and zero page errors. Original before/after stability for 376 graph and 175 runtime rows remains distinct from the reviewer's later current-file authentication.

The accepted Native review is 82186 bytes, SHA256 ebae093f16cfc4c4bcc5bb4a1de3fc1ccab383b3e95cf86c7f2e9a38569ef529. No capture counter or Host input-object ledger was recorded. Window blur handling is an explicit DOM Event boundary, not hardware or OS-focus evidence. The initial publication draft's Native-PENDING cutoff remains historical; final public bilingual review, normal prepush, mandatory hooks and new Git delivery remain PENDING.

The work establishes no physical GPU identity, phones, fonts/IME, native SDK, performance/energy/GC, complete EUI, advanced 3D, full Spine R020/V020 or migration R008/V006 acceptance. Remote CI success is not inferred. Read the [contract](bitmap-button-contract.md) and [remaining plan](bitmap-button-implementation-plan.md).
