import test from 'node:test';
import assert from 'node:assert/strict';
const { createCanvasHost } = await import('@egret/engine/web');
function fixture() {
  const calls = [];
  const context = new Proxy({ isContextLost: () => false }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    set(target, key, value) { target[key] = value; calls.push([key, value]); return true; }
  });
  let width = 0, height = 0;
  const canvas = { getContext: () => context, get width() { return width; }, get height() { return height; }, set width(v) { width=v; calls.push(['width',v]); }, set height(v) { height=v; calls.push(['height',v]); } };
  return { canvas, context, calls };
}
const matrix = { a:1,b:0,c:0,d:1,tx:0,ty:0 };
const rect = { x:0,y:0,width:10,height:10 };
const frame = () => ({ frameId:1,width:20,height:10,clearColor:0,clearAlpha:1,commands:[{kind:'rect',matrix:{...matrix},rect:{...rect},color:0xff0000,alpha:0.5,clips:[]}] });
const code = value => error => error.code === value;
test('lifecycle, fixed surface, reset each frame, and terminal close', async () => {
  const f=fixture(), host=createCanvasHost({canvas:f.canvas,pixelRatio:1.5});
  assert.equal(host.surface,f.canvas);
  assert.throws(()=>host.renderFrame(frame()),code('CANVAS_HOST_NOT_STARTED'));
  host.start(); host.start(); host.renderFrame(frame()); host.renderFrame(frame());
  assert.equal(f.canvas.width,30); assert.equal(f.canvas.height,15);
  assert.equal(f.calls.filter(c=>c[0]==='width').length,2);
  assert.equal(f.calls.filter(c=>c[0]==='fillRect').length,4);
  await host.close(); assert.throws(()=>host.start(),code('CANVAS_HOST_CLOSED'));
  assert.throws(()=>host.renderFrame(frame()),code('CANVAS_HOST_CLOSED'));
});
test('all invalid and derived values reject before mutation', () => {
  const f=fixture(),host=createCanvasHost({canvas:f.canvas}); host.start();
  for(const mutate of [v=>v.commands[0].alpha=NaN,v=>v.commands[0].matrix.tx=Infinity,v=>v.width=1e20,v=>{v.commands[0].rect.x=Number.MAX_VALUE;v.commands[0].rect.width=Number.MAX_VALUE;},v=>v.frameId=0,v=>v.commands[0].kind='other']) {
    const v=structuredClone(frame()); mutate(v); const count=f.calls.length;
    assert.throws(()=>host.renderFrame(v)); assert.equal(f.calls.length,count);
  }
});
test('getters cannot close or reenter before mutation and idle barrier waits', async () => {
  const f=fixture(),host=createCanvasHost({canvas:f.canvas}); host.start();
  const v=frame(); let closed;
  Object.defineProperty(v,'width',{get(){ assert.throws(()=>host.renderFrame(frame()),code('CANVAS_FRAME_REENTRANT')); closed=host.close(); return 20; }});
  assert.throws(()=>host.renderFrame(v),code('CANVAS_HOST_CLOSED')); assert.equal(f.calls.length,0); await closed;
});
test('close during drawing stops later primitives; failures release idle barrier', async () => {
  const f=fixture(),host=createCanvasHost({canvas:f.canvas}); host.start();
  let n=0,closed;
  f.context.fillRect=()=>{ if(++n===2) closed=host.close(); };
  const v=frame();v.commands.push(structuredClone(v.commands[0])); host.renderFrame(v);assert.equal(n,2);await closed;
  const g=fixture(),other=createCanvasHost({canvas:g.canvas});other.start();g.context.fillRect=()=>{throw Error('draw');};
  assert.throws(()=>other.renderFrame(frame()),code('CANVAS_RENDER_FAILED'));
  assert.throws(()=>other.renderFrame(frame()),code('CANVAS_HOST_CLOSED'));assert.throws(()=>other.start(),code('CANVAS_HOST_CLOSED'));await other.close();
});
test('stop before start and invalid options',async()=>{
  const f=fixture(),host=createCanvasHost({canvas:f.canvas});host.stop();assert.throws(()=>host.start(),code('CANVAS_HOST_CLOSED'));await host.close();
  for(const options of [{canvas:null},{canvas:f.canvas,pixelRatio:0},{canvas:f.canvas,maxBackingPixels:1.5}])assert.throws(()=>createCanvasHost(options),code('CANVAS_HOST_INVALID'));
});

test('context availability/loss, assigned dimensions, backing budgets and scaled corner overflow',async()=>{
  const f=fixture();f.canvas.getContext=()=>null;
  assert.throws(()=>createCanvasHost({canvas:f.canvas}).start(),code('CANVAS_CONTEXT_UNAVAILABLE'));
  const g=fixture(),host=createCanvasHost({canvas:g.canvas,pixelRatio:2,maxBackingPixels:1000});host.start();
  const v=frame();v.width=30;assert.throws(()=>host.renderFrame(v),code('CANVAS_BACKING_LIMIT'));assert.equal(g.calls.length,0);
  const overflow=frame();overflow.commands[0].matrix.a=Number.MAX_VALUE;
  assert.throws(()=>host.renderFrame(overflow),code('CANVAS_FRAME_INVALID'));assert.equal(g.calls.length,0);
  g.context.isContextLost=()=>true;g.calls.length=0;
  assert.throws(()=>host.renderFrame(frame()),code('CANVAS_CONTEXT_LOST'));assert.equal(g.calls.length,0);await host.close();
  const k=fixture();Object.defineProperty(k.canvas,'width',{get:()=>0,set:()=>{}});
  const allocation=createCanvasHost({canvas:k.canvas});allocation.start();assert.throws(()=>allocation.renderFrame(frame()),code('CANVAS_BACKING_LIMIT'));
  assert.throws(()=>allocation.renderFrame(frame()),code('CANVAS_HOST_CLOSED'));assert.throws(()=>allocation.start(),code('CANVAS_HOST_CLOSED'));await allocation.close();
});
test('stable copy survives mutation of previously read fields',async()=>{
  const f=fixture(),host=createCanvasHost({canvas:f.canvas});host.start();
  const v=structuredClone(frame());Object.defineProperty(v.commands[0],'clips',{get(){v.commands[0].matrix.tx=999;v.commands[0].rect.width=999;return [];}});
  host.renderFrame(v);
  assert.deepEqual(f.calls.filter(c=>c[0]==='setTransform').at(-1),['setTransform',1,0,0,1,0,0]);
  assert.deepEqual(f.calls.filter(c=>c[0]==='fillRect').at(-1),['fillRect',0,0,10,10]);await host.close();
});
test('one supplied canvas excludes two engines and engine retains host error cause',async()=>{
  const {createEngine}=await import('@egret/engine');const f=fixture(),host=createCanvasHost({canvas:f.canvas});
  const engine=await createEngine({host});
  await assert.rejects(createEngine({host:createCanvasHost({canvas:f.canvas})}));
  f.context.isContextLost=()=>true;
  assert.throws(()=>engine.renderFrame({width:20,height:10}),error=>error.code==='FRAME_RENDER_FAILED' && error.cause.code==='CANVAS_CONTEXT_LOST');await engine.dispose();
});
test('root and web imports do not read DOM globals or start a scheduler',()=>{
  return import('node:child_process').then(({spawnSync})=>{
    const script=`for(const name of ['window','document','HTMLCanvasElement','setTimeout','requestAnimationFrame'])Object.defineProperty(globalThis,name,{get(){throw Error('import touched '+name)}});await import('@egret/engine');await import('@egret/engine/web');`;
    const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  });
});

test('Canvas retains custom command/clip iterators and getter fault identity',async()=>{
  const {EgretError}=await import('@egret/engine');
  const f=fixture(),host=createCanvasHost({canvas:f.canvas});host.start();
  const v=frame(),alternate=structuredClone(v.commands[0]);alternate.color=0x00ff00;
  alternate.clips[Symbol.iterator]=function*(){yield {matrix:{...matrix},rect:{x:3,y:4,width:5,height:6}};};
  v.commands[Symbol.iterator]=function*(){yield alternate;};
  host.renderFrame(v);
  assert.ok(f.calls.some(c=>c[0]==='rect'&&c[1]===3&&c[2]===4&&c[3]===5&&c[4]===6));
  assert.ok(f.calls.some(c=>c[0]==='fillStyle'&&c[1]==='#00ff00'));
  for(const cause of [Error('getter'),new EgretError('TEST_GETTER')]){
    const bad=frame();Object.defineProperty(bad,'width',{get(){throw cause;}});const before=f.calls.length;
    assert.throws(()=>host.renderFrame(bad),e=>cause instanceof EgretError?e===cause:e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);
    assert.equal(f.calls.length,before);
  }
  assert.throws(()=>host.renderFrame({...frame(),clearAlpha:2}),code('CANVAS_FRAME_INVALID'));
  assert.throws(()=>host.renderFrame({...frame(),width:16777217}),code('CANVAS_BACKING_LIMIT'));
  await host.close();
});


