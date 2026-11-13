# JY battle 133 ANGLE diagnostics

English | [简体中文](README.zh-CN.md)

## Status

The investigation is paused. A dedicated Ubuntu 24.04.5 WSL2 environment retains the downloaded dependencies and incremental build. Chromium 157.0.8103.78 is pinned to `4b3d0dabb8250b6f152d2d85d79e7706e309d087`. Its ANGLE dependency is `c56e2a4a9b8cb0040920c995a268be559ba53f1c`. Both probe objects compiled for AArch64 and contain their event names. At the manual interrupt, Siso reported 31,846 completed build actions, zero failed actions and 43,653 remaining. The full APK has yet to be built, installed or tested.

Previous original-order Fold7 traces captured EGL fence creation at 22.932 and 27.659 ms near 5.574 s after the first skill target tap. The two subsequent native Flush calls in those batches took 5 and 1 µs. Whether the older 70–71 ms spike and these intervals share a driver function or lock remains open.

## Resume

1. Reuse the isolated Linux checkout at `/opt/jy133-build/src`. The build script expects the verified Chromium checkout and depot_tools under `/opt/jy133-build`. Use the existing Linux script copy or make a new fixed copy before running. Pass the ANGLE patch as the first argument and an absolute artifact directory containing `isolated-browser-launch.diff` as the second. The script reuses synchronized dependencies and incremental compiler outputs.
2. Verify the ARM64 APK, isolated package `org.chromium.chrome`, shell profileability and matching Build IDs for its native library and unstripped symbols. For the installer, set `JY_ADB` and `JY_PHONE_LOCK` to the absolute ADB path and the existing shared device lease path. Pass the artifact directory to `node install-diagnostic.mjs`. The installer stops if the phone is reserved or the lab package already exists.
3. Use the existing private battle fixture and phone route. Confirm the actual GPU path is ANGLE OpenGL ES 3.2 on Adreno 830 with driver 0800.64.8, with both probes appearing on the expected GPU thread. Run with the complete HUD and the original draw, fence, Flush and error-check sequence. Do not add a Flush. Pair the browser capture with the BOOTTIME Perfetto configuration, replacing `JY_GPU_PID` with the lab GPU PID.
4. Run `node analyze-angle-stacks.mjs <capture-dir> <trace-processor> [rounds]` on the paired captures. Confirm clock alignment and sample coverage. Match driver frames by module Build ID and relative PC. A shared lock requires evidence of the same wait object or lock address and owner. Make an engine change only after identifying an actionable cause and verifying it on the phone.

The branch carries the diagnostic patches and reusable tools. The original game fixture, phone captures and Linux build cache stay in the local workspace.

## Sources

- [Pinned Chromium Android build instructions](https://github.com/chromium/chromium/blob/4b3d0dabb8250b6f152d2d85d79e7706e309d087/docs/android_build_instructions.md)
- [Pinned ANGLE Android setup](https://github.com/google/angle/blob/c56e2a4a9b8cb0040920c995a268be559ba53f1c/doc/DevSetupAndroid.md)
- [Perfetto scheduler data](https://perfetto.dev/docs/data-sources/cpu-scheduling)

The patch context is from Chromium and ANGLE at the revisions above. Their existing license notices apply to the upstream files. The diagnostic instrumentation and supporting scripts are authored for this investigation.
