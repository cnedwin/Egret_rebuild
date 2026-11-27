// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClassicEditor, androidClassicEditor } from '../tools/egret-migrate/compat/text-input.mjs';

function setup() {
  const scope = new AbortController(),
    rows = [],
    sessions = [];
  const editor = createClassicEditor(
    scope.signal,
    (request, events) => {
      const s = {
        request,
        events,
        closed: false,
        write(value) {
          this.value = value;
        },
        close() {
          this.closed = true;
        }
      };
      sessions.push(s);
      return s;
    },
    (field, type) => rows.push([type, field.text]),
    e => {
      throw e;
    }
  );
  const field = () => ({
    text: '',
    type: 'input',
    stage: {},
    inputType: 'tel',
    restrict: '0-9',
    maxChars: 3,
    width: 100,
    height: 40,
    localToGlobal(x, y) {
      return { x, y };
    },
    size: 20,
    textColor: 0,
    fontFamily: 'sans-serif',
    textAlign: 'left'
  });
  return { scope, rows, editor, sessions, field: field(), next: field() };
}
test('reports real focus, edits after filtering, transfer and retirement only for the current field', () => {
  const { scope, rows, editor, sessions, field, next } = setup();
  editor.focus(field);
  assert.deepEqual(rows, []);
  sessions[0].events.focus();
  sessions[0].events.change('a42');
  assert.equal(sessions[0].value, '42');
  assert.deepEqual(rows, [
    ['focusIn', ''],
    ['change', '42']
  ]);
  editor.focus(next);
  assert.equal(sessions[0].closed, true);
  sessions[0].events.change('777');
  sessions[1].events.focus();
  sessions[1].events.change('3456');
  assert.deepEqual(rows.slice(-3), [
    ['focusOut', '42'],
    ['focusIn', ''],
    ['change', '345']
  ]);
  scope.abort();
  sessions[1].events.change('999');
  assert.equal(next.text, '345');
  assert.equal(sessions[1].closed, true);
});
test('the Android adapter waits for native focus, uses real updates, and reconciles the committed reply', async () => {
  let opts, done;
  const seen = [];
  const port = androidClassicEditor({
    editText(options) {
      opts = options;
      return new Promise(r => (done = r));
    }
  });
  port(
    { value: '', inputMode: 'tel', maxLength: 7 },
    {
      focus: () => seen.push('in'),
      change: v => seen.push(v),
      finish: () => seen.push('out'),
      fail: e => {
        throw e;
      }
    }
  );
  assert.deepEqual(seen, []);
  opts.onFocus();
  opts.onChange('2');
  done({ status: 'confirmed', text: '25' });
  await Promise.resolve();
  assert.deepEqual(seen, ['in', '2', '25', 'out']);
  assert.equal(opts.inputMode, 'tel');
});
