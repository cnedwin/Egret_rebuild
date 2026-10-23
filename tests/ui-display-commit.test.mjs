import test from 'node:test';
import assert from 'node:assert/strict';
import { createStage, createScope, createEventType, DisplayObjectContainer, DisplayObject } from '@egret/runtime';
const ui = await import('@egret/runtime/ui').catch(() => ({}));
const code = expected => error => error?.code === expected;
function setup() {
  assert.equal(typeof ui.createUiDisplayOperations, 'function', 'runtime UI assembly must exist');
  const diagnostics = [];
  const context = { assertOpen() {}, report(d) { diagnostics.push(d); }, captureCleanup() {} };
  const stage = createStage(context), scope = createScope(context, () => {});
  const operations = ui.createUiDisplayOperations(stage), root = operations.createWrapper(scope);
  return { context, stage, scope, operations, root, diagnostics };
}
test('UNIT UI publishes prepared geometry and topology while preserving Stage siblings', () => {
  const {stage, scope, operations: o, root} = setup();
  const before = scope.use(new DisplayObjectContainer()); stage.addChild(before);
  const row = o.createWrapper(scope), content = scope.use(new DisplayObject());
  const token = o.prepare(root, [{wrapper: root, children: [row], x: 10, clipRect: {x:0,y:0,width:100,height:100}}, {wrapper: row, children:[content], y:20, touchEnabled:true, hitArea:{x:0,y:0,width:30,height:40}}]);
  assert.equal(root.parent, undefined); assert.equal(row.y, 0);
  o.commit(token);
  assert.equal(stage.getChildAt(0), before); assert.equal(stage.getChildAt(1), root);
  assert.equal(stage.hitTest(15,25), row);
  const after = scope.use(new DisplayObject()); stage.addChild(after);
  o.commit(o.prepare(root, [{wrapper:row,y:40}]));
  assert.equal(stage.getChildAt(2), after); assert.equal(stage.hitTest(15,25), undefined);
  assert.equal(stage.hitTest(15,45), row);
  assert.throws(() => o.commit(token), code('UI_STALE_PREPARATION'));
  scope.dispose(); assert.equal(root.isDisposed,true); assert.equal(stage.numChildren,0);
});
test('UNIT managed writes, removals and direct disposal refuse without partial batch edits', () => {
  const {stage, scope, operations:o, root} = setup();
  const plain = scope.use(new DisplayObject()); stage.addChild(plain);
  o.commit(o.prepare(root, []));
  for (const operation of [() => {root.x=9;}, () => {root.hitArea=undefined;}, () => {root.touchEnabled=true;}, () => {root.touchChildren=false;}, () => root.addChild(new DisplayObject()), () => stage.removeChild(root), () => stage.removeChildren(), () => stage.setChildIndex(root,0), () => root.dispose(), () => plain.parent.addChild(root)]) assert.throws(operation,code('UI_MANAGED_GEOMETRY'));
  assert.equal(stage.numChildren,2); assert.equal(stage.getChildAt(0),plain);
  plain.x=3; assert.equal(plain.x,3);
  scope.dispose(); assert.equal(root.isDisposed,true); root.dispose();
});
test('UNIT stale sibling plan and unsupported Stage retain old geometry', () => {
  const {stage, scope, operations:o, root} = setup(); o.commit(o.prepare(root,[{wrapper:root,x:5}]));
  const plan=o.prepare(root,[{wrapper:root,x:50}]); stage.addChild(scope.use(new DisplayObject()));
  assert.throws(()=>o.commit(plan),code('UI_STALE_PREPARATION')); assert.equal(root.x,5); assert.equal(stage.numChildren,2);
  const plan2=o.prepare(root,[{wrapper:root,x:50}]); stage.scaleX=2;
  assert.throws(()=>o.commit(plan2),code('UI_STAGE_TRANSFORM_UNSUPPORTED')); assert.equal(root.x,5);
  stage.scaleX=1; scope.dispose();
});
test('UNIT borrowed content rejects foreign owner, disposed descendants and cycles', () => {
  const {context, scope, operations:o, root} = setup(); const other=createScope(context,()=>{});
  const foreign=other.use(new DisplayObject());
  assert.throws(()=>o.prepare(root,[{wrapper:root,children:[foreign]}]),code('UI_CONTENT_INVALID'));
  assert.equal(foreign.isDisposed,false); assert.equal(foreign.parent,undefined);
  assert.throws(()=>o.prepare(root,[{wrapper:root,children:[root]}]),code('UI_CONTENT_INVALID'));
  const dead=scope.use(new DisplayObject()); dead.dispose();
  assert.throws(()=>o.prepare(root,[{wrapper:root,children:[dead]}]),code('UI_CONTENT_INVALID'));
  scope.dispose(); other.dispose();
});
test('UNIT Scope abort cannot mutate another live managed wrapper during terminal cleanup', () => {
  const {context,scope,operations:o,root}=setup(); const binding=createScope(context,()=>{}), row=o.createWrapper(binding);
  o.commit(o.prepare(root,[{wrapper:root,children:[row]}]));
  let observed=false;
  binding.signal.addEventListener('abort', ()=>{assert.throws(()=>{root.visible=false;},code('UI_MANAGED_GEOMETRY')); observed=true;});
  binding.dispose(); assert.equal(observed,true); assert.equal(row.isDisposed,true); assert.equal(root.isDisposed,false);
  o.detach(root); assert.equal(root.parent,undefined); scope.dispose();
});

test('UNIT every managed visual and tree entry refuses before caller getters or hooks', () => {
  const {stage,scope,operations:o,root}=setup();
  const row=o.createWrapper(scope), content=scope.use(new DisplayObject());
  o.commit(o.prepare(root,[{wrapper:root,children:[row]},{wrapper:row,children:[content]}]));
  let reads=0;
  const rect={get x(){reads++; return 0;},y:0,width:1,height:1};
  for(const [key,value] of Object.entries({x:1,y:1,scaleX:2,scaleY:2,rotation:1,anchorOffsetX:1,anchorOffsetY:1,alpha:.5,visible:false,clipRect:rect,hitArea:rect,touchEnabled:true,touchChildren:false,renderBoundary:'isolate',sharedMaterial:null})) {
    assert.throws(()=>{row[key]=value;},code('UI_MANAGED_GEOMETRY'),key);
  }
  assert.equal(reads,0);
  const other=scope.use(new DisplayObjectContainer());
  for(const mutate of [()=>row.addChildAt(other,0),()=>row.removeChild(content),()=>row.removeChildren(),()=>row.setChildIndex(content,0),()=>other.addChild(content),()=>other.addChildAt(row,0),()=>stage.addChildAt(root,0),()=>stage.dispose()]) assert.throws(mutate,code('UI_MANAGED_GEOMETRY'));
  assert.equal(content.parent,row); assert.equal(root.parent,stage); scope.dispose();
});
test('UNIT original per-wrapper cleanup bypasses a shadow disposer without unlocking peers', () => {
  const {context,scope,operations:o,root,diagnostics}=setup();
  const binding=createScope(context,()=>{}), row=o.createWrapper(binding);
  o.commit(o.prepare(root,[{wrapper:root,children:[row]}]));
  let shadowCalls=0, cleanupCalls=0, diagnosticCalls=0;
  row.dispose=()=>{shadowCalls++; throw Error('shadow must not run');};
  const failure=Error('signal removal failure');
  const signal={aborted:false,reason:undefined,addEventListener(){},removeEventListener(){
    cleanupCalls++;
    assert.equal(row.isDisposed,true);
    assert.equal(row.parent,undefined);
    assert.throws(()=>{root.x=20;},code('UI_MANAGED_GEOMETRY'));
    throw failure;
  }};
  row.on(createEventType('ui-cleanup-unit'),()=>{}, {signal});
  const originalReport=context.report;
  context.report=d=>{diagnosticCalls++; assert.throws(()=>root.dispose(),code('UI_MANAGED_GEOMETRY')); originalReport(d);};
  binding.dispose();
  assert.equal(shadowCalls,0); assert.equal(cleanupCalls,1); assert.equal(diagnosticCalls,1);
  assert.equal(diagnostics[0].code,'EVENT_LISTENER_CLEANUP_FAILED'); assert.equal(diagnostics[0].cause,failure);
  assert.equal(root.isDisposed,false); assert.equal(root.numChildren,0);
  scope.dispose();
});
test('UNIT content topology, descendant lifetime and binding Scope changes invalidate prepared plans', () => {
  for(const change of ['add','dispose','scope']) {
    const {context,scope,operations:o,root}=setup();
    const binding=createScope(context,()=>{}), row=o.createWrapper(binding), content=binding.use(new DisplayObjectContainer());
    const leaf=binding.use(new DisplayObject()); content.addChild(leaf);
    o.commit(o.prepare(root,[]));
    const plan=o.prepare(root,[{wrapper:root,children:[row]},{wrapper:row,children:[content],y:55}]);
    if(change==='add')content.addChild(binding.use(new DisplayObject()));
    if(change==='dispose')leaf.dispose();
    if(change==='scope')binding.dispose();
    assert.throws(()=>o.commit(plan),code('UI_STALE_PREPARATION'));
    assert.equal(root.numChildren,0); assert.equal(row.y,0);
    binding.dispose(); scope.dispose();
  }
});
test('UNIT content exact node/depth caps and foreign Engine never transfer ownership', () => {
  const {scope,operations:o,root}=setup();
  const wide=scope.use(new DisplayObjectContainer());
  for(let index=0;index<31;index++)wide.addChild(scope.use(new DisplayObject()));
  o.validateContent(wide,scope);
  const excess=scope.use(new DisplayObject()); wide.addChild(excess);
  assert.throws(()=>o.validateContent(wide,scope),code('UI_CONTENT_INVALID')); wide.removeChild(excess);
  const deep=scope.use(new DisplayObjectContainer()); let tail=deep;
  for(let depth=2;depth<=8;depth++){const child=scope.use(new DisplayObjectContainer()); tail.addChild(child);tail=child;}
  o.validateContent(deep,scope); tail.addChild(scope.use(new DisplayObject()));
  assert.throws(()=>o.validateContent(deep,scope),code('UI_CONTENT_INVALID'));
  const other=setup(); const foreign=other.scope.use(new DisplayObject());
  assert.throws(()=>o.validateContent(foreign,scope),code('UI_CONTENT_INVALID')); assert.equal(foreign.isDisposed,false);
  assert.throws(()=>o.prepare(root,[{wrapper:root,children:[other.root]}]),code('UI_CONTENT_INVALID'));
  scope.dispose(); other.scope.dispose();
});
test('UNIT detached replaced hit identity and root terminal detachment preserve unrelated scene', () => {
  const {context,stage,scope,operations:o,root}=setup();
  const one=createScope(context,()=>{}), two=createScope(context,()=>{}), old=o.createWrapper(one), next=o.createWrapper(two);
  const area={x:0,y:0,width:40,height:40};
  o.commit(o.prepare(root,[{wrapper:root,children:[old]},{wrapper:old,touchEnabled:true,hitArea:area}]));
  assert.equal(stage.hitTest(5,5),old);
  const sibling=scope.use(new DisplayObject());stage.addChild(sibling);
  o.commit(o.prepare(root,[{wrapper:root,children:[next]},{wrapper:next,touchEnabled:true,hitArea:area}]));
  assert.equal(old.parent,undefined);assert.equal(old.isDisposed,false);assert.equal(stage.hitTest(5,5),next);
  const prepared=o.prepare(root,[{wrapper:root,x:10}]);o.detach(root);
  assert.equal(stage.numChildren,1);assert.equal(stage.getChildAt(0),sibling);assert.equal(stage.hitTest(5,5),undefined);
  assert.throws(()=>o.commit(prepared),code('UI_STALE_PREPARATION'));
  assert.throws(()=>o.prepare(root,[]),code('UI_OWNER_INVALID'));
  one.dispose();two.dispose();scope.dispose();
});
test('UNIT caller getter reentry supersedes outer preparation and getter throws preserve presentation', () => {
  const {scope,operations:o,root}=setup();o.commit(o.prepare(root,[{wrapper:root,x:3}]));
  assert.throws(()=>o.prepare(root,[{wrapper:root,get x(){o.commit(o.prepare(root,[{wrapper:root,x:17}]));return 99;}}]),code('UI_STALE_PREPARATION'));
  assert.equal(root.x,17);
  const cause=Error('rectangle getter');
  assert.throws(()=>o.prepare(root,[{wrapper:root,x:50,clipRect:{get x(){throw cause;},y:0,width:5,height:5}}]),error=>error===cause);
  assert.equal(root.x,17);scope.dispose();
});
test('UNIT copied child lists and rectangle records ignore later caller source edits', () => {
  const {scope,operations:o,root}=setup();const child=o.createWrapper(scope);
  const children=[child],clip={x:0,y:0,width:80,height:70};
  const plan=o.prepare(root,[{wrapper:root,children,clipRect:clip,x:12}]);
  children.length=0;clip.width=1;o.commit(plan);
  assert.equal(root.numChildren,1);assert.equal(root.clipRect.width,80);
  assert.equal(Object.isFrozen(root.clipRect),true);scope.dispose();
});
test('UNIT arbitrary Stage mutations retain ordinary semantics and failed UI plan is single use', () => {
  const {stage,scope,operations:o,root}=setup();o.commit(o.prepare(root,[]));
  for(const [key,value] of Object.entries({x:2,y:2,scaleX:2,scaleY:2,rotation:2,anchorOffsetX:2,anchorOffsetY:2})) {
    const plan=o.prepare(root,[{wrapper:root,x:20}]);const original=stage[key];stage[key]=value;
    assert.equal(stage[key],value);assert.throws(()=>o.commit(plan),code('UI_STAGE_TRANSFORM_UNSUPPORTED'));
    stage[key]=original;assert.throws(()=>o.commit(plan),code('UI_STALE_PREPARATION'));assert.equal(root.x,0);
  }
  scope.dispose();
});

test('UNIT review R1 update getter growth cannot enlarge captured preparation', () => {
  const {scope,operations:o,root}=setup();const extra=o.createWrapper(scope);
  const updates=[{wrapper:root,x:12}];
  Object.defineProperty(updates,0,{get(){updates.push({wrapper:extra,x:77});return {wrapper:root,x:12};}});
  o.commit(o.prepare(root,updates));
  assert.equal(root.x,12);assert.equal(updates.length,2);assert.equal(extra.x,0);
  scope.dispose();
});
test('UNIT review R1 child getter growth cannot publish beyond captured 8192 boundary', () => {
  const {scope,operations:o,root}=setup();
  const children=Array.from({length:8192},()=>o.createWrapper(scope));
  const first=children[0],extra=o.createWrapper(scope);
  Object.defineProperty(children,0,{get(){children.push(extra);return first;}});
  o.commit(o.prepare(root,[{wrapper:root,children}]));
  assert.equal(children.length,8193);assert.equal(root.numChildren,8192);assert.equal(extra.parent,undefined);
  scope.dispose();
});
test('UNIT review R1 update and child Proxy lengths are captured once', () => {
  for(const kind of ['updates','children']) {
    const {scope,operations:o,root}=setup();const child=o.createWrapper(scope);let reads=0;
    const input=new Proxy(kind==='updates'?[{wrapper:root,x:12}]:[child],{
      get(target,key,receiver){if(key==='length')return ++reads===1?1:0;return Reflect.get(target,key,receiver);},
    });
    o.commit(o.prepare(root,kind==='updates'?input:[{wrapper:root,children:input}]));
    assert.equal(reads,1,kind+' length reads');
    if(kind==='updates')assert.equal(root.x,12);else assert.equal(root.getChildAt(0),child);
    scope.dispose();
  }
});
test('UNIT review R1 malformed and over-cap Proxy lengths refuse before entry reads', () => {
  for(const kind of ['updates','children'])for(const length of [-1,.5,NaN,Infinity,8193,'1']) {
    const {scope,operations:o,root}=setup();let entries=0,lengthReads=0;
    const input=new Proxy([],{
      get(_target,key){if(key==='length'){lengthReads++;return length;}entries++;return kind==='updates'?{wrapper:root}:root;},
    });
    assert.throws(()=>o.prepare(root,kind==='updates'?input:[{wrapper:root,children:input}]),code('UI_CAP_EXCEEDED'));
    assert.equal(entries,0);assert.equal(lengthReads,1);scope.dispose();
  }
});
test('UNIT review R1 terminal wrapper cleanup remains handled during later Scope cleanup', () => {
  for(const mode of ['explicit','parent-first']) {
    const {scope,operations:o,root,diagnostics}=setup();
    const row=o.createWrapper(scope),parent=o.createWrapper(scope);
    o.commit(o.prepare(root,[{wrapper:root,children:[parent]},{wrapper:parent,children:[row]}]));
    let shadows=0,ordinary=0;
    row.dispose=()=>{shadows++;throw Error('terminal managed shadow');};
    const value={dispose(){ordinary++;}};scope.use(value);
    value.dispose=()=>{ordinary+=3;};
    if(mode==='explicit')o.disposeWrapper(row);
    // parent was acquired after row; reverse Scope cleanup must retire row through parent first.
    scope.dispose();
    assert.equal(row.isDisposed,true);assert.equal(shadows,0,mode);assert.equal(ordinary,3);
    assert.equal(diagnostics.length,0);scope.dispose();assert.equal(ordinary,3);
  }
});
