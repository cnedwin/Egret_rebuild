// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {scene,summary,events,expectCode,MARKERS} from './sequence-controller-fixture.mjs';

test('SCL01 two-phase coordinator commits later instance before earlier listener observes it',async()=>{
  const f=await scene();try{let b;const seen=[];const a=f.controller({markers:[{id:'half',timeSeconds:0.5}],onEvent(){seen.push(b.getStatus().elapsedSeconds);}});
    b=f.controller({totalPlays:'infinite'},f.target());f.engine.advanceTime(0);a.start();b.start();f.engine.advanceTime(0.5);assert.deepEqual(seen,[0.5]);
  }finally{await f.close();}
});
test('SCL02 listener controls apply next tick after old-rate interval, not subscriber order',async()=>{
  const f=await scene();try{let b;const a=f.controller({totalPlays:'infinite',markers:[{id:'half',timeSeconds:0.5}],onEvent(){b.pause();}});
    b=f.controller({totalPlays:'infinite'},f.target());f.engine.advanceTime(0);a.start();b.start();f.engine.advanceTime(0.5);
    assert.equal(b.getStatus().state,'running');assert.equal(b.getStatus().pendingCommands,1);
    expectCode(()=>b.resume(),'ANIMATION_COMMANDS_PENDING');f.engine.advanceTime(0.75);
    assert.deepEqual(summary(b),[0.75,0,0.75,3,'paused']);assert.equal(b.getStatus().pendingCommands,0);
  }finally{await f.close();}
});
test('SCL03 public handlers on either side of coordinator cannot apply ordinary controls in same tick',async()=>{
  const f=await scene();try{let c;f.engine.clock.onTick(f.scope,()=>{if(f.engine.clock.tickId===1)c.setRate(2);});
    c=f.controller({totalPlays:'infinite'});f.engine.clock.onTick(f.scope,()=>{if(f.engine.clock.tickId===1)c.pause();});
    f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.25);assert.deepEqual(summary(c),[0.25,0,0.25,1,'running']);assert.equal(c.getStatus().pendingCommands,2);
    f.engine.advanceTime(0.5);assert.deepEqual(summary(c),[0.5,0,0.5,2,'paused']);assert.equal(c.getStatus().rate,2);
  }finally{await f.close();}
});
test('SCL04 prior clock callback failure is caught up using authentic elapsed time',async()=>{
  const f=await scene();try{let first=true;f.engine.clock.onTick(f.scope,()=>{if(first){first=false;throw Error('earlier');}});
    const c=f.controller({totalPlays:'infinite'});f.engine.advanceTime(0);c.start();expectCode(()=>f.engine.advanceTime(0.25),'CLOCK_CALLBACK_FAILED');
    assert.equal(c.getStatus().elapsedSeconds,0);f.engine.advanceTime(0.5);assert.deepEqual(summary(c),[0.5,0,0.5,2,'running']);
  }finally{await f.close();}
});
test('SCL05 outside silent seek replaces queued intent and diagnostic callback stays guarded',async()=>{
  let c;const seen=[];const f=await scene({onDiagnostic(d){if(d.code==='ANIMATION_COMMANDS_REPLACED'){seen.push(c.getStatus().elapsedSeconds);c.setRate(2);}}});
  try{c=f.controller({totalPlays:'infinite',markers:[{id:'x',timeSeconds:0.5}],onEvent(){c.pause();}});f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.5);
    c.seek({timeSeconds:0.25});assert.deepEqual(seen,[0.25]);assert.equal(c.getStatus().state,'running');assert.equal(c.getStatus().pendingCommands,1);
    f.engine.advanceTime(0.75);assert.equal(c.getStatus().elapsedSeconds,0.5);assert.equal(c.getStatus().rate,2);
  }finally{await f.close();}
});
test('SCL06 listener exceptions and hostile then returns retain commits and other instances',async()=>{
  const f=await scene();try{let bad;const es=[];const c=f.controller({markers:MARKERS,onEvent(e){es.push(e.id??e.kind);if(e.kind==='marker'&&e.id==='half')throw Error('listener');if(e.kind==='marker'&&e.id==='halfAgain')return {get then(){bad.pause();throw Error('then');}};}});
    bad=f.controller({totalPlays:'infinite'},f.target());f.engine.advanceTime(0);c.start();bad.start();f.engine.advanceTime(0.5);
    assert.deepEqual(es,['zero','half','halfAgain']);assert.equal(c.getStatus().elapsedSeconds,0.5);assert.equal(bad.getStatus().elapsedSeconds,0.5);assert.equal(bad.getStatus().pendingCommands,1);
    assert.equal(f.diagnostics.filter(d=>d.code==='ANIMATION_CALLBACK_FAILED').length,1);f.engine.advanceTime(0.75);assert.equal(bad.getStatus().state,'paused');
  }finally{await f.close();}
});
test('SCL07 immediate stop revokes later same-batch events including completion',async()=>{
  const f=await scene();try{const es=[];let c;c=f.controller({markers:MARKERS,onEvent(e){es.push(e.id??e.kind);if(e.id==='half')c.stop();}});
    c.start();c.seek({timeSeconds:1,replayEvents:true});assert.deepEqual(es,['zero','half']);assert.equal(c.getStatus().state,'completed');assert.equal(c.getStatus().isDisposed,true);
    assert.equal(c.getStatus().committedEventCount,5);
  }finally{await f.close();}
});
test('SCL08 closing first application Scope leaves other controller clock alive and fully releases slots',async()=>{
  const f=await scene();try{const second=f.engine.createScope();const a=f.controller({totalPlays:'infinite'}),b=f.controller({totalPlays:'infinite'},f.target(),second);
    f.engine.advanceTime(0);a.start();b.start();f.scope.dispose();assert.equal(a.getStatus().state,'stopped');f.engine.advanceTime(0.25);assert.equal(b.getStatus().elapsedSeconds,0.25);b.stop();
    const slots=[];for(let i=0;i<256;i++)slots.push(f.engine.clock.onTick(second,()=>undefined));for(const sub of slots)sub.dispose();
  }finally{await f.close();}
});
test('SCL09 clock exhaustion rolls back creation; 64 controller limit releases on terminal retirement',async()=>{
  const f=await scene();try{const subs=Array.from({length:256},()=>f.engine.clock.onTick(f.scope,()=>undefined));
    expectCode(()=>f.controller(),'CLOCK_CALLBACK_LIMIT');for(const s of subs)s.dispose();
    const cs=[f.controller({totalPlays:'infinite'})];for(let i=1;i<64;i++)cs.push(f.controller({totalPlays:'infinite'},f.target()));
    const spare=f.target();expectCode(()=>f.controller({},spare),'ANIMATION_CONTROLLER_LIMIT');cs[0].stop();const replacement=f.controller({},spare);
    for(const c of cs)c.dispose();replacement.dispose();
    const full=Array.from({length:256},()=>f.engine.clock.onTick(f.scope,()=>undefined));full.forEach(s=>s.dispose());
  }finally{await f.close();}
});
test('SCL10 invalid binding faults one controller while its peer commits and earlier events remain immutable',async()=>{
  const f=await scene();try{const es=[],a=f.controller({totalPlays:'infinite',markers:MARKERS,onEvent(e){es.push(e);}}),b=f.controller({totalPlays:'infinite'},f.target());
    f.engine.advanceTime(0);a.start();b.start();const saved=es[0];f.bitmap.dispose();f.engine.advanceTime(0.5);
    assert.equal(a.getStatus().state,'faulted');assert.equal(a.getStatus().lastIssue.code,'ANIMATION_BINDING_INVALID');assert.equal(b.getStatus().elapsedSeconds,0.5);
    assert.deepEqual(saved,{kind:'marker',id:'zero',markerIndex:0,playIndex:0,timelineSeconds:0,positionSeconds:0,clockTickId:0,sequence:1,source:'start'});
  }finally{await f.close();}
});
test('SCL11 option/seek getter reentry refuses; thrown accessor preserves original cause',async()=>{
  const f=await scene();try{let c=f.controller({totalPlays:'infinite'});c.start();const original=Error('getter');
    const error=expectCode(()=>c.seek({get timeSeconds(){c.pause();return 0;}}),'ANIMATION_REENTRANT');assert.equal(error.code,'ANIMATION_REENTRANT');
    assert.equal(c.getStatus().state,'running');const e=expectCode(()=>c.seek({get timeSeconds(){throw original;}}),'ANIMATION_SEEK_INVALID');assert.equal(e.cause,original);
  }finally{await f.close();}
});
test('SCL12 bounded queue refuses seventeenth command; invalid compound preserves all intents until explicit replacement',async()=>{
  const f=await scene();try{let c;let limit;c=f.controller({totalPlays:'infinite',markers:[{id:'x',timeSeconds:0.25}],onEvent(){for(let i=0;i<16;i++)c.setRate(1);try{c.setRate(2);}catch(e){limit=e.code;}}});
    f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.25);assert.equal(limit,'ANIMATION_COMMAND_LIMIT');assert.equal(c.getStatus().pendingCommands,16);f.engine.advanceTime(0.5);assert.equal(c.getStatus().pendingCommands,0);
    c.stop();let d;d=f.controller({markers:[{id:'z',timeSeconds:0}],onEvent(){d.start();}},f.target());d.start();assert.equal(d.getStatus().pendingCommands,1);f.engine.advanceTime(0.75);
    assert.equal(d.getStatus().elapsedSeconds,0);assert.equal(d.getStatus().lastIssue.code,'ANIMATION_COMMAND_INVALID');assert.equal(d.getStatus().pendingCommands,1);
    d.seek({timeSeconds:0.5});assert.equal(d.getStatus().pendingCommands,0);
  }finally{await f.close();}
});
test('SCL13 ordinary completion wins queued controls and Scope abort revokes before reverse cleanup',async()=>{
  const f=await scene();try{let c;c=f.controller({markers:[{id:'half',timeSeconds:0.5}],onEvent(){c.pause();}});f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.5);f.engine.advanceTime(1);
    assert.equal(c.getStatus().state,'completed');assert.equal(c.getStatus().pendingCommands,0);assert.ok(f.diagnostics.some(d=>d.code==='ANIMATION_TERMINAL_COMMAND'));
    const d=f.controller({totalPlays:'infinite'},f.target());d.start();let during;f.scope.use({dispose(){during=d.getStatus().state;}});f.scope.dispose();assert.equal(during,'stopped');
  }finally{await f.close();}
});

test('SCL14 genuine Scope cancellation wins even while a user getter is being captured',async()=>{
  const f=await scene();try{const c=f.controller({totalPlays:'infinite'});c.start();
    expectCode(()=>c.seek({get timeSeconds(){f.scope.dispose();return 0.25;}}),'ANIMATION_TERMINAL');
    assert.equal(c.getStatus().state,'stopped');assert.equal(c.getStatus().isDisposed,true);
    const s=f.engine.createScope();const slots=Array.from({length:256},()=>f.engine.clock.onTick(s,()=>undefined));slots.forEach(v=>v.dispose());
  }finally{await f.close();}
});
test('SCL15 Engine closure inside capture retires all controllers before cleanup completes',async()=>{
  const f=await scene();let closing;try{const a=f.controller({totalPlays:'infinite'}),b=f.controller({totalPlays:'infinite'},f.target());a.start();b.start();
    assert.throws(()=>a.seek({get timeSeconds(){closing=f.engine.dispose();return 0.25;}}));
    assert.equal(a.getStatus().state,'stopped');assert.equal(b.getStatus().state,'stopped');await closing;
  }finally{await f.close();}
});
test('SCL16 failed compound replay budget keeps every pending command and old frame',async()=>{
  const f=await scene();try{let c;const markers=Array.from({length:64},(_,i)=>({id:'m'+i,timeSeconds:0.5}));
    const listenerScope=f.engine.createScope();f.engine.clock.onTick(listenerScope,()=>{if(f.engine.clock.tickId===1){c.seek({timeSeconds:8,replayEvents:true});c.seek({timeSeconds:17,replayEvents:true});}});
    c=f.controller({markers,totalPlays:'infinite'});f.engine.advanceTime(0);c.start();f.engine.advanceTime(0.25);f.engine.advanceTime(0.5);
    assert.equal(c.getStatus().elapsedSeconds,0.25);assert.equal(c.getStatus().lastSample.frameIndex,1);assert.equal(c.getStatus().pendingCommands,2);
    assert.equal(c.getStatus().committedEventCount,0);assert.equal(c.getStatus().lastIssue.code,'ANIMATION_COMMAND_INVALID');c.seek({timeSeconds:0.5});assert.equal(c.getStatus().pendingCommands,0);
  }finally{await f.close();}
});
test('SCL17 diagnostic disposal and terminal listener creation cannot revive an old coordinator',async()=>{
  let stopped;const f=await scene({onDiagnostic(d){if(d.code==='ANIMATION_CALLBACK_FAILED')stopped?.dispose();}});
  try{let replacement;const a=f.controller({onEvent(){throw Error('aftercommit');},markers:[{id:'z',timeSeconds:0}]});stopped=a;a.start();assert.equal(a.getStatus().state,'stopped');
    const b=f.controller({onEvent(e){if(e.kind==='complete'){replacement=f.controller({totalPlays:'infinite'},f.target());replacement.start();}}});
    f.engine.advanceTime(0);b.start();f.engine.advanceTime(1);assert.equal(replacement.getStatus().state,'idle');assert.equal(replacement.getStatus().pendingCommands,1);
    b.dispose();f.engine.advanceTime(1.25);assert.equal(replacement.getStatus().state,'running');assert.equal(replacement.getStatus().elapsedSeconds,0);
  }finally{await f.close();}
});

for(const mode of ['scope','engine'])test('SCL18 diagnostic observer honors prior '+mode+' closure',async()=>{
  let f,peerScope,closing;const seen=[];
  f=await scene({onDiagnostic(d){
    if(d.code!=='ANIMATION_CALLBACK_FAILED')return;
    seen.push([d.cause?.message,peerScope.state,f.engine.clock.state]);
    if(seen.length===1){if(mode==='scope')peerScope.dispose();else closing=f.engine.dispose();}
  }});
  try{
    peerScope=f.engine.createScope();
    const a=f.controller({totalPlays:'infinite',markers:[{id:'a',timeSeconds:0.5}],onEvent(){throw Error('first');}});
    const b=f.controller({totalPlays:'infinite',markers:[{id:'b',timeSeconds:0.5}],onEvent(){throw Error('second');}},f.target(),peerScope);
    f.engine.advanceTime(0);a.start();b.start();f.engine.advanceTime(0.5);
    if(closing)await closing;
    assert.deepEqual(seen,[['first','open','running']]);
    assert.equal(b.getStatus().state,'stopped');
    assert.deepEqual(b.getStatus().lastIssue,{code:'ANIMATION_CALLBACK_FAILED',clockTickId:1});
  }finally{await f.close();}
});
