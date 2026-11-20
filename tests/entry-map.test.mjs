// guide/entries.json says which engine entries each entry brings with it, for tools that count what a game uses.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { entryMap, engineEntries } from '../tools/entry-map.mjs';

test('EM01 guide/entries.json is what the built engine gives, and names every engine entry', () => {
  const written = JSON.parse(fs.readFileSync(new URL('../guide/entries.json', import.meta.url), 'utf8'));
  assert.deepEqual(written, entryMap(), 'run node tools/entry-map.mjs');
  assert.deepEqual(Object.keys(written.includes).sort(), engineEntries());
  // The browser game brings its inputs and loop; the 3D app brings the overlay's 2D game.
  for (const part of ['@egret/engine/web/pointer', '@egret/engine/web/keyboard', '@egret/engine/web/loop'])
    assert.ok(written.includes['@egret/engine/web/game'].includes(part), part);
  assert.ok(written.partOf['@egret/engine/web/game'].includes('@egret/engine/play'));
  for (const [entry, parts] of Object.entries(written.includes)) assert.ok(!parts.includes(entry), entry);
});
