// SPDX-License-Identifier: Apache-2.0
// Replay complete observed strict diagnostics; runtime and browser acceptance stay separate.
import { readFileSync, realpathSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath } from './lib/file-identity.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const inventoryPath = 'tests/types/browser-png-diagnostic-expectations.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const failure = message => { throw new Error('Browser PNG types: ' + message); };
if (process.argv.length !== 2) failure('this gate accepts no arguments');
const inventoryBytes = readFileSync(path.join(root, inventoryPath));
const inventory = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inventoryBytes));
const inventoryPin = fingerprintFile(root, inventoryPath);
const selfPin = fingerprintFile(root, 'tools/browser-png-types.mjs');
const lanes = ['positive', 'negative', 'import-negative', 'dom-free-positive', 'dom-free-negative'];
if (inventory.schemaVersion !== 1 || inventory.kind !== 'BROWSER_PNG_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'
  || !equal(inventory.tupleFormat, ['file', 'line', 'column', 'code', 'message'])
  || inventory.compiler?.name !== 'typescript' || inventory.compiler.version !== '7.0.2'
  || inventory.compiler.entry !== 'node_modules/typescript/bin/tsc'
  || !equal(inventory.lanes?.map(row => row.lane), lanes)) failure('wrong observed inventory or compiler');

// Only the two explicit WebGL2 exports may select this reviewed package revision.
const m14EnginePackageBase = {"path":"packages/engine/package.json","bytes":1567,"sha256":"e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5"};
const m14EnginePackageCurrent = {"path":"packages/engine/package.json","bytes":1799,"sha256":"c106c84b479f88ac1570418a21672b6148b1bdd0b870631198c359d467f2f0c7"};
function m14EnginePackagePin(owner, expected) {
 if (!equal(expected, m14EnginePackageBase)) return expected;
 const actual = fingerprintFile(owner, expected.path);
 if (!equal(actual, m14EnginePackageCurrent)) return expected;
 const raw = readFileSync(path.join(owner, expected.path));
 if (raw.length !== actual.bytes || hash(raw) !== actual.sha256) throw Error('M1.4 engine package changed during read');
 const value = JSON.parse(raw);
 delete value.exports['./webgl2']; delete value.exports['./webgl2/scene3d'];
 const predecessor = Buffer.from(JSON.stringify(value, null, 2) + '\n');
 if (predecessor.length !== expected.bytes || hash(predecessor) !== expected.sha256) throw Error('M1.4 engine package predecessor differs');
 return actual;
}

// M1.5 keeps all historical diagnostics and image facade identities. Only the
// complete reviewed package/provider source, emission and declaration group may
// select this finite raw-input successor; this is not a new full compiler closure.
const m15PngProductPairs = [{"path":"packages/engine/package.json","base":{"bytes":1567,"sha256":"e01d48a51c0845783afeec93ffcc7674c7980797cd6a9c58cc74ec3f13d2e0c5"},"current":{"bytes":2167,"sha256":"be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143"}},{"path":"packages/engine/web/BrowserTextureProvider.ts","base":{"bytes":26925,"sha256":"f3653ea77a29979f43f18c95405223ad1d2a72a647d40391705668f9ea504993"},"current":{"bytes":38735,"sha256":"19a7a5c531372a93a88d52bd1885ccfc77054ca21821ac93a301ed5cfff2ef39"}},{"path":"packages/engine/dist/web/BrowserTextureProvider.js","base":{"bytes":26201,"sha256":"06f49a72039f95d0fd3c23bb409db658672bb10b512b4ca9b256064b419e1d90"},"current":{"bytes":37211,"sha256":"4daad43034281f0038220a4c1fa5238b1a67c8fe09870ef0717b53b50c5a15dd"}},{"path":"packages/engine/dist/web/BrowserTextureProvider.d.ts","base":{"bytes":1130,"sha256":"44418045d02c256a6814b74abdda44b5ed1f1433618479a4aade9ddc08f30257"},"current":{"bytes":2366,"sha256":"5304af807252f688b48b3b0bd4864bc3b7a020803fff375367fa4f172c0f45d2"}}];
// M2.2 adds only the exact optional animation entry before retained inverses.
const m22PngEnginePackage = {base:{path:'packages/engine/package.json',bytes:2591,sha256:'817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5'},current:{path:'packages/engine/package.json',bytes:2709,sha256:'3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9'}};
// Only the exact readonly paragraph exports extend this unchanged PNG consumer.
const m32PngEnginePackage = {base:m22PngEnginePackage.current,current:{path:'packages/engine/package.json',bytes:2933,sha256:'afcc7ed24ddd5e73f0ebed1f60b1c1b31d1bac59d2127e0b061c499cfe8e93fe'}};
const m32PngPackageSelected=equal(fingerprintFile(root,m32PngEnginePackage.current.path),m32PngEnginePackage.current);
function m32PngPackagePredecessor(raw){
 if(!m32PngPackageSelected)return raw;
 const {base,current}=m32PngEnginePackage;
 if(raw.length!==current.bytes||hash(raw)!==current.sha256)failure('M3.2 PNG package changed during replay');
 const value=JSON.parse(raw);
 if(!equal(value.exports?.['./paragraph'],{types:'./dist/paragraph.d.ts',import:'./dist/paragraph.js'})||!equal(value.exports?.['./web/paragraph'],{types:'./dist/web/paragraph.d.ts',import:'./dist/web/paragraph.js'}))failure('M3.2 PNG paragraph exports differ');
 delete value.exports['./paragraph'];delete value.exports['./web/paragraph'];
 const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(previous.length!==base.bytes||hash(previous)!==base.sha256)failure('M3.2 PNG package predecessor differs');return previous;
}
const m22PngPackageSelected = equal(fingerprintFile(root,m22PngEnginePackage.current.path),m22PngEnginePackage.current)||m32PngPackageSelected;
function m22PngPackagePredecessor(raw){
 raw=m32PngPackagePredecessor(raw);
 if(!m22PngPackageSelected)return raw;
 const {base,current}=m22PngEnginePackage;
 if(raw.length!==current.bytes||hash(raw)!==current.sha256)failure('M2.2 PNG engine package changed during replay');
 const value=JSON.parse(raw);
 if(!equal(value.exports?.['./animation'],{types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))failure('M2.2 PNG animation export shape differs');
 delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(previous.length!==base.bytes||hash(previous)!==base.sha256)failure('M2.2 PNG engine package predecessor differs');return previous;
}
// M3.1 adds only the exact optional UI route before the retained pointer inverse.
const m31PngEnginePackage = {"base":{"path":"packages/engine/package.json","bytes":2494,"sha256":"65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951"},"current":{"path":"packages/engine/package.json","bytes":2591,"sha256":"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5"}};
const m31PngPackageSelected = equal(fingerprintFile(root,m31PngEnginePackage.current.path),m31PngEnginePackage.current)||m22PngPackageSelected;
function m31PngPackagePredecessor(raw){
 raw=m22PngPackagePredecessor(raw);
 if(!m31PngPackageSelected)return raw;
 const {base,current}=m31PngEnginePackage;
 if(raw.length!==current.bytes||hash(raw)!==current.sha256)failure('M3.1 PNG engine package changed during replay');
 const value=JSON.parse(raw);delete value.exports['./ui'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(previous.length!==base.bytes||hash(previous)!==base.sha256)failure('M3.1 PNG engine package predecessor differs');return previous;
}
// M33-PNG-PACKAGE-BEGIN
// Only the reviewed optional input exports/private alias extend the retained
// M1.5 package. Provider identities, original tuples and lane inputs stay exact.
const m33PngEnginePackage = {base:{path:'packages/engine/package.json',bytes:2167,sha256:'be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143'},current:{path:'packages/engine/package.json',bytes:2494,sha256:'65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951'}};
const m33PngPackageSelected = equal(fingerprintFile(root,m33PngEnginePackage.current.path),m33PngEnginePackage.current)||m31PngPackageSelected;
function m33PngPackagePredecessor(raw) {
  raw=m31PngPackagePredecessor(raw);
  if(!m33PngPackageSelected)return raw;
  const {base,current}=m33PngEnginePackage;
  if(raw.length!==current.bytes||hash(raw)!==current.sha256)failure('M3 PNG engine package changed during replay');
  const value=JSON.parse(raw);
  delete value.exports['./input'];delete value.exports['./web/pointer'];delete value.imports['#egret-pointer-input'];
  const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
  if(previous.length!==base.bytes||hash(previous)!==base.sha256)failure('M3 PNG engine package predecessor differs');
  return previous;
}
// M33-PNG-PACKAGE-END

function m15ProductIdentityBranch() {
  const actual = m15PngProductPairs.map(row => fingerprintFile(root, row.path));
  if(m22PngPackageSelected)actual[0]=m22PngEnginePackage.base;
  if(m31PngPackageSelected)actual[0]=m31PngEnginePackage.base;
  if(m33PngPackageSelected){
    if(!equal({path:m15PngProductPairs[0].path,...m15PngProductPairs[0].current},m33PngEnginePackage.base)
      ||!equal(actual[0],m33PngEnginePackage.current))failure('M3 PNG engine package identity changed');
    actual[0]=m33PngEnginePackage.base;
  }
  const matches = actual.map((row, index) => equal(row, { path: m15PngProductPairs[index].path, ...m15PngProductPairs[index].current }));
  if (!matches.some(Boolean)) return 'historical';
  if (!matches.every(Boolean)) failure('unregistered or mixed M1.5 PNG product identity');
  const row = m15PngProductPairs[0], raw = m33PngPackagePredecessor(readFileSync(path.join(root, row.path)));
  if (raw.length !== row.current.bytes || hash(raw) !== row.current.sha256) failure('M1.5 engine package changed during read');
  const value = JSON.parse(raw);
  delete value.exports['./resources']; delete value.exports['./web/resources'];
  delete value.imports['#egret-manifest-resources'];
  const predecessor = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (predecessor.length !== m14EnginePackageCurrent.bytes || hash(predecessor) !== m14EnginePackageCurrent.sha256) failure('M1.5 engine package predecessor differs');
  return 'current';
}
const m15ProductBranch = m15ProductIdentityBranch();
function m15ProductPin(expected) {
  const pair = m15PngProductPairs.find(row => equal(expected, { path: row.path, ...row.base }));
  return pair && m15ProductBranch === 'current' ? { path: pair.path, ...pair.current } : expected;
}

// M2.1 changes only the dev-only lock input; compiler observations remain frozen.
const m21ContentLock = {"base":{"path":"pnpm-lock.yaml","bytes":9017,"sha256":"79383095fd4bb2bb4682a12f9651d9a876a01fc6dc1326d09bc0ad587db23084"},"current":{"path":"pnpm-lock.yaml","bytes":9271,"sha256":"061742afdc492e6e1721798dcc1b1539f8e4fd9d0274fa7c5fd9091917e57338"}};
function checkPin(pin) {
  if(equal(pin,m21ContentLock.base)&&equal(fingerprintFile(root,pin.path),m21ContentLock.current))pin=m21ContentLock.current;
  pin = m15ProductPin(pin);
  pin = m14EnginePackagePin(root, pin);
  if(m33PngPackageSelected&&equal(pin,m33PngEnginePackage.base))pin=m33PngEnginePackage.current;
  if(m31PngPackageSelected&&equal(pin,m31PngEnginePackage.base))pin=m31PngEnginePackage.current;
  if(m22PngPackageSelected&&equal(pin,m22PngEnginePackage.base))pin=m22PngEnginePackage.current;
  if(m32PngPackageSelected&&equal(pin,m32PngEnginePackage.base))pin=m32PngEnginePackage.current;
  logicalPath(pin.path);
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[0-9a-f]{64}$/.test(pin.sha256)) failure('malformed raw pin');
  const actual = fingerprintFile(root, pin.path);
  if (actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256) failure('changed input: ' + pin.path);
}
// Installed package links are authenticated separately from repository file reads.
const dependencyOwner = realpathSync(path.join(root, 'node_modules'));
function installed(owner) {
  ownerRelativePath(dependencyOwner, path.join(owner, 'package.json'));
  if (!samePhysicalPath(realpathSync(owner), owner)) failure('another installed owner');
}
const compilerOwner = path.dirname(realpathSync(path.join(root, 'node_modules/typescript/package.json')));
installed(compilerOwner);
const metadata = JSON.parse(readFileSync(path.join(compilerOwner, 'package.json'), 'utf8'));
if (metadata.name !== 'typescript' || metadata.version !== '7.0.2'
  || !equal(metadata.bin, { tsc: './bin/tsc' }) || metadata.imports?.['#getExePath'] !== './lib/getExePath.js') failure('wrong compiler launcher');
for (const relative of ['bin/tsc', 'lib/tsc.js', 'lib/getExePath.js']) {
  if (!samePhysicalPath(realpathSync(path.join(root, 'node_modules/typescript', relative)), path.join(compilerOwner, relative))) failure('compiler link owner changed');
}
const requireFromCompiler = createRequire(path.join(compilerOwner, 'package.json'));
const nativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
const nativeMetadataPath = requireFromCompiler.resolve(nativeName + '/package.json');
const nativeOwner = path.dirname(realpathSync(nativeMetadataPath));
installed(nativeOwner);
const nativeMetadata = JSON.parse(readFileSync(nativeMetadataPath, 'utf8'));
if (nativeMetadata.name !== nativeName || nativeMetadata.version !== '7.0.2'
  || metadata.optionalDependencies?.[nativeName] !== '7.0.2'
  || !equal(nativeMetadata.os, [process.platform]) || !equal(nativeMetadata.cpu, [process.arch])) failure('wrong platform-native compiler package');
const nativeRelative = process.platform === 'win32' ? 'lib/tsc.exe' : 'lib/tsc';
const nativeBinary = path.join(nativeOwner, nativeRelative);
function installedPin(owner, relative) {
  const filename = path.join(owner, relative), stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || !samePhysicalPath(realpathSync(filename), filename)) failure('installed file escaped qualified package');
  const bytes = readFileSync(filename);
  return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
}
function witness() {
  const declarations = readdirSync(path.join(compilerOwner, 'lib')).filter(name => name.endsWith('.d.ts')).sort();
  if (declarations.length === 0) failure('missing stock declaration library');
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    if (!samePhysicalPath(realpathSync(path.join(root, 'node_modules/@egret', name)), path.join(root, 'packages', name))) failure('workspace package alias points to another owner');
  }
  return { compilerOwner, nativeOwner, nativeResolution: realpathSync(nativeMetadataPath),
    launcher: ['package.json', 'bin/tsc', 'lib/tsc.js', 'lib/getExePath.js'].map(file => installedPin(compilerOwner, file)),
    native: ['package.json', nativeRelative].map(file => installedPin(nativeOwner, file)),
    declarations: declarations.map(name => installedPin(compilerOwner, 'lib/' + name)) };
}
const currentOwners = witness();
const compilerPaths = ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc',
  'node_modules/typescript/lib/tsc.js', 'node_modules/typescript/lib/getExePath.js', 'pnpm-lock.yaml'];
if (!equal(inventory.compiler.pins?.map(row => row.path), compilerPaths)) failure('missing stock launcher/lock identities');
const productPaths = ['packages/engine/package.json', 'packages/engine/web/image.ts',
  'packages/engine/web/BrowserTextureProvider.ts', 'packages/engine/dist/web/image.js',
  'packages/engine/dist/web/image.d.ts', 'packages/engine/dist/web/BrowserTextureProvider.js',
  'packages/engine/dist/web/BrowserTextureProvider.d.ts'];
const configurationPaths = ['tsconfig.base.json', 'tsconfig.json', 'packages/contracts/tsconfig.json',
  'packages/runtime/tsconfig.json', 'packages/engine/tsconfig.json', 'packages/engine/tsconfig.rendering.json',
  'packages/engine/tsconfig.web.json', 'packages/project/tsconfig.json'];
if (!equal(inventory.productPins?.map(row => row.path), productPaths)
  || !equal(inventory.configurationPins?.map(row => row.path), configurationPaths)) failure('incomplete product or project configuration inventory');
function checkCompilerPin(pin) {
  if (pin.path === 'pnpm-lock.yaml') return checkPin(pin);
  const relative = pin.path.slice('node_modules/typescript/'.length);
  const actual = installedPin(compilerOwner, relative);
  if (actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256) failure('changed stock compiler input: ' + pin.path);
}
// M1.3 preserves the complete historical inventory. Only this authentic Texture
// source/declaration pair selects the single observed structural-error wording.
// This local successor does not claim a newly frozen full compiler closure.
const m13TextureSourcePairs = [{"path":"packages/runtime/src/Texture.ts","base":{"bytes":4149,"sha256":"35e564962d77300cdab9738201cebdb4cc52d01b6c2559ef5734ce79c7795820"},"current":{"bytes":8333,"sha256":"3dbaac58fd9f2b744896801039d247a45e51e64d2afa51c1a2a6acf8bc47159f"}},{"path":"packages/runtime/dist/Texture.d.ts","base":{"bytes":1055,"sha256":"77c4e29aa324f4b3bc8dd47d296802c2bfff0cf7a9303271b29b8bb7e73da0d3"},"current":{"bytes":1388,"sha256":"04aebb73bf1c3001edab3ec5f20bf2e66fef582dd3b1f57ecf560f4895ed83a2"}}];
const m13TextureDiagnosticSuccessor = {"lane":"negative","index":24,"base":{"file":"tests/types/browser-png-negative.ts","line":73,"column":18,"code":2740,"message":"Type '{}' is missing the following properties from type 'Texture': textureBrand, imageData, sourceRect, width, and 3 more."},"current":{"file":"tests/types/browser-png-negative.ts","line":73,"column":18,"code":2740,"message":"Type '{}' is missing the following properties from type 'Texture': textureBrand, imageData, sourceRect, viewRegion, and 4 more."}};
function textureIdentityBranch() {
  const actual = m13TextureSourcePairs.map(row => fingerprintFile(root, row.path));
  for (const branch of ['base', 'current'])
    if (actual.every((row, index) => equal(row, { path: m13TextureSourcePairs[index].path, ...m13TextureSourcePairs[index][branch] }))) return branch;
  failure('unregistered or mixed Texture source/declaration identity');
}
const names = new Set();
function markers(group) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path.join(root, group.sourcePin.path)));
  if (/@ts-(?:ignore|expect-error|nocheck)\b/.test(text)) failure('suppressed consumer diagnostic');
  const sourceLines = text.split('\n'), found = [];
  const prefix = group.lane === 'negative' ? 'N' : group.lane === 'import-negative' ? 'I'
    : group.lane === 'dom-free-negative' ? 'DN' : group.lane === 'positive' ? 'P' : 'DP';
  for (let at = 0; at < sourceLines.length; at++) {
    if (!sourceLines[at].includes('BIP_TYPE_CASE')) continue;
    const match = /^\/\/ BIP_TYPE_CASE (BIP1-(?:P|DP|N|I|DN)\d{2}): (.+)$/.exec(sourceLines[at]);
    if (!match || !match[1].startsWith('BIP1-' + prefix) || names.has(match[1])
      || !sourceLines[at + 1]?.trim() || /^\s*\/\//.test(sourceLines[at + 1])) failure('malformed or duplicate case marker');
    names.add(match[1]);
    found.push({ name: match[1], line: at + 2, statement: sourceLines[at + 1], intent: match[2] });
  }
  const negative = group.expectedExit === 1;
  if (negative && (!equal(found, group.markers) || found.length === 0)) failure('changed negative statements or intentions');
  if (!negative && group.markers.length !== 0) failure('positive lane has negative marker table');
}
for (const group of inventory.lanes) {
  const negative = group.lane.includes('negative');
  if (group.expectedExit !== (negative ? 1 : 0)
    || group.sourcePin.path !== 'tests/types/browser-png-' + group.lane + '.ts'
    || group.configPin.path !== 'tests/types/tsconfig.browser-png-' + group.lane + '.json') failure('wrong lane identity');
  checkPin(group.sourcePin); checkPin(group.configPin); markers(group);
  if (!Array.isArray(group.diagnostics) || (negative ? group.diagnostics.length === 0 : group.diagnostics.length !== 0)) failure('wrong observed lane diagnostics');
}
const textureSuccessorGroup = inventory.lanes.find(group => group.lane === m13TextureDiagnosticSuccessor.lane);
if (!equal(textureSuccessorGroup?.diagnostics[m13TextureDiagnosticSuccessor.index], m13TextureDiagnosticSuccessor.base))
  failure('historical Texture diagnostic differs');
const textureBranch = textureIdentityBranch();
function unchanged() {
  if (m15ProductIdentityBranch() !== m15ProductBranch) failure('M1.5 PNG product branch changed during replay');
  checkPin(inventoryPin); checkPin(selfPin);
  if (textureIdentityBranch() !== textureBranch) failure('Texture source/declaration branch changed during replay');
  for (const pin of inventory.productPins) checkPin(pin);
  for (const pin of inventory.configurationPins) checkPin(pin);
  for (const group of inventory.lanes) { checkPin(group.sourcePin); checkPin(group.configPin); }
  for (const pin of inventory.compiler.pins) checkCompilerPin(pin);
  if (!equal(witness(), currentOwners)) failure('installed compiler owner or raw bytes changed');
}
function diagnosticMessage(text) {
  return text.replace(/(["'])((?:[A-Za-z]:[\\/]|\\\\|\/)[^"']+)\1/g, (all, quote, filename) => {
    let relative;
    try { relative = ownerRelativePath(root, filename); }
    catch { failure('unowned absolute filename in diagnostic message'); }
    return quote + '<repo>/' + relative + quote;
  });
}
function parseDiagnostics(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
  if (!text) return [];
  if (text.includes('\r') || !text.endsWith('\n')) failure('incomplete compiler output');
  const result = [];
  for (const line of text.slice(0, -1).split('\n')) {
    const match = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (match) {
      const code = Number(match[4]);
      if ([2307, 2688, 6053, 5058, 5083, 5110].includes(code)) failure('compiler setup diagnostic is not a refusal witness');
      const filename = path.isAbsolute(match[1]) || /^[A-Za-z]:[\\/]/.test(match[1])
        ? ownerRelativePath(root, match[1]) : logicalPath(match[1].replaceAll('\\', '/'));
      result.push({ file: filename, line: Number(match[2]), column: Number(match[3]), code, message: diagnosticMessage(match[5]) });
    } else {
      if (!result.length || !/^ {2,}\S.*$/.test(line)) failure('unconsumed compiler output');
      result.at(-1).message += '\n' + diagnosticMessage(line);
    }
  }
  return result;
}
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete environment[key];
}
// No diagnostic count can substitute for these complete observed tuples.
for (const group of inventory.lanes) {
  unchanged();
  const result = spawnSync(process.execPath, [inventory.compiler.entry, '--project', group.configPin.path, '--pretty', 'false'],
    { cwd: root, env: environment, windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? Buffer.alloc(0));
  process.stderr.write(result.stderr ?? Buffer.alloc(0));
  unchanged();
  if (result.error || result.signal !== null || result.status !== group.expectedExit || result.stderr?.length) {
    throw result.error ?? new Error('Browser PNG types: compiler settlement refused in ' + group.lane);
  }
  const observed = parseDiagnostics(result.stdout ?? Buffer.alloc(0));
  const expected = textureBranch === 'current' && group.lane === m13TextureDiagnosticSuccessor.lane
    ? group.diagnostics.map((row, index) => index === m13TextureDiagnosticSuccessor.index ? m13TextureDiagnosticSuccessor.current : row)
    : group.diagnostics;
  if (!equal(observed, expected) || observed.some(row => row.file !== group.sourcePin.path)
    || new Set(observed.map(row => JSON.stringify(row))).size !== observed.length) failure('changed/missing/extra/duplicate complete diagnostics in ' + group.lane);
  console.log('Browser PNG ' + group.lane + ' exact diagnostic replay: ' + JSON.stringify(observed));
}
unchanged();
console.log('Browser PNG current native compiler witness: ' + JSON.stringify({ name: nativeName,
  version: nativeMetadata.version, platform: process.platform, arch: process.arch, pins: currentOwners.native }));
console.log('Browser PNG strict consumers PASS; runtime, policy and native acceptance are separate.');
