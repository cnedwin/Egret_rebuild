// SPDX-License-Identifier: Apache-2.0
import {DisplayObjectContainer} from '@egret/engine';
import {createSequenceController} from '@egret/engine/animation';
import {createMeshGeometry3D, createSceneFrame3D} from '@egret/engine/scene3d';
import {createSpineDisplay, createSpineInstance, createSpineResetSlot} from '@egret/spine';
import {skins} from './project.mjs';

export const frameOptions = Object.freeze({width:960,height:520,clearColor:0x10192c,clearAlpha:1,outputAlpha:'opaque'});

function backdrop() {
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const quad = (left, right, bottom, top, z, color) => ({
    geometry:createMeshGeometry3D({positions:[left,top,z,right,top,z,right,bottom,z,left,bottom,z],
      colors:[...color,...color,...color,...color],indices:[0,1,2,0,2,3]}),
    modelView:identity
  });
  return createSceneFrame3D({
    projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:9},
    draws:[quad(-.125,.875,-.625,.5,-3,[.1875,.3125,.5]),quad(-.25,.9375,-.75,.6875,-7,[.125,.1875,.3125])]
  });
}

export function createStudioScene(engine, scope, characters, spineAssets, {sheet,clip}) {
  const actors = new Map();
  const scene = backdrop();
  for (const [index, character] of characters.entries()) {
    const borrowed = scope.use(engine.createScope());
    const target = scope.use(new DisplayObjectContainer());
    Object.assign(target, {x:530+240*index,y:272,scaleX:4,scaleY:4});
    const animation = index === 0 ? 'sway' : 'rise';
    const instance = createSpineInstance(spineAssets.get(character.palette), borrowed);
    instance.setSkins(skins(character.outfit));
    instance.setAnimation(0, animation, {loop:true});
    const display = createSpineDisplay(instance, borrowed, {colorProfile:'egret-shared-linear/1'});
    target.addChild(display.node);
    engine.stage.addChild(target);
    const slot = createSpineResetSlot(engine, scope, target, {version:character.palette,instance,display});
    actors.set(character.id, {borrowed,slot,animation});
  }
  const bitmap = scope.use(sheet.createBitmap('spark'));
  Object.assign(bitmap, {x:641,y:390,scaleX:20,scaleY:20});
  engine.stage.addChild(bitmap);
  const sequence = createSequenceController(engine, scope, bitmap, clip, {profile:'egret.sequence-control/1',totalPlays:'infinite'});
  sequence.start();
  engine.clock.onTick(scope, tick => {
    for (const {slot} of actors.values()) slot.getActive().instance.advance(tick);
  });

  return Object.freeze({
    scene,
    setOutfit(id, outfit) { actors.get(id).slot.getActive().instance.setSkins(skins(outfit)); },
    requestPalette(character, palette, loader) {
      const {slot,animation} = actors.get(character.id);
      return slot.request({policy:'reset',version:palette,loader,assetId:'e_character',animation,skins:skins(character.outfit),loop:true});
    },
    retireBorrowed(id) {
      // A RESET slot owns its replacement. The application retires its original borrowed instance.
      const actor = actors.get(id);
      actor.borrowed?.dispose();
      actor.borrowed = undefined;
    },
    inspect() {
      return {
        actors:[...actors].map(([id,{slot}]) => {
          if (slot.isDisposed) return {id,closed:true};
          const active = slot.getActive();
          return {id,palette:active.version,ownership:active.ownership,playback:active.instance.getSnapshot()};
        }),
        sequence:sequence.getStatus()
      };
    }
  });
}
