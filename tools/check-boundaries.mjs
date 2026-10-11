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
      './web/text': {types:'./dist/web/text.d.ts',import:'./dist/web/text.js'},
      // S3D1_MAP_BEGIN
      './scene3d': {types:'./dist/rendering/scene3d.d.ts',import:'./dist/rendering/scene3d.js'},
      './webgpu/scene3d': {types:'./dist/web/scene3d.d.ts',import:'./dist/web/scene3d.js'},
      // S3D1_MAP_END
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
        if (name === 'engine') {
          const target=path.relative(dir,path.resolve(path.dirname(file),imported)).split(path.sep).join('/');
          const relative=path.relative(dir,file).split(path.sep).join('/');
          const providerTarget=['web/CanvasTextRasterProvider.js','dist/web/CanvasTextRasterProvider.js'].includes(target);
          const providerBarrel=['web/text.ts','dist/web/text.js','dist/web/text.d.ts'].includes(relative);
          if ((providerTarget && !providerBarrel) || ['web/text.js','dist/web/text.js'].includes(target)) throw new Error(`${file}: Canvas text opt-in module imported outside its barrel`);
        }
      } else if (imported === '#egret-textured-frame-state') {
        // Only these two first-party adapters may share the Engine-owned registry.
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['web/CanvasHost.ts', 'web/WebGPUHost.ts', 'dist/web/CanvasHost.js', 'dist/web/WebGPUHost.js'].includes(relative)) throw new Error(`${file}: private textured registry import outside approved adapters`);
      } else if (imported === '@egret/runtime/text') {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['src/text.ts', 'dist/text.js', 'dist/text.d.ts'].includes(relative)) throw new Error(`${file}: unapproved/deep package import ${imported}`);
      } else if (imported === '@egret/engine/text') {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        // The public provider protocol is one exact erased dependency, not a
        // same-package value-import exception or permission for other adapters.
        const clause = code.slice(0, match.index).match(/\bimport\s+type\s*\{([^{}]+)\}\s*$/);
        const types = ['TextLineMetricsInput','TextMeasureContext','TextRasterContext','TextRasterPlan','TextRasterProvider','TextRasterRequest'];
        const names = clause?.[1].split(',').map(value=>value.trim()).filter(Boolean);
        if (name !== 'engine' || !['web/CanvasTextRasterProvider.ts','dist/web/CanvasTextRasterProvider.d.ts'].includes(relative)
            || !names?.length || names.some(value=>!types.includes(value)) || new Set(names).size!==names.length)
          throw new Error(`${file}: unapproved/deep package import ${imported}`);
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
const texturedRootValues = ['Engine', 'createEngine', 'createEngineForProfile', 'CancellationController', 'EgretError', 'Event', 'createEventType', 'EventDispatcher', 'DisplayObject', 'DisplayObjectContainer', 'Scope', 'Stage', 'AssetManager', 'AssetLease', 'createAssetType', 'createAssetRef', 'Sprite', 'Graphics', ...imageValues, ...geometryValues, 'TEXTURED_FRAME_PROFILE_2D', 'Texture', 'createTexture', 'isTexture', 'Bitmap', 'Mesh2D', 'createSequenceClip', 'SequencePlayer', 'ByteReader', 'BYTE_READER_LIMITS'].sort();
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
const canvasText = await import('@egret/engine/web/text');
const textEntries = [...meshEntries,
  ['runtime/text',runtimeText,'packages/runtime/dist/text/index'],
  ['engine/text',engineText,'packages/engine/dist/text'],
  ['engine/web/text',canvasText,'packages/engine/dist/web/text'],
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
  'collectFrameContent','collectTexturedFrameContent','Texture','createTexture','isTexture','Bitmap','Mesh2D','createSequenceClip','SequencePlayer','ByteReader','BYTE_READER_LIMITS'].sort();
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

// BR1 extends only the two retained exact value inventories above. These new
// checks follow every old refusal, without adding an import/subpath exception.
const byteReaderValues = ['BYTE_READER_LIMITS', 'ByteReader'];
const byteReaderNames = [...byteReaderValues, 'ByteOrder'];
const byteReaderStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const byteReaderModuleReference = /["'][^"']*(?:^|\/)ByteReader\.js["']/;
const byteReaderRuntimeWildcard = /export\s+(?:type\s+)?\*(?:\s+as\s+\w+)?\s*from\s*["']@egret\/runtime["']/;
// These public barrels admit named runtime dependencies, never a root-runtime
// namespace import or import-type query. The observed genuine baseline has
// neither form. Reject the form itself, without resolving local names/escapes.
// This bounded ordinary-barrel scan is not a general TypeScript parser.
const byteReaderRuntimeModuleAccess = raw => {
  const tokens = [...raw.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*'|`(?:\\[\s\S]|[^`\\$]|\$(?!\{))*`|[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*|[^\s]/gu)]
    .map(match => match[0]).filter(text => !text.startsWith('/*') && !text.startsWith('//'));
  const target = token => typeof token === 'string' && /^(["'])@egret\/runtime\1$/.test(token);
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index] !== 'import') continue;
    // typeof import(...) exposes value shapes even with no BR1 name in the
    // declaration; the same fixed policy also rejects qualified import types.
    if (tokens[index + 1] === '(' && target(tokens[index + 2])) return true;
    let from = index + 1;
    for (; from < tokens.length; from++) {
      if (tokens[from] === ';' || (from > index + 1 && ['import', 'export'].includes(tokens[from]))) break;
      if (tokens[from] === 'from' && /^["']/.test(tokens[from + 1] ?? '')) break;
    }
    if (tokens[from] === 'from' && target(tokens[from + 1]) && tokens.slice(index + 1, from).includes('*')) return true;
  }
  return false;
};
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const rawDeclaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const declaration = byteReaderStrip(rawDeclaration);
  const emitted = byteReaderStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  if (entry !== 'root' && entry !== 'runtime') {
    for (const name of byteReaderNames) if (name in values || new RegExp('\\b' + name + '\\b').test(declaration + '\n' + emitted)) throw new Error(`${entry}: root/runtime-only ByteReader port leaked: ${name}`);
    if (byteReaderModuleReference.test(declaration + '\n' + emitted) || byteReaderRuntimeWildcard.test(declaration + '\n' + emitted)
        || byteReaderRuntimeModuleAccess(rawDeclaration)) throw new Error(`${entry}: root/runtime-only ByteReader module leaked`);
    continue;
  }
  if ('ByteOrder' in values || /\bByteOrder\b/.test(emitted)) throw new Error(`${entry}: ByteOrder must be erased`);
  if (typeof values.ByteReader !== 'function' || typeof values.BYTE_READER_LIMITS !== 'object' || values.BYTE_READER_LIMITS === null) throw new Error(`${entry}: ByteReader value surface missing`);
  const target = entry === 'root' ? '@egret/runtime' : './ByteReader.js';
  const ports = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match =>
    byteReaderNames.some(name => new RegExp('\\b' + name + '\\b').test(match[2])) || /(?:^|\/)ByteReader\.js$/.test(match[3]));
  const valuesDeclared = ports.filter(match => !match[1]);
  const typesDeclared = ports.filter(match => !!match[1]);
  const remainder = ports.reduce((text, match) => text.replace(match[0], ''), declaration);
  // Named clauses are exact: aliases, inline type modifiers, duplicate clauses
  // and runtime-wide type namespaces cannot silently enlarge this small API.
  if (ports.length !== 2 || valuesDeclared.length !== 1 || typesDeclared.length !== 1
      || ports.some(match => match[3] !== target)
      || JSON.stringify(valuesDeclared[0][2].split(',').map(name => name.trim()).sort()) !== JSON.stringify(byteReaderValues)
      || typesDeclared[0][2].trim() !== 'ByteOrder'
      || byteReaderNames.some(name => new RegExp('\\b' + name + '\\b').test(remainder))
      || byteReaderModuleReference.test(remainder) || byteReaderRuntimeWildcard.test(remainder)
      || byteReaderRuntimeModuleAccess(rawDeclaration)) throw new Error(`${entry}: exact ByteReader declaration re-export mismatch`);
}
const byteReaderModule = await import(new URL('../packages/runtime/dist/ByteReader.js', import.meta.url));
if (JSON.stringify(Object.keys(byteReaderModule)) !== JSON.stringify(byteReaderValues)) throw new Error('runtime: canonical ByteReader runtime export surface mismatch');
for (const name of byteReaderValues) {
  if (runtimeFacade[name] !== byteReaderModule[name]) throw new Error(`runtime: ByteReader module identity mismatch: ${name}`);
  if (facade[name] !== runtimeFacade[name]) throw new Error(`root: ByteReader runtime identity mismatch: ${name}`);
}
const byteReaderDeclaration = byteReaderStrip(readFileSync(path.join(root, 'packages/runtime/dist/ByteReader.d.ts'), 'utf8'));
const byteReaderDeclaredNames = [...byteReaderDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
const byteReaderExportCount = (byteReaderDeclaration.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
if (JSON.stringify(byteReaderDeclaredNames) !== JSON.stringify([...byteReaderNames].sort()) || byteReaderExportCount !== 3) throw new Error('runtime: canonical ByteReader declaration export surface mismatch');
// Triple-slash references remain dependencies even though the retained generic
// scan removes ordinary comments. This exact utility stays DOM/Node-free.
for (const file of ['packages/runtime/src/ByteReader.ts', 'packages/runtime/dist/ByteReader.js', 'packages/runtime/dist/ByteReader.d.ts']) {
  const raw = readFileSync(path.join(root, file), 'utf8'), code = byteReaderStrip(raw);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}

// WC1 adds one explicit value and no named type surface. Keep old entry guards
// and their refusal precedence; this leaf is never a default or Canvas-host port.
if (JSON.stringify(Object.keys(canvasText))!==JSON.stringify(['createCanvasTextRasterProvider'])
    || typeof canvasText.createCanvasTextRasterProvider!=='function') throw new Error('web/text: exact Canvas text runtime surface mismatch');
const canvasTextStrip=raw=>raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim();
const canvasTextDeclaration=canvasTextStrip(readFileSync(path.join(root,'packages/engine/dist/web/text.d.ts'),'utf8'));
if (!/^export\s*\{\s*createCanvasTextRasterProvider\s*\}\s*from\s*['"]\.\/CanvasTextRasterProvider\.js['"];?$/.test(canvasTextDeclaration)) throw new Error('web/text: exact Canvas text declaration surface mismatch');
const canvasProviderDeclaration=canvasTextStrip(readFileSync(path.join(root,'packages/engine/dist/web/CanvasTextRasterProvider.d.ts'),'utf8'));
if (!/^import\s+type\s*\{\s*TextRasterProvider\s*\}\s*from\s*['"]@egret\/engine\/text['"];\s*export\s+declare\s+function\s+createCanvasTextRasterProvider\s*\(\s*\)\s*:\s*TextRasterProvider\s*;$/.test(canvasProviderDeclaration)) throw new Error('web/text: exact Canvas text factory declaration mismatch');
for(const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  if(entry==='engine/web/text')continue;
  const code=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8')+'\n'+readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  if('createCanvasTextRasterProvider' in values || /\b(?:createCanvasTextRasterProvider|CanvasTextRasterProvider)\b/.test(code)
      || /['"][^'"]*\/web\/text\.js['"]/.test(code)) throw new Error(`${entry}: explicit-only Canvas text port leaked`);
}
// Source, runtime emission and declarations share the exact opt-in boundary.
for(const suffix of ['web/CanvasTextRasterProvider.ts','web/text.ts','dist/web/CanvasTextRasterProvider.js','dist/web/text.js','dist/web/CanvasTextRasterProvider.d.ts','dist/web/text.d.ts']) {
  const file='packages/engine/'+suffix,code=canvasTextStrip(readFileSync(path.join(root,file),'utf8'));
  if(/\b(?:FontFace|OffscreenCanvas|fetch|setTimeout|clearTimeout|setInterval|clearInterval|requestAnimationFrame|cancelAnimationFrame)\b|\.fonts\s*\.\s*(?:load|ready|add|delete|clear)\b|\baddEventListener\b/.test(code)) throw new Error(`${file}: Canvas text hidden work or font ownership`);
  if(/['"][^'"]*(?:runtime\/text|\/text\/(?:TextRasterCache|request|plan|budget|types)|\.\.\/text|textField)\.js['"]/.test(code)) throw new Error(`${file}: Canvas text private/value text dependency`);
}
// Import itself is inert in the ordinary Node checker; only the explicit factory
// reports environment unavailability. This is not native Canvas verification.
let canvasTextUnavailable;
try { canvasText.createCanvasTextRasterProvider(); } catch(error) { canvasTextUnavailable=error; }
if(canvasTextUnavailable?.code!=='WEB_TEXT_UNAVAILABLE')throw new Error('web/text: nonbrowser factory must be unavailable');

// HT1 adds only an erased options port and members on existing display classes.
// The retained value inventories and every older refusal above stay unchanged.
const hitTestStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
const hitTestPrivateNames = ['DisplayHitState', 'registerDisplayHitNode', 'registerDisplayHitContainer',
  'readDisplayHitState', 'readDisplayTouchChildren', 'writeDisplayTouchEnabled', 'writeDisplayTouchChildren', 'writeDisplayHitArea', 'queryDisplayHit'];
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const declaration = hitTestStrip(readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8'));
  const emitted = hitTestStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  let remainder = declaration;
  if (entry === 'root' || entry === 'runtime') {
    const target = entry === 'root' ? '@egret/runtime' : './displayHitTest.js';
    const clauses = [...declaration.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
      .filter(match => /\bHitTestOptions\b/.test(match[1]) || /\bdisplayHitTest\b/.test(match[2]));
    if (clauses.length !== 1 || !/^export\s+type\s*\{\s*HitTestOptions\s*\}\s*from\s*['"][^'"]+['"];?$/.test(clauses[0][0])
        || clauses[0][2] !== target || 'HitTestOptions' in values || /\bHitTestOptions\b/.test(emitted)) {
      throw new Error(`${entry}: exact hit-test type-only facade mismatch`);
    }
    remainder = declaration.replace(clauses[0][0], '');
    if (/\bHitTestOptions\b/.test(remainder)) throw new Error(`${entry}: duplicate hit-test options declaration`);
  } else if ('HitTestOptions' in values || /\bHitTestOptions\b/.test(declaration + '\n' + emitted)) {
    throw new Error(`${entry}: root/runtime-only hit-test options leaked`);
  }
  for (const name of hitTestPrivateNames) if (name in values || new RegExp('\\b' + name + '\\b').test(remainder + '\n' + emitted)) {
    throw new Error(`${entry}: private hit-test authority leaked: ${name}`);
  }
  if (/\b(?:displayHitState|displayHitTest)\b/.test(remainder + '\n' + emitted)) throw new Error(`${entry}: private hit-test module leaked`);
}
const hitTestOptionsDeclaration = hitTestStrip(readFileSync(path.join(root, 'packages/runtime/dist/displayHitTest.d.ts'), 'utf8'));
const hitTestOptionBodies = [...hitTestOptionsDeclaration.matchAll(/export\s+interface\s+HitTestOptions\s*\{([^}]*)\}/g)];
if (hitTestOptionBodies.length !== 1 || !/^\s*readonly\s+maxNodes\?\s*:\s*number\s*;\s*$/.test(hitTestOptionBodies[0][1])) {
  throw new Error('runtime: exact hit-test options shape mismatch');
}
const hitTestClassMembers = [
  ['DisplayObject', 'touchEnabled', 'get touchEnabled(): boolean;', 'set touchEnabled(value: boolean);'],
  ['DisplayObject', 'hitArea', 'get hitArea(): Rectangle2D | undefined;', 'set hitArea(value: Rectangle2D | undefined);'],
  ['DisplayObjectContainer', 'touchChildren', 'get touchChildren(): boolean;', 'set touchChildren(value: boolean);'],
];
for (const name of ['DisplayObject', 'DisplayObjectContainer', 'Stage']) if (facade[name] !== runtimeFacade[name]) {
  throw new Error(`root: hit-test class identity mismatch: ${name}`);
}
const hitTestDeclarationText = name => hitTestStrip(readFileSync(path.join(root, 'packages/runtime/dist/' + name + '.d.ts'), 'utf8')).replace(/\s+/g, ' ');
for (const [name, member, getter, setter] of hitTestClassMembers) {
  const declaration = hitTestDeclarationText(name);
  if (!declaration.includes(getter) || !declaration.includes(setter)
      || [...declaration.matchAll(new RegExp('\\b(?:get|set)\\s+' + member + '\\s*\\(', 'g'))].length !== 2) throw new Error(`runtime: hit-test ${name}.${member} declaration mismatch`);
  for (const [entry, values] of [['runtime', runtimeFacade], ['root', facade]]) {
    const descriptor = Object.getOwnPropertyDescriptor(values[name].prototype, member);
    if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function'
        || descriptor.enumerable !== false || descriptor.configurable !== true) throw new Error(`${entry}: hit-test ${name}.${member} accessor mismatch`);
  }
}
const hitTestStageSignature = 'hitTest(globalX: number, globalY: number, options?: HitTestOptions): DisplayObject | undefined;';
if (!hitTestDeclarationText('Stage').includes(hitTestStageSignature)
    || [...hitTestDeclarationText('Stage').matchAll(/\bhitTest\s*\(/g)].length !== 1
    || /\bhitTest\s*\(|\btouchChildren\b/.test(hitTestDeclarationText('DisplayObject'))
    || /\bhitTest\s*\(/.test(hitTestDeclarationText('DisplayObjectContainer'))) throw new Error('runtime: Stage.hitTest declaration mismatch');
for (const [entry, values] of [['runtime', runtimeFacade], ['root', facade]]) {
  const descriptor = Object.getOwnPropertyDescriptor(values.Stage.prototype, 'hitTest');
  if (!descriptor || typeof descriptor.value !== 'function' || descriptor.enumerable !== false || descriptor.configurable !== true
      || Object.hasOwn(values.DisplayObject.prototype, 'hitTest') || Object.hasOwn(values.DisplayObjectContainer.prototype, 'hitTest')) {
    throw new Error(`${entry}: Stage-only hit-test method mismatch`);
  }
}
for (const name of ['displayHitState', 'displayHitTest']) for (const [directory, suffix] of [['src', '.ts'], ['dist', '.js'], ['dist', '.d.ts']]) {
  const file = `packages/runtime/${directory}/${name}${suffix}`, raw = readFileSync(path.join(root, file), 'utf8'), code = hitTestStrip(raw);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*['"]dom(?:\.iterable)?['"]|types\s*=\s*['"]node['"])/i.test(raw)) throw new Error(`${file}: hit-test host ambient dependency`);
  const runtimeImports = directory === 'src' ? code.replace(/\bimport\s+type\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '') : code;
  if (suffix !== '.d.ts' && /\bimport\b[^;]*['"]\.\/(?:DisplayObject|DisplayObjectContainer|Stage)\.js['"]/.test(runtimeImports)) {
    throw new Error(`${file}: hit-test display class value backedge`);
  }
}

// RG1_BOUNDARY_BEGIN
// Scope-owned resource groups add three erased Engine types and one instance
// method. The runtime port below is exact assembly typing, not owner authority.
// Every retained policy runs before this finite successor, with no exemption.
const assetGroupStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
const assetGroupPublicTypes = ['AssetGroup', 'AssetGroupState', 'AssetGroupOptions'];
const assetGroupPrivateNames = ['createAssetGroup', 'createAssetGroupOwner', 'AssetGroupOwner', 'AssetGroupContext', 'assetGroupBrand', 'registerAssetGroupOperations', 'requireAssetManagerOwner', 'registerAssetManagerOwner'];
const assetGroupSourceEntries = {
  contracts: 'packages/contracts/src/index.ts', root: 'packages/engine/src/index.ts',
  runtime: 'packages/runtime/src/index.ts', web: 'packages/engine/web/index.ts',
  webgpu: 'packages/engine/web/webgpu.ts', 'runtime/text': 'packages/runtime/src/text/index.ts',
  'engine/text': 'packages/engine/src/text.ts', 'engine/web/text': 'packages/engine/web/text.ts',
  project: 'packages/project/src/index.ts',
};
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const declaration = assetGroupStrip(readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8'));
  const emitted = assetGroupStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  const original = assetGroupStrip(readFileSync(path.join(root, assetGroupSourceEntries[entry]), 'utf8'));
  for (const [label, text] of [[entry, declaration], [entry + ' source', original]]) {
    let remainder = text;
    if (entry === 'root') {
      const ports = [...text.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
        .filter(match => match[2] === './assetGroupTypes.js' || /\b(?:AssetGroup|AssetGroupState|AssetGroupOptions)\b/.test(match[1]));
      const references = [...text.matchAll(/['"]\.\/assetGroupTypes\.js['"]/g)];
      if (ports.length !== 1 || !/^export\s+type\s*\{[^}]+\}\s*from\s*['"]\.\/assetGroupTypes\.js['"];?$/.test(ports[0][0])
          || references.length !== 1 || JSON.stringify(ports[0][1].split(',').map(name => name.trim()).sort()) !== JSON.stringify([...assetGroupPublicTypes].sort())
          || assetGroupPublicTypes.some(name => name in values)) throw new Error(`${label}: exact AssetGroup type-only export surface mismatch`);
      remainder = text.replace(ports[0][0], '');
      if (/\b(?:AssetGroup|AssetGroupState|AssetGroupOptions)\b/.test(remainder)) throw new Error(`${label}: exact AssetGroup type-only export surface mismatch`);
    } else {
      for (const name of assetGroupPublicTypes) if (name in values || new RegExp('\\b' + name + '\\b').test(text)) throw new Error(`${label}: Engine-only AssetGroup type leaked: ${name}`);
      if (/\bassetGroupTypes\b/.test(text)) throw new Error(`${label}: Engine-only AssetGroup types module leaked`);
    }
    if (entry === 'runtime') {
      const ports = [...text.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
        .filter(match => match[2] === './assetManagerOwnerState.js' || /\bAssetGroupOperations\b/.test(match[1]));
      if (ports.length !== 1 || !/^export\s+type\s*\{\s*AssetGroupOperations\s*\}\s*from\s*['"]\.\/assetManagerOwnerState\.js['"];?$/.test(ports[0][0])
          || [...text.matchAll(/['"]\.\/assetManagerOwnerState\.js['"]/g)].length !== 1 || 'AssetGroupOperations' in values)
        throw new Error(`${label}: exact AssetGroupOperations type-only assembly mismatch`);
      remainder = remainder.replace(ports[0][0], '');
      if (/\b(?:AssetGroupOperations|assetManagerOwnerState)\b/.test(remainder)) throw new Error(`${label}: exact AssetGroupOperations type-only assembly mismatch`);
    } else if ('AssetGroupOperations' in values || /\bAssetGroupOperations\b/.test(text)) {
      throw new Error(`${label}: runtime-only AssetGroup assembly type leaked`);
    }
    for (const name of assetGroupPrivateNames) if (name in values || new RegExp('\\b' + name + '\\b').test(remainder)) throw new Error(`${label}: private AssetGroup authority leaked: ${name}`);
    if (/['"][^'"]*(?:^|\/)assetGroup(?:\.js|['"])/.test(remainder)) throw new Error(`${label}: private AssetGroup module leaked`);
  }
  for (const name of [...assetGroupPublicTypes, 'AssetGroupOperations', ...assetGroupPrivateNames])
    if (name in values || new RegExp('\\b' + name + '\\b').test(emitted)) throw new Error(`${entry}: AssetGroup erased or private value leaked: ${name}`);
  if (/\b(?:assetGroupTypes|assetGroup|assetManagerOwnerState)\b/.test(emitted)) throw new Error(`${entry}: private AssetGroup module leaked`);
}
const assetGroupTypesModule = await import(new URL('../packages/engine/dist/assetGroupTypes.js', import.meta.url));
if (Object.keys(assetGroupTypesModule).length !== 0) throw new Error('engine: AssetGroup types emitted runtime values');
// RG1_ERASURE_BEGIN
// An empty namespace does not prove local allocations were erased. The exact
// declaration-only module may retain only its empty compiler module marker.
const assetGroupTypesEmitted = assetGroupStrip(readFileSync(path.join(root, 'packages/engine/dist/assetGroupTypes.js'), 'utf8'));
if (!/^export\s*\{\s*\}\s*;$/.test(assetGroupTypesEmitted)) throw new Error('engine: AssetGroup types emitted non-erased module code');
// RG1_ERASURE_END
for (const [label, file] of [['engine source', 'packages/engine/src/assetGroupTypes.ts'], ['engine', 'packages/engine/dist/assetGroupTypes.d.ts']]) {
  const code = assetGroupStrip(readFileSync(path.join(root, file), 'utf8'));
  const names = [...code.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
  const exportCount = (code.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
  if (JSON.stringify(names) !== JSON.stringify([...assetGroupPublicTypes].sort()) || exportCount !== 3)
    throw new Error(`${label}: canonical AssetGroup type inventory mismatch`);
  const states = [...code.matchAll(/export\s+type\s+AssetGroupState\s*=\s*([^;]+);/g)];
  const options = [...code.matchAll(/export\s+interface\s+AssetGroupOptions\s*\{([^}]*)\}/g)];
  const groups = [...code.matchAll(/export\s+interface\s+AssetGroup\s*<\s*T\s*>\s*\{([^}]*)\}/g)];
  const compact = value => value.replace(/\s+/g, '');
  if ([...code.matchAll(/\bdeclare\s+const\s+assetGroupBrand\s*:\s*unique\s+symbol\s*;/g)].length !== 1
      || /\bexport\s+(?:declare\s+)?const\s+assetGroupBrand\b/.test(code)
      || states.length !== 1 || compact(states[0][1]) !== "'pending'|'ready'|'failed'|'disposed'"
      || options.length !== 1 || compact(options[0][1]) !== 'readonlyconcurrency?:number;'
      || groups.length !== 1 || compact(groups[0][1]) !== 'readonly[assetGroupBrand]:true;readonlystate:AssetGroupState;readonlyready:Promise<readonlyAssetLease<T>[]>;dispose():void;')
    throw new Error(`${label}: canonical AssetGroup contract mismatch`);
}
const assetGroupMethod = 'createAssetGroup<T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions): AssetGroup<T>';
for (const [label, file, ending] of [['engine source', 'packages/engine/src/Engine.ts', ' {'], ['engine', 'packages/engine/dist/Engine.d.ts', ';']]) {
  const code = assetGroupStrip(readFileSync(path.join(root, file), 'utf8')).replace(/\s+/g, ' ');
  if (!code.includes(assetGroupMethod + ending) || [...code.matchAll(/\bcreateAssetGroup\s*(?:<[^>]*>)?\s*\(/g)].length !== 1)
    throw new Error(`${label}: exact createAssetGroup signature mismatch`);
}
const assetGroupMethodDescriptor = Object.getOwnPropertyDescriptor(facade.Engine.prototype, 'createAssetGroup');
if (!assetGroupMethodDescriptor || typeof assetGroupMethodDescriptor.value !== 'function'
    || assetGroupMethodDescriptor.enumerable !== false || assetGroupMethodDescriptor.configurable !== true
    || Object.hasOwn(facade.Engine, 'createAssetGroup')) throw new Error('engine: createAssetGroup instance method mismatch');
// Optional context assembly keeps ordinary runtime construction valid. Pin the
// four captured operations, not a public factory or runtime ownership lookup.
for (const [label, directory, suffix] of [['runtime source', 'src', '.ts'], ['runtime', 'dist', '.d.ts']]) {
  const operations = assetGroupStrip(readFileSync(path.join(root, `packages/runtime/${directory}/assetManagerOwnerState${suffix}`), 'utf8'));
  const ports = [...operations.matchAll(/export\s+interface\s+AssetGroupOperations\s*\{([^}]*)\}/g)];
  const expectedBody = 'readonlyadmitGroupRefs:(refs:readonlyunknown[])=>void;readonlyacquire:<T>(ref:AssetRef<T>,options?:AssetAcquireOptions)=>Promise<AssetLease<T>>;readonlyclaimGroupLease:(lease:unknown,group:object)=>void;readonlyreleaseGroupLease:(lease:unknown)=>void;';
  if (ports.length !== 1 || ports[0][1].replace(/\s+/g, '') !== expectedBody) throw new Error(`${label}: AssetGroupOperations assembly contract mismatch`);
  const context = assetGroupStrip(readFileSync(path.join(root, `packages/runtime/${directory}/ownership${suffix}`), 'utf8'));
  if ([...context.matchAll(/readonly\s+registerAssetGroupOperations\?\s*:\s*\(operations\s*:\s*AssetGroupOperations\)\s*=>\s*void\s*;/g)].length !== 1
      || [...context.matchAll(/\bregisterAssetGroupOperations\b/g)].length !== 1) throw new Error(`${label}: optional AssetGroupOperations context assembly mismatch`);
}
// Only new group modules gain this no-automatic-timing check. Retained Engine
// shutdown deadlines and all earlier source-scanner exceptions remain intact.
for (const name of ['assetGroup', 'assetGroupTypes']) for (const [directory, suffix] of [['src', '.ts'], ['dist', '.js'], ['dist', '.d.ts']]) {
  const file = `packages/engine/${directory}/${name}${suffix}`;
  const raw = readFileSync(path.join(root, file), 'utf8'), code = assetGroupStrip(raw);
  if (/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code)) throw new Error(`${file}: AssetGroup automatic timing dependency`);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS|GPUDevice)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*['"]dom(?:\.iterable)?['"]|types\s*=\s*['"]node['"])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}
// RG1_BOUNDARY_END
// S3D1_BOUNDARY_BEGIN
// Separate explicit entries do not exempt any earlier private authority guard.
const sceneCPUValues = ['createMeshGeometry3D','isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin','createSceneFrame3D','isSceneFrame3D','Scene3DError','getScene3DErrorOrigin'];
const sceneCPUTypes = ['Matrix4','MeshGeometry3DInput','MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin','SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'];
const sceneWebTypes = ['SceneWebGPUHostOptions','SceneWebGPUHostStatus','SceneWebGPUHost'];
const sceneRead = file => assetGroupStrip(readFileSync(path.join(root,file),'utf8'));
const sceneEqual = (a,b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function sceneExports(code, label) {
  const value = [], type = [];
  if (/\bexport\s*(?:type\s*)?\*/.test(code) || /\bexport\s+default\b/.test(code)) throw new Error(label + ': exact type-only export surface mismatch');
  for (const match of code.matchAll(/\bexport(\s+type)?\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?\s*;?/g)) {
    for (const name of match[2].split(',').map(name=>name.trim()).filter(Boolean)) {
      if (!/^\w+$/.test(name)) throw new Error(label + ': exact type-only export surface mismatch');
      (match[1] ? type : value).push(name);
    }
  }
  for (const match of code.matchAll(/\bexport\s+(?:declare\s+)?(type|interface|function|const|class|enum)\s+(\w+)/g))
    (['type','interface'].includes(match[1]) ? type : value).push(match[2]);
  return {value,type};
}
function sceneSurface(code, label, expectedValues, expectedTypes) {
  const names=sceneExports(code,label);
  if (!sceneEqual(names.value,expectedValues)) throw new Error(label + ': exact runtime export surface mismatch');
  if (!sceneEqual(names.type,expectedTypes)) throw new Error(label + ': exact type-only export surface mismatch');
}
function sceneClauses(code, label, allowed) {
  // Direct quoted static clauses only. A computed/dynamic edge has no permission
  // on either facade, even when it would resolve into the same private subtree.
  if (/\bimport\s*\(/.test(code)) throw new Error('S3D1: scene entry imported outside approved closure: '+label);
  for (const match of code.matchAll(/\b(import|export)(\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)) {
    const kind=match[2]?'type':'value',rule=allowed[match[4]]?.[kind];
    const names=match[3].split(',').map(name=>name.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    if (!rule || names.some(name=>!rule.includes(name)) || new Set(names).size!==names.length)
      throw new Error('S3D1: scene entry imported outside approved closure: '+label);
  }
  const stripped=code.replace(/\b(?:import|export)(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'');
  if (/\bimport\b|\bfrom\s*['"]/.test(stripped)) throw new Error('S3D1: scene entry imported outside approved closure: '+label);
}
function sceneForward(code, name, target, parameter, label) {
  const imports=[...code.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .filter(match=>match[2]===target).flatMap(match=>match[1].split(',').map(value=>value.trim().split(/\s+as\s+/)));
  const forwardName=name==='createSceneWebGPUHost'?'createB1WebGPUHost':name;
  const importsForFactory=imports.filter(parts=>parts[0]===forwardName);
  if (importsForFactory.length!==1) throw new Error(label+': exact direct factory forwarding mismatch');
  const local=importsForFactory[0][1]??importsForFactory[0][0];
  const functions=[...code.matchAll(new RegExp('export\\s+function\\s+'+name+'\\s*\\(\\s*'+parameter+'(?:\\s*:[^)]*)?\\s*\\)(?:\\s*:[^{]+)?\\s*\\{([^}]*)\\}','g'))];
  if (functions.length!==1 || functions[0][1].replace(/\s+/g,'')!=='return'+local+'('+parameter+');')
    throw new Error(label+': exact direct factory forwarding mismatch');
}
function sceneOnlyProgram(code,kind,factories,localTypes,label) {
  let rest=code.replace(/\b(?:import|export)(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'');
  for(const [name,signature,body]of localTypes) {
    const match=rest.match(new RegExp('export\\s+(?:declare\\s+)?'+signature+'\\s*'+name+'\\b[^\\{;]*(?:\\{([^}]*)\\}|=([^;]+);)'));
    if(!match || (match[1]??match[2]).replace(/\s+/g,'')!==body)throw new Error(label+': canonical authoring/Host type mismatch: '+name);
    rest=rest.replace(match[0],'');
  }
  for(const [name,inputType,outputType,parameter]of factories) {
    const expression=kind==='emitted'
      ? 'export\\s+function\\s+'+name+'\\s*\\(\\s*'+parameter+'\\s*\\)\\s*\\{[^}]*\\}'
      : kind==='declaration'
      ? 'export\\s+declare\\s+function\\s+'+name+'\\s*\\(\\s*'+parameter+'\\s*:\\s*'+inputType+'\\s*\\)\\s*:\\s*'+outputType+'\\s*;'
      : 'export\\s+function\\s+'+name+'\\s*\\(\\s*'+parameter+'\\s*:\\s*'+inputType+'\\s*\\)\\s*:\\s*'+outputType+'\\s*\\{[^}]*\\}';
    const match=rest.match(new RegExp(expression));if(!match)throw new Error(label+': exact direct factory signature mismatch: '+name);
    rest=rest.replace(match[0],'');
  }
  if(rest.trim())throw new Error('S3D1: facade contains non-forwarding module code: '+label);
}
function sceneCanonicalTypeReexports(code,label) {
  const targets={Matrix4:'./matrix4.js',MeshGeometry3D:'./meshGeometry3D.js',MeshGeometry3DErrorCode:'./meshGeometry3D.js',MeshGeometry3DErrorOrigin:'./meshGeometry3D.js'};
  for(const name of ['SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'])targets[name]='./sceneFrame3D.js';
  const exports=[...code.matchAll(/\bexport\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .flatMap(match=>match[1].split(',').map(name=>({name:name.trim(),target:match[2]})).filter(item=>item.name));
  for(const [name,target]of Object.entries(targets)) {
    const found=exports.filter(item=>item.name===name);
    if(found.length!==1 || found[0].target!==target)throw new Error(label+': exact canonical type re-export mismatch: '+name);
  }
}
const sceneCPU=await import('@egret/engine/scene3d');
const sceneWeb=await import('@egret/engine/webgpu/scene3d');
if (!sceneEqual(Object.keys(sceneCPU),sceneCPUValues)) throw new Error('scene3d: exact runtime export surface mismatch');
if (!sceneEqual(Object.keys(sceneWeb),['createSceneWebGPUHost'])) throw new Error('webgpu/scene3d: exact runtime export surface mismatch');
const sceneCPURules={
  './matrix4.js':{type:['Matrix4']},
  './meshGeometry3D.js':{value:['createMeshGeometry3D','isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin'],type:['MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin']},
  './sceneFrame3D.js':{value:['createSceneFrame3D','isSceneFrame3D','Scene3DError','getScene3DErrorOrigin'],type:['SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin']},
};
const sceneWebTypeRules={
  '@egret/contracts':{type:['RenderFrame2D']},
  '../rendering/scene3d.js':{type:['SceneFrame3D']},
  './webgpu.js':{type:['WebGPUHost','WebGPUHostOptions','WebGPUHostStatus']},
};
for (const [label,file,kind] of [['scene3d source','packages/engine/rendering/scene3d.ts','source'],['scene3d','packages/engine/dist/rendering/scene3d.d.ts','declaration'],['scene3d emitted','packages/engine/dist/rendering/scene3d.js','emitted']]) {
  const code=sceneRead(file);
  sceneSurface(code,label,sceneCPUValues,kind==='emitted'?[]:sceneCPUTypes);
  sceneClauses(code,label,sceneCPURules);
  if (kind!=='declaration') {
    sceneForward(code,'createMeshGeometry3D','./meshGeometry3D.js','input',label);
    sceneForward(code,'createSceneFrame3D','./sceneFrame3D.js','input',label);
  }
  if(kind!=='emitted')sceneCanonicalTypeReexports(code,label);
  sceneOnlyProgram(code,kind,[['createMeshGeometry3D','MeshGeometry3DInput','MeshGeometry3D','input'],['createSceneFrame3D','SceneInput3D','SceneFrame3D','input']],kind==='emitted'?[]:[['MeshGeometry3DInput','interface','readonlypositions:readonlynumber[];readonlycolors:readonlynumber[];readonlyindices:readonlynumber[];']],label);
  if (kind==='emitted' && sceneCPUTypes.some(name=>new RegExp('\\b'+name+'\\b').test(code))) throw new Error('scene3d: type-only runtime erasure mismatch');
}
for (const [label,file,kind] of [['webgpu/scene3d source','packages/engine/web/scene3d.ts','source'],['webgpu/scene3d','packages/engine/dist/web/scene3d.d.ts','declaration'],['webgpu/scene3d emitted','packages/engine/dist/web/scene3d.js','emitted']]) {
  const code=sceneRead(file);
  if (kind==='declaration' && /\b(?:B1BuiltinProtocol|createB1WebGPUHostInternal|B1WebGPUHost|B1SceneStatus)\b|['"](?:\.\/b1|\.\/WebGPUHost|\.\.\/rendering\/sceneFrame3D)\.js['"]/.test(code))
    throw new Error('webgpu/scene3d: private declaration dependency leaked');
  sceneSurface(code,label,['createSceneWebGPUHost'],kind==='emitted'?[]:sceneWebTypes);
  sceneClauses(code,label,{...sceneWebTypeRules,...(kind==='declaration'?{}:{'./b1.js':{value:['createB1WebGPUHost']}})});
  if (kind!=='declaration') sceneForward(code,'createSceneWebGPUHost','./b1.js','options',label);
  sceneOnlyProgram(code,kind,[['createSceneWebGPUHost','SceneWebGPUHostOptions','SceneWebGPUHost','options']],kind==='emitted'?[]:[
    ['SceneWebGPUHostOptions','type','WebGPUHostOptions'],
    ['SceneWebGPUHostStatus','interface','readonlyhost:WebGPUHostStatus;readonlypendingSceneBytes:number;readonlypendingUniformBytes:number;readonlypendingDepthBytes:number;'],
    ['SceneWebGPUHost','interface','renderSceneFrame(scene:SceneFrame3D,overlay:RenderFrame2D):undefined;getSceneStatus():SceneWebGPUHostStatus;'],
  ],label);
  if (kind==='emitted' && [...sceneWebTypes,'SceneFrame3D','RenderFrame2D','WebGPUHostOptions','WebGPUHostStatus'].some(name=>new RegExp('\\b'+name+'\\b').test(code)))
    throw new Error('webgpu/scene3d: type-only runtime erasure mismatch');
}
// Original module values, including origin registration and identity predicates,
// cannot be replaced by a facade-local class/function with a matching shape.
for (const [target,names] of [['meshGeometry3D',['isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin']],['sceneFrame3D',['isSceneFrame3D','Scene3DError','getScene3DErrorOrigin']]]) {
  const original=await import(new URL('../packages/engine/dist/rendering/'+target+'.js',import.meta.url));
  for (const name of names) if (sceneCPU[name]!==original[name]) throw new Error('scene3d: original module identity mismatch: '+name);
}
const sceneNewNames=['MeshGeometry3DInput','createSceneWebGPUHost',...sceneWebTypes];
for (const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  const text=[sceneRead(assetGroupSourceEntries[entry]),sceneRead(emittedEntry+'.js'),sceneRead(emittedEntry+'.d.ts')].join('\n');
  for (const name of sceneNewNames) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': explicit-only scene name leaked: '+name);
}
const sceneForbiddenNames=[...meshPrivate,...texturedPrivate,...privateTexturedGPU,...privateCapture,...privateCoordinates,...privateBounds,...assetGroupPublicTypes,'AssetGroupOperations',...assetGroupPrivateNames,'packMeshGeometry3D','PackedMeshGeometry3D','MeshPacking3DError','getMeshPacking3DErrorOrigin','B1BuiltinProtocol','getBuiltinB1Protocol','isBuiltinB1Protocol','createB1WebGPUHostInternal'];
for (const [label,values,stem] of [['scene3d',sceneCPU,'packages/engine/dist/rendering/scene3d'],['webgpu/scene3d',sceneWeb,'packages/engine/dist/web/scene3d']]) {
  const text=sceneRead(stem+'.d.ts')+'\n'+sceneRead(stem+'.js');
  for (const name of sceneForbiddenNames) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(label+': retained private authority leaked: '+name);
}
for (const file of [...files(path.join(root,'packages/engine/src')),...files(path.join(root,'packages/engine/rendering')),...files(path.join(root,'packages/engine/web')),...files(path.join(root,'packages/engine/dist'))]) {
  if (!/\.(?:js|ts)$/.test(file)) continue;
  const relative=path.relative(path.join(root,'packages/engine'),file).split(path.sep).join('/'),code=sceneRead(path.relative(root,file));
  for (const match of code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),match[1])).split(path.sep).join('/');
    if (!['rendering/scene3d.js','dist/rendering/scene3d.js','web/scene3d.js','dist/web/scene3d.js'].includes(target)) continue;
    const typeHost=['web/scene3d.ts','dist/web/scene3d.d.ts'].includes(relative) && ['rendering/scene3d.js','dist/rendering/scene3d.js'].includes(target);
    const before=code.slice(0,match.index);
    if (!typeHost || !/\bimport\s+type\s*\{\s*SceneFrame3D\s*\}\s*$/.test(before)) throw new Error('S3D1: scene entry imported outside approved closure: '+relative);
  }
}
const sceneLiteralClosure = {
  "packages/engine/rendering/sceneFrame3D.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./projection3D.js"
    ]
  ],
  "packages/engine/rendering/meshGeometry3D.ts": [],
  "packages/engine/web/b1.ts": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/matrix4.ts": [],
  "packages/engine/rendering/projection3D.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/rendering/packMeshGeometry3D.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/web/WebGPUHost.ts": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/web/webgpuMeshPass.ts": [],
  "packages/engine/rendering/admitTexturedFrame2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/copyFrame2D.ts": [
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/copyMixedFrame2D.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./imageFrameBudget.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/ownedPreparationFailure2D.ts": [],
  "packages/engine/rendering/packImageVertices2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/rendering/packTexturedMesh2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/rendering/prepareMixedDraws2D.ts": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/prepareRectangles2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/rendering/prepareTexturedDraws2D.ts": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/texturedPreparationBudget2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/web/imageProjections2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/prepareTexturedSubmission2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/texturedWebGPUOptions.ts": [
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/web/webgpuImagePass.ts": [],
  "packages/engine/web/webgpuLifetime.ts": [],
  "packages/engine/web/webgpuPass.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packedOrientation.js"
    ],
    [
      "static",
      "../rendering/packedPosition2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ]
  ],
  "packages/engine/web/webgpuTexturedPass.ts": [],
  "packages/engine/rendering/RectangleFrame2D.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/imageFrameBudget.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/packedOrientation.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/rendering/packedPosition2D.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/rendering/prepareImages2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/prepareTexturedMesh2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/sceneFrame3D.js": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./projection3D.js"
    ]
  ],
  "packages/engine/dist/rendering/sceneFrame3D.d.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/rendering/meshGeometry3D.js": [],
  "packages/engine/dist/rendering/meshGeometry3D.d.ts": [],
  "packages/engine/dist/web/b1.js": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ]
  ],
  "packages/engine/dist/web/b1.d.ts": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/matrix4.js": [],
  "packages/engine/dist/rendering/matrix4.d.ts": [],
  "packages/engine/dist/rendering/projection3D.js": [
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/dist/rendering/projection3D.d.ts": [
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/dist/rendering/packMeshGeometry3D.js": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/rendering/packMeshGeometry3D.d.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.js": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.d.ts": [
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/webgpuMeshPass.js": [],
  "packages/engine/dist/web/webgpuMeshPass.d.ts": [],
  "packages/engine/dist/rendering/admitTexturedFrame2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/admitTexturedFrame2D.d.ts": [
    [
      "static",
      "./prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyFrame2D.js": [],
  "packages/engine/dist/rendering/copyFrame2D.d.ts": [
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyMixedFrame2D.js": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./imageFrameBudget.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyMixedFrame2D.d.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/ownedPreparationFailure2D.js": [],
  "packages/engine/dist/rendering/ownedPreparationFailure2D.d.ts": [],
  "packages/engine/dist/rendering/packImageVertices2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packImageVertices2D.d.ts": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packTexturedMesh2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packTexturedMesh2D.d.ts": [
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareMixedDraws2D.js": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareMixedDraws2D.d.ts": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareRectangles2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/dist/rendering/prepareRectangles2D.d.ts": [
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedDraws2D.js": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/texturedPreparationBudget2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/web/imageProjections2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/imageProjections2D.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/prepareTexturedSubmission2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/prepareTexturedSubmission2D.d.ts": [
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/texturedWebGPUOptions.js": [],
  "packages/engine/dist/web/texturedWebGPUOptions.d.ts": [
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/dist/web/webgpuImagePass.js": [],
  "packages/engine/dist/web/webgpuImagePass.d.ts": [],
  "packages/engine/dist/web/webgpuLifetime.js": [],
  "packages/engine/dist/web/webgpuLifetime.d.ts": [],
  "packages/engine/dist/web/webgpuPass.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packedOrientation.js"
    ],
    [
      "static",
      "../rendering/packedPosition2D.js"
    ]
  ],
  "packages/engine/dist/web/webgpuPass.d.ts": [
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/web/webgpuTexturedPass.js": [],
  "packages/engine/dist/web/webgpuTexturedPass.d.ts": [],
  "packages/engine/dist/rendering/RectangleFrame2D.js": [],
  "packages/engine/dist/rendering/RectangleFrame2D.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/imageFrameBudget.js": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/imageFrameBudget.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/packedOrientation.js": [
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/dist/rendering/packedOrientation.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packedPosition2D.js": [],
  "packages/engine/dist/rendering/packedPosition2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareImages2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareImages2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedMesh2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ]
};
function sceneGraphEdges(code) {
  return [...code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)]
    .map(match=>[/^import\s*\(/.test(match[0])?'dynamic':'static',match[1]])
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
for (const [file,edges] of Object.entries(sceneLiteralClosure)) {
  const code=sceneRead(file);
  if (JSON.stringify(sceneGraphEdges(code))!==JSON.stringify(edges)) throw new Error('S3D1: scene entry imported outside approved closure: '+file);
  // Non-literal dynamic imports cannot hide an additional dependency edge.
  if ((code.match(/\bimport\s*\(/g)??[]).length!==edges.filter(edge=>edge[0]==='dynamic').length) throw new Error('S3D1: scene entry imported outside approved closure: '+file);
}

// S3D1_BOUNDARY_END
console.log(`Boundary check PASS: four private workspace packages, actual exports resolution, ${inspected} source/build/declaration files, DOM-free core and exact DOM-only web subtree without Node imports/globals.`);

