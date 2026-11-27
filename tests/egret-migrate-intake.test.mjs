// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectLegacyProject } from '../tools/egret-migrate/inspect.mjs';
import { rebuildProject } from '../tools/egret-migrate/rebuild.mjs';
import { convertProject } from '../tools/egret-migrate/convert.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egret53-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'source');
  const write = (key, data) => {
    const file = path.join(root, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  };
  const properties = { engineVersion: '5.3.10', compilerVersion: '5.3.10', modules: [{ name: 'egret' }] };
  write('egretProperties.json', properties);
  write(
    'index.html',
    '<div class="egret-player" data-entry-class="Main" data-content-width="320" data-content-height="480"></div>'
  );
  write('manifest.json', { initial: ['libs/modules/egret/egret.js'], game: ['bin-debug/Main.js'] });
  write('src/Main.ts', 'class Main extends egret.Sprite {}');
  write('resource/default.res.json', { groups: [], resources: [] });
  return { root, write, properties, out: path.join(dir, 'output') };
}

test('5.3 intake retains order and aggregates missing local inputs and external work without executing the project', async t => {
  const { root, write, properties, out } = fixture(t);
  fs.appendFileSync(
    path.join(root, 'index.html'),
    '<script src="https://auth.invalid/a.js?token=private-fixture"></script>'
  );
  properties.modules.push({ name: 'eui' }, { name: 'socket' }, { name: 'billing', path: './plugins/billing' });
  write('egretProperties.json', properties);
  write('src/State.ts', 'throw new Error("must not run")');
  write('src/Types.d.ts', 'declare const unused: string;');
  write('manifest.json', {
    initial: ['libs/modules/egret/egret.js', 'vendor/billing.js'],
    game: ['bin-debug/State.js', 'bin-debug/Main.js', 'bin-debug/Later.js']
  });
  write('resource/default.thm.json', { exmls: ['resource/Main.exml'], skins: { Card: 'resource/Card.exml' } });
  write('resource/Main.exml', '<e:Skin/>');
  write('resource/second.res.json', {
    groups: [{ name: 'preload', keys: 'absent,remote' }],
    resources: [
      { name: 'absent', type: 'image', url: 'absent.png' },
      { name: 'remote', type: 'image', url: 'https://example.invalid/image.png?token=private-fixture' }
    ]
  });
  const result = inspectLegacyProject(root);
  assert.equal(result.conversion.status, 'review-required');
  const { inventory } = result;
  assert.deepEqual(inventory.scripts.sourceOrder, ['src/State.ts', 'src/Main.ts', 'src/Later.ts']);
  assert.deepEqual(inventory.scripts.missingSources, ['src/Later.ts']);
  assert.deepEqual(inventory.scripts.extraInitial, ['vendor/billing.js']);
  assert.equal(inventory.htmlBootstrap.requiresReview, true);
  assert.deepEqual(inventory.scripts.declarations, ['src/Types.d.ts']);
  assert.deepEqual(inventory.modulesNeedingAdapters, ['socket', 'billing']);
  assert.deepEqual(inventory.themes[0].missing, ['resource/Card.exml']);
  const second = inventory.resourceManifests[1];
  assert.deepEqual(second.missing, ['resource/absent.png']);
  assert.deepEqual(second.external, ['remote']);
  assert.equal(JSON.stringify(result).includes('private-fixture'), false);
  await assert.rejects(convertProject({ source: root, out }), { code: 'MIGRATE_REVIEW_REQUIRED' });
  assert.equal(fs.existsSync(out), false);
});

test('5.3 custom HTML interaction requests a host adapter before conversion', t => {
  const { root } = fixture(t);
  fs.appendFileSync(path.join(root, 'index.html'), '<section onload="boot()"><button>Buy</button></section>');
  const report = inspectLegacyProject(root);
  assert.equal(report.inventory.htmlBootstrap.hasPageInteraction, true);
  assert.ok(report.conversion.reasons.includes('MIGRATE_HTML_BOOTSTRAP'));
});

test('an oversized ordered program stays inspectable without dropping any script or raising the conversion limit', t => {
  const { root, write } = fixture(t);
  const game = ['bin-debug/Main.js', ...Array.from({ length: 512 }, (_, index) => 'bin-debug/Group' + index + '.js')];
  write('manifest.json', { initial: [], game });
  const result = inspectLegacyProject(root);
  assert.equal(result.inventory.scripts.sourceOrder.length, 513);
  assert.equal(result.inventory.scripts.sourceOrder[512], 'src/Group511.ts');
  assert.equal(result.inventory.scripts.missingSources.length, 512);
  assert.deepEqual(result.conversion.reasons, ['MIGRATE_SOURCE_LIMIT', 'MIGRATE_SOURCE_MISSING']);
  assert.equal(result.inventory.scripts.sourceLimit, 512);
  assert.equal(result.stage.width, 320);
});

test('editable rebuild retains the project ID, reports changed dependencies and retries a missing input', async t => {
  const { root, write, out } = fixture(t);
  const esbuild = {
    async transform(code) {
      return { code };
    }
  };
  write('resource/settings.json', '{}');
  write('resource/default.res.json', {
    resources: [{ name: 'settings', type: 'json', url: 'settings.json' }],
    groups: []
  });
  write('engine.mjs', 'export {};');
  const first = await convertProject({
    source: root,
    out,
    engine: path.join(root, 'engine.mjs'),
    engineVersion: '7.0.2',
    esbuild
  });
  const snapshot = JSON.parse(fs.readFileSync(path.join(out, 'web/project.json'), 'utf8'));
  const entity = snapshot.entities[0];
  entity.data.stage.width = 400;
  const transaction = JSON.stringify({
    command: 'edit',
    projectId: first.projectId,
    transactionId: 't_stage',
    baseRevision: 1,
    toolProtocolVersion: '1.0',
    source: {
      actorId: 'a_migrate',
      actorKind: 'agent',
      intent: 'Set width',
      toolId: 'egret-migrate',
      toolVersion: '0.5.0'
    },
    scope: { entityIds: [entity.id], fileIds: [], metadata: false, roots: false },
    operations: [{ op: 'putEntity', entity }]
  });
  const edited = path.join(path.dirname(root), 'edited');
  await rebuildProject({ source: out, out: edited, esbuild, transaction });
  const replay = path.join(path.dirname(root), 'replayed');
  const restored = await rebuildProject({ source: edited, out: replay, esbuild });
  assert.equal(restored.revision, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(replay, 'web/project.json'))).entities[0].data.stage.width, 400);
  assert.deepEqual(restored.inputChanges, { added: [], changed: [], removed: [] });
  const next = path.join(path.dirname(root), 'next');
  fs.writeFileSync(path.join(out, 'src/Main.ts'), 'class Main extends egret.Sprite { lives = 4; }');
  fs.writeFileSync(
    path.join(out, 'resource/default.res.json'),
    JSON.stringify({
      groups: [],
      resources: [{ name: 'mission', type: 'json', url: 'mission.json' }]
    })
  );
  await assert.rejects(rebuildProject({ source: out, out: next, esbuild }), { code: 'MIGRATE_REVIEW_REQUIRED' });
  assert.equal(fs.existsSync(next), false);
  fs.writeFileSync(path.join(out, 'resource/mission.json'), '{"goal":4}');
  const rebuilt = await rebuildProject({ source: out, out: next, esbuild });
  assert.equal(rebuilt.projectId, first.projectId);
  assert.deepEqual(rebuilt.target, first.target);
  assert.deepEqual(rebuilt.inputChanges, {
    added: ['resource/mission.json'],
    changed: ['resource/default.res.json', 'src/Main.ts'],
    removed: ['resource/settings.json']
  });
  assert.equal(fs.existsSync(path.join(next, 'resource/settings.json')), false);
  assert.match(fs.readFileSync(path.join(next, 'web/game.mjs'), 'utf8'), /lives = 4/);
  fs.writeFileSync(path.join(out, 'web/egret2d.mjs'), 'changed');
  await assert.rejects(rebuildProject({ source: out, out: next, esbuild }), { code: 'MIGRATE_REBUILD_ENGINE' });
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(next, 'conversion.json'))),
    JSON.parse(JSON.stringify(rebuilt))
  );
});

test('5.3 classic subset reaches the existing conversion path and version mismatches stay refused', async t => {
  const { root, write, properties, out } = fixture(t);
  write('resource/settings.json', '{}');
  write('resource/default.res.json', {
    resources: [{ name: 'settings', type: 'json', url: 'settings.json' }],
    groups: []
  });
  write('engine.mjs', 'export {};');
  write('src/GameTypes.d.ts', 'declare type Score = number;');
  write('tsconfig.json', '{"compilerOptions":{"target":"es5"}}');
  const admitted = inspectLegacyProject(root);
  assert.equal(admitted.conversion.status, 'eligible');
  assert.equal(admitted.engineVersion, '5.3.10');
  assert.equal(admitted.sources[0].path, 'src/Main.ts');
  const result = await convertProject({
    source: root,
    out,
    engine: path.join(root, 'engine.mjs'),
    engineVersion: '7.0.2',
    esbuild: {
      async transform(code) {
        return { code };
      }
    }
  });
  assert.equal(result.revision, 1);
  assert.equal(fs.readFileSync(path.join(out, 'src/Main.ts'), 'utf8'), 'class Main extends egret.Sprite {}');
  assert.equal(fs.readFileSync(path.join(out, 'src/GameTypes.d.ts'), 'utf8'), 'declare type Score = number;');
  assert.equal(fs.existsSync(path.join(out, 'tsconfig.json')), true);
  write('egretProperties.json', { ...properties, compilerVersion: '5.3.9' });
  assert.throws(() => inspectLegacyProject(root), { code: 'MIGRATE_VERSION_UNSUPPORTED' });
});
