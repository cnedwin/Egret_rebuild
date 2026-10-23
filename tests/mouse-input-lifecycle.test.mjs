import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPublicSDK,withInputFixture,down,up,captureThrown,assertCode,shadow} from './mouse-input.test.mjs';
// Public cancellation dependencies load without the optional input entry.
const sdk=await loadPublicSDK();

function assertNativePairs(f) {
  assert.deepEqual(f.browser.attempts.map(p=>[p.target===f.browser.canvas?'canvas':'window',p.type,p.capture]),[
    ['canvas','pointerdown',false],['window','pointerup',true],['window','pointercancel',true],['window','blur',false],['window','pagehide',false],
  ]);
  assert.equal(new Set(f.browser.attempts.map(p=>p.listener)).size,5);
}
function assertExactRemovals(f,attempts=f.browser.attempts) {
  assert.deepEqual(f.browser.removals.map(r=>r.type),attempts.toReversed().map(p=>p.type));
  for(const [index,removal]of f.browser.removals.entries()) {
    const pair=attempts.toReversed()[index];assert.equal(removal.target,pair.target);assert.equal(removal.listener,pair.listener);assert.equal(removal.capture,pair.capture);
  }
}

// Transparent first-party signal observation is installed before Engine assembly.
// Forward real add/remove calls and restore the exact prototype descriptors.
function observeSignal(sdk,restorers) {
  const signal=new sdk.CancellationController().signal,prototype=Object.getPrototypeOf(signal);
  const adds=[],removes=[];
  for(const [name,list]of [['addEventListener',adds],['removeEventListener',removes]]) {
    const descriptor=Object.getOwnPropertyDescriptor(prototype,name);assert.equal(typeof descriptor?.value,'function');
    Object.defineProperty(prototype,name,{...descriptor,value:function(...args){const pair={signal:this,args,success:false};list.push(pair);const result=Reflect.apply(descriptor.value,this,args);pair.success=true;return result;}});
    restorers.push(()=>Object.defineProperty(prototype,name,descriptor));
  }
  return {adds,removes};
}

test('MI1 dependency genuine Scope once/later callbacks precede two reverse owners',async()=>{
  await withGenuineScope(({scope,diagnostics})=>{const trace=[];scope.use({dispose(){trace.push('owned-first');}});scope.use({dispose(){trace.push('owned-second');}});scope.signal.addEventListener('abort',()=>trace.push('once:'+scope.state+':'+scope.signal.aborted),{once:true});scope.signal.addEventListener('abort',()=>trace.push('later:'+scope.state+':'+scope.signal.aborted));scope.dispose();const before=[...trace];scope.dispose();assert.deepEqual(trace,['once:closing:true','later:closing:true','owned-second','owned-first']);assert.deepEqual(trace,before);assert.equal(scope.state,'closed');assert.deepEqual(diagnostics,[]);});
});

for(const marker of [Object.freeze({dependencyPublicRemove:true}),undefined])test('MI1 dependency strong poisoned '+(marker===undefined?'undefined':'marker')+' observations precede explicit recovery',async()=>{
  await withGenuineScope(({scope})=>{const trace=[],owners=[],recovery={explicitDisposals:0};const own=name=>{let closed=false;const resource={dispose(){if(!closed){closed=true;trace.push(name);}}};owners.push({resource,get closed(){return closed;}});return resource;};scope.use(own('owned-first'));scope.use(own('owned-second'));scope.signal.addEventListener('abort',()=>trace.push('once:'+scope.state+':'+scope.signal.aborted),{once:true});scope.signal.addEventListener('abort',()=>trace.push('later:'+scope.state+':'+scope.signal.aborted));const poison=poisonPublicRemoval(scope.signal,marker);let observation;
    try {const failure=captureThrown(()=>scope.dispose()),before=trace.length;scope.dispose();observation={trace:[...trace],poisonCalls:poison.calls,ownedDisposals:owners.filter(owner=>owner.closed).length,scopeState:scope.state,signalAborted:scope.signal.aborted,repeatDelta:trace.length-before,failure:{present:failure.present,assignedCauseMatched:failure.present&&failure.cause===marker,kind:failure.present?(failure.cause===undefined?'undefined':'value'):'none'}};assert.deepEqual(observation,{trace:['once:closing:true','later:closing:true','owned-second','owned-first'],poisonCalls:0,ownedDisposals:2,scopeState:'closed',signalAborted:true,repeatDelta:0,failure:{present:false,assignedCauseMatched:false,kind:'none'}});}
    finally {poison.restore();for(const owner of owners)if(!owner.closed){recovery.explicitDisposals++;owner.resource.dispose();}}
    assert.ok(observation,'pre-recovery observation required');assert.equal(recovery.explicitDisposals,0,'recovery cannot count as observed GREEN');
  });
});

test('MI1 failed public Engine start retains original error and closes Host with zero timers',async()=>{
  const marker=Object.freeze({startup:true}),trace=[],timers=new Set();
  const host={surface:{},start(){trace.push('start');throw marker;},stop(){trace.push('stop');},async close(){trace.push('close');},setTimeout(callback,delayMs){const timer={callback,delayMs};timers.add(timer);return()=>timers.delete(timer);}};
  let present=false,cause;try{await sdk.createEngine({host});}catch(error){present=true;cause=error;}
  assert.equal(present,true);assert.equal(cause.code,'ENGINE_START_FAILED');assert.equal(cause.cause,marker);assert.deepEqual(trace,['start','stop','close']);assert.equal(timers.size,0);
});

test('MI1 acquisition exact five native pairs and original abort identity',async()=>{
  let signalObservation;
  await withInputFixture(f=>{
    assertNativePairs(f);const original=f.scope.signal;
    const subscriptions=signalObservation.adds.filter(p=>p.signal===original&&p.args[0]==='abort');
    assert.equal(subscriptions.length,1);const pair=subscriptions[0];assert.equal(typeof pair.args[1],'function');assert.deepEqual(pair.args[2],{once:true});assert.equal(Object.isFrozen(pair.args[2]),true);
    f.input.dispose();f.input.dispose();assert.equal(f.input.state,'closed');assertExactRemovals(f);
    const removals=signalObservation.removes.filter(p=>p.signal===original&&p.args[0]==='abort');assert.equal(removals.length,1);assert.equal(removals[0].args[1],pair.args[1]);assert.equal(f.browser.active().length,0);assert.deepEqual(f.diagnostics,[]);
  },{beforeEngine:({sdk,restorers})=>{signalObservation=observeSignal(sdk,restorers);}});
});

for(const closure of ['dispose','scope','engine'])test('MI1 '+closure+' immediately gates held press without gameplay cancellation',async()=>{
  await withInputFixture(async f=>{const trace=[];f.upper.on(f.input.events.cancel,()=>trace.push('cancel'));f.upper.on(f.input.events.end,()=>trace.push('end'));down(f);let closing;if(closure==='dispose')f.input.dispose();if(closure==='scope')f.scope.dispose();if(closure==='engine')closing=f.engine.dispose();assert.equal(f.input.state,'closed');f.browser.hooks.field=()=>{throw new Error('closed leaked callback read');};up(f);down(f);f.browser.emit(f.browser.window,'blur');assert.deepEqual(trace,[]);assertExactRemovals(f);assert.equal(f.browser.active().length,0);if(closing)await closing;});
});

test('MI1 factory ordered reads, options authentication and lifetime precedence',async()=>{
  await withInputFixture(f=>{
    const reads=[];const options={};for(const [name,value]of Object.entries({...f.options,maxNodes:4096}))Object.defineProperty(options,name,{get(){reads.push(name);return value;}});
    Object.defineProperty(options,'ignored',{get(){throw new Error('factory enumerated options');}});
    const input=f.sdk.createMouseInput(options);input.dispose();assert.deepEqual(reads,['engine','scope','width','height','maxNodes']);
    for(const value of [null,[],false])assertCode(()=>f.sdk.createMouseInput(value),'MOUSE_INPUT_OPTIONS_INVALID');
    let poisonReads=0;const poison=()=>{poisonReads++;throw new Error('later options read');};
    assertCode(()=>f.sdk.createMouseInput({engine:{},get scope(){return poison();}}),'MOUSE_INPUT_INVALID');assert.equal(poisonReads,0);
    assertCode(()=>f.sdk.createMouseInput({engine:f.engine,scope:{},get width(){return poison();}}),'MOUSE_INPUT_SCOPE_INVALID');assert.equal(poisonReads,0);
    f.scope.dispose();assertCode(()=>f.sdk.createMouseInput({engine:f.engine,scope:f.scope,get width(){return poison();}}),'SCOPE_CLOSED');assert.equal(poisonReads,0);
  },{create:false});
});

for(const cause of [Object.freeze({optionsFault:true}),undefined])test('MI1 throwing scalar wins callback closure including '+(cause===undefined?'undefined':'marker'),async()=>{
  await withInputFixture(f=>{let heightReads=0;const options={engine:f.engine,scope:f.scope,get width(){f.scope.dispose();throw cause;},get height(){heightReads++;return 80;}};assertCode(()=>f.sdk.createMouseInput(options),'MOUSE_INPUT_OPTIONS_INVALID',cause,true);assert.equal(heightReads,0);assert.equal(f.browser.attempts.length,0);assert.deepEqual(f.diagnostics,[]);},{create:false});
});

test('MI1 successful scalar closure is checked before numeric validation',async()=>{
  await withInputFixture(f=>{const reads=[];const options={engine:f.engine,scope:f.scope,get width(){reads.push('width');f.scope.dispose();return -1;},get height(){reads.push('height');return NaN;},get maxNodes(){reads.push('maxNodes');return 0;}};assertCode(()=>f.sdk.createMouseInput(options),'SCOPE_CLOSED');assert.deepEqual(reads,['width','height','maxNodes']);assert.equal(f.browser.attempts.length,0);},{create:false});
});

test('MI1 foreign scope and closed engine reject before poisoned later reads',async()=>{
  await withInputFixture(async f=>{
    const timers=new Set(),foreign=await f.sdk.createEngine({host:{surface:{},start(){},stop(){},async close(){},setTimeout(callback,delayMs){const t={callback,delayMs};timers.add(t);return()=>timers.delete(t);}}});
    try {const foreignScope=foreign.createScope();let reads=0;assertCode(()=>f.sdk.createMouseInput({engine:f.engine,scope:foreignScope,get width(){reads++;throw undefined;}}),'MOUSE_INPUT_SCOPE_INVALID');assert.equal(reads,0);const close=f.engine.dispose();assertCode(()=>f.sdk.createMouseInput({engine:f.engine,get scope(){reads++;throw undefined;}}),'ENGINE_CLOSED');assert.equal(reads,0);await close;}
    finally{await foreign.dispose();assert.equal(timers.size,0);}
  },{create:false});
});

for(const value of [0,-1,NaN,Infinity,'100'])test('MI1 finite positive viewport rejects '+String(value),async()=>{
  await withInputFixture(f=>{assertCode(()=>f.sdk.createMouseInput({...f.options,width:value}),'MOUSE_INPUT_OPTIONS_INVALID');assert.equal(f.browser.attempts.length,0);},{create:false});
});
for(const value of [0,65537,1.5,NaN,'4096'])test('MI1 integral finite maxNodes rejects '+String(value),async()=>{
  await withInputFixture(f=>{assertCode(()=>f.sdk.createMouseInput({...f.options,maxNodes:value}),'MOUSE_INPUT_OPTIONS_INVALID');assert.equal(f.browser.attempts.length,0);},{create:false});
});

test('MI1 receiver authentication survives closure and descriptors are per adapter',async()=>{
  await withInputFixture(f=>{const state=Object.getOwnPropertyDescriptor(f.input,'state').get,dispose=f.input.dispose;assertCode(()=>Reflect.apply(state,{},[]),'MOUSE_INPUT_INVALID');assertCode(()=>Reflect.apply(dispose,{},[]),'MOUSE_INPUT_INVALID');const old=f.input.events;f.input.dispose();assertCode(()=>Reflect.apply(dispose,{},[]),'MOUSE_INPUT_INVALID');const successor=f.sdk.createMouseInput(f.options);try{for(const name of ['begin','end','activate','cancel'])assert.notEqual(successor.events[name],old[name]);}finally{successor.dispose();}});
});

test('MI1 single live surface token refuses before acquisition effects and successor is independent',async()=>{
  await withInputFixture(f=>{const attempts=f.browser.attempts.length;assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_IN_USE');assert.equal(f.browser.attempts.length,attempts);assert.equal(f.input.state,'idle');f.input.dispose();const successor=f.sdk.createMouseInput(f.options);try{f.input.dispose();assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_IN_USE');assert.equal(successor.state,'idle');}finally{successor.dispose();}assert.deepEqual(f.diagnostics,[]);});
});

for(const index of [0,2,4])for(const phase of ['before','after'])test('MI1 attempted-before-add rollback '+index+'/'+phase,async()=>{
  await withInputFixture(f=>{const marker=Object.freeze({index,phase});f.browser.hooks.add=(when,pair)=>{if(when===phase&&pair.sequence===index+1)throw marker;};const failure=assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_SETUP_FAILED',marker,true);assert.equal(f.browser.attempts.length,index+1);assertExactRemovals(f);assert.equal(f.browser.active().length,0);assert.equal(failure.cleanupErrors?.length??0,0);assert.deepEqual(f.diagnostics,[]);f.browser.hooks.add=undefined;const successor=f.sdk.createMouseInput(f.options);successor.dispose();},{create:false});
});

for(const closure of ['scope','engine'])test('MI1 in-flight '+closure+' closure defers current removal until add settles',async()=>{
  await withInputFixture(async f=>{let closing;const trace=[];f.browser.hooks.add=(when,pair)=>{trace.push('add:'+when+':'+pair.type);if(when==='before'&&pair.type==='pointerup'){if(closure==='scope')f.scope.dispose();else closing=f.engine.dispose();assert.equal(f.browser.removals.some(r=>r.type==='pointerup'),false,'in-flight pair removed before add settled');}};f.browser.hooks.remove=(when,pair)=>{if(when==='before')trace.push('remove:'+pair.type);};assertCode(()=>f.sdk.createMouseInput(f.options),closure==='scope'?'SCOPE_CLOSED':'ENGINE_CLOSED');assert.equal(f.browser.attempts.length,2);assert.equal(f.browser.removals.filter(r=>r.type==='pointerdown').length,1);assert.equal(f.browser.removals.filter(r=>r.type==='pointerup').length,1);assert.ok(trace.indexOf('remove:pointerup')>trace.indexOf('add:after:pointerup'));assert.equal(f.browser.active().length,0);if(closing)await closing;},{create:false});
});

test('MI1 setup throw wins simultaneous closure and aggregates every rollback cause including undefined',async()=>{
  await withInputFixture(f=>{const source=Object.freeze({source:true}),later=Object.freeze({later:true});f.browser.hooks.add=(when,pair)=>{if(when==='after'&&pair.type==='pointerup'){f.scope.dispose();throw source;}};f.browser.hooks.remove=(when,pair)=>{if(when==='after')throw pair.type==='pointerdown'?undefined:later;};const failure=assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_SETUP_FAILED',source,true);assert.equal(f.browser.removals.length,2);assert.ok(failure.cleanupErrors.includes(undefined));assert.ok(failure.cleanupErrors.includes(later));assert.equal(f.browser.active().length,0);assert.deepEqual(f.diagnostics,[]);},{create:false});
});

test('MI1 explicit cleanup first undefined cause, all attempts and no replay',async()=>{
  await withInputFixture(f=>{const later=Object.freeze({later:true});f.browser.hooks.remove=(when,pair)=>{if(when==='after')throw pair.type==='pagehide'?undefined:later;};const failure=assertCode(()=>f.input.dispose(),'MOUSE_INPUT_CLEANUP_FAILED',undefined,true);assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.deepEqual(failure.cleanupErrors,[later,later,later,later]);const attempts=f.browser.removals.length;assert.doesNotThrow(()=>f.input.dispose());assert.equal(f.browser.removals.length,attempts);assert.deepEqual(f.diagnostics,[]);});
});

test('MI1 original Scope abort observes one cleanup aggregate and attempts every pair',async()=>{
  await withInputFixture(f=>{const marker=Object.freeze({remove:true});f.browser.hooks.remove=(when)=>{if(when==='after')throw marker;};assert.doesNotThrow(()=>f.scope.dispose());assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CLEANUP_FAILED');assert.equal(f.diagnostics[0].cause.cause,marker);assert.deepEqual(f.diagnostics[0].cause.cleanupErrors,[marker,marker,marker,marker]);const attempts=f.browser.removals.length;f.scope.dispose();f.input.dispose();assert.equal(f.browser.removals.length,attempts);});
});

test('MI1 early Engine gate precedes owners and retains one exact cleanup aggregate',async()=>{
  await withInputFixture(async f=>{const marker=Object.freeze({engineRemove:true}),trace=[];f.scope.use({dispose(){trace.push(f.input.state);}});f.browser.hooks.remove=(when)=>{if(when==='after')throw marker;};const promise=f.engine.dispose();assert.equal(f.input.state,'closed');let present=false,cause;try{await promise;}catch(error){present=true;cause=error;}assert.equal(present,true);assert.equal(cause.code,'ENGINE_CLOSE_FAILED');assert.equal(f.engine.dispose(),promise);f.expectedClose.present=true;f.expectedClose.cause=cause;assert.deepEqual(trace,['closed']);assertExactRemovals(f);assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CLEANUP_FAILED');assert.equal(f.diagnostics[0].cause.cause,marker);assert.deepEqual(f.diagnostics[0].cause.cleanupErrors,[marker,marker,marker,marker]);assert.equal(cause.cause,f.diagnostics[0].cause);});
});

test('MI1 release own token before cleanup reentry and preserve successor token',async()=>{
  await withInputFixture(f=>{let successor;f.browser.hooks.remove=(when,pair)=>{if(when==='after'&&pair.type==='pagehide'&&!successor)successor=f.sdk.createMouseInput(f.options);};f.input.dispose();assert.ok(successor);assert.equal(successor.state,'idle');assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_IN_USE');f.input.dispose();assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_IN_USE');f.browser.hooks.remove=undefined;successor.dispose();assert.equal(f.browser.active().length,0);});
});

for(const cause of [Object.freeze({outerHandler:true}),undefined])test('MI1 distinct outer source '+(cause===undefined?'undefined':'marker')+' remains observed after reentry',async()=>{
  await withInputFixture(f=>{let nestedReads=0;f.upper.on(f.input.events.begin,()=>{f.browser.hooks.field=()=>{nestedReads++;throw new Error('nested fields must stay unread');};down(f);f.browser.hooks.field=undefined;throw cause;});assert.doesNotThrow(()=>down(f));assert.equal(nestedReads,0);assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,2,'distinct source fault is a separate observation');assert.deepEqual(f.diagnostics.map(d=>d.code),['MOUSE_INPUT_CALLBACK_FAILED','MOUSE_INPUT_CALLBACK_FAILED']);assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_REENTRANT');assert.ok(Object.hasOwn(f.diagnostics[1].cause,'cause'));assert.equal(f.diagnostics[1].cause.cause,cause);assertExactRemovals(f);assert.equal(f.browser.active().length,0);});
});

for(const identity of ['cause','wrapper'])test('MI1 same reentry '+identity+' rethrow reports exactly one episode',async()=>{
  await withInputFixture(f=>{f.upper.on(f.input.events.begin,()=>{down(f);assert.equal(f.diagnostics.length,1);throw identity==='cause'?f.diagnostics[0].cause.cause:f.diagnostics[0].cause;});assert.doesNotThrow(()=>down(f));assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_REENTRANT');assertExactRemovals(f);});
});

test('MI1 remaining unscoped candidate distinct undefined fault remains observed after reentry',async()=>{
  await withInputFixture(f=>{const trace=[];f.upper.on(f.input.events.begin,()=>{trace.push('first');down(f);});f.upper.on(f.input.events.begin,()=>{trace.push('remaining');throw undefined;});down(f);assert.deepEqual(trace,['first','remaining']);assert.equal(f.diagnostics.length,2);assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_REENTRANT');assert.ok(Object.hasOwn(f.diagnostics[1].cause,'cause'));assert.equal(f.diagnostics[1].cause.cause,undefined);assert.equal(f.input.state,'closed');});
});

for(const closure of ['scope','engine'])for(const source of ['closure-code','undefined'])test('MI1 '+closure+' closure then genuine handler '+source+' retains exact source',async()=>{
  await withInputFixture(async f=>{const marker=source==='undefined'?undefined:new f.sdk.EgretError(closure==='scope'?'SCOPE_CLOSED':'ENGINE_CLOSED');let closing;f.upper.on(f.input.events.begin,()=>{if(closure==='scope')f.scope.dispose();else closing=f.engine.dispose();throw marker;});assert.doesNotThrow(()=>down(f));assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.ok(Object.hasOwn(f.diagnostics[0].cause,'cause'));assert.equal(f.diagnostics[0].cause.cause,marker);if(closing)await closing;});
});

for(const first of [Object.freeze({pagehideFirst:true}),undefined])test('MI1 pagehide cleanup-only primary '+(first===undefined?'undefined':'marker')+' is not duplicated',async()=>{
  await withInputFixture(f=>{const later=Object.freeze({pagehideLater:true});f.browser.hooks.remove=(when,pair)=>{if(when==='after'&&pair.type==='pagehide')throw first;if(when==='after'&&pair.type==='blur')throw later;};down(f);assert.doesNotThrow(()=>f.browser.emit(f.browser.window,'pagehide'));assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.equal(f.diagnostics.length,1);const error=f.diagnostics[0].cause;assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(error.code,'MOUSE_INPUT_CALLBACK_FAILED');assert.ok(Object.hasOwn(error,'cause'));assert.equal(error.cause,first);assert.deepEqual(error.cleanupErrors,[later]);});
});

for(const closure of ['scope','engine'])test('MI1 pagehide successful '+closure+' retirement never promotes an already reported cleanup fault',async()=>{
  await withInputFixture(async f=>{const marker=Object.freeze({pagehideOwnerRemoval:true});let closing;f.browser.hooks.remove=(when,pair)=>{if(when==='after'&&pair.type==='pagehide')throw marker;};f.upper.on(f.input.events.cancel,()=>{if(closure==='scope')f.scope.dispose();else closing=f.engine.dispose();});down(f);assert.doesNotThrow(()=>f.browser.emit(f.browser.window,'pagehide'));assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.equal(f.diagnostics.length,1,'owner cleanup has already been observed');assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CLEANUP_FAILED');assert.equal(f.diagnostics[0].cause.code,'MOUSE_INPUT_CLEANUP_FAILED');assert.equal(f.diagnostics[0].cause.cause,marker);assert.deepEqual(f.diagnostics[0].cause.cleanupErrors,[]);if(closing){let present=false,cause;try{await closing;}catch(error){present=true;cause=error;}assert.equal(present,true);assert.equal(cause.code,'ENGINE_CLOSE_FAILED');assert.equal(cause.cause,f.diagnostics[0].cause);f.expectedClose.present=true;f.expectedClose.cause=cause;}});
});

test('MI1 pagehide caught explicit cleanup error returns normally without a callback diagnostic',async()=>{
  await withInputFixture(f=>{
    const marker=Object.freeze({pagehideCaughtExplicitRemoval:true}),trace=[];let caught;
    f.browser.hooks.remove=(when,pair)=>{if(when==='after'&&pair.type==='pagehide')throw marker;};
    f.upper.on(f.input.events.cancel,event=>{
      trace.push([event.payload.reason,f.input.state]);
      caught=captureThrown(()=>f.input.dispose());
      // The application handles this explicit disposal error and returns normally.
    });
    down(f);assert.equal(f.input.state,'pressed');
    assert.doesNotThrow(()=>f.browser.emit(f.browser.window,'pagehide'));
    assert.deepEqual(trace,[['pagehide','idle']]);assert.equal(caught?.present,true);
    assert.ok(caught.cause instanceof f.sdk.EgretError);assert.equal(caught.cause.code,'MOUSE_INPUT_CLEANUP_FAILED');
    assert.equal(caught.cause.cause,marker);assert.deepEqual(caught.cause.cleanupErrors,[]);
    assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.equal(f.browser.active().length,0);
    assert.deepEqual(f.diagnostics,[],'caught explicit cleanup does not produce internal or callback diagnostics');
    const removalCount=f.browser.removals.length;assert.doesNotThrow(()=>f.input.dispose());
    f.browser.emit(f.browser.window,'pagehide');assert.equal(f.browser.removals.length,removalCount);
    assert.deepEqual(f.diagnostics,[]);
  });
});

for(const cause of [Object.freeze({oncePublicRemoval:true}),undefined])test('MI1 earlier genuine once listener ignores public remove poison and gates all native pairs',async()=>{
  let observed,original,poison,trace=[];
  await withInputFixture(f=>{const pair=observed.adds.filter(p=>p.signal===original&&p.args[0]==='abort').at(-1);f.scope.dispose();assert.deepEqual(trace,['app:closing']);assert.equal(poison.calls,0);assert.equal(f.input.state,'closed');assertExactRemovals(f);assert.equal(f.browser.active().length,0);const removed=observed.removes.filter(p=>p.signal===original&&p.args[0]==='abort');assert.equal(removed.length,1);assert.equal(removed[0].args[1],pair.args[1]);assert.deepEqual(f.diagnostics,[]);},
    {beforeEngine:({sdk,restorers})=>{observed=observeSignal(sdk,restorers);},afterScope:({scope,restorers})=>{original=scope.signal;original.addEventListener('abort',()=>trace.push('app:'+scope.state),{once:true});poison=poisonPublicRemoval(original,cause);restorers.push(()=>poison.restore());}});
});
function poisonPublicRemoval(signal, cause) {
  const descriptor = Object.getOwnPropertyDescriptor(signal, 'removeEventListener');
  let calls = 0;
  Object.defineProperty(signal, 'removeEventListener', {
    configurable: true, writable: true, value() { calls++; throw cause; },
  });
  return {
    get calls() { return calls; },
    restore() {
      if (descriptor === undefined) {
        assert.equal(Reflect.deleteProperty(signal, 'removeEventListener'), true,
          'CLEANUP: removal override did not restore');
      } else Object.defineProperty(signal, 'removeEventListener', descriptor);
    },
  };
}

async function withGenuineScope(run, expectedCloseCauses = [], observer, expectedClose) {
  const hostTrace = [], timers = new Set(), diagnostics = [];
  const host = {
    surface: {}, start() { hostTrace.push('host.start'); },
    stop() { hostTrace.push('host.stop'); },
    async close() { hostTrace.push('host.close'); },
    setTimeout(callback, delayMs) {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delayMs);
      timers.add(timer);
      return () => { timers.delete(timer); clearTimeout(timer); };
    },
  };
  let engine, scope, hasRunFailure = false, runFailure;
  let closeThrew = false, closeCause;
  try {
    engine = await sdk.createEngine({ host, onDiagnostic: d => {
      diagnostics.push(d); observer?.(d);
    } });
    assert.ok(engine instanceof sdk.Engine, 'SETUP: Engine is not genuine');
    assert.ok(engine.stage instanceof sdk.Stage, 'SETUP: Stage is not genuine');
    scope = engine.createScope();
    assert.ok(scope instanceof sdk.Scope, 'SETUP: Scope is not genuine');
    assert.equal(scope.state, 'open', 'SETUP: Scope did not open');
    await run({ engine, scope, diagnostics });
  } catch (cause) { hasRunFailure = true; runFailure = cause; }
  finally {
    if (engine !== undefined) {
      try {
        const closing = engine.dispose(), sameClosing = engine.dispose();
        try { await closing; }
        catch (cause) { closeThrew = true; closeCause = cause; }
        assert.equal(sameClosing, closing, 'CLEANUP: close Promise identity changed');
        if (expectedClose !== undefined) {
          assert.equal(closing, expectedClose.promise, 'CLEANUP: original close Promise changed');
          assert.equal(closeCause, expectedClose.cause, 'CLEANUP: original close error changed');
        }
      } catch (cause) {
        if (closeThrew) closeCause = new AggregateError([closeCause, cause],
          'CLEANUP: close and cleanup observation failed', { cause: closeCause });
        else { closeThrew = true; closeCause = cause; }
      }
    }
  }
  if (hasRunFailure) {
    if (closeThrew) throw new AggregateError([runFailure, closeCause],
      'TEST_AND_CLEANUP_FAILURE', { cause: runFailure });
    throw runFailure;
  }
  if (expectedCloseCauses.length === 0) {
    if (closeThrew) throw closeCause;
    assert.deepEqual(diagnostics, [], 'CLEANUP: unexpected SDK diagnostic');
  } else {
    assert.equal(closeThrew, true, 'CLEANUP: known failures were not retained');
    assert.ok(closeCause instanceof sdk.EgretError, 'CLEANUP: genuine close error required');
    assert.equal(closeCause.code, 'ENGINE_CLOSE_FAILED');
    assert.equal(closeCause.cause, expectedCloseCauses[0]);
    assert.deepEqual(closeCause.cleanupErrors, expectedCloseCauses.slice(1));
  }
  assert.equal(scope.state, 'closed', 'CLEANUP: Scope did not close');
  assert.equal(scope.signal.aborted, true, 'CLEANUP: Scope did not abort');
  assert.equal(engine.stage.isDisposed, true, 'CLEANUP: Stage did not retire');
  assert.equal(timers.size, 0, 'CLEANUP: pending Host timer survived');
  assert.deepEqual(hostTrace, ['host.start', 'host.stop', 'host.close']);
}

// Break caught: once replay, skipped later listener or replaced first reason.
test('CR01 genuine Controller once and later listeners notify exactly once', () => {
  const diagnostics = [], trace = [];
  const controller = new sdk.CancellationController(d => diagnostics.push(d));
  const reason = Object.freeze({ first: true });
  controller.signal.addEventListener('abort', () => trace.push('once'), { once: true });
  controller.signal.addEventListener('abort', () => trace.push('later'));
  controller.abort(reason); controller.abort('second');
  controller.signal.addEventListener('abort', () => trace.push('late'));
  assert.deepEqual(trace, ['once', 'later']);
  assert.equal(controller.signal.reason, reason);
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(diagnostics, []);
});

// Break caught: scope abort omitted, duplicate owner cleanup or forward cleanup.
test('CR02 genuine Scope once abort precedes two deduplicated owners in reverse order',
  { timeout: 10000 }, async () => {
    await withGenuineScope(({ scope }) => {
      const trace = [], first = { dispose() { trace.push('first'); } };
      scope.use(first); scope.use({ release() { trace.push('second'); } }); scope.use(first);
      scope.signal.addEventListener('abort', () => trace.push('abort:' + scope.state), { once: true });
      scope.dispose(); scope.dispose();
      assert.deepEqual(trace, ['abort:closing', 'second', 'first']);
      assert.equal(scope.state, 'closed');
    });
  });

for (const profile of [
  { label: 'marker', controllerId: 'CR03', scopeId: 'CR05', cause: Object.freeze({ marker: true }) },
  { label: 'undefined', controllerId: 'CR04', scopeId: 'CR06', cause: undefined },
]) {
  // Break caught: internal once retirement calls replaceable public removal.
  test(profile.controllerId + ' Controller ignores public removal throwing ' + profile.label, () => {
    const trace = [], diagnostics = [];
    const controller = new sdk.CancellationController(d => diagnostics.push(d));
    const poison = poisonPublicRemoval(controller.signal, profile.cause);
    try {
      controller.signal.addEventListener('abort', () => trace.push('once'), { once: true });
      controller.signal.addEventListener('abort', () => trace.push('later'));
      assert.doesNotThrow(() => controller.abort('first'));
      controller.abort('second');
      assert.deepEqual(trace, ['once', 'later']);
      assert.equal(poison.calls, 0, 'Internal once retirement called public removal');
      assert.equal(controller.signal.aborted, true);
      assert.equal(controller.signal.reason, 'first');
      assert.deepEqual(diagnostics, []);
    } finally { poison.restore(); }
  });

  // Break caught: real Scope loses callback or owned cleanup after once removal.
  test(profile.scopeId + ' Scope fully cleans when public removal throws ' + profile.label,
    { timeout: 10000 }, async () => {
      await withGenuineScope(({ scope }) => {
        const trace = [], poison = poisonPublicRemoval(scope.signal, profile.cause);
        try {
          scope.signal.addEventListener('abort', () => trace.push('abort:' + scope.state), { once: true });
          scope.use({ dispose() { trace.push('first'); } });
          scope.use({ release() { trace.push('second'); } });
          assert.doesNotThrow(() => scope.dispose()); scope.dispose();
          assert.deepEqual(trace, ['abort:closing', 'second', 'first']);
          assert.equal(poison.calls, 0, 'Scope once retirement called public removal');
          assert.equal(scope.state, 'closed');
          assert.equal(scope.signal.aborted, true);
          assert.equal(scope.signal.reason.code, 'SCOPE_CLOSED');
        } finally { poison.restore(); }
      });
    });
}

// Break caught: explicit removal stops working, reentry replays, observer masks
// the listener cause, or a failed listener interrupts later notification.
test('CR07 explicit removal, listener/observer faults and reentry retain Controller semantics', () => {
  const trace = [], diagnostics = [];
  const listenerFailure = Object.freeze({ listenerFailure: true });
  const observerFailure = Object.freeze({ observerFailure: true });
  const controller = new sdk.CancellationController(d => {
    diagnostics.push(d); throw observerFailure;
  });
  const removed = () => trace.push('removed');
  controller.signal.addEventListener('abort', () => {
    trace.push('first');
    controller.signal.removeEventListener('abort', removed);
    controller.signal.addEventListener('abort', () => trace.push('late'));
    controller.abort('nested');
    throw listenerFailure;
  }, { once: true });
  controller.signal.addEventListener('abort', removed);
  controller.signal.addEventListener('abort', () => trace.push('last'), { once: true });
  assert.doesNotThrow(() => controller.abort('first reason'));
  controller.abort('later reason');
  assert.deepEqual(trace, ['first', 'last']);
  assert.equal(controller.signal.reason, 'first reason');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 'CANCELLATION_LISTENER_FAILED');
  assert.equal(diagnostics[0].cause, listenerFailure);
  assert.equal(Object.isFrozen(diagnostics[0]), true);
});

// Break caught: listener/observer/owner faults or Scope reentry interrupt reverse
// cleanup, or Engine closing replaces the original lifecycle failure identities.
test('CR08 Scope retains listener/owner failures while observer throws and reentry is inert',
  { timeout: 10000 }, async () => {
    const listenerFailure = Object.freeze({ scopeListenerFailure: true });
    const ownerFailure = Object.freeze({ ownerFailure: true });
    const observerFailure = Object.freeze({ scopeObserverFailure: true });
    const expectedClose = {};
    let observerCalls = 0;
    await withGenuineScope(async ({ engine, scope, diagnostics }) => {
      const trace = [];
      scope.use({ dispose() { trace.push('first'); } });
      scope.use({ release() { trace.push('second'); throw ownerFailure; } });
      scope.signal.addEventListener('abort', () => {
        trace.push('abort:' + scope.state); scope.dispose(); throw listenerFailure;
      }, { once: true });
      // Engine records lifecycle causes only during its genuine closing phase.
      expectedClose.promise = engine.dispose();
      let closeThrew = false;
      try { await expectedClose.promise; }
      catch (cause) { closeThrew = true; expectedClose.cause = cause; }
      assert.equal(closeThrew, true);
      assert.ok(expectedClose.cause instanceof sdk.EgretError);
      assert.equal(expectedClose.cause.code, 'ENGINE_CLOSE_FAILED');
      assert.equal(expectedClose.cause.cause, listenerFailure);
      assert.deepEqual(expectedClose.cause.cleanupErrors, [ownerFailure]);
      scope.dispose();
      assert.deepEqual(trace, ['abort:closing', 'second', 'first']);
      assert.equal(scope.state, 'closed');
      assert.deepEqual(diagnostics.map(d => [d.code, d.cause]), [
        ['CANCELLATION_LISTENER_FAILED', listenerFailure], ['SCOPE_CLEANUP_FAILED', ownerFailure],
      ]);
      assert.equal(observerCalls, 2);
    }, [listenerFailure, ownerFailure], () => { observerCalls++; throw observerFailure; }, expectedClose);
  });

test('MI1 routed delivery excludes same-Engine optional UI publication',async()=>{
 const {createUiRoot}=await import('@egret/engine/ui');
 await withInputFixture(async f=>{
  const root=createUiRoot({engine:f.engine,scope:f.scope,id:'ui',viewport:{width:20,height:20},origin:{x:70,y:40},density:1,
   tree:{id:'spacer',kind:'leaf',explicitWidth:20,explicitHeight:20}});
  const token=await root.prepare();let attempts=0;
  f.upper.on(f.input.events.begin,()=>{attempts++;assertCode(()=>root.commit(token),'UI_BUSY');});
  down(f);assert.equal(attempts,1);assert.equal(root.snapshot().committedRevision,0);
  assert.equal(root.commit(token).kind,'committed');root.dispose();
 });
});
