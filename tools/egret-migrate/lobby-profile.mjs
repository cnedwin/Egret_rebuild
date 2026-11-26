// SPDX-License-Identifier: Apache-2.0
import { compileExml } from './exml.mjs';
import { planMigratedResources } from './legacy-assets.mjs';

export const eraserLobbyProfile = 'eraser-lobby';
const vendorPath = 'socket.io/bin/socket.io/socket.io.js';
// The original browser bundle is supplied by the game owner and is never executed during inspection.
const vendorSha256 = '0d1178ab2803ad8fcace11f6efb69b8c44a886f9022b64ef77911e8a1572e0bd';
const scenes = Object.freeze(['SceneLobby', 'SceneRoom']);
const themes = {
  SceneLobby: 'SceneLobbySkin',
  SceneRoom: 'SceneRoomSkin',
  RoomListItemRenderer: 'RoomListItemRendererSkin',
  'eui.Button': 'skins.ButtonSkin'
};
const modules = new Map([
  ['egret', undefined],
  ['game', undefined],
  ['res', undefined],
  ['eui', undefined],
  ['tween', undefined],
  ['socket', undefined],
  ['promise', './promise'],
  ['socket.io', '../socket.io']
]);

function invalid(message, details) {
  throw Object.assign(new Error(message), { code: 'MIGRATE_LOBBY_PROFILE', details });
}

function checkProperties(properties) {
  if (
    properties?.egret_version !== '5.0.14' ||
    properties.engineVersion !== undefined ||
    properties.compilerVersion !== undefined ||
    properties.target?.current !== 'web' ||
    properties.eui?.themes?.length !== 1 ||
    properties.eui.themes[0] !== 'resource/default.thm.json'
  ) {
    invalid('Expected the Wing 5.0.14 Web client and its declared EUI theme.');
  }
  const declared = properties.modules;
  if (
    !Array.isArray(declared) ||
    declared.length !== modules.size ||
    new Set(declared.map(item => item?.name)).size !== modules.size ||
    declared.some(item => !modules.has(item?.name) || modules.get(item.name) !== item.path)
  ) {
    invalid('The game modules must match the profile, including the sibling Socket.IO module.');
  }
}

function readLobbyTheme(read, declaration) {
  const themePath = 'resource/default.thm.json';
  if (!Array.isArray(declaration?.exmls) || declaration.exmls.length > 512) invalid('Expected a bounded EXML list.');
  const exmls = Object.entries(themes).map(([component, className]) => {
    const filename = className.split('.').at(-1);
    const file = 'resource/eui_skins/' + filename + '.exml';
    if (declaration.skins?.[component] !== file || !declaration.exmls.includes(file)) {
      invalid('A required skin must be declared by the original theme.', { component, path: file });
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(read('client/' + file).bytes);
    } catch (error) {
      if (error.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') throw error;
      invalid('A selected skin must contain UTF-8 text.', { path: file });
    }
    const skin = compileExml(text, { path: file });
    if (skin.className !== className) invalid('The selected skin class differs from its declaration.', { path: file });
    return skin;
  });
  return { themePath, skins: { 'eui.Button': themes['eui.Button'] }, exmls };
}

function skinImageNames(theme) {
  const names = new Set();
  function visit(node, skin) {
    if (node.type === 'Image') {
      for (const properties of [node.properties, ...Object.values(node.overrides ?? {})]) {
        const value = properties.source;
        if (value === undefined || value === '') continue;
        if (typeof value !== 'string') {
          invalid('A data-bound image source has no fixed lobby resource set.', { path: skin, property: 'source' });
        }
        names.add(value);
      }
    }
    for (const child of node.children) visit(child, skin);
    if (node.inlineSkin) visit(node.inlineSkin, skin);
    if (node.itemRendererSkin) visit(node.itemRendererSkin, skin);
  }
  for (const skin of theme.exmls) visit(skin.root, skin.sourcePath);
  return [...names];
}

function readLobbyResources(read, declaration, resourceNames) {
  if (!Array.isArray(declaration?.resources) || declaration.resources.length > 4096) {
    invalid('Expected a bounded set of source RES entries.');
  }
  const resources = resourceNames.map(name => {
    const matches = declaration.resources.filter(resource => resource?.name === name);
    if (
      matches.length !== 1 ||
      matches[0].type !== 'image' ||
      typeof matches[0].url !== 'string' ||
      !matches[0].url.endsWith('.png')
    ) {
      invalid('Expected one local RES image declaration for each lobby skin PNG.', { name });
    }
    return matches[0];
  });
  // Plan only reachable room assets; keep the original all-game manifest byte-for-byte as an input.
  const { plan } = planMigratedResources(
    JSON.stringify({
      groups: [{ name: 'roomUI', keys: resourceNames.join(',') }],
      resources
    }),
    'resource',
    key => read('client/' + key)
  );
  const files = plan.files.map(file => {
    const sourcePath = 'client/' + file.sourcePath;
    read(sourcePath);
    return { ...file, sourcePath };
  });
  return { ...plan, files };
}

export function selectLobbyInterface(read, readJSON) {
  const manifest = 'resource/default.res.json';
  const theme = readLobbyTheme(read, readJSON('client/resource/default.thm.json'));
  return {
    sources: scenes.map(name => read('client/src/Game/UI/' + name + '.ts').identity),
    manifest,
    resources: readLobbyResources(read, readJSON('client/' + manifest), skinImageNames(theme)),
    theme
  };
}

/** Select a two-scene entry from a repository root; the sibling module cannot escape that owner. */
export function inspectEraserLobby({ read, readJSON, readStage }) {
  const properties = readJSON('client/egretProperties.json');
  checkProperties(properties);
  const stage = readStage(read('client/index.html').bytes.toString('utf8'));
  if (stage.entry !== 'Main') invalid('Expected the original Main bootstrap.');
  read('client/src/Main.ts');

  const socketBuild = readJSON('socket.io/tsconfig.json');
  if (socketBuild?.compilerOptions?.outFile !== 'bin/socket.io/socket.io.js') {
    invalid('The sibling Socket.IO module must declare the admitted browser bundle.');
  }
  if (read(vendorPath).identity.sha256 !== vendorSha256) {
    invalid('The supplied Socket.IO browser bundle differs from the reviewed source.', { path: vendorPath });
  }
  return {
    schemaVersion: 1,
    profile: eraserLobbyProfile,
    engineVersion: properties.egret_version,
    modules: properties.modules.map(item => item.name),
    stage,
    ...selectLobbyInterface(read, readJSON),
    network: { vendorPath, vendorSha256, scenes }
  };
}
