# Sound for a 2D game

English | [简体中文](../../Cns/docs/audio.md)

`@egret/engine/audio` is a mixer: sounds, voices that play them, one music at a time, and named volumes under a master volume. It is free of the DOM and makes no sound itself; a backend does. `@egret/engine/web/audio` is the backend for a page, on Web Audio. Both are optional entries: a game that imports neither loads nothing of them.

**What is checked and what is not.** The mixer and the adapter are checked in Node, and the example in headless Chromium, where the samples the browser renders are measured. Nothing listened to a loudspeaker, and no phone, tablet, Safari or Firefox was run. See [What was run](#what-was-run).

## On a page

```js
import { createBrowserAudio } from '@egret/engine/web/audio';

const audio = scope.use(createBrowserAudio({ buses: [{ name: 'music', volume: 0.6 }, 'effects'] }));
const mixer = audio.mixer;
const bytes = async url => new Uint8Array(await (await fetch(url)).arrayBuffer());
const [theme, click] = await Promise.all([mixer.decode(await bytes('theme.ogg')), mixer.decode(await bytes('click.wav'))]);

mixer.playMusic(theme, { fade: 1 });      // waits for the first press if the page may not sound yet
button.onActivate = () => mixer.play(click, { maxInstances: 2 });
```

`createBrowserAudio` makes an `AudioContext`, or uses the one given as `context` and leaves it open. It returns `mixer`, the `context`, `output` (the node every sound passes on its way out, where an analyser of the page can listen) and `dispose()`.

The adapter fetches nothing. A game reads the bytes of a file the way it reads its other files and gives them to `decode`.

**The first press.** A browser lets a page sound only after the person has touched it. Until then `mixer.state` is `'locked'`. The adapter listens for `pointerdown`, `pointerup`, `touchend`, `keydown` and `click` on the document, or on `unlockTarget`, and asks the output to start inside the first of them. When the output runs the state becomes `'running'` and the listeners are removed. An output the system takes away later, as a phone does for a call, locks the mixer again until it is back or the next press brings it back.

**A hidden page** is silent: the adapter asks for silence under the name `'hidden'` while `document.visibilityState` is `'hidden'`. `pauseWhenHidden: false` turns this off.

What fails where nothing can be returned, in a listener of the page or after the output was asked to start or stop, goes to `onError`, or to `reportError` of the page without it.

## Sounds

`mixer.decode(bytes)` takes the bytes of one encoded file, as a `Uint8Array` or an `ArrayBuffer`, and settles with a sound. The bytes stay the caller's and unchanged. Which formats decode is the browser's matter: WAV, MP3 and AAC in MP4 decode in every current browser, Ogg Vorbis and Opus in most.

A sound is decoded samples in memory. `sound.decodedBytes` is what it counts as: seconds × sample rate × channels × 4. Three minutes of stereo at 44.1 kHz are about 63.5 MB. The mixer holds at most `maxDecodedBytes` (128 MiB unless said otherwise) and `maxSounds` (256); a decode that would pass either is refused and its samples given back. Keep music short, in one channel or at a lower rate where it can be, and release what a scene no longer needs.

`sound.release()` ends the voices of the sound and gives the samples back. A scope can own a sound: `sceneScope.use(await mixer.decode(bytes))` releases it when the scene's scope is disposed.

## Effects

```js
const voice = mixer.play(sound, { bus: 'effects', volume: 0.8, rate: 1.2, pan: -0.5, loop: false, offset: 0, fadeIn: 0, maxInstances: 2 });
voice.setVolume(0.4, { fade: 0.3 });
voice.stop({ fade: 0.2 });
const reason = await voice.ended;         // 'finished', 'stopped', 'stolen', 'limit', 'silent', 'released' or 'closed'
```

| Option | Meaning | Default |
| --- | --- | --- |
| `bus` | The named volume the voice is under | `'effects'` if the mixer has it, otherwise the first bus |
| `volume` | 0 to 1 | 1 |
| `rate` | Speed and pitch together, 0.25 to 4 | 1 |
| `pan` | A balance. At -1 only the left side is heard, at 1 only the right; towards one side the other falls in a straight line. At 0 the sound is as it is | 0 |
| `loop` | Start again at the end | `false` |
| `offset` | Seconds into the sound, below its duration | 0 |
| `fadeIn` | Seconds over which the voice rises from nothing, up to 60 | 0 |
| `maxInstances` | At most this many voices of this sound; the oldest gives its place | none |
| `whileSilent` | `'drop'` ends the voice at once when nothing can be heard; `'start'` starts it so that it is heard when the output runs again | `'drop'` |

A voice has `state` (`'playing'`, `'paused'`, `'stopping'` while it fades out, `'ended'`), `endReason`, `position` in seconds by the clock of the output, `setVolume`, `setRate`, `setPan`, `pause()`, `resume()` and `stop()`. `ended` is a promise that settles with the reason and never rejects. What is asked of a voice that is over does nothing.

A volume never moves in a step. Without a fade it moves over five milliseconds, too short to hear as a fade and long enough to make no click.

## Music

```js
mixer.playMusic(battle, { fade: 1.5 });   // the music before it fades out over the same time
mixer.stopMusic({ fade: 1 });
```

There is one music. `playMusic` starts the sound as a loop on the `'music'` bus, rising over `fade`, and stops the music before it over the same fade. Asked for the sound that is already the music, it changes nothing but the volume given, so a scene can ask for its music every time it is entered; `restart: true` starts it again. `loop: false`, `volume`, `offset` and `bus` are taken; a rate, a pan and a number of voices are not. `mixer.music` is the voice that is the music, until it is stopped or over.

Music asked for while nothing can be heard is started all the same and is heard from its beginning when the output runs: this is how music asked for when a page opens begins with the first press.

## Volumes

```js
mixer.bus('music').setVolume(0.5, { fade: 0.3 });
mixer.bus('effects').setMuted(true);
mixer.master.setVolume(0.8);
```

`buses` names the volumes under the master: names alone, or a name with the `volume` and `muted` to start from. Without it there are `'music'` and `'effects'`. Up to sixteen can be named; `'master'` is taken. A muted bus keeps its volume for when it is heard again.

The mixer keeps nothing between visits. A game that lets a person choose volumes saves them itself and gives them back as `volume`, `muted` and `buses` the next time, as the example does.

## Silence

| `mixer.state` | Meaning |
| --- | --- |
| `'running'` | Sound comes out |
| `'locked'` | The host has not let the output start. This comes before `'suspended'` |
| `'suspended'` | Somebody asked for silence |
| `'closed'` | The mixer was disposed |

`mixer.suspend(reason)` asks for silence under a name and `mixer.resume(reason)` lets go of it; the name is `'game'` when none is given. Every name that asked has to let go before sound returns, so a game paused on a hidden page stays silent when the page is shown. While suspended the clock of the output stands still: every voice goes on from where it was.

`mixer.subscribe(listener)` tells each new state, and `mixer.snapshot()` is a frozen picture: the state, `locked`, `suspendedBy`, the volumes, and the numbers of voices, sounds and decoded bytes, of voices started, and of voices dropped because nothing could be heard, because no place could be made, or because they gave their place.

## Limits

At most `maxVoices` voices are not over at once (32 unless said otherwise, up to 256). When every place is taken, the oldest voice that is neither a loop nor the music gives its place and ends with `'stolen'`. When there is none, the new voice ends at once with `'limit'`. `maxInstances` does the same among the voices of one sound, loops included, the music never.

## Ownership

`mixer.dispose()` ends every voice, releases every sound and closes the backend. `scope.use(mixer)`, or `scope.use(audio)` on a page, ties that to a scope of the Engine. After it, what would start something throws `AUDIO_CLOSED` and what would quieten something does nothing.

## Another host

`createAudioMixer({ backend, ... })` takes anything that implements `AudioBackend`: a clock in seconds that stands still while the output is suspended, `decode`, `createBus`, `start`, `suspend`, `resume` and `close`. A host that is not a page writes those and has the same mixer. `locked: true` and `mixer.setLocked(...)` are how a host says whether it lets the output start.

## Errors

Every error is an `EgretError` with one of these codes.

| Code | When |
| --- | --- |
| `AUDIO_OPTIONS_INVALID` | An option of the mixer, of a bus, of a volume or of a fade is not what it may be |
| `AUDIO_PLAY_OPTIONS` | An option of `play` or `playMusic` is not what it may be |
| `AUDIO_BUS_UNKNOWN` | No bus has that name |
| `AUDIO_BYTES_INVALID` | `decode` was given no bytes |
| `AUDIO_DECODE_FAILED` | The backend could not decode the bytes; `cause` is what it said |
| `AUDIO_BUDGET`, `AUDIO_SOUND_LIMIT` | The decoded samples or the number of sounds would pass what the mixer may hold |
| `AUDIO_SOUND_INVALID`, `AUDIO_SOUND_RELEASED` | The value is no sound of this mixer, or one that was released |
| `AUDIO_REASON_INVALID`, `AUDIO_REASON_LIMIT` | A name for silence is not a string of 1 to 32 characters, or eight names already ask |
| `AUDIO_BACKEND_FAILED` | The backend threw or returned something that is not what it should be; `cause` is what it threw |
| `AUDIO_LISTENER_FAILED` | A listener given to `subscribe` threw. The state changed and every other listener was told first |
| `AUDIO_CLEANUP_FAILED` | Something failed while disposing. Everything else was still let go; `cleanupErrors` has the rest |
| `AUDIO_CLOSED` | The mixer was disposed |
| `AUDIO_HOST_UNAVAILABLE` | The page has no `AudioContext` and none was given |

## What was run

| What | Where | Result |
| --- | --- | --- |
| The mixer against a recording backend, and a scope of a real Engine owning a mixer and a sound | Node, [`tests/audio-mixer.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/audio-mixer.test.mjs) | 33 cases |
| The Web Audio adapter against a stand-in page and output, a strict TypeScript consumer of both entries with ten refused misuses, and the exports of both entries | Node, [`tests/browser-audio.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-audio.test.mjs) | 24 cases |
| Every comparison, boolean and logical operator of both modules changed one at a time | Node | 279 changes, 274 caught. The 5 left change nothing that can be observed: a voice that never started has nothing to silence, and a line of volume read exactly at one of its ends has the same value either way |
| The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/audio-mixer/README.md): locked until the first press, key or tap; effects over music; two voices of one sound; volumes and mutes heard; one music giving way to the next; a paused game; volumes kept for the next visit; a phone profile | Headless Chromium 153 | 8 scenarios |
| Rendered ahead of time and measured sample by sample: the level through a voice, a bus and the master; the two sides of a pan, also changed while playing; a fade in and a fade out; a loop; the pitch at two rates; a start part way in; one music giving way to the next; a mute and a fade of a bus; a pause | Headless Chromium 153, `OfflineAudioContext` | 1 scenario, 57 checks |
| A hidden page | Headless Chromium 153 | Not run: a browser without a window keeps its page visible. The adapter's part is covered against the stand-in page |
| What a person hears from a loudspeaker; a phone or a tablet; Safari and Firefox; an output taken away by a call | — | Not run |

The lock is checked with the policy of an ordinary browser asked for by name (`--autoplay-policy=document-user-activation-required`), and the page is given time to start by a clock outside it, because this browser counts a question from the automation protocol as a touch.

## Not in this slice

- **Streamed music.** Every sound is decoded whole. Long music played from a stream, without its samples in memory, is the next step of this entry.
- **Sound in the resource manifest.** The bytes of a sound are read by the game; the manifest and its byte source do not know sound files yet.
- **Positions in space.** A 2D pan is a balance between two sides. World3D has its own listener and positional sound.
- Effects on a bus such as reverb or a filter, lowering the music under a voice line, several sounds in one file, and recording.
- **Other hosts.** The backend for a page is the only one. A mini-game host needs its own.
