# Gamepads

English | [简体中文](../../Cns/docs/gamepad.md)

`@egret/engine/input/gamepad` turns what pads say into presses, sticks and keys, free of the DOM. `@egret/engine/web/gamepad` asks the pads of a page. Both are optional entries: a game that imports neither loads nothing of them.

**What is checked and what is not.** The input and the keys are checked in Node, the adapter against a stand-in page, and the [controls example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/README.md) in headless Chromium with a list of pads the check writes. No pad was held, and no browser read a real one. See [What was run](#what-was-run).

## On a page

```js
import { bindGamepadKeys } from '@egret/engine/input/gamepad';
import { createBrowserGamepadInput } from '@egret/engine/web/gamepad';

const pads = scope.use(createBrowserGamepadInput());
// Once a frame, with the frame's time: a browser tells nothing of a pad by itself.
function frame(time) { pads.poll(time); /* game update and draw */ requestAnimationFrame(frame); }
requestAnimationFrame(frame);

const pad = pads.input.pad(0);
if (pad?.pressed('a')) jump();
const { x, y } = pad?.stick('left') ?? { x: 0, y: 0 };
```

`poll(timestamp)` reads `navigator.getGamepads()` once and gives the input what every connected pad says. A hidden page is not read. When the page is hidden, or the window loses the person, every button is let go, because what a pad does then is not told. `rumble(pad, { duration, weak, strong })` shakes a pad that can be shaken and says whether it asked; failures go to `onError`.

## The input

`createGamepadInput({ deadZone, maxPads, onButton, onConnection })` takes looks: `input.sample(samples, timestamp)` is everything that is connected at one moment. It tells each press and each letting go once (`onButton`, `subscribe`), and each pad that arrives or is taken away (`onConnection`). A pad that is taken away lets its buttons go first. Then `onSample` listeners are told the look is over.

| Read | Meaning |
| --- | --- |
| `input.pads`, `input.pad(index)` | The connected pads, by index |
| `pad.pressed(name or number)`, `pad.value(...)` | A button, by its name in the standard layout or by number on any pad. `value` is how far a trigger is pulled |
| `pad.stick('left' or 'right')` | A stick with the dead zone (0.15 by default) taken out, the rest stretched to reach 1 |
| `pad.axis(index)` | One axis as the host gave it |
| `pad.standard` | Whether the browser arranged the pad in the standard layout. Names mean nothing otherwise, and sticks read as the middle |

The names are those of the place of a button: `a` is the lower face button, `b` the right one, `x` the left, `y` the top; `l1`, `r1` the shoulders, `l2`, `r2` the triggers; `select`, `start`, `l3`, `r3`, `up`, `down`, `left`, `right`, `home`.

`input.release()` lets every button go and keeps the pads. A listener may read the pads; it may not give the next look (`GAMEPAD_REENTRANT`). What a listener throws is told once the look is over (`GAMEPAD_LISTENER_FAILED`), after every other listener was told.

## Keys for a UI

```js
const keys = bindGamepadKeys({ gamepad: pads.input, keyboard });
```

`bindGamepadKeys` drives a keyboard input — the logical one of the Engine, or anything with `keyDown`, `keyUp` and `moveFocus` — so a UI that answers keys answers a pad without a line of its own.

| Button | Action |
| --- | --- |
| The cross and the left stick | The arrow keys. An arrow nobody took moves the focus: down and right to the next stop, up and left to the previous one |
| `a` | Enter |
| `b` | Escape |
| `l1`, `r1` | The focus to the previous or the next stop |

The focus goes round from the last stop to the first; `wrap: false` stops at the ends. Directions and moves of the focus repeat while held, after `repeatDelay` (400 ms) every `repeatInterval` (100 ms), at most once a look; Enter and Escape do not. A key held from two places is one key. `map` replaces an action (`{ key, code, otherwise }` or `{ focus }`) or takes it away (`null`); `pad` drives the keys from one pad; `stick: 'right'` or `false` chooses the stick; `threshold` (0.5) is how far a stick is pushed to count, and it lets go below 70 % of that. `dispose()` lets the held keys go.

## Errors

| Code | When |
| --- | --- |
| `GAMEPAD_OPTIONS_INVALID` | An option is not what it may be |
| `GAMEPAD_SAMPLE` | A look, a pad of it or its time is not what it may be. Nothing of it was taken in |
| `GAMEPAD_BUTTON_UNKNOWN`, `GAMEPAD_STICK_UNKNOWN`, `GAMEPAD_AXIS_UNKNOWN` | No such button, stick or axis |
| `GAMEPAD_REENTRANT` | A listener gave the next look |
| `GAMEPAD_LISTENER_FAILED` | A listener, or the keyboard driven by the keys, threw |
| `GAMEPAD_CLOSED` | The input was disposed |
| `GAMEPAD_HOST_UNAVAILABLE` | The page cannot be asked for pads |

## What was run

| What | Where | Result |
| --- | --- | --- |
| The input against looks the test writes, and the keys against a recording keyboard and the genuine keyboard input of an Engine | Node, [`tests/gamepad-input.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/gamepad-input.test.mjs) | 22 cases |
| The adapter against a stand-in page and its pads; a strict TypeScript consumer of both entries with nine refused misuses; the exports | Node, [`tests/browser-gamepad.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-gamepad.test.mjs) | 11 cases |
| Every comparison, boolean and logical operator of the three built modules changed one at a time | Node | 245 changes, 240 caught. The 5 left change nothing that can be observed: a button past the last one, a stick exactly on the edge of its dead zone, and a second disposal |
| The controls example walked by a scripted pad: the focus, a press held and let go, the group by the cross and the stick, the shoulders, a held direction that repeats, and a pad taken away while it holds a press | Headless Chromium 153 | 1 scenario |
| A real pad in a real browser; rumble; Safari and Firefox; a phone with a pad | — | Not run |

## Not in this slice

- Remapping by the player and saving it; names of buttons as the maker of a pad prints them.
- Touch sticks drawn on a phone screen.
- Pads in a mini-game host.
