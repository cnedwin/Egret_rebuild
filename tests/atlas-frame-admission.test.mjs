// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {egret,PROFILE,A,LA,LB,frames,input,fixture} from './atlas-frame-fixture.mjs';
const refusal=(fn,code,cause)=>assert.throws(fn,error=>{
 assert.ok(error instanceof Error);assert.equal(error.code,code);
 if(code==='SEQ_READ_FAILED')assert.equal(error.name,'SequenceClipError');
 if(code.startsWith('SPRITE_SHEET_'))assert.ok(error instanceof egret.EgretError);
 if(cause!=='skip'){assert.ok(Object.hasOwn(error,'cause'));assert.equal(error.cause,cause);}
 return true;
});
// Break: default factories probe newly recognized metadata or change old region shape.
test('TR01 omitted and undefined profile leave unknown getters unread and four-field crops',async()=>{
 const f=await fixture();try{let reads=0;const fs=frames();
 for(const frame of fs)for(const key of ['layout','rotated','trimmed'])Object.defineProperty(frame,key,{get(){reads++;throw Error('extra');}});
 for(const profiles of [[],[undefined]]){
  assert.deepEqual(egret.createSpriteSheet(f.lease,fs,...profiles).getRegion('A'),A);
  const data={atlasWidth:6,atlasHeight:6,frames:fs.map(frame=>Object.create(null,Object.getOwnPropertyDescriptors(frame)))};
  for(const frame of data.frames)frame.durationSeconds=.125;
  const p=new egret.SequencePlayer(new egret.Bitmap(f.lease),egret.createSequenceClip(data,...profiles));
  assert.deepEqual(p.applyAt(0).region,A);
 }
 assert.equal(reads,0);
 }finally{await f.close();}
});
// Break: profile silently ignored, caller graph retained, layout not deeply frozen.
test('TR02 opt-in sheet and clip own frozen layouts for both rotation cases',async()=>{
 const f=await fixture();try{const fs=frames(),data=input(fs),sheet=egret.createSpriteSheet(f.lease,fs,PROFILE);
 const player=new egret.SequencePlayer(new egret.Bitmap(f.lease),egret.createSequenceClip(data,PROFILE));
 fs[0].layout.trimX=3;data.frames[1].layout.trimY=0;
 assert.deepEqual(sheet.getRegion('A'),{...A,layout:LA});
 assert.deepEqual(sheet.getRegion('B').layout,LB);
 for(const [time,want] of [[0,LA],[.125,LB]]){const s=player.applyAt(time);assert.deepEqual(s.region.layout,want);assert.ok(Object.isFrozen(s.region));assert.ok(Object.isFrozen(s.region.layout));}
 assert.ok(Object.isFrozen(sheet.getRegion('A').layout));
 sheet.dispose();assert.deepEqual(sheet.getRegion('A').layout,LA);
 }finally{await f.close();}
});
// Break: partial/inherited/nonrecord layout or coerced rotation admitted.
test('TR02 shape and integer geometry errors use factory-specific families',async()=>{
 const f=await fixture();try{
 const cases=[ [undefined,'INPUT'],[null,'INPUT'],[[], 'INPUT'],[{...LA,packedRotation:undefined},'REGION'],
 [Object.create(LA),'INPUT'],[{...LA,packedRotation:180},'REGION'],[{...LA,packedRotation:'90'},'REGION'],
 [{...LA,trimX:-1},'REGION'],[{...LA,trimX:3},'REGION'],[{...LA,trimY:Number.MAX_SAFE_INTEGER},'REGION'],
 [{...LA,sourceWidth:0},'REGION'],[{...LA,trimX:.5},'REGION'] ];
 for(const [layout,family] of cases){const fs=[{name:'A',...A,layout}];
 refusal(()=>egret.createSpriteSheet(f.lease,fs,PROFILE),'SPRITE_SHEET_'+family+'_INVALID','skip');
 refusal(()=>egret.createSequenceClip(input(fs),PROFILE),'SEQ_'+family+'_INVALID','skip');}
 const partial={...LA};delete partial.trimX;
 refusal(()=>egret.createSpriteSheet(f.lease,[{name:'A',...A,layout:partial}],PROFILE),'SPRITE_SHEET_INPUT_INVALID','skip');
 for(const value of [null,{},1,'trim-rotation-v2']){
 refusal(()=>egret.createSpriteSheet(f.lease,[],value),'SPRITE_SHEET_INPUT_INVALID','skip');
 refusal(()=>egret.createSequenceClip({},value),'SEQ_INPUT_INVALID','skip');}
 }finally{await f.close();}
});
// Break: sheet validates layout too early or clip stages later frames too early.
test('TR03 sheet stages across invalid layouts while clip refuses before next frame',async()=>{
 const f=await fixture();try{for(const bad of [undefined,null,[],{}])for(const cause of [undefined,Error('later')]){
 let reads=0;const later={...frames()[1],get x(){reads++;throw cause;}};
 const fs=[{name:'A',...A,layout:bad},later];
 refusal(()=>egret.createSpriteSheet(f.lease,fs,PROFILE),'SPRITE_SHEET_READ_FAILED',cause);assert.equal(reads,1);
 const data={atlasWidth:6,atlasHeight:6,frames:[{...fs[0],durationSeconds:.125},later]};reads=0;
 refusal(()=>egret.createSequenceClip(data,PROFILE),'SEQ_INPUT_INVALID','skip');assert.equal(reads,0);
 }}finally{await f.close();}
});
// Break: field order, exact undefined throw, successful resource termination is lost.
test('TR03 ordered own layout reads preserve exact causes and lease lifecycle priority',async()=>{
 const f=await fixture();try{const seen=[];const layout={};for(const key of Object.keys(LA))Object.defineProperty(layout,key,{get(){seen.push(key);return LA[key];}});
 const record={name:'A',...A,get layout(){seen.push('layout');return layout;}};
 egret.createSpriteSheet(f.lease,[record],PROFILE);assert.deepEqual(seen,['layout','sourceWidth','sourceHeight','trimX','trimY','packedRotation']);
 const throwing={...LA,get trimY(){throw undefined;}};
 refusal(()=>egret.createSpriteSheet(f.lease,[{name:'A',...A,layout:throwing}],PROFILE),'SPRITE_SHEET_READ_FAILED',undefined);
 refusal(()=>egret.createSequenceClip(input([{...A,layout:throwing}]),PROFILE),'SEQ_READ_FAILED',undefined);
 const terminal={...LA,get trimX(){f.lease.release();return 1;}};
 refusal(()=>egret.createSpriteSheet(f.lease,[{name:'A',...A,layout:terminal}],PROFILE),'ASSET_LEASE_RELEASED','skip');
 }finally{await f.close();}
});
