// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { convertProject } from '../../../tools/egret-migrate/convert.mjs';

const { values } = parseArgs({
  options: Object.fromEntries(
    ['legacy-libs', 'engine', 'esbuild', 'playwright', 'browser', 'out'].map(name => [name, { type: 'string' }])
  )
});
for (const key of ['legacy-libs', 'engine', 'esbuild', 'playwright', 'browser', 'out']) {
  if (!values[key]) throw new Error('Missing --' + key + ' for the inventory comparison.');
}
const fixture = import.meta.dirname;
const template = path.resolve(fixture, '../egret-migrate-eui/project');
const originalLibs = fs.realpathSync(values['legacy-libs']);
const esbuild = (await import(pathToFileURL(fs.realpathSync(values.esbuild)).href)).default;
assert.equal(esbuild.version, '0.27.4');
const { chromium } = await import(pathToFileURL(fs.realpathSync(values.playwright)).href);
const browserPath = fs.realpathSync(values.browser);
const engine = fs.realpathSync(values.engine);
const dir = path.resolve(values.out),
  legacy = path.join(dir, 'legacy'),
  target = path.join(dir, 'target');
const inside = (root, dir) => {
  const relative = path.relative(root, dir);
  return !relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};
if (inside(fixture, dir) || inside(originalLibs, dir))
  throw new Error('Choose a new evidence directory outside the fixture and original SDK.');
const admitted = new Map([
  ['egret/egret.js', '032c11f385165b66b4a4bbcd4e199f0ae07aeeca359c0b5bb344067a4257c690'],
  ['egret/egret.web.js', '2236d4eb9f41db9e735220460b52073655781210b16b10c3f0231a547da0a7eb'],
  ['eui/eui.js', '146f21be584e6fab092d8d1a031b29b4b5d03e4f07ad4e77ba9c2dfd5b9c0686'],
  ['assetsmanager/assetsmanager.js', '2cdeff8fda9589b0e73702cf1cdb3694025b1f67a52f84f50ee04a12dc85aa2a']
]);
const runtimeFiles = new Map();
for (const [name, checksum] of admitted) {
  const bytes = fs.readFileSync(path.join(originalLibs, name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), checksum, 'Unexpected Egret 5.2.7 runtime: ' + name);
  runtimeFiles.set('libs/modules/' + name, bytes);
}
fs.mkdirSync(dir, { recursive: false });
fs.mkdirSync(legacy);
const props = JSON.parse(fs.readFileSync(path.join(template, 'egretProperties.json')));
props.modules = props.modules.filter(m => m.name !== 'dragonBones');
fs.writeFileSync(path.join(legacy, 'egretProperties.json'), JSON.stringify(props));
const manifest = JSON.parse(fs.readFileSync(path.join(template, 'manifest.json')));
manifest.initial = manifest.initial.filter(k => runtimeFiles.has(k));
fs.writeFileSync(path.join(legacy, 'manifest.json'), JSON.stringify(manifest));
for (const [entry, bytes] of runtimeFiles) {
  fs.mkdirSync(path.dirname(path.join(legacy, entry)), { recursive: true });
  fs.writeFileSync(path.join(legacy, entry), bytes);
}
for (const dest of ['src', 'bin-debug', 'resource/skins']) fs.mkdirSync(path.join(legacy, dest), { recursive: true });
const source = fs.readFileSync(path.join(fixture, 'Main.ts'), 'utf8');
fs.writeFileSync(path.join(legacy, 'src/Main.ts'), source);
fs.writeFileSync(
  path.join(legacy, 'bin-debug/Main.js'),
  (
    await esbuild.transform(source, {
      loader: 'ts',
      target: 'es2017',
      tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } }
    })
  ).code
);
let html = fs
  .readFileSync(path.join(template, 'index.html'), 'utf8')
  .split('\n')
  .filter(line => !line.includes('dragonBones'))
  .join('\n');
fs.writeFileSync(
  path.join(legacy, 'index.html'),
  html
    .replace('Lantern Guardian', 'Dynamic stock list')
    .replace('window.Main=Main', 'window.StockBadge=StockBadge;window.StockRow=StockRow;window.Main=Main')
);
const names = ['StockRow', 'StockPanel'];
fs.writeFileSync(
  path.join(legacy, 'resource/default.thm.json'),
  JSON.stringify({ skins: {}, exmls: names.map(n => 'resource/skins/' + n + '.exml'), autoGenerateExmlsList: false })
);
fs.writeFileSync(path.join(legacy, 'resource/default.res.json'), JSON.stringify({ groups: [], resources: [] }));
for (const name of names)
  fs.copyFileSync(path.join(fixture, name + '.exml'), path.join(legacy, 'resource/skins', name + '.exml'));
fs.writeFileSync(
  path.join(legacy, 'NOTICE'),
  'Original Egret Migrate dynamic inventory fixture. Apache-2.0. Official Egret libraries remain under their original license.\n'
);
await convertProject({ source: legacy, out: target, engine, engineVersion: '7.0.2', esbuild });
const mime = {
  '.mjs': 'application/javascript',
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.json': 'application/json',
  '.exml': 'text/xml'
};
const server = createServer((req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    const full = path.resolve(dir, '.' + name);
    if (!full.startsWith(dir + path.sep)) throw Error();
    res.setHeader('content-type', mime[path.extname(full)] ?? 'application/octet-stream');
    res.end(fs.readFileSync(full));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({
  executablePath: browserPath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const report = {
  mode: 'Headless Chromium, SwiftShader WebGL2, automated pointer input',
  engineSha256: createHash('sha256').update(fs.readFileSync(engine)).digest('hex'),
  browser: browser.version(),
  runs: {}
};
try {
  for (const [host, url] of [
    ['legacy', 'legacy/index.html'],
    ['converted', 'target/web/index.html']
  ]) {
    const context = await browser.newContext({ viewport: { width: 480, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const run = (report.runs[host] = { snapshots: [], errors: [], warnings: [] });
    page.on('pageerror', e => {
      run.errors.push(e.message);
      console.log(host, 'PAGE', e.message);
    });
    page.on('console', e => {
      if (e.type() === 'warning' || e.type() === 'error') {
        run.warnings.push(e.text());
        console.log(host, 'CONSOLE', e.text());
      }
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/' + url);
    await page.waitForFunction(() => globalThis.stockProbe?.snapshot().firstLabel === 'Rice', null, { timeout: 10000 });
    const take = async name => {
      await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
      const state = await page.evaluate(() => stockProbe.snapshot());
      run.snapshots.push({ name, ...state });
      await page.screenshot({ path: path.join(dir, host + '-' + name + '.png') });
      console.log(host, name, state);
    };
    await take('open');
    await page.mouse.click(40, 94);
    await take('pick-tea');
    await page.evaluate(() => stockProbe.change());
    await take('change');
    await page.evaluate(() => stockProbe.scroll());
    await take('scroll');
    await page.mouse.click(40, 59);
    await take('pick-rice');
    await page.evaluate(() => stockProbe.reenter());
    await take('reenter');
    await context.close();
  }
  assert.deepEqual(report.runs.legacy.snapshots, report.runs.converted.snapshots);
  assert.deepEqual(
    report.runs.legacy.snapshots.map(p => [p.status, p.selected, p.firstLabel, p.badgeVisible]),
    [
      ['Harbor', null, 'Rice', false],
      ['Harbor', 'Tea', 'Rice', false],
      ['Dock Gate', 'Tea', 'Pear', true],
      ['Dock Gate', 'Tea', 'Pear', true],
      ['Dock Gate', 'Rice', 'Pear', true],
      ['Gate', 'Rice', 'Rice', false]
    ]
  );
  for (const r of Object.values(report.runs)) assert.deepEqual(r.errors, []);
  report.pass = true;
} catch (error) {
  report.error = error.message;
  report.pass = false;
  throw error;
} finally {
  fs.writeFileSync(path.join(dir, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(dir);
  await browser.close();
  await new Promise(ok => server.close(ok));
}
