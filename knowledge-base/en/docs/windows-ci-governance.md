# Windows CI failure governance

[简体中文](../../Cns/docs/windows-ci-governance.md)

A failed Windows job produces one evidence record and a prevention decision before retry or acceptance. The goal is to shorten repeated diagnosis while retaining meaningful source, behavior and protected-merge checks. The reusable [Egret Windows CI skill](https://github.com/cnedwin/Egret_rebuild/tree/main/skills/egret-windows-ci) includes an offline recording summarizer.

## Failure record and ownership

Capture the PR/head/base, workflow/run/attempt/job, actual checkout when observed, first stopping step and unchanged raw recordings. Complete the cause and owner after comparing actual source, emission, fixture or environment evidence. Record the bounded repair, focused result, retained successful evidence, remaining candidate checks and the prevention decision. A classifier output is a starting receipt, not a verified root cause or merge approval.

The change author owns the implementation and reproduction; the relevant module maintainer reviews its contract. Maintainers own admission of current shared source records and final metadata. Infrastructure problems retain their actual external boundary. Independent review covers source, results and both public language editions. A merged increment does not close unexercised device, IME or performance rows.

## Reusable cause families

| Cause family | Evidence and lesson | Prevention |
| --- | --- | --- |
| Current source-owner drift | A new module or changed pointer code can trigger `SS1_BOUNDARY_SOURCE_OWNER` on every OS. This signature alone does not establish a Windows EOL defect. | Compare the owned raw tuples; freeze correct final code, then admit one finite reviewed successor for the package. Preserve previous source/graph/diagnostic records. |
| Stale workspace installation | A package can be declared in the manifest/lockfile yet be absent from installed workspace links after a branch/dependency change. | Restore the existing pinned frozen-lockfile setup before expensive checks; verify the actual import origin. Do not hand-create aliases or change source records. |
| Fixture dependency drift | A copied smoke fixture can omit a newly required module or assign it to the wrong owner. | Copy the actual admitted closure and run its affected healthy/refusal control before expensive work. Do not loosen the expected refusal to hide an invalid prerequisite. |
| Path and authored-byte mismatch | Logical repository names and physical Windows paths have different comparison rules. | Use the shared identity helper and canonical writer; retain exact original hashes. See [repository identity](repository-identity-and-line-endings.md). |
| Expected negative output misread | Compiler and mutation controls deliberately emit failures before restored controls pass. | Read the actual stopped command/aggregate result and its nearby diagnostic. Do not grep the first error word and declare a root cause. |
| Runner/service interruption | Queued, cancelled or unpublished-log states can precede any product execution. | Retain incomplete status; confirm the service failure before a bounded failed-job retry. Successful jobs remain bound to their original candidate. |

The current-source lesson is illustrated by [PR #127](https://github.com/cnedwin/Egret_rebuild/pull/127); fixture prerequisites and early shared checks were repaired in [PR #125](https://github.com/cnedwin/Egret_rebuild/pull/125). These references establish the documented bounded cases, not a general Windows performance or reliability result.

The optional native-editing entries in [PR #132](https://github.com/cnedwin/Egret_rebuild/pull/132) exposed a distinct package-admission case: the shared source graph accepted the new entries, while independent package owners and a semantic export projection still required the predecessor maps. The Atlas owner also had a different predecessor closure from the PNG and SpriteSheet owners. The repair admits only the exact additional routes, reconstructs the complete original package maps and preserves each owner's own graph count. When an optional SDK entry changes package exports or private aliases, inspect every existing standalone package/source owner as well as the shared gate. An exact current-byte check and an older semantic export projection can both need the same bounded addition. Prove each complete predecessor by an exact inverse; derive graph counts from that owner's actual closure rather than copying another inventory's count. Run the affected standalone checks together before the next candidate push, preserving all original pins and refusal assertions.

## Closure and future updates

Use focused checks while developing, required candidate checks at publication and separate milestone/browser/device acceptance. Reuse unchanged input evidence and identify any changed head/base/tree explicitly. Never normalize source bytes to satisfy a fingerprint or replace historical rows with current bytes. A source identity admission follows reviewed behavior, not the other way around.

For each failure, add a focused regression, improve owner/admission information, or explain why an existing mechanism already prevents recurrence. Update this existing cause family and the Skill only when the new lesson changes future decisions. Keep one complete work package rather than creating a task, collector or inheritance chain for every failed run. Normal hooks, independent review and protected-branch checks remain the delivery path.

Raw logs and execution receipts stay outside the public source tree. Publish only the reviewed diagnosis, repair and relevant evidence links. The offline summarizer does not run tests, contact services, change credentials, refresh source pins, or authorize a retry or merge.
