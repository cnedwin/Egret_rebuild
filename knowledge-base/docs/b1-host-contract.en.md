# B1 scene Host contract

[简体中文](b1-host-contract.zh-CN.md) · [Verification evidence](b1-host-evidence.en.md)

Egret's first-party B1 Host joins a bounded 3D mesh pass with the existing 2D rectangle/image pass under one lifecycle and submission owner. This is an internal engineering slice. `createB1WebGPUHost`, `renderSceneFrame` and `getSceneStatus` are not exported by the package entry barrels; their current source signatures do not establish a stable public API.

## Admission and ownership

The B1 entry in `packages/engine/web/b1.ts` accepts the existing `WebGPUHostOptions`. B1 mode belongs to a private closure; options cannot install a loader, protocol or renderer callback. The Host in `packages/engine/web/WebGPUHost.ts` observes its literal `import('./b1.js')` during B1 startup. Ordinary WebGPU hosts have no scene methods, including on their prototype chain. Importing the explicit B1 entry can already evaluate and cache its dependencies.

The frozen built-in protocol has one version field and seven fixed function references. Protocol and scene admission use actual module-owned identity before reading foreign scene fields. Frozen copies and proxies do not gain that identity. This mechanism assumes the bound module and dependencies; it does not authenticate replacement loaders or modified source.

Each distinct geometry identity is packed once per frame. Repeated draws share its vertex/index upload; equal contents in separate identities remain separate. Every draw, including an empty draw, has a 64-byte column-major MVP uniform. The current mesh shader consumes position and encoded RGB with an MVP transform; lighting, materials and skinning are outside this slice.

## Frame and resource contract

One target view and encoder record the scene pass first: color clear/store and `depth32float`, reverse depth clear `0`, comparison `greater`, depth writes enabled. The UI pass then loads/stores color without a depth attachment and preserves rectangle/image painter order. Optional readback follows both pass endings; the frame finishes and submits once. The overlay must have `clearAlpha === 1`.

Admission precedes scene packing, GPU mutation and serial/ledger commitment. Scene and UI uploads share the configured upload limits. Fixed B1 limits are:

| Quantity | Per frame | Outstanding |
| --- | ---: | ---: |
| Draws / distinct geometry identities | 64 / 64 | — |
| CPU logical geometry bytes | 8,388,608 | — |
| Packed scene bytes | 4,194,304 | 8,388,608 |
| Scene uniform bytes | 4,096 | 8,192 |
| Logical depth bytes (`4 × width × height`) | 16,777,216 | 33,554,432 |

Configured defaults remain 33,554,432 upload bytes per frame, 67,108,864 outstanding upload bytes and two pending frames. Readback charges aligned staging **plus** output bytes: a 1×1 request charges 260 bytes, so a 259-byte allowance rejects it. Image projection limits remain separately charged. These are logical admission budgets, not measured physical GPU memory.

Resources enter the submission owner before reentrant getters. Attempted queue writes/submission receive a settlement fence even if encoding fails before submission. Unsafe settlement retains accounting until the close path attempts retirement; cleanup can report an unsafe outcome and quarantine an Engine-owned surface. Borrowed devices remain caller-owned. Cancellation preserves and drains the pending B1 startup barrier before any new GPU work.

## Verification boundary

The current evidence covers CPU admission, descriptors, mock GPU calls and fixed-runtime module loading. The corrected default Node test route passed all thirteen Host cases, and the selected combined source set passed whole-repository verification: 901/901 tests plus build, boundary and type gates. The paired evidence distinguishes these results from the earlier isolation-none focused run and the failed default-worker guard attempt. Native shader compilation, pixels, browser/device behavior and performance remain unrun/unverified; fonts, DragonBones and complete project migration are separate open work.
