// SPDX-License-Identifier: Apache-2.0
// Public SDK composition; all rendering belongs to the single Engine scene.
import {Sprite} from '@egret/engine';
import {createSequenceController} from '@egret/engine/animation';
import {createSpineInstance,createSpineDisplay} from '@egret/spine';
import {counts} from './content.mjs';
export function createOutfitScene(engine,asset,sheet,clip){
 const scope=engine.createScope(),players=[],sequences=[],subscriptions=[],events=[];let disposed=false;
 const record=event=>{events.push(event);if(events.length>80)events.shift();};
 try{
  const background=scope.use(new Sprite());background.graphics.beginFill(0x18243a).drawRect(0,0,640,400).endFill();engine.stage.addChild(background);
  // Each row interleaves five Spine nodes, fifty sequence nodes, then an Engine rail.
  for(let row=0;row<4;row++){
   for(let col=0;col<5;col++){
    const index=row*5+col,owner=engine.createScope();scope.use(owner);
    const player=createSpineInstance(asset,owner,{maxSegments:16,onEvent:event=>record({owner:index,...event})}),display=createSpineDisplay(player,owner,{colorProfile:'egret-shared-linear/1'});
    display.node.x=64+col*128;display.node.y=55+row*96;engine.stage.addChild(display.node);
    player.setAnimation(0,'sway',{loop:true});player.setRate(index%2===0?1:.5);
    subscriptions.push(engine.clock.onTick(owner,tick=>{player.advance(tick);}));players.push({owner,player,display});
   }
   for(let col=0;col<50;col++){
    const index=row*50+col,owner=engine.createScope();scope.use(owner);const bitmap=owner.use(sheet.createBitmap('spark'));
    bitmap.x=16+col*12;bitmap.y=83+row*96;bitmap.scaleX=6;bitmap.scaleY=6;engine.stage.addChild(bitmap);
    const controller=createSequenceController(engine,owner,bitmap,clip,{profile:'egret.sequence-control/1',totalPlays:'infinite',rate:index%2===0?1:2});controller.start();sequences.push({owner,bitmap,controller});
   }
   const rail=scope.use(new Sprite());rail.graphics.beginFill(0x506580).drawRect(12,94+row*96,616,2).endFill();engine.stage.addChild(rail);
  }
  if(players.length!==counts.spine||sequences.length!==counts.sequences)throw Error('SCENE_COUNTS');
 }catch(error){scope.dispose();throw error;}
 const selected=index=>{if(!Number.isInteger(index)||index<0||index>=players.length)throw Error('PLAYER_SELECTION');if(disposed)throw Error('SCENE_CLOSED');return players[index].player;};
 return Object.freeze({
  edit(index,{outfit,animation,plays,paused,rate}={}){const p=selected(index);if(outfit!==undefined){if(!['default','cool-coat','warm-hat','both'].includes(outfit))throw Error('OUTFIT');p.setSkins(outfit==='default'?['default']:outfit==='both'?['default','cool-coat','warm-hat']:['default',outfit]);}if(animation!==undefined)p.setAnimation(0,animation,plays==='infinite'?{loop:true}:{plays:plays??2});if(paused!==undefined)p.setPaused(paused);if(rate!==undefined)p.setRate(rate);},
  inspect(){return {disposed,counts:{spine:players.filter(p=>!p.player.isDisposed).length,sequences:sequences.filter(s=>!s.controller.getStatus().isDisposed).length},players:players.map(p=>p.player.getSnapshot()),sequences:sequences.map(s=>s.controller.getStatus()),events:[...events],ownership:{scope:scope.state,playerScopes:players.map(p=>p.owner.state),sequenceScopes:sequences.map(s=>s.owner.state),displaysDisposed:players.map(p=>p.display.getStatus().isDisposed),bitmapsDisposed:sequences.map(s=>s.bitmap.isDisposed),subscriptionsDisposed:subscriptions.map(s=>s.isDisposed)}};},
  dispose(){if(disposed)return;disposed=true;scope.dispose();}
 });
}
