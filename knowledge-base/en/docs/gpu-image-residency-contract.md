# Experimental WebGPU image residency contract

English | [简体中文](../../Cns/docs/gpu-image-residency-contract.md) · [Evidence and limits](gpu-image-residency-evidence.md)

Engineering preview **0.61.0** adds an internal image cache with per-Host ownership. It reuses an exact cropped GPU image after its earlier submission has completed safely. The mechanism is implemented inside `WebGPUHost`; it adds no package entry, export, option, public status, error code or dependency. Workspace packages remain private **0.0.0** and the Host protocol remains **1.0**. The existing [WebGPU contract](webgpu-rectangle-execution-contract.md) and [textured geometry contract](textured-geometry-and-mesh2d-contract.md) continue to define public admission and rendering behavior.

This contract defines logical ownership and bounded reuse. Operation-count controls are separate from browser pixels, physical GPU memory and performance acceptance. The new dedicated cache browser matrix remains deferred and OPEN; consult the paired evidence for the actual verification cutoff.

## Identity and rendering scope

An entry belongs to one unforgeable Host-session identity. Its complete key combines that identity, the genuine immutable `ImageData2D` object identity, the exact integer crop `(x, y, width, height)` and the fixed upload/sampling recipe. Equal bytes in different image objects do not share entries. Different crops do not share entries. Two Hosts do not share entries even when they borrow the same GPU device. Negative zero in an admitted crop has the same canonical spelling as zero.

The recipe remains a tightly packed `rgba8unorm` image with encoded-premultiplied bytes, nearest/clamp sampling, mip level 0, one mip, sample count 1 and the existing texture usage 6. Callers cannot select a recipe identifier. Transform, clipping, opacity and Mesh light values remain per-draw calculations rather than cache identity.

Ordinary image draws, textured Mesh2D draws and scene overlays use the same internal mechanism. Scene depth, geometry and materials are outside this image cache. Canvas remains separate. The change does not remove CPU frame/projection copies, remap whole atlases, merge batches, cache external textures/video/readback targets or implement automatic device recovery. Fresh capture still validates the original resource lease and display lifetime. A saved immutable frame retains its existing replay semantics after the original Texture is disposed.

## Ownership and safe reuse

A newly created image texture belongs exclusively to its submission record. It is unavailable to later submissions until safe completion qualifies it for promotion. The record registers the returned native resource before reading disposal/view operations or checking reentrant state changes. A creation that returns no resource has no invented cleanup obligation.

Promotion requires successful submission, observed error scopes and queue fence, any requested readback mapping/output, and cleanup of the record's noncandidate resources. The record and Host must have no failure or unsafe state; the Host must remain active with the same session identity and reuse enabled. A successful synchronous upload alone does not qualify a texture. Each native cleanup return is followed by a fresh qualification check.

Promotion transfers the exact resource from the record's exclusive cleanup set to cache ownership once. A ready entry retains only GPU resources and bounded ownership/index metadata. It holds no CPU image/pixel array, frame, projection plan, lease, Texture wrapper, submission or callback. The weak image index does not add a reverse strong image reference. GPU cleanup does not depend on garbage collection or finalizers.

A submission pins each distinct ready entry once, regardless of repeated draws or shared image/Mesh use. Its view is borrowed; it is not also placed in the submission's exclusively owned texture cleanup set. Releasing one reader cannot destroy an entry still pinned by another reader.

Concurrent cold submissions do not share an unfinished candidate. If another safely completed candidate has already published the same key, that winner remains; the later candidate is cleaned up by its own record. Collision does not refresh the winner's recency. A full ready directory makes a later candidate transient: its record cleans it up safely without waiting, eviction during retirement, a promotion queue or later resurrection. Qualification, winner and directory capacity are checked again after every native callback.

## Logical budgets and deterministic eviction

The image allocation/reservation pool is **32 MiB (33554432 bytes)**. Each cropped image is charged `4 × width × height`; this is logical accounting, not measured VRAM. At most **256 ready entries** are searchable. This directory limit does not count all in-flight candidates.

Existing limits remain: 16 MiB projection per frame, 32 MiB pending projection, 128 views and the existing source/table/scratch/device/scene/geometry/upload/readback limits. Cache hits and uncovered views do not refund the original frame's complete logical projection charge. `pendingUploadBytes` keeps its existing buffer/uniform definition. Ordinary and B1 Hosts retain default `maxPendingFrames=2` and their existing allowance for larger positive safe integers; textured and textured-scene options retain their maximum of 2.

All existing validation, packing and projection copies finish before the cache forms a read-only plan. Covered views are deduplicated in first-draw order. The plan protects all current hits and selects the oldest eligible idle ready prefix sufficient for both prospective bytes and directory slots. Pinned entries and current hits are ineligible. Directory pressure alone can select victims even when the byte budget already fits. Failure to obtain a prospective directory slot does not reject or delay an otherwise legal frame; its candidate can remain transient.

Commit runs within the existing synchronous submission busy boundary. It pins hits, touches them in first-use order, cleans selected victims, and only after all required cleanup returns successfully reserves the cold bytes. A returned cold texture converts its reserved charge to allocated charge without increasing the total. A cache hit creates and uploads no new image texture; existing draw setup, geometry/uniform work, fence and requested readback still occur.

An eviction detaches lookup/LRU membership before attempting captured cleanup. Its charge remains until `destroy` returns normally, including during callbacks. A thrown cleanup retains the unknown charge, disables reuse/promotion and follows the existing unsafe failure path. It is not retried or republished. There is no allocation against an assumed successful destruction.

Hits move to newest at submission commit; safely promoted entries enter newest. Reader completion, collision and observation do not alter recency. Retirement never evicts ready entries and does not acquire a new busy lock. Original record-owned cleanup may still reenter an active Host under the existing admission rules. Ready eviction occurs in synchronous submission, where an attempted nested render receives the existing `WEBGPU_REENTRANT` refusal.

The accounting retains every record's original pending charge until all its cleanup callbacks return. Record-owned candidates and reservations remain covered by that charge; detached cache-owned victims are charged separately until successful cleanup. This distinction prevents retirement reentry from allocating over the pool while an evicted texture is still being destroyed.

## Stop, failure, idle and close

`stop()` synchronously disables lookup and promotion without native cleanup. Safe in-flight records continue their existing settlement; already ready entries remain owned until explicit close. Failures, delivered device-loss notifications and uncaptured-error events also disable reuse/promotion. A stopped or failed Host cannot restart its session; reconstruction uses a new Host under the existing device contract.

`whenIdle()` keeps its existing snapshot-of-work meaning. It does not flush resident entries or promise zero image storage.

`close()` keeps its cached Promise and existing barrier. It disables reuse/promotion, waits for startup, synchronous work and ledger outcomes, and performs the required final queue fence. Finalizing records release pins and clean their owned candidates without promotion. The Host then attempts each remaining cache-owned resource once before the existing surface/listener/device cleanup. Borrowed devices remain borrowed. Previously attempted cleanup is not repeated, and unknown reclamation is not reported as safe.

An unresolved fence, scope or readback leaves the original record, pins and close pending. There is no forced retirement, early budget refund or cache timeout. An Engine close timeout reports its existing timeout while retaining authority; later settlement still determines safe or unsafe completion. Controlled manual timer invocation establishes that timeout authority, not an observed wall-clock delay.

Device loss follows the existing Promise notification ordering. Resolving a controlled `device.lost` Promise inside a synchronous native callback queues a notification; it does not mean the Host has already observed loss. Native-boundary checks use the state actually observed at that point. Delivered loss and synchronous uncaptured-error events remain distinct controls.

## Provenance and acceptance boundaries

The implementation, original fixtures and documentation are first-party work authored with Codex assistance under Apache-2.0. The mechanism extends the existing first-party Host, projection, resource ownership and submission ledger. Existing research, foundational dependencies and their notices retain the roles recorded in [source-origin.json](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json) and the [independent implementation policy](independent-implementation-and-dependency-policy.md). This change introduces no new runtime dependency.

Logical bounds and controlled operation counts do not establish speed, energy, thermal behavior, driver reclamation or physical VRAM. The dedicated new cache browser collector and its six-context/24-primary-readback matrix remain deferred and OPEN. Existing browser regression results, when recorded, apply only to their exact current inputs and literal comparison domains. Production hosts, target phones, actual device-loss recovery, full UI/P04, Spine R020/V020, complete 3D and migration R008/V006 remain open.
