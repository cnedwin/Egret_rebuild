// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { crc32 } from 'node:zlib';
import { PNG } from 'pngjs';
import { convertProject } from '../tools/egret-migrate/convert.mjs';
import { inspectLegacyProject } from '../tools/egret-migrate/inspect.mjs';
import { normalizeLegacyPng } from '../tools/egret-migrate/legacy-assets.mjs';

test('legacy grayscale PNG normalizes to equivalent RGBA8 while admitted PNG bytes remain untouched', () => {
  const rgba = PNG.sync.write({ width: 2, height: 1, data: Buffer.from([32, 32, 32, 255, 192, 192, 192, 255]) });
  const grayscale = PNG.sync.write(PNG.sync.read(rgba), { colorType: 0, inputColorType: 6 });
  assert.equal(grayscale[25], 0);
  const result = normalizeLegacyPng(grayscale, 'resource/atlas.png');
  assert.equal(result[25], 6);
  assert.deepEqual(PNG.sync.read(result).data, PNG.sync.read(grayscale).data);
  assert.equal(normalizeLegacyPng(rgba, 'resource/atlas.png'), rgba);
  const text = Buffer.from('Comment\0original art');
  const chunk = Buffer.alloc(text.length + 12);
  chunk.writeUInt32BE(text.length);
  chunk.write('tEXt', 4);
  text.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + text.length)), 8 + text.length);
  const metadata = Buffer.concat([rgba.subarray(0, 33), chunk, rgba.subarray(33)]);
  const normalized = normalizeLegacyPng(metadata, 'resource/atlas.png');
  assert.deepEqual(PNG.sync.read(normalized).data, PNG.sync.read(metadata).data);
  assert.equal(normalized.includes(Buffer.from('original art')), false);
});

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
    modules: [{ name: 'egret' }, { name: 'custom-ui' }]
  });
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_MODULE_UNSUPPORTED' });
});

test('inspect admits a declared EUI theme, intact EXML and local atlas subkeys through RES planning', t => {
  const { folder, write } = oldProject(t);
  write('egretProperties.json', {
    engineVersion: '5.2.29',
    compilerVersion: '5.2.29',
    modules: [{ name: 'egret' }, { name: 'eui' }]
  });
  write('resource/default.thm.json', { skins: { Main: 'PanelSkin' }, exmls: ['resource/PanelSkin.exml'] });
  write(
    'resource/PanelSkin.exml',
    '<e:Skin xmlns:e="http://ns.egret.com/eui" class="PanelSkin" width="360" height="600"><e:Group width="100%"><e:Image id="icon" source="star" width="20" height="30"/></e:Group></e:Skin>'
  );
  write('resource/default.res.json', {
    resources: [{ name: 'icons', type: 'sheet', url: 'icons.json', subkeys: 'star' }],
    groups: [{ name: 'preload', keys: 'star,icons' }]
  });
  write('resource/icons.json', {
    file: 'icons.png',
    frames: { star: { x: 1, y: 2, w: 10, h: 12, offX: 2, offY: 3, sourceW: 20, sourceH: 30 } }
  });
  write('resource/icons.png', 'Fixture page');
  const result = inspectLegacyProject(folder);
  assert.equal(result.theme.exmls[0].className, 'PanelSkin');
  assert.equal(result.theme.exmls[0].root.children[0].children[0].properties.source, 'star');
  assert.equal(result.sheets[0].frames[0].sourceWidth, 20);
  assert.equal(
    result.resources.files.some(file => file.sourcePath === 'resource/icons.png'),
    true
  );
  assert.deepEqual(result.resources.groups[0].resourceIndices, [0, 0]);
  assert.equal(
    result.inputs.some(file => file.path === 'resource/PanelSkin.exml'),
    true
  );
  write('resource/icons.json', { file: '../outside.png', frames: { star: { x: 1, y: 2, w: 10, h: 12 } } });
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_RES_UNSUPPORTED' });
});

test('conversion admits an exact DragonBones image pair and writes only neutral data into the browser resource paths', async t => {
  const { folder, write } = oldProject(t);
  const outputs = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-bones-output-'));
  t.after(() => fs.rmSync(outputs, { recursive: true, force: true }));
  write('egretProperties.json', {
    engineVersion: '5.2.29',
    compilerVersion: '5.2.29',
    modules: [{ name: 'egret' }, { name: 'dragonBones' }]
  });
  write('resource/default.res.json', {
    resources: [
      { name: 'rig', type: 'json', url: 'rig.json' },
      { name: 'atlas', type: 'json', url: 'atlas.json' },
      { name: 'page', type: 'image', url: 'page.png' }
    ],
    groups: [{ name: 'preload', keys: 'rig,atlas,page' }]
  });
  const skeleton = {
    name: 'rig',
    version: '5.5',
    frameRate: 24,
    armature: [
      {
        name: 'actor',
        bone: [{ name: 'body' }],
        slot: [{ name: 'part', parent: 'body' }],
        skin: [{ slot: [{ name: 'part', display: [{ name: 'body' }] }] }],
        animation: [{ name: 'idle', duration: 24 }]
      }
    ]
  };
  const atlas = {
    name: 'rig',
    imagePath: 'page.png',
    width: 2,
    height: 2,
    SubTexture: [{ name: 'body', x: 0, y: 0, width: 2, height: 2 }]
  };
  write('resource/rig.json', skeleton);
  write('resource/atlas.json', atlas);
  fs.writeFileSync(
    path.join(folder, 'resource/page.png'),
    PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) })
  );
  const bones = [{ skeleton: 'rig', atlas: 'atlas', texture: 'page' }];
  assert.throws(() => inspectLegacyProject(folder), { code: 'MIGRATE_BONES_MANIFEST' });
  assert.equal(inspectLegacyProject(folder, { bones }).bones[0].descriptor.schema, 'egret.migrate-bones/1');
  write('engine.mjs', 'export {};\n');
  const options = {
    source: folder,
    out: path.join(outputs, 'converted'),
    engine: path.join(folder, 'engine.mjs'),
    engineVersion: '7.0.2',
    bones,
    esbuild: {
      async transform(code) {
        return { code };
      }
    }
  };
  const result = await convertProject(options);
  const generated = key => JSON.parse(fs.readFileSync(path.join(options.out, key), 'utf8'));
  assert.deepEqual(generated('resource/rig.json'), skeleton);
  assert.deepEqual(generated('resource/atlas.json'), atlas);
  assert.deepEqual(generated('web/resource/rig.json'), generated('web/resource/atlas.json'));
  assert.equal(generated('web/resource/rig.json').schema, 'egret.migrate-bones/1');
  assert.equal(result.browserFiles.includes('legacy-bones.mjs'), true);
  assert.deepEqual(generated('bones-map.json'), bones);
  write('resource/atlas.json', { ...atlas, imagePath: 'wrong.png' });
  assert.throws(() => inspectLegacyProject(folder, { bones }), { code: 'MIGRATE_BONES_MANIFEST' });
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
