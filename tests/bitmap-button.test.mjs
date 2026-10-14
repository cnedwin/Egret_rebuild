// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {withScene,sdk,UP,PRESSED,DISABLED,AREA,FRAME,readOriginal,code} from './bitmap-button-api.test.mjs';
const skin=(b,state,crop)=>{assert.equal(b.state,state);assert.deepEqual(readOriginal('crop',b.display),crop);};

test('BB00 factory owns genuine detached Bitmap and borrows the existing lease',async()=>{
  await withScene(f=>{const b=f.addButton();assert.ok(Object.isFrozen(b));assert.ok(b.display instanceof sdk.Bitmap);assert.equal(b.display.parent,undefined);assert.equal(b.enabled,true);skin(b,'up',UP);assert.equal(readOriginal('lease',b.display),f.lease);assert.deepEqual(readOriginal('hit',b.display),AREA);assert.equal(readOriginal('touch',b.display),true);assert.equal(f.scope.use(b),b);assert.equal(f.scope.use(b.display),b.display);const other=f.engine.createScope();code(()=>other.use(b),'OWNERSHIP_CONFLICT');code(()=>f.scope.use(f.lease),'OWNERSHIP_CONFLICT');other.dispose();assert.equal(f.browser.attempts.length,5);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,0);assert.equal(f.renders.length,0);assert.equal(f.engine.clock.elapsedSeconds,0);});
});

test('BB01 private skin commits precede routed listeners; callback follows complete activate route',async()=>{
  await withScene(f=>{const trace=[];let receiver,received;
    const b=f.attach(f.addButton({onActivate:function(payload){receiver=this;received=payload;trace.push(['callback',b.state]);return 42;}}));
    f.stage.on(f.input.events.begin,()=>{skin(b,'pressed',PRESSED);trace.push(['capture-begin',b.state]);},{capture:true,priority:1000000});
    b.display.on(f.input.events.begin,()=>trace.push(['begin',b.state]));
    b.display.on(f.input.events.end,()=>{skin(b,'up',UP);trace.push(['end',b.state]);});
    b.display.on(f.input.events.activate,()=>trace.push(['activate-target',b.state]));
    f.stage.on(f.input.events.activate,()=>trace.push(['activate-stage',b.state]));
    f.down();f.up();assert.deepEqual(trace,[['capture-begin','pressed'],['begin','pressed'],['end','up'],['activate-target','up'],['activate-stage','up'],['callback','up']]);
    assert.equal(receiver,undefined);assert.equal(Object.isFrozen(received),true);assert.deepEqual(received,{pointerId:7,globalX:12,globalY:12,pointerType:'mouse',button:0});assert.equal(f.renders.length,0);assert.equal(f.engine.clock.elapsedSeconds,0);assert.deepEqual(f.diagnostics,[]);
  });
});
for(const veto of ['begin','end'])test('BB01 '+veto+' default veto suppresses callback while ending in up',async()=>{
  await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));b.display.on(f.input.events[veto],e=>e.preventDefault());f.down();skin(b,'pressed',PRESSED);f.up();skin(b,'up',UP);assert.equal(calls,0);assert.equal(f.input.state,'idle');});
});
for(const method of ['stopPropagation','stopImmediatePropagation'])test('BB01 '+method+' cannot bypass private transitions or the callback entitlement',async()=>{
  await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));f.stage.on(f.input.events.begin,e=>{skin(b,'pressed',PRESSED);e[method]();},{capture:true,priority:1000000});f.stage.on(f.input.events.activate,e=>e[method](),{capture:true});f.down();f.up();skin(b,'up',UP);assert.equal(calls,1);});
});

test('BB02 shared input ends original target on outside or sibling release',async()=>{
  await withScene(f=>{let aCalls=0,bCalls=0,ends=0;const a=f.attach(f.addButton({onActivate(){aCalls++;}})),b=f.attach(f.addButton({onActivate(){bCalls++;}}),32,12);a.display.on(f.input.events.end,()=>{ends++;skin(a,'up',UP);});
    for(const point of [[90,70],[32,12]]){f.down();skin(a,'pressed',PRESSED);skin(b,'up',UP);f.up(...point);skin(a,'up',UP);}assert.equal(ends,2);assert.equal(aCalls,0);assert.equal(bCalls,0);f.down(32,12);f.up(32,12);assert.equal(bCalls,1);assert.equal(f.browser.attempts.length,5);assert.equal(f.counts.loads,1);
  });
});
for(const change of ['clip','cover','hide'])test('BB02 '+change+' after end is re-picked before callback',async()=>{
  await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));b.display.on(f.input.events.end,()=>{if(change==='clip')b.display.clipRect={x:0,y:0,width:1,height:1};if(change==='hide')b.display.visible=false;if(change==='cover'){const cover=f.scope.use(new sdk.Sprite());cover.touchEnabled=true;cover.hitArea={x:0,y:0,width:100,height:80};f.stage.addChild(cover);}});f.down();f.up();skin(b,'up',UP);assert.equal(calls,0);});
});

// A change during activate is later than MouseInput's existing post-end pick.
test('BB02 complete activate route must be followed by the Button current-release pick',async()=>{
  await withScene(f=>{let calls=0;const route=[];const b=f.attach(f.addButton({onActivate(){calls++;}}));b.display.on(f.input.events.end,()=>{route.push('end');assert.equal(f.stage.hitTest(12,12),b.display);});b.display.on(f.input.events.activate,()=>{route.push('activate-target');assert.equal(f.stage.hitTest(12,12),b.display);});f.stage.on(f.input.events.activate,()=>{route.push('activate-stage-cover');const cover=f.scope.use(new sdk.Sprite());cover.touchEnabled=true;cover.hitArea={x:0,y:0,width:100,height:80};f.stage.addChild(cover);assert.equal(f.stage.hitTest(12,12),cover);});f.down();f.up();assert.deepEqual(route,['end','activate-target','activate-stage-cover']);skin(b,'up',UP);assert.equal(f.input.state,'idle');assert.equal(calls,0);});
});

test('BB02 nested scale and authored pivot use actual Stage picking and bounds',async()=>{
  await withScene(f=>{let calls=0;const parent=f.scope.use(new sdk.Sprite());parent.x=30;parent.y=20;parent.scaleX=2;parent.scaleY=2;f.stage.addChild(parent);const b=f.addButton({onActivate(){calls++;}});Object.assign(b.display,{x:12,y:12,anchorOffsetX:4,anchorOffsetY:3});parent.addChild(b.display);assert.deepEqual(b.display.getBounds(),AREA);assert.deepEqual(f.stage.getBounds(),{x:46,y:38,width:16,height:12});assert.equal(f.stage.hitTest(54,44),b.display);f.down(54,44);f.up(54,44);assert.equal(calls,1);});
});
test('BB03 disabled falls through; undefined defaults true and null is refused',async()=>{
  await withScene(f=>{let lowerCalls=0,upperCalls=0;const lower=f.attach(f.addButton({onActivate(){lowerCalls++;}})),upper=f.attach(f.addButton({enabled:false,onActivate(){upperCalls++;}}));skin(upper,'disabled',DISABLED);assert.equal(readOriginal('touch',upper.display),false);assert.equal(f.stage.hitTest(12,12),lower.display);f.down();f.up();assert.equal(lowerCalls,1);assert.equal(upperCalls,0);upper.enabled=true;skin(upper,'up',UP);assert.equal(f.stage.hitTest(12,12),upper.display);f.down();f.up();assert.equal(upperCalls,1);const defaulted=f.addButton({enabled:undefined});assert.equal(defaulted.enabled,true);skin(defaulted,'up',UP);code(()=>f.inputAPI.createBitmapButton(f.options({enabled:null})),'BITMAP_BUTTON_OPTIONS_INVALID');});
});
for(const phase of ['begin','end','activate'])test('BB03 disable/re-enable during '+phase+' permanently invalidates that gesture',async()=>{
  await withScene(f=>{let calls=0,raw=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));b.display.on(f.input.events[phase],()=>{b.enabled=false;skin(b,'disabled',DISABLED);b.enabled=true;skin(b,'up',UP);},{once:true});b.display.on(f.input.events.activate,()=>raw++);f.down();f.up();assert.equal(raw,1,'raw MouseInput route retains its existing behavior');assert.equal(calls,0);skin(b,'up',UP);f.down();f.up();assert.equal(calls,1);});
});
test('BB03 same enabled value preserves press; hover/move adds no listener or visual state',async()=>{
  await withScene(f=>{let calls=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));f.browser.emit(f.browser.canvas,'pointerenter');f.browser.emit(f.browser.canvas,'pointermove',{clientX:190,clientY:150});skin(b,'up',UP);f.down();b.enabled=true;skin(b,'pressed',PRESSED);f.browser.emit(f.browser.canvas,'pointerleave');f.browser.emit(f.browser.canvas,'pointermove',{clientX:190,clientY:150});skin(b,'pressed',PRESSED);f.up();assert.equal(calls,1);assert.equal(f.browser.attempts.length,5);});
});
for(const reason of ['pointercancel','blur'])test('BB03 '+reason+' resets before routed cancellation with no callback',async()=>{
  await withScene(f=>{let calls=0,cancels=0;const b=f.attach(f.addButton({onActivate(){calls++;}}));b.display.on(f.input.events.cancel,e=>{cancels++;skin(b,'up',UP);assert.equal(e.payload.reason,reason);});f.down();skin(b,'pressed',PRESSED);f.browser.emit(f.browser.window,reason,{pointerId:7});skin(b,'up',UP);assert.equal(cancels,1);f.up();assert.equal(calls,0);});
});

test('BB05 caller sheet retirement and control disposal retain original lease and saved frames',async()=>{
  await withScene(f=>{const callerSheet=f.resourceScope.use(sdk.createSpriteSheet(f.lease,[{name:'caller',...UP}]));const b=f.attach(f.addButton());const saved=f.engine.captureFrame(FRAME),image=f.texture.imageData;callerSheet.dispose();f.down();skin(b,'pressed',PRESSED);const pressed=f.engine.captureFrame(FRAME);b.enabled=false;skin(b,'disabled',DISABLED);const disabled=f.engine.captureFrame(FRAME);b.dispose();assert.equal(b.state,'disposed');assert.equal(readOriginal('disposed',b.display),true);assert.equal(f.lease.value,f.texture);assert.equal(f.counts.loads,1);assert.equal(f.counts.disposals,0);assert.deepEqual(saved.commands[0].sourceRect,UP);assert.deepEqual(pressed.commands[0].sourceRect,PRESSED);assert.deepEqual(disabled.commands[0].sourceRect,DISABLED);f.resourceScope.dispose();assert.equal(f.texture.isDisposed,true);assert.deepEqual(saved.commands[0].sourceRect,UP);assert.equal(sdk.copyImageData2DPixels(image)[0],255);assert.equal(f.counts.disposals,1);});
});
test('BB02 ancestor clipping and touchChildren use genuine current picking; alpha alone does not disable it',async()=>{
  await withScene(f=>{let calls=0;const parent=f.scope.use(new sdk.Sprite());f.stage.addChild(parent);const b=f.addButton({onActivate(){calls++;}});Object.assign(b.display,{x:12,y:12,anchorOffsetX:4,anchorOffsetY:3});parent.addChild(b.display);parent.clipRect={x:0,y:0,width:10,height:20};assert.notEqual(f.stage.hitTest(12,12),b.display);f.down();f.up();assert.equal(calls,0);parent.clipRect=undefined;parent.touchChildren=false;assert.notEqual(f.stage.hitTest(12,12),b.display);f.down();f.up();assert.equal(calls,0);parent.touchChildren=true;b.display.alpha=0;assert.equal(f.stage.hitTest(12,12),b.display);f.down();f.up();assert.equal(calls,1);});
});
