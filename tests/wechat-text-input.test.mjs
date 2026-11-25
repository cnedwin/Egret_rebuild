// SPDX-License-Identifier: Apache-2.0
// Text input through WeChat's keyboard: createWechatTextInput of @egret/engine/web/wechat-text-input, given a keyboard
// owned by the test that behaves as WeChat documents it. The keyboard is passed as an option; no global is replaced.
// WeChat itself, its keyboard and its input methods are met only on a phone or in WeChat DevTools, not here.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWechatTextInput } from '@egret/engine/web/wechat-text-input';

/** A keyboard as WeChat's: shown with its own field, telling of input, of its confirm key and of being closed. */
function keyboard({ tellsHide = true } = {}) {
  const listeners = { input: new Set(), confirm: new Set(), complete: new Set() };
  const calls = [];
  const later = [];
  let shown;
  const tell = (name, value) => [...listeners[name]].forEach(fn => fn({ value }));
  const wx = {
    showKeyboard(options) {
      calls.push(['show', { ...options, fail: typeof options.fail }]);
      shown = { value: options.defaultValue, confirmHold: options.confirmHold };
    },
    hideKeyboard() {
      calls.push(['hide']);
      const was = shown;
      shown = undefined;
      // WeChat tells of the keyboard closed after the call returns.
      if (was && tellsHide) later.push(() => tell('complete', was.value));
    },
    updateKeyboard({ value }) {
      calls.push(['update', value]);
      if (shown) shown.value = value;
    },
    onKeyboardInput: fn => listeners.input.add(fn),
    onKeyboardConfirm: fn => listeners.confirm.add(fn),
    onKeyboardComplete: fn => listeners.complete.add(fn),
    offKeyboardInput: fn => listeners.input.delete(fn),
    offKeyboardConfirm: fn => listeners.confirm.delete(fn),
    offKeyboardComplete: fn => listeners.complete.delete(fn)
  };
  return {
    wx,
    calls,
    listeners,
    get shown() {
      return shown;
    },
    /** The player types: the field's whole value is told. */
    type(text) {
      shown.value += text;
      tell('input', shown.value);
    },
    /** The confirm key: told, and the keyboard closes itself unless asked to stay, which is told after. */
    confirm() {
      const was = shown;
      tell('confirm', was.value);
      if (!was.confirmHold) {
        shown = undefined;
        later.push(() => tell('complete', was.value));
      }
    },
    /** The player closes the keyboard without the confirm key. */
    close() {
      const was = shown;
      shown = undefined;
      tell('complete', was.value);
    },
    /** What WeChat tells after the calls have returned. */
    settle() {
      for (const job of later.splice(0)) job();
    }
  };
}
const place = { x: 10, y: 20, width: 200, height: 40 };

// Break caught: a keyboard shown without the session's value, limit or kind of key, input not told as changes, or the
// confirm key not committing what was typed.
test('WT01 a session shows the keyboard, tells of what is typed and commits on the confirm key', () => {
  const k = keyboard();
  const input = createWechatTextInput({ keyboard: k.wx });
  const changes = [],
    commits = [];
  input.open({
    ...place,
    value: '仵作',
    maxLength: 8,
    enterKeyHint: 'send',
    onChange: change => changes.push(change),
    onCommit: value => commits.push(value)
  });
  assert.deepEqual(k.calls[0], [
    'show',
    { defaultValue: '仵作', maxLength: 8, multiple: false, confirmHold: true, confirmType: 'send', fail: 'function' }
  ]);
  assert.deepEqual(input.getSnapshot(), { state: 'open', value: '仵作', composing: false });
  k.type('验尸');
  assert.deepEqual(changes, [{ value: '仵作验尸', composing: false }]);
  k.confirm();
  assert.deepEqual(commits, ['仵作验尸']);
  assert.deepEqual(input.getSnapshot(), { state: 'idle', value: '', composing: false });
  k.settle();
  assert.deepEqual(commits, ['仵作验尸'], 'the keyboard closing after the confirm key ends nothing more');
  // A multiline session asks for a keyboard of several lines, whose confirm key also commits.
  input.open({ ...place, multiline: true, onCommit: value => commits.push(value) });
  assert.equal(k.calls.at(-1)[1].multiple, true);
  k.type('一\n二');
  k.confirm();
  assert.deepEqual(commits, ['仵作验尸', '一\n二']);
  input.dispose();
});

// Break caught: a keyboard closed by the player losing what was typed, or cancelling against what the game asked.
test('WT02 a keyboard the player closes commits, or cancels when the session asks', () => {
  const k = keyboard();
  const input = createWechatTextInput({ keyboard: k.wx });
  const told = [];
  input.open({ ...place, onCommit: value => told.push(['commit', value]), onCancel: () => told.push(['cancel']) });
  k.type('河边');
  k.close();
  input.open({
    ...place,
    blur: 'cancel',
    onCommit: value => told.push(['commit', value]),
    onCancel: () => told.push(['cancel'])
  });
  k.type('袖口');
  k.close();
  assert.deepEqual(told, [['commit', '河边'], ['cancel']]);
  // The game ends a session itself: the keyboard is closed, and WeChat's telling of that ends nothing more.
  input.open({ ...place, onCancel: () => told.push(['cancel 2']) });
  input.cancel();
  assert.deepEqual(k.calls.at(-1), ['hide']);
  k.settle();
  assert.deepEqual(told, [['commit', '河边'], ['cancel'], ['cancel 2']]);
  input.dispose();
});

// Break caught: the next field, opened when the last commits, ended at once by the closing of the keyboard before it.
test('WT03 a field opened from onCommit is not ended by the keyboard closed before it', () => {
  for (const ending of ['confirm', 'commit'])
    for (const tellsHide of [true, false]) {
      const k = keyboard({ tellsHide });
      const input = createWechatTextInput({ keyboard: k.wx });
      const told = [];
      input.open({
        ...place,
        onCommit: value => {
          told.push(['first', value]);
          input.open({
            ...place,
            onCommit: next => told.push(['second', next]),
            onCancel: () => told.push(['second cancelled'])
          });
        }
      });
      k.type('一');
      if (ending === 'confirm') k.confirm();
      else input.commit();
      k.settle();
      assert.equal(input.getSnapshot().state, 'open', ending + ': the second field is still open');
      k.shown ? k.type('二') : assert.fail('the second keyboard is shown');
      k.confirm();
      assert.deepEqual(told, [
        ['first', '一'],
        ['second', '二']
      ]);
      input.dispose();
    }
});

// Break caught: a limit counted in UTF-16 units, a value longer than the limit kept, or setValue not reaching the field.
test('WT04 the limit counts characters, and the field is given the value kept', () => {
  const k = keyboard();
  const input = createWechatTextInput({ keyboard: k.wx });
  const changes = [];
  input.open({ ...place, value: '😀😀😀', maxLength: 2, onChange: change => changes.push(change.value) });
  assert.equal(k.calls[0][1].defaultValue, '😀😀');
  k.type('a');
  assert.deepEqual(changes, [], 'nothing past the limit is a change');
  assert.deepEqual(k.calls.at(-1), ['update', '😀😀']);
  input.setValue('案卷');
  assert.deepEqual(k.calls.at(-1), ['update', '案卷']);
  assert.equal(input.getSnapshot().value, '案卷');
  // With no limit, the keyboard is asked for more than WeChat's 100 characters.
  input.open({ ...place });
  assert.equal(k.calls.filter(call => call[0] === 'show').at(-1)[1].maxLength, 65536);
  input.dispose();
});

// Break caught: listeners left on wx after dispose, a callback's error stopping the input, or a request accepted that
// the browser text input refuses.
test('WT05 dispose leaves nothing on wx; errors of callbacks are reported; what the browser input refuses is refused', () => {
  const k = keyboard();
  const errors = [];
  const input = createWechatTextInput({ keyboard: k.wx, onError: error => errors.push(error.message) });
  input.open({
    ...place,
    onChange: () => {
      throw new Error('change failed');
    }
  });
  k.type('x');
  assert.deepEqual(errors, ['change failed']);
  assert.equal(input.getSnapshot().state, 'open');
  // Place and size have nothing to place, but are checked as the browser input checks them.
  input.move({ x: 0, y: 0, width: 10, height: 10 });
  input.resize(720, 1280);
  input.sync();
  assert.throws(() => input.move({ x: 0, y: 0, width: 0, height: 10 }), { code: 'BROWSER_TEXT_INPUT_RECTANGLE' });
  input.dispose();
  assert.equal(input.getSnapshot().state, 'disposed');
  for (const set of Object.values(k.listeners)) assert.equal(set.size, 0);
  assert.throws(() => input.open({ ...place }), { code: 'BROWSER_TEXT_INPUT_DISPOSED' });
  const other = createWechatTextInput({ keyboard: k.wx });
  for (const bad of [
    { ...place, maxLength: 0 },
    { ...place, multiline: true, password: true },
    { ...place, blur: 'keep' },
    { ...place, width: 0 }
  ])
    assert.throws(() => other.open(bad), { code: 'BROWSER_TEXT_INPUT_REQUEST' });
  assert.throws(() => other.setValue('x'), { code: 'BROWSER_TEXT_INPUT_IDLE' });
  assert.throws(() => createWechatTextInput({ keyboard: {} }), { code: 'BROWSER_TEXT_INPUT_SURFACE' });
  // In Node there is no wx: the input needs one given.
  assert.throws(() => createWechatTextInput(), { code: 'BROWSER_TEXT_INPUT_SURFACE' });
  other.dispose();
});
