import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const expected = {
  contracts: [],
  runtime: ["@egret/contracts"],
  engine: ["@egret/contracts", "@egret/runtime"],
  project: ["@egret/contracts"],
};
// External root imports are audited separately from the internal workspace DAG/references.
const external = { engine: { 'robust-predicates': '3.0.3' }, project: { 'jsonc-parser': '3.3.1' } };
const projectValues = ['DEFAULT_PROJECT_LIMITS', 'createProjectStore', 'openProjectHistory', 'parseProjectSnapshot', 'parseProjectTransaction', 'serializeProjectSnapshot'];
const projectTypes = ['ProjectId', 'EntityId', 'FileId', 'TransactionId', 'ProjectRevision', 'Sha256', 'JsonValue', 'JsonObject', 'ProjectVersionPins', 'ProjectReference', 'ProjectEntity', 'ProjectFileRole', 'ProjectFile', 'ProjectSnapshot', 'ProjectTransactionSource', 'ProjectTransactionScope', 'ProjectOperation', 'ProjectEditTransaction', 'ProjectRestoreTransaction', 'ProjectTransaction', 'ProjectHistory', 'ProjectDiff', 'ProjectDiagnosticCode', 'ProjectDiagnostic', 'ProjectValueResult', 'ProjectTransactionReceipt', 'ProjectCommitResult', 'ProjectLimits', 'ProjectStore'];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? files(file) : [file];
  });
}
let inspected = 0;
const forbidden = /\b(?:document|window|HTMLCanvasElement|GPUDevice|process|Buffer|require)\b|["']node:/;
for (const [name, allowed] of Object.entries(expected)) {
  const dir = path.join(root, "packages", name);
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const dependencies = Object.keys(pkg.dependencies ?? {}).sort();
  const registryImports = { '#egret-textured-frame-state': { types: './dist/internal/texturedFrameState.d.ts', import: './dist/internal/texturedFrameState.js' } };
  if (name === 'engine') {
    if (JSON.stringify(pkg.imports) !== JSON.stringify(registryImports)) throw new Error('engine: private textured registry mapping mismatch');
  } else if (pkg.imports !== undefined) throw new Error(`${name}: unexpected private import mapping`);
  const externalAllowed = Object.hasOwn(external, name) ? external[name] : {};
  const internalDependencies = dependencies.filter(dependency => !Object.hasOwn(externalAllowed, dependency));
  if (JSON.stringify(internalDependencies) !== JSON.stringify(allowed)) throw new Error(`${name}: dependency DAG mismatch`);
  for (const [dependency, version] of Object.entries(externalAllowed)) if (pkg.dependencies[dependency] !== version) throw new Error(`${name}: external exact pin mismatch`);
  if (!pkg.private || pkg.version !== "0.0.0" || pkg.type !== "module") throw new Error(`${name}: private prototype metadata mismatch`);
  if (name === 'project' && JSON.stringify(pkg.exports) !== JSON.stringify({'.': {types:'./dist/index.d.ts', import:'./dist/index.js'}})) throw new Error('project: root export mapping mismatch');
  if (name === 'runtime' || name === 'engine') {
    const textExports = name === 'runtime' ? {
      '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
      './text': {types:'./dist/text/index.d.ts',import:'./dist/text/index.js'},
    } : {
      '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
      './webgpu': {types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'},
      './web': {types:'./dist/web/index.d.ts',import:'./dist/web/index.js'},
      './text': {types:'./dist/text.d.ts',import:'./dist/text.js'},
    };
    if (JSON.stringify(Object.keys(pkg.exports ?? {}).sort()) !== JSON.stringify(Object.keys(textExports).sort())
        || Object.entries(textExports).some(([entry, mapping]) => JSON.stringify(pkg.exports[entry]) !== JSON.stringify(mapping)))
      throw new Error(`${name}: text explicit export mapping mismatch`);
  }
  for (const dependency of dependencies) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(dependency)});`], { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${name}: ESM dependency resolution failed: ${result.stderr}`);
  }
  for (const file of [...files(path.join(dir, "src")), ...files(path.join(dir, "dist")), ...(name === 'engine' ? [...files(path.join(dir, 'web')), ...files(path.join(dir, 'rendering'))] : [])]) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
    const raw = readFileSync(file, "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const web = name === 'engine' && (file.startsWith(path.join(dir, 'web') + path.sep) || file.startsWith(path.join(dir, 'dist', 'web') + path.sep));
    const rendering = name === 'engine' && (file.startsWith(path.join(dir, 'rendering') + path.sep) || file.startsWith(path.join(dir, 'dist', 'rendering') + path.sep));
    const projectFoundation = name === 'project' && ['json-foundation.ts', 'json-foundation.js', 'json-foundation.d.ts'].includes(path.basename(file));
    // Raw triple-slash references are compiler dependencies, even though ordinary
    // comments are removed below. Project declarations must stay DOM/Node-free.
    if (name === 'project' && (/\b(?:HTMLElement|HTMLCanvasElement|Document|Window|Navigator|NodeJS|GPUDevice)\b/.test(code) || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))) throw new Error(`${path.relative(root, file)}: host ambient dependency`);
    if ((web ? /\b(?:process|Buffer|require)\b|["']node:/ : forbidden).test(code)) throw new Error(`${path.relative(root, file)}: host ambient dependency`);
    // Consume complete ordinary quoted strings before recognizing import clauses.
    // This bounded lexical scan retains the existing import policies and reasons.
    for (const match of code.matchAll(/"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*'|\b(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g)) {
      const imported = match[1];
      if (!imported) continue;
      if (imported.startsWith(".")) {
        if (!path.resolve(path.dirname(file), imported).startsWith(`${dir}${path.sep}`)) throw new Error(`${file}: crosses package by relative path`);
      } else if (imported === '#egret-textured-frame-state') {
        // Only these two first-party adapters may share the Engine-owned registry.
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['web/CanvasHost.ts', 'web/WebGPUHost.ts', 'dist/web/CanvasHost.js', 'dist/web/WebGPUHost.js'].includes(relative)) throw new Error(`${file}: private textured registry import outside approved adapters`);
      } else if (imported === '@egret/runtime/text') {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['src/text.ts', 'dist/text.js', 'dist/text.d.ts'].includes(relative)) throw new Error(`${file}: unapproved/deep package import ${imported}`);
      } else if (!allowed.includes(imported) && !((rendering || projectFoundation) && Object.hasOwn(external, name) && Object.hasOwn(externalAllowed, imported))) throw new Error(`${file}: unapproved/deep package import ${imported}`);
    }
    inspected++;
  }
  const tsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  if (tsconfig.extends !== "../../tsconfig.base.json") throw new Error(`${name}: shared strict baseline missing`);
  const references = (tsconfig.references ?? []).map((entry) => entry.path).sort();
  const expectedReferences = allowed.map((dependency) => `../${dependency.slice("@egret/".length)}`).sort();
  if (JSON.stringify(references) !== JSON.stringify(expectedReferences)) throw new Error(`${name}: project references mismatch`);
  if (name === 'project' && JSON.stringify(tsconfig.compilerOptions) !== JSON.stringify({rootDir:'src',outDir:'dist'})) throw new Error('project: strict compilation boundary mismatch');
  if (name === 'engine') {
    const webConfig = JSON.parse(readFileSync(path.join(dir, 'tsconfig.web.json'), 'utf8'));
    if (webConfig.extends !== '../../tsconfig.base.json' || webConfig.compilerOptions.rootDir !== 'web' || webConfig.compilerOptions.outDir !== 'dist/web' || JSON.stringify(webConfig.compilerOptions.lib) !== JSON.stringify(['ES2022', 'DOM']) || JSON.stringify(webConfig.include) !== JSON.stringify(['web/**/*.ts'])) throw new Error('engine: approved web compilation boundary mismatch');
    const webReferences = webConfig.references.map(entry => entry.path).sort();
    if (JSON.stringify(webReferences) !== JSON.stringify([...expectedReferences, './tsconfig.rendering.json', './tsconfig.json'].sort())) throw new Error('engine: web dependency references mismatch');
    const renderingConfig = JSON.parse(readFileSync(path.join(dir, 'tsconfig.rendering.json'), 'utf8'));
    const renderingOptions = { composite: true, types: [], lib: ['ES2022'], rootDir: 'rendering', outDir: 'dist/rendering', tsBuildInfoFile: 'tsconfig.rendering.tsbuildinfo' };
    if (renderingConfig.extends !== '../../tsconfig.base.json' || JSON.stringify(renderingConfig.compilerOptions) !== JSON.stringify(renderingOptions) || JSON.stringify(renderingConfig.include) !== JSON.stringify(['rendering/**/*.ts']) || JSON.stringify(renderingConfig.references) !== JSON.stringify([{path:'../contracts'}])) throw new Error('engine: DOM-free rendering compilation boundary mismatch');
    for (const file of files(path.join(dir, 'src'))) {
      if (/['"][^'"]*(?:\/(?:web|rendering)\/|\/(?:web|rendering)['"])/.test(readFileSync(file, 'utf8'))) throw new Error('engine: root imports adapter/preparation subtree');
    }
  }
}
const projectFacade = await import('@egret/project');
if (JSON.stringify(Object.keys(projectFacade)) !== JSON.stringify(projectValues)) throw new Error('project: runtime export surface mismatch');
const projectDeclaration = readFileSync(path.join(root, 'packages/project/dist/index.d.ts'), 'utf8').replace(/\/\/[^\n]*/g, '');
const typeExports = [...projectDeclaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const valueExports = [...projectDeclaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const declarationRemainder = projectDeclaration.replace(/export(?: type)?\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '').trim();
if (JSON.stringify(typeExports) !== JSON.stringify([...projectTypes].sort()) || JSON.stringify(valueExports) !== JSON.stringify(projectValues) || declarationRemainder) throw new Error('project: type-only export surface mismatch');
const facade = await import("@egret/engine");
const webFacade = await import('@egret/engine/web');
const gpuFacade = await import('@egret/engine/webgpu');
const contractsFacade = await import(new URL('../packages/contracts/dist/index.js', import.meta.url));
const runtimeFacade = await import(new URL('../packages/runtime/dist/index.js', import.meta.url));
// Mesh is one runtime singleton. Its slot module and authority stay private on
// every entry, including type-only declarations and aliased module re-exports.
const meshPrivate = ['MeshCaptureState', 'hasMeshState', 'readMeshState', 'writeMeshState'];
const meshEntries = [
  ['contracts', contractsFacade, 'packages/contracts/dist/index'],
  ['root', facade, 'packages/engine/dist/index'],
  ['web', webFacade, 'packages/engine/dist/web/index'],
  ['webgpu', gpuFacade, 'packages/engine/dist/web/webgpu'],
  ['runtime', runtimeFacade, 'packages/runtime/dist/index'],
];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  for (const name of meshPrivate) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private Mesh authority leaked: ${name}`);
  if (/\bmeshDisplayState\b/.test(declaration + '\n' + emitted)) throw new Error(`${entry}: private Mesh state module leaked`);
}
if (typeof runtimeFacade.Mesh2D !== 'function') throw new Error('runtime: public Mesh2D singleton missing');
if (typeof facade.Mesh2D !== 'function') throw new Error('root: public Mesh2D singleton missing');
if (facade.Mesh2D !== runtimeFacade.Mesh2D) throw new Error('root: Mesh2D runtime identity mismatch');
for (const [entry, values] of [['contracts', contractsFacade], ['web', webFacade], ['webgpu', gpuFacade]]) if ('Mesh2D' in values) throw new Error(`${entry}: public Mesh2D value belongs only to runtime/root`);
for (const [entry, declarationPath, target] of [
  ['root', 'packages/engine/dist/index.d.ts', '@egret/runtime'],
  ['runtime', 'packages/runtime/dist/index.d.ts', './Mesh2D.js'],
]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const exports = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].flatMap(match => match[2].split(',').filter(name => name.trim() === 'Mesh2D').map(() => ({typeOnly:!!match[1], target:match[3]})));
  if (exports.length !== 1 || exports[0].typeOnly || exports[0].target !== target) throw new Error(`${entry}: exact Mesh2D value declaration re-export mismatch`);
}
const meshStateSource = readFileSync(path.join(root, 'packages/runtime/src/meshDisplayState.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
for (const match of meshStateSource.matchAll(/\bimport\b/g)) if (!/^import\s+type\b/.test(meshStateSource.slice(match.index))) throw new Error('runtime: Mesh state source imports must be type-only');
const meshStateEmitted = readFileSync(path.join(root, 'packages/runtime/dist/meshDisplayState.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
if (/\bimport\b|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["']/.test(meshStateEmitted)) throw new Error('runtime: Mesh state emitted value import/backedge');
const meshStateDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/meshDisplayState.d.ts'), 'utf8');
const meshStateNames = [...meshStateDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(meshStateNames) !== JSON.stringify([...meshPrivate].sort())) throw new Error('runtime: Mesh state private declaration surface mismatch');
// Task 5 entry controls; Mesh guards above retain their existing reasons.
const texturedPrivate = ['registerTexturedFrame', 'readOwnedTexturedFrame', 'texturedRenderFrame2DBrand', 'createTexturedRenderFrame2D', 'CapturedEngineFramePorts', 'startEngine', 'TexturedCaptureBudget', 'admitTree', 'referencedTuples', 'flattenClips', 'readMeshCaptureImage', 'observeRejectedRenderResult'];
const texturedPrivateModules = ['texturedFrameState', 'texturedFrameBudget', 'meshCaptureSnapshot'];
const texturedWorkspaceNames = ['collectTexturedFrameContent', 'CapturedTexturedContent2D'];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  for (const name of texturedPrivate) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private textured-frame authority leaked: ${name}`);
  for (const name of texturedPrivateModules) if (new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private textured-frame module leaked: ${name}`);
  if (entry !== 'runtime') for (const name of texturedWorkspaceNames) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: textured-frame workspace port leaked: ${name}`);
}
const texturedRegistryEmitted = readFileSync(path.join(root, 'packages/engine/dist/internal/texturedFrameState.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
if (/\bimport\b|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["']/.test(texturedRegistryEmitted)) throw new Error('engine: completed-frame registry emitted import/backedge');

// New typed GPU host ports stay on their explicit entry; private implementation
// names and module paths cannot be hidden by a public alias or type-only export.
const privateTexturedGPU = [
  'TexturedPreparationLimits2D', 'TexturedPreparationSnapshot2D', 'TexturedPreparationBudget2D',
  'MeshPoint2D', 'MeshClipPolicy2D', 'createMeshClipPolicy2D', 'MeshStageCounters2D',
  'PreparedMesh2D', 'attachTexturedMeshAttributes2D', 'prepareTexturedMesh2D',
  'PackedTexturedMesh2D', 'TexturedMeshPackingAllocationError', 'packTexturedMesh2D',
  'AdmittedTexturedCommand2D', 'TexturedFrameAdmission2D', 'PreparedTexturedDraw2D', 'prepareTexturedDraws2D',
  'TexturedFrameAdmissionOptions2D', 'TexturedFrameAdmissionError2D', 'admitTexturedFrame2D',
  'noteOwnedPreparationFailure', 'runOwnedPreparationScope',
  'TexturedSubmissionStorageOptions2D', 'TexturedSubmissionHardware2D', 'TexturedSubmissionOwnerSnapshot2D',
  'TexturedSubmissionRequest2D', 'TexturedDrawStorage2D', 'TexturedSubmissionStorage2D',
  'PackedTexturedDraw2D', 'TexturedPayloadOperations2D', 'TexturedSubmissionAdmissionError2D',
  'isTexturedSubmissionAdmissionError2D', 'planTexturedSubmissionStorage2D', 'FIRST_PARTY_OPERATIONS',
  'TexturedSubmissionPlan2D', 'prepareTexturedSubmission2D',
  'planTexturedImageProjections', 'createWebGPUTexturedPipeline', 'createWebGPUTexturedMeshPipeline', 'encodeWebGPUTexturedMesh',
  'TEXTURED_MODE', 'TEXTURED_OWNERS', 'TEXTURED_OPTIONS', 'TEXTURED_FUNCTIONS', 'TEXTURED_LIMITS',
  'SharedSubmissionPlan2D', 'TexturedConfiguration', 'TexturedWebGPUConfiguration', 'admitTexturedWebGPUOptions',
  'createTexturedWebGPUHostInternal',
];
const privateTexturedGPUModules = [
  'texturedPreparationBudget2D', 'prepareTexturedMesh2D', 'packTexturedMesh2D',
  'prepareTexturedDraws2D', 'admitTexturedFrame2D', 'ownedPreparationFailure2D',
  'prepareTexturedSubmission2D', 'texturedWebGPUOptions', 'webgpuTexturedPass', 'webgpuTexturedMeshPass',
];
const publicTexturedGPUTypes = ['TexturedWebGPUHost', 'TexturedWebGPUHostOptions', 'TexturedWebGPUHostStatus'];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  const text = declaration + '\n' + emitted;
  for (const name of privateTexturedGPU) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': private textured GPU port leaked: '+name);
  for (const name of privateTexturedGPUModules) if (new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': private textured GPU module leaked: '+name);
  if (entry !== 'webgpu') for (const name of publicTexturedGPUTypes) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': GPU-only textured host type leaked: '+name);
}
if (JSON.stringify(Object.keys(gpuFacade)) !== JSON.stringify(['createTexturedWebGPUHost', 'createWebGPUHost'])) throw new Error('webgpu facade leaks private helpers');
const gpuExport = JSON.parse(readFileSync(path.join(root, 'packages/engine/package.json'), 'utf8')).exports['./webgpu'];
if (JSON.stringify(gpuExport) !== JSON.stringify({types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'})) throw new Error('webgpu export mapping mismatch');
if (['createTexturedWebGPUHost', 'createWebGPUHost'].some(name => name in facade || name in webFacade)) throw new Error('GPU factory leaks root/Canvas boundary');
if (JSON.stringify(Object.keys(webFacade)) !== JSON.stringify(['createCanvasHost'])) throw new Error('web facade leaks internal ports');
if ('createCanvasHost' in facade) throw new Error('root facade leaks Canvas entry');
const imageValues = ['IMAGE_LIMITS_2D', 'copyImageData2DPixels', 'createImageData2D', 'isImageData2D'];
const geometryValues = ['createTexturedGeometry2D', 'isTexturedGeometry2D'];
const geometryTypes = ['TexturedFloatArray2D', 'TexturedIndexArray2D', 'TexturedGeometry2DInput', 'TexturedGeometry2D'];
const contractValues = [...imageValues, ...geometryValues, 'TEXTURED_FRAME_PROFILE_2D'].sort();
if (JSON.stringify(Object.keys(contractsFacade)) !== JSON.stringify(contractValues)) throw new Error('contracts: executable image/geometry export surface mismatch');
for (const name of imageValues) if (facade[name] !== contractsFacade[name]) throw new Error(`engine: image contract identity mismatch: ${name}`);
for (const name of geometryValues) if (typeof contractsFacade[name] !== 'function' || facade[name] !== contractsFacade[name]) throw new Error(`engine: geometry contract identity mismatch: ${name}`);
// Literal equality checks the protocol value; owned-frame singleton evidence
// requires actual Engine captures and first-party host refusal in later stages.
if (contractsFacade.TEXTURED_FRAME_PROFILE_2D !== 'egret.textured-frame2d/1' || facade.TEXTURED_FRAME_PROFILE_2D !== contractsFacade.TEXTURED_FRAME_PROFILE_2D) throw new Error('engine: textured profile literal mismatch');
// Exact accepted Mesh root plus the opt-in factory and shared literal.
const texturedRootValues = ['Engine', 'createEngine', 'createEngineForProfile', 'CancellationController', 'EgretError', 'Event', 'createEventType', 'EventDispatcher', 'DisplayObject', 'DisplayObjectContainer', 'Scope', 'Stage', 'AssetManager', 'AssetLease', 'createAssetType', 'createAssetRef', 'Sprite', 'Graphics', ...imageValues, ...geometryValues, 'TEXTURED_FRAME_PROFILE_2D', 'Texture', 'createTexture', 'isTexture', 'Bitmap', 'Mesh2D', 'createSequenceClip', 'SequencePlayer'].sort();
if (typeof facade.createEngineForProfile !== 'function' || JSON.stringify(Object.keys(facade)) !== JSON.stringify(texturedRootValues)) throw new Error('root: executable textured-frame export surface mismatch');
const texturedTypes = ['TexturedFrameProfile2D', 'TexturedMeshCommand2D', 'TexturedRenderCommand2D', 'TexturedRenderFrame2D', 'TexturedRenderHostAdapter'];
for (const [entry, values, declarationPath] of [['contracts', contractsFacade, 'packages/contracts/dist/index.d.ts'], ['root', facade, 'packages/engine/dist/index.d.ts']]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const names = [...declaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
  for (const name of texturedTypes) if (name in values || names.filter(value => value === name).length !== 1) throw new Error(`${entry}: textured-frame type-only export mismatch: ${name}`);
}
const texturedModuleDeclaration = readFileSync(path.join(root, 'packages/contracts/dist/TexturedRenderFrame2D.d.ts'), 'utf8');
const texturedModuleNames = [...texturedModuleDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(texturedModuleNames) !== JSON.stringify(['TEXTURED_FRAME_PROFILE_2D', ...texturedTypes].sort())) throw new Error('contracts: textured-frame declaration surface mismatch');
const texturedRuntimeDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8');
const texturedRuntimePorts = [...texturedRuntimeDeclaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].flatMap(match => match[2].split(',').map(name => ({name:name.trim(),typeOnly:!!match[1],target:match[3]})));
for (const [name, typeOnly] of [['collectTexturedFrameContent', false], ['CapturedTexturedContent2D', true]]) {
  const ports = texturedRuntimePorts.filter(port => port.name === name);
  if (ports.length !== 1 || ports[0].typeOnly !== typeOnly || ports[0].target !== './texturedFrameCapture.js' || (typeOnly ? name in runtimeFacade : typeof runtimeFacade[name] !== 'function')) throw new Error(`runtime: low-level textured capture port mismatch: ${name}`);
}

for (const [entry, values, declarationPath] of [
  ['contracts', contractsFacade, 'packages/contracts/dist/index.d.ts'],
  ['root', facade, 'packages/engine/dist/index.d.ts'],
]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const types = [...declaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
  for (const name of geometryTypes) if (name in values || types.filter(type => type === name).length !== 1) throw new Error(`${entry}: geometry type-only export mismatch: ${name}`);
}
// The owned value module exposes precisely the six specified names. Its private
// identity symbol/registry and capacity policy are not public declarations.
const geometryDeclaration = readFileSync(path.join(root, 'packages/contracts/dist/TexturedGeometry2D.d.ts'), 'utf8');
const geometryDeclaredNames = [...geometryDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(geometryDeclaredNames) !== JSON.stringify([...geometryTypes, ...geometryValues].sort())) throw new Error('contracts: geometry declaration surface mismatch');
// Private rectangle and future mixed/image preparation ports remain unavailable
// on every public entry, in runtime values and emitted declaration exports.
const privateRendering = ['RectangleFrame2D', 'copyFrame2D', 'copyCanvasFrame', 'prepareRectangles2D', 'FrameCopyOptions', 'RectanglePreparationOptions', 'PreparedRectangles2D', 'FrameCopyError', 'FrameInputReadError', 'GeometryPreparationError', 'copyMixedFrame2D', 'imageFrameBudget', 'prepareImages2D', 'packImageVertices2D', 'CapturedContent2D', 'collectFrameContent', 'Matrix4', 'Vector4', 'Math3DErrorCode', 'Math3DError', 'createMatrix4', 'createVector4', 'multiplyMatrix4', 'transformHomogeneous4', 'DepthRange3D', 'DepthDirection3D', 'DepthConvention3D', 'Projection3D', 'createPerspectiveProjection3D', 'createOrthographicProjection3D', 'MeshGeometry3D', 'MeshGeometry3DErrorCode', 'MeshGeometry3DError', 'MeshGeometry3DErrorOrigin', 'createMeshGeometry3D', 'isMeshGeometry3D', 'getMeshGeometry3DErrorOrigin', 'PackedMeshGeometry3D', 'MeshPacking3DErrorCode', 'MeshPacking3DErrorOrigin', 'MeshPacking3DError', 'packMeshGeometry3D', 'getMeshPacking3DErrorOrigin', 'SceneProjectionInput3D', 'SceneDrawInput3D', 'SceneInput3D', 'SceneDraw3D', 'SceneFrame3D', 'createSceneFrame3D', 'isSceneFrame3D', 'Scene3DErrorOrigin', 'Scene3DErrorCode', 'Scene3DError', 'getScene3DErrorOrigin', 'B1SceneStatus', 'B1WebGPUHost', 'createB1WebGPUHost', 'createB1WebGPUHostInternal', 'B1BuiltinProtocol', 'getBuiltinB1Protocol', 'isBuiltinB1Protocol', 'createWebGPUMeshPipeline', 'encodeWebGPUMesh'];
const privateCapture = ['isStageRoot', 'CaptureImageBudget', 'BitmapCaptureState', 'bitmapCaptureState', 'readBitmapImage', 'TextureSnapshot2D', 'readTextureSnapshot', 'isAssetLease', 'readAssetLeaseValue'];
const privateCoordinates = ['composeDisplayTransform', 'queryDisplayPoint', 'invertCoordinatePoint', 'decodeFiniteDyadic', 'sumDyadicProducts', 'roundDyadicRatio', 'Dyadic'];
const privateBounds = ['queryDisplayBounds', 'hasBitmapState', 'readBitmapState', 'writeBitmapState', 'childCountOf', 'childAtOf'];
for (const [entry, values] of [['contracts', contractsFacade], ['root', facade], ['web', webFacade], ['webgpu', gpuFacade]]) {
  const declarationPath = entry === 'contracts' ? 'packages/contracts/dist/index.d.ts' : entry === 'root' ? 'packages/engine/dist/index.d.ts' : `packages/engine/dist/web/${entry === 'web' ? 'index' : 'webgpu'}.d.ts`;
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  for (const name of [...privateRendering, ...privateCapture, ...privateCoordinates, ...privateBounds]) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration)) throw new Error(`${entry}: private rendering port leaked: ${name}`);
}
const runtimeDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8');
if (typeof runtimeFacade.collectFrameContent !== 'function' || !/export type\s*\{\s*CapturedContent2D\s*\}/.test(runtimeDeclaration)) throw new Error('runtime: low-level capture port missing');
for (const name of [...privateCapture, ...privateCoordinates, ...privateBounds]) if (name in runtimeFacade || new RegExp(`\\b${name}\\b`).test(runtimeDeclaration)) throw new Error(`runtime: private authority leaked: ${name}`);
for (const internal of ["collectFrameCommands", "createScope", "createStage", "constructEngine", "createAssetManager", "createAssetLease", "revokeAssetLease", "assertAssetRef", "assertAssetType", "reportDiagnostic", "bind", "engineOf", "ownerOf"]) {
  if (internal in facade) throw new Error(`Internal lifecycle port leaked: ${internal}`);
}
// Keep retained private-port reasons above this exact type-only facade check.
const expectedGPUTypeNames = [
  'WebGPUHost', 'WebGPUHostState', 'WebGPUHostErrorCode', 'WebGPUHostFailure',
  'WebGPUHostDiagnostic', 'WebGPUHostOptions', 'WebGPUReadback', 'WebGPUHostStatus',
  ...publicTexturedGPUTypes,
].sort();
const gpuDeclaration = readFileSync(path.join(root, 'packages/engine/dist/web/webgpu.d.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const actualGPUTypeNames = [...gpuDeclaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const actualGPUValueNames = [...gpuDeclaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const gpuDeclarationRemainder = gpuDeclaration.replace(/export(?: type)?\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '').trim();
if (JSON.stringify(actualGPUTypeNames) !== JSON.stringify(expectedGPUTypeNames) || JSON.stringify(actualGPUValueNames) !== JSON.stringify(['createTexturedWebGPUHost', 'createWebGPUHost']) || gpuDeclarationRemainder) throw new Error('webgpu: exact type-only host export surface mismatch');

// T1 adds one exact explicit DOM-free entry. Every retained rule above remains.
const textPublicTypes = [
  'TextRasterRequestInput','TextSourceLine','TextRasterRequest','TextBounds2D','TextLineMetricsInput',
  'TextPlanInput','TextLineMetrics','TextRasterPlacement','TextRasterMetrics','TextRasterPlan','TextRasterLimits',
  'TextMeasureContext','TextRasterContext','TextRasterProvider','TextRasterCacheOptions','TextRasterAcquireOptions',
  'PreparedTextRaster','TextRasterCacheStatus','TextRasterCache',
];
const textPrivate = [
  'registerAssetManagerOwner','requireAssetManagerOwner','beginTextCacheCreation','commitTextCacheLifetime',
  'markAssetManagerOwnerClosed','closeOwnedTextCache','observeAssetLeaseRetirement',
  'TextValueInvocation','TextValueFailureCode','TextValueFailure','TextRasterRequestSnapshot','TextRasterRequestSummary',
  'createTextValueInvocation','closeTextValueInvocation','createTextValueFailure','takeTextValueFailure',
  'snapshotTextRasterRequest','summarizeTextRasterRequest','createOwnedTextRasterRequest',
  'isOwnedTextRasterRequest','requireOwnedTextRasterRequest','matchesTextRasterRequestSummary',
  'TextRasterPlanIssuer','createTextRasterPlanIssuer','closeTextRasterPlanIssuer','readIssuedTextRasterPlan','requireIssuedTextRasterPlan',
  'TextBudgetLimits','TextBudgetCounters','TextBudgetDelta','TextBudgetFailure','TextBudget','TEXT_BUDGET_DEFAULTS','TEXT_BUDGET_MINIMA',
  'requestBrand','planBrand','cacheBrand',
  'registerTextFieldEngine','requireTextFieldEngine','TextFieldEnginePort',
  'createTextFieldLeaf','TextFieldLeaf','TextFieldCachePort','createTextFieldRequestInput',
  'TextFieldCommittedDisplay','TextFieldDisplayState','hasTextFieldState','readTextFieldState','writeTextFieldState','assertTextFieldScope',
];
const runtimeText = await import('@egret/runtime/text');
const engineText = await import('@egret/engine/text');
const textEntries = [...meshEntries,
  ['runtime/text',runtimeText,'packages/runtime/dist/text/index'],
  ['engine/text',engineText,'packages/engine/dist/text'],
];
// Engine-owned clock extends only the root type surface. Preserve every retained
// reason above; admission and owner helpers remain same-package private details.
const clockPublicTypes = ['GameClockOptions','GameClockState','GameClockTick','GameClockHandler','GameClock','GameClockSubscription'];
const clockPrivate = ['admitGameClockOptions','createGameClockOwner','AdmittedGameClockOptions','GameClockContext','GameClockOwner','clockBrand','subscriptionBrand','createGameClock'];
for (const [entry, values, emittedEntry] of [...textEntries, ['project',projectFacade,'packages/project/dist/index']]) {
  const declaration = readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted = readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source = declaration+'\n'+emitted;
  for (const name of clockPrivate) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: private clock authority leaked: ${name}`);
  if (/["'][^"']*(?:^|\/)gameClock(?:\.js|["'])/.test(source)) throw new Error(`${entry}: private clock module leaked`);
  if (entry !== 'root') {
    for (const name of clockPublicTypes) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: Engine-only clock type leaked: ${name}`);
    if (/["'][^"']*(?:^|\/)gameClockTypes(?:\.js|["'])/.test(source)) throw new Error(`${entry}: Engine-only clock types module leaked`);
  } else {
    const clockPorts = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match => match[3] === './gameClockTypes.js');
    if (clockPorts.length !== 1 || !clockPorts[0][1] || JSON.stringify(clockPorts[0][2].split(',').map(name=>name.trim()).sort()) !== JSON.stringify([...clockPublicTypes].sort()) || clockPublicTypes.some(name=>name in values)) throw new Error('root: exact clock type-only export surface mismatch');
  }
}
for (const [entry,values,emittedEntry] of textEntries) {
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted=readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source=declaration+'\n'+emitted;
  for (const name of textPrivate) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: private text authority leaked: ${name}`);
  if (/["'][^"']*(?:assetManagerOwnerState|\/(?:request|plan|budget)\.js)["']/.test(source)) throw new Error(`${entry}: private text module leaked`);
  if (/["'][^"']*(?:textFieldFactoryState|textDisplayState|\/text\/TextField)\.js["']/.test(source)) throw new Error(`${entry}: private text module leaked`);
  if (entry !== 'engine/text') {
    for (const name of ['createTextField','TextField','TextFieldStatus']) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: explicit-only TextField port leaked: ${name}`);
    if (/["'][^"']*\/textField\.js["']/.test(source)) throw new Error(`${entry}: explicit-only TextField module leaked`);
  }
  if (Object.hasOwn(values,'textFieldBrand') || /\bexport\s+(?:declare\s+)?(?:const|let|var|class|function)\s+textFieldBrand\b/.test(declaration) || /\btextFieldBrand\b/.test(emitted)) throw new Error(`${entry}: private TextField brand value leaked`);
  if (!entry.endsWith('/text')) {
    for (const name of ['createTextRasterCache',...textPublicTypes]) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: explicit-only text port leaked: ${name}`);
    if (/["'][^"']*(?:\/text(?:\/|\.js|["']))/.test(source)) throw new Error(`${entry}: explicit-only text module leaked`);
  }
}
const expectedRuntimeValues=['CancellationController','EgretError','Scope','createScope','Event','createEventType',
  'EventDispatcher','DisplayObject','DisplayObjectContainer','Stage','createStage','reportDiagnostic','AssetManager',
  'createAssetManager','AssetLease','createAssetType','createAssetRef','Sprite','Graphics','collectFrameCommands',
  'collectFrameContent','collectTexturedFrameContent','Texture','createTexture','isTexture','Bitmap','Mesh2D','createSequenceClip','SequencePlayer'].sort();
if (JSON.stringify(Object.keys(runtimeFacade)) !== JSON.stringify(expectedRuntimeValues)) throw new Error('runtime: unchanged default-root export surface mismatch');
for (const [entry,values,emittedEntry,valueTarget,typeTarget] of [
  ['runtime/text',runtimeText,'packages/runtime/dist/text/index','./TextRasterCache.js','./types.js'],
  ['engine/text',engineText,'packages/engine/dist/text','@egret/runtime/text','@egret/runtime/text'],
]) {
  const expectedValues=entry==='engine/text'?['createTextField','createTextRasterCache']:['createTextRasterCache'];
  if (JSON.stringify(Object.keys(values)) !== JSON.stringify(expectedValues) || expectedValues.some(name=>typeof values[name]!=='function')) throw new Error(`${entry}: exact text runtime surface mismatch`);
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const valuesDeclared=[...declaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)];
  const typeStars=[...declaration.matchAll(/export\s+type\s*\*\s*from\s*["']([^"']+)["'];?/g)];
  let remainder=declaration.replace(/export\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g,'').replace(/export\s+type\s*\*\s*from\s*["'][^"']+["'];?/g,'');
  const cachePorts=valuesDeclared.filter(match=>match[1].trim()==='createTextRasterCache'&&match[2]===valueTarget);
  if(entry==='engine/text') {
    const fieldPorts=valuesDeclared.filter(match=>match[1].trim()==='createTextField'&&match[2]==='./textField.js');
    const interfaces=[...remainder.matchAll(/export\s+interface\s+(\w+)(?:\s+extends\s+DisplayObject)?\s*\{[^{}]*\}/g)];
    if(fieldPorts.length!==1||JSON.stringify(interfaces.map(match=>match[1]).sort())!==JSON.stringify(['TextField','TextFieldStatus']))throw new Error(`${entry}: exact TextField type-only surface mismatch`);
    remainder=remainder.replace(/export\s+interface\s+(?:TextField|TextFieldStatus)(?:\s+extends\s+DisplayObject)?\s*\{[^{}]*\}/g,'')
      .replace(/import\s+type\s*\{\s*DisplayObject\s*\}\s*from\s*["']@egret\/runtime["'];?/g,'')
      .replace(/import\s+type\s*\{\s*TextRasterMetrics\s*,\s*TextRasterRequestInput\s*\}\s*from\s*["']@egret\/runtime\/text["'];?/g,'')
      .replace(/declare\s+const\s+textFieldBrand\s*:\s*unique\s+symbol\s*;/g,'')
      .replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm,'');
  }
  if (valuesDeclared.length!==expectedValues.length || cachePorts.length!==1 || typeStars.length!==1 || typeStars[0][1]!==typeTarget || remainder.trim()) throw new Error(`${entry}: exact text declaration surface mismatch`);
}
if (runtimeText.createTextRasterCache !== engineText.createTextRasterCache) throw new Error('engine/text: runtime factory identity mismatch');
const textTypesModule=await import(new URL('../packages/runtime/dist/text/types.js',import.meta.url));
if (Object.keys(textTypesModule).length!==0) throw new Error('runtime/text: canonical types emitted runtime values');
const textTypesDeclaration=readFileSync(path.join(root,'packages/runtime/dist/text/types.d.ts'),'utf8');
const textDeclaredNames=[...textTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
if (JSON.stringify(textDeclaredNames)!==JSON.stringify([...textPublicTypes].sort())) throw new Error('runtime/text: canonical public type inventory mismatch');
// Triple-slash ambient references are dependencies even when normal comments
// are removed by the retained source scan. The new text subtree is DOM-free.
for (const file of [...files(path.join(root,'packages/runtime/src/text')), ...files(path.join(root,'packages/runtime/dist/text')),
  path.join(root,'packages/engine/src/text.ts'),path.join(root,'packages/engine/dist/text.js'),path.join(root,'packages/engine/dist/text.d.ts')]) {
  if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
  const raw=readFileSync(file,'utf8');
  if (/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${path.relative(root,file)}: host ambient dependency`);
}

const clockTypesModule = await import(new URL('../packages/engine/dist/gameClockTypes.js',import.meta.url));
if (Object.keys(clockTypesModule).length !== 0) throw new Error('engine: clock types emitted runtime values');
const clockTypesDeclaration = readFileSync(path.join(root,'packages/engine/dist/gameClockTypes.d.ts'),'utf8');
const clockDeclaredNames = [...clockTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
if (JSON.stringify(clockDeclaredNames) !== JSON.stringify([...clockPublicTypes].sort())) throw new Error('engine: canonical clock type inventory mismatch');
// Existing host timeout code remains outside this exact two-module clock scan.
for (const file of ['packages/engine/src/gameClock.ts','packages/engine/src/gameClockTypes.ts','packages/engine/dist/gameClock.js','packages/engine/dist/gameClockTypes.js','packages/engine/dist/gameClock.d.ts','packages/engine/dist/gameClockTypes.d.ts']) {
  const raw = readFileSync(path.join(root,file),'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if (/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code)) throw new Error(`${file}: clock automatic timing dependency`);
  if (/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}

// Scope-owned scalar Tween extends only Engine's root type surface/method.
// These names follow the adopted plan; they are not public owner ports.
const tweenPublicTypes = ['Tween','TweenState','TweenOptions','TweenEasing'];
const tweenPrivate = ['createTweenOwner','TweenContext','TweenOwner','tweenBrand','createTween'];
for(const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted=readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source=declaration+'\n'+emitted;
  for(const name of tweenPrivate)if(name in values || new RegExp('\\b'+name+'\\b').test(source))throw new Error(`${entry}: private Tween authority leaked: ${name}`);
  if(/["'][^"']*(?:^|\/)tween(?:\.js|["'])/.test(source))throw new Error(`${entry}: private Tween module leaked`);
  if(entry!=='root') {
    for(const name of tweenPublicTypes)if(name in values || new RegExp('\\b'+name+'\\b').test(source))throw new Error(`${entry}: Engine-only Tween type leaked: ${name}`);
    if(/["'][^"']*(?:^|\/)tweenTypes(?:\.js|["'])/.test(source))throw new Error(`${entry}: Engine-only Tween types module leaked`);
  } else {
    const ports=[...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match=>match[3]==='./tweenTypes.js');
    const references=[...declaration.matchAll(/["']\.\/tweenTypes\.js["']/g)];
    if(ports.length!==1 || !ports[0][1] || references.length!==1 || /["']\.\/tweenTypes\.js["']/.test(emitted) || JSON.stringify(ports[0][2].split(',').map(name=>name.trim()).sort())!==JSON.stringify([...tweenPublicTypes].sort()) || tweenPublicTypes.some(name=>name in values))throw new Error('root: exact Tween type-only export surface mismatch');
  }
}
const tweenTypesModule=await import(new URL('../packages/engine/dist/tweenTypes.js',import.meta.url));
if(Object.keys(tweenTypesModule).length!==0)throw new Error('engine: Tween types emitted runtime values');
const tweenTypesDeclaration=readFileSync(path.join(root,'packages/engine/dist/tweenTypes.d.ts'),'utf8');
const tweenDeclaredNames=[...tweenTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
// The four canonical declarations are the complete export surface, including
// erased local aliases/reexports that declaration-name scanning alone misses.
const tweenTypesCode=tweenTypesDeclaration.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
// Only standalone empty compiler module markers with a semicolon add no named export.
const tweenExportCount=(tweenTypesCode.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm,'').match(/\bexport\b/g)??[]).length;
if(JSON.stringify(tweenDeclaredNames)!==JSON.stringify([...tweenPublicTypes].sort()) || tweenExportCount!==tweenPublicTypes.length)throw new Error('engine: canonical Tween type inventory mismatch');
// Only the exact two Tween modules are scanned; existing host deadlines keep
// their lifecycle scope and every prior source scanner/reason remains intact.
for(const file of ['packages/engine/src/tween.ts','packages/engine/src/tweenTypes.ts','packages/engine/dist/tween.js','packages/engine/dist/tweenTypes.js','packages/engine/dist/tween.d.ts','packages/engine/dist/tweenTypes.d.ts']) {
  const raw=readFileSync(path.join(root,file),'utf8');
  const code=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if(/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code))throw new Error(`${file}: Tween automatic timing dependency`);
  if(/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))throw new Error(`${file}: host ambient dependency`);
}

console.log(`Boundary check PASS: four private workspace packages, actual exports resolution, ${inspected} source/build/declaration files, DOM-free core and exact DOM-only web subtree without Node imports/globals.`);

