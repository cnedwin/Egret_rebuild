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
function fixture({ imported, subtree = 'engine/rendering', declared = false, missingImageExport = false, missingGeometryExport, missingGeometryType, missingMesh, splitMesh = false, meshLeak, meshModuleLeak, meshWrongEntry, meshStateSourceValueImport = false, meshStateEmittedValueImport = false, profileLeak, profileModuleLeak, missingTexturedPort, missingProfileFactory = false, profileRegistryImport = false, registryLegitimateHosts = false, registryMapMutation, registryImporterProbe, hitTestMutation, mouseInputMutation, spineImportMutation, combinedSceneMutation, sharedMutation, sequenceMutation, /* S3D1_OPTIONS_BEGIN */ scene3dMutation /* S3D1_OPTIONS_END */ }, run) {
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
        './input': {types:'./dist/input/index.d.ts',import:'./dist/input/index.js'},
        './ui': {types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'},
      } : name === 'engine' ? {
        '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
        './webgpu': gpuExport,
        './webgl2': {types:'./dist/web/webgl2.d.ts',import:'./dist/web/webgl2.js'},
        './webgl2/scene3d': {types:'./dist/web/webgl2Scene3d.d.ts',import:'./dist/web/webgl2Scene3d.js'},
        './web': {types:'./dist/web/index.d.ts',import:'./dist/web/index.js'},
        './text': {types:'./dist/text.d.ts',import:'./dist/text.js'},
        './layout': {types:'./dist/layout.d.ts',import:'./dist/layout.js'},
        './animation': {types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'},
        './web/text': {types:'./dist/web/text.d.ts',import:'./dist/web/text.js'},
        './web/input': {types:'./dist/web/input.d.ts',import:'./dist/web/input.js'},
        './input': {types:'./dist/input.d.ts',import:'./dist/input.js'},
        './ui': {types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'},
        './web/pointer': {types:'./dist/web/pointer.d.ts',import:'./dist/web/pointer.js'},
        './web/image': {types:'./dist/web/image.d.ts',import:'./dist/web/image.js'},
        './resources': {types:'./dist/resources.d.ts',import:'./dist/resources.js'},
        './web/resources': {types:'./dist/web/resources.d.ts',import:'./dist/web/resources.js'},
        // S3D1_FIXTURE_MAP_BEGIN
        './scene3d': {types:'./dist/rendering/scene3d.d.ts',import:'./dist/rendering/scene3d.js'},
        './webgpu/scene3d': {types:'./dist/web/scene3d.d.ts',import:'./dist/web/scene3d.js'},
        // S3D1_FIXTURE_MAP_END
      } : name === 'project' ? {'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./spine':{types:'./dist/spine/index.d.ts',import:'./dist/spine/index.js'},'./atlas':{types:'./dist/atlas/index.d.ts',import:'./dist/atlas/index.js'},'./resources':{types:'./dist/resources/index.d.ts',import:'./dist/resources/index.js'}} : {'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./resources':{types:'./dist/resources/index.d.ts',import:'./dist/resources/index.js'}};
      write(`packages/${name}/package.json`, { name: `@egret/${name}`, private: true, version: '0.0.0', type: 'module', dependencies: dependencyMap, ...(packageExports === undefined ? {} : {exports:packageExports}) });
      write(`packages/${name}/tsconfig.json`, { extends: '../../tsconfig.base.json', ...(name === 'project' ? {compilerOptions:{rootDir:'src',outDir:'dist'}} : {}), references: allowed.map(value => ({ path: `../${value.slice('@egret/'.length)}` })) });
      write(`packages/${name}/src/index.ts`, 'export {};\n');
      write(`packages/${name}/dist/index.js`, 'export {};\n');
      const exports = name === 'engine' ? { '.': './index.js', './web': './web.js', './webgpu':'./webgpu.js', './webgl2':'./webgl2.js', './webgl2/scene3d':'./webgl2-scene3d.js', './text':'./text.js', './layout':'./layout.js', './animation':'./animation.js', './web/text':'./web-text.js', './web/image':'./web-image.js', './resources':'./resources.js', './web/resources':'./web-resources.js', './ui':'./ui.js', /* S3D1_FIXTURE_RESOLVER_BEGIN */ './scene3d':'./scene3d.js', './webgpu/scene3d':'./scene3d-web.js' /* S3D1_FIXTURE_RESOLVER_END */ }
        : name === 'runtime' ? { '.': './index.js', './text':'./text.js', './ui':'./ui.js' } : name === 'project' ? {'.':'./index.js','./spine':'./spine.js','./resources':'./resources.js'} : {'.':'./index.js','./resources':'./resources.js'};
      write(`node_modules/@egret/${name}/package.json`, { name: `@egret/${name}`, type: 'module', exports });
      write(`node_modules/@egret/${name}/index.js`, 'export {};\n');
      if (name === 'project') {
        // Synthetic policy fixture only; the project integration suite uses real builds.
        const values = ['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
        write('node_modules/@egret/project/index.js', values.map(name => `export const ${name}=1;`).join('\n'));
        write('packages/project/dist/index.d.ts', readFileSync(path.join(repository,'packages/project/dist/index.d.ts')));
        // SP1-A synthetic declaration/resolution fixture, never animation behavior.
        write('packages/project/src/spine/index.ts',"export {createSpineImportPlan,SPINE_IMPORT_LIMITS} from './preflight.js';\nexport type {SpineImportInput,SpineTextSource,SpinePageBinding,SpineProvenance,SpineImportPlan,SpineImportResult,SpineImportDiagnostic,SpineImportDiagnosticCode,SpineSourceSpan,SpinePagePlan,SpineRegionPlan} from './types.js';\n");
        write('packages/project/dist/spine/index.d.ts',"export {createSpineImportPlan,SPINE_IMPORT_LIMITS} from './preflight.js';\nexport type {SpineImportInput,SpineTextSource,SpinePageBinding,SpineProvenance,SpineImportPlan,SpineImportResult,SpineImportDiagnostic,SpineImportDiagnosticCode,SpineSourceSpan,SpinePagePlan,SpineRegionPlan} from './types.js';\n");
        write('packages/project/dist/spine/index.js',"export {createSpineImportPlan,SPINE_IMPORT_LIMITS} from './preflight.js';\n");
        write('packages/project/dist/spine/preflight.js','export const SPINE_IMPORT_LIMITS=Object.freeze({}); export function createSpineImportPlan() {}\n');
        write('packages/project/dist/spine/types.js','export {};\n');
        write('node_modules/@egret/project/spine.js','export const SPINE_IMPORT_LIMITS=Object.freeze({}); export function createSpineImportPlan() {}\n');
        // Inert atlas facades support retained-entry isolation scans only.
        // Atlas import behavior remains in its dedicated integration suite.
        for (const file of ['packages/project/src/atlas/index.ts','packages/project/dist/atlas/index.js','packages/project/dist/atlas/index.d.ts'])
          write(file, 'export {};\n');

      }
      if (name === 'engine') {
        write('node_modules/@egret/engine/web.js', 'export function createCanvasHost() {}\n');
        write('node_modules/@egret/engine/webgpu.js', 'export function createTexturedWebGPUHost() {}\nexport function createWebGPUHost() {}\n');
        write('packages/engine/dist/web/index.js', 'export function createCanvasHost() {}\n');
        write('packages/engine/dist/web/webgpu.js', 'export function createTexturedWebGPUHost() {}\nexport function createWebGPUHost() {}\n');
        // The mapped image route is an empty inert policy namespace, never a provider.
        for (const file of ['packages/engine/web/image.ts', 'packages/engine/dist/web/image.js', 'packages/engine/dist/web/image.d.ts'])
          write(file, 'export {};\n');
        write('node_modules/@egret/engine/web-image.js', "export * from '../../../packages/engine/dist/web/image.js';\n");
        // The optional layout namespace is inert here, like the image route above;
        // synthetic boundary controls establish policy, without running a planner.
        for (const file of ['packages/engine/src/layout.ts', 'packages/engine/src/layoutTypes.ts',
          'packages/engine/dist/layout.js', 'packages/engine/dist/layout.d.ts',
          'packages/engine/dist/layoutTypes.js', 'packages/engine/dist/layoutTypes.d.ts'])
          write(file, 'export {};\n');
        write('node_modules/@egret/engine/layout.js', "export * from '../../../packages/engine/dist/layout.js';\n");
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
    write('packages/engine/dist/web/webgpu.d.ts', "export {createTexturedWebGPUHost,createWebGPUHost} from './WebGPUHost.js';\nexport type {WebGPUHost,WebGPUHostState,WebGPUHostErrorCode,WebGPUHostFailure,WebGPUHostDiagnostic,WebGPUHostOptions,WebGPUReadback,WebGPUHostStatus} from './WebGPUHost.js';\nexport type {TexturedWebGPUHost,TexturedWebGPUHostOptions,TexturedWebGPUHostStatus} from './WebGPUHost.js';\n");
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
    write('packages/engine/package.json', {...engineFixturePackage, imports:{'#egret-textured-frame-state':{types:'./dist/internal/texturedFrameState.d.ts',import:'./dist/internal/texturedFrameState.js'},'#egret-mouse-input':{types:'./dist/mouseInput.d.ts',import:'./dist/mouseInput.js'},'#egret-manifest-resources':{types:'./dist/manifestResourceState.d.ts',import:'./dist/manifestResourceState.js'},'#egret-pointer-input':{types:'./dist/pointerInput.d.ts',import:'./dist/pointerInput.js'}}});
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
    // BW1 baseline only: inert canonical values, not writer behavior. Both
    // roots and resolver bridges share that module; BR1 order clauses stay intact.
    const byteWriterBody = 'export class ByteWriter {}\nexport const BYTE_WRITER_LIMITS = Object.freeze({maxBytes:16777216});\n';
    const byteWriterTypes = 'import type {ByteOrder} from "./ByteReader.js";\nexport declare const BYTE_WRITER_LIMITS: Readonly<{maxBytes:16777216}>;\nexport declare class ByteWriter {}\n';
    write('packages/runtime/src/ByteWriter.ts', byteWriterTypes);
    write('packages/runtime/dist/ByteWriter.d.ts', byteWriterTypes);
    write('packages/runtime/dist/ByteWriter.js', byteWriterBody);
    const byteWriterPort = "export {ByteWriter,BYTE_WRITER_LIMITS} from './ByteWriter.js';\n";
    for (const file of ['packages/runtime/src/index.ts', 'packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + byteWriterPort);
    for (const file of ['packages/engine/src/index.ts', 'packages/engine/dist/index.js', 'packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {ByteWriter,BYTE_WRITER_LIMITS} from '@egret/runtime';\n");
    for (const file of ['node_modules/@egret/engine/index.js', 'node_modules/@egret/runtime/index.js'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {ByteWriter,BYTE_WRITER_LIMITS} from '../../../packages/runtime/dist/ByteWriter.js';\n");
    // NS1_FIXTURE_BEGIN
    // Retained inert policy baseline only. Copy the actual current NS leaf and
    // emissions without calling the factory; synthetic contracts/owners remain
    // inert. Genuine NS policy controls use a separate complete copied graph.
    for (const file of ['packages/runtime/src/NineSliceGeometry2D.ts', 'packages/runtime/dist/NineSliceGeometry2D.js', 'packages/runtime/dist/NineSliceGeometry2D.d.ts'])
      write(file, readFileSync(path.join(repository, file)));
    const nsValuePort = "export {createNineSliceGeometry2D} from './NineSliceGeometry2D.js';\n";
    const nsTypePort = "export type {NineSliceInsets2D,NineSliceGeometry2DOptions} from './NineSliceGeometry2D.js';\n";
    for (const file of ['packages/runtime/src/index.ts', 'packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + nsValuePort + (file.endsWith('.js') ? '' : nsTypePort));
    for (const file of ['packages/engine/src/index.ts', 'packages/engine/dist/index.js', 'packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {createNineSliceGeometry2D} from '@egret/runtime';\n" + (file.endsWith('.js') ? '' : "export type {NineSliceInsets2D,NineSliceGeometry2DOptions} from '@egret/runtime';\n"));
    for (const file of ['node_modules/@egret/engine/index.js', 'node_modules/@egret/runtime/index.js'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {createNineSliceGeometry2D} from '../../../packages/runtime/dist/NineSliceGeometry2D.js';\n");
    // Bind the pre-existing inert contract name without invoking it. The old
    // missing-contract-export control must still reach its inventory refusal,
    // rather than fail earlier while the newly copied leaf module is loading.
    const nsContractsResolver = 'node_modules/@egret/contracts/index.js';
    write(nsContractsResolver, readFileSync(path.join(root, nsContractsResolver), 'utf8') + "export function createTexturedGeometry2D() {}\n");
    // NS1_FIXTURE_END
    // NLB1 supplies only inert canonical policy/resolution surfaces, never display behavior.
    // Both resolver roots forward the same sole class; options remain erased from JS.
    const nineSliceBitmapFixtureTypes = 'export interface NineSliceBitmapOptions {}\nexport declare class NineSliceBitmap {}\n';
    write('packages/runtime/src/NineSliceBitmap.ts', nineSliceBitmapFixtureTypes);
    write('packages/runtime/dist/NineSliceBitmap.d.ts', nineSliceBitmapFixtureTypes);
    write('packages/runtime/dist/NineSliceBitmap.js', 'export class NineSliceBitmap {}\n');
    for (const file of ['packages/runtime/src/index.ts', 'packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {NineSliceBitmap} from './NineSliceBitmap.js';\n" + (file.endsWith('.js') ? '' : "export type {NineSliceBitmapOptions} from './NineSliceBitmap.js';\n"));
    for (const file of ['packages/engine/src/index.ts', 'packages/engine/dist/index.js', 'packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {NineSliceBitmap} from '@egret/runtime';\n" + (file.endsWith('.js') ? '' : "export type {NineSliceBitmapOptions} from '@egret/runtime';\n"));
    for (const file of ['node_modules/@egret/engine/index.js', 'node_modules/@egret/runtime/index.js'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {NineSliceBitmap} from '../../../packages/runtime/dist/NineSliceBitmap.js';\n");
    // SS1 baseline is an inert policy surface, never genuine atlas/Bitmap behavior.
    // Both synthetic roots share this sole factory; erased names stay out of JS.
    const spriteSheetFixtureBody = 'export function createSpriteSheet() {}\n';
    const spriteSheetFixtureTypes = 'export interface SpriteSheetFrameInput {}\nexport interface SpriteSheet {}\nexport declare function createSpriteSheet(): SpriteSheet;\n';
    write('packages/runtime/src/spriteSheet.ts', spriteSheetFixtureTypes);
    write('packages/runtime/dist/spriteSheet.d.ts', spriteSheetFixtureTypes);
    write('packages/runtime/dist/spriteSheet.js', spriteSheetFixtureBody);
    for (const file of ['packages/runtime/src/index.ts', 'packages/runtime/dist/index.js', 'packages/runtime/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {createSpriteSheet} from './spriteSheet.js';\n" + (file.endsWith('.js') ? '' : "export type {SpriteSheet,SpriteSheetFrameInput} from './spriteSheet.js';\n"));
    for (const file of ['packages/engine/src/index.ts', 'packages/engine/dist/index.js', 'packages/engine/dist/index.d.ts'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {createSpriteSheet} from '@egret/runtime';\n" + (file.endsWith('.js') ? '' : "export type {SpriteSheet,SpriteSheetFrameInput} from '@egret/runtime';\n"));
    for (const file of ['node_modules/@egret/engine/index.js', 'node_modules/@egret/runtime/index.js'])
      write(file, readFileSync(path.join(root, file), 'utf8') + "export {createSpriteSheet} from '../../../packages/runtime/dist/spriteSheet.js';\n");
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
    write('packages/engine/web/webgpu.ts', "export {createTexturedWebGPUHost,createWebGPUHost} from './WebGPUHost.js';\nexport type {WebGPUHost,WebGPUHostState,WebGPUHostErrorCode,WebGPUHostFailure,WebGPUHostDiagnostic,WebGPUHostOptions,WebGPUReadback,WebGPUHostStatus} from './WebGPUHost.js';\nexport type {TexturedWebGPUHost,TexturedWebGPUHostOptions,TexturedWebGPUHostStatus} from './WebGPUHost.js';\n");
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
    write('packages/runtime/dist/meshDisplayState.js', 'export function hasMeshState() {}\nexport function readMeshState() {}\nexport function writeMeshState() {}\n');
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
    const sceneGraph = {"packages/engine/rendering/sceneFrame3D.ts":[["static","./matrix4.js"],["static","./matrix4.js"],["static","./meshGeometry3D.js"],["static","./meshGeometry3D.js"],["static","./projection3D.js"]],"packages/engine/rendering/meshGeometry3D.ts":[],"packages/engine/web/b1.ts":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"],["static","@egret/contracts"]],"packages/engine/rendering/matrix4.ts":[],"packages/engine/rendering/projection3D.ts":[["static","./matrix4.js"],["static","./matrix4.js"]],"packages/engine/rendering/packMeshGeometry3D.ts":[["static","./meshGeometry3D.js"]],"packages/engine/web/WebGPUHost.ts":[["dynamic","./b1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./b1.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBufferPool.js"],["static","./webgpuBufferPool.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/web/webgpuMeshPass.ts":[],"packages/engine/rendering/admitTexturedFrame2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedDraws2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/copyFrame2D.ts":[["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/copyMixedFrame2D.ts":[["static","./copyFrame2D.js"],["static","./copyFrame2D.js"],["static","./imageFrameBudget.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/ownedPreparationFailure2D.ts":[],"packages/engine/rendering/packImageVertices2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./preparedFrameCache2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/rendering/packTexturedMesh2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./preparedFrameCache2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/rendering/prepareMixedDraws2D.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/prepareRectangles2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./preparedFrameCache2D.js"],["static","./RectangleFrame2D.js"],["static","@egret/contracts"],["static","robust-predicates"]],"packages/engine/rendering/prepareTexturedDraws2D.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/texturedPreparationBudget2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/web/imageProjections2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/web/prepareTexturedSubmission2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/web/texturedWebGPUOptions.ts":[["static","./WebGPUHost.js"]],"packages/engine/web/webgpuImagePass.ts":[],"packages/engine/web/webgpuLifetime.ts":[],"packages/engine/web/webgpuPass.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packedOrientation.js"],["static","../rendering/packedPosition2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/prepareRectangles2D.js"]],"packages/engine/web/webgpuTexturedPass.ts":[],"packages/engine/rendering/RectangleFrame2D.ts":[["static","@egret/contracts"]],"packages/engine/rendering/imageFrameBudget.ts":[["static","./copyFrame2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/packedOrientation.ts":[["static","./prepareRectangles2D.js"],["static","robust-predicates"]],"packages/engine/rendering/packedPosition2D.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/rendering/prepareImages2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/prepareTexturedMesh2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/sceneFrame3D.js":[["static","./matrix4.js"],["static","./meshGeometry3D.js"],["static","./projection3D.js"]],"packages/engine/dist/rendering/sceneFrame3D.d.ts":[["static","./matrix4.js"],["static","./meshGeometry3D.js"]],"packages/engine/dist/rendering/meshGeometry3D.js":[],"packages/engine/dist/rendering/meshGeometry3D.d.ts":[],"packages/engine/dist/web/b1.js":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"]],"packages/engine/dist/web/b1.d.ts":[["static","../rendering/packMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuMeshPass.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/matrix4.js":[],"packages/engine/dist/rendering/matrix4.d.ts":[],"packages/engine/dist/rendering/projection3D.js":[["static","./matrix4.js"]],"packages/engine/dist/rendering/projection3D.d.ts":[["static","./matrix4.js"]],"packages/engine/dist/rendering/packMeshGeometry3D.js":[["static","./meshGeometry3D.js"]],"packages/engine/dist/rendering/packMeshGeometry3D.d.ts":[["static","./meshGeometry3D.js"]],"packages/engine/dist/web/WebGPUHost.js":[["dynamic","./b1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBufferPool.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/dist/web/WebGPUHost.d.ts":[["static","./b1.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","@egret/contracts"]],"packages/engine/dist/web/webgpuMeshPass.js":[],"packages/engine/dist/web/webgpuMeshPass.d.ts":[],"packages/engine/dist/rendering/admitTexturedFrame2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/admitTexturedFrame2D.d.ts":[["static","./prepareTexturedDraws2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyFrame2D.js":[],"packages/engine/dist/rendering/copyFrame2D.d.ts":[["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyMixedFrame2D.js":[["static","./copyFrame2D.js"],["static","./imageFrameBudget.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/copyMixedFrame2D.d.ts":[["static","./copyFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/ownedPreparationFailure2D.js":[],"packages/engine/dist/rendering/ownedPreparationFailure2D.d.ts":[],"packages/engine/dist/rendering/packImageVertices2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packImageVertices2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packTexturedMesh2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./packedOrientation.js"],["static","./packedPosition2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packTexturedMesh2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/dist/rendering/prepareMixedDraws2D.js":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareMixedDraws2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareRectangles2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","robust-predicates"]],"packages/engine/dist/rendering/prepareRectangles2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./RectangleFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareTexturedDraws2D.js":[["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"]],"packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/texturedPreparationBudget2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/web/imageProjections2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","@egret/contracts"]],"packages/engine/dist/web/imageProjections2D.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/web/prepareTexturedSubmission2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"]],"packages/engine/dist/web/prepareTexturedSubmission2D.d.ts":[["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./webgpuPass.js"],["static","@egret/contracts"]],"packages/engine/dist/web/texturedWebGPUOptions.js":[],"packages/engine/dist/web/texturedWebGPUOptions.d.ts":[["static","./WebGPUHost.js"]],"packages/engine/dist/web/webgpuImagePass.js":[],"packages/engine/dist/web/webgpuImagePass.d.ts":[],"packages/engine/dist/web/webgpuLifetime.js":[],"packages/engine/dist/web/webgpuLifetime.d.ts":[],"packages/engine/dist/web/webgpuPass.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packedOrientation.js"],["static","../rendering/packedPosition2D.js"],["static","../rendering/preparedFrameCache2D.js"]],"packages/engine/dist/web/webgpuPass.d.ts":[["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/prepareRectangles2D.js"]],"packages/engine/dist/web/webgpuTexturedPass.js":[],"packages/engine/dist/web/webgpuTexturedPass.d.ts":[],"packages/engine/dist/rendering/RectangleFrame2D.js":[],"packages/engine/dist/rendering/RectangleFrame2D.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/rendering/imageFrameBudget.js":[["static","./copyFrame2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/imageFrameBudget.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/rendering/packedOrientation.js":[["static","robust-predicates"]],"packages/engine/dist/rendering/packedOrientation.d.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/packedPosition2D.js":[],"packages/engine/dist/rendering/packedPosition2D.d.ts":[["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareImages2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"]],"packages/engine/dist/rendering/prepareImages2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareTexturedMesh2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"]],"packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts":[["static","./preparedFrameCache2D.js"],["static","./prepareRectangles2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/web/webgpuBufferPool.ts":[["static","./webgpuLifetime.js"]],"packages/engine/dist/web/webgpuBufferPool.js":[],"packages/engine/dist/web/webgpuBufferPool.d.ts":[["static","./webgpuLifetime.js"]],"packages/engine/web/webgpuBindingCache.ts":[["static","./webgpuBufferPool.js"]],"packages/engine/dist/web/webgpuBindingCache.js":[],"packages/engine/dist/web/webgpuBindingCache.d.ts":[["static","./webgpuBufferPool.js"]],"packages/engine/rendering/preparedBatches2D.ts":[["static","./packImageVertices2D.js"],["static","./packTexturedMesh2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/preparedBatches2D.js":[],"packages/engine/dist/rendering/preparedBatches2D.d.ts":[["static","./packImageVertices2D.js"],["static","./packTexturedMesh2D.js"],["static","@egret/contracts"]],"packages/engine/rendering/preparedFrameCache2D.ts":[["static","./prepareRectangles2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/preparedFrameCache2D.js":[],"packages/engine/dist/rendering/preparedFrameCache2D.d.ts":[["static","./prepareRectangles2D.js"],["static","@egret/contracts"]]};
    const m13SharedGraph = {"packages/contracts/dist/SharedGeometry2D.d.ts":[],"packages/contracts/dist/SharedGeometry2D.js":[],"packages/contracts/dist/SharedMaterial2D.d.ts":[],"packages/contracts/dist/SharedMaterial2D.js":[],"packages/contracts/dist/SharedRenderFrame2D.d.ts":[["static","./HostAdapter.js"],["static","./ImageData2D.js"],["static","./RenderFrame2D.js"],["static","./SharedGeometry2D.js"],["static","./SharedMaterial2D.js"],["static","./TexturedGeometry2D.js"],["static","./TextureViewRegion2D.js"]],"packages/contracts/dist/SharedRenderFrame2D.js":[],"packages/contracts/dist/TextureViewRegion2D.d.ts":[["static","./ImageData2D.js"]],"packages/contracts/dist/TextureViewRegion2D.js":[],"packages/contracts/src/SharedGeometry2D.ts":[],"packages/contracts/src/SharedMaterial2D.ts":[],"packages/contracts/src/SharedRenderFrame2D.ts":[["static","./HostAdapter.js"],["static","./ImageData2D.js"],["static","./RenderFrame2D.js"],["static","./SharedGeometry2D.js"],["static","./SharedMaterial2D.js"],["static","./TexturedGeometry2D.js"],["static","./TextureViewRegion2D.js"]],"packages/contracts/src/TextureViewRegion2D.ts":[["static","./ImageData2D.js"]],"packages/engine/dist/rendering/packSharedDraws2D.d.ts":[["static","./prepareSharedDraws2D.js"]],"packages/engine/dist/rendering/packSharedDraws2D.js":[["static","./packedOrientation.js"],["static","./prepareSharedDraws2D.js"]],"packages/engine/dist/rendering/packSharedMeshGeometry3D.d.ts":[["static","./meshGeometry3D.js"]],"packages/engine/dist/rendering/packSharedMeshGeometry3D.js":[["static","./meshGeometry3D.js"],["static","./sharedColor2D.js"]],"packages/engine/dist/rendering/prepareSharedDraws2D.d.ts":[["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/prepareSharedDraws2D.js":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./sharedColor2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"]],"packages/engine/dist/rendering/preparedSharedBatches2D.d.ts":[["static","./packSharedDraws2D.js"],["static","./preparedBatches2D.js"]],"packages/engine/dist/rendering/preparedSharedBatches2D.js":[],"packages/engine/dist/rendering/sharedColor2D.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/rendering/sharedColor2D.js":[["static","@egret/contracts"]],"packages/engine/dist/web/WebGPUHost.d.ts":[["static","./b1.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/dist/web/WebGPUHost.js":[["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/dist/web/prepareSharedSubmission2D.d.ts":[["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","./imageProjections2D.js"],["static","./sharedWebGPUOptions.js"]],"packages/engine/dist/web/prepareSharedSubmission2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"]],"packages/engine/dist/web/sharedB1.d.ts":[["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuSharedMeshPass.js"]],"packages/engine/dist/web/sharedB1.js":[["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./webgpuSharedMeshPass.js"]],"packages/engine/dist/web/sharedWebGPUOptions.d.ts":[["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],"packages/engine/dist/web/sharedWebGPUOptions.js":[],"packages/engine/dist/web/webgpuBufferPool.d.ts":[["static","./webgpuLifetime.js"],["static","./webgpuRetentionPool.js"]],"packages/engine/dist/web/webgpuBufferPool.js":[["static","./webgpuRetentionPool.js"]],"packages/engine/dist/web/webgpuRetentionPool.d.ts":[["static","./webgpuLifetime.js"]],"packages/engine/dist/web/webgpuRetentionPool.js":[],"packages/engine/dist/web/webgpuSharedMeshPass.d.ts":[],"packages/engine/dist/web/webgpuSharedMeshPass.js":[],"packages/engine/dist/web/webgpuSharedPass.d.ts":[["static","@egret/contracts"]],"packages/engine/dist/web/webgpuSharedPass.js":[],"packages/engine/dist/web/webgpuSharedResolvePass.d.ts":[],"packages/engine/dist/web/webgpuSharedResolvePass.js":[],"packages/engine/rendering/packSharedDraws2D.ts":[["static","./packedOrientation.js"],["static","./prepareSharedDraws2D.js"],["static","./prepareSharedDraws2D.js"]],"packages/engine/rendering/packSharedMeshGeometry3D.ts":[["static","./meshGeometry3D.js"],["static","./sharedColor2D.js"]],"packages/engine/rendering/prepareSharedDraws2D.ts":[["static","./ownedPreparationFailure2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareRectangles2D.js"],["static","./sharedColor2D.js"],["static","./texturedPreparationBudget2D.js"],["static","./texturedPreparationBudget2D.js"],["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/rendering/preparedSharedBatches2D.ts":[["static","./packSharedDraws2D.js"],["static","./preparedBatches2D.js"]],"packages/engine/rendering/sharedColor2D.ts":[["static","@egret/contracts"],["static","@egret/contracts"]],"packages/engine/web/WebGPUHost.ts":[["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./b1.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBufferPool.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],"packages/engine/web/prepareSharedSubmission2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"],["static","./sharedWebGPUOptions.js"]],"packages/engine/web/sharedB1.ts":[["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./webgpuSharedMeshPass.js"]],"packages/engine/web/sharedWebGPUOptions.ts":[["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],"packages/engine/web/webgpuBufferPool.ts":[["static","./webgpuLifetime.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuRetentionPool.js"]],"packages/engine/web/webgpuRetentionPool.ts":[["static","./webgpuLifetime.js"]],"packages/engine/web/webgpuSharedMeshPass.ts":[],"packages/engine/web/webgpuSharedPass.ts":[["static","@egret/contracts"]],"packages/engine/web/webgpuSharedResolvePass.ts":[],"packages/runtime/dist/sharedFrameCapture.d.ts":[["static","./Stage.js"],["static","@egret/contracts"]],"packages/runtime/dist/sharedFrameCapture.js":[["static","./Bitmap.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./textDisplayState.js"],["static","@egret/contracts"]],"packages/runtime/src/sharedFrameCapture.ts":[["static","./Bitmap.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./Stage.js"],["static","./textDisplayState.js"],["static","./textDisplayState.js"],["static","@egret/contracts"],["static","@egret/contracts"]]};
    // M14_FIXTURE_SCAFFOLD_BEGIN
    // Fixed, inert policy fixtures for the two optional WebGL2 entries. These
    // authored source shapes are never a product implementation or native proof.
    // The capture and scene classes below are never constructed or called.
    // Retain both historical graph literals; this finite overlay supplies the
    // changed shared-storage/ledger edges and the explicit WebGL2 closure.
    const m14FixtureGraph = {"packages/engine/dist/web/prepareSharedSubmission2D.d.ts":[["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]],"packages/engine/dist/web/prepareSharedSubmission2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"]],"packages/engine/dist/web/webgpuRetentionPool.js":[["static","./sharedRetentionLedger.js"]],"packages/engine/web/sharedSubmissionStorage2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"]],"packages/engine/dist/web/sharedSubmissionStorage2D.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/sharedColor2D.js"]],"packages/engine/dist/web/sharedSubmissionStorage2D.d.ts":[["static","../rendering/prepareSharedDraws2D.js"],["static","./imageProjections2D.js"]],"packages/engine/web/sharedRetentionLedger.ts":[],"packages/engine/dist/web/sharedRetentionLedger.js":[],"packages/engine/dist/web/sharedRetentionLedger.d.ts":[],"packages/engine/web/prepareSharedSubmission2D.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","./imageProjections2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]],"packages/engine/web/webgpuRetentionPool.ts":[["static","./sharedRetentionLedger.js"],["static","./webgpuLifetime.js"]],"packages/engine/web/webgl2.ts":[["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],"packages/engine/dist/web/webgl2.js":[["static","./WebGL2Host.js"]],"packages/engine/dist/web/webgl2.d.ts":[["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],"packages/engine/web/webgl2Scene3d.ts":[["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],"packages/engine/dist/web/webgl2Scene3d.js":[["static","./WebGL2Host.js"]],"packages/engine/dist/web/webgl2Scene3d.d.ts":[["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],"packages/engine/web/WebGL2Host.ts":[["dynamic","./sharedWebGL2Scene.js"],["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedRetentionLedger.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Scene.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","./webgl2Native.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],"packages/engine/dist/web/WebGL2Host.js":[["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],"packages/engine/dist/web/WebGL2Host.d.ts":[["static","./sharedWebGL2Options.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"]],"packages/engine/web/webgl2Types.ts":[["static","../rendering/sceneFrame3D.js"],["static","@egret/contracts"]],"packages/engine/dist/web/webgl2Types.js":[],"packages/engine/dist/web/webgl2Types.d.ts":[["static","../rendering/sceneFrame3D.js"],["static","@egret/contracts"]],"packages/engine/web/webgl2Native.ts":[["static","./webgl2Types.js"],["static","@egret/runtime"]],"packages/engine/dist/web/webgl2Native.js":[["static","@egret/runtime"]],"packages/engine/dist/web/webgl2Native.d.ts":[["static","./webgl2Types.js"],["static","@egret/runtime"]],"packages/engine/web/sharedWebGL2Options.ts":[["static","../rendering/prepareSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./webgl2Types.js"]],"packages/engine/dist/web/sharedWebGL2Options.js":[],"packages/engine/dist/web/sharedWebGL2Options.d.ts":[["static","../rendering/prepareSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./webgl2Types.js"]],"packages/engine/web/sharedWebGL2Arena.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"]],"packages/engine/dist/web/sharedWebGL2Arena.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","./sharedSubmissionStorage2D.js"]],"packages/engine/dist/web/sharedWebGL2Arena.d.ts":[["static","../rendering/packSharedDraws2D.js"]],"packages/engine/web/sharedWebGL2Shaders.ts":[["static","@egret/contracts"]],"packages/engine/dist/web/sharedWebGL2Shaders.js":[],"packages/engine/dist/web/sharedWebGL2Shaders.d.ts":[["static","@egret/contracts"]],"packages/engine/web/sharedWebGL2Scene.ts":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"]],"packages/engine/dist/web/sharedWebGL2Scene.js":[["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"]],"packages/engine/dist/web/sharedWebGL2Scene.d.ts":[["static","../rendering/packSharedMeshGeometry3D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sceneFrame3D.js"]]};
    write("packages/engine/web/webgl2.ts", "export { createSharedWebGL2Host } from './WebGL2Host.js';\nexport type { SharedWebGL2HostOptions } from './sharedWebGL2Options.js';\nexport type { SharedWebGL2Host, SharedWebGL2HostStatus, SharedWebGL2Readback, WebGL2HostState, WebGL2HostErrorCode, WebGL2HostFailure, WebGL2HostDiagnostic, WebGL2HostStatus } from './webgl2Types.js';\n");
    write("packages/engine/web/webgl2Scene3d.ts", "export { createSharedSceneWebGL2HostInternal as createSharedSceneWebGL2Host } from './WebGL2Host.js';\nexport type { SharedSceneWebGL2Host } from './webgl2Types.js';\nexport type { SharedSceneWebGL2HostOptions } from './sharedWebGL2Options.js';\n");
    write("packages/engine/web/WebGL2Host.ts", "export function createSharedWebGL2Host() {}\nexport function createSharedSceneWebGL2HostInternal() {}\nconst inertResourceKinds = ['Buffer','Buffer','Buffer'];\nclass InertGLHost {\n  private readonly sceneMode = false;\n  private sceneFunctions: typeof import('./sharedWebGL2Scene.js') | undefined;\n  private generationGate(_token: number): void {}\n  async load(token: number): Promise<void> {\n    if (this.sceneMode) { this.sceneFunctions = await import('./sharedWebGL2Scene.js'); this.generationGate(token); }\n  }\n}\n");
    write("packages/engine/web/webgl2Native.ts", "export type GLNativeKind = 'Buffer' | 'Texture' | 'Renderbuffer' | 'Framebuffer' | 'Shader' | 'Program' | 'VertexArray' | 'Sync';\nconst METHODS = ['getContextAttributes','getError','isContextLost','getParameter','getShaderPrecisionFormat','getFramebufferAttachmentParameter','checkFramebufferStatus','bindFramebuffer','bindBuffer','bufferData','bufferSubData','getBufferSubData','readPixels','shaderSource','attachShader','getShaderParameter','getProgramParameter','getShaderInfoLog','getProgramInfoLog','getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms','getUniformLocation','useProgram','clientWaitSync','activeTexture','bindTexture','bindRenderbuffer','bindVertexArray','bindSampler','bindBufferRange','enable','disable','colorMask','depthMask','depthFunc','clearDepth','clearColor','clear','viewport','scissor','depthRange','blendEquationSeparate','blendFuncSeparate','pixelStorei','texParameteri','texStorage2D','texSubImage2D','renderbufferStorage','framebufferTexture2D','framebufferRenderbuffer','drawBuffers','readBuffer','compileShader','linkProgram','detachShader','uniformBlockBinding','uniform1i','uniform1f','uniform2f','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','drawArrays','drawElements','flush'];\nconst KINDS = ['Buffer','Texture','Renderbuffer','Framebuffer','Shader','Program','VertexArray','Sync'];\nclass InertGLCapture {\n  calls = new Map();\n  constructor(context: unknown, gate: () => void, captured: object) {\n    for (const name of [...METHODS,...KINDS.flatMap(kind=>[kind==='Sync'?'fenceSync':'create'+kind,'delete'+kind])]) {\n      const candidate = (context as unknown as Record<string,unknown>)[name];\n      gate(); if (typeof candidate !== 'function') throw new TypeError(name);\n      const call = candidate.bind(context) as (...args:unknown[])=>unknown;\n      this.calls.set(name,call); Object.defineProperty(captured,name,{value:(...args:unknown[]):unknown=>{gate();const value=call(...args);if(name==='texSubImage2D'&&this.diagnostics){const state=this.diagnostics,bytes=(args[4] as number)*(args[5] as number)*4;if(state.totals.pageWriteCalls===Number.MAX_SAFE_INTEGER||bytes>Number.MAX_SAFE_INTEGER-state.totals.pageWriteBytes)state.saturated=true;state.totals.pageWriteCalls=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteCalls+1);state.totals.pageWriteBytes=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteBytes+bytes);}gate();return value;}});\n    }\n  }\n}\n");
    write("packages/engine/web/webgl2Types.ts", "export type SharedWebGL2Host = unknown;\nexport type SharedWebGL2HostStatus = unknown;\nexport type SharedWebGL2Readback = unknown;\nexport type WebGL2HostState = unknown;\nexport type WebGL2HostErrorCode = unknown;\nexport type WebGL2HostFailure = unknown;\nexport type WebGL2HostDiagnostic = unknown;\nexport type WebGL2HostStatus = unknown;\nexport type SharedSceneWebGL2Host = unknown;\n");
    write("packages/engine/web/sharedWebGL2Options.ts", "export type SharedWebGL2HostOptions = unknown;\nexport type SharedSceneWebGL2HostOptions = unknown;\n");
    write("packages/engine/dist/web/webgl2.js", "export { createSharedWebGL2Host } from './WebGL2Host.js';\n");
    write("packages/engine/dist/web/webgl2Scene3d.js", "export { createSharedSceneWebGL2HostInternal as createSharedSceneWebGL2Host } from './WebGL2Host.js';\n");
    write("packages/engine/dist/web/WebGL2Host.js", "export function createSharedWebGL2Host() {}\nexport function createSharedSceneWebGL2HostInternal() {}\nconst inertResourceKinds = ['Buffer','Buffer','Buffer'];\nclass InertGLHost {\n  sceneMode = false;\n  sceneFunctions;\n  generationGate(_token) {}\n  async load(token) {\n    if (this.sceneMode) { this.sceneFunctions = await import('./sharedWebGL2Scene.js'); this.generationGate(token); }\n  }\n}\n");
    write("packages/engine/dist/web/webgl2Native.js", "const METHODS = ['getContextAttributes','getError','isContextLost','getParameter','getShaderPrecisionFormat','getFramebufferAttachmentParameter','checkFramebufferStatus','bindFramebuffer','bindBuffer','bufferData','bufferSubData','getBufferSubData','readPixels','shaderSource','attachShader','getShaderParameter','getProgramParameter','getShaderInfoLog','getProgramInfoLog','getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms','getUniformLocation','useProgram','clientWaitSync','activeTexture','bindTexture','bindRenderbuffer','bindVertexArray','bindSampler','bindBufferRange','enable','disable','colorMask','depthMask','depthFunc','clearDepth','clearColor','clear','viewport','scissor','depthRange','blendEquationSeparate','blendFuncSeparate','pixelStorei','texParameteri','texStorage2D','texSubImage2D','renderbufferStorage','framebufferTexture2D','framebufferRenderbuffer','drawBuffers','readBuffer','compileShader','linkProgram','detachShader','uniformBlockBinding','uniform1i','uniform1f','uniform2f','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','drawArrays','drawElements','flush'];\nconst KINDS = ['Buffer','Texture','Renderbuffer','Framebuffer','Shader','Program','VertexArray','Sync'];\nclass InertGLCapture {\n  calls = new Map();\n  constructor(context, gate, captured) {\n    for (const name of [...METHODS,...KINDS.flatMap(kind=>[kind==='Sync'?'fenceSync':'create'+kind,'delete'+kind])]) {\n      const candidate = context[name];\n      gate(); if (typeof candidate !== 'function') throw new TypeError(name);\n      const call = candidate.bind(context);\n      this.calls.set(name,call); Object.defineProperty(captured,name,{value:(...args)=>{gate();const value=call(...args);if(name==='texSubImage2D'&&this.diagnostics){const state=this.diagnostics,bytes=args[4]*args[5]*4;if(state.totals.pageWriteCalls===Number.MAX_SAFE_INTEGER||bytes>Number.MAX_SAFE_INTEGER-state.totals.pageWriteBytes)state.saturated=true;state.totals.pageWriteCalls=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteCalls+1);state.totals.pageWriteBytes=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteBytes+bytes);}gate();return value;}});\n    }\n  }\n}\n");
    write("packages/engine/dist/web/webgl2Types.js", "export {};\n");
    write("packages/engine/dist/web/sharedWebGL2Options.js", "export {};\n");
    write("packages/engine/dist/web/webgl2.d.ts", "export { createSharedWebGL2Host } from './WebGL2Host.js';\nexport type { SharedWebGL2HostOptions } from './sharedWebGL2Options.js';\nexport type { SharedWebGL2Host, SharedWebGL2HostStatus, SharedWebGL2Readback, WebGL2HostState, WebGL2HostErrorCode, WebGL2HostFailure, WebGL2HostDiagnostic, WebGL2HostStatus } from './webgl2Types.js';\n");
    write("packages/engine/dist/web/webgl2Scene3d.d.ts", "export { createSharedSceneWebGL2HostInternal as createSharedSceneWebGL2Host } from './WebGL2Host.js';\nexport type { SharedSceneWebGL2Host } from './webgl2Types.js';\nexport type { SharedSceneWebGL2HostOptions } from './sharedWebGL2Options.js';\n");
    write("packages/engine/dist/web/WebGL2Host.d.ts", "export declare function createSharedWebGL2Host(): void;\nexport declare function createSharedSceneWebGL2HostInternal(): void;\n");
    write("packages/engine/dist/web/webgl2Native.d.ts", "export type GLNativeKind = 'Buffer' | 'Texture' | 'Renderbuffer' | 'Framebuffer' | 'Shader' | 'Program' | 'VertexArray' | 'Sync';\n");
    write("packages/engine/dist/web/webgl2Types.d.ts", "export type SharedWebGL2Host = unknown;\nexport type SharedWebGL2HostStatus = unknown;\nexport type SharedWebGL2Readback = unknown;\nexport type WebGL2HostState = unknown;\nexport type WebGL2HostErrorCode = unknown;\nexport type WebGL2HostFailure = unknown;\nexport type WebGL2HostDiagnostic = unknown;\nexport type WebGL2HostStatus = unknown;\nexport type SharedSceneWebGL2Host = unknown;\n");
    write("packages/engine/dist/web/sharedWebGL2Options.d.ts", "export type SharedWebGL2HostOptions = unknown;\nexport type SharedSceneWebGL2HostOptions = unknown;\n");
    write("node_modules/@egret/engine/webgl2.js", "export * from '../../../packages/engine/dist/web/webgl2.js';\n");
    write("node_modules/@egret/engine/webgl2-scene3d.js", "export * from '../../../packages/engine/dist/web/webgl2Scene3d.js';\n");
    // M14_FIXTURE_SCAFFOLD_END
    // M15 fixed source-reviewed literal overlay; never read policy tables from the checker.
    // Historical graph literals above remain unchanged. New factory bodies stay inert.
    const m15FixtureGraph = {
      "packages/contracts/src/ResourceManifest.ts": [["static","./ProjectFormat.generated.js"]],
      "packages/contracts/dist/ResourceManifest.js": [],
      "packages/contracts/dist/ResourceManifest.d.ts": [["static","./ProjectFormat.generated.js"]],
      "packages/contracts/src/resources/index.ts": [["static","../ResourceManifest.js"],["static","./manifestAdmission.js"]],
      "packages/contracts/dist/resources/index.js": [["static","./manifestAdmission.js"]],
      "packages/contracts/dist/resources/index.d.ts": [["static","../ResourceManifest.js"],["static","./manifestAdmission.js"]],
      "packages/contracts/src/resources/manifestAdmission.ts": [["static","../ProjectFormat.generated.js"],["static","../ResourceManifest.js"],["static","./sha256.js"]],
      "packages/contracts/dist/resources/manifestAdmission.js": [["static","./sha256.js"]],
      "packages/contracts/dist/resources/manifestAdmission.d.ts": [["static","../ResourceManifest.js"]],
      "packages/contracts/src/resources/sha256.ts": [],
      "packages/contracts/dist/resources/sha256.js": [],
      "packages/contracts/dist/resources/sha256.d.ts": [],
      "packages/project/src/resources/index.ts": [["static","./content.js"],["static","./content.js"],["static","./manifest.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
      "packages/project/dist/resources/index.js": [["static","./content.js"],["static","./manifest.js"]],
      "packages/project/dist/resources/index.d.ts": [["static","./content.js"],["static","./content.js"],["static","./manifest.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
      "packages/project/src/resources/content.ts": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../live-input.js"],["static","../paths.js"],["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
      "packages/project/dist/resources/content.js": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../live-input.js"],["static","../paths.js"],["static","@egret/contracts/resources"]],
      "packages/project/dist/resources/content.d.ts": [["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"]],
      "packages/project/src/resources/manifest.ts": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../public.js"],["static","../text-input.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
      "packages/project/dist/resources/manifest.js": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../text-input.js"],["static","@egret/contracts/resources"]],
      "packages/project/dist/resources/manifest.d.ts": [["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"]],
      "packages/engine/src/resources.ts": [["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"]],
      "packages/engine/dist/resources.js": [["static","./manifestResourceState.js"]],
      "packages/engine/dist/resources.d.ts": [["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"]],
      "packages/engine/src/manifestResourceTypes.ts": [["static","@egret/runtime"]],
      "packages/engine/dist/manifestResourceTypes.js": [],
      "packages/engine/dist/manifestResourceTypes.d.ts": [["static","@egret/runtime"]],
      "packages/engine/src/manifestResourceState.ts": [["static","./manifestResourceTypes.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/manifestResourceState.js": [["static","@egret/contracts/resources"],["static","@egret/runtime"]],
      "packages/engine/dist/manifestResourceState.d.ts": [["static","./manifestResourceTypes.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
      "packages/engine/src/manifestAssetGroup.ts": [["static","./assetGroup.js"],["static","./manifestResourceState.js"],["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/manifestAssetGroup.js": [["static","./manifestResourceState.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
      "packages/engine/dist/manifestAssetGroup.d.ts": [["static","./assetGroup.js"],["static","./manifestResourceTypes.js"],["static","@egret/runtime"]],
      "packages/engine/src/Engine.ts": [["static","./assetGroup.js"],["static","./assetGroup.js"],["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./manifestAssetGroup.js"],["static","./manifestAssetGroup.js"],["static","./manifestResourceTypes.js"],["static","./mouseInput.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./sequencePlayback.js"],["static","./sequencePlaybackTypes.js"],["static","./tween.js"],["static","./tween.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/Engine.js": [["static","./assetGroup.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./manifestAssetGroup.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./tween.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/Engine.d.ts": [["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./manifestResourceTypes.js"],["static","./sequencePlaybackTypes.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/src/bitmapBindingTicket.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/bitmapBindingTicket.js": [["static","@egret/runtime"]],
      "packages/engine/dist/bitmapBindingTicket.d.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/web/resources.ts": [["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","@egret/runtime"]],
      "packages/engine/dist/web/resources.js": [["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","@egret/runtime"]],
      "packages/engine/dist/web/resources.d.ts": [["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"]],
      "packages/engine/web/ManifestByteSource.ts": [["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","#egret-manifest-resources"],["static","#egret-manifest-resources"]],
      "packages/engine/dist/web/ManifestByteSource.js": [["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","#egret-manifest-resources"]],
      "packages/engine/dist/web/ManifestByteSource.d.ts": [["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","#egret-manifest-resources"]],
      "packages/engine/web/BrowserTextureProvider.ts": [["static","./ManifestByteSource.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/web/BrowserTextureProvider.js": [["static","@egret/contracts"],["static","@egret/runtime"]],
      "packages/engine/dist/web/BrowserTextureProvider.d.ts": [["static","./ManifestByteSource.js"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/web/sharedDeviceSession.ts": [],
      "packages/engine/dist/web/sharedDeviceSession.js": [],
      "packages/engine/dist/web/sharedDeviceSession.d.ts": [],
      "packages/engine/web/sharedFrameUpload.ts": [["static","@egret/contracts"]],
      "packages/engine/dist/web/sharedFrameUpload.js": [],
      "packages/engine/dist/web/sharedFrameUpload.d.ts": [["static","@egret/contracts"]],
      "packages/engine/web/WebGPUHost.ts": [["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./b1.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedRetentionLedger.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBufferPool.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],
      "packages/engine/dist/web/WebGPUHost.js": [["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],
      "packages/engine/dist/web/WebGPUHost.d.ts": [["static","./b1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
      "packages/engine/web/webgpu.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
      "packages/engine/dist/web/webgpu.js": [["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
      "packages/engine/dist/web/webgpu.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
      "packages/engine/web/scene3d.ts": [["static","../rendering/scene3d.js"],["static","./b1.js"],["static","./sharedB1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./webgpu.js"],["static","./webgpu.js"],["static","./WebGPUHost.js"],["static","@egret/contracts"]],
      "packages/engine/dist/web/scene3d.js": [["static","./b1.js"],["static","./sharedB1.js"]],
      "packages/engine/dist/web/scene3d.d.ts": [["static","../rendering/scene3d.js"],["static","./sharedB1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./webgpu.js"],["static","./webgpu.js"],["static","./WebGPUHost.js"],["static","@egret/contracts"]],
      "packages/engine/web/sharedWebGPUOptions.ts": [["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],
      "packages/engine/dist/web/sharedWebGPUOptions.js": [],
      "packages/engine/dist/web/sharedWebGPUOptions.d.ts": [["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],
      "packages/engine/web/webgpuLifetime.ts": [],
      "packages/engine/dist/web/webgpuLifetime.js": [],
      "packages/engine/dist/web/webgpuLifetime.d.ts": [],
      "packages/engine/web/webgpuRetentionPool.ts": [["static","./sharedRetentionLedger.js"],["static","./sharedRetentionLedger.js"],["static","./webgpuLifetime.js"]],
      "packages/engine/dist/web/webgpuRetentionPool.js": [["static","./sharedRetentionLedger.js"]],
      "packages/engine/dist/web/webgpuRetentionPool.d.ts": [["static","./sharedRetentionLedger.js"],["static","./webgpuLifetime.js"]],
      "packages/engine/web/WebGL2Host.ts": [["dynamic","./sharedWebGL2Scene.js"],["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedRetentionLedger.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Scene.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","./webgl2Native.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],
      "packages/engine/dist/web/WebGL2Host.js": [["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],
      "packages/engine/dist/web/WebGL2Host.d.ts": [["static","./sharedWebGL2Options.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"]],
      "packages/engine/web/webgl2Types.ts": [["static","../rendering/sceneFrame3D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","@egret/contracts"]],
      "packages/engine/dist/web/webgl2Types.js": [],
      "packages/engine/dist/web/webgl2Types.d.ts": [["static","../rendering/sceneFrame3D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","@egret/contracts"]],
      "packages/engine/web/webgl2.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
      "packages/engine/dist/web/webgl2.js": [["static","./WebGL2Host.js"]],
      "packages/engine/dist/web/webgl2.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
      "packages/engine/web/webgl2Scene3d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
      "packages/engine/dist/web/webgl2Scene3d.js": [["static","./WebGL2Host.js"]],
      "packages/engine/dist/web/webgl2Scene3d.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
      "packages/runtime/src/Bitmap.ts": [["static","./AssetLease.js"],["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./sequenceClip.js"],["static","./sharedFrameCapture.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/Bitmap.js": [["static","./AssetLease.js"],["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./sharedFrameCapture.js"],["static","./Texture.js"]],
      "packages/runtime/dist/Bitmap.d.ts": [["static","./AssetLease.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./sequenceClip.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/runtime/src/sharedFrameCapture.ts": [["static","./Bitmap.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./Stage.js"],["static","./textDisplayState.js"],["static","./textDisplayState.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
      "packages/runtime/dist/sharedFrameCapture.js": [["static","./Bitmap.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./textDisplayState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/sharedFrameCapture.d.ts": [["static","./bitmapDisplayState.js"],["static","./Stage.js"],["static","@egret/contracts"]],
      "packages/runtime/src/bitmapDisplayState.ts": [["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./DisplayObject.js"],["static","./displayVisualState.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/bitmapDisplayState.js": [["static","./displayVisualState.js"]],
      "packages/runtime/dist/bitmapDisplayState.d.ts": [["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./DisplayObject.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/runtime/src/ownership.ts": [["static","./AssetLease.js"],["static","./assetManagerOwnerState.js"],["static","./Bitmap.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./Scope.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/ownership.js": [["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"]],
      "packages/runtime/dist/ownership.d.ts": [["static","./AssetLease.js"],["static","./assetManagerOwnerState.js"],["static","./Bitmap.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./Scope.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","@egret/contracts"]],
      "packages/engine/web/webgl2Native.ts": [["static","./sharedRetentionLedger.js"],["static","./webgl2Types.js"],["static","@egret/runtime"]],
      "packages/engine/dist/web/webgl2Native.js": [["static","@egret/runtime"]],
      "packages/engine/dist/web/webgl2Native.d.ts": [["static","./sharedRetentionLedger.js"],["static","./webgl2Types.js"],["static","@egret/runtime"]],
      "packages/engine/web/sharedRetentionLedger.ts": [],
      "packages/engine/dist/web/sharedRetentionLedger.js": [],
      "packages/engine/dist/web/sharedRetentionLedger.d.ts": [],
      "packages/engine/rendering/sharedColor2D.ts": [["static","@egret/contracts"],["static","@egret/contracts"]],
      "packages/engine/dist/rendering/sharedColor2D.js": [["static","@egret/contracts"]],
      "packages/engine/dist/rendering/sharedColor2D.d.ts": [["static","@egret/contracts"]],
      "packages/engine/web/sharedSubmissionStorage2D.ts": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"]],
      "packages/engine/dist/web/sharedSubmissionStorage2D.js": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/sharedColor2D.js"]],
      "packages/engine/dist/web/sharedSubmissionStorage2D.d.ts": [["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"]],
      "packages/engine/web/prepareSharedSubmission2D.ts": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]],
      "packages/engine/dist/web/prepareSharedSubmission2D.js": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"]],
      "packages/engine/dist/web/prepareSharedSubmission2D.d.ts": [["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]]
    };
    // M1.2: the reviewed stock-ledger check adds this one emitted static edge.
    // Keep the retained fixture graphs intact; do not derive policy from the checker.
    const m12FixtureGraph = {
      "packages/engine/dist/rendering/prepareTexturedDraws2D.js": [["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],
    };
    for (const [file,edges] of Object.entries({...sceneGraph,...m13SharedGraph,...m14FixtureGraph,...m12FixtureGraph})) {
      if (Object.hasOwn(m15FixtureGraph,file)) continue; // Completed after the retained facade scaffolds below.
      const original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      const present=[...original.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
      const needed=[...edges];
      for (const target of present) { const index=needed.findIndex(edge=>edge[1]===target); if(index>=0)needed.splice(index,1); }
      const imports=needed.map(([kind,target],index)=>kind==='dynamic'?`const sceneDynamic${index}=()=>import(${JSON.stringify(target)});`: `import ${JSON.stringify(target)};`).join('\n');
      write(file,original+'\n'+imports+'\n');
    }
    // Inert canonical matrix exports preserve the same original module identity.
    write('packages/engine/dist/rendering/matrix4.js',readFileSync(path.join(root,'packages/engine/dist/rendering/matrix4.js'),'utf8')+'export function createMatrix4() {}\nexport function multiplyMatrix4() {}\nexport function Math3DError() {}\n');
    for (const [target,names] of [['meshGeometry3D',['createMeshGeometry3D','isMeshGeometry3D','getMeshGeometry3DErrorOrigin','MeshGeometry3DError']],['sceneFrame3D',['createSceneFrame3D','isSceneFrame3D','getScene3DErrorOrigin','Scene3DError']]]) {
      const file='packages/engine/dist/rendering/'+target+'.js';
      write(file,readFileSync(path.join(root,file),'utf8')+names.map(name=>`export function ${name}() {}`).join('\n'));
    }
    const sceneB1='packages/engine/dist/web/b1.js';
    write(sceneB1,readFileSync(path.join(root,sceneB1),'utf8')+'export function createB1WebGPUHost() {}\nexport function createTexturedB1WebGPUHost() {}\n');
    const cpuTypes=['Matrix4','Math3DErrorCode','MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin','SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'];
    const cpuTypeText="export type {Matrix4} from './matrix4.js';\nexport type {Math3DErrorCode} from './matrix4.js';\nexport type {MeshGeometry3D,MeshGeometry3DErrorCode,MeshGeometry3DErrorOrigin} from './meshGeometry3D.js';\nexport type {SceneProjectionInput3D,SceneDrawInput3D,SceneInput3D,SceneDraw3D,SceneFrame3D,Scene3DErrorCode,Scene3DErrorOrigin} from './sceneFrame3D.js';\nexport interface MeshGeometry3DInput { readonly positions: readonly number[]; readonly colors: readonly number[]; readonly indices: readonly number[]; }\n";
    const cpuValues="export {Math3DError} from './matrix4.js';\nexport {isMeshGeometry3D,MeshGeometry3DError,getMeshGeometry3DErrorOrigin} from './meshGeometry3D.js';\nexport {isSceneFrame3D,Scene3DError,getScene3DErrorOrigin} from './sceneFrame3D.js';\n";
    const cpuImports="import {createMatrix4 as createMatrix4Internal,multiplyMatrix4 as multiplyMatrix4Internal} from './matrix4.js';\nimport {createMeshGeometry3D as createMeshGeometry3DInternal} from './meshGeometry3D.js';\nimport {createSceneFrame3D as createSceneFrame3DInternal} from './sceneFrame3D.js';\n";
    const matrixSource="export function createMatrix4(input: readonly number[]): Matrix4 { return createMatrix4Internal(input); }\nexport function multiplyMatrix4(left: Matrix4,right: Matrix4): Matrix4 { return multiplyMatrix4Internal(left,right); }\n";
    const matrixEmitted="export function createMatrix4(input) { return createMatrix4Internal(input); }\nexport function multiplyMatrix4(left,right) { return multiplyMatrix4Internal(left,right); }\n";
    const matrixDeclaration="export declare function createMatrix4(input: readonly number[]): Matrix4;\nexport declare function multiplyMatrix4(left: Matrix4,right: Matrix4): Matrix4;\n";
    write('packages/engine/rendering/scene3d.ts',cpuImports+cpuValues+cpuTypeText+matrixSource+'export function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D { return createMeshGeometry3DInternal(input); }\nexport function createSceneFrame3D(input: SceneInput3D): SceneFrame3D { return createSceneFrame3DInternal(input); }\n');
    write('packages/engine/dist/rendering/scene3d.js',cpuImports+cpuValues+matrixEmitted+'export function createMeshGeometry3D(input) { return createMeshGeometry3DInternal(input); }\nexport function createSceneFrame3D(input) { return createSceneFrame3DInternal(input); }\n');
    write('packages/engine/dist/rendering/scene3d.d.ts',cpuValues+cpuTypeText+matrixDeclaration+'export declare function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D;\nexport declare function createSceneFrame3D(input: SceneInput3D): SceneFrame3D;\n');
    const browserTypes="import type {RenderFrame2D,TexturedRenderFrame2D} from '@egret/contracts';\nimport type {SceneFrame3D} from '../rendering/scene3d.js';\nimport type {WebGPUHost,WebGPUHostOptions,WebGPUHostStatus,TexturedWebGPUHost,TexturedWebGPUHostOptions} from './webgpu.js';\nexport type {TexturedWebGPUHostOptions} from './webgpu.js';\nexport type SceneWebGPUHostOptions = WebGPUHostOptions;\nexport interface SceneWebGPUHostStatus { readonly host: WebGPUHostStatus; readonly pendingSceneBytes: number; readonly pendingUniformBytes: number; readonly pendingDepthBytes: number; }\nexport interface SceneWebGPUHost extends WebGPUHost { renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined; getSceneStatus(): SceneWebGPUHostStatus; }\nexport interface TexturedSceneWebGPUHost extends TexturedWebGPUHost, SceneWebGPUHost { renderSceneTexturedFrame(scene: SceneFrame3D, overlay: TexturedRenderFrame2D): undefined; }\n";
    const browserImport="import {createB1WebGPUHost,createTexturedB1WebGPUHost} from './b1.js';\n";
    write('packages/engine/web/scene3d.ts',browserImport+browserTypes+'export function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost { return createB1WebGPUHost(options); }\nexport function createTexturedSceneWebGPUHost(options: TexturedWebGPUHostOptions): TexturedSceneWebGPUHost { return createTexturedB1WebGPUHost(options); }\n');
    write('packages/engine/dist/web/scene3d.js',browserImport+'export function createSceneWebGPUHost(options) { return createB1WebGPUHost(options); }\nexport function createTexturedSceneWebGPUHost(options) { return createTexturedB1WebGPUHost(options); }\n');
    write('packages/engine/dist/web/scene3d.d.ts',browserTypes+'export declare function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost;\nexport declare function createTexturedSceneWebGPUHost(options: TexturedWebGPUHostOptions): TexturedSceneWebGPUHost;\n');
    write('node_modules/@egret/engine/scene3d.js',"export * from '../../../packages/engine/dist/rendering/scene3d.js';\n");
    write('node_modules/@egret/engine/scene3d-web.js',"export * from '../../../packages/engine/dist/web/scene3d.js';\n");
    // S3D1_FIXTURE_SCAFFOLD_END
    // Only these fixed inert runtime dependencies are reached by the shared capture stub.
    for(const name of ['Bitmap','displayTransform','displayTreeState','displayVisualState','EgretError','meshCaptureSnapshot','ownership','textDisplayState']) {
      const file='packages/runtime/dist/'+name+'.js';if(!existsSync(path.join(root,file)))write(file,'export {};\n');
    }
    // M1.3 inert policy surfaces; copied declarations prove shape only.
    // These functions never stand in for capture, brands, pixels or Host behavior.
    const sharedTypes = {
      SharedMaterial2D:['SharedMaterialInput2D','SharedMaterial2D'],
      SharedGeometry2D:['SharedFloatArray2D','SharedIndexArray2D','SharedGeometryInput2D','SharedGeometry2D'],
      TextureViewRegion2D:['TextureViewRegionInput2D','TextureViewRegion2D'],
      SharedRenderFrame2D:['SharedFrameProfile2D','SharedOutputAlpha2D','SharedFrameOptions2D','SharedPage2D','SharedRegion2D','SharedDrawState2D','SharedRectangleCommand2D','SharedImageCommand2D','SharedMeshCommand2D','SharedBarrierCommand2D','SharedRenderCommand2D','SharedRenderFrame2D','SharedRenderHostAdapter'],
    };
    const append=(file,text)=>write(file,(existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'')+text);
    for(const [leaf,names]of Object.entries(sharedTypes)) {
      write('packages/contracts/dist/'+leaf+'.d.ts',readFileSync(path.join(repository,'packages/contracts/dist/'+leaf+'.d.ts')));
      const values=leaf==='SharedMaterial2D'?['createSharedMaterial2D','isSharedMaterial2D']:leaf==='SharedGeometry2D'?['createSharedGeometry2D','isSharedGeometry2D']:leaf==='SharedRenderFrame2D'?['SHARED_FRAME_PROFILE_2D']:[];
      for(const name of values)append('packages/contracts/dist/'+leaf+'.js',name==='SHARED_FRAME_PROFILE_2D'?'export const SHARED_FRAME_PROFILE_2D="egret.shared-frame2d/1";\n':'export function '+name+'() {}\n');
      for(const relative of ['src/index.ts','dist/index.d.ts','dist/index.js']) {
        const hasTypes=!relative.endsWith('.js');
        append('packages/contracts/'+relative,(hasTypes?'export type {'+names.join(',')+"} from './"+leaf+".js';\n":'')+(values.length?'export {'+values.join(',')+"} from './"+leaf+".js';\n":''));
        if(hasTypes)append('packages/engine/'+relative,'export type {'+names.join(',')+"} from '@egret/contracts';\n");
        const publicValues=values.filter(name=>!name.startsWith('isShared'));
        if(publicValues.length)append('packages/engine/'+relative,'export {'+publicValues.join(',')+"} from '@egret/contracts';\n");
      }
    }
    const exposedContractValues=[...imageValues.filter(name=>!missingImageExport||name!=='isImageData2D'),...geometryValues.filter(name=>name!==missingGeometryExport),'TEXTURED_FRAME_PROFILE_2D','createSharedMaterial2D','createSharedGeometry2D','SHARED_FRAME_PROFILE_2D'];
    const fakeEngine='node_modules/@egret/engine/index.js',fakeOriginal=readFileSync(path.join(root,fakeEngine),'utf8');
    const allContracts="export * from '../../../packages/contracts/dist/index.js';\n";
    assert.equal(fakeOriginal.split(allContracts).length,2);
    write(fakeEngine,fakeOriginal.replace(allContracts,'export {'+exposedContractValues.join(',')+"} from '../../../packages/contracts/dist/index.js';\n"));
    append('packages/runtime/dist/Texture.js','export function createTextureView() {}\n');
    append('packages/runtime/dist/sharedFrameCapture.js','export function collectSharedFrameContent() {}\n');
    write('packages/runtime/dist/sharedFrameCapture.d.ts',readFileSync(path.join(repository,'packages/runtime/dist/sharedFrameCapture.d.ts')));
    write('packages/runtime/dist/Mesh2D.d.ts',readFileSync(path.join(repository,'packages/runtime/dist/Mesh2D.d.ts')));
    for(const relative of ['src/index.ts','dist/index.d.ts','dist/index.js']) {
      append('packages/runtime/'+relative,"export {createTextureView} from './Texture.js';\nexport {collectSharedFrameContent} from './sharedFrameCapture.js';\n"+(!relative.endsWith('.js')?"export type {CapturedSharedContent2D} from './sharedFrameCapture.js';\n":''));
      append('packages/engine/'+relative,"export {createTextureView} from '@egret/runtime';\n");
    }
    append(fakeEngine,"export {createTextureView} from '../../../packages/runtime/dist/index.js';\n");
    append('packages/engine/dist/web/WebGPUHost.js','export function createSharedWebGPUHost() {}\n');
    for(const relative of ['web/webgpu.ts','dist/web/webgpu.d.ts','dist/web/webgpu.js'])append('packages/engine/'+relative,"export {createSharedWebGPUHost} from './WebGPUHost.js';\n"+(!relative.endsWith('.js')?"export type {SharedWebGPUHost,SharedWebGPUHostOptions,SharedWebGPUHostStatus,SharedWebGPUReadback} from './WebGPUHost.js';\n":''));
    append('node_modules/@egret/engine/webgpu.js','export function createSharedWebGPUHost() {}\n');
    append('packages/engine/dist/web/sharedB1.js','export function createSharedSceneWebGPUHost() {}\n');
    for(const relative of ['web/scene3d.ts','dist/web/scene3d.d.ts','dist/web/scene3d.js'])append('packages/engine/'+relative,"export {createSharedSceneWebGPUHost} from './sharedB1.js';\n"+(!relative.endsWith('.js')?"export type {SharedSceneWebGPUHost,SharedSceneWebGPUHostOptions} from './WebGPUHost.js';\n":''));
    // M13_SHARED_FIXTURE_END

    // MI1_FIXTURE_SCAFFOLD_BEGIN
    // Inert canonical policy inputs, never picker/event/native behavior evidence.
    const mouseTypes=['MouseInputOptions','MouseInput','MouseInputState','MouseInputEvents','MouseInputPayload','MouseInputCancelReason'];
    const buttonTypes=['BitmapButton','BitmapButtonOptions','BitmapButtonState'];
    const buttonForward="export {createBitmapButton} from '#egret-mouse-input';\n";
    const mouseBarrel="export {createMouseInput} from './MouseInput.js';\nexport type {"+mouseTypes.join(',')+"} from '#egret-mouse-input';\n"+buttonForward+"export type {"+buttonTypes.join(',')+"} from '#egret-mouse-input';\n";
    write('packages/engine/web/input.ts',mouseBarrel);write('packages/engine/dist/web/input.d.ts',mouseBarrel);
    write('packages/engine/dist/web/input.js',"export {createMouseInput} from './MouseInput.js';\n"+buttonForward);
    write('node_modules/@egret/engine/mouse-input.js',"export * from '../../../packages/engine/dist/web/input.js';\n");
    const resolverFile='node_modules/@egret/engine/package.json',resolver=JSON.parse(readFileSync(path.join(root,resolverFile),'utf8'));
    write(resolverFile,{...resolver,exports:{...resolver.exports,'./web/input':'./mouse-input.js'}});
    const mouseTypeScaffold=mouseTypes.map(name=>'export type '+name+' = unknown;\n').join('');
    write('packages/engine/src/mouseInputTypes.ts',mouseTypeScaffold);write('packages/engine/dist/mouseInputTypes.d.ts',mouseTypeScaffold);write('packages/engine/dist/mouseInputTypes.js','export {};\n');
    const buttonTypeScaffold=buttonTypes.map(name=>'export type '+name+' = unknown;\n').join('');
    write('packages/engine/src/bitmapButtonTypes.ts',buttonTypeScaffold);write('packages/engine/dist/bitmapButtonTypes.d.ts',buttonTypeScaffold);write('packages/engine/dist/bitmapButtonTypes.js','export {};\n');
    write('packages/engine/src/bitmapButton.ts','export function createBitmapButton(options) {}\n');write('packages/engine/dist/bitmapButton.js','export function createBitmapButton(options) {}\n');
    const browserInput="import {createMouseInputWithNative} from '#egret-mouse-input';\nexport function createMouseInput(options) { return createMouseInputWithNative(options); }\n";
    write('packages/engine/web/MouseInput.ts',browserInput);write('packages/engine/dist/web/MouseInput.js',browserInput);
    write('packages/engine/dist/web/MouseInput.d.ts',"import type {MouseInputOptions,MouseInput} from '#egret-mouse-input';\nexport declare function createMouseInput(options:MouseInputOptions):MouseInput;\n");
    const ownerSource="import {CancellationController,EgretError} from '@egret/runtime';\nexport function createMouseInputOwner(engine, assembly) {\nconst sample = new CancellationController().signal;\nconst originalSignals = new WeakMap();\nlet started=false;\nif (!started) throw new EgretError('MOUSE_INPUT_INVALID');\n}\nexport function createMouseInputWithNative(options) {}\nexport type {"+mouseTypes.join(',')+"} from './mouseInputTypes.js';\n";
    write('packages/engine/src/mouseInput.ts',ownerSource);write('packages/engine/dist/mouseInput.js',"export function createMouseInputWithNative(options) {}\nexport {createBitmapButton} from './bitmapButton.js';\n");
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
    // M15_FIXTURE_SCAFFOLD_BEGIN
    // Fixed empty factories and erased metadata only. No manifest admission,
    // binding, capture, bytes, decoding, upload or recovery behavior is simulated.
    write("packages/contracts/src/resources/index.ts", "export {validateResourceBuildPlanDescription,evaluateResourceBuildKeys,validateResourceBuildDescription,admitResourceManifest,buildResourceManifest,serializeResourceManifest,isAdmittedResourceManifest,getResourceManifestIdentityInputs} from './manifestAdmission.js';\nexport type {ResourceBuildSourceEntry,ResourceBuildPlanDescription,ResourceBuildKeyEntry,ResourceBuildKeyPlan,ResourceBuildEntry,ResourceBuildDescription,ResourceManifestEntry,AdmittedResourceManifest,ResourceManifestDiagnosticCode,ResourceManifestDiagnostic,ResourceManifestResult,ResourceManifestIdentityInputs} from '../ResourceManifest.js';\n");
    write("packages/contracts/dist/resources/index.js", "export {validateResourceBuildPlanDescription,evaluateResourceBuildKeys,validateResourceBuildDescription,admitResourceManifest,buildResourceManifest,serializeResourceManifest,isAdmittedResourceManifest,getResourceManifestIdentityInputs} from './manifestAdmission.js';\n");
    write("packages/contracts/dist/resources/index.d.ts", "export {validateResourceBuildPlanDescription,evaluateResourceBuildKeys,validateResourceBuildDescription,admitResourceManifest,buildResourceManifest,serializeResourceManifest,isAdmittedResourceManifest,getResourceManifestIdentityInputs} from './manifestAdmission.js';\nexport type {ResourceBuildSourceEntry,ResourceBuildPlanDescription,ResourceBuildKeyEntry,ResourceBuildKeyPlan,ResourceBuildEntry,ResourceBuildDescription,ResourceManifestEntry,AdmittedResourceManifest,ResourceManifestDiagnosticCode,ResourceManifestDiagnostic,ResourceManifestResult,ResourceManifestIdentityInputs} from '../ResourceManifest.js';\n");
    write("packages/project/src/resources/index.ts", "export {describeResourceBuild,parseResourceManifest,serializeResourceManifest} from './manifest.js';\nexport {describeContentRecipes,bindContentArtifacts,createContentAdoption} from './content.js';\nexport type {ContentProducer,ContentOutputFile,ContentOutput,ContentBoundOutput,ContentArtifactBinding,ContentAdoptionOptions} from './content.js';\nexport type {ResourceBuildPlanDescription} from '@egret/contracts/resources';\nexport type {ResourceBuildDescription,ResourceBuildEntry,ResourceManifestEntry,AdmittedResourceManifest} from '@egret/contracts/resources';\n");
    write("packages/project/dist/resources/index.js", "export {describeResourceBuild,parseResourceManifest,serializeResourceManifest} from './manifest.js';\nexport {describeContentRecipes,bindContentArtifacts,createContentAdoption} from './content.js';\n");
    write("packages/project/dist/resources/index.d.ts", "export {describeResourceBuild,parseResourceManifest,serializeResourceManifest} from './manifest.js';\nexport {describeContentRecipes,bindContentArtifacts,createContentAdoption} from './content.js';\nexport type {ContentProducer,ContentOutputFile,ContentOutput,ContentBoundOutput,ContentArtifactBinding,ContentAdoptionOptions} from './content.js';\nexport type {ResourceBuildPlanDescription} from '@egret/contracts/resources';\nexport type {ResourceBuildDescription,ResourceBuildEntry,ResourceManifestEntry,AdmittedResourceManifest} from '@egret/contracts/resources';\n");
    write("packages/project/src/resources/content.ts", "import type {AdmittedResourceManifest,ResourceBuildPlanDescription,ResourceBuildSourceEntry,ResourceManifestResult} from '@egret/contracts/resources';\nimport {buildResourceManifest,evaluateResourceBuildKeys,validateResourceBuildPlanDescription} from '@egret/contracts/resources';\nexport function describeContentRecipes() {}\nexport function bindContentArtifacts() {}\nexport function createContentAdoption() {}\nexport type ContentProducer = unknown;\nexport type ContentOutputFile = unknown;\nexport type ContentOutput = unknown;\nexport type ContentBoundOutput = unknown;\nexport type ContentArtifactBinding = unknown;\nexport type ContentAdoptionOptions = unknown;\n");
    write("packages/project/dist/resources/content.js", "import {buildResourceManifest,evaluateResourceBuildKeys,validateResourceBuildPlanDescription} from '@egret/contracts/resources';\nexport function describeContentRecipes() {}\nexport function bindContentArtifacts() {}\nexport function createContentAdoption() {}\n");
    write("packages/project/dist/resources/content.d.ts", "import type {AdmittedResourceManifest,ResourceBuildPlanDescription} from '@egret/contracts/resources';\nexport declare function describeContentRecipes(): void;\nexport declare function bindContentArtifacts(): void;\nexport declare function createContentAdoption(): void;\nexport type ContentProducer = unknown;\nexport type ContentOutputFile = unknown;\nexport type ContentOutput = unknown;\nexport type ContentBoundOutput = unknown;\nexport type ContentArtifactBinding = unknown;\nexport type ContentAdoptionOptions = unknown;\n");
    write("packages/engine/src/resources.ts", "export {createManifestAssetBinding} from './manifestResourceState.js';\nexport type {ManifestBinding,ManifestAssetBinding,ManifestAssetGroup,ManifestGroupOptions} from './manifestResourceTypes.js';\n");
    write("packages/engine/dist/resources.js", "export {createManifestAssetBinding} from './manifestResourceState.js';\n");
    write("packages/engine/dist/resources.d.ts", "export {createManifestAssetBinding} from './manifestResourceState.js';\nexport type {ManifestBinding,ManifestAssetBinding,ManifestAssetGroup,ManifestGroupOptions} from './manifestResourceTypes.js';\n");
    write("packages/contracts/src/ResourceManifest.ts", "export type ResourceBuildSourceEntry = unknown;\nexport type ResourceBuildPlanDescription = unknown;\nexport type ResourceBuildKeyEntry = unknown;\nexport type ResourceBuildKeyPlan = unknown;\nexport type ResourceBuildEntry = unknown;\nexport type ResourceBuildDescription = unknown;\nexport type ResourceManifestEntry = unknown;\nexport type AdmittedResourceManifest = unknown;\nexport type ResourceManifestDiagnosticCode = unknown;\nexport type ResourceManifestDiagnostic = unknown;\nexport type ResourceManifestResult = unknown;\nexport type ResourceManifestIdentityInputs = unknown;\n");
    write("packages/contracts/dist/ResourceManifest.d.ts", "export type ResourceBuildSourceEntry = unknown;\nexport type ResourceBuildPlanDescription = unknown;\nexport type ResourceBuildKeyEntry = unknown;\nexport type ResourceBuildKeyPlan = unknown;\nexport type ResourceBuildEntry = unknown;\nexport type ResourceBuildDescription = unknown;\nexport type ResourceManifestEntry = unknown;\nexport type AdmittedResourceManifest = unknown;\nexport type ResourceManifestDiagnosticCode = unknown;\nexport type ResourceManifestDiagnostic = unknown;\nexport type ResourceManifestResult = unknown;\nexport type ResourceManifestIdentityInputs = unknown;\n");
    write("packages/contracts/dist/ResourceManifest.js", "export {};\n");
    write("packages/engine/src/manifestResourceTypes.ts", "export type ManifestBinding = unknown;\nexport type ManifestAssetBinding = unknown;\nexport type ManifestAssetGroup = unknown;\nexport type ManifestGroupOptions = unknown;\n");
    write("packages/engine/dist/manifestResourceTypes.d.ts", "export type ManifestBinding = unknown;\nexport type ManifestAssetBinding = unknown;\nexport type ManifestAssetGroup = unknown;\nexport type ManifestGroupOptions = unknown;\n");
    write("packages/engine/dist/manifestResourceTypes.js", "export {};\n");
    write("packages/engine/web/sharedDeviceSession.ts", "export type SharedDeviceSessionState = unknown;\nexport type SharedDeviceSessionStatus = unknown;\nexport type SharedHostResourceStatus = unknown;\n");
    write("packages/engine/dist/web/sharedDeviceSession.d.ts", "export type SharedDeviceSessionState = unknown;\nexport type SharedDeviceSessionStatus = unknown;\nexport type SharedHostResourceStatus = unknown;\n");
    write("packages/engine/dist/web/sharedDeviceSession.js", "export {};\n");
    write("packages/engine/web/sharedFrameUpload.ts", "export type SharedFrameUploadOptions = unknown;\nexport type SharedFrameUploadReady = unknown;\nexport type SharedFrameSubmission = unknown;\nexport type SharedFrameUpload = unknown;\n");
    write("packages/engine/dist/web/sharedFrameUpload.d.ts", "export type SharedFrameUploadOptions = unknown;\nexport type SharedFrameUploadReady = unknown;\nexport type SharedFrameSubmission = unknown;\nexport type SharedFrameUpload = unknown;\n");
    write("packages/engine/dist/web/sharedFrameUpload.js", "export {};\n");
    write("packages/contracts/src/resources/manifestAdmission.ts", "export function validateResourceBuildPlanDescription() {}\nexport function evaluateResourceBuildKeys() {}\nexport function validateResourceBuildDescription() {}\nexport function admitResourceManifest() {}\nexport function buildResourceManifest() {}\nexport function serializeResourceManifest() {}\nexport function isAdmittedResourceManifest() {}\nexport function getResourceManifestIdentityInputs() {}\n");
    write("packages/contracts/dist/resources/manifestAdmission.js", "export function validateResourceBuildPlanDescription() {}\nexport function evaluateResourceBuildKeys() {}\nexport function validateResourceBuildDescription() {}\nexport function admitResourceManifest() {}\nexport function buildResourceManifest() {}\nexport function serializeResourceManifest() {}\nexport function isAdmittedResourceManifest() {}\nexport function getResourceManifestIdentityInputs() {}\n");
    write("packages/contracts/dist/resources/manifestAdmission.d.ts", "export declare function validateResourceBuildPlanDescription(): void;\nexport declare function evaluateResourceBuildKeys(): void;\nexport declare function validateResourceBuildDescription(): void;\nexport declare function admitResourceManifest(): void;\nexport declare function buildResourceManifest(): void;\nexport declare function serializeResourceManifest(): void;\nexport declare function isAdmittedResourceManifest(): void;\nexport declare function getResourceManifestIdentityInputs(): void;\n");
    write("packages/engine/src/manifestResourceState.ts", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nimport type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';\nexport function createManifestAssetBinding() {}\nexport function requireManifestBinding() {}\nexport function requireManifestAssetRef() {}\n");
    write("packages/engine/dist/manifestResourceState.js", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nexport function createManifestAssetBinding() {}\nexport function requireManifestBinding() {}\nexport function requireManifestAssetRef() {}\n");
    write("packages/engine/dist/manifestResourceState.d.ts", "import type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';\nexport declare function createManifestAssetBinding(): void;\nexport declare function requireManifestBinding(): void;\nexport declare function requireManifestAssetRef(): void;\n");
    write("packages/engine/src/manifestAssetGroup.ts", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nimport type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';\nexport function createManifestGroupOwner() {}\n");
    write("packages/engine/dist/manifestAssetGroup.js", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nexport function createManifestGroupOwner() {}\n");
    write("packages/project/src/resources/manifest.ts", "import type {AdmittedResourceManifest,ResourceBuildDescription,ResourceBuildEntry,ResourceManifestResult} from '@egret/contracts/resources';\nimport {admitResourceManifest,serializeResourceManifest as encodeManifest,validateResourceBuildDescription} from '@egret/contracts/resources';\nexport function describeResourceBuild() {}\nexport function parseResourceManifest() {}\nexport function serializeResourceManifest() {}\n");
    write("packages/project/dist/resources/manifest.js", "import {admitResourceManifest,serializeResourceManifest as encodeManifest,validateResourceBuildDescription} from '@egret/contracts/resources';\nexport function describeResourceBuild() {}\nexport function parseResourceManifest() {}\nexport function serializeResourceManifest() {}\n");
    write("packages/project/dist/resources/manifest.d.ts", "import type {AdmittedResourceManifest,ResourceBuildDescription} from '@egret/contracts/resources';\nexport declare function describeResourceBuild(): void;\nexport declare function parseResourceManifest(): void;\nexport declare function serializeResourceManifest(): void;\n");
    write("packages/engine/web/ManifestByteSource.ts", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nimport type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';\nimport {requireManifestBinding,requireManifestAssetRef} from '#egret-manifest-resources';\nimport type {ManifestBinding} from '#egret-manifest-resources';\nexport type ManifestByteSource = unknown;\nexport type ManifestByteSourceOptions = unknown;\nexport type ManifestByteSourceStatus = unknown;\nexport function createManifestByteSource() {}\nexport function requireManifestByteSource() {}\n");
    write("packages/engine/dist/web/ManifestByteSource.js", "import {isAdmittedResourceManifest} from '@egret/contracts/resources';\nimport {requireManifestBinding,requireManifestAssetRef} from '#egret-manifest-resources';\nexport function createManifestByteSource() {}\nexport function requireManifestByteSource() {}\n");
    write("packages/engine/dist/web/ManifestByteSource.d.ts", "import type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';\nimport type {ManifestBinding} from '#egret-manifest-resources';\nexport type ManifestByteSource = unknown;\nexport type ManifestByteSourceOptions = unknown;\nexport type ManifestByteSourceStatus = unknown;\nexport declare function createManifestByteSource(): void;\nexport declare function requireManifestByteSource(): void;\n");
    write("packages/engine/web/BrowserTextureProvider.ts", "import type {ManifestPngOwner,ManifestPngJob} from './ManifestByteSource.js';\nexport type BrowserPngPorts = unknown;\nexport type ManifestTextureProvider = unknown;\nexport type ManifestTextureProviderStatus = unknown;\nexport function createManifestPngTextureProvider() {}\n");
    write("packages/engine/dist/web/BrowserTextureProvider.js", "export function createManifestPngTextureProvider() {}\n");
    write("packages/engine/dist/web/BrowserTextureProvider.d.ts", "import type {ManifestPngOwner} from './ManifestByteSource.js';\nexport type BrowserPngPorts = unknown;\nexport type ManifestTextureProvider = unknown;\nexport type ManifestTextureProviderStatus = unknown;\nexport declare function createManifestPngTextureProvider(): void;\n");
    write("packages/engine/web/resources.ts", "import {requireManifestByteSource} from './ManifestByteSource.js';\nimport {createManifestPngTextureProvider} from './BrowserTextureProvider.js';\nimport {EgretError} from '@egret/runtime';\nexport {createManifestByteSource} from './ManifestByteSource.js';\nimport type {ManifestByteSource} from './ManifestByteSource.js';\nimport type {BrowserPngPorts,ManifestTextureProvider} from './BrowserTextureProvider.js';\nexport type {ManifestByteSource,ManifestByteSourceOptions,ManifestByteSourceStatus} from './ManifestByteSource.js';\nexport type {ManifestTextureProvider,ManifestTextureProviderStatus} from './BrowserTextureProvider.js';\nexport interface ManifestTextureProviderOptions {}\nexport function createManifestTextureProvider() {}\n");
    write("packages/engine/dist/web/resources.js", "import {requireManifestByteSource} from './ManifestByteSource.js';\nimport {createManifestPngTextureProvider} from './BrowserTextureProvider.js';\nimport {EgretError} from '@egret/runtime';\nexport {createManifestByteSource} from './ManifestByteSource.js';\nexport function createManifestTextureProvider() {}\n");
    write("packages/engine/dist/web/resources.d.ts", "export {createManifestByteSource} from './ManifestByteSource.js';\nimport type {ManifestByteSource} from './ManifestByteSource.js';\nimport type {BrowserPngPorts,ManifestTextureProvider} from './BrowserTextureProvider.js';\nexport type {ManifestByteSource,ManifestByteSourceOptions,ManifestByteSourceStatus} from './ManifestByteSource.js';\nexport type {ManifestTextureProvider,ManifestTextureProviderStatus} from './BrowserTextureProvider.js';\nexport interface ManifestTextureProviderOptions {}\nexport declare function createManifestTextureProvider(): void;\n");
    write("node_modules/@egret/contracts/resources.js", "export * from '../../../packages/contracts/dist/resources/index.js';\n");
    write("node_modules/@egret/project/resources.js", "export * from '../../../packages/project/dist/resources/index.js';\n");
    write("node_modules/@egret/engine/resources.js", "export * from '../../../packages/engine/dist/resources.js';\n");
    write("node_modules/@egret/engine/web-resources.js", "export * from '../../../packages/engine/dist/web/resources.js';\n");
    append('node_modules/@egret/runtime/index.js',"export {EgretError} from '../../../packages/runtime/dist/index.js';\n");
    const m15HostForward="export type {SharedDeviceSessionState,SharedDeviceSessionStatus,SharedHostResourceStatus} from './sharedDeviceSession.js';\nexport type {SharedFrameUploadOptions,SharedFrameUploadReady,SharedFrameSubmission,SharedFrameUpload} from './sharedFrameUpload.js';\n";
    for(const name of ['webgpu','scene3d','webgl2','webgl2Scene3d']) for(const [directory,suffix] of [['web','.ts'],['dist/web','.d.ts']])
      append('packages/engine/'+directory+'/'+name+suffix,m15HostForward);
    const m15EngineImports="import type {AdmittedResourceManifest} from '@egret/contracts/resources';\nimport type {ManifestAssetGroup,ManifestBinding,ManifestGroupOptions} from './manifestResourceTypes.js';\n";
    const m15Methods=['capturePreparedSharedFrame(ticket: BitmapBindingTicket, options: SharedFrameOptions2D): SharedRenderFrame2D',
      'createManifestGroup(scope: Scope, manifest: AdmittedResourceManifest, roots: readonly string[], bindings: readonly ManifestBinding[], options?: ManifestGroupOptions): ManifestAssetGroup'];
    for(const [file,declaration]of [['packages/engine/src/Engine.ts',false],['packages/engine/dist/Engine.d.ts',true]]) {
      const original=readFileSync(path.join(root,file),'utf8'),anchor=declaration?'export declare class Engine {':'export class Engine {';
      assert.equal(original.split(anchor).length,2,'one retained inert Engine class');
      const methods=m15Methods.map(method=>method+(declaration?';':" { throw new Error('Synthetic policy fixture only'); }")).join('\n');
      write(file,m15EngineImports+original.replace(anchor,anchor+'\n'+methods+'\n'));
    }
    append('packages/runtime/src/sharedFrameCapture.ts',"export function collectSharedFrameContent(stage: Stage): CapturedSharedContent2D { throw new Error('Synthetic policy fixture only'); }\n");
    // Named missing leaves are inert dependencies of these fixed generated
    // source shapes. They supply no copied product implementation or behavior.
    for(const file of [
      'packages/project/dist/api.js','packages/project/dist/diagnostics.js','packages/project/dist/limits.js','packages/project/dist/text-input.js',
      'packages/project/dist/live-input.js','packages/project/dist/paths.js',
      'packages/runtime/dist/AssetLease.js','packages/runtime/dist/atlasFrameLayout.js',
      'packages/engine/dist/closeHost.js','packages/engine/dist/bitmapResourceSlot.js',
      'packages/engine/dist/internal/textFieldFactoryState.js','packages/engine/dist/sequencePlayback.js',
    ]) if(!existsSync(path.join(root,file)))write(file,'export {};\n');
    // Preserve named clauses and all existing mutant additions. Complete only
    // the fixed missing literal edges; this never consults the checker source.
    for(const [file,edges]of Object.entries(m15FixtureGraph)) {
      const original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      const present=[...original.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
      const needed=[...edges];
      for(const target of present) {const index=needed.findIndex(edge=>edge[1]===target);if(index>=0)needed.splice(index,1);}
      const imports=needed.map(([kind,target],index)=>kind==='dynamic'?`const m15Dynamic${index}=()=>import(${JSON.stringify(target)});`:`import ${JSON.stringify(target)};`).join('\n');
      write(file,original+'\n'+imports+'\n');
    }

    // M3.1 fixed independent inert UI surfaces and literal scaffold. No product execution.
    const m31FixtureGraph = {
      "packages/engine/src/Engine.ts": [["static","./assetGroup.js"],["static","./assetGroup.js"],["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./internal/uiFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","./manifestAssetGroup.js"],["static","./manifestAssetGroup.js"],["static","./manifestResourceTypes.js"],["static","./mouseInput.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./sequencePlayback.js"],["static","./sequencePlaybackTypes.js"],["static","./tween.js"],["static","./tween.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/Engine.js": [["static","./assetGroup.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./internal/uiFactoryState.js"],["static","./manifestAssetGroup.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./tween.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/engine/dist/Engine.d.ts": [["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./manifestResourceTypes.js"],["static","./sequencePlaybackTypes.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
      "packages/runtime/src/DisplayObject.ts": [["static","./displayBounds.js"],["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./displayCoordinates.js"],["static","./displayHitState.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
      "packages/runtime/dist/DisplayObject.js": [["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./displayHitState.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/DisplayObject.d.ts": [["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./DisplayObjectContainer.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","@egret/contracts"]],
      "packages/runtime/src/DisplayObjectContainer.ts": [["static","./displayHitState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
      "packages/runtime/dist/DisplayObjectContainer.js": [["static","./displayHitState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
      "packages/runtime/dist/DisplayObjectContainer.d.ts": [["static","./DisplayObject.js"],["static","./ownership.js"]],
      "packages/runtime/src/Scope.ts": [["static","./CancellationController.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/Scope.js": [["static","./CancellationController.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
      "packages/runtime/dist/Scope.d.ts": [["static","./ownership.js"],["static","@egret/contracts"]],
      "packages/runtime/src/displayHitState.ts": [["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/displayHitState.js": [["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
      "packages/runtime/dist/displayHitState.d.ts": [["static","./DisplayObject.js"],["static","@egret/contracts"]],
      "packages/runtime/src/displayTreeState.ts": [["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./Stage.js"]],
      "packages/runtime/dist/displayTreeState.js": [["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"]],
      "packages/runtime/dist/displayTreeState.d.ts": [["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./Stage.js"]],
      "packages/runtime/src/displayVisualState.ts": [["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/displayVisualState.js": [["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
      "packages/runtime/dist/displayVisualState.d.ts": [["static","./DisplayObject.js"],["static","@egret/contracts"]],
      "packages/engine/src/pointerInput.ts": [["static","./internal/mouseInputFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","./mouseInput.js"],["static","./pointerInputTypes.js"],["static","./pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/input"],["static","@egret/runtime/input"]],
      "packages/engine/dist/pointerInput.js": [["static","./internal/mouseInputFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","@egret/runtime"],["static","@egret/runtime/input"]],
      "packages/engine/dist/pointerInput.d.ts": [["static","./pointerInputTypes.js"],["static","./pointerInputTypes.js"]],
      "packages/engine/src/internal/uiFactoryState.ts": [["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
      "packages/engine/dist/internal/uiFactoryState.js": [["static","@egret/runtime"]],
      "packages/engine/dist/internal/uiFactoryState.d.ts": [["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
      "packages/runtime/src/ui/index.ts": [["static","./displayCommit.js"],["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"],["static","./types.js"]],
      "packages/runtime/dist/ui/index.js": [["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"]],
      "packages/runtime/dist/ui/index.d.ts": [["static","./displayCommit.js"],["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"],["static","./types.js"]],
      "packages/runtime/src/ui/managedState.ts": [["static","../DisplayObject.js"],["static","../displayTreeState.js"],["static","../EgretError.js"]],
      "packages/runtime/dist/ui/managedState.js": [["static","../displayTreeState.js"],["static","../EgretError.js"]],
      "packages/runtime/dist/ui/managedState.d.ts": [["static","../DisplayObject.js"]],
      "packages/runtime/src/ui/displayCommit.ts": [["static","../displayHitState.js"],["static","../DisplayObject.js"],["static","../DisplayObjectContainer.js"],["static","../displayTreeState.js"],["static","../displayTreeState.js"],["static","../displayVisualState.js"],["static","../EgretError.js"],["static","../ownership.js"],["static","../Scope.js"],["static","../Stage.js"],["static","./managedState.js"],["static","@egret/contracts"]],
      "packages/runtime/dist/ui/displayCommit.js": [["static","../displayHitState.js"],["static","../DisplayObjectContainer.js"],["static","../displayTreeState.js"],["static","../displayVisualState.js"],["static","../EgretError.js"],["static","../ownership.js"],["static","../Scope.js"],["static","./managedState.js"]],
      "packages/runtime/dist/ui/displayCommit.d.ts": [["static","../DisplayObject.js"],["static","../DisplayObjectContainer.js"],["static","../Scope.js"],["static","../Stage.js"],["static","@egret/contracts"]],
      "packages/runtime/src/ui/layout.ts": [["static","../EgretError.js"],["static","./types.js"]],
      "packages/runtime/dist/ui/layout.js": [["static","../EgretError.js"]],
      "packages/runtime/dist/ui/layout.d.ts": [["static","./types.js"]],
      "packages/runtime/src/ui/heightIndex.ts": [["static","../EgretError.js"],["static","./types.js"]],
      "packages/runtime/dist/ui/heightIndex.js": [["static","../EgretError.js"]],
      "packages/runtime/dist/ui/heightIndex.d.ts": [["static","./types.js"]],
      "packages/runtime/src/ui/types.ts": [],
      "packages/runtime/dist/ui/types.js": [],
      "packages/runtime/dist/ui/types.d.ts": [],
      "packages/engine/src/ui/index.ts": [["static","./types.js"],["static","./uiRoot.js"]],
      "packages/engine/dist/ui/index.js": [["static","./uiRoot.js"]],
      "packages/engine/dist/ui/index.d.ts": [["static","./types.js"],["static","./uiRoot.js"]],
      "packages/engine/src/ui/types.ts": [["static","../Engine.js"],["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
      "packages/engine/dist/ui/types.js": [],
      "packages/engine/dist/ui/types.d.ts": [["static","../Engine.js"],["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
      "packages/engine/src/ui/uiRoot.ts": [["static","../internal/uiFactoryState.js"],["static","../pointerInputTypes.js"],["static","./types.js"],["static","./virtualList.js"],["static","./virtualList.js"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"],["static","@egret/runtime/ui"]],
      "packages/engine/dist/ui/uiRoot.js": [["static","../internal/uiFactoryState.js"],["static","./virtualList.js"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
      "packages/engine/dist/ui/uiRoot.d.ts": [["static","./types.js"]],
      "packages/engine/src/ui/virtualList.ts": [["static","./types.js"],["static","@egret/runtime"]],
      "packages/engine/dist/ui/virtualList.js": [["static","@egret/runtime"]],
      "packages/engine/dist/ui/virtualList.d.ts": [["static","./types.js"]],
    };
    const m31UiSeeds = {
  "packages/engine/src/ui/index.ts": "// SPDX-License-Identifier: Apache-2.0\nexport { createUiRoot } from './uiRoot.js';\nexport type { LayoutNode, UiInvalidationKind, UiLimits, VirtualRecord, VirtualDataSource, RowBindContext, RowBinding, RowUnbindInfo, RowRetention, UiRowPointerNotification, UiRootOptions, UiPreparation, UiCommitResult, UiRowSnapshot, UiCounters, VirtualListSnapshot, UiSnapshot, VirtualListHandle, UiRoot } from './types.js';\n",
  "packages/engine/dist/ui/index.d.ts": "// SPDX-License-Identifier: Apache-2.0\nexport { createUiRoot } from './uiRoot.js';\nexport type { LayoutNode, UiInvalidationKind, UiLimits, VirtualRecord, VirtualDataSource, RowBindContext, RowBinding, RowUnbindInfo, RowRetention, UiRowPointerNotification, UiRootOptions, UiPreparation, UiCommitResult, UiRowSnapshot, UiCounters, VirtualListSnapshot, UiSnapshot, VirtualListHandle, UiRoot } from './types.js';\n",
  "packages/engine/dist/ui/index.js": "export {createUiRoot} from './uiRoot.js';\n",
  "packages/engine/dist/ui/uiRoot.js": "export function createUiRoot() {}\nimport {captureUiLayout,planUiLayout,UiHeightIndex,createUiDisplayOperations} from \"@egret/runtime/ui\";\n",
  "packages/engine/dist/internal/uiFactoryState.js": "export function requireUiEngine() {}\n",
  "packages/runtime/dist/ui/index.js": "export {createUiDisplayOperations} from './displayCommit.js';\nexport {captureUiLayout,planUiLayout} from './layout.js';\nexport {UiHeightIndex} from './heightIndex.js';\n",
  "packages/runtime/dist/ui/displayCommit.js": "export function createUiDisplayOperations() {}\n",
  "packages/runtime/dist/ui/layout.js": "export function captureUiLayout() {}\nexport function planUiLayout() {}\n",
  "packages/runtime/dist/ui/heightIndex.js": "export class UiHeightIndex {}\n",
  "packages/engine/src/internal/uiFactoryState.ts": "import type {createUiDisplayOperations,UiDisplayOperations} from \"@egret/runtime/ui\";\n",
  "packages/engine/dist/internal/uiFactoryState.d.ts": "import type {createUiDisplayOperations,UiDisplayOperations} from \"@egret/runtime/ui\";\n",
  "packages/engine/src/ui/types.ts": "import type {UiLayoutNode,UiDirtyKind,UiLayoutBox} from \"@egret/runtime/ui\";\n",
  "packages/engine/dist/ui/types.d.ts": "import type {UiLayoutNode,UiDirtyKind,UiLayoutBox} from \"@egret/runtime/ui\";\n",
  "packages/engine/src/ui/uiRoot.ts": "import {captureUiLayout,planUiLayout,UiHeightIndex,createUiDisplayOperations} from \"@egret/runtime/ui\";\nimport type {UiLayoutTree,UiLayoutNode,UiLayoutPlan,UiLayoutBox,UiDisplayUpdate} from \"@egret/runtime/ui\";\n"
};
    for(const [file,body]of Object.entries(m31UiSeeds))write(file,body);
    for(const file of ['packages/runtime/dist/displayBounds.js','packages/runtime/dist/displayCoordinates.js',
      'packages/runtime/dist/EgretError.js','packages/runtime/dist/CancellationController.js','packages/runtime/dist/frameCaptureCache.js'])
      if(!existsSync(path.join(root,file)))write(file,'export {};\n');
    write('node_modules/@egret/engine/ui.js',"export * from '../../../packages/engine/dist/ui/index.js';\n");
    write('node_modules/@egret/runtime/ui.js',"export * from '../../../packages/runtime/dist/ui/index.js';\n");
    for(const [file,edges]of Object.entries(m31FixtureGraph)){
      const original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      const present=[...original.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
      const needed=[...edges];
      for(const target of present){const index=needed.findIndex(edge=>edge[1]===target);if(index>=0)needed.splice(index,1);}
      write(file,original+'\n'+needed.map(([,target])=>'import '+(file.endsWith('.ts')?'type {UiFixtureType} from ':'')+JSON.stringify(target)+';').join('\n')+'\n');
    }
    // Synthetic exact sequence facades and literal edges establish policy only.
    const m22FixtureGraph = {
  "packages/engine/src/Engine.ts": [
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./assetGroupTypes.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./closeHost.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "./internal/texturedFrameState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./manifestResourceTypes.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "./tween.js"
    ],
    [
      "static",
      "./tween.js"
    ],
    [
      "static",
      "./tweenTypes.js"
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
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts/resources"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/Engine.js": [
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./closeHost.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "./internal/texturedFrameState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "./tween.js"
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
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/Engine.d.ts": [
    [
      "static",
      "./assetGroupTypes.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./manifestResourceTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./tweenTypes.js"
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
      "@egret/contracts/resources"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/sequencePlayback.ts": [
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequencePlayback.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequencePlayback.d.ts": [
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/sequenceTargetClaims.ts": [
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequenceTargetClaims.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequenceTargetClaims.d.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/internal/sequenceControllerFactoryState.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/internal/sequenceControllerFactoryState.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/internal/sequenceControllerFactoryState.d.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/animation/index.ts": [
    [
      "static",
      "./sequenceController.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/dist/animation/index.js": [
    [
      "static",
      "./sequenceController.js"
    ]
  ],
  "packages/engine/dist/animation/index.d.ts": [
    [
      "static",
      "./sequenceController.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/src/animation/sequenceController.ts": [
    [
      "static",
      "../Engine.js"
    ],
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceController.js": [
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceController.d.ts": [
    [
      "static",
      "../Engine.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/animation/sequenceCoordinator.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceCoordinator.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceCoordinator.d.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ]
  ],
  "packages/engine/src/animation/sequenceInput.ts": [
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceInput.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceInput.d.ts": [
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/src/animation/sequenceMath.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceMath.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceMath.d.ts": [],
  "packages/engine/src/animation/types.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/types.js": [],
  "packages/engine/dist/animation/types.d.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ]
};
    for(const [file,edges]of Object.entries(m22FixtureGraph)){
      const existing=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      const present=[...existing.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
      const needed=[...edges];for(const target of present){const index=needed.findIndex(edge=>edge[1]===target);if(index>=0)needed.splice(index,1);}
      write(file,existing+'\n'+needed.map(([,target])=>'import '+(file.endsWith('.ts')?'type {SequenceFixtureType} from ':'')+JSON.stringify(target)+';').join('\n')+'\n');
    }
    const sequenceTypes=["SequenceMarker","SequenceControllerOptions","SequenceControllerState","SequenceEventSource","SequenceControllerEvent","SequenceSeekRequest","SequenceControllerStatus","SequenceController"];
    for(const [file,typed]of [['packages/engine/src/animation/index.ts',true],['packages/engine/dist/animation/index.js',false],['packages/engine/dist/animation/index.d.ts',true]])write(file,"export {createSequenceController} from './sequenceController.js';\n"+(typed?"export type {"+sequenceTypes.join(',')+"} from './types.js';\n":''));
    write('packages/engine/dist/animation/types.js','export {};\n');
    write('node_modules/@egret/engine/animation.js','export function createSequenceController() {}\n');
    if(sequenceMutation){
      const baseline=spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:root,encoding:'utf8'});
      assert.equal(baseline.status,0,'fresh sequence policy baseline: '+baseline.stdout+baseline.stderr);
      const edits={
        'extra-value':['node_modules/@egret/engine/animation.js','export const extraSequence=1;\n'],
        'extra-type':['packages/engine/dist/animation/index.d.ts','export interface ExtraSequence {}\n'],
        'types-value':['packages/engine/dist/animation/types.js','export const badSequenceType=1;\n'],
        'root-type':['packages/engine/dist/index.d.ts','export interface SequenceController {}\n'],
        'root-edge':['packages/engine/src/ProbeSequence.ts',"import './animation/sequenceController.js';\n"],
        'factory-edge':['packages/engine/src/ProbeSequence.ts',"import './internal/sequenceControllerFactoryState.js';\n"],
        'claims-edge':['packages/engine/src/ProbeSequence.ts',"import './sequenceTargetClaims.js';\n"],
        'host-timer':['packages/engine/src/animation/sequenceController.ts','const badSequenceTimer=setTimeout(()=>{},1);\n'],
      };
      const [file,addition]=edits[sequenceMutation];write(file,(existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'')+addition);
    }
    // M15_FIXTURE_SCAFFOLD_END
    if(sharedMutation) {
      const baseline=spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:root,encoding:'utf8'});assert.ifError(baseline.error);
      assert.equal(baseline.status,0,'shared mutation requires complete canonical baseline: '+baseline.stdout+baseline.stderr);
      const edits={
        'root-guard':['packages/engine/dist/index.d.ts','',"export {isSharedMaterial2D} from '@egret/contracts';\n"],
        'wrong-type-owner':['packages/engine/dist/index.d.ts',"export type {SharedMaterialInput2D,SharedMaterial2D} from '@egret/contracts';","export type {SharedMaterialInput2D,SharedMaterial2D} from './SharedMaterial2D.js';"],
        'extra-leaf-type':['packages/contracts/dist/SharedGeometry2D.d.ts','','\nexport interface SharedExtraGeometry {}\n'],
        'extra-leaf-alias':['packages/contracts/dist/SharedGeometry2D.d.ts','','\nexport type { SharedGeometry2D as ExtraSharedGeometry };\n'],
        'mesh-wide-content':['packages/runtime/dist/Mesh2D.d.ts','setContent(textureLease: AssetLease<Texture>, geometry: G): void;','setContent(textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D | SharedGeometry2D): void;'],
        'mesh-wide-getter':['packages/runtime/dist/Mesh2D.d.ts','get geometry(): G | undefined;','get geometry(): TexturedGeometry2D | SharedGeometry2D | undefined;'],
        'wrong-scene-forward':['packages/engine/web/scene3d.ts',"export {createSharedSceneWebGPUHost} from './sharedB1.js';","export {createSharedSceneWebGPUHost} from './WebGPUHost.js';"],
        'shared-private-helper':['packages/engine/dist/index.d.ts','','export interface SharedOwnerSnapshot2D {}\n'],
        'shared-extra-edge':['packages/engine/dist/rendering/packSharedDraws2D.js','',"const extra=()=>import('./packSharedMeshGeometry3D.js');\n"],
      };
      const edit=edits[sharedMutation];assert.ok(edit,'finite M1.3 mutation');const[file,before,after]=edit,original=readFileSync(path.join(root,file),'utf8');
      if(before)assert.equal(original.split(before).length,2,'unique M1.3 mutation anchor');
      write(file,before?original.replace(before,after):original+after);
    }

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
    // CH_POLICY_MUTATION_BEGIN
    let combinedSceneBaseline;
    if(combinedSceneMutation){
      assert.equal(createHash('sha256').update(readFileSync(path.join(root,'tools/check-boundaries.mjs'))).digest('hex'),checkerHash,'exact combined checker fixture copy');
      combinedSceneBaseline=spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:root,encoding:'utf8'});assert.ifError(combinedSceneBaseline.error);
      assert.equal(combinedSceneBaseline.status,0,'combined mutation requires fresh canonical baseline first: '+combinedSceneBaseline.stdout+combinedSceneBaseline.stderr);
      assert.match(combinedSceneBaseline.stdout,/Boundary check PASS/);
      const edits={
        'missing-combined-runtime':['packages/engine/dist/web/scene3d.js','export function createTexturedSceneWebGPUHost(options) { return createTexturedB1WebGPUHost(options); }\n',''],
        'extra-combined-type':['packages/engine/dist/web/scene3d.d.ts','','export interface ExtraCombinedHostType {}\n'],
        'old-route-combined-factory':['packages/engine/dist/web/index.d.ts','','export declare function createTexturedSceneWebGPUHost(): undefined;\n'],
        'wrong-combined-frame':['packages/engine/dist/web/scene3d.d.ts','renderSceneTexturedFrame(scene: SceneFrame3D, overlay: TexturedRenderFrame2D): undefined;','renderSceneTexturedFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined;'],
      };
      const edit=edits[combinedSceneMutation];assert.ok(edit,'finite assigned combined policy mutation');const [file,before,after]=edit;
      const original=readFileSync(path.join(root,file),'utf8');
      if(before!=='')assert.equal(original.split(before).length-1,1,'unique combined policy mutation anchor');
      write(file,before===''?original+after:original.replace(before,after));
    }
    // CH_POLICY_MUTATION_END
    // S3D1_MUTATION_BEGIN
    let sceneComparator;
    if (scene3dMutation) {
      assert.equal(createHash('sha256').update(readFileSync(path.join(root,'tools/check-boundaries.mjs'))).digest('hex'),checkerHash,'exact amended checker fixture copy');
      // This comparator represents historical S3D1 policy before the later
      // dependent M15 block. The full current checker still runs first and last.
      const comparatorSource=checker.toString('utf8');
      for(const marker of ['// M15_RESOURCE_RECOVERY_BOUNDARY_BEGIN','// M15_RESOURCE_RECOVERY_BOUNDARY_END'])
        assert.equal(comparatorSource.split(marker).length,2,'one exact M15 comparator marker');
      for(const marker of ['// S3D1_BOUNDARY_BEGIN','// S3D1_BOUNDARY_END'])
        assert.equal(comparatorSource.split(marker).length,2,'one exact S3D1 comparator marker');
      const sequenceClosureDeclarations=[...comparatorSource.matchAll(/^const m22SequenceLiteralClosure = (\{[\s\S]*?^\});$/gm)];
      assert.equal(sequenceClosureDeclarations.length,1,'one exact current sequence closure declaration');
      assert.doesNotThrow(()=>JSON.parse(sequenceClosureDeclarations[0][1]),'retained current sequence closure is pure JSON');
      const sequenceClosureDeclaration=sequenceClosureDeclarations[0][0];
      const predecessor=comparatorSource.replace(/\/\/ S3D1_BOUNDARY_BEGIN[\s\S]*?\/\/ S3D1_BOUNDARY_END\r?\n/,sequenceClosureDeclaration+'\n')
        .replace(/\/\/ M15_RESOURCE_RECOVERY_BOUNDARY_BEGIN[\s\S]*?\/\/ M15_RESOURCE_RECOVERY_BOUNDARY_END\r?\n/,'');
      assert.equal(predecessor.includes('M15_RESOURCE_RECOVERY_BOUNDARY_BEGIN'),false);
      assert.equal(predecessor.includes('S3D1_BOUNDARY_BEGIN'),false);
      assert.equal(predecessor.split(sequenceClosureDeclaration).length,2,'exact current sequence closure retained once');
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
        'button-root-type-leak':['packages/engine/dist/index.d.ts','','export interface BitmapButton {}\n'],
        'button-types-runtime':['packages/engine/dist/bitmapButtonTypes.js','','export const ButtonTypeRuntime=1;\n'],
        'button-private-target':['packages/engine/src/ProbeButton.ts','',"import type {BitmapButton} from './bitmapButtonTypes.js';\n"],
        'button-core-dom':['packages/engine/src/bitmapButton.ts','','const element=document;\n'],
        'button-core-clock':['packages/engine/src/bitmapButton.ts','','const clock=Date;\n'],
        'button-wrong-forward':['packages/engine/web/input.ts',"export {createBitmapButton} from '#egret-mouse-input';","export {createBitmapButton} from './MouseInput.js';"],
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
    // SP1-A_POLICY_MUTATION_BEGIN
    if(spineImportMutation){
      const edits={
        'extra-runtime':['node_modules/@egret/project/spine.js','','export const unexpectedSpine=1;\n'],
        'extra-type':['packages/project/dist/spine/index.d.ts','','export type {UnexpectedSpine} from "./types.js";\n'],
        'wrong-forward':['packages/project/src/spine/index.ts',"from './preflight.js'","from './other.js'"],
        'barrel-work':['packages/project/src/spine/index.ts','','const hiddenWork=1;\n'],
        'types-runtime':['packages/project/dist/spine/types.js','','export const hiddenTypeRuntime=1;\n'],
        'private-root-edge':['packages/project/src/SpineProbe.ts','','import type {SpineImportPlan} from "./spine/types.js";\n'],
        'dom-ambient':['packages/project/src/spine/preflight.ts','','const canvas:HTMLCanvasElement=undefined;\n'],
        'host-timer':['packages/project/dist/spine/preflight.js','','setTimeout(()=>{},1);\n'],
      };
      const edit=edits[spineImportMutation];assert.ok(edit,'finite SP1-A control');
      const [file,before,after]=edit,original=existsSync(path.join(root,file))?readFileSync(path.join(root,file),'utf8'):'';
      if(before)assert.equal(original.split(before).length-1,1,'unique SP1-A mutation anchor');
      write(file,before?original.replace(before,after):original+after);
    }
    // SP1-A_POLICY_MUTATION_END
    let meshStateBaseline;
    if (meshStateEmittedValueImport) {
      // The shared capture stub now reaches this state module during facade loading.
      // Resolve the forbidden edge to the same inert singleton before testing policy.
      write('packages/runtime/dist/Mesh2D.js', "export {Mesh2D} from './index.js';\n");
      meshStateBaseline = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
      assert.ifError(meshStateBaseline.error);
      assert.equal(meshStateBaseline.status, 0, 'Complete Mesh backedge baseline: ' + meshStateBaseline.stdout + meshStateBaseline.stderr);
      const file = 'packages/runtime/dist/meshDisplayState.js';
      write(file, "import {Mesh2D} from './Mesh2D.js';\n" + readFileSync(path.join(root, file), 'utf8'));
    }
    const result = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    /* S3D1_RESULT_BEGIN */ if(sceneComparator)result.mapAdaptedPredecessor=sceneComparator; /* S3D1_RESULT_END */
    if(combinedSceneBaseline)result.combinedSceneBaseline=combinedSceneBaseline;
    if(meshStateBaseline)result.meshStateBaseline=meshStateBaseline;
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
  ['button-root-type-leak','MI1: input leaks outside optional entry'],
  ['button-types-runtime','BITMAP_BUTTON: types emitted runtime values'],
  ['button-private-target','MI1: private input target imported outside named paths'],
  ['button-core-dom','host ambient dependency'],
  ['button-core-clock','MI1: input automatic timing dependency'],
  ['button-wrong-forward','MI1: exact optional forwarding mismatch'],
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

// Each assigned control starts from its own complete legal policy fixture.
for(const [name,reason]of [
  ['missing-combined-runtime','webgpu/scene3d: exact runtime export surface mismatch'],
  ['extra-combined-type','webgpu/scene3d: exact type-only export surface mismatch'],
  ['old-route-combined-factory','web: explicit-only scene name leaked: createTexturedSceneWebGPUHost'],
  ['wrong-combined-frame','webgpu/scene3d: canonical authoring/Host type mismatch: TexturedSceneWebGPUHost'],
])test('combined scene host boundary rejects '+name,()=>{
  fixture({imported:'robust-predicates',combinedSceneMutation:name},result=>{
    assert.equal(result.combinedSceneBaseline.status,0,'fresh canonical combined baseline completed');
    assert.equal(result.status,1);assert.ok(result.stderr.includes(reason),'assigned combined reason: '+result.stdout+result.stderr);
  });
});

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
    assert.equal(result.meshStateBaseline.status,0,'fresh complete baseline before the backedge');
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/runtime: Mesh state emitted value import\/backedge/);
    assert.doesNotMatch(result.stderr,/ERR_MODULE_NOT_FOUND/);
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

// SP1_A_POLICY_TESTS_BEGIN
test('SP1-A exact optional policy baseline preserves retained root',()=>{
  fixture({imported:'robust-predicates'},r=>{assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/Boundary check PASS/);});
});
for(const [name,reason]of [
  ['extra-runtime','SP1-A: exact optional runtime exports mismatch'],
  ['extra-type','SP1-A: exact optional declaration forwarding mismatch'],
  ['wrong-forward','SP1-A: exact optional declaration forwarding mismatch'],
  ['barrel-work','SP1-A: exact optional declaration forwarding mismatch'],
  ['types-runtime','SP1-A: types module emitted runtime values'],
  ['private-root-edge','SP1-A: optional subtree imported outside its entry'],
  ['dom-ambient','host ambient dependency'],
  ['host-timer','SP1-A: optional planning entry requests a host'],
])test('SP1-A policy '+name+' requires fresh complete baseline then exact refusal',()=>{
  fixture({imported:'robust-predicates'},r=>{assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/Boundary check PASS/);});
  fixture({imported:'robust-predicates',spineImportMutation:name},r=>{assert.equal(r.status,1,r.stdout+r.stderr);assert.ok(r.stderr.includes(reason),r.stderr);});
});
// SP1_A_POLICY_TESTS_END

// M1.3 finite policy controls do not replace genuine shared capture/Host tests.
for(const [name,reason]of [
  ['root-guard','M13: shared brand guard leaked outside contracts'],
  ['wrong-type-owner','M13: canonical shared forwarding mismatch'],
  ['extra-leaf-type','M13: exact shared contract leaf mismatch'],
  ['extra-leaf-alias','M13: exact shared contract leaf mismatch'],
  ['mesh-wide-content','M13: Mesh2D canonical generic contract mismatch'],
  ['mesh-wide-getter','M13: Mesh2D canonical generic contract mismatch'],
  ['wrong-scene-forward','M13: canonical shared forwarding mismatch'],
  ['shared-private-helper','M13: private shared helper leaked'],
  ['shared-extra-edge','S3D1: scene entry imported outside approved closure'],
])test('M1.3 policy '+name+' requires healthy baseline and assigned refusal',()=>{
  fixture({imported:'robust-predicates',sharedMutation:name},result=>{
    assert.equal(result.status,1,result.stdout+result.stderr);assert.ok(result.stderr.includes(reason),result.stderr);
  });
});

for(const [mutation,refusal]of [["extra-value","M2.2: exact optional sequence values mismatch"],["extra-type","M2.2: exact optional sequence facade mismatch"],["types-value","M2.2: sequence types acquired runtime values"],["root-type","M2.2: sequence authority leaked outside optional entry"],["root-edge","M2.2: default engine acquired optional sequence logic"],["factory-edge","M2.2: private sequence factory imported outside named modules"],["claims-edge","M2.2: private sequence claims imported outside named modules"],["host-timer","M2.2: sequence controller acquired automatic host work"]])test('M2.2 sequence policy '+mutation+' retains exact refusal',()=>{fixture({imported:'robust-predicates',sequenceMutation:mutation},result=>{assert.equal(result.status,1,result.stdout+result.stderr);assert.ok(result.stderr.includes(refusal),result.stderr);});});
