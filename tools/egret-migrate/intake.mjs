// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { logicalPath } from '../lib/file-identity.mjs';

const maxEntries = 100_000;

function portable(value) {
  try {
    return logicalPath(value);
  } catch {
    return undefined;
  }
}

// Index only the source and resource trees. Project code, vendor modules and remote URLs never run.
function indexProject(owner) {
  const files = new Set();
  const stack = [];
  let entries = 0;
  for (const entry of fs.readdirSync(owner, { withFileTypes: true })) {
    if (entry.name === 'src' || entry.name === 'resource') {
      if (!entry.isDirectory())
        throw Object.assign(new TypeError('Expected a regular source or resource directory.'), {
          code: 'MIGRATE_INPUT_FILE',
          details: { path: entry.name }
        });
      stack.push(entry.name);
    } else if (entry.isFile() && portable(entry.name)) files.add(entry.name);
  }
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(path.join(owner, dir), { withFileTypes: true })) {
      if (++entries > maxEntries) {
        throw Object.assign(new RangeError('Project inventory exceeds 100,000 directory entries.'), {
          code: 'MIGRATE_INVENTORY_LIMIT'
        });
      }
      const key = logicalPath(dir + '/' + entry.name);
      if (entry.isDirectory()) stack.push(key);
      else if (entry.isFile()) files.add(key);
      else
        throw Object.assign(new TypeError('Expected a regular file or directory in the inventory.'), {
          code: 'MIGRATE_INPUT_FILE',
          details: { path: key }
        });
    }
  }
  return files;
}

function sourceFromScript(script) {
  if (!portable(script) || !script.startsWith('bin-debug/') || !script.endsWith('.js')) return undefined;
  return 'src/' + script.slice('bin-debug/'.length, -3) + '.ts';
}

function resourceManifest(key, value, files, issues) {
  const missing = new Set();
  const external = new Set();
  const types = new Map();
  const list = Array.isArray(value?.resources) ? value.resources : [];
  if (!Array.isArray(value?.resources) || !Array.isArray(value?.groups)) issues.add('MIGRATE_RES_UNSUPPORTED');
  for (const resource of list) {
    if (typeof resource?.name !== 'string' || typeof resource.type !== 'string' || typeof resource.url !== 'string') {
      issues.add('MIGRATE_RES_UNSUPPORTED');
      continue;
    }
    types.set(resource.type, (types.get(resource.type) ?? 0) + 1);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(resource.url)) external.add(resource.name);
    else if (!portable(resource.url)) issues.add('MIGRATE_RES_UNSUPPORTED');
    else {
      const source = path.posix.join(path.posix.dirname(key), resource.url);
      if (!files.has(source)) missing.add(source);
    }
  }
  if (missing.size) issues.add('MIGRATE_RESOURCE_MISSING');
  if (external.size) issues.add('MIGRATE_EXTERNAL_RESOURCE');
  return {
    path: key,
    entries: list.length,
    groups: Array.isArray(value?.groups) ? value.groups.length : 0,
    types: Object.fromEntries([...types].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    missing: [...missing].sort(),
    external: [...external].sort()
  };
}

function themeManifest(key, value, files, issues) {
  const list = value?.exmls ?? [];
  const skins = value?.skins ?? {};
  if (!Array.isArray(list) || typeof skins !== 'object' || Array.isArray(skins)) {
    issues.add('MIGRATE_EXML_UNSUPPORTED');
    return { path: key, declared: [], missing: [] };
  }
  const declared = new Set();
  for (const name of [...list, ...Object.values(skins).filter(s => typeof s === 'string' && s.endsWith('.exml'))]) {
    if (!portable(name) || !name.endsWith('.exml')) issues.add('MIGRATE_EXML_UNSUPPORTED');
    else declared.add(name);
  }
  const missing = [...declared].filter(name => !files.has(name)).sort();
  if (missing.length) issues.add('MIGRATE_SKIN_MISSING');
  return { path: key, declared: [...declared].sort(), missing };
}

// Only an explicit classic script order and the stock final launch can be replaced mechanically.
export function inspectHtmlBootstrap(html, scripts) {
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const local = [];
  // The generated host owns a canvas. Original page controls and event handlers require explicit host integration.
  const hasPageInteraction =
    /<(?:button|input|textarea|select|a|form|iframe|canvas|video|audio)\b/i.test(html) ||
    /<[A-Za-z][^>]*\s(?:on[A-Za-z]+\s*=|(?:href|src|action)\s*=\s*['"]?\s*javascript\s*:)/i.test(html);
  let review = hasPageInteraction || tags.length !== [...html.matchAll(/<script\b/gi)].length;
  let launched = false;
  for (const [, attrs, body] of tags) {
    const source = /^\s*src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*$/i.exec(attrs);
    if (source) {
      const key = portable(source[1] ?? source[2] ?? source[3]);
      local.push(key ?? null);
      if (!key || body.trim() || launched) review = true;
    } else if (!attrs.trim() && /^\s*egret\.runEgret\(\);?\s*$/.test(body) && !launched) launched = true;
    else if (attrs.trim() || body.trim()) review = true;
  }
  if (local.length) {
    const expected = [
      ...scripts.initial,
      ...scripts.sourceOrder.map(key => key && 'bin-debug/' + key.slice(4, -3) + '.js')
    ];
    if (local.length !== expected.length || local.some((key, index) => key !== expected[index])) review = true;
  }
  return { tags: tags.length, localScriptOrder: local, hasPageInteraction, requiresReview: review };
}

export function inspectClassicInventory(owner, properties, options, readJson, supportedModules, sourceLimit) {
  const files = indexProject(owner);
  const issues = new Set();
  const document = key => {
    if (!files.has(key)) {
      issues.add('MIGRATE_INPUT_FILE');
      return {};
    }
    return readJson(key);
  };
  const manifest = files.has('manifest.json') || !options.sources ? document('manifest.json') : {};
  const initialList = manifest?.initial ?? [];
  const game = manifest?.game ?? [];
  if (!Array.isArray(initialList) || !Array.isArray(game)) issues.add('MIGRATE_SOURCE_ORDER');
  // Preserve order exactly; a null entry is an unsupported path at that original position.
  const initial = Array.isArray(initialList) ? initialList.map(value => portable(value) ?? null) : [];
  const manifestOrder = Array.isArray(game) ? game.map(value => sourceFromScript(value) ?? null) : [];
  const explicit = options.sources !== undefined;
  const sourceOrder =
    explicit && Array.isArray(options.sources)
      ? options.sources.map(key => (portable(key) && key.startsWith('src/') && key.endsWith('.ts') ? key : null))
      : manifestOrder;
  if (
    explicit &&
    (!Array.isArray(options.sources) ||
      (manifestOrder.length &&
        (manifestOrder.length !== sourceOrder.length ||
          manifestOrder.some((key, index) => key !== sourceOrder[index]))))
  )
    issues.add('MIGRATE_SOURCE_ORDER');
  if (sourceOrder.length > sourceLimit) issues.add('MIGRATE_SOURCE_LIMIT');
  if (
    !sourceOrder.length ||
    sourceOrder.some(key => !key || key.endsWith('.d.ts')) ||
    new Set(sourceOrder.map(key => key?.toLowerCase())).size !== sourceOrder.length
  )
    issues.add('MIGRATE_SOURCE_ORDER');
  const missingSources = sourceOrder.filter(key => key && !files.has(key));
  if (missingSources.length) issues.add('MIGRATE_SOURCE_MISSING');
  const modules = Array.isArray(properties.modules) ? properties.modules : [];
  const modulesNeedingAdapters = [];
  const moduleLocations = [];
  const admittedInitial = new Set();
  for (const item of modules) {
    if (!supportedModules.has(item?.name) || (item.path !== undefined && item.path !== '${EGRET_DEFAULT}')) {
      const name = typeof item?.name === 'string' ? item.name : null;
      modulesNeedingAdapters.push(name);
      const key = typeof item?.path === 'string' ? portable(item.path.replace(/^\.\//, '')) : undefined;
      if (key) moduleLocations.push({ name, path: key });
    } else {
      for (const suffix of ['.js', '.min.js', '.web.js', '.web.min.js']) {
        admittedInitial.add('libs/modules/' + item.name + '/' + item.name + suffix);
      }
    }
  }
  if (modulesNeedingAdapters.length || !modules.some(item => item?.name === 'egret'))
    issues.add('MIGRATE_MODULE_UNSUPPORTED');
  const extraInitial = initial.filter(key => !admittedInitial.has(key));
  if (extraInitial.length) issues.add('MIGRATE_BOOTSTRAP_ADAPTER');
  const names = [...files].sort();
  const resources = options.resources ?? 'resource/default.res.json';
  const theme = options.theme ?? 'resource/default.thm.json';
  const resourceKeys = names.filter(key => key.endsWith('.res.json') || key === resources);
  const themeKeys = names.filter(key => key.endsWith('.thm.json') || key === theme);
  if (!resourceKeys.includes(resources) || (modules.some(item => item?.name === 'eui') && !themeKeys.includes(theme))) {
    issues.add('MIGRATE_INPUT_FILE');
  }
  if (resourceKeys.some(key => key !== resources)) issues.add('MIGRATE_MULTIPLE_RES_MANIFESTS');
  if (themeKeys.some(key => key !== theme) || (themeKeys.length && !modules.some(item => item?.name === 'eui'))) {
    issues.add('MIGRATE_THEME_SELECTION');
  }
  if (properties.target?.current !== undefined && properties.target.current !== 'web')
    issues.add('MIGRATE_TARGET_UNSUPPORTED');
  const resourceManifests = resourceKeys.map(key => resourceManifest(key, document(key), files, issues));
  const themes = themeKeys.map(key => themeManifest(key, document(key), files, issues));
  const declared = new Set(sourceOrder);
  const unlistedSources = names.filter(
    key => key.startsWith('src/') && key.endsWith('.ts') && !key.endsWith('.d.ts') && !declared.has(key)
  );
  if (unlistedSources.length) issues.add('MIGRATE_UNLISTED_SOURCE');
  return {
    inventory: {
      modulesNeedingAdapters,
      moduleLocations,
      scripts: {
        initial,
        extraInitial,
        ...(explicit ? { manifestOrder } : {}),
        sourceOrder,
        sourceLimit,
        missingSources,
        unlistedSources,
        declarations: names.filter(key => key.startsWith('src/') && key.endsWith('.d.ts'))
      },
      resourceManifests,
      themes
    },
    issues: [...issues].sort()
  };
}
