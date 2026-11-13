// SPDX-License-Identifier: Apache-2.0
// The clean-consumer check: its own parts on made-up inputs, then the whole run against the built
// packages of this checkout, installed without the registry into a directory of the system.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { EXAMPLES, OPTIONAL_PACKAGES, PACKAGES, THIRD_PARTY, admitOutput, readArchive, repository, separationFaults, verifyCleanConsumer } from '../tools/verify-clean-consumer.mjs';
import { SCENE, importMapOf, matches, pageFiles, serveConsumer, summarize } from '../tools/verify-clean-consumer-page.mjs';

/** One record of a tar stream: a header block, then the body padded to whole blocks. */
function record(name, body, type = '0', prefix = '') {
  const header = Buffer.alloc(512), bytes = Buffer.from(body);
  header.write(name, 0, 100, 'utf8'); header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136); header.write(type, 156); header.write('ustar\0' + '00', 257); header.write(prefix, 345, 155, 'utf8');
  return Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
}
const archive = (...records) => zlib.gzipSync(Buffer.concat([...records, Buffer.alloc(1024)]));
const refused = (code, body) => assert.throws(body, error => error.code === code);

test('CC01 an archive lists its files, with long names from either kind of header', () => {
  const long = 'package/dist/' + 'deep/'.repeat(30) + 'module.js', pax = 'path=' + long + '\n', length = String(pax.length + 4).length + 1 + pax.length;
  const files = readArchive(archive(
    record('package/package.json', '{"name":"x"}'),
    record('index.js', 'export {};', '0', 'package/dist'),
    record('PaxHeader', length + ' ' + pax, 'x'), record('short', 'a'),
    record('././@LongLink', long + '2\0', 'L'), record('short', 'bc'),
    record('package/dist', '', '5'),
  ));
  assert.deepEqual(files.map(file => [file.path, file.bytes]), [['package/package.json', 12], ['package/dist/index.js', 10], [long, 1], [long + '2', 2]]);
  assert.equal(files[0].content.toString(), '{"name":"x"}');
  assert.match(files[0].sha256, /^[0-9a-f]{64}$/);
  // A long name names one file only.
  assert.equal(readArchive(archive(record('PaxHeader', length + ' ' + pax, 'x'), record('a', '1'), record('b', '2')))[1].path, 'b');
  const cut = zlib.gzipSync(record('package/a', 'x'.repeat(600)).subarray(0, 900));
  refused('CLEAN_CONSUMER_ARCHIVE_INVALID', () => readArchive(cut));
});

test('CC02 the output directory is absolute, unused, apart from the checkout and unshadowed', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-consumer-admit-'));
  try {
    assert.equal(admitOutput(repository, path.join(base, 'new')), path.join(base, 'new'));
    assert.equal(admitOutput(repository, base), base);
    refused('CLEAN_CONSUMER_OUTPUT_RELATIVE', () => admitOutput(repository, 'out'));
    refused('CLEAN_CONSUMER_OUTPUT_RELATIVE', () => admitOutput(repository, undefined));
    refused('CLEAN_CONSUMER_OUTPUT_INSIDE', () => admitOutput(repository, path.join(repository, 'work', 'consumer')));
    refused('CLEAN_CONSUMER_OUTPUT_INSIDE', () => admitOutput(repository, repository));
    refused('CLEAN_CONSUMER_OUTPUT_INSIDE', () => admitOutput(repository, path.dirname(repository)));
    fs.writeFileSync(path.join(base, 'kept.txt'), 'x');
    refused('CLEAN_CONSUMER_OUTPUT_USED', () => admitOutput(repository, base));
    refused('CLEAN_CONSUMER_OUTPUT_USED', () => admitOutput(repository, path.join(base, 'kept.txt')));
    // A consumer below a workspace, or below installed packages of this project, would not be on its own.
    fs.writeFileSync(path.join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
    refused('CLEAN_CONSUMER_OUTPUT_SHADOWED', () => admitOutput(repository, path.join(base, 'a', 'b')));
    fs.rmSync(path.join(base, 'pnpm-workspace.yaml'));
    fs.mkdirSync(path.join(base, 'node_modules', '@egret'), { recursive: true });
    refused('CLEAN_CONSUMER_OUTPUT_SHADOWED', () => admitOutput(repository, path.join(base, 'a')));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('CC03 each kind of leak between entries is named', () => {
  const engine = file => ({ outside: false, package: '@egret/engine', path: file }), other = (name, file = 'index.js') => ({ outside: false, package: name, path: file });
  const plain = [engine('dist/index.js'), engine('dist/layout.js'), other('@egret/runtime'), other('@egret/contracts')];
  assert.deepEqual(separationFaults('@egret/engine/layout', plain, { draws: false }), []);
  assert.deepEqual(separationFaults('@egret/engine/webgl2', [...plain, engine('dist/web/webgl2.js'), other(THIRD_PARTY.name)], { draws: true }), []);
  assert.deepEqual(separationFaults('@egret/engine/web/input', [...plain, engine('dist/web/input.js')], { draws: false }), []);
  assert.deepEqual(separationFaults('@egret/engine/webgpu/world3d', [engine('dist/web/world3d/webgpu.js'), engine('dist/rendering/world3d/index.js')], { draws: false }), []);
  const one = (entry, file, draws = false) => { const faults = separationFaults(entry, [...plain, file], { draws }); assert.equal(faults.length, 1, JSON.stringify(faults)); return faults[0]; };
  assert.match(one('@egret/engine', engine('dist/web/webgl2.js')), /loads the web module dist\/web\/webgl2\.js/);
  assert.match(one('@egret/engine/layout', engine('dist/rendering/world3d/index.js')), /loads the 3D module/);
  assert.match(one('@egret/engine/webgl2', engine('dist/rendering/world3d/index.js'), true), /loads the 3D module/);
  assert.match(one('@egret/engine/ui', other(THIRD_PARTY.name)), /loads robust-predicates/);
  assert.match(one('@egret/engine', { outside: true, package: null, path: '/elsewhere/index.js' }), /from outside the consumer/);
  for (const name of OPTIONAL_PACKAGES) assert.match(one('@egret/engine/webgl2', other(name), true), /loads the optional package/);
});

test('CC04 the built packages work in a new project outside the checkout', { timeout: 600000 }, () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-consumer-'));
  try {
    const output = path.join(base, 'run'), report = verifyCleanConsumer({ output, offline: true });
    assert.deepEqual(report.rows.filter(row => !row.ok), []);
    assert.equal(report.ok, true);
    assert.deepEqual(report.rows.map(row => row.name), ['archives', 'install', 'entries', 'separation', 'examples', 'types', 'notices']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8')), report);
    const row = name => report.rows.find(item => item.name === name), manifest = JSON.parse(fs.readFileSync(path.join(repository, 'packages/engine/package.json'), 'utf8'));
    assert.deepEqual(row('archives').archives.map(item => item.package), PACKAGES.map(name => '@egret/' + name));
    for (const item of row('archives').archives) { assert.ok(item.licences.includes('LICENSE')); assert.equal(fs.statSync(path.join(output, 'archives', item.file)).size, item.bytes); }
    // Every declared entry, none left out and none invented.
    assert.deepEqual(row('entries').entries.map(item => item.entry), Object.keys(manifest.exports).map(subpath => '@egret/engine' + subpath.slice(1)));
    for (const item of row('entries').entries) assert.ok(item.modules > 0 && item.gzipBytes > 0 && item.gzipBytes < item.bytes, item.entry);
    // The default entry and the optional entry of the example stay within the three packages.
    for (const entry of ['@egret/engine', '@egret/engine/layout']) assert.deepEqual(row('entries').entries.find(item => item.entry === entry).packages, ['@egret/contracts', '@egret/engine', '@egret/runtime']);
    assert.deepEqual(row('entries').entries.find(item => item.entry === '@egret/engine/webgl2').packages, ['@egret/contracts', '@egret/engine', '@egret/runtime', THIRD_PARTY.name]);
    assert.deepEqual(row('install'), { name: 'install', ok: true, faults: [], mode: 'offline', installed: 4, declared: ['@egret/engine'] });
    assert.deepEqual(row('examples').examples.map(item => item.file), EXAMPLES.map(item => item.file));
    for (const item of row('examples').examples) assert.ok(item.outputBytes > 0);
    assert.deepEqual(row('notices').notices.map(item => [item.package, item.files.includes('LICENSE')]), [['@egret/contracts', true], ['@egret/runtime', true], ['@egret/engine', true], [THIRD_PARTY.name, true]]);
    // The consumer holds copies, not links into the checkout.
    // On another drive the relative path is an absolute one.
    const installed = fs.realpathSync(path.join(output, 'consumer/node_modules/@egret/engine'));
    const inside = (parent, child) => { const relative = path.relative(fs.realpathSync(parent), child); return !relative.startsWith('..') && !path.isAbsolute(relative); };
    assert.equal(inside(repository, installed), false);
    assert.equal(inside(output, installed), true);
    assert.ok(report.open.length >= 6 && report.open.some(line => /registry was not used/.test(line)));
    // The import map of a page of this consumer: every entry of every installed package, each a file inside the consumer.
    const consumer = fs.realpathSync(path.join(output, 'consumer')), { root, map, packages } = importMapOf(consumer);
    assert.equal(root, consumer);
    assert.deepEqual(packages.map(item => [item.name, item.entries, item.privateNames]), [['@egret/engine', Object.keys(manifest.exports).length, Object.keys(manifest.imports).length], ['@egret/runtime', 6, 0], ['@egret/contracts', 2, 0], [THIRD_PARTY.name, 1, 0]]);
    assert.deepEqual(Object.keys(map.imports).slice(0, Object.keys(manifest.exports).length), Object.keys(manifest.exports).map(subpath => '@egret/engine' + subpath.slice(1)));
    assert.deepEqual(Object.keys(map.scopes), [packages[0].directory]);
    assert.deepEqual(Object.keys(map.scopes[packages[0].directory]), Object.keys(manifest.imports));
    const addresses = [...Object.values(map.imports), ...Object.values(map.scopes[packages[0].directory])];
    for (const address of addresses) {
      assert.match(address, /^\/node_modules\/[^\\]+\.js$/, address);
      const file = path.join(consumer, ...address.slice(1).split('/').map(decodeURIComponent));
      assert.ok(fs.statSync(file).isFile() && inside(consumer, fs.realpathSync(file)), address);
    }
    assert.equal(new Set(Object.values(map.imports)).size, Object.keys(map.imports).length, 'no two entries share a module');
    // A second run never writes over the first.
    refused('CLEAN_CONSUMER_OUTPUT_USED', () => verifyCleanConsumer({ output, offline: true }));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('CC05 a colour read back from a frame is the one that was drawn, to within two steps', () => {
  assert.equal(matches([0x10, 0x20, 0x30, 255], SCENE.clear), true);
  assert.equal(matches([0x12, 0x1e, 0x30, 255], SCENE.clear), true);
  for (const sample of [[0x13, 0x20, 0x30, 255], [0x10, 0x1d, 0x30, 255], [0x10, 0x20, 0x33, 255], [0x10, 0x20, 0x30, 254], [0x10, 0x20, 0x30], [0x10, 0x20, 0x30, 255, 0], undefined, null, 'x']) assert.equal(matches(sample, SCENE.clear), false, JSON.stringify(sample));
  assert.equal(matches([0x3d, 0x4a, 0x63, 255], SCENE.idle), true);
  assert.equal(matches([0x3d, 0x4a, 0x63, 255], SCENE.activated), false);
});

test('CC06 the page of the consumer names the installed engine by its public entries alone', () => {
  const map = { imports: { '@egret/engine': '/node_modules/x/index.js' }, scopes: {} }, files = pageFiles(map);
  assert.deepEqual(Object.keys(files), ['page/index.html', 'page/main.mjs']);
  assert.ok(files['page/index.html'].includes('<script type="importmap">' + JSON.stringify(map) + '</script>'));
  const named = [...files['page/main.mjs'].matchAll(/(?:from\s*|import\(\s*)'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(named, ['@egret/engine', '@egret/engine/ui', '@egret/engine/web/pointer', '@egret/engine/webgpu', '@egret/engine/webgl2']);
  // Nothing of the checkout and nothing private is named, and the scene is the one the check reads back.
  assert.equal(/node_modules|packages\/|\.\.\/|#egret/.test(files['page/main.mjs']), false);
  for (const value of [SCENE.width, SCENE.height, SCENE.clear, SCENE.idle, SCENE.activated, SCENE.button.x, SCENE.button.width]) assert.ok(files['page/main.mjs'].includes(String(value)), String(value));
});

test('CC07 the server of the consumer serves that directory and nothing else, and keeps what was asked', async () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-consumer-serve-'))), root = path.join(base, 'consumer');
  fs.mkdirSync(path.join(root, 'page'), { recursive: true }); fs.mkdirSync(path.join(root, 'node_modules', 'a b+c@1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'page', 'index.html'), '<p>page</p>'); fs.writeFileSync(path.join(root, 'node_modules', 'a b+c@1', 'index.js'), 'export {};'); fs.writeFileSync(path.join(base, 'secret.txt'), 'outside');
  const server = serveConsumer(root), origin = await server.listen();
  try {
    const get = async address => { const response = await fetch(origin + address); return [response.status, response.headers.get('content-type'), await response.text()]; };
    assert.deepEqual(await get('/page/index.html'), [200, 'text/html', '<p>page</p>']);
    assert.deepEqual(await get('/node_modules/' + encodeURIComponent('a b+c@1') + '/index.js'), [200, 'text/javascript', 'export {};']);
    for (const address of ['/missing.js', '/page', '/page/', '/%2e%2e/secret.txt', '/page/..%2f..%2fsecret.txt', '/page/..%5c..%5csecret.txt', '/%zz']) assert.equal((await get(address))[0], 404, address);
    assert.deepEqual(server.requests.map(request => [request.status, request.bytes]), [[200, 11], [200, 10], [404, 0], [404, 0], [404, 0], [404, 0], [404, 0], [404, 0], [404, 0]]);
    const packages = [{ name: 'a', directory: '/node_modules/' + encodeURIComponent('a b+c@1') + '/' }];
    assert.deepEqual(summarize(server.requests.slice(0, 3), packages), { requests: 3, bytes: 21, failed: ['/missing.js'], groups: { a: { requests: 1, bytes: 10 }, page: { requests: 2, bytes: 11 } } });
  } finally { await server.close(); fs.rmSync(base, { recursive: true, force: true }); }
});
