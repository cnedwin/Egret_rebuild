// guide/entries.json says which engine entries each entry brings with it, for tools that count what a game uses.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { entryMap, engineEntries } from '../tools/entry-map.mjs';
import { planVendor } from '../tools/vendor-game.mjs';

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

test('EM02 BrowserGame example import maps cover the built browser game dependency closure', () => {
  const entries = entryMap(),
    examples = new URL('../examples/', import.meta.url);
  const publicEntries = new Set(engineEntries());
  let checked = 0;
  for (const name of fs.readdirSync(examples, { recursive: true }).filter(name => name.endsWith('.html'))) {
    const text = fs.readFileSync(new URL(name.replaceAll('\\', '/'), examples), 'utf8');
    const match = /<script type="importmap">([\s\S]*?)<\/script>/.exec(text);
    if (!match) continue;
    const { imports } = JSON.parse(match[1]);
    const publicNames = Object.keys(imports).filter(key => publicEntries.has(key));
    if (
      !publicNames.some(
        key => key === '@egret/engine/web/game' || entries.includes[key].includes('@egret/engine/web/game')
      )
    )
      continue;
    const { map } = planVendor(publicNames);
    assert.deepEqual(
      Object.keys(map).filter(key => !Object.hasOwn(imports, key)),
      [],
      name
    );
    checked++;
  }
  assert.ok(checked > 0, 'at least one BrowserGame example');
});
