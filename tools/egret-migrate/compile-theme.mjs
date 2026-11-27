// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logicalPath, samePhysicalPath } from '../lib/file-identity.mjs';
import { hash, json, readProjectFile, refuse } from './inspect.mjs';

const digestPattern = /^[0-9a-f]{64}$/;
const namePart = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const virtualOrigin = 'http://127.0.0.1:18079';
const bodyTypes = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.exml': 'text/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css'
};
function fail(message, detail) {
  refuse('MIGRATE_THEME_COMPILER', message, detail);
}
function sourceText(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function qualified(name) {
  return typeof name === 'string' && name.split('.').every(key => namePart.test(key) && !forbidden.has(key));
}
function belongs(root, file) {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

// Run this function inside the supplied legacy SDK's own page so project-defined EUI types
// and their original reflection metadata take part in compilation.
function compileBatch(entries) {
  const { eui, egret } = globalThis;
  return entries.map(({ file, text }) => {
    try {
      const xml = egret.XML.parse(text);
      const className = xml.attributes.class;
      if (
        typeof className !== 'string' ||
        !className
          .split('.')
          .every(key => /^[A-Za-z_$][\w$]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key))
      )
        throw new Error('Expected a named skin.');
      delete xml.attributes.class;
      const gjs = new eui.sys.EXMLParser().parseClass(xml, className).toCode();
      const names = className.split('.'),
        leaf = names.pop();
      let space = globalThis;
      for (const key of names) {
        if (!Object.hasOwn(space, key)) space[key] = Object.create(null);
        space = space[key];
      }
      // Later skins may depend on classes emitted earlier in the same theme.
      const prior = Object.getOwnPropertyDescriptor(space, leaf);
      if (
        prior &&
        (typeof prior.value !== 'function' ||
          !(prior.value.prototype instanceof eui.Skin) ||
          prior.value.prototype.__class__ !== className ||
          !prior.writable)
      )
        throw new Error('The skin name conflicts with a bootstrap definition.');
      const type = (0, eval)(gjs);
      egret.registerClass(type, className);
      space[leaf] = type;
      if (prior) {
        // The original SDK may cache a constructor during startup. Later skins
        // must reflect the class compiled in this session.
        egret.cleanCache?.();
        if (egret.getDefinitionByName(className) !== type)
          throw new Error('The old SDK retained a different skin constructor.');
      }
      return { path: file, className, gjs };
    } catch (error) {
      return { path: file, error: String(error?.message ?? error) };
    }
  });
}

export async function compileTheme(options) {
  const source = fs.realpathSync(path.resolve(options.source));
  const classic = fs.realpathSync(path.resolve(options.classic));
  const out = path.resolve(options.out);
  const parent = fs.realpathSync(path.dirname(out));
  if (
    !samePhysicalPath(parent, path.dirname(out)) ||
    belongs(source, out) ||
    belongs(classic, out) ||
    fs.existsSync(out)
  )
    fail('Select a new output directory outside the inputs.');
  const themeKey = logicalPath(options.theme),
    entry = logicalPath(options.entry ?? 'index.html');
  if (!themeKey.endsWith('.json') || !entry.endsWith('.html') || (options.ready && !qualified(options.ready)))
    fail('Expected a theme JSON, an HTML entry and an optional qualified readiness property.');
  const namespaces = options.namespaces ? options.namespaces.split(',') : [];
  if (
    namespaces.length > 64 ||
    namespaces.some(key => !qualified(key) || key.includes('.')) ||
    new Set(namespaces).size !== namespaces.length
  )
    fail('Expected distinct project namespace identifiers.');
  const read = (root, key) => readProjectFile(root, key, 16 << 20);
  const receiptFile = read(classic, 'classic-build.json');
  const receipt = JSON.parse(sourceText(receiptFile.bytes));
  const readOriginal = key => read(source, key);
  const pageInputs = new Map();
  const manifest = JSON.parse(sourceText(readOriginal('manifest.json').bytes));
  const version = JSON.parse(sourceText(readOriginal('egretProperties.json').bytes));
  if (
    receipt.schemaVersion !== 1 ||
    !/^5\.3\.\d+$/.test(receipt.engineVersion) ||
    receipt.engineVersion !== version.engineVersion ||
    receipt.target !== 'config' ||
    !Array.isArray(manifest.game) ||
    !Array.isArray(receipt.artifacts) ||
    !receipt.artifacts.length ||
    receipt.artifacts.length !== manifest.game.length
  )
    fail('Supply the matching compile-classic output built with --target config.');
  const artifacts = new Map();
  const known = new Map(receipt.originals.map(record => [record.path, record.sha256]));
  let inputBytes = 0;
  function trusted(root, file, digest) {
    const record = read(root, file);
    if (!digestPattern.test(digest ?? '') || record.identity.sha256 !== digest)
      fail('Compiler inputs changed. Rebuild the classic scripts.', { file });
    return record.bytes;
  }
  trusted(source, 'manifest.json', known.get('manifest.json'));
  for (const [index, record] of receipt.artifacts.entries()) {
    const key = logicalPath(manifest.game[index]);
    if (
      !key.startsWith('bin-debug/') ||
      !key.endsWith('.js') ||
      record.source !== 'src/' + key.slice(10, -3) + '.ts' ||
      artifacts.has(key)
    )
      fail('Classic output differs from the original manifest order.');
    trusted(source, record.source, record.sourceSha256);
    const bytes = trusted(classic, logicalPath(record.file), record.sha256);
    inputBytes += bytes.length;
    if (inputBytes > 128 << 20) fail('Classic scripts exceed 128 MiB.');
    artifacts.set(key, { bytes, source: record.source, sha256: record.sourceSha256 });
  }
  for (const dependency of receipt.dependencies)
    if (dependency.sha256) trusted(source, logicalPath(dependency.path), dependency.sha256);
  const themeFile = readOriginal(themeKey);
  const theme = JSON.parse(sourceText(themeFile.bytes));
  if (!Array.isArray(theme.exmls) || !theme.skins || typeof theme.skins !== 'object' || Array.isArray(theme.skins))
    fail('Expected editable EXML paths and a control-to-skin map.');
  const paths = [
    ...new Set([
      ...theme.exmls,
      ...Object.values(theme.skins).filter(key => typeof key === 'string' && key.endsWith('.exml'))
    ])
  ];
  if (!paths.length || paths.length > 4096) fail('Expected 1 to 4096 unique skin paths.');
  const inputs = [],
    gaps = [],
    digests = new Map();
  for (const candidate of paths) {
    const file = logicalPath(candidate);
    if (!file.endsWith('.exml')) fail('Expected an EXML source path.', { file });
    if (!fs.existsSync(path.join(source, file))) {
      gaps.push({ path: file, reason: 'missing-source' });
      continue;
    }
    const record = readOriginal(file);
    inputBytes += record.bytes.length;
    if (inputBytes > 256 << 20) fail('Theme and script inputs exceed 256 MiB.');
    inputs.push({ file, text: sourceText(record.bytes) });
    digests.set(file, record.identity.sha256);
  }
  const { chromium } = await import(pathToFileURL(path.resolve(options.playwright)).href);
  const browser = await chromium.launch({
    headless: true,
    ...(options.executable ? { executablePath: options.executable } : {})
  });
  const exmls = [],
    names = new Set();
  let changedInput;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const req = route.request(),
        url = new URL(req.url());
      if (req.method() !== 'GET' || url.origin !== virtualOrigin) return route.abort();
      let body, file;
      try {
        file = logicalPath(decodeURIComponent(url.pathname.slice(1)) || entry);
        const compiled = artifacts.get(file);
        if (compiled) {
          pageInputs.set(compiled.source, compiled.sha256);
          body = compiled.bytes;
        } else {
          const observed = readOriginal(file);
          const expected = known.get(file) ?? pageInputs.get(file);
          if (expected && observed.identity.sha256 !== expected) {
            changedInput = file;
            throw new Error('Input changed');
          }
          pageInputs.set(file, observed.identity.sha256);
          body = observed.bytes;
        }
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
      await route.fulfill({
        status: 200,
        body,
        contentType: bodyTypes[path.extname(file)] ?? 'application/octet-stream'
      });
    });
    const page = await context.newPage();
    await page.goto(virtualOrigin + '/' + entry, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      parts => {
        if (!globalThis.egret?.XML || !globalThis.eui?.sys?.EXMLParser) return false;
        let object = globalThis;
        for (const key of parts) object = object?.[key];
        return !!object;
      },
      options.ready ? options.ready.split('.') : [],
      { timeout: 90000 }
    );
    for (let at = 0; at < inputs.length; at += 32) {
      const result = await page.evaluate(compileBatch, inputs.slice(at, at + 32));
      for (const row of result) {
        if (row.error) {
          gaps.push({ path: row.path, reason: 'original-compiler-diagnostic', message: row.error });
          continue;
        }
        if (!qualified(row.className) || names.has(row.className))
          fail('Ambiguous compiled skin identity.', { file: row.path });
        names.add(row.className);
        exmls.push({ ...row, sourceSha256: digests.get(row.path) });
      }
    }
  } finally {
    await browser.close();
  }
  if (changedInput) fail('A bootstrap input changed during theme compilation.', { file: changedInput });
  if (!exmls.length) fail('The original compiler produced no factories.', { gaps });
  const provider = json({ exmls });
  const profile = {
    schemaVersion: 1,
    format: 'gjs',
    origin: 'project-regenerated',
    global: 'EgretMigratedTheme',
    provider: 'published.thm.json',
    sha256: hash(Buffer.from(provider)),
    namespaces,
    themeSha256: themeFile.identity.sha256,
    unavailableSources: gaps.filter(row => row.reason === 'missing-source').map(row => row.path),
    unresolvedSources: gaps
      .filter(row => row.reason === 'original-compiler-diagnostic')
      .map(row => ({ path: row.path, sha256: digests.get(row.path) }))
  };
  const report = {
    schemaVersion: 1,
    status: gaps.length ? 'partial' : 'passed',
    engineVersion: version.engineVersion,
    theme: themeKey,
    themeSha256: themeFile.identity.sha256,
    classicReceiptSha256: receiptFile.identity.sha256,
    declared: paths.length,
    compiled: exmls.length,
    bootstrapInputs: [...pageInputs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, sha256]) => ({ path, sha256 })),
    gaps
  };
  const temp = fs.mkdtempSync(path.join(parent, '.egret-theme-'));
  try {
    fs.writeFileSync(path.join(temp, 'published.thm.json'), provider);
    profile.buildReportSha256 = hash(Buffer.from(json(report)));
    fs.writeFileSync(path.join(temp, 'profile.json'), json(profile));
    fs.writeFileSync(path.join(temp, 'theme-build.json'), json(report));
    fs.renameSync(temp, out);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return report;
}
