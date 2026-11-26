// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintFile, logicalPath } from '../lib/file-identity.mjs';
import { discoverLegacySkins } from './exml.mjs';
import { convertDragonBones } from './dragonbones.mjs';
import { planMigratedResources } from './legacy-assets.mjs';

export const hash = data => createHash('sha256').update(data).digest('hex');
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const profile = 'egret-5.2-classic-web-2d';
const supportedModules = new Set(['egret', 'game', 'res', 'assetsmanager', 'promise', 'eui', 'dragonBones']);
const scaleModes = { showAll: 'contain', noBorder: 'cover', exactFit: 'stretch' };

export function refuse(code, message, details) {
  throw Object.assign(new Error(message), { code, details });
}

export function readProjectFile(owner, key) {
  let identity;
  try {
    identity = fingerprintFile(owner, key);
  } catch (error) {
    refuse('MIGRATE_INPUT_FILE', 'Missing input or invalid project file identity.', {
      path: key,
      reason: error.message
    });
  }
  const bytes = fs.readFileSync(path.join(owner, key));
  if (identity.sha256 !== hash(bytes))
    refuse('MIGRATE_INPUT_CHANGED', 'Project input changed while it was read.', { path: key });
  return { identity, bytes };
}

function readJSON(read, key) {
  const text = read(key)
    .bytes.toString('utf8')
    .replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch {
    refuse('MIGRATE_INPUT_JSON', 'Expected a JSON document.', { path: key });
  }
}

function readStage(html) {
  // Read the bootstrap declaration as data; the old HTML and its scripts never run during inspection.
  const tags = [...html.matchAll(/<div\b[^>]*>/gi)].map(
    ([tag]) =>
      new Map([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, key, , value]) => [key.toLowerCase(), value]))
  );
  const players = tags.filter(tag => tag.get('class')?.split(/\s+/).includes('egret-player'));
  if (players.length !== 1) refuse('MIGRATE_ENTRY', 'Expected one classic egret-player bootstrap.');
  const player = players[0];
  const entry = player.get('data-entry-class');
  const width = Number(player.get('data-content-width'));
  const height = Number(player.get('data-content-height'));
  const scaleMode = player.get('data-scale-mode') ?? 'showAll';
  if (
    !/^[A-Za-z_$][\w$]*$/.test(entry ?? '') ||
    ![width, height].every(size => Number.isInteger(size) && size > 0 && size <= 8192) ||
    !Object.hasOwn(scaleModes, scaleMode)
  )
    refuse('MIGRATE_ENTRY', 'The entry class, fixed stage size or scale mode is outside this profile.');
  return { entry, width, height, fit: scaleModes[scaleMode] };
}

function readSourceOrder(read, configured) {
  const scriptList = configured ?? readJSON(read, 'manifest.json')?.game;
  if (!Array.isArray(scriptList) || scriptList.length === 0 || scriptList.length > 512) {
    refuse('MIGRATE_SOURCE_ORDER', 'A classic manifest or an explicit ordered source list is required.');
  }
  const sources = scriptList.map(script => {
    const prefix = configured ? 'src/' : 'bin-debug/';
    const extension = configured ? '.ts' : '.js';
    if (typeof script !== 'string' || !script.startsWith(prefix) || !script.endsWith(extension)) {
      refuse('MIGRATE_SOURCE_ORDER', 'A script is outside the admitted source order.', { script });
    }
    try {
      logicalPath(script);
    } catch {
      refuse('MIGRATE_SOURCE_ORDER', 'Expected a portable source path.', { script });
    }
    const source = configured ? script : 'src/' + script.slice(prefix.length, -extension.length) + '.ts';
    if (source.endsWith('.d.ts')) refuse('MIGRATE_SOURCE_ORDER', 'Expected executable TypeScript source.', { script });
    return source;
  });
  if (new Set(sources.map(source => source.toLowerCase())).size !== sources.length) {
    refuse('MIGRATE_SOURCE_ORDER', 'Source paths must be unique across platforms.');
  }
  return sources.map(source => read(source).identity);
}

export function inspectLegacyProject(folder, options = {}) {
  const owner = path.resolve(folder);
  const files = new Map();
  const read = key => {
    if (files.has(key)) return files.get(key);
    const result = readProjectFile(owner, key);
    files.set(key, result);
    return result;
  };
  const properties = readJSON(read, 'egretProperties.json');
  // This older Wing project format records one SDK release and no separate compiler version.
  const wing5015 =
    properties?.egret_version === '5.0.15' &&
    properties.engineVersion === undefined &&
    properties.compilerVersion === undefined;
  const classic519 = properties?.engineVersion === '5.1.9' && properties?.compilerVersion === '5.1.9';
  if (
    !wing5015 &&
    !classic519 &&
    (!/^5\.2\.\d+$/.test(properties?.engineVersion ?? '') || !/^5\.2\.\d+$/.test(properties?.compilerVersion ?? ''))
  ) {
    refuse(
      'MIGRATE_VERSION_UNSUPPORTED',
      'Expected matched Egret 5.1.9 declarations, Egret 5.2.x declarations or the 5.0.15 Wing project format.'
    );
  }
  const modules = Array.isArray(properties.modules) ? properties.modules : [];
  const unsupported = modules.filter(
    module =>
      !(supportedModules.has(module?.name) || ((wing5015 || classic519) && module?.name === 'tween')) ||
      (module.path !== undefined &&
        module.path !== '${EGRET_DEFAULT}' &&
        !(wing5015 && module.name === 'promise' && module.path === './promise'))
  );
  if (!modules.some(module => module?.name === 'egret') || unsupported.length) {
    refuse('MIGRATE_MODULE_UNSUPPORTED', 'A module requires an explicit migration rule.', {
      modules: unsupported.map(module => module?.name)
    });
  }
  const stage = readStage(read('index.html').bytes.toString('utf8'));
  const sources = readSourceOrder(read, options.sources);
  const manifest = options.resources ?? 'resource/default.res.json';
  const resourceRoot = path.posix.dirname(manifest);
  const result = planMigratedResources(read(manifest).bytes.toString('utf8'), resourceRoot, read);
  for (const file of result.plan.files) read(file.sourcePath);
  const hasModule = name => modules.some(module => module.name === name);
  const theme = hasModule('eui') ? discoverLegacySkins(read, options.theme ?? 'resource/default.thm.json') : undefined;
  let bones;
  if (hasModule('dragonBones') || options.bones !== undefined) {
    if (!Array.isArray(options.bones) || !options.bones.length || options.bones.length > 128)
      refuse('MIGRATE_BONES_MANIFEST', 'Supply a bounded DragonBones resource-name mapping with --bones.');
    const used = new Set();
    const resourceOf = (name, type) => {
      const resource = result.plan.resources.find(item => item.name === name && item.type === type);
      if (!resource) refuse('MIGRATE_BONES_MANIFEST', 'The mapping must name declared RES resources.', { name, type });
      return result.plan.files[resource.fileIndex].sourcePath;
    };
    bones = options.bones.map(pair => {
      if (
        !pair ||
        Array.isArray(pair) ||
        Object.keys(pair).some(key => !['atlas', 'skeleton', 'texture', 'allowRenamedPage'].includes(key)) ||
        !['atlas', 'skeleton', 'texture'].every(key => typeof pair[key] === 'string') ||
        (pair.allowRenamedPage !== undefined && pair.allowRenamedPage !== true)
      )
        refuse('MIGRATE_BONES_MANIFEST', 'Expected a skeleton, atlas and texture RES name.');
      const skeletonPath = resourceOf(pair.skeleton, 'json');
      const atlasPath = resourceOf(pair.atlas, 'json');
      const texturePath = resourceOf(pair.texture, 'image');
      for (const key of [skeletonPath, atlasPath]) {
        if (used.has(key))
          refuse('MIGRATE_BONES_MANIFEST', 'A converted JSON path may be selected only once.', { key });
        used.add(key);
      }
      const atlas = readJSON(read, atlasPath);
      let expectedPage;
      try {
        expectedPage = logicalPath(path.posix.dirname(atlasPath) + '/' + logicalPath(atlas.imagePath));
      } catch {
        refuse('MIGRATE_BONES_MANIFEST', 'The atlas must declare a local page.', { atlasPath });
      }
      if (expectedPage !== texturePath && !pair.allowRenamedPage)
        refuse(
          'MIGRATE_BONES_MANIFEST',
          'Mapped texture does not match the authored atlas page. A known rename requires allowRenamedPage.',
          { atlasPath, texturePath, expectedPage }
        );
      const descriptor = convertDragonBones(readJSON(read, skeletonPath), atlas);
      const { bytes: png } = read(texturePath);
      if (
        png.length < 24 ||
        png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        png.toString('ascii', 12, 16) !== 'IHDR' ||
        png.readUInt32BE(16) !== descriptor.atlas.width ||
        png.readUInt32BE(20) !== descriptor.atlas.height
      )
        refuse('MIGRATE_BONES_MANIFEST', 'Expected a PNG atlas matching the declared dimensions.', { texturePath });
      return {
        ...pair,
        skeletonPath,
        atlasPath,
        texturePath,
        ...(expectedPage === texturePath ? {} : { originalPage: expectedPage }),
        descriptor
      };
    });
  }
  // Preserve declared project notices byte for byte in the editable output, outside the preview.
  for (const name of fs.readdirSync(owner)) if (/^(?:LICENSE|NOTICE|COPYING)(?:\.(?:md|txt))?$/i.test(name)) read(name);
  const inputs = [...files.values()]
    .map(file => file.identity)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    schemaVersion: 1,
    profile: wing5015 ? 'egret-5.0.15-classic-web-2d' : classic519 ? 'egret-5.1.9-classic-web-2d' : profile,
    engineVersion: wing5015 ? properties.egret_version : properties.engineVersion,
    ...(wing5015 ? {} : { compilerVersion: properties.compilerVersion }),
    modules: modules.map(module => module.name),
    stage,
    sources,
    manifest,
    resources: result.plan,
    ...(result.sheets === undefined ? {} : { sheets: result.sheets }),
    ...(theme === undefined ? {} : { theme }),
    ...(bones === undefined ? {} : { bones }),
    inputs,
    inputSha256: hash(JSON.stringify(inputs))
  };
}
