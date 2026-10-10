import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (args, cwd = root) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
const packageRequire = createRequire(path.join(root, 'packages/project/package.json'));
const cases = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/project/foundation-cases.json'), 'utf8'));
const strictOptions = { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false };
function checkExpectedVmWarning(stderr) {
  const known = /\(node:\d+\) ExperimentalWarning: VM Modules is an experimental feature and might change at any time\r?\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/g;
  const warnings = [...stderr.matchAll(known)];
  assert.equal(warnings.length, 1, 'expected exactly the known Node experimental VM warning');
  assert.equal(stderr.replace(known, ''), '', 'unexpected successful-harness stderr');
  return warnings[0][0];
}

test('format generation is present and generated artifacts have no drift', () => {
  assert.ok(existsSync(path.join(root, 'tools/generate-project-format.mjs')), 'missing project format generator');
  const result = run(['tools/generate-project-format.mjs', '--check']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('exact candidate resolves through its installed public bare root', () => {
  const result = run(['--input-type=module', '--eval', "const p = await import('jsonc-parser'); if(typeof p.createScanner !== 'function' || typeof p.visit !== 'function') throw Error('missing foundation exports');"], path.join(root, 'packages/project'));
  assert.equal(result.status, 0, 'unresolved jsonc-parser public root: ' + result.stderr);
});

test('generated format declaration exists for strict consumers', () => {
  const file = path.join(root, 'packages/contracts/dist/ProjectFormat.generated.d.ts');
  assert.ok(existsSync(file), 'missing generated project format types');
  assert.ok(readFileSync(file, 'utf8').length > 0);
});

const generator = path.join(root, 'tools/generate-project-format.mjs');
const schemaPath = 'packages/contracts/schema/project-format.schema.json';
function isolated(action) {
  const fixtureParent = path.join(root, 'work');
  mkdirSync(fixtureParent, { recursive: true });
  const dir = mkdtempSync(path.join(fixtureParent, 'project-format-fixture-'));
  try {
    mkdirSync(path.join(dir, 'packages/contracts/schema'), { recursive: true });
    cpSync(path.join(root, schemaPath), path.join(dir, schemaPath));
    return action(dir);
  } finally {
    const resolved = realpathSync(dir);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(fixtureParent).toLowerCase() + path.sep) && path.basename(resolved).startsWith('project-format-fixture-'));
    rmSync(resolved, { recursive: true, force: true });
  }
}
test('generation is deterministic and check-only drift never rewrites sources', () => isolated(dir => {
  const generate = () => run([generator, '--root', dir]);
  assert.equal(generate().status, 0);
  const generated = 'packages/project/src/format-shape.generated.ts';
  const before = readFileSync(path.join(dir, generated), 'utf8');
  assert.equal(generate().status, 0);
  assert.equal(readFileSync(path.join(dir, generated), 'utf8'), before);
  const source = JSON.parse(readFileSync(path.join(dir, schemaPath), 'utf8'));
  source.$defs.ProjectSnapshot.properties.name['x-project-check'] = 'path';
  const changed = JSON.stringify(source);
  writeFileSync(path.join(dir, schemaPath), changed);
  const drift = run([generator, '--root', dir, '--check']);
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /Generated format drift/);
  assert.equal(readFileSync(path.join(dir, schemaPath), 'utf8'), changed);
  assert.equal(readFileSync(path.join(dir, generated), 'utf8'), before);
  assert.equal(generate().status, 0);
  assert.match(readFileSync(path.join(dir, generated), 'utf8'), /"projectCheck": "path"/);
}));

test('source property order and semantic annotations survive generation without integer shaping', async () => {
  const { FORMAT_DEFINITIONS: nodes } = await import('../packages/project/dist/format-shape.generated.js');
  assert.deepEqual(nodes.ProjectSnapshot.properties.map(property => property.name), ['projectSchemaVersion', 'projectId', 'revision', 'name', 'versions', 'roots', 'entities', 'files', 'retiredEntityIds', 'retiredFileIds']);
  assert.equal(nodes.ProjectSnapshot.properties[0].node.projectCheck, 'fixed-version');
  assert.equal(nodes.ProjectVersionPins.properties[2].node.projectCheck, 'fixed-version');
  assert.equal(nodes.ProjectHistory.properties[0].node.projectCheck, 'fixed-version');
  assert.equal(nodes.ProjectEditTransaction.properties[0].node.projectCheck, undefined);
  assert.equal(nodes.ProjectEditTransaction.properties[1].node.projectCheck, 'fixed-version');
  assert.equal(nodes.ProjectRestoreTransaction.properties[1].node.projectCheck, 'fixed-version');
  assert.deepEqual(nodes.ProjectRevision, { schemaPointer: '#/$defs/ProjectRevision', type: 'number', projectCheck: 'safe-integer' });
  assert.equal(nodes.ProjectFile.properties[5].node.type, 'number');
  assert.equal(nodes.ProjectFile.properties[5].node.projectCheck, 'safe-integer');
  assert.equal(nodes.ProjectReference.oneOf[0].properties[1].node.projectCheck, undefined);
  assert.equal(nodes.ProjectReference.oneOf[0].properties[0].name, 'slot');
  assert.equal(nodes.ProjectReference.oneOf[1].properties[0].name, 'slot');
  isolated(dir => {
    assert.equal(run([generator, '--root', dir]).status, 0);
    const source = JSON.parse(readFileSync(path.join(dir, schemaPath), 'utf8'));
    const { name, ...rest } = source.$defs.ProjectSnapshot.properties;
    source.$defs.ProjectSnapshot.properties = { name, ...rest };
    writeFileSync(path.join(dir, schemaPath), JSON.stringify(source));
    const drift = run([generator, '--root', dir, '--check']);
    assert.notEqual(drift.status, 0);
    assert.match(drift.stderr, /Generated format drift/);
    assert.equal(run([generator, '--root', dir]).status, 0);
    const descriptor = readFileSync(path.join(dir, 'packages/project/src/format-shape.generated.ts'), 'utf8');
    assert.ok(descriptor.indexOf('"name": "name"', descriptor.indexOf('"ProjectSnapshot"')) < descriptor.indexOf('"name": "projectSchemaVersion"', descriptor.indexOf('"ProjectSnapshot"')));
  });
});

test('closed generator rejects unknown keywords, refs and project check tags', () => {
  for (const [change, error] of [
    [node => { node.minimum = 0; }, /unknown keyword minimum/],
    [node => { node['x-project-check'] = 'new-check'; }, /unknown project check/],
    [node => { delete node.type; node.$ref = '#/$defs/Absent'; }, /unknown ref/],
    [node => { node.type = 'integer'; }, /unknown structural type/],
  ]) isolated(dir => {
    const schema = JSON.parse(readFileSync(path.join(dir, schemaPath), 'utf8'));
    change(schema.$defs.ProjectRevision);
    writeFileSync(path.join(dir, schemaPath), JSON.stringify(schema));
    const result = run([generator, '--root', dir]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.equal(existsSync(path.join(dir, 'packages/contracts/src/ProjectFormat.generated.ts')), false);
  });
});

test('generator rejects unknown CLI arguments rather than silently ignoring them', () => {
  const result = run([generator, '--unrecognized', '--check']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown generator argument/);
});

function compileIsolatedFormat(dir, definitions, consumer) {
  writeFileSync(path.join(dir, schemaPath), JSON.stringify({ $defs: definitions }));
  const generated = run([generator, '--root', dir]);
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  writeFileSync(path.join(dir, 'consumer.ts'), consumer);
  writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    extends: path.join(root, 'tsconfig.base.json'),
    compilerOptions: { noEmit: true, composite: false, declaration: false, declarationMap: false },
    include: ['consumer.ts'],
  }));
  const result = run([path.join(root, 'node_modules/typescript/bin/tsc'), '--project', path.join(dir, 'tsconfig.json')]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test('isolated emitter compiles inline enum and oneOf arrays with independent readonly union types', () => isolated(dir => {
  compileIsolatedFormat(dir, {
    EnumArray: { 'x-ts-name': 'EnumArray', type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
    OneOfArray: { 'x-ts-name': 'OneOfArray', type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
  }, `import type { EnumArray, OneOfArray } from './packages/contracts/src/ProjectFormat.generated.js';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EnumCheck = Assert<Equal<EnumArray, readonly ('a' | 'b')[]>>;
type OneOfCheck = Assert<Equal<OneOfArray, readonly (string | number)[]>>;
const enumValue: EnumArray = ['a', 'b'];
const unionValue: OneOfArray = ['a', 1];
void enumValue; void unionValue;
`);
}));

test('isolated emitter compiles required and optional nonidentifier interface properties', () => isolated(dir => {
  compileIsolatedFormat(dir, {
    NamedProperties: { 'x-ts-name': 'NamedProperties', type: 'object', properties: {
      'a-b': { type: 'string' }, 'optional key': { type: 'number' }, 'quote"field': { type: 'boolean' },
    }, required: ['a-b', 'quote"field'], additionalProperties: false },
  }, `import type { NamedProperties } from './packages/contracts/src/ProjectFormat.generated.js';
type Expected = { readonly 'a-b': string; readonly 'optional key'?: number; readonly 'quote"field': boolean };
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type PropertyCheck = Assert<Equal<NamedProperties, Expected>>;
const requiredOnly: NamedProperties = { 'a-b': 'a', 'quote"field': true };
const withOptional: NamedProperties = { ...requiredOnly, 'optional key': 1 };
void withOptional;
`);
}));

function declarations(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new Map(clean.split(/(?=^export (?:type|interface) )/m).flatMap(part => {
    const match = part.match(/^export (?:type|interface) (\w+)/);
    if (!match) return [];
    const body = part.split(/(?=^export (?:const|function) )/m)[0];
    return [[match[1], body.replace(/[\s;]+/g, '').replace(/^exporttype(\w+)=\|/, 'exporttype$1=')]];
  }));
}
test('generated format and operational declarations reproduce the independent literal appendix', () => {
  const expected = declarations(readFileSync(path.join(root, 'tests/fixtures/project/api-signatures.txt'), 'utf8'));
  const actual = new Map([...declarations(readFileSync(path.join(root, 'packages/contracts/src/ProjectFormat.generated.ts'), 'utf8')), ...declarations(readFileSync(path.join(root, 'packages/project/src/public.ts'), 'utf8'))]);
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
  for (const [name, declaration] of expected) assert.equal(actual.get(name), declaration, name);
});

test('installed public declarations and all literal consumer types compile with strict NodeNext flags', () => {
  const result = run(['node_modules/typescript/bin/tsc', '--project', 'tests/types/tsconfig.project-foundation.json']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('installed scanner and visitor report literal strict syntax failures', async () => {
  const {visit} = await import('../packages/project/dist/json-foundation.js');
  for (const text of cases.strictRejected) {
    const errors=[];
    visit(text,{onError(code,offset,length){errors.push({code,offset,length});}},strictOptions);
    assert.ok(errors.length>0, JSON.stringify(text));
    const sentinel={};
    assert.throws(()=>visit(text,{onError(){throw sentinel;}},strictOptions), error=>error===sentinel);
  }
});

test('installed visitor preserves decoded duplicate keys and lone surrogates requiring adapters', async () => {
  const {visit} = await import('../packages/project/dist/json-foundation.js');
  for (const fixture of [cases.duplicates,cases.surrogates]) {
    const keys=[],values=[],errors=[];
    visit(fixture.text,{onObjectProperty(key){keys.push(key);},onLiteralValue(value){values.push(value);},onError(code){errors.push(code);}},strictOptions);
    assert.deepEqual(keys,fixture.keys);
    if (fixture.values) assert.deepEqual(values,fixture.values);
    assert.deepEqual(errors,[]);
  }
});

test('raw scanner offsets and lexemes retain provenance before rounded numeric callbacks', async () => {
  const {createScanner,visit}=await import('../packages/project/dist/json-foundation.js');
  const scanner=createScanner(cases.scanner.text,false),tokens=[];
  for (let kind=scanner.scan();kind!==17;kind=scanner.scan()) if(kind===10||kind===11) tokens.push({kind,offset:scanner.getTokenOffset(),length:scanner.getTokenLength(),raw:cases.scanner.text.slice(scanner.getTokenOffset(),scanner.getTokenOffset()+scanner.getTokenLength()),value:scanner.getTokenValue()});
  assert.deepEqual(tokens,cases.scanner.tokens);
  for(const fixture of cases.numbers) {
    const scanner=createScanner(fixture.text,false);
    assert.equal(scanner.scan(),11);assert.equal(scanner.getTokenValue(),fixture.text);assert.equal(scanner.getTokenOffset(),0);assert.equal(scanner.getTokenLength(),fixture.text.length);
    const values=[],errors=[];
    visit(fixture.text,{onLiteralValue(value){values.push(value);},onError(code){errors.push(code);}},strictOptions);
    assert.deepEqual(errors,[]);assert.equal(values.length,1);
    if(fixture.nonfinite) assert.equal(Number.isFinite(values[0]),false);
    else if(fixture.negativeZero) assert.equal(Object.is(values[0],-0),true);
    else assert.equal(values[0],fixture.value);
  }
});

test('throwing a sentinel stops the real visitor while false only suppresses callbacks', async()=>{
  const {visit}=await import('../packages/project/dist/json-foundation.js');
  let errors=0,suppressedBegins=0;
  visit('[[0]] 2',{onArrayBegin(){suppressedBegins++;return false;},onArrayEnd(){},onError(){errors++;}},strictOptions);
  assert.equal(errors,1);assert.equal(suppressedBegins,1);
  const sentinel={},text='[[[[0]]]]';let begins=0;
  assert.throws(()=>visit(text,{onArrayBegin(){if(++begins===2)throw sentinel;}},strictOptions),error=>error===sentinel);
  assert.equal(begins,2);
});

test('direct upstream parse loses inert __proto__ and remains excluded from product integration',()=>{
  const upstream=packageRequire('jsonc-parser');
  const errors=[],value=upstream.parse(cases.inertDirectParse,errors,strictOptions);
  assert.deepEqual(errors,[]);
  assert.equal(Object.hasOwn(value,'__proto__'),false);
  assert.equal(Object.getPrototypeOf(value).inherited,true);
  assert.equal(Object.hasOwn(value,'constructor'),true);
  assert.equal(value.constructor,3);
  assert.equal(Object.prototype.inherited,undefined);
});

test('actual installed library and built foundation evaluate with every host capability denied',t=>{
  const helper=path.join(root,'tests/helpers/project-denied-host.mjs');
  assert.ok(existsSync(helper),'missing built-foundation denied-host harness');
  const audit=run(['--experimental-vm-modules',helper]);
  assert.equal(audit.status,0,audit.stdout+audit.stderr);
  t.diagnostic('Retained known harness diagnostic:\n' + checkExpectedVmWarning(audit.stderr));
  const report=JSON.parse(audit.stdout);
  assert.deepEqual(report.deniedHostAccesses,[]);
  assert.deepEqual(report.foundationExports,['createScanner','visit']);
  assert.equal(report.libraryGraph.length,6);
  assert.equal(report.foundationGraph.length,1);
  assert.deepEqual(report.storeAuthorityExports,[]);
  const control=run(['--experimental-vm-modules',helper,'--probe-host']);
  assert.notEqual(control.status,0);
  assert.match(control.stderr,/Denied host access: process/);
  const randomControl=run(['--experimental-vm-modules',helper,'--probe-host','Math.random']);
  assert.notEqual(randomControl.status,0);
  assert.match(randomControl.stderr,/Denied host access: Math.random/);
});

test('successful denied-host audit rejects an independently injected unexpected stderr diagnostic', () => {
  assert.equal(typeof checkExpectedVmWarning, 'function', 'missing successful-harness stderr diagnostic gate');
  const helperUrl = pathToFileURL(path.join(root, 'tests/helpers/project-denied-host.mjs')).href;
  const injected = run(['--experimental-vm-modules', '--input-type=module', '--eval',
    `await import(${JSON.stringify(helperUrl)}); process.stderr.write('INDEPENDENT_UNEXPECTED_DIAGNOSTIC\\n');`]);
  assert.equal(injected.status, 0, injected.stdout + injected.stderr);
  assert.deepEqual(JSON.parse(injected.stdout).deniedHostAccesses, []);
  assert.match(injected.stderr, /ExperimentalWarning: VM Modules/);
  assert.match(injected.stderr, /INDEPENDENT_UNEXPECTED_DIAGNOSTIC/);
  assert.throws(() => checkExpectedVmWarning(injected.stderr), /unexpected successful-harness stderr/);
});

test('installed exact candidate bytes, MIT notice and lock integrity match the retained official artifact',()=>{
  const installed=path.resolve(path.dirname(realpathSync(packageRequire.resolve('jsonc-parser'))),'../..');
  const metadata=JSON.parse(readFileSync(path.join(installed,'package.json'),'utf8'));
  assert.equal(metadata.name,'jsonc-parser');assert.equal(metadata.version,'3.3.1');assert.equal(metadata.license,'MIT');
  assert.equal(metadata.main,'./lib/umd/main.js');assert.equal(metadata.typings,'./lib/umd/main.d.ts');assert.equal(metadata.module,'./lib/esm/main.js');
  assert.equal(metadata.dependencies,undefined);assert.equal(metadata.exports,undefined);
  const installedFiles=[];
  function verify(dir,relative=''){
    for(const item of readdirSync(dir,{withFileTypes:true})){
      const rel=path.join(relative,item.name);
      if(item.isDirectory())verify(path.join(dir,item.name),rel);
      else {
        const name=rel.replaceAll(path.sep,'/');installedFiles.push(name);
        assert.equal(createHash('sha256').update(readFileSync(path.join(installed,rel))).digest('hex'),cases.officialArtifact.files[name],name);
      }
    }
  }
  verify(installed);
  assert.deepEqual(installedFiles.sort(),Object.keys(cases.officialArtifact.files).sort());
  const license=readFileSync(path.join(installed,'LICENSE.md'));
  assert.deepEqual(readFileSync(path.join(root,'third-party/jsonc-parser-3.3.1.LICENSE')),license);
  const integrity=cases.officialArtifact.integrity;
  assert.equal(integrity,'sha512-HUgH65KyejrUFPvHFPbqOY0rsFip3Bo5wb4ngvdi1EpCYWUQDC5V+Y7mZws+DLkr4M//zQJoanu1SP+87Dv1oQ==');
  const lock=readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8');
  assert.ok(lock.includes('jsonc-parser@3.3.1:'));
  assert.ok(lock.includes(integrity));
});

test('native public-root CJS interop and shipped extensionless ESM limitation remain explicit',()=>{
  const cwd=path.join(root,'packages/project');
  const native=run(['--input-type=module','--eval',"import {createScanner,visit} from 'jsonc-parser'; if(typeof createScanner!=='function'||typeof visit!=='function')throw Error('root interop failed');"],cwd);
  assert.equal(native.status,0,native.stderr);
  const esm=path.resolve(path.dirname(realpathSync(packageRequire.resolve('jsonc-parser'))),'../esm/main.js');
  const limited=run(['--input-type=module','--eval',`await import(${JSON.stringify(pathToFileURL(esm).href)});`],cwd);
  assert.notEqual(limited.status,0);assert.match(limited.stderr,/ERR_MODULE_NOT_FOUND/);assert.match(limited.stderr,/[\\/]impl[\\/]format/);
});

test('completed public project root exposes exactly its six contract values and no foundation helpers',async()=>{
  assert.deepEqual(Object.keys(await import('@egret/project')).sort(),['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot']);
  const foundation=await import('../packages/project/dist/json-foundation.js');
  assert.deepEqual(Object.keys(foundation).sort(),['createScanner','visit']);
});
