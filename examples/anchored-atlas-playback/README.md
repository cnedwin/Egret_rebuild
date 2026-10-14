# Anchored atlas playback playground

English | [简体中文](README.zh-CN.md)

Engineering preview 0.53.0 · S107 / V058. This example joins one real asset lease, named SpriteSheet crops, the Engine clock and authored Bitmap pivots. It introduces no Engine API, runtime dependency or automatic timer.

Build with the repository's fixed Node (`node tools/build.mjs`), serve the repository root with an ordinary local HTTP static server, then open `/examples/anchored-atlas-playback/`. The explicit import map resolves built public package entries. Canvas is the default. Choose WebGPU in the selector, or use `?backend=webgpu`; a compatible browser and secure context such as localhost are required. An unavailable backend is shown explicitly. Changing backend reloads into a fresh session.

## Operate the scene

| Control | Result |
| --- | --- |
| Step 0.125 s | Add 0.125 to absolute game source time and present the live frame. |
| Pause | Pause playback without advancing or rendering. |
| Resume | Resume playback without consuming the pause gap or rendering. |
| Replay baseline | Present the exact saved first red frame; live animation/time stay unchanged. |
| Show live | Capture and present current live state without advancing time. |
| Close | Gate new actions immediately and await actual cleanup. |

The normal 192×192 preview positions the Bitmap at (96,96), pivot (4,3), scale (8,8), so the visible rectangle is (64,72,64,48). `?preset=verification` selects 24×24, DPR 1, position (12,12), pivot (4,3), unit scale and transparent-black clear; the rectangle is (8,9,8,6). Add `backend=canvas` or `backend=webgpu` explicitly when reproducing a selected backend.

Ready shows red at source time 0. Step shows blue at 0.125. Pause then Step reaches 0.25 with blue still paused. Resume then Step reaches 0.375 with red; another Step reaches 0.5 with blue. Replay shows saved red while live remains blue at 0.5; Show live returns the presentation to blue. Only Step advances time.

## Resources and retirement

The original 16×6 RGBA atlas contains opaque red in columns 0–7 and opaque blue in columns 8–15. It is first-party Apache-2.0 data, generated without external art, fonts, codecs or network assets. The provider creates its own Texture. The resource Scope adopts the sole genuine lease, sheet and Bitmap; the animation Scope owns the controller. Sheet and playback borrow the same original lease rather than acquiring another.

Close retires animation before resources, waits for every actually started preparation task, then awaits Engine/host close. Repeated Close shares one Promise. Closing while preparation is pending does not count as safe completion until the original task settles; cancellation before Texture creation creates nothing to dispose. An unsafe host close remains a failure. Saved frames retain their immutable original image pixels after live wrappers retire. Page exit cleanup is best effort.

## Evidence and limits

The independently accepted current build/focused/code scope includes 16 public-consumer tests, all 9 code phases, Core 3147/3147 and retained Spine Source 160/160. These are separate scopes. Desktop Edge 155.0.4283.45 Canvas/WebGPU acceptance covers 14 main readbacks and 32256 channels with zero mismatches at tolerance 0; the separate fresh Canvas control contributes 0 main cases. Public Source/bilingual review, normal full prepush, hooks and new delivery are also PENDING.

Read the [contract](../../knowledge-base/en/docs/anchored-atlas-playback-contract.md), [evidence](../../knowledge-base/en/docs/anchored-atlas-playback-evidence.md) and [remaining plan](../../knowledge-base/en/docs/anchored-atlas-playback-implementation-plan.md). This desktop example does not establish complete EUI/layout, full Spine R020/V020, migration R008/V006, fonts, physical GPU identity, phone/native SDK, performance or remote CI acceptance.
