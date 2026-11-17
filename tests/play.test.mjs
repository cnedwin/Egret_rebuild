// SPDX-License-Identifier: Apache-2.0
// The play entry: what it exports, what it refuses before it touches a page, and the sound effects it makes in code.
// What needs a page (the canvas, keys, the pointer, text, the loop) is checked in a browser; see the guide.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as entry from '@egret/engine/play';
import { Sprite, describeErrorCode } from '@egret/engine';
import { encodeWav } from '@egret/engine/kit';

const { play, PlayText, SFX_PRESETS, isSfxRecipe, synthesizeSfx } = entry;
const refusal = async run => {
  try {
    await run();
  } catch (cause) {
    return cause;
  }
  return undefined;
};

test('PL01 the entry gives play, the text class and the sound effect parts', () => {
  assert.deepEqual(Object.keys(entry).sort(), ['PlayText', 'SFX_PRESETS', 'isSfxRecipe', 'play', 'synthesizeSfx']);
  assert.equal(typeof play, 'function');
  assert.ok(PlayText.prototype instanceof Sprite);
  assert.ok(describeErrorCode('PLAY_OPTIONS_INVALID').length > 0);
  assert.ok(describeErrorCode('PLAY_SFX_UNKNOWN').length > 0);
});

test('PL02 options that cannot make a game are refused before a page is touched, and the message says which', async () => {
  for (const [options, word] of [
    [undefined, 'object'],
    [null, 'object'],
    [{}, 'width'],
    [{ width: 480 }, 'width'],
    [{ width: 0, height: 270 }, 'width'],
    [{ width: 480.5, height: 270 }, 'width'],
    [{ width: 480, height: 270, background: -1 }, 'background'],
    [{ width: 480, height: 270, background: 0x1000000 }, 'background'],
    [{ width: 480, height: 270, setup: 5 }, 'setup'],
    [{ width: 480, height: 270, update: 'x' }, 'update'],
    [{ width: 480, height: 270, onError: {} }, 'onError']
  ]) {
    const error = await refusal(() => play(options));
    assert.equal(error?.code, 'PLAY_OPTIONS_INVALID', JSON.stringify(options));
    assert.match(error.message, new RegExp('Cause: Error: .*' + word), error.message);
  }
  // Valid options get as far as needing a page, which a test in Node does not have.
  const error = await refusal(() => play({ width: 480, height: 270 }));
  assert.equal(error?.code, 'PLAY_OPTIONS_INVALID');
  assert.match(error.message, /needs a page$/);
});

test('PL03 every preset is a recipe, lasts as long as its tones and stays within -1 and 1', () => {
  const names = Object.keys(SFX_PRESETS);
  assert.deepEqual(names, [
    'jump',
    'coin',
    'hit',
    'hurt',
    'explosion',
    'shoot',
    'powerup',
    'bounce',
    'pop',
    'click',
    'win',
    'lose'
  ]);
  assert.ok(Object.isFrozen(SFX_PRESETS));
  for (const name of names) {
    const recipe = SFX_PRESETS[name];
    assert.ok(isSfxRecipe(recipe), name);
    const tones = Array.isArray(recipe) ? recipe : [recipe];
    const samples = synthesizeSfx(recipe, 22050);
    assert.equal(
      samples.length,
      tones.reduce((sum, tone) => sum + Math.round(tone.seconds * 22050), 0),
      name
    );
    let peak = 0,
      energy = 0;
    for (const value of samples) {
      assert.ok(Number.isFinite(value) && value >= -1 && value <= 1);
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    // Heard, and not clipped flat.
    assert.ok(peak > 0.1 && peak <= 0.8, `${name} peak ${peak}`);
    assert.ok(energy / samples.length > 1e-4, `${name} is all but silent`);
    // It starts and ends at rest, so it does not click.
    assert.ok(Math.abs(samples[0]) < 0.01 && Math.abs(samples[samples.length - 1]) < 0.01, name);
    // The samples are what the mixer decodes as a WAV file.
    const wav = encodeWav([samples], 22050);
    assert.equal(wav.length, 44 + samples.length * 2);
  }
});

test('PL04 an effect is the same each time, slides its pitch and takes a rate and a seed', () => {
  const rising = { wave: 'sine', from: 200, to: 800, seconds: 0.2, decay: 0 };
  const a = synthesizeSfx(rising),
    b = synthesizeSfx(rising);
  assert.deepEqual(a, b);
  assert.equal(synthesizeSfx(rising, 44100).length, 8820);
  // Zero crossings come faster at the end of a rising tone than at its start.
  const crossings = (from, to) => {
    let count = 0;
    for (let i = from + 1; i < to; i++) if (a[i - 1] < 0 !== a[i] < 0) count++;
    return count;
  };
  assert.ok(crossings(a.length - 1100, a.length) > crossings(0, 1100) * 2);
  // Noise repeats for one seed and differs for another.
  const noise = { wave: 'noise', from: 2000, seconds: 0.05 };
  assert.deepEqual(synthesizeSfx(noise, 22050, 7), synthesizeSfx(noise, 22050, 7));
  assert.notDeepEqual(synthesizeSfx(noise, 22050, 7), synthesizeSfx(noise, 22050, 8));
  // A quieter tone is quieter, sample for sample.
  const loud = synthesizeSfx({ wave: 'triangle', from: 440, seconds: 0.05, volume: 0.8, decay: 0 }),
    soft = synthesizeSfx({ wave: 'triangle', from: 440, seconds: 0.05, volume: 0.2, decay: 0 });
  assert.ok(Math.abs(loud[300]) > Math.abs(soft[300]) * 3.9);
});

test('PL05 what is not a recipe is told apart', () => {
  for (const bad of [
    undefined,
    null,
    [],
    'jump',
    {},
    { from: 440 },
    { from: 440, seconds: 0 },
    { from: 5, seconds: 0.1 },
    { from: 440, seconds: 10 },
    { from: 440, to: NaN, seconds: 0.1 },
    { from: 440, seconds: 0.1, wave: 'organ' },
    { from: 440, seconds: 0.1, volume: 2 },
    { from: 440, seconds: 0.1, noise: -1 },
    [{ from: 440, seconds: 0.1 }, null],
    new Array(33).fill({ from: 440, seconds: 0.1 })
  ])
    assert.equal(isSfxRecipe(bad), false, JSON.stringify(bad));
  assert.ok(isSfxRecipe({ from: 440, seconds: 0.1 }));
  assert.ok(
    isSfxRecipe([
      { from: 440, seconds: 0.1 },
      { wave: 'noise', from: 900, to: 100, seconds: 0.3, noise: 0.5 }
    ])
  );
});

// Break caught: hand the Engine the promise of an `async` tap, which it refuses and which ends pointer input; or
// lose what a tap's function threw.
test('PL06 the listener of a tap returns nothing, and what its function throws or rejects with is told', async () => {
  const { tapListener } = await import('../packages/engine/dist/web/BrowserPlay.js');
  const told = [],
    fail = cause => told.push(cause);
  let calls = 0;
  assert.equal(tapListener(() => ++calls, fail)(), undefined);
  assert.equal(tapListener(async () => ++calls, fail)(), undefined);
  assert.equal(calls, 2);
  const thrown = new Error('thrown'),
    rejected = new Error('rejected');
  assert.equal(
    tapListener(() => {
      throw thrown;
    }, fail)(),
    undefined
  );
  assert.deepEqual(told, [thrown]);
  tapListener(async () => {
    throw rejected;
  }, fail)();
  tapListener(() => ({ then: 'not a promise' }), fail)();
  tapListener(() => null, fail)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(told, [thrown, rejected]);
});

// Break caught: leave the colour or the size of a text as it was made, saying nothing; or take what is not one.
test('PL07 the colour and the size of a text are set after it is made, and what is not one is not taken', () => {
  const styled = [];
  const label = new PlayText(
    '2',
    () => {},
    0xffffff,
    24,
    style => styled.push(style)
  );
  assert.deepEqual([label.color, label.size], [0xffffff, 24]);
  label.color = 0x776e65;
  label.size = 48;
  label.color = 0x776e65;
  assert.deepEqual(styled, [{ color: 0x776e65 }, { size: 48 }]);
  for (const bad of ['#ff0000', -1, 0x1000000, 1.5, NaN]) label.color = bad;
  for (const bad of [0, -4, Infinity, '12']) label.size = bad;
  assert.deepEqual([label.color, label.size, styled.length], [0x776e65, 48, 2]);
  // A text made as before, without a colour, a size or a way to restyle, is white and 24.
  const plain = new PlayText('x', () => {});
  plain.color = 0xff0000;
  assert.deepEqual([plain.color, plain.size], [0xff0000, 24]);
});
