import assert from 'node:assert/strict';
import test from 'node:test';
import * as egret from '@egret/engine';

test('F01 public engine root exposes the exact textured profile literal', () => {
  // Existing public capabilities must initialize before the new assertion.
  assert.equal(typeof egret.createEngine, 'function');
  assert.equal(typeof egret.createTexturedGeometry2D, 'function');
  assert.equal(typeof egret.isTexturedGeometry2D, 'function');
  assert.equal(typeof egret.Mesh2D, 'function');
  assert.equal(egret.TEXTURED_FRAME_PROFILE_2D, 'egret.textured-frame2d/1',
    'missing exact public textured frame profile literal');
});
