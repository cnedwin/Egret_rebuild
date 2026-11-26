// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runPlaytest, startPreview } from '../tools/agent-playtest.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const seed = fileURLToPath(new URL('../examples/agent-playtest/project.json', import.meta.url));

function setup(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-agent-playtest-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const web = path.join(folder, 'source');
  fs.mkdirSync(web);
  fs.writeFileSync(path.join(web, 'index.html'), '<canvas></canvas>');
  const scenario = path.join(folder, 'scenario.mjs');
  fs.writeFileSync(scenario, 'export default function () {}\n');
  return {
    folder,
    web,
    scenario,
    project: seed,
    playwright: path.join(folder, 'missing-playwright.mjs'),
    out: path.join(folder, 'failed')
  };
}

test('agent playtest preserves failure, rejects a different scenario or stale transaction and refuses a failed preview', async t => {
  const initial = setup(t);
  const failed = await runPlaytest(initial);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.diagnostic.code, 'ERR_MODULE_NOT_FOUND');
  await assert.rejects(startPreview(initial.out, '127.0.0.1'), { code: 'PLAYTEST_PREVIEW_FAILED' });
  const original = fs.readFileSync(path.join(initial.out, 'report.json'));
  const transaction = path.join(initial.folder, 'transaction.json');
  const entity = JSON.parse(fs.readFileSync(seed, 'utf8')).entities[0];
  entity.data.signalColor = '#FFD266';
  fs.writeFileSync(
    transaction,
    JSON.stringify({
      command: 'edit',
      toolProtocolVersion: '1.0',
      projectId: failed.projectId,
      transactionId: 't_stale',
      baseRevision: 1,
      source: {
        actorId: 'a_agent',
        actorKind: 'agent',
        intent: 'Set signal color',
        toolId: 'agent-playtest',
        toolVersion: '1.0'
      },
      scope: { entityIds: [entity.id], fileIds: [], metadata: false, roots: false },
      operations: [{ op: 'putEntity', entity }]
    })
  );
  const retry = { ...initial, after: initial.out, transaction, out: path.join(initial.folder, 'retry') };
  await assert.rejects(runPlaytest(retry), { code: 'PLAYTEST_TRANSACTION_REFUSED' });
  fs.appendFileSync(initial.scenario, '// New script\n');
  await assert.rejects(runPlaytest(retry), { code: 'PLAYTEST_REPAIR_BASE' });
  assert.equal(fs.existsSync(retry.out), false);
  assert.deepEqual(fs.readFileSync(path.join(initial.out, 'report.json')), original);
});

test('preview admits only sealed bytes and refuses changes on its next start', async t => {
  const { folder, web } = setup(t);
  const build = new Map([
    ['index.html', Buffer.from('<canvas></canvas>')],
    ['project.json', Buffer.from('{}')]
  ]);
  const files = [...build].map(([name, data]) => ({ path: name, bytes: data.length, sha256: sha256(data) }));
  const artifact = { files, sha256: sha256(JSON.stringify(files)) };
  fs.renameSync(web, path.join(folder, 'web'));
  fs.writeFileSync(path.join(folder, 'web/project.json'), build.get('project.json'));
  fs.writeFileSync(path.join(folder, 'web/unlisted.json'), '{"private": true}');
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ schemaVersion: 1, status: 'passed', artifact }));

  let encodedUrl;
  const qrcode = () => ({
    addData: url => {
      encodedUrl = url;
    },
    make() {},
    getModuleCount: () => 1,
    isDark: () => true
  });
  const preview = await startPreview(folder, '127.0.0.1', qrcode);
  t.after(() => preview.server.close());
  assert.equal(preview.artifactSha256, artifact.sha256);
  assert.equal(encodedUrl, preview.url);
  assert.equal(fs.readFileSync(preview.qr).subarray(1, 4).toString(), 'PNG');
  fs.writeFileSync(path.join(folder, 'web/index.html'), '<p>changed</p>');
  const response = await fetch(preview.url);
  assert.equal(response.headers.get('X-Egret-Artifact-Sha256'), artifact.sha256);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), build.get('index.html'));
  const checked = await fetch(preview.url + '?revision=1', { method: 'HEAD' });
  assert.equal(checked.status, 200);
  assert.equal(checked.headers.get('Content-Length'), String(build.get('index.html').length));
  assert.equal(await checked.text(), '');
  const unlisted = await fetch(new URL('unlisted.json', preview.url));
  assert.equal(unlisted.status, 404);
  const report = await fetch(new URL('../report.json', preview.url));
  assert.equal(report.status, 404);
  await assert.rejects(startPreview(folder, '127.0.0.1'), { code: 'PLAYTEST_ARTIFACT_CHANGED' });
});
