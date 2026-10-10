# Sequence clip CPU contract

[简体中文](sequence-clip-contract.zh-CN.md) · [Verification evidence](sequence-clip-evidence.en.md)

Egret's first-party sequence clip core (`packages/runtime/src/sequenceClip.ts`) converts atlas-region durations into immutable timing data and samples a frame from supplied seconds. It is an internal CPU component, not a player, texture loader or renderer. Its functions and types are not exported by the runtime package barrel.

The [implemented Bitmap region member](bitmap-region-contract.en.md) can receive a sample from a full-image atlas using caller-supplied seconds and the same borrowed lease. Sampling remains internal and separate from assignment; no clock/player is added. Its bounded CPU evidence does not validate visible playback or transfer the older sampler/full-suite records to a new rendering result.

```ts
createSequenceClip(input: unknown): SequenceClip
sampleSequenceClip(clip: SequenceClip, elapsedSeconds: number,
  options: { readonly mode: 'once' | 'loop'; readonly stopAtSeconds?: number }
): SequenceSample
```

## Construction

Input owns `atlasWidth`, `atlasHeight` and a dense `frames` array containing 1–1024 records. Each frame owns `x`, `y`, `width`, `height` and `durationSeconds`. Atlas dimensions and region sizes are positive safe integers; coordinates are nonnegative safe integers. Region extents must safely fit the independently declared atlas dimensions.

Own fields are captured in defined order before interpretation: atlas dimensions and frames, then each array entry and its five frame fields. A source read failure becomes `SEQ_READ_FAILED` with the exact original `cause`, including `undefined`; semantic errors use the `SEQ_INPUT_INVALID`, `SEQ_BUDGET`, `SEQ_REGION_INVALID` or `SEQ_TIME_INVALID` codes. Validation stops at the first invalid frame without reading later frames.

Durations use JavaScript binary64 seconds, including positive subnormal values. Input-order cumulative ends must remain finite and strictly increase after rounding. Overflow and increments absorbed by rounding are rejected. There is no float32 or integer-tick conversion.

Construction returns frozen metadata with exactly `atlasWidth`, `atlasHeight`, `frameCount` and `durationSeconds`. Owned regions and timing arrays are frozen; caller records are neither retained nor frozen. Authentic clip identity is registered in a module-private WeakMap only after successful preparation. Copies and proxies are rejected as `SEQ_CLIP_INVALID` before reading their fields, time or options.

## Sampling

Elapsed seconds must be finite and nonnegative even when `stopAtSeconds` is supplied. Sampling captures the own `mode` and optional stop field before interpreting them. An explicit valid stop time replaces elapsed time; a missing or `undefined` stop field does not stop the sample.

`once` clamps at total duration and returns the final frame with `atEnd: true`. `loop` uses the binary64 remainder `%`, without accumulating elapsed cycles, and keeps `atEnd: false`. A frame boundary selects the next frame: the search finds the first cumulative end strictly greater than position. At 1024 frames, that binary search uses at most eleven comparisons. Negative zero is normalized to positive zero.

Each call returns a fresh frozen sample containing `frameIndex`, an owned frozen `region`, `positionSeconds`, `atEnd` and `stopped`. Repeated samples can share the same owned region. This core does not advance a clock, dispatch events, load resources or write renderer state. The selected combined source set passed the current whole-repository verification: 901/901 tests plus build, boundary and type gates. Playback integration, real atlas assets and rendered animation remain separate validation work; that repository result does not establish them. The paired evidence preserves the earlier failed repository attempt.
