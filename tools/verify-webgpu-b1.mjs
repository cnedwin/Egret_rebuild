// First-party bounded B1 browser verifier. Cooperative API cleanup is not OS retirement proof.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { verifyPixels, POSITIVE_FRAMES, NEGATIVES } from './b1-webgpu/oracle.mjs';
import { verifyCompositionPixels, COMPOSITION_BASELINES, COMPOSITION_CONTROL } from './b1-webgpu/public-composition-oracle.mjs';
import { captureRegistryProvenance, verifyRegistryProvenanceAfter, resolveRegistryConsumers, resolveB1Dependency, isPrivateRegistryPolicyRefusal } from './b1-webgpu/registryProvenance.mjs';

const directory = dirname(fileURLToPath(import.meta.url)), companionDirectory = resolve(directory, 'b1-webgpu');
const sha256 = body => createHash('sha256').update(body).digest('hex');
class SetupRefusal extends Error {
  constructor(code, message) { super(message); this.name = 'SetupRefusal'; this.code = code; }
}
function samePath(first, second) {
  const comparable = value => process.platform === 'win32' ? value.replaceAll('\\', '/').toLowerCase() : value;
  return comparable(first) === comparable(second);
}
function inside(root, candidate) {
  const tail = relative(root, candidate);
  return tail === '' || (!isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + sep));
}
async function directoryChain(path) {
  // Realpath equality plus lstat rejects path aliases, symlinks and Windows junction ancestors.
  // This is finite admission in a cooperative filesystem, not an adversarial inode-race guarantee.
  for (let cursor = path; ; cursor = dirname(cursor)) {
    const info = await lstat(cursor);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(cursor), cursor)) {
      throw Error('Output ancestry is not canonical regular directories');
    }
    if (dirname(cursor) === cursor) break;
  }
}
async function outputAdmission(requested, repository) {
  const output = resolve(requested);
  if (!samePath(requested, output) || inside(repository, output)) throw Error('Output must be a canonical repository-external child');
  try { await lstat(output); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await directoryChain(dirname(output)); return output;
  }
  throw Error('Existing output is never reused');
}
async function admit(argv) {
  const options = Object.create(null), metadataInputs = new Map();
  if (argv.length !== 6) throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Exactly three option/value pairs are required');
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!['--playwright', '--channel', '--output'].includes(key) || Object.hasOwn(options, key)
        || typeof value !== 'string' || !value.length || value.length > 32768) {
      throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Missing, duplicate, unknown or invalid option/value');
    }
    options[key] = value;
  }
  if (!isAbsolute(options['--playwright']) || !isAbsolute(options['--output'])) {
    throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Installed-tool and output paths must be absolute');
  }
  if (options['--channel'] !== 'msedge') throw new SetupRefusal('CHANNEL_UNSUPPORTED', 'Only the selected msedge channel is admitted');
  if (process.version !== 'v26.7.0' || process.execArgv.length !== 0) {
    throw new SetupRefusal('NODE_PROFILE_INVALID', 'Node.js v26.7.0 without added execution flags is required');
  }
  const repository = await realpath(resolve(directory, '..'));
  let output;
  try { output = await outputAdmission(options['--output'], repository); }
  catch { throw new SetupRefusal('OUTPUT_OWNERSHIP_INVALID', 'Output must be absent, canonical, nonsymlink and outside the repository'); }
  async function profileFile(path) {
    const physical = await realpath(path), info = await lstat(physical);
    if (!info.isFile() || info.size > 1024 * 1024) throw Error('Profile input is not a bounded regular file');
    const body = await readFile(physical);
    if (body.length !== info.size) throw Error('Profile input changed while reading');
    const receipt = { path: physical, bytes: body.length, sha256: sha256(body) };
    const previous = metadataInputs.get(physical);
    if (previous) assert.deepEqual(receipt, previous, 'Profile input changed during admission');
    metadataInputs.set(physical, receipt); return body;
  }
  const profileJSON = async path => JSON.parse((await profileFile(path)).toString('utf8'));
  let modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata;
  try {
    modulePath = await realpath(options['--playwright']); playwrightMetadataPath = resolve(modulePath, 'package.json');
    metadata = await profileJSON(playwrightMetadataPath);
    if (metadata.name !== 'playwright' || metadata.version !== '1.62.1') throw Error('Installed Playwright identity/version differs');
    // Resolve from the selected package: both nested and sibling node_modules layouts are valid.
    const require = createRequire(playwrightMetadataPath);
    coreMetadataPath = await realpath(require.resolve('playwright-core/package.json')); coreMetadata = await profileJSON(coreMetadataPath);
    if (coreMetadata.name !== 'playwright-core' || coreMetadata.version !== '1.62.1') throw Error('Installed playwright-core identity/version differs');
    await profileFile(resolve(modulePath, 'index.mjs'));
  } catch { throw new SetupRefusal('PLAYWRIGHT_METADATA_INVALID', 'Installed Playwright/core identity, version or entry metadata is invalid'); }
  let rootMetadata, compilerMetadataPath;
  try {
    rootMetadata = await profileJSON(resolve(repository, 'package.json'));
    compilerMetadataPath = resolve(repository, 'node_modules/typescript/package.json');
    if (rootMetadata.packageManager !== 'pnpm@11.25.0' || rootMetadata.devDependencies?.typescript !== '7.0.2'
        || (await profileJSON(compilerMetadataPath)).version !== '7.0.2') throw Error('Repository profile differs');
  } catch { throw new SetupRefusal('REPOSITORY_PROFILE_INVALID', 'Repository pnpm/TypeScript metadata differs from the selected profile'); }
  try {
    await outputAdmission(output, repository); // Recheck after metadata IO before exclusive ownership.
    await mkdir(output);
    await directoryChain(output);
  } catch { throw new SetupRefusal('OUTPUT_OWNERSHIP_INVALID', 'Exclusive canonical output creation failed; existing caller paths remain untouched'); }
  return { repository, output, modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata,
    rootMetadata, compilerMetadataPath, metadataInputs };
}
async function main() {
let admission;
try { admission = await admit(process.argv.slice(2)); }
catch (error) {
  const code = error instanceof SetupRefusal ? error.code : 'SETUP_INCOMPLETE';
  const message = error instanceof SetupRefusal ? error.message : 'Canonical repository or setup IO could not be admitted';
  console.error(`${code}: ${message.slice(0, 1024)}`); process.exitCode = 1; return;
}
const { repository, output, modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata,
  rootMetadata, compilerMetadataPath, metadataInputs } = admission;
const startedAt = Date.now(), operationDeadline = startedAt + 70000, closeDeadline = startedAt + 85000;
const report = { schemaVersion: 1, status: 'INCOMPLETE', startedAtUTC: new Date(startedAt).toISOString(), budgetMs: 90000,
  launch: { channel: 'msedge', headless: true, callerAddedFlags: [], freshContext: true, deviceScaleFactor: 1 },
  windows: [], supplementaryWindows: [], patches: [], requests: [], browserEvents: [], cleanupFailures: [], failure: null,
  registryProvenance: [], registryResolution: [], registryCaptureObservations: [], registryRereads: [], registryRecordingFailures: [],
  registryFailures: [], registryFailure: null,
  registryRecordingScope: 'Enforced filesystem and selected resolver policy; not browser loads or requests',
  lifecycle: { browserClosed: false, contextClosed: false, serverClosed: false, identitiesStable: false,
    cleanupScope: 'standalone-cooperative-api', osDescendantRetirement: 'UNBOUND', pendingApiOperations: 0 },
  limits: 'Real desktop-browser compilation/readback only; no hardware acceleration, physical display, phone, SDK, font, DragonBones, performance or full texture acceptance.' };
const hash = sha256, pendingApiOperations = new Set();
function fault(error) { return { name: typeof error?.name === 'string' ? error.name : 'Unknown', message: typeof error?.message === 'string' ? error.message.slice(0, 16000) : 'Non-error rejection', stack: typeof error?.stack === 'string' ? error.stack.slice(0, 16000) : null }; }
function observe(promise) {
  // Settlement observation owns every started API promise; timeout does not cancel its work.
  if (!pendingApiOperations.has(promise)) {
    pendingApiOperations.add(promise);
    const settled = () => { pendingApiOperations.delete(promise); };
    promise.then(settled, settled);
  }
  return promise;
}
async function bounded(promise, deadline, label) {
  observe(promise); const remaining = Math.min(15000, deadline - Date.now()); if (remaining <= 0) throw Error(`INCOMPLETE:${label}:deadline`);
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`INCOMPLETE:${label}:timeout`)), remaining); })]); }
  finally { clearTimeout(timer); }
}
const save = (name, value) => writeFile(resolve(output, name), JSON.stringify(value, null, 2), { flag: 'wx' });
// Emergency direct exit records INCOMPLETE; it cannot prove browser-descendant retirement.
const hardTimer = setTimeout(() => {
  report.status = 'INCOMPLETE'; report.cleanupFailures.push({ name: 'HardDeadline', message: 'Selected verifier exceeded its fixed budget; cleanup is unproven' });
  report.lifecycle.pendingApiOperations = pendingApiOperations.size;
  try { writeFileSync(resolve(output, 'hard-abort.json'), JSON.stringify(report, null, 2), { flag: 'wx' }); } catch {}
  process.exit(1);
}, 89000);
let browser, server, context, browserCloseRequested = false;
const sockets = new Set(), identities = new Map(metadataInputs), served = new Map(), openPages = new Set(), acquisitions = [];
const registryCaptures = new Map();
// Only errors created here have S04 incomplete authority; public code strings do not.
const s04PrivateErrors = new WeakSet();
let s04EnforcementIncomplete = false, s04FirstAbort = null;
function s04Fault(error) {
  return { ...fault(error), code: typeof error?.code === 'string' ? error.code : null };
}
function s04FailurePriority(value) {
  const field = value.reason?.field ?? value.readFailures?.[0]?.role;
  if (field === 'originalSource' || field === 'originalSource.path') return 0;
  if (field === 'originalEmitted') return 1;
  if (field === 'selectedEmitted') return 2;
  return 3;
}
function s04Incomplete(phase, mode, reason, details = {}) {
  const failure = { phase, mode, reason: reason ? structuredClone(reason) : null, ...structuredClone(details) };
  report.registryFailures.push(failure);
  if (!report.registryFailure || s04FailurePriority(failure) < s04FailurePriority(report.registryFailure)) {
    report.registryFailure = structuredClone(failure);
  }
  s04EnforcementIncomplete = true;
  const error = new Error('Private B1 registry evidence is incomplete');
  s04PrivateErrors.add(error); s04FirstAbort ??= error;
  return error;
}
async function s04Reread(phase, mode, capture) {
  let receipt;
  try { receipt = await verifyRegistryProvenanceAfter({ repository, output, captured: capture }); }
  catch (error) {
    // This catch owns only the policy read call, not native/render/setup operations.
    const observationFailure = s04Fault(error);
    report.registryRecordingFailures.push({ phase, mode, ...observationFailure });
    s04Incomplete(phase, mode, null, { observationFailure });
    return;
  }
  report.registryRereads.push({ phase, mode, ...receipt });
  if (!receipt.accepted) {
    const readFailures = receipt.observations.filter(value => value.error).map(value => ({ role: value.role, error: value.error }));
    s04Incomplete(phase, mode, receipt.reason, { readFailures });
  }
}
function acquire(promise, label, assign) {
  // Assign handles in the continuation even when the caller's bounded await has timed out.
  const record = { label, settled: false, promise: null };
  record.promise = observe(promise.then(value => { record.settled = true; assign(value); return value; },
    error => { record.settled = true; throw error; }));
  acquisitions.push(record); return record.promise;
}
const aliases = { '#egret-textured-frame-state': 'packages/engine/dist/internal/texturedFrameState.js', '@egret/contracts': 'packages/contracts/dist/index.js', '@egret/contracts/resources': 'packages/contracts/dist/resources/index.js', '@egret/runtime': 'packages/runtime/dist/index.js',
  '@egret/engine': 'packages/engine/dist/index.js', '@egret/engine/scene3d': 'packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgpu/scene3d': 'packages/engine/dist/web/scene3d.js', 'robust-predicates': 'packages/engine/node_modules/robust-predicates/index.js' };
const entryNames = ['packages/engine/dist/index.js', 'packages/engine/dist/rendering/scene3d.js',
  'packages/engine/dist/web/scene3d.js', 'packages/engine/dist/web/webgpuMeshPass.js'];
// Source-read frozen finite closure of the public entries plus the one private WGSL diagnostic.
const allowedModules = new Set([
  ...['ImageData2D', 'index', 'TexturedGeometry2D', 'TexturedRenderFrame2D'].map(name => `packages/contracts/dist/${name}.js`),
  ...['assetGroup', 'closeHost', 'createEngine', 'createEngineForProfile', 'Engine', 'gameClock', 'index', 'mouseInput', 'startEngine', 'surfaceOwnership', 'tween'].map(name => `packages/engine/dist/${name}.js`),
  ...['mouseInputFactoryState', 'textFieldFactoryState', 'texturedFrameState'].map(name => `packages/engine/dist/internal/${name}.js`),
  ...['admitTexturedFrame2D', 'copyFrame2D', 'copyMixedFrame2D', 'imageFrameBudget', 'matrix4', 'meshGeometry3D', 'ownedPreparationFailure2D',
    'packedOrientation', 'packedPosition2D', 'packImageVertices2D', 'packMeshGeometry3D', 'packTexturedMesh2D', 'prepareImages2D', 'prepareMixedDraws2D',
    'prepareRectangles2D', 'prepareTexturedDraws2D', 'prepareTexturedMesh2D', 'preparedFrameCache2D', 'preparedBatches2D', 'projection3D', 'sceneFrame3D', 'scene3d', 'texturedPreparationBudget2D'].map(name => `packages/engine/dist/rendering/${name}.js`),
  ...['b1', 'imageProjections2D', 'prepareTexturedSubmission2D', 'scene3d', 'texturedWebGPUOptions', 'WebGPUHost', 'webgpuImagePass', 'webgpuLifetime',
    'webgpuMeshPass', 'webgpuPass', 'webgpuTexturedPass', 'webgpuBufferPool', 'webgpuBindingCache'].map(name => `packages/engine/dist/web/${name}.js`),
  ...['AssetLease', 'AssetManager', 'assetManagerOwnerState', 'AssetRef', 'Bitmap', 'bitmapDisplayState', 'ByteReader', 'CancellationController',
    'coordinateInverse', 'diagnostics', 'displayBounds', 'displayCoordinates', 'displayHitState', 'displayHitTest', 'displayInputOperations', 'DisplayObject', 'DisplayObjectContainer',
    'displayTransform', 'displayTreeState', 'displayVisualState', 'EgretError', 'Event', 'EventDispatcher', 'frameCapture', 'frameCaptureCache', 'Graphics', 'imageFrameBudget',
    'index', 'Mesh2D', 'meshCaptureSnapshot', 'meshDisplayState', 'ownership', 'Scope', 'sequenceClip', 'SequencePlayer', 'Sprite', 'Stage',
    'textDisplayState', 'Texture', 'texturedFrameBudget', 'texturedFrameCapture'].map(name => `packages/runtime/dist/${name}.js`),
  // Exact current public literal closure; no additional entries or resolver aliases.
  ...['bitmapResourceSlot', 'bitmapBindingTicket', 'bitmapButton', 'sequencePlayback'].map(name => `packages/engine/dist/${name}.js`),
  ...['atlasFrameLayout', 'bitmapAtlasPlacement', 'ByteWriter', 'NineSliceGeometry2D', 'NineSliceBitmap', 'spriteSheet'].map(name => `packages/runtime/dist/${name}.js`),
  'packages/engine/node_modules/robust-predicates/index.js',
  ...['incircle', 'insphere', 'orient2d', 'orient3d', 'util'].map(name => `packages/engine/node_modules/robust-predicates/esm/${name}.js`),
]);
// M1.4 adds only the two concrete private extraction dependencies; the bound is unchanged.
allowedModules.add('packages/engine/dist/web/sharedRetentionLedger.js');
allowedModules.add('packages/engine/dist/web/sharedSubmissionStorage2D.js');
// M1.3 adds only the reviewed current literal closure, with the same 128-module bound.
for (const name of ["packages/contracts/dist/SharedGeometry2D.js","packages/contracts/dist/SharedMaterial2D.js","packages/contracts/dist/SharedRenderFrame2D.js","packages/engine/dist/rendering/packSharedDraws2D.js","packages/engine/dist/rendering/packSharedMeshGeometry3D.js","packages/engine/dist/rendering/prepareSharedDraws2D.js","packages/engine/dist/rendering/preparedSharedBatches2D.js","packages/engine/dist/rendering/sharedColor2D.js","packages/engine/dist/web/prepareSharedSubmission2D.js","packages/engine/dist/web/sharedB1.js","packages/engine/dist/web/sharedWebGPUOptions.js","packages/engine/dist/web/webgpuRetentionPool.js","packages/engine/dist/web/webgpuSharedMeshPass.js","packages/engine/dist/web/webgpuSharedPass.js","packages/engine/dist/web/webgpuSharedResolvePass.js","packages/runtime/dist/sharedFrameCapture.js"]) allowedModules.add(name);
// Preserve the historical scanner policy; only this exact M1.5 raw closure selects 133.
const historicalSourceModuleLimit = 128;
const m15SourceModuleLimit = 133;
const m15ModuleIdentities = new Map([
  ["packages/engine/dist/index.js", { bytes: 1358, sha256: "96afca247999dc46d1321ce15138fbe01fffde0aafbb76fb48440a09b67ca082" }],
  ["packages/engine/dist/rendering/copyMixedFrame2D.js", { bytes: 3818, sha256: "e7f1f60a683a5afe7e49fffa9294e53278c43910b1f0613ce1f50fa47f10468c" }],
  ["packages/engine/dist/web/webgpuRetentionPool.js", { bytes: 3300, sha256: "72531b85727976d7de55a5a7cbd4a68d16ab28ca4ab5b13b26eaf4157f901c48" }],
  ["packages/engine/dist/web/webgpuSharedResolvePass.js", { bytes: 1522, sha256: "eb5c2334da94a6e71970ab99df7a07932ab631b92641535215b889f8833cb2ef" }],
  ["packages/engine/dist/web/webgpuSharedPass.js", { bytes: 6534, sha256: "efc042e1867ff8e052babdb9f5c1205761d8f9c25b6f4597a7175fbe91dec199" }],
  ["packages/engine/dist/rendering/sharedColor2D.js", { bytes: 2455, sha256: "4e3c221cb075be46b90454719c04f3886bed2dd10fd048bdef5273ebda7962b0" }],
  ["packages/engine/dist/rendering/preparedSharedBatches2D.js", { bytes: 3326, sha256: "6690664da548935ae8a9406436b5719ea6a8681b00c16d788914bba38c3eb036" }],
  ["packages/engine/dist/web/prepareSharedSubmission2D.js", { bytes: 2433, sha256: "6c2952fa06328f3ed9cc34f1e3903e40168b5a43f0dbf19f40a5fc5764efdb19" }],
  ["packages/engine/dist/rendering/prepareSharedDraws2D.js", { bytes: 13524, sha256: "19db787c5805700203e8eb7f8f8c4e82fe3ceb03b320e905a3879081352a78d1" }],
  ["packages/engine/dist/web/sharedWebGPUOptions.js", { bytes: 3853, sha256: "8bcdf60791f837ef3a489807a0e7e75d7ef905dffc187ffb008ea1bcdcc70eb7" }],
  ["packages/runtime/dist/bitmapDisplayState.js", { bytes: 1066, sha256: "fd50bff484322b93d54755698a1928edd46526a1f8a57816928499fc36b9bd73" }],
  ["packages/runtime/dist/atlasFrameLayout.js", { bytes: 1991, sha256: "a1e35328e4f911087b80b268e0c82c71b620bc1837401fea0db8269febc95eee" }],
  ["packages/runtime/dist/texturedFrameBudget.js", { bytes: 1542, sha256: "f8287dcba0eeebcd898c055b62e1249754d2c121b09f8734a55aaf248c54f2c3" }],
  ["packages/runtime/dist/meshCaptureSnapshot.js", { bytes: 610, sha256: "65a2523739ba5ec960290fe217cc7dcaad58729438ccbf77663d7306d5c3bd56" }],
  ["packages/runtime/dist/frameCaptureCache.js", { bytes: 15981, sha256: "b041688739321426600fb1ad1a2dfd005ebcdca93d3e5beb90d2dab8219757f0" }],
  ["packages/runtime/dist/displayTransform.js", { bytes: 1258, sha256: "c508f3c99d02453c24ee705ec07af136ebb1591333fcab0be2537a27690a0e05" }],
  ["packages/runtime/dist/imageFrameBudget.js", { bytes: 1802, sha256: "f7b61124a43c7b9621698c03efbd9e565b83977e839a0e737afe1827d1d54ac0" }],
  ["packages/runtime/dist/textDisplayState.js", { bytes: 1185, sha256: "b61cab464a2c46a9bda0cec4d6dea3561c2588d675eef2bb8b80dab4bd332156" }],
  ["packages/runtime/dist/meshDisplayState.js", { bytes: 978, sha256: "867eeb0aed95cb6d28fafe3ab02560acaf428086c89df0d61da9313b2a63ef55" }],
  ["packages/runtime/dist/bitmapAtlasPlacement.js", { bytes: 1753, sha256: "55aa9193fd9cfa060e45b10ad02e7d60a3ee83fdafef9f67a80347de741e7cb2" }],
  ["packages/runtime/dist/assetManagerOwnerState.js", { bytes: 2888, sha256: "9db66146430152ab5a0d07f704d9b27f5daa70834981ac33b5e9eb1194de563a" }],
  ["packages/runtime/dist/displayHitTest.js", { bytes: 6873, sha256: "7ec9518b01bed802d0c254d13906c9920655b77d34626af17d0d87e0f5332196" }],
  ["packages/runtime/dist/displayVisualState.js", { bytes: 4036, sha256: "92dd463f12869fded4ca7cdf38e18ac4fdceff0809a6368ce48c6ca8e9110814" }],
  ["packages/runtime/dist/displayCoordinates.js", { bytes: 3352, sha256: "f2604e5359839916ae9cba2582ce896e069a69d013664b3e7ee95f85378df890" }],
  ["packages/runtime/dist/displayBounds.js", { bytes: 7900, sha256: "648a056edd70cbd8ffa2e6bb45f03e6e6c42f8f9a03708d52eaa227157786231" }],
  ["packages/runtime/dist/displayHitState.js", { bytes: 3388, sha256: "13da7621b9ff3091980084c5a8df9b8f86a80843d8eb097882c37d68068dd96c" }],
  ["packages/runtime/dist/displayTreeState.js", { bytes: 15727, sha256: "e0f8ab70550bfc4a879c29b475f2374bf342d831c643ee18cef8744fec1c79aa" }],
  ["packages/runtime/dist/ownership.js", { bytes: 6711, sha256: "a26b1fcd8232dc000ed45fc522784668cb5c69b35d187cea21419cf6b3da7b52" }],
  ["packages/engine/dist/surfaceOwnership.js", { bytes: 615, sha256: "e37243cf059c239fb8a56beddcd0020c2f9a0df80db1017012443e72748f75be" }],
  ["packages/engine/dist/bitmapButton.js", { bytes: 13700, sha256: "1e6540a6ad9c25749dda3d404df2571fd16a053be13849b89b1dda4d44237b77" }],
  ["packages/engine/dist/rendering/copyFrame2D.js", { bytes: 6229, sha256: "cea039426a697ebb5acd60b6c18d6d372299d339fce2cfe818caec6545dc5595" }],
  ["packages/engine/dist/rendering/prepareRectangles2D.js", { bytes: 11969, sha256: "c937d387f44241ce6d9d5c6f7fe28ce6e9fcf29e1dfdf0ad65197667aff11fd9" }],
  ["packages/engine/dist/rendering/prepareMixedDraws2D.js", { bytes: 3234, sha256: "b5925f98de56982a203a22529a45aa72604e18cb4083ce5e261a185594dc6feb" }],
  ["packages/engine/dist/rendering/preparedBatches2D.js", { bytes: 8234, sha256: "6f2ef1c01d8bef89ae3bc604ed961807532faf83010aee363edec6f8da5c5d48" }],
  ["packages/engine/node_modules/robust-predicates/esm/incircle.js", { bytes: 26758, sha256: "784e4c897b00289869c9a9e51e0281ac550853e399a8df664afaf29494fe85b5" }],
  ["packages/engine/node_modules/robust-predicates/esm/orient3d.js", { bytes: 13368, sha256: "6e122bc0c0b461d0cdf37e2caa458a823556630a20b044069e57391641acd97a" }],
  ["packages/engine/node_modules/robust-predicates/esm/orient2d.js", { bytes: 5281, sha256: "ba1af2b1ea71924fa2e0a3e50b8972d3a83ab9a9f406dd73e851c9763a8eb741" }],
  ["packages/contracts/dist/resources/sha256.js", { bytes: 5264, sha256: "076bd16070e02ce539aacb2e420c665eb62655431fa208e1293d09e6a86a939f" }],
  ["packages/engine/dist/rendering/prepareTexturedMesh2D.js", { bytes: 7492, sha256: "f7f1bde2bd2fadffc4acc7d9c4e2b779c76f5673023fa4e72c04e59d944a6cfe" }],
  ["packages/engine/dist/rendering/packedOrientation.js", { bytes: 340, sha256: "4f4b2c5125997952cf18cb5b4cfe655fe7d2ae4cb399a03bc633bf58261eae83" }],
  ["packages/engine/dist/rendering/packedPosition2D.js", { bytes: 573, sha256: "68258e7949e85b2b5c5771b1045e5261d63ff330e67c81e89e958a19773c0d16" }],
  ["packages/engine/dist/rendering/prepareImages2D.js", { bytes: 4494, sha256: "6dd60d19ca7e3da67baa42f31ebbbd88f2b3555e041092ae29c54fe5f8a00809" }],
  ["packages/engine/node_modules/robust-predicates/index.js", { bytes: 233, sha256: "1e26fb2e616a0fa84dadb3a15633d9743671884d82f1abb124e20292fd0ab86d" }],
  ["packages/engine/dist/rendering/imageFrameBudget.js", { bytes: 1625, sha256: "fc7e689d10b3827144609a8c8629e0d8e154f3e1ffaea2345efcf9241a76e6d9" }],
  ["packages/engine/dist/web/sharedRetentionLedger.js", { bytes: 17028, sha256: "ca080bdf2a99acc6a2485bd2df427b711d7f35913036702eac5103af80326858" }],
  ["packages/engine/dist/web/sharedSubmissionStorage2D.js", { bytes: 3778, sha256: "81c4c37de3347fbe762881c3f3f7108eda030027e5a3633600d6ab43309511e5" }],
  ["packages/engine/dist/rendering/packSharedDraws2D.js", { bytes: 3322, sha256: "2e10b9fc3defc1dad671a1540f99f8670852325bba4a080496a549c706068778" }],
  ["packages/runtime/dist/coordinateInverse.js", { bytes: 4201, sha256: "7cc84087cf8d2d8e92b3c5f1f560d8feacc4cea4cfe1f6511248a7bda86cd69a" }],
  ["packages/engine/dist/internal/mouseInputFactoryState.js", { bytes: 4356, sha256: "bfb0f749f658c2365e8d8a3605f0de8269e2d27cb978a689ef6f3af0b149bbe9" }],
  ["packages/contracts/dist/resources/manifestAdmission.js", { bytes: 16232, sha256: "39604bb6f530d229e576f0122e53d90d1b05270b2ae229322fe0f402e3d7c715" }],
  ["packages/engine/dist/web/webgpuTexturedPass.js", { bytes: 2090, sha256: "1afe7ae7e5162415d83c8f0dff55712ef19dc04192eab8bbf67f666f82718c47" }],
  ["packages/engine/dist/web/texturedWebGPUOptions.js", { bytes: 2744, sha256: "7457fc91a6dd24946d92d05a3c3a43c77d1b3ba2bf12feed1488b358ce7be8f2" }],
  ["packages/engine/dist/web/prepareTexturedSubmission2D.js", { bytes: 12690, sha256: "14c5baa8c8ac5bcb970173cea5e8094dd0ad3a5f4aa8b9650b252562d4a12434" }],
  ["packages/engine/dist/rendering/ownedPreparationFailure2D.js", { bytes: 1082, sha256: "2c762d5297f10925364d7ccffe77e654ddbc7238d48423c96675f1fa9fe6f338" }],
  ["packages/engine/dist/rendering/packTexturedMesh2D.js", { bytes: 5253, sha256: "2b2812f97af50299451c2205dbe9acbdf169bb846dc41b4b964dc081039f8733" }],
  ["packages/engine/dist/rendering/texturedPreparationBudget2D.js", { bytes: 5977, sha256: "eeb48a6701001b53159567a87a43bafbe1300810dc3ceee176a6b9e6c4090e9f" }],
  ["packages/engine/dist/rendering/prepareTexturedDraws2D.js", { bytes: 2645, sha256: "313d56811af0cccba4b7708b4eac3ea58f2fb8f42f71b2c17e652edaa6cf0e91" }],
  ["packages/engine/dist/rendering/admitTexturedFrame2D.js", { bytes: 6594, sha256: "9a1890c7402a5b92cd20b6d66b322a1e39e1ca729a6d53589d0042f193060c55" }],
  ["packages/engine/dist/web/webgpuLifetime.js", { bytes: 2256, sha256: "5e71a326c3cb4cb2cc76acd16ddf7b5c6390542e037364fd204fbcf041fdeb1f" }],
  ["packages/engine/dist/web/imageProjections2D.js", { bytes: 6102, sha256: "f7e8ec0c7d13cef5050bfc087297ea02c893775ad1773603b7ca643d64c8f14c" }],
  ["packages/engine/dist/web/webgpuImagePass.js", { bytes: 2380, sha256: "1dd032650be95493d088f47cdc7b56e153ed7b4fb7410feef2420b1b74a88ffe" }],
  ["packages/engine/dist/web/webgpuPass.js", { bytes: 6136, sha256: "07d77f142cc280b34eb85b7c0ab5c6f9f21b92e1be1696a6572436959f527bd2" }],
  ["packages/engine/dist/rendering/packImageVertices2D.js", { bytes: 3851, sha256: "d133289551bc3514cc3c5a42661abd32377371f480669bb13547fe7df9b0f30f" }],
  ["packages/engine/dist/rendering/preparedFrameCache2D.js", { bytes: 19934, sha256: "5e969f7d89fff8a9e7b5cb54daac0c027441c498890dee00d63d3ccc5d57f8e2" }],
  ["packages/engine/dist/web/webgpuBindingCache.js", { bytes: 8374, sha256: "74bcda1b46f7ec63e46cb9a412c97ee353763d21e1375053663567ebdcfabea3" }],
  ["packages/engine/node_modules/robust-predicates/esm/insphere.js", { bytes: 23925, sha256: "6782ad663d713b0da8d0710d88123a89ad388a6359c4bc81ed89ac5f682a12ea" }],
  ["packages/engine/dist/manifestResourceState.js", { bytes: 2387, sha256: "46662790efbb2fb844034da7782df72213f1fe8a46a404d6ad54f1b4396a0417" }],
  ["packages/engine/dist/web/webgpuSharedMeshPass.js", { bytes: 2753, sha256: "f178dcba92a940500b1f65f61e7f4ce1501cafb18e557106c8932983bb60f96f" }],
  ["packages/runtime/dist/Event.js", { bytes: 2393, sha256: "d6b60b43d3768d67424d907410c832594b554d870185c6f9d871f62853edce7a" }],
  ["packages/runtime/dist/Scope.js", { bytes: 4811, sha256: "773d15a4e82f268ea00a16f7bb1746705845364b5f0c1e2adeabbd8fd7707647" }],
  ["packages/runtime/dist/EgretError.js", { bytes: 508, sha256: "34693e8147cb8142260471f4f80897ebd59a409486026ab0931b6f7523cf2f9f" }],
  ["packages/runtime/dist/CancellationController.js", { bytes: 2112, sha256: "f2a27aee08b35e3ca17b7feb3f8166c3efc388e38d70f3f0c9b0ef13455e24c7" }],
  ["packages/engine/dist/startEngine.js", { bytes: 1275, sha256: "e250a877eeb8523473963504646e1c80c16ceb2c326b3f10788c0ee4550c23bc" }],
  ["packages/engine/dist/sequencePlayback.js", { bytes: 12959, sha256: "d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d" }],
  ["packages/engine/dist/mouseInput.js", { bytes: 18823, sha256: "57e636eab8f68308e868ca6b9fb249879d3e214507c25d912379c97461ece03f" }],
  ["packages/engine/dist/manifestAssetGroup.js", { bytes: 16305, sha256: "d30b5f3233bc6022de5ed7a581ad1f651825470efb6e19b7875f62a8a4514d50" }],
  ["packages/engine/dist/assetGroup.js", { bytes: 11120, sha256: "86627b3431b17f52b70877ef6d8e8e32713e61dfac9a930825e5b640c1a08a3c" }],
  ["packages/engine/dist/internal/textFieldFactoryState.js", { bytes: 1108, sha256: "fa69fb138980f01bfda9cf70214705a89f88de52435a8d59abe51a2e729c7568" }],
  ["packages/engine/dist/tween.js", { bytes: 12172, sha256: "e9a1f3588e21fed0e49285a2c89eb8ea48557759242cb2a3128890399426444d" }],
  ["packages/engine/dist/gameClock.js", { bytes: 9342, sha256: "fe76c89615b916f29e9287bff189d0d4b6da88936a94e3e9f058f9e19a4187ec" }],
  ["packages/engine/dist/internal/texturedFrameState.js", { bytes: 975, sha256: "1fb9cc9e234a5bfe5a914f613fbb0dac8019840343f5df02fa4ec3d78b900300" }],
  ["packages/engine/dist/closeHost.js", { bytes: 2440, sha256: "4a486e51396da8014487febfa29b465e8351023dd2169bd568f66f22383b83a7" }],
  ["packages/engine/dist/bitmapBindingTicket.js", { bytes: 7431, sha256: "3024b2d5e809b4e304796fd22ccc1bdaecad3a87080701d757bb64b822f81e42" }],
  ["packages/engine/dist/bitmapResourceSlot.js", { bytes: 10956, sha256: "27a628aa27688f37f789455d4be4e802a7d7e46bd88bd6279304a2f9cfd2b73e" }],
  ["packages/engine/dist/web/sharedB1.js", { bytes: 1116, sha256: "7b6b48c2abeb2c6a3f05c8a32d1d620e62f98dbe963e962fb9a6ce3e45ea1a85" }],
  ["packages/engine/dist/web/b1.js", { bytes: 1408, sha256: "ea0b12fe3693be7d3b1a2dc80c5768045e826e6278428ddca6e9006e66150c2e" }],
  ["packages/engine/dist/rendering/sceneFrame3D.js", { bytes: 10022, sha256: "c059e09ddf929c3f27c1bbe40fd3fba9237931b23ee2192bec66fb70d1a5bb80" }],
  ["packages/engine/dist/rendering/meshGeometry3D.js", { bytes: 5964, sha256: "a380f7b31f445d5d9ea341283d04159910158ea23a3dcc464fed6cb2167bae7b" }],
  ["packages/engine/dist/rendering/matrix4.js", { bytes: 4112, sha256: "3e816beceb6b79aed81bfbcdda765258a2da8ba6a0a12bcea42d151c87846f21" }],
  ["packages/contracts/dist/index.js", { bytes: 540, sha256: "f90933caf2643c0d4aa688eff5264160a7e931ee54b94c80163e1535e398ebce" }],
  ["packages/runtime/dist/index.js", { bytes: 1708, sha256: "c8cbc112cd5597e0729c34368954d74a94511638d3efab1fec78603e2f7007f5" }],
  ["packages/engine/dist/createEngineForProfile.js", { bytes: 3663, sha256: "f8ef8b3e4f154fa3da1ecab1d8253e83fe06f164f79709d6349d2c4821bcc4e7" }],
  ["packages/engine/dist/createEngine.js", { bytes: 1347, sha256: "dcb5a5185202248ebd401799bfe5e1fec9e5d4e9f6ad6c9d836145db2ebd243c" }],
  ["packages/engine/dist/Engine.js", { bytes: 21169, sha256: "61e9613b37d886859d2f11ed23b889684b24a0aba39b4d8f324fb2d5a003f933" }],
  ["packages/engine/dist/web/webgpuMeshPass.js", { bytes: 2743, sha256: "5cae311c66b2c5dbf6b27c9195c7e80eb759e96395ebaa03f49630ab30ac722f" }],
  ["packages/engine/dist/web/scene3d.js", { bytes: 532, sha256: "7d95b104c9e547fef5a6b479cc713ad753ce702286d1b4724ccf300725e0a14a" }],
  ["packages/engine/dist/rendering/scene3d.js", { bytes: 1324, sha256: "4d71aed1486089f3da2c59fcb3d81b8067008c63d1565e89b9d3f74d419b247c" }],
  ["packages/runtime/dist/EventDispatcher.js", { bytes: 7218, sha256: "573e357a5018379b244f1cc1cd26e51951b7b7ad4421e5c840a82031868abcb7" }],
  ["packages/runtime/dist/DisplayObject.js", { bytes: 7658, sha256: "0f8e18b08432736d24d93b71a75806bca09a84f07b7887b4b82677d33fccd44f" }],
  ["packages/runtime/dist/DisplayObjectContainer.js", { bytes: 8630, sha256: "f379a1da5a940710864a92b00349aa6d11b1de2b580b06f8f736c8131321a673" }],
  ["packages/runtime/dist/Stage.js", { bytes: 1170, sha256: "06a06d17ec70f30ddc16692eb2fc7434cbf609e07f05328c48e48b72674e864d" }],
  ["packages/engine/dist/rendering/packSharedMeshGeometry3D.js", { bytes: 4927, sha256: "06832d2e3abfad0803778177869b667530ca8f10642af02ed52292b76100e908" }],
  ["packages/engine/dist/web/WebGPUHost.js", { bytes: 187333, sha256: "edfd58cc7facae99f49541d906224bff1df9f32f49a26a630d2de70c5040752d" }],
  ["packages/engine/dist/rendering/packMeshGeometry3D.js", { bytes: 4841, sha256: "e0eb4837fbafa972a3b44ad114d839287842b5e64768b07adfdb4c2e8f7c5ac4" }],
  ["packages/engine/dist/rendering/projection3D.js", { bytes: 7347, sha256: "a270ffda327bc88043f5dfc79e25437940a1ad7c02a21d8459b30b995dc05cde" }],
  ["packages/contracts/dist/SharedRenderFrame2D.js", { bytes: 263, sha256: "73eb564457e0e23af0dbe6b0170c1707d52d4320706eb9e3b4dfee48c38aacf7" }],
  ["packages/contracts/dist/TexturedRenderFrame2D.js", { bytes: 200, sha256: "735bcac8275f424e48829e167f0cebd21ab30817755650c24f4ffd88fa9620a8" }],
  ["packages/contracts/dist/SharedGeometry2D.js", { bytes: 8593, sha256: "0b5ba021999903be40c9ba97206e07cb9f633ea3248efc33f7f0e9dbc3e74302" }],
  ["packages/contracts/dist/SharedMaterial2D.js", { bytes: 7517, sha256: "5eed01974eb0856bec1628f542c5fa759c123f0b25446504b16bb57856dcc5f6" }],
  ["packages/contracts/dist/TexturedGeometry2D.js", { bytes: 7696, sha256: "b3cdb387cb84078bf67769b8f6861cec4c904d256e79f0be151fdc8d38cc98aa" }],
  ["packages/contracts/dist/ImageData2D.js", { bytes: 5361, sha256: "08bd03f81a5b789a37d4ac84c647b59945273dd22a70305b9440ae66321fdfcd" }],
  ["packages/runtime/dist/spriteSheet.js", { bytes: 11824, sha256: "5f15aca4af6961cfd65f0e4c5243f7f81ccac9267056815d2401226b4d8dd00d" }],
  ["packages/runtime/dist/NineSliceBitmap.js", { bytes: 6749, sha256: "b30062f359b294fba6bf32421779f42c23c7bdc63b20df00d7f66379f56696f8" }],
  ["packages/runtime/dist/NineSliceGeometry2D.js", { bytes: 5487, sha256: "06373188c1f7abf86e593387c7ddc3c7ce745927be39bb06b6af840ddc404126" }],
  ["packages/runtime/dist/ByteWriter.js", { bytes: 7375, sha256: "19ab3ae8e6213fd83f915e5ea8dd4baf5e9d1960e021fcf4a12d39b934f2df76" }],
  ["packages/contracts/dist/resources/index.js", { bytes: 283, sha256: "2ea27b7090a99051f53c9a314142b34a01ac4f2831fce3435c0e7ccdc26335ea" }],
  ["packages/runtime/dist/displayInputOperations.js", { bytes: 3210, sha256: "650e7037c3024c2efefd39e32bbf2d946560fc0495a21db2797a762cd36992e4" }],
  ["packages/runtime/dist/SequencePlayer.js", { bytes: 3069, sha256: "1a5de3251dd6e98b63afa02b1a6e3105538c89671b27d32ba7a69c972c37715f" }],
  ["packages/runtime/dist/sequenceClip.js", { bytes: 8216, sha256: "87a1aaf749638e90f5ace7a01b8b604ad8994c1ece39593c963be678519b2925" }],
  ["packages/runtime/dist/Mesh2D.js", { bytes: 4604, sha256: "4e813aeb81bae9d15102aa383f8618d49767eb68046143eabbaddd71d5e52950" }],
  ["packages/runtime/dist/Bitmap.js", { bytes: 23075, sha256: "075a6f146714c98fec748aeabe52e3cf38d0213eb6a4f868d7fb846bb59196b8" }],
  ["packages/runtime/dist/Texture.js", { bytes: 7579, sha256: "fc0b399b96874a836c899d1bdae2fb48e70e7ad831fdfa5aeb32ebcecd32e00e" }],
  ["packages/runtime/dist/sharedFrameCapture.js", { bytes: 19247, sha256: "81358a25a54262dca6439fee2710cc9b4255f43bd3e9b1aad6894f675f3028bc" }],
  ["packages/runtime/dist/texturedFrameCapture.js", { bytes: 14352, sha256: "1f1520b64e3fbd174bd15cd803415c36ebfd932113d804188bdc6ee5c7c0452b" }],
  ["packages/runtime/dist/frameCapture.js", { bytes: 8393, sha256: "0ea5d699ed3dbaff63904ed5fcb0cb1b99f10b9c5357740e6186f7dc6a8f9e72" }],
  ["packages/runtime/dist/Graphics.js", { bytes: 1448, sha256: "c4637f250e7059ca46a313898d5afbbf283b2a164cbcabb9b3fd729fd69afeff" }],
  ["packages/runtime/dist/Sprite.js", { bytes: 464, sha256: "75d96bf10122f2371ee9dcb5369336bfc9295dba8a8d350f49af19745a67cd24" }],
  ["packages/runtime/dist/AssetRef.js", { bytes: 1218, sha256: "71f8764d8e825d946a308f6d75528bff9e2622780fb0625a8c662e202e46f024" }],
  ["packages/runtime/dist/AssetLease.js", { bytes: 2698, sha256: "db4e5a3f9c29554eca36480e9f4e42e4aa63008f0ada90b09a9302db5f097e0f" }],
  ["packages/runtime/dist/AssetManager.js", { bytes: 17534, sha256: "c84c30bf6487b95e176a20caec5f16828fb8a71374fc5428d123506913a46340" }],
  ["packages/runtime/dist/diagnostics.js", { bytes: 549, sha256: "32711ffa07c5bfcedc4775756d3180d1c6969086d082be623d6bd1a40eab796f" }],
  ["packages/runtime/dist/ByteReader.js", { bytes: 6839, sha256: "c8fd39e01476ff6961925a70caa90749cb808713bd89f8066f6340f0fdf2092a" }],
  ["packages/engine/node_modules/robust-predicates/esm/util.js", { bytes: 3606, sha256: "7b6ed8737cbee96fb413a312e6aaadd84ce9e9594847949f7b4bc8b3dac2cd14" }],
]);
assert.equal(m15ModuleIdentities.size, m15SourceModuleLimit, 'M1.5 source closure table is incomplete');
// Only these reviewed performance emissions supersede the retained M1.5 pins.
// The public closure membership, module ceiling and all native controls stay fixed.
const m12PerformanceModuleSuccessors = new Map([
  ["packages/engine/dist/web/WebGPUHost.js", { bytes: 187635, sha256: "c23ac47a7a5176ac91f56d70055ae2cf00b9bf22ba2ff2323b0e6019ec6853f3" }],
  ["packages/engine/dist/rendering/admitTexturedFrame2D.js", { bytes: 8673, sha256: "9f021d73fd9ba1db2feceb92e360bfe1003f92a2cbda563401bb3b9ce740f8b0" }],
  ["packages/engine/dist/rendering/prepareRectangles2D.js", { bytes: 20840, sha256: "401732bc01b2385b7aab673d518a4e44d3772beb77c57d63f9a6c46c0035841c" }],
  ["packages/engine/dist/rendering/prepareImages2D.js", { bytes: 4821, sha256: "82f93f3c93665c0d69d300b19b4e673779cd450727e784fb17d21c9d5af36589" }],
  ["packages/engine/dist/rendering/prepareTexturedMesh2D.js", { bytes: 7762, sha256: "28796314e7b0d1fc8acceaa6fbe6c8805040b531b4df0772c207acd0123429e3" }],
  ["packages/engine/dist/rendering/prepareTexturedDraws2D.js", { bytes: 4612, sha256: "b81bcaa01006be0fe1eb3f18d5a93e51f354e5de79923f7d918e3f9976e085c4" }],
  ["packages/engine/dist/rendering/preparedFrameCache2D.js", { bytes: 23608, sha256: "b28b5313bbf1ace8d741d686b72a59d3385c5b56591dcd363e68ab92a0bae294" }],
  ["packages/runtime/dist/texturedFrameCapture.js", { bytes: 15193, sha256: "987bfb7d35185b57ddbf3aed8a73933b2b6c2a5cc0fe4beb31f016feef6dbf85" }],
]);
assert.equal(m12PerformanceModuleSuccessors.size, 8);
for (const name of m12PerformanceModuleSuccessors.keys()) assert.ok(m15ModuleIdentities.has(name), 'Performance successor must retain M1.5 membership');
// M3 preserves the public closure and admits only this reviewed mouse compatibility emission.
const m33MouseCompatibilityModuleSuccessor = new Map([
  ["packages/engine/dist/mouseInput.js", { bytes: 19479, sha256: "6ec0b9d091c8d10a9e033e19575704795bb3636fd0fac1fd01960f43bd18476e" }],
]);
assert.equal(m33MouseCompatibilityModuleSuccessor.size, 1);
for (const name of m33MouseCompatibilityModuleSuccessor.keys()) assert.ok(m15ModuleIdentities.has(name), 'Mouse compatibility successor must retain M1.5 membership');
// M2 content adds build-plan helpers only in these two existing resource modules.
// Keep all historical pins, closure membership and native/request budgets unchanged.
const m21ContentModuleSuccessors = new Map([
  ["packages/contracts/dist/resources/index.js", { bytes: 348, sha256: "33e0fd9874ac06a2455af14a36b36e4caec75e318718c03755195961340d0ff2" }],
  ["packages/contracts/dist/resources/manifestAdmission.js", { bytes: 18139, sha256: "552bdb9c52612564614943667322b73892e7dbcb1b506a2f102d758da335e0f5" }],
]);
assert.equal(m21ContentModuleSuccessors.size, 2);
for (const name of m21ContentModuleSuccessors.keys()) assert.ok(m15ModuleIdentities.has(name), 'Content successor must retain M1.5 membership');
// M3.1 retains every historical identity and changes only this exact default closure.
// The optional UI assembly remains outside these four native entry points.
const m31UiModuleSuccessors = new Map([
  ["packages/engine/dist/Engine.js", { bytes: 22046, sha256: "42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239" }],
  ["packages/runtime/dist/Scope.js", { bytes: 4927, sha256: "f49aff05fbef7adde7e96bb36f968ea2cbfb64b2875ba10a6c07f9455d1307ab" }],
  ["packages/runtime/dist/displayTreeState.js", { bytes: 17075, sha256: "c7f4b2dc7895c9f14c532be2ef752fe54d7eeefba0716f2bf549e460864b0b0f" }],
  ["packages/runtime/dist/displayVisualState.js", { bytes: 4129, sha256: "a3740df92ab4e1e2b8807674f5e79f2d07bf39bba18a4d6150249c0a22f7b998" }],
  ["packages/runtime/dist/DisplayObject.js", { bytes: 7755, sha256: "581492976c85f3f8abb3c44039c06a4aa6fcf6e8153d4b174fa67d25249fd7aa" }],
  ["packages/runtime/dist/displayHitState.js", { bytes: 3481, sha256: "99cbbb70f8c223fbbdf59bf892c4a216f45effa38d22a50f7aa18c9b6adba4d6" }],
  ["packages/runtime/dist/DisplayObjectContainer.js", { bytes: 9277, sha256: "ec71cbae41ffda303f40ec404ede643e798c97bc3e421083873c5ad5ce15acc6" }],
]);
assert.equal(m31UiModuleSuccessors.size, 7);
for (const name of m31UiModuleSuccessors.keys()) assert.ok(m15ModuleIdentities.has(name), 'UI successor must retain M1.5 membership');
const m31UiModuleAdditions = new Map([
  ["packages/runtime/dist/ui/managedState.js", { bytes: 1630, sha256: "40e519e12a711fde43556cf6f15d02214448dfc5e037eb070c215bd811e4ff62" }],
  ["packages/engine/dist/internal/uiFactoryState.js", { bytes: 4420, sha256: "0a67b4189539e30baae0e7c7befc58fdeec6fdc357b352f93cecbd511cd06046" }],
]);
assert.equal(m31UiModuleAdditions.size, 2);
for (const name of m31UiModuleAdditions.keys()) assert.ok(!m15ModuleIdentities.has(name), 'UI addition must be a new exact dependency');
const m31SourceModuleLimit = 135;
const m22SequenceModuleSuccessors = new Map([
  [
    "packages/engine/dist/Engine.js",
    {
      "bytes": 23756,
      "sha256": "83050b49d34c654f94e887d676419cb43fa4653dff4d2105f3ba9cfd5744a6b9"
    }
  ],
  [
    "packages/engine/dist/sequencePlayback.js",
    {
      "bytes": 13139,
      "sha256": "2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e"
    }
  ],
  [
    "packages/engine/dist/internal/textFieldFactoryState.js",
    {
      "bytes": 1209,
      "sha256": "320085d19f32fdf1957b356709b114897364d0bd48f10fbe4c57da6d0d06468e"
    }
  ],
  [
    "packages/runtime/dist/assetManagerOwnerState.js",
    {
      "bytes": 4102,
      "sha256": "864a608dccaf23b7df91758416c229dc7f19afce1529214893648a6d6827608e"
    }
  ]
]);
const m22SequenceModuleAdditions = new Map([
  [
    "packages/engine/dist/sequenceTargetClaims.js",
    {
      "bytes": 993,
      "sha256": "de59c8d9d4057d7755da0756f835d316c64149330a8c7359cb6f9ec01d18b6ab"
    }
  ],
  [
    "packages/engine/dist/internal/sequenceControllerFactoryState.js",
    {
      "bytes": 3344,
      "sha256": "cdd2354efcfa58e4fcfe83705c123494b0a358a518a8c47f646f7becc8f63aa9"
    }
  ],
  [
    "packages/engine/dist/internal/contentFactoryState.js",
    {
      "bytes": 574,
      "sha256": "4c38c5b38105459e829be1398ff29d157b9ff8e942857b9194cef0830cc25fb1"
    }
  ]
]);
assert.equal(m22SequenceModuleSuccessors.size,4);
assert.equal(m22SequenceModuleAdditions.size,3);
for(const name of m22SequenceModuleSuccessors.keys())assert.ok(m15ModuleIdentities.has(name));
for(const name of m22SequenceModuleAdditions.keys())assert.ok(!m15ModuleIdentities.has(name));
const m22SourceModuleLimit = 138;
const currentModuleIdentities = new Map([...m15ModuleIdentities, ...m12PerformanceModuleSuccessors, ...m33MouseCompatibilityModuleSuccessor, ...m21ContentModuleSuccessors, ...m31UiModuleSuccessors, ...m31UiModuleAdditions, ...m22SequenceModuleSuccessors, ...m22SequenceModuleAdditions]);
assert.equal(currentModuleIdentities.size, m22SourceModuleLimit, 'M3.1 current closure table is incomplete');
for (const name of currentModuleIdentities.keys()) allowedModules.add(name);
function assertCurrentClosure() {
  assert.deepEqual([...served.keys()].map(url => url.slice(1)).sort(), [...currentModuleIdentities.keys()].sort(),
    'Current complete emitted closure membership changed');
}
const registryName = 'packages/engine/dist/internal/texturedFrameState.js';
const registrySourceName = 'packages/engine/src/internal/texturedFrameState.ts';
const descriptor = (path, body) => ({ path, bytes: body.length, sha256: hash(body) });
async function identity(path) {
  const absolute = await realpath(path); if (identities.has(absolute)) return identities.get(absolute);
  const body = await readFile(absolute); assert.ok(body.length <= 128 * 1024 * 1024); const value = descriptor(absolute, body);
  identities.set(absolute, value); return value;
}
function normalize(value) { return value.replaceAll('\\', '/'); }
function imported(source) {
  const names = [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\bfrom\s+)?['"]([^'"\r\n]+)['"]/g)].map(match => match[1]);
  names.push(...[...source.matchAll(/\bimport\s*\(\s*['"]([^'"\r\n]+)['"]\s*\)/g)].map(match => match[1])); return names;
}

// Derive requests from each actual selected map. A negative window loads both
// original Engine modules and selected copied scene/Host modules at distinct URLs.
// This reuses the collector's literal scanner; it does not admit new served code.
function deriveRequestCapacity(routes, publicMaps) {
  const modes=['baseline','N1','N2','N3','N4','N5','S1','S2','SN1'];
  assert.equal(JSON.stringify(publicMaps.map(row=>row.mode)),JSON.stringify(modes.slice(0,6)),'Fixed public maps required for request accounting');
  const perWindow=modes.map(mode=>{
    const copied=/^N[1-5]$/.test(mode),prefix=copied?'/copy/'+mode+'/':'/';
    const selected=publicMaps.find(row=>row.mode===(copied?mode:'baseline')).map,visited=new Set();
    function visit(url) {
      if(visited.has(url))return;
      const value=routes.get(url);assert.ok(value&&value.contentType==='text/javascript','Selected request route must already be served: '+url);
      assert.ok(!url.startsWith('/copy/')||url.startsWith(prefix),'Foreign negative copy in selected request closure');
      visited.add(url);
      for(const specifier of imported(value.body.toString('utf8'))){
        const relative=specifier.startsWith('./')||specifier.startsWith('../');
        const scope=copied&&url.startsWith(prefix)?selected.scopes?.[prefix]:undefined;
        const target=relative?new URL(specifier,'http://b1-request.invalid'+url).pathname:scope?.[specifier]??selected.imports[specifier];
        assert.ok(typeof target==='string'&&target.startsWith('/')&&!target.startsWith('//'),'Unmapped selected request dependency: '+specifier);
        visit(target);
      }
    }
    visit('/fixture.mjs');
    // The fixture's sole template import is this fixed private WGSL probe.
    visit(prefix+'packages/engine/dist/web/webgpuMeshPass.js');
    const modules=[...visited].filter(url=>/^\/(?:copy\/N[1-5]\/)?packages\//.test(url));
    const companions=[...visited].filter(url=>!modules.includes(url)).sort();
    assert.equal(JSON.stringify(companions),JSON.stringify(['/fixture.mjs','/oracle.mjs','/public-composition-oracle.mjs']),'Fixed companion closure required');
    const html=copied?'/index-'+mode+'.html':'/index.html';assert.equal(routes.get(html)?.contentType,'text/html');
    return {mode,modules:modules.length,companions:companions.length,html:1,favicon:1,routes:[html,...visited].sort(),limit:visited.size+2};
  });
  return {windows:modes.length,historical:1051,previous:1197,perWindow,current:perWindow.reduce((sum,row)=>sum+row.limit,0),
    basis:'One request per reachable selected URL in each fixed window, plus its HTML and one historical favicon allowance; not observed browser traffic.'};
}
function dependency(specifier, parent) {
  return resolveB1Dependency(specifier, parent, { repository, aliases });
}
async function collect(name) {
  const url = '/' + name; if (served.has(url)) return;
  assert.ok(allowedModules.has(name), `Unapproved public native dependency: ${name}`);
  assert.ok(currentModuleIdentities.has(name), `Unapproved current native dependency: ${name}`);
  assert.ok(served.size < m22SourceModuleLimit, 'Finite emitted closure exceeded');
  const path = resolve(repository, name), physical = await realpath(path);
  assert.ok(physical.startsWith(repository + sep), 'Selected dependency escaped repository');
  const body = await readFile(physical); assert.ok(body.length <= 1024 * 1024);
  const expected = currentModuleIdentities.get(name);
  assert.equal(body.length, expected.bytes, `Current emitted byte length changed: ${name}`);
  assert.equal(hash(body), expected.sha256, `Current emitted raw identity changed: ${name}`);
  served.set(url, { body, contentType: 'text/javascript', identity: descriptor(name, body) });
  const bound = await identity(physical); assert.equal(bound.bytes, body.length); assert.equal(bound.sha256, hash(body), 'Emitted bytes changed during capture');
  for (const child of imported(body.toString('utf8'))) await collect(dependency(child, name));
}
function shaderText(body) {
  const matches = [...body.toString('utf8').matchAll(/const MESH_SHADER = `([\s\S]*?)`;/g)]; assert.equal(matches.length, 1);
  assert.ok(!/[\\]|\$\{/.test(matches[0][1]), 'WGSL template escape requires a reviewed decoder');
  // JavaScript template values normalize line endings; no other decoding occurs.
  return matches[0][1].replace(/\r\n?/g, '\n');
}
function replaceOne(source, expression, alter) {
  const matches = [...source.matchAll(expression)]; assert.equal(matches.length, 1, 'Sensitivity patch must have exactly one target');
  const match = matches[0], changed = alter(match[0]); assert.notEqual(changed, match[0]);
  return { text: source.slice(0, match.index) + changed + source.slice(match.index + match[0].length), removed: match[0], inserted: changed };
}
async function prepareCopy(id) {
  const mesh = 'packages/engine/dist/web/webgpuMeshPass.js', host = 'packages/engine/dist/web/WebGPUHost.js';
  const target = ['N2', 'N3'].includes(id) ? host : mesh, original = served.get('/' + target).body;
  const source = original.toString('utf8'); let patch;
  if (id === 'N1') patch = replaceOne(source, /depthCompare: 'greater'/g, value => value.replace("'greater'", "'less'"));
  if (id === 'N2') patch = replaceOne(source, /for \(const draw of p\.scene\.draws\) \{\r?\n\s*const lease = this\.submissionBuffer\(record, bufferRequest\+\+, gate\), uniform = lease\.handle\.resource;\r?\n\s*touchedQueue = true;\r?\n\s*this\.write\(uniform\.buffer, 0, draw\.uniform\);/g,
    value => value.replace('draw.uniform', 'p.scene.draws[0].uniform'));
  if (id === 'N3') patch = replaceOne(source, /for \(const draw of p\.draws\) \{\r?\n\s*if \(draw\.kind === 'rect'\)\r?\n\s*encodeWebGPURectangles/g,
    value => value.replace('of p.draws)', 'of [...p.draws].reverse())'));
  if (id === 'N4') patch = replaceOne(source, /const MESH_SHADER = `[\s\S]*?`;/g, value => value.slice(0, -2) + '\negret_b1_invalid_wgsl_token\n`;');
  if (id === 'N5') patch = replaceOne(source, /result\.clip = draw\.mvp \* vec4<f32>\(position, 1\.0\);/g,
    value => value + '\n    result.clip.w = abs(result.clip.w);');
  assert.ok(patch); const altered = Buffer.from(patch.text); const manifest = []; let changedFiles = 0;
  for (const [url, value] of [...served.entries()].filter(([url]) => url.startsWith('/packages/engine/')).sort()) {
    const name = url.slice(1), body = name === target ? altered : value.body;
    const file = resolve(output, 'copies', id, name); await mkdir(dirname(file), { recursive: true }); await writeFile(file, body, { flag: 'wx' });
    const current = descriptor(name, body); manifest.push({ ...current, originalSHA256: value.identity.sha256 });
    if (current.sha256 !== value.identity.sha256) { changedFiles++; assert.equal(name, target); }
    served.set(`/copy/${id}${url}`, { body, contentType: 'text/javascript', identity: current });
  }
  assert.equal(changedFiles, 1);
  const receipt = { id, scope: 'Actual bounded emitted-product mutation', target, original: descriptor(target, original), altered: descriptor(target, altered),
    patch: { removed: patch.removed, inserted: patch.inserted }, changedFiles, copiedFiles: manifest, originalsEdited: false,
    expectedShaderSHA256: hash(Buffer.from(shaderText(id === 'N2' || id === 'N3' ? served.get('/' + mesh).body : altered))) };
  report.patches.push(receipt); await save(`patch-${id}.json`, receipt); return receipt;
}
function expectedCompilerConsole(event, window) {
  if (event.kind !== 'console' || event.level !== 'error' || window.mode !== 'N4' || window.status !== 'EXPECTED_COMPILATION_FAILURE') return false;
  // Admit only explicitly recorded shader/pipeline validation diagnostics in N4.
  return /WGSL|CreateShaderModule|shader module.*invalid|ShaderModule.*invalid|CreateRenderPipeline/i.test(event.text)
    && /error|invalid|pars|compil|validation/i.test(event.text);
}
async function retainWindow(window) {
  for (const frame of window.frames) if (frame.readback) {
    const bytes = Buffer.from(frame.readback.bytes); assert.ok(bytes.length <= 1024 * 1024, 'Unexpected raw capture exceeded its finite cap');
    const file = `${window.mode}-${frame.name}.rgba`; await writeFile(resolve(output, file), bytes, { flag: 'wx' });
    // This collector independently reinspects delivered raw bytes; fixture JSON is not pixel authority.
    const supplemental = window.stage === 'public-engine-composition';
    const negative = supplemental ? (window.mode === 'SN1' ? COMPOSITION_CONTROL : null) : NEGATIVES.find(value => value.id === window.mode);
    try {
      frame.collectorChecks = supplemental ? verifyCompositionPixels({ ...frame.readback, bytes }, frame.name, negative?.assertion ?? null)
        : verifyPixels({ ...frame.readback, bytes }, frame.name, negative?.assertion ?? null);
      assert.ok(!negative, 'Intended negative raw readback unexpectedly passed');
    } catch (error) {
      if (!negative || error.name !== (supplemental ? 'CompositionPixelAssertion' : 'PixelAssertion')) throw error;
      assert.equal(error.assertion, negative.assertion); assert.deepEqual(error.actual, [...negative.actual]);
      assert.deepEqual(frame.assertion?.actual, error.actual); assert.equal(frame.assertion?.assertion, error.assertion);
      frame.collectorAssertion = { name: error.name, assertion: error.assertion, x: error.x, y: error.y, expected: error.expected, actual: error.actual };
    }
    frame.readback = { ...frame.readback, bytes: undefined, raw: descriptor(file, bytes) };
  }
  await save(`window-${window.mode}.json`, window);
}
try {
  for (const path of [process.execPath, fileURLToPath(import.meta.url), resolve(companionDirectory, 'fixture.mjs'), resolve(companionDirectory, 'oracle.mjs'),
    resolve(companionDirectory, 'public-composition-oracle.mjs'),
    resolve(companionDirectory, 'registryProvenance.mjs'),
    playwrightMetadataPath, resolve(modulePath, 'index.mjs'), coreMetadataPath, compilerMetadataPath,
    resolve(repository, 'package.json'), resolve(repository, 'pnpm-lock.yaml'), resolve(repository, 'tsconfig.json'),
    ...['engine', 'contracts', 'runtime'].map(name => resolve(repository, `packages/${name}/package.json`))]) await identity(path);
  for (const name of entryNames) await collect(name);
  assertCurrentClosure();
  const packageExports = JSON.parse((await readFile(resolve(repository, 'packages/engine/package.json'))).toString('utf8')).exports;
  assert.deepEqual(packageExports['./scene3d'], { types: './dist/rendering/scene3d.d.ts', import: './dist/rendering/scene3d.js' });
  assert.deepEqual(packageExports['./webgpu/scene3d'], { types: './dist/web/scene3d.d.ts', import: './dist/web/scene3d.js' });
  const currentHost = await identity(resolve(repository, 'packages/engine/web/WebGPUHost.ts'));
  const historicalM12HostSource = { bytes: 104705, sha256: 'e9d172d17cc9f45109dae7b7038485d63d2c8e572efd88fb74af918812045d1d' };
  const m13HostSourceSuccessor = {"bytes":134474,"sha256":"73c33a00ed99283e1e4d70867308ebc3550c905df881a1d79c714d6c80bbe5a0"};
  const m15HostSourceSuccessor = {"bytes":189815,"sha256":"f84a1de242e8b3efefc1bb4ccb344cb02b659d355b512c071cfccf7c1943bf10"};
  const m12PerformanceHostSourceSuccessor = {"bytes":190117,"sha256":"f3d324c1357ecce0f2f4067d017d2ae88886c5e26fe7458df0b5d16e59fdfb93"};
  assert.equal(currentHost.bytes, m12PerformanceHostSourceSuccessor.bytes, 'Native acceptance binds the reviewed performance Host successor');
  assert.equal(currentHost.sha256, m12PerformanceHostSourceSuccessor.sha256);
  report.publicRoute = { entries: entryNames.slice(0, 3), packageExports: { './scene3d': packageExports['./scene3d'], './webgpu/scene3d': packageExports['./webgpu/scene3d'] },
    hostSource: currentHost, historicalM12HostSource, m13HostSourceSuccessor, m15HostSourceSuccessor, m12PerformanceHostSourceSuccessor,
    sourceCollection: { historicalModuleLimit: historicalSourceModuleLimit, m15ModuleLimit: m15SourceModuleLimit, currentModuleLimit: m22SourceModuleLimit, exactModules: [...currentModuleIdentities].map(([path, value]) => ({ path, ...value })) }, privateDiagnostic: 'packages/engine/dist/web/webgpuMeshPass.js', allowedModules: [...allowedModules].sort() };
  const emitted = [...served.values()].reduce((sum, value) => sum + value.body.length, 0); assert.ok(emitted <= 4 * 1024 * 1024);
  // Bind matching first-party source files without scanning unrelated repository files.
  for (const url of served.keys()) {
    const name = url.slice(1); let source;
    // Exact internal source exceptions preserve the retained registry policy.
    if (name === 'packages/engine/dist/internal/texturedFrameState.js') {
      source = 'packages/engine/src/internal/texturedFrameState.ts';
    } else if (name === 'packages/engine/dist/internal/textFieldFactoryState.js') {
      source = 'packages/engine/src/internal/textFieldFactoryState.ts';
    } else if (name === 'packages/engine/dist/internal/mouseInputFactoryState.js') {
      source = 'packages/engine/src/internal/mouseInputFactoryState.ts';
    } else if (name.startsWith('packages/engine/dist/')) {
      const tail = name.slice('packages/engine/dist/'.length).replace(/\.js$/, '.ts'); source = `packages/engine/${tail.includes('/') ? '' : 'src/'}${tail}`;
    } else if (/^packages\/(runtime|contracts)\/dist\//.test(name)) source = name.replace('/dist/', '/src/').replace(/\.js$/, '.ts');
    if (source === registrySourceName && name === registryName) {
      try { await identity(resolve(repository, source)); }
      catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        throw s04Incomplete('capture', null, { code: 'B1_REGISTRY_EXACT_SOURCE_MISSING', phase: 'capture',
          path: registrySourceName, field: 'originalSource.path' });
      }
    } else if (source) await identity(resolve(repository, source));
  }
  for (const name of ['packages/engine/node_modules/robust-predicates/package.json', 'packages/contracts/src/RenderFrame2D.ts']) await identity(resolve(repository, name));
  const meshSource = await readFile(resolve(repository, 'packages/engine/web/webgpuMeshPass.ts'));
  const baselineShader = shaderText(served.get('/packages/engine/dist/web/webgpuMeshPass.js').body);
  assert.equal(shaderText(meshSource), baselineShader, 'Source and emitted mesh shader differ');
  report.toolchain = { node: process.version, playwright: metadata.version, playwrightCore: coreMetadata.version,
    installedToolMetadata: { playwright: metadataInputs.get(await realpath(playwrightMetadataPath)),
      core: metadataInputs.get(await realpath(coreMetadataPath)) },
    typescript: '7.0.2', packageManagerPin: rootMetadata.packageManager, platform: process.platform, selectedChannel: 'msedge',
    browserExecutableIdentity: { status: 'UNBOUND', reason: 'No reliable exact channel-resolved executable identity was observed' },
    bundle: null, nativeModuleInput: 'exact frozen emitted ESM graph' };
  report.baselineShaderSHA256 = hash(Buffer.from(baselineShader));
  report.emittedModules = [...served.entries()].map(([url, value]) => ({ url, ...value.identity }));
  for (const value of NEGATIVES) await prepareCopy(value.id);
  for (const name of ['fixture.mjs', 'oracle.mjs', 'public-composition-oracle.mjs']) {
    const body = await readFile(resolve(companionDirectory, name)); served.set('/' + name, { body, contentType: 'text/javascript', identity: descriptor(name, body) });
  }
  const importMap = { imports: Object.fromEntries(Object.entries(aliases).map(([name, value]) => [name, '/' + value])),
    scopes: Object.fromEntries(NEGATIVES.map(({ id }) => [`/copy/${id}/`, { '#egret-textured-frame-state': `/copy/${id}/${registryName}` }])) };
  // One generated map serves both the real HTML and selected route validation.
  // Scoped copies use their own private registry; other aliases remain unchanged.
  const originalSource = { ...await identity(resolve(repository, registrySourceName)), path: registrySourceName };
  const originalEmitted = served.get('/' + registryName).identity;
  for (const mode of ['baseline', ...NEGATIVES.map(value => value.id)]) {
    const copied = mode !== 'baseline', url = (copied ? `/copy/${mode}/` : '/') + registryName;
    const patch = copied ? report.patches.find(value => value.id === mode) : null;
    const selected = served.get(url);
    const consumers = resolveRegistryConsumers(mode, importMap).map(value => ({ ...value,
      moduleCollected: served.has(value.importerUrl), registryServed: served.has(value.url) }));
    let capture;
    try {
      capture = await captureRegistryProvenance({ repository, output, selectedMode: mode,
        originalSource, originalEmitted,
        selectedEmitted: { ...selected.identity, path: copied ? `copies/${mode}/${registryName}` : registryName, url },
        copiedFile: patch ? patch.copiedFiles.find(value => value.path === registryName) : null,
        consumers, changedFiles: patch?.changedFiles ?? 0, patchTarget: patch?.target ?? null });
    } catch (error) {
      // Retain honest policy IO/setup failure; never assign an invented provenance code.
      const observationFailure = s04Fault(error);
      report.registryRecordingFailures.push({ phase: 'capture', mode, ...observationFailure });
      s04Incomplete('capture', mode, null, { observationFailure });
      continue;
    }
    report.registryProvenance.push(capture.registryProvenance); report.registryResolution.push(capture.resolverPolicy);
    report.registryCaptureObservations.push({ mode, observations: capture.captureObservations });
    if (patch) patch.registryProvenance = structuredClone(capture.registryProvenance);
    if (capture.accepted) registryCaptures.set(mode, capture);
    else s04Incomplete('capture', mode, capture.reason);
  }
  if (s04EnforcementIncomplete) throw s04FirstAbort;
  const html = Buffer.from(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>B1 WebGPU verification</title><script type="importmap">${JSON.stringify(importMap)}</script><script type="module">import * as fixture from '/fixture.mjs'; window.b1Fixture=fixture; window.fixtureReady=true;</script>`);
  served.set('/index.html', { body: html, contentType: 'text/html', identity: descriptor('index.html', html) });
  report.publicImportMaps = [{ mode: 'baseline', map: importMap, html: descriptor('index.html', html) }];
  for (const { id } of NEGATIVES) {
    const selectedMap = structuredClone(importMap);
    for (const name of ['@egret/engine/scene3d', '@egret/engine/webgpu/scene3d']) selectedMap.imports[name] = `/copy/${id}/${aliases[name]}`;
    const body = Buffer.from(html.toString('utf8').replace(JSON.stringify(importMap), JSON.stringify(selectedMap)));
    served.set(`/index-${id}.html`, { body, contentType: 'text/html', identity: descriptor(`index-${id}.html`, body) });
    report.publicImportMaps.push({ mode: id, map: selectedMap, html: descriptor(`index-${id}.html`, body) });
  }
  report.identitiesBefore = [...identities.values()]; await save('inputs.json', { original: report.identitiesBefore,
    emitted: report.emittedModules, html: descriptor('index.html', html), publicRoute: report.publicRoute, publicImportMaps: report.publicImportMaps,
    registryProvenance: report.registryProvenance,
    registryResolution: report.registryResolution, registryCaptureObservations: report.registryCaptureObservations,
    registryRecordingFailures: report.registryRecordingFailures, registryFailures: report.registryFailures,
    registryFailure: report.registryFailure, registryRecordingScope: report.registryRecordingScope });
  // Preserve historical 1051/1197 receipts; the current quota follows all nine
  // complete selected closures, including their original and copied URL union.
  const requestCapacity = deriveRequestCapacity(served, report.publicImportMaps);
  const requestLimit = requestCapacity.current;
  report.requestCapacity = requestCapacity;
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname, value = served.get(pathname);
    const observed = { method: request.method, pathname, status: value && request.method === 'GET' ? 200 : 404, bytes: value?.body.length ?? 0, sha256: value?.identity.sha256 ?? null };
    if (report.requests.length >= requestLimit) { report.requestOverflow = true; response.writeHead(429); response.end(); return; }
    report.requests.push(observed);
    if (!value || request.method !== 'GET') { response.writeHead(404); response.end('Unselected resource'); return; }
    response.writeHead(200, { 'content-type': value.contentType, 'cache-control': 'no-store' }); response.end(value.body);
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('error', error => { report.serverFailure ??= fault(error); });
  await bounded(observe(new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); })), operationDeadline, 'server-start');
  const origin = `http://127.0.0.1:${server.address().port}`; report.origin = origin;
  const playwright = await bounded(observe(import(pathToFileURL(resolve(modulePath, 'index.mjs')).href)), operationDeadline, 'tool-import');
  await bounded(acquire(playwright.chromium.launch({ channel: 'msedge', headless: true }), 'browser-launch', value => {
    browser = value;
    browser.on('disconnected', () => { if (!browserCloseRequested) report.unexpectedBrowserDisconnect = true; });
  }), operationDeadline, 'browser-launch');
  report.browserVersion = browser.version();
  await bounded(acquire(browser.newContext({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 }),
    'context-start', value => { context = value; }), operationDeadline, 'context-start');
  for (const mode of ['baseline', ...NEGATIVES.map(value => value.id), ...COMPOSITION_BASELINES, COMPOSITION_CONTROL.id]) {
    const supplemental = [...COMPOSITION_BASELINES, COMPOSITION_CONTROL.id].includes(mode);
    const page = await bounded(acquire(context.newPage(), `page-start-${mode}`, value => { openPages.add(value); }),
      operationDeadline, `page-start-${mode}`); const events = [];
    const record = value => { if (events.length >= 128) { report.browserEventOverflow = true; return; } events.push({ mode, ...value }); };
    page.on('pageerror', error => record({ kind: 'pageerror', text: error.message.slice(0, 16000) }));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') record({ kind: 'console', level: message.type(), text: message.text().slice(0, 16000), location: message.location() }); });
    page.on('requestfailed', request => record({ kind: 'requestfailed', text: request.failure()?.errorText ?? 'unknown', url: request.url() }));
    page.on('response', response => { if (response.status() >= 400) record({ kind: 'HTTP', text: `HTTP ${response.status()}`, url: response.url() }); });
    let window;
    try {
      await bounded(observe(page.goto(origin + (NEGATIVES.some(value => value.id === mode) ? `/index-${mode}.html` : '/index.html'))), operationDeadline, 'page-start');
      await bounded(observe(page.waitForFunction(() => window.fixtureReady === true)), operationDeadline, 'fixture-ready');
      if (supplemental) await bounded(observe(page.exposeFunction('b1CaptureSupplementaryScreenshot', async selectedMode => {
        assert.equal(selectedMode, mode, 'Supplementary screenshot request changed mode');
        const screenshot = `${mode}-supplement.png`;
        const body = await bounded(observe(page.screenshot()), operationDeadline, `screenshot-${mode}`);
        await writeFile(resolve(output, screenshot), body, { flag: 'wx' }); return descriptor(screenshot, body);
      })), operationDeadline, 'supplementary-screenshot-port');
      window = await bounded(observe(page.evaluate(value => window.b1Fixture.runWindow(value), { mode, deadline: operationDeadline })), operationDeadline, `native-${mode}`);
      // Preserve delivered raw bytes and failure metadata before inspecting identity.
      if (registryCaptures.has(mode)) window.registryPolicy = {
        scope: 'Retained selected resolver/filesystem policy; browser loads and requests are separate',
        registryProvenance: structuredClone(registryCaptures.get(mode).registryProvenance),
      };
      await retainWindow(window); (supplemental ? report.supplementaryWindows : report.windows).push(window);
      const expectedShader = mode === 'baseline' || supplemental ? report.baselineShaderSHA256 : report.patches.find(value => value.id === mode).expectedShaderSHA256;
      if (window.compilation) assert.equal(window.compilation.shaderSHA256, expectedShader, 'Native compiler shader identity differs from served bytes');
      for (const event of events) {
        event.expected = event.kind === 'console' && event.level === 'warning' ? false : expectedCompilerConsole(event, window);
        if (event.kind !== 'console' || event.level === 'error') assert.ok(event.expected, `Unexpected ${event.kind} in ${mode}: ${event.text}`);
      }
      if (window.status === 'UNSUPPORTED') {
        assert.equal(window.cleanup.failures.length, 0); assert.equal(window.uncaptured.length, 0);
        if (window.deviceAcquired) { assert.equal(window.cleanup.deviceDestroyed, true); assert.equal(window.cleanup.lossSettled, true); }
        if (mode !== 'baseline') throw Error('INCOMPLETE:capability changed after successful baseline');
        report.status = 'UNSUPPORTED'; break;
      }
      assert.ok(window.cleanup.failures.length === 0 && window.uncaptured.length === 0, 'Native API cleanup failed');
      assert.equal(window.cleanup.hostClosed, true); assert.equal(window.cleanup.hostSafe, true); assert.equal(window.cleanup.deviceDestroyed, true); assert.equal(window.cleanup.lossSettled, true);
      assert.equal(window.nativeQueue.submitAttempts, mode === 'baseline' ? 7 : mode === 'N4' ? 0 : 1, 'Actual native queue submit count differs from selected frame schedule');
      assert.equal(window.cleanup.queueObserverRestored, true); assert.equal(window.cleanup.canvasRetired, true);
      if (supplemental) {
        assert.equal(window.stage, 'public-engine-composition'); assert.equal(window.frames.length, 1);
        assert.equal(window.status, mode === 'SN1' ? 'EXPECTED_PIXEL_FAILURE' : 'PASSED');
        for (const key of ['engineClosed', 'scopeClosed', 'nodesDisposed', 'textureDisposed']) assert.equal(window.cleanup[key], true);
        assert.equal(window.authoring.cpuLogicalBytes, 480); assert.equal(window.authoring.sceneBytes, 240); assert.equal(window.authoring.uniformBytes, 128);
        if (mode !== 'SN1') assert.equal(window.frames[0].collectorChecks.comparisons, mode === 'S1' ? 6 : 8);
        else {
          const baseline = report.supplementaryWindows.find(value => value.mode === 'S2'); assert.ok(baseline, 'SN1 requires completed S2');
          const changed = structuredClone(baseline.authoring); changed.parent.clipRect = null;
          assert.deepEqual(window.authoring, changed, 'SN1 must omit only the parent local clip');
          assert.deepEqual(window.frames[0].collectorAssertion, { name: 'CompositionPixelAssertion', assertion: 'clip-outside', x: 33, y: 28,
            expected: [255, 255, 255, 255], actual: [255, 0, 255, 255] });
          assert.equal(window.controlBinding.changedInput, 'parent.clipRect');
        }
      } else if (mode === 'baseline') { assert.equal(window.status, 'PASSED'); assert.equal(window.frames.length, 7); assert.equal(window.frames.reduce((sum, value) => sum + value.checks.comparisons, 0), 8214); }
      else { assert.equal(window.status, mode === 'N4' ? 'EXPECTED_COMPILATION_FAILURE' : 'EXPECTED_PIXEL_FAILURE'); assert.equal(window.frames.length, mode === 'N4' ? 0 : 1); }
    } finally {
      try { await bounded(observe(page.close().then(() => { openPages.delete(page); })), closeDeadline, `page-close-${mode}`); }
      catch (error) { report.cleanupFailures.push(fault(error)); }
      // Recheck after page closure so late error events cannot evade the gate.
      for (const event of events) {
        event.expected = window ? expectedCompilerConsole(event, window) : false;
        if ((event.kind !== 'console' || event.level === 'error') && !event.expected) report.unexpectedBrowserEvent = true;
      }
      report.browserEvents.push(...events);
      // Reread even when native validation or retention rejected the selected window.
      if (registryCaptures.has(mode)) await s04Reread('window', mode, registryCaptures.get(mode));
    }
    if (s04EnforcementIncomplete) throw s04FirstAbort;
  }
  if (report.requestOverflow || report.browserEventOverflow) throw Error('INCOMPLETE:bounded observation quota exceeded');
  assert.equal(report.unexpectedBrowserEvent ?? false, false, 'Unexpected browser event after closure');
  if (report.status !== 'UNSUPPORTED' && !s04EnforcementIncomplete) { assert.equal(report.windows.length, 6); assert.equal(report.supplementaryWindows.length, 3); report.status = 'PASS'; }
} catch (error) {
  report.failure = fault(error);
  if (s04PrivateErrors.has(error)) report.status = 'INCOMPLETE';
  else if (isPrivateRegistryPolicyRefusal(error)) {
    report.privateRegistryPolicyFailure = { code: error.code, phase: error.phase, field: error.field, expected: error.expected, actual: error.actual };
    report.status = 'INCOMPLETE';
  } else report.status = /INCOMPLETE:|browserType\.launch|Executable doesn't exist|Target .* closed|page\.goto/.test(error.message ?? '') ? 'INCOMPLETE' : 'FAIL';
} finally {
  // Drain late acquisitions before deciding which handles this collector must close.
  for (const record of acquisitions) if (!record.settled) {
    try { await bounded(record.promise, closeDeadline, `late-${record.label}`); }
    catch (error) { report.cleanupFailures.push(fault(error)); }
  }
  for (const page of [...openPages]) {
    try { await bounded(observe(page.close().then(() => { openPages.delete(page); })), closeDeadline, 'remaining-page-close'); }
    catch (error) { report.cleanupFailures.push(fault(error)); }
  }
  try { if (context) await bounded(observe(context.close().then(() => {
    report.lifecycle.contextClosed = true; openPages.clear();
  })), closeDeadline, 'context-close'); } catch (error) { report.cleanupFailures.push(fault(error)); }
  try { if (browser) {
    browserCloseRequested = true;
    await bounded(observe(browser.close().then(() => { report.lifecycle.browserClosed = true; })), closeDeadline, 'browser-close');
  } } catch (error) { report.cleanupFailures.push(fault(error)); }
  try { if (server) { server.closeAllConnections(); for (const socket of sockets) socket.destroy(); await bounded(observe(new Promise((done, reject) => server.close(error => error ? reject(error) : done()))), closeDeadline, 'server-close'); report.lifecycle.serverClosed = sockets.size === 0; } } catch (error) { report.cleanupFailures.push(fault(error)); }
  try {
    const peers = [...pendingApiOperations];
    if (peers.length) await bounded(observe(Promise.allSettled(peers)), closeDeadline, 'collector-api-drain');
  } catch (error) { report.cleanupFailures.push(fault(error)); }
  if (report.serverFailure) report.cleanupFailures.push({ name: 'ServerFailure', message: report.serverFailure.message });
  if (report.unexpectedBrowserDisconnect) report.cleanupFailures.push({ name: 'BrowserDisconnected', message: 'Browser disconnected before collector-requested close' });
  report.lifecycle.pendingApiOperations = pendingApiOperations.size;
  report.lifecycle.unsettledAcquisitions = acquisitions.filter(value => !value.settled).map(value => value.label);
  report.lifecycle.standaloneCleanupObserved = pendingApiOperations.size === 0 && openPages.size === 0
    && report.lifecycle.unsettledAcquisitions.length === 0 && (!context || report.lifecycle.contextClosed)
    && (!browser || report.lifecycle.browserClosed) && (!server || report.lifecycle.serverClosed);
  const after = [];
  // Recheck all accepted retained selections before generic original assertions.
  // Earlier capture/window rejection does not suppress peer or final observations.
  for (const [mode, capture] of registryCaptures) await s04Reread('final', mode, capture);
  try { for (const [path, before] of identities) { const body = await readFile(path); const current = descriptor(path, body); after.push(current); assert.deepEqual(current, before, 'Original source/tool identity changed'); } report.lifecycle.identitiesStable = true; }
  catch (error) { report.cleanupFailures.push(fault(error)); }
  report.identitiesAfter = after;
  if (report.cleanupFailures.length || !report.lifecycle.identitiesStable || !report.lifecycle.standaloneCleanupObserved) report.status = 'INCOMPLETE';
  report.counts = { positiveFrames: report.windows.find(value => value.mode === 'baseline')?.frames.length ?? 0,
    counterexamples: report.windows.filter(value => value.mode !== 'baseline' && ['EXPECTED_PIXEL_FAILURE', 'EXPECTED_COMPILATION_FAILURE'].includes(value.status)).length,
    submittedFrames: report.windows.reduce((sum, value) => sum + value.frames.filter(frame => frame.rendered).length, 0), maximumSubmittedFrames: 11 };
  if (report.counts.submittedFrames > 11) { report.status = 'FAIL'; report.cleanupFailures.push({ message: 'Finite frame budget exceeded' }); }
  if (report.status === 'PASS' && (report.counts.positiveFrames !== 7 || report.counts.counterexamples !== 5 || report.counts.submittedFrames !== 11)) {
    report.status = 'FAIL'; report.cleanupFailures.push({ message: 'Complete seven-positive/five-counterexample receipt missing' });
  }
  report.supplementaryCounts = { stage: 'public-engine-composition', positiveFrames: report.supplementaryWindows.filter(value => value.status === 'PASSED').length,
    controls: report.supplementaryWindows.filter(value => value.mode === 'SN1' && value.status === 'EXPECTED_PIXEL_FAILURE').length,
    submittedFrames: report.supplementaryWindows.reduce((sum, value) => sum + value.frames.filter(frame => frame.rendered).length, 0),
    baselinePixelComparisons: report.supplementaryWindows.reduce((sum, value) => sum + (value.mode === 'SN1' ? 0 : value.frames.reduce((sum, frame) => sum + (frame.collectorChecks?.comparisons ?? 0), 0)), 0), maximumSubmittedFrames: 3 };
  if (report.supplementaryCounts.submittedFrames > 3 || (report.status === 'PASS' &&
      (report.supplementaryCounts.positiveFrames !== 2 || report.supplementaryCounts.controls !== 1 || report.supplementaryCounts.submittedFrames !== 3 || report.supplementaryCounts.baselinePixelComparisons !== 14))) {
    report.status = 'FAIL'; report.cleanupFailures.push({ message: 'Separate S1/S2/SN1 composition receipt incomplete' });
  }
  // Preserve count/cleanup diagnostics, then keep trusted provenance incompleteness final.
  if (s04EnforcementIncomplete || report.privateRegistryPolicyFailure) {
    report.statusBeforeRegistryIncomplete = report.status;
    report.status = 'INCOMPLETE';
  }
  report.elapsedMs = Date.now() - startedAt; report.exitCode = report.status === 'PASS' ? 0 : report.status === 'UNSUPPORTED' ? 2 : 1;
  try { await save('requests.json', report.requests); report.lifecycle.rawSaved = true; await save('result.json', report); }
  catch (error) { report.status = 'INCOMPLETE'; report.exitCode = 1; console.error(JSON.stringify({ evidenceSaveFailure: fault(error) })); }
  // Keep the emergency direct-exit timer if API cleanup remains unproven; never report PASS.
  if (report.lifecycle.standaloneCleanupObserved) clearTimeout(hardTimer);
  process.exitCode = report.exitCode;
  console.log(JSON.stringify({ status: report.status, exitCode: report.exitCode, counts: report.counts, lifecycle: report.lifecycle, failure: report.failure }));
}
}
await main();
