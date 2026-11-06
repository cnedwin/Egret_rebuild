---
name: egret-windows-ci
description: Use when Windows GitHub Actions checks fail, stall, or need retry decisions in cnedwin/Egret_rebuild.
---

# Egret Windows CI

English | [简体中文](SKILL.zh-CN.md)

Turn each distinct failure into an exact diagnosis, a bounded repair and a reusable prevention decision. This skill grants no additional publication or account authority.

## Intake

Read the current PR head/base and the actual failed Windows job, run/attempt, steps and log. Save recordings once in private evidence outside the checkout. Bind a retained result to its inputs; an updated PR timestamp is not a new source commit. If Git context or credentials fail on the configured Windows maintainer machine, use the installed `$egret-windows-git` entry before retrying expensive work. Do not reset accounts to repair a test refusal.

The offline helper consumes saved job JSON and either plain logs or the existing API helper's `{status,data}` responses:

```text
node <skill-directory>/scripts/summarize-windows-failure.mjs --job <job.json> --log <log-recording> --head <expected-head-sha> --out <new-private-receipt.json>
```

It preserves saved-input hashes, refuses overwrite and produces diagnostic candidates. Exit 0 means the recording was processed, including a failed job or mismatched head; it is not a CI success or admission result. Complete the unconfirmed root-cause and follow-up fields from source evidence. It neither contacts GitHub nor reruns or approves anything. Its job head is not proof of the synthetic checkout; verify that separately when admitting a merge candidate.

## Decide from the stopping point

| Observation | Investigate first | Durable response |
| --- | --- | --- |
| `SS1_BOUNDARY_SOURCE_OWNER` / raw group drift | Actual changed source/emission versus the owned record | One reviewed current successor after correct source freezes; retain historical pins |
| Missing workspace package after branch/dependency changes | Declared dependencies, installed workspace links and the actual import origin | Restore the pinned frozen-lockfile setup before expensive checks; do not hand-create aliases or alter source pins |
| Module resolution / stale copied fixture | The real dependency closure and file owner | Repair the fixture/closure and its focused control |
| Raw-byte/path hygiene | Actual bytes and explicit Windows physical-path semantics | Canonical authoring and shared identity helpers; never normalize hashes |
| Assertion / compiler diagnostic | Product, policy and fixture separately | Minimal reproducer and the affected regression |
| Missing logs / unfinished job | Job status, actual steps and service evidence | Keep incomplete; absence of logs does not establish capacity failure |

Use the actual terminal refusal, not expected negative-test text. A signature identifies the failure domain, not a proven root cause. Preserve raw failures and unknowns.

## Repair and close

Record identity, stopping point, verified cause/owner, changed inputs, focused result, reused evidence, required remaining checks and prevention. Reuse unchanged successful evidence; rerun only the affected work plus the final candidate's mandatory protected checks. A confirmed infrastructure retry keeps successful jobs from the same candidate. A new head/base/tree requires a fresh applicability decision, not an automatic full historical replay.

For state-machine repairs, review the admitted terminal/ownership/error boundaries together, including existing bubbling and callback failure, rather than patching one scalar example per review. Keep browser/device/performance acceptance separate.

Update the existing cause family and work package. Add a regression, clearer owner/admission or a narrow skill correction when it changes future decisions; do not create another maintenance framework for each occurrence. Require normal hooks, independent review, paired public documentation and branch protection. Never rehash sealed history, waive a real failure, bypass hooks or treat manual subset passes as complete CI.
