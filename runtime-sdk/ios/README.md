# iOS Runtime SDK host

[简体中文](README.zh-CN.md)

This host runs a bundled Egret 7 scene with JavaScriptCore. Rust validates the opaque-output EGR2 frame and resolves page references, painter order and physical scissors. Metal presents the result on a fitted 320 × 192 stage. The shared fixture animates 40 cards using a single 32 × 8 atlas. Standalone game packaging on iOS currently covers this 2D profile.

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

## Verify a build

```bash
node --test runtime-sdk/ios/scene.test.mjs
cargo test --locked --offline --manifest-path runtime-sdk/native/Cargo.toml
python3 runtime-sdk/ios/verify-simulator.py --app "$OUT/build/simulator/product/EgretPlayer.app" --out "$OUT/evidence"
node runtime-sdk/ios/check-receipt.mjs "$OUT/evidence/receipt.json"
```

The verifier creates a temporary simulator, opens the app and retrieves its receipt. It compares the JSC frame hashes for ticks 0 and 7 with captures from the original Node fixture. With a Metal device it also requires four reference pixels, a changed animation frame, a missing-page error after release, byte-identical restored pixels and a presentation callback from the layer. Closing the JS scene must release one atlas. The receipt records an unavailable simulator GPU separately. Physical iPhone signing, actual background/foreground behavior, thermal load and frame times require a phone run.

## Native boundary

`egret_frame2d_create/page/decode/destroy` in `runtime-sdk/native/include/egret_frame2d.h` use a decoder owned by one render thread. Slots 1–255 register validated dimensions after a successful GPU upload. Slot 0 is white for solid primitives. A zero size releases an existing slot. A decoded frame borrows the decoder's vertex and draw storage until the next decode or destruction. Each draw carries its texture page, vertex range, opacity, UV crop and top-left physical scissor. A failed decode clears the output view.

The first Metal profile accepts normal, nearest-sampled project quads over an opaque clear, including texture alpha, crop and axis-aligned clips. EGR3–EGR6, text input, audio, touch controls and native World3D remain outside the current iOS implementation. The sample models background resource reconstruction while the JS game stays alive. Persistence after process termination is a separate capability. The C ABI uses first-party Rust code and the host uses Apple system frameworks. [JavaScriptCore](https://developer.apple.com/documentation/javascriptcore) · [MetalKit](https://developer.apple.com/documentation/metalkit/mtkview)
