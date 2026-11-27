// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  androidEnvironment,
  androidLog,
  browserEnvironment,
  legacyHost
} from '../tools/egret-migrate/compat/host-environment.mjs';
import * as sdk from '@egret/engine';
import { createLegacyBindings } from '../tools/egret-migrate/legacy-web.mjs';

test('hash identifiers, dictionary and screen constants match the supplied Egret 5 SDK', {
  skip: !process.env.EGRET_LEGACY_MODULES && 'Supply a trusted Egret 5 SDK modules directory.'
}, () => {
  const ctx = vm.createContext({ console });
  vm.runInContext('window=this;self=this;', ctx);
  const file = path.join(process.env.EGRET_LEGACY_MODULES, 'egret/egret.js');
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }).runInContext(ctx);
  function values(api) {
    const first = new api.HashObject(),
      second = new api.HashObject(),
      map = api.createMap();
    map.__proto__ = 42;
    return [
      first.hashCode > 0,
      first.hashCode === first.$hashCode,
      second.hashCode - first.hashCode,
      Object.getPrototypeOf(map) === null,
      map.__proto__,
      new api.HashObject().__class__,
      ...[
        'NO_SCALE',
        'SHOW_ALL',
        'NO_BORDER',
        'EXACT_FIT',
        'FIXED_WIDTH',
        'FIXED_HEIGHT',
        'FIXED_NARROW',
        'FIXED_WIDE'
      ].map(key => api.StageScaleMode[key]),
      ...['AUTO', 'PORTRAIT', 'LANDSCAPE', 'LANDSCAPE_FLIPPED'].map(key => api.OrientationMode[key]),
      ...['WEB', 'NATIVE', 'RUNTIME2', 'WXGAME'].map(key => api.RuntimeType[key])
    ];
  }
  assert.deepEqual(values(legacyHost({ signal: new AbortController().signal }, {}, {})), values(ctx.egret));
});

test('capabilities use the active backend and device, including iPad desktop user agent', () => {
  const cases = [
    [{ userAgent: 'Windows NT 10.0', platform: 'Win32' }, 'Windows PC', false],
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 16)', userAgentData: { mobile: true } }, 'Android', true],
    [{ platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Mac OS' }, 'iOS', true],
    [{ platform: 'MacIntel', maxTouchPoints: 0, userAgent: 'Mac OS' }, 'Mac OS', false],
    [{ platform: 'Linux x86_64' }, 'Unknown', false]
  ];
  for (const [navigator, os, mobile] of cases) {
    const web = browserEnvironment({ navigator }, 'webgl2', 'fixedWidth');
    assert.deepEqual(
      [web.runtimeType, web.os, web.isMobile, web.renderMode, web.scaleMode],
      ['web', os, mobile, 'webgl', 'fixedWidth']
    );
  }
  assert.equal(browserEnvironment({}, 'webgpu', 'cover').renderMode, 'webgpu');
  const native = androidEnvironment();
  assert.deepEqual(
    [native.runtimeType, native.os, native.isMobile, native.renderMode, native.scaleMode],
    ['native', 'Android', true, 'gles3', 'showAll']
  );
});

test('classic stage and capabilities are scoped, policies are read from the mount, and logs preserve receivers', async () => {
  const engine = await sdk.createEngine({
    host: {
      surface: {},
      start() {},
      stop() {},
      async close() {},
      setTimeout() {
        return () => {};
      }
    }
  });
  const scope = engine.createScope(),
    notes = [],
    sink = {
      log(...args) {
        notes.push([this === sink, ...args]);
      }
    };
  let size = { width: 320, height: 180 },
    change;
  const game = {
    scope,
    engine,
    stage: engine.stage,
    pointer: { events: { tap: sdk.createEventType('tap', { bubbles: true }) } },
    get screen() {
      return size;
    },
    onScreenChange(fn) {
      change = fn;
      return () => {
        change = undefined;
      };
    }
  };
  const env = browserEnvironment({ console: sink, navigator: { platform: 'Win32' } }, 'webgl2', 'fixedWidth');
  const {
    api: { egret }
  } = createLegacyBindings(
    sdk,
    game,
    { width: 320, height: 180, resources: { resources: [], groups: [] } },
    { environment: env, storage: () => ({}) }
  );
  const stage = egret.MainContext.instance.stage;
  assert.equal(stage, engine.stage.getChildAt(0));
  assert.equal(stage.scaleMode, egret.StageScaleMode.FIXED_WIDTH);
  assert.equal(stage.orientation, egret.OrientationMode.AUTO);
  assert.equal(egret.Capabilities.runtimeType, egret.RuntimeType.WEB);
  stage.orientation = 'auto';
  assert.throws(
    () => {
      stage.orientation = 'portrait';
    },
    { code: 'LEGACY_SCREEN_POLICY_FIXED' }
  );
  const events = [];
  stage.addEventListener(egret.Event.RESIZE, () => events.push([stage.stageWidth, stage.stageHeight]), null);
  size = { width: 320, height: 640 };
  change();
  assert.deepEqual(events, [[320, 640]]);
  const one = new egret.HashObject(),
    two = new egret.HashObject();
  assert.equal(two.hashCode, one.hashCode + 1);
  const swarm = [
    new egret.Sprite(),
    new egret.Sprite(),
    new egret.EventDispatcher(),
    new egret.Event('go'),
    new egret.Timer(100)
  ];
  assert.equal(new Set(swarm.map(v => v.hashCode)).size, swarm.length);
  assert.ok(
    swarm.every(v => v.hashCode > two.hashCode && v instanceof egret.HashObject && egret.is(v, 'egret.IHashObject'))
  );
  class Special extends egret.HashObject {}
  assert.equal(new egret.Sprite() instanceof Special, false);
  const dictionary = egret.createMap();
  dictionary.__proto__ = 'value';
  assert.equal(Object.getPrototypeOf(dictionary), null);
  egret.log('entered', 9);
  assert.deepEqual(notes, [[true, 'entered', 9]]);
  await engine.dispose();
  assert.equal(egret.MainContext.instance.stage, null);
  assert.equal(egret.Capabilities.os, undefined);
  assert.throws(() => stage.scaleMode, { code: 'LEGACY_BINDINGS_CLOSED' });
  egret.log('closed');
  assert.equal(notes.length, 1);
  assert.equal(change, undefined);
});

test('native logs use an optional sink and capture messages only on request', () => {
  const rows = [],
    sink = {
      warn(...args) {
        rows.push(args);
      }
    };
  const a = androidLog(sink);
  a.logger.warn('foo', 42);
  assert.deepEqual(rows, [['foo', 42]]);
  assert.deepEqual(a.snapshot(), { legacyLogCounts: { log: 0, warn: 1, error: 0 } });
  const b = androidLog(null, true);
  for (let i = 0; i < 35; i++) b.logger.log('item', i);
  assert.equal(b.snapshot().legacyLog.length, 32);
  assert.equal(b.snapshot().legacyLog[0].text, 'item 3');
  assert.equal(b.snapshot().legacyLogDropped, 3);
  const throwing = new Error();
  Object.defineProperty(throwing, 'message', {
    get() {
      throw Error('getter must not run');
    }
  });
  assert.doesNotThrow(() => b.logger.error(throwing));
  assert.equal(b.snapshot().legacyLog.at(-1).text, '[object]');
});
