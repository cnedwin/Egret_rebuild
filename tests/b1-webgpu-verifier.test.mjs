import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, lstat, rm, symlink } from 'node:fs/promises';
import { dirname, join, parse, resolve, relative, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// These paths become repository-relative when this candidate is adopted into tests/.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(repository, 'tools/verify-webgpu-b1.mjs');
const oracleUrl = new URL('../tools/b1-webgpu/oracle.mjs', import.meta.url);
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
