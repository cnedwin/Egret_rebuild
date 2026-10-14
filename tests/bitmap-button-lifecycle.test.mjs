// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {withScene,sdk,UP,PRESSED,AREA,original,readOriginal,writeOriginal,override,code} from './bitmap-button-api.test.mjs';
const lateChild=process.argv[2]==='--late-prototype-child';
const dead=b=>{assert.equal(b.state,'disposed');assert.equal(readOriginal('disposed',b.display),true);};

function registerLifetimeCases(){
  // Each boundary uses a new genuine composition; no fake picker or native router.
  for(const phase of ['begin','end','activate'])for(const retirement of ['button','display','input','scope','engine'])test('BB04 '+retirement+' retirement during '+phase+' cannot restore activation',async()=>{
    await withScene(async f=>{let calls=0,closing;const b=f.attach(f.addButton({onActivate(){calls++;}})),other=f.attach(f.addButton(),32,12);
      b.display.on(f.input.events[phase],()=>{if(retirement==='button')b.dispose();if(retirement==='display')b.display.dispose();if(retirement==='input')f.input.dispose();if(retirement==='scope')f.scope.dispose();if(retirement==='engine')closing=f.engine.dispose();},{once:true});
      f.down();f.up();dead(b);assert.equal(calls,0);if(['input','scope','engine'].includes(retirement)){dead(other);assert.equal(f.input.state,'closed');}else{assert.equal(other.state,'up');assert.equal(f.input.state,'idle');}if(closing)await closing;
    });
  });
  for(const effect of ['disable','dispose','scope','engine'])test('BB04 callback '+effect+' is committed without a trailing state restore',async()=>{
    await withScene(async f=>{let calls=0,closing;const b=f.attach(f.addButton({onActivate(){calls++;if(effect==='disable')b.enabled=false;if(effect==='dispose')b.dispose();if(effect==='scope')f.scope.dispose();if(effect==='engine')closing=f.engine.dispose();}}));f.down();f.up();assert.equal(calls,1);if(effect==='disable'){assert.equal(b.state,'disabled');assert.equal(b.enabled,false);}else dead(b);if(closing)await closing;});
  });
  test('BB04 exact receiver and terminal observations retain their specified priority',async()=>{
    await withScene(async f=>{const b=f.addButton({enabled:false}),view=b.display,descriptors=Object.getOwnPropertyDescriptors(b);for(const receiver of [{},new Proxy(b,{})]){for(const key of ['display','state','enabled'])code(()=>Reflect.apply(descriptors[key].get,receiver,[]),'BITMAP_BUTTON_INVALID');code(()=>Reflect.apply(descriptors.enabled.set,receiver,[true]),'BITMAP_BUTTON_INVALID');code(()=>Reflect.apply(b.dispose,receiver,[]),'BITMAP_BUTTON_INVALID');}
      view.dispose();dead(b);assert.equal(b.display,view);assert.equal(b.enabled,false);const closing=f.engine.dispose();code(()=>{b.enabled=null;},'BITMAP_BUTTON_DISPOSED');assert.doesNotThrow(()=>b.dispose());assert.doesNotThrow(()=>b.dispose());await closing;
    });
  });
  test('BB04 synthetic public Events never arm the control',async()=>{
    await withScene(f=>{let calls=0,raw=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));const payload=Object.freeze({pointerId:7,globalX:12,globalY:12,pointerType:'mouse',button:0});for(const phase of ['begin','end','activate']){b.display.on(f.input.events[phase],()=>raw++);b.display.dispatchEvent(new sdk.Event(f.input.events[phase],payload));assert.equal(b.state,'up');assert.equal(f.input.state,'idle');}assert.equal(raw,3);assert.equal(calls,0);f.down();f.up();assert.equal(calls,1);});
  });
  test('BB04 ignored pointer variants cannot arm or consume a valid held press',async()=>{
    await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));for(const fields of [{isPrimary:false},{pointerType:'touch'},{button:1}]){f.down(12,12,fields);assert.equal(b.state,'up');assert.equal(f.input.state,'idle');}f.down();f.up(12,12,{pointerId:8});assert.equal(b.state,'pressed');assert.equal(f.input.state,'pressed');f.up();assert.equal(calls,1);});
  });
  test('BB04 pagehide resets before cancel and retires every associated control',async()=>{
    await withScene(f=>{let calls=0,cancels=0;const b=f.attach(f.addButton({onActivate(){calls++;}})),other=f.addButton();b.display.on(f.input.events.cancel,e=>{cancels++;assert.equal(e.payload.reason,'pagehide');assert.equal(b.state,'up');});f.down();f.browser.emit(f.browser.window,'pagehide');assert.equal(cancels,1);assert.equal(calls,0);dead(b);dead(other);assert.equal(f.input.state,'closed');assert.equal(f.browser.active().length,0);});
  });
  test('BB04 thrown undefined is retained as the original callback occurrence',async()=>{
    await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;throw undefined;}})),other=f.addButton();f.down();assert.doesNotThrow(()=>f.up());assert.equal(calls,1);dead(b);dead(other);assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);const d=f.diagnostics[0];assert.equal(d.code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(d.cause.code,d.code);assert.ok(Object.hasOwn(d.cause,'cause'));assert.equal(d.cause.cause,undefined);assert.equal(f.browser.active().length,0);});
  });
  test('BB04 returned rejecting Promise is observed and closes shared input',async()=>{
    await withScene(async f=>{const marker=Object.freeze({rejectedCallback:true});const b=f.attach(f.addButton({onActivate(){return Promise.reject(marker);}})),other=f.addButton();f.down();f.up();await Promise.resolve();await Promise.resolve();dead(b);dead(other);assert.equal(f.input.state,'closed');const primary=f.diagnostics.find(d=>d.code==='MOUSE_INPUT_CALLBACK_FAILED');assert.ok(primary);assert.equal(primary.cause.cause.code,'ASYNC_EVENT_HANDLER');assert.equal(f.browser.active().length,0);});
  });
  test('BB04 native reentry reports the existing failure and retires all controls',async()=>{
    await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;f.down();}})),other=f.addButton();f.down();f.up();assert.equal(calls,1);dead(b);dead(other);assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_REENTRANT');});
  });
  test('BB05 option, skin and crop reads occur once in order without presence probes',async()=>{
    await withScene(f=>{const reads=[],base=f.options();const observed=(label,value)=>Object.defineProperties({},Object.fromEntries(Object.entries(value).map(([key,v])=>[key,{get(){reads.push(label+'.'+key);return v;}}])));const skins=observed('skins',{up:observed('up',UP),pressed:observed('pressed',PRESSED),disabled:observed('disabled',{x:16,y:0,width:8,height:6})});const inherited={get enabled(){reads.push('enabled');return undefined;}};const options=Object.create(inherited);for(const key of ['engine','scope','input','textureLease','skins','onActivate'])Object.defineProperty(options,key,{get(){reads.push(key);return key==='skins'?skins:base[key];}});Object.defineProperty(options,'unknown',{get(){assert.fail('unknown field read');}});const noPresence=new Proxy(options,{has(){assert.fail('presence trap');},getOwnPropertyDescriptor(){assert.fail('descriptor trap');}});const b=f.inputAPI.createBitmapButton(noPresence);assert.equal(b.enabled,true);assert.equal(b.state,'up');assert.deepEqual(reads,['engine','scope','input','textureLease','skins','enabled','onActivate','skins.up','skins.pressed','skins.disabled','up.x','up.y','up.width','up.height','pressed.x','pressed.y','pressed.width','pressed.height','disabled.x','disabled.y','disabled.width','disabled.height']);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,0);assert.equal(f.browser.attempts.length,5);});
  });
  for(const position of ['enabled','pressed.width'])test('BB05 throwing '+position+' preserves even undefined and the completed closure',async()=>{
    await withScene(f=>{const options=f.options();if(position==='enabled')Object.defineProperty(options,'enabled',{get(){f.scope.dispose();throw undefined;}});else options.skins={up:UP,pressed:{...PRESSED,get width(){f.scope.dispose();throw undefined;}},disabled:{x:16,y:0,width:8,height:6}};code(()=>f.inputAPI.createBitmapButton(options),'BITMAP_BUTTON_OPTIONS_INVALID',undefined,true);assert.equal(f.scope.state,'closed');assert.equal(f.input.state,'closed');assert.equal(f.lease.value,f.texture);assert.equal(f.counts.disposals,0);assert.equal(f.browser.active().length,0);});
  });
  test('BB05 successful read closure wins later scalar validation and stops later reads',async()=>{
    await withScene(f=>{let later=0;const options=f.options();Object.defineProperty(options,'enabled',{get(){f.scope.dispose();return null;}});Object.defineProperty(options,'onActivate',{get(){later++;throw undefined;}});code(()=>f.inputAPI.createBitmapButton(options),'SCOPE_CLOSED');assert.equal(later,0);assert.equal(f.lease.value,f.texture);assert.equal(f.counts.disposals,0);});
  });
  test('BB05 malformed records and scalar values cannot change resources or input',async()=>{
    await withScene(f=>{const factory=f.inputAPI.createBitmapButton;for(const value of [null,[],0,()=>{}])code(()=>factory(value),'BITMAP_BUTTON_OPTIONS_INVALID');for(const value of [null,[],0])code(()=>factory(f.options({skins:value})),'BITMAP_BUTTON_OPTIONS_INVALID');for(const value of [null,0,'true',new Boolean(true)])code(()=>factory(f.options({enabled:value})),'BITMAP_BUTTON_OPTIONS_INVALID');for(const value of [null,0,{}])code(()=>factory(f.options({onActivate:value})),'BITMAP_BUTTON_OPTIONS_INVALID');code(()=>factory(f.options({engine:{}})),'MOUSE_INPUT_INVALID');code(()=>factory(f.options({scope:{}})),'MOUSE_INPUT_SCOPE_INVALID');code(()=>factory(f.options({input:{}})),'MOUSE_INPUT_INVALID');code(()=>factory(f.options({textureLease:{}})),'SPRITE_SHEET_LEASE_INVALID');code(()=>factory(f.options({skins:{up:UP,pressed:{...PRESSED,x:-1},disabled:UP}})),'SPRITE_SHEET_REGION_INVALID');code(()=>factory(f.options({skins:{up:UP,pressed:{...PRESSED,width:7},disabled:UP}})),'BITMAP_BUTTON_SKIN_INVALID');assert.equal(f.lease.value,f.texture);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,0);assert.equal(f.input.state,'idle');assert.equal(f.browser.attempts.length,5);assert.deepEqual(f.diagnostics,[]);});
  });
  test('BB05 foreign Scope, input and lease are refused without rebinding either Engine',async()=>{
    await withScene(async f=>{await withScene(g=>{const initial={outer:f.browser.attempts.length,inner:g.browser.attempts.length};assert.ok(initial.outer>0);assert.ok(initial.inner>0);for(const extra of [{scope:g.scope},{input:g.input},{textureLease:g.lease}])code(()=>f.inputAPI.createBitmapButton(f.options(extra)),'ENGINE_MISMATCH');assert.equal(f.input.state,'idle');assert.equal(g.input.state,'idle');assert.equal(f.lease.value,f.texture);assert.equal(g.lease.value,g.texture);assert.equal(f.counts.disposals,0);assert.equal(g.counts.disposals,0);assert.equal(f.browser.attempts.length,initial.outer);assert.equal(g.browser.attempts.length,initial.inner);});assert.equal(f.input.state,'idle');});
  });
  test('BB05 a different open button Scope shares the original input without owning it',async()=>{
    await withScene(f=>{const otherScope=f.engine.createScope();let calls=0;const b=f.inputAPI.createBitmapButton(f.options({scope:otherScope,onActivate(){calls++;}}));f.attach(b);f.down();f.up();assert.equal(calls,1);otherScope.dispose();dead(b);assert.equal(f.input.state,'idle');assert.equal(f.scope.state,'open');assert.equal(f.lease.value,f.texture);});
  });
  for(const close of ['scope','input','engine'])test('BB05 closed '+close+' admission precedes poisoned later options',async()=>{
    await withScene(async f=>{let later=0,closing;const options=f.options();Object.defineProperty(options,'textureLease',{get(){later++;throw undefined;}});if(close==='scope')f.scope.dispose();if(close==='input')f.input.dispose();if(close==='engine')closing=f.engine.dispose();code(()=>f.inputAPI.createBitmapButton(options),close==='scope'?'SCOPE_CLOSED':close==='input'?'BITMAP_BUTTON_INPUT_CLOSED':'ENGINE_CLOSED');assert.equal(later,0);if(closing)await closing;});
  });
  for(const kind of ['lease','crop','hit','touch'])test('BB05 own getter shadows cannot conceal an actual '+kind+' mutation',async()=>{
    await withScene(f=>{const b=f.addButton(),node=b.display;const property={lease:'textureLease',crop:'sourceRect',hit:'hitArea',touch:'touchEnabled'}[kind],expected={lease:f.lease,crop:UP,hit:AREA,touch:true}[kind];let reads=0;f.restorers.push(override(node,property,{get(){reads++;return expected;}}));f.restorers.push(override(node,'isDisposed',{get(){reads++;return false;}}));writeOriginal(kind,node,{lease:undefined,crop:PRESSED,hit:{x:1,y:0,width:8,height:6},touch:false}[kind]);assert.notDeepEqual(readOriginal(kind,node),expected);assert.equal(b.state,'up','observation alone does not run semantic validation');code(()=>{b.enabled=false;},'BITMAP_BUTTON_SKIN_INVALID');dead(b);assert.equal(reads,0);assert.equal(f.input.state,'idle');assert.equal(f.lease.value,f.texture);assert.equal(f.counts.disposals,0);});
  });
  test('BB05 own terminal getter shadow cannot resurrect an originally disposed Bitmap',async()=>{
    await withScene(f=>{const b=f.addButton(),node=b.display;let reads=0;f.restorers.push(override(node,'isDisposed',{get(){reads++;return false;}}));Reflect.apply(original.bitmapDispose,node,[]);dead(b);assert.equal(b.display,node);code(()=>{b.enabled=true;},'BITMAP_BUTTON_DISPOSED');assert.equal(reads,0);});
  });
  test('BB05 premature genuine lease release keeps its original entitlement failure',async()=>{
    await withScene(f=>{const b=f.addButton();f.lease.release();code(()=>{b.enabled=false;},'ASSET_LEASE_RELEASED');dead(b);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,1);assert.equal(f.texture.isDisposed,true);assert.equal(f.input.state,'idle');});
  });
  test('BB05 eager SDK accessors remain authoritative across a late optional import',async()=>{
    const {stdout,stderr}=await promisify(execFile)(process.execPath,[fileURLToPath(import.meta.url),'--late-prototype-child'],{timeout:30000,maxBuffer:1024*1024});assert.equal(stderr,'');assert.deepEqual(JSON.parse(stdout),{lateImport:true,mutations:4,terminal:true,poisonReads:0});
  });
}

async function runLatePrototypeChild(){
  let lease,poisonReads=0;
  // The public root import above already triggered genuine eager authority capture.
  // Replace exposed prototypes before the first optional-entry import in this process.
  await withScene(f=>{lease=f.lease;for(const kind of ['lease','crop','hit','touch']){const b=f.addButton();writeOriginal(kind,b.display,{lease:undefined,crop:PRESSED,hit:{x:1,y:0,width:8,height:6},touch:false}[kind]);code(()=>{b.enabled=false;},'BITMAP_BUTTON_SKIN_INVALID');dead(b);}const terminal=f.addButton();Reflect.apply(original.bitmapDispose,terminal.display,[]);dead(terminal);assert.equal(poisonReads,0);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,0);},
    {beforeOptional({restorers}){for(const [prototype,key,value] of [[sdk.Bitmap.prototype,'textureLease',()=>lease],[sdk.Bitmap.prototype,'sourceRect',()=>UP],[sdk.DisplayObject.prototype,'hitArea',()=>AREA],[sdk.DisplayObject.prototype,'touchEnabled',()=>true],[sdk.DisplayObject.prototype,'isDisposed',()=>false]]){const descriptor=Object.getOwnPropertyDescriptor(prototype,key);restorers.push(override(prototype,key,{get(){poisonReads++;return value();},...(descriptor.set?{set:descriptor.set}:{})}));}}});
  process.stdout.write(JSON.stringify({lateImport:true,mutations:4,terminal:true,poisonReads})+'\n');
}
if(lateChild)await runLatePrototypeChild();else registerLifetimeCases();
