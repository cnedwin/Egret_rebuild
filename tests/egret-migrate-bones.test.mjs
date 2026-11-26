// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { convertDragonBones } from '../tools/egret-migrate/dragonbones.mjs';
import { createLegacyBones } from '../tools/egret-migrate/legacy-bones.mjs';

// Original region rig: two bones, two slots in explicit draw order and independent transform channels.
function fixture() {
  return {
    skeleton: {
      name: 'fighter',
      version: '5.5',
      compatibleVersion: '5.5',
      frameRate: 8,
      armature: [
        {
          name: 'actor',
          type: 'Armature',
          bone: [
            { name: 'hand', parent: 'body', transform: { x: 4 } },
            { name: 'body', transform: { x: 10, y: 20 } }
          ],
          slot: [
            { name: 'weapon', parent: 'hand' },
            { name: 'shirt', parent: 'body' }
          ],
          skin: [
            {
              name: '',
              slot: [
                { name: 'weapon', display: [{ name: 'blade', transform: { x: 2 } }] },
                { name: 'shirt', display: [{ name: 'cloth' }] }
              ]
            }
          ],
          animation: [
            {
              name: 'swing',
              duration: 8,
              playTimes: 1,
              bone: [
                {
                  name: 'body',
                  translateFrame: [
                    { duration: 4, x: 0, tweenEasing: 0 },
                    { duration: 4, x: 8 }
                  ]
                },
                {
                  name: 'hand',
                  rotateFrame: [
                    { duration: 4, rotate: 0, tweenEasing: 0 },
                    { duration: 4, rotate: 90 }
                  ],
                  scaleFrame: [
                    { duration: 4, x: 1, y: 1, tweenEasing: -2 },
                    { duration: 4, x: 2, y: 1 }
                  ]
                }
              ],
              slot: [
                {
                  name: 'weapon',
                  displayFrame: [
                    { duration: 4, value: 0 },
                    { duration: 4, value: -1 }
                  ]
                },
                {
                  name: 'shirt',
                  colorFrame: [
                    { duration: 4, value: { aM: 100 }, tweenEasing: 0 },
                    { duration: 4, value: { aM: 50 } }
                  ]
                }
              ]
            },
            {
              name: 'idle',
              duration: 8,
              playTimes: 0,
              bone: [
                {
                  name: 'body',
                  frame: [
                    { duration: 4, transform: { x: 0 }, tweenEasing: 0 },
                    { duration: 4, transform: { x: 8 }, tweenEasing: 0 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    atlas: {
      name: 'fighterAtlas',
      imagePath: 'fighter.png',
      width: 8,
      height: 8,
      SubTexture: [
        { name: 'blade', x: 0, y: 0, width: 4, height: 2, frameWidth: 6, frameHeight: 4, frameX: -1, frameY: -1 },
        { name: 'cloth', x: 4, y: 0, width: 4, height: 4 }
      ]
    }
  };
}

function closeTo(value, target) {
  assert.ok(Math.abs(value - target) < 1e-8, value + ' differs from ' + target);
}

async function host() {
  const engine = await sdk.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
  });
  const scope = engine.createScope();
  const type = sdk.createAssetType('original-rig-page', sdk.isTexture);
  let allocated = 0,
    released = 0;
  engine.assets.register(type, {
    async load() {
      allocated++;
      return sdk.createTexture(sdk.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(255) }));
    },
    dispose(value) {
      released++;
      value.dispose();
    }
  });
  const lease = scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'sheet')));
  const token = Object.freeze({});
  const dragonBones = createLegacyBones({
    sdk,
    game: { engine, stage: engine.stage, scope },
    getTexture: value => (value === token ? lease : undefined)
  });
  return { engine, scope, token, dragonBones, counts: () => [allocated, released] };
}

function converted() {
  const { skeleton, atlas } = fixture();
  return convertDragonBones(skeleton, atlas);
}

test('DragonBones region export becomes native parent-first descriptors with original slot order and trim pivots', () => {
  const descriptor = converted(),
    armature = descriptor.armatures[0];
  assert.equal(descriptor.schema, 'egret.migrate-bones/1');
  assert.deepEqual(
    armature.bones.map(bone => [bone.name, bone.parent]),
    [
      ['body', -1],
      ['hand', 0]
    ]
  );
  assert.deepEqual(
    armature.slots.map(slot => slot.name),
    ['weapon', 'shirt']
  );
  assert.deepEqual(armature.slots[0].attachments[0].anchor, [2, 1]);
  assert.deepEqual(
    armature.clips[0].boneTracks[0].translate.map(frame => frame.frame),
    [0, 4]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(descriptor)), descriptor);
});

test('early 5.0 local-transform flags and explicit authored slot z order are preserved', () => {
  const { skeleton, atlas } = fixture();
  skeleton.version = skeleton.compatibleVersion = '5.0';
  skeleton.isGlobal = 0;
  skeleton.armature[0].slot[1].z = 1;
  assert.deepEqual(
    convertDragonBones(skeleton, atlas).armatures[0].slots.map(slot => slot.name),
    ['weapon', 'shirt']
  );
  skeleton.armature[0].slot[1].z = 0;
  assert.throws(() => convertDragonBones(skeleton, atlas), /sort order/);
});

test('native factory plays a parent-composed rig on the real engine clock, retaining one texture and reusing display slots', async () => {
  const instance = await host();
  try {
    const data = converted();
    const factory = instance.dragonBones.EgretFactory.factory;
    assert.equal(factory, instance.dragonBones.EgretFactory.factory);
    assert.deepEqual(factory.parseDragonBonesData(data).armatureNames, ['actor']);
    assert.throws(() => factory.buildArmatureDisplay('actor'), /matching native atlas/);
    factory.parseTextureAtlasData(data, instance.token);
    // Metadata mutation after registration cannot alter the runtime's independent model.
    data.armatures[0].bones[0].bind[0] = 100;
    const display = factory.buildArmatureDisplay('actor'),
      { animation } = display;
    assert.strictEqual(display.getArmature().display, display);
    const blade = display.getChildAt(0),
      shirt = display.getChildAt(1);
    assert.equal(blade.name, 'weapon');
    assert.equal(shirt.name, 'shirt');
    assert.deepEqual(blade.sourceRect, { x: 0, y: 0, width: 4, height: 2 });
    instance.engine.stage.addChild(display);
    animation.play('swing');
    instance.engine.advanceTime(0);
    instance.engine.advanceTime(0.125);
    instance.engine.advanceTime(0.25);
    const pivot = blade.localToGlobal(2, 1);
    closeTo(pivot.x, 18 + Math.sqrt(2));
    closeTo(pivot.y, 20 + Math.sqrt(2));
    closeTo(blade.rotation, 45);
    closeTo(shirt.alpha, 0.75);
    // An off-stage instance remains attachable but does not advance while detached.
    instance.engine.stage.removeChild(display);
    instance.engine.advanceTime(0.375);
    closeTo(animation.currentTime, 0.25);
    instance.engine.stage.addChild(display);
    instance.engine.advanceTime(0.5);
    instance.engine.advanceTime(0.625);
    assert.equal(blade.visible, false);
    closeTo(shirt.alpha, 0.5);
    instance.engine.advanceTime(0.75);
    instance.engine.advanceTime(0.875);
    instance.engine.advanceTime(1);
    instance.engine.advanceTime(1.125);
    assert.equal(animation.isCompleted, true);
    assert.equal(animation.isPlaying, false);
    assert.equal(animation.currentTime, 1);
    animation.play('idle', 0);
    assert.equal(blade.visible, true);
    assert.equal(display.getChildAt(0), blade);
    for (const time of [1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2, 2.125]) instance.engine.advanceTime(time);
    closeTo(animation.currentTime, 0);
    assert.equal(animation.isPlaying, true);
    closeTo(shirt.x, 10);
    animation.stop();
    instance.engine.advanceTime(2.25);
    closeTo(animation.currentTime, 0);
    display.dispose();
    assert.equal(blade.isDisposed, true);
    assert.equal(shirt.isDisposed, true);
    instance.engine.advanceTime(2.375);
    assert.deepEqual(instance.counts(), [1, 0]);
  } finally {
    await instance.engine.dispose();
  }
  assert.deepEqual(instance.counts(), [1, 1]);
});

test('native region conversion refuses unsupported DragonBones features rather than changing animations', () => {
  const changes = [
    [rig => (rig.skeleton.armature[0].bone[0].inheritScale = false), /inheritScale/],
    [rig => (rig.skeleton.armature[0].bone[1].parent = 'hand'), /cyclic/],
    [rig => (rig.skeleton.armature[0].skin[0].slot[0].display[0].type = 'mesh'), /image-region/],
    [rig => (rig.atlas.SubTexture[0].rotated = true), /rotated/],
    [rig => (rig.atlas.SubTexture[0].x = 7), /finite number/],
    [rig => (rig.skeleton.armature[0].animation[0].bone[0].translateFrame[0].curve = [0, 1, 0, 1]), /Bezier/],
    [rig => (rig.skeleton.armature[0].animation[0].bone[0].translateFrame[0].duration = 9), /after the clip/],
    [rig => (rig.skeleton.armature[0].animation[0].slot[1].colorFrame[0].value.rM = 1), /tint/]
  ];
  for (const [change, message] of changes) {
    const rig = fixture();
    change(rig);
    assert.throws(
      () => convertDragonBones(rig.skeleton, rig.atlas),
      error => error.code === 'MIGRATE_DRAGONBONES_UNSUPPORTED' && message.test(error.message)
    );
  }
});

test('factory requires a matching converted page and refuses malformed neutral data before building a display', async () => {
  const instance = await host();
  try {
    const factory = instance.dragonBones.EgretFactory.factory;
    assert.throws(() => factory.parseDragonBonesData(fixture().skeleton), /converted native bone descriptor/);
    const data = converted();
    data.armatures[0].bones[0].parent = 1;
    assert.throws(() => factory.parseDragonBonesData(data), /hierarchy/);
    assert.throws(() => factory.parseTextureAtlasData(converted(), {}), /matching admitted page/);
    assert.equal(instance.engine.stage.numChildren, 0);
  } finally {
    await instance.engine.dispose();
  }
});
