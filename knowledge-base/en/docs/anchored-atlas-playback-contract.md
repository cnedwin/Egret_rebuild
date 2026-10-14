# Anchored atlas playback — contract

English | [简体中文](../../Cns/docs/锚点图集播放契约.md)

Engineering preview 0.53.0 · S107 / V058. The example composes existing built public Engine APIs and optional Canvas/WebGPU hosts. It adds no product API, package entry, dependency, host protocol or automatic clock driver. Current Source and CPU/code qualification are recorded separately in the [evidence](anchored-atlas-playback-evidence.md).

## Original content and display

One first-party 16×6 opaque RGBA atlas has red (255,0,0,255) in columns 0–7 and blue (0,0,255,255) in columns 8–15, on all six rows. Named sheet crops are red=(0,0,8,6) and blue=(8,0,8,6). One loop clip uses those crops, each for 0.125 seconds. The provider creates and later disposes its exact Texture; no supplied callback replaces the image or provides a fake lease.

The preview is 192×192: Bitmap position (96,96), anchorOffset (4,3), scale (8,8), rotation 0. The authored content appears at (64,72,64,48). Verification uses 24×24, DPR 1, position (12,12), the same pivot, unit scale and transparent-black clear; its content is (8,9,8,6). Bitmap.getBounds() measures receiver-local content (0,0,8,6); Stage.getBounds() measures the sole transformed child. No target-space getBounds overload is introduced.

## Example-local session

`createAnchoredAtlasSession({host, preset='preview', prepareAtlas?})` is a synchronous export of `examples/anchored-atlas-playback/session.mjs`, outside Engine package exports. `preset` is exactly preview or verification. The optional asynchronous prepareAtlas callback is only a provider preparation barrier; its return value is ignored and the original atlas remains fixed.

The returned frozen handle exposes:

- ready: Promise of a frozen ready snapshot, after genuine acquisition, admission and N1 presentation.
- step(), pause(), resume(), replayBaseline(), showLive(): synchronous operations returning snapshots.
- inspect(): a synchronous, side-effect-free frozen snapshot.
- close(): a normal function returning one cached Promise<void>, including repeated/reentrant calls.
- scene: a frozen view of genuine engine, resourceScope, animationScope, lease, sheet, bitmap, playback, savedFrame and texture handles. Fields can be undefined before acquisition and remain available after close for public observations; the view does not freeze live objects or transfer their ownership.

Snapshot fields are state (starting/ready/closing/closed), sourceSeconds, clockElapsedSeconds, playbackState, frameIndex (number or null), liveColor/presentedColor (red/blue or null), loads, disposals, pendingTasks, primaryOccurred, primaryCause, initializationCause and a frozen copy of cleanupErrors. Disposed playback observations follow its real public API; the session does not invent a retained live sample.

## Time and saved presentation

Initialization seeds engine.advanceTime(0), starts the existing playback and saves the exact first red frame. Only Step adds 0.125 to absolute source time and advances the Engine. Pause/Resume affect only the controller; they neither capture nor render. Replay passes the exact N1 object to the same live host without capture or advancement. Show live captures/presents current state without advancing.

| View | Source seconds | Live crop / controller | Presentation |
| --- | --- | --- | --- |
| N1 ready | 0 | red / running | red, saved baseline |
| N2 Step | 0.125 | blue / running | blue |
| N3 Pause then Step | 0.25 | blue / paused | blue |
| N4 Resume then Step | 0.375 | red / running | red |
| N5 Step | 0.5 | blue / running | blue |
| N6 Replay baseline | 0.5 | blue / running | exact saved N1 red |
| N7 Show live | 0.5 | blue / running | current blue |

This is the contract sequence, not an actual Native count. Capture, replay and presentation do not advance time. A successful advanceTime commits sourceSeconds even if the later render operation fails; no rollback of the public clock is promised.

## Ownership, refusal and closing

One genuine resource Scope adopts lease → sheet → Bitmap; one animation Scope owns playback. Sheet, Bitmap and playback borrow the original lease and acquire no second one. Objects are attached to the same Engine Stage. The supplied HostAdapter retains its ordinary surface/start/stop/close/timer contracts and safe-return obligations.

Operations before ready throw the example-only EXAMPLE_NOT_READY code. Closing/closed operations throw EXAMPLE_CLOSED. These codes create no Egret error family. Close gates operations immediately, cancels/retires animation before resources, waits for raw initialization and all actual provider preparation tasks, then awaits Engine disposal and the original host chain. A pending preparation is rechecked after cancellation before Texture creation; if none was created, disposal count stays zero. Every actually obtained result must retire once.

Initialization failure rejects ready with its original outer initialization cause only after cleanup, and retains it as primaryCause/initializationCause. Intentional Close during startup instead rejects ready with EXAMPLE_CLOSED, retains the original abort cause in initializationCause, and keeps primaryOccurred false. An operation failure records/rethrows its exact original cause; the page then requests Close. Close reports cleanup failure separately (the single original failure, or AggregateError for multiple failures), preserving the first primary and frozen cleanupErrors. A failed or timed-out host close does not prove safe surface return.

Repeated Close changes no load/disposal count. Saved frame/image values retain their immutable original pixels after live wrappers retire. Page exit is best effort, not proof of process retirement. Full EUI/layout, input routing, automatic scheduling, full Spine R020/V020, migration R008/V006 and platform/performance qualification remain separate work.
