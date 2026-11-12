// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioBank } from '@egret/integrations/web/audio';

test('the browser audio factory refuses a host without a browser audio platform', () => {
  assert.throws(() => createAudioBank({ clips: { tone: { src: ['example.wav'] } } }), {
    integration: 'audio', code: 'platform-unavailable',
  });
});
