// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureViewport,createMountQueue} from '../examples/mobile/viewport.mjs';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
test('mobile viewport distinguishes CSS geometry from bounded backing density',()=>{
  assert.deepEqual(measureViewport(358.8,3,'resources'),{width:358,height:358*2/3,density:2});
  assert.deepEqual(measureViewport(700,1.25,'ui'),{width:700,height:520,density:1.25});
  assert.equal(measureViewport(2000,NaN,'paragraph').width,960);
  assert.equal(measureViewport(240,0,'pointers').density,1);
  for(const width of [0,-1,Infinity,NaN])assert.throws(()=>measureViewport(width,1,'ui'),RangeError);
});
test('resizing snapshots the previous owner before abort and restores model without overlapping owners',async()=>{
  const events=[];let live=0,maximum=0;
  const queue=createMountQueue(async(viewport,signal,model)=>{
    maximum=Math.max(maximum,++live);events.push(['mount',viewport.width,model]);
    signal.addEventListener('abort',()=>events.push(['abort',viewport.width]));
    return {snapshot(){events.push(['snapshot',viewport.width]);return {selected:7};},inspect(){return viewport;},async close(){events.push(['close',viewport.width]);live--;}};
  });
  await queue.request({width:300});await queue.request({width:600});await queue.close();
  assert.equal(maximum,1);assert.equal(live,0);
  assert.deepEqual(events.slice(1,5),[['snapshot',300],['abort',300],['close',300],['mount',600,{selected:7}]]);
  assert.equal(queue.inspect().state,'closed');
});
test('a superseded initialization is disposed before the latest mount starts',async()=>{
  const started=deferred(),release=deferred(),events=[];
  const queue=createMountQueue(async(viewport,signal,model)=>{
    events.push(['start',viewport.width]);
    if(viewport.width===100){started.resolve();await release.promise;assert.equal(signal.aborted,true);}
    return {snapshot(){return {width:viewport.width};},inspect(){return viewport;},close(){events.push(['close',viewport.width]);}};
  });
  const first=queue.request({width:100});await started.promise;
  queue.request({width:200});queue.request({width:300});release.resolve();await first;
  assert.deepEqual(events,[['start',100],['close',100],['start',300]]);
  assert.equal(queue.inspect().application.width,300);await queue.close();
});
test('close during initialization revokes authority and prevents later publication',async()=>{
  const started=deferred(),release=deferred();let closed=0;
  const queue=createMountQueue(async(_viewport,signal)=>{
    started.resolve();await release.promise;assert.equal(signal.aborted,true);
    return {snapshot(){return {};},inspect(){return {unexpected:true};},close(){closed++;}};
  });
  queue.request({width:300});await started.promise;const closing=queue.close();release.resolve();await closing;
  assert.equal(closed,1);assert.equal(queue.inspect().state,'closed');assert.equal(queue.inspect().application,null);
  await queue.request({width:900});assert.equal(closed,1);
});
test('failed initialization stays visible and can retry on a later viewport',async()=>{
  const queue=createMountQueue(async(viewport)=>{if(viewport.width===1)throw Error('INIT_FAILED');return {inspect(){return viewport;},close(){}};});
  await queue.request({width:1});assert.equal(queue.inspect().state,'failed');assert.deepEqual(queue.inspect().errors,['INIT_FAILED']);
  await queue.request({width:2});assert.equal(queue.inspect().state,'ready');await queue.close();
});
test('snapshot failure still closes its owner',async()=>{
  let closed=0;
  const queue=createMountQueue(async()=>({snapshot(){throw Error('SNAPSHOT_FAILED');},close(){closed++;}}));
  await queue.request({width:100});await assert.rejects(queue.request({width:200}),/SNAPSHOT_FAILED/);
  assert.equal(closed,1);assert.equal(queue.inspect().state,'failed');await queue.close();
});

test('idle includes a resize started while an application operation is pending',async()=>{
  const entered=deferred(),release=deferred();
  const queue=createMountQueue(async viewport=>({inspect(){return viewport;},close(){},async whenIdle(){if(viewport.width===100){entered.resolve();await release.promise;}}}));
  await queue.request({width:100});const idle=queue.whenIdle();await entered.promise;
  await queue.request({width:200});release.resolve();await idle;
  assert.equal(queue.inspect().application.width,200);await queue.close();
});
test('cleanup failure during aborted initialization blocks replacement rather than publishing ready',async()=>{
  const entered=deferred(),release=deferred();let mounts=0;
  const queue=createMountQueue(async(_viewport,signal)=>{mounts++;entered.resolve();await release.promise;if(signal.aborted)throw new AggregateError([Error('native unsafe')],'CLEANUP_FAILED');});
  const initial=queue.request({width:100});await entered.promise;
  const replacement=queue.request({width:200});
  const first=assert.rejects(initial,/CLEANUP_FAILED/),second=assert.rejects(replacement,/CLEANUP_FAILED/);release.resolve();await Promise.all([first,second]);
  assert.equal(mounts,1);assert.equal(queue.inspect().state,'failed');assert.equal(queue.inspect().blocked,true);
  await assert.rejects(queue.request({width:300}),/CLEANUP_FAILED/);await queue.close();
});

test('a viewport request in the completion microtask is not stranded behind the old pump',async()=>{
 let queue;queue=createMountQueue(async viewport=>({inspect(){return viewport;},close(){}}),value=>{
  if(value.state==='ready'&&value.revision===1)queueMicrotask(()=>{void queue.request({width:200});});
 });
 await queue.request({width:100});await queue.whenIdle();
 assert.equal(queue.inspect().application.width,200);await queue.close();
});

test('close in the completion microtask awaits terminal retirement',async()=>{
 let queue,closing,closed=0;const release=deferred();
 queue=createMountQueue(async()=>({inspect(){return {};},async close(){await release.promise;closed++;}}),value=>{
  if(value.state==='ready')queueMicrotask(()=>{closing=queue.close();release.resolve();});
 });
 await queue.request({width:100});await closing;
 assert.equal(closed,1);assert.equal(queue.inspect().state,'closed');
});
