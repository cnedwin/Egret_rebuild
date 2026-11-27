// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openLegacyAndroid } from '../tools/egret-migrate/compat/android.mjs';
import { createPlayerProject } from '../runtime-sdk/project/player-project.mjs';
import { prepareCourier } from '../runtime-sdk/examples/legacy-courier/prepare.mjs';

test('deferred classic entry uses a single engine for EUI, packaged RES, touch, save and close', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-native-legacy-')),
    directory = path.join(tmp, 'game');
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  prepareCourier(directory);
  let preparedTheme = false;
  const uploads = [],
    released = [],
    scripts = [],
    saved = new Map();
  let owner, raster, failure, mount, mounted;
  globalThis.EgretRuntimeScripts = {
    async loadGroup(name) {
      assert(globalThis.egret?.DisplayObjectContainer && globalThis.eui?.Label && globalThis.RES?.loadGroup);
      assert(preparedTheme, 'prepare the theme against the installed bindings before running the business group');
      if (scripts.includes(name)) return;
      scripts.push(name);
      Function(fs.readFileSync(path.join(directory, 'courier.js'), 'utf8'))();
    }
  };
  t.after(() => {
    delete globalThis.CourierMain;
    delete globalThis.courierObservation;
    delete globalThis.EgretRuntimeScripts;
  });
  const native = {
    page(id) {
      uploads.push(id);
    },
    releasePage(id) {
      released.push(id);
    },
    saveRead(key) {
      return JSON.stringify({ value: saved.get(key) ?? null });
    },
    saveWrite(key, value) {
      saved.set(key, value);
      return true;
    },
    raster(raw) {
      const job = JSON.parse(raw);
      if (job.op === 'measure') return JSON.stringify({ widths: job.runs.map(run => run.text.length * run.size) });
      if (job.op === 'textMetrics')
        return JSON.stringify({
          metrics: job.runs.map(run => ({
            width: run.text.length * run.size,
            ascent: run.size,
            descent: 2,
            left: 0,
            top: -run.size,
            right: run.text.length * run.size,
            bottom: 0
          }))
        });
      if (!['png', 'text', 'textOutline'].includes(job.op)) throw new Error('Unexpected raster request ' + job.op);
      return JSON.stringify({ pixels: Buffer.alloc(job.width * job.height * 4).toString('base64') });
    }
  };
  const session = createPlayerProject(
    {
      width: 320,
      height: 180,
      async create(services) {
        owner = services.engine;
        raster = services.raster;
        mount = () =>
          openLegacyAndroid(
            { ...services, assets: { readText: name => fs.readFileSync(path.join(directory, name), 'utf8') } },
            {
              width: 320,
              height: 180,
              projectId: 'p_routes_fixture',
              scriptGroup: 'courier',
              entry: 'CourierMain',
              resources: {
                configUrl: 'resource/routes.res.json',
                root: 'resource/',
                resources: [
                  { name: 'routes_json', url: 'routes.json', type: 'json' },
                  ...['north', 'south'].map(name => ({ name: name + '_png', type: 'image', url: name + '.png' }))
                ],
                groups: [{ name: 'routes', keys: ['routes_json', 'north_png', 'south_png'] }]
              },
              images: ['north', 'south'].map((name, i) => ({ url: name + '.png', page: i + 1, width: 8, height: 8 })),
              async prepareTheme(api) {
                assert.equal(api.eui, globalThis.eui);
                assert.equal(api.RES, globalThis.RES);
                await Promise.resolve();
                preparedTheme = true;
              },
              theme: JSON.parse(fs.readFileSync(path.join(directory, 'theme.json'))),
              onError(cause) {
                failure = cause;
              }
            }
          );
        mounted = await mount();
        return mounted;
      }
    },
    native
  );
  try {
    await session.start();
    assert.deepEqual(scripts, ['courier']);
    assert.equal(owner.stage.numChildren, 1);
    assert.deepEqual(globalThis.courierObservation, {
      selected: 0,
      heading: '北门驿站',
      markerWidth: 8,
      saved: null,
      routeLoaded: true,
      controls: 3
    });
    const event = type => session.input({ type, id: 0, x: 64, y: 90 });
    event('down');
    session.pause();
    session.resume();
    event('up');
    assert.equal(globalThis.courierObservation.selected, 0);
    event('down');
    event('up');
    assert.equal(globalThis.courierObservation.heading, '南门渡口');
    assert.equal(globalThis.courierObservation.saved, '1');
    await new Promise(resolve => setImmediate(resolve));
    session.frame(0, 1);
    assert.equal(failure, undefined);
    mounted.close();
    assert.equal(owner.stage.numChildren, 0);
    const previousUploads = [...uploads];
    await assert.rejects(mount, { code: 'LEGACY_ANDROID_NEW_VIEW_REQUIRED' });
    assert.equal(owner.stage.numChildren, 0);
    assert.deepEqual(uploads, previousUploads);
    assert.deepEqual(scripts, ['courier']);
    assert.equal(globalThis.courierObservation.saved, '1');
    assert.equal('egret' in globalThis, false);
  } finally {
    await session.close();
  }
  assert.equal('egret' in globalThis, false);
  assert.equal('eui' in globalThis, false);
  assert.equal(raster.textPageUsage().occupied, 0);
  assert.deepEqual([...uploads].sort(), [...released].sort());
});

test('close while the script group is pending removes only the namespaces installed by this owner', async t => {
  let entered, resume;
  const waiting = new Promise(resolve => {
    entered = resolve;
  });
  globalThis.EgretRuntimeScripts = {
    loadGroup() {
      entered();
      return new Promise(resolve => {
        resume = resolve;
      });
    }
  };
  t.after(() => {
    delete globalThis.EgretRuntimeScripts;
  });
  const session = createPlayerProject(
    {
      width: 20,
      height: 20,
      create: s =>
        openLegacyAndroid(s, {
          width: 20,
          height: 20,
          projectId: 'p_close',
          scriptGroup: 'late',
          entry: 'LateMain'
        })
    },
    {
      raster() {
        throw new Error('Unexpected raster');
      }
    }
  );
  const starting = session.start();
  await waiting;
  assert(globalThis.egret);
  const closing = session.close();
  assert.equal('egret' in globalThis, false);
  resume();
  await assert.rejects(starting);
  await closing;
});

test('closing during asynchronous theme registration prevents the business group from starting', async t => {
  let begin, finish;
  const entered = new Promise(resolve => {
    begin = resolve;
  });
  globalThis.EgretRuntimeScripts = {
    loadGroup() {
      assert.fail('closed view loaded its business group');
    }
  };
  t.after(() => {
    delete globalThis.EgretRuntimeScripts;
  });
  const session = createPlayerProject(
    {
      width: 20,
      height: 20,
      create: services =>
        openLegacyAndroid(services, {
          width: 20,
          height: 20,
          projectId: 'p_theme_close',
          scriptGroup: 'entry',
          entry: 'Main',
          theme: { skins: {}, exmls: [] },
          async prepareTheme({ eui }) {
            assert.equal(eui, globalThis.eui);
            begin();
            await new Promise(resolve => {
              finish = resolve;
            });
          }
        })
    },
    {
      raster() {
        throw new Error('unexpected draw');
      }
    }
  );
  const starting = session.start();
  await entered;
  const closed = session.close();
  finish();
  await assert.rejects(starting);
  await closed;
  assert.equal('eui' in globalThis, false);
});
