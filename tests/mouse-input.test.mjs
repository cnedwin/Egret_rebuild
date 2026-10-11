import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Controlled WebIDL units only. This fixture makes no native-browser claim and
// delegates every display query and typed event dispatch to the built public SDK.
export const repository=path.resolve(process.env.MI1_TEST_SDK_REPO??fileURLToPath(new URL('..',import.meta.url)));
let publicRoot,publicInput;
export async function loadPublicSDK(input=false) {
  const packageURL=pathToFileURL(path.join(repository,'packages/engine/package.json'));
  const metadata=JSON.parse(await readFile(packageURL,'utf8'));
  assert.equal(metadata.name,'@egret/engine','SETUP: genuine public package');
  assert.deepEqual(metadata.exports['.'],{types:'./dist/index.d.ts',import:'./dist/index.js'});
  publicRoot??=await import(new URL(metadata.exports['.'].import,packageURL));
  if(!input)return publicRoot;
  assert.deepEqual(metadata.exports['./web/input'],{types:'./dist/web/input.d.ts',import:'./dist/web/input.js'});
  publicInput??=await import(new URL(metadata.exports['./web/input'].import,packageURL));
  assert.deepEqual(Object.keys(publicInput),['createMouseInput']);
  return {...publicRoot,...publicInput};
}

export function captureThrown(action) {
  try{return {present:false,value:action()};}catch(cause){return {present:true,cause};}
}
export function assertCode(action,code,cause,hasCause=false) {
  const failure=captureThrown(action);
  assert.equal(failure.present,true,'expected '+code);
  assert.equal(failure.cause?.code,code);
  if(hasCause){assert.ok(Object.hasOwn(failure.cause,'cause'));assert.equal(failure.cause.cause,cause);}
  return failure.cause;
}
export function shadow(object,name,descriptor) {
  const original=Object.getOwnPropertyDescriptor(object,name);
  Object.defineProperty(object,name,{configurable:true,...descriptor});
  return ()=>{if(original)Object.defineProperty(object,name,original);else assert.equal(Reflect.deleteProperty(object,name),true);};
}

export function controlledBrowser() {
  const BaseTarget=globalThis.EventTarget,BaseEvent=globalThis.Event;
  const nativeAdd=BaseTarget.prototype.addEventListener,nativeRemove=BaseTarget.prototype.removeEventListener;
  const nativeDispatch=BaseTarget.prototype.dispatchEvent;
  const nodes=new WeakMap(),styles=new WeakMap(),rects=new WeakMap(),windows=new WeakMap(),pointers=new WeakMap();
  const elementBrands=new WeakSet(),canvasBrands=new WeakSet(),documentBrands=new WeakSet();
  const attempts=[],removals=[],reads=[],installed=[];
  const hooks={add:undefined,remove:undefined,field:undefined,style:undefined,rect:undefined};
  let serial=0;
  function brand(map,value,name){const state=map.get(value);if(!state)throw new TypeError('controlled '+name+' receiver');return state;}
  function read(map,value,name){const state=brand(map,value,name);reads.push(name);hooks.field?.(name,value);return state[name];}
  function capture(options){return typeof options==='boolean'?options:Boolean(options?.capture);}
  class ControlledTarget extends BaseTarget {
    addEventListener(type,listener,options) {
      const pair={target:this,type,listener,options,capture:capture(options),sequence:++serial,added:false,removed:false};
      attempts.push(pair);hooks.add?.('before',pair);
      Reflect.apply(nativeAdd,this,[type,listener,options]);pair.added=true;installed.push(pair);
      hooks.add?.('after',pair);
    }
    removeEventListener(type,listener,options) {
      const removal={target:this,type,listener,options,capture:capture(options)};removals.push(removal);
      hooks.remove?.('before',removal);
      Reflect.apply(nativeRemove,this,[type,listener,options]);
      for(const pair of installed)if(pair.target===this&&pair.type===type&&pair.listener===listener&&pair.capture===removal.capture)pair.removed=true;
      hooks.remove?.('after',removal);
    }
  }
  class ControlledNode extends ControlledTarget {
    constructor(nodeType,ownerDocument,parentNode=null){super();nodes.set(this,{nodeType,ownerDocument,parentNode});}
    get nodeType(){return read(nodes,this,'nodeType');}
    get ownerDocument(){return read(nodes,this,'ownerDocument');}
    get parentNode(){return read(nodes,this,'parentNode');}
  }
  class ControlledElement extends ControlledNode {
    constructor(ownerDocument,parentNode=null){super(1,ownerDocument,parentNode);elementBrands.add(this);styles.set(this,new ControlledStyle());}
    getBoundingClientRect(){if(!elementBrands.has(this))throw new TypeError('controlled Element receiver');reads.push('getBoundingClientRect');hooks.rect?.(this);return rect;}
  }
  class ControlledHTMLElement extends ControlledElement {}
  class ControlledCanvas extends ControlledHTMLElement {
    constructor(ownerDocument,parentNode){super(ownerDocument,parentNode);canvasBrands.add(this);}
    get width(){if(!canvasBrands.has(this))throw new TypeError('controlled HTMLCanvasElement receiver');return 300;}
    get height(){if(!canvasBrands.has(this))throw new TypeError('controlled HTMLCanvasElement receiver');return 150;}
  }
  class ControlledDocument extends ControlledNode {
    constructor(){super(9,null);documentBrands.add(this);}
    get defaultView(){if(!documentBrands.has(this))throw new TypeError('controlled Document receiver');return read(nodes,this,'defaultView');}
  }
  class ControlledWindow extends ControlledTarget {
    constructor(){super();windows.set(this,true);}
    getComputedStyle(element){brand(windows,this,'Window');if(!elementBrands.has(element))throw new TypeError('controlled Element receiver');reads.push('getComputedStyle');hooks.style?.(element);return styles.get(element);}
  }
  class ControlledStyle {
    constructor(){styles.set(this,new Map(Object.entries({transform:'none',perspective:'none',translate:'none',rotate:'none',scale:'none',zoom:'1','object-fit':'fill','padding-left':'0px','padding-right':'0px','padding-top':'0px','padding-bottom':'0px','border-left-width':'0px','border-right-width':'0px','border-top-width':'0px','border-bottom-width':'0px'})));}
    getPropertyValue(name){const values=brand(styles,this,'CSSStyleDeclaration');reads.push('css:'+name);return values.get(name)??'';}
  }
  class ControlledRect {
    constructor(value){rects.set(this,value);}
    get left(){return read(rects,this,'left');}
    get top(){return read(rects,this,'top');}
    get width(){return read(rects,this,'width');}
    get height(){return read(rects,this,'height');}
  }
  class ControlledMouseEvent extends BaseEvent {
    constructor(type,value={}){super(type);pointers.set(this,{button:0,clientX:80,clientY:60,...value});}
    get button(){return read(pointers,this,'button');}
    get clientX(){return read(pointers,this,'clientX');}
    get clientY(){return read(pointers,this,'clientY');}
  }
  class ControlledPointerEvent extends ControlledMouseEvent {
    constructor(type,value={}){super(type,{pointerId:7,pointerType:'mouse',isPrimary:true,...value});}
    get pointerId(){return read(pointers,this,'pointerId');}
    get pointerType(){return read(pointers,this,'pointerType');}
    get isPrimary(){return read(pointers,this,'isPrimary');}
  }
  const document=new ControlledDocument(),window=new ControlledWindow();
  nodes.get(document).defaultView=window;
  const html=new ControlledHTMLElement(document,document),parent=new ControlledHTMLElement(document,html),canvas=new ControlledCanvas(document,parent);
  document.documentElement=html;window.document=document;
  const rect=new ControlledRect({left:10,top:20,width:200,height:160});
  const globals={EventTarget:ControlledTarget,Event:BaseEvent,Node:ControlledNode,Element:ControlledElement,HTMLElement:ControlledHTMLElement,HTMLCanvasElement:ControlledCanvas,Document:ControlledDocument,Window:ControlledWindow,CSSStyleDeclaration:ControlledStyle,DOMRectReadOnly:ControlledRect,DOMRect:ControlledRect,MouseEvent:ControlledMouseEvent,PointerEvent:ControlledPointerEvent,window,document};
  const saved=new Map();
  return {
    canvas,parent,html,document,window,rect,hooks,attempts,removals,reads,installed,
    install(){for(const [name,value]of Object.entries(globals)){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}},
    restore(){for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}saved.clear();},
    style(element,name,value){styles.get(styles.get(element)).set(name,value);},
    setRect(value){Object.assign(rects.get(rect),value);},
    setNode(element,value){Object.assign(nodes.get(element),value);},
    adoptCanvasIntoForeignDocument(){
      const foreignDocument=new ControlledDocument(),foreignWindow=new ControlledWindow();
      nodes.get(foreignDocument).defaultView=foreignWindow;
      const foreignHtml=new ControlledHTMLElement(foreignDocument,foreignDocument),foreignParent=new ControlledHTMLElement(foreignDocument,foreignHtml);
      foreignDocument.documentElement=foreignHtml;foreignWindow.document=foreignDocument;
      // Model real adoption: ownership and the complete ordinary ancestor chain
      // move together, rather than assigning one inconsistent ancestor identity.
      Object.assign(nodes.get(canvas),{ownerDocument:foreignDocument,parentNode:foreignParent});
      return {document:foreignDocument,window:foreignWindow,html:foreignHtml,parent:foreignParent};
    },
    addAncestor(){const value=new ControlledHTMLElement(document,nodes.get(canvas).parentNode);nodes.get(canvas).parentNode=value;return value;},
    emit(target,type,value={}){const event=type.startsWith('pointer')?new ControlledPointerEvent(type,value):new BaseEvent(type);Reflect.apply(nativeDispatch,target,[event]);return event;},
    emitEvent(target,event){Reflect.apply(nativeDispatch,target,[event]);},
    event(type,value={}){return new ControlledPointerEvent(type,value);},
    clearReads(){reads.length=0;},
    active(){return installed.filter(pair=>!pair.removed);},
    recover(){hooks.add=undefined;hooks.remove=undefined;for(const pair of installed){Reflect.apply(nativeRemove,pair.target,[pair.type,pair.listener,pair.options]);pair.removed=true;}},
  };
}

export async function withInputFixture(run,{create=true,beforeEngine,afterScope,hostOverrides={}}={}) {
  const sdk=await loadPublicSDK(true),browser=controlledBrowser();
  const {host}=await import(pathToFileURL(path.join(repository,'tests/helpers.mjs')));
  browser.install();const hostFixture=host({surface:browser.canvas,...hostOverrides});
  const diagnostics=[],frames=[];hostFixture.adapter.renderFrame=frame=>{frames.push(frame);};
  let engine,scope,input,failure={present:false};const expectedClose={present:false};
  const restorers=[];
  try {
    await beforeEngine?.({browser,sdk,restorers});
    engine=await sdk.createEngine({host:hostFixture.adapter,onDiagnostic:d=>diagnostics.push(d)});
    scope=engine.createScope();afterScope?.({engine,scope,browser,sdk,diagnostics,restorers});
    const stage=engine.stage,panel=scope.use(new sdk.Sprite()),lower=scope.use(new sdk.Sprite()),upper=scope.use(new sdk.Sprite());
    panel.x=10;panel.y=5;lower.graphics.beginFill(0x112233).drawRect(0,0,50,30).endFill();
    upper.x=20;upper.y=10;upper.graphics.beginFill(0x445566).drawRect(0,0,30,20).endFill();
    stage.addChild(panel);panel.addChild(lower);panel.addChild(upper);
    lower.touchEnabled=true;upper.touchEnabled=true;
    lower.hitArea={x:0,y:0,width:50,height:30};
    upper.hitArea={x:0,y:0,width:30,height:20};
    assert.equal(stage.hitTest(35,20),upper,'SETUP: literal HT1 upper selection');
    assert.equal(stage.hitTest(15,10),lower,'SETUP: literal HT1 lower selection');
    assert.equal(stage.hitTest(90,60),undefined,'SETUP: literal HT1 miss');
    assert.equal(stage.hitTest(60,20),undefined,'SETUP: half-open right boundary');
    const options={engine,scope,width:100,height:80};
    if(create)input=sdk.createMouseInput(options);
    await run({sdk,browser,engine,scope,stage,panel,lower,upper,input,options,diagnostics,frames,hostFixture,restorers,expectedClose});
  }catch(cause){failure={present:true,cause};}
  finally {
    const cleanup=[];
    for(const restore of restorers.reverse())try{restore();}catch(cause){cleanup.push(cause);}
    browser.hooks.add=undefined;browser.hooks.remove=undefined;browser.hooks.field=undefined;browser.hooks.style=undefined;browser.hooks.rect=undefined;
    try{input?.dispose();}catch(cause){cleanup.push(cause);}
    try{await engine?.dispose();if(expectedClose.present)assert.fail('CLEANUP: original Engine failure disappeared');}catch(cause){if(expectedClose.present){try{assert.equal(cause,expectedClose.cause,'CLEANUP: original Engine failure identity changed');}catch(check){cleanup.push(check);}}else cleanup.push(cause);}
    try{if(engine){assert.equal(engine.stage.isDisposed,true);assert.equal(scope.state,'closed');}assert.equal(hostFixture.timers.size,0);assert.deepEqual(hostFixture.trace,['start','stop','close']);}catch(cause){cleanup.push(cause);}
    // Explicit recovery is separate from cleanup assertions; a failed adapter
    // removal must remain observable even though test-owned listeners are retired.
    browser.recover();browser.restore();
    if(cleanup.length)throw new AggregateError(failure.present?[failure.cause,...cleanup]:cleanup,'MI1 fixture cleanup failed',{cause:failure.present?failure.cause:cleanup[0]});
  }
  if(failure.present)throw failure.cause;
}

export function down(f,value={}){return f.browser.emit(f.browser.canvas,'pointerdown',value);}
export function up(f,value={}){return f.browser.emit(f.browser.window,'pointerup',value);}
export function observeRoute(f,type,trace,events=[]) {
  for(const [node,label,capture]of [[f.stage,'stage',true],[f.panel,'panel',true],[f.upper,'upper',true],[f.upper,'upper',false],[f.panel,'panel',false],[f.stage,'stage',false]])
    node.on(type,event=>{trace.push([label,event.eventPhase,f.input.state,event.target===f.upper,event.currentTarget===node]);events.push(event);},{capture});
}
const goldenRoute=state=>[['stage','capturing',state,true,true],['panel','capturing',state,true,true],['upper','atTarget',state,true,true],['upper','atTarget',state,true,true],['panel','bubbling',state,true,true],['stage','bubbling',state,true,true]];

function registerBehaviorTests() {
  test('MI1 literal HT1 golden route, scaled point, immutable events and explicit frames',async()=>{
    await withInputFixture(f=>{
      const begin=[],end=[],activate=[],events=[];
      observeRoute(f,f.input.events.begin,begin,events);observeRoute(f,f.input.events.end,end,events);observeRoute(f,f.input.events.activate,activate,events);
      assert.deepEqual(Object.keys(f.input.events).sort(),['activate','begin','cancel','end']);
      for(const name of ['begin','end','activate','cancel']){const type=f.input.events[name];assert.equal(type.key,'egret.mouse.'+name);assert.equal(type.bubbles,true);assert.equal(type.cancelable,name==='begin'||name==='end');assert.equal(Object.isFrozen(type),true);}
      assert.equal(Object.isFrozen(f.input),true);assert.equal(Object.isFrozen(f.input.events),true);
      const frame=f.engine.renderFrame({width:100,height:80});assert.equal(frame.commands.length,2);
      const native=down(f);assert.equal(native.defaultPrevented,false);assert.equal(f.input.state,'pressed');up(f);
      assert.deepEqual(begin,goldenRoute('pressed'));assert.deepEqual(end,goldenRoute('idle'));assert.deepEqual(activate,goldenRoute('idle'));
      assert.equal(new Set(events).size,3);for(const event of new Set(events)){assert.ok(event instanceof f.sdk.Event);assert.equal(Object.isFrozen(event),true);assert.equal(Object.isFrozen(event.payload),true);assert.deepEqual(event.payload,{pointerId:7,globalX:35,globalY:20,pointerType:'mouse',button:0});}
      assert.equal(f.frames.length,1,'input never renders implicitly');assert.equal(f.input.state,'idle');assert.deepEqual(f.diagnostics,[]);
    });
  });
  for(const veto of ['begin','end','stop'])test('MI1 default allowance '+veto,async()=>{
    await withInputFixture(f=>{const trace=[];f.upper.on(f.input.events.begin,e=>{trace.push('begin');if(veto==='begin')e.preventDefault();if(veto==='stop')e.stopPropagation();});f.upper.on(f.input.events.end,e=>{trace.push('end');if(veto==='end')e.preventDefault();});f.upper.on(f.input.events.activate,e=>{e.preventDefault();trace.push('activate:'+e.defaultPrevented);});down(f);up(f);assert.deepEqual(trace,veto==='stop'?['begin','end','activate:false']:['begin','end']);assert.deepEqual(f.diagnostics,[]);});
  });
  for(const release of [{name:'miss',clientX:190,clientY:140},{name:'different target',clientX:40,clientY:40}])test('MI1 Q1 '+release.name+' ends on original target',async()=>{
    await withInputFixture(f=>{const trace=[];f.upper.on(f.input.events.end,e=>trace.push(['end',e.target===f.upper,e.payload.globalX,e.payload.globalY,f.input.state]));f.upper.on(f.input.events.activate,()=>trace.push('activate'));down(f);up(f,release);assert.deepEqual(trace,[['end',true,(release.clientX-10)/2,(release.clientY-20)/2,'idle']]);assert.deepEqual(f.diagnostics,[]);});
  });
  for(const change of ['hide','transform','clip','touchChildren','cover','order'])test('MI1 Q2 uses same point after end '+change,async()=>{
    await withInputFixture(f=>{const trace=[];f.upper.on(f.input.events.end,()=>{trace.push('end');if(change==='hide')f.upper.visible=false;if(change==='transform')f.upper.x=80;if(change==='clip')f.panel.clipRect={x:0,y:0,width:5,height:5};if(change==='touchChildren')f.panel.touchChildren=false;if(change==='order')f.panel.setChildIndex(f.lower,1);if(change==='cover'){const cover=f.scope.use(new f.sdk.Sprite());cover.touchEnabled=true;cover.hitArea={x:0,y:0,width:100,height:80};cover.graphics.beginFill(0).drawRect(0,0,100,80).endFill();f.stage.addChild(cover);}f.engine.renderFrame({width:100,height:80});});f.upper.on(f.input.events.activate,()=>trace.push('activate'));down(f);f.browser.clearReads();up(f);assert.deepEqual(trace,['end']);assert.equal(f.browser.reads.filter(x=>x==='clientX').length,1);assert.equal(f.browser.reads.filter(x=>x==='clientY').length,1);assert.equal(f.frames.length,1);assert.deepEqual(f.diagnostics,[]);});
  });
  test('MI1 original target uses current route after reparent',async()=>{
    await withInputFixture(f=>{const trace=[],other=f.scope.use(new f.sdk.Sprite());f.stage.addChild(other);other.x=30;other.y=15;f.upper.on(f.input.events.end,e=>trace.push(['upper',e.target===f.upper]));other.on(f.input.events.end,()=>trace.push(['new-parent']));f.panel.on(f.input.events.end,()=>trace.push(['old-parent']));down(f);other.addChild(f.upper);up(f,{clientX:190,clientY:140});assert.deepEqual(trace,[['upper',true],['new-parent']]);});
  });
  test('MI1 captured stage, surface, signal and private display operations ignore own shadows',async()=>{
    await withInputFixture(f=>{let poisonReads=0;const poison={get(){poisonReads++;throw new Error('own authority poison');}};
      const trace=[];f.upper.on(f.input.events.begin,()=>trace.push('begin'));f.upper.on(f.input.events.end,()=>trace.push('end'));f.upper.on(f.input.events.activate,()=>trace.push('activate'));
      for(const [object,names]of [[f.engine,['stage']],[f.hostFixture.adapter,['surface']],[f.scope,['signal','state','use']],[f.upper,['dispatchEvent','assertUsable','eventParent','parent','candidates']],[f.stage,['hitTest']]])for(const name of names)f.restorers.push(shadow(object,name,poison));
      down(f);up(f);assert.deepEqual(trace,['begin','end','activate']);assert.equal(poisonReads,0);assert.deepEqual(f.diagnostics,[]);
    });
  });
  test('MI1 genuine typed application nested dispatch retains its route',async()=>{
    await withInputFixture(f=>{const type=f.sdk.createEventType('app.nested',{bubbles:true}),trace=[];f.stage.on(type,()=>trace.push('nested'));f.upper.on(f.input.events.begin,()=>f.upper.dispatchEvent(new f.sdk.Event(type,{value:1})));down(f);up(f);assert.deepEqual(trace,['nested']);assert.deepEqual(f.diagnostics,[]);});
  });
  test('MI1 captured WebIDL getters ignore canvas, rectangle and event own poison',async()=>{
    await withInputFixture(f=>{let reads=0;const poison={get(){reads++;throw new Error('own DOM field is not authority');}};
      for(const [object,names]of [[f.browser.canvas,['width','ownerDocument','parentNode','getBoundingClientRect']],[f.browser.parent,['ownerDocument','parentNode']],[f.browser.document,['defaultView']],[f.browser.rect,['left','top','width','height']]])for(const name of names)f.restorers.push(shadow(object,name,poison));
      const input=f.sdk.createMouseInput(f.options);try{const trace=[];f.upper.on(input.events.begin,e=>trace.push([e.payload.globalX,e.payload.globalY]));const event=f.browser.event('pointerdown');for(const name of ['pointerId','pointerType','isPrimary','button','clientX','clientY'])f.restorers.push(shadow(event,name,poison));f.browser.emitEvent(f.browser.canvas,event);assert.deepEqual(trace,[[35,20]]);assert.equal(reads,0);}finally{input.dispose();}
    },{create:false});
  });
  test('MI1 genuine HT1 budget fault is a callback failure with original query cause',async()=>{
    await withInputFixture(f=>{const input=f.sdk.createMouseInput({...f.options,maxNodes:1});try{down(f);assert.equal(input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(f.diagnostics[0].cause.cause.code,'HIT_TEST_TREE_LIMIT');}finally{input.dispose();}},{create:false});
  });
  test('MI1 ignore-before-poison and coordinate-free pointer cancellation',async()=>{
    await withInputFixture(f=>{let poisonReads=0;f.browser.hooks.field=name=>{if(['clientX','clientY'].includes(name)){poisonReads++;throw new Error('coordinates must stay unread');}};f.browser.hooks.style=()=>{poisonReads++;throw new Error('style must stay unread');};
      for(const value of [{pointerId:-1},{pointerId:1.5},{pointerType:'touch'},{isPrimary:false},{button:1}])down(f,value);
      up(f);f.browser.emit(f.browser.window,'pointercancel');f.browser.emitEvent(f.browser.canvas,new Event('pointerdown'));
      assert.equal(poisonReads,0);assert.equal(f.input.state,'idle');f.browser.hooks.field=undefined;f.browser.hooks.style=undefined;const trace=[];f.upper.on(f.input.events.cancel,e=>trace.push([e.payload,f.input.state]));down(f);
      f.browser.hooks.field=name=>{if(['clientX','clientY','button'].includes(name)){poisonReads++;throw new Error('cancel field must stay unread');}};f.browser.hooks.style=()=>{poisonReads++;throw new Error('cancel style must stay unread');};
      down(f,{pointerId:8});f.browser.emit(f.browser.window,'pointercancel',{pointerId:8});f.browser.emit(f.browser.window,'pointercancel',{button:-1});
      assert.equal(poisonReads,0);assert.deepEqual(trace,[[{pointerId:7,globalX:35,globalY:20,pointerType:'mouse',button:0,reason:'pointercancel'},'idle']]);assert.equal(f.input.state,'idle');assert.deepEqual(f.diagnostics,[]);
    });
  });
  for(const type of ['blur','pagehide'])test('MI1 '+type+' uses last point and retires before callbacks',async()=>{
    await withInputFixture(f=>{const trace=[];f.upper.on(f.input.events.cancel,e=>trace.push([e.payload.reason,e.payload.globalX,e.payload.globalY,f.input.state]));down(f);f.browser.hooks.style=()=>{throw new Error('no cancellation CSS');};f.browser.hooks.field=name=>{if(['clientX','clientY','button','pointerId','pointerType','isPrimary'].includes(name))throw new Error('no cancellation pointer fields');};f.browser.emit(f.browser.window,type);assert.deepEqual(trace,[[type,35,20,'idle']]);assert.equal(f.input.state,type==='pagehide'?'closed':'idle');assert.deepEqual(f.diagnostics,[]);});
  });
  for(const mode of ['ancestor-transform','ancestor-zoom','padding','border','object-fit','detached','cycle','foreign-document','non-element','over-budget'])test('MI1 complete CSS/root profile refuses '+mode,async()=>{
    await withInputFixture(f=>{if(mode==='ancestor-transform')f.browser.style(f.browser.html,'transform','matrix(1,0,0,1,0,0)');if(mode==='ancestor-zoom')f.browser.style(f.browser.parent,'zoom','1.0');if(mode==='padding')f.browser.style(f.browser.canvas,'padding-left','0.0px');if(mode==='border')f.browser.style(f.browser.canvas,'border-top-width','1px');if(mode==='object-fit')f.browser.style(f.browser.canvas,'object-fit','contain');if(mode==='detached')f.browser.setNode(f.browser.html,{parentNode:null});if(mode==='cycle')f.browser.setNode(f.browser.html,{parentNode:f.browser.parent});if(mode==='foreign-document')f.browser.adoptCanvasIntoForeignDocument();if(mode==='non-element')f.browser.setNode(f.browser.html,{nodeType:11});if(mode==='over-budget')for(let n=0;n<62;n++)f.browser.addAncestor();assertCode(()=>f.sdk.createMouseInput(f.options),'MOUSE_INPUT_SURFACE_INVALID');assert.equal(f.browser.attempts.length,0);assert.deepEqual(f.diagnostics,[]);},{create:false});
  });
  test('MI1 accepts exactly 64 CSS elements with finite scaled coordinates and no DPR reads',async()=>{
    await withInputFixture(f=>{for(let n=0;n<61;n++)f.browser.addAncestor();f.restorers.push(shadow(f.browser.window,'devicePixelRatio',{get(){throw new Error('DPR is not authority');}}));const input=f.sdk.createMouseInput(f.options);try{const trace=[];f.upper.on(input.events.begin,e=>trace.push([e.payload.globalX,e.payload.globalY]));down(f);assert.deepEqual(trace,[[35,20]]);}finally{input.dispose();}},{create:false});
  });
  for(const field of ['clientX','clientY'])test('MI1 native getter fault '+field+' preserves undefined cause',async()=>{
    await withInputFixture(f=>{f.browser.hooks.field=name=>{if(name===field)throw undefined;};assert.doesNotThrow(()=>down(f));assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_EVENT_INVALID');assert.ok(Object.hasOwn(f.diagnostics[0].cause.cause,'cause'));assert.equal(f.diagnostics[0].cause.cause.cause,undefined);});
  });
  for(const phase of ['begin','end','cancel'])test('MI1 '+phase+' nested native delivery retires once without nested reads',async()=>{
    await withInputFixture(f=>{let nestedReads=0;f.upper.on(f.input.events[phase],()=>{f.browser.hooks.field=()=>{nestedReads++;throw new Error('nested native fields');};down(f,{pointerId:8});f.browser.hooks.field=undefined;});down(f);if(phase==='end')up(f);if(phase==='cancel')f.browser.emit(f.browser.window,'blur');assert.equal(nestedReads,0);assert.equal(f.input.state,'closed');assert.equal(f.diagnostics.length,1);assert.equal(f.diagnostics[0].code,'MOUSE_INPUT_CALLBACK_FAILED');assert.equal(f.diagnostics[0].cause.cause.code,'MOUSE_INPUT_REENTRANT');});
  });
}

// Lifecycle imports these public fixture helpers without registering this suite.
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))registerBehaviorTests();
