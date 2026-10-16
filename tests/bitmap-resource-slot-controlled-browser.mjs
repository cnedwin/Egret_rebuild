// SPDX-License-Identifier: Apache-2.0
// Existing first-party controlledBrowser copied verbatim from tests/mouse-input.test.mjs.
// Only the ordinary injected WebIDL port is reused; no test registration or SDK loader.
// Slot outcomes and image/event oracles are independently authored in sibling fixtures.
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
