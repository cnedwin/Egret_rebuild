# Explicit-time sequence player

English | [简体中文](../../Cns/docs/显式时间序列播放器契约.md)

Status: implemented, with bounded CPU/type and opaque desktop browser acceptance recorded below, 2026-10-10. This work package connects owned sequence metadata to an existing Bitmap.

## Public interface

The root `@egret/engine` entry and the runtime barrel expose `createSequenceClip`, `SequencePlayer`, and the types `SequenceClipInput`, `SequenceFrameInput`, `SequenceClip`, `SequenceRegion`, `SequenceSample`, `SequencePlaybackMode`. The factory accepts `unknown` for validation; the input types document the valid shape.

```ts
interface SequenceFrameInput {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
  readonly durationSeconds: number;
}
interface SequenceClipInput {
  readonly atlasWidth: number; readonly atlasHeight: number;
  readonly frames: readonly SequenceFrameInput[];
}
type SequencePlaybackMode = "once" | "loop";
class SequencePlayer {
  constructor(bitmap: Bitmap, clip: SequenceClip, mode?: SequencePlaybackMode);
  applyAt(elapsedSeconds: number): SequenceSample;
  readonly lastSample: SequenceSample | undefined;
  readonly isDisposed: boolean;
  dispose(): void;
}
```

Construction leaves the current Bitmap crop unchanged. The default mode is `once`. `applyAt` takes absolute, finite, nonnegative seconds; calls may move backward. A caller resets by applying zero. No implicit timer, scheduler, asset acquisition, delta accumulation or animation event is introduced. The underlying sampler stays internal. Existing clip admission retains its maximum of 1024 frames, binary64 cumulative-duration validation, own-field capture, authentic identity and frozen owned data.

## Binding, ownership and commit

The player borrows an authentic live Bitmap and its exact current AssetLease. Only a full-image Texture view is accepted: origin zero and view dimensions equal the immutable image dimensions. The clip's declared atlas dimensions must match that image. Existing factory validation checks every frame before a player can bind. An already cropped Bitmap using a full-image Texture is valid.

Each application checks player identity/lifetime, Bitmap identity/lifetime and Engine openness, then the exact current lease, then lease and Texture entitlement, and finally time. A replaced or cleared lease fails with `SEQ_BINDING_CHANGED`, even if the replacement points to the same Texture. Reassigning the exact same lease remains valid and the next application reinstates the sampled crop.

Authoritative private state, rather than overridden public getters or setters, supplies binding and image facts. The player applies the immutable sampled region through the captured intrinsic Bitmap crop setter. Crop and natural dimensions commit together. `lastSample` is committed only after that crop succeeds; failed calls retain both the previous crop and sample. External disposal side effects are not rolled back. The applied sample and region are frozen and retain no image, lease or caller input.

Successful construction binds the player's Engine affinity to the target's Engine, so a Scope from another Engine rejects adoption through the existing ownership rules. This affinity survives disposal. Binding does not install a cleanup subscription or confer ownership of the target.

`dispose` is idempotent and terminal, drops Bitmap/clip/lease references and retains only the last immutable sample. It does not dispose the Bitmap, release the lease, restore the crop, or close the Engine. Cached observations remain readable. Scope or Engine shutdown prevents further application through existing target/lease lifecycle rules; no hidden player subscription is installed.

## Errors and boundaries

Constructor priority: Bitmap identity, object lifetime, Engine state, required binding, live lease/Texture, mode, clip identity, full-image/atlas match. Existing errors retain their codes, including `BITMAP_INVALID`, `OBJECT_DISPOSED`, `ENGINE_CLOSED`, `BITMAP_TEXTURE_REQUIRED`, `ASSET_LEASE_RELEASED`, `TEXTURE_DISPOSED`, and clip admission codes. An invalid mode reports `SEQ_INPUT_INVALID`; a non-full Texture or mismatched dimensions reports `SEQ_ATLAS_MISMATCH`.

Application priority: `SEQ_PLAYER_INVALID`, `SEQ_PLAYER_DISPOSED`, target lifecycle, `SEQ_BINDING_CHANGED`, resource entitlement, `SEQ_TIME_INVALID`. Receiver checks use private identity. Query/dispose calls on forged receivers report `SEQ_PLAYER_INVALID`. No new public error-class promise is made; callers inspect `code`. The `SequenceSample.stopped` field is always false for this player; explicit time selection is not a stop controller. Once mode retains the final frame at/after duration and marks `atEnd`; loop mode wraps exactly at duration. The existing sampler's binary64 behavior is preserved.

Trim offsets, rotated atlas regions, frame labels/events, automatic playback, skeletons, Spine/DragonBones runtime integration, interpolation and original MovieClip behavioral migration remain separate work. The accepted Spine requirement and full migration requirement are unchanged.

## Execution plan and verification

1. Independently review this EN/CN specification before implementing. Reuse the already isolated `egret/webgpu` worktree; preserve prior evidence.
2. Add behavior tests importing the built public root. Observe a missing-capability failure before changing product code, then implement the small runtime class, authoritative Bitmap binding helper and public exports. Add public type checks.
3. Use an independently specified 6×2 atlas with red 2×2, green 1×2 and blue 3×1 crops and durations 0.125/0.25/0.125 seconds. Verify exact crop/geometry at 0/0.125/0.375/0.5, backward seeks, once/loop boundaries, one load/exact lease, immutable saved-frame isolation, forged receivers, failures, overrides and retirement. Expectations use literals, not sampler-derived oracles.
4. Add a reproducible browser example using only public engine/web/WebGPU entries. Fixed-time opaque pixels and saved-frame replay must be checked on Canvas and WebGPU with the default installed browser. Existing opaque crop evidence is a separate prerequisite; the player requires its own current-build observation. Do not extend opaque evidence to alpha precision, performance, devices or full A2.
5. Independent implementation and saved-artifact review; resolve actionable issues. Update this paired contract, core progress and release navigation with measured scope. Complete source provenance, critical English comments, bilingual registry/hash review and the complete prepush gates before an authorized reviewable GitHub submission.

## Recorded acceptance — 2026-10-10

Fourteen public-root behavior checks passed, covering explicit once/loop boundaries and backward selection, crop/sample commit, exact lease changes, forged receivers, authoritative state, resource failures, disposal cache and Engine affinity. The type gate passed 54 root, 5 web and 28 project expected negative diagnostics. The behavioral missing-capability run was observed before product implementation. The full-suite sandbox attempt retained 18 temporary-file permission failures and one real B1 source-closure admission failure; the narrowly selected emitted division witness repaired that integration failure without changing the sampler or generic parser refusal. The actual native B1 driver then passed all 13 cases. These records do not substitute for the fresh complete prepush gate.

A separately bound native public-player observation completed **8 captures, 256 pixels and 1024 exact channel comparisons at zero tolerance**, across Canvas and WebGPU. It applied 0/0.125/0.375 seconds through the public API to one Bitmap/exact atlas lease per backend. Construction retained the crop; returned samples were immutable and committed to the target. Player disposal retained the cached last sample and left the Bitmap/lease live. After caller-owned Bitmap/lease/Texture/origin Engine retirement, a distinct compatible Host replayed the immutable saved red frame. Independent saved-artifact review found zero actionable P1/P2; browser/server/context closure and external Job/process/EOF receipts agree.

The selected [public evidence projection](../../evidence/sequence-player-native.json) contains the raw RGBA arrays, original source identities, player proofs and review/result digests. The separate [Bitmap prerequisite](bitmap-region-evidence.md) retains its earlier source scope and incomplete predecessor. This player observation uses Node 24.19.0, Playwright 1.62.1 and Edge 154.0.4258.62 on Windows x64, fixed 8×4 DPR1 frames and default browser launch without added flags. The exact Canvas readback warning was preserved as one advisory; all other warning/error messages remained fatal.

The interactive example has source/syntax review but its UI has not been browser-tested. The opaque fixture does not establish browser coverage for every player lifecycle case, partial-alpha calibration, whole A2, hardware acceleration, phones, performance, full UI/skeletons/Spine or complete legacy migration. Those obligations remain separate.

## Source policy

This package is independently authored against the existing first-party clip, Bitmap, resource and frame contracts. No third-party animation implementation or dependency is incorporated. Study references and third-party notices elsewhere retain their original attribution and evidence boundaries.
