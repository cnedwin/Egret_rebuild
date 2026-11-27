// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { compileClassic } from '../tools/egret-migrate/compile-classic.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-classic-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'original');
  const put = (file, text) => {
    const target = path.join(source, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof text === 'string' ? text : JSON.stringify(text));
  };
  put('egretProperties.json', { engineVersion: '5.3.10', compilerVersion: '5.3.10' });
  put('manifest.json', { initial: ['libs/framework.js'], game: ['bin-debug/Item.js', 'bin-debug/Shelf.js'] });
  put('tsconfig.json', { compilerOptions: { target: 'es5', types: [], lib: ['es5'] }, include: ['src', 'libs'] });
  put('src/Item.ts', 'interface Stock { price: number }\nclass Item implements Stock { price = 7 }\n');
  put('src/Shelf.ts', 'class Shelf extends Item {}\nvar first = new Shelf().price;\n');
  put('src/Offstage.ts', 'class Offstage {}\n');
  put(
    'assets/Shelf.exml',
    '<e:Skin class="ShelfSkin" xmlns:e="http://ns.egret.com/eui"><e:Label text="货架"/></e:Skin>'
  );
  put('theme.json', { skins: { Shelf: 'ShelfSkin' }, exmls: ['assets/Shelf.exml', 'assets/Missing.exml'] });
  const compiler = process.env.EGRET_LEGACY_TYPESCRIPT_PLUS;
  return {
    source,
    put,
    build: (name, options = {}) => {
      const out = path.join(root, name);
      const summary = compileClassic({ source, compiler, out, theme: 'theme.json', ...options });
      return { out, summary, report: JSON.parse(fs.readFileSync(path.join(out, 'classic-build.json'))) };
    }
  };
}

test('reject duplicate source identities and a destination inside the original before loading a compiler', t => {
  const f = fixture(t);
  assert.throws(() => f.build('original/nested'), { code: 'MIGRATE_OUTPUT' });
  f.put('manifest.json', { initial: [], game: ['bin-debug/Item.js', 'bin-debug/item.js'] });
  assert.throws(() => f.build('duplicates'), { code: 'MIGRATE_SOURCE_ORDER' });
});

test('legacy compiler preserves classic boundaries, reflection, deferred order and reviewed diagnostics', {
  skip:
    !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS &&
    'Set EGRET_LEGACY_TYPESCRIPT_PLUS to an external trusted Egret compiler'
}, t => {
  const f = fixture(t);
  const groups = [{ name: 'market', from: 'src/Shelf.ts' }];
  const before = fs.readFileSync(path.join(f.source, 'src/Shelf.ts'));
  const { out, report } = f.build('compiled', { groups });
  assert.deepEqual(fs.readFileSync(path.join(f.source, 'src/Shelf.ts')), before);
  assert.deepEqual(report.unlistedConfigScripts, ['src/Offstage.ts']);
  assert.equal(report.dependencies[0].action, 'missing-original-adapter');
  assert.deepEqual(
    report.artifacts.map(a => a.source),
    ['src/Item.ts', 'src/Shelf.ts']
  );
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(report.staticSkins, { accepted: 1, review: 1, unresolvedMappings: 0, details: 'static-skins.json' });
  const theme = JSON.parse(fs.readFileSync(path.join(out, 'static-skins.json')));
  assert.equal(theme.exmls[0].className, 'ShelfSkin');
  assert.equal(theme.exmls[0].root.children[0].properties.text, '货架');
  const { v8Scripts } = JSON.parse(fs.readFileSync(path.join(out, 'v8-scripts.json')));
  assert.deepEqual(v8Scripts, { startup: ['classic/0000.js'], groups: { market: ['classic/0001.js'] } });
  // Only this test's independently authored sample is evaluated.
  const context = vm.createContext({});
  for (const filename of [...v8Scripts.startup, ...v8Scripts.groups.market]) {
    new vm.Script(fs.readFileSync(path.join(out, filename), 'utf8')).runInContext(context);
  }
  assert.equal(context.first, 7);
  assert.equal(context.Shelf.prototype.__class__, 'Shelf');
  assert.ok(context.Item.prototype.__types__.includes('Stock'));
  const repeated = f.build('repeat', { groups, baseline: report, compilerSha256: report.compiler.sha256 });
  assert.deepEqual(repeated.report.artifacts, report.artifacts);
  assert.equal(repeated.report.diagnosticStatus, 'matched');
  assert.throws(() => f.build('bad-hash', { compilerSha256: '1'.repeat(64) }), { code: 'MIGRATE_COMPILER' });
  assert.throws(() => f.build('bad-order', { groups: [...groups, ...groups] }), { code: 'MIGRATE_SCRIPT_GROUPS' });
  f.put(
    'src/Shelf.ts',
    before.toString() + 'var wrong: number = "text";\nthrow Error("must never run while building");'
  );
  assert.throws(() => f.build('changed', { baseline: report }), { code: 'MIGRATE_DIAGNOSTIC_BASELINE' });
  const changed = f.build('needs-review');
  assert.ok(changed.report.diagnostics.some(d => d.file === 'src/Shelf.ts' && d.code === 2322));
  assert.equal(f.build('reviewed', { baseline: changed.report }).report.diagnosticStatus, 'matched');
  f.put('src/Shelf.ts', 'export class Shelf {}');
  assert.throws(() => f.build('module'), { code: 'MIGRATE_COMPILER_CONFIG' });
});

test('lists runtime and type-only SDK declarations separately without exporting business namespaces', {
  skip: !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS && 'Supply a trusted original TypeScript-Plus compiler'
}, t => {
  const f = fixture(t);
  f.put(
    'libs/modules/example/example.d.ts',
    [
      'declare namespace egret {',
      ' class Clip { static readonly limit:number; draw():void; private hidden:number; }',
      ' interface RenderOptions { visible:boolean; }',
      ' let Loader:{new():Loader; readonly mode:string;};',
      ' interface Loader { open(url:string):void; }',
      ' const OrientationMode: { AUTO:string; };',
      ' let ExternalInterface: { call(name:string):void; };',
      ' namespace sys { function flush():void; }',
      ' /** @internal */ function inspectOnly():void;',
      '}',
      'declare namespace eui.sys { const enum StateKey { Current } }',
      'declare namespace egret { const enum Priority { Normal } }',
      'declare module "egret" { export const importedOnly:number; }',
      'declare namespace StudioGame {class InternalQuest {}}'
    ].join('\n')
  );
  const { out, report } = f.build('sdk-surface');
  const schema = JSON.parse(fs.readFileSync(path.join(out, report.sdkDeclarations.details), 'utf8'));
  const find = (name, placement) => schema.entries.find(x => x.name === name && x.placement === placement);
  assert.equal(find('egret.OrientationMode.AUTO', 'static').kind, 'property');
  assert.equal(find('egret.ExternalInterface.call', 'static').kind, 'method');
  assert.equal(find('egret.Clip', 'namespace').kind, 'class');
  assert.equal(find('egret.Clip.draw', 'instance').kind, 'method');
  assert.equal(find('egret.Clip.limit', 'static').visibility, 'public');
  assert.equal(find('egret.Clip.hidden', 'instance').visibility, 'private');
  assert.equal(find('egret.sys.flush', 'namespace').visibility, 'internal');
  assert.equal(find('egret.inspectOnly', 'namespace').visibility, 'internal');
  assert.equal(find('egret.RenderOptions', 'type').kind, 'interface');
  assert.equal(find('egret.RenderOptions.visible', 'instance'), undefined);
  assert.equal(find('egret.Loader.open', 'instance').kind, 'method');
  assert.equal(find('egret.Loader.mode', 'static').kind, 'property');
  assert.equal(find('eui.sys.StateKey.Current', 'type').visibility, 'internal');
  assert.equal(find('egret.Priority', 'type').kind, 'const-enum');
  assert.equal(find('egret.Priority.Normal', 'type').visibility, 'public');
  assert.equal(
    schema.entries.some(x => x.name.startsWith('StudioGame')),
    false
  );
  assert.equal(
    schema.entries.some(x => x.name === 'egret.importedOnly'),
    false
  );
});

test('ES2015 emission allows a legacy subclass to construct a native class adapter', {
  skip: !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS && 'Set EGRET_LEGACY_TYPESCRIPT_PLUS'
}, t => {
  const f = fixture(t);
  f.put('libs/ui.d.ts', 'declare namespace eui { class Component { label: string; } }');
  f.put(
    'src/Item.ts',
    'interface Named {label: string}\nnamespace merchant { export class Item extends eui.Component implements Named { label = "药铺" } }'
  );
  f.put('src/Shelf.ts', 'class Shelf extends merchant.Item { count = 4 }\n');
  function load(out) {
    const context = vm.createContext({
      eui: {
        Component: class Component {
          constructor() {
            this.attached = true;
          }
        }
      }
    });
    for (const file of ['classic/0000.js', 'classic/0001.js'])
      new vm.Script(fs.readFileSync(path.join(out, file), 'utf8')).runInContext(context);
    return context;
  }
  const original = f.build('original-emit');
  assert.throws(() => new (load(original.out).Shelf)(), /class constructor.*without 'new'/i);
  assert.throws(() => f.build('mixed', { target: 'es2015', baseline: original.report }), {
    code: 'MIGRATE_DIAGNOSTIC_BASELINE'
  });
  const { out, report } = f.build('native-emit', { target: 'es2015' });
  assert.equal(report.target, 'es2015');
  const context = load(out);
  const shelf = new context.Shelf();
  assert.equal(shelf.attached, true);
  assert.equal(shelf.label, '药铺');
  assert.equal(shelf.count, 4);
  assert.ok(shelf instanceof context.merchant.Item);
  assert.equal(shelf.__class__, 'Shelf');
  assert.ok(shelf.__types__.includes('Named'));
  assert.equal(context.merchant.Item.prototype.__class__, 'merchant.Item');
});

test('preserve a reviewed precompiled provider after its last business dependency and retain static gaps', {
  skip: !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS && 'Set EGRET_LEGACY_TYPESCRIPT_PLUS'
}, async t => {
  const { createHash } = await import('node:crypto');
  const f = fixture(t);
  const js =
    'globalThis.registry = {names: () => ["ShelfSkin"], get(name) { if(name === "ShelfSkin") return class ShelfSkin {}; }};\n';
  f.put('providers/shelf.js', js);
  const profile = {
    schemaVersion: 1,
    format: 'registry',
    global: 'registry',
    origin: 'project-owned',
    provider: 'providers/shelf.js',
    sha256: createHash('sha256').update(js).digest('hex'),
    after: 'src/Shelf.ts',
    entries: [{ className: 'ShelfSkin', path: 'assets/Shelf.exml' }]
  };
  f.put('factories.json', profile);
  const opts = { themeFactories: 'factories.json', groups: [{ name: 'market', from: 'src/Shelf.ts' }] };
  const { out, report } = f.build('prepared', opts);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'v8-scripts.json'))).v8Scripts.groups.market, [
    'classic/0001.js',
    'classic/theme-factories.js'
  ]);
  assert.equal(fs.readFileSync(path.join(out, 'classic/theme-factories.js'), 'utf8'), js);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'theme-factories.json')));
  assert.deepEqual(manifest.missingProviders, ['assets/Missing.exml']);
  assert.equal(report.staticSkins.review, 1);
  assert.ok(report.originals.some(file => file.path === 'providers/shelf.js' && file.sha256 === profile.sha256));
  f.put('providers/shelf.js', js + ' ');
  assert.throws(() => f.build('changed-factory', opts), { code: 'MIGRATE_THEME_FACTORIES' });
  f.put('providers/shelf.js', js);
  f.put('factories.json', { ...profile, entries: [...profile.entries, ...profile.entries] });
  assert.throws(() => f.build('duplicate', opts), { code: 'MIGRATE_THEME_FACTORIES' });
});

test('regenerate edited EXML using the supplied original SDK and reject a stale provider', {
  skip:
    !(
      process.env.EGRET_LEGACY_TYPESCRIPT_PLUS &&
      process.env.EGRET_LEGACY_MODULES &&
      process.env.EGRET_THEME_PLAYWRIGHT
    ) && 'Supply the original TypeScript/EUI SDK and a Playwright browser.'
}, async t => {
  const { compileTheme } = await import('../tools/egret-migrate/compile-theme.mjs');
  const f = fixture(t);
  const modules = process.env.EGRET_LEGACY_MODULES;
  for (const file of ['egret/egret.js', 'egret/egret.web.js', 'eui/eui.js'])
    f.put('libs/' + file, fs.readFileSync(path.join(modules, file), 'utf8'));
  f.put(
    'index.html',
    '<!doctype html><meta charset="utf-8"><script src="libs/egret/egret.js"></script><script src="libs/egret/egret.web.js"></script><script src="libs/eui/eui.js"></script><script src="bin-debug/Item.js"></script><script src="bin-debug/Shelf.js"></script>'
  );
  const classic = f.build('bootstrap').out;
  const root = path.dirname(classic);
  const options = {
    source: f.source,
    classic,
    theme: 'theme.json',
    playwright: process.env.EGRET_THEME_PLAYWRIGHT,
    executable: process.env.EGRET_THEME_BROWSER,
    ready: 'Shelf'
  };
  async function generate(folder) {
    const out = path.join(root, folder);
    const report = await compileTheme({ ...options, out });
    assert.deepEqual([report.status, report.declared, report.compiled], ['partial', 2, 1]);
    assert.deepEqual(report.gaps, [{ path: 'assets/Missing.exml', reason: 'missing-source' }]);
    return out;
  }
  const first = await generate('first-theme');
  const migrated = f.build('compiled-theme', { compiledTheme: first });
  const before = fs.readFileSync(path.join(migrated.out, 'classic/theme-factories.js'), 'utf8');
  assert.ok(before.includes('货架'));
  const input = fs.readFileSync(path.join(f.source, 'src/Item.ts'), 'utf8');
  f.put('src/Item.ts', input + '\n// The original page evaluated this script.\n');
  assert.throws(() => f.build('changed-bootstrap-source', { compiledTheme: first }), {
    code: 'MIGRATE_THEME_FACTORIES'
  });
  f.put('src/Item.ts', input);
  f.put(
    'assets/Shelf.exml',
    '<e:Skin class="ShelfSkin" xmlns:e="http://ns.egret.com/eui"><e:Label text="今日特价"/></e:Skin>'
  );
  assert.throws(() => f.build('stale', { compiledTheme: first }), { code: 'MIGRATE_THEME_FACTORIES' });
  const refreshed = await generate('updated-theme');
  const updated = f.build('updated', { compiledTheme: refreshed });
  const after = fs.readFileSync(path.join(updated.out, 'classic/theme-factories.js'), 'utf8');
  assert.ok(after.includes('今日特价'));
  assert.ok(!after.includes('货架'));
  f.put('assets/Missing.exml', '<e:Skin class="NewSkin" xmlns:e="http://ns.egret.com/eui"/>');
  assert.throws(() => f.build('newly-arrived', { compiledTheme: refreshed }), { code: 'MIGRATE_THEME_FACTORIES' });
  const html = fs.readFileSync(path.join(f.source, 'index.html'), 'utf8');
  f.put('index.html', html + '<script>globalThis.ShelfSkin=class OtherBusinessType{};</script>');
  const conflict = await compileTheme({ ...options, out: path.join(root, 'conflicting-skin') });
  assert.equal(conflict.compiled, 1);
  assert.ok(conflict.gaps.some(row => row.path === 'assets/Shelf.exml' && row.message.includes('conflicts')));
  f.put('src/Item.ts', 'throw new Error("changed after compilation");');
  await assert.rejects(compileTheme({ ...options, out: path.join(root, 'stale-scripts') }), {
    code: 'MIGRATE_THEME_COMPILER'
  });
});
