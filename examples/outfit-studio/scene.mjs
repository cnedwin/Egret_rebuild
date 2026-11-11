// SPDX-License-Identifier: Apache-2.0
import {DisplayObjectContainer} from '@egret/engine';
import {createSequenceController} from '@egret/engine/animation';
import {createMeshGeometry3D, createSceneFrame3D} from '@egret/engine/scene3d';
import {createSpineDisplay, createSpineInstance, createSpineResetSlot} from '@egret/spine';
import {skins} from './project.mjs';
import {workload} from './workload.mjs';

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

export function createStudioScene(engine, scope, characters, spineAssets, {sheet,clip}, profile) {
  const actors = new Map(), sequences = [];
  const scene = backdrop();
  const root = profile ? scope.use(new DisplayObjectContainer()) : engine.stage;
  const camera = profile ? root.addChild(new DisplayObjectContainer()) : root;
  let map;
  if (profile) engine.stage.addChild(root);

  for (const [index, character] of characters.entries()) {
    const borrowed = scope.use(engine.createScope());
    const target = scope.use(new DisplayObjectContainer());
    Object.assign(target, {x:530+240*index,y:272,scaleX:4,scaleY:4});
    const animation = index%2 ? 'rise' : 'sway';
    const instance = createSpineInstance(spineAssets.get(character.palette), borrowed);
    instance.setSkins(skins(character.outfit));
    instance.setAnimation(0, animation, {loop:true});
    if (profile) instance.setAnimation(1,'trim',{loop:true});
    const display = createSpineDisplay(instance, borrowed, {colorProfile:'egret-shared-linear/1'});
    target.addChild(display.node);
    camera.addChild(target);
    const slot = createSpineResetSlot(engine, scope, target, {version:character.palette,instance,display});
    actors.set(character.id, {borrowed,slot,animation,target,index,x:target.x});
  }
  const sequenceCount = profile ? workload.sequences : 1;
  for (let index = 0; index < sequenceCount; index++) {
    const bitmap = scope.use(sheet.createBitmap('spark'));
    Object.assign(bitmap, {x:641,y:390,scaleX:20,scaleY:20});
    camera.addChild(bitmap);
    const controller = createSequenceController(engine, scope, bitmap, clip, {profile:'egret.sequence-control/1',totalPlays:'infinite'});
    controller.start();
    if (index) controller.seek({timeSeconds:index/sequenceCount});
    sequences.push({bitmap,controller});
  }
  engine.clock.onTick(scope, tick => {
    for (const {slot} of actors.values()) slot.getActive().instance.advance(tick);
  });

  function layout(value) {
    map = value.map;
    Object.assign(root,{x:map.x,y:map.y,clipRect:{x:0,y:0,width:map.width,height:map.height}});
    const scale = Math.min(map.width/176,map.height/118);
    for (const actor of actors.values()) {
      const {target,index} = actor;
      actor.x = ((index%4+.5)/4-.5)*map.width;
      Object.assign(target,{x:actor.x,y:(index<4 ? -.23 : .18)*map.height,scaleX:scale,scaleY:scale});
    }
    for (const [index,{bitmap}] of sequences.entries()) {
      Object.assign(bitmap,{x:((index%20+.6)/20-.5)*map.width,y:(Math.floor(index/20)*.215-.31)*map.height,
        scaleX:Math.max(2,scale*1.25),scaleY:Math.max(2,scale*1.25)});
    }
    camera.x = map.width/2;
    camera.y = map.height/2;
  }
  if (profile) layout(profile);
  let moved;
  return Object.freeze({
    scene,root,layout,
    applyView(pose,selected,holds) {
      Object.assign(camera,{x:map.width/2+pose.x,y:map.height/2+pose.y,scaleX:pose.scale,scaleY:pose.scale,rotation:pose.rotation});
      if (moved && moved !== selected) actors.get(moved).target.x = actors.get(moved).x;
      const actor = actors.get(selected);
      actor.target.x = actor.x + Math.sin(holds/19)*Math.min(22,map.width/18);
      moved = selected;
    },
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
      if (profile) actor.slot.getActive().instance.setAnimation(1,'trim',{loop:true});
    },
    inspect() {
      return {
        actors:[...actors].map(([id,{slot}]) => {
          if (slot.isDisposed) return {id,closed:true};
          const active = slot.getActive();
          return {id,palette:active.version,ownership:active.ownership,playback:active.instance.getSnapshot(),
            ...(profile ? {render:active.display.getStatus()} : {})};
        }),
        sequence:sequences[0].controller.getStatus(),
        ...(profile ? {sequences:sequences.map(({controller}) => controller.getStatus().positionSeconds)} : {})
      };
    }
  });
}
