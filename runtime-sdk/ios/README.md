# iOS Runtime SDK host

[简体中文](README.zh-CN.md)

This host runs a bundled Egret 7 scene with JavaScriptCore. Rust validates the opaque-output EGR2 frame and resolves page references, painter order and physical scissors. Metal fits the game’s logical stage into the safe area. The default 320 × 192 fixture animates 40 cards using a single 32 × 8 atlas. Standalone game packaging on iOS currently covers this 2D profile.

## Build on a Mac

Use Xcode with an installed iOS Simulator runtime, CMake 3.24 or newer, Node 26.7.0, pnpm 11.25.0 and Rust 1.100.0. The sample targets iOS 16.4 and later. Start from the repository root. Choose a new output directory. Preparing the scene bundles the built workspace and its distribution notices.

```bash
export OUT="$(mktemp -d)"
export RUSTUP_TOOLCHAIN=1.100.0
target=aarch64-apple-ios-sim
[[ $(uname -m) == arm64 ]] || target=x86_64-apple-ios
rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal --target "$target,aarch64-apple-ios"
pnpm install --frozen-lockfile --ignore-scripts
node tools/build.mjs
npm install --prefix "$OUT/bundler" --no-save --ignore-scripts esbuild@0.28.2
node runtime-sdk/ios/prepare.mjs --esbuild "$OUT/bundler/node_modules/esbuild" --out "$OUT/scene"
bash runtime-sdk/ios/build.sh simulator "$OUT/build" "$OUT/scene"
bash runtime-sdk/ios/build.sh device "$OUT/build" "$OUT/scene"
```

Open `$OUT/build/simulator/EgretIosPlayer.xcodeproj` to run the `EgretPlayer` scheme. Its display loop reads live scene packets from JavaScriptCore. Sending the app to the background releases the GPU page table and renderer. Returning creates a renderer and republishes the live scene atlas. For a physical phone, set `EGRET_BUNDLE_ID` before generating the device project, then open `$OUT/build/device/EgretIosPlayer.xcodeproj`, choose your team and sign with Xcode. The scripted device build produces an unsigned application.

## Package your own game

Pass a local ES module to `--entry`. The default entry is the 40-card fixture. This independent game uses a 160 × 120 stage and one moving solid quad.

```bash
node runtime-sdk/ios/prepare.mjs --esbuild "$OUT/bundler/node_modules/esbuild" \
  --entry runtime-sdk/ios/examples/moving-square.mjs --out "$OUT/custom-scene"
node runtime-sdk/ios/check-custom-entry.mjs "$OUT/custom-scene"
export EGRET_BUNDLE_ID=com.example.mygame
bash runtime-sdk/ios/build.sh device "$OUT/custom-build" "$OUT/custom-scene"
```

Export `openGame(host)` from the entry. It can open asynchronously, create the engine with `createEngine({host})` and use relative module imports. Return the following members.

| Member | Contract |
| --- | --- |
| `width`, `height` | Logical stage dimensions, integers from 1 to 16,384. UIKit fits this aspect ratio inside the safe area. |
| `pages` | A fixed array of `{slot,source,width,height,pixels}`. Slot 1–255 and the source identity must each be unique. `source` is the image data object found in the engine capture. `pixels()` synchronously returns packed straight RGBA8 in a `Uint8Array`, including after GPU reconstruction. Allow at most 16 MiB per page and 64 MiB for the set. Use an empty array for solid-only games. |
| `capture(tick)` | Synchronously return `engine.captureSharedFrame(...)` at the declared size. Tick starts at zero and advances once for each drawable. Use normal quads, nearest sampling and an opaque clear. |
| `close()` | Dispose the game scope and engine and release owned resources. A returned promise is awaited, including when the scene disconnects during opening. |

The native bootstrap owns JSC timers, Metal uploads and frame encoding. A customer game owns its gameplay, art, dependencies and distribution notices. Use the example as a working entry and the default fixture for textured pages. The fixed pixel verifier and its `--egret-verify` launch argument are specific to the reference scene.

## Archive and export a signed IPA

The device project can also archive without distribution credentials. To export a signed build, set your registered bundle ID before generating it. Select your development team, signing certificate and matching provisioning profile in the generated Xcode project's Signing & Capabilities. Use Product → Archive with a generic iOS device destination. In Organizer choose Distribute App and the method applicable to your account and devices. Export the signed IPA and keep the matching archive and export settings for subsequent versions.

From the same Mac you can repeat the signed archive with the selected team and an export options plist produced by Xcode for your distribution method.

```bash
xcodebuild archive -project "$OUT/custom-build/device/EgretIosPlayer.xcodeproj" \
  -scheme EgretPlayer -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/MyGame.xcarchive" DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
xcodebuild -exportArchive -archivePath "$OUT/MyGame.xcarchive" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" -exportPath "$OUT/ipa"
```

The hosted build publishes `ios-unsigned-xcarchive` with the sample’s unsigned arm64 archive and its SHA-256. Extract the GitHub artifact, check the inner ZIP with `shasum -a 256 -c EgretRuntime-iOS-unsigned.sha256`, and expand it on macOS with `ditto -x -k EgretRuntime-iOS-unsigned.xcarchive.zip .`. For your own identity and game, generate the project and archive with the bundle ID and entry above. IPA export, provisioning, device installation and App Store acceptance require the corresponding Apple credentials and devices.

## Verify a build

```bash
node --test runtime-sdk/ios/scene.test.mjs
cargo test --locked --offline --manifest-path runtime-sdk/native/Cargo.toml
python3 runtime-sdk/ios/verify-simulator.py --app "$OUT/build/simulator/product/EgretPlayer.app" --out "$OUT/evidence"
node runtime-sdk/ios/check-receipt.mjs "$OUT/evidence/receipt.json"
```

The verifier creates a temporary simulator, opens the app and retrieves its receipt. It compares the JSC frame hashes for ticks 0 and 7 with captures from the original Node fixture. With a Metal device it also requires four reference pixels, a changed animation frame, a missing-page error after release, byte-identical restored pixels and four corresponding game pixels in the composed Simulator screenshot. Closing the JS scene must release one atlas. The receipt records an unavailable simulator GPU separately. Physical iPhone signing, actual background/foreground behavior, thermal load and frame times require a phone run.

Apple CI at `b8652115` compiled the simulator and unsigned arm64 apps. iOS Simulator 26.2 reported `Apple iOS simulator GPU`, matched four offscreen reference samples and four points on the composited screen, rebuilt the same pixel buffer after release, and returned one atlas at close. The two animation frames produced distinct pixel hashes. [Run and screenshot](https://github.com/cnedwin/Egret_rebuild/actions/runs/45948081738)

## Native boundary

`egret_frame2d_create/page/decode/destroy` in `runtime-sdk/native/include/egret_frame2d.h` use a decoder owned by one render thread. Slots 1–255 register validated dimensions after a successful GPU upload. Slot 0 is white for solid primitives. A zero size releases an existing slot. A decoded frame borrows the decoder's vertex and draw storage until the next decode or destruction. Each draw carries its texture page, vertex range, opacity, UV crop and top-left physical scissor. A failed decode clears the output view.

The first Metal profile accepts normal, nearest-sampled project quads over an opaque clear, including texture alpha, crop and axis-aligned clips. EGR3–EGR6, text input, audio, touch controls and native World3D remain outside the current iOS implementation. The sample models background resource reconstruction while the JS game stays alive. Persistence after process termination is a separate capability. The C ABI uses first-party Rust code and the host uses Apple system frameworks. [JavaScriptCore](https://developer.apple.com/documentation/javascriptcore) · [MetalKit](https://developer.apple.com/documentation/metalkit/mtkview)
