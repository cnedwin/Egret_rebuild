# Play3D: a whole small 3D game from one call

English | [简体中文](../../Cns/docs/play3d.md)

`play3d` is [`play`](play.md) with a world of three dimensions under it. One call makes the picture, a camera, a sun and the loop; the game it gives has boxes, balls, cylinders, cones and a ground that are placed by plain numbers, a camera that follows, tests of distance and overlap, and pieces thrown out by a hit. Everything else is what `play` gives, unchanged: keys and a pointer to ask each frame, sound effects made in code, timers, tweens, text, buttons, saves and `restart`. It is exported by `@egret/engine/webgl2/world3d`.

The picture is a [World3D app](world3d-app.md) on a canvas of its own. The interface is a `play` game drawn clear over it, as the [overlay](world3d-app.md) of an app is, so text and buttons are flat and in the units of `width` and `height`.

**What is checked.** Options, the numbers of a thing and the tests of overlap are checked in Node. In headless Chromium on software WebGL2, the game of the [play example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.md) was played by keyboard to its end: the ball landed, rolled to a star, jumped, fell off the edge, and the button started it again. Under software rendering the quality is `low`, so shadows and antialiasing were not drawn. That original full-game run did not cover hardware GPUs.

On November 18, 2026, the contract repairs based on main `ec17a5a2` passed on Windows Edge 157.0.4341.60 / RTX 5090 Laptop and Galaxy Z Fold7 / Android 17 / Chrome 157.0.8103.78 / Adreno 830, each with explicit WebGPU and WebGL2 and no software fallback. OS samples showed Edge in the foreground during capture; the phone stayed awake and unlocked during capture. Protocol mouse/touch on the actual devices changed the centre pixel from RGBA `255,32,64,255` to `32,255,96,255` on all four combinations. The bounded 128 × 96, low-quality World3D fixture also checked offset and mirrored collisions, imported rotation and yaw editing, and a falling ball settling at `y = 0.45`. Each backend/device run completed 24 restarts: five current owned primitives remained live; all five prior primitive geometries/materials retired. Final close also retired the three pooled burst pieces while borrowed model resources remained live. Cleanup refused reentrant box/add/burst operations before borrowed transforms changed, and repeated/reentrant disposal shared one Promise and stopped the native Motion chain. The offscreen target contained visible geometry (6 draws, 972 triangles). These are logical lifecycle and bounded pixel observations, not physical VRAM measurements, high-quality shadow/AA, human input or performance acceptance.

## A game

```js
import { play3d } from '@egret/engine/webgl2/world3d';

let ball, floor, vy = 0;

await play3d({
  width: 960, height: 540, background: 0x0b1020,
  setup(game) {
    floor = game.ground(24, 0x2d6a4f);
    ball = game.sphere(0.5, 0xe8453c, { y: 3 });
    game.follow(ball, { y: 6, z: 9 });
    game.text('Arrows roll, Space jumps', { x: 16, y: 12 });
  },
  update(dt, game) {
    const move = game.keys.axis();
    ball.x += move.x * 6 * dt;
    ball.z += move.y * 6 * dt;
    vy -= 20 * dt;
    ball.y += vy * dt;
    const push = game.pushOut(ball, floor);
    if (push) { ball.y += push.y; vy = 0; if (game.keys.pressed('space')) vy = 8; }
  },
});
```

`x` is right, `y` is up and `z` is towards the camera as the game starts, so on the ground the arrows' `axis()` is `x` and `z`. A unit is whatever the game makes it; a ball of radius 0.5 and a ground of 24 read well.

## Options

Those of [`play`](play.md#options), without `canvas`: `play3d` makes its two canvases itself. `width` and `height` are the units of the interface and the shape of the picture. `background` is the colour of the sky. `backend: 'webgpu'` draws both with WebGPU; without it both are WebGL2.

## Things

| Call | Gives |
| --- | --- |
| `game.box(width, height, depth, color, { x, y, z })` | A box, its middle at the place |
| `game.sphere(radius, color, { x, y, z })` | A ball |
| `game.cylinder(radius, height, color, { x, y, z })` | A cylinder standing on its end |
| `game.cone(radius, height, color, { x, y, z })` | A cone standing on its base |
| `game.ground(size, color, y = 0)` | A square floor of that size whose top is at height `y`. It is 8 deep, so a thing falling fast in a slow frame is pushed back up out of it |
| `game.add(model, { x, y, z })` | Makes a model of your own a thing: a `Mesh3D` of your own geometry, a group of them, or what `loadGltf3D` loaded. Its box for the tests is worked out from all its meshes, placed as they are under it, so a figure whose feet are at its place stands on a floor. It keeps its own materials, and `color` does not change it |
| `game.remove(thing)` | Takes it out of the world |
| `game.group([a, b, c], { x, y, z })` | Makes things one: a group placed, turned, scaled, tweened and tested as one thing. The things stay where they are within it, their places now counted from the group's place, which is `at`, 0 unless given. Test the group, not its parts; removing it removes them. A thing is in one group at most |
| `game.lamp(color, { x, y, z }, { intensity: 4, range: 8 })` | A lamp: light from a point that fades out by its range. Its `x`, `y`, `z`, `color`, `intensity`, `range` and `visible` can be set and tweened; `game.remove(lamp)` puts it out. Eight are lit fully, more by a coarser way |
| `game.onTap(thing, () => …)` | Calls the function when the thing is tapped or clicked: a ray from the camera through the pointer, and the nearest thing it meets with a tap gets it. A press on a thing is still `game.pointer.pressed`. A sprite of the interface is given to `onTap` as in `play` |

Each gives a thing. Set `x`, `y`, `z`, `rotationX`, `rotationY`, `rotationZ` (degrees), `scale` or `scaleX`, `scaleY`, `scaleZ`, `visible` and `color` on it at any time; they can be tweened, as in `game.tween(door).to({ y: 4 }, 0.5)`. Add properties of your own (`enemy.hp = 3`). `thing.removed` says whether it has been removed; setting a removed thing does nothing and does not fail. `thing.node` is its [Mesh3D](world3d.md). `thing.glow` makes it shine with its own colour, lit or not: 0 unless set, 1 as bright as its colour, more for a lantern or a screen; it follows a new `color`, and a model keeps the materials it has. A thing that glows is not hidden by fog. `thing.opacity` is how much of it is seen, 1 unless set: less lets what is behind it show through, as glass or a ghost, and a see-through thing casts no shadow; with `glow` its light is added to what is behind it, as a beam's is. Every shape is placed by its middle. `rotationY` turns a thing to its left, counterclockwise seen from above; at 0 a thing faces away from the camera, towards -z, so it moves forward by `x -= Math.sin(r) * d` and `z -= Math.cos(r) * d` with `r = thing.rotationY * Math.PI / 180`.

An imported model keeps its existing root rotation. Editing `rotationY` preserves the other two axes. Collision direction uses the centre of the same scaled bounds that establish overlap, including a model whose origin is at its feet.

Primitive geometries and the materials made for them belong to the game. Removing them, restarting or disposing releases those resources. Models given to `add` remain borrowed, so their geometry, materials and textures remain the caller's responsibility. Burst pieces share one game-owned shape that survives restart and ends at final disposal. Creating or attaching things during world cleanup or after disposal is refused with `PLAY_OPTIONS_INVALID`. Cleanup continues through resource-listener failures and reports them.

Play3D follows the [Play restart contract](play.md). A failed setup releases the primitives it created and detaches borrowed models. Await `game.dispose()` to close the overlay and the World3D Engine, including its renderer and scopes. If a resource cleanup fails, the remaining owners still run and the close Promise reports the error. Concurrent callers receive the same close Promise.

On November 18, 2026, Windows Edge 157 (RTX 5090 Laptop) and Galaxy Z Fold7 Chrome 157 (Adreno 830) each passed the [async lifecycle fixture](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/verify-async-lifecycle.mjs) on WebGPU and WebGL2. The 128 × 96 scene used the same low World3D preset as the earlier lifecycle checks. The fixture held and released an application load during startup and restart, triggered a failing restart with pointer input on a UI object and a mesh, verified the subsequent explicit retry, and observed a failing resource cleanup through the public close Promise. Each run recorded zero late attachments, zero remaining canvases after close and zero unhandled Promise rejections.

On unmodified #369 a single scene using Windows WebGL2 at default high quality lost its context. On main `b3874464`, Windows Edge 157.0.4341.60 and a GeForce RTX 5090 Laptop (ANGLE D3D11) reproduced the failure in a box and 2D overlay. Turning off SSAO alone moved the first reported shader error from `post/ssao` to `post/down`. Turning off shadow reception on the box kept the scene running with SSAO enabled.

The WebGL2 fragment shader now selects the directional cascade and its far edge from the four fixed components of the split-distance uniform. Both surface and volumetric shadows use this selection. With the original high-quality settings, shadows and SSAO enabled, the same scene updated 119 times in 120 browser callbacks, with zero context losses or rendering errors. A separate 128 × 96 floor-and-box fixture checks visible lit and shadowed pixels for one through four atlas maps. It passed on native WebGL2 and WebGPU. In a separate SwiftShader before/after comparison, all five readbacks (shadows off and one to four maps) were byte-identical. These are correctness observations.

## The camera and the sun

`game.follow(thing, { x: 0, y: 4, z: 8, smooth: 6 })` keeps the camera that far from a thing, looking at it, and catching up with it smoothly; `smooth: 0` holds it exactly, and `turn: true` turns that place with the thing's `rotationY`, so the camera stays behind a car or a figure whichever way it faces. Without `follow`, set `game.camera.x`, `.y` and `.z` and call `game.camera.lookAt(x, y, z)`; `game.camera.fov` is the angle it sees, 55 degrees unless set. It starts at (0, 6, 12) looking at the middle of the world.

`game.sun` is the light of the day, with a soft light from the sky. It keeps its direction and stays over what the camera looks at. Every thing casts and takes shadows; nothing needs setting. They are drawn at the [quality](world3d-app.md#quality) the app chose for the device, `medium` or `high`; a software-rendered browser gets `low`, without shadows, and `game.app.setQuality('medium')` asks for them anyway.

## The look of the world

`game.look(name)` sets the light and the air at once: `'day'` (the look a game starts with), `'dusk'`, `'night'`, `'fog'` or `'snow'`. It changes the background, the colours and strength of the light from above and below, the colour, strength and side of the sun, and the fog, whose colour is the background's. An object `{ background, sky, ground, light, sun, sunIntensity, sunFrom, fog }` changes only the parts it names. `fog` is the thickness of exponential fog: 0 clear, 0.02 a haze, 0.06 a fog. `sunFrom` is the side the sun shines from as `[x, y, z]`, with y above 0. The look stays through a restart; the five are `PLAY_LOOKS_3D`. `game.weather('snow')` or `'rain'` lets it fall around what the camera looks at, `{ amount }` from 0 to 3, 1 unless given; `'none'` stops it, and it stays through a restart too. Flakes are left where they fall as the camera moves; their motion is worked out on the GPU, so they cost the game nothing a frame. In a software-rendered browser the quality is `low`, without shadows or bloom, and the looks were checked there; hardware draws them with shadows.

## Tests

| Ask | Answer |
| --- | --- |
| `game.overlaps(a, b)` | Whether two things overlap, taken as upright boxes of their size and scale |
| `game.hits(a, list)`, `game.hitsAll(a, list)` | The first thing of the list that overlaps `a`, or every one |
| `game.near(a, b, distance?)` | Whether their middles are within a distance: the sum of their radii unless given |
| `game.pushOut(a, b)` | How far to move `a` out of `b` by the shortest way, `{ x, y, z }` with one of them not 0, or `undefined` when apart. A `y` above 0 means `a` stands on `b` |

A hidden or removed thing overlaps nothing. A turned thing is still tested as an upright box. For bodies that tumble, slide and stack there is [physics](world3d.md), by `createPhysicsWorld3D` from `@egret/engine/world3d`, which `play3d` does not wrap.

## Feel

`game.shake(amount = 0.3, seconds = 0.25)` shakes the camera by up to that many units of the world. `game.burst(x, y, z, { color, count, speed, life, size, gravity })` throws small pieces out from a point. `game.flash`, `game.hitStop` and `game.sfx` are those of `play`.

## The page

With modules, the page is that of [`play`](play.md#the-page) with `@egret/engine/webgl2/world3d` in its import map. With [one file](single-file.md) it is `egret3d.js`, which holds `play`, `play3d` and World3D:

```html
<script src="egret3d.js"></script>
<script type="module">
const { play3d } = Egret;
await play3d({ width: 960, height: 540, setup(game) { … }, update(dt, game) { … } });
</script>
```

## When a game outgrows it

`game.scene` is the [Scene3D](world3d.md) and `game.app` the [World3D app](world3d-app.md): models loaded from glTF, materials, more lights, particles, physics and post-processing are added to the scene beside what `play3d` made. `game.camera.node` and `thing.node` are the camera and the meshes themselves.
