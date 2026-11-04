# Prepared display subtree

English | [中文](../../Cns/docs/prepared-display-subtree.md)

This bounded M2.4 prerequisite prepares a detached display root in the position of an existing container's children, captures a genuine shared frame without changing the live tree, and explicitly publishes that child replacement. The layered [Spine RESET slot](spine-reset-slot.md) and [application recovery flow](spine-recovery-integration.md) now consume this CPU primitive. This does not provide state-preserving cross-version replacement or complete M2.4 acceptance.

## Public contract

The built `@egret/engine` entry adds one erased type, `DisplaySubtreeTicket`, and two Engine methods:

~~~ts
const ticket = engine.prepareDisplaySubtree(ticketScope, target, candidate);
const frame = engine.capturePreparedDisplaySharedFrame(ticket, frameOptions);
ticket.commit(); // CPU tree publication only
ticket.dispose(); // revoke an uncommitted ticket; never dispose borrowed nodes
~~~

Target is an ordinary genuine DisplayObjectContainer attached to this Engine's Stage. Candidate is a genuine detached DisplayObject, with its own transform, clip and identity. Each root must have a genuine open Scope owner from the same Engine; the two node Scopes and ticket Scope may differ. Existing producer-owned Mesh descendants retain their real owner chains. A facade, proxy, foreign Engine, Stage root, overlap, cycle, retired node, closed owner or forbidden managed UI edge is refused. Existing UI managed-edge rules apply; this API grants no UI wrapper authority.

Candidate becomes target's **sole child**. Target's own graphics and placement stay in the scene; the previous children detach in existing order. Candidate children are not silently moved out of their root. Parent transforms, opacity, visibility, inherited materials, clipping and sibling paint order apply during candidate capture exactly through the existing shared traversal.

One ticket affects one target. At most 32 targets may have pending tickets per Engine. The combined target and candidate subtrees may contain at most 4,096 nodes, including both roots, each subtree depth at most 128; target ancestry and ownership chains are separately bounded to 128. The rest of the Stage keeps the existing shared-capture limits. A refused request does not replace a valid pending intent; a newly accepted request for the same target retires the previous ticket. Nested or overlapping pending targets/candidates are refused. Dispose stale tickets to release their pending capacity.

## Validation and ownership

Preparation records the affected subtrees' exact authoritative topology, owners, transforms, appearance, geometry/content and bindings. It also records inherited ancestor transform/appearance/binding and child-order revisions. Capture and commit revalidate these records, live resource entitlements and owner chains. Mutation followed by restoration still changes the revision and is stale. Reparenting, disposal, page-lease release and changed Mesh binding cannot publish a candidate. Ancestor child-order changes invalidate the ticket; unrelated sibling content changes are allowed.

The returned frame is an immutable snapshot. It may contain an earlier sibling animation pose than the later live scene. Candidate capture substitutes private child/parent readers only for the target-to-candidate edge; it never temporarily edits the live tree or weakens ordinary capture invariants. Final CPU publication uses preallocated child storage after complete validation, with no application callback or further allocation in that publication section. Frame-capture or clock reentry cannot commit.

Tickets borrow all old and new nodes, Scopes, players, leases and resources. Ticket disposal, supersession and commit never dispose or acquire those objects. Commit detaches old children without closing their Scopes, stopping their clocks or consuming their events. Callers explicitly retire old owners after their own presentation policy permits it. Closing the ticket Scope revokes the ticket; closing a node/resource owner invalidates use. An old owner's ordinary cleanup remains its own responsibility. Existing detach/input behavior is retained: no new pointer, keyboard-focus or input transaction is promised.

## Host boundary and the Spine consumers

Applications may pass the genuine candidate frame to the existing Host `stageSharedFrame`, await `upload.ready`, separately commit the CPU ticket and separately call `upload.submit()`. Only the Host owns GPU readiness, device generations, draw completion and native retirement. Upload readiness does not present a frame. CPU commit does not present a frame. Host submit may fail after native draw work has begun; this API does not roll back CPU state or promise cross-domain atomicity. Cancellation of a CPU ticket does not cancel a separate Host upload; applications dispose both when abandoning a staged request. A frame already captured remains replayable under ordinary Host rules even after CPU ticket abort or commit.

Perform slow asset loading and semantic preparation before capturing a ticket. Old target animation/content changes invalidate this snapshot, so use a bounded final capture/stage/commit window with an explicit application clock policy. The SDK never silently suspends a global clock. The [RESET slot](spine-reset-slot.md) provides exact animation/skin validation, silent zero-time initialization, latest-intent cancellation and owned participant retirement. The [application recovery flow](spine-recovery-integration.md) uses genuine Host generations and tickets to rebuild device resources while retaining the active CPU player and event cursor. It separately records CPU publication, native submission and settlement; this primitive itself adds no Host atomicity. State-preserving cross-version replacement, broader recovery coverage and completeSpine remain open.

## Verification and source record

The [public example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-subtree/README.md) mixes an original textured Mesh, Bitmap and clipped translucent rectangles. On 2026-11-04, focused behavior and adjacent regressions passed 139/139, including 28 new CPU behavior cases and one strict type suite. Four unsuppressed TypeScript 7.0.2 negatives record TS2741 at 3:7, TS2740 at 3:36, TS2554 at 3:8 and TS2739 at 3:42, each after a fresh positive baseline. Full package boundary checks passed with the exact new private assembly edges; the four-package dependency direction and DOM-free core remain intact.

Default headed Edge 156.0.4314.58 / Playwright 1.62.1 / Node 26.7.0 passed WebGPU and WebGL2. Each backend checks ten image observations at six literal points (24 channels per observation): old pixels during upload, cancellation and CPU-only commit; explicit submission; conflict; old/candidate replay after abort and commit. Closing with an additional ready upload drains pending frames and disposes exactly two owned textures. Raw screenshots/readbacks and executed-input identities are retained separately; the [portable summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-subtree/verification-summary.json) records hashes and limits.

Earlier attempts remain failures: a missing import-map alias prevented execution; a fractional CSS origin produced a 65-pixel screenshot; an initial reference incorrectly treated inherited per-draw alpha as offscreen group alpha. The corrected independent composition applies cyan alpha 0.5 over green alpha 0.5, producing linear green 0.75 and blue 0.5, with one channel-value tolerance for quantization. Initial CPU fixtures incorrectly tried to Scope-own an already binding-owned Mesh node; the fix owns its binding and authenticates real owner chains. A new descendant exposed an overlap hole, now rejected. Initial type expectations used generic TS2345; recorded actual diagnostics are frozen instead. The first boundary runs correctly refused undeclared new dependency edges; only the exact reviewed additions were admitted.

Source, focused execution, browser observation, independent review, full protected CI and merge delivery remain separate. This record claims no physical memory, phone/device qualification, performance improvement, device recovery, input integration or Spine compatibility completeness. M1.2's 10.3 ms observation and 8 ms target are unchanged. First-party implementation, original geometry, tests and documentation were independently authored with AI assistance under Apache-2.0; existing dependency notices and licenses are unchanged.

An intermediate collector-only edit left an unused lockfile key in its final input index and therefore failed evidence sealing; it is retained as incomplete. The corrected final collection excludes that unused lockfile and generated reports and passes the same native checks.

Review repair: the target direct-child quota is checked in O(1) before the managed-child helper can copy a list (4,094 children plus the target/candidate roots fit; 4,095 do not). This quota takes precedence over managed-child traversal after root/lifetime admission. Pending affected-node sets are intersected, so a new candidate containing a previous pending candidate is refused. Ancestor records store bounded revisions/owner chains, never whole sibling arrays.

This fixed already-bound API does not freshly dispatch subclass assertUsable, attachability or bindability hooks, or public parent/children getters. Applications must run their own semantic guards before preparation; Scope ownership establishes lifetime/affinity, not permission from those guards. Ordinary addChild/addChildAt behavior is unchanged. A public subclass regression covers this distinction.
