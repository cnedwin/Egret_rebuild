// SPDX-License-Identifier: Apache-2.0
// Optional public-API CPU benchmark: 100 independent Spine displays, no GPU or timing gate.
// After building: node packages/spine/test/bench-display.mjs [new-result.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createEngine} from '@egret/engine';
import {createSpineContentLoader,createSpineInstance,createSpineDisplay} from '@egret/spine';
import {fixture,ports,atlas} from './fixtures.mjs';
import {renderingSource} from './renderingFixture.mjs';
import {host} from '../../../tests/helpers.mjs';
const [out,...extra]=process.argv.slice(2);
assert.equal(extra.length,0);
const skeleton=renderingSource({mesh:true,weighted:true,tint:true});
for(let i=0;i<10;i++){
  const name='bench-'+i,which=i%2?'blue':'red';
  skeleton.bones.push({name,parent:'root',x:i%5*3,y:Math.floor(i/5)*4});
  skeleton.slots.push({name,bone:name,attachment:which,color:i%3?'80ff8080':'ffffffff',dark:i%2?'804020':'000000'});
  skeleton.skins[0].attachments[name]={[which]:{path:which,width:8,height:8}};
}
const data=fixture({skeleton,atlasText:atlas}),p=ports(data);
const diagnostics=[],engine=await createEngine({host:host().adapter,onDiagnostic:d=>diagnostics.push(d.code)});
const loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory);
const group=loader.load(engine.createScope(),['e_json']);
await group.ready;
const asset=group.getSpine('e_json'),players=[],displays=[];
let events=0,tickId=0;
const eventHash=createHash('sha256');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
try{
  for(let i=0;i<100;i++){
    const ply=createSpineInstance(asset,engine.createScope(),{onEvent:e=>{events++;eventHash.update(JSON.stringify(e));}}),
      view=createSpineDisplay(ply,engine.createScope(),{colorProfile:'egret-shared-linear/1'});
    view.node.x=(i%10)*24;view.node.y=Math.floor(i/10)*20;
    engine.stage.addChild(view.node);
    ply.setAnimation(0,'move',{loop:true});
    players.push(ply);displays.push(view);
  }
  const step=()=>{
    const id=++tickId,tick={tickId:id,elapsedSeconds:id/60,deltaSeconds:1/60};
    const a=performance.now();for(const player of players)player.advance(tick);
    const b=performance.now(),frame=engine.captureSharedFrame({width:320,height:240}),c=performance.now();
    return {advance:b-a,capture:c-b,total:c-a,frame};
  };
  for(let n=0;n<18;n++)step();
  const samples=[];
  const checkpoint=[];
  for(let round=0;round<3;round++){
    const rows=[];
    for(let n=0;n<35;n++){const {advance,capture,total,frame}=step();rows.push({advance,capture,total});if(n===34){
      checkpoint.push({tickId,commands:frame.commands.length,geometries:frame.geometries.length,vertices:frame.geometries.reduce((n,g)=>n+g.vertexCount,0),
        indices:frame.geometries.reduce((n,g)=>n+g.indexCount,0),drawDigest:digest([frame.commands,frame.geometries,frame.materials]),
        semanticDigest:digest(players.map(x=>x.getSnapshot())),displayDigest:digest(displays.map(x=>x.getStatus())),events});
    }}
    samples.push(rows);
  }
  const stat=x=>{const a=[...x].sort((a,b)=>a-b);const v=q=>a[Math.min(a.length-1,Math.floor((a.length-1)*q))];return{median:v(.5),p95:v(.95),max:a.at(-1)};};
  const stats=rows=>Object.fromEntries(['advance','capture','total'].map(k=>[k,stat(rows.map(x=>x[k]))]));
  const result={scope:'headless CPU only; original numerical fixture; 100 independently advanced displays; fixed 1/60 seconds',node:process.version,
    setup:{displays:players.length,bonesPerDisplay:skeleton.bones.length,slotsPerDisplay:skeleton.slots.length,warmup:18,rounds:3,framesPerRound:35,backend:'captureSharedFrame without GPU'},
    checkpoints:checkpoint,eventDigest:eventHash.digest('hex'),diagnostics,perRound:samples.map(stats),aggregate:stats(samples.flat()),samples};
  assert.deepEqual(diagnostics,[]);
  assert.equal(players.length,100);
  for(const row of checkpoint){
    assert.equal(row.commands,1200);assert.equal(row.vertices,4800);assert.equal(row.indices,7200);
  }
  const json=JSON.stringify(result,null,2)+'\n';
  if(out)fs.writeFileSync(out,json,{flag:'wx'});
  else process.stdout.write(json);
}finally{await loader.close();await engine.dispose();}
