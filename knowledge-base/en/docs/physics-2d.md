# 2D collision and simple physics

English | [简体中文](../../Cns/docs/physics-2d.md)

`@egret/engine/physics2d` is a small world of 2D bodies: circles, boxes and convex polygons that fall, bounce, slide and come to rest, push each other by their masses, tell when they begin and stop touching, and can be asked what is at a point, in a rectangle or along a ray. A character can be moved by `moveAndSlide` so that it slides along walls instead of passing through them, and the solid cells of a tile map become a few static boxes. It keeps no clock: the game calls `step(seconds)` once a frame, and the world takes as many fixed steps as that time holds. It is an optional entry: a game that does not import it loads nothing of it.

**What is checked and what is not.** The world is checked in Node, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/physics-2d/README.md) in headless Chromium with software WebGL2, where colours are read from the canvas. No hardware GPU or phone was run, and no frame rate was measured. See [What was run](#what-was-run).

## Use

```js
import { createPhysicsWorld } from '@egret/engine/physics2d';

const world = scope.use(createPhysicsWorld({ gravity: { x: 0, y: 600 } }));
world.addTileColliders({ columns: 32, rows: 18, tileWidth: 16, tileHeight: 16, solid: (column, row) => map.solidAt(column, row) });
const stone = world.addBody({ shape: { kind: 'circle', radius: 8 }, x: 200, y: 40, restitution: 0.4, display: stoneView });
const hero = world.addBody({ kind: 'kinematic', shape: { kind: 'box', width: 16, height: 16 }, x: 60, y: 200, display: heroView });
const pond = world.addBody({ kind: 'static', shape: { kind: 'box', width: 90, height: 30 }, x: 120, y: 240, sensor: true });
world.onContact(contact => { if (contact.sensor) splash(contact.type); });

function frame(seconds) {
  world.moveAndSlide(hero, input.x * 140 * seconds, input.y * 140 * seconds);
  world.step(seconds);
  engine.renderSharedFrame(frameOptions);
}
```

| World option | Meaning | Default |
| --- | --- | --- |
| `gravity` | Units a second, every second, for dynamic bodies | `{ x: 0, y: 0 }` |
| `fixedStep`, `maxSteps` | Seconds of one step, up to 1; the most steps one `step` takes, up to 120 — what is left beyond them is let go | 1/60, 8 |
| `iterations` | Rounds of the speeds of the contacts each step, 1 to 64: more lets a stack settle sooner | 8 |
| `bounceThreshold` | Bodies that meet slower than this, in units a second, do not bounce, so that what rests stays at rest | twice what gravity gives in one step, at least 1 |
| `cellSize`, `maxBodies` | The cell of the grid that finds the pairs that may meet; the most bodies, up to 65,536 | 64, 4,096 |

| Body option | Meaning | Default |
| --- | --- | --- |
| `kind` | `dynamic` (moved by gravity, forces and contacts), `kinematic` (moved by its speed alone, pushes dynamic bodies) or `static` | `dynamic` |
| `shape` | `{ kind: 'circle', radius }`, `{ kind: 'box', width, height }` or `{ kind: 'polygon', points }` — 3 to 64 points of a convex polygon, around its place, in either turning | — |
| `x`, `y`, `angle`, `vx`, `vy` | Its place (the middle of a circle or box), degrees it is turned by, its speed | 0 |
| `density` | Its mass is its area times this | 1 |
| `restitution`, `friction` | 0 to 1: how much it comes back from a contact, the bouncier of the two deciding; 0 and up: friction, the two together `sqrt(a × b)` | 0, 0.3 |
| `gravityScale`, `layer`, `mask` | How much gravity moves it; two bodies meet when the layer of each is in the mask of the other | 1, 1, all |
| `sensor`, `display`, `data` | A sensor is told of contacts and pushes nothing; a display object set to its place and angle when the body is added and after each step; anything of the game's | false |

A body has `x`, `y`, `angle`, `vx`, `vy`, `restitution`, `friction`, `gravityScale`, `layer` and `mask` to read and set, `applyImpulse(x, y)`, `applyForce(x, y)` (for the next step), `bounds()`, `mass`, `state` and `data`. The world has `addBody`, `removeBody` (its contacts end and are told), `addTileColliders(grid)` (runs of solid cells merged across and then down, returned as static boxes), `step(seconds)` (returns the steps taken), `onContact(listener)` (returns a function that stops it), `queryPoint(x, y, mask?)`, `queryRect(rect, mask?)`, `raycast(from, to, mask?)` (the first solid body on the segment, with its point, normal and fraction; sensors are left out, and a ray that starts inside a body does not meet it), `moveAndSlide(body, dx, dy)` (across and then down, pushed back out of each static or kinematic body it enters, in parts no longer than half the body, with the normals it slid along), `snapshot()` and `dispose()`. Contacts are told after each step, begin and end, in the order of the ids of the two bodies; edges touch, so two boxes side by side are in contact.

Bodies do not turn by themselves: a contact pushes along its normal and there is no spin, so a box knocked at its corner slides instead of tipping over. Turn a body by setting its `angle`. The pairs are found on a grid, then by separating axes; a fast small body can pass through a thin wall in one step, so keep speeds under the size of the thinnest wall each step, or move it by `moveAndSlide`.

**Changing kind.** `body.setKind('dynamic')` lets a body that was held — a weight on a rope, a crate on a shelf — fall from where it is, keeping its contacts, its joints and its `data`; `setKind('static')` stops one where it is, and `'kinematic'` leaves it to its speed. A body made dynamic takes the mass of the density it was added with.

**Joints.** `world.addJoint({ kind, a, b })` joins two bodies; with `point` instead of `b` it holds `a` to a place in the world. A `'distance'` joint keeps its anchors at one `length`, as a rod; `'rope'` keeps them no further apart than that and lets them come closer. The length defaults to the distance when the joint is added, and can be set later, as a rope that is wound in. `anchorA` and `anchorB` place the joint away from a body's centre, turned with its `angle`; `stiffness` below 1 makes a distance joint soft. A distance joint of length 0 is a pin. `joint.distance()` is how far apart the anchors are now; `world.removeJoint(joint)` cuts it, and removing either body removes it.

```js
const weight = world.addBody({ shape: { kind: 'circle', radius: 12 }, x: 400, y: 160 });
const rope = world.addJoint({ kind: 'rope', a: weight, point: { x: 400, y: 40 } });
// The pellet's path crossed the rope:
world.removeJoint(rope);
```

Joints pull bodies along a line and do not turn them: a pendulum's bob swings, but a plank on a pin does not tip.

**What a contact listener may do.** Contacts are told once their step is done. A listener may add and remove bodies and joints, push bodies and change their kind; what it changes takes effect from the next step, and a body it removes tells the end of its contacts at once. It may not call `step`, which is refused with `PHYSICS_STEP_REENTRANT`. One `step` may take several fixed steps, and the contacts of each are told before the next is taken.

## Errors

| Code | When |
| --- | --- |
| `PHYSICS_OPTIONS_INVALID` | An option or an argument is not what it may be |
| `PHYSICS_BODY_LIMIT` | `maxBodies` bodies are already in the world |
| `PHYSICS_BODY_INVALID` | A body is not of this world, or was removed |
| `PHYSICS_JOINT_INVALID` | A joint is not of this world, or was removed |
| `PHYSICS_STEP_REENTRANT` | `step` was called from a contact listener, inside a step |
| `PHYSICS_LISTENER_FAILED` | A contact listener threw; the others were told first, and the first failure is its cause |
| `PHYSICS_CLOSED` | The world was disposed |

## What was run

| What | Where | Result |
| --- | --- | --- |
| Options, fixed steps under uneven updates, falling and resting, bouncing and coming to rest below the threshold, momentum between masses, friction on slopes, shapes turned and polygons, rays at edges and ends, contacts begun and ended and their order, layers and masks, sensors, kinematic bodies, sliding along walls, grid colliders merged, displays following bodies, a stack that settles, listeners that throw, disposal, a strict TypeScript consumer with five refused misuses, the exports, a pendulum on a pin, a rope that falls slack and holds taut, is wound in and cut, a chain of rods, anchors turned with their body, a change of kind that keeps contacts, and a listener that removes a body, pushes another and is refused a step | Node, [`tests/physics-2d.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/physics-2d.test.mjs) | 26 cases |
| Every comparison, boolean, logical and arithmetic operator of the two built modules changed one at a time, before joints and changes of kind were added | Node | 452 changes, 397 caught; the rest change nothing that can be seen — a bound one way or the other where the two sides are equal, one more round of a loop that settles, a check made twice |
| The example: the hall made from its grid, the ray, a disciple moved by keys who stops at walls and slides along the ledge, a stone resting on the ledge, one sliding down the slope, one bouncing in the pond that lights it, stones dropped by a click and by the button that settle without passing into each other, the keyboard in real time, a tap on a phone profile | Headless Chromium 153, software WebGL2 | 7 scenarios |
| A hardware GPU, a real phone, the cost of thousands of bodies a frame | — | Not run |

## Not in this slice

- Bodies that turn by themselves (angular speed, torque, inertia), and so hinges that turn what they hold, such as a seesaw; joints are distance and rope only; continuous collision for fast bodies; concave shapes other than as several bodies; slopes and one-way platforms in `moveAndSlide`.
