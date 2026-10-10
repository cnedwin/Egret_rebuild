// Independently authored Egret Rebuild collector support. Apache-2.0.
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function contained(root, candidate) {
  const base = path.resolve(root).toLowerCase();
  const item = path.resolve(candidate).toLowerCase();
  return item === base || item.startsWith(base + path.sep);
}
export async function identity(file, maxBytes = 134217728) {
  const absolute = await realpath(file);
  const info = await stat(absolute);
  if (!info.isFile() || info.size > maxBytes) throw new Error('Identity file budget: ' + absolute);
  const bytes = await readFile(absolute);
  if (bytes.length !== info.size) throw new Error('Identity changed during read: ' + absolute);
  return { path: absolute, bytes: bytes.length, sha256: sha256(bytes) };
}

// This restricted lexical reader admits the installed emitted-module syntax,
// not arbitrary JavaScript. Ambiguous templates/imports fail closed; there is
// no package resolver, bundler, evaluation, install or remote fallback.
function tokens(text) {
  const out = [];
  let index = 0;
  while (index < text.length) {
    const start = index, char = text[index];
    if (/\s/.test(char)) { index++; continue; }
    if (text.startsWith('//', index)) {
      index = text.indexOf('\n', index + 2); if (index < 0) break; continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Unterminated module comment');
      index = end + 2; continue;
    }
    if (char === '"' || char === "'") {
      index++;
      while (index < text.length && text[index] !== char) {
        if (text[index] === '\\') index++;
        index++;
      }
      if (index >= text.length) throw new Error('Unterminated module string');
      index++;
      out.push({ kind: 'string', value: text.slice(start + 1, index - 1), start, end: index });
      continue;
    }
    if (char === '`') {
      index++;
      while (index < text.length && text[index] !== '`') {
        if (text[index] === '\\') index++;
        index++;
      }
      if (index >= text.length) throw new Error('Unterminated module template');
      const body = text.slice(start + 1, index++);
      if (/\bimport\b/.test(body)) throw new Error('Import in template requires a separately reviewed parser');
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      index++;
      while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index++;
      out.push({ kind: 'word', value: text.slice(start, index), start, end: index }); continue;
    }
    index++;
    out.push({ kind: 'punctuation', value: char, start, end: index });
  }
  return out;
}
function imports(text) {
  const lexical = tokens(text), result = [];
  const admit = token => {
    if (!token || token.kind !== 'string' || token.value.length === 0 || /[\\\s?#%:\0]/.test(token.value)) {
      throw new Error('Module import must be a simple literal path');
    }
    result.push(token);
  };
  for (let index = 0; index < lexical.length; index++) {
    const token = lexical[index];
    if (token.kind !== 'word') continue;
    if (token.value === 'import') {
      const next = lexical[index + 1];
      if (next?.value === '.') throw new Error('import.meta is outside this browser module graph');
      if (next?.value === '(') {
        admit(lexical[index + 2]);
        if (lexical[index + 3]?.value !== ')') throw new Error('Dynamic import options/nonliteral argument refused');
      } else if (next?.kind === 'string') admit(next);
      else {
        let cursor = index + 1;
        while (cursor < lexical.length && lexical[cursor].value !== ';' && lexical[cursor].value !== 'from') cursor++;
        if (lexical[cursor]?.value !== 'from') throw new Error('Unresolved static import');
        admit(lexical[cursor + 1]);
      }
    } else if (token.value === 'export' && ['{', '*'].includes(lexical[index + 1]?.value)) {
      let cursor = index + 1;
      while (cursor < lexical.length && lexical[cursor].value !== ';' && lexical[cursor].value !== 'from') cursor++;
      if (lexical[cursor]?.value === 'from') admit(lexical[cursor + 1]);
    }
  }
  return result;
}
function sourceCounterpart(repositoryRoot, file) {
  const relative = path.relative(repositoryRoot, file).replaceAll(path.sep, '/');
  const match = /^packages\/(contracts|runtime|engine)\/dist\/(.+)\.js$/.exec(relative);
  if (!match) return null;
  const [, name, tail] = match;
  const subpath = name === 'engine' && /^(web|rendering)\//.test(tail) ? tail : 'src/' + tail;
  return path.join(repositoryRoot, 'packages', name, subpath + '.ts');
}

export async function sealGraph({ repositoryRoot, entryPaths, aliases, maxModules = 128, maxBytes = 4194304 }) {
  const root = await realpath(repositoryRoot), modules = new Map(), inventory = new Map();
  const aliasPaths = new Map();
  for (const [name, file] of Object.entries(aliases)) aliasPaths.set(name, await realpath(file));
  let totalBytes = 0;
  async function visit(input) {
    const file = await realpath(input);
    if (!contained(root, file) || path.extname(file) !== '.js') throw new Error('Uncontained emitted module: ' + file);
    if (modules.has(file)) return modules.get(file);
    if (modules.size >= maxModules) throw new Error('Module-count budget exceeded');
    const bytes = await readFile(file);
    totalBytes += bytes.length;
    if (bytes.length > maxBytes || totalBytes > maxBytes) throw new Error('Module-byte budget exceeded');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const record = { file, route: '/m/' + String(modules.size).padStart(4, '0') + '.js', bytes, edges: [] };
    modules.set(file, record);
    inventory.set(file, { path: file, bytes: bytes.length, sha256: sha256(bytes), role: 'original-emitted-module' });
    const counterpart = sourceCounterpart(root, file);
    if (counterpart !== null) {
      const source = await identity(counterpart, maxBytes);
      if (!contained(root, source.path)) throw new Error('Uncontained source counterpart');
      inventory.set(source.path, { ...source, role: 'first-party-source-counterpart', emittedPath: file });
    } else if (!contained(await realpath(path.dirname(aliasPaths.get('robust-predicates'))), file)) {
      throw new Error('Module has no first-party source or admitted foundational package identity');
    }
    for (const specifier of imports(text)) {
      let target;
      if (specifier.value.startsWith('./') || specifier.value.startsWith('../')) {
        target = path.resolve(path.dirname(file), specifier.value);
      } else if (aliasPaths.has(specifier.value)) target = aliasPaths.get(specifier.value);
      else throw new Error('Unselected bare import: ' + specifier.value);
      const dependency = await visit(target);
      record.edges.push({ ...specifier, file: dependency.file, route: dependency.route });
    }
    let rewritten = text;
    for (const edge of [...record.edges].sort((a, b) => b.start - a.start)) {
      rewritten = rewritten.slice(0, edge.start) + JSON.stringify(edge.route) + rewritten.slice(edge.end);
    }
    record.servedBytes = Buffer.from(rewritten, 'utf8');
    record.servedSHA256 = sha256(record.servedBytes);
    return record;
  }
  const entries = {};
  // Each seed completes before another can visit an unreserved shared module.
  for (const [name, files] of Object.entries(entryPaths)) {
    entries[name] = [];
    for (const file of files) entries[name].push(await visit(file));
  }
  const closures = {};
  for (const [name, records] of Object.entries(entries)) {
    const found = new Set();
    const traverse = record => {
      if (found.has(record.file)) return;
      found.add(record.file);
      for (const edge of record.edges) traverse(modules.get(edge.file));
    };
    records.forEach(traverse);
    closures[name] = [...found].sort();
    if (name === 'canvas' && closures[name].some(file => /[\\/]rendering[\\/]|[\\/]webgpu[^\\/]*\.js$|[\\/]b1\.js$|[\\/]WebGPUHost\.js$|[\\/]robust-predicates[\\/]/i.test(file))) {
      throw new Error('Canvas/root closure crosses the GPU boundary');
    }
  }
  const routes = new Map();
  for (const record of modules.values()) routes.set(record.route, {
    bytes: record.servedBytes, contentType: 'text/javascript; charset=utf-8', originalPath: record.file,
    originalSHA256: sha256(record.bytes), servedSHA256: record.servedSHA256,
  });
  const routeFor = file => modules.get(path.resolve(file))?.route ?? [...modules.values()].find(row => row.file.toLowerCase() === path.resolve(file).toLowerCase())?.route;
  return { routes, inventory: [...inventory.values()], closures, routeFor, totalBytes,
    modules: [...modules.values()].map(row => ({ path: row.file, route: row.route, originalBytes: row.bytes.length,
      originalSHA256: sha256(row.bytes), servedBytes: row.servedBytes.length, servedSHA256: row.servedSHA256,
      edges: row.edges.map(edge => ({ specifier: edge.value, target: edge.file, route: edge.route })) })) };
}
