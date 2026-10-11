# Scalar Tween evidence

English | [简体中文](../../Cns/docs/标量补间证据.md) · [Shared evidence](../../evidence/scalar-tween-verification.json)

**Engineering preview 0.26.0**; private manifests remain **0.0.0**, tool protocol **1.0**. Build, public behavior, affected regressions and strict types passed. Production boundaries cover 399 files. Preserving failures and timeout, whole verify-r2 passed 2,131/2,131 with 23 unique boundary controls. Final public checks/GitHub delivery are **PENDING**.

## What was exercised

A real Engine creates a Scope-owned scalar Tween: finite endpoints, positive duration, built-in easing and synchronous writer. Construction/start offer no sample; later ticks offer the reached value. The [game-clock contract](game-clock-contract.md) defines explicit time, with no timer, implicit render or asynchronous callback task.

Real Engine, Scope and borrowed display resources support independent easing literals, pause/resume anchors, skipped turns, ordered option reads, exact causes, receiver/ownership guards, shared clock capacity, listener order, terminal states, return refusal and closing cleanup. Adapting alpha is application code, not a generic property-animation API. Unreachable numeric edges remain source-only; logical retirement proves no GC, physical memory or performance.

## Recorded outcomes

| Record | Actual outcome | Scope |
| --- | --- | --- |
| Original TW01 | FAIL: one missing-method assertion | Genuine display, clock and Scope setup preceded the absent `Engine.createTween` witness. |
| build-r2 | PASS | Source-bound core build; input identities stable. |
| public-r1 | PASS: 31/31 | Reviewed original public behavior fixture. |
| public-r2 | PASS: 32/32 | Preserved bodies plus a separate external Scope-abort witness. |
| regressions-r1 | PASS: 94/94 | Selected affected existing tests; not the whole legacy suite. |
| types-r1 | PASS | Positive/DOM-free consumers and 265 actual diagnostic lines (old/new negatives). |
| boundaries-r1 | FAIL | Preserved quoted-option import-scanner false positive. |
| boundaries-r2 | FAIL | Compiler empty export marker counted as an additional public export. |
| boundaries-r3 | PASS | Actual production scan: 399 source/build/declaration files. |
| boundaryControls-r1 | INCOMPLETE | 90-second timeout, zero stdout/stderr; no control acceptance. |
| verify-r1 | FAIL: 2,130/2,131 | TW10 received a different refusal after the valid baseline; no skips. |
| boundaryBrand-r1 | PASS: 1/1 | Exact expected-reason fixture successor; strict earlier facade rejection witnessed. |
| verify-r2 | PASS: 2,131/2,131 | Complete current core verifier; 23 unique boundary controls within this run, not a standalone rerun. |
| Final publication checks and GitHub delivery | PENDING | No push, merge or remote CI result is supplied here. |

Strict types matched 20 ordinary and 11 isolated named Tween negatives by file, line and code. The 265 diagnostic lines include old suites, not new Tween behavior cases. Public 31/31 and 32/32 overlap; regressions, types, scans and whole tests have separate scopes and are not summed.

## Corrections and review history

**TW-FIXTURE-001** corrected a fixture assumption, not a product defect: readonly observations need not be own getters. Authentic receiver-aware lookup preserves forged-receiver `TWEEN_INVALID` and frozen/readonly checks. The request-changes review stays historical, not a runtime PASS.

The four-file core review found no defect and recorded **TW-CORE-NOTE-001** as a missing witness. Public-r2 adds a real external Scope-abort observer advancing time during closing before reverse cleanup: no further write/completion; its sample is retained and resources stay live until the observer ends. Saved-output review closes the note for exact 32/32; 31/31 stays historical.

The reviewed canonical alias guard adds comment-stripped export counting to four-name/empty-runtime checks, retaining its assigned refusal. That source-only closure supplied no executed control PASS; verify-r2 is the separate current runtime witness.

Boundaries-r1 mistook the quoted `from` key for import syntax. Successor source reviews recorded **TW-SCANNER-001** (a URL/comment-truncated quote could consume a later import across a newline) and **TW-SCANNER-002** (escaped CRLF requires atomic recognition). Reviewed source closures preserve the request-changes cutoffs and existing refusal reasons; they are not executed control results. Boundaries-r2 then rejected the compiler-produced standalone `export {};` marker after four intended declarations. Its narrowly reviewed exclusion retains named-export and empty-runtime guards; boundaries-r3 passed. The standalone timeout remains INCOMPLETE. Whole verify-r1 failed TW10 because `engine/text: exact text declaration surface mismatch` shadowed the assigned reason. The whole run contains 22 unique passing controls and one failed control. An independently reviewed one-string fixture correction aligns TW10 with the strict earlier text-facade refusal; product/checker stay unchanged. The narrow 1/1 successor passed, without exercising the later Tween-specific branch. The failed whole run and timeout remain historical. Fresh verify-r2 passes all 2,131 tests (failure/cancellation/skip/todo all zero), including 23 unique controls: 19 assigned negatives and four other controls. Controls pass within the whole run; the standalone attempt stays INCOMPLETE. Independent saved-output review closes **TW-ACTUAL-001** for the exact successor, retaining the later-branch limit.

## Provenance and limits

First-party AI-assisted source and spec-derived fixtures received independent source/output review. No competitor/vendored animation implementation or new dependency was added. Existing licensing/attribution applies; shared records contain identities, not private paths/raw logs.

These CPU results exclude browser/native animation, fonts/TextField/Spine, full legacy Tween, chains/loops/custom easing, migration, phones/performance and physical memory. Source-bound successors preserve failures, incomplete attempts and review cutoffs.

## Later delivery closure — 2026-10-11

The PENDING statements above describe the earlier source-verification cutoff. The following saved delivery record closes publication for the recorded 0.26.0 source commit; this later appendix is intended for a subsequent publication.

The first push attempt passed 2,131 core tests and 52 publication tests, but the mandatory hook failed because two LICENSE references in the English/Chinese contract pair left the knowledge-base root. The narrow correction replaced those targets with the repository's existing public LICENSE URL and refreshed their derived identities. It changed no product code, license terms or gate policy. The failed attempt remains part of the history.

A fresh complete mandatory hook ran from 2026-10-11T00:06:01.917Z to 2026-10-11T00:12:37.643Z: 2,131 core tests passed, 52 publication tests passed and the knowledge base reported zero issues. The saved receipt records exit 0, stable source, no hook bypass and no forced push. These are separate results, not additions to earlier overlapping test totals.

[PR 11](https://github.com/cnedwin/Egret_rebuild/pull/11) delivered source commit c57872a288fed15b2f9fba5f9022e8afdc8404dd. The saved draft-PR record verified all 1,108 remote paths, modes and Git blobs against the recorded inventory; the later merge record verified the same tree on Main. This appendix reports those saved checks and does not claim another remote enumeration. The PR was made ready for review, then its merged state was verified at 2026-10-11T00:14:25.560Z. That timestamp is the verification cutoff, not a separately established merge-event time. Main is ecd9f8c6a1fa55855c7d0ea0c9495cbde96bdbf7, with tree 5f54f7a11913ea9de36bee6de81deca68249ac3d. Local publication Main was fast-forwarded to those same identities at 2026-10-11T00:15:08.427Z, without resetting the engineering overlay.

The saved GitHub response contains zero commit-status entries and zero check runs; it supplies no remote CI execution or CI success. The complete local mandatory hook is the verification witness. Delivery does not broaden the CPU, source-provenance, licensing or feature boundaries above: browser/native animation, fonts/TextField/Spine, legacy migration, phones/performance and physical memory remain outside this evidence.
