#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
if [[ $# -ne 3 || ( $1 != simulator && $1 != device ) ]]; then
  echo 'Usage: bash runtime-sdk/ios/build.sh simulator|device /absolute/output /absolute/prepared-scene' >&2
  exit 2
fi
kind=$1
output=$2
scene=$3
root=$(cd "$(dirname "$0")/../.." && pwd)
if [[ $output != /* || $scene != /* || ! -f $scene/scene.js ]]; then
  echo 'Supply absolute output and prepared scene paths.' >&2
  exit 2
fi
if [[ $kind == device ]]; then
  sdk=iphoneos
  arch=arm64
  target=aarch64-apple-ios
elif [[ $(uname -m) == arm64 ]]; then
  sdk=iphonesimulator
  arch=arm64
  target=aarch64-apple-ios-sim
else
  sdk=iphonesimulator
  arch=x86_64
  target=x86_64-apple-ios
fi
# A device archive is explicitly unsigned. Use the generated Xcode project to choose a team and sign locally.
export IPHONEOS_DEPLOYMENT_TARGET=16.4
cargo build --locked --offline --release --manifest-path "$root/runtime-sdk/native/Cargo.toml" \
  --target "$target" --target-dir "$output/rust"
cmake -S "$root/runtime-sdk/ios" -B "$output/$kind" -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_SYSROOT="$sdk" -DCMAKE_OSX_ARCHITECTURES="$arch" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET="$IPHONEOS_DEPLOYMENT_TARGET" -DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY \
  -DEGRET_RUST_LIBRARY="$output/rust/$target/release/libegret_runtime_native.a" -DEGRET_SCENE_DIR="$scene" \
  -DEGRET_BUNDLE_ID="${EGRET_BUNDLE_ID:-org.egret.runtime.ios.sample}"
xcodebuild -project "$output/$kind/EgretIosPlayer.xcodeproj" -scheme EgretPlayer \
  -configuration Release -sdk "$sdk" -destination "generic/platform=$(if [[ $kind == device ]]; then echo 'iOS'; else echo 'iOS Simulator'; fi)" \
  CONFIGURATION_BUILD_DIR="$output/$kind/product" CODE_SIGNING_ALLOWED=NO build
test -x "$output/$kind/product/EgretPlayer.app/EgretPlayer"
