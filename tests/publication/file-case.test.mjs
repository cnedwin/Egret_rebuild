// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkPublication } from '../../tools/check-publication.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'egret-file-case-'));
  try {
    const body = '/** Original source bytes require exact portable path identities. */\nexport const original = true;\n';
    await mkdir(path.join(root, 'src'));
    await writeFile(path.join(root, 'src/core.ts'), body);
    const inventory = {
      schemaVersion: 1, semanticReview: { status: 'reviewed_with_scope' },
      documents: [], registries: [],
      criticalComments: [{ path: 'src/core.ts', sha256: createHash('sha256').update(body).digest('hex') }],
    };
    const save = () => writeFile(path.join(root, 'localization.json'), JSON.stringify(inventory));
    await save();
    assert.deepEqual((await checkPublication(root)).issues, [], 'genuine complete publication baseline');
    await run(root, inventory, save);
  } finally {
    // Remove only this independently allocated fixture under the system temp root.
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('egret-file-case-'));
    await rm(root, { recursive: true, force: true });
  }
}

test('publication refuses a Windows-readable directory case alias', () => fixture(async (root, inventory, save) => {
  inventory.criticalComments[0].path = 'SRC/core.ts';
  await save();
  const result = await checkPublication(root);
  assert.ok(result.issues.length > 0, 'different portable spelling must not borrow the original fingerprint');
}));

test('publication refuses duplicate fingerprint rows using case aliases', () => fixture(async (root, inventory, save) => {
  inventory.criticalComments.push({ ...inventory.criticalComments[0], path: 'src/CORE.ts' });
  await save();
  const result = await checkPublication(root);
  assert.ok(result.issues.length > 0, 'one physical file must not satisfy two differently spelled path identities');
}));
