// SPDX-License-Identifier: Apache-2.0
// The API reference is what the built declarations give: every export of every entry is found, and the two documents
// are current.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { API_REFERENCE_DOCUMENTS, collectApi, renderApi } from '../tools/api-reference.mjs';

const api = collectApi();
test('AR01 every entry is listed and every name it exports is found', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../packages/engine/package.json', import.meta.url), 'utf8'));
  assert.deepEqual(
    api.map(entry => entry.entry),
    Object.keys(manifest.exports).map(key => '@egret/engine' + key.slice(1))
  );
  for (const entry of api) {
    assert.ok(entry.names.length > 0, entry.entry + ' exports nothing');
    assert.deepEqual(
      entry.names.filter(row => row.kind === 'unknown').map(row => row.name),
      [],
      entry.entry
    );
    assert.equal(
      new Set(entry.names.map(row => row.name)).size,
      entry.names.length,
      entry.entry + ' lists a name twice'
    );
  }
});
test('AR02 a name has its kind and the first sentence written above it', () => {
  const row = (entry, name) => api.find(item => item.entry === entry).names.find(item => item.name === name);
  assert.deepEqual(row('@egret/engine', 'createEngine')?.kind, 'function');
  assert.equal(row('@egret/engine', 'Sprite')?.kind, 'class');
  assert.equal(row('@egret/engine', 'EngineOptions')?.kind, 'interface');
  assert.match(
    row('@egret/engine/web/game', 'createBrowserGame').says,
    /^Makes a game ready to draw: `await createBrowserGame\(\{ canvas, width, height, update \}\)`, then add display objects to `game\.stage`\.$/
  );
  // A sentence ends at its full stop, not at one inside a span of code.
  assert.match(row('@egret/engine', 'animate').says, /\.start\(\)`\.$/);
});
test('AR03 the two documents are what the declarations give now', () => {
  for (const language of ['en', 'zh'])
    assert.equal(
      fs.readFileSync(new URL('../' + API_REFERENCE_DOCUMENTS[language], import.meta.url), 'utf8'),
      renderApi(api, language),
      API_REFERENCE_DOCUMENTS[language] + ' is out of date: run node tools/api-reference.mjs'
    );
});
