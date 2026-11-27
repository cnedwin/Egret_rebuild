// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {createPlayerProject} from './player-project.mjs';

test('system overlays use the session host and cancel outstanding input on close', async () => {
  const calls = [];
  const replies = new Map();
  const canceled = [];
  const native = {
    hostStart(id, name, json) { calls.push({id, name, value: JSON.parse(json)}); return true; },
    hostCancel(id) { canceled.push(id); },
    hostTake(id) { const result = replies.get(id); replies.delete(id); return result; }
  };
  let services;
  const project = createPlayerProject({width: 4, height: 4, create(ctx) { services = ctx; return {}; }}, native);
  const finish = (index, value) => {
    const {id} = calls[index];
    replies.set(id, JSON.stringify(value));
    project.hostResult(id, true);
  };
  try {
    await project.start();
    const previous = services.waitForBack();
    const current = services.waitForBack();
    assert.equal(calls[0].name, 'egret.waitForBack');
    finish(0, false);
    finish(1, true);
    assert.deepEqual(await Promise.all([previous, current]), [false, true]);
    const edit = services.editText({text: '灯\n楼', multiline: true});
    assert.deepEqual(calls[2].value, {text: '灯\n楼', multiline: true});
    finish(2, {status: 'canceled'});
    assert.deepEqual(await edit, {status: 'canceled'});
    const playing = services.music.play('song.wav', {loop: false});
    assert.deepEqual(calls[3].value, {path: 'song.wav', loop: false});
    finish(3, true);
    assert.equal(await playing, true);
    const stopped = services.music.stop();
    assert.equal(calls[4].name, 'egret.music.stop');
    finish(4, true);
    await stopped;
    const pending = services.waitForBack();
    const error = assert.rejects(pending, {name: 'AbortError'});
    await project.close();
    await error;
    assert.deepEqual(canceled, [calls[5].id]);
    project.hostResult(calls[5].id, true);
  } finally { await project.close(); }
});
