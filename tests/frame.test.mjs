import { spawnSync } from 'node:child_process';
import {host as makeHost} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

test('literal world geometry and immutable painter snapshots', async () => {
  assert.equal(typeof egret.Sprite, 'function');
  const engine = await egret.createEngine({host: makeHost().adapter});
  const parent = new egret.Sprite(); parent.x=10; parent.y=20; parent.scaleX=2;
  const child = new egret.Sprite(); child.x=3; child.y=4; child.rotation=90;
  parent.addChild(child); engine.stage.addChild(parent);
  child.graphics.beginFill(0xff0000).drawRect(1,2,3,4).endFill();
  const frame=engine.captureFrame({width:100,height:100});
  const c=frame.commands[0];
  for (const [k,v] of Object.entries({a:0,b:1,c:-2,d:0,tx:16,ty:24})) assert.ok(Math.abs(c.matrix[k]-v)<1e-10);
  for (const [x,y,X,Y] of [[1,2,12,25],[4,2,12,28],[4,6,4,28],[1,6,4,25]]) {
    assert.ok(Math.abs(c.matrix.a*x+c.matrix.c*y+c.matrix.tx-X)<1e-10);
    assert.ok(Math.abs(c.matrix.b*x+c.matrix.d*y+c.matrix.ty-Y)<1e-10);
  }
  child.x=100; child.graphics.clear(); assert.equal(c.rect.width,3);
  assert.ok(Object.isFrozen(c.matrix)); assert.ok(Object.isFrozen(frame.commands));
  assert.equal(frame.frameId,1); assert.equal(frame.clearAlpha,0);
  await engine.dispose();
});

test('frame backend uses original receiver and waits for unwind before close', async () => {
  let engine, closing, stopped=false;
  const host={...makeHost().adapter, renderFrame(frame){assert.equal(this,host); closing=engine.dispose(); assert.equal(stopped,false); assert.equal(engine.stage.isDisposed,false);}, stop(){stopped=true;}, async close(){}};
  engine=await egret.createEngine({host});
  const original=host.renderFrame; original.call=()=>{throw Error('hostile call');}; host.renderFrame=()=>{throw Error('replacement');};
  assert.equal(engine.renderFrame({width:1,height:1}).frameId,1);
  await closing; assert.equal(stopped,true);
});

test('options reentry, failure and missing port preserve capture sequence', async () => {
  const engine=await egret.createEngine({host:makeHost().adapter});
  assert.throws(()=>engine.captureFrame({get width(){assert.throws(()=>engine.captureFrame({width:1,height:1}),{code:'FRAME_REENTRANT'});return NaN;},height:1}),{code:'INVALID_FRAME_OPTIONS'});
  assert.throws(()=>engine.renderFrame({width:1,height:1}),{code:'RENDERER_REQUIRED'});
  assert.equal(engine.captureFrame({width:1,height:1}).frameId,1);
  await engine.dispose();
});


test('fill snapshots, clips, ancestor suppression and atomic validation', async()=>{
 const engine=await egret.createEngine({host:makeHost().adapter}); const p=new egret.Sprite(),c=new egret.Sprite(); p.alpha=.5;c.alpha=.5;p.addChild(c);engine.stage.addChild(p);
 const clip={x:0,y:0,width:10,height:10};p.clipRect=clip;clip.width=99;
 p.graphics.beginFill(1).drawRect(0,0,2,2); c.graphics.beginFill(2,.5).drawRect(0,0,2,2).beginFill(3).drawRect(0,0,3,3).endFill();
 assert.throws(()=>c.graphics.drawRect(0,0,1,1),{code:'GRAPHICS_FILL_REQUIRED'});
 c.graphics.beginFill(4).drawRect(0,0,0,1).beginFill(5,0).drawRect(0,0,1,1);
 let f=engine.captureFrame({width:10,height:10});assert.deepEqual(f.commands.map(x=>[x.color,x.alpha]),[[1,.5],[2,.125],[3,.25]]);assert.equal(f.commands[1].clips[0].rect.width,10);assert.ok(Object.isFrozen(f.commands[1].clips));
 for(const bad of [NaN,Infinity,'1',new Number(1),null]) {assert.throws(()=>{c.x=bad;},{code:'DISPLAY_VALUE_INVALID'});assert.equal(c.x,0);assert.throws(()=>c.graphics.beginFill(bad),{code:'GRAPHICS_VALUE_INVALID'});}
 for(const bad of [-1,1.1,Infinity]) assert.throws(()=>{c.alpha=bad;},{code:'DISPLAY_VALUE_INVALID'});
 assert.throws(()=>{c.visible=1;},{code:'DISPLAY_VALUE_INVALID'});assert.throws(()=>{c.clipRect={x:0,y:0,width:-1,height:1};},{code:'DISPLAY_VALUE_INVALID'});
 p.visible=false;assert.equal(engine.captureFrame({width:1,height:1}).commands.length,0);p.visible=true;p.alpha=0;assert.equal(engine.captureFrame({width:1,height:1}).commands.length,0);
 p.alpha=.5; p.removeChild(c);await engine.dispose();assert.throws(()=>{c.x=1;},{code:'ENGINE_CLOSED'});assert.throws(()=>c.graphics.clear(),{code:'ENGINE_CLOSED'});c.dispose();
});

test('hostile visual getters are ignored and derived overflow rejects before backend',async()=>{
 let calls=0;const engine=await egret.createEngine({host:makeHost({renderFrame(){calls++;}}).adapter});const s=new egret.Sprite();s.graphics.beginFill(1).drawRect(0,0,2,2);engine.stage.addChild(s);
 for(const key of ['x','visible','alpha','clipRect','numChildren']) Object.defineProperty(s,key,{get(){throw Error('public getter');}});
 assert.equal(engine.renderFrame({width:1,height:1}).commands.length,1);
 const p=new egret.Sprite(),c=new egret.Sprite();p.scaleX=Number.MAX_VALUE;c.scaleX=2;p.addChild(c);engine.stage.addChild(p);
 assert.throws(()=>engine.renderFrame({width:1,height:1}),{code:'FRAME_TRANSFORM_INVALID'});assert.equal(calls,1);engine.stage.removeChild(p);assert.equal(engine.captureFrame({width:1,height:1}).frameId,2);await engine.dispose();
});

test('option disposal waits until reads unwind and null clear values reject',async()=>{
 const engine=await egret.createEngine({host:makeHost().adapter});for(const key of ['clearAlpha','clearColor'])assert.throws(()=>engine.captureFrame({width:1,height:1,[key]:null}),{code:'INVALID_FRAME_OPTIONS'});
 let closing;assert.throws(()=>engine.captureFrame({get width(){closing=engine.dispose();assert.equal(engine.stage.isDisposed,false);return 1;},height:1}),{code:'ENGINE_CLOSED'});await closing;
});

test('renderer getter rejection occurs before surface reservation',async()=>{
 const surface={};const bad=makeHost({surface}).adapter;Object.defineProperty(bad,'renderFrame',{get(){throw Error('getter');}});await assert.rejects(egret.createEngine({host:bad}),{code:'INVALID_RENDERER'});const engine=await egret.createEngine({host:makeHost({surface}).adapter});await engine.dispose();
});


test('backend failures isolate diagnostics and observe native async rejection',async()=>{
 const cause=Error('backend');let mode=0,diagnostics=[];
 const engine=await egret.createEngine({host:makeHost({renderFrame(){if(mode===0)throw cause;if(mode===1)return 42;return Promise.reject(cause);}}).adapter,onDiagnostic(d){diagnostics.push(d);throw Error('observer');}});
 for(mode=0;mode<3;mode++)assert.throws(()=>engine.renderFrame({width:1,height:1}),{code:'FRAME_RENDER_FAILED'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(diagnostics[0].cause,cause);assert.equal(diagnostics[0].phase,'graphics');assert.equal(engine.captureFrame({width:1,height:1}).frameId,4);await engine.dispose();
});

test('deep traversal does not depend on public recursion',async()=>{
 const engine=await egret.createEngine({host:makeHost().adapter});const nodes=[];let current=engine.stage;
 for(let i=0;i<1200;i++){const next=new egret.Sprite();current.addChild(next);nodes.push(next);current=next;}
 current.graphics.beginFill(7).drawRect(1,2,3,4);assert.equal(engine.captureFrame({width:1,height:1}).commands[0].color,7);
 for(let i=nodes.length-1;i>=0;i--){nodes[i].dispose();}await engine.dispose();
});

test('each sprite keeps one stable graphics facade',()=>{
 const s=new egret.Sprite(),original=s.graphics;assert.throws(()=>{s.graphics=new egret.Sprite().graphics;},TypeError);assert.equal(s.graphics,original);s.dispose();
});

test('unclipped commands also freeze their empty clip chain',async()=>{
 const engine=await egret.createEngine({host:makeHost().adapter});const s=new egret.Sprite();engine.stage.addChild(s);s.graphics.beginFill(1).drawRect(0,0,1,1);const frame=engine.captureFrame({width:1,height:1});assert.ok(Object.isFrozen(frame.commands[0].clips));await engine.dispose();
});

test('clip getter disposal prevents committing a copied rectangle',async()=>{
 const engine=await egret.createEngine({host:makeHost().adapter});const s=new egret.Sprite();engine.stage.addChild(s);s.clipRect={x:1,y:2,width:3,height:4};let closing;
 assert.throws(()=>{s.clipRect={get x(){closing=engine.dispose();return 0;},y:0,width:10,height:10};},{code:'OBJECT_DISPOSED'});assert.equal(s.clipRect.x,1);await closing;
});

test('host identity is captured once for rendering and shutdown',async()=>{
 const first=makeHost({renderFrame(){assert.equal(this,first.adapter);}}),second=makeHost();let reads=0;
 const engine=await egret.createEngine({get host(){return reads++===0?first.adapter:second.adapter;}});engine.renderFrame({width:1,height:1});await engine.dispose();assert.equal(reads,1);assert.deepEqual(first.trace,['start','stop','close']);assert.deepEqual(second.trace,[]);
});

test('all public structural mutations reject detached bound nodes while closing',async()=>{
 let engine;const p=new egret.Sprite(),a=new egret.Sprite(),b=new egret.Sprite();p.addChild(a);p.addChild(b);
 engine=await egret.createEngine({host:makeHost({renderFrame(){const closing=engine.dispose();assert.throws(()=>p.removeChild(a),{code:'ENGINE_CLOSED'});assert.throws(()=>p.setChildIndex(b,0),{code:'ENGINE_CLOSED'});return undefined;}}).adapter});engine.stage.addChild(p);engine.stage.removeChild(p);engine.renderFrame({width:1,height:1});await engine.dispose();p.dispose();
});


test('foreign native and thenable backend rejections are observed without async submission', () => {
  // An isolated real process makes an unhandled rejection observable without
  // allowing node:test's own rejection tracking to obscure the frame outcome.
  const source = `
    import vm from 'node:vm';
    import { createEngine } from '@egret/engine';
    import { host } from './tests/helpers.mjs';
    const unhandled = [];
    process.on('unhandledRejection', cause => unhandled.push(cause.message));
    const diagnostics = [];
    let closing;
    let stopped = false;
    let beforeCleanup;
    let thenableObserved = false;
    let calls = 0;
    const adapter = host({
      renderFrame() {
        calls++;
        if (calls === 1) {
          closing = engine.dispose();
          beforeCleanup = {stopped, disposed:engine.stage.isDisposed};
          return vm.runInNewContext('Promise.reject(new Error("foreign rejection"))');
        }
        return { then(resolve, reject) { reject(Error('thenable rejection')); } };
      },
      stop() { stopped = true; }
    }).adapter;
    const engine = await createEngine({host: adapter, onDiagnostic(d) { diagnostics.push(d); }});
    let code;
    try { engine.renderFrame({width:1,height:1}); } catch(error) { code = error.code; }
    await closing;
    const other = await createEngine({host: host({renderFrame() {
      return {then(resolve,reject) {thenableObserved=true;reject(Error('thenable rejection'));}};
    }}).adapter});
    let thenableCode;
    try { other.renderFrame({width:1,height:1}); } catch(error) {thenableCode=error.code;}
    const nextId = other.captureFrame({width:1,height:1}).frameId;
    await new Promise(resolve => setImmediate(resolve));
    await other.dispose();
    console.log(JSON.stringify({code,thenableCode,nextId,stopped,beforeCleanup,thenableObserved,diagnostic:diagnostics[0].code,phase:diagnostics[0].phase,unhandled}));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    code:'FRAME_RENDER_FAILED', thenableCode:'FRAME_RENDER_FAILED', nextId:2,
    stopped:true, beforeCleanup:{stopped:false,disposed:false}, thenableObserved:true, diagnostic:'FRAME_RENDER_FAILED', phase:'graphics', unhandled:[]
  });
});


