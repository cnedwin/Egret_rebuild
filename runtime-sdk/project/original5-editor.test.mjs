// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { installOriginal5Editor } from './original5-editor.mjs';

test('original InputController events follow only the current Android editor', async () => {
  const log = [], calls = [];
  class Dispatcher { dispatchEventWith(name) { log.push(name); } }
  const egret = {EventDispatcher: Dispatcher, StageText: class {}};
  const previous = egret.StageText;
  const editor = installOriginal5Editor(egret, {
    signal: new AbortController().signal,
    editText(options, signal) {
      const gate = Promise.withResolvers();
      calls.push({options, signal, gate});
      return gate.promise;
    }
  });
  const field = new egret.StageText();
  field.$setTextField({stage: true, inputType: 'tel', maxChars: 6});
  field.$setText('12');
  field.$show();
  field.$show();
  assert.equal(calls.length, 1);
  const [first] = calls;
  assert.equal(first.options.inputMode, 'tel');
  assert.equal(first.options.maxLength, 6);
  first.options.onFocus();
  first.options.onChange('123');
  assert.equal(field.$getText(), '123');
  field.$removeFromStage();
  assert.ok(first.signal.aborted);
  field.$show();
  const second = calls[1];
  first.options.onChange('stale');
  first.gate.resolve({status: 'confirmed', text: 'stale'});
  second.options.onFocus();
  second.gate.resolve({status: 'confirmed', text: '456'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(field.$getText(), '456');
  assert.deepEqual(log, ['focus', 'updateText', 'blur', 'focus', 'updateText', 'blur']);
  field.$setTextField({stage: true, displayAsPassword: true});
  assert.throws(() => field.$show(), /secure native editor/);
  assert.equal(calls.length, 2);
  editor.close();
  assert.equal(egret.StageText, previous);
});

test('an EUI prompt is display text and does not consume the native input length', () => {
  class Dispatcher { dispatchEventWith() {} }
  let options;
  const egret = {EventDispatcher: Dispatcher};
  const editor = installOriginal5Editor(egret, {
    signal: new AbortController().signal,
    editText(value) { options = value; return new Promise(() => {}); }
  });
  const input = new egret.StageText();
  const owner = {stage:true, text:'', prompt:'Enter account', maxChars:10};
  input.$setTextField(owner);
  input.$setText(owner.prompt);
  input.$show();
  assert.equal(options.text, '');
  assert.equal(options.maxLength, 10);
  input.$hide();
  owner.text = 'Alan';
  input.$setText('Alan');
  input.$show();
  assert.equal(options.text, 'Alan');
  input.$hide();
  // EUI temporarily clears displayAsPassword while painting a placeholder.
  owner.$isShowPrompt = true;
  owner.$EditableText = [owner.prompt, 0, true];
  assert.throws(() => input.$show(), /secure native editor/);
  editor.close();
});
