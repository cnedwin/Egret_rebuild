// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prepareOriginal5 } from './prepare-original5.mjs';

test('preparing native input preserves published scripts in manifest order and preserves resource URLs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'egret-original5-'));
  try {
    const source = path.join(dir, 'published');
    await mkdir(source);
    const initial = ['egret.js','egret.web.js','eui.min.js'];
    const game = ['base.js','entry.js'];
    for (const name of [...initial,...game,'level.json']) await writeFile(path.join(source,name), '/* '+name+' */\r\n');
    await writeFile(path.join(source,'manifest.json'), JSON.stringify({initial,game}));
    const output = path.join(dir, 'ready');
    await prepareOriginal5(source, {entryClass:'menu.Main',width:480,height:270,assets:['level.json']}, output);
    const desc = JSON.parse(await readFile(path.join(output,'project.json')));
    const groups = desc.v8Scripts.groups;
    assert.equal(groups.originalCore.length, 1);
    assert.equal(groups.originalModules.length, 1);
    const scriptMap = JSON.parse(await readFile(path.join(output,'original-script-map.json')));
    assert.deepEqual(Object.values(scriptMap), ['egret.js','eui.min.js','base.js','entry.js']);
    assert.equal(scriptMap[groups.originalGame[1]], 'entry.js');
    for (const [n, member] of [[initial[0],groups.originalCore[0]],[initial[2],groups.originalModules[0]],
        ...game.map((name,index) => [name,groups.originalGame[index]])]) {
      assert.deepEqual(await readFile(path.join(output,member)), await readFile(path.join(source,n)));
    }
    assert.deepEqual(desc.assets,['level.json']);
    const bridge = 'export function installHost({defineGlobal, services}) { defineGlobal("locale", () => services.host.call("channel.locale", null)); }\n';
    await writeFile(path.join(source,'channel.mjs'), bridge);
    const withHost = path.join(dir,'host');
    await prepareOriginal5(source, {entryClass:'Main',width:2,height:2,hostAdapter:'channel.mjs'}, withHost);
    assert.equal(await readFile(path.join(withHost,'original-host.mjs'),'utf8'), bridge);
    assert.match(await readFile(path.join(withHost,'main.mjs'),'utf8'), /installHost: host\.installHost, remoteRequest: host\.remoteRequest/);
    await assert.rejects(prepareOriginal5(source, {entryClass:'Main',width:2,height:2,hostAdapter:'../channel.mjs'}, path.join(dir,'escape')));
    await assert.rejects(prepareOriginal5(source, {entryClass:'Main',width:2,height:2,assets:['../private.txt']}, path.join(dir,'bad')));
    await assert.rejects(readFile(path.join(dir,'bad','project.json')));
    await assert.rejects(prepareOriginal5(source, {entryClass:'Main',width:2,height:2}, output));
  } finally { await rm(dir, {recursive:true,force:true}); }
});
