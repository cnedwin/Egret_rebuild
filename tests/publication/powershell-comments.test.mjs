// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkPublication } from '../../tools/check-publication.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'egret-powershell-comments-'));
  try {
    await mkdir(path.join(root, 'tools'));
    const inventory = { schemaVersion: 1, semanticReview: { status: 'reviewed_with_scope' }, documents: [], registries: [], criticalComments: [] };
    await writeFile(path.join(root, 'localization.json'), JSON.stringify(inventory));
    assert.deepEqual((await checkPublication(root)).issues, []);
    const save = async body => {
      await writeFile(path.join(root, 'tools/Writer.ps1'), body);
      inventory.criticalComments = [{ path: 'tools/Writer.ps1', sha256: createHash('sha256').update(body).digest('hex') }];
      await writeFile(path.join(root, 'localization.json'), JSON.stringify(inventory));
    };
    await run(root, save);
  } finally {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('egret-powershell-comments-'));
    await rm(root, { recursive: true, force: true });
  }
}
test('publication recognizes a genuine English PowerShell line comment', () => fixture(async (root, save) => {
  await save('# Original authored text always uses explicit line endings.\nWrite-Output 1\n');
  assert.deepEqual((await checkPublication(root)).issues, []);
}));
test('PowerShell English code text cannot replace an English comment', () => fixture(async (root, save) => {
  await save('# 保留原始字节。\nWrite-Output "English code contains several meaningful words"\n');
  assert.ok((await checkPublication(root)).issues.includes('missing English comment: tools/Writer.ps1'));
}));
