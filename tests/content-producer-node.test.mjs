// SPDX-License-Identifier: Apache-2.0
// A content build, fonts included, on another Node than the one the repository pins: refused, with a message that says
// which Node it found, which it needs and why. Another Node is stood in for in a child process, whose versions object
// is replaced before the tool loads; this process is untouched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Break caught: a refusal that names the version needed but not the version found or the reason, as a game met on
// Node 22.
test('CP01 another Node is refused with the version found, the version needed and why', () => {
  const script = `Object.defineProperty(process, 'versions', { value: { ...process.versions, node: '22.11.0' } });
    const { getContentProducer } = await import('./tools/content/importers.mjs');
    try { getContentProducer(); console.log('built'); } catch (error) { console.log(error.message); }`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(child.status, 0, child.stderr);
  const message = child.stdout.trim();
  assert.match(message, /fonts included/);
  assert.match(message, /Node 26\.7\.0 exactly/);
  assert.match(message, /this is Node 22\.11\.0/);
  assert.match(message, /build key and recipe/);
});
