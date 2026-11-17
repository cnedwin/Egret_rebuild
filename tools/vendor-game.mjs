// SPDX-License-Identifier: Apache-2.0
// Copies the part of a built engine that a game loads into the game's own
// folder, and writes the import map and the Node loader that find it there.
//
//   node tools/vendor-game.mjs <game folder> <entry> [<entry> ...]
//   node tools/vendor-game.mjs ../MyGame @egret/engine @egret/engine/webgl2/world3d @egret/engine/kit
//
// Only the JavaScript files the named entries import, directly or through other
// files, are copied, with each package's licence. A page loads them through
// `vendor/importmap.json` (pasted into its import map, or read by
// `vendor/importmap.js`); rules and tests run them in Node through
// `node --import ./vendor/node-register.mjs`. `vendor/SOURCE.md` records the
// commit and the entries. Run it again to refresh: files no entry needs any
// more are taken away.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PACKAGES = ['contracts', 'runtime', 'engine', 'spine', 'project'];

/** The import target of an `exports` value under the `import` condition. */
function target(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return target(value.import ?? value.default);
  return undefined;
}

/** Every bare specifier a workspace package answers, with the file it gives. */
function workspaceSpecifiers() {
  const map = new Map();
  for (const name of PACKAGES) {
    const dir = path.join(root, 'packages', name);
    const manifest = path.join(dir, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
      const file = target(value);
      if (file)
        map.set(subpath === '.' ? pkg.name : pkg.name + subpath.slice(1), { pack: name, file: path.join(dir, file) });
    }
    for (const [specifier, value] of Object.entries(pkg.imports ?? {})) {
      const file = target(value);
      if (file) map.set(specifier, { pack: name, file: path.join(dir, file), internal: true });
    }
  }
  return map;
}

/** A third-party package as the importing package's own `node_modules` gives it. */
function thirdParty(specifier, fromPack) {
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = parts.slice(specifier.startsWith('@') ? 2 : 1).join('/');
  for (const base of [path.join(root, 'packages', fromPack, 'node_modules'), path.join(root, 'node_modules')]) {
    const dir = path.join(base, name);
    if (!fs.existsSync(path.join(dir, 'package.json'))) continue;
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const key = sub ? './' + sub : '.';
    const file =
      target(
        typeof pkg.exports === 'string' || pkg.exports?.import
          ? key === '.'
            ? pkg.exports
            : undefined
          : pkg.exports?.[key]
      ) ?? (key === '.' ? (pkg.module ?? pkg.main ?? 'index.js') : sub);
    return { name, dir: fs.realpathSync(dir), file: path.join(fs.realpathSync(dir), file), license: pkg.license };
  }
  throw new Error(`cannot find ${specifier} for ${fromPack}`);
}

const IMPORTS =
  /^\s*(?:import|export)\s+(?:[^'";]*?\bfrom\s+)?['"]([^'"\r\n]+)['"]|\bimport\(\s*['"]([^'"\r\n]+)['"]\s*\)/gm;

/**
 * Plans the copy: which files go where, and what the import map says. Exported for tests; `vendorGame` writes it.
 */
export function planVendor(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError('name at least one entry');
  const specifiers = workspaceSpecifiers();
  const files = new Map(); // source path -> path under vendor/
  const map = {}; // specifier -> path under vendor/
  const third = new Map();
  const vendorPathOf = source => {
    for (const name of PACKAGES) {
      const dir = path.join(root, 'packages', name) + path.sep;
      if (source.startsWith(dir)) return path.posix.join(name, path.relative(dir, source).split(path.sep).join('/'));
    }
    for (const [, info] of third) {
      if (source.startsWith(info.dir + path.sep))
        return path.posix.join(info.name.replace('/', '__'), path.relative(info.dir, source).split(path.sep).join('/'));
    }
    throw new Error('outside the workspace: ' + source);
  };
  const visit = (source, pack) => {
    if (files.has(source)) return;
    if (!fs.existsSync(source)) throw new Error(`missing ${path.relative(root, source)}; build the engine first`);
    files.set(source, vendorPathOf(source));
    const text = fs.readFileSync(source, 'utf8');
    for (const [, a, b] of text.matchAll(IMPORTS)) {
      const spec = a ?? b;
      if (spec.startsWith('.')) visit(path.resolve(path.dirname(source), spec), pack);
      else resolve(spec, pack);
    }
  };
  const resolve = (spec, fromPack) => {
    const own = specifiers.get(spec);
    if (own) {
      visit(own.file, own.pack);
      map[spec] = files.get(own.file);
      return;
    }
    const info = thirdParty(spec, fromPack);
    third.set(info.name, info);
    visit(info.file, fromPack);
    map[spec] = files.get(info.file);
  };
  for (const entry of entries) {
    if (!specifiers.has(entry) || specifiers.get(entry).internal) throw new Error(`not a public entry: ${entry}`);
    resolve(entry, specifiers.get(entry).pack);
  }
  return { files, map, third: [...third.values()] };
}

/** Copies the plan into `<game>/vendor` and writes the import map, the Node loader and SOURCE.md. */
export function vendorGame(game, entries) {
  const plan = planVendor(entries);
  const vendor = path.join(path.resolve(game), 'vendor');
  fs.mkdirSync(vendor, { recursive: true });
  const keep = new Set(['importmap.json', 'importmap.js', 'node-register.mjs', 'node-resolve.mjs', 'SOURCE.md']);
  for (const relative of plan.files.values()) keep.add(relative);
  // Copy, without the source-map comment; the code is otherwise unchanged.
  for (const [source, relative] of plan.files) {
    const to = path.join(vendor, ...relative.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, fs.readFileSync(source, 'utf8').replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'));
  }
  // Licences: the engine's and each third-party package's own.
  for (const name of ['LICENSE', 'NOTICE']) {
    if (!fs.existsSync(path.join(root, name))) continue;
    fs.copyFileSync(path.join(root, name), path.join(vendor, name));
    keep.add(name);
  }
  for (const info of plan.third) {
    for (const file of fs.readdirSync(info.dir)) {
      if (!/^(licen[cs]e|notice|copying)/i.test(file)) continue;
      const relative = path.posix.join(info.name.replace('/', '__'), file);
      fs.copyFileSync(path.join(info.dir, file), path.join(vendor, ...relative.split('/')));
      keep.add(relative);
    }
  }
  // Take away what an earlier run copied and no entry needs now; only .js files and licences are touched.
  for (const file of fs.readdirSync(vendor, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const relative = path.relative(vendor, path.join(file.parentPath, file.name)).split(path.sep).join('/');
    if (!keep.has(relative) && /\.(m?js)$/.test(relative)) fs.unlinkSync(path.join(vendor, relative));
  }
  const imports = Object.fromEntries(
    Object.entries(plan.map).map(([spec, relative]) => [spec, './vendor/' + relative])
  );
  fs.writeFileSync(path.join(vendor, 'importmap.json'), JSON.stringify({ imports }, null, 2) + '\n');
  const relativeMap = Object.fromEntries(Object.entries(plan.map).map(([spec, relative]) => [spec, './' + relative]));
  fs.writeFileSync(
    path.join(vendor, 'importmap.js'),
    "// Adds the engine's import map to the page. Load it with a plain <script src> before any module script.\n" +
      `const imports = ${JSON.stringify(relativeMap, null, 2)};\n` +
      'const base = document.currentScript.src;\n' +
      'for (const name of Object.keys(imports)) imports[name] = new URL(imports[name], base).href;\n' +
      "const map = document.createElement('script');\n" +
      "map.type = 'importmap';\n" +
      'map.textContent = JSON.stringify({ imports });\n' +
      'document.currentScript.after(map);\n'
  );
  const resolver =
    "// Lets Node find the engine copy in this folder under the names the page's import map uses,\n" +
    '// so rules and tests run unchanged outside a browser. Registered by node-register.mjs.\n' +
    `export const MAP = ${JSON.stringify(relativeMap, null, 2)};\n` +
    'export function resolve(specifier, context, next) {\n' +
    '  const file = MAP[specifier];\n' +
    '  return file ? { url: new URL(file, import.meta.url).href, shortCircuit: true } : next(specifier, context);\n' +
    '}\n';
  fs.writeFileSync(path.join(vendor, 'node-resolve.mjs'), resolver);
  fs.writeFileSync(
    path.join(vendor, 'node-register.mjs'),
    '// node --import ./vendor/node-register.mjs your-script.mjs\n' +
      "import * as module from 'node:module';\n" +
      "import { resolve } from './node-resolve.mjs';\n" +
      '// registerHooks runs in this thread (Node 22.15 and later); register is the older, separate-thread form.\n' +
      "if (typeof module.registerHooks === 'function') module.registerHooks({ resolve });\n" +
      "else module.register('./node-resolve.mjs', import.meta.url);\n"
  );
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    /* not a checkout */
  }
  fs.writeFileSync(
    path.join(vendor, 'SOURCE.md'),
    '# Vendored engine\n\n' +
      `- Egret Engine community rebuild, commit \`${commit}\`, copied by \`tools/vendor-game.mjs\`.\n` +
      `- Entries: ${entries.map(e => '`' + e + '`').join(', ')}. Only the JavaScript files they import are kept; source maps and declarations are left out.\n` +
      (plan.third.length
        ? `- Third-party packages, copied with their own licences: ${plan.third.map(t => `\`${t.name}\` (${t.license ?? 'see its licence file'})`).join(', ')}.\n`
        : '') +
      '- First-party engine code: Apache-2.0, see `LICENSE` and `NOTICE`.\n' +
      '- In a page: add `vendor/importmap.json` to the import map, or load `vendor/importmap.js` first. In Node: `node --import ./vendor/node-register.mjs`.\n'
  );
  return { files: plan.files.size, map: plan.map, commit };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [game, ...entries] = process.argv.slice(2);
  if (!game || entries.length === 0) {
    console.error('Usage: node tools/vendor-game.mjs <game folder> <entry> [<entry> ...]');
    process.exit(2);
  }
  const result = vendorGame(game, entries);
  console.log(`${result.files} files from ${result.commit} into ${path.join(game, 'vendor')}`);
}
