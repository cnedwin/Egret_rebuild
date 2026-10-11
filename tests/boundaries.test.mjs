import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const checker = readFileSync(path.join(repository, 'tools/check-boundaries.mjs'));
const checkerHash = createHash('sha256').update(checker).digest('hex');
const ownedParent = path.resolve(repository, 'work');
const dependencies = { contracts: [], runtime: ['@egret/contracts'], engine: ['@egret/contracts', '@egret/runtime'], project: ['@egret/contracts'] };

// Synthetic facades prove tool policy/resolution only, never core or native behavior.
function fixture({ imported, subtree = 'engine/rendering', declared = false, missingImageExport = false, missingGeometryExport, missingGeometryType, missingMesh, splitMesh = false, meshLeak, meshModuleLeak, meshWrongEntry, meshStateSourceValueImport = false, meshStateEmittedValueImport = false, profileLeak, profileModuleLeak, missingTexturedPort, missingProfileFactory = false, profileRegistryImport = false, registryLegitimateHosts = false, registryMapMutation, registryImporterProbe, hitTestMutation, mouseInputMutation, /* S3D1_OPTIONS_BEGIN */ scene3dMutation /* S3D1_OPTIONS_END */ }, run) {
  mkdirSync(ownedParent, { recursive: true });
  const root = mkdtempSync(path.join(ownedParent, 'egret-boundary-policy-'));
  function write(relative, content) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' || content instanceof Uint8Array ? content : JSON.stringify(content));
  }
  try {
    write('tools/check-boundaries.mjs', checker);
    for (const [name, allowed] of Object.entries(dependencies)) {
      const dependencyMap = Object.fromEntries(allowed.map(value => [value, 'workspace:*']));
      if (name === 'engine') {
        dependencyMap['robust-predicates'] = '3.0.3';
        if (declared) dependencyMap.constructor = '1.0.0';
      }
      if (name === 'project') dependencyMap['jsonc-parser'] = '3.3.1';
      const gpuExport = { types: './dist/web/webgpu.d.ts', import: './dist/web/webgpu.js' };
      const packageExports = name === 'runtime' ? {
        '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
        './text': {types:'./dist/text/index.d.ts',import:'./dist/text/index.js'},
      } : name === 'engine' ? {
        '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
        './webgpu': gpuExport,
        './web': {types:'./dist/web/index.d.ts',import:'./dist/web/index.js'},
        './text': {types:'./dist/text.d.ts',import:'./dist/text.js'},
        './web/text': {types:'./dist/web/text.d.ts',import:'./dist/web/text.js'},
        './web/input': {types:'./dist/web/input.d.ts',import:'./dist/web/input.js'},
        // S3D1_FIXTURE_MAP_BEGIN
        './scene3d': {types:'./dist/rendering/scene3d.d.ts',import:'./dist/rendering/scene3d.js'},
        './webgpu/scene3d': {types:'./dist/web/scene3d.d.ts',import:'./dist/web/scene3d.js'},
        // S3D1_FIXTURE_MAP_END
      } : name === 'project' ? {'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}} : undefined;
      write(`packages/${name}/package.json`, { name: `@egret/${name}`, private: true, version: '0.0.0', type: 'module', dependencies: dependencyMap, ...(packageExports === undefined ? {} : {exports:packageExports}) });
      write(`packages/${name}/tsconfig.json`, { extends: '../../tsconfig.base.json', ...(name === 'project' ? {compilerOptions:{rootDir:'src',outDir:'dist'}} : {}), references: allowed.map(value => ({ path: `../${value.slice('@egret/'.length)}` })) });
      write(`packages/${name}/src/index.ts`, 'export {};\n');
      write(`packages/${name}/dist/index.js`, 'export {};\n');
      const exports = name === 'engine' ? { '.': './index.js', './web': './web.js', './webgpu':'./webgpu.js', './text':'./text.js', './web/text':'./web-text.js', /* S3D1_FIXTURE_RESOLVER_BEGIN */ './scene3d':'./scene3d.js', './webgpu/scene3d':'./scene3d-web.js' /* S3D1_FIXTURE_RESOLVER_END */ }
        : name === 'runtime' ? { '.': './index.js', './text':'./text.js' } : './index.js';
      write(`node_modules/@egret/${name}/package.json`, { name: `@egret/${name}`, type: 'module', exports });
      write(`node_modules/@egret/${name}/index.js`, 'export {};\n');
      if (name === 'project') {
        // Synthetic policy fixture only; the project integration suite uses real builds.
        const values = ['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
        write('node_modules/@egret/project/index.js', values.map(name => `export const ${name}=1;`).join('\n'));
        write('packages/project/dist/index.d.ts', readFileSync(path.join(repository,'packages/project/dist/index.d.ts')));
      }
      if (name === 'engine') {
        write('node_modules/@egret/engine/web.js', 'export function createCanvasHost() {}\n');
        write('node_modules/@egret/engine/webgpu.js', 'export function createTexturedWebGPUHost() {}\nexport function createWebGPUHost() {}\n');
        write('packages/engine/dist/web/index.js', 'export function createCanvasHost() {}\n');
        write('packages/engine/dist/web/webgpu.js', 'export function createTexturedWebGPUHost() {}\nexport function createWebGPUHost() {}\n');
      }
    }
    // These are synthetic policy/resolution surfaces, never engine execution proof.
    const imageValues = ['IMAGE_LIMITS_2D','copyImageData2DPixels','createImageData2D','isImageData2D'];
    const geometryValues = ['createTexturedGeometry2D','isTexturedGeometry2D'];
    const geometryTypes = ['TexturedFloatArray2D','TexturedIndexArray2D','TexturedGeometry2DInput','TexturedGeometry2D'];
    write('packages/contracts/dist/index.js', [
      ...imageValues.filter(name => !missingImageExport || name !== 'isImageData2D').map(name => 'export const '+name+' = 1;'),
      ...geometryValues.filter(name => name !== missingGeometryExport).map(name => 'export function '+name+'() {}'),
      'export const TEXTURED_FRAME_PROFILE_2D = "egret.textured-frame2d/1";',
    ].join('\n'));
    const meshEngineValue = missingMesh === 'root' ? '' : splitMesh || missingMesh === 'runtime' ? 'export class Mesh2D {}\n' : "export {Mesh2D} from '../../../packages/runtime/dist/index.js';\n";
    write('node_modules/@egret/engine/index.js', "export * from '../../../packages/contracts/dist/index.js';\n" + meshEngineValue);
    for (const file of ['packages/contracts/dist/index.d.ts','packages/engine/dist/index.d.ts','packages/engine/dist/web/index.d.ts','packages/engine/dist/web/webgpu.d.ts']) write(file,'export {};\n');
    write('packages/engine/dist/web/webgpu.d.ts', "export {createTexturedWebGPUHost,createWebGPUHost} from './WebGPUHost.js';\nexport type {WebGPUHost,WebGPUHostState,WebGPUHostErrorCode,WebGPUHostFailure,WebGPUHostDiagnostic,WebGPUHostOptions,WebGPUReadback,WebGPUHostStatus,TexturedWebGPUHost,TexturedWebGPUHostOptions,TexturedWebGPUHostStatus} from './WebGPUHost.js';\n");
    const geometryReexports = 'export type {'+geometryTypes.filter(name => name !== missingGeometryType).join(',')+"} from './TexturedGeometry2D.js';\n";
    for (const file of ['packages/contracts/dist/index.d.ts','packages/engine/dist/index.d.ts']) write(file,geometryReexports);
    write('packages/engine/dist/index.d.ts', geometryReexports + (missingMesh === 'root' ? '' : "export {Mesh2D} from '@egret/runtime';\n"));
    write('packages/contracts/dist/TexturedGeometry2D.d.ts', [
      ...geometryTypes.map(name => 'export type '+name+' = unknown;'),
      ...geometryValues.map(name => 'export declare function '+name+'(): unknown;'),
    ].join('\n'));
    write('packages/runtime/dist/index.js','export function collectFrameContent() {}\n' + (missingMesh === 'runtime' ? '' : 'export class Mesh2D {}\n'));
    write('packages/runtime/dist/index.d.ts','interface CapturedContent2D {}\nexport type {CapturedContent2D};\n' + (missingMesh === 'runtime' ? '' : "export {Mesh2D} from './Mesh2D.js';\n"));
    // Profile Task 5: complete valid executable/declaration surfaces first.
    const engineFixturePackage = JSON.parse(readFileSync(path.join(root,'packages/engine/package.json'),'utf8'));
    write('packages/engine/package.json', {...engineFixturePackage, imports:{'#egret-textured-frame-state':{types:'./dist/internal/texturedFrameState.d.ts',import:'./dist/internal/texturedFrameState.js'},'#egret-mouse-input':{types:'./dist/mouseInput.d.ts',import:'./dist/mouseInput.js'}}});
    const profileTypes = ['TexturedFrameProfile2D','TexturedMeshCommand2D','TexturedRenderCommand2D','TexturedRenderFrame2D','TexturedRenderHostAdapter'];
    const profileRootValues = ['Engine','createEngine','createEngineForProfile','CancellationController','EgretError','Event','createEventType','EventDispatcher','DisplayObject','DisplayObjectContainer','Scope','Stage','AssetManager','AssetLease','createAssetType','createAssetRef','Sprite','Graphics','Texture','createTexture','isTexture','Bitmap','createSequenceClip','SequencePlayer'];
    const profileRootFile = 'node_modules/@egret/engine/index.js';
    write(profileRootFile, readFileSync(path.join(root, profileRootFile), 'utf8') + profileRootValues.map(name => `export function ${name}() {}\n`).join(''));
    for (const file of ['packages/contracts/dist/index.d.ts','packages/engine/dist/index.d.ts']) write(file, readFileSync(path.join(root,file),'utf8') + `export type {${profileTypes.join(',')}} from './TexturedRenderFrame2D.js';\n`);
    write('packages/contracts/dist/TexturedRenderFrame2D.d.ts', 'export declare const TEXTURED_FRAME_PROFILE_2D: "egret.textured-frame2d/1";\n' + profileTypes.map(name => `export type ${name} = unknown;\n`).join(''));
    write('packages/runtime/dist/index.js', readFileSync(path.join(root,'packages/runtime/dist/index.js'),'utf8') + 'export function collectTexturedFrameContent() {}\n');
    write('packages/runtime/dist/index.d.ts', readFileSync(path.join(root,'packages/runtime/dist/index.d.ts'),'utf8') + "export {collectTexturedFrameContent} from './texturedFrameCapture.js';\nexport type {CapturedTexturedContent2D} from './texturedFrameCapture.js';\n");
    write('packages/runtime/dist/texturedFrameCapture.js', 'export function collectTexturedFrameContent() {}\n');
    write('packages/runtime/dist/texturedFrameCapture.d.ts', 'export interface CapturedTexturedContent2D {}\nexport declare function collectTexturedFrameContent(): CapturedTexturedContent2D;\n');
    // T1 scaffolds are synthetic policy surfaces, never genuine assets or cache behavior.
    // Retain the three existing runtime values and every old mutation of them.
    const runtimeRootValues = ['CancellationController','EgretError','Scope','createScope','Event','createEventType',
      'EventDispatcher','DisplayObject','DisplayObjectContainer','Stage','createStage','reportDiagnostic','AssetManager',
      'createAssetManager','AssetLease','createAssetType','createAssetRef','Sprite','Graphics','collectFrameCommands',
      'Texture','createTexture','isTexture','Bitmap','createSequenceClip','SequencePlayer'];
    write('packages/runtime/dist/index.js', readFileSync(path.join(root,'packages/runtime/dist/index.js'),'utf8')
      + runtimeRootValues.map(name => `export function ${name}() {}\n`).join(''));
    const textTypes = ['TextRasterRequestInput','TextSourceLine','TextRasterRequest','TextBounds2D','TextLineMetricsInput',
      'TextPlanInput','TextLineMetrics','TextRasterPlacement','TextRasterMetrics','TextRasterPlan','TextRasterLimits',
      'TextMeasureContext','TextRasterContext','TextRasterProvider','TextRasterCacheOptions','TextRasterAcquireOptions',
      'PreparedTextRaster','TextRasterCacheStatus','TextRasterCache'];
    const textTypeScaffold = textTypes.map(name => `export type ${name} = unknown;\n`).join('');
    write('packages/runtime/src/text/types.ts', textTypeScaffold);
    write('packages/runtime/dist/text/types.d.ts', textTypeScaffold);
    write('packages/runtime/dist/text/types.js', 'export {};\n');
    write('packages/runtime/src/text/TextRasterCache.ts', 'export function createTextRasterCache(): void {}\n');
    write('packages/runtime/dist/text/TextRasterCache.js', 'export function createTextRasterCache() {}\n');
    write('packages/runtime/dist/text/TextRasterCache.d.ts', 'export declare function createTextRasterCache(): void;\n');
    const runtimeTextDeclaration = "export {createTextRasterCache} from './TextRasterCache.js';\nexport type * from './types.js';\n";
    write('packages/runtime/src/text/index.ts', runtimeTextDeclaration);
    write('packages/runtime/dist/text/index.d.ts', runtimeTextDeclaration);
    write('packages/runtime/dist/text/index.js', "export {createTextRasterCache} from './TextRasterCache.js';\n");
    const engineTextDeclaration = "export {createTextRasterCache} from '@egret/runtime/text';\nexport type * from '@egret/runtime/text';\n";
    write('packages/engine/src/text.ts', engineTextDeclaration);
    write('packages/engine/dist/text.d.ts', engineTextDeclaration);
    write('packages/engine/dist/text.js', "export {createTextRasterCache} from '@egret/runtime/text';\n");
    write('node_modules/@egret/runtime/text.js', "export {createTextRasterCache} from '../../../packages/runtime/dist/text/index.js';\n");
    write('node_modules/@egret/engine/text.js', "export {createTextRasterCache} from '../../../packages/engine/dist/text.js';\n");
    // TF1 inventory baseline only: inert named interfaces/factory, never leaf behavior.
    const textFieldTypes = 'export interface TextFieldStatus {}\nexport interface TextField {}\n';
    for (const file of ['packages/engine/src/text.ts','packages/engine/dist/text.d.ts'])
      write(file, readFileSync(path.join(root,file),'utf8') + "export {createTextField} from './textField.js';\n" + textFieldTypes);
    write('packages/engine/dist/textField.js', 'export function createTextField() {}\n');
    write('packages/engine/dist/text.js', readFileSync(path.join(root,'packages/engine/dist/text.js'),'utf8') + "export {createTextField} from './textField.js';\n");
    write('node_modules/@egret/engine/text.js', "export {createTextField,createTextRasterCache} from '../../../packages/engine/dist/text.js';\n");
    // BR1 baseline only: inert policy values share one synthetic identity;
    // erased declaration names keep old witnesses reachable, not byte behavior.
    const byteReaderBody = 'export class ByteReader {}\nexport const BYTE_READER_LIMITS = Object.freeze({maxBytes:16777216});\n';
    const byteReaderTypes = 'export type ByteOrder = "bigEndian" | "littleEndian";\nexport declare const BYTE_READER_LIMITS: Readonly<{maxBytes:16777216}>;\nexport declare class ByteReader {}\n';
    write('packages/runtime/src/ByteReader.ts', byteReaderTypes);
    write('packages/runtime/dist/ByteReader.d.ts', byteReaderTypes);
    write('packages/runtime/dist/ByteReader.js', byteReaderBody);
    const byteReaderValues = "export {ByteReader,BYTE_READER_LIMITS} from './ByteReader.js';\n";
    const byteReaderPortTypes = "export type {ByteOrder} from './ByteReader.js';\n";
    for (const file of ['packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + byteReaderValues + (file.endsWith('.d.ts') ? byteReaderPortTypes : ''));
    for (const file of ['packages/engine/dist/index.js', 'packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {ByteReader,BYTE_READER_LIMITS} from '@egret/runtime';\n" + (file.endsWith('.d.ts') ? "export type {ByteOrder} from '@egret/runtime';\n" : ''));
    for (const file of ['node_modules/@egret/engine/index.js', 'node_modules/@egret/runtime/index.js'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {ByteReader,BYTE_READER_LIMITS} from '../../../packages/runtime/dist/ByteReader.js';\n");
    // WC1 baseline only: exact opt-in surfaces let retained policy mutants run.
    // The inert synthetic factory reports Node unavailability; it provides no
    // native Canvas, genuine resource, font, TextField or rendering evidence.
    const canvasTextBarrel = "export {createCanvasTextRasterProvider} from './CanvasTextRasterProvider.js';\n";
    const canvasTextProviderTypes = "import type {TextRasterProvider} from '@egret/engine/text';\nexport declare function createCanvasTextRasterProvider(): TextRasterProvider;\n";
    const canvasTextProviderBody = "export function createCanvasTextRasterProvider() { throw {code:'WEB_TEXT_UNAVAILABLE'}; }\n";
    write('packages/engine/web/text.ts', canvasTextBarrel);
    write('packages/engine/web/CanvasTextRasterProvider.ts', "import type {TextRasterProvider} from '@egret/engine/text';\nexport function createCanvasTextRasterProvider(): TextRasterProvider { throw {code:'WEB_TEXT_UNAVAILABLE'}; }\n");
    write('packages/engine/dist/web/text.js', canvasTextBarrel);
    write('packages/engine/dist/web/text.d.ts', canvasTextBarrel);
    write('packages/engine/dist/web/CanvasTextRasterProvider.js', canvasTextProviderBody);
    write('packages/engine/dist/web/CanvasTextRasterProvider.d.ts', canvasTextProviderTypes);
    write('node_modules/@egret/engine/web-text.js', "export {createCanvasTextRasterProvider} from '../../../packages/engine/dist/web/text.js';\n");
    // HT1 baseline only: inert shared class surfaces exercise declaration and
    // descriptor policy. No Engine, tree, rectangle, picking or lifecycle runs.
    const hitTestOptions = 'export interface HitTestOptions { readonly maxNodes?: number; }\n';
    for (const file of ['packages/runtime/src/displayHitTest.ts', 'packages/runtime/dist/displayHitTest.d.ts'])
      write(file, hitTestOptions + 'export declare function queryDisplayHit(): undefined;\n');
    write('packages/runtime/dist/displayHitTest.js', 'export function queryDisplayHit() {}\n');
    for (const file of ['packages/runtime/src/displayHitState.ts', 'packages/runtime/dist/displayHitState.d.ts'])
      write(file, 'export declare function readDisplayHitState(): undefined;\n');
    write('packages/runtime/dist/displayHitState.js', 'export function readDisplayHitState() {}\n');
    const hitTestClassBodies = {
      DisplayObject: 'export class DisplayObject { get touchEnabled() { return false; } set touchEnabled(value) {} get hitArea() { return undefined; } set hitArea(value) {} }\n',
      DisplayObjectContainer: "import {DisplayObject} from './DisplayObject.js';\nexport class DisplayObjectContainer extends DisplayObject { get touchChildren() { return true; } set touchChildren(value) {} }\n",
      Stage: "import {DisplayObjectContainer} from './DisplayObjectContainer.js';\nexport class Stage extends DisplayObjectContainer { hitTest(globalX, globalY, options) {} }\n",
    };
    const hitTestClassDeclarations = {
      DisplayObject: "import type {Rectangle2D} from '@egret/contracts';\nexport declare class DisplayObject { get touchEnabled(): boolean; set touchEnabled(value: boolean); get hitArea(): Rectangle2D | undefined; set hitArea(value: Rectangle2D | undefined); }\n",
      DisplayObjectContainer: "import {DisplayObject} from './DisplayObject.js';\nexport declare class DisplayObjectContainer extends DisplayObject { get touchChildren(): boolean; set touchChildren(value: boolean); }\n",
      Stage: "import {DisplayObjectContainer} from './DisplayObjectContainer.js';\nimport type {DisplayObject} from './DisplayObject.js';\nimport type {HitTestOptions} from './displayHitTest.js';\nexport declare class Stage extends DisplayObjectContainer { hitTest(globalX: number, globalY: number, options?: HitTestOptions): DisplayObject | undefined; }\n",
    };
    for (const name of Object.keys(hitTestClassBodies)) {
      write(`packages/runtime/dist/${name}.js`, hitTestClassBodies[name]);
      write(`packages/runtime/dist/${name}.d.ts`, hitTestClassDeclarations[name]);
      for (const [file, target] of [['packages/runtime/dist/index.js', `./${name}.js`], ['node_modules/@egret/engine/index.js', `../../../packages/runtime/dist/${name}.js`]])
        write(file, readFileSync(path.join(root, file), 'utf8').replace(`export function ${name}() {}\n`, `export {${name}} from '${target}';\n`));
    }
    write('packages/runtime/dist/index.d.ts', readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8') + "export type {HitTestOptions} from './displayHitTest.js';\n");
    write('packages/engine/dist/index.d.ts', readFileSync(path.join(root, 'packages/engine/dist/index.d.ts'), 'utf8') + "export type {HitTestOptions} from '@egret/runtime';\n");
    // Clock baseline only: inert synthetic policy inputs carry the exact six
    // public type names and erased emission. No owner or behavior shim is added.
    const clockTypes = ['GameClockOptions','GameClockState','GameClockTick','GameClockHandler','GameClock','GameClockSubscription'];
    const clockTypeScaffold = clockTypes.map(name => `export type ${name} = unknown;\n`).join('');
    write('packages/engine/src/gameClockTypes.ts', clockTypeScaffold);
    write('packages/engine/dist/gameClockTypes.d.ts', clockTypeScaffold);
    write('packages/engine/dist/gameClockTypes.js', 'export {};\n');
    for (const file of ['packages/engine/src/gameClock.ts','packages/engine/dist/gameClock.d.ts','packages/engine/dist/gameClock.js']) write(file, 'export {};\n');
    write('packages/engine/dist/index.d.ts', readFileSync(path.join(root,'packages/engine/dist/index.d.ts'),'utf8') + `export type {${clockTypes.join(',')}} from './gameClockTypes.js';\n`);
    // Tween baseline only: inert canonical names and erased module emission.
    // No behavior/owner shim or private-import exemption is introduced.
    const tweenTypes = ['Tween','TweenState','TweenOptions','TweenEasing'];
    const tweenTypeScaffold = tweenTypes.map(name => `export type ${name} = unknown;\n`).join('');
    write('packages/engine/src/tweenTypes.ts', tweenTypeScaffold);
    write('packages/engine/dist/tweenTypes.d.ts', tweenTypeScaffold);
    write('packages/engine/dist/tweenTypes.js', 'export {};\n');
    for (const file of ['packages/engine/src/tween.ts','packages/engine/dist/tween.d.ts','packages/engine/dist/tween.js']) write(file, 'export {};\n');
    write('packages/engine/dist/index.d.ts', readFileSync(path.join(root,'packages/engine/dist/index.d.ts'),'utf8') + `export type {${tweenTypes.join(',')}} from './tweenTypes.js';\n`);
    // RG1 baseline only: exact inert declarations and one instance descriptor let
    // retained policy controls reach their assigned guard. No group, owner,
    // acquisition, cleanup or product module is executed by this scaffold.
    const assetGroupTypes = ['AssetGroup','AssetGroupState','AssetGroupOptions'];
    const assetGroupTypeScaffold = [
      "import type {AssetLease} from '@egret/runtime';",
      'declare const assetGroupBrand: unique symbol;',
      "export type AssetGroupState = 'pending' | 'ready' | 'failed' | 'disposed';",
      'export interface AssetGroupOptions { readonly concurrency?: number; }',
      'export interface AssetGroup<T> { readonly [assetGroupBrand]: true; readonly state: AssetGroupState; readonly ready: Promise<readonly AssetLease<T>[]>; dispose(): void; }',
    ].join('\n') + '\n';
    for (const file of ['packages/engine/src/assetGroupTypes.ts','packages/engine/dist/assetGroupTypes.d.ts']) write(file, assetGroupTypeScaffold);
    write('packages/engine/dist/assetGroupTypes.js', 'export {};\n');
    for (const file of ['packages/engine/src/assetGroup.ts','packages/engine/dist/assetGroup.d.ts','packages/engine/dist/assetGroup.js']) write(file, 'export {};\n');
    for (const file of ['packages/engine/src/index.ts','packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root,file),'utf8') + `export type {${assetGroupTypes.join(',')}} from './assetGroupTypes.js';\n`);
    const assetGroupOperationsScaffold = [
      "import type {AssetAcquireOptions} from './AssetManager.js';",
      "import type {AssetLease} from './AssetLease.js';",
      "import type {AssetRef} from './AssetRef.js';",
      'export interface AssetGroupOperations {',
      'readonly admitGroupRefs: (refs: readonly unknown[]) => void;',
      'readonly acquire: <T>(ref: AssetRef<T>, options?: AssetAcquireOptions) => Promise<AssetLease<T>>;',
      'readonly claimGroupLease: (lease: unknown, group: object) => void;',
      'readonly releaseGroupLease: (lease: unknown) => void;',
      '}',
    ].join('\n') + '\n';
    for (const file of ['packages/runtime/src/assetManagerOwnerState.ts','packages/runtime/dist/assetManagerOwnerState.d.ts']) write(file, assetGroupOperationsScaffold);
    write('packages/runtime/dist/assetManagerOwnerState.js', 'export {};\n');
    for (const file of ['packages/runtime/src/index.ts','packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root,file),'utf8') + "export type {AssetGroupOperations} from './assetManagerOwnerState.js';\n");
    const assetGroupContextScaffold = "import type {AssetGroupOperations} from './assetManagerOwnerState.js';\nexport interface EngineContext { readonly registerAssetGroupOperations?: (operations: AssetGroupOperations) => void; }\n";
    for (const file of ['packages/runtime/src/ownership.ts','packages/runtime/dist/ownership.d.ts']) write(file, assetGroupContextScaffold);
    const assetGroupMethod = 'createAssetGroup<T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions): AssetGroup<T>';
    const assetGroupEngineImports = "import type {Scope,AssetRef} from '@egret/runtime';\nimport type {AssetGroup,AssetGroupOptions} from './assetGroupTypes.js';\n";
    write('packages/engine/src/Engine.ts', assetGroupEngineImports + `export class Engine { ${assetGroupMethod} { throw new Error('Synthetic policy fixture only'); } }\n`);
    write('packages/engine/dist/Engine.d.ts', assetGroupEngineImports + `export declare class Engine { ${assetGroupMethod}; }\n`);
    write(profileRootFile, readFileSync(path.join(root,profileRootFile),'utf8') + "Object.defineProperty(Engine.prototype,'createAssetGroup',{value:function createAssetGroup() {},configurable:true,writable:true});\n");
    write('packages/engine/web/webgpu.ts', 'export {};\n');
    write('packages/engine/src/internal/texturedFrameState.ts', 'export function registerTexturedFrame(): void {}\nexport function readOwnedTexturedFrame(): undefined {return undefined;}\n');
    write('packages/engine/dist/internal/texturedFrameState.js', 'export function registerTexturedFrame() {}\nexport function readOwnedTexturedFrame() {}\n');
    write('packages/engine/dist/internal/texturedFrameState.d.ts', 'export declare function registerTexturedFrame(): void;\nexport declare function readOwnedTexturedFrame(): undefined;\n');
    if (registryLegitimateHosts) {
      // Exact synthetic adapter importers exercise real package-map resolution.
      // This does not import any engine or host implementation.
      for (const file of ['web/CanvasHost.ts', 'web/WebGPUHost.ts', 'dist/web/CanvasHost.js', 'dist/web/WebGPUHost.js']) {
        write(`packages/engine/${file}`, "import {readOwnedTexturedFrame} from '#egret-textured-frame-state';\nexport const registryProbe = readOwnedTexturedFrame;\n");
      }
      for (const file of ['dist/web/CanvasHost.js', 'dist/web/WebGPUHost.js']) {
        const url = pathToFileURL(path.join(root, 'packages/engine', file)).href;
        const resolvedHost = spawnSync(process.execPath, ['--input-type=module', '--eval', `const host = await import(${JSON.stringify(url)}); if (typeof host.registryProbe !== 'function') throw new Error('Synthetic exact host did not resolve registry');`], {cwd:root,encoding:'utf8'});
        assert.ifError(resolvedHost.error);
        assert.equal(resolvedHost.status, 0, `Exact synthetic host resolution failed: ${resolvedHost.stdout}${resolvedHost.stderr}`);
      }
    }

    // This legitimate synthetic Mesh/state surface lets the current checker reach
    // the new guard witness. It is not an actual product build or declaration.
    write('packages/runtime/src/meshDisplayState.ts', meshStateSourceValueImport ? "import {DisplayObject} from './DisplayObject.js';\nexport {};\n" : "import type {DisplayObject} from './DisplayObject.js';\nexport {};\n");
    write('packages/runtime/dist/meshDisplayState.js', (meshStateEmittedValueImport ? "import {Mesh2D} from './Mesh2D.js';\n" : '') + 'export function hasMeshState() {}\nexport function readMeshState() {}\nexport function writeMeshState() {}\n');
    write('packages/runtime/dist/meshDisplayState.d.ts', 'export interface MeshCaptureState {}\nexport declare function hasMeshState(): boolean;\nexport declare function readMeshState(): undefined;\nexport declare function writeMeshState(): void;\n');
    const meshEntryFiles = {
      contracts: ['packages/contracts/dist/index.js', 'packages/contracts/dist/index.d.ts'],
      root: ['node_modules/@egret/engine/index.js', 'packages/engine/dist/index.d.ts'],
      runtime: ['packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'],
      web: ['node_modules/@egret/engine/web.js', 'packages/engine/dist/web/index.d.ts'],
      webgpu: ['node_modules/@egret/engine/webgpu.js', 'packages/engine/dist/web/webgpu.d.ts'],
    };
    if (meshLeak) {
      const file = meshEntryFiles[meshLeak.entry][meshLeak.kind === 'value' ? 0 : 1];
      const leak = meshLeak.kind === 'value' ? 'export function '+meshLeak.name+'() {}\n' : 'export interface '+meshLeak.name+' {}\n';
      write(file, readFileSync(path.join(root, file), 'utf8') + leak);
    }
    if (meshModuleLeak) {
      const file = meshEntryFiles[meshModuleLeak][1];
      write(file, readFileSync(path.join(root, file), 'utf8') + "export * from './meshDisplayState.js';\n");
    }
    if (meshWrongEntry) {
      const file = meshEntryFiles[meshWrongEntry][0];
      write(file, readFileSync(path.join(root, file), 'utf8') + 'export class Mesh2D {}\n');
    }
    for (const name of ['robust-predicates', 'constructor', 'jsonc-parser']) {
      // Deliberately resolve even a deep path; authorization must independently reject it.
      // jsonc-parser is a synthetic resolution fixture here, never installed-library admission.
      write(`node_modules/${name}/package.json`, { name, version: name === 'robust-predicates' ? '3.0.3' : name === 'jsonc-parser' ? '3.3.1' : '1.0.0', type: 'module', exports: { '.': './index.js', './esm/orient2d.js': './index.js' } });
      write(`node_modules/${name}/index.js`, 'export const marker = 1;\n');
    }
    write('packages/engine/web/index.ts', 'export {};\n');
    mkdirSync(path.join(root, 'packages/engine/rendering'), { recursive: true });
    for (const name of ['web', 'rendering']) write(`packages/engine/tsconfig.${name}.json`, readFileSync(path.join(repository, `packages/engine/tsconfig.${name}.json`)));
    write(`packages/${subtree}/Probe.ts`, `import { marker } from ${JSON.stringify(imported)};\nexport const value = marker;\n`);
    const resolution = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(imported)});`], { cwd: path.join(root, 'packages/engine'), encoding: 'utf8' });
    assert.equal(resolution.status, 0, resolution.stderr);
    // S3D1_FIXTURE_SCAFFOLD_BEGIN
    // Inert policy-only dependency stubs: no CPU identity/native/Host claim.
    const sceneGraph = {"packages/engine/rendering/sceneFrame3D.ts":[["static","./matrix4.js"],["static","./matrix4.js"],["static","./meshGeometry3D.js"],["static","./meshGeometry3D.js"],["static","./projection3D.js"]],"packages/engine/rendering/meshGeometry3D.ts":[],"packages/engine/web/b1.ts":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"],["static","@egret/contracts"]],"packages/engine/rendering/matrix4.ts":[],"packages/engine/rendering/projection3D.ts":[["static","./matrix4.js"],["static","./matrix4.js"]],"packages/engine/rendering/packMeshGeometry3D.ts":[["static","./meshGeometry3D.js"]],"packages/engine/web/WebGPUHost.ts":[["dynamic","./b1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./b1.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/web/webgpuMeshPass.ts":[],"packages/engine/rendering/admitTexturedFrame2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedDraws2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/copyFrame2D.ts":[["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/copyMixedFrame2D.ts":[["static","./copyFrame2D.js"],["static","./copyFrame2D.js"],["static","./imageFrameBudget.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/ownedPreparationFailure2D.ts":[],"packages/engine/rendering/packImageVertices2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/rendering/packTexturedMesh2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/rendering/prepareMixedDraws2D.ts":[["static","./prepareImages2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/prepareRectangles2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./RectangleFrame2D.js"],["static","@egret/contracts"],["static","robust-predicates"]],"packages/engine/rendering/prepareTexturedDraws2D.ts":[["static","./prepareImages2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/texturedPreparationBudget2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/web/imageProjections2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/web/prepareTexturedSubmission2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/web/texturedWebGPUOptions.ts":[["static","./WebGPUHost.js"]],"packages/engine/web/webgpuImagePass.ts":[],"packages/engine/web/webgpuLifetime.ts":[],"packages/engine/web/webgpuPass.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packedOrientation.js"],["static","../rendering/packedPosition2D.js"],["static","../rendering/prepareRectangles2D.js"]],"packages/engine/web/webgpuTexturedPass.ts":[],"packages/engine/rendering/RectangleFrame2D.ts":[["static","@egret/contracts"]],"packages/engine/rendering/imageFrameBudget.ts":[["static","./copyFrame2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/packedOrientation.ts":[["static","./prepareRectangles2D.js"],["static","robust-predicates"]],"packages/engine/rendering/packedPosition2D.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/rendering/prepareImages2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/prepareTexturedMesh2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/sceneFrame3D.js":[["static","./matrix4.js"],["static","./meshGeometry3D.js"],["static","./projection3D.js"]],"packages/engine/dist/rendering/sceneFrame3D.d.ts":[["static","./matrix4.js"],["static","./meshGeometry3D.js"]],"packages/engine/dist/rendering/meshGeometry3D.js":[],"packages/engine/dist/rendering/meshGeometry3D.d.ts":[],"packages/engine/dist/web/b1.js":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"]],"packages/engine/dist/web/b1.d.ts":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/matrix4.js":[],"packages/engine/dist/rendering/matrix4.d.ts":[],"packages/engine/dist/rendering/projection3D.js":[["static","./matrix4.js"]],"packages/engine/dist/rendering/projection3D.d.ts":[["static","./matrix4.js"]],"packages/engine/dist/rendering/packMeshGeometry3D.js":[["static","./meshGeometry3D.js"]],"packages/engine/dist/rendering/packMeshGeometry3D.d.ts":[["static","./meshGeometry3D.js"]],"packages/engine/dist/web/WebGPUHost.js":[["dynamic","./b1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/dist/web/WebGPUHost.d.ts":[["static","./b1.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","@egret/contracts"]],"packages/engine/dist/web/webgpuMeshPass.js":[],"packages/engine/dist/web/webgpuMeshPass.d.ts":[],"packages/engine/dist/rendering/admitTexturedFrame2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/admitTexturedFrame2D.d.ts":[["static","./prepareTexturedDraws2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyFrame2D.js":[],"packages/engine/dist/rendering/copyFrame2D.d.ts":[["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyMixedFrame2D.js":[["static","./copyFrame2D.js"],["static","./imageFrameBudget.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyMixedFrame2D.d.ts":[["static","./copyFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/ownedPreparationFailure2D.js":[],"packages/engine/dist/rendering/ownedPreparationFailure2D.d.ts":[],"packages/engine/dist/rendering/packImageVertices2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packImageVertices2D.d.ts":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packTexturedMesh2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packTexturedMesh2D.d.ts":[["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/dist/rendering/prepareMixedDraws2D.js":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareMixedDraws2D.d.ts":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareRectangles2D.js":[["static","./ownedPreparationFailure2D.js"],["static","robust-predicates"]],"packages/engine/dist/rendering/prepareRectangles2D.d.ts":[["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareTexturedDraws2D.js":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"]],"packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/texturedPreparationBudget2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/dist/web/imageProjections2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","@egret/contracts"]],"packages/engine/dist/web/imageProjections2D.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/web/prepareTexturedSubmission2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"]],"packages/engine/dist/web/prepareTexturedSubmission2D.d.ts":[["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"]],"packages/engine/dist/web/texturedWebGPUOptions.js":[],"packages/engine/dist/web/texturedWebGPUOptions.d.ts":[["static","./WebGPUHost.js"]],"packages/engine/dist/web/webgpuImagePass.js":[],"packages/engine/dist/web/webgpuImagePass.d.ts":[],"packages/engine/dist/web/webgpuLifetime.js":[],"packages/engine/dist/web/webgpuLifetime.d.ts":[],"packages/engine/dist/web/webgpuPass.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packedOrientation.js"],["static","../rendering/packedPosition2D.js"]],"packages/engine/dist/web/webgpuPass.d.ts":[["static","../rendering/prepareRectangles2D.js"]],"packages/engine/dist/web/webgpuTexturedPass.js":[],"packages/engine/dist/web/webgpuTexturedPass.d.ts":[],"packages/engine/dist/rendering/RectangleFrame2D.js":[],"packages/engine/dist/rendering/RectangleFrame2D.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/rendering/imageFrameBudget.js":[["static","./copyFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/imageFrameBudget.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/rendering/packedOrientation.js":[["static","robust-predicates"]],"packages/engine/dist/rendering/packedOrientation.d.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packedPosition2D.js":[],"packages/engine/dist/rendering/packedPosition2D.d.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareImages2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareImages2D.d.ts":[["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareTexturedMesh2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts":[["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]]};
    for (const [file,edges] of Object.entries(sceneGraph)) {
      const original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      const present=[...original.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
      const needed=[...edges];
      for (const target of present) { const index=needed.findIndex(edge=>edge[1]===target); if(index>=0)needed.splice(index,1); }
      const imports=needed.map(([kind,target],index)=>kind==='dynamic'?`const sceneDynamic${index}=()=>import(${JSON.stringify(target)});`: `import ${JSON.stringify(target)};`).join('\n');
      write(file,original+'\n'+imports+'\n');
    }
    for (const [target,names] of [['meshGeometry3D',['createMeshGeometry3D','isMeshGeometry3D','getMeshGeometry3DErrorOrigin','MeshGeometry3DError']],['sceneFrame3D',['createSceneFrame3D','isSceneFrame3D','getScene3DErrorOrigin','Scene3DError']]]) {
      const file='packages/engine/dist/rendering/'+target+'.js';
      write(file,readFileSync(path.join(root,file),'utf8')+names.map(name=>`export function ${name}() {}`).join('\n'));
    }
    const sceneB1='packages/engine/dist/web/b1.js';
    write(sceneB1,readFileSync(path.join(root,sceneB1),'utf8')+'export function createB1WebGPUHost() {}\n');
    const cpuTypes=['Matrix4','MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin','SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'];
    const cpuTypeText="export type {Matrix4} from './matrix4.js';\nexport type {MeshGeometry3D,MeshGeometry3DErrorCode,MeshGeometry3DErrorOrigin} from './meshGeometry3D.js';\nexport type {SceneProjectionInput3D,SceneDrawInput3D,SceneInput3D,SceneDraw3D,SceneFrame3D,Scene3DErrorCode,Scene3DErrorOrigin} from './sceneFrame3D.js';\nexport interface MeshGeometry3DInput { readonly positions: readonly number[]; readonly colors: readonly number[]; readonly indices: readonly number[]; }\n";
    const cpuValues="export {isMeshGeometry3D,MeshGeometry3DError,getMeshGeometry3DErrorOrigin} from './meshGeometry3D.js';\nexport {isSceneFrame3D,Scene3DError,getScene3DErrorOrigin} from './sceneFrame3D.js';\n";
    const cpuImports="import {createMeshGeometry3D as createMeshGeometry3DInternal} from './meshGeometry3D.js';\nimport {createSceneFrame3D as createSceneFrame3DInternal} from './sceneFrame3D.js';\n";
    write('packages/engine/rendering/scene3d.ts',cpuImports+cpuValues+cpuTypeText+'export function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D { return createMeshGeometry3DInternal(input); }\nexport function createSceneFrame3D(input: SceneInput3D): SceneFrame3D { return createSceneFrame3DInternal(input); }\n');
    write('packages/engine/dist/rendering/scene3d.js',cpuImports+cpuValues+'export function createMeshGeometry3D(input) { return createMeshGeometry3DInternal(input); }\nexport function createSceneFrame3D(input) { return createSceneFrame3DInternal(input); }\n');
    write('packages/engine/dist/rendering/scene3d.d.ts',cpuValues+cpuTypeText+'export declare function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D;\nexport declare function createSceneFrame3D(input: SceneInput3D): SceneFrame3D;\n');
    const browserTypes="import type {RenderFrame2D} from '@egret/contracts';\nimport type {SceneFrame3D} from '../rendering/scene3d.js';\nimport type {WebGPUHost,WebGPUHostOptions,WebGPUHostStatus} from './webgpu.js';\nexport type SceneWebGPUHostOptions = WebGPUHostOptions;\nexport interface SceneWebGPUHostStatus { readonly host: WebGPUHostStatus; readonly pendingSceneBytes: number; readonly pendingUniformBytes: number; readonly pendingDepthBytes: number; }\nexport interface SceneWebGPUHost extends WebGPUHost { renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined; getSceneStatus(): SceneWebGPUHostStatus; }\n";
    const browserImport="import {createB1WebGPUHost} from './b1.js';\n";
    write('packages/engine/web/scene3d.ts',browserImport+browserTypes+'export function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost { return createB1WebGPUHost(options); }\n');
    write('packages/engine/dist/web/scene3d.js',browserImport+'export function createSceneWebGPUHost(options) { return createB1WebGPUHost(options); }\n');
    write('packages/engine/dist/web/scene3d.d.ts',browserTypes+'export declare function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost;\n');
    write('node_modules/@egret/engine/scene3d.js',"export * from '../../../packages/engine/dist/rendering/scene3d.js';\n");
    write('node_modules/@egret/engine/scene3d-web.js',"export * from '../../../packages/engine/dist/web/scene3d.js';\n");
    // S3D1_FIXTURE_SCAFFOLD_END
    // MI1_FIXTURE_SCAFFOLD_BEGIN
    // Inert canonical policy inputs, never picker/event/native behavior evidence.
    const mouseTypes=['MouseInputOptions','MouseInput','MouseInputState','MouseInputEvents','MouseInputPayload','MouseInputCancelReason'];
    const mouseBarrel="export {createMouseInput} from './MouseInput.js';\nexport type {"+mouseTypes.join(',')+"} from '#egret-mouse-input';\n";
    write('packages/engine/web/input.ts',mouseBarrel);write('packages/engine/dist/web/input.d.ts',mouseBarrel);
    write('packages/engine/dist/web/input.js',"export {createMouseInput} from './MouseInput.js';\n");
    write('node_modules/@egret/engine/mouse-input.js',"export * from '../../../packages/engine/dist/web/input.js';\n");
    const resolverFile='node_modules/@egret/engine/package.json',resolver=JSON.parse(readFileSync(path.join(root,resolverFile),'utf8'));
    write(resolverFile,{...resolver,exports:{...resolver.exports,'./web/input':'./mouse-input.js'}});
    const mouseTypeScaffold=mouseTypes.map(name=>'export type '+name+' = unknown;\n').join('');
    write('packages/engine/src/mouseInputTypes.ts',mouseTypeScaffold);write('packages/engine/dist/mouseInputTypes.d.ts',mouseTypeScaffold);write('packages/engine/dist/mouseInputTypes.js','export {};\n');
    const browserInput="import {createMouseInputWithNative} from '#egret-mouse-input';\nexport function createMouseInput(options) { return createMouseInputWithNative(options); }\n";
    write('packages/engine/web/MouseInput.ts',browserInput);write('packages/engine/dist/web/MouseInput.js',browserInput);
    write('packages/engine/dist/web/MouseInput.d.ts',"import type {MouseInputOptions,MouseInput} from '#egret-mouse-input';\nexport declare function createMouseInput(options:MouseInputOptions):MouseInput;\n");
    const ownerSource="import {CancellationController,EgretError} from '@egret/runtime';\nexport function createMouseInputOwner(engine, assembly) {\nconst sample = new CancellationController().signal;\nconst originalSignals = new WeakMap();\nlet started=false;\nif (!started) throw new EgretError('MOUSE_INPUT_INVALID');\n}\nexport function createMouseInputWithNative(options) {}\nexport type {"+mouseTypes.join(',')+"} from './mouseInputTypes.js';\n";
    write('packages/engine/src/mouseInput.ts',ownerSource);write('packages/engine/dist/mouseInput.js','export function createMouseInputWithNative(options) {}\n');
    write('packages/engine/dist/mouseInput.d.ts','export declare function createMouseInputWithNative(options:unknown):unknown;\nexport type {'+mouseTypes.join(',')+"} from './mouseInputTypes.js';\n");
    for(const file of ['packages/engine/src/internal/mouseInputFactoryState.ts','packages/engine/dist/internal/mouseInputFactoryState.js'])write(file,'export function markMouseInputEngineStarted(engine) {}\n');
    write('packages/engine/src/startEngine.ts',"import {markMouseInputEngineStarted} from './internal/mouseInputFactoryState.js';\nexport async function startEngine(host,engine) { await host.start?.(); markMouseInputEngineStarted(engine); return engine; }\n");
    const engineSourceFile='packages/engine/src/Engine.ts',engineOriginal=readFileSync(path.join(root,engineSourceFile),'utf8');
    const mouseEngineBody=' #currentState="open"; #mouseInputOwner; #assetGroupOwner; constructor() { const stage={}; this.#mouseInputOwner=createMouseInputOwner(this,{operations:createDisplayInputOperations(stage)}); } createScope() { const scope={}; this.#mouseInputOwner.registerScope(scope); return scope; } dispose() { this.#currentState = "closing"; this.#mouseInputOwner.close(); this.#assetGroupOwner.close(); } ';
    write(engineSourceFile,"import {createDisplayInputOperations} from '@egret/runtime';\nimport {createMouseInputOwner} from './mouseInput.js';\n"+engineOriginal.replace('export class Engine {','export class Engine {'+mouseEngineBody));
    write('packages/runtime/dist/EventDispatcher.js','export function dispatchDisplayInputEvent(target,event,route) {}\n');
    const operationSource="import {queryDisplayHit} from './displayHitTest.js';\nimport {dispatchDisplayInputEvent} from './EventDispatcher.js';\nexport function createDisplayInputOperations(stage) { return {pick(x,y,maxNodes) { return queryDisplayHit(stage,x,y,{maxNodes}); },dispatch(target,event,maxNodes) { return dispatchDisplayInputEvent(target,event,[]); }}; }\n";
    write('packages/runtime/src/displayInputOperations.ts',operationSource);write('packages/runtime/dist/displayInputOperations.js',operationSource);
    write('packages/runtime/dist/displayInputOperations.d.ts','export interface DisplayInputOperations {}\nexport declare function createDisplayInputOperations(stage:unknown):DisplayInputOperations;\n');
    write('packages/runtime/dist/index.js',readFileSync(path.join(root,'packages/runtime/dist/index.js'),'utf8')+"export {createDisplayInputOperations} from './displayInputOperations.js';\n");
    write('packages/runtime/dist/index.d.ts',readFileSync(path.join(root,'packages/runtime/dist/index.d.ts'),'utf8')+"export {createDisplayInputOperations} from './displayInputOperations.js';\nexport type {DisplayInputOperations} from './displayInputOperations.js';\n");
    // MI1_FIXTURE_SCAFFOLD_END
    const profileMutation = profileLeak || profileModuleLeak || missingTexturedPort || missingProfileFactory || profileRegistryImport || registryMapMutation || registryImporterProbe;
    if (profileMutation) {
      const baseline = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], {cwd:root,encoding:'utf8'});
      assert.ifError(baseline.error);
      assert.equal(baseline.status, 0, `Assigned profile control never reached valid baseline: ${baseline.stdout}${baseline.stderr}`);
      assert.match(baseline.stdout, /Boundary check PASS/);
      if (profileLeak) {
        const file = meshEntryFiles[profileLeak.entry][profileLeak.kind === 'value' ? 0 : 1];
        const addition = profileLeak.kind === 'value' ? `export function ${profileLeak.name}() {}\n` : `export interface ${profileLeak.name} {}\n`;
        write(file, readFileSync(path.join(root,file),'utf8') + addition);
      }
      if (profileModuleLeak) {
        const emittedEntry = profileModuleLeak.entry === 'root' ? 'packages/engine/dist/index.js' : 'packages/runtime/dist/index.js';
        const declarationEntry = meshEntryFiles[profileModuleLeak.entry][1];
        const target = `./${profileModuleLeak.name}.js`;
        const modulePath = path.posix.join(path.posix.dirname(emittedEntry), target);
        write(modulePath, 'export const boundaryPrivateMarker = 1;\n');
        write(modulePath.replace(/\.js$/, '.d.ts'), 'export interface BoundaryPrivateMarker {}\n');
        if (profileModuleLeak.kind === 'type') write(declarationEntry, readFileSync(path.join(root,declarationEntry),'utf8') + `export type {BoundaryPrivateMarker as retainedAuthority} from '${target}';\n`);
        else {
          write(emittedEntry, readFileSync(path.join(root,emittedEntry),'utf8') + `export {boundaryPrivateMarker as retainedAuthority} from '${target}';\n`);
          if (profileModuleLeak.entry === 'root') {
            // Actual root executable facade also resolves the same named module.
            write(`node_modules/@egret/engine/${profileModuleLeak.name}.js`, 'export const boundaryPrivateMarker = 1;\n');
            const file = meshEntryFiles.root[0];
            write(file, readFileSync(path.join(root,file),'utf8') + `export {boundaryPrivateMarker as retainedAuthority} from '${target}';\n`);
          }
        }
      }
      if (missingTexturedPort === 'value') {
        const file = 'packages/runtime/dist/index.js';
        write(file, readFileSync(path.join(root,file),'utf8').replace('export function collectTexturedFrameContent() {}\n',''));
      }
      if (missingTexturedPort === 'type') {
        const file = 'packages/runtime/dist/index.d.ts';
        write(file, readFileSync(path.join(root,file),'utf8').replace("export type {CapturedTexturedContent2D} from './texturedFrameCapture.js';\n",''));
      }
      if (missingProfileFactory) {
        const file = meshEntryFiles.root[0];
        write(file, readFileSync(path.join(root,file),'utf8').replace('export function createEngineForProfile() {}\n',''));
      }
      if (profileRegistryImport) {
        write('packages/engine/dist/internal/marker.js', 'export const marker = 1;\n');
        const file = 'packages/engine/dist/internal/texturedFrameState.js';
        write(file, "import {marker} from './marker.js';\n" + readFileSync(path.join(root,file),'utf8'));
      }
      if (registryMapMutation) {
        const file = `packages/${registryMapMutation.packageName}/package.json`;
        const pkg = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
        if (registryMapMutation.remove) delete pkg.imports;
        else pkg.imports = registryMapMutation.imports;
        write(file, pkg);
      }
      if (registryImporterProbe) {
        const file = `packages/engine/${registryImporterProbe}`;
        write(file, "import {readOwnedTexturedFrame} from '#egret-textured-frame-state';\nexport const registryProbe = readOwnedTexturedFrame;\n");
        // A resolvable package alias is still forbidden from the wrong importer.
        // Only emitted .js fixtures execute here; .ts probes are source-policy only.
        if (registryImporterProbe.endsWith('.js')) {
          const url = pathToFileURL(path.join(root, file)).href;
          const resolution = spawnSync(process.execPath, ['--input-type=module', '--eval', `const probe = await import(${JSON.stringify(url)}); if (typeof probe.registryProbe !== 'function') throw new Error('Synthetic disallowed importer did not resolve registry');`], {cwd:root,encoding:'utf8'});
          assert.ifError(resolution.error);
          assert.equal(resolution.status, 0, `Disallowed synthetic importer was not resolvable: ${resolution.stdout}${resolution.stderr}`);
        }
      }
    }

    if (hitTestMutation) {
      const baseline = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
      assert.ifError(baseline.error);
      assert.equal(baseline.status, 0, `Assigned HT1 control never reached valid baseline: ${baseline.stdout}${baseline.stderr}`);
      assert.match(baseline.stdout, /Boundary check PASS/);
      const edits = {
        'missing-runtime-options': ['packages/runtime/dist/index.d.ts', "export type {HitTestOptions} from './displayHitTest.js';\n", ''],
        'alias-root-options': ['packages/engine/dist/index.d.ts', 'export type {HitTestOptions}', 'export type {HitTestOptions as PublicOptions}'],
        'value-root-options': ['packages/engine/dist/index.d.ts', 'export type {HitTestOptions}', 'export {HitTestOptions}'],
        'duplicate-root-options': ['packages/engine/dist/index.d.ts', '', "export type {HitTestOptions} from '@egret/runtime';\n"],
        'off-entry-options': ['packages/contracts/dist/index.d.ts', '', 'export interface HitTestOptions {}\n'],
        'alias-private-query': ['packages/runtime/dist/index.d.ts', '', "export type {queryDisplayHit as PublicQuery} from './displayHitTest.js';\n"],
        'alias-private-state': ['packages/engine/dist/index.d.ts', '', "export type {DisplayHitState as PublicState} from './displayHitState.js';\n"],
        'split-root-stage': ['node_modules/@egret/engine/index.js', "export {Stage} from '../../../packages/runtime/dist/Stage.js';\n", 'export class Stage { hitTest(globalX, globalY, options) {} }\n'],
        'missing-getter-declaration': ['packages/runtime/dist/DisplayObject.d.ts', 'get touchEnabled(): boolean;', ''],
        'missing-setter-descriptor': ['packages/runtime/dist/DisplayObject.js', 'set touchEnabled(value) {}', ''],
        'missing-query-declaration': ['packages/runtime/dist/Stage.d.ts', 'hitTest(globalX: number, globalY: number, options?: HitTestOptions): DisplayObject | undefined;', ''],
        'missing-query-descriptor': ['packages/runtime/dist/Stage.js', 'hitTest(globalX, globalY, options) {}', ''],
        'ambient-query-reference': ['packages/runtime/src/displayHitTest.ts', '', '/// <reference lib="dom" />\n'],
        'state-value-backedge': ['packages/runtime/src/displayHitState.ts', '', "import {DisplayObject} from './DisplayObject.js';\n"],
      };
      const mutation = edits[hitTestMutation];
      assert.ok(mutation, `Unknown HT1 policy mutation: ${hitTestMutation}`);
      if (hitTestMutation === 'alias-private-state') {
        // A resolvable same-package declaration alias must reach the new guard,
        // rather than earning rejection from the retained cross-package rule.
        write('packages/engine/dist/displayHitState.d.ts', 'export interface DisplayHitState {}\n');
        write('packages/engine/dist/displayHitState.js', 'export {};\n');
      }
      const [file, before, after] = mutation, original = readFileSync(path.join(root, file), 'utf8');
      if (before !== '') assert.equal(original.split(before).length - 1, 1, `HT1 mutation anchor is not unique: ${hitTestMutation}`);
      write(file, before === '' ? original + after : original.replace(before, after));
    }
    // S3D1_MUTATION_BEGIN
    let sceneComparator;
    if (scene3dMutation) {
      assert.equal(createHash('sha256').update(readFileSync(path.join(root,'tools/check-boundaries.mjs'))).digest('hex'),checkerHash,'exact amended checker fixture copy');
      const predecessor=checker.toString('utf8').replace(/\/\/ S3D1_BOUNDARY_BEGIN[\s\S]*?\/\/ S3D1_BOUNDARY_END\r?\n/,'');
      assert.equal(predecessor.includes('S3D1_BOUNDARY_BEGIN'),false);
      assert.match(predecessor,/['"]\.\/scene3d['"]:/,'map-adapted predecessor retains new maps');
      const execute=program=>{write('tools/check-boundaries.mjs',program);const value=spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:root,encoding:'utf8'});assert.ifError(value.error);return value;};
      for(const [label,program]of [['amended',checker],['map-adapted predecessor',predecessor]]) {
        const baseline=execute(program);assert.equal(baseline.status,0,label+' canonical baseline: '+baseline.stdout+baseline.stderr);assert.match(baseline.stdout,/Boundary check PASS/);
      }
      const edits={
        'extra-cpu-runtime':['packages/engine/dist/rendering/scene3d.js','','export function extraSceneFactory() {}\n'],
        'missing-cpu-runtime':['packages/engine/dist/rendering/scene3d.js',"export {isSceneFrame3D,Scene3DError,getScene3DErrorOrigin} from './sceneFrame3D.js';\n","export {Scene3DError,getScene3DErrorOrigin} from './sceneFrame3D.js';\n"],
        'extra-cpu-type':['packages/engine/dist/rendering/scene3d.d.ts','','export interface ExtraSceneType {}\n'],
        'aliased-cpu-type':['packages/engine/dist/rendering/scene3d.d.ts','export type {Matrix4}','export type {Matrix4 as MatrixAlias}'],
        'cpu-type-as-value':['packages/engine/dist/rendering/scene3d.d.ts','export type {Matrix4}','export {Matrix4}'],
        'extra-web-runtime':['packages/engine/dist/web/scene3d.js','','export function extraSceneHost() {}\n'],
        'extra-web-type':['packages/engine/dist/web/scene3d.d.ts','','export interface ExtraSceneHostType {}\n'],
        'private-web-declaration':['packages/engine/dist/web/scene3d.d.ts','../rendering/scene3d.js','../rendering/sceneFrame3D.js'],
        'old-entry-new-input-type':['packages/engine/dist/web/index.d.ts','','export interface MeshGeometry3DInput {}\n'],
        'old-entry-new-host-type':['packages/engine/dist/web/index.d.ts','','export interface SceneWebGPUHostOptions {}\n'],
        'extra-cpu-static-edge':['packages/engine/dist/rendering/scene3d.js','',"import './projection3D.js';\n"],
        'extra-cpu-dynamic-edge':['packages/engine/dist/rendering/scene3d.js','',"const dormant=()=>import('./projection3D.js');\n"],
        'extra-transitive-dynamic-edge':['packages/engine/dist/rendering/matrix4.js','',"const dormant=()=>import('./meshGeometry3D.js');\n"],
        'cpu-extra-module-work':['packages/engine/dist/rendering/scene3d.js','','const sceneExtraWork=Object.freeze({});\n'],
        'wrong-local-output-type':['packages/engine/dist/rendering/scene3d.d.ts',"export type {Matrix4} from './matrix4.js';\n",'export interface Matrix4 {}\n'],
        'old-entry-extra-facade-edge':['packages/engine/web/index.ts','',"import type {SceneFrame3D} from '../rendering/scene3d.js';\n"],
      };
      const edit=edits[scene3dMutation];assert.ok(edit,'finite S3D1 mutation');const [file,before,after]=edit,original=readFileSync(path.join(root,file),'utf8');
      if(before!=='')assert.equal(original.split(before).length-1,1,'unique S3D1 mutation anchor');
      write(file,before===''?original+after:original.replace(before,after));
      sceneComparator=execute(predecessor);
      assert.equal(sceneComparator.status,0,'new guard candidate must PASS map-adapted predecessor: '+sceneComparator.stdout+sceneComparator.stderr);
      assert.match(sceneComparator.stdout,/Boundary check PASS/);
      write('tools/check-boundaries.mjs',checker);
    }
    // S3D1_MUTATION_END
    // MI1_MUTATION_BEGIN
    if(mouseInputMutation) {
      assert.equal(createHash('sha256').update(readFileSync(path.join(root,'tools/check-boundaries.mjs'))).digest('hex'),checkerHash,'exact MI1 checker fixture copy');
      const baseline=spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:root,encoding:'utf8'});assert.ifError(baseline.error);
      assert.equal(baseline.status,0,'MI1 mutation requires canonical baseline first: '+baseline.stdout+baseline.stderr);assert.match(baseline.stdout,/Boundary check PASS/);
      const edits={
        'extra-runtime':['packages/engine/dist/web/input.js','','export function extraMouseInput() {}\n'],
        'extra-type':['packages/engine/dist/web/input.d.ts','','export interface ExtraMouseInput {}\n'],
        'type-as-value':['packages/engine/dist/web/input.d.ts','export type {MouseInputOptions','export {MouseInputOptions'],
        'wrong-forward':['packages/engine/web/input.ts',"from './MouseInput.js'","from './input.js'"],
        'barrel-work':['packages/engine/web/input.ts','','const extraMouseWork=Object.freeze({});\n'],
        'root-type-leak':['packages/engine/dist/index.d.ts','','export interface MouseInputPayload {}\n'],
        'web-type-leak':['packages/engine/dist/web/index.d.ts','','export interface MouseInputEvents {}\n'],
        'gpu-type-leak':['packages/engine/dist/web/webgpu.d.ts','','export interface MouseInputState {}\n'],
        'engine-assembly-type':['packages/engine/dist/index.d.ts','','export interface DisplayInputOperations {}\n'],
        'types-runtime':['packages/engine/dist/mouseInputTypes.js','','export const MouseInputTypeRuntime=1;\n'],
        'browser-extra-import':['packages/engine/web/MouseInput.ts','',"import {Scope} from '@egret/runtime';\n"],
        'browser-dynamic-import':['packages/engine/web/MouseInput.ts','',"const lazyInput=()=>import('./MouseInput.js');\n"],
        'browser-emitted-src':['packages/engine/web/MouseInput.ts',"from '#egret-mouse-input'","from '../src/mouseInput.js'"],
        'public-picker':['packages/runtime/src/displayInputOperations.ts','queryDisplayHit(stage,x,y,{maxNodes})','stage.hitTest(x,y,{maxNodes})'],
        'public-dispatch':['packages/runtime/src/displayInputOperations.ts','dispatchDisplayInputEvent(target,event,[])','target.dispatchEvent(event)'],
        'early-gate':['packages/engine/src/Engine.ts','this.#mouseInputOwner.close(); this.#assetGroupOwner.close();','this.#assetGroupOwner.close(); this.#mouseInputOwner.close();'],
        'startup-ready':['packages/engine/src/startEngine.ts','await host.start?.(); markMouseInputEngineStarted(engine);','markMouseInputEngineStarted(engine); await host.start?.();'],
        'module-signal-capture':['packages/engine/src/mouseInput.ts','export function createMouseInputOwner(engine, assembly) {\nconst sample = new CancellationController().signal;','const sample = new CancellationController().signal;\nexport function createMouseInputOwner(engine, assembly) {'],
        'private-type-target':['packages/engine/src/ProbeMouse.ts','',"import type {MouseInput} from './mouseInputTypes.js';\n"],
        'private-alias-importer':['packages/engine/web/ProbeMouse.ts','',"import type {MouseInput} from '#egret-mouse-input';\n"],
      };
      const edit=edits[mouseInputMutation];assert.ok(edit,'finite MI1 assigned mutation');const [file,before,after]=edit;
      const original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      if(before!=='')assert.equal(original.split(before).length-1,1,'unique MI1 source mutation anchor');
      write(file,before===''?original+after:original.replace(before,after));
    }
    // MI1_MUTATION_END
    const result = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    /* S3D1_RESULT_BEGIN */ if(sceneComparator)result.mapAdaptedPredecessor=sceneComparator; /* S3D1_RESULT_END */
    run(result);
  } finally {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(ownedParent + path.sep) && path.basename(resolved).startsWith('egret-boundary-policy-'));
    rmSync(resolved, { recursive: true, force: true });
    assert.equal(existsSync(resolved), false);
  }
}

// MI1_POLICY_TESTS_BEGIN
test('MI1 canonical policy baseline preserves every retained facade and exact alias',()=>{
  fixture({imported:'robust-predicates'},result=>{assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Boundary check PASS/);});
});
for(const [name,reason]of [
  ['extra-runtime','MI1: exact optional runtime export surface mismatch'],
  ['extra-type','MI1: exact optional export surface mismatch'],
  ['type-as-value','MI1: exact optional export surface mismatch'],
  ['wrong-forward','MI1: exact optional forwarding mismatch'],
  ['barrel-work','MI1: input barrel performs module work'],
  ['root-type-leak','MI1: input leaks outside optional entry'],
  ['web-type-leak','MI1: input leaks outside optional entry'],
  ['gpu-type-leak','webgpu: exact type-only host export surface mismatch'],
  ['engine-assembly-type','MI1: input leaks outside optional entry'],
  ['types-runtime','MI1: input types emitted runtime values'],
  ['browser-extra-import','MI1: exact input module import closure mismatch'],
  ['browser-dynamic-import','MI1: exact input module import closure mismatch'],
  ['browser-emitted-src','MI1: exact input module import closure mismatch'],
  ['public-picker','MI1: captured display port must reuse private HT1 and typed route'],
  ['public-dispatch','MI1: captured display port must reuse private HT1 and typed route'],
  ['early-gate','MI1: early Engine input gate order mismatch'],
  ['startup-ready','MI1: successful startup readiness guard missing'],
  ['module-signal-capture','MI1: Signal intrinsic capture must occur per Engine assembly'],
  ['private-type-target','MI1: private input target imported outside named paths'],
  ['private-alias-importer','MI1: private mouse input alias imported outside exact browser ports'],
])test('MI1 policy '+name+' requires canonical baseline and assigned refusal',()=>{
  fixture({imported:'robust-predicates',mouseInputMutation:name},result=>{assert.equal(result.status,1,result.stdout+result.stderr);assert.ok(result.stderr.includes(reason),result.stderr);});
});
// MI1_POLICY_TESTS_END

// S3D1_TESTS_BEGIN
// Run this focused positive gate first, before the retained suite and controls.
test('S3D1 canonical boundary policy baseline admits every retained surface',()=>{
  fixture({imported:'robust-predicates'},result=>{assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Boundary check PASS/);});
});
for(const [name,reason]of [
  ['extra-cpu-runtime','scene3d: exact runtime export surface mismatch'],['missing-cpu-runtime','scene3d: exact runtime export surface mismatch'],
  ['extra-cpu-type','scene3d: exact type-only export surface mismatch'],['aliased-cpu-type','scene3d: exact type-only export surface mismatch'],['cpu-type-as-value','scene3d: exact runtime export surface mismatch'],
  ['extra-web-runtime','webgpu/scene3d: exact runtime export surface mismatch'],['extra-web-type','webgpu/scene3d: exact type-only export surface mismatch'],
  ['private-web-declaration','webgpu/scene3d: private declaration dependency leaked'],
  ['old-entry-new-input-type','web: explicit-only scene name leaked: MeshGeometry3DInput'],['old-entry-new-host-type','web: explicit-only scene name leaked: SceneWebGPUHostOptions'],
  ['extra-cpu-static-edge','S3D1: scene entry imported outside approved closure'],['extra-cpu-dynamic-edge','S3D1: scene entry imported outside approved closure'],
  ['extra-transitive-dynamic-edge','S3D1: scene entry imported outside approved closure'],['cpu-extra-module-work','S3D1: facade contains non-forwarding module code'],
  ['wrong-local-output-type','scene3d: exact canonical type re-export mismatch: Matrix4'],['old-entry-extra-facade-edge','S3D1: scene entry imported outside approved closure'],
])test('S3D1 new guard '+name+' defeats map-adapted predecessor',()=>{
  fixture({imported:'robust-predicates',scene3dMutation:name},result=>{
    assert.equal(result.mapAdaptedPredecessor.status,0,'explicit comparator assigned candidate PASS');
    assert.equal(result.status,1);assert.ok(result.stderr.includes(reason),'assigned S3D1 reason: '+result.stdout+result.stderr);
  });
});
// S3D1_TESTS_END

test('boundary checker admits the exact external root only in engine rendering', t => {
  t.diagnostic(`Unmodified checker SHA256 ${checkerHash}; generated minimal workspace, synthetic resolution facades, guarded cleanup.`);
  fixture({ imported: 'robust-predicates' }, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Boundary check PASS/);
  });
  for (const subtree of ['engine/src', 'engine/web', 'runtime/src']) fixture({ imported: 'robust-predicates', subtree }, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unapproved\/deep package import robust-predicates/);
  });
});
test('boundary checker rejects a resolvable deep dependency import', () => {
  fixture({ imported: 'robust-predicates/esm/orient2d.js' }, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unapproved\/deep package import robust-predicates\/esm\/orient2d\.js/);
  });
});
for (const declared of [true, false]) test(`boundary checker rejects resolvable inherited constructor in ${declared ? 'dependency' : 'import'} guard`, () => {
  fixture({ imported: 'constructor', declared }, result => {
    assert.equal(result.status, 1, `resolvable constructor unexpectedly accepted: ${result.stdout}`);
    assert.match(result.stderr, declared ? /engine: dependency DAG mismatch/ : /unapproved\/deep package import constructor/);
  });
});

test('synthetic missing image export rejects for the assigned executable surface reason',()=>{
  fixture({imported:'robust-predicates',missingImageExport:true},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/contracts: executable image\/geometry export surface mismatch/);
  });
});

for (const name of ['createTexturedGeometry2D','isTexturedGeometry2D']) test(`synthetic missing geometry value ${name} rejects its executable surface`,()=>{
  fixture({imported:'robust-predicates',missingGeometryExport:name},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/contracts: executable image\/geometry export surface mismatch/);
  });
});
for (const name of ['TexturedFloatArray2D','TexturedIndexArray2D','TexturedGeometry2DInput','TexturedGeometry2D']) test(`synthetic missing geometry type ${name} rejects its declaration surface`,()=>{
  fixture({imported:'robust-predicates',missingGeometryType:name},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.ok(result.stderr.includes('contracts: geometry type-only export mismatch: '+name));
  });
});

test('synthetic Mesh facade admits the identical runtime singleton',()=>{
  fixture({imported:'robust-predicates'},result=>{
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.match(result.stdout,/Boundary check PASS/);
  });
});
for (const missingMesh of ['runtime','root']) test(`synthetic missing ${missingMesh} Mesh value rejects its singleton requirement`,()=>{
  fixture({imported:'robust-predicates',missingMesh},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.ok(result.stderr.includes(missingMesh+': public Mesh2D singleton missing'));
  });
});
test('synthetic split Mesh constructors reject runtime identity mismatch',()=>{
  fixture({imported:'robust-predicates',splitMesh:true},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/root: Mesh2D runtime identity mismatch/);
  });
});
for (const entry of ['contracts','root','runtime','web','webgpu']) {
  for (const [kind,name] of [['value','readMeshState'],['type','MeshCaptureState']]) test(`synthetic ${entry} Mesh ${kind} leak ${name} rejects private authority`,()=>{
    fixture({imported:'robust-predicates',meshLeak:{entry,kind,name}},result=>{
      assert.equal(result.status,1,result.stdout+result.stderr);
      assert.ok(result.stderr.includes(entry+': private Mesh authority leaked: '+name));
    });
  });
}
for (const entry of ['root','runtime']) {
  for (const name of ['hasMeshState','writeMeshState']) test(`synthetic ${entry} Mesh value leak ${name} rejects private authority`,()=>{
    fixture({imported:'robust-predicates',meshLeak:{entry,kind:'value',name}},result=>{
      assert.equal(result.status,1,result.stdout+result.stderr);
      assert.ok(result.stderr.includes(entry+': private Mesh authority leaked: '+name));
    });
  });
  test(`synthetic ${entry} Mesh state module re-export rejects private module`,()=>{
    fixture({imported:'robust-predicates',meshModuleLeak:entry},result=>{
      assert.equal(result.status,1,result.stdout+result.stderr);
      assert.ok(result.stderr.includes(entry+': private Mesh state module leaked'));
    });
  });
}
for (const entry of ['contracts','web','webgpu']) test(`synthetic Mesh value on ${entry} rejects its exact public entry`,()=>{
  fixture({imported:'robust-predicates',meshWrongEntry:entry},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.ok(result.stderr.includes(entry+': public Mesh2D value belongs only to runtime/root'));
  });
});
test('synthetic Mesh state source value import rejects the type-only seam',()=>{
  fixture({imported:'robust-predicates',meshStateSourceValueImport:true},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/runtime: Mesh state source imports must be type-only/);
  });
});
test('synthetic Mesh state emitted import rejects the value backedge',()=>{
  fixture({imported:'robust-predicates',meshStateEmittedValueImport:true},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/runtime: Mesh state emitted value import\/backedge/);
  });
});

// Task 5 controls. fixture admits a fresh baseline before each new mutation.
// Root must run these with the old checker before applying the checker snippets.
test('profile boundary valid executable and declaration baseline passes', () => {
  fixture({imported:'robust-predicates'}, result => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Boundary check PASS/);
  });
});
const profilePrivateNames = ['registerTexturedFrame', 'readOwnedTexturedFrame', 'texturedRenderFrame2DBrand', 'createTexturedRenderFrame2D', 'CapturedEngineFramePorts', 'startEngine', 'TexturedCaptureBudget', 'admitTree', 'referencedTuples', 'flattenClips', 'readMeshCaptureImage', 'observeRejectedRenderResult'];
for (const entry of ['contracts', 'root', 'runtime', 'web', 'webgpu']) for (const name of profilePrivateNames) for (const kind of ['value', 'type']) test(`profile boundary ${entry} ${kind} leak ${name} rejects exact private reason`, () => {
  fixture({imported:'robust-predicates',profileLeak:{entry,name,kind}}, result => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes(`${entry}: private textured-frame authority leaked: ${name}`), result.stderr);
  });
});
for (const entry of ['contracts', 'root', 'web', 'webgpu']) for (const name of ['collectTexturedFrameContent', 'CapturedTexturedContent2D']) for (const kind of ['value', 'type']) test(`profile boundary ${entry} ${kind} workspace leak ${name} rejects exact private reason`, () => {
  fixture({imported:'robust-predicates',profileLeak:{entry,name,kind}}, result => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes(`${entry}: textured-frame workspace port leaked: ${name}`), result.stderr);
  });
});
for (const entry of ['root', 'runtime']) for (const name of ['texturedFrameState', 'texturedFrameBudget', 'meshCaptureSnapshot']) for (const kind of ['emitted', 'type']) test(`profile boundary ${entry} ${kind} module leak ${name} rejects exact private reason`, () => {
  fixture({imported:'robust-predicates',profileModuleLeak:{entry,name,kind}}, result => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes(`${entry}: private textured-frame module leaked: ${name}`), result.stderr);
  });
});
for (const missingTexturedPort of ['value', 'type']) test(`profile boundary missing runtime ${missingTexturedPort} port rejects exact requirement`, () => {
  fixture({imported:'robust-predicates',missingTexturedPort}, result => {
    const name = missingTexturedPort === 'value' ? 'collectTexturedFrameContent' : 'CapturedTexturedContent2D';
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes(`runtime: low-level textured capture port mismatch: ${name}`), result.stderr);
  });
});
test('profile boundary missing root factory rejects exact executable surface', () => {
  fixture({imported:'robust-predicates',missingProfileFactory:true}, result => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes('root: executable textured-frame export surface mismatch'), result.stderr);
  });
});
test('profile boundary completed-frame registry import rejects exact erased seam', () => {
  fixture({imported:'robust-predicates',profileRegistryImport:true}, result => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stderr.includes('engine: completed-frame registry emitted import/backedge'), result.stderr);
  });
});

test('private package alias permits only exact targets and host importers', async t => {
  t.diagnostic(`S02 copies the unmodified first-party checker ${checkerHash}; fixture modules are synthetic policy inputs only.`);
  await t.test('exact package map and two source/emitted host importers are admitted', () => {
    fixture({imported:'robust-predicates',registryLegitimateHosts:true}, result => {
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Boundary check PASS/);
    });
  });
  const exactTarget = {types:'./dist/internal/texturedFrameState.d.ts',import:'./dist/internal/texturedFrameState.js'};
  const mutations = [
    {label:'missing engine map',packageName:'engine',remove:true},
    {label:'empty engine map',packageName:'engine',imports:{}},
    {label:'misspelled private key',packageName:'engine',imports:{'#egret-textured-frame-states':exactTarget}},
    {label:'extra private key',packageName:'engine',imports:{'#egret-textured-frame-state':exactTarget,'#egret-extra':exactTarget}},
    {label:'altered types target points at existing declaration',packageName:'engine',imports:{'#egret-textured-frame-state':{types:'./dist/index.d.ts',import:exactTarget.import}}},
    {label:'altered import target points at existing emitted file',packageName:'engine',imports:{'#egret-textured-frame-state':{types:exactTarget.types,import:'./dist/index.js'}}},
    {label:'extra condition',packageName:'engine',imports:{'#egret-textured-frame-state':{...exactTarget,default:exactTarget.import}}},
    {label:'string target omits exact conditions',packageName:'engine',imports:{'#egret-textured-frame-state':exactTarget.import}},
    {label:'private mapping on another package',packageName:'runtime',imports:{'#egret-textured-frame-state':exactTarget}},
  ];
  for (const mutation of mutations) await t.test(mutation.label, () => {
    fixture({imported:'robust-predicates',registryLegitimateHosts:true,registryMapMutation:mutation}, result => {
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.ok(result.stderr.includes(mutation.packageName === 'engine' ? 'engine: private textured registry mapping mismatch' : 'runtime: unexpected private import mapping'), result.stderr);
    });
  });
  for (const importer of ['src/ProbePrivate.ts','web/OtherHost.ts','rendering/ProbePrivate.ts','dist/ProbePrivate.js','dist/web/OtherHost.js']) await t.test(`resolvable exact alias is refused from ${importer}`, () => {
    fixture({imported:'robust-predicates',registryLegitimateHosts:true,registryImporterProbe:importer}, result => {
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.ok(result.stderr.includes('private textured registry import outside approved adapters'), result.stderr);
      assert.ok(result.stderr.includes(importer.replaceAll('/', path.sep)), result.stderr);
    });
  });
});

test('HT1 admits only erased root/runtime options and the finite display class members', async t => {
  t.diagnostic(`HT1 copies the first-party checker ${checkerHash}; inert synthetic classes prove policy only.`);
  await t.test('complete inert surfaces reach the retained checker PASS', () => {
    fixture({ imported: 'robust-predicates' }, result => {
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Boundary check PASS/);
    });
  });
  const mutants = [
    ['missing-runtime-options', 'runtime: exact hit-test type-only facade mismatch'],
    ['alias-root-options', 'root: exact hit-test type-only facade mismatch'],
    ['value-root-options', 'root: exact hit-test type-only facade mismatch'],
    ['duplicate-root-options', 'root: exact hit-test type-only facade mismatch'],
    ['off-entry-options', 'contracts: root/runtime-only hit-test options leaked'],
    ['alias-private-query', 'runtime: exact hit-test type-only facade mismatch'],
    ['alias-private-state', 'root: private hit-test authority leaked: DisplayHitState'],
    ['split-root-stage', 'root: hit-test class identity mismatch: Stage'],
    ['missing-getter-declaration', 'runtime: hit-test DisplayObject.touchEnabled declaration mismatch'],
    ['missing-setter-descriptor', 'runtime: hit-test DisplayObject.touchEnabled accessor mismatch'],
    ['missing-query-declaration', 'runtime: Stage.hitTest declaration mismatch'],
    ['missing-query-descriptor', 'runtime: Stage-only hit-test method mismatch'],
    ['ambient-query-reference', 'packages/runtime/src/displayHitTest.ts: hit-test host ambient dependency'],
    ['state-value-backedge', 'packages/runtime/src/displayHitState.ts: hit-test display class value backedge'],
  ];
  for (const [mutation, refusal] of mutants) await t.test(mutation, () => {
    fixture({ imported: 'robust-predicates', hitTestMutation: mutation }, result => {
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.ok(result.stderr.includes(refusal), result.stderr);
    });
  });
});
