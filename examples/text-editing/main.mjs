// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile, Sprite} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createUiTextEditor} from '@egret/engine/ui/editing';
import {createParagraphCache} from '@egret/engine/paragraph';
import {createCanvasKitFontSetProvider} from '@egret/engine/web/paragraph';
import {createBrowserEditorFontProvider,createBrowserTextEditor} from '@egret/engine/web/editing';
import {createManifestFontContentLoader} from '@egret/engine/web/resources';
import {admitResourceManifest} from '@egret/contracts/resources';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {createBrowserKeyboardInput} from '@egret/engine/web/keyboard';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';

const canvas=document.querySelector('#scene'),status=document.querySelector('#status'),query=new URL(location.href).searchParams;
const backend=query.get('backend')??'webgl2',configPath=query.get('fontConfig'),preset=query.get('preset')??'preview';
if(!['preview','verification'].includes(preset))throw Error('EXAMPLE_OPTIONS');
const layered=query.get('layers')==='1';
const verification=preset==='verification',scene=canvas.parentElement;document.documentElement.dataset.preset=preset;
const pixelRatio=verification?1:Math.min(3,Math.max(1,globalThis.devicePixelRatio||1));
const sceneWidth=()=>verification?800:Math.max(240,Math.min(800,scene.clientWidth));
if(!['webgl2','webgpu'].includes(backend)||!/^work\/font-resources\/run-[A-Za-z0-9]{6}\/browser-config\.json$/.test(configPath??''))throw Error('EXAMPLE_OPTIONS');
for(const link of document.querySelectorAll('[data-backend]')){const url=new URL(location.href);url.searchParams.set('backend',link.dataset.backend);link.href=url.href;}
const errors=[],changes=[],fields=new Map(),bindings=new Map(),ownedSets=new Set(),fontScopes=new Set(),setOwners=new WeakMap();
let host,engine,scope,viewScope,cache,root,input,keyboard,transport,paragraphs,fontProvider,fonts,config,alternate=false;
let state='loading',width=680,density=verification?1:pixelRatio,revision=0,queue=Promise.resolve(),queued=false,closed=false,closePromise,lastPixels,pendingFonts,nextNativeEnd;
let resizeObserver,resizeQueued=false,rebuilding=false,viewRebuilds=0,narrow=false,layerExample;
const origin=verification?{x:36,y:36}:{x:16,y:16};
const frameOptions={width:sceneWidth(),height:480,clearColor:0x142033,clearAlpha:1,outputAlpha:'opaque'};
width=verification?680:frameOptions.width-origin.x*2;
const availableWidth=()=>frameOptions.width-origin.x*2;
const errorInfo=cause=>({name:cause?.name??'Error',code:cause?.code??'EXAMPLE_FAILURE'});
const target=key=>({kind:'row',listId:'fields',key});
function inspect(){return {state,backend,preset,width,density,revision,viewRebuilds,logicalSize:{width:frameOptions.width,height:frameOptions.height},pixelRatio,backingSize:{width:canvas.width,height:canvas.height},errors:[...errors],changes:[...changes],ui:root?.snapshot(),keyboard:keyboard?.getSnapshot(),layers:layerExample?.inspect(),fontStatus:fontProvider?.getStatus(),paragraphStatus:cache?.getStatus(),fields:Object.fromEntries([...fields].map(([key,value])=>[key,value.snapshot()])),bindings:Object.fromEntries([...bindings].map(([key,value])=>[key,value.snapshot()]))};}
function describe(){status.textContent=JSON.stringify(inspect(),null,2);}
function enqueue(action){const next=queue.then(action);queue=next.catch(cause=>{errors.push(errorInfo(cause));describe();});return next;}
function changed(change){changes.push({kind:change.kind,source:change.source,revision:change.revision,contentRevision:change.contentRevision});if(changes.length>128)changes.shift();if(change.source==='native'&&nextNativeEnd){const terminal=nextNativeEnd;nextNativeEnd=undefined;if(terminal==='blur')document.querySelector('[data-egret-text-editor]')?.blur();else for(const item of bindings.values())item[terminal]();}if(!queued&&!closed){queued=true;void enqueue(async()=>{queued=false;revision++;root.list('fields').setSource(source());await publish();}).catch(()=>{});}}
function source(){return {revision,records:Array.from({length:10},(_,index)=>{const key=index===0?'name':index===1?'description':'note-'+index,field=fields.get(key);return {key,contentVersion:field?.content.revision??1,estimatedHeight:key==='description'?120:48,value:key};}),async bind(context){const field=fields.get(context.key);if(field)return field.prepare(context);const content=context.scope.use(new Sprite());content.graphics.beginFill(0x243950).drawRect(0,0,context.width,40).endFill();return {content,measuredHeight:48};},unbind(){}};}
async function publish(){for(let i=0;i<40;i++){const preparation=await root.prepare();if(preparation.status==='pending'){await new Promise(resolve=>setTimeout(resolve,0));continue;}const result=root.commit(preparation);if(!['committed','unchanged'].includes(result.kind))throw Error('EXAMPLE_COMMIT');if(layerExample)await layerExample.prepare();for(const binding of bindings.values())binding.sync();await draw();return;}throw Error('EXAMPLE_UI_PENDING');}
async function draw(){if(closed)return;const pending=host.requestReadback();void pending.catch(()=>{});host.renderSharedFrame(engine.captureSharedFrame(frameOptions));const result=await pending;await host.whenIdle();lastPixels={width:result.width,height:result.height,bytes:new Uint8Array(result.bytes)};describe();}
async function openFonts(){
 const url=new URL('/'+configPath,location.origin),response=await fetch(url);if(!response.ok)throw Error('EXAMPLE_FONT_CONFIG_HTTP');config=await response.json();
 if(config.format!=='egret.font-example/1'||!/^build\/generations\/[a-f0-9]{64}\/manifest\.json$/.test(config.manifestPath))throw Error('EXAMPLE_FONT_CONFIG');
 const base=new URL('./',url),manifestResponse=await fetch(new URL(config.manifestPath,base));if(!manifestResponse.ok)throw Error('EXAMPLE_MANIFEST_HTTP');const bytes=new Uint8Array(await manifestResponse.arrayBuffer());
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(sha!==config.manifestSha256)throw Error('EXAMPLE_MANIFEST_HASH');
 const parsed=admitResourceManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(!parsed.ok)throw Error('EXAMPLE_MANIFEST');
 transport=createManifestFontContentLoader(engine,parsed.value,{baseUrl:base.href,deadlineMs:30000});
 const metadata=await(await fetch('../paragraph-panel/vendor/manifest.json')).json();
 const canvasKit=await globalThis.CanvasKitInit({locateFile:()=>new URL('../paragraph-panel/vendor/runtime/layout-r1/canvaskit.wasm',import.meta.url).href});
 paragraphs=createCanvasKitFontSetProvider({canvasKit,buildIdentity:metadata.runtime.buildIdentity});
 fontProvider=createBrowserEditorFontProvider({engine,scope,paragraphProvider:paragraphs});
 fonts=await loadFonts(config.initial);
}
async function loadFonts(roots){const owner=engine.createScope();fontScopes.add(owner);pendingFonts=owner;try{const set=await fontProvider.load(owner,transport.loader,roots);ownedSets.add(set);setOwners.set(set,owner);return set;}catch(cause){owner.dispose();fontScopes.delete(owner);throw cause;}finally{if(pendingFonts===owner)pendingFonts=undefined;}}
async function retireFonts(set){set.dispose();await set.closed;ownedSets.delete(set);const owner=setOwners.get(set);owner?.dispose();fontScopes.delete(owner);}
async function replaceFonts(roots){if(pendingFonts)throw Error('EXAMPLE_FONTS_BUSY');if([...fields.values()].some(field=>field.snapshot().state==='composing'))throw Error('EXAMPLE_COMPOSING');const candidate=await loadFonts(roots),previous=fonts;try{for(const binding of bindings.values())binding.setFontSet(candidate);layerExample?.replaceFonts(candidate);fonts=candidate;await queue;await publish();await retireFonts(previous);return inspect();}catch(cause){await retireFonts(candidate);throw cause;}}
function active(key){const binding=bindings.get(key);if(!binding)throw Error('EXAMPLE_FIELD');for(const [other,item]of bindings)if(other!==key)item.finish();root.list('fields').focus(key);binding.activate();describe();}
async function action(kind){await ready;if(closed)throw Error('EXAMPLE_CLOSED');
 if(layerExample&&['details','rename','save','dismiss','list','edit-rename','layer-cancel'].includes(kind)){await enqueue(async()=>{if(kind==='edit-rename')layerExample.activate();else{layerExample.action(kind==='layer-cancel'?'cancel':kind);await publish();}});return inspect();}
 if(fields.has(kind)){active(kind);return inspect();}
 if(kind==='finish'||kind==='cancel'){for(const binding of bindings.values())binding[kind]();await queue;return inspect();}
 if(kind==='replace')fields.get('description').setValue('Programmatic replacement — 中文与 العربية\nThe same UI and resource owners remain in use.');
 else if(kind==='fonts'){alternate=!alternate;return replaceFonts(alternate?config.alternate:config.initial);}
 else if(kind==='width'){narrow=!narrow;width=verification?(narrow?390:680):(narrow?Math.max(80,Math.round(availableWidth()*.75)):availableWidth());revision++;root.setViewport({width,height:360},density);root.setTree(tree());}
 else if(kind==='density'){density=density===1?2:1;root.setViewport({width,height:360},density);}
 else if(kind==='scroll')root.list('fields').setScrollOffset(350);
 else if(kind==='reset-scroll')root.list('fields').setScrollOffset(0);
 else if(kind==='close')return close();else throw Error('EXAMPLE_ACTION');
 await enqueue(publish);return inspect();
}
function tree(){return {kind:'virtualList',id:'fields',explicitWidth:width,explicitHeight:360,source:source()};}
async function close(){if(closePromise)return closePromise;closed=true;resizeObserver?.disconnect();window.removeEventListener('resize',resized);closePromise=(async()=>{const failures=[];const attempt=async operation=>{try{await operation();}catch(cause){failures.push(errorInfo(cause));}};await attempt(()=>layerExample?.dispose());layerExample=undefined;await attempt(()=>root?.dispose());for(const binding of bindings.values())await attempt(()=>binding.dispose());await attempt(()=>queue);await attempt(()=>viewScope?.dispose());await attempt(()=>scope?.dispose());await attempt(()=>cache?.dispose());await attempt(()=>fontProvider?.close());await attempt(()=>paragraphs?.close());await attempt(()=>transport?.close());for(const owner of fontScopes)await attempt(()=>owner.dispose());fontScopes.clear();await attempt(()=>host?.whenIdle());await attempt(()=>engine?.dispose());errors.push(...failures);state='closed';describe();return inspect();})();return closePromise;}
// The pointer viewport is immutable. Rebuild only the existing view adapters on a true width change.
// Field models, Engine, paragraph cache and font/resource owners outlive this presentation.
async function createView(previous){
 if(closed)return;
 // A view owns its registrations separately; disposing adapters alone leaves them registered in a long-lived Scope.
 viewScope=engine.createScope();
 input=createBrowserPointerInput({engine,scope:viewScope,width:frameOptions.width,height:frameOptions.height,capacity:10});
 root=createUiRoot({engine,scope:viewScope,id:'text-editing-form',viewport:{width,height:360},origin,density,input,keyboard:{input:keyboard,idPrefix:'native-edit-form'},tree:tree(),onRowPointer(notification){if(notification.kind==='begin'&&bindings.has(notification.key)){for(const [key,item]of bindings)if(key!==notification.key)item.finish();bindings.get(notification.key).activate({x:notification.event.payload.globalX,y:notification.event.payload.globalY});}},limits:{overscan:1,residentCap:12,retainedCap:2}});
 if(previous)root.list('fields').setScrollOffset(previous.scrollOffset);
 await publish();if(closed)return;
 // Keyboard focus authenticates a realized row, so restore it after the first publication.
 if(previous&&previous.focus.key!==undefined){
  if(!root.list('fields').snapshot().rows.some(row=>row.key===previous.focus.key)){root.list('fields').reveal(previous.focus.key);await publish();if(closed)return;}
  root.list('fields').focus(previous.focus.key,{visible:previous.focus.focusVisible});
 }
 // Focus realization must not replace the caller's visible stable-key scroll anchor.
 if(previous?.anchor){
  const list=root.list('fields');list.reveal(previous.anchor.key,{align:'start'});await publish();if(closed)return;
  const snapshot=list.snapshot(),row=snapshot.rows.find(row=>row.key===previous.anchor.key);
  if(row){list.setScrollOffset(snapshot.scrollOffset+row.box.y+Math.min(previous.anchor.offset,row.box.height));await publish();if(closed)return;}
 }
 for(const [key,editor]of fields)bindings.set(key,createBrowserTextEditor({editor,root,target:target(key),canvas,fonts,logicalWidth:frameOptions.width,logicalHeight:frameOptions.height,label:key==='name'?'Profile name':'Profile description',keyboard,onInvalidate(){if(!closed)void enqueue(draw).catch(()=>{});},onError:cause=>{errors.push(errorInfo(cause));describe();}}));
 if(layered){const {createFormLayers}=await import('./layers.mjs');layerExample=await createFormLayers({engine,scope:viewScope,base:root,input,keyboard,canvas,cache,fonts,viewport:{x:0,y:0,width:frameOptions.width,height:frameOptions.height},density,getName:()=>fields.get('name').snapshot().value,setName:value=>fields.get('name').setValue(value),request(){if(!queued&&!closed&&!rebuilding){queued=true;void enqueue(async()=>{queued=false;await publish();}).catch(()=>{});}},onError:cause=>{errors.push(errorInfo(cause));describe();},previous:previous?.layers});await publish();}
 viewRebuilds++;describe();
}
function resized(){
 if(closed||state!=='ready'||verification||resizeQueued||sceneWidth()===frameOptions.width)return;
 resizeQueued=true;void enqueue(async()=>{
  resizeQueued=false;if(closed||sceneWidth()===frameOptions.width)return;
  rebuilding=true;
  try{
   for(const binding of bindings.values())binding.finish();
   const previous={scrollOffset:root.list('fields').snapshot().scrollOffset,anchor:root.list('fields').snapshot().anchor,focus:root.list('fields').getFocus(),layers:layerExample?.saveView()};
   layerExample?.dispose();layerExample=undefined;for(const binding of bindings.values())binding.dispose();bindings.clear();root.dispose();viewScope.dispose();
   frameOptions.width=sceneWidth();width=narrow?Math.max(80,Math.round(availableWidth()*.75)):availableWidth();revision++;
   await createView(previous);
  }finally{rebuilding=false;}
 }).catch(()=>{});
}
export const ready=(async()=>{
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio,outputAlpha:'opaque',enableReadback:true});
 engine=await createEngineForProfile({host},'egret.shared-frame2d/1');scope=engine.createScope();await openFonts();
 cache=createParagraphCache(engine.assets,{provider:paragraphs,maxImageBytes:33554432});
 const style={fontSet:fonts.key,fontFamilies:fonts.fontFamilies,fontSize:20,lineHeight:30,locale:'und',direction:'ltr',fillColor:0xffffff,backgroundColor:0x29415a};
 fields.set('name',createUiTextEditor({engine,scope,cache,mode:'single-line',value:'Egret 创作者',style,onChange:changed}));
 fields.set('description',createUiTextEditor({engine,scope,cache,mode:'multiline',value:'Create together — 一起创造\nالعربية with English and 中文.\nA native editor and the existing readonly paragraph share one committed value.',style,onChange:changed}));
 keyboard=createBrowserKeyboardInput({engine,scope,onFocusChange(change){if(state==='ready'&&!rebuilding&&change.reason==='keyboard'&&change.previousId!==change.focusedId){const key=root.list('fields').getFocus().key;if(bindings.has(key))void enqueue(()=>active(key)).catch(()=>{});}}});
 await createView();
 if(!verification){resizeObserver=new ResizeObserver(resized);resizeObserver.observe(scene);window.addEventListener('resize',resized);}
 for(const button of document.querySelectorAll('[data-layer-control]'))button.hidden=!layered;
 state='ready';describe();return inspect();
})().catch(cause=>{state='failed';errors.push(errorInfo(cause));describe();throw cause;});void ready.catch(()=>{});
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{void action(button.dataset.action).catch(cause=>{errors.push(errorInfo(cause));describe();});});
window.addEventListener('pagehide',()=>{void close();},{once:true});
globalThis.__egretTextEditing=Object.freeze({ready,inspect,action,close,settled:async()=>{for(let i=0;i<20;i++){const pending=queue;await pending;if(pending===queue)return inspect();}throw Error('EXAMPLE_QUEUE_PENDING');},setValue:async(key,value,options)=>{fields.get(key).setValue(value,options);await queue;return inspect();},setSelection:(key,selection)=>fields.get(key).setSelection(selection),sync:()=>{for(const binding of bindings.values())binding.sync();return inspect();},replaceFonts,setNextNativeEnd:how=>{if(!['finish','cancel','blur'].includes(how))throw Error('EXAMPLE_TERMINAL');nextNativeEnd=how;},cancelFontReplacement:()=>pendingFonts?.dispose(),readback:()=>{if(!lastPixels)throw Error('EXAMPLE_NO_PIXELS');let data='';for(let i=0;i<lastPixels.bytes.length;i+=16384)data+=String.fromCharCode(...lastPixels.bytes.subarray(i,i+16384));return {width:lastPixels.width,height:lastPixels.height,base64:btoa(data)};},geometry:key=>{const geometry=fields.get(key).getTextGeometry(root,target(key));return geometry&&{text:geometry.text,lines:geometry.lines,clusters:geometry.clusters,caret:geometry.getCaret(fields.get(key).snapshot().selection.focus)};}});
