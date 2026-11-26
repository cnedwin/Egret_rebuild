// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { convertProject } from '../tools/egret-migrate/convert.mjs';
import { inspectLegacyProject } from '../tools/egret-migrate/inspect.mjs';

function oldProject(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-migrate-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const write = (relative, body) => {
    const destination = path.join(folder, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, typeof body === 'string' ? body : JSON.stringify(body));
  };
  write('egretProperties.json', {
    engineVersion: '5.2.29',
    compilerVersion: '5.2.29',
    modules: [{ name: 'egret' }, { name: 'game' }, { name: 'assetsmanager' }]
  });
  write(
    'index.html',
    '<div data-content-width="360" class="egret-player" data-entry-class="Main" data-content-height="600" data-scale-mode="showAll"></div>'
  );
  write('manifest.json', {
    initial: ['libs/modules/egret/egret.js'],
    game: ['bin-debug/State.js', 'bin-debug/Main.js']
  });
  write('src/State.ts', 'class State {}\n');
  write('src/Main.ts', 'class Main extends egret.Sprite {}\n');
  write('resource/default.res.json', {
    resources: [{ name: 'settings', type: 'json', url: 'settings.json' }],
    groups: [{ name: 'preload', keys: 'settings,settings' }]
  });
  write('resource/settings.json', { lives: 3 });
  return { folder, write };
}

test('inspect reuses the RES plan and preserves source and group order from a 5.2 web project', t => {
  const { folder } = oldProject(t);
  const project = inspectLegacyProject(folder);
  assert.equal(project.engineVersion, '5.2.29');
  assert.deepEqual(project.stage, { entry: 'Main', width: 360, height: 600, fit: 'contain' });
  assert.deepEqual(
    project.sources.map(file => file.path),
    ['src/State.ts', 'src/Main.ts']
  );
  assert.deepEqual(project.resources.groups, [{ name: 'preload', resourceIndices: [0, 0] }]);
  assert.equal(project.resources.files[0].sourcePath, 'resource/settings.json');
});

test('inspect refuses unsupported modules, ambiguous script paths, and nonlocal RES', t => {
  const { folder, write } = oldProject(t);
  write('manifest.json', { initial: [], game: ['../../Main.js'] });
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_SOURCE_ORDER' });
  write('manifest.json', { initial: [], game: ['bin-debug/Main.js'] });
  write('resource/default.res.json', {
    resources: [{ name: 'remote', type: 'image', url: 'https://example.com/remote.png' }],
    groups: []
  });
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_RES_UNSUPPORTED' });
  write('egretProperties.json', {
    engineVersion: '5.2.29',
    compilerVersion: '5.2.29',
    modules: [{ name: 'egret' }, { name: 'eui' }]
  });
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_MODULE_UNSUPPORTED' });
});

test('convert creates a real scoped import receipt in an independent and reproducible output', async t => {
  const { folder, write } = oldProject(t);
  const outputs = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-migrate-output-'));
  t.after(() => fs.rmSync(outputs, { recursive: true, force: true }));
  write('engine.mjs', 'export {};\n');
  write('LICENSE.txt', 'Fixture notice\r\n');
  const options = {
    source: folder,
    out: path.join(outputs, 'one'),
    engine: path.join(folder, 'engine.mjs'),
    engineVersion: '7.0.2',
    esbuild: {
      async transform(code) {
        return { code };
      }
    }
  };
  const receipt = await convertProject(options);
  const second = await convertProject({ ...options, out: path.join(outputs, 'two') });
  assert.deepEqual(second, receipt);
  assert.equal(receipt.revision, 1);
  assert.deepEqual(receipt.receipt.diff.addedFileIds, ['f_resource_0']);
  const actual = key => fs.readFileSync(path.join(options.out, key), 'utf8');
  const project = JSON.parse(actual('web/project.json'));
  assert.equal(project.versions.engineVersion, '7.0.2');
  assert.deepEqual(project.roots, ['e_client']);
  assert.equal(actual('src/Main.ts'), 'class Main extends egret.Sprite {}\n');
  assert.equal(actual('web/resource/settings.json'), '{"lives":3}');
  assert.equal(actual('LICENSE.txt'), 'Fixture notice\r\n');
  assert.equal(fs.existsSync(path.join(folder, 'history.json')), false);
  const previousReport = actual('conversion.json');
  await assert.rejects(convertProject(options), { code: 'EEXIST' });
  assert.equal(actual('conversion.json'), previousReport);

  await assert.rejects(convertProject({ ...options, out: path.join(folder, 'invalid') }), {
    code: 'MIGRATE_OUTPUT_OWNER'
  });
  const entity = project.entities[0];
  entity.data.stage.width = 480;
  const repair = JSON.stringify({
    command: 'edit',
    projectId: project.projectId,
    transactionId: 't_wider',
    baseRevision: 1,
    toolProtocolVersion: '1.0',
    source: {
      actorId: 'a_migrate',
      actorKind: 'agent',
      intent: 'Adjust width',
      toolId: 'egret-migrate',
      toolVersion: '0.1.0'
    },
    scope: { entityIds: [entity.id], fileIds: [], metadata: false, roots: false },
    operations: [{ op: 'putEntity', entity }]
  });
  const repaired = await convertProject({ ...options, out: path.join(outputs, 'repair'), transaction: repair });
  assert.equal(repaired.revision, 2);
  assert.deepEqual(repaired.repair.diff.changedEntityIds, ['e_client']);
});
