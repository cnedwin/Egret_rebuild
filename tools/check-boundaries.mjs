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
  const externalAllowed = Object.hasOwn(external, name) ? external[name] : {};
  const internalDependencies = dependencies.filter(dependency => !Object.hasOwn(externalAllowed, dependency));
  if (JSON.stringify(internalDependencies) !== JSON.stringify(allowed)) throw new Error(`${name}: dependency DAG mismatch`);
  for (const [dependency, version] of Object.entries(externalAllowed)) if (pkg.dependencies[dependency] !== version) throw new Error(`${name}: external exact pin mismatch`);
  if (!pkg.private || pkg.version !== "0.0.0" || pkg.type !== "module") throw new Error(`${name}: private prototype metadata mismatch`);
  if (name === 'project' && JSON.stringify(pkg.exports) !== JSON.stringify({'.': {types:'./dist/index.d.ts', import:'./dist/index.js'}})) throw new Error('project: root export mapping mismatch');
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
    for (const match of code.matchAll(/(?:from\s*|import\s*\(|import\s*)["']([^"']+)["']/g)) {
      const imported = match[1];
      if (!imported) continue;
      if (imported.startsWith(".")) {
        if (!path.resolve(path.dirname(file), imported).startsWith(`${dir}${path.sep}`)) throw new Error(`${file}: crosses package by relative path`);
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
    if (JSON.stringify(webReferences) !== JSON.stringify([...expectedReferences, './tsconfig.rendering.json'].sort())) throw new Error('engine: web dependency references mismatch');
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
if (JSON.stringify(Object.keys(gpuFacade)) !== JSON.stringify(['createWebGPUHost'])) throw new Error('webgpu facade leaks private helpers');
const gpuExport = JSON.parse(readFileSync(path.join(root, 'packages/engine/package.json'), 'utf8')).exports['./webgpu'];
if (JSON.stringify(gpuExport) !== JSON.stringify({types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'})) throw new Error('webgpu export mapping mismatch');
if ('createWebGPUHost' in facade || 'createWebGPUHost' in webFacade) throw new Error('GPU factory leaks root/Canvas boundary');
if (JSON.stringify(Object.keys(webFacade)) !== JSON.stringify(['createCanvasHost'])) throw new Error('web facade leaks internal ports');
if ('createCanvasHost' in facade) throw new Error('root facade leaks Canvas entry');
const contractsFacade = await import(new URL('../packages/contracts/dist/index.js', import.meta.url));
const imageValues = ['IMAGE_LIMITS_2D', 'copyImageData2DPixels', 'createImageData2D', 'isImageData2D'];
if (JSON.stringify(Object.keys(contractsFacade)) !== JSON.stringify(imageValues)) throw new Error('contracts: executable image export surface mismatch');
for (const name of imageValues) if (facade[name] !== contractsFacade[name]) throw new Error(`engine: image contract identity mismatch: ${name}`);
// Private rectangle and future mixed/image preparation ports remain unavailable
// on every public entry, in runtime values and emitted declaration exports.
const privateRendering = ['RectangleFrame2D', 'copyFrame2D', 'copyCanvasFrame', 'prepareRectangles2D', 'FrameCopyOptions', 'RectanglePreparationOptions', 'PreparedRectangles2D', 'FrameCopyError', 'FrameInputReadError', 'GeometryPreparationError', 'copyMixedFrame2D', 'imageFrameBudget', 'prepareImages2D', 'packImageVertices2D', 'CapturedContent2D', 'collectFrameContent', 'Matrix4', 'Vector4', 'Math3DErrorCode', 'Math3DError', 'createMatrix4', 'createVector4', 'multiplyMatrix4', 'transformHomogeneous4', 'DepthRange3D', 'DepthDirection3D', 'DepthConvention3D', 'Projection3D', 'createPerspectiveProjection3D', 'createOrthographicProjection3D', 'MeshGeometry3D', 'MeshGeometry3DErrorCode', 'MeshGeometry3DError', 'MeshGeometry3DErrorOrigin', 'createMeshGeometry3D', 'isMeshGeometry3D', 'getMeshGeometry3DErrorOrigin', 'PackedMeshGeometry3D', 'MeshPacking3DErrorCode', 'MeshPacking3DErrorOrigin', 'MeshPacking3DError', 'packMeshGeometry3D', 'getMeshPacking3DErrorOrigin', 'SceneProjectionInput3D', 'SceneDrawInput3D', 'SceneInput3D', 'SceneDraw3D', 'SceneFrame3D', 'createSceneFrame3D', 'isSceneFrame3D', 'Scene3DErrorOrigin', 'Scene3DErrorCode', 'Scene3DError', 'getScene3DErrorOrigin', 'B1SceneStatus', 'B1WebGPUHost', 'createB1WebGPUHost', 'createB1WebGPUHostInternal', 'B1BuiltinProtocol', 'getBuiltinB1Protocol', 'isBuiltinB1Protocol', 'createWebGPUMeshPipeline', 'encodeWebGPUMesh'];
const privateCapture = ['isStageRoot', 'CaptureImageBudget', 'BitmapCaptureState', 'bitmapCaptureState', 'readBitmapImage', 'TextureSnapshot2D', 'readTextureSnapshot', 'isAssetLease', 'readAssetLeaseValue'];
for (const [entry, values] of [['contracts', contractsFacade], ['root', facade], ['web', webFacade], ['webgpu', gpuFacade]]) {
  const declarationPath = entry === 'contracts' ? 'packages/contracts/dist/index.d.ts' : entry === 'root' ? 'packages/engine/dist/index.d.ts' : `packages/engine/dist/web/${entry === 'web' ? 'index' : 'webgpu'}.d.ts`;
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  for (const name of [...privateRendering, ...privateCapture]) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration)) throw new Error(`${entry}: private rendering port leaked: ${name}`);
}
const runtimeFacade = await import(new URL('../packages/runtime/dist/index.js', import.meta.url));
const runtimeDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8');
if (typeof runtimeFacade.collectFrameContent !== 'function' || !/export type\s*\{\s*CapturedContent2D\s*\}/.test(runtimeDeclaration)) throw new Error('runtime: low-level capture port missing');
for (const name of privateCapture) if (name in runtimeFacade || new RegExp(`\\b${name}\\b`).test(runtimeDeclaration)) throw new Error(`runtime: private capture authority leaked: ${name}`);
for (const internal of ["collectFrameCommands", "createScope", "createStage", "constructEngine", "createAssetManager", "createAssetLease", "revokeAssetLease", "assertAssetRef", "assertAssetType", "reportDiagnostic", "bind", "engineOf", "ownerOf"]) {
  if (internal in facade) throw new Error(`Internal lifecycle port leaked: ${internal}`);
}
console.log(`Boundary check PASS: four private workspace packages, actual exports resolution, ${inspected} source/build/declaration files, DOM-free core and exact DOM-only web subtree without Node imports/globals.`);

