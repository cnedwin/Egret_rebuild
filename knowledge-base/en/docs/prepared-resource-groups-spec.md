# Prepared resource groups and Bitmap publication

[简体中文](../../Cns/docs/prepared-resource-groups-spec.md)

This contract covers preparing a set of Texture resources and publishing their bindings to existing Bitmaps together. Resource loading, publication and Host presentation are separate operations. It does not add a renderer or change the ownership of an AssetGroup's members.

## Purpose

A character or interface can have several related image layers. Preparing one layer must not replace the visible set while another layer is still loading. A replacement also needs to preserve the display objects, their transforms and their input identities. The application first prepares the complete compatible set with an AssetGroup, then explicitly publishes that set through a Bitmap binding ticket.

Typical uses include coordinated outfit layers, multi-part character portraits and related interface images that must change as one set. The currently published set remains available while a candidate loads. If candidate loading, content validation, budget admission or ticket preparation fails before commit, retire only the candidate and preserve the old set, provided its owners remain valid.

Calling ordinary Bitmap setters in a loop cannot provide this contract. A later target can refuse a write after an earlier target has already changed. A ticket checks every target before publishing any binding. It also detects an intervening assignment that restores the same public lease and crop: the original binding identity has still changed.

## Stages and completion promises

Preparation has distinct stages: source reading and verification, decoding into Texture resources, AssetGroup readiness, binding publication, and Host presentation. An AssetGroup can be `ready` while none of its members has been published. Its stable original `ready` Promise settles readiness; it does not report ticket commit, presentation or resource retirement. Ticket `prepare`, `commit` and `dispose` introduce no Promise.

The example coordinator returns the original Promise created for each replacement request. It fulfills only after that request commits and the business selection is updated. A failed, cancelled or superseded request rejects without publishing a partial replacement. Keep and observe that original result rather than substituting a cleanup or presentation Promise. A committed request remains successful if subsequent retirement reports a failure; reporting that failure must preserve the distinction between publication and cleanup.

In the scene composition, session readiness covers CPU-side owner construction and dependency policy checks. A successful session readiness result alone does not establish native font registration, rendered pixels, GPU completion or closure of external adapters.

The example-local `createPreparedResourceApplication` exposes a read-only `input` accessor for its existing genuine MouseInput; it is not an SDK export. The accessor can return `undefined` during startup. After awaiting the original `app.ready`, consumers can subscribe to `app.input.events.activate` through `session.scene.engine.stage.on`, using `session.scene.inputScope.signal` for the subscription lifetime. The accessor creates no second input owner or new EventType. Application close continues to own input disposal.

## Public interface

```ts
import type { AssetLease, Bitmap, Scope, Texture } from '@egret/engine';

// Selected Engine method:
interface Engine {
  captureBitmapBindings(scope: Scope, targets: readonly Bitmap[]): BitmapBindingTicket;
}

interface BitmapBindingTicket {
  prepare(members: readonly AssetLease<Texture>[]): void;
  commit(): void;
  dispose(): void;
}
```

`BitmapBindingTicket` is an erased TypeScript type. The root entry adds no ticket constructor, free factory or standalone runtime batch function exports. The returned handle is frozen; its three methods require that exact handle as their receiver. Preparation and commit are synchronous and return `void`.

Capture accepts 1–128 distinct, live, nonempty Bitmaps from the same Engine and an open Scope from that Engine. Target and member arrays must be dense arrays with their own indexed positions. The member count must equal the captured target count. Repeated genuine member leases are permitted; repeated targets are refused.

The application manages these ordinary Bitmap bindings exclusively. Do not share the same binding with a Bitmap resource slot, a Button skin owner or a sequence-animation crop owner. The scene composition keeps a sequence-animated body on its own atlas lease and animation Scope. The ticket publishes only the ordinary outer and trim Bitmap layers. Replacing those layers neither retargets the body atlas nor transfers ownership of animation crops. The factory does not identify every application-level owner automatically.

## Preparation and commit

Capture retains the targets' exact current binding identities. `prepare` snapshots the ordered members and validates their live Texture views without changing the targets. A candidate's complete Texture view, including its nonzero origin and natural dimensions, becomes the new binding on commit. Application policy must check content revisions, layout compatibility and its resource budgets before calling `commit`.

Commit checks the complete set again: target affinity and lifetime, active target mutations, all captured binding identities, old bindings and prepared member entitlement. All binding-identity checks precede entitlement reads. It prepares the publication records before the first write, then publishes the complete set without calling application code. An ordinary refusal publishes no prefix.

The ticket preserves each Bitmap's identity, parent, order, transform, anchor, visibility, hit area and event subscriptions. A successful binding change does not promise a completed frame, a GPU submission or a displayed image. Applications separately capture and present a frame and await the Host's relevant completion barrier.

## Retry and retirement

| Operation or condition | Result |
|---|---|
| Invalid preparation input or entitlement, before a successful preparation | No target writes; a corrected preparation may be attempted. |
| A second preparation after preparation succeeded | Refused; the prepared set cannot be replaced. |
| A temporary target mutation or entitlement refusal during commit | No target writes; the prepared plan remains available while its original bindings and owners remain valid. |
| An intervening target assignment, including same-lease/full-view reassignment | The ticket becomes terminal with a binding-conflict reason. Create a new capture for a new attempt. |
| A captured target is disposed | The ticket becomes terminal; it does not restore another target. |
| Commit succeeds | The prepared plan is consumed exactly once. |
| Dispose before commit | The initial target bindings remain unchanged. |
| Dispose after commit | Only bindings that still have this ticket's exact published identity are cleared. Later manual or successor bindings remain unchanged. |

`dispose` is idempotent. It never restores initial resources and never releases member leases. Releasing a group-owned lease or disposing its Texture independently can invalidate a borrow; the ticket cannot undo that revocation. A later manual binding that needs an independent lifetime must use a separately owned lease. Assigning a binding away and then back to the same lease and view is an ABA conflict: equality of public values does not restore the captured identity. After such a change, create a new ticket. Cleanup of an older ticket must not clear a later manual binding or a successor publication.

Method admission checks the exact receiver, intrinsic Engine lifetime, captured Scope lifetime and terminal reason before consuming new input. An input getter cannot resurrect a disposed ticket or a closed owner. Reentry into the same ticket during preparation is refused. Ordinary Engine frame capture is not a global prohibition on using an otherwise valid ticket.

Engine closing first makes every ticket terminal and conditionally clears every ticket publication, before releasing resource groups and other callback-capable owners. Ordinary Scope closing retains its existing abort-first, reverse-cleanup behavior; intrinsic lifetime checks refuse new preparation or commit as soon as that Scope closes.

## Resource ownership and application coordination

The AssetManager handles acquisition, caching and provider disposal. Scope arranges lifetime cleanup; it is not a separate resource cache. AssetGroup remains the sole cleanup owner of its member leases. A ticket borrows the exact ready members; it does not acquire, adopt, claim, transfer or release them. Retire a publication before retiring its group. Use short-lived binding and group Scopes for each attempt, with one application coordinator cleanup registered in the longer-lived scene Scope.

For latest-request behavior, the coordinator publishes a fresh intent identity before cancelling an earlier preparation or activating a loader. It checks that identity after cleanup or loader reentry. Only the latest valid attempt may check the complete manifest and budget, prepare the ticket and commit. After a successful commit, it updates the business selection and resolves success before retiring the previous set; cleanup reentry must not overwrite a newer selection or turn that success into an uncommitted result.

Logical cancellation and physical source completion are distinct. Cancelling a pending replacement revokes its publication authority and begins owner cleanup; it does not prove that a reader, decoder or other original source task has stopped. A stale completion must be observed and retired without changing the current selection. An original loading task continues to occupy its source budget until it actually settles. Keep logical working-set charges, encoded source retention, decoded CPU data, frame work, GPU residency and temporary allocations as separate accounts. A post-commit frame refusal cannot establish pre-commit resource admission.

## Cleanup and adapter boundaries

For an individual replacement, invalidate publication authority first, dispose its ticket, dispose the group Scope, then finish binding-Scope cleanup. Keep logical reservations until callback-capable cleanup has returned. A scene shutdown first invalidates actor generations and coordinators, then stops animation, detaches and retires display objects, and releases group and atlas owners. Teardown must continue through secondary failures while retaining the primary cause.

The session borrows its source and shared-dependency adapters. Its stable original close Promise covers its Engine, text-cache cleanup and the tracked source/dependency work it observes. The outer application remains responsible for closing the borrowed adapters and awaiting their own original close results. Register terminal state and each close Promise before abort or disposer callbacks can reenter. Repeated close calls share the same result. These ownership boundaries do not establish native shutdown correctness by inspection alone.

The fixed outfit source adapter verifies encoded identity and complete Texture views, and keeps each admitted original provider task in its source ledger until that task settles. Its snapshot describes the allocations it logically owns; it excludes reader-retained bytes, browser-private decoding storage, GPU allocation and physical memory reclamation. The coordinator's bounded set and byte limits are example policy, not universal SDK limits or measured device capacities.

## Error boundaries

Ticket admission uses `BITMAP_BINDING_INVALID`, `BITMAP_BINDING_SCOPE_INVALID`, `BITMAP_BINDING_TARGETS_INVALID`, `BITMAP_BINDING_MEMBERS_INVALID`, `BITMAP_BINDING_STATE_INVALID`, `BITMAP_BINDING_REENTRANT` and `BITMAP_BINDING_DISPOSED`. Genuine runtime failures retain their existing codes, including binding conflict, disposed objects, active Bitmap mutation and revoked lease or Texture entitlement. A scope or Engine lifetime failure takes priority over an error thrown by a caller input getter.

This contract defines a bounded Texture-binding primitive. It does not establish complete UI behavior, animated-atlas retargeting, Spine support, arbitrary heterogeneous resource transactions, GPU rollback, physical cancellation, device recovery or target-device performance. Implementation, public behavior, authority units, types, native presentation and final delivery have separate evidence records.

## Verification and delivery status

The specification, saved CPU results, real native presentation and delivery are separate evidence categories. Source review checks the public interface and ownership design. CPU controls can exercise request ordering, failure, reentry and logical cleanup, but cannot prove actual PNG decoding, native font readiness, input behavior, Canvas/WebGPU pixels, GPU budgets or physical resource retirement.

The finite desktop composition, native input and recorded owner-retirement results are documented in the [verification record](prepared-resource-groups-evidence.md). General native support, physical/GPU budget acceptance and target-device results remain open; full repository gates and Git delivery have separate cutoffs. Earlier native results for related primitives do not transfer automatically to this scene. An interrupted full check with no completion receipt is not a pass. Test counts and isolated policy checks do not establish product completion or release acceptance.
