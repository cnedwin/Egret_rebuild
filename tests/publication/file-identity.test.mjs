// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync,
  symlinkSync, lstatSync, unlinkSync, rmSync, existsSync,
} from 'node:fs';
import {
  logicalPath, physicalPathKey, samePhysicalPath, ownerRelativePath, fingerprintFile, canonicalTextBytes,
} from '../../tools/lib/file-identity.mjs';

// These tests concern development-tool identities, not Engine/runtime APIs.
// Pure physical keys are lexical only; fingerprint tests use actual owned files.
const rawSha = bytes => createHash('sha256').update(bytes).digest('hex');

for (const value of [
  'src/Bitmap.ts', 'knowledge-base/Cns/docs/文档 名称.md',
  'knowledge-base/en/docs/source-origin.md', '.gitattributes', '.editorconfig',
  'docs/e\u0301.md', 'docs/é.md',
]) {
  test('logical path keeps exact POSIX spelling: ' + value, () => assert.equal(logicalPath(value), value));
}
for (const value of [
  '', null, 1, '/src/a.ts', 'C:/src/a.ts', '\\\\server\\share\\a.ts',
  'src\\a.ts', './src/a.ts', 'src/./a.ts', 'src/../a.ts', '../a.ts',
  'src//a.ts', 'src/', 'src/a.ts:stream', 'src/a\0.ts', 'src./a.ts', 'src/a.ts ',
]) {
  test('noncanonical logical path is refused: ' + JSON.stringify(value), () => assert.throws(() => logicalPath(value)));
}
test('logical identities keep case and Unicode code points distinct', () => {
  assert.notEqual(logicalPath('src/Bitmap.ts'), logicalPath('src/bitmap.ts'));
  assert.notEqual(logicalPath('docs/é.md'), logicalPath('docs/e\u0301.md'));
});
const windowsPairs = [
  ['C:\\Repo\\packages\\Runtime\\A.ts', 'c:/repo/packages/runtime/a.ts'],
  ['C:/Repo/Sub/../Asset.bin', 'c:\\repo\\asset.bin'],
  ['\\\\Server\\Share\\Repo\\A.ts', '//server/share/repo/a.ts'],
];
for (const [left,right] of windowsPairs) {
  test('Windows absolute lexical key admits drive/UNC slash and case equivalents', () => {
    assert.equal(physicalPathKey(left, 'win32'), physicalPathKey(right, 'win32'));
    assert.equal(samePhysicalPath(left, right, 'win32'), true);
  });
}
test('Windows lexical comparison preserves drive/share and Unicode distinctions', () => {
  assert.equal(samePhysicalPath('C:/repo/a.ts', 'D:/repo/a.ts', 'win32'), false);
  assert.equal(samePhysicalPath('//server/share/a.ts', '//server/other/a.ts', 'win32'), false);
  assert.notEqual(physicalPathKey('C:/repo/é.md', 'win32'), physicalPathKey('C:/repo/e\u0301.md', 'win32'));
});
for (const value of ['', 'repo/a.ts', 'C:repo/a.ts', '\\repo\\a.ts', '/repo/a.ts']) {
  test('Windows physical key does not guess a cwd or drive: ' + JSON.stringify(value), () => {
    assert.throws(() => physicalPathKey(value, 'win32'));
  });
}
test('POSIX physical paths retain case and literal backslashes', () => {
  assert.equal(samePhysicalPath('/repo/dir/../a.ts', '/repo/a.ts', 'linux'), true);
  assert.equal(samePhysicalPath('/Repo/A.ts', '/repo/a.ts', 'linux'), false);
  assert.notEqual(physicalPathKey('/repo/a\\b.ts', 'linux'), physicalPathKey('/repo/a/b.ts', 'linux'));
  assert.throws(() => physicalPathKey('repo/a.ts', 'linux'));
});
test('owner-relative Windows path retains full tail case without a basename join', () => {
  assert.equal(ownerRelativePath('C:\\Repo', 'c:/REPO/Sub/A.ts', 'win32'), 'Sub/A.ts');
  assert.equal(ownerRelativePath('//server/share/Repo', '\\\\SERVER\\SHARE\\repo\\docs\\A.md', 'win32'), 'docs/A.md');
});
for (const absolute of ['C:/Repo', 'C:/Repo-other/a.ts', 'C:/Repo/../escape/a.ts', 'D:/Repo/a.ts']) {
  test('Windows containment refuses self, prefix siblings and owner escapes: ' + absolute, () => {
    assert.throws(() => ownerRelativePath('C:/Repo', absolute, 'win32'));
  });
}
test('POSIX containment is case-sensitive and rejects prefix siblings', () => {
  assert.equal(ownerRelativePath('/Repo', '/Repo/Sub/A.ts', 'linux'), 'Sub/A.ts');
  assert.throws(() => ownerRelativePath('/Repo', '/repo/Sub/A.ts', 'linux'));
  assert.throws(() => ownerRelativePath('/Repo', '/Repo-sibling/A.ts', 'linux'));
  assert.throws(() => ownerRelativePath('/Repo', '/Repo', 'linux'));
});

/** The cleanup oracle uses native path/fs operations, never the module under test. */
async function ownedFixture(body) {
  const parent = path.join(tmpdir(), 'egret-file-identity-regressions');
  mkdirSync(parent, { recursive: true });
  const physicalParent = realpathSync(parent);
  const owner = realpathSync(mkdtempSync(path.join(physicalParent, 'case-')));
  const links = [];
  let primary, cleanup;
  try { await body(owner, links); }
  catch (cause) { primary = { cause }; }
  try {
    for (const link of links) {
      const relative = path.relative(owner, link);
      assert.ok(relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
      assert.ok(lstatSync(link).isSymbolicLink());
      unlinkSync(link); // Remove the owned link itself before recursive cleanup.
    }
    const resolved = realpathSync(owner), relative = path.relative(physicalParent, resolved);
    assert.equal(resolved, owner);
    assert.equal(path.dirname(resolved), physicalParent);
    assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    assert.ok(path.basename(resolved).startsWith('case-'));
    rmSync(resolved, { recursive: true, force: false });
    assert.equal(existsSync(resolved), false);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause,cleanup.cause], 'FILE_IDENTITY_FIXTURE_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
function put(owner, logical, bytes) {
  const file = path.join(owner, ...logical.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return file;
}
async function exactPin(owner, logical, bytes) {
  const actual = await fingerprintFile(owner, logical);
  assert.equal(actual.path, logical);
  assert.equal(actual.bytes, bytes.length);
  assert.equal(actual.sha256, rawSha(bytes));
  return actual;
}
test('raw fingerprint distinguishes LF, CRLF and BOM without text normalization', async () => ownedFixture(async owner => {
  const logical = 'src/identity.ts', lf = Buffer.from('one\ntwo\n'), crlf = Buffer.from('one\r\ntwo\r\n');
  put(owner, logical, lf);
  const a = await exactPin(owner, logical, lf);
  put(owner, logical, crlf);
  const b = await exactPin(owner, logical, crlf);
  assert.notEqual(a.sha256, b.sha256); assert.notEqual(a.bytes, b.bytes);
  const bom = Buffer.concat([Buffer.from([239,187,191]), lf]);
  put(owner, logical, bom);
  const c = await exactPin(owner, logical, bom);
  assert.notEqual(c.sha256, a.sha256); assert.equal(c.bytes, a.bytes + 3);
  assert.deepEqual(readFileSync(path.join(owner, 'src/identity.ts')), bom);
}));
test('same basename at distinct complete logical paths never collapses identity', async () => ownedFixture(async owner => {
  const bytes = Buffer.from('same bytes\n');
  put(owner, 'one/value.bin', bytes); put(owner, 'two/value.bin', bytes);
  const a = await exactPin(owner, 'one/value.bin', bytes), b = await exactPin(owner, 'two/value.bin', bytes);
  assert.equal(a.sha256, b.sha256);
  assert.notEqual(a.path, b.path);
  assert.deepEqual([a.path,b.path], ['one/value.bin','two/value.bin']);
}));
test('raw binary fingerprint preserves NUL and non-UTF8 bytes', async () => ownedFixture(async owner => {
  const bytes = Buffer.from([0,255,13,10,128,0,10]);
  put(owner, 'assets/original.bin', bytes);
  await exactPin(owner, 'assets/original.bin', bytes);
}));
test('fingerprint refuses traversal after a genuine complete-file baseline', async () => ownedFixture(async owner => {
  const bytes = Buffer.from('baseline\n');
  put(owner, 'src/good.ts', bytes); await exactPin(owner, 'src/good.ts', bytes);
  await assert.rejects(async () => fingerprintFile(owner, '../good.ts'));
  await assert.rejects(async () => fingerprintFile(owner, 'src/../src/good.ts'));
}));
test('fingerprint refuses directory values and symbolic path segments', async () => ownedFixture(async (owner, links) => {
  const bytes = Buffer.from('owned baseline\n');
  const target = path.join(owner, 'real');
  put(owner, 'real/value.ts', bytes); await exactPin(owner, 'real/value.ts', bytes);
  await assert.rejects(async () => fingerprintFile(owner, 'real'));
  const alias = path.join(owner, 'alias');
  symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir'); links.push(alias);
  await assert.rejects(async () => fingerprintFile(owner, 'alias/value.ts'));
  assert.deepEqual(readFileSync(path.join(target, 'value.ts')), bytes);
}));

test('fresh text writer canonicalizes CRLF and final LF only', () => {
  for (const [source, expected] of [
    ['alpha\r\nbeta\r\n', 'alpha\nbeta\n'],
    ['alpha', 'alpha\n'],
    ['alpha\n\n\n', 'alpha\n'],
    ['', ''],
  ]) {
    const result = canonicalTextBytes(source);
    assert.ok(result instanceof Uint8Array);
    assert.deepEqual([...result], [...Buffer.from(expected)]);
  }
});
test('fresh text writer preserves interior blank lines, Unicode and Markdown hard breaks', () => {
  const text = 'first  \r\n\r\n😀 second  \r\n\r\n';
  assert.deepEqual([...canonicalTextBytes(text)], [...Buffer.from('first  \n\n😀 second  \n')]);
  const first = canonicalTextBytes('owned'), second = canonicalTextBytes('owned');
  assert.notEqual(first, second);
  first.fill(0);
  assert.deepEqual([...second], [...Buffer.from('owned\n')]);
});
for (const text of ['bare\rcarriage', '\uFEFFbom', 'nul\0byte', '\uD800', '\uDC00', null, 1]) {
  test('fresh text writer refuses malformed authored text: ' + JSON.stringify(text), () => {
    assert.throws(() => canonicalTextBytes(text));
  });
}
// canonicalTextBytes is for newly authored text only. The raw fingerprint cases
// above intentionally keep CRLF/BOM/binary bytes and must never call the writer.
