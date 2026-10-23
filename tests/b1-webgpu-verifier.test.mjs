import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, lstat, rm, symlink } from 'node:fs/promises';
import { dirname, join, parse, resolve, relative, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

// These paths become repository-relative when this candidate is adopted into tests/.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(repository, 'tools/verify-webgpu-b1.mjs');
const oracleUrl = new URL('../tools/b1-webgpu/oracle.mjs', import.meta.url);
const compositionOracleUrl = new URL('../tools/b1-webgpu/public-composition-oracle.mjs', import.meta.url);
let oraclePromise;
const activeRefusals = new Set();
function oracle() { return oraclePromise ??= import(oracleUrl.href); }

async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function workspace(t) {
  const base = await realpath(tmpdir());
  const relation = relative(await realpath(repository), base);
  assert.ok(relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation),
    'The selected temporary directory must be outside the repository before any fixture write');
  const root = await realpath(await mkdtemp(join(base, 'egret-b1-cli-')));
  t.after(async () => {
    assert.equal(activeRefusals.has(root), false, 'Unsettled direct CLI child: retain its owned files');
    await rm(root, { recursive: true, force: true });
  });
  const installed = join(root, 'installed-playwright');
  const core = join(installed, 'node_modules/playwright-core');
  await mkdir(core, { recursive: true });
  const marker = join(root, 'playwright-imported');
  const manifest = { name: 'playwright', version: '1.62.1', type: 'module', main: './index.mjs' };
  const coreManifest = { name: 'playwright-core', version: '1.62.1', type: 'module', main: './index.mjs' };
  await writeFile(join(installed, 'package.json'), JSON.stringify(manifest), { flag: 'wx' });
  await writeFile(join(core, 'package.json'), JSON.stringify(coreManifest), { flag: 'wx' });
  // This boundary tripwire has no browser API: premature installed-code import is a failure.
  const tripwire = `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'premature import', { flag: 'wx' });\nthrow Error('PLAYWRIGHT_IMPORT_TRIPWIRE');\n`;
  await writeFile(join(installed, 'index.mjs'), tripwire, { flag: 'wx' });
  await writeFile(join(core, 'index.mjs'), tripwire, { flag: 'wx' });
  const output = join(root, 'output');
  return { root, installed, core, marker, manifest, coreManifest, output,
    argv: ['--playwright', installed, '--channel', 'msedge', '--output', output] };
}
function environment(directory) {
  const env = { PATH: dirname(process.execPath), TEMP: directory, TMP: directory, TMPDIR: directory };
  if (process.platform === 'win32') {
    const drive = parse(directory).root.replace(/[\\/]$/, '');
    const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
    assert.ok(systemRoot, 'The Windows test needs its existing system directory');
    Object.assign(env, { SYSTEMROOT: systemRoot, WINDIR: systemRoot, HOMEDRIVE: drive,
      SYSTEMDRIVE: drive, HOMEPATH: directory.slice(drive.length), LOGONSERVER: '\\\\egret-test',
      USERDOMAIN: 'egret-test', USERNAME: 'egret-test', USERPROFILE: directory });
  } else Object.assign(env, { HOME: directory, LANG: 'C', LC_ALL: 'C' });
  return env; // No inherited Node test context, NODE_OPTIONS, loader or browser flags.
}
async function runCli(argv, directory) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cli, ...argv], {
      cwd: directory, env: environment(directory), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    activeRefusals.add(directory);
    const streams = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 };
    const ended = { stdout: false, stderr: false };
    let failure = null;
    const fail = error => { failure ??= error; child.kill(); };
    child.once('error', error => { failure ??= error; });
    for (const name of ['stdout', 'stderr']) {
      child[name].on('data', chunk => {
        const available = 256 * 1024 - sizes[name];
        if (available > 0) streams[name].push(chunk.subarray(0, available));
        sizes[name] += chunk.length;
        if (sizes[name] > 256 * 1024) fail(Error(`CLI ${name} exceeded its 256 KiB test bound`));
      });
      child[name].once('end', () => { ended[name] = true; });
      child[name].once('error', fail);
    }
    const deadline = setTimeout(() => fail(Error('CLI refusal exceeded 8 seconds')), 8000);
    const retirement = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(Error('CLI direct close did not settle within 12 seconds; retirement is unproven'));
    }, 12000);
    child.once('close', (status, signal) => {
      clearTimeout(deadline); clearTimeout(retirement);
      activeRefusals.delete(directory);
      if (failure) { rejectRun(failure); return; }
      if (!ended.stdout || !ended.stderr) { rejectRun(Error('CLI close lacked both stream EOFs')); return; }
      resolveRun({ status, signal, stdout: Buffer.concat(streams.stdout).toString('utf8'),
        stderr: Buffer.concat(streams.stderr).toString('utf8') });
    });
  });
}
async function refuses(w, argv, code, { outputMayExist = false } = {}) {
  const receipt = await runCli(argv, w.root);
  assert.equal(receipt.signal, null, 'Refusal must be a clean application exit');
  assert.equal(receipt.status, 1, 'Setup refusal must not report PASS or observed UNSUPPORTED');
  assert.match(receipt.stderr, new RegExp(`\\b${code}\\b`), 'The actual admission reason must be observable');
  assert.doesNotMatch(receipt.stdout + receipt.stderr, /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|PLAYWRIGHT_IMPORT_TRIPWIRE/);
  assert.equal(await exists(w.marker), false, 'Refusal must precede installed tool-code import');
  if (!outputMayExist) assert.equal(await exists(w.output), false, 'Refusal must not create the selected output');
}

const malformedOptions = [
  ['C01 missing options cannot fall through to a browser attempt', () => []],
  ['C02 a missing value is rejected as CLI input', w => w.argv.slice(0, 5)],
  ['C03 a duplicate option cannot replace the missing output', w => ['--playwright', w.installed, '--channel', 'msedge', '--channel', 'msedge']],
  ['C04 an unknown option cannot be treated as output', w => ['--playwright', w.installed, '--channel', 'msedge', '--unknown', w.output]],
  ['C05 extra options cannot introduce flags or a reduced schedule', w => [...w.argv, '--case', 'F1']],
  ['C07 a relative installed-tool path cannot depend on caller cwd', w => ['--playwright', 'installed-playwright', ...w.argv.slice(2)]],
  ['C08 a relative output cannot depend on caller cwd', w => [...w.argv.slice(0, 5), 'output']],
];
for (const [name, options] of malformedOptions) test(name, async t => {
  const w = await workspace(t); await refuses(w, options(w), 'CLI_OPTIONS_INVALID');
});
test('C06 an unapproved browser channel is refused before tool import', async t => {
  const w = await workspace(t), args = [...w.argv]; args[3] = 'chromium';
  await refuses(w, args, 'CHANNEL_UNSUPPORTED');
});
test('C09 existing output directory and caller sentinel remain intact', async t => {
  const w = await workspace(t); await mkdir(w.output);
  await writeFile(join(w.output, 'caller.txt'), 'caller bytes', { flag: 'wx' });
  await refuses(w, w.argv, 'OUTPUT_OWNERSHIP_INVALID', { outputMayExist: true });
  assert.deepEqual(await readdir(w.output), ['caller.txt']);
  assert.equal(await readFile(join(w.output, 'caller.txt'), 'utf8'), 'caller bytes');
});
test('C10 an existing output file is not removed or replaced', async t => {
  const w = await workspace(t); await writeFile(w.output, 'owned by caller', { flag: 'wx' });
  await refuses(w, w.argv, 'OUTPUT_OWNERSHIP_INVALID', { outputMayExist: true });
  assert.equal(await readFile(w.output, 'utf8'), 'owned by caller');
  assert.equal((await lstat(w.output)).isFile(), true);
});
test('C11 an absent repository child is refused before output creation', async t => {
  const w = await workspace(t), args = [...w.argv];
  const target = join(repository, 'tests', `.b1-refusal-${randomUUID()}`);
  assert.equal(await exists(target), false); args[5] = target;
  try { await refuses(w, args, 'OUTPUT_OWNERSHIP_INVALID'); }
  finally {
    // A buggy CLI-created repository tree is evidence, not an owned test fixture to delete.
    assert.equal(await exists(target), false, `Unexpected repository output is preserved: ${target}`);
  }
});
test('C12 dot-dot output spelling is refused without creating its normalized target', async t => {
  const w = await workspace(t); await mkdir(join(w.root, 'scratch'));
  const args = [...w.argv]; args[5] = `${w.root}${sep}scratch${sep}..${sep}output`;
  await refuses(w, args, 'OUTPUT_OWNERSHIP_INVALID');
});
test('C13 a symlink or Windows junction ancestor cannot confer output ownership', async t => {
  const w = await workspace(t), target = join(w.root, 'target'), link = join(w.root, 'alias');
  await mkdir(target); await writeFile(join(target, 'caller.txt'), 'untouched', { flag: 'wx' });
  await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  const args = [...w.argv]; args[5] = join(link, 'output');
  await refuses(w, args, 'OUTPUT_OWNERSHIP_INVALID');
  assert.deepEqual(await readdir(target), ['caller.txt']);
  assert.equal(await readFile(join(target, 'caller.txt'), 'utf8'), 'untouched');
  assert.equal((await lstat(link)).isSymbolicLink(), true);
});
const invalidMetadata = [
  ['C14 installed package identity is checked before import', 'playwright', { name: 'other-tool' }],
  ['C15 the installed Playwright version is checked before import', 'playwright', { version: '1.62.0' }],
  ['C16 the installed playwright-core version is checked before import', 'core', { version: '1.62.0' }],
];
for (const [name, owner, change] of invalidMetadata) test(name, async t => {
  const w = await workspace(t), directory = owner === 'core' ? w.core : w.installed;
  const manifest = owner === 'core' ? w.coreManifest : w.manifest;
  await writeFile(join(directory, 'package.json'), JSON.stringify({ ...manifest, ...change }));
  await refuses(w, w.argv, 'PLAYWRIGHT_METADATA_INVALID');
});
test('C17 missing core metadata is not deferred until trusted code import', async t => {
  const w = await workspace(t); await rm(join(w.core, 'package.json'));
  await refuses(w, w.argv, 'PLAYWRIGHT_METADATA_INVALID');
});
test('C18 valid option permutation reaches the actual metadata refusal', async t => {
  const w = await workspace(t);
  await writeFile(join(w.installed, 'package.json'), JSON.stringify({ ...w.manifest, version: '1.62.0' }));
  await refuses(w, ['--output', w.output, '--channel', 'msedge', '--playwright', w.installed], 'PLAYWRIGHT_METADATA_INVALID');
});

// These CPU bytes are hand-authored oracle inputs, never renderer-computed expected images.
function blackFrame(overrides = {}) {
  const bytes = new Uint8Array(16384);
  for (let index = 3; index < bytes.length; index += 4) bytes[index] = 255;
  return { width: 64, height: 64, bytes, format: 'rgba8unorm', sourceFormat: 'rgba8unorm',
    colorSpace: 'srgb', alphaMode: 'premultiplied', ...overrides };
}
function pixel(frame, x, y, rgba) { frame.bytes.set(rgba, 4 * (64 * y + x)); }
const authoredPoints = {
  F1: [[20, 24, [255, 0, 0, 255]], [12, 20, [0, 0, 255, 255]]],
  F2: [[20, 24, [255, 0, 0, 255]], [12, 20, [0, 0, 255, 255]]],
  F3: [[16, 16, [0, 255, 0, 255]], [48, 48, [0, 255, 0, 255]]],
  F4: [[22, 24, [255, 255, 255, 255]], [29, 30, [255, 0, 255, 255]], [31, 32, [0, 255, 0, 255]], [17, 18, [255, 0, 0, 255]], [10, 12, [0, 0, 255, 255]]],
  F5: [[22, 24, [255, 255, 255, 255]], [29, 30, [255, 255, 255, 255]], [31, 32, [0, 255, 0, 255]], [17, 18, [255, 0, 0, 255]], [10, 12, [0, 0, 255, 255]]],
  F6: [], F7: [],
};
function authoredFrame(id) {
  const frame = blackFrame();
  for (const [x, y, rgba] of authoredPoints[id]) pixel(frame, x, y, rgba);
  return frame;
}
function expectPixelFailure(api, run, expected) {
  assert.throws(run, error => {
    assert.ok(error instanceof api.PixelAssertion);
    assert.equal(error.name, 'PixelAssertion');
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(error[field], value);
    return true;
  });
}
test('O01 all seven literal frame inputs produce their independent comparison totals', async () => {
  const api = await oracle(); let total = 0;
  for (const [id, comparisons, exhaustive] of [
    ['F1', 3, false], ['F2', 3, false], ['F3', 4, false], ['F4', 6, false], ['F5', 6, false],
    ['F6', 4096, true], ['F7', 4096, true],
  ]) {
    const result = api.verifyPixels(authoredFrame(id), id);
    assert.deepEqual(result, { comparisons, selection: null, exhaustive });
    total += result.comparisons;
  }
  assert.equal(total, 8214);
});
test('O02 the final F6 pixel is checked rather than only named samples', async () => {
  const api = await oracle(), frame = blackFrame(); pixel(frame, 63, 63, [255, 0, 0, 255]);
  expectPixelFailure(api, () => api.verifyPixels(frame, 'F6'), {
    assertion: 'empty-black-reset', x: 63, y: 63, expected: [0, 0, 0, 255], actual: [255, 0, 0, 255],
  });
});
test('O03 F7 checks a wrong noncenter pixel during its exhaustive comparison', async () => {
  const api = await oracle(), frame = blackFrame(); pixel(frame, 0, 63, [0, 0, 255, 255]);
  expectPixelFailure(api, () => api.verifyPixels(frame, 'F7'), {
    assertion: 'behind-camera-all-black', x: 0, y: 63, expected: [0, 0, 0, 255], actual: [0, 0, 255, 255],
  });
});
test('O04 F7 reports its named center failure before the exhaustive loop', async () => {
  const api = await oracle(), frame = blackFrame(); pixel(frame, 32, 32, [255, 0, 0, 255]);
  expectPixelFailure(api, () => api.verifyPixels(frame, 'F7'), {
    assertion: 'behind-camera-center', x: 32, y: 32, expected: [0, 0, 0, 255], actual: [255, 0, 0, 255],
  });
});
test('O05 named negative selections distinguish all four authored wrong-color outcomes', async () => {
  const api = await oracle();
  for (const [id, assertion, x, y, expected, actual] of [
    ['F1', 'near-red', 20, 24, [255, 0, 0, 255], [0, 0, 0, 255]],
    ['F3', 'right-mvp', 48, 48, [0, 255, 0, 255], [0, 0, 0, 255]],
    ['F4', 'last-ui-rectangle', 31, 32, [0, 255, 0, 255], [255, 255, 255, 255]],
    ['F7', 'behind-camera-center', 32, 32, [0, 0, 0, 255], [255, 0, 0, 255]],
  ]) {
    const frame = authoredFrame(id); pixel(frame, x, y, actual);
    expectPixelFailure(api, () => api.verifyPixels(frame, id, assertion), { assertion, x, y, expected, actual });
  }
});
test('O06 unknown or other-frame named selections are refused rather than silently ignored', async () => {
  const api = await oracle();
  assert.throws(() => api.verifyPixels(blackFrame(), 'F6', 'unknown'), /UNKNOWN_NAMED_PIXEL_ASSERTION/);
  assert.throws(() => api.verifyPixels(authoredFrame('F1'), 'F1', 'right-mvp'), /UNKNOWN_NAMED_PIXEL_ASSERTION/);
});
test('O07 readback metadata refuses unsupported sizes, formats and encoding before comparison', async () => {
  const api = await oracle();
  for (const override of [{ width: 63 }, { height: 65 }, { format: 'bgra8unorm' },
    { sourceFormat: 'rgba16float' }, { colorSpace: 'display-p3' }, { alphaMode: 'straight' }]) {
    assert.throws(() => api.verifyPixels(blackFrame(override), 'F6'), /READBACK_METADATA_INVALID/);
  }
});
test('O08 short and extra byte buffers cannot produce partial pixel acceptance', async () => {
  const api = await oracle();
  for (const length of [16383, 16385]) {
    assert.throws(() => api.verifyPixels(blackFrame({ bytes: new Uint8Array(length) }), 'F6'), /READBACK_METADATA_INVALID/);
  }
});
test('O09 unknown and prototype frame names cannot select inherited sample tables', async () => {
  const api = await oracle();
  for (const id of ['F0', '__proto__', 'constructor']) {
    assert.throws(() => api.verifyPixels(blackFrame(), id), /READBACK_METADATA_INVALID/);
  }
});
test('O10 normalized RGBA bytes may originate from an admitted BGRA surface', async () => {
  const api = await oracle(), frame = authoredFrame('F1'); frame.sourceFormat = 'bgra8unorm';
  assert.deepEqual(api.verifyPixels(frame, 'F1'), { comparisons: 3, selection: null, exhaustive: false });
});
test('O11 every RGBA lane uses exact endpoint comparison including alpha', async () => {
  const api = await oracle();
  for (const actual of [[254, 0, 0, 255], [255, 1, 0, 255], [255, 0, 1, 255], [255, 0, 0, 254]]) {
    const frame = authoredFrame('F1'); pixel(frame, 20, 24, actual);
    expectPixelFailure(api, () => api.verifyPixels(frame, 'F1'), {
      assertion: 'near-red', x: 20, y: 24, expected: [255, 0, 0, 255], actual,
    });
  }
});
test('O12 a named-only check is distinct from the full exhaustive frame obligation', async () => {
  const api = await oracle(), frame = blackFrame(); pixel(frame, 63, 0, [0, 255, 0, 255]);
  assert.deepEqual(api.verifyPixels(frame, 'F7', 'behind-camera-center'), {
    comparisons: 1, selection: 'behind-camera-center', exhaustive: false,
  });
  expectPixelFailure(api, () => api.verifyPixels(frame, 'F7'), {
    assertion: 'behind-camera-all-black', x: 63, y: 0, expected: [0, 0, 0, 255], actual: [0, 255, 0, 255],
  });
});

function authoredComposition(id) {
  const frame = blackFrame();
  for (const [x, y, rgba] of authoredPoints.F4) pixel(frame, x, y, rgba);
  if (id === 'S2') {
    pixel(frame, 29, 28, [255, 0, 255, 255]);
    pixel(frame, 33, 28, [255, 255, 255, 255]);
  }
  return frame;
}
test('S01 the separate S1/S2 oracle uses six/eight literal comparisons', async () => {
  const api = await import(compositionOracleUrl.href);
  assert.deepEqual(api.COMPOSITION_BASELINES, ['S1', 'S2']);
  assert.deepEqual(api.verifyCompositionPixels(authoredComposition('S1'), 'S1'), { comparisons: 6, selection: null, exhaustive: false });
  assert.deepEqual(api.verifyCompositionPixels(authoredComposition('S2'), 'S2'), { comparisons: 8, selection: null, exhaustive: false });
});
test('S02 SN1 selects clip-outside first and requires its assigned magenta literal', async () => {
  const api = await import(compositionOracleUrl.href), frame = authoredComposition('S2');
  pixel(frame, 33, 28, [255, 0, 255, 255]);
  // An unrelated wrong pixel cannot take priority over the named SN1 witness.
  pixel(frame, 22, 24, [0, 0, 0, 255]);
  assert.throws(() => api.verifyCompositionPixels(frame, 'S2', 'clip-outside'), error => {
    assert.ok(error instanceof api.CompositionPixelAssertion);
    assert.equal(error.assertion, 'clip-outside'); assert.equal(error.x, 33); assert.equal(error.y, 28);
    assert.deepEqual(error.expected, [255, 255, 255, 255]); assert.deepEqual(error.actual, [255, 0, 255, 255]); return true;
  });
});
test('S03 S2 also checks the independently authored inside clip pixel', async () => {
  const api = await import(compositionOracleUrl.href), frame = authoredComposition('S2'); pixel(frame, 29, 28, [255, 255, 255, 255]);
  assert.throws(() => api.verifyCompositionPixels(frame, 'S2'), error => error.assertion === 'clip-inside' && error.x === 29 && error.y === 28);
});
test('S04 supplementary oracle refuses malformed metadata and unknown named assertions', async () => {
  const api = await import(compositionOracleUrl.href);
  for (const override of [{ width: 63 }, { height: 65 }, { bytes: new Uint8Array(16383) }, { bytes: new Uint8Array(16385) },
    { format: 'bgra8unorm' }, { sourceFormat: 'rgba16float' }, { colorSpace: 'display-p3' }, { alphaMode: 'straight' }]) {
    assert.throws(() => api.verifyCompositionPixels({ ...authoredComposition('S1'), ...override }, 'S1'), /COMPOSITION_READBACK_METADATA_INVALID/);
  }
  for (const name of ['SN1', 'F1', '__proto__', 'constructor']) assert.throws(() => api.verifyCompositionPixels(blackFrame(), name), /COMPOSITION_READBACK_METADATA_INVALID/);
  assert.throws(() => api.verifyCompositionPixels(authoredComposition('S1'), 'S1', 'clip-outside'), /COMPOSITION_NAMED_ASSERTION_INVALID/);
});
test('S05 ordinary native fixture factory imports use only the exact public ports', async () => {
  const source = await readFile(join(repository, 'tools/b1-webgpu/fixture.mjs'), 'utf8');
  for (const name of ['@egret/engine', '@egret/engine/scene3d', '@egret/engine/webgpu/scene3d']) assert.ok(source.includes(`import('${name}')`));
  assert.doesNotMatch(source, /getBuiltinB1Protocol|createB1WebGPUHost|createMatrix4|import\([^\n]*(?:meshGeometry3D|matrix4|ImageData2D|web\/b1)\.js/);
  assert.match(source, /import\(`\$\{base\}\/packages\/engine\/dist\/web\/webgpuMeshPass\.js`\)/);
});
test('S06 collector pins the current Host and retains both schedules separately', async () => {
  const source = await readFile(cli, 'utf8');
  const historical = source.match(/^  const historicalM12HostSource = (\{[^\n]+\});$/m);
  const current = source.match(/^  const m13HostSourceSuccessor = (\{[^\n]+\});$/m);
  assert.ok(historical && current, 'Both exact Host identity declarations are retained');
  // Evaluate only these two bounded metadata literals, never the native collector.
  const identities = runInNewContext(historical[0] + '\n' + current[0] + '\n({historicalM12HostSource,m13HostSourceSuccessor})', {}, { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(identities)), {
    historicalM12HostSource: { bytes: 104705, sha256: 'e9d172d17cc9f45109dae7b7038485d63d2c8e572efd88fb74af918812045d1d' },
    m13HostSourceSuccessor: { bytes: 134474, sha256: '73c33a00ed99283e1e4d70867308ebc3550c905df881a1d79c714d6c80bbe5a0' },
  });
  const successor = source.match(/^  const m15HostSourceSuccessor = (\{[^\n]+\});$/m);
  assert.ok(successor, 'The historical M1.5 Host successor remains explicit');
  assert.deepEqual(JSON.parse(successor[1]), { bytes: 189815, sha256: 'f84a1de242e8b3efefc1bb4ccb344cb02b659d355b512c071cfccf7c1943bf10' });
  const performance = source.match(/^  const m12PerformanceHostSourceSuccessor = (\{[^\n]+\});$/m);
  assert.ok(performance, 'The reviewed performance Host successor must be explicit');
  const selected = JSON.parse(performance[1]);
  const currentHost = await readFile(join(repository, 'packages/engine/web/WebGPUHost.ts'));
  assert.deepEqual(selected, { bytes: currentHost.length, sha256: createHash('sha256').update(currentHost).digest('hex') });
  assert.match(source, /assert\.equal\(currentHost\.bytes, m12PerformanceHostSourceSuccessor\.bytes,/);
  assert.match(source, /assert\.equal\(currentHost\.sha256, m12PerformanceHostSourceSuccessor\.sha256\)/);
  assert.match(source, /allowedModules\.has\(name\)/);
  assert.match(source, /maximumSubmittedFrames: 11/); assert.match(source, /maximumSubmittedFrames: 3/);
  assert.match(source, /baselinePixelComparisons !== 14/); assert.match(source, /window\.frames\.reduce\([^\n]*8214/);
});

async function emittedClosurePolicy({ selectedReadFile = readFile } = {}) {
  const source = await readFile(cli, 'utf8');
  const start = source.indexOf('const aliases = '), end = source.indexOf('function shaderText(body)');
  assert.ok(start >= 0 && end > start, 'The selected finite collector source must exist');
  const { resolveB1Dependency } = await import(pathToFileURL(join(repository, 'tools/b1-webgpu/registryProvenance.mjs')).href);
  const served = new Map();
  // Evaluate only the verifier's policy declarations and collector, never emitted SDK code or main().
  const policy = runInNewContext(source.slice(start, end) + '\n({ aliases, entryNames, allowedModules, m15ModuleIdentities, m12PerformanceModuleSuccessors, currentModuleIdentities, historicalSourceModuleLimit, m15SourceModuleLimit, m31SourceModuleLimit, m22SourceModuleLimit, m22SequenceModuleSuccessors, m22SequenceModuleAdditions, assertCurrentClosure, collect, deriveRequestCapacity:typeof deriveRequestCapacity==="function"?deriveRequestCapacity:undefined })', {
    repository: await realpath(repository), sep, assert, resolve, readFile: selectedReadFile, realpath, resolveB1Dependency, URL,
    served, identities: new Map(), hash: body => createHash('sha256').update(body).digest('hex'),
  }, { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(policy.aliases)), {
    '#egret-textured-frame-state': 'packages/engine/dist/internal/texturedFrameState.js',
    '@egret/contracts': 'packages/contracts/dist/index.js', '@egret/contracts/resources': 'packages/contracts/dist/resources/index.js', '@egret/runtime': 'packages/runtime/dist/index.js',
    '@egret/engine': 'packages/engine/dist/index.js', '@egret/engine/scene3d': 'packages/engine/dist/rendering/scene3d.js',
    '@egret/engine/webgpu/scene3d': 'packages/engine/dist/web/scene3d.js',
    'robust-predicates': 'packages/engine/node_modules/robust-predicates/index.js',
  });
  assert.deepEqual(Array.from(policy.entryNames), [
    'packages/engine/dist/index.js', 'packages/engine/dist/rendering/scene3d.js',
    'packages/engine/dist/web/scene3d.js', 'packages/engine/dist/web/webgpuMeshPass.js',
  ]);
  assert.equal(policy.historicalSourceModuleLimit, 128);
  assert.equal(policy.m15SourceModuleLimit, 133);
  assert.equal(policy.m15ModuleIdentities.size, 133);
  assert.equal(policy.m31SourceModuleLimit, 135);
  assert.equal(policy.m22SourceModuleLimit, 137);
  assert.equal(policy.currentModuleIdentities.size, 137);
  assert.deepEqual([...policy.m12PerformanceModuleSuccessors.keys()].sort(), ["packages/engine/dist/rendering/admitTexturedFrame2D.js","packages/engine/dist/rendering/prepareImages2D.js","packages/engine/dist/rendering/prepareRectangles2D.js","packages/engine/dist/rendering/prepareTexturedDraws2D.js","packages/engine/dist/rendering/prepareTexturedMesh2D.js","packages/engine/dist/rendering/preparedFrameCache2D.js","packages/engine/dist/web/WebGPUHost.js","packages/runtime/dist/texturedFrameCapture.js"]);
  for (const [name, successor] of policy.m12PerformanceModuleSuccessors) {
    assert.ok(policy.m15ModuleIdentities.has(name), 'A successor cannot add a module');
    assert.notEqual(successor.sha256, policy.m15ModuleIdentities.get(name).sha256);
    assert.deepEqual(policy.currentModuleIdentities.get(name), successor);
  }
  assert.equal(policy.m15ModuleIdentities.get('packages/engine/dist/web/WebGPUHost.js').sha256, 'edfd58cc7facae99f49541d906224bff1df9f32f49a26a630d2de70c5040752d');
  assert.match(source, /served\.size < m22SourceModuleLimit/);
  assert.match(source, /body\.length <= 1024 \* 1024/);
  assert.match(source, /emitted <= 4 \* 1024 \* 1024/);
  return { ...policy, served };
}

test('S07 the finite native collector admits the actual current emitted public closure', async t => {
  const policy = await emittedClosurePolicy();
  for (const entry of policy.entryNames) await policy.collect(entry);
  const bytes = [...policy.served.values()].reduce((sum, value) => sum + value.body.length, 0);
  policy.assertCurrentClosure();
  assert.equal(policy.served.size, 137); assert.ok(bytes <= 4 * 1024 * 1024);
  t.diagnostic(`Actual emitted closure: ${policy.served.size} modules, ${bytes} bytes; SDK code was read, never evaluated`);
});

test('S08 the finite native collector still refuses an unrelated emitted module', async () => {
  const policy = await emittedClosurePolicy();
  const unrelated = 'packages/engine/dist/web/BrowserTextureProvider.js';
  assert.ok((await readFile(join(repository, unrelated))).length > 0, 'The refused module really exists');
  assert.equal(policy.allowedModules.has(unrelated), false);
  await assert.rejects(policy.collect(unrelated), error => {
    assert.equal(error.message, `Unapproved public native dependency: ${unrelated}`); return true;
  });
  assert.equal(policy.served.size, 0, 'Refused code must not enter the served closure');
});

async function completeCurrentClosure(policy = undefined) {
  const current = policy ?? await emittedClosurePolicy();
  for (const entry of current.entryNames) await current.collect(entry);
  current.assertCurrentClosure();
  assert.equal(current.served.size, 137);
  return current;
}

test('S09 the actual 137-module closure cannot admit a 138th real file even after a local allowlist mutation', async () => {
  const policy = await completeCurrentClosure();
  const extra = 'packages/engine/dist/web/BrowserTextureProvider.js';
  const body = await readFile(join(repository, extra));
  assert.equal(policy.allowedModules.has(extra), false);
  assert.equal(policy.currentModuleIdentities.has(extra), false);
  const failures = [];
  try {
    // This test-owned policy mutation reaches the independent count guard with a real file.
    policy.allowedModules.add(extra);
    policy.currentModuleIdentities.set(extra, { bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
    await assert.rejects(policy.collect(extra), error => error.message === 'Finite emitted closure exceeded');
    assert.equal(policy.served.size, 137);
    assert.equal(policy.served.has('/' + extra), false);
  } catch (cause) {
    failures.push(cause);
  } finally {
    for (const restore of [
      () => policy.allowedModules.delete(extra),
      () => policy.currentModuleIdentities.delete(extra),
    ]) {
      try { restore(); } catch (cause) { failures.push(cause); }
    }
  }
  try { policy.assertCurrentClosure(); } catch (cause) { failures.push(cause); }
  try { await completeCurrentClosure(); } catch (cause) { failures.push(cause); }
  if (failures.length) throw new AggregateError(failures, 'B1 module ceiling refusal/restoration');
});

test('S10 a same-length changed emitted byte is refused before capture and exact originals still pass', async () => {
  const target = 'packages/engine/dist/index.js';
  const original = await readFile(join(repository, target));
  await completeCurrentClosure();
  let altered = true;
  const failures = [];
  try {
    const policy = await emittedClosurePolicy({ selectedReadFile: async (...args) => {
      const value = await readFile(...args);
      if (!altered || resolve(args[0]) !== resolve(repository, target)) return value;
      const copy = Buffer.from(value);
      copy[0] ^= 1;
      assert.equal(copy.length, original.length);
      return copy;
    } });
    await assert.rejects(policy.collect(target), error => {
      assert.equal(error.code, 'ERR_ASSERTION');
      assert.match(error.message, /^Current emitted raw identity changed: packages\/engine\/dist\/index\.js(?:\r?\n|$)/);
      return true;
    });
    assert.equal(policy.served.size, 0);
  } catch (cause) {
    failures.push(cause);
  } finally {
    altered = false;
  }
  try { assert.deepEqual(await readFile(join(repository, target)), original); } catch (cause) { failures.push(cause); }
  try { await completeCurrentClosure(); } catch (cause) { failures.push(cause); }
  if (failures.length) throw new AggregateError(failures, 'B1 raw identity refusal/restoration');
});

test('S11 a missing reachable resources alias refuses the actual graph and restoration passes', async () => {
  const policy = await completeCurrentClosure();
  const name = '@egret/contracts/resources', original = policy.aliases[name];
  const failures = [];
  try {
    policy.served.clear();
    delete policy.aliases[name];
    await assert.rejects(policy.collect(policy.entryNames[0]), error =>
      error.message === 'Unsupported emitted dependency @egret/contracts/resources');
  } catch (cause) {
    failures.push(cause);
  } finally {
    for (const restore of [
      () => { policy.aliases[name] = original; },
      () => policy.served.clear(),
    ]) {
      try { restore(); } catch (cause) { failures.push(cause); }
    }
  }
  try { await completeCurrentClosure(policy); } catch (cause) { failures.push(cause); }
  try { await completeCurrentClosure(); } catch (cause) { failures.push(cause); }
  if (failures.length) throw new AggregateError(failures, 'B1 resource alias refusal/restoration');
});

async function requestQuotaFixture() {
  const policy=await completeCurrentClosure(),source=await readFile(cli,'utf8'),{NEGATIVES}=await oracle();
  const hash=body=>createHash('sha256').update(body).digest('hex'),descriptor=(path,body)=>({path,bytes:body.length,sha256:hash(body)}),report={patches:[]};
  const begin=source.indexOf('function shaderText(body)'),end=source.indexOf('function expectedCompilerConsole(event, window)',begin);
  // Execute only the real copy preparation with metadata write ports. Product
  // bytes are never evaluated, and no copy is written into the repository.
  const prepare=runInNewContext(source.slice(begin,end)+'\nprepareCopy',{served:policy.served,report,assert,Buffer,hash,descriptor,resolve,dirname,
    output:join(tmpdir(),'egret-b1-request-metadata'),mkdir:async()=>{},writeFile:async()=>{},save:async()=>{}},{timeout:1000});
  for(const {id}of NEGATIVES)await prepare(id);
  for(const name of ['fixture.mjs','oracle.mjs','public-composition-oracle.mjs']){const body=await readFile(join(repository,'tools/b1-webgpu',name));policy.served.set('/'+name,{body,contentType:'text/javascript',identity:descriptor(name,body)});}
  const mapStart=source.indexOf('  const importMap ='),mapEnd=source.indexOf('  // One generated map',mapStart);
  const importMap=runInNewContext(source.slice(mapStart,mapEnd)+'\nimportMap',{aliases:policy.aliases,NEGATIVES,registryName:'packages/engine/dist/internal/texturedFrameState.js'},{timeout:1000});
  const htmlStart=source.indexOf('  const html = Buffer.from'),htmlEnd=source.indexOf('  report.identitiesBefore =',htmlStart);
  runInNewContext(source.slice(htmlStart,htmlEnd),{served:policy.served,report,importMap,aliases:policy.aliases,NEGATIVES,Buffer,descriptor,structuredClone},{timeout:1000});
  const capacityStart=source.indexOf('  const requestCapacity ='),capacityEnd=source.indexOf('  server = createServer',capacityStart);
  assert.ok(capacityStart>0&&capacityEnd>capacityStart);
  const calculate=()=>runInNewContext(source.slice(capacityStart,capacityEnd)+'\nrequestLimit',{report,served:policy.served,deriveRequestCapacity:policy.deriveRequestCapacity},{timeout:1000});
  const limit=calculate();
  const serverStart=source.indexOf('  server = createServer',capacityEnd),serverEnd=source.indexOf("  server.on('connection'",serverStart);
  const handler=runInNewContext(source.slice(serverStart,serverEnd)+'\nserver',{report,served:policy.served,requestLimit:limit,URL,createServer:value=>value},{timeout:1000});
  return {policy,report,limit,calculate,handler};
}
test('S12 actual selected route closures include both original and copied SDK URLs in all nine request budgets',async t=>{
  const value=await requestQuotaFixture();
  assert.ok(value.limit>=1274,'The fixed nine complete windows require 1274 requests before optional favicon allowances');
  assert.equal(value.limit,1283);assert.equal(value.report.requestCapacity.historical,1051);assert.equal(value.report.requestCapacity.previous,1197);
  const rows=value.report.requestCapacity.perWindow;assert.deepEqual(Array.from(rows,row=>row.mode),['baseline','N1','N2','N3','N4','N5','S1','S2','SN1']);
  assert.deepEqual(Array.from(rows,row=>row.modules),[137,138,138,138,138,138,137,137,137]);
  assert.equal(rows.reduce((sum,row)=>sum+row.routes.length,0),1274);
  for(const row of rows){assert.equal(new Set(row.routes).size,row.routes.length);assert.equal(row.companions,3);assert.equal(row.html,1);assert.equal(row.favicon,1);}
  value.policy.served.set('/unused-metadata.mjs',{body:Buffer.from(''),contentType:'text/javascript'});assert.equal(value.calculate(),1283,'Unreachable served routes cannot inflate the budget');
  t.diagnostic('Selected-map closure is filesystem metadata, not observed browser requests or rendering acceptance');
});
test('S13 actual request handler accepts every necessary route and retains finite overflow refusal',async()=>{
  const value=await requestQuotaFixture();assert.ok(value.limit>=1274);
  value.report.requests=[];
  const request=pathname=>{let code;value.handler({url:pathname,method:'GET'},{writeHead(status){code=status;},end(){}});return code;};
  for(const row of value.report.requestCapacity.perWindow)for(const route of row.routes)assert.equal(request(route),200);
  assert.equal(value.report.requests.length,1274);assert.notEqual(value.report.requestOverflow,true);
  for(let index=0;index<9;index++)assert.equal(request('/favicon.ico'),404);
  assert.equal(value.report.requests.length,1283);assert.notEqual(value.report.requestOverflow,true);
  assert.equal(request('/index.html'),429);assert.equal(value.report.requestOverflow,true);assert.equal(value.report.requests.length,1283);
});


test('S14 content-build successors retain exact historical membership and current bytes', async () => {
  const source = await readFile(cli, 'utf8');
  const declaration = source.match(/const m21ContentModuleSuccessors = new Map\((\[[\s\S]*?\n\])\);/);
  assert.ok(declaration, 'The reviewed two-file content successor must remain explicit');
  const entries = runInNewContext(declaration[1], {}, { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(entries)), [
    ['packages/contracts/dist/resources/index.js', { bytes: 348, sha256: '33e0fd9874ac06a2455af14a36b36e4caec75e318718c03755195961340d0ff2' }],
    ['packages/contracts/dist/resources/manifestAdmission.js', { bytes: 18139, sha256: '552bdb9c52612564614943667322b73892e7dbcb1b506a2f102d758da335e0f5' }],
  ]);
  const policy = await completeCurrentClosure();
  assert.deepEqual(JSON.parse(JSON.stringify(policy.m15ModuleIdentities.get(entries[0][0]))),
    { bytes: 283, sha256: '2ea27b7090a99051f53c9a314142b34a01ac4f2831fce3435c0e7ccdc26335ea' });
  assert.deepEqual(JSON.parse(JSON.stringify(policy.m15ModuleIdentities.get(entries[1][0]))),
    { bytes: 16232, sha256: '39604bb6f530d229e576f0122e53d90d1b05270b2ae229322fe0f402e3d7c715' });
  for (const [name, successor] of entries) {
    assert.deepEqual(JSON.parse(JSON.stringify(policy.currentModuleIdentities.get(name))), JSON.parse(JSON.stringify(successor)));
  }
});

for (const target of ['packages/contracts/dist/resources/index.js', 'packages/contracts/dist/resources/manifestAdmission.js']) {
  test('S15 content-build successor refuses an unknown same-length byte: ' + target, async () => {
    await completeCurrentClosure();
    const original = await readFile(join(repository, target));
    const policy = await emittedClosurePolicy({ selectedReadFile: async (...args) => {
      const value = await readFile(...args);
      if (resolve(args[0]) !== resolve(repository, target)) return value;
      const copy = Buffer.from(value); copy[0] ^= 1;
      assert.equal(copy.length, original.length);
      return copy;
    } });
    await assert.rejects(policy.collect(target), error => error.code === 'ERR_ASSERTION' &&
      error.message.startsWith('Current emitted raw identity changed: ' + target));
    assert.equal(policy.served.size, 0, 'Changed successor must be refused before capture');
    assert.deepEqual(await readFile(join(repository, target)), original);
    await completeCurrentClosure();
  });
}

// Exact UI successors are independently pinned; old tables remain historical evidence.
const uiSuccessors = [
  [
    "packages/engine/dist/Engine.js",
    {
      "bytes": 22046,
      "sha256": "42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239"
    }
  ],
  [
    "packages/runtime/dist/Scope.js",
    {
      "bytes": 4927,
      "sha256": "f49aff05fbef7adde7e96bb36f968ea2cbfb64b2875ba10a6c07f9455d1307ab"
    }
  ],
  [
    "packages/runtime/dist/displayTreeState.js",
    {
      "bytes": 17075,
      "sha256": "c7f4b2dc7895c9f14c532be2ef752fe54d7eeefba0716f2bf549e460864b0b0f"
    }
  ],
  [
    "packages/runtime/dist/displayVisualState.js",
    {
      "bytes": 4129,
      "sha256": "a3740df92ab4e1e2b8807674f5e79f2d07bf39bba18a4d6150249c0a22f7b998"
    }
  ],
  [
    "packages/runtime/dist/DisplayObject.js",
    {
      "bytes": 7755,
      "sha256": "581492976c85f3f8abb3c44039c06a4aa6fcf6e8153d4b174fa67d25249fd7aa"
    }
  ],
  [
    "packages/runtime/dist/displayHitState.js",
    {
      "bytes": 3481,
      "sha256": "99cbbb70f8c223fbbdf59bf892c4a216f45effa38d22a50f7aa18c9b6adba4d6"
    }
  ],
  [
    "packages/runtime/dist/DisplayObjectContainer.js",
    {
      "bytes": 9277,
      "sha256": "ec71cbae41ffda303f40ec404ede643e798c97bc3e421083873c5ad5ce15acc6"
    }
  ]
];
const uiAdditions = [
  [
    "packages/runtime/dist/ui/managedState.js",
    {
      "bytes": 1630,
      "sha256": "40e519e12a711fde43556cf6f15d02214448dfc5e037eb070c215bd811e4ff62"
    }
  ],
  [
    "packages/engine/dist/internal/uiFactoryState.js",
    {
      "bytes": 4420,
      "sha256": "0a67b4189539e30baae0e7c7befc58fdeec6fdc357b352f93cecbd511cd06046"
    }
  ]
];
test('S16 UI cooperation admits only seven exact successors and two eager dependencies', async () => {
  const source = await readFile(cli, 'utf8');
  for (const [name, expected] of [['m31UiModuleSuccessors', uiSuccessors], ['m31UiModuleAdditions', uiAdditions]]) {
    const declaration = source.match(new RegExp('const ' + name + ' = new Map\\((\\[[\\s\\S]*?\\n\\])\\);'));
    assert.ok(declaration, 'Explicit finite UI table required: ' + name);
    assert.deepEqual(JSON.parse(JSON.stringify(runInNewContext(declaration[1], {}, { timeout: 1000 }))), expected);
  }
  const policy = await completeCurrentClosure();
  for (const [name, expected] of uiSuccessors) {
    assert.ok(policy.m15ModuleIdentities.has(name), 'A successor must retain historical membership');
    assert.notEqual(policy.m15ModuleIdentities.get(name).sha256, expected.sha256);
    assert.deepEqual(JSON.parse(JSON.stringify(policy.currentModuleIdentities.get(name))), JSON.parse(JSON.stringify(policy.m22SequenceModuleSuccessors.get(name)??expected)));
  }
  for (const [name, expected] of uiAdditions) {
    assert.equal(policy.m15ModuleIdentities.has(name), false);
    assert.deepEqual(JSON.parse(JSON.stringify(policy.currentModuleIdentities.get(name))), JSON.parse(JSON.stringify(policy.m22SequenceModuleSuccessors.get(name)??expected)));
  }
  for (const name of ['packages/engine/dist/ui/index.js', 'packages/runtime/dist/ui/index.js']) {
    assert.equal(policy.allowedModules.has(name), false, 'Optional UI assembly cannot enter this default closure');
    await assert.rejects(policy.collect(name), error => error.message === 'Unapproved public native dependency: ' + name);
  }
});
for (const [target] of [...uiSuccessors, ...uiAdditions]) {
  test('S17 UI identity refuses an unknown same-length byte: ' + target, async () => {
    await completeCurrentClosure();
    const original = await readFile(join(repository, target));
    const policy = await emittedClosurePolicy({ selectedReadFile: async (...args) => {
      const value = await readFile(...args);
      if (resolve(args[0]) !== resolve(repository, target)) return value;
      const copy = Buffer.from(value); copy[0] ^= 1;
      assert.equal(copy.length, original.length);
      return copy;
    } });
    await assert.rejects(policy.collect(target), error => error.code === 'ERR_ASSERTION' &&
      error.message.startsWith('Current emitted raw identity changed: ' + target));
    assert.equal(policy.served.size, 0, 'Unknown UI bytes must be refused before capture');
    assert.deepEqual(await readFile(join(repository, target)), original);
    await completeCurrentClosure();
  });
}

const sequenceSuccessors=[
  [
    "packages/engine/dist/Engine.js",
    {
      "bytes": 22833,
      "sha256": "115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822"
    }
  ],
  [
    "packages/engine/dist/sequencePlayback.js",
    {
      "bytes": 13139,
      "sha256": "2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e"
    }
  ]
];
const sequenceAdditions=[
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
  ]
];
test('S18 sequence collector admits only two exact successors and two private eager dependencies',async()=>{
 const policy=await completeCurrentClosure();
 assert.deepEqual(JSON.parse(JSON.stringify([...policy.m22SequenceModuleSuccessors])),sequenceSuccessors);
 assert.deepEqual(JSON.parse(JSON.stringify([...policy.m22SequenceModuleAdditions])),sequenceAdditions);
 for(const [name,expected]of [...sequenceSuccessors,...sequenceAdditions])assert.deepEqual(JSON.parse(JSON.stringify(policy.currentModuleIdentities.get(name))),expected);
 for(const name of ['packages/engine/dist/animation/index.js','packages/engine/dist/animation/sequenceController.js','packages/engine/dist/animation/sequenceCoordinator.js']){assert.equal(policy.allowedModules.has(name),false);await assert.rejects(policy.collect(name),error=>error.message==='Unapproved public native dependency: '+name);}
});

for (const [target] of [...sequenceSuccessors, ...sequenceAdditions]) {
  test('S19 sequence identity refuses an unknown same-length byte: ' + target, async () => {
    await completeCurrentClosure();
    const original = await readFile(join(repository, target));
    const policy = await emittedClosurePolicy({ selectedReadFile: async (...args) => {
      const value = await readFile(...args);
      if (resolve(args[0]) !== resolve(repository, target)) return value;
      const copy = Buffer.from(value); copy[0] ^= 1;
      assert.equal(copy.length, original.length);
      return copy;
    } });
    await assert.rejects(policy.collect(target), error => error.code === 'ERR_ASSERTION' &&
      error.message.startsWith('Current emitted raw identity changed: ' + target));
    assert.equal(policy.served.size, 0, 'Unknown sequence bytes must be refused before capture');
    assert.deepEqual(await readFile(join(repository, target)), original);
    await completeCurrentClosure();
  });
}
