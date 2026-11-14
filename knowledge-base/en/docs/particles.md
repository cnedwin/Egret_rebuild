# 2D particles

English | [简体中文](../../Cns/docs/particles.md)

`@egret/engine/particles` makes streams of particles — fire, smoke, sparks, falling petals, dust — each drawn as one mesh over one texture on the shared renderer. It keeps no clock: the game calls `update(seconds)` once a frame. It is an optional entry: a game that does not import it loads nothing of it.

**What is checked and what is not.** Emitters are checked in Node on a real Engine with a leased texture, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/particles/README.md) in headless Chromium with software WebGL2, where colours are read from the canvas. No hardware GPU or phone was run, and no frame rate was measured. See [What was run](#what-was-run).

## Use

```js
import { createParticleEmitter } from '@egret/engine/particles';

const fire = scope.use(createParticleEmitter({
  texture: dotLease, rate: 90, lifetime: [0.6, 1.1], speed: [30, 70], angle: [250, 290],
  gravity: { x: 0, y: -40 }, size: 18, endScale: 0.2, startColor: 0xffd34d, endColor: 0xd23a1e, endAlpha: 0,
  shape: { kind: 'rectangle', width: 44, height: 6 },
}));
world.addChild(fire.display);
fire.x = 140; fire.y = 182;

function frame(seconds) { fire.update(seconds); engine.renderSharedFrame(frameOptions); }
```

A range is a number, or two numbers between which each particle picks evenly.

| Option | Meaning | Default |
| --- | --- | --- |
| `texture` | A leased texture: the whole of it is the image of each particle | — |
| `maxParticles` | The most alive at once, up to 16,384; more are counted as refused | 512 |
| `rate`, `running`, `duration` | Particles born each second while it runs; whether it starts running; seconds after which it stops by itself | 50, true, none |
| `lifetime`, `speed`, `angle` | Seconds a particle lives; units a second; degrees it sets off in, 0 right and 90 down | 1, 100, 0 to 360 |
| `gravity`, `drag` | Units a second, every second; the share of its speed it loses each second, the same whatever the steps | none, 0 |
| `size`, `startScale`, `endScale` | Its width and height at the scale of 1; the scale it is born and dies with | 8, 1, 1 |
| `startAlpha`, `endAlpha`, `startColor`, `endColor` | Its alpha and tint, born and dying | 1, 0, white, white |
| `rotation`, `spin` | Degrees it is born turned by, and turns by each second | 0, 0 |
| `shape` | Where it is born around the emitter: a `point`, a `rectangle` of a width and height, or a `circle` of a radius, over its area or on its `edge` | point |
| `seed` | The same seed gives the same particles for the same updates | 1 |

`x` and `y` are the place of the emitter inside its display; a particle stays where it was born when the emitter moves. `start()`, `stop()` (those alive live out their lives), `burst(count)`, `clear()`, `alive`, `snapshot()` and `particles()` (each particle alive, for checks and tools).

The colour and alpha of a particle are the colour of its vertices, which the renderer multiplies with the texture. Blending is the renderer's ordinary blending: there is no additive blending yet, so overlapping flames are as bright as the brightest, not brighter.

## Errors

| Code | When |
| --- | --- |
| `PARTICLE_OPTIONS_INVALID` | An option or an argument is not what it may be |
| `PARTICLE_CLOSED` | The emitter was disposed |
| `PARTICLE_CLEANUP_FAILED` | Letting go of the mesh failed |

## What was run

| What | Where | Result |
| --- | --- | --- |
| Emission by rate across updates, lifetimes, the most alive, motion under gravity and drag at any step, what a particle is born and dies with, the mesh corner by corner, shapes, seeds, durations, disposal, edges of options, a strict TypeScript consumer with five refused misuses, and the exports | Node, [`tests/particles.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/particles.test.mjs) | 13 cases |
| Every comparison, boolean and logical operator of the built module changed one at a time | Node | 122 changes, 122 caught |
| The example: the first frame, a brazier that burns the same way for the same steps, petals that fall, sparks where a press is, the fire put out and lit again, real time, a tap on a phone profile | Headless Chromium 153, software WebGL2 | 7 scenarios |
| A hardware GPU, a real phone, the cost of thousands of particles a frame | — | Not run |

## Not in this slice

- Additive and other blend modes; frames of a sprite sheet over a particle's life; particles that collide; emitters that follow a path.
