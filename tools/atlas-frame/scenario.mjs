// SPDX-License-Identifier: Apache-2.0
// Literal independent actor, time and command expectations. Never generate pixel masks here.
export const PROFILES=Object.freeze(['canvas-2d','webgpu-textured-2d']);
export const KINDS=Object.freeze(['ordinary','rotation-sign','trim-y-constant']);
export const FIXTURE_ROUTE='/tools/atlas-frame/native-fixture.mjs';
export const HTML_ROUTE='/examples/trimmed-atlas-playback/__native-fixture.html';
const rows=[
  ['N01',0,0,'idle',0,0,'idle',0,0,0],
  ['N02',.125,1,'running',.125,1,'idle',0,0,0],
  ['N03',.125,1,'running',.125,1,'running',0,0,0],
  ['N04',.125,1,'paused',.125,1,'running',0,0,0],
  ['N05',.1875,2,'running',.125,1,'running',.0625,0,0],
  ['N06',.4375,3,'completed',.375,1,'running',.3125,1,0],
  ['N07',.5,4,'completed',.375,1,'running',.375,0,0],
  ['N08',.5,4,'completed',.375,1,'running',.375,0,1],
  ['N09',.5,4,'completed',.375,1,'running',.375,0,2],
  ['N10',.5,4,'completed',.375,1,'running',.375,0,0],
];
export const ORDINARY=Object.freeze(rows.map(([id,time,tick,leftState,leftElapsed,leftFrame,rightState,rightElapsed,rightFrame,view])=>
  Object.freeze({id,time,tick,leftState,leftElapsed,leftFrame,rightState,rightElapsed,rightFrame,view})));
const requireThat=(value,message)=>{if(!value)throw new Error(message);};
const equal=(actual,expected,label)=>requireThat(JSON.stringify(actual)===JSON.stringify(expected),label+' differs');
const crop=index=>index===0?{x:0,y:0,width:2,height:3}:{x:3,y:0,width:2,height:3};
const RIGHT_POSITIONS=Object.freeze({N01:0,N02:0,N03:0,N04:0,N05:.0625,N06:.3125,N07:0,N08:0,N09:0,N10:0});
const layout=index=>({sourceWidth:4,sourceHeight:5,trimX:1,trimY:index===0?1:2,packedRotation:index===0?0:90});
function matrix(actual,expected,tolerance,label){
  equal(Object.keys(actual).sort(),['a','b','c','d','tx','ty'].sort(),label+' keys');
  for(const key of Object.keys(expected))requireThat(Number.isFinite(actual[key])&&Math.abs(actual[key]-expected[key])<=tolerance,label+' '+key);
}
export function assertAtlasObservation(observation,id,kind='ordinary',role='healthy') {
  const row=kind==='ordinary'?ORDINARY.find(value=>value.id===id):ORDINARY[1];
  requireThat(row,'Known fixed row required');
  const {session,commands,images,profile}=observation;
  requireThat(PROFILES.includes(profile),'Exact capture profile required');
  equal([session.state,session.sourceSeconds,session.gameSeconds,session.tickId],['ready',row.time,row.time,row.tick],'Clock state');
  equal(session.ticks,[[.125,.125],[.1875,.0625],[.4375,.25],[.5,.0625]].slice(0,row.tick)
    .map(([elapsedSeconds,deltaSeconds],index)=>({tickId:index+1,elapsedSeconds,deltaSeconds})),'Actual ticks');
  requireThat(session.diagnostics.length===0&&session.cleanupErrors.length===0,'No session diagnostic or cleanup failure');
  requireThat(commands.length===2&&images.length>=1&&images.every(image=>image.width===6&&image.height===6&&image.byteLength===144),'Two genuine images using original atlas');
  for(const [index,id] of ['left','right'].entries()) {
    const actor=session.actors[id],frame=row[id+'Frame'],state=row[id+'State'],elapsed=row[id+'Elapsed'];
    equal([actor.mode,actor.state,actor.elapsed,actor.isDisposed,actor.bitmapDisposed],
      [index===0?'once':'loop',state,elapsed,state==='completed',false],id+' controller');
    equal([actor.naturalWidth,actor.naturalHeight],[4,5],id+' logical size');
    equal(actor.bounds,{x:0,y:0,width:4,height:5},id+' logical bounds');
    equal(actor.sourceRect,crop(frame),id+' packed crop');
    if(state==='idle')equal(actor.sample,null,id+' idle sample');
    else {
      requireThat(actor.sample?.frameIndex===frame,id+' actual sample');
      equal(actor.sample.region,{...crop(frame),layout:layout(frame)},id+' sample region');
      requireThat(actor.sample.atEnd===(index===0&&state==='completed'),id+' terminal flag');
      requireThat(actor.sample.positionSeconds===(index===0?row.leftElapsed:RIGHT_POSITIONS[row.id])
        &&actor.sample.stopped===false,id+' literal sample position/stop flag');
    }
    const transformed=index===0&&row.view>0;
    equal(actor.parent,{x:index===0?2:12,y:2,rotation:transformed?90:0,anchorOffsetX:transformed?1:0,
      anchorOffsetY:transformed?1:0,clipRect:index===0&&row.view===2?{x:0,y:0,width:3,height:4}:null},id+' parent');
    const command=commands[index];
    requireThat(command.kind==='image'&&command.alpha===1&&Number.isSafeInteger(command.imageIndex)&&images[command.imageIndex],id+' public image command');
    equal(command.rect,{x:0,y:0,width:2,height:3},id+' packed draw rect');
    equal(command.sourceRect,crop(frame),id+' command source crop');
    let expected=frame===0?{a:1,b:0,c:0,d:1,tx:index===0?3:13,ty:3}
      :{a:0,b:-1,c:1,d:0,tx:index===0?3:13,ty:6};
    if(transformed)expected={a:1,b:0,c:0,d:1,tx:-1,ty:2};
    if(index===0&&role==='assigned') {
      requireThat(kind!=='ordinary','Assigned ordinary refused');
      if(kind==='rotation-sign')expected={a:0,b:1,c:1,d:0,tx:3,ty:6};
      else expected={a:0,b:-1,c:1,d:0,tx:3,ty:5};
    }
    matrix(command.matrix,expected,transformed?1e-12:0,id+' image matrix');
    if(index===0&&row.view===2) {
      requireThat(command.clips.length===1,'One original parent clip required');
      matrix(command.clips[0].matrix,{a:0,b:1,c:-1,d:0,tx:3,ty:1},1e-12,'Parent clip matrix');
      equal(command.clips[0].rect,{x:0,y:0,width:3,height:4},'Parent clip rect');
    } else equal(command.clips,[],id+' empty clips');
  }
  return true;
}
export function expectedIds(kind){return kind==='ordinary'?[...ORDINARY.map(row=>row.id),'N11']:[kind+':healthy',kind+':assigned'];}
export function assertAtlasRetirement(retired){
  requireThat(retired?.state==='closed'&&retired.stage===true&&retired.clock==='closed','Actual original owners must be terminal');
  for(const key of ['controllers','bitmaps','sheets','leases','textures'])requireThat(Array.isArray(retired[key])&&retired[key].length>0
    &&retired[key].every(value=>value===true),'Actual retired owner observations required '+key);
  requireThat(retired.cleanupErrors===0&&Array.isArray(retired.cleanupFailures)&&retired.cleanupFailures.length===0
    &&Array.isArray(retired.diagnostics)&&retired.diagnostics.length===0,'Post-cleanup diagnostic/failure stream must be empty');
  return true;
}
