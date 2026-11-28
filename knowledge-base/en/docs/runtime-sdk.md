# Egret Runtime SDK

English | [简体中文](../../Cns/docs/runtime-sdk.md)

A game keeps its TypeScript entry point and asset manifest across export targets. The packager resolves host services at export time. It should identify the offending import and capability when game code depends on DOM elements, a browser-owned graphics context or an unavailable platform service. The public `@egret/runtime` TypeScript package retains its existing role. The native SDK has its own binary interface and compatibility profile.

For the Android AAR, game export and Activity integration, see the [Android project player guide](android-project-player.md).

## Platform plan

| Target | Build product | Host and first acceptance |
| --- | --- | --- |
| Android | AAR and generated Gradle project for externally signed arm64 APK/AAB builds targeting API 36. | On Fold7, a split install and upgrade restored the save. The GLES3 player ran selected 2D and World3D games with a 2D HUD and recovered resident geometry for replay. On the Snow Temple route, a skinned fighter casts a directional shadow and a hit lights nearby surfaces. Broader graphics profiles and Vulkan remain open. [Scene, package sizes and host choice](android-project-player.md#snow-temple-yard-lighting) · [Player and measurements](android-project-player.md) |
| iOS | Xcode project with separate simulator and unsigned arm64 app builds. | A game supplies its own bundled ES entry to JavaScriptCore. iOS Simulator 26.2 rendered the shared 40-card EGR2 fixture through Metal, matched the displayed pixels and recovered its texture. Physical iPhone signing, input and background transitions remain open. [Build and verify](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/ios/README.md) |
| HarmonyOS | Native library and DevEco Studio project for signed application packages | Bind ArkTS to a C ABI and an XComponent native window. Qualify surface replacement and the graphics backend on hardware before enabling it by default. |
| WeChat Mini Games | A repository tool exports a JS entry, adapter, packaged assets and project configuration for WebGL2. | A 2D game reached gameplay on the simulated wx host. DevTools, on-device WeChat and platform submission remain open. [Export and limitations](wechat-minigame.md) |
| Douyin Mini Games | Douyin project with JS entry, platform configuration and resource subpackages | Use the host graphics interface and a single on-screen canvas. Qualify compositing and optional TTWebAssembly on each supported host. |

Ordinary mini-game export uses the public platform interfaces. An OEM or app operator embedding the native SDK is a separate integration with its own device and distribution agreement. Evaluate native backends, including wgpu, against required features, package size and measured device costs. [Android game host](https://developer.android.com/games/agdk/game-activity/get-started) · [Apple Metal](https://developer.apple.com/metal/) · [Huawei XComponent](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/napi-xcomponent-guidelines/) · [WeChat interfaces](https://github.com/wechat-miniprogram/minigame-api-typings) · [Douyin runtime](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game) · [Douyin Wasm](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/optimization)

The Rust renderer, Android host and procedural sample are original contributions. The APK carries the project and bundled dependency notices. [Provenance](https://github.com/cnedwin/Egret_rebuild/blob/main/contributions/android-runtime-sdk.json)

## Shared ownership

TypeScript retains input, gameplay, display order, clocks and resource leases. A native executor consumes ordered batches derived from a completed SharedRenderFrame2D capture. The profile defines page identities, sampling, colors, transforms and accepted commands. Refuse unsupported commands before displaying a partial frame. Large immutable texture pages cross the bridge at creation or recovery. Only changed game state and the work needed to render the frame belong on the steady-state path.

AssetManager and the owning Scope remain the authority for logical assets, version replacement and cancellation. A native surface owns physical allocations for its device generation. Retain a rebuildable CPU source while the game holds a lease. A lost context invalidates handles from its generation. Stop accepting new work before shutdown, release outstanding work safely and report cleanup failures. Bounds, ownership and byte order belong to the versioned native interface; callers cannot borrow a JS or Rust object past the call.

## Original delivery sequence

1. Install the Android 2D specimen. Run the same scene in Android Chrome, in the live Rust renderer, and as a native replay of the captured commands. Check pixels and image lifetime before interpreting timing. State the script VM, bridge transport, GPU backend and supported scene profile.
2. Add an iOS Metal host and a second script embedding. Use shared capability tests for startup, pause/resume, close and texture rebuilding. Freeze the distributable embedding ABI after both hosts can exercise it.
3. Bring up the HarmonyOS host, then export the two mini-game project formats. Verify privileges, signing, storage, input and subpackage behavior separately. Probe features before selecting an accelerated path.
4. Add complex UI/text, transparent batches and single-surface World3D/2D composition as independently supported profiles. Ship a general exporter after testing an external project, explicit capability errors and signed builds. Keep the browser exporter available throughout.

## Same-device measurements

Freeze the source, captured frame cycle, texture bytes, physical render-buffer dimensions and quality. The live and replay paths must produce the same command bytes. The browser uses the existing shared 2D executor. Record sampled pixels outside timing runs. Alternate run order; retain individual runs, warm-up length, observed refresh rate, foreground state and thermal conditions.

Report launch-to-first-frame with the exact clock origin for each host. Separate process launch, content loading and first usable frame where observable. Chrome navigation with an existing browser process and a fresh Activity launch have different scopes. Record p50/p95/p99 frame intervals, live capture/encode/transport CPU time, replay/submit CPU time and sampled process PSS with explicit process coverage. Replay removes JS production and transport together; their total difference includes scheduling, so label direct phase timers separately. GPU completion and display presentation need their own instrumentation. A single scene cannot qualify the whole SDK.

## Running an original Egret 5 game

The same Android player accepts an Egret 7 game, a project using the migration adapter, or original Egret 5.3 engine modules and game scripts. With the original modules, Egret 5 still runs the display list, EUI, RES, event dispatch and hit testing. Its native bindings project changes onto the shared display tree. The current encoder writes frame commands. Rust validates them and executes the supported GLES3 draws with the same GPU resource lifetime used by Egret 7. An embedded-V8 APK contains one selected V8 build. The Android platform layer owns the Activity, system editor, audio and vendor callback integration. [Package an original game](android-migration-build-kit.md)

Windows Edge and Fold7 ran the original atlas/EUI example across eight 5.3 tags. In the separate 5.3.10 nine-slice fixture, 779 RGB samples matched across six states. A real project subsequently guarded its browser mouse plugin and preserved the original input dispatcher. Its signed Android Release APK loaded the 69-entry login group, accepted text in the system editor, reached the original server selector and restored the input after a process restart. The AAB signature was verified. Live authentication, channel callbacks, missing artwork and complete gameplay require the operator’s services and assets. [Original-engine fixtures](original5-atlas-verification.md) · [Project results and receiver guide](android-migration-build-kit.md)

In a separate package comparison, adding eight minified 5.3.10 engine modules to the same signed Release APK increased its size from 64,441,672 to 64,603,144 bytes. That 161,472-byte difference measures just those script files. Game assets, third-party libraries and the actual adapter have their own costs.

## VM and platform ownership

Android uses the upstream Javet 6.0.4 embedding of V8 15.8.62.52. Select the internationalized profile for games that require `Intl`. A standalone release APK can compress the native libraries for download when installation-time extraction is acceptable. In the matched example, the trimmed VM package was 64,305,415 bytes with direct mapping or 17,670,631 bytes with compression. The installed VM ELF was 62,039,024 bytes in both cases. WebAssembly remains available to game dependencies. A game with dynamically loaded scripts needs to declare and exercise those dependencies before removing a VM feature. [V8 qualification](https://github.com/cnedwin/Egret_rebuild/pull/531)

The iOS host executes a bundled Egret 7 2D scene in Apple's JavaScriptCore, sends EGR2 through the shared Rust decoder and presents it with Metal. A macOS/Xcode run built both targets and verified the simulator's composed pixels and resource reconstruction. A device archive requires the customer's signing identity for installation. Physical iPhone performance, the other Android frame profiles and original 5.x input remain separate iOS targets. [iOS host and build instructions](https://github.com/cnedwin/Egret_rebuild/pull/530)
