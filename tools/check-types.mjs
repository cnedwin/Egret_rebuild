import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, rmSync, existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fingerprintFile, ownerRelativePath } from "./lib/file-identity.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const compiler = path.join(root, "node_modules/typescript/bin/tsc");
// The current shared declaration lane authorizes its actual compiler files
// before any compiler launch. Other-platform native binaries are independently
// owner/version qualified and snapshotted; Windows observations are not reused.
const sceneDomM13CompilerPins = {"observedPlatform":"win32","observedArch":"x64","version":"7.0.2","wrapper":[{"path":"package.json","bytes":3087,"sha256":"3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e"},{"path":"bin/tsc","bytes":44,"sha256":"2219f428a7e55aaf1f7ad85b9b0f0cf5078aeb76ccc9a7c6036c92d48f492ffd"},{"path":"lib/tsc.js","bytes":609,"sha256":"cbdfbf11c26ed00dfc073155e316a42d6d6d8a387be61006b82fa9aa93ac572e"},{"path":"lib/getExePath.js","bytes":3051,"sha256":"96c10fd3a18e165d7323de8e314ac8d755ad96811f9fbc304a5b3ba4e05285cc"}],"native":[{"path":"package.json","bytes":1042,"sha256":"6d8ec7623880a902bb225c53571112e2bbf0273412b2c534070b1193d2be0f6b"},{"path":"lib/tsc.exe","bytes":24520544,"sha256":"f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7"}]};
function prepareSceneDomM13Compiler(){
  if(!existsSync(path.join(root,'packages/engine/dist/web/sharedB1.d.ts')))return null;
  const wrapperOwner=realpathSync(path.join(root,'node_modules/typescript'));
  const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
  const nativeBinary='lib/tsc'+(process.platform==='win32'?'.exe':'');
  const fail=message=>{throw Error('S3D1 M1.3 compiler '+message);};
  function qualify(){
    if(realpathSync(path.join(root,'node_modules/typescript'))!==wrapperOwner)fail('wrapper owner changed');
    for(const row of sceneDomM13CompilerPins.wrapper){const actual=fingerprintFile(wrapperOwner,row.path);if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)fail('input changed: typescript/'+row.path);}
    const wrapper=JSON.parse(readFileSync(path.join(wrapperOwner,'package.json'),'utf8'));
    const resolver=createRequire(path.join(wrapperOwner,'lib/getExePath.js'));
    const selected=resolver.resolve.paths(nativeName+'/package.json').map(base=>path.join(base,nativeName,'package.json')).find(file=>existsSync(file));
    if(!selected)fail('native owner missing');
    const owner=realpathSync(path.dirname(selected)),metadata=JSON.parse(readFileSync(path.join(owner,'package.json'),'utf8'));
    if(realpathSync(path.dirname(resolver.resolve(nativeName+'/package.json')))!==owner)fail('native resolution differs');
    if(wrapper.name!=='typescript'||wrapper.version!==sceneDomM13CompilerPins.version||wrapper.optionalDependencies?.[nativeName]!==wrapper.version
      ||metadata.name!==nativeName||metadata.version!==wrapper.version||JSON.stringify(metadata.os)!==JSON.stringify([process.platform])
      ||JSON.stringify(metadata.cpu)!==JSON.stringify([process.arch])||JSON.stringify(metadata.exports)!==JSON.stringify({'./package.json':'./package.json'}))fail('native owner/platform metadata differs');
    if(process.platform===sceneDomM13CompilerPins.observedPlatform&&process.arch===sceneDomM13CompilerPins.observedArch)
      for(const row of sceneDomM13CompilerPins.native){const actual=fingerprintFile(owner,row.path);if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)fail('input changed: '+nativeName+'/'+row.path);}
    return owner;
  }
  const nativeOwner=qualify(),snapshot=['package.json',nativeBinary].map(file=>fingerprintFile(nativeOwner,file));
  function verify(){
    if(qualify()!==nativeOwner)fail('native owner changed');
    for(const row of snapshot){const actual=fingerprintFile(nativeOwner,row.path);if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)fail('input changed: '+nativeName+'/'+row.path);}
  }
  verify();return {nativeOwner,verify};
}
const sceneDomM13Compiler = prepareSceneDomM13Compiler();
const result = spawnSync(process.execPath, [compiler, "--project", "tests/types/tsconfig.json"], { cwd: root, encoding: "utf8" });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Independently compile the negative fixture without suppression: a green
// check must prove real compiler diagnostics, not silently accepted misuse.
const fixture = path.join(root, "tests/types/negative.ts");
const raw = readFileSync(fixture, "utf8");
const invalid = path.join(root, "tests/types/invalid.generated.ts");
const invalidConfig = path.join(root, "tests/types/invalid.generated.json");
try {
  writeFileSync(invalid, raw.replace(/^.*@ts-expect-error.*$/gm, ""));
  writeFileSync(invalidConfig, JSON.stringify({ extends: "./tsconfig.json", include: ["invalid.generated.ts"] }));
  const negative = spawnSync(process.execPath, [compiler, "--project", "tests/types/invalid.generated.json", "--pretty", "false"], { cwd: root, encoding: "utf8" });
  process.stdout.write(negative.stdout ?? "");
  process.stderr.write(negative.stderr ?? "");
  if (negative.error) throw negative.error;
  const count = (negative.stdout?.match(/error TS\d+:/g) ?? []).length;
  const expected = (raw.match(/@ts-expect-error/g) ?? []).length;
  if (negative.status === 0 || count !== expected) {
    throw new Error(`Negative fixture expected ${expected} diagnostics; got ${count}, exit ${negative.status}`);
  }
  // Preserve the aggregate assertion above and also require each named geometry
  // misuse to fail at its original line, in this exact generated fixture.
  const expectedGeometry = raw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/@ts-expect-error GEOMETRY_CASE ([\w-]+) TS(\d+)/);
    return match ? [{name:match[1],file:'tests/types/invalid.generated.ts',line:index+2,code:Number(match[2])}] : [];
  });
  if (expectedGeometry.length !== 16 || expectedGeometry.length !== (raw.match(/GEOMETRY_CASE/g) ?? []).length || new Set(expectedGeometry.map(item => item.name)).size !== expectedGeometry.length) throw new Error('Unclassified or duplicate geometry negative fixture');
  const observedGeometry = [...(negative.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match => ({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
  const geometryReceipts = expectedGeometry.map(expectedCase => {
    const matching = observedGeometry.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line && actual.code === expectedCase.code);
    if (matching.length !== 1) throw new Error(`Geometry negative ${expectedCase.name}: expected exactly one ${expectedCase.file}:${expectedCase.line} / TS${expectedCase.code}; got ${matching.length}`);
    return {name:expectedCase.name,expected:expectedCase,actual:matching[0]};
  });
  console.log('Geometry individual diagnostic receipts: '+JSON.stringify(geometryReceipts));
  // Retain every prior pass and pin each Mesh misuse to its own compiler result.
  const expectedMesh = raw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/@ts-expect-error MESH_CASE ([\w-]+) TS(\d+)/);
    return match ? [{name:match[1],file:'tests/types/invalid.generated.ts',line:index+2,code:Number(match[2])}] : [];
  });
  if (expectedMesh.length !== 13 || expectedMesh.length !== (raw.match(/MESH_CASE/g) ?? []).length || new Set(expectedMesh.map(item => item.name)).size !== expectedMesh.length) throw new Error('Unclassified or duplicate Mesh negative fixture');
  // The original marker is historical. Only this reviewed generic declaration
  // succeeds it at the same genuine consumer expression and exact column.
  const m13MeshDeclaration = {"path":"packages/runtime/dist/Mesh2D.d.ts","bytes":995,"sha256":"97f47566b1e2239f3eebf09e4510e6c97008d65bd35c07ce2a8c6ad480590ef0"};
  const m13MeshBytes = readFileSync(path.join(root, m13MeshDeclaration.path));
  const m13Mesh = m13MeshBytes.length === m13MeshDeclaration.bytes && createHash('sha256').update(m13MeshBytes).digest('hex') === m13MeshDeclaration.sha256;
  const m13ForgedMesh = {name:'forged-geometry',file:'tests/types/invalid.generated.ts',line:296,column:37,historicalCode:2741,code:2345};
  const meshReceipts = expectedMesh.map(expectedCase => {
    const atLocation = observedGeometry.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line);
    const shared = m13Mesh && expectedCase.name === m13ForgedMesh.name;
    if (shared && (expectedCase.file !== m13ForgedMesh.file || expectedCase.line !== m13ForgedMesh.line || expectedCase.code !== m13ForgedMesh.historicalCode)) throw Error('M1.3 Mesh diagnostic predecessor differs');
    const current = shared ? {...expectedCase,column:m13ForgedMesh.column,code:m13ForgedMesh.code} : expectedCase;
    const matching = atLocation.filter(actual => actual.code === current.code && (!shared || actual.column === current.column));
    if (atLocation.length !== 1 || matching.length !== 1) throw new Error(`Mesh negative ${expectedCase.name}: expected exactly one ${current.file}:${current.line} / TS${current.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,current,actual:matching[0]};
  });
  console.log('Mesh individual diagnostic receipts: '+JSON.stringify(meshReceipts));
  // Task 5 supplements the accepted 110 root cases; preserve their checks above.
  const expectedTextured = raw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/@ts-expect-error TEXTURED_FRAME_CASE ([\w-]+) TS(\d+)/);
    return match ? [{name:match[1],file:'tests/types/invalid.generated.ts',line:index + 2,code:Number(match[2])}] : [];
  });
  if (expectedTextured.length !== 12 || expectedTextured.length !== (raw.match(/TEXTURED_FRAME_CASE/g) ?? []).length || new Set(expectedTextured.map(item => item.name)).size !== expectedTextured.length) throw new Error('Unclassified or duplicate textured-frame negative fixture');
  const texturedReceipts = expectedTextured.map(expectedCase => {
    const atLocation = observedGeometry.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line);
    if (atLocation.length !== 1 || atLocation[0].code !== expectedCase.code) throw new Error(`Textured-frame negative ${expectedCase.name}: expected exactly one ${expectedCase.file}:${expectedCase.line} / TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
  });
  console.log('Textured-frame individual diagnostic receipts: '+JSON.stringify(texturedReceipts));

  // Clock additions retain the aggregate and all prior named diagnostic guards.
  const expectedClock = raw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/@ts-expect-error GAME_CLOCK_CASE ([\w-]+) TS(\d+)/);
    return match ? [{name:match[1],file:'tests/types/invalid.generated.ts',line:index + 2,code:Number(match[2])}] : [];
  });
  if (expectedClock.length !== 21 || expectedClock.length !== (raw.match(/GAME_CLOCK_CASE/g) ?? []).length || new Set(expectedClock.map(item => item.name)).size !== expectedClock.length) throw new Error('Unclassified or duplicate clock negative fixture');
  const clockReceipts = expectedClock.map(expectedCase => {
    const atLocation = observedGeometry.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line);
    if (atLocation.length !== 1 || atLocation[0].code !== expectedCase.code) throw new Error(`Clock negative ${expectedCase.name}: expected one ${expectedCase.file}:${expectedCase.line} / TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
  });
  console.log('Clock individual unsuppressed diagnostic receipts: '+JSON.stringify(clockReceipts));

  // Tween additions keep every old aggregate and individual guard intact.
  const expectedTween = raw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/@ts-expect-error TWEEN_CASE ([\w-]+) TS(\d+)/);
    return match ? [{name:match[1],file:'tests/types/invalid.generated.ts',line:index + 2,code:Number(match[2])}] : [];
  });
  if (expectedTween.length !== 20 || expectedTween.length !== (raw.match(/TWEEN_CASE/g) ?? []).length || new Set(expectedTween.map(item=>item.name)).size !== 20) throw new Error('Unclassified or duplicate Tween negative fixture');
  const tweenReceipts = expectedTween.map(expectedCase => {
    const atLocation = observedGeometry.filter(actual=>actual.file===expectedCase.file&&actual.line===expectedCase.line);
    if (atLocation.length!==1 || atLocation[0].code!==expectedCase.code) throw new Error(`Tween negative ${expectedCase.name}: expected one ${expectedCase.file}:${expectedCase.line}/TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
  });
  console.log('Tween individual unsuppressed diagnostic receipts: '+JSON.stringify(tweenReceipts));

  console.log(`Type fixtures PASS: positive + ${expected} checked negative assertions (${count} actual compiler errors).`);
} finally {
  rmSync(invalid, { force: true });
  rmSync(invalidConfig, { force: true });
}

// Isolated absent exports cannot cascade through the main working declarations.
const texturedImportRaw = readFileSync(path.join(root, 'tests/types/textured-frame-import-negative.ts'), 'utf8');
const texturedImportInvalid = path.join(root, 'tests/types/textured-frame-import-invalid.generated.ts');
const texturedImportConfig = path.join(root, 'tests/types/textured-frame-import-invalid.generated.json');
const expectedTexturedImports = texturedImportRaw.split(/\r?\n/).flatMap((line, index) => {
  const match = line.match(/@ts-expect-error TEXTURED_FRAME_IMPORT_CASE ([\w-]+) TS(\d+)/);
  return match ? [{name:match[1],file:'tests/types/textured-frame-import-invalid.generated.ts',line:index + 2,code:Number(match[2])}] : [];
});
if (expectedTexturedImports.length !== 2 || expectedTexturedImports.length !== (texturedImportRaw.match(/@ts-expect-error/g) ?? []).length || expectedTexturedImports.length !== (texturedImportRaw.match(/TEXTURED_FRAME_IMPORT_CASE/g) ?? []).length || new Set(expectedTexturedImports.map(item => item.name)).size !== expectedTexturedImports.length || expectedTexturedImports.some(item => item.code !== 2305)) throw new Error('Unclassified or duplicate textured-frame import negative fixture');
try {
  writeFileSync(texturedImportInvalid, texturedImportRaw.replace(/^.*@ts-expect-error.*$/gm, ''));
  writeFileSync(texturedImportConfig, JSON.stringify({extends:'./tsconfig.json',include:['textured-frame-import-invalid.generated.ts']}));
  const check = spawnSync(process.execPath, [compiler, '--project', 'tests/types/textured-frame-import-invalid.generated.json', '--pretty', 'false'], {cwd:root,encoding:'utf8'});
  process.stdout.write(check.stdout ?? ''); process.stderr.write(check.stderr ?? '');
  if (check.error) throw check.error;
  const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match => ({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
  if (check.status === 0 || observed.length !== expectedTexturedImports.length) throw new Error(`Textured-frame import negatives expected ${expectedTexturedImports.length} actual diagnostics; got ${observed.length}`);
  const receipts = expectedTexturedImports.map(expectedCase => {
    const atLocation = observed.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line);
    if (atLocation.length !== 1 || atLocation[0].code !== expectedCase.code) throw new Error(`Textured-frame import ${expectedCase.name}: expected one ${expectedCase.file}:${expectedCase.line} / TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
  });
  console.log('Textured-frame import individual diagnostic receipts: '+JSON.stringify(receipts));
} finally {
  rmSync(texturedImportInvalid, {force:true});
  rmSync(texturedImportConfig, {force:true});
}
const texturedImportSuppressed = spawnSync(process.execPath, [compiler, '--project', 'tests/types/tsconfig.textured-frame-import-negative.json'], {cwd:root,encoding:'utf8'});
process.stdout.write(texturedImportSuppressed.stdout ?? ''); process.stderr.write(texturedImportSuppressed.stderr ?? '');
if (texturedImportSuppressed.error) throw texturedImportSuppressed.error;
if (texturedImportSuppressed.status !== 0) process.exit(texturedImportSuppressed.status ?? 1);

for (const config of ['tests/types/tsconfig.web.json', 'tests/types/tsconfig.dom-free.json']) {
  const check = spawnSync(process.execPath, [compiler, '--project', config], { cwd: root, encoding: 'utf8' });
  process.stdout.write(check.stdout ?? '');
  process.stderr.write(check.stderr ?? '');
  if (check.error) throw check.error;
  if (check.status !== 0) process.exit(check.status ?? 1);
}
console.log('Web consumer and DOM-free root consumer fixtures PASS.');
const webRaw = readFileSync(path.join(root, 'tests/types/web.ts'), 'utf8');
const webInvalid = path.join(root, 'tests/types/web-invalid.generated.ts');
const webConfig = path.join(root, 'tests/types/web-invalid.generated.json');
try {
  writeFileSync(webInvalid, webRaw.replace(/^.*@ts-expect-error.*\r?\n/gm, ''));
  writeFileSync(webConfig, JSON.stringify({extends:'./tsconfig.web.json',include:['web-invalid.generated.ts']}));
  const check = spawnSync(process.execPath, [compiler, '--project', webConfig], {cwd:root,encoding:'utf8'});
  if (check.error) throw check.error;
  process.stdout.write(check.stdout ?? '');
  const count = (check.stdout?.match(/error TS\d+:/g) ?? []).length;
  const expected = (webRaw.match(/@ts-expect-error/g) ?? []).length;
  if (check.status === 0 || count !== expected) throw Error(`Web negative fixture expected ${expected} actual diagnostics; got ${count}`);
  console.log(`Web negative fixtures PASS: ${count} actual diagnostics. Total negative assertions: ${(raw.match(/@ts-expect-error/g) ?? []).length + expected}.`);
} finally {
  rmSync(webInvalid,{force:true});rmSync(webConfig,{force:true});
}

const projectConfig = 'tests/types/tsconfig.project.json';
const projectPositive = spawnSync(process.execPath, [compiler, '--project', projectConfig], {cwd:root,encoding:'utf8'});
process.stdout.write(projectPositive.stdout ?? '');process.stderr.write(projectPositive.stderr ?? '');
if (projectPositive.error) throw projectPositive.error;
if (projectPositive.status !== 0) process.exit(projectPositive.status ?? 1);
const projectRaw = readFileSync(path.join(root,'tests/types/project-negative.ts'),'utf8');
const projectInvalid = path.join(root,'tests/types/project-invalid.generated.ts');
const projectInvalidConfig = path.join(root,'tests/types/project-invalid.generated.json');
const expectedProject = projectRaw.split(/\r?\n/).flatMap((line,index) => {
  const match = line.match(/@ts-expect-error PROJECT_CASE ([\w-]+) TS(\d+)/);
  return match ? [{name:match[1],line:index+2,code:Number(match[2])}] : [];
});
if (!expectedProject.length || expectedProject.length !== (projectRaw.match(/@ts-expect-error/g) ?? []).length) throw Error('Unclassified project negative fixture');
try {
  // Keep line endings/locations stable; only remove suppression comment content.
  writeFileSync(projectInvalid,projectRaw.replace(/^.*@ts-expect-error.*$/gm,''));
  writeFileSync(projectInvalidConfig,JSON.stringify({extends:'./tsconfig.project.json',include:['project-invalid.generated.ts']}));
  const check = spawnSync(process.execPath,[compiler,'--project','tests/types/project-invalid.generated.json','--pretty','false'],{cwd:root,encoding:'utf8'});
  process.stdout.write(check.stdout ?? '');process.stderr.write(check.stderr ?? '');
  if (check.error) throw check.error;
  const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
  if (check.status === 0 || observed.length !== expectedProject.length) throw Error(`Project negatives expected ${expectedProject.length} actual diagnostics; got ${observed.length}, exit ${check.status}`);
  for (const expected of expectedProject) {
    const matching=observed.filter(actual=>actual.file==='tests/types/project-invalid.generated.ts'&&actual.line===expected.line&&actual.code===expected.code);
    if(matching.length!==1)throw Error(`Project negative ${expected.name}: missing exact line ${expected.line} / TS${expected.code}`);
  }
  console.log(`Project type fixtures PASS: 29 type-only exports, six exact value signatures, ${observed.length} unsuppressed diagnostics with individual file/line/code checks.`);
  console.log('Project diagnostic locations: '+JSON.stringify(observed));
} finally {
  rmSync(projectInvalid,{force:true});rmSync(projectInvalidConfig,{force:true});
}

// The new GPU consumer is compiled separately through the existing DOM config.
// Its negative source has no suppression; location/code receipts are mandatory.
const texturedGPUPositiveConfig = path.join(root, 'tests/types/textured-webgpu-positive.generated.json');
const texturedGPUNegativeConfig = path.join(root, 'tests/types/textured-webgpu-negative.generated.json');
try {
  writeFileSync(texturedGPUPositiveConfig, JSON.stringify({extends:'./tsconfig.web.json',include:['textured-webgpu-positive.ts']}));
  const positive = spawnSync(process.execPath, [compiler, '--project', 'tests/types/textured-webgpu-positive.generated.json', '--pretty', 'false'], {cwd:root,encoding:'utf8'});
  process.stdout.write(positive.stdout ?? ''); process.stderr.write(positive.stderr ?? '');
  if (positive.error) throw positive.error;
  if (positive.status !== 0) throw new Error(`Textured GPU positive consumer failed: exit ${positive.status}`);
  const file = 'tests/types/textured-webgpu-negative.ts';
  const negative = readFileSync(path.join(root, file), 'utf8');
  if (/@ts-(?:expect-error|ignore|nocheck)/.test(negative)) throw new Error('Textured GPU negative source contains suppression');
  const expected = negative.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^\/\/ TEXTURED_GPU_CASE ([\w-]+) TS(\d+)$/);
    return match ? [{name:match[1],file,line:index+2,code:Number(match[2])}] : [];
  });
  if (expected.length !== 19 || new Set(expected.map(item => item.name)).size !== expected.length) throw new Error('Textured GPU negative case inventory mismatch');
  writeFileSync(texturedGPUNegativeConfig, JSON.stringify({extends:'./tsconfig.web.json',include:['textured-webgpu-negative.ts']}));
  const check = spawnSync(process.execPath, [compiler, '--project', 'tests/types/textured-webgpu-negative.generated.json', '--pretty', 'false'], {cwd:root,encoding:'utf8'});
  process.stdout.write(check.stdout ?? ''); process.stderr.write(check.stderr ?? '');
  if (check.error) throw check.error;
  const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match => ({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
  if (check.status !== 1 || observed.length !== expected.length) throw new Error(`Textured GPU negatives expected ${expected.length} actual diagnostics, exit 1; got ${observed.length}, exit ${check.status}`);
  const receipts = expected.map(item => {
    const matching = observed.filter(actual => actual.file === item.file && actual.line === item.line);
    if (matching.length !== 1 || matching[0].code !== item.code) throw new Error(`Textured GPU negative ${item.name}: expected one ${item.file}:${item.line} / TS${item.code}; got ${JSON.stringify(matching)}`);
    return {name:item.name,expected:item,actual:matching[0]};
  });
  console.log('Textured GPU positive consumer PASS: exact new options, factory, port, literal, readonly nested status; unchanged legacy signatures.');
  console.log('Textured GPU individual unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
} finally {
  rmSync(texturedGPUPositiveConfig, {force:true});
  rmSync(texturedGPUNegativeConfig, {force:true});
}
// T1 explicit-entry fixtures supplement every existing compiler check above.
// Positives and ordinary misuses compile with ES2022 only; existing DOM entry
// absence trials remain isolated under the existing web configuration.
const textTypeConfigs=[];
try {
  for (const [name,source,base,expectedCount,marker] of [
    ['positive','text-raster-positive.ts','tsconfig.dom-free.json',0,null],
    ['negative','text-raster-negative.ts','tsconfig.dom-free.json',18,'TEXT_RASTER_CASE'],
    ['imports','text-raster-import-negative.ts','tsconfig.web.json',9,'TEXT_RASTER_IMPORT_CASE'],
  ]) {
    const file='tests/types/'+source;
    const fixture=readFileSync(path.join(root,file),'utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('Text raster fixture contains suppression: '+file);
    const expected=marker ? fixture.split(/\r?\n/).flatMap((line,index)=>{
      const match=line.match(new RegExp('^// '+marker+' ([\\w-]+) TS(\\d+)$'));
      return match ? [{name:match[1],file,line:index+2,code:Number(match[2])}] : [];
    }) : [];
    if (expected.length!==expectedCount || new Set(expected.map(item=>item.name)).size!==expectedCount) throw new Error('Text raster diagnostic inventory mismatch: '+file);
    const config='tests/types/text-raster-'+name+'.generated.json';textTypeConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./'+base,include:[source]}));
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8'});
    process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.error)throw check.error;
    if (!marker) { if(check.status!==0)throw new Error('Text raster DOM-free positive consumer failed: exit '+check.status);continue; }
    const observed=[...(check.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
    if(check.status!==1 || observed.length!==expectedCount)throw new Error(`Text raster ${name} expected ${expectedCount} diagnostics, exit 1; got ${observed.length}, exit ${check.status}`);
    const receipts=expected.map(item=>{
      const found=observed.filter(actual=>actual.file===item.file&&actual.line===item.line);
      if(found.length!==1||found[0].code!==item.code)throw new Error(`Text raster ${item.name}: expected one ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return {name:item.name,expected:item,actual:found[0]};
    });
    console.log('Text raster '+name+' individual unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('Text raster fixtures PASS: exact explicit-entry DOM-free positive consumer, 18 ordinary and 9 isolated import/value diagnostics.');
} finally { for(const config of textTypeConfigs)rmSync(config,{force:true}); }

// Fixed isolated absent-clock imports supplement the retained import policies.
const clockImportFile = 'tests/types/game-clock-import-negative.ts';
const clockImportSource = readFileSync(path.join(root, clockImportFile), 'utf8');
if (/@ts-(?:expect-error|ignore|nocheck)/.test(clockImportSource)) throw new Error('Clock import fixture contains suppression');
const expectedClockImports = clockImportSource.split(/\r?\n/).flatMap((line,index) => {
  const match = line.match(/^\/\/ GAME_CLOCK_IMPORT_CASE ([\w-]+) TS(\d+)$/);
  return match ? [{name:match[1],file:clockImportFile,line:index+2,code:Number(match[2])}] : [];
});
if (expectedClockImports.length !== 10 || new Set(expectedClockImports.map(item=>item.name)).size !== 10) throw new Error('Clock import diagnostic inventory mismatch');
const clockImportCheck = spawnSync(process.execPath, [compiler,'--project','tests/types/tsconfig.game-clock-import-negative.json','--pretty','false'], {cwd:root,encoding:'utf8'});
process.stdout.write(clockImportCheck.stdout ?? ''); process.stderr.write(clockImportCheck.stderr ?? '');
if (clockImportCheck.error) throw clockImportCheck.error;
const observedClockImports = [...(clockImportCheck.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
if (clockImportCheck.status !== 1 || observedClockImports.length !== 10) throw new Error(`Clock imports expected 10 diagnostics, exit 1; got ${observedClockImports.length}, exit ${clockImportCheck.status}`);
const clockImportReceipts = expectedClockImports.map(expectedCase => {
  const atLocation = observedClockImports.filter(actual=>actual.file===expectedCase.file&&actual.line===expectedCase.line);
  if (atLocation.length!==1 || atLocation[0].code!==expectedCase.code) throw new Error(`Clock import ${expectedCase.name}: expected one ${expectedCase.file}:${expectedCase.line}/TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
  return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
});
console.log('Clock import individual unsuppressed diagnostic receipts: '+JSON.stringify(clockImportReceipts));

// Fixed isolated Tween imports supplement the unchanged absence policies.
const tweenImportFile = 'tests/types/tween-import-negative.ts';
const tweenImportSource = readFileSync(path.join(root,tweenImportFile),'utf8');
if (/@ts-(?:expect-error|ignore|nocheck)/.test(tweenImportSource)) throw new Error('Tween import fixture contains suppression');
const expectedTweenImports = tweenImportSource.split(/\r?\n/).flatMap((line,index)=>{
  const match=line.match(/^\/\/ TWEEN_IMPORT_CASE ([\w-]+) TS(\d+)$/);
  return match ? [{name:match[1],file:tweenImportFile,line:index+2,code:Number(match[2])}] : [];
});
if (expectedTweenImports.length!==11 || new Set(expectedTweenImports.map(item=>item.name)).size!==11) throw new Error('Tween import diagnostic inventory mismatch');
const tweenImportCheck = spawnSync(process.execPath,[compiler,'--project','tests/types/tsconfig.tween-import-negative.json','--pretty','false'],{cwd:root,encoding:'utf8'});
process.stdout.write(tweenImportCheck.stdout ?? ''); process.stderr.write(tweenImportCheck.stderr ?? '');
if(tweenImportCheck.error)throw tweenImportCheck.error;
const observedTweenImports=[...(tweenImportCheck.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
if(tweenImportCheck.status!==1 || observedTweenImports.length!==11)throw new Error(`Tween imports expected 11 diagnostics, exit 1; got ${observedTweenImports.length}, exit ${tweenImportCheck.status}`);
const tweenImportReceipts=expectedTweenImports.map(expectedCase=>{
  const atLocation=observedTweenImports.filter(actual=>actual.file===expectedCase.file&&actual.line===expectedCase.line);
  if(atLocation.length!==1 || atLocation[0].code!==expectedCase.code)throw new Error(`Tween import ${expectedCase.name}: expected one ${expectedCase.file}:${expectedCase.line}/TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
  return {name:expectedCase.name,expected:expectedCase,actual:atLocation[0]};
});
console.log('Tween import individual unsuppressed diagnostic receipts: '+JSON.stringify(tweenImportReceipts));

// TF1 supplements every retained diagnostic, with predictions frozen in source.
const fieldTypeConfigs=[];
try {
  for(const [name,source,base,count,marker] of [
    ['positive','text-field-positive.ts','tsconfig.dom-free.json',0,null],
    ['negative','text-field-negative.ts','tsconfig.dom-free.json',18,'TEXT_FIELD_CASE'],
    ['supplement','text-field-supplement-negative.ts','tsconfig.dom-free.json',4,'TEXT_FIELD_SUPPLEMENT_CASE'],
    ['imports','text-field-import-negative.ts','tsconfig.web.json',12,'TEXT_FIELD_IMPORT_CASE'],
  ]) {
    const file='tests/types/'+source,fixture=readFileSync(path.join(root,file),'utf8');
    if(/@ts-(?:expect-error|ignore|nocheck)/.test(fixture))throw new Error('TextField fixture contains suppression: '+file);
    const expected=marker?fixture.split(/\r?\n/).flatMap((line,index)=>{
      const match=line.match(new RegExp('^// '+marker+' ([\\w-]+) TS(\\d+)$'));
      return match?[{name:match[1],file,line:index+2,code:Number(match[2])}]:[];
    }):[];
    if(expected.length!==count||new Set(expected.map(item=>item.name)).size!==count)throw new Error('TextField diagnostic inventory mismatch: '+file);
    const config='tests/types/text-field-'+name+'.generated.json';fieldTypeConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./'+base,include:[source]}));
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8'});
    process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.error)throw check.error;
    if(!marker){if(check.status!==0)throw new Error('TextField DOM-free positive consumer failed');continue;}
    const observed=[...(check.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
    if(check.status!==1||observed.length!==count)throw new Error(`TextField ${name}: expected ${count} diagnostics/exit 1; got ${observed.length}/exit ${check.status}`);
    const receipts=expected.map(item=>{
      const found=observed.filter(actual=>actual.file===item.file&&actual.line===item.line);
      if(found.length!==1||found[0].code!==item.code)throw new Error(`TextField ${item.name}: expected ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return {name:item.name,expected:item,actual:found[0]};
    });
    console.log('TextField '+name+' individual unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('TextField fixtures PASS: DOM/Node-free positive, 18 ordinary, 4 supplemental and 12 dedicated-file import location diagnostics.');
} finally {for(const config of fieldTypeConfigs)rmSync(config,{force:true});}


// BR1 consumes the frozen R2 public consumers under the existing DOM-free
// strict baseline; every previous compiler/diagnostic check stays above intact.
const byteReaderTypeConfigs = [];
try {
  for (const [name, source, count, marker] of [
    ['positive', 'byte-reader-positive.ts', 0, null],
    ['negative', 'byte-reader-negative.ts', 18, 'BYTE_READER_CASE'],
  ]) {
    const file = 'tests/types/' + source, fixture = readFileSync(path.join(root, file), 'utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('ByteReader fixture contains suppression: ' + file);
    const expected = marker ? fixture.split(/\r?\n/).flatMap((line, index) => {
      const match = line.match(/^\/\/ BYTE_READER_CASE ([\w-]+) TS(\d+)$/);
      return match ? [{name:match[1], file, line:index + 2, code:Number(match[2])}] : [];
    }) : [];
    if (expected.length !== count || new Set(expected.map(item => item.name)).size !== count
        || (marker && (fixture.match(/\bBYTE_READER_CASE\b/g) ?? []).length !== count)) throw new Error('ByteReader diagnostic inventory mismatch: ' + file);
    const config = 'tests/types/byte-reader-' + name + '.generated.json';
    byteReaderTypeConfigs.push(path.join(root, config));
    writeFileSync(path.join(root, config), JSON.stringify({extends:'./tsconfig.dom-free.json', include:[source]}));
    const check = spawnSync(process.execPath, [compiler, '--project', config, '--pretty', 'false'], {cwd:root, encoding:'utf8'});
    process.stdout.write(check.stdout ?? ''); process.stderr.write(check.stderr ?? '');
    if (check.error) throw check.error;
    if (!marker) {
      if (check.status !== 0) throw new Error('ByteReader DOM-free positive consumer failed: exit ' + check.status);
      continue;
    }
    const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match => ({file:match[1].replaceAll('\\','/'), line:Number(match[2]), column:Number(match[3]), code:Number(match[4])}));
    if (check.status !== 1 || observed.length !== count) throw new Error(`ByteReader negatives expected ${count} diagnostics/exit 1; got ${observed.length}/exit ${check.status}`);
    // Total count cannot award a case: require its sole actual diagnostic at
    // the unchanged consumer filename/line and its frozen R2 prediction code.
    const receipts = expected.map(item => {
      const found = observed.filter(actual => actual.file === item.file && actual.line === item.line);
      if (found.length !== 1 || found[0].code !== item.code) throw new Error(`ByteReader ${item.name}: expected one ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return {name:item.name, expected:item, actual:found[0]};
    });
    console.log('ByteReader individual unsuppressed diagnostic receipts: ' + JSON.stringify(receipts));
  }
  console.log('ByteReader fixtures PASS: frozen DOM/Node-free public positive consumer and 18 exact file/line/code unsuppressed negatives.');
} finally { for (const config of byteReaderTypeConfigs) rmSync(config, {force:true}); }

// WC1 predictions are source-authored before compilation. Existing checks above
// keep their exact fixtures, counts and refusal reasons.
const canvasTextConfigs=[];
try {
  for(const [name,source,base,count,marker] of [
    ['positive','canvas-text-provider-positive.ts','tsconfig.dom-free.json',0,null],
    ['negative','canvas-text-provider-negative.ts','tsconfig.web.json',12,'CANVAS_TEXT_CASE'],
    ['imports','canvas-text-provider-import-negative.ts','tsconfig.web.json',8,'CANVAS_TEXT_IMPORT_CASE'],
  ]) {
    const file='tests/types/'+source,fixture=readFileSync(path.join(root,file),'utf8');
    if(/@ts-(?:expect-error|ignore|nocheck)/.test(fixture))throw new Error('Canvas text fixture contains suppression: '+file);
    const expected=marker?fixture.split(/\r?\n/).flatMap((line,index)=>{
      const match=line.match(new RegExp('^// '+marker+' ([\\w-]+) TS(\\d+)$'));
      return match?[{name:match[1],file,line:index+2,code:Number(match[2])}]:[];
    }):[];
    if(expected.length!==count||new Set(expected.map(item=>item.name)).size!==count
        || (marker && (fixture.match(new RegExp('\\b'+marker+'\\b','g'))??[]).length!==count)) throw new Error('Canvas text diagnostic inventory mismatch: '+file);
    const config='tests/types/canvas-text-provider-'+name+'.generated.json';canvasTextConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./'+base,include:[source]}));
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8'});
    process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.error)throw check.error;
    if(!marker){if(check.status!==0)throw new Error('Canvas text DOM-free signature consumer failed');continue;}
    const observed=[...(check.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
    if(check.status!==1||observed.length!==count)throw new Error(`Canvas text ${name}: expected ${count} diagnostics/exit 1; got ${observed.length}/exit ${check.status}`);
    const receipts=expected.map(item=>{
      const found=observed.filter(actual=>actual.file===item.file&&actual.line===item.line);
      if(found.length!==1||found[0].code!==item.code)throw new Error(`Canvas text ${item.name}: expected ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return {name:item.name,expected:item,actual:found[0]};
    });
    console.log('Canvas text '+name+' individual unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('Canvas text fixtures PASS: DOM-free public signature, 12 ordinary diagnostics and 8 dedicated-file exact-location diagnostics in one invocation (file/line/code).');
} finally {for(const config of canvasTextConfigs)rmSync(config,{force:true});}

// HT1 expectations are authored in unsuppressed consumer fixtures before the
// compiler runs; each diagnostic must bind to its own file, line and code.
const hitTestConfigs = [];
try {
  for (const [name, source, base, count, marker] of [
    ['positive', 'hit-test-positive.ts', 'tsconfig.dom-free.json', 0, null],
    ['negative', 'hit-test-negative.ts', 'tsconfig.dom-free.json', 16, 'HIT_TEST_CASE'],
    ['imports', 'hit-test-import-negative.ts', 'tsconfig.web.json', 8, 'HIT_TEST_IMPORT_CASE'],
  ]) {
    const file = 'tests/types/' + source, fixture = readFileSync(path.join(root, file), 'utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('Hit-test fixture contains suppression: ' + file);
    const expected = marker ? fixture.split(/\r?\n/).flatMap((line, index) => {
      const match = line.match(new RegExp('^// ' + marker + ' ([\\w-]+) TS(\\d+)$'));
      return match ? [{ name: match[1], file, line: index + 2, code: Number(match[2]) }] : [];
    }) : [];
    if (expected.length !== count || new Set(expected.map(item => item.name)).size !== count
        || (marker && (fixture.match(new RegExp('\\b' + marker + '\\b', 'g')) ?? []).length !== count)) throw new Error('Hit-test diagnostic inventory mismatch: ' + file);
    const config = 'tests/types/hit-test-' + name + '.generated.json';
    hitTestConfigs.push(path.join(root, config));
    writeFileSync(path.join(root, config), JSON.stringify({ extends: './' + base, include: [source] }));
    const check = spawnSync(process.execPath, [compiler, '--project', config, '--pretty', 'false'], { cwd: root, encoding: 'utf8' });
    process.stdout.write(check.stdout ?? ''); process.stderr.write(check.stderr ?? '');
    if (check.error) throw check.error;
    if (!marker) { if (check.status !== 0) throw new Error('Hit-test DOM-free positive consumer failed: exit ' + check.status); continue; }
    const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)]
      .map(match => ({ file: match[1].replaceAll('\\', '/'), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]) }));
    if (check.status !== 1 || observed.length !== count) throw new Error(`Hit-test ${name}: expected ${count} diagnostics/exit 1; got ${observed.length}/exit ${check.status}`);
    const receipts = expected.map(item => {
      const found = observed.filter(actual => actual.file === item.file && actual.line === item.line);
      if (found.length !== 1 || found[0].code !== item.code) throw new Error(`Hit-test ${item.name}: expected ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return { name: item.name, expected: item, actual: found[0] };
    });
    console.log('Hit-test ' + name + ' individual unsuppressed diagnostic receipts: ' + JSON.stringify(receipts));
  }
  console.log('Hit-test fixtures PASS: DOM-free public positive consumer, 16 ordinary and 8 import negatives bound to exact file/line/code.');
} finally { for (const config of hitTestConfigs) rmSync(config, { force: true }); }

// RG1_TYPES_BEGIN
// Codes and exact source lines below are primary observations from the frozen
// unsuppressed RG1 consumer probe, not guessed diagnostic totals. Keep the
// misuse fixtures unchanged and refuse extra/missing/unrelated diagnostics.
const assetGroupDiagnosticCases = {
  negative: [
    ['required-private-brand', 8, 2741], ['homogeneous-invariant-input', 10, 2322],
    ['invariant-group-result', 12, 2322], ['required-arguments', 14, 2554],
    ['required-refs', 16, 2554], ['genuine-scope-type', 18, 2739],
    ['ref-type', 20, 2322], ['array-type', 22, 2740],
    ['numeric-concurrency', 24, 2322], ['options-shape', 26, 2559],
    ['readonly-state', 28, 2540], ['readonly-members', 30, 2339],
    ['group-type-only', 32, 2693], ['state-type-only', 34, 2693], ['options-type-only', 36, 2693],
  ],
  imports: [
    ['no-root-factory', 2, 2724], ['no-root-owner', 4, 2305],
    ['no-root-brand', 6, 2724], ['no-root-assembly-port', 8, 2724],
    ['no-runtime-group', 10, 2305], ['no-runtime-state', 12, 2305],
    ['no-runtime-options', 14, 2724], ['no-runtime-factory', 16, 2724],
    ['no-runtime-owner-lookup', 18, 2305], ['no-group-subpath', 20, 2307], ['no-private-module', 22, 2307],
  ],
};
const assetGroupTypeConfigs = [];
try {
  for (const [name, source, marker] of [
    ['positive', 'asset-group-positive.ts', null],
    ['negative', 'asset-group-negative.ts', 'ASSET_GROUP_CASE'],
    ['imports', 'asset-group-import-negative.ts', 'ASSET_GROUP_IMPORT_CASE'],
  ]) {
    const file = 'tests/types/' + source, fixture = readFileSync(path.join(root, file), 'utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('AssetGroup fixture contains suppression: ' + file);
    const expected = marker ? assetGroupDiagnosticCases[name].map(([caseName, line, code]) => ({ name: caseName, file, line, code })) : [];
    const declared = marker ? fixture.split(/\r?\n/).flatMap((line, index) => {
      const match = line.match(new RegExp('^// ' + marker + ' ([\\w-]+)$'));
      return match ? [{ name: match[1], line: index + 2 }] : [];
    }) : [];
    if (declared.length !== expected.length || new Set(declared.map(item => item.name)).size !== expected.length
        || (marker && (fixture.match(new RegExp('\\b' + marker + '\\b', 'g')) ?? []).length !== expected.length)
        || expected.some((item, index) => declared[index]?.name !== item.name || declared[index]?.line !== item.line))
      throw new Error('AssetGroup exact source diagnostic inventory mismatch: ' + file);
    const config = 'tests/types/asset-group-' + name + '.generated.json';
    assetGroupTypeConfigs.push(path.join(root, config));
    writeFileSync(path.join(root, config), JSON.stringify({ extends: './tsconfig.dom-free.json', include: [source] }));
    const check = spawnSync(process.execPath, [compiler, '--project', config, '--pretty', 'false'], {
      cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    process.stdout.write(check.stdout ?? ''); process.stderr.write(check.stderr ?? '');
    if (check.error) throw check.error;
    if (!marker) { if (check.status !== 0) throw new Error('AssetGroup DOM-free public positive consumer failed: exit ' + check.status); continue; }
    const observed = [...(check.stdout ?? '').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)]
      .map(match => ({ file: match[1].replaceAll('\\', '/'), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]) }));
    if (check.status !== 1 || observed.length !== expected.length)
      throw new Error(`AssetGroup ${name}: expected ${expected.length} diagnostics/exit 1; got ${observed.length}/exit ${check.status}`);
    const receipts = expected.map(item => {
      const found = observed.filter(actual => actual.file === item.file && actual.line === item.line);
      if (found.length !== 1 || found[0].code !== item.code)
        throw new Error(`AssetGroup ${item.name}: expected ${item.file}:${item.line}/TS${item.code}; got ${JSON.stringify(found)}`);
      return { name: item.name, expected: item, actual: found[0] };
    });
    console.log('AssetGroup ' + name + ' individual unsuppressed diagnostic receipts: ' + JSON.stringify(receipts));
  }
  console.log('AssetGroup fixtures PASS: DOM-free public positive consumer, 15 ordinary and 11 import negatives bound to exact source/file/line/code.');
} finally { for (const config of assetGroupTypeConfigs) rmSync(config, { force: true }); }
// RG1_TYPES_END
// S3D1_TYPES_BEGIN
// This gate intentionally refuses pending predictions. Exact diagnostics are
// populated only from a separate actual pinned TS7 probe after genuine ports.
const {createHash:sceneTypeHash}=await import('node:crypto');
const sceneTypeDigest=file=>sceneTypeHash('sha256').update(readFileSync(path.join(root,file))).digest('hex');
const sceneTypeExpectations=JSON.parse(readFileSync(path.join(root,'tests/types/scene3d-diagnostic-expectations.json'),'utf8'));
const sceneTypeCompiler=JSON.parse(readFileSync(path.join(root,'node_modules/typescript/package.json'),'utf8'));
if (sceneTypeExpectations.schemaVersion!==1 || sceneTypeExpectations.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS')
  throw new Error('S3D1 types: actual TS7 diagnostic expectations are not frozen; run the independent unsuppressed probes before final acceptance');
if (sceneTypeCompiler.version!=='7.0.2' || sceneTypeExpectations.compiler?.version!=='7.0.2'
    || sceneTypeExpectations.compiler?.tscSHA256!==sceneTypeDigest('node_modules/typescript/bin/tsc')
    || sceneTypeExpectations.compiler?.packageSHA256!==sceneTypeDigest('node_modules/typescript/package.json'))
  throw new Error('S3D1 types: exact observed compiler identity mismatch');
// Only this independently observed current declaration closure succeeds the
// historical S3D1 DOM-negative table; all five other lanes retain their tables.
const sceneDomM13Successor = {"schemaVersion":1,"lane":"web-dom-free-negative","compilerVersion":"7.0.2","closure":[{"owner":"compiler-native","path":"lib/lib.es5.d.ts","bytes":218947,"sha256":"6388847232654d7fcbed7fe89ea511a65ad1f5104b41e905c43f90910e1408b6"},{"owner":"compiler-native","path":"lib/lib.es2015.d.ts","bytes":1202,"sha256":"3f88bedbeb09c6f5a6645cb24c7c55f1aa22d19ae96c8e6959cbd8b85a707bc6"},{"owner":"compiler-native","path":"lib/lib.es2016.d.ts","bytes":926,"sha256":"7fe93b39b810eadd916be8db880dd7f0f7012a5cc6ffb62de8f62a2117fa6f1f"},{"owner":"compiler-native","path":"lib/lib.es2017.d.ts","bytes":1123,"sha256":"bb0074cc08b84a2374af33d8bf044b80851ccc9e719a5e202eacf40db2c31600"},{"owner":"compiler-native","path":"lib/lib.es2018.d.ts","bytes":1049,"sha256":"1a7daebe4f45fb03d9ec53d60008fbf9ac45a697fdc89e4ce218bc94b94f94d6"},{"owner":"compiler-native","path":"lib/lib.es2019.d.ts","bytes":1032,"sha256":"f94b133a3cb14a288803be545ac2683e0d0ff6661bcd37e31aaaec54fc382aed"},{"owner":"compiler-native","path":"lib/lib.es2020.d.ts","bytes":1162,"sha256":"f59d0650799f8782fd74cf73c19223730c6d1b9198671b1c5b3a38e1188b5953"},{"owner":"compiler-native","path":"lib/lib.es2021.d.ts","bytes":997,"sha256":"8a15b4607d9a499e2dbeed9ec0d3c0d7372c850b2d5f1fb259e8f6d41d468a84"},{"owner":"compiler-native","path":"lib/lib.es2022.d.ts","bytes":1069,"sha256":"26e0fe14baee4e127f4365d1ae0b276f400562e45e19e35fd2d4c296684715e6"},{"owner":"compiler-native","path":"lib/lib.es2015.core.d.ts","bytes":22821,"sha256":"770011bd32a52f929fc98fbf9976c1fa9d80b6445171c02b08627fdba9778933"},{"owner":"compiler-native","path":"lib/lib.es2015.collection.d.ts","bytes":5627,"sha256":"f0b6b1d3624fb143656dd86a8dd3e1950b7e65f218319b47bde52f65d47e2e4b"},{"owner":"compiler-native","path":"lib/lib.es2015.generator.d.ts","bytes":2518,"sha256":"00343ca5b2e3d48fa5df1db6e32ea2a59afab09590274a6cccb1dbae82e60c7c"},{"owner":"compiler-native","path":"lib/lib.es2015.iterable.d.ts","bytes":18185,"sha256":"ebd9f816d4002697cb2864bea1f0b70a103124e18a8cd9645eeccc09bdf80ab4"},{"owner":"compiler-native","path":"lib/lib.es2015.promise.d.ts","bytes":3161,"sha256":"2c1afac30a01772cd2a9a298a7ce7706b5892e447bb46bdbeef720f7b5da77ad"},{"owner":"compiler-native","path":"lib/lib.es2015.proxy.d.ts","bytes":5212,"sha256":"7b0225f483e4fa685625ebe43dd584bb7973bbd84e66a6ba7bbe175ee1048b4f"},{"owner":"compiler-native","path":"lib/lib.es2015.reflect.d.ts","bytes":6454,"sha256":"c0a4b8ac6ce74679c1da2b3795296f5896e31c38e888469a8e0f99dc3305de60"},{"owner":"compiler-native","path":"lib/lib.es2015.symbol.d.ts","bytes":1608,"sha256":"83e3871cda2abd4421970fa923cca51a9ce8cdbece6f898285643ab030cb80f3"},{"owner":"compiler-native","path":"lib/lib.es2015.symbol.wellknown.d.ts","bytes":10971,"sha256":"c5079c53f0f141a0698faa903e76cb41cd664e3efb01cc17a5c46ec2eb0bef42"},{"owner":"compiler-native","path":"lib/lib.es2016.array.include.d.ts","bytes":5165,"sha256":"32cafbc484dea6b0ab62cf8473182bbcb23020d70845b406f80b7526f38ae862"},{"owner":"compiler-native","path":"lib/lib.es2016.intl.d.ts","bytes":1445,"sha256":"fca4cdcb6d6c5ef18a869003d02c9f0fd95df8cfaf6eb431cd3376bc034cad36"},{"owner":"compiler-native","path":"lib/lib.es2017.arraybuffer.d.ts","bytes":876,"sha256":"b93ec88115de9a9dc1b602291b85baf825c85666bf25985cc5f698073892b467"},{"owner":"compiler-native","path":"lib/lib.es2017.date.d.ts","bytes":1877,"sha256":"f5c06dcc3fe849fcb297c247865a161f995cc29de7aa823afdd75aaaddc1419b"},{"owner":"compiler-native","path":"lib/lib.es2017.object.d.ts","bytes":2434,"sha256":"b77e16112127a4b169ef0b8c3a4d730edf459c5f25fe52d5e436a6919206c4d7"},{"owner":"compiler-native","path":"lib/lib.es2017.sharedmemory.d.ts","bytes":7170,"sha256":"fbffd9337146eff822c7c00acbb78b01ea7ea23987f6c961eba689349e744f8c"},{"owner":"compiler-native","path":"lib/lib.es2017.string.d.ts","bytes":2540,"sha256":"6aaeba1e4f228fda4e9175e34d96807e2c6dc984d0b37a772b3af9365a456681"},{"owner":"compiler-native","path":"lib/lib.es2017.intl.d.ts","bytes":1410,"sha256":"c7b3542146734342e440a84b213384bfa188835537ddbda50d30766f0593aff9"},{"owner":"compiler-native","path":"lib/lib.es2017.typedarrays.d.ts","bytes":1503,"sha256":"ce6180fa19b1cccd07ee7f7dbb9a367ac19c0ed160573e4686425060b6df7f57"},{"owner":"compiler-native","path":"lib/lib.es2018.asyncgenerator.d.ts","bytes":2653,"sha256":"3f02e2476bccb9dbe21280d6090f0df17d2f66b74711489415a8aa4df73c9675"},{"owner":"compiler-native","path":"lib/lib.es2018.asynciterable.d.ts","bytes":2218,"sha256":"45e3ab34c1c013c8ab2dc1ba4c80c780744b13b5676800ae2e3be27ae862c40c"},{"owner":"compiler-native","path":"lib/lib.es2018.intl.d.ts","bytes":2982,"sha256":"805c86f6cca8d7702a62a844856dbaa2a3fd2abef0536e65d48732441dde5b5b"},{"owner":"compiler-native","path":"lib/lib.es2018.promise.d.ts","bytes":1314,"sha256":"e42e397f1a5a77994f0185fd1466520691456c772d06bf843e5084ceb879a0ad"},{"owner":"compiler-native","path":"lib/lib.es2018.regexp.d.ts","bytes":1193,"sha256":"f4c2b41f90c95b1c532ecc874bd3c111865793b23aebcc1c3cbbabcd5d76ffb0"},{"owner":"compiler-native","path":"lib/lib.es2019.array.d.ts","bytes":3124,"sha256":"ab26191cfad5b66afa11b8bf935ef1cd88fabfcb28d30b2dfa6fad877d050332"},{"owner":"compiler-native","path":"lib/lib.es2019.object.d.ts","bytes":1434,"sha256":"2088bc26531e38fb05eedac2951480db5309f6be3fa4a08d2221abb0f5b4200d"},{"owner":"compiler-native","path":"lib/lib.es2019.string.d.ts","bytes":1489,"sha256":"cb9d366c425fea79716a8fb3af0d78e6b22ebbab3bd64d25063b42dc9f531c1e"},{"owner":"compiler-native","path":"lib/lib.es2019.symbol.d.ts","bytes":967,"sha256":"500934a8089c26d57ebdb688fc9757389bb6207a3c8f0674d68efa900d2abb34"},{"owner":"compiler-native","path":"lib/lib.es2019.intl.d.ts","bytes":919,"sha256":"689da16f46e647cef0d64b0def88910e818a5877ca5379ede156ca3afb780ac3"},{"owner":"compiler-native","path":"lib/lib.es2020.bigint.d.ts","bytes":38258,"sha256":"bc21cc8b6fee4f4c2440d08035b7ea3c06b3511314c8bab6bef7a92de58a2593"},{"owner":"compiler-native","path":"lib/lib.es2020.date.d.ts","bytes":2917,"sha256":"7ca53d13d2957003abb47922a71866ba7cb2068f8d154877c596d63c359fed25"},{"owner":"compiler-native","path":"lib/lib.es2020.promise.d.ts","bytes":1764,"sha256":"54725f8c4df3d900cb4dac84b64689ce29548da0b4e9b7c2de61d41c79293611"},{"owner":"compiler-native","path":"lib/lib.es2020.sharedmemory.d.ts","bytes":5089,"sha256":"e5594bc3076ac29e6c1ebda77939bc4c8833de72f654b6e376862c0473199323"},{"owner":"compiler-native","path":"lib/lib.es2020.string.d.ts","bytes":2451,"sha256":"2f3eb332c2d73e729f3364fcc0c2b375e72a121e8157d25a82d67a138c83a95c"},{"owner":"compiler-native","path":"lib/lib.es2020.symbol.wellknown.d.ts","bytes":1566,"sha256":"6f4427f9642ce8d500970e4e69d1397f64072ab73b97e476b4002a646ac743b1"},{"owner":"compiler-native","path":"lib/lib.es2020.intl.d.ts","bytes":22394,"sha256":"db839fa0625981ae6e20a55e079c3613184310ca246879245b294573e7cc6926"},{"owner":"compiler-native","path":"lib/lib.es2020.number.d.ts","bytes":1548,"sha256":"b7bf9377723203b5a6a4b920164df22d56a43f593269ba6ae1fdc97774b68855"},{"owner":"compiler-native","path":"lib/lib.es2021.promise.d.ts","bytes":2223,"sha256":"db9709688f82c9e5f65a119c64d835f906efe5f559d08b11642d56eb85b79357"},{"owner":"compiler-native","path":"lib/lib.es2021.string.d.ts","bytes":1553,"sha256":"4b25b8c874acd1a4cf8444c3617e037d444d19080ac9f634b405583fd10ce1f7"},{"owner":"compiler-native","path":"lib/lib.es2021.weakref.d.ts","bytes":3132,"sha256":"37be57d7c90cf1f8112ee2636a068d8fd181289f82b744160ec56a7dc158a9f5"},{"owner":"compiler-native","path":"lib/lib.es2021.intl.d.ts","bytes":8206,"sha256":"a917a49ac94cd26b754ab84e113369a75d1a47a710661d7cd25e961cc797065f"},{"owner":"compiler-native","path":"lib/lib.es2022.array.d.ts","bytes":4637,"sha256":"6d3261badeb7843d157ef3e6f5d1427d0eeb0af0cf9df84a62cfd29fd47ac86e"},{"owner":"compiler-native","path":"lib/lib.es2022.error.d.ts","bytes":2340,"sha256":"195daca651dde22f2167ac0d0a05e215308119a3100f5e6268e8317d05a92526"},{"owner":"compiler-native","path":"lib/lib.es2022.intl.d.ts","bytes":7653,"sha256":"8b11e4285cd2bb164a4dc09248bdec69e9842517db4ca47c1ba913011e44ff2f"},{"owner":"compiler-native","path":"lib/lib.es2022.object.d.ts","bytes":1046,"sha256":"0508571a52475e245b02bc50fa1394065a0a3d05277fbf5120c3784b85651799"},{"owner":"compiler-native","path":"lib/lib.es2022.string.d.ts","bytes":1116,"sha256":"8f9af488f510c3015af3cc8c267a9e9d96c4dd38a1fdff0e11dc5a544711415b"},{"owner":"compiler-native","path":"lib/lib.es2022.regexp.d.ts","bytes":1304,"sha256":"fc611fea8d30ea72c6bbfb599c9b4d393ce22e2f5bfef2172534781e7d138104"},{"owner":"compiler-native","path":"lib/lib.decorators.d.ts","bytes":13153,"sha256":"1ce14b81c5cc821994aa8ec1d42b220dd41b27fcc06373bce3958af7421b77d4"},{"owner":"compiler-native","path":"lib/lib.decorators.legacy.d.ts","bytes":1287,"sha256":"b3a048b3e9302ef9a34ef4ebb9aecfb28b66abb3bce577206a79fee559c230da"},{"owner":"repository","path":"packages/contracts/dist/CancellationSignal.d.ts","bytes":558,"sha256":"879eb0ae6c8b5b305930f8770298f286259992a69b6653a25ea24b1944fe0a45"},{"owner":"repository","path":"packages/contracts/dist/Disposable.d.ts","bytes":441,"sha256":"989546b49c6a87bfc04487d6fe166aeea81650049efbbd7615476d36021b88c5"},{"owner":"repository","path":"packages/contracts/dist/Diagnostic.d.ts","bytes":532,"sha256":"6f1d73cb7d31a3bf11427f6b856eb1b2ea0cb28eefbc9b67c0518652ee612c59"},{"owner":"repository","path":"packages/contracts/dist/HostAdapter.d.ts","bytes":907,"sha256":"2830519734a7957ffa6aa70998f01f87f1d00f80bafcc4fc114133b5c38d5458"},{"owner":"repository","path":"packages/contracts/dist/Point2D.d.ts","bytes":193,"sha256":"f0d8ca89c643a80fd96031ef8267969fd12c212a319ce8ddb3f8b81e0f8c76e5"},{"owner":"repository","path":"packages/contracts/dist/ImageData2D.d.ts","bytes":1563,"sha256":"48984b068c63562aae1abb3c2561573aeeb31e1f390595ec357dbd87a61673a7"},{"owner":"repository","path":"packages/contracts/dist/RenderFrame2D.d.ts","bytes":1799,"sha256":"a1bceb2e8135c3fea5fb981c661ac45244ed792899c7fb3f2cf7ff9934e83492"},{"owner":"repository","path":"packages/contracts/dist/TexturedGeometry2D.d.ts","bytes":1186,"sha256":"dbc403a70e6ebdd39346260c3a965b1ac8dbb3e5bfcad21c402d34d4ae0f500e"},{"owner":"repository","path":"packages/contracts/dist/SharedMaterial2D.d.ts","bytes":1674,"sha256":"d74f46a568cc7b67878bbe57b2365d5b3c1bb70e90ac6e963448cacb1b4f3974"},{"owner":"repository","path":"packages/contracts/dist/SharedGeometry2D.d.ts","bytes":1243,"sha256":"6ebfdcfb29d99199360b2754e9f3c67090aacf7d7bb32b36fb44985c45ecae10"},{"owner":"repository","path":"packages/contracts/dist/TextureViewRegion2D.d.ts","bytes":765,"sha256":"7ce875bc19801847f9b7bfe28586c06a305a0f44491fbba785bc828d158de030"},{"owner":"repository","path":"packages/contracts/dist/TexturedRenderFrame2D.d.ts","bytes":1634,"sha256":"11f7c7967e2142906717c2c2a744611cff6e435b3021e9d537ba61a3cd0ab351"},{"owner":"repository","path":"packages/contracts/dist/SharedRenderFrame2D.d.ts","bytes":3469,"sha256":"13a5f207acd792a3ee8e17fa6a7564ccc7f0d438a74448c80294eeab526cec4b"},{"owner":"repository","path":"packages/contracts/dist/ProjectFormat.generated.d.ts","bytes":4161,"sha256":"6feed3c80a4ceb9d9c6b2c299ee5e5d11a2f5c0b145b58e855ce8443e3b2de11"},{"owner":"repository","path":"packages/contracts/dist/index.d.ts","bytes":2486,"sha256":"955bbf2feaeafdab5b155e3e4875f077c667d074fe6d807a85c9a5fec6f24434"},{"owner":"repository","path":"packages/engine/dist/rendering/matrix4.d.ts","bytes":1020,"sha256":"7f93b0d9d9f549f9627ba9cea8fbe423241dc59806d84ce1006b419111eb36e7"},{"owner":"repository","path":"packages/engine/dist/rendering/meshGeometry3D.d.ts","bytes":1045,"sha256":"289f1bc15356c5efc936458b1f23ea714d113da999c5075e75bb1ba4195eb84b"},{"owner":"repository","path":"packages/engine/dist/rendering/sceneFrame3D.d.ts","bytes":1650,"sha256":"6eede4d7ca07375516bc746ad0ac70fef56cf7ab6dca532f46ef049339314a82"},{"owner":"repository","path":"packages/engine/dist/rendering/scene3d.d.ts","bytes":1275,"sha256":"4efe7c389cb1e312124984b6a6b8ed02115a2a131a937e0f83c70f06406d5c3e"},{"owner":"repository","path":"packages/engine/dist/web/texturedWebGPUOptions.d.ts","bytes":886,"sha256":"ad1cd028fd3469bf4be4a21963a6157456c23af8de806ceb9b44559eab2a6753"},{"owner":"repository","path":"packages/engine/dist/web/sharedWebGPUOptions.d.ts","bytes":1002,"sha256":"3d57f913bc82fee111db7c24e6c8373ef4b9039284b2640512f7b7fd08a68a05"},{"owner":"repository","path":"packages/engine/dist/rendering/packMeshGeometry3D.d.ts","bytes":1053,"sha256":"566c68091d400b2fade8ee472c46b6611dc54f1d6ca9c528b36bafa80d1c63ff"},{"owner":"repository","path":"packages/engine/dist/web/webgpuMeshPass.d.ts","bytes":735,"sha256":"b0b0d5ccdbc1b871f787b8d6c2251c35fa2df002efd356226e391e33d7c97b40"},{"owner":"repository","path":"packages/engine/dist/web/b1.d.ts","bytes":2093,"sha256":"110e6403cef059c24bc4a83192010ec89a41eaafaff215e549ac00b7865345c4"},{"owner":"repository","path":"packages/engine/dist/web/WebGPUHost.d.ts","bytes":6463,"sha256":"42ac73d1911d55c44f9945439b4c73778ba8c887acf680488f5b1daec82465c6"},{"owner":"repository","path":"packages/engine/dist/web/webgpu.d.ts","bytes":595,"sha256":"3916e5931b13bb607303ca87568454a0fb4eaa37dab9e09c4433ee864d8d0ffa"},{"owner":"repository","path":"packages/engine/dist/rendering/packSharedMeshGeometry3D.d.ts","bytes":1086,"sha256":"f442f5cfe82626d887d8a2af294cd3e63c0a8b27eb026838a2f445a7a0435b9c"},{"owner":"repository","path":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","bytes":743,"sha256":"7d1094342be884cfc1bf0850d8fc4cf8437d0bcc1b571b044791094be0b380c7"},{"owner":"repository","path":"packages/engine/dist/web/sharedB1.d.ts","bytes":1302,"sha256":"f2df25a1ba2a184731c240f8aef5b9b4c9a0af05d583f493cc9ba816ce91abd5"},{"owner":"repository","path":"packages/engine/dist/web/scene3d.d.ts","bytes":1433,"sha256":"54ae3906765ca00ff8a0de7bbbdacd182816aabb03e79edc57ec5b00b099f62c"},{"owner":"repository","path":"tests/types/scene3d-web-dom-free-negative.ts","bytes":397,"sha256":"914d4ae90905f31dabfaa428c3fb37065517340c0dcbb89ac8ebd64b09638cde"}],"inputs":[{"path":"tests/types/scene3d-diagnostic-expectations.json","bytes":10358,"sha256":"5d399ffd1e64fbdf790642f0f5832f629cc8e18e0cf15af907c8be994fefe0d9"},{"path":"tests/types/tsconfig.dom-free.json","bytes":56,"sha256":"24bc13fae1f9d98b5d2dc212c9fb4f1f926aeb956f706d8269acbd617c900b49"},{"path":"tests/types/tsconfig.json","bytes":224,"sha256":"e378996174db2020f9c416fb0599ea1182b3ca3265b3dc56012a688fd3252ad9"},{"path":"tsconfig.base.json","bytes":446,"sha256":"b7a31fb9f93a93e20bfdcf33c135acb45cb3a6895a8b3e7006bd85214ddc1008"},{"path":"node_modules/typescript/package.json","bytes":3087,"sha256":"3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e"},{"path":"node_modules/typescript/bin/tsc","bytes":44,"sha256":"2219f428a7e55aaf1f7ad85b9b0f0cf5078aeb76ccc9a7c6036c92d48f492ffd"}],"cases":[{"name":"m13-browser-dom-01","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":20,"column":22,"code":2304},{"name":"m13-browser-dom-02","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":25,"column":26,"code":2304},{"name":"m13-browser-dom-03","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":63,"column":23,"code":2304},{"name":"m13-browser-dom-04","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":103,"column":42,"code":2304},{"name":"m13-browser-dom-05","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":103,"column":72,"code":2304},{"name":"m13-browser-dom-06","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":103,"column":103,"code":2304},{"name":"m13-browser-dom-07","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":103,"column":143,"code":2304},{"name":"m13-browser-dom-08","file":"packages/engine/dist/web/WebGPUHost.d.ts","line":103,"column":229,"code":2304},{"name":"m13-browser-dom-09","file":"packages/engine/dist/web/sharedWebGPUOptions.d.ts","line":14,"column":14,"code":2304},{"name":"m13-browser-dom-10","file":"packages/engine/dist/web/sharedWebGPUOptions.d.ts","line":16,"column":15,"code":2304},{"name":"m13-browser-dom-11","file":"packages/engine/dist/web/texturedWebGPUOptions.d.ts","line":11,"column":14,"code":2304},{"name":"m13-browser-dom-12","file":"packages/engine/dist/web/texturedWebGPUOptions.d.ts","line":13,"column":15,"code":2304},{"name":"m13-browser-dom-13","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":2,"column":71,"code":2304},{"name":"m13-browser-dom-14","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":2,"column":101,"code":2304},{"name":"m13-browser-dom-15","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":2,"column":141,"code":2304},{"name":"m13-browser-dom-16","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":2,"column":181,"code":2304},{"name":"m13-browser-dom-17","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":2,"column":247,"code":2304},{"name":"m13-browser-dom-18","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":4,"column":48,"code":2304},{"name":"m13-browser-dom-19","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":4,"column":80,"code":2304},{"name":"m13-browser-dom-20","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":4,"column":109,"code":2304},{"name":"m13-browser-dom-21","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":4,"column":129,"code":2304},{"name":"m13-browser-dom-22","file":"packages/engine/dist/web/webgpuMeshPass.d.ts","line":4,"column":150,"code":2304},{"name":"m13-browser-dom-23","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":2,"column":77,"code":2304},{"name":"m13-browser-dom-24","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":2,"column":107,"code":2304},{"name":"m13-browser-dom-25","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":2,"column":147,"code":2304},{"name":"m13-browser-dom-26","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":2,"column":187,"code":2304},{"name":"m13-browser-dom-27","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":2,"column":243,"code":2304},{"name":"m13-browser-dom-28","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":4,"column":54,"code":2304},{"name":"m13-browser-dom-29","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":4,"column":86,"code":2304},{"name":"m13-browser-dom-30","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":4,"column":115,"code":2304},{"name":"m13-browser-dom-31","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":4,"column":135,"code":2304},{"name":"m13-browser-dom-32","file":"packages/engine/dist/web/webgpuSharedMeshPass.d.ts","line":4,"column":156,"code":2304}]};
const sceneDomM13Selected = existsSync(path.join(root,'packages/engine/dist/web/sharedB1.d.ts'));
const sceneDomM13Native = sceneDomM13Compiler?.nativeOwner ?? null;
function verifySceneDomM13(){
  if(!sceneDomM13Selected)return;
  if(!sceneDomM13Compiler)throw Error('S3D1 M1.3 compiler input selection changed');
  sceneDomM13Compiler.verify();
  if(JSON.parse(readFileSync(path.join(sceneDomM13Native,'package.json'),'utf8')).version!==sceneDomM13Successor.compilerVersion)throw Error('S3D1 M1.3 actual native compiler version differs');
  for(const row of [...sceneDomM13Successor.inputs.map(pin=>({owner:'repository',...pin})),...sceneDomM13Successor.closure]){
    const owner=row.owner==='compiler-native'?sceneDomM13Native:root,actual=fingerprintFile(owner,row.path);
    if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)throw Error('S3D1 M1.3 complete input changed: '+row.path);
  }
}
verifySceneDomM13();
const sceneTypeConsumers=[
  ['positive','tsconfig.dom-free.json',false],['web-positive','tsconfig.web.json',false],
  ['negative','tsconfig.dom-free.json',true],['web-negative','tsconfig.web.json',true],
  ['import-negative','tsconfig.web.json',true],['web-dom-free-negative','tsconfig.dom-free.json',true],
];
const sceneTypeConfigs=[];
try {
  for (const [name,base,isNegative] of sceneTypeConsumers) {
    const source='scene3d-'+name+'.ts',file='tests/types/'+source,fixture=readFileSync(path.join(root,file),'utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('S3D1 types: suppression in '+file);
    if (sceneTypeExpectations.fixtureSHA256?.[file]!==sceneTypeDigest(file)) throw new Error('S3D1 types: observed fixture identity mismatch: '+file);
    const expected=isNegative?(name===sceneDomM13Successor.lane&&sceneDomM13Selected?sceneDomM13Successor.cases:sceneTypeExpectations.cases[name]):[];
    if (!Array.isArray(expected) || (isNegative && expected.length===0)) throw new Error('S3D1 types: missing actual diagnostic inventory: '+name);
    const declared=fixture.split(/\r?\n/).flatMap((line,index)=>{
      const match=line.match(/^\/\/ SCENE3D_CASE ([\w-]+)$/);return match?[{name:match[1],line:index+2}]:[];
    });
    if (name!=='web-dom-free-negative' && isNegative && (declared.length!==expected.length
        || new Set(declared.map(item=>item.name)).size!==declared.length
        || (fixture.match(/\bSCENE3D_CASE\b/g)??[]).length!==declared.length
        || expected.some((item,index)=>item.name!==declared[index]?.name || item.file!==file || item.line!==declared[index]?.line)))
      throw new Error('S3D1 types: exact authored case/file/line inventory mismatch: '+file);
    if (new Set(expected.map(item=>item.name)).size!==expected.length || expected.some(item=>
        typeof item.name!=='string' || typeof item.file!=='string' || !Number.isSafeInteger(item.line) || item.line<1
        || !Number.isSafeInteger(item.column) || item.column<1 || !Number.isSafeInteger(item.code) || item.code<1))
      throw new Error('S3D1 types: malformed actual diagnostic receipt: '+name);
    // Names identify authored cases; only normalized diagnostic tuples can
    // prove one-to-one coverage of the complete compiler diagnostic multiset.
    const sceneDiagnosticTuple=item=>JSON.stringify([item.file.replaceAll('\\','/'),item.line,item.column,item.code]);
    const expectedTuples=new Set();
    for (const item of expected) {
      const tuple=sceneDiagnosticTuple(item);
      if(expectedTuples.has(tuple))throw new Error('S3D1 types: '+name+' duplicate expected diagnostic tuple: '+tuple);
      expectedTuples.add(tuple);
    }
    if (name==='web-dom-free-negative' && !expected.some(item=>/^packages\/engine\/dist\/web\/.+\.d\.ts$/.test(item.file)))
      throw new Error('S3D1 types: no actual browser declaration DOM dependency witness');
    const config='tests/types/scene3d-'+name+'.generated.json';sceneTypeConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./'+base,include:[source]}));
    if(name===sceneDomM13Successor.lane&&sceneDomM13Selected){
      verifySceneDomM13();
      const closure=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false','--listFilesOnly'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
      if(closure.error||closure.status!==0||closure.signal!==null||closure.stderr!=='')throw Error('S3D1 M1.3 declaration closure observation failed');
      const actual=closure.stdout.trim().split(/\r?\n/).map(file=>{
        const resolved=realpathSync(file),nativeRelative=path.relative(sceneDomM13Native,resolved);
        return nativeRelative!==''&&!nativeRelative.startsWith('..'+path.sep)&&!path.isAbsolute(nativeRelative)
          ? ['compiler-native',ownerRelativePath(sceneDomM13Native,resolved)] : ['repository',ownerRelativePath(realpathSync(root),resolved)];
      });
      const ordered=rows=>rows.map(row=>JSON.stringify(row)).sort();
      if(JSON.stringify(ordered(actual))!==JSON.stringify(ordered(sceneDomM13Successor.closure.map(row=>[row.owner,row.path]))))throw Error('S3D1 M1.3 complete declaration closure differs');
      verifySceneDomM13();
    }
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
    if(name===sceneDomM13Successor.lane&&sceneDomM13Selected)verifySceneDomM13();
    process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.error)throw check.error;
    const observed=[...(check.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)]
      .map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
    if (!isNegative) { if(check.status!==0 || observed.length!==0)throw new Error('S3D1 types: '+name+' actual positive consumer failed: '+check.status);continue; }
    if (check.status!==1 || observed.length!==expected.length) throw new Error('S3D1 types: '+name+' extra/missing/unrelated diagnostics: '+observed.length+'/'+check.status);
    // Keep multiplicity: a duplicate compiler tuple cannot be collapsed
    // into a set and silently satisfy a single expected diagnostic.
    const unconsumedDiagnostics=new Map();
    for (const actual of observed) {
      const tuple=sceneDiagnosticTuple(actual),bucket=unconsumedDiagnostics.get(tuple)??[];
      bucket.push(actual);unconsumedDiagnostics.set(tuple,bucket);
    }
    const receipts=expected.map(item=>{
      const tuple=sceneDiagnosticTuple(item),found=unconsumedDiagnostics.get(tuple)??[];
      if(found.length!==1)throw new Error('S3D1 types: '+item.name+' exact file/line/column/code mismatch: '+JSON.stringify(found));
      unconsumedDiagnostics.delete(tuple);
      return {name:item.name,expected:item,actual:found[0]};
    });
    if(unconsumedDiagnostics.size!==0)throw new Error('S3D1 types: '+name+' unmatched observed diagnostic tuples: '+JSON.stringify([...unconsumedDiagnostics.values()].flat()));
    console.log('S3D1 '+name+' individual unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('S3D1 type fixtures PASS: actual DOM-free/public browser positives and individually frozen unsuppressed TS7 diagnostics. Structural types do not authenticate owned values.');
} finally { for(const config of sceneTypeConfigs)rmSync(config,{force:true}); }
// S3D1_TYPES_END

// MI1_TYPES_BEGIN
// The independent actual TS7 probe replaces only this inline observation. Pending
// receipts fail closed; this author does not predict diagnostics or compiler hashes.
const mouseTypeExpectations={"schemaVersion":1,"status":"OBSERVED_FROZEN_TS7_DIAGNOSTICS","compiler":{"version":"7.0.2","tscSHA256":"2219f428a7e55aaf1f7ad85b9b0f0cf5078aeb76ccc9a7c6036c92d48f492ffd","packageSHA256":"3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e"},"fixtureSHA256":{"tests/types/mouse-input-positive.ts":"23a7731bb56be6ee7628c77d652b7fabcb0ba76ff292163306a0df48c09a6463","tests/types/mouse-input-negative.ts":"ac859cfbf7813dc3c636ee758ee50d2d4c4260f213c25836c54426ab0e9f21d3","tests/types/mouse-input-import-negative.ts":"6c34169bab1f3248a832daf90d885eb19ff1af1424f7c021bb3f469049215db0","tests/types/mouse-input-dom-free-negative.ts":"d81d4613c6c78f176796dc321a90cbd50bc95e19c7de891b68bfc493573fcb43"},"cases":{"negative":[{"name":"required-arguments","line":12,"file":"tests/types/mouse-input-negative.ts","column":1,"code":2554},{"name":"required-scope","line":14,"file":"tests/types/mouse-input-negative.ts","column":18,"code":2741},{"name":"genuine-engine","line":16,"file":"tests/types/mouse-input-negative.ts","column":19,"code":2740},{"name":"genuine-scope","line":18,"file":"tests/types/mouse-input-negative.ts","column":26,"code":2739},{"name":"numeric-width","line":20,"file":"tests/types/mouse-input-negative.ts","column":32,"code":2322},{"name":"numeric-height","line":22,"file":"tests/types/mouse-input-negative.ts","column":42,"code":2322},{"name":"numeric-budget","line":24,"file":"tests/types/mouse-input-negative.ts","column":52,"code":2322},{"name":"no-pointer-capture-option","line":26,"file":"tests/types/mouse-input-negative.ts","column":52,"code":2353},{"name":"no-touch-option","line":28,"file":"tests/types/mouse-input-negative.ts","column":52,"code":2353},{"name":"required-private-handle-brand","line":30,"file":"tests/types/mouse-input-negative.ts","column":7,"code":2741},{"name":"readonly-state","line":32,"file":"tests/types/mouse-input-negative.ts","column":7,"code":2540},{"name":"readonly-options","line":34,"file":"tests/types/mouse-input-negative.ts","column":9,"code":2540},{"name":"readonly-events","line":36,"file":"tests/types/mouse-input-negative.ts","column":8,"code":2540},{"name":"readonly-payload","line":38,"file":"tests/types/mouse-input-negative.ts","column":9,"code":2540},{"name":"exact-pointer-kind","line":40,"file":"tests/types/mouse-input-negative.ts","column":66,"code":2322},{"name":"exact-primary-button","line":42,"file":"tests/types/mouse-input-negative.ts","column":85,"code":2322},{"name":"exact-state","line":44,"file":"tests/types/mouse-input-negative.ts","column":7,"code":2322},{"name":"exact-cancel-reason","line":46,"file":"tests/types/mouse-input-negative.ts","column":7,"code":2322},{"name":"cancel-payload-invariant","line":48,"file":"tests/types/mouse-input-negative.ts","column":37,"code":2345},{"name":"no-async-typed-input-handler","line":50,"file":"tests/types/mouse-input-negative.ts","column":36,"code":2345},{"name":"input-type-only","line":52,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693},{"name":"options-type-only","line":54,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693},{"name":"events-type-only","line":56,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693},{"name":"payload-type-only","line":58,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693},{"name":"state-type-only","line":60,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693},{"name":"reason-type-only","line":62,"file":"tests/types/mouse-input-negative.ts","column":6,"code":2693}],"import-negative":[{"name":"no-root-factory","line":2,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2305},{"name":"no-root-types","line":4,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2305},{"name":"no-default-web-factory","line":6,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2305},{"name":"no-default-web-types","line":8,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2305},{"name":"no-gpu-input","line":10,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2305},{"name":"no-gpu-input-types","line":12,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2305},{"name":"no-runtime-factory","line":14,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2305},{"name":"no-engine-display-assembly","line":16,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2305},{"name":"no-engine-display-assembly-type","line":18,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2305},{"name":"no-optional-owner-port","line":20,"file":"tests/types/mouse-input-import-negative.ts","column":9,"code":2724},{"name":"no-optional-native-port","line":22,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2305},{"name":"no-cancel-seventh-type","line":24,"file":"tests/types/mouse-input-import-negative.ts","column":14,"code":2724},{"name":"no-deep-browser-module","line":26,"file":"tests/types/mouse-input-import-negative.ts","column":52,"code":2307},{"name":"no-deep-owner-module","line":28,"file":"tests/types/mouse-input-import-negative.ts","column":50,"code":2307},{"name":"no-deep-registry","line":30,"file":"tests/types/mouse-input-import-negative.ts","column":39,"code":2307}],"dom-free-negative":[{"name":"no-core-html-canvas-global","line":3,"file":"tests/types/mouse-input-dom-free-negative.ts","column":22,"code":2304},{"name":"no-core-pointer-global","line":5,"file":"tests/types/mouse-input-dom-free-negative.ts","column":23,"code":2304},{"name":"no-core-window-global","line":7,"file":"tests/types/mouse-input-dom-free-negative.ts","column":27,"code":2304},{"name":"no-dom-free-root-input","line":9,"file":"tests/types/mouse-input-dom-free-negative.ts","column":9,"code":2305},{"name":"no-dom-free-default-input","line":11,"file":"tests/types/mouse-input-dom-free-negative.ts","column":14,"code":2305}]}};
if(mouseTypeExpectations.schemaVersion!==1||mouseTypeExpectations.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS')
  throw new Error('MI1 types: actual unsuppressed TS7 probe is pending');
const mouseTypeCompiler=JSON.parse(readFileSync(path.join(root,'node_modules/typescript/package.json'),'utf8'));
if(mouseTypeCompiler.version!=='7.0.2'||mouseTypeExpectations.compiler?.version!=='7.0.2'
  ||mouseTypeExpectations.compiler?.tscSHA256!==sceneTypeDigest('node_modules/typescript/bin/tsc')
  ||mouseTypeExpectations.compiler?.packageSHA256!==sceneTypeDigest('node_modules/typescript/package.json'))
  throw new Error('MI1 types: actual compiler identity mismatch');
const mouseTypeConfigs=[];
try {
  for(const [name,base,isNegative]of [['positive','tsconfig.dom-free.json',false],['negative','tsconfig.web.json',true],['import-negative','tsconfig.web.json',true],['dom-free-negative','tsconfig.dom-free.json',true]]) {
    const source='mouse-input-'+name+'.ts',file='tests/types/'+source,fixture=readFileSync(path.join(root,file),'utf8');
    if(/@ts-(?:expect-error|ignore|nocheck)/.test(fixture))throw new Error('MI1 types: suppression in '+file);
    if(mouseTypeExpectations.fixtureSHA256?.[file]!==sceneTypeDigest(file))throw new Error('MI1 types: observed fixture identity mismatch: '+file);
    const expected=isNegative?mouseTypeExpectations.cases[name]:[];
    if(!Array.isArray(expected)||(isNegative&&expected.length===0))throw new Error('MI1 types: missing actual diagnostic inventory: '+name);
    const declared=fixture.split(/\r?\n/).flatMap((line,index)=>{const match=line.match(/^\/\/ MOUSE_INPUT_CASE ([\w-]+)$/);return match?[{name:match[1],line:index+2}]:[];});
    if(isNegative&&(declared.length!==expected.length||new Set(declared.map(item=>item.name)).size!==declared.length
      ||(fixture.match(/\bMOUSE_INPUT_CASE\b/g)??[]).length!==declared.length
      ||expected.some((item,index)=>item.name!==declared[index]?.name||item.file!==file||item.line!==declared[index]?.line)))
      throw new Error('MI1 types: exact authored case/file/line inventory mismatch: '+file);
    if(new Set(expected.map(item=>item.name)).size!==expected.length||expected.some(item=>typeof item.name!=='string'||typeof item.file!=='string'
      ||!Number.isSafeInteger(item.line)||item.line<1||!Number.isSafeInteger(item.column)||item.column<1||!Number.isSafeInteger(item.code)||item.code<1))
      throw new Error('MI1 types: malformed actual diagnostic receipt: '+name);
    const tuple=item=>JSON.stringify([item.file.replaceAll('\\','/'),item.line,item.column,item.code]);
    const expectedTuples=new Set();for(const item of expected){const key=tuple(item);if(expectedTuples.has(key))throw new Error('MI1 types: duplicate expected diagnostic tuple: '+key);expectedTuples.add(key);}
    const config='tests/types/mouse-input-'+name+'.generated.json';mouseTypeConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./'+base,include:[source]}));
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
    process.stdout.write(check.stdout??'');process.stderr.write(check.stderr??'');if(check.error)throw check.error;
    const observed=[...(check.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)]
      .map(match=>({file:match[1].replaceAll('\\','/'),line:Number(match[2]),column:Number(match[3]),code:Number(match[4])}));
    if(!isNegative){if(check.status!==0||observed.length!==0)throw new Error('MI1 types: public positive consumer failed: '+check.status);continue;}
    if(check.status!==1||observed.length!==expected.length)throw new Error('MI1 types: '+name+' extra/missing/unrelated diagnostic or wrong exit');
    // Complete tuple multiset bijection; duplicate compiler output cannot collapse.
    const remaining=new Map();for(const actual of observed){const key=tuple(actual),bucket=remaining.get(key)??[];bucket.push(actual);remaining.set(key,bucket);}
    const receipts=expected.map(item=>{const key=tuple(item),bucket=remaining.get(key);if(!bucket||bucket.length!==1)throw new Error('MI1 types: '+item.name+' exact diagnostic tuple mismatch');remaining.delete(key);return {name:item.name,expected:item,actual:bucket[0]};});
    if(remaining.size!==0)throw new Error('MI1 types: unassigned compiler diagnostics');
    console.log('MI1 '+name+' complete unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('MI1 types PASS: exact public positive and complete unsuppressed negative diagnostic bijection');
} finally {for(const config of mouseTypeConfigs)rmSync(config,{force:true});}
// MI1_TYPES_END

// SP1_A_TYPES_BEGIN
// Root freezes this observation only after the actual unsuppressed TS7 probe.
const spineTypeExpectations={"schemaVersion":1,"status":"OBSERVED_FROZEN_TS7_DIAGNOSTICS","compiler":{"version":"7.0.2","tscSHA256":"2219f428a7e55aaf1f7ad85b9b0f0cf5078aeb76ccc9a7c6036c92d48f492ffd","packageSHA256":"3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e"},"fixtureSHA256":{"tests/types/spine-import-plan-positive.ts":"df00b55e8bfea1a6ba47ef8f6db35915819c157ab63d6302b9bfdcc3ab025e36","tests/types/spine-import-plan-negative.ts":"345d935f274eea35e63206423af39eef0653890589ded914bd7270d182a3ffd7","tests/types/spine-import-plan-import-negative.ts":"8cfc9ed7af8fc91fefbde041a1ae00bc33a5e3ccac8ed4730affec7a385305c5"},"cases":{"negative":[{"name":"required-input","line":12,"file":"tests/types/spine-import-plan-negative.ts","column":1,"code":2554},{"name":"numeric-text","line":14,"file":"tests/types/spine-import-plan-negative.ts","column":43,"code":2322},{"name":"numeric-source-id","line":16,"file":"tests/types/spine-import-plan-negative.ts","column":34,"code":2322},{"name":"required-provenance","line":18,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2741},{"name":"required-provenance-notice","line":20,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2741},{"name":"no-limit-override","line":22,"file":"tests/types/spine-import-plan-negative.ts","column":33,"code":2353},{"name":"no-fetch-callback","line":24,"file":"tests/types/spine-import-plan-negative.ts","column":33,"code":2353},{"name":"required-asset-id","line":26,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2741},{"name":"numeric-asset-id","line":28,"file":"tests/types/spine-import-plan-negative.ts","column":60,"code":2322},{"name":"readonly-plan-version","line":30,"file":"tests/types/spine-import-plan-negative.ts","column":6,"code":2540},{"name":"readonly-page-name","line":32,"file":"tests/types/spine-import-plan-negative.ts","column":6,"code":2540},{"name":"readonly-region-width","line":34,"file":"tests/types/spine-import-plan-negative.ts","column":8,"code":2540},{"name":"readonly-output-array","line":36,"file":"tests/types/spine-import-plan-negative.ts","column":12,"code":2339},{"name":"readonly-limit","line":38,"file":"tests/types/spine-import-plan-negative.ts","column":21,"code":2540},{"name":"exact-input-source","line":40,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2322},{"name":"no-input-text-span","line":42,"file":"tests/types/spine-import-plan-negative.ts","column":34,"code":2322},{"name":"closed-code","line":44,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2322},{"name":"no-ready-acceptance","line":46,"file":"tests/types/spine-import-plan-negative.ts","column":7,"code":2322},{"name":"readonly-diagnostic","line":48,"file":"tests/types/spine-import-plan-negative.ts","column":12,"code":2540},{"name":"no-value-in-failure","line":50,"file":"tests/types/spine-import-plan-negative.ts","column":27,"code":2339},{"name":"no-type-runtime","line":52,"file":"tests/types/spine-import-plan-negative.ts","column":6,"code":2693},{"name":"no-span-runtime","line":54,"file":"tests/types/spine-import-plan-negative.ts","column":6,"code":2693}],"import-negative":[{"name":"no-root-factory","line":2,"file":"tests/types/spine-import-plan-import-negative.ts","column":9,"code":2305},{"name":"no-root-limits","line":4,"file":"tests/types/spine-import-plan-import-negative.ts","column":9,"code":2305},{"name":"no-root-plan-type","line":6,"file":"tests/types/spine-import-plan-import-negative.ts","column":14,"code":2305},{"name":"no-private-planner-import","line":8,"file":"tests/types/spine-import-plan-import-negative.ts","column":55,"code":2307},{"name":"no-dom-ambient","line":10,"file":"tests/types/spine-import-plan-import-negative.ts","column":22,"code":2304},{"name":"no-node-ambient","line":12,"file":"tests/types/spine-import-plan-import-negative.ts","column":20,"code":2503}]}};
if(spineTypeExpectations.status!=='OBSERVED_FROZEN_TS7_DIAGNOSTICS')throw new Error('SP1-A types: actual unsuppressed compiler probe pending');
if(spineTypeExpectations.compiler.version!=='7.0.2'||spineTypeExpectations.compiler.tscSHA256!==sceneTypeDigest('node_modules/typescript/bin/tsc')||spineTypeExpectations.compiler.packageSHA256!==sceneTypeDigest('node_modules/typescript/package.json'))throw new Error('SP1-A types: exact compiler identity mismatch');
const spineGeneratedConfigs=[];
try{
  for(const name of ['positive','negative','import-negative']){
    const source='spine-import-plan-'+name+'.ts',file='tests/types/'+source,raw=readFileSync(path.join(root,file),'utf8'),expected=name==='positive'?[]:spineTypeExpectations.cases[name];
    if(/@ts-(?:expect-error|ignore|nocheck)/.test(raw))throw new Error('SP1-A types: suppression in '+file);
    if(spineTypeExpectations.fixtureSHA256[file]!==sceneTypeDigest(file))throw new Error('SP1-A types: frozen fixture identity mismatch');
    const declared=raw.split(/\r?\n/).flatMap((line,i)=>{const match=line.match(/^\/\/ SPINE_IMPORT_CASE ([\w-]+)$/);return match?[{name:match[1],line:i+2}]:[];});
    if(name!=='positive'&&(!expected?.length||expected.length!==declared.length||new Set(declared.map(v=>v.name)).size!==declared.length||(raw.match(/\bSPINE_IMPORT_CASE\b/g)??[]).length!==declared.length||expected.some((v,i)=>v.file!==file||v.name!==declared[i]?.name||v.line!==declared[i]?.line)))throw new Error('SP1-A types: exact authored diagnostic inventory mismatch');
    const tuple=v=>JSON.stringify([v.file.replaceAll('\\','/'),v.line,v.column,v.code]);
    if(new Set(expected.map(tuple)).size!==expected.length||expected.some(v=>!Number.isSafeInteger(v.column)||v.column<1||!Number.isSafeInteger(v.code)||v.code<1))throw new Error('SP1-A types: malformed frozen diagnostic tuples');
    const config='tests/types/spine-import-plan-'+name+'.generated.json';spineGeneratedConfigs.push(path.join(root,config));
    writeFileSync(path.join(root,config),JSON.stringify({extends:'./tsconfig.dom-free.json',include:[source]}));
    const r=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
    process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;
    const observed=[...(r.stdout??'').matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gm)].map(m=>({file:m[1].replaceAll('\\','/'),line:+m[2],column:+m[3],code:+m[4]}));
    // A matching tuple inventory cannot hide global or stderr compiler errors.
    const allCompilerErrors=[...((r.stdout??'')+'\n'+(r.stderr??'')).matchAll(/\berror TS\d+:/g)];
    if(allCompilerErrors.length!==observed.length)throw new Error('SP1-A types: unlocated or stderr compiler diagnostic');
    if(name==='positive'){if(r.status!==0||observed.length)throw new Error('SP1-A types: public DOM-free positive failed');continue;}
    if(r.status!==1||observed.length!==expected.length)throw new Error('SP1-A types: extra/missing/unrelated diagnostics');
    const remaining=new Map();for(const actual of observed){const key=tuple(actual),bucket=remaining.get(key)??[];bucket.push(actual);remaining.set(key,bucket);}
    const receipts=expected.map(v=>{const key=tuple(v),bucket=remaining.get(key);if(bucket?.length!==1)throw new Error('SP1-A types: exact file/line/column/code mismatch for '+v.name);remaining.delete(key);return{name:v.name,expected:v,actual:bucket[0]};});
    if(remaining.size)throw new Error('SP1-A types: unassigned diagnostics');
    console.log('SP1-A '+name+' complete unsuppressed diagnostic receipts: '+JSON.stringify(receipts));
  }
  console.log('SP1-A types PASS: public DOM-free positive, exact observed unsuppressed diagnostics and retained root isolation');
}finally{for(const file of spineGeneratedConfigs)rmSync(file,{force:true});}
// SP1_A_TYPES_END

// BW1_TYPES_BEGIN
// This standalone addition preserves every preceding type check. Its inventory
// comes from the separately reviewed unsuppressed TS7 observations, not guesses.
{
  const bwFs = await import('node:fs');
  const {createHash: bwCreateHash} = await import('node:crypto');
  const bwDigest = bytes => bwCreateHash('sha256').update(bytes).digest('hex');
  const bwInventoryFile = 'tests/types/byte-writer-diagnostic-expectations.json';
  const bwInventoryBytes = bwFs.readFileSync(path.join(root, bwInventoryFile));
  if (bwInventoryBytes.length !== 17706 || bwDigest(bwInventoryBytes) !== '3e209f571a29d1e89c5e4deab3fc8f89bf668572d21561fce0d285ffe9e173cf')
    throw new Error('BW1 types: frozen actual diagnostic inventory identity mismatch');
  const bwInventory = JSON.parse(bwInventoryBytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (bwInventory.schemaVersion !== 1 || bwInventory.compiler?.version !== '7.0.2'
    || !Array.isArray(bwInventory.positive?.diagnostics) || bwInventory.positive.diagnostics.length !== 0)
    throw new Error('BW1 types: missing actual positive/strict compiler inventory');
  const bwCompilerBytes = bwFs.readFileSync(path.join(root, 'node_modules/typescript/package.json'));
  if (JSON.parse(bwCompilerBytes.toString('utf8')).version !== '7.0.2'
    || bwDigest(bwCompilerBytes) !== '3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e'
    || bwDigest(bwFs.readFileSync(compiler)) !== '2219f428a7e55aaf1f7ad85b9b0f0cf5078aeb76ccc9a7c6036c92d48f492ffd')
    throw new Error('BW1 types: observed compiler identity mismatch');
  const bwTrials = [
    {name: 'positive', source: 'byte-writer-positive.ts', base: 'tsconfig.dom-free.json', marker: null, count: 0, inventory: bwInventory.positive},
    {name: 'negative', source: 'byte-writer-negative.ts', base: 'tsconfig.dom-free.json', marker: 'BYTE_WRITER_CASE', count: 41, inventory: bwInventory.groups?.negative},
    {name: 'import-negative', source: 'byte-writer-import-negative.ts', base: 'tsconfig.web.json', marker: 'BYTE_WRITER_IMPORT_CASE', count: 16, inventory: bwInventory.groups?.['import-negative']},
  ];
  const bwTuple = item => JSON.stringify([item.file, item.line, item.column, item.code, item.message]);
  for (const trial of bwTrials) {
    trial.file = 'tests/types/' + trial.source;
    const fixturePin = trial.inventory?.fixture, fixtureBytes = bwFs.readFileSync(path.join(root, trial.file));
    if (fixturePin?.path !== trial.file || fixturePin.bytes !== fixtureBytes.length || fixturePin.sha256 !== bwDigest(fixtureBytes))
      throw new Error('BW1 types: observed fixture identity mismatch: ' + trial.file);
    const fixture = fixtureBytes.toString('utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(fixture)) throw new Error('BW1 types: suppression in ' + trial.file);
    trial.expected = trial.marker ? trial.inventory.cases : [];
    if (!Array.isArray(trial.expected) || trial.expected.length !== trial.count)
      throw new Error('BW1 types: incomplete actual diagnostic inventory: ' + trial.name);
    if (trial.marker) {
      const markerPattern = new RegExp('^// ' + trial.marker + ' ([a-z0-9-]+)$');
      const declared = fixture.split(/\r?\n/).flatMap((line, index) => {
        const match = line.match(markerPattern);
        return match ? [{name: match[1], line: index + 2}] : [];
      });
      if (declared.length !== trial.count || new Set(declared.map(item => item.name)).size !== declared.length
        || (fixture.match(new RegExp('\\b' + trial.marker + '\\b', 'g')) ?? []).length !== declared.length
        || trial.expected.some((item, index) => item.name !== declared[index]?.name || item.file !== trial.file || item.line !== declared[index]?.line))
        throw new Error('BW1 types: exact original authored case/file/line mismatch: ' + trial.file);
    }
    if (trial.expected.some(item => typeof item.name !== 'string' || item.file !== trial.file
      || !Number.isSafeInteger(item.line) || item.line < 1 || !Number.isSafeInteger(item.column) || item.column < 1
      || !Number.isSafeInteger(item.code) || item.code < 1 || typeof item.message !== 'string')
      || new Set(trial.expected.map(bwTuple)).size !== trial.expected.length)
      throw new Error('BW1 types: malformed or duplicate actual diagnostic tuple: ' + trial.name);
    trial.config = 'tests/types/byte-writer-' + trial.name + '.gate.generated.json';
    trial.physicalConfig = path.resolve(root, trial.config);
    if (path.relative(root, trial.physicalConfig).replaceAll('\\', '/') !== trial.config)
      throw new Error('BW1 types: generated config escapes its SDK root');
  }
  // Refuse known setup conflicts for every trial before the first BW1 write or
  // compiler process; the per-trial check and exclusive write also remain below.
  for (const trial of bwTrials) {
    if (bwFs.existsSync(trial.physicalConfig)) throw new Error('BW1 types: generated config already exists: ' + trial.config);
  }
  for (const trial of bwTrials) {
    if (bwFs.existsSync(trial.physicalConfig)) throw new Error('BW1 types: generated config already exists: ' + trial.config);
    let bwCreated = false, bwCheck;
    try {
      bwFs.writeFileSync(trial.physicalConfig, JSON.stringify({extends: './' + trial.base, include: [trial.source]}) + '\n', {flag: 'wx'});
      bwCreated = true;
      bwCheck = spawnSync(process.execPath, [compiler, '--project', trial.config, '--pretty', 'false'],
        {cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 12000000, windowsHide: true, shell: false});
    } finally {
      if (bwCreated) bwFs.rmSync(trial.physicalConfig);
    }
    process.stdout.write(bwCheck.stdout ?? '');
    process.stderr.write(bwCheck.stderr ?? '');
    if (bwCheck.error) throw bwCheck.error;
    if (bwCheck.signal !== null || ![0, 1].includes(bwCheck.status)) throw new Error('BW1 types: interrupted or invalid compiler outcome: ' + trial.name);
    const stdout = bwCheck.stdout ?? '', stderr = bwCheck.stderr ?? '';
    const observed = [...stdout.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/gm)].map(match => {
      const absolute = path.isAbsolute(match[1]) ? match[1] : path.resolve(root, match[1]);
      return {file: path.relative(root, absolute).replaceAll('\\', '/'), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]), message: match[5]};
    });
    const allCompilerErrors = [...(stdout + '\n' + stderr).matchAll(/\berror TS\d+:/g)];
    if (stderr.trim() !== '' || allCompilerErrors.length !== observed.length || observed.some(item => item.file !== trial.file))
      throw new Error('BW1 types: unlocated, stderr or external compiler/config diagnostic: ' + trial.name);
    if (!trial.marker) {
      if (bwCheck.status !== 0 || observed.length !== 0) throw new Error('BW1 types: unsuppressed DOM-free positive failed');
      continue;
    }
    if (bwCheck.status !== 1 || observed.length !== trial.expected.length)
      throw new Error('BW1 types: missing/extra diagnostics or wrong negative exit: ' + trial.name);
    const remaining = new Map();
    for (const actual of observed) {
      const key = bwTuple(actual), bucket = remaining.get(key) ?? [];
      bucket.push(actual); remaining.set(key, bucket);
    }
    const receipts = trial.expected.map(expected => {
      const key = bwTuple(expected), bucket = remaining.get(key);
      if (bucket?.length !== 1) throw new Error('BW1 types: exact file/line/column/code/message mismatch: ' + expected.name);
      remaining.delete(key);
      return {name: expected.name, expected, actual: bucket[0]};
    });
    if (remaining.size !== 0) throw new Error('BW1 types: duplicate or unassigned actual diagnostic tuples: ' + trial.name);
    console.log('BW1 ' + trial.name + ' complete unsuppressed diagnostic receipts: ' + JSON.stringify(receipts));
  }
  console.log('BW1 types PASS: public DOM-free positive and exact individually observed unsuppressed ordinary/optional-import diagnostics. Runtime behavior is separately verified.');
}
// BW1_TYPES_END

// NS1_TYPES_BEGIN
// Standalone addition; original type gates remain byte-for-byte unchanged.
{
  const nsFrozenInventory = {"path":"tests/types/nine-slice-diagnostic-expectations.json","bytes":27106,"sha256":"9f6922706a8f846802e6704a6eafed7bd5b3154fb9b0beedfd9c5b4ed7922705"};
  const nsTools = {portableMessage: function portableMessage(message, repository, platform) {
  if (typeof message !== 'string') throw Error('NS1 message is not a string');
  // TypeScript escapes non-ASCII UTF-16 units in quoted import types. Match only
  // spellings derived from the complete known owner; do not decode the message.
  const compilerSpelling = value => value.replace(/[^\x20-\x7e]/g, unit =>
    '\\u' + unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  const owners = [repository, repository.replaceAll('\\', '/'), repository.replaceAll('/', '\\')];
  const variants = [...new Set(owners.flatMap(owner => [owner, compilerSpelling(owner)]))].sort((a, b) => b.length - a.length);
  let result = message;
  for (const variant of variants) {
    const escaped = variant.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
    // A root prefix cannot authorize a sibling such as sdk-other.
    result = result.replace(new RegExp(escaped + '(?=[\\\\/])', platform === 'win32' ? 'gi' : 'g'), '<SDK_ROOT>');
  }
  if (/[A-Za-z]:[\\/]|file:\/\/|\/(?:Users|home|tmp|private)\//i.test(result)) throw Error('NS1 unclassified absolute path in diagnostic message');
  return result;
}, sourceCases: function sourceCases(text, marker, file) {
  if (!marker) return [];
  const lines = text.split(/\r?\n/), pattern = new RegExp('^// ' + marker + ' ([a-z0-9-]+)$');
  const rows = lines.flatMap((line, index) => { const match = pattern.exec(line); return match ? [{ name: match[1], file, markerLine: index + 1, line: index + 2 }] : []; });
  if (!rows.length || new Set(rows.map(row => row.name)).size !== rows.length || (text.match(new RegExp('\\b' + marker + '\\b', 'g')) ?? []).length !== rows.length)
    throw Error('NS1 incomplete or duplicate original source markers');
  const forbidden = new Map([
    ['runtime-no-new-subpath', '@egret/runtime/nine-slice'], ['engine-no-new-subpath', '@egret/engine/nine-slice'],
    ['runtime-source-not-public', '@egret/runtime/src/NineSliceGeometry2D.js'], ['engine-source-not-public', '@egret/engine/src/NineSliceGeometry2D.js'],
  ]);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], limit = index + 1 < rows.length ? rows[index + 1].markerLine - 1 : lines.length;
    row.endLine = row.line; while (row.endLine <= limit && !lines[row.endLine - 1].includes(';')) row.endLine++;
    if (row.endLine > limit) throw Error('NS1 original case has no complete consumer statement');
    if (marker === 'NSI' && forbidden.has(row.name)) {
      const literal = '"' + forbidden.get(row.name) + '"', statement = lines[row.line - 1];
      if (!statement.includes('from ') || statement.indexOf(literal) < 0 || statement.indexOf(literal) !== statement.lastIndexOf(literal)) throw Error('NS1 forbidden route literal missing or duplicated');
      row.forbiddenSpecifier = forbidden.get(row.name); row.moduleStartColumn = statement.indexOf(literal) + 1; row.moduleEndColumn = row.moduleStartColumn + literal.length - 1;
    }
  }
  if (marker === 'NSI' && rows.filter(row => row.forbiddenSpecifier).length !== 4) throw Error('NS1 four exact forbidden routes required');
  return rows;
}, parseDiagnostics: function parseDiagnostics(stdout, stderr, repository, pathAPI) {
  if (stderr !== '') throw Error('NS1 compiler stderr is not empty');
  const rows = []; let current = null;
  for (const raw of stdout.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(raw);
    if (header) {
      const absolute = pathAPI.isAbsolute(header[1]) ? pathAPI.resolve(header[1]) : pathAPI.resolve(repository, header[1]);
      const relative = pathAPI.relative(repository, absolute).replaceAll('\\', '/');
      if (!relative || pathAPI.isAbsolute(relative) || relative === '..' || relative.startsWith('../')) throw Error('NS1 external diagnostic location');
      current = { file: relative, line: Number(header[2]), column: Number(header[3]), code: Number(header[4]), message: header[5] };
      if (![current.line, current.column, current.code].every(value => Number.isSafeInteger(value) && value > 0)) throw Error('NS1 invalid diagnostic coordinates');
      rows.push(current);
    } else if (/\berror TS\d+:/.test(raw)) throw Error('NS1 unlocated compiler diagnostic');
    else if (/^[ \t]+\S/.test(raw) && current) current.message += '\n' + raw;
    else throw Error('NS1 unrecognized compiler stdout line');
  }
  if ((stdout.match(/\berror TS\d+:/g) ?? []).length !== rows.length) throw Error('NS1 unconsumed compiler diagnostic');
  return rows;
}, moduleRefusal: function moduleRefusal(row, cases, marker) {
  if (!/Cannot find module/.test(row.message)) {
    if (/Cannot find type definition file|Cannot read file|Unknown compiler option|Cannot write file|File ['"].*['"] not found/.test(row.message)) throw Error('NS1 compiler setup refusal');
    return false;
  }
  if (marker !== 'NSI' || row.code !== 2307 || !cases.some(item => item.forbiddenSpecifier && row.file === item.file && row.line === item.line
    && row.column >= item.moduleStartColumn && row.column <= item.moduleEndColumn
    && row.message === "Cannot find module '" + item.forbiddenSpecifier + "' or its corresponding type declarations.")) throw Error('NS1 unassigned missing-module refusal');
  return true;
}};
  await (async function ns1TypeGate(frozen, tools) {
  const nsFs = await import('node:fs'), nsCrypto = await import('node:crypto'), nsPath = await import('node:path');
  const nsURL = await import('node:url'), nsModule = await import('node:module'), nsChild = await import('node:child_process');
  const nsRoot = nsPath.resolve(nsURL.fileURLToPath(new URL('..', import.meta.url)));
  const nsHash = bytes => nsCrypto.createHash('sha256').update(bytes).digest('hex');
  const nsRead = pin => {
    if (!pin || typeof pin.path !== 'string' || !pin.path || pin.path.includes('\\') || pin.path.includes(':')
      || pin.path.split('/').some(part => !part || part === '.' || part === '..')) throw Error('NS1 types: nonportable input pin');
    const bytes = nsFs.readFileSync(nsPath.join(nsRoot, pin.path));
    if (bytes.length !== pin.bytes || nsHash(bytes) !== pin.sha256) throw Error('NS1 types: frozen input identity mismatch: ' + pin.path);
    return bytes;
  };
  const nsInventoryBytes = nsRead(frozen), nsInventory = JSON.parse(nsInventoryBytes.toString('utf8'));
  if (nsInventory.schemaVersion !== 1 || nsInventory.compiler?.version !== '7.0.2' || nsInventory.compiler.platform !== process.platform
    || nsInventory.compiler.arch !== process.arch || !Array.isArray(nsInventory.positive?.diagnostics) || nsInventory.positive.diagnostics.length !== 0)
    throw Error('NS1 types: observed strict compiler/positive inventory missing');
  if (JSON.stringify(nsInventory.compiler.wrapperPins?.map(pin => pin.path)) !== JSON.stringify(['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc', 'node_modules/typescript/lib/tsc.js', 'node_modules/typescript/lib/getExePath.js'])) throw Error('NS1 types: canonical compiler wrapper inventory mismatch');
  for (const pin of nsInventory.compiler.wrapperPins) nsRead(pin);
  if (JSON.parse(nsFs.readFileSync(nsPath.join(nsRoot, 'node_modules/typescript/package.json'), 'utf8')).version !== '7.0.2') throw Error('NS1 types: canonical compiler version mismatch');
  const nsRequire = nsModule.createRequire(nsFs.realpathSync(nsPath.join(nsRoot, 'node_modules/typescript/lib/getExePath.js')));
  const nsPlatformName = '@typescript/typescript-' + process.platform + '-' + process.arch;
  const nsPlatformMetadata = nsRequire.resolve(nsPlatformName + '/package.json');
  const nsNative = nsPath.join(nsPath.dirname(nsPlatformMetadata), 'lib', process.platform === 'win32' ? 'tsc.exe' : 'tsc');
  for (const [file, pin] of [[nsPlatformMetadata, nsInventory.compiler.nativePlatform.package], [nsNative, nsInventory.compiler.nativePlatform.executable]]) {
    const bytes = nsFs.readFileSync(file); if (bytes.length !== pin.bytes || nsHash(bytes) !== pin.sha256) throw Error('NS1 types: actual native compiler owner changed');
  }
  const nsMetadata = JSON.parse(nsFs.readFileSync(nsPlatformMetadata, 'utf8'));
  if (nsMetadata.name !== nsPlatformName || nsMetadata.version !== '7.0.2') throw Error('NS1 types: native compiler platform/version mismatch');
  const nsConfigPaths = ['tsconfig.base.json', 'tests/types/tsconfig.json', 'tests/types/tsconfig.dom-free.json', 'tests/types/tsconfig.web.json'];
  if (JSON.stringify(nsInventory.configurationPins?.map(pin => pin.path)) !== JSON.stringify(nsConfigPaths)) throw Error('NS1 types: exact configuration inventory mismatch');
  for (const pin of nsInventory.configurationPins) nsRead(pin);
  const nsBase = JSON.parse(nsFs.readFileSync(nsPath.join(nsRoot, nsConfigPaths[0]), 'utf8'));
  const nsShared = JSON.parse(nsFs.readFileSync(nsPath.join(nsRoot, nsConfigPaths[1]), 'utf8'));
  const nsDOMFree = JSON.parse(nsFs.readFileSync(nsPath.join(nsRoot, nsConfigPaths[2]), 'utf8'));
  const nsWeb = JSON.parse(nsFs.readFileSync(nsPath.join(nsRoot, nsConfigPaths[3]), 'utf8'));
  if (nsBase.compilerOptions?.strict !== true || nsBase.compilerOptions.noUncheckedIndexedAccess !== true
    || nsBase.compilerOptions.moduleResolution !== 'NodeNext' || JSON.stringify(nsBase.compilerOptions.lib) !== JSON.stringify(['ES2022'])
    || JSON.stringify(nsBase.compilerOptions.types) !== '[]' || nsShared.extends !== '../../tsconfig.base.json' || nsShared.compilerOptions?.noEmit !== true
    || nsDOMFree.extends !== './tsconfig.json' || nsWeb.extends !== './tsconfig.json' || JSON.stringify(nsWeb.compilerOptions?.lib) !== JSON.stringify(['ES2022', 'DOM'])) throw Error('NS1 types: original DOM-free/web strict configuration changed');
  const nsTrials = [
    { name: 'positive', source: 'nine-slice-positive.ts', base: 'tsconfig.dom-free.json', marker: null, count: 0, inventory: nsInventory.positive },
    { name: 'negative', source: 'nine-slice-negative.ts', base: 'tsconfig.dom-free.json', marker: 'NSN', count: 41, inventory: nsInventory.groups?.negative },
    { name: 'import-negative', source: 'nine-slice-import-negative.ts', base: 'tsconfig.web.json', marker: 'NSI', count: 35, inventory: nsInventory.groups?.['import-negative'] },
  ];
  const nsTuple = item => JSON.stringify([item.file, item.line, item.column, item.code, item.message]);
  for (const trial of nsTrials) {
    trial.file = 'tests/types/' + trial.source;
    if (trial.inventory?.fixture?.path !== trial.file) throw Error('NS1 types: wrong original consumer path');
    const bytes = nsRead(trial.inventory.fixture); trial.text = bytes.toString('utf8');
    if (/@ts-(?:expect-error|ignore|nocheck)/.test(trial.text)) throw Error('NS1 types: suppressed diagnostic');
    trial.cases = tools.sourceCases(trial.text, trial.marker, trial.file); trial.expected = trial.marker ? trial.inventory.cases : [];
    if (!Array.isArray(trial.expected) || trial.expected.length !== trial.count || trial.cases.length !== trial.count
      || new Set(trial.expected.map(item => item.name)).size !== trial.count) throw Error('NS1 types: missing original case inventory');
    for (let index = 0; index < trial.expected.length; index++) {
      const item = trial.expected[index], declared = trial.cases[index];
      if (item.name !== declared.name || item.file !== trial.file || !Number.isSafeInteger(item.line) || item.line < declared.line || item.line > declared.endLine
        || !Number.isSafeInteger(item.column) || item.column < 1 || !Number.isSafeInteger(item.code) || item.code < 1 || typeof item.message !== 'string'
        || tools.portableMessage(item.message, nsRoot, process.platform) !== item.message) throw Error('NS1 types: source-case/file/full-message mismatch');
      tools.moduleRefusal(item, trial.cases, trial.marker);
    }
    if (new Set(trial.expected.map(nsTuple)).size !== trial.expected.length) throw Error('NS1 types: duplicate frozen diagnostic tuple');
    trial.config = 'tests/types/nine-slice-' + trial.name + '.gate.generated.json'; trial.physicalConfig = nsPath.join(nsRoot, trial.config);
    const relative = nsPath.relative(nsRoot, trial.physicalConfig);
    if (nsPath.isAbsolute(relative) || relative.startsWith('..') || !relative) throw Error('NS1 types: generated configuration escape');
  }
  // All three conflicts are refused before any NS1 write; only a successfully created file is removed.
  for (const trial of nsTrials) if (nsFs.existsSync(trial.physicalConfig)) throw Error('NS1 types: generated configuration exists');
  const nsEnvironment = { ...process.env };
  for (const key of Object.keys(nsEnvironment)) if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete nsEnvironment[key];
  for (const trial of nsTrials) {
    if (nsFs.existsSync(trial.physicalConfig)) throw Error('NS1 types: generated configuration collision');
    let ownedConfig = false, primary = null, cleanup = null, result;
    try {
      nsFs.writeFileSync(trial.physicalConfig, JSON.stringify({ extends: './' + trial.base, include: [trial.source] }) + '\n', { flag: 'wx' }); ownedConfig = true;
      result = nsChild.spawnSync(process.execPath, [nsPath.join(nsRoot, 'node_modules/typescript/bin/tsc'), '--project', trial.config, '--pretty', 'false'],
        { cwd: nsRoot, encoding: 'utf8', windowsHide: true, env: nsEnvironment, timeout: 30000, maxBuffer: 4194304 });
    } catch (cause) { primary = cause; }
    finally { if (ownedConfig) try { nsFs.rmSync(trial.physicalConfig, { force: false, maxRetries: 0 }); } catch (cause) { cleanup = cause; } }
    if (primary || cleanup) throw new AggregateError([primary, cleanup].filter(Boolean), 'NS1 types: compiler invocation or owned configuration cleanup failed');
    process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
    if (result.error || result.signal !== null || ![0, 1].includes(result.status)) throw result.error ?? Error('NS1 types: interrupted compiler');
    const observed = tools.parseDiagnostics(result.stdout ?? '', result.stderr ?? '', nsRoot, nsPath).map(item => ({ ...item, message: tools.portableMessage(item.message, nsRoot, process.platform) }));
    if (observed.some(item => item.file !== trial.file)) throw Error('NS1 types: unrelated diagnostic file');
    for (const item of observed) tools.moduleRefusal(item, trial.cases, trial.marker);
    if (!trial.marker) { if (result.status !== 0 || observed.length !== 0) throw Error('NS1 types: genuine DOM-free positive failed'); continue; }
    if (result.status !== 1 || observed.length !== trial.expected.length) throw Error('NS1 types: missing/extra diagnostics or negative exit');
    const remaining = new Map(); for (const item of observed) { const key = nsTuple(item), bucket = remaining.get(key) ?? []; bucket.push(item); remaining.set(key, bucket); }
    const receipts = trial.expected.map(item => {
      const key = nsTuple(item), bucket = remaining.get(key); if (bucket?.length !== 1) throw Error('NS1 types: exact file/line/column/code/full-message mismatch: ' + item.name);
      remaining.delete(key); return { name: item.name, expected: item, actual: bucket[0] };
    });
    if (remaining.size) throw Error('NS1 types: duplicate or unassigned diagnostics');
    console.log('NS1 ' + trial.name + ' exact unsuppressed complete diagnostic receipts: ' + JSON.stringify(receipts));
  }
  console.log('NS1 types PASS: original DOM-free positive and complete ordinary/optional-route diagnostics including continuations. Runtime/browser acceptance is separate.');
})(nsFrozenInventory, nsTools);
}
// NS1_TYPES_END

// SEQP_TYPES_BEGIN
// Delegate only after every retained type gate above has completed.
await import('./sequence-playback-types.mjs');
// SEQP_TYPES_END

// SPRITESHEET_TYPES_BEGIN
// Run the mandatory SpriteSheet lane only after every retained type gate has completed.
await import('./spritesheet-types.mjs');
// SPRITESHEET_TYPES_END

// NLB_TYPES_BEGIN
// Retain every previous strict lane before checking the new display leaf.
await import('./nine-slice-bitmap-types.mjs');
// NLB_TYPES_END

// DCA_TYPES_BEGIN
// Run both mandatory public consumer lanes after every retained strict type owner.
await import('./display-container-remove-children-types.mjs');
// DCA_TYPES_END

// CGI_TYPES_BEGIN
// Run the direct-child query consumers only after every retained strict type lane.
await import('./display-container-child-index-types.mjs');
// CGI_TYPES_END

// ADI_TYPES_BEGIN
// Run indexed insertion consumers after every retained strict type owner.
await import('./display-container-add-child-at-types.mjs');
// ADI_TYPES_END

// AO_TYPES_BEGIN
// Check inherited anchor scalars after every retained strict type owner.
await import('./display-anchor-offsets-types.mjs');
// AO_TYPES_END

// BITMAP_BUTTON_TYPES_BEGIN
// Preserve every retained strict lane before checking the optional Button contract.
await import('./bitmap-button-types.mjs');
// BITMAP_BUTTON_TYPES_END

// LINEAR_LAYOUT_TYPES_BEGIN
// Run the optional planner consumers only after every retained strict type lane.
await import('./linear-layout-types.mjs');
// LINEAR_LAYOUT_TYPES_END

// BITMAP_RESOURCE_SLOT_TYPES_BEGIN
// Preserve every retained strict lane before checking resource-slot consumers.
await import('./bitmap-resource-slot-types.mjs');
// BITMAP_RESOURCE_SLOT_TYPES_END

// BITMAP_BINDING_TICKET_TYPES_BEGIN
// Preserve retained strict lanes before replaying borrowed binding-ticket consumers.
await import('./bitmap-binding-ticket-types.mjs');
// BITMAP_BINDING_TICKET_TYPES_END

// Preserve retained strict lanes before the explicit atlas-layout extension.
await import('./atlas-frame-types.mjs');

// Preserve every retained strict lane before the optional atlas importer.
await (await import('./atlas-import-types.mjs')).runAtlasImportTypes();

// Preserve every existing strict lane before the shared-profile consumers.
await import('./shared-render-types.mjs');
await import('./shared-webgl2-types.mjs');
