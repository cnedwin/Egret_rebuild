#!/usr/bin/env bash
set -euo pipefail
umask 022
export PATH="/opt/jy133-build/depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0
export DEPOT_TOOLS_BOOTSTRAP_PYTHON3=0
export GIT_TERMINAL_PROMPT=0
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_0=protocol.version
export GIT_CONFIG_VALUE_0=2
export GIT_CONFIG_KEY_1=http.lowSpeedLimit
export GIT_CONFIG_VALUE_1=1024
export GIT_CONFIG_KEY_2=http.lowSpeedTime
export GIT_CONFIG_VALUE_2=180

work=/opt/jy133-build
chromium=4b3d0dabb8250b6f152d2d85d79e7706e309d087
angle=c56e2a4a9b8cb0040920c995a268be559ba53f1c
patch=$1
output=$2
cd "$work"
exec 9>"$work/build.lock"
flock -n 9
checkpoint() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" | tee "$work/build-stage.txt"; }
check_space() {
  local available linux_available
  linux_available=$(df -Pk / | awk 'NR == 2 {print $4}')
  available=$(df -Pk /mnt/c | awk 'NR == 2 {print $4}')
  if [[ $available -lt $(( 25 * 1024 * 1024 )) || $linux_available -lt $(( 25 * 1024 * 1024 )) ]]; then
    echo "Chromium build stopped to preserve free space on the host or guest." >&2
    exit 75
  fi
}
trap 'rc=$?; printf "%s EXIT %s\n" "$(date -u +%FT%TZ)" "$rc" | tee -a "$work/build-results.txt"' EXIT

[[ "$(git -C src rev-parse HEAD)" == "$chromium" ]]
grep -Fq "$angle" src/DEPS
check_space
if [[ ! -e .gclient ]]; then
  cat > .gclient <<'GCLIENT'
solutions = [
  {
    "name": "src",
    "url": "https://chromium.googlesource.com/chromium/src.git",
    "managed": False,
    "custom_deps": {},
    "custom_vars": {"checkout_pgo_profiles": False},
  },
]
target_os = ["android"]
GCLIENT
fi
checkpoint "sync Android dependencies"
if [[ ! -s .gclient_entries ]]; then
  gclient sync --no-history --nohooks --noprehooks --jobs 12
fi
check_space
[[ "$(git -C src rev-parse HEAD)" == "$chromium" ]]
[[ "$(git -C src/third_party/angle rev-parse HEAD)" == "$angle" ]]
checkpoint "run Chromium dependency hooks"
if [[ ! -e .jy133-hooks-complete ]]; then
  gclient runhooks --jobs 4
  touch .jy133-hooks-complete
fi
check_space
cd src
launch_patch="$output/isolated-browser-launch.diff"
if git apply --check "$launch_patch"; then
  git apply "$launch_patch"
else
  git apply --reverse --check "$launch_patch"
fi
git diff --check
if git -C third_party/angle apply --check "$patch"; then
  git -C third_party/angle apply "$patch"
else
  git -C third_party/angle apply --reverse --check "$patch"
fi
git -C third_party/angle diff --check
git -C third_party/angle diff --stat
checkpoint "configure arm64 profileable Chromium"
gn gen out/JY133Angle --args='target_os="android" target_cpu="arm64" is_debug=false is_component_build=false is_official_build=false debuggable_apks=false dcheck_always_on=false use_static_angle=true android_channel="default" symbol_level=1 blink_symbol_level=0 v8_symbol_level=0'
check_space
checkpoint "compile chrome_public_apk"
autoninja -C out/JY133Angle -j 12 chrome_public_apk
checkpoint "verify and export build"
apk=out/JY133Angle/apks/ChromePublic.apk
test -s "$apk"
unzip -tq "$apk"
sha256sum "$apk"
aapt_tool=$(find third_party/android_sdk/public/build-tools -type f -name aapt -print -quit)
test -x "$aapt_tool"
if [[ -x "$aapt_tool" ]]; then
  "$aapt_tool" dump badging "$apk" | grep -E "^package:|^native-code:" > "$output/apk-badging.txt"
  grep -Fq "name='org.chromium.chrome'" "$output/apk-badging.txt"
  grep -Fq "arm64-v8a" "$output/apk-badging.txt"
  "$aapt_tool" dump xmltree "$apk" AndroidManifest.xml > "$work/apk-manifest.txt"
  grep -A3 -F "E: profileable" "$work/apk-manifest.txt" | tee -a "$output/apk-badging.txt"
fi
symbols=out/JY133Angle/lib.unstripped/libchrome.so
test -s "$symbols"
grep -aFq "JY.ANGLE.DriverEGLCreateSyncKHR" "$symbols"
grep -aFq "JY.ANGLE.DriverGLFlush" "$symbols"
unzip -p "$apk" lib/arm64-v8a/libchrome.so > "$work/apk-libchrome.so"
apk_build_id=$(readelf -n "$work/apk-libchrome.so" | awk '/Build ID:/ {print $3}')
sym_build_id=$(readelf -n "$symbols" | awk '/Build ID:/ {print $3}')
[[ -n "$apk_build_id" && "$apk_build_id" == "$sym_build_id" ]]
printf 'Build ID: %s\n' "$sym_build_id" | tee "$output/libchrome-build-id.txt"
sha256sum "$patch" "$launch_patch" > "$output/probe-source-sha256.txt"
realpath "$symbols" | tee "$output/libchrome-symbols-wsl.txt"
cp "$apk" "$output/ChromePublic-JY133-Angle.apk.partial"
cmp "$apk" "$output/ChromePublic-JY133-Angle.apk.partial"
mv "$output/ChromePublic-JY133-Angle.apk.partial" "$output/ChromePublic-JY133-Angle.apk"
sha256sum "$output/ChromePublic-JY133-Angle.apk"
checkpoint "APK exported"
