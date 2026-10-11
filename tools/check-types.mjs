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
