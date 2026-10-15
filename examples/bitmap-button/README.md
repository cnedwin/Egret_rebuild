# Shared-input bitmap buttons

English | [简体中文](README.zh-CN.md)

This original example creates two genuine scoped Buttons over one shared MouseInput and one borrowed atlas lease. Red, blue and gray indicate up, pressed and disabled. Controls expose enable/disable, dispose/recreate, isolated/two-button layout, saved-up replay, current presentation and Close.

Run `node tools/build.mjs`, serve the repository root over ordinary local HTTP, then open `/examples/bitmap-button/`. Canvas is default; select WebGPU explicitly. Unavailable startup is shown without silently switching backend. Navigation awaits the current Engine close chain.

Preview is 192×128. `?preset=verification&backend=canvas` selects the fixed 24×24 DPR-1 fixture; backend=webgpu selects the same profile. It supports independent pixel checks, not a performance benchmark.

Public input routes queue one coalesced application microtask to capture committed state. Saved replay submits the original saved-up frame without changing live Button state or activation counters. The verification-only WebGPU Host adapter arms its original public readback before each original submission. No product export or diagnostic hook is added.

Control Scopes retire before input/resource Scopes; Close awaits startup, provider work and Engine disposal. The atlas uses original programmatic pixels; the example adds no automatic game clock or dependency. Read the [contract](../../knowledge-base/en/docs/bitmap-button-contract.md) and [evidence](../../knowledge-base/en/docs/bitmap-button-evidence.md).
