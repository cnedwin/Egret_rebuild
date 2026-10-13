// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repository = fileURLToPath(new URL('../..', import.meta.url));
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'egret-text-writers-'));
  try {
    for (const relative of ['tools/write-repository-text.mjs','tools/lib/file-identity.mjs','knowledge-base/tools/Write-CanonicalText.ps1']) {
      const destination = path.join(root, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(repository, relative), destination);
    }
    await mkdir(path.join(root, 'docs'));
    await mkdir(path.join(root, 'third-party'));
    await run(root);
  } finally {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('egret-text-writers-'));
    await rm(root, { recursive: true, force: true });
  }
}
function execute(root, executable, args, input) {
  const result = spawnSync(executable, args, { cwd: root, input, windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  assert.equal(result.signal, null);
  return result;
}
const authored = 'Unicode 😀  \r\n\r\nsecond\r\n\r\n';
const expected = Buffer.from('Unicode 😀  \n\nsecond\n');

test('Node authoring entry writes explicit UTF8/LF while preserving authored interior spaces', () => fixture(async root => {
  const result = execute(root, process.execPath, ['tools/write-repository-text.mjs','--path','docs/node.md'], Buffer.from(authored));
  assert.equal(result.status, 0, result.stderr.toString());
  assert.deepEqual(await readFile(path.join(root, 'docs/node.md')), expected);
}));
test('PowerShell wrapper writes the same bytes without Environment.NewLine', () => fixture(async root => {
  const result = execute(root, process.env.EGRET_TEST_PWSH || 'pwsh', ['-NoLogo','-NoProfile','-File',
    'knowledge-base/tools/Write-CanonicalText.ps1','-RelativePath','docs/powershell.md','-Text',authored,'-Node',process.execPath]);
  assert.equal(result.status, 0, result.stderr.toString());
  assert.deepEqual(await readFile(path.join(root, 'docs/powershell.md')), expected);
}));
test('authoring entry refuses an original legal file without changing its raw bytes', () => fixture(async root => {
  const original = Buffer.from('Original legal material\r\n');
  await writeFile(path.join(root, 'third-party/LICENSE'), original);
  const result = execute(root, process.execPath, ['tools/write-repository-text.mjs','--path','third-party/LICENSE'], Buffer.from('replacement\n'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr.toString(), /Preserved original paths/);
  assert.deepEqual(await readFile(path.join(root, 'third-party/LICENSE')), original);
}));
