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
function fixture({ imported, subtree = 'engine/rendering', declared = false, missingImageExport = false, missingGeometryExport, missingGeometryType, missingMesh, splitMesh = false, meshLeak, meshModuleLeak, meshWrongEntry, meshStateSourceValueImport = false, meshStateEmittedValueImport = false, profileLeak, profileModuleLeak, missingTexturedPort, missingProfileFactory = false, profileRegistryImport = false, registryLegitimateHosts = false, registryMapMutation, registryImporterProbe, hitTestMutation }, run) {
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
      } : name === 'project' ? {'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}} : undefined;
      write(`packages/${name}/package.json`, { name: `@egret/${name}`, private: true, version: '0.0.0', type: 'module', dependencies: dependencyMap, ...(packageExports === undefined ? {} : {exports:packageExports}) });
      write(`packages/${name}/tsconfig.json`, { extends: '../../tsconfig.base.json', ...(name === 'project' ? {compilerOptions:{rootDir:'src',outDir:'dist'}} : {}), references: allowed.map(value => ({ path: `../${value.slice('@egret/'.length)}` })) });
      write(`packages/${name}/src/index.ts`, 'export {};\n');
      write(`packages/${name}/dist/index.js`, 'export {};\n');
      const exports = name === 'engine' ? { '.': './index.js', './web': './web.js', './webgpu':'./webgpu.js', './text':'./text.js', './web/text':'./web-text.js' }
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
    write('packages/engine/package.json', {...engineFixturePackage, imports:{'#egret-textured-frame-state':{types:'./dist/internal/texturedFrameState.d.ts',import:'./dist/internal/texturedFrameState.js'}}});
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
    const result = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    run(result);
  } finally {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(ownedParent + path.sep) && path.basename(resolved).startsWith('egret-boundary-policy-'));
    rmSync(resolved, { recursive: true, force: true });
    assert.equal(existsSync(resolved), false);
  }
}

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
