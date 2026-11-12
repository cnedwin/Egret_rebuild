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

## Limits

The example demonstrates rendering and interaction. The desktop Edge and physical Android Chrome checks observed visible output, shadow toggles, and disposal on both backends. Performance, human gestures and broader device coverage remain open. See the [World3D contract](../../knowledge-base/en/docs/world3d.md) for scope and open items.
