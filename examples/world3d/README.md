# World3D example

English | [简体中文](README.zh-CN.md)

This example builds a retained 3D scene with `@egret/engine/world3d` and draws it with the WebGL2 or WebGPU renderer. The explicit Engine clock drives animation and rendering through `createWorld3DView`.

## Run

Use Node.js 26.7.0 and pnpm 11.25.0 from the repository root:

    pnpm setup:dev
    pnpm example:browser

Open `http://127.0.0.1:4173/examples/world3d/index.html`. Add `?backend=webgpu` or use the link in the header to switch backends.

## What it shows

- Standard, Phong, Lambert and unlit materials under a directional light, a spot light and a point light, with a procedural sky used as background and environment.
- Shadows from the directional and spot lights.
- 400 instanced pillars with per-instance colors.
- A column skinned to four bones and animated by a clip, and a sphere with a morph target.
- A particle emitter and a sprite.
- A second camera rendering into a render target shown on a screen in the scene.
- Orbit, pan and zoom with mouse or touch. Click an object to highlight it.

The header buttons toggle shadows, particles and wireframe. The status line reports draw calls, triangles and live particles.

## Feature gallery

Open `http://127.0.0.1:4173/examples/world3d/features.html` (or follow the link in the header) for the newer features in one scene. The header buttons move the camera between five areas:

- **Surfaces**: thin, solid and frosted glass that bends and tints the checker wall behind it, velvet sheen, clearcoat, toon shading, a light map on a second coordinate set, 240 batched pebbles drawn in one call, a wide line, and extruded text. "Font" loads any TrueType file and "Text" rewrites the title with it, including Chinese, Japanese and Korean fonts.
- **Physics**: a crate pyramid, convex-hull rocks, a rope of weights, a hinged door with limits and a motor, a moving platform that carries a crate, and a thin glass wall. "Shoot" fires fast projectiles with continuous collision from the camera.
- **Character**: a capsule character with a follow camera. W A S D or the arrow keys walk relative to the view, Shift runs and Space jumps. It climbs the stairs, walks down the ramp, pushes the crates, and is carried by the turntable and the ferry; the camera moves in when the wall comes between it and the character. This area needs a keyboard.
- **Crowd**: 48 walkers on a navigation mesh built from a yard with pillars and a wall. Each picks a random place, walks there around the obstacles and the other walkers, and picks another. "Nav mesh" shows the mesh.
- **Editing**: click an object to select it; it is outlined and gets a transform gizmo. "Move", "Turn" and "Size" switch the handles and "World/Local" their orientation.

"Post", "SSAO", "Depth of field" and "Shadows" toggle those effects. The gallery was run on WebGL2 in headless Chromium with software rendering, including handle drags with real pointer events; it has not been run on a physical GPU or through WebGPU canvas presentation, and no person has operated it by hand yet.

## Landscape

Open `http://127.0.0.1:4173/examples/world3d/landscape.html` for a height-map terrain and a lake. The terrain is 257 by 257 samples in 64 chunks; the status line shows how many of its triangles are drawn at the current detail levels, and "Wireframe" shows the levels and the skirts between them. The same heights are the collision shape the balls and crates land on; "Drop" adds more. The lake has waves, bends what lies under it and mirrors the scene; "Reflection" switches the mirror image off, leaving the sky's reflection, and "Calm" flattens the waves. The buoy rides the waves through the CPU copy of the wave formula. Six hundred box figures walk, pause, look around and wave on the dry ground; they are one draw call, posed from three clips baked into an animation texture. Height fog pools in the basin, with light shafts when the view turns toward the sun ("Fog" switches both off); mist over the lake and the smoke and sparks of a campfire are GPU particles, the mist and smoke fading softly where they meet the ground; a light circles the lake with a trail behind it; and "Stamp" lays a painted ring onto the terrain near the view's center as a decal.

The page was run on WebGL2 in headless Chromium with software rendering. It has not been run on a physical GPU or through WebGPU canvas presentation, and no person has operated it.

The ground is four tiling textures blended by a weight map. The water darkens with depth, foams along its shore and shows caustics in the shallows; move the camera below the surface and the view turns to blue fog. Heads in the crowd turn on their own, clip changes cross-fade, and the status line shows how many of the 600 figures are drawn after those outside the view are left out. Sparks bounce off the ground, smoke and mist are drawn back to front, and "Volumetric" swaps the screen-space fog for fog lit through the sun's shadow map.

## Limits

The example demonstrates rendering and interaction. The desktop Edge and physical Android Chrome checks observed visible output, shadow toggles, and disposal on both backends. Performance, human gestures and broader device coverage remain open. See the [World3D contract](../../knowledge-base/en/docs/world3d.md) for scope and open items.
