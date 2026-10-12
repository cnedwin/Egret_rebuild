import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const root = fileURLToPath(new URL("..", import.meta.url));
const compiler = path.join(root, "node_modules/typescript/bin/tsc");
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
  const meshReceipts = expectedMesh.map(expectedCase => {
    const atLocation = observedGeometry.filter(actual => actual.file === expectedCase.file && actual.line === expectedCase.line);
    const matching = atLocation.filter(actual => actual.code === expectedCase.code);
    if (atLocation.length !== 1 || matching.length !== 1) throw new Error(`Mesh negative ${expectedCase.name}: expected exactly one ${expectedCase.file}:${expectedCase.line} / TS${expectedCase.code}; got ${JSON.stringify(atLocation)}`);
    return {name:expectedCase.name,expected:expectedCase,actual:matching[0]};
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
    const expected=isNegative?sceneTypeExpectations.cases[name]:[];
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
    const check=spawnSync(process.execPath,[compiler,'--project',config,'--pretty','false'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
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
