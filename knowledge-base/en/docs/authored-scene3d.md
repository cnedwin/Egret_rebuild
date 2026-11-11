# Authored 3D scenes and engine roadmap

English | [简体中文](../../Cns/docs/authored-scene3d.md)

## Scene, camera and asset ownership

Egret's optional `@egret/engine/scene3d/authoring` entry creates immutable, editable scene revisions. A node has a stable ID, an optional parent, a column-major affine local transform and references to owned meshes. A revision resolves the hierarchy and keeps mesh identity across instances and edits. `withNodeTransform(id, matrix)` returns a new revision. Saved worlds, frames and the UI display list remain usable. The authored scene admits at most 64 mesh draws across at most 256 nodes, with the existing frame geometry and uniform budgets.

`createSceneCamera3D` accepts eye, target and optional up vectors and either a perspective or orthographic projection. Perspective field of view is vertical and measured in radians. Orthographic height is the full vertical span. Both projections use an explicit aspect, near and far. The camera uses a right-handed view with negative forward Z. Capture composes the world, view and reverse-depth projection in binary64, then rounds the final MVP once to finite normal float32 or exact zero. Values that overflow, underflow to zero or lack existing arithmetic headroom are refused. The original scene capture keeps its established exact binary32 admission.

`capture(camera)` produces a genuine `SceneFrame3D` for either existing shared scene host. The renderer draws the opaque depth pass before the normal 2D overlay. Meshes and camera remain CPU-owned so the application can submit a new frame after the host recovers. The host still owns buffers and GPU state. The first version reuses native mesh buffer pools and currently rewrites mesh contents per submission.

## Static GLB profile

`loadStaticGlbScene3D(bytes)` accepts one self-contained GLB 2.0 asset up to 8 MiB, with one scene and one embedded binary buffer. Each selected mesh primitive uses tightly packed float32 positions, unsigned 16- or 32-bit triangle indices and optional tightly packed float32 linear RGB vertex colors. It requires a double-sided, opaque `KHR_materials_unlit` material. Materials and vertex colors combine in linear space; the result converts once to the scene's established sRGB vertex representation. Meshes used by multiple nodes share geometry. Node matrices and TRS are supported; imported IDs are `gltf-node-<source index>`.

The bounded import profile admits at most 64 nodes, draws and unique primitives, 192 buffer views and accessors, and a 512 KiB JSON chunk. Unsupported profile features such as external URIs, textures, skinning, animation, compression, sparse data, strided attributes, single-sided or blended materials receive a structured refusal. Applications can pass bytes from their existing verified asset provider, and hold the resulting world revision with the existing AssetManager/Scope lease. A malformed replacement leaves the last published world usable. This entry parses supplied bytes synchronously, while fetching, cancellation, hash validation and revision publication belong to the existing resource owner.

Run `node tools/serve-example.mjs` and open `/examples/authored-scene3d/index.html?backend=webgl2` or change the backend to `webgpu`. The sample builds its own small GLB and demonstrates camera movement and parented model edits. Use `node tools/verify-authored-scene3d.mjs <playwright-root> <fresh-output>` for the browser reference. The Edge reference matched both backends byte for byte for reversed model order, foreground/background depth, node edits, camera orbit, orthographic view and the 2D HUD. Physical Android Chrome passed the same reference using the final camera and parser build on both backends. Its six captures per backend match the desktop output byte for byte. These are functional observations.

## Remaining 3D work

| Increment | Engine decision and required proof |
| --- | --- |
| 2D characters in a 3D world | Add a world-space textured card that shares the opaque scene depth, reads textures through existing owned image leases and writes depth only for admitted cutout pixels. Keep the ordinary HUD pass after it. Verify a character crossing behind and in front of the same imported building on both backends, including transparent edges and restoration. |
| Textured models, materials and light | Extend the imported profile with explicit UVs, normals, image semantics and a versioned material contract. Use linear light with a single output conversion; share texture and device lifetime. Test authored color reference, normal direction, exposure range, and distinct opaque, cutout and blended policy. |
| Animated 3D actors and scene effects | Use the existing game clock for clips, poses and events. Adopt per-instance state and share immutable mesh/skin data. Integrate bounded scene effects with the existing pass order and capability limits. Verify complete model-to-preview editing, asset replacement and recovery, plus declared device and frame budgets. |

Three.js is a reference for separating asset decoding, scene authoring, render passes and color management. Egret uses its own implementation, scene identity, backends and lifecycle. The GLB format and selected material extension follow Khronos. [Three.js model loading](https://threejs.org/docs/pages/GLTFLoader.html) · [Three.js color management](https://threejs.org/manual/pages/color-management.html) · [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [KHR_materials_unlit](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit)
