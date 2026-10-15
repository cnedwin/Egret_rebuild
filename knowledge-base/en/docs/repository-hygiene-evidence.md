# Repository hygiene verification — 0.45.1

English | [简体中文](../../Cns/docs/仓库路径与换行验证记录.md)

Proposed engineering preview 0.45.1 repairs repository path identity and authored text handling. This dated record separates the read-only diagnosis, actual pre-fix regression and independently accepted focused successor. Complete local gates, remote CI and 0.45.1 delivery are not accepted here.

## Read-only byte diagnosis

The 2026-10-13 12:03:30 UTC audit examined 1,428 files in the current public-discovery working tree. It excluded the declared private, dependency, generated and ignored directories. It did not query Git's tracked inventory, index or committed blobs.

| Byte category | Files |
| --- | ---: |
| LF | 1,327 |
| Mixed LF and CRLF | 43 |
| CRLF | 21 |
| Binary | 34 |
| No line terminator | 3 |

The same audit found 1 UTF-8 BOM, 12 text files without a final newline and 12 text files with an extra blank EOF line. These findings overlap the categories above; they are not additional files or test results. Original bytes and raw SHA-256 identities were retained.

Two separate problems require separate repairs. Windows may open a differently cased physical path while a published owner-relative fingerprint must retain its complete, exact spelling. Authored text also needs an explicit byte policy: converting CRLF alone does not remove extra blank EOF lines. The earlier SpriteSheet staged whitespace refusal concerned three extra EOF blank lines and is retained as historical evidence.

## Actual pre-fix regression result

At 2026-10-13 12:12:04 UTC, the unchanged publication checker ran two newly adopted regression cases. Each case first passed a genuine complete publication fixture baseline, then changed one assigned inventory condition.

| Case | Intended refusal | Observed old-tool result |
| --- | --- | --- |
| Directory case alias | A fingerprint for literal owner-relative path `SRC/core.ts` must not borrow the `src/core.ts` identity | No issue reported; assigned assertion failed |
| Duplicate case-alias row | One physical file must not satisfy both `src/core.ts` and `src/CORE.ts` fingerprint rows | No issue reported; assigned assertion failed |

The saved run exited 1 with **0 passed, 2 failed, 0 skipped**. Both failures reached the intended publication assertions after their baselines. This is an actual expected RED that reproduces the defect; it is neither a setup failure nor evidence that the repair already passes.

## Saved focused successor

Four saved actors at 2026-10-13 12:26:08–12:26:12 UTC exited 0 without timeout: the focused path/fingerprint/fresh-text regression collection, the build, strict SpriteSheet diagnostics and strict Sequence playback diagnostics. The focused collection reported **111 passed, 0 failed, 0 skipped**. The other three actors are separate checks, not additional members of that test count.

The earlier draft recorded independent saved-result review as **PENDING**. The subsequent 2026-10-13 12:30:13 UTC review accepted the four saved actors as PASS_ACTUAL_FOCUSED_IDENTITY with 0 open findings. It bound the four repaired tool sources and consumed the complete exact diagnostic tuples: SpriteSheet positive 0, ordinary/import negatives 22/14; Sequence positive 0, ordinary/import negatives 27/13. This finite successor does not establish final publication. The additional Node and PowerShell canonical writing wrappers were source-only at that earlier draft cutoff; their later actual acceptance is recorded below.

Separate writer RED at 2026-10-13 12:23:21 UTC reported one file-level failure for the missing named export canonicalTextBytes before module instantiation completed. Its functional cases did not execute in that RED attempt. The accepted focused GREEN separately covers the pure writer helper; later wrapper acceptance is qualified below.

## Saved Git and working-tree successor

The prior Gate RED produced 0/12 passing tests: each actual native Git setup reached the intended absent tools/check-repository-hygiene.mjs and printed ERR_MODULE_NOT_FOUND. It did not qualify the missing Gate behavior. The later GREEN comprises 12 test families and 14 fresh native baseline instances; the instance count is not a test count.

The separate writer actor at 2026-10-13 12:45:33–12:45:34 UTC passed 3/3 real Node/PowerShell cases, independently accepted as PASS_ACTUAL_NODE_AND_POWERSHELL_TEXT_WRITERS. It checked exact authored UTF-8/LF bytes and a preserved legal-file refusal. The exact internally resolved PowerShell executable path was not retained by the outer receipt; this result does not qualify every installed PowerShell environment or a generated JSON writer.

Three saved actors at 2026-10-13 12:47:57–12:48:12 UTC exited 0 without timeout:

| Saved lane | Measured result | Scope |
| --- | --- | --- |
| Isolated real Git controls | 12/12 passed, 0 failed or skipped | Assigned fixture families, including byte preservation with autocrlf enabled and disabled |
| Current working-tree hygiene | 1,440 files, 76 unchanged legacy exemptions, 0 issues; stagedCompared 0 | Working files only; no current index or committed-snapshot acceptance |
| Related five-file test collection | 123/123 passed, 0 failed or skipped; includes 9 knowledge-base cases | Separate overlapping run, not added to the earlier 111/111 or writer 3/3 |

An earlier cutoff recorded the independent Gate review as PENDING. The 2026-10-13 12:54:33 UTC successor accepted these three saved actors as PASS_ACTUAL_REPOSITORY_HYGIENE_DATA with 0 open findings. The original baseline holds 77 legacy text records; the working snapshot used 76 unchanged exemptions because the edited knowledge-base validator was canonical text. This difference is not a missing baseline record or authorization to rewrite other originals.

The earlier draft's NOT_RUN writer/Git states remain their original historical cutoff. Current working success does not substitute for full publication mode, actual index/blob equality, a complete committed snapshot or the mandatory push/PR/Main chain.

## Repair and acceptance boundaries

The [path identity and line-ending policy](repository-identity-and-line-endings.md) defines separate portable logical paths and platform-aware absolute path comparisons. File fingerprints must still hash the complete original bytes. Lexical path equivalence does not establish real filesystem object identity or authorize a symlink escape.

The proposed policy preserves Git payload bytes with `* -text`, uses UTF-8/LF editor defaults for authored text, and permits older abnormal text only at its exact unchanged complete path, byte length and raw SHA-256. A writer may canonicalize newly authored text; a fingerprint reader must never do so. The gate must inspect new and untracked public files as well as tracked files and compare working, staged and committed bytes without rewriting them.

| Remaining lane | Status at this cutoff |
| --- | --- |
| Independent acceptance of the focused saved successor | PASS_ACTUAL_FOCUSED_IDENTITY |
| Node and PowerShell canonical writing wrapper execution | PASS_ACTUAL_NODE_AND_POWERSHELL_TEXT_WRITERS |
| Isolated Git byte-preservation fixtures with autocrlf enabled and disabled | PASS_ACTUAL_REPOSITORY_HYGIENE_DATA |
| Working hygiene / actual current staged and complete committed checks | SAVED_WORKING_PASS / NOT_RUN |
| Final source provenance, English comments, bilingual and complete local gates | NOT_RUN |
| Actual 0.45.1 mandatory push hook, PR merge and Main readback | NOT_RUN |
| Remote CI acceptance for 0.45.1 | NOT_RUN |

Later measured results must be appended as separately qualified successors. This record assigns no future test count, commit identity or passing result. Preserved upstream/legal originals and historical evidence are not bulk reformatted or rehashed. Repository tooling work is linked to modern engineering R016, bilingual publication R019 and the new path/raw-byte hygiene requirement R021; no engine runtime acceptance follows.

## Previous actual delivery: 0.45.0

Named SpriteSheet 0.45.0 was subsequently delivered through [PR #32](https://github.com/cnedwin/Egret_rebuild/pull/32) and merged into Main. Independent saved-result review accepted Main commit `863b29c90b92b62e37ce77cf32e02c4294135a16` and tree `1c7b706163ab58e41916bdaa8a6d45f74743a4f9`.

Its actual mandatory push hook passed **63 publication**, **2,909 core** and **160 experimental** tests as separate suites, with **0 knowledge-base issues**. Remote CI PASS is not claimed. This delivery fact succeeds the earlier source-curation PENDING cutoff; the older [SpriteSheet verification reading](spritesheet-evidence.md), its original failures and recorded source identities remain historical.

This tooling repair does not establish browser PNG decoding, phone or Native SDK performance, complete UI/3D, full Spine R020/V020 or legacy-project migration R008/V006. Full Spine and migration remain OPEN.
