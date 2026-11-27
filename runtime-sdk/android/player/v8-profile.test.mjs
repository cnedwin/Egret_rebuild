// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectV8Profile } from './v8-profile.mjs';

test('embedded V8 selection considers declared transitive capabilities and explicit host choice', () => {
  assert.equal(selectV8Profile(), 'trimmed');
  assert.equal(selectV8Profile(undefined, ['WebAssembly']), 'trimmed');
  assert.equal(selectV8Profile(undefined, ['WebAssembly', 'Intl']), 'standard');
  assert.equal(selectV8Profile('standard', []), 'standard');
  assert.equal(selectV8Profile('webview'), 'webview');
  assert.throws(() => selectV8Profile('trimmed', ['Intl']), /Intl requires/);
  assert.throws(() => selectV8Profile('webview', ['WebAssembly']), /embedded V8/);
  for (const input of [null, 'Intl', ['intl'], ['Intl', 'Intl'], ['DOM']])
    assert.throws(() => selectV8Profile(undefined, input), /requiredV8Features/);
});

test('the packaged notice preserves every pinned source byte and the ICU license', () => {
  const lock = JSON.parse(readFileSync(new URL('../v8-provenance.json', import.meta.url)));
  const legal = new URL('../../../third-party/', import.meta.url);
  const bundle = readFileSync(new URL('v8-' + lock.v8.version + '.NOTICES', legal));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  let pos = 0;
  for (const source of lock.notices) {
    const marker = Buffer.from('Upstream: ' + source.url + '\n\n');
    assert.deepEqual(bundle.subarray(pos, pos + marker.length), marker);
    pos += marker.length;
    assert.equal(sha(bundle.subarray(pos, pos + source.bytes)), source.sha256);
    pos += source.bytes;
    assert.equal(bundle.subarray(pos, pos + 2).toString(), '\n\n');
    pos += 2;
  }
  assert.equal(pos, bundle.length);
  assert.equal(sha(readFileSync(new URL('icu-19dfb44.LICENSE', legal))), lock.icu.licenseSha256);
});
