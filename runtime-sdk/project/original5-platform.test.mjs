// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { installOriginal5Platform } from './original5-platform.mjs';

function setup() {
  const events = [];
  const pending = [];
  const lifetime = new AbortController();
  class Dispatcher {
    dispatchEventWith(type) { events.push([type, this.response ?? this.data]); }
  }
  const egret = {
    EventDispatcher: Dispatcher, Event: { COMPLETE: 'complete' }, IOErrorEvent: { IO_ERROR: 'ioError' },
    BitmapData: class { constructor(source) { this.source = source; } },
    RuntimeType: {NATIVE:'native'}, Capabilities: {}, localStorage: {}
  };
  const services = {
    storage: { getItem: () => null, setItem() {}, removeItem() {} },
    signal: lifetime.signal,
    assets: { readText: (url, signal) => new Promise(resolve => pending.push({url, signal, resolve})) },
    raster: { async loadPng(path, width, height) { return {path, width, height}; } }
  };
  const display = { async imageSource(image) { return image; } };
  installOriginal5Platform(egret, services, display, [{path: 'res/a.png', width: 3, height: 2}]);
  return {egret, events, pending, lifetime};
}

test('5.x RES reads remain asynchronous, and stale local completions cannot replace the latest request', async () => {
  const {egret, events, pending} = setup();
  const req = new egret.HttpRequest();
  req.open('res/old.json', 'get'); req.send();
  await new Promise(resolve => setImmediate(resolve));
  req.open('res/current.json?v=v7', 'get'); req.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(pending[1].url, 'res/current.json');
  pending[0].resolve('stale'); pending[1].resolve('current');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, [['complete','current']]);
});

test('declared packaged images enter the original BitmapData and a missing image signals ioError', async () => {
  const {egret, events} = setup();
  const loader = new egret.ImageLoader();
  loader.load('res/a.png');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events[0][1].source, {path:'res/a.png',width:3,height:2});
  loader.load('res/missing.png');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events.map(e => e[0]), ['complete','ioError']);
});

test('closing the player disarms an in-flight request and refuses undeclared URL schemes', async () => {
  const {egret, events, pending, lifetime} = setup();
  const req = new egret.HttpRequest();
  req.open('res/config.json'); req.send();
  await new Promise(resolve => setImmediate(resolve));
  lifetime.abort();
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve('late');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.length, 0);
  const next = setup();
  const remote = new next.egret.HttpRequest();
  remote.open('https://example.invalid/level'); remote.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(next.events.map(e => e[0]), ['ioError']);
});
