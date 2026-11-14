# Music and effects

English | [简体中文](README.zh-CN.md)

One music at a time and effects over it, each with its own volume under a master volume. The page asks for its music at once; a browser lets nothing sound before the page has been touched, so the music waits and starts with the first press or key. The controls are ordinary controls of the page: the example is about what is heard.

The sounds are made in the page from sine waves, as WAV bytes of the kind a game loads from a file. The repository carries no recording.

## Run

Build the packages, serve the repository root, and open the page:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Keep the host and port the server prints and open `/examples/audio-mixer/index.html` there.

## What to try

- Open the page and wait. The line under the text says there is no sound yet. Press anywhere, or any key: the music starts from its beginning, rising over a second.
- **演武 / Drill** brings the other music in while the first one fades out. **山门 / Gate** while it already plays changes nothing. **停止 / Stop** fades the music out.
- The three bells are the same sound on the left, in the middle and on the right. They ring over the music and end by themselves.
- Press **点击声 / Tick** quickly. It is kept to two voices: the third press ends the oldest one, so the sound never piles up on itself.
- Move a volume, or mute one. Music and effects are turned down separately, and the master turns down both. Reload the page: the volumes are as they were left.
- **暂停 / Pause** silences everything and stops the clock of the sound: the music goes on from the same place. A bell asked for while paused is dropped, not kept for later.
- Switch to another tab, or minimize the window, and come back. The page is silent while hidden.

## How it works

| Part | From |
| --- | --- |
| The output, the first press, the hidden page | `createBrowserAudio` from `@egret/engine/web/audio` |
| Volumes, voices, the music | `audio.mixer`, the same mixer `createAudioMixer` of `@egret/engine/audio` makes over any backend |
| A sound | `mixer.decode(bytes)` with the bytes of one encoded file |
| An effect | `mixer.play(sound, { pan, rate, maxInstances })` |
| The music | `mixer.playMusic(sound, { fade })` and `mixer.stopMusic({ fade })` |
| A volume | `mixer.bus('music').setVolume(value, { fade })`, `setMuted`, and `mixer.master` |
| A pause | `mixer.suspend()` and `mixer.resume()` |
| The line that says whether the page sounds | `mixer.subscribe` and `mixer.state` |
| The meter | An `AnalyserNode` of the page connected to `audio.output` |
| The volumes on the next visit | `localStorage` of the page; the mixer keeps nothing |

See the [sound guide](../../knowledge-base/en/docs/audio.md).

## Check

```text
node examples/audio-mixer/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

The verifier presses, taps and types through the automation protocol of a real browser and reads what the page says about itself. One case renders ahead of time and measures the samples: the level through a voice, a bus and the master, the two sides of a pan, a fade in and out, a loop, the pitch at a rate, a start part way in, one music giving way to the next, a mute, and a pause. Nothing listens to a loudspeaker, and no phone or tablet is used. A case the browser cannot be brought into is reported as `NOT RUN` with its reason: a browser without a window keeps its page visible, so the hidden page is such a case there.
