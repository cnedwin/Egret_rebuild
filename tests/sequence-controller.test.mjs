// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {scene,summary,events,expectCode,MARKERS,egret} from './sequence-controller-fixture.mjs';

test('SQC01 optional public profile exposes one controller factory',async()=>{
  const result=await import('@egret/engine/animation').then(value=>({value}),error=>({error}));
  assert.equal(result.error,undefined,'SEQUENCE_CONTROL_PUBLIC_ENTRY_REQUIRED');
  assert.deepEqual(Object.keys(result.value).sort(),['createSequenceController']);
});
test('SQC02 literal two-instance four-color schedule commits ordered events and finite final frame',async()=>{
  const f=await scene();try{
    const ae=[],be=[],a=f.controller({totalPlays:2,markers:MARKERS,onEvent:e=>{ae.push(e);}});
    const b=f.controller({totalPlays:'infinite',rate:2,markers:MARKERS,onEvent:e=>{be.push(e);}},f.target());
    assert.deepEqual(summary(a),[0,0,0,undefined,'idle']);f.engine.advanceTime(0);a.start();b.start();
    assert.deepEqual(events(ae),[['zero',0,0]]);assert.deepEqual(events(be),[['zero',0,0]]);
    const rows=[
      [0.25,[0.25,0,0.25,1,'running'],[0.5,0,0.5,2,'running']],
      [0.5,[0.5,0,0.5,2,'running'],[1,1,0,0,'running']],
      [0.75,[0.75,0,0.75,3,'running'],[1.5,1,0.5,2,'running']],
      [1,[1,1,0,0,'running'],[2,2,0,0,'running']],
    ];
    for(const [time,ar,br]of rows){f.engine.advanceTime(time);assert.deepEqual(summary(a),ar);assert.deepEqual(summary(b),br);}
    b.pause();a.setRate(2);f.engine.advanceTime(1.25);assert.deepEqual(summary(a),[1.5,1,0.5,2,'running']);
    f.engine.advanceTime(1.5);assert.deepEqual(summary(a),[2,1,1,3,'completed']);assert.equal(a.getStatus().isDisposed,true);
    assert.deepEqual(events(ae),[['zero',0,0],['half',0,0.5],['halfAgain',0,0.5],['end',0,1],['zero',1,1],['half',1,1.5],['halfAgain',1,1.5],['end',1,2],['complete',2,2]]);
    assert.deepEqual(summary(b),[2,2,0,0,'paused']);b.seek({timeSeconds:0.25});b.resume();
    f.engine.advanceTime(1.75);assert.deepEqual(summary(b),[0.75,0,0.75,3,'running']);
    f.engine.advanceTime(2);assert.deepEqual(summary(b),[1.25,1,0.25,1,'running']);
    assert.deepEqual(events(be).slice(-4),[['half',0,0.5],['halfAgain',0,0.5],['end',0,1],['zero',1,1]]);
    assert.deepEqual(ae.map(e=>e.sequence),[1,2,3,4,5,6,7,8,9]);assert.ok(ae.every(Object.isFrozen));
  }finally{await f.close();}
});
test('SQC03 silent seek consumes boundaries; replay is forward and finite completion is explicit',async()=>{
  const f=await scene();try{const es=[],c=f.controller({totalPlays:2,markers:MARKERS,onEvent:e=>{es.push(e);}});
    c.start();c.seek({timeSeconds:1});assert.deepEqual(summary(c),[1,1,0,0,'running']);assert.equal(es.length,1);
    c.seek({timeSeconds:1.1,replayEvents:true});assert.equal(es.length,1);
    expectCode(()=>c.seek({timeSeconds:0.25,replayEvents:true}),'ANIMATION_SEEK_BACKWARDS');
    c.seek({timeSeconds:0.25});c.seek({timeSeconds:1.25,replayEvents:true});
    assert.deepEqual(events(es).slice(1),[['half',0,0.5],['halfAgain',0,0.5],['end',0,1],['zero',1,1]]);
    c.seek({timeSeconds:2});assert.deepEqual(summary(c),[2,1,1,3,'completed']);assert.equal(es.length,5);
    expectCode(()=>c.seek({timeSeconds:0}),'ANIMATION_TERMINAL');
  }finally{await f.close();}
});
test('SQC04 zero rate and explicit resume retain paused time without implicit restart',async()=>{
  const f=await scene();try{const c=f.controller({rate:0,totalPlays:'infinite'});f.engine.advanceTime(0);c.start();
    assert.equal(c.getStatus().state,'paused');expectCode(()=>c.resume(),'ANIMATION_RATE_ZERO');
    f.engine.advanceTime(1);c.setRate(2);assert.equal(c.getStatus().state,'paused');c.resume();
    f.engine.advanceTime(1.25);assert.deepEqual(summary(c),[0.5,0,0.5,2,'running']);c.pause();
    f.engine.advanceTime(2);c.setRate(1);c.resume();f.engine.advanceTime(2.25);assert.equal(c.getStatus().elapsedSeconds,0.75);
    expectCode(()=>c.start(),'ANIMATION_ALREADY_STARTED');
  }finally{await f.close();}
});
test('SQC05 canonical nonbinary boundaries use exact B(k), preserving legacy modulo',async()=>{
  const f=await scene({durations:[0.1,0.1]});try{const es=[],c=f.controller({totalPlays:'infinite',markers:[{id:'zero',timeSeconds:0},{id:'end',timeSeconds:0.2}],onEvent:e=>{es.push(e);}});
    c.start();for(const [t,k,p,frame]of [[0.9999999999999999,4,0.19999999999999984,1],[1,5,0,0],[1.0000000000000002,5,2.220446049250313e-16,0],[0.6,2,0.19999999999999996,1],[0.6000000000000001,3,0,0]]){
      c.seek({timeSeconds:t});assert.deepEqual(summary(c),[t,k,p,frame,'running']);
    }
    c.seek({timeSeconds:0.75});c.seek({timeSeconds:1,replayEvents:true});assert.deepEqual(events(es).slice(1),[['end',3,0.8],['zero',4,0.8],['end',4,1],['zero',5,1]]);
    c.seek({timeSeconds:1.0000000000000002,replayEvents:true});assert.equal(es.length,5);
    const old=new egret.SequencePlayer(f.target(),f.clip,'loop');try{assert.equal(old.applyAt(1).frameIndex,1);}finally{old.dispose();}
    const fin=f.controller({totalPlays:5},f.target());fin.start();fin.seek({timeSeconds:1});assert.deepEqual(summary(fin),[1,4,0.2,1,'completed']);
  }finally{await f.close();}
});
test('SQC06 ordinary nonbinary clock interval agrees with seek and end-before-zero events',async()=>{
  const f=await scene({durations:[0.1,0.1]});try{const es=[],c=f.controller({totalPlays:'infinite',markers:[{id:'zero',timeSeconds:0},{id:'end',timeSeconds:0.2}],onEvent:e=>{es.push(e);}});
    f.engine.advanceTime(0);c.start();c.seek({timeSeconds:0.75});f.engine.advanceTime(0.25);
    assert.deepEqual(summary(c),[1,5,0,0,'running']);assert.deepEqual(events(es).slice(1),[['end',3,0.8],['zero',4,0.8],['end',4,1],['zero',5,1]]);
  }finally{await f.close();}
});
test('SQC07 tiny durations retain legal small positions and refuse enormous cycle work before apply',async()=>{
  const f=await scene({durations:[Number.MIN_VALUE,Number.MIN_VALUE]});try{
    const c=f.controller({totalPlays:'infinite'});c.start();c.seek({timeSeconds:2e-323});assert.deepEqual(summary(c),[2e-323,2,0,0,'running']);
    const before=c.getStatus();expectCode(()=>c.seek({timeSeconds:0.25}),'ANIMATION_TIME_LIMIT');
    assert.equal(c.getStatus().elapsedSeconds,before.elapsedSeconds);assert.equal(c.getStatus().lastSample,before.lastSample);
    const finite=f.controller({totalPlays:2},f.target());f.engine.advanceTime(0);finite.start();f.engine.advanceTime(0.25);
    assert.deepEqual(summary(finite),[2e-323,1,1e-323,1,'completed']);
  }finally{await f.close();}
});
test('SQC08 one transition accepts 1024 events and refuses 1025 atomically even without listener',async()=>{
  const f=await scene();try{const markers=Array.from({length:64},(_,i)=>({id:'m'+i,timeSeconds:0.5}));
    const ok=f.controller({markers,rate:16,totalPlays:'infinite'});const refused=f.controller({markers,rate:16,totalPlays:16},f.target());
    f.engine.advanceTime(0);ok.start();refused.start();f.engine.advanceTime(1);
    assert.equal(ok.getStatus().committedEventCount,1024);assert.equal(ok.getStatus().elapsedSeconds,16);
    assert.equal(refused.getStatus().elapsedSeconds,0);assert.equal(refused.getStatus().lastSample.frameIndex,0);
    assert.equal(refused.getStatus().lastIssue.code,'ANIMATION_EVENT_LIMIT');assert.equal(refused.getStatus().committedEventCount,0);
    refused.seek({timeSeconds:16});assert.equal(refused.getStatus().state,'completed');
  }finally{await f.close();}
});
test('SQC09 input capture refuses sparse, unknown, duplicate and nonfinite descriptors',async()=>{
  const f=await scene();try{
    for(const options of [{profile:'wrong'},{rate:-1},{rate:17},{rate:NaN},{totalPlays:0},{totalPlays:1.5},{totalPlays:1000001},{unknown:1},
      {markers:new Array(1)},{markers:Array.from({length:65},(_,i)=>({id:'m'+i,timeSeconds:0}))},
      {markers:[{id:'same',timeSeconds:0},{id:'same',timeSeconds:1}]},{markers:[{id:'0bad',timeSeconds:0}]},{markers:[{id:'x',timeSeconds:2}]},{markers:[{id:'x',timeSeconds:0,extra:1}]}]){
      expectCode(()=>f.controller(options),'ANIMATION_OPTIONS_INVALID');
    }
    const c=f.controller();expectCode(()=>c.pause(),'ANIMATION_NOT_STARTED');expectCode(()=>c.seek({timeSeconds:0}),'ANIMATION_NOT_STARTED');c.start();
    for(const request of [{timeSeconds:-1},{timeSeconds:Infinity},{timeSeconds:2},{timeSeconds:0,extra:1},{timeSeconds:0,replayEvents:1}]){
      assert.throws(()=>c.seek(request));assert.equal(c.getStatus().elapsedSeconds,0);
    }
  }finally{await f.close();}
});
test('SQC10 copied immutable inputs are read once and terminal facade preserves inert samples',async()=>{
  const f=await scene();try{let n=0,lengthReads=0;const marker={id:'x',timeSeconds:0.5};const array=new Proxy([marker],{get(t,k,r){if(k==='length')lengthReads++;return Reflect.get(t,k,r);}});
    const options={get rate(){n++;return 1;},markers:array};const es=[];options.onEvent=e=>{es.push(e);};const c=f.controller(options);
    assert.equal(n,1);assert.equal(lengthReads,1);marker.timeSeconds=0;array[0]={id:'other',timeSeconds:0};c.start();c.seek({timeSeconds:0.5,replayEvents:true});
    assert.deepEqual(events(es),[['x',0,0.5]]);assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.getStatus()));
    const prior=c.getStatus().lastSample;c.dispose();assert.equal(c.getStatus().lastSample,prior);c.dispose();c.stop();
    expectCode(()=>c.start.call({}),'ANIMATION_CONTROLLER_INVALID');expectCode(()=>c.getStatus.call({}),'ANIMATION_CONTROLLER_INVALID');
  }finally{await f.close();}
});

test('SQC11 positive scaled interval cannot silently underflow away',async()=>{
  const f=await scene();try{const c=f.controller({rate:Number.MIN_VALUE,totalPlays:'infinite'});f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.25);
    assert.equal(c.getStatus().elapsedSeconds,0);assert.equal(c.getStatus().lastIssue?.code,'ANIMATION_PRECISION_LIMIT');
  }finally{await f.close();}
});
test('SQC12 own descriptor admission preserves even an EgretError getter cause',async()=>{
  const f=await scene();try{const original=new egret.EgretError('ANIMATION_OPTIONS_INVALID');
    const error=expectCode(()=>f.controller({get rate(){throw original;}}),'ANIMATION_OPTIONS_INVALID');assert.equal(error.cause,original);
    const c=f.controller();c.start();const cause=new egret.EgretError('ANIMATION_SEEK_INVALID');
    assert.equal(expectCode(()=>c.seek({get timeSeconds(){throw cause;}}),'ANIMATION_SEEK_INVALID').cause,cause);
    const inherited=Object.create({profile:'egret.sequence-control/1'});
    expectCode(()=>f.factory(f.engine,f.scope,f.target(),f.clip,inherited),'ANIMATION_OPTIONS_INVALID');
  }finally{await f.close();}
});
test('SQC13 finite total duration admission retains the named time-limit refusal',async()=>{
  const f=await scene({durations:[2**32]});try{
    expectCode(()=>f.controller({totalPlays:2}),'ANIMATION_TIME_LIMIT');
    const c=f.controller({totalPlays:1});c.start();c.seek({timeSeconds:2**32});assert.equal(c.getStatus().state,'completed');
  }finally{await f.close();}
});
test('SQC14 late-started and completed handlers keep event/source/tick identity immutable',async()=>{
  const f=await scene();try{const es=[],c=f.controller({markers:[{id:'a',timeSeconds:0},{id:'b',timeSeconds:1}],onEvent(e){es.push(e);return Promise.reject(Error('rejected'));}});
    c.start();c.seek({timeSeconds:1,replayEvents:true});await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(es.map(e=>[e.kind,e.source,e.clockTickId,e.sequence]),[['marker','start',0,1],['marker','seek',0,2],['complete','seek',0,3]]);
    assert.equal(c.getStatus().state,'completed');assert.equal(c.getStatus().lastIssue.code,'ANIMATION_CALLBACK_RETURN_INVALID');
  }finally{await f.close();}
});
