// SPDX-License-Identifier: Apache-2.0
// Check strict public consumers against the complete original unsuppressed tuples.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const fail = message => { throw Error('DisplayObject.anchorOffsetX/anchorOffsetY types: ' + message); };
const hash = raw => createHash('sha256').update(raw).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (process.argv.length !== 2) fail('this type gate accepts no arguments');
// Authenticate shared first-party identity code before importing it.
const helperFile = path.join(root, 'tools/lib/file-identity.mjs');
const helperRaw = readFileSync(helperFile);
if (helperRaw.length !== 5065 || hash(helperRaw) !== '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569') fail('changed raw shared helper before import');
const { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath } = await import(pathToFileURL(helperFile).href);
if (!equal(fingerprintFile(root, 'tools/lib/file-identity.mjs'), {path:'tools/lib/file-identity.mjs',bytes:helperRaw.length,sha256:hash(helperRaw)})) fail('shared helper physical identity differs');
const inventory = JSON.parse(readFileSync(path.join(root, 'tests/types/display-anchor-offsets-diagnostic-expectations.json'), 'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(root, 'display-anchor-offsets', inventory);

const lanes = ['positive', 'negative'];
const expectedInputs = [
  "tools/lib/file-identity.mjs",
  "node_modules/typescript/package.json",
  "node_modules/typescript/bin/tsc",
  "node_modules/typescript/lib/tsc.js",
  "node_modules/typescript/lib/getExePath.js",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "tests/types/tsconfig.json",
  "tests/types/tsconfig.dom-free.json",
  "tests/types/display-anchor-offsets-positive.ts",
  "tests/types/tsconfig.display-anchor-offsets-positive.json",
  "tests/types/display-anchor-offsets-negative.ts",
  "tests/types/tsconfig.display-anchor-offsets-negative.json",
  "packages/contracts/package.json",
  "packages/runtime/package.json",
  "packages/engine/package.json",
  "packages/contracts/dist/CancellationSignal.d.ts",
  "packages/contracts/dist/Diagnostic.d.ts",
  "packages/contracts/dist/Disposable.d.ts",
  "packages/contracts/dist/HostAdapter.d.ts",
  "packages/contracts/dist/ImageData2D.d.ts",
  "packages/contracts/dist/Point2D.d.ts",
  "packages/contracts/dist/ProjectFormat.generated.d.ts",
  "packages/contracts/dist/RenderFrame2D.d.ts",
  "packages/contracts/dist/TexturedGeometry2D.d.ts",
  "packages/contracts/dist/TexturedRenderFrame2D.d.ts",
  "packages/contracts/dist/index.d.ts",
  "packages/engine/dist/Engine.d.ts",
  "packages/engine/dist/assetGroupTypes.d.ts",
  "packages/engine/dist/createEngine.d.ts",
  "packages/engine/dist/createEngineForProfile.d.ts",
  "packages/engine/dist/gameClock.d.ts",
  "packages/engine/dist/gameClockTypes.d.ts",
  "packages/engine/dist/index.d.ts",
  "packages/engine/dist/sequencePlaybackTypes.d.ts",
  "packages/engine/dist/tweenTypes.d.ts",
  "packages/runtime/dist/AssetLease.d.ts",
  "packages/runtime/dist/AssetManager.d.ts",
  "packages/runtime/dist/AssetRef.d.ts",
  "packages/runtime/dist/Bitmap.d.ts",
  "packages/runtime/dist/ByteReader.d.ts",
  "packages/runtime/dist/ByteWriter.d.ts",
  "packages/runtime/dist/CancellationController.d.ts",
  "packages/runtime/dist/DisplayObject.d.ts",
  "packages/runtime/dist/DisplayObjectContainer.d.ts",
  "packages/runtime/dist/EgretError.d.ts",
  "packages/runtime/dist/Event.d.ts",
  "packages/runtime/dist/EventDispatcher.d.ts",
  "packages/runtime/dist/Graphics.d.ts",
  "packages/runtime/dist/Mesh2D.d.ts",
  "packages/runtime/dist/NineSliceBitmap.d.ts",
  "packages/runtime/dist/NineSliceGeometry2D.d.ts",
  "packages/runtime/dist/Scope.d.ts",
  "packages/runtime/dist/SequencePlayer.d.ts",
  "packages/runtime/dist/Sprite.d.ts",
  "packages/runtime/dist/Stage.d.ts",
  "packages/runtime/dist/Texture.d.ts",
  "packages/runtime/dist/assetManagerOwnerState.d.ts",
  "packages/runtime/dist/assetState.d.ts",
  "packages/runtime/dist/bitmapDisplayState.d.ts",
  "packages/runtime/dist/diagnostics.d.ts",
  "packages/runtime/dist/displayBounds.d.ts",
  "packages/runtime/dist/displayCoordinates.d.ts",
  "packages/runtime/dist/displayHitTest.d.ts",
  "packages/runtime/dist/displayInputOperations.d.ts",
  "packages/runtime/dist/displayTreeState.d.ts",
  "packages/runtime/dist/frameCapture.d.ts",
  "packages/runtime/dist/index.d.ts",
  "packages/runtime/dist/ownership.d.ts",
  "packages/runtime/dist/sequenceClip.d.ts",
  "packages/runtime/dist/spriteSheet.d.ts",
  "packages/runtime/dist/texturedFrameCapture.d.ts"
];
const expectedNativeLibraries = [
  "lib/lib.decorators.d.ts",
  "lib/lib.decorators.legacy.d.ts",
  "lib/lib.es2015.collection.d.ts",
  "lib/lib.es2015.core.d.ts",
  "lib/lib.es2015.d.ts",
  "lib/lib.es2015.generator.d.ts",
  "lib/lib.es2015.iterable.d.ts",
  "lib/lib.es2015.promise.d.ts",
  "lib/lib.es2015.proxy.d.ts",
  "lib/lib.es2015.reflect.d.ts",
  "lib/lib.es2015.symbol.d.ts",
  "lib/lib.es2015.symbol.wellknown.d.ts",
  "lib/lib.es2016.array.include.d.ts",
  "lib/lib.es2016.d.ts",
  "lib/lib.es2016.intl.d.ts",
  "lib/lib.es2017.arraybuffer.d.ts",
  "lib/lib.es2017.d.ts",
  "lib/lib.es2017.date.d.ts",
  "lib/lib.es2017.intl.d.ts",
  "lib/lib.es2017.object.d.ts",
  "lib/lib.es2017.sharedmemory.d.ts",
  "lib/lib.es2017.string.d.ts",
  "lib/lib.es2017.typedarrays.d.ts",
  "lib/lib.es2018.asyncgenerator.d.ts",
  "lib/lib.es2018.asynciterable.d.ts",
  "lib/lib.es2018.d.ts",
  "lib/lib.es2018.intl.d.ts",
  "lib/lib.es2018.promise.d.ts",
  "lib/lib.es2018.regexp.d.ts",
  "lib/lib.es2019.array.d.ts",
  "lib/lib.es2019.d.ts",
  "lib/lib.es2019.intl.d.ts",
  "lib/lib.es2019.object.d.ts",
  "lib/lib.es2019.string.d.ts",
  "lib/lib.es2019.symbol.d.ts",
  "lib/lib.es2020.bigint.d.ts",
  "lib/lib.es2020.d.ts",
  "lib/lib.es2020.date.d.ts",
  "lib/lib.es2020.intl.d.ts",
  "lib/lib.es2020.number.d.ts",
  "lib/lib.es2020.promise.d.ts",
  "lib/lib.es2020.sharedmemory.d.ts",
  "lib/lib.es2020.string.d.ts",
  "lib/lib.es2020.symbol.wellknown.d.ts",
  "lib/lib.es2021.d.ts",
  "lib/lib.es2021.intl.d.ts",
  "lib/lib.es2021.promise.d.ts",
  "lib/lib.es2021.string.d.ts",
  "lib/lib.es2021.weakref.d.ts",
  "lib/lib.es2022.array.d.ts",
  "lib/lib.es2022.d.ts",
  "lib/lib.es2022.error.d.ts",
  "lib/lib.es2022.intl.d.ts",
  "lib/lib.es2022.object.d.ts",
  "lib/lib.es2022.regexp.d.ts",
  "lib/lib.es2022.string.d.ts",
  "lib/lib.es5.d.ts"
];
if (inventory.schemaVersion !== 1 || inventory.kind !== 'DISPLAY_ANCHOR_OFFSETS_ACTUAL_STRICT_DIAGNOSTICS'
  || inventory.status !== 'OBSERVED_FROZEN_TS7_DIAGNOSTICS'
  || !equal(inventory.tupleFormat, ['file','line','column','code','message'])
  || !equal(inventory.inputPins?.map(row => row.path), expectedInputs)
  || !equal(inventory.nativeLibraryPins?.map(row => row.path), expectedNativeLibraries)) fail('original observations or complete current inputs are malformed');
for (const row of m13?.inputPins ?? inventory.inputPins) {
  if (logicalPath(row.path) !== row.path || !equal(fingerprintFile(root, row.path), row)) fail('changed complete raw input: ' + row.path);
}
const wrapperOwner = realpathSync(path.join(root, 'node_modules/typescript'));
const wrapperPackage = JSON.parse(readFileSync(path.join(wrapperOwner, 'package.json'), 'utf8'));
if (wrapperPackage.name !== 'typescript' || wrapperPackage.version !== '7.0.2') fail('official compiler wrapper version differs');
// Use the official wrapper's installed-package selection on the actual host.
const nativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
const nativeMetadataFile = createRequire(path.join(wrapperOwner, 'package.json')).resolve(nativeName + '/package.json');
const nativeOwner = realpathSync(path.dirname(nativeMetadataFile));
const nativePackage = JSON.parse(readFileSync(nativeMetadataFile, 'utf8'));
if (nativePackage.name !== nativeName || nativePackage.version !== wrapperPackage.version
  || !samePhysicalPath(nativeOwner, realpathSync(path.join(root, 'node_modules', nativeName)), process.platform)) fail('selected native compiler owner/version differs');
// Authenticate and use the stock wrapper's installed-package executable selection.
// Convert only its documented Windows long-path prefix before physical identity checks.
const { default: getExePath } = await import(pathToFileURL(path.join(wrapperOwner, 'lib/getExePath.js')).href);
let selectedExecutable = getExePath();
if (process.platform === 'win32' && selectedExecutable.startsWith('\\\\?\\')) {
  const ordinary = selectedExecutable.slice(4);
  selectedExecutable = ordinary.startsWith('UNC\\') ? '\\\\' + ordinary.slice(4) : ordinary;
}
const nativeBinaryPath = 'lib/tsc' + (process.platform === 'win32' ? '.exe' : '');
if (ownerRelativePath(nativeOwner, realpathSync(selectedExecutable), process.platform) !== nativeBinaryPath) fail('stock wrapper selected another executable owner/path');
const currentCompilerObservation = {
  platform: process.platform, arch: process.arch, version: nativePackage.version, nativePackage: nativeName,
  nativeMetadataPin: fingerprintFile(nativeOwner, 'package.json'),
  nativeBinaryPin: fingerprintFile(nativeOwner, nativeBinaryPath),
  nativeLibraryCount: inventory.nativeLibraryPins.length,
};
for (const row of inventory.nativeLibraryPins) {
  if (logicalPath(row.path) !== row.path || !equal(fingerprintFile(nativeOwner, row.path), row)) fail('changed selected ES2022 standard library: ' + row.path);
}
const observedCompiler = inventory.originalCompilerObservation;
if (!observedCompiler || typeof observedCompiler.platform !== 'string' || !observedCompiler.platform
  || typeof observedCompiler.arch !== 'string' || !observedCompiler.arch
  || observedCompiler.nativePackage !== '@typescript/typescript-' + observedCompiler.platform + '-' + observedCompiler.arch
  || observedCompiler.version !== wrapperPackage.version) fail('original compiler provenance differs');
// Bind original native artifacts only on their observed host; select the actual host normally.
if (process.platform === observedCompiler.platform && process.arch === observedCompiler.arch) {
  for (const row of [observedCompiler.nativeMetadataPin, observedCompiler.nativeBinaryPin]) {
    if (logicalPath(row.path) !== row.path || !equal(fingerprintFile(nativeOwner, row.path), row)) fail('changed observed native compiler raw artifact');
  }
}
for (const name of ['contracts','runtime','engine']) {
  if (!samePhysicalPath(realpathSync(path.join(root,'node_modules/@egret',name)), realpathSync(path.join(root,'packages',name)), process.platform)) fail('foreign public workspace alias: ' + name);
}
if (!Array.isArray(inventory.groups) || !equal(inventory.groups.map(group => group.lane), lanes)) fail('incomplete consumer lanes');

function tuplesFrom(raw) {
  const text = new TextDecoder('utf-8', {fatal:true}).decode(raw);
  const tuples = [];
  // EOL handling is only diagnostic parsing; every original raw hash precedes it.
  for (const line of text.replaceAll('\r\n','\n').split('\n')) {
    if (line === '') continue;
    const match = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (match) {
      const absolute = path.isAbsolute(match[1]) ? match[1] : path.resolve(root, match[1]);
      tuples.push([ownerRelativePath(root, absolute, process.platform), Number(match[2]), Number(match[3]), Number(match[4]), match[5]]);
    } else if (/^ {2,}\S/.test(line) && tuples.length) tuples.at(-1)[4] += '\n' + line;
    else fail('unlocated or unconsumed compiler output');
  }
  return tuples;
}
for (const group of inventory.groups) {
  m13?.recheck();
  const file = 'tests/types/display-anchor-offsets-' + group.lane + '.ts';
  const config = 'tests/types/tsconfig.display-anchor-offsets-' + group.lane + '.json';
  const expectedExit = group.lane === 'positive' ? 0 : 1;
  const expectedRaw = group.lane === 'positive'
    ? {bytes:0,sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
    : {bytes:1211,sha256:'ab2895508ad717adc393401212e49207d48ea81a7fc09d1fa34973dcddf2d6d4'};
  const original = group.observedExecution;
  if (group.expectedExit !== expectedExit || !original || original.exitCode !== expectedExit || original.timeout !== false
    || !equal(original.stdout, expectedRaw) || original.stderr?.bytes !== 0
    || original.stderr.sha256 !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    || typeof group.originalStdout !== 'string') fail('original compiler observation is missing or changed');
  const originalRaw = Buffer.from(group.originalStdout, 'utf8');
  if (originalRaw.length !== expectedRaw.bytes || hash(originalRaw) !== expectedRaw.sha256) fail('original unsuppressed stdout bytes differ');
  if (!Array.isArray(group.tuples) || !equal(tuplesFrom(originalRaw), group.tuples)) fail('frozen tuples differ from their original raw output');
  const source = readFileSync(path.join(root, file), 'utf8');
  if (/@ts-(?:expect-error|ignore|nocheck)\b/.test(source)) fail('suppressed source diagnostics');
  // These original fixture statements name source intent, not compiler predictions.
  const negativeStatements = [
    "node.anchorOffsetX='4';", "node.anchorOffsetY=null;",
    "sprite.anchorOffsetX=undefined;", "sprite.anchorOffsetY={valueOf:()=>2};",
    "bitmap.anchorOffsetX=true;", "bitmap.anchorOffsetY=[];",
    "stage.anchorOffsetX=1n;", "stage.anchorOffsetY=()=>1;",
    "const wrongX:string=node.anchorOffsetX;", "const wrongY:boolean=node.anchorOffsetY;",
  ];
  const cases = group.lane === 'positive' ? [] : negativeStatements.map((statement,index) => {
    const lines = source.split('\n').flatMap((line,position)=>line===statement?[position+1]:[]);
    if (lines.length !== 1) fail('missing or duplicate original negative source statement');
    return {name:'AO-N'+String(index+1).padStart(2,'0'),line:lines[0]};
  });
  const names = group.lane === 'positive' ? [] : negativeStatements.map((_,index)=>'AO-N'+String(index+1).padStart(2,'0'));
  if (!equal(cases.map(row=>row.name), names) || !equal(cases, group.cases) || new Set(cases.map(row=>row.name)).size !== cases.length) fail('source intent inventory differs');
  const args = ['node_modules/typescript/bin/tsc','--noEmit','--project',config,'--pretty','false'];
  const result = spawnSync(process.execPath, args, {cwd:root,timeout:60000,maxBuffer:4*1024*1024});
  if (result.error || result.signal !== null || result.status !== expectedExit || !Buffer.isBuffer(result.stdout)
    || !Buffer.isBuffer(result.stderr) || result.stderr.length !== 0) fail('compiler setup/exit/stderr failure');
  const tuples = tuplesFrom(result.stdout);
  if (tuples.some(tuple=>tuple[0]!==file || tuple[3]===2307 || /[A-Za-z]:[\\/]|file:\/\//.test(tuple[4]))
    || !equal(tuples,m13?.group(group.lane).tuples ?? group.tuples) || tuples.length !== cases.length
    || !equal(tuples.map(tuple=>tuple[1]),cases.map(row=>row.line))) fail('missing, extra, unrelated or changed complete diagnostic');
  // Freeze the current raw streams and complete tuples in a lane-specific receipt.
  m13?.verifyClosure(group.lane);
  console.log('DisplayObject.anchorOffsetX/anchorOffsetY exact strict lane receipt: ' + JSON.stringify({
    lane: group.lane, args, exitCode: result.status, signal: result.signal, timeout: false,
    stdout: { bytes: result.stdout.length, sha256: hash(result.stdout) },
    stderr: { bytes: result.stderr.length, sha256: hash(result.stderr) },
    tuples, inputCount: (m13?.inputPins ?? inventory.inputPins).length, compiler: currentCompilerObservation,
  }));
}
console.log('DisplayObject.anchorOffsetX/anchorOffsetY strict public consumers PASS; runtime and host acceptance remain separate.');
