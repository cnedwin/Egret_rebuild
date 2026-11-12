# Jelly Pandas

English | [简体中文](README.zh-CN.md)

Jelly Pandas is a complete small game built on `@egret/engine/world3d`: see-through jelly pandas hold a toy island for fifteen minutes against a growing horde of candy. Toys fire on their own, the panda's wobbly body is a weapon too, every level brings an upgrade card, and three bosses arrive at 5, 10 and 15 minutes. It exercises the engine the way a real project does: physics, character movement, instancing, see-through materials, particles, shadows and post-processing all run together under one Engine clock.

The game follows the design of [Jiggle Kings](https://github.com/gamesbyai/jiggle-kings) by GamesByAI, whose repository publishes the built game only. Nothing was copied from it: the code, shapes, names, numbers and text here were written for this example, and the characters are pandas in eight colours and belly patterns.

## Run

Use Node.js 26.7.0 and pnpm 11.25.0 from the repository root:

    pnpm setup:dev
    pnpm example:browser

Open `http://127.0.0.1:4173/examples/jelly-pandas/index.html`. The game is made for a desktop browser with a keyboard and mouse or a gamepad.

| | Keyboard and mouse | Gamepad |
|---|---|---|
| Move | W A S D or arrows | left stick |
| Look | mouse | right stick |
| Jump (hold for a super jump) | Space | A |
| Slam in the air, belly bump on the ground | Ctrl, left click or Q | B |
| Roll | Shift, right click or E | X |
| Pick a card | 1 to 3, R rerolls | direction pad left, up, right; Y rerolls |
| Menu | Esc or P | Start |

Address options: `?backend=webgpu` draws with WebGPU, `?lang=en` or `?lang=zh` sets the language, `?jelly=0` swaps the see-through bodies for plain glossy ones, `?post=0` turns post-processing off, `?shadows=0` turns shadows off, `?reflect=0` turns the water's mirror image off, and `?ratio=1` lowers the drawing resolution.

## What is in it

- Eight pandas, each with its own colour, belly pattern and first toy. Play alone or with one to three friends steered by the game; a fallen panda is revived by standing next to it.
- Twelve toys with eight levels and an evolution each (reach the top level and own the matching charm), and twelve charms with five levels.
- Seven kinds of candy, crowned elites that drop a chest, a surge every two and a half minutes, and three bosses.
- Body moves: a charged super jump, a slam that grows with the height of the fall, a belly bump and a roll.
- Enemies are thrown into the air, hurt by the fall and drowned in the sea. Beach balls and barrels are rigid bodies that can be shoved into the crowd.

## How it uses the engine

| Part | Engine feature |
|---|---|
| Pandas walking, jumping and pushing props | `createCharacterMotor3D` on a `PhysicsWorld3D` |
| Island collision | static triangle-mesh body from `createMeshShape3D` |
| Beach balls and barrels | dynamic sphere and convex-hull bodies |
| Jelly bodies | `createGlassMaterial3D` with a painted pattern texture |
| The horde, shots, sprinkles, palms | `InstancedMesh3D` with per-instance colour |
| The sea | `createWater3D` with waves and a mirror image of the scene |
| Effects | `createParticleEmitter3D` bursts and additive rings |
| Camera | `createFollowCamera3D` |
| Frame loop | `createWorld3DView` and `startWorld3DLoop` on the Engine clock |
| Look | cascaded shadows, gradient sky and environment, bloom and FXAA |

The simulation (`sim.mjs`, `toys.mjs`, `island.mjs`, `data.mjs`) needs no page. `view.mjs` and `panda.mjs` draw it, `hud.mjs` builds the page around the canvas, and `input.mjs` and `audio.mjs` handle devices and sound. Up to 260 enemies are alive at once; they follow a lighter model than the rigid bodies, on the same height grid the island mesh is built from.

## Play it without a page

    node examples/jelly-pandas/headless.mjs 4 7

plays a whole run with four pandas steered by the friends' rules (party size, seed and minutes are optional) and prints one line per minute. It is the quickest way to check a change to the rules or the numbers.

## Limits

- Solo and friends steered by the game only. Jiggle Kings also has online play through a separate server; that is not part of this example.
- Checked on WebGL2 in headless Chromium with software rendering: title, play, level-up cards, a boss and the end screen, with keyboard input. It has not been run on a physical GPU, through WebGPU, with a gamepad or by a person, so frame rate and the feel of the controls are open.
- The difficulty was tuned with the headless runs. Pandas steered by those rules last about ten minutes alone and reach the last boss as a party of four; nobody has played it by hand yet.
- Sound effects are made with Web Audio; there is no music. Touch controls are not provided.
