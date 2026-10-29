// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile, Sprite} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createParagraph, createParagraphCache} from '@egret/engine/paragraph';
import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';

const canvas=document.querySelector('#scene'),status=document.querySelector('#status');
const backend=new URL(location.href).searchParams.get('backend')??'webgl2';
if(!['webgl2','webgpu'].includes(backend))throw Error('EXAMPLE_BACKEND');
const frameOptions=Object.freeze({width:1100,height:760,clearColor:0x142033,clearAlpha:1,outputAlpha:'opaque'});
const fontInputs=Object.freeze([
  {family:'Noto Sans',file:'NotoSans-Regular.ttf',identity:'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'},
  {family:'Noto Sans Arabic',file:'NotoSansArabic-Regular.ttf',identity:'bd86ca02f087d7f3c3788ba458fb6b73744c7639ed276b8d870dba6def6c40d0'},
  {family:'Noto Sans CJK SC',file:'NotoSansCJKsc-Regular.otf',identity:'2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b'},
]);
const fontFamilies=Object.freeze(fontInputs.map(font=>font.family));
const copy={
  introduction:'Mixed direction after wrapping: abc \u202Bمرحبا 123     \u202C xyz.\nParagraphs wrap to the available width. Their measured height positions the next UI element.\n段落按宽度换行，真实行高驱动布局。密度只影响栅格。',
  arabic:'تُعرض الفقرات باستخدام الخطوط المحددة. يتغير ارتفاع النص عند تغيير عرض اللوحة مع الحفاظ على مقاييس الخط الفعلية.',
  rows:[
    'Build a reusable game interface with paragraphs whose natural line metrics determine each row height.',
    '资源、角色与世界的信息可以自然换行。列表中每个条目的高度来自真实段落排版，不依赖固定行数或硬编码高度。',
    'تتغير أسطر النص وارتفاع الصف عند تغيير العرض. تُجهز الفقرة قبل نشر الصورة والهندسة معًا.',
  ],
};
const errors=[],expectedFailures=[],events=[],binds=[],unbinds=[],preparations=[],readbacks=[],supersededUpdates=[];
let engine,host,scope,input,cache,nativeProvider,article,list;
let state='starting',label='initial',width=530,fontSize=20,minLineHeight=undefined,density=1,revision=1,textAlign='left',maxLines=undefined;
let calls=0,runtimeBytes,fontBytes=0,lastPixels,closePromise,pendingUpdate,delayGate,gateEntered=false,failToken;
const errorInfo=cause=>({code:cause?.code??null,message:String(cause?.message??cause)});
function describe(){status.textContent=JSON.stringify({state,backend,label,width,fontSize,minLineHeight:minLineHeight??null,density,textAlign,maxLines:maxLines??null,providerCalls:calls,cache:cache?.getStatus(),latestFailure:expectedFailures.at(-1)??null},null,2);}
async function checkedFont(font){
  const response=await fetch(new URL('./vendor/fonts/'+font.file,import.meta.url));
  if(!response.ok)throw Error('EXAMPLE_FONT_HTTP');
  const data=new Uint8Array(await response.arrayBuffer());
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==font.identity)throw Error('EXAMPLE_FONT_IDENTITY');
  fontBytes+=data.length;return {family:font.family,identity:sha,data};
}
function request(text,availableWidth,direction='ltr'){
  return {text,width:availableWidth,fontFamilies,fontSize,...(minLineHeight===undefined?{}:{lineHeight:minLineHeight}),locale:direction==='rtl'?'ar':'en',direction,fillColor:0xe9f2ff,density,...(textAlign==='left'?{}:{textAlign}),...(maxLines===undefined?{}:{maxLines})};
}
function articleTree(version=revision,marker=''){
  const localSize=fontSize,localHeight=minLineHeight,localAlign=textAlign,localMaxLines=maxLines;
  const content=(id,text,direction='ltr')=>({revision:version,prepare(context){
    // A detached binding owns its exact request values even if controls change later.
    const node=createParagraph(engine,context.scope,cache);
    node.setRequest({...request(text+marker,context.width,direction),fontSize:localSize,...(localHeight===undefined?{lineHeight:undefined}:{lineHeight:localHeight}),density:context.density,textAlign:localAlign,maxLines:localMaxLines});
    return node.prepare().then(metrics=>{if(context.signal.aborted)throw Error('EXAMPLE_CONTENT_CANCELLED');preparations.push({id,version,width:context.width,density:context.density,metrics});return {content:node,measuredHeight:metrics.height};});
  }});
  return {kind:'column',id:'article-column',explicitWidth:width,gap:18,crossAlign:'stretch',children:[
    {kind:'leaf',id:'article-heading',explicitHeight:8,fill:{color:0x4dd7b7}},
    {kind:'leaf',id:'introduction',content:content('introduction',copy.introduction)},
    {kind:'leaf',id:'arabic',content:content('arabic',copy.arabic,'rtl')},
    {kind:'leaf',id:'article-footer',explicitHeight:12,fill:{color:0xe9a66e}},
  ]};
}
function rowSource(version){
  const localSize=fontSize,localHeight=minLineHeight,localAlign=textAlign,localMaxLines=maxLines;
  const records=Array.from({length:24},(_,index)=>({key:'paragraph-'+String(index).padStart(2,'0'),contentVersion:version,estimatedHeight:120,value:{text:copy.rows[index%3].repeat(index%4===3?2:1),direction:index%3===2?'rtl':'ltr',color:index%2?0x253f5e:0x1c3452}}));
  return {revision:version,records,async bind(context){
    binds.push({key:context.key,generation:context.bindingGeneration,version:context.contentVersion});
    const node=createParagraph(engine,context.scope,cache);
    node.setRequest({...request(context.value.text,context.width-20,context.value.direction),fontSize:localSize,lineHeight:localHeight,density:context.density,textAlign:localAlign,maxLines:localMaxLines});
    const metrics=await node.prepare();
    if(context.signal.aborted)throw Error('EXAMPLE_ROW_CANCELLED');
    const content=context.scope.use(new Sprite());
    content.graphics.beginFill(context.value.color).drawRect(0,0,context.width,metrics.height+20).endFill();
    node.x=10;node.y=10;content.addChild(node);
    preparations.push({id:context.key,version:context.contentVersion,width:context.width-20,density:context.density,metrics});
    return {content,measuredHeight:metrics.height+20};
  },unbind(info){unbinds.push({...info});}};
}
async function publish(root){
  for(let attempt=0;attempt<32;attempt++){
    const preparation=await root.prepare();
    if(preparation.status==='pending'){await new Promise(resolve=>setTimeout(resolve,0));continue;}
    const result=root.commit(preparation);
    if(result.kind==='stale')continue;
    if(!['committed','unchanged'].includes(result.kind)||result.postCommitErrors.length)throw Error('EXAMPLE_UI_COMMIT');
    return result;
  }
  throw Error('EXAMPLE_UI_PREPARATION_LIMIT');
}
async function draw(name){
  const pixels=host.requestReadback();void pixels.catch(()=>{});
  host.renderSharedFrame(engine.captureSharedFrame(frameOptions));
  const result=await pixels;await host.whenIdle();
  if(result.width!==1100||result.height!==760||result.bytes.length!==3344000)throw Error('EXAMPLE_READBACK');
  lastPixels=new Uint8Array(result.bytes);label=name;
  readbacks.push({label:name,frameId:result.frameId,serial:result.serial,width:result.width,height:result.height});
  describe();return inspect();
}
export function inspect(){return {state,backend,label,width,fontSize,minLineHeight:minLineHeight??null,density,revision,textAlign,maxLines:maxLines??null,providerCalls:calls,runtimeBytes,fontBytes,article:article?.snapshot(),list:list?.snapshot(),cache:cache?.getStatus(),preparations:[...preparations],binds:[...binds],unbinds:[...unbinds],events:[...events],readbacks:[...readbacks],expectedFailures:[...expectedFailures],supersededUpdates:[...supersededUpdates],errors:[...errors],gateEntered,scopeState:scope?.state,inputState:input?.state};}
export function readback(){if(!lastPixels)throw Error('EXAMPLE_NO_READBACK');let bytes='';for(let i=0;i<lastPixels.length;i+=16384)bytes+=String.fromCharCode(...lastPixels.subarray(i,i+16384));return {width:1100,height:760,base64:btoa(bytes),label};}
function assertReady(){if(state!=='ready')throw Error('EXAMPLE_NOT_READY');}
export async function action(kind){
  assertReady();if(pendingUpdate)throw Error('EXAMPLE_UPDATE_PENDING');
  if(kind==='narrow')width=300;
  else if(kind==='wide')width=530;
  else if(kind==='larger'){fontSize=26;minLineHeight=undefined;}
  else if(kind==='line-height')minLineHeight=44;
  else if(kind==='density'){density=density===1?2:1;}
  else if(kind==='align'){const values=['left','center','right','start','end','justify'];textAlign=values[(values.indexOf(textAlign)+1)%values.length];}
  else if(kind==='clamp'){maxLines=maxLines===undefined?2:undefined;}
  else if(kind==='scroll'){list.list('paragraph-rows').setScrollOffset(380);await publish(list);return draw(kind);}
  else if(kind==='static'){await publish(article);await publish(list);return draw(kind);}
  else if(kind==='fail'){
    const marker=' [failed-request-'+(++revision)+']';failToken=marker;
    article.setTree(articleTree(revision,marker));
    try{await publish(article);throw Error('EXAMPLE_EXPECTED_FAILURE_MISSING');}
    catch(cause){let error=cause,matched=false;for(let depth=0;error&&depth<8;depth++,error=error.cause)if(error.code==='EXAMPLE_PARAGRAPH_FAILURE')matched=true;if(!matched)throw cause;expectedFailures.push(errorInfo(cause));}
    return draw('failed-update-kept-old-content');
  }else throw Error('EXAMPLE_ACTION');
  revision++;article.setViewport({width,height:704},density);article.setTree(articleTree());
  await publish(article);
  if(kind==='larger'||kind==='line-height'||kind==='density'||kind==='align'||kind==='clamp'){list.setViewport({width:420,height:704},density);list.list('paragraph-rows').setSource(rowSource(revision));await publish(list);}
  return draw(kind);
}
export function beginDelayedUpdate(){
  assertReady();if(pendingUpdate)throw Error('EXAMPLE_UPDATE_PENDING');
  let resolve,complete;delayGate={promise:new Promise(yes=>{resolve=yes;}),resolve,completed:new Promise(yes=>{complete=yes;}),complete,token:' [delayed-request-'+(++revision)+']',claimed:false};gateEntered=false;
  article.setTree(articleTree(revision,delayGate.token));
  pendingUpdate=publish(article);void pendingUpdate.catch(()=>{});
  return inspect();
}
export async function pendingFrame(){assertReady();if(!gateEntered)throw Error('EXAMPLE_DELAY_NOT_ENTERED');return draw('pending-old-content');}
export async function finishDelayedUpdate(){assertReady();if(!pendingUpdate)throw Error('EXAMPLE_NO_PENDING_UPDATE');delayGate.resolve();await pendingUpdate;pendingUpdate=undefined;delayGate=undefined;return draw('delayed-update-committed');}
export async function supersedeDelayedUpdate(){
  assertReady();if(!pendingUpdate||!gateEntered)throw Error('EXAMPLE_NO_PENDING_UPDATE');
  const stale=pendingUpdate,retiredGate=delayGate;
  width=300;revision++;article.setViewport({width,height:704},density);article.setTree(articleTree());
  // Set the latest intent first, then let the canceled public flight retire.
  // Its provider remains held: starting the new revision never waits for it.
  let cancellation;
  try{await stale;throw Error('EXAMPLE_STALE_FLIGHT_RESOLVED');}
  catch(cause){if(!['UI_STALE','EXAMPLE_CONTENT_CANCELLED','PARAGRAPH_CANCELLED','PARAGRAPH_STALE'].includes(cause?.code??cause?.message))throw cause;cancellation=errorInfo(cause);}
  pendingUpdate=undefined;delayGate=undefined;
  await publish(article);
  const latest=article.snapshot(),committedRevision=latest.committedRevision;
  retiredGate.resolve();await retiredGate.completed;
  const afterLateResult=article.snapshot();
  if(afterLateResult.committedRevision!==committedRevision||JSON.stringify(afterLateResult.boxes)!==JSON.stringify(latest.boxes))throw Error('EXAMPLE_LATE_RESULT_OVERWROTE_LATEST_UI');
  supersededUpdates.push({cancellation,committedRevision,afterLateRevision:afterLateResult.committedRevision,oldProviderSettled:true});
  return draw('new-width-supersedes-delayed-content');
}
export function close(){
  if(closePromise)return closePromise;state='closing';delayGate?.resolve();
  closePromise=(async()=>{
    const attempt=async action=>{try{await action();}catch(cause){errors.push(errorInfo(cause));}};
    window.removeEventListener('pagehide',onPageHide);
    for(const [button,listener]of handlers)button.removeEventListener('click',listener);
    await attempt(()=>ready.catch(()=>{}));
    await attempt(()=>article?.dispose());await attempt(()=>list?.dispose());
    await attempt(()=>pendingUpdate?.catch(cause=>{if(!['UI_CLOSED','UI_STALE','PARAGRAPH_CANCELLED','PARAGRAPH_STALE'].includes(cause?.code))throw cause;}));
    await attempt(()=>scope?.dispose());await attempt(()=>cache?.dispose());
    await attempt(()=>host?.whenIdle());await attempt(()=>engine?.dispose());await attempt(()=>nativeProvider?.dispose());
    state='closed';describe();return inspect();
  })();return closePromise;
}
export const ready=(async()=>{
  const manifestResponse=await fetch(new URL('./vendor/manifest.json',import.meta.url));if(!manifestResponse.ok)throw Error('EXAMPLE_RUNTIME_MANIFEST_HTTP');const manifest=await manifestResponse.json();runtimeBytes=manifest.payloadBytes.runtime;if(!Number.isSafeInteger(runtimeBytes)||runtimeBytes<1)throw Error('EXAMPLE_RUNTIME_MANIFEST');
  const fonts=await Promise.all(fontInputs.map(checkedFont));
  const canvasKit=await globalThis.CanvasKitInit({locateFile:()=>new URL('./vendor/runtime/layout-r1/canvaskit.wasm',import.meta.url).href});
  nativeProvider=createCanvasKitParagraphProvider({canvasKit,fonts,buildIdentity:manifest.runtime.buildIdentity});
  // Example-only gates test real paragraph completion, not a synthetic text renderer.
  const provider={identity:nativeProvider.identity,capabilities:nativeProvider.capabilities,async prepare(request,context){
    calls++;
    const delayed=delayGate&&!delayGate.claimed&&request.text.includes(delayGate.token)?delayGate:undefined;
    if(delayed){delayed.claimed=true;gateEntered=true;await delayed.promise;}
    try{
      if(failToken&&request.text.includes(failToken)){failToken=undefined;const failure=Error('EXAMPLE_PARAGRAPH_FAILURE');failure.code='EXAMPLE_PARAGRAPH_FAILURE';throw failure;}
      return await nativeProvider.prepare(request,context);
    }finally{delayed?.complete();}
  }};
  host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true});
  engine=await createEngineForProfile({host},'egret.shared-frame2d/1');scope=engine.createScope();cache=createParagraphCache(engine.assets,{provider});
  input=createBrowserPointerInput({engine,scope,width:1100,height:760,capacity:10});
  article=createUiRoot({engine,scope,id:'paragraph-article',viewport:{width,height:704},origin:{x:24,y:28},density,tree:articleTree()});
  list=createUiRoot({engine,scope,id:'paragraph-list',viewport:{width:420,height:704},origin:{x:646,y:28},density,input,onRowPointer:notification=>{events.push({kind:notification.kind,key:notification.key,layoutRevision:notification.layoutRevision,globalX:notification.event.payload.globalX,globalY:notification.event.payload.globalY});describe();},tree:{kind:'virtualList',id:'paragraph-rows',explicitWidth:420,explicitHeight:704,source:rowSource(revision)},limits:{overscan:0,residentCap:24,retainedCap:0}});
  await publish(article);await publish(list);state='ready';return draw('initial');
})().catch(cause=>{errors.push(errorInfo(cause));state='failed';describe();throw cause;});void ready.catch(()=>{});
const handlers=[];
for(const button of document.querySelectorAll('[data-action]')){
  const listener=()=>{void Promise.resolve().then(()=>{const kind=button.dataset.action;return kind==='close'?close():kind==='delay'?beginDelayedUpdate():kind==='finish'?finishDelayedUpdate():kind==='supersede'?supersedeDelayedUpdate():action(kind);}).catch(cause=>{errors.push(errorInfo(cause));describe();});};
  button.addEventListener('click',listener);handlers.push([button,listener]);
}
function onPageHide(){void close();}
window.addEventListener('pagehide',onPageHide,{once:true});
globalThis.__egretParagraphPanel=Object.freeze({ready,inspect,readback,action,beginDelayedUpdate,pendingFrame,finishDelayedUpdate,supersedeDelayedUpdate,close});
