// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inspectLegacyProject } from '../tools/egret-migrate/inspect.mjs';
import { selectLobbyInterface } from '../tools/egret-migrate/lobby-profile.mjs';

function viewFixture() {
  const files = new Map();
  const button = 'client/resource/eui_skins/ButtonSkin.exml';
  const manifest = {
    resources: [
      { name: 'idle_png', type: 'image', url: 'a.png' },
      { name: 'pressed_png', type: 'image', url: 'b.png' },
      { name: 'large_sound', type: 'sound', url: 'unused.mp3' }
    ],
    groups: [{ name: 'preload', keys: 'other,'.repeat(1100) }]
  };
  const theme = { skins: {}, exmls: [] };
  for (const [key, type] of Object.entries({
    SceneRoom: 'SceneRoomSkin',
    SceneLobby: 'SceneLobbySkin',
    RoomListItemRenderer: 'RoomListItemRendererSkin',
    'eui.Button': 'skins.ButtonSkin'
  })) {
    const file = 'resource/eui_skins/' + type.split('.').at(-1) + '.exml';
    theme.skins[key] = file;
    theme.exmls.push(file);
    files.set('client/' + file, '<e:Skin class="' + type + '" xmlns:e="http://ns.egret.com/eui"/>');
  }
  files.set(
    button,
    '<e:Skin class="skins.ButtonSkin" states="up,down" xmlns:e="http://ns.egret.com/eui">' +
      '<e:Image source="idle_png" source.down="pressed_png"/><e:Image source="idle_png"/></e:Skin>'
  );
  theme.exmls.push('resource/unselected.exml');
  for (const key of ['src/Game/UI/SceneLobby.ts', 'src/Game/UI/SceneRoom.ts', 'resource/a.png', 'resource/b.png']) {
    files.set('client/' + key, 'fixture input');
  }
  const read = key => {
    assert.ok(files.has(key), 'Unexpected read: ' + key);
    return { identity: { path: key }, bytes: Buffer.from(files.get(key)) };
  };
  const declarations = { 'client/resource/default.res.json': manifest, 'client/resource/default.thm.json': theme };
  return { manifest, theme, files, button, select: () => selectLobbyInterface(read, key => declarations[key]) };
}

test('the room interface selects its two scenes and retains author-owned resources and skin classes', () => {
  const selected = viewFixture().select();
  assert.deepEqual(
    selected.sources.map(file => file.path),
    ['client/src/Game/UI/SceneLobby.ts', 'client/src/Game/UI/SceneRoom.ts']
  );
  assert.deepEqual(selected.resources.files, [
    { sourcePath: 'client/resource/a.png', destinationPath: 'resource/a.png' },
    { sourcePath: 'client/resource/b.png', destinationPath: 'resource/b.png' }
  ]);
  assert.deepEqual(selected.resources.groups, [{ name: 'roomUI', resourceIndices: [0, 1] }]);
  assert.deepEqual(
    selected.theme.exmls.map(skin => skin.className),
    ['SceneLobbySkin', 'SceneRoomSkin', 'RoomListItemRendererSkin', 'skins.ButtonSkin']
  );
});

test('selected resource ambiguity, escaping URLs and missing theme declarations fail closed', () => {
  const duplicate = viewFixture();
  duplicate.manifest.resources.push(duplicate.manifest.resources[0]);
  assert.throws(duplicate.select, { code: 'MIGRATE_LOBBY_PROFILE' });
  const escaped = viewFixture();
  escaped.manifest.resources[0].url = '../out.png';
  assert.throws(escaped.select, { code: 'MIGRATE_RES_UNSUPPORTED' });
  const dynamic = viewFixture();
  dynamic.files.set(
    dynamic.button,
    dynamic.files.get(dynamic.button).replace('source.down="pressed_png"', 'source.down="{data.image}"')
  );
  assert.throws(dynamic.select, e => e.code === 'MIGRATE_LOBBY_PROFILE' && e.details.property === 'source');
  const missing = viewFixture();
  missing.theme.exmls = [];
  assert.throws(missing.select, { code: 'MIGRATE_LOBBY_PROFILE' });
});

test('the public profile requires the Wing declaration, original sibling and reviewed vendor bytes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-migrate-lobby-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const properties = {
    egret_version: '5.0.14',
    target: { current: 'web' },
    eui: { themes: ['resource/default.thm.json'] },
    modules: [
      ...['egret', 'game', 'res', 'eui', 'tween', 'socket'].map(name => ({ name })),
      { name: 'promise', path: './promise' },
      { name: 'socket.io', path: '../socket.io' }
    ]
  };
  write('client/egretProperties.json', properties);
  write(
    'client/index.html',
    '<div class="egret-player" data-entry-class="Main" data-content-width="640" data-content-height="480"></div>'
  );
  write('client/src/Main.ts', 'class Main {}');
  write('socket.io/tsconfig.json', { compilerOptions: { outFile: 'bin/socket.io/socket.io.js' } });
  write(
    'socket.io/bin/socket.io/socket.io.js',
    'throw new Error("inspection should never execute vendor JavaScript");'
  );
  const inspect = () => inspectLegacyProject(root, { profile: 'eraser-lobby' });
  assert.throws(
    inspect,
    e => e.code === 'MIGRATE_LOBBY_PROFILE' && e.details.path === 'socket.io/bin/socket.io/socket.io.js'
  );
  properties.modules.at(-1).path = '../../socket.io';
  write('client/egretProperties.json', properties);
  assert.throws(inspect, /sibling Socket.IO module/);
  assert.throws(() => inspectLegacyProject(root, { profile: 'eraser-lobby', sources: ['src/Main.ts'] }), {
    code: 'MIGRATE_ARGUMENTS'
  });
  assert.throws(() => inspectLegacyProject(path.join(root, 'client')), { code: 'MIGRATE_VERSION_UNSUPPORTED' });
  write('client/egretProperties.json', ' '.repeat(1024 * 1024 + 1));
  assert.throws(inspect, { code: 'MIGRATE_INPUT_FILE' });
});
