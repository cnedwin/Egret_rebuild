// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/api-reference.mjs [--check]
// Writes knowledge-base/{en,Cns}/docs/api-reference.md: for each entry of @egret/engine, every name it exports, what
// kind of thing it is and the first sentence written above it in the sources. It reads the built declarations, so
// build first. With --check nothing is written and the exit is 1 when a document is not what would be written.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const API_REFERENCE_DOCUMENTS = Object.freeze({ en: 'knowledge-base/en/docs/api-reference.md', zh: 'knowledge-base/Cns/docs/api-reference.md' });
const PACKAGES = { '@egret/engine': 'packages/engine', '@egret/runtime': 'packages/runtime', '@egret/contracts': 'packages/contracts' };
const texts = new Map();
const read = file => { if (!texts.has(file)) texts.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined); return texts.get(file); };

/** The declaration file a module specifier names, from the file that names it. */
function resolve(from, specifier) {
  if (specifier.startsWith('.')) return path.resolve(path.dirname(from), specifier.replace(/\.js$/, '.d.ts'));
  if (specifier.startsWith('#')) {
    // A private name of the engine package, as its package.json maps it.
    const mapped = manifest('packages/engine').imports?.[specifier], types = typeof mapped === 'string' ? mapped.replace(/\.js$/, '.d.ts') : mapped?.types;
    return types === undefined ? undefined : path.join(root, 'packages/engine', types);
  }
  // A package by its name, or an entry of it as its package.json gives it.
  for (const [name, directory] of Object.entries(PACKAGES)) {
    if (specifier !== name && !specifier.startsWith(name + '/')) continue;
    const entry = manifest(directory).exports?.['.' + specifier.slice(name.length)];
    return entry?.types === undefined ? undefined : path.join(root, directory, entry.types);
  }
  return undefined;
}
const manifests = new Map();
function manifest(directory) {
  if (!manifests.has(directory)) manifests.set(directory, JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8')));
  return manifests.get(directory);
}
/** The first sentence of the comment that ends just before `at`, on one line. */
function sentence(text, at) {
  const before = text.slice(0, at), match = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/.exec(before);
  if (match === null) return '';
  const body = match[1].split('\n').map(line => line.replace(/^\s*\*? ?/, '')).join(' ').replace(/\s+/g, ' ').trim();
  if (body.startsWith('@')) return '';
  // A sentence ends at a full stop or a colon that a space or the end follows, outside a span of code.
  let code = false;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '`') code = !code;
    else if (!code && body[i] === '.' && (i + 1 === body.length || body[i + 1] === ' ')) return body.slice(0, i + 1);
  }
  return body;
}
/** What a name exported by a declaration file is: its kind and its sentence; undefined when the file does not hold it. */
function find(file, name, seen = new Set()) {
  const key = file + '#' + name;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const text = read(file);
  if (text === undefined) return undefined;
  const escaped = name.replace(/\$/g, '\\$');
  const declared = new RegExp('^export (?:declare )?(?:abstract )?(class|function|interface|type|const|enum|let|var) ' + escaped + '\\b', 'm').exec(text);
  if (declared !== null) return { kind: declared[1] === 'let' || declared[1] === 'var' ? 'const' : declared[1], says: sentence(text, declared.index) };
  for (const match of text.matchAll(/^export (type )?\{([^}]*)\}(?: from ['"]([^'"]+)['"])?;/gm)) {
    for (const part of match[2].split(',')) {
      const words = part.trim().replace(/^type /, '').split(/\s+as\s+/), inner = words[0], outer = words[1] ?? words[0];
      if (outer !== name || inner === '') continue;
      if (match[3] === undefined) {
        // A name declared in this file without `export`, and exported in a list.
        const local = new RegExp('^(?:declare )?(?:abstract )?(class|function|interface|type|const|enum) ' + inner.replace(/\$/g, '\\$') + '\\b', 'm').exec(text);
        if (local !== null) return { kind: local[1], says: sentence(text, local.index) };
        // Or a name this file imports and exports again.
        for (const imported of text.matchAll(/^import (?:type )?\{([^}]*)\} from ['"]([^'"]+)['"];/gm)) {
          for (const piece of imported[1].split(',')) {
            const pair = piece.trim().replace(/^type /, '').split(/\s+as\s+/);
            if ((pair[1] ?? pair[0]) !== inner) continue;
            const target = resolve(file, imported[2]), found = target === undefined ? undefined : find(target, pair[0], seen);
            if (found !== undefined) return found;
          }
        }
        continue;
      }
      const target = resolve(file, match[3]);
      const found = target === undefined ? undefined : find(target, inner, seen);
      if (found !== undefined) return found;
    }
  }
  for (const match of text.matchAll(/^export \* from ['"]([^'"]+)['"];/gm)) {
    const target = resolve(file, match[1]), found = target === undefined ? undefined : find(target, name, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}
/** The names a declaration file exports, in the order it gives them. */
function names(file, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const text = read(file), out = [];
  if (text === undefined) return out;
  for (const match of text.matchAll(/^export (?:(?:declare )?(?:abstract )?(?:class|function|interface|type|const|enum|let|var) ([A-Za-z_$][\w$]*)|(?:type )?\{([^}]*)\}(?: from ['"][^'"]+['"])?;|\* from ['"]([^'"]+)['"];)/gm)) {
    if (match[1] !== undefined) out.push(match[1]);
    else if (match[2] !== undefined) for (const part of match[2].split(',')) { const words = part.trim().replace(/^type /, '').split(/\s+as\s+/), outer = words[1] ?? words[0]; if (outer) out.push(outer); }
    else { const target = resolve(file, match[3]); if (target !== undefined) out.push(...names(target, seen)); }
  }
  return [...new Set(out)];
}

/**
 * A name that the files do not lead to, because a private name of the package is typed by another file than it is
 * loaded from: the one declaration of that name among the engine's declarations, if there is exactly one.
 */
let declared;
function only(name) {
  if (declared === undefined) {
    declared = new Map();
    const walk = directory => { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, item.name); if (item.isDirectory()) walk(file); else if (item.name.endsWith('.d.ts')) for (const match of read(file).matchAll(/^export (?:declare )?(?:abstract )?(class|function|interface|type|const|enum) ([A-Za-z_$][\w$]*)/gm)) { const list = declared.get(match[2]) ?? []; list.push({ kind: match[1], says: sentence(read(file), match.index) }); declared.set(match[2], list); } } };
    walk(path.join(root, 'packages/engine/dist'));
  }
  const list = declared.get(name);
  return list !== undefined && list.length === 1 ? list[0] : undefined;
}
/** Every entry of @egret/engine with what it exports: `{ entry, names: [{ name, kind, says }] }`, in package.json's order. */
export function collectApi() {
  return Object.entries(manifest('packages/engine').exports).map(([key, value]) => {
    const file = path.join(root, 'packages/engine', value.types);
    if (read(file) === undefined) throw new Error('Not built: ' + value.types + '. Run node tools/build.mjs first.');
    const list = names(file).map(name => ({ name, ...(find(file, name) ?? only(name) ?? { kind: 'unknown', says: '' }) }));
    list.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.name < b.name ? -1 : 1));
    return { entry: '@egret/engine' + key.slice(1), names: list };
  });
}
const KINDS = { en: { class: 'class', function: 'function', interface: 'interface', type: 'type', const: 'value', enum: 'enum', unknown: '' }, zh: { class: '类', function: '函数', interface: '接口', type: '类型', const: '值', enum: '枚举', unknown: '' } };
const cell = text => text.replace(/\|/g, '\\|');
export function renderApi(api, language) {
  const zh = language === 'zh', total = api.reduce((sum, entry) => sum + entry.names.length, 0), silent = api.reduce((sum, entry) => sum + entry.names.filter(row => row.says === '').length, 0), lines = [];
  lines.push(zh ? '# API 参考' : '# API reference', '');
  lines.push(zh ? '[English](../../en/docs/api-reference.md) | 简体中文' : 'English | [简体中文](../../Cns/docs/api-reference.md)', '');
  lines.push(zh
    ? '本页列出 `@egret/engine` 每个入口导出的全部名字：它是什么，以及源码中写在它上方的第一句说明。说明取自源码注释，所以是英文。本页由 `node tools/api-reference.mjs` 根据构建出的类型声明生成，`tests/api-reference.test.mjs` 在它与声明不一致时失败；不要手工修改。共 ' + api.length + ' 个入口、' + total + ' 个导出，其中 ' + silent + ' 个在源码中还没有说明。'
    : 'This page lists every name that each entry of `@egret/engine` exports: what kind of thing it is, and the first sentence written above it in the sources. It is written by `node tools/api-reference.mjs` from the built declarations, and `tests/api-reference.test.mjs` fails when it is not what they give; do not edit it by hand. ' + api.length + ' entries, ' + total + ' exports; ' + silent + ' of them have no sentence in the sources yet.', '');
  lines.push(zh ? '该从哪个入口导入，见[该引哪个入口](entry-points.md)。' : 'For which entry to import from, see [What to import](entry-points.md).', '');
  for (const entry of api) {
    lines.push('## `' + entry.entry + '`', '', zh ? '| 名字 | 种类 | 说明 |' : '| Name | Kind | What the sources say |', '| --- | --- | --- |');
    for (const row of entry.names) lines.push('| `' + row.name + '` | ' + KINDS[language][row.kind] + ' | ' + cell(row.says) + ' |');
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const api = collectApi(), check = process.argv.includes('--check');
  let stale = 0;
  for (const language of ['en', 'zh']) {
    const file = path.join(root, API_REFERENCE_DOCUMENTS[language]), text = renderApi(api, language);
    if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('Out of date: ' + API_REFERENCE_DOCUMENTS[language] + '. Run node tools/api-reference.mjs.'); stale++; } }
    else fs.writeFileSync(file, text);
  }
  const all = api.flatMap(entry => entry.names), unknown = all.filter(row => row.kind === 'unknown'), silent = all.filter(row => row.says === '');
  console.log(api.length + ' entries; ' + all.length + ' exports; ' + unknown.length + ' not found' + (unknown.length ? ': ' + unknown.map(row => row.name).join(', ') : '') + '; ' + silent.length + ' without a sentence' + (check ? stale ? '; documents OUT OF DATE' : '; documents current' : '; documents written'));
  process.exitCode = stale ? 1 : 0;
}
