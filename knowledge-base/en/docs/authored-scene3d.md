# Authored 3D scenes and engine roadmap

English | [简体中文](../../Cns/docs/authored-scene3d.md)

## Scene, camera and asset ownership

Egret's optional `@egret/engine/scene3d/authoring` entry creates immutable, editable scene revisions. A node has a stable ID, an optional parent, a column-major affine local transform and references to owned meshes. A revision resolves the hierarchy and keeps mesh identity across instances and edits. `withNodeTransform(id, matrix)` returns a new revision. Saved worlds, frames and the UI display list remain usable. The authored scene admits at most 64 combined mesh and card draws across at most 256 nodes, with the existing frame geometry and uniform budgets.

`createSceneCamera3D` accepts eye, target and optional up vectors and either a perspective or orthographic projection. Perspective field of view is vertical and measured in radians. Orthographic height is the full vertical span. Both projections use an explicit aspect, near and far. The camera uses a right-handed view with negative forward Z. Capture composes the world, view and reverse-depth projection in binary64, then rounds the final MVP once to finite normal float32 or exact zero. Values that overflow, underflow to zero or lack existing arithmetic headroom are refused. The original scene capture keeps its established exact binary32 admission.

`capture(camera)` produces a genuine `SceneFrame3D` for either existing shared scene host. The renderer draws the opaque depth pass before the normal 2D overlay. Meshes and camera remain CPU-owned so the application can submit a new frame after the host recovers. The host still owns buffers and GPU state. The first version reuses native mesh buffer pools and currently rewrites mesh contents per submission.

## Static GLB profile

`loadStaticGlbScene3D(bytes)` accepts one self-contained GLB 2.0 asset up to 8 MiB, with one scene and one embedded binary buffer. Each selected mesh primitive uses tightly packed float32 positions, unsigned 16- or 32-bit triangle indices and optional tightly packed float32 linear RGB vertex colors. It requires a double-sided, opaque `KHR_materials_unlit` material. Materials and vertex colors combine in linear space; the result converts once to the scene's established sRGB vertex representation. Meshes used by multiple nodes share geometry. Node matrices and TRS are supported; imported IDs are `gltf-node-<source index>`.

The bounded import profile admits at most 64 nodes, draws and unique primitives, 192 buffer views and accessors, and a 512 KiB JSON chunk. Unsupported profile features such as external URIs, textures, skinning, animation, compression, sparse data, strided attributes, single-sided or blended materials receive a structured refusal. Applications can pass bytes from their existing verified asset provider, and hold the resulting world revision with the existing AssetManager/Scope lease. A malformed replacement leaves the last published world usable. This entry parses supplied bytes synchronously, while fetching, cancellation, hash validation and revision publication belong to the existing resource owner.

Run `node tools/serve-example.mjs` and open `/examples/authored-scene3d/index.html?backend=webgl2` or change the backend to `webgpu`. The sample builds its own small GLB and demonstrates camera movement and parented model edits. Use `node tools/verify-authored-scene3d.mjs <playwright-root> <fresh-output>` for the browser reference. The Edge reference matched both backends byte for byte for reversed model order, foreground/background depth, node edits, camera orbit, orthographic view and the 2D HUD. Physical Android Chrome passed the same reference using the final camera and parser build on both backends. Its six captures per backend match the desktop output byte for byte. These are functional observations.

## Opaque textured GLB

Use `prepareTexturedStaticGlbScene3D(bytes)` for a bounded static model with a base-color texture. Each textured primitive uses one tightly packed float32 `TEXCOORD_0`, an opaque double-sided `KHR_materials_unlit` material, and an embedded noninterlaced RGB8 PNG. The sampler explicitly selects nearest minification and magnification with clamp-to-edge on both axes. UV origin is the top left. Models with default repeat, a second texture-coordinate set, RGBA images, external image references, or other material modes receive a structured refusal.

The plan exposes indexed image requests. Each `copyBytes()` returns a fresh copy for the existing PNG provider. Acquire the decoded texture through the application's AssetManager and Scope. Pass its `imageData` to `plan.bindImages([{ imageIndex, source }, ...])` only after every image is ready. Binding checks image identity, dimensions and full opacity before publishing a world revision. The byte provider and decoder establish the correspondence between the supplied image and the embedded PNG. Applications keep the source leases while using the world and can publish a replacement after all its images bind successfully.

Each embedded image has a 4 MiB encoded limit, a maximum edge of 4096 and a limit of 1,048,576 pixels. A plan admits up to 6 MiB of embedded PNG bytes and 4,194,304 decoded pixels across the asset. The UV stream adds eight bytes per vertex to the native geometry budget. Shared WebGL2 and WebGPU use the existing image-page owner and reversed-depth pass. Base color and vertex factors multiply in linear RGB before output conversion. Shared texture identity allows a mesh, a cutout card and the HUD to use one native page.

Run `node tools/serve-example.mjs` and open `/examples/textured-scene3d/index.html?backend=webgl2` or select `webgpu`. Use `node tools/verify-textured-glb-scene3d.mjs <playwright-root> <new-output-directory>` for the desktop reference. The generated room uses a four-color PNG and moves a 2D card in front of and behind the wall. Desktop Edge and physical Android Chrome matched all six named pixels and all five readbacks on both backends for this fixture. The first frame uploaded one page, warm frames uploaded none, and the first submission after native device recovery uploaded one. This evidence covers the documented profile and lifecycle.

## Authored directional light

Use `prepareLambertStaticGlbScene3D(bytes)` to opt into Egret's opaque diffuse material. It follows the textured GLB profile and requires tightly packed, unit-length float32 `NORMAL` attributes on textured primitives. Supply the same leased images to `plan.bindImages(bindings, lighting)`. Lighting contains a world-space `direction` toward the light and two nonnegative linear scalars, `ambient` and `intensity`, whose sum is at most one. Untextured primitives keep their unlit material.

`world.withLighting(lighting)` publishes a new light revision and reuses its geometry, images and prepared normal transforms. A node edit recomputes the affected world transform. The engine uses a scaled inverse transpose for normals, accounts for reflected winding and flips authored back-face normals for double-sided lighting. A singular or ill-conditioned lit transform is rejected before a new revision can replace a saved one. An interpolated normal that cancels to zero receives ambient light.

The lit pass multiplies the linear base color by `ambient + intensity * max(0, dot(normal, direction))`. It shares the existing opaque scene depth, texture pages, device lifecycle and later HUD pass. Lighting adds 12 native bytes and 24 CPU logical bytes per vertex. A lit draw uses a 128-byte uniform and shares the existing 4096-byte frame uniform budget with unlit geometry and cards. The renderer exposes this separate Egret material on request. The standard glTF metallic-roughness material and shadows remain future work.

Run `node tools/verify-lambert-glb-scene3d.mjs <playwright-root> <new-output-directory>` for the browser reference. Desktop Edge and physical Android Chrome matched all eight readbacks on both backends for this generated model. The slope under nonuniform scale reads 252, the back face under ambient light reads 137, and the mirrored front and relit back read 255. The WebGL2 reference begins with the context's front face set to clockwise before creating the host. The first frame and the first submission after native device recovery each upload one shared page. Warm frames upload none. [Three.js diffuse material](https://threejs.org/docs/pages/MeshLambertMaterial.html) · [Normal matrix reference](https://threejs.org/docs/pages/Matrix3.html#getNormalMatrix)

## Depth-tested 2D characters

`createSceneWorldCard3D({ source, width, height, region, pivotX, pivotY, alphaCutoff })` creates an immutable image card. Supply an owned `ImageData2D` from the existing asset lease. Width and height use world units. The optional atlas region uses top-left pixel coordinates. Pivot coordinates are relative to the crop and may extend outside it. The default pivot is bottom center. The alpha cutoff is the first accepted byte, from 1 to 255, with a default of 128.

Attach cards to a node with its `cards` field. Use `world.withNodes([...])` to append nodes to a new revision, including one loaded from a GLB. Node transforms place and orient the cards. WebGL2 and WebGPU draw them with the opaque scene's depth buffer. Pixels below the alpha cutoff are discarded before they can write depth. Accepted pixels reconstruct straight RGB from the canonical premultiplied page and write full opacity. The ordinary HUD is composed afterward. This profile supports nearest-sampled cutouts with an explicit orientation.

Cards, HUD images and atlas crops share the existing image storage, preparation limits and device lifecycle. Two cards using the same source image share one page, even when they sample different crops. The application holds the image lease while it uses the card. On the first submission after device recovery, the host recreates the GPU pages from owned CPU data. Use the shared scene host and submission path to draw card-bearing frames.


```ts
import { createSceneWorldCard3D } from "@egret/engine/scene3d/authoring";

const card = createSceneWorldCard3D({
  source: actorImage,
  width: 1,
  height: 1.5,
  region: { x: 32, y: 0, width: 32, height: 48 },
});
const revision = world.withNodes([{
  id: "actor",
  localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 4, 1],
  cards: [card],
}]);
const frame = revision.capture(camera);
```

Run `node tools/verify-world-depth-cards.mjs <playwright-root> <new-output-directory>` to verify the original generated GLB and atlas fixture on both backends. It checks occlusion in front of and behind the building, transparent holes, atlas coordinates, alpha cutoff, the HUD, staged and direct submissions, upload reuse, and native loss and recovery. Named witness pixels test cross-backend behavior. Raster coverage and nearest sampling at exact ties can differ between implementations.

On desktop Edge and physical Android Chrome, both backends passed all nine witness checks. Staged, immediate, reversed-order and restored submissions matched byte for byte within each host in the applicable scene. The fixture observed two cold uploads, no warm uploads, and two uploads after native device recovery. These are functional and lifecycle results.

## Remaining 3D work

| Increment | Engine decision and required proof |
| --- | --- |
| Additional light and material profiles | Extend the imported profile with explicit UVs, normals, image semantics and a versioned material contract. Use linear light with a single output conversion; share texture and device lifetime. Test authored color reference, normal direction, exposure range, and distinct opaque, cutout and blended policy. |
| Animated 3D actors and scene effects | Use the existing game clock for clips, poses and events. Adopt per-instance state and share immutable mesh/skin data. Integrate bounded scene effects with the existing pass order and capability limits. Verify complete model-to-preview editing, asset replacement and recovery, plus declared device and frame budgets. |

Three.js is a reference for separating asset decoding, scene authoring, render passes and color management. Egret uses its own implementation, scene identity, backends and lifecycle. The GLB format and selected material extension follow Khronos. [Three.js model loading](https://threejs.org/docs/pages/GLTFLoader.html) · [Three.js color management](https://threejs.org/manual/pages/color-management.html) · [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [KHR_materials_unlit](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit)
