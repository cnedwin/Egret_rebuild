# The game kit: actions, saves, random numbers, sound cues, asset bundles and touch controls

English | [简体中文](../../Cns/docs/game-kit.md)

Most games need the same small parts around their rules: input by action rather than by key, a save that survives a new build, random numbers that repeat, sound effects that do not sound mechanical, and controls for a touch screen. `@egret/engine/kit` has the parts that need no page; `@egret/engine/web/kit` feeds them from the page.

**What is checked and what is not.** Both halves are checked in Node, the browser half with stand-in event targets, gamepads and storage. In headless Chromium, keys pressed through the automation protocol drove a button and a diagonal of length 1 without scrolling the page; a click synthesised with `encodeWav` was decoded by Web Audio and played through a cue and the limiter in an offline output, peaking at 0.26; a bundle was read back by byte ranges; and a save was written to the page's storage. In a second run an 8 MB save went to IndexedDB and was read back after reopening, and a bundle entry read once was read again from the Cache API with the network refused. A phone, Safari and a physical gamepad were not run.

## Input by action

```js
import { createInputActions } from '@egret/engine/kit';
import { bindBrowserInputActions, createTouchButton, createTouchStick } from '@egret/engine/web/kit';

const input = createInputActions({
  jump: { bindings: ['Key:Space', 'Pad:a', 'Touch:jump'] },
  fire: { bindings: ['Mouse:0', 'Pad:rightTrigger'] },
  move: { kind: 'vector', up: ['Key:KeyW'], down: ['Key:KeyS'], left: ['Key:KeyA'], right: ['Key:KeyD'], sticks: ['Pad:leftStick', 'Touch:stick'] },
});
const page = bindBrowserInputActions(input, { pointerTarget: canvas });
createTouchStick(touchLayer, input);
createTouchButton(jumpButton, input, 'Touch:jump');

function frame(seconds) {
  page.poll();                       // reads the gamepads
  const { x, y } = input.vector('move');
  if (input.justPressed('jump')) hero.jump();
  input.endFrame();
}
```

A binding is a short string: `Key:` and a `KeyboardEvent.code`, `Mouse:` and a button number, `Pad:` and a standard button name or number, `Pad:leftStick` or `Pad:rightStick` for a whole stick, `Pad:leftStickX+` for half of an axis, and `Touch:` for an on-screen control.

| Kind | Read with | Bindings |
| --- | --- | --- |
| `button` (default) | `pressed`, `justPressed`, `justReleased` | `bindings` |
| `axis` | `value`, from -1 to 1 | `negative`, `positive` |
| `vector` | `vector`, of length at most 1, y down | `up`, `down`, `left`, `right`, `sticks` |

Keys for two directions held together give a vector of length 1, so a diagonal is no faster. A stick's dead zone (0.2 by default) is taken out and the rest stretched, so small pushes start from zero. An analog trigger presses a button past half way.

The page binding lets every control go when the window loses focus or the page is hidden. It keeps bound keys from scrolling the page and leaves keys alone while the player types in a field. `dispose()` takes its listeners off.

Mouse buttons can be held together. For example, with `Mouse:2` held to aim, pressing and releasing `Mouse:0` fires and releases the shot while aim stays active. Start each press on the bound target. Releasing a button elsewhere in the same window still ends its action.

## Rebinding

`input.rebind(action, binding, { slot, index })` puts a control on an action and takes it off any other, so one key never does two things. `input.lastPressed` gives the control pressed this frame, for a "press a key" screen, and `describeInputBinding(binding)` gives a readable name (`W`, `Shift`, `Right button`). `saveBindings()` returns what differs from the map as plain data. `loadBindings(data)` applies it and skips unknown actions and malformed entries. `resetBindings()` goes back to the map.

## Saves

```js
import { createSaveStore } from '@egret/engine/kit';
import { browserSaveStorage } from '@egret/engine/web/kit';

const save = createSaveStore({
  key: 'snow-temple',
  version: 3,
  defaults: () => ({ tier: 1, best: {}, settings: { quality: 'auto' } }),
  migrations: {
    1: old => ({ tier: old.level, best: {} }),
    2: old => ({ ...old, settings: { quality: 'auto' } }),
  },
  storage: browserSaveStorage(),
  onProblem: problem => console.warn(problem.kind),
});
save.update(data => { data.tier = 2; });
```

A save is kept as `{ version, savedAt, data }`. An older save is brought up to date step by step and written back. A save that cannot be read, fails `validate`, is newer than the build, or is older than the oldest step starts again from `defaults`. The old text is kept under `<key>.unread`, so nothing is lost. A write that the storage refuses, as when it is full, returns `false` and is reported to `onProblem`; it never throws. `export()` and `import(text)` move a save by hand.

`browserSaveStorage()` is the page's local storage, or memory where the page has none (a private window, a blocked site); `persistent` says which. `createMemorySaveStorage()` is the same for tests.

## Random numbers that repeat

```js
import { createRandom } from '@egret/engine/kit';

const dice = createRandom(seed);       // a number or a string
const loot = dice.fork();              // its own sequence, unaffected by later rolls of `dice`
dice.int(1, 6); dice.range(0, 1); dice.chance(0.25); dice.pick(items); dice.weighted(items, weights); dice.shuffle(items); dice.normal(10, 2);
const saved = dice.state();            // createRandom(saved) continues from here
```

The same seed gives the same numbers on every engine and device. The generator is sfc32: quick and good for games, and not for secrets.

## Sound effects by name

```js
import { createAudioCues, encodeWav } from '@egret/engine/kit';
import { createBrowserAudio } from '@egret/engine/web/audio';

const audio = createBrowserAudio({ limiter: true });
const steps = await Promise.all(stepTakes.map(bytes => audio.mixer.decode(bytes)));
const cues = createAudioCues(audio.mixer, {
  step: { sounds: steps, rate: [0.92, 1.08], volume: [0.6, 0.8], cooldown: 0.06, maxVoices: 3 },
  hit: { sounds: hits, rate: [0.95, 1.05], maxVoices: 4 },
});
cues.play('step', { volume: 1 - distance / 30, pan: side });
```

A cue chooses one of its takes, never the same one twice in a row, and picks its volume and rate within the ranges given. A play inside the `cooldown` is skipped. Past `maxVoices` the oldest voice of the cue fades out to make room. `createBrowserAudio({ limiter: true })` puts a gentle limiter between the master volume and the speakers so a crowd of sounds does not clip; an object sets `threshold`, `knee`, `ratio`, `attack` and `release` itself.

Games that make their sounds in code fill a `Float32Array` per channel and call `encodeWav(channels, sampleRate)`. The 16-bit WAV bytes go to `mixer.decode` like any file, so synthesised sounds use the same buses, cues and limiter as recorded ones.

## Asset bundles

A level's models, pictures and sounds can travel as one file. Where the host serves byte ranges only the parts asked for are fetched; where it does not, the file is fetched once.

```js
// In a build script (Node)
import { writeAssetBundle } from '@egret/engine/kit';
const file = writeAssetBundle([
  { name: 'models/hero-high.glb', bytes: heroHigh, type: 'model/gltf-binary', tags: ['hero', 'high'] },
  { name: 'models/hero-low.glb', bytes: heroLow, type: 'model/gltf-binary', tags: ['hero', 'low'] },
]);

// In the game
import { openBrowserAssetBundle } from '@egret/engine/web/kit';
const bundle = await openBrowserAssetBundle('assets/level1.pack');
const wanted = bundle.entries('hero', quality).map(entry => entry.name);
const files = await bundle.read(wanted);
```

The file is a 12-byte header, a JSON index of names, offsets, sizes, types, tags and checksums, and the entries one after another, each starting at a multiple of four bytes. Opening asks for the first 64 KB, and once more when the index is longer. `read` fetches the named entries, joining neighbours less than 64 KB apart into one request, and checks each against the index. `bundle.ranged` says whether the host answered ranges, and `bundle.transferred` gives the bytes fetched. `readAssetBundleIndex`, `sliceAssetBundle` and `planAssetBundleRanges` do the same work on bytes a game already has.

## Models by picture quality

```js
import { pickQualityFiles, pickQualityVariant } from '@egret/engine/kit';

const hero = pickQualityVariant({ low: 'hero-low.glb', high: 'hero-high.glb' }, app.quality);  // medium gets low
const wanted = pickQualityFiles(bundle.index.entries.map(e => e.name), app.quality);
```

`pickQualityVariant` takes the tier asked for, or else the nearest tier below it, or else the nearest above. `pickQualityFiles` groups names of the form `<base>-<tier>.<ext>` and keeps one of each group for the quality, with names that have no tier passed through, so a bundle or a folder with `hero-high.glb`, `hero-medium.glb` and `hero-low.glb` loads only one hero. `app.quality` from `createWorld3DApp` names the tier.

## Playing the rules without a page

```js
import { runHeadless } from '@egret/engine/kit';

const runs = runHeadless({
  createGame: seed => createGame({ seed }),
  createPlayer: (game, seed) => createBot(game, { seed }).think,
  done: game => game.state === 'won' || game.state === 'dead',
  seeds: 8,
  summary: game => ({ state: game.state, time: Math.round(game.t), kills: game.stats.kills }),
});
console.table(runs.map(run => ({ seed: run.seed, ...run.summary, ms: run.averageMs.toFixed(3) })));
```

Each seed gets a new game and a stand-in player, and steps of `step` seconds (1/60 by default) run until `done` or `maxSeconds` (1,200 by default). Every run reports whether it finished, its game seconds, its steps, the average and slowest milliseconds of a step, and the game's `summary`. With the rules kept apart from the picture and `vendor/node-register.mjs`, a whole game can be tested and balanced from Node.

## Large saves and playing offline

`openIndexedDBSaveStorage({ database })` is a save storage over IndexedDB, for saves larger than local storage holds. Opening reads every saved string into memory, so `createSaveStore` uses it as it does local storage; each write goes to memory at once and to the database after. `flush()` waits for the writes, and a write the database refuses is told to `onError` and refused at the next write.

`openBrowserBundleCache(name)` keeps the index of an asset bundle and every entry read, in the Cache API. Give it to `openBrowserAssetBundle(url, { cache })`. Entries are kept by the bundle's address and checksum, so a rebuilt bundle never serves old bytes. When the bundle cannot be fetched, a kept index still opens it, `bundle.offline` is true, and kept entries read as before. `cache.prune(keep)` forgets entries of other addresses.

## Copying the engine into a game

A game folder that ships without a package manager carries the part of the engine it loads. From a built checkout:

```
node tools/vendor-game.mjs ../MyGame @egret/engine @egret/engine/webgl2/world3d @egret/engine/kit @egret/engine/web/kit
```

Only the JavaScript files the named entries import, directly or through other files, are copied into `../MyGame/vendor`, with the engine's licence and each third-party package's own. The source-map comments are dropped; the code is otherwise unchanged. Alongside the files:

| File | For |
| --- | --- |
| `vendor/importmap.json` | the page's import map, to paste in |
| `vendor/importmap.js` | a plain `<script src>` that adds the same map, for pages that would rather not paste it |
| `vendor/node-register.mjs` | `node --import ./vendor/node-register.mjs rules.test.mjs`: the game's rules and tests run in Node under the names the page uses |
| `vendor/SOURCE.md` | the commit and entries it was made from |

Running it again refreshes the copy and takes away files no entry needs any more.

## Errors

| Code | Meaning |
| --- | --- |
| `INPUT_ACTIONS_INVALID` | A malformed map, binding, slot or value, or an unknown action |
| `SAVE_STORE_OPTIONS_INVALID` | A missing key, version, defaults or storage |
| `RANDOM_SEED_INVALID` | A seed that is not a finite number, a string or four words |
| `RANDOM_RANGE_INVALID` | An empty list, a reversed range or a bad weight |
| `AUDIO_CUES_INVALID` | A cue without sounds, a range out of bounds, or an unknown cue |
| `ASSET_BUNDLE_INVALID` | A bad name, duplicate, or bytes that are not a `Uint8Array` |
| `ASSET_BUNDLE_FORMAT_INVALID` | Bytes that are not a bundle, or a damaged index |
| `ASSET_BUNDLE_ENTRY_MISSING` | No entry of that name |
| `ASSET_BUNDLE_CHECK_FAILED` | An entry's bytes differ from its checksum |
| `ASSET_BUNDLE_RANGE_INVALID` | The host answered a different range than asked |
| `ASSET_BUNDLE_FETCH_FAILED` | The host answered with an error; `cause` has its status |
| `QUALITY_VARIANT_INVALID`, `QUALITY_VARIANT_MISSING` | A tier that is not low, medium or high; no variant at all |
| `HEADLESS_RUN_INVALID` | Missing functions, or a bad step, limit or seed list |
| `BROWSER_STORAGE_UNAVAILABLE`, `BROWSER_STORAGE_WRITE_FAILED`, `BROWSER_STORAGE_CLOSED` | No IndexedDB; a write the database refused; a write after `close` |
| `AUDIO_WAV_INVALID` | Channels of different lengths, no samples, or a sample rate out of range |
