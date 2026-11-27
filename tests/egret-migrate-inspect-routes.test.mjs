// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectRoutes } from '../tools/egret-migrate/inspect-routes.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-route-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const src = path.join(base, 'source'),
    pub = path.join(base, 'published'),
    prepared = path.join(base, 'prepared');
  function put(root, file, value) {
    const name = path.join(root, file);
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, typeof value === 'string' ? value : JSON.stringify(value));
    return name;
  }
  const initial = ['libs/modules/egret/egret.js', 'libs/modules/egret/egret.web.js'];
  const game = ['bin-debug/Main.js'];
  const property = { engineVersion: '5.3.10', compilerVersion: '5.3.10', modules: [{ name: 'egret' }] };
  put(src, 'egretProperties.json', property);
  put(
    src,
    'index.html',
    '<div class="egret-player" data-entry-class="Main" data-content-width="80" data-content-height="80"></div>'
  );
  put(src, 'resource/default.res.json', { resources: [], groups: [] });
  put(src, 'src/Main.ts', 'class Main extends egret.Sprite {}');
  put(src, 'manifest.json', { initial, game });
  put(pub, 'manifest.json', { initial, game });
  put(pub, initial[0], 'var Capabilities={}; Capabilities.engineVersion="5.3.10";');
  put(pub, game[0], 'document.addEventListener("mousemove",onMove);');
  const map = { 'original/0000.js': initial[0], 'original/0001.js': game[0] };
  put(prepared, 'original-script-map.json', map);
  put(prepared, 'original/0001.js', fs.readFileSync(path.join(pub, game[0]), 'utf8'));
  const launch = put(base, 'launch.json', {
    apkSha256: 'f'.repeat(64),
    player: {
      lastError: 'Cannot run project script original/0001.js: ReferenceError: document is not defined; private-value'
    }
  });
  return { src, pub, prepared, launch, put, map, initial, game };
}

test('each route reports its own admissible inputs without requiring compilation or running source', t => {
  const { src, pub, prepared, launch } = fixture(t);
  assert.throws(() => inspectRoutes(src, {}, { published: pub, compiler: path.join(pub, 'bin-debug/Main.js') }), {
    code: 'MIGRATE_COMPILER'
  });
  const source = inspectRoutes(src).routes;
  assert.equal(source.web.status, 'eligible');
  assert.equal(source.android.status, 'missing-published-scripts');
  assert.equal(source.hostUsage.status, 'not-scanned');
  const published = inspectRoutes(pub).routes;
  assert.equal(published.web.status, 'needs-source');
  assert.equal(published.android.status, 'ready-for-preparation');
  assert.deepEqual(
    published.android.groups.map(g => [g.name, g.files]),
    [
      ['originalCore', 1],
      ['originalGame', 1]
    ]
  );
  const mapped = inspectRoutes(src, {}, { published: pub, prepared, launch }).routes.android;
  assert.equal(mapped.status, 'observed-startup-failure');
  assert.equal(mapped.observation.publishedPath, 'bin-debug/Main.js');
  assert(!JSON.stringify(mapped).includes('private-value'));
  assert.equal(mapped.observation.association, 'supplied-run-and-prepared-directory');
  fs.unlinkSync(path.join(prepared, 'original-script-map.json'));
  fs.writeFileSync(
    path.join(prepared, 'project.json'),
    JSON.stringify({
      v8Scripts: {
        groups: {
          originalCore: ['original/0000.js'],
          originalGame: ['original/0001.js']
        }
      }
    })
  );
  assert.equal(
    inspectRoutes(src, {}, { published: pub, prepared, launch }).routes.android.observation.mapOrigin,
    'earlier-prepared-groups'
  );
});

test('contradictory map, staged script, or source and published order refuse a launch association', t => {
  const { src, pub, prepared, launch, initial, game, map, put } = fixture(t);
  const run = () => inspectRoutes(src, {}, { published: pub, prepared, launch });
  const cleanLaunch = put(prepared, 'ok.json', { apkSha256: 'f'.repeat(64), player: { lastError: '' } });
  assert.throws(() => inspectRoutes(src, {}, { published: pub, prepared, launch: cleanLaunch }), {
    code: 'MIGRATE_ANDROID_RUN'
  });
  put(prepared, 'original-script-map.json', { ...map, 'original/0001.js': initial[0] });
  assert.throws(run, { code: 'MIGRATE_ANDROID_RUN' });
  put(prepared, 'original-script-map.json', map);
  put(prepared, 'original/0001.js', 'another version');
  assert.throws(run, { code: 'MIGRATE_ANDROID_RUN' });
  put(pub, 'manifest.json', { initial, game: [...game, '../wrong.js'] });
  assert.equal(inspectRoutes(pub).routes.android.status, 'invalid-script-order');
  put(pub, 'manifest.json', { initial, game: ['bin-debug/Not Portable.js'] });
  assert.equal(inspectRoutes(pub).routes.android.status, 'invalid-script-order');
  put(pub, 'manifest.json', { initial, game: [...game, 'bin-debug/Other.js'] });
  assert.throws(run, { code: 'MIGRATE_ANDROID_INPUT' });
});

test('Web slice and Android package budgets are independent and preserve original order', t => {
  const { src, pub, initial, put } = fixture(t);
  const game = Array.from({ length: 513 }, (_, i) => 'bin-debug/F' + i + '.js');
  put(src, 'manifest.json', { initial, game });
  put(pub, 'manifest.json', { initial, game });
  const { web, android } = inspectRoutes(src, {}, { published: pub }).routes;
  assert.equal(web.status, 'review-required');
  assert.equal(web.nextAction, 'select-supported-gameplay-slice');
  assert.deepEqual(
    web.reviewRanges.map(r => [r.start, r.endExclusive, r.first, r.last]),
    [
      [0, 512, 'src/F0.ts', 'src/F511.ts'],
      [512, 513, 'src/F512.ts', 'src/F512.ts']
    ]
  );
  assert.equal(android.counts.missing, 513);
  assert.equal(android.groups.at(-1).last, game.at(-1));
  put(pub, 'manifest.json', { initial, game: Array.from({ length: 4095 }, (_, i) => 's' + i + '.js') });
  assert.equal(inspectRoutes(pub).routes.android.status, 'over-budget');
  put(pub, 'manifest.json', { initial, game: ['a.js', 'A.js'] });
  assert.equal(inspectRoutes(pub).routes.android.status, 'duplicate-scripts');
});

test('a supplied trusted compiler records locations and skips comments and string literals', {
  skip: !process.env.EGRET_LEGACY_COMPILER && 'Supply the separately installed TypeScript-Plus compiler.'
}, t => {
  const { src, put } = fixture(t);
  put(
    src,
    'src/Main.ts',
    [
      '// document.getElementById("secret");',
      'const text = "wx.login()";',
      'document.addEventListener("keydown", onKey);',
      'window.wx.login();',
      'RES.getRes("known");',
      'RES.getRes("map_" + this.id);'
    ].join('\n')
  );
  const usage = inspectRoutes(src, {}, { compiler: process.env.EGRET_LEGACY_COMPILER }).routes.hostUsage;
  assert.equal(usage.status, 'scanned');
  assert.equal(usage.findings['browser-host'].occurrences, 1);
  assert.equal(usage.findings['browser-host'].examples[0].line, 3);
  assert.equal(usage.findings['platform-bridge'].examples[0].line, 4);
  assert.equal(usage.findings['dynamic-resource'].examples[0].line, 6);
  assert(!JSON.stringify(usage).includes('secret'));
});

test('native ABI qualification uses the exact original Android preparer contract', t => {
  const { pub, put, initial } = fixture(t);
  const inspect = () => inspectRoutes(pub).routes.android;
  put(pub, initial[0], 'Capabilities.engineVersion="5.3.4";');
  assert.equal(inspect().status, 'review-core-abi');
  assert.equal(inspect().nextAction, 'qualify-original-core-abi');
  put(pub, initial[0], 'Capabilities.engineVersion="5.3.1"; var requiredNrABIVersion=5;');
  assert.equal(inspect().status, 'review-core-abi');
  put(pub, initial[0], 'Capabilities.engineVersion="5.3.4"; var requiredNrABIVersion=4;');
  assert.equal(inspect().status, 'ready-for-preparation');
  assert.equal(inspect().nativeAbi, 4);
});
