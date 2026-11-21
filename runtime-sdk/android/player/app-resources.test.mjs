// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';
import { writeAppResources } from './app-resources.mjs';

async function workspace(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'egret-release-resources-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  return dir;
}

test('Android branding preserves app labels as literal strings and versions as data', async t => {
  const dir = await workspace(t);
  const icon = path.join(dir, 'brand.png');
  const pixels = PNG.sync.write(new PNG({width: 64, height: 64}));
  await writeFile(icon, pixels);
  const versionName = "1.0-测试+'preview'";
  await writeAppResources(dir, {id: 'org.example.demo', name: '@灯  塔 & "友" \'路\'\\50%',
    icon, 'version-code': '2', 'version-name': versionName});
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'egret-app.json'), 'utf8')),
    {applicationId: 'org.example.demo', versionCode: 2, versionName});
  const label = await readFile(path.join(dir, 'src/main/res/values/strings.xml'), 'utf8');
  assert.ok(label.includes(String.raw`"@灯  塔 &amp; \"友\" \'路\'\\50%"`));
  assert.deepEqual(await readFile(path.join(dir, 'src/main/res/mipmap-nodpi/egret_launcher.png')), pixels);
});

test('default Android metadata keeps both existing debug layouts usable', async t => {
  for (const [layout, name] of [['standalone', 'Egret Game'], ['embedded', 'Egret Game Library']]) {
    const dir = await workspace(t);
    await writeAppResources(dir, {id: 'org.example.game', layout});
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'egret-app.json'), 'utf8')),
      {applicationId: 'org.example.game', versionCode: 1, versionName: '1.0'});
    assert.ok((await readFile(path.join(dir, 'src/main/res/values/strings.xml'), 'utf8')).includes('"' + name + '"'));
  }
});

test('Android export rejects invalid version codes, XML text and malformed launcher images', async t => {
  const dir = await workspace(t);
  for (const code of ['0', '-1', '1.2', '10x', '2147483648']) {
    await assert.rejects(writeAppResources(dir, {id: 'org.example.game', 'version-code': code}), /version-code/);
  }
  await assert.rejects(writeAppResources(dir, {id: 'org.example.game', name: 'Game\0'}), /name/);
  const icon = path.join(dir, 'broken.png');
  const writeIcon = () => writeAppResources(dir, {id: 'org.example.game', icon});
  await writeFile(icon, PNG.sync.write(new PNG({width: 2, height: 3})));
  await assert.rejects(writeIcon(), /square PNG/);
  await writeFile(icon, PNG.sync.write(new PNG({width: 4, height: 4})).subarray(0, 30));
  await assert.rejects(writeIcon());
});
