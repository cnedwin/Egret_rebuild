// SPDX-License-Identifier: Apache-2.0
// Fixed browser dependencies; session borrows providers and owns its own caches.
import { EgretError, Texture, isTexture } from '@egret/engine';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';

const APPLY=Reflect.apply,FREEZE=Object.freeze,THEN=Promise.prototype.then;
const IMAGE=Object.getOwnPropertyDescriptor(Texture.prototype,'imageData').get;
const RECT=Object.getOwnPropertyDescriptor(Texture.prototype,'sourceRect').get;
const BYTE_PROTO=Object.getPrototypeOf(Uint8Array.prototype);
const TAG=Object.getOwnPropertyDescriptor(BYTE_PROTO,Symbol.toStringTag).get;
const LENGTH=Object.getOwnPropertyDescriptor(BYTE_PROTO,'byteLength').get;
const BUFFER=Object.getOwnPropertyDescriptor(BYTE_PROTO,'buffer').get;
const OFFSET=Object.getOwnPropertyDescriptor(BYTE_PROTO,'byteOffset').get;
const BACKING_LENGTH=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const RESIZABLE=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
const BYTE_SET=BYTE_PROTO.set,IGNORE=()=>{};
const IMAGES=FREEZE([
  FREEZE({key:'atlas-v1',url:new URL('../resource-scene/assets/atlas-v1.png',import.meta.url).href,bytes:130,sha256:'54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd',width:32,height:16,revision:'p02-atlas-v1-r1'}),
  FREEZE({key:'badge',url:new URL('../../tools/browser-png/assets/rgb-red-green.png',import.meta.url).href,bytes:72,sha256:'917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d',width:2,height:1,revision:'p02-badge-r1'}),
]);
const FONT_PINS=FREEZE([
  FREEZE({key:'ahem',url:new URL('../canvas-text/assets/ahem.ttf',import.meta.url).href,bytes:22572,sha256:'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc',revision:'ahem-fixed-r1',size:8,text:'X X XX'}),
  FREEZE({key:'cjk',url:new URL('../resource-scene/assets/NotoSansSC-fixed.woff2',import.meta.url).href,bytes:1796,sha256:'9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895',revision:'noto-sc-v41-fixed-r1',size:12,text:'左侧 已选择右侧'}),
]);
const IMAGE_URLS=new Map(IMAGES.map(pin=>[pin.url,pin]));
function fault(code,cause){return new EgretError('PREPARED_SCENE_DEPS_'+code,{cause});}
function handled(promise){void APPLY(THEN,promise,[undefined,IGNORE]);return promise;}
function settled(promise){return APPLY(THEN,promise,[IGNORE,IGNORE]);}
function snapshotBytes(value,length){
  try{
    if(APPLY(TAG,value,[])!=='Uint8Array'||APPLY(LENGTH,value,[])!==length)throw new TypeError('Fixed original Uint8Array length required');
    const backing=APPLY(BUFFER,value,[]),offset=APPLY(OFFSET,value,[]);APPLY(BACKING_LENGTH,backing,[]);
    if(RESIZABLE&&APPLY(RESIZABLE,backing,[]))throw new TypeError('Fixed original backing required');
    const copy=new Uint8Array(length);APPLY(BYTE_SET,copy,[new Uint8Array(backing,offset,length)]);return copy;
  }catch(cause){throw fault('IDENTITY',cause);}
}

/** Main owns this handle; session.close never closes it or removes its fonts. */
export function createPreparedSceneDependencies(options={}){
  if(options===null||typeof options!=='object'||Array.isArray(options))throw fault('OPTIONS_INVALID');
  const originalReader=options.readBytes,suppliedPorts=options.ports;
  if(originalReader!==undefined&&typeof originalReader!=='function')throw fault('OPTIONS_INVALID');
  const textureEvidence=new WeakMap(),issued=new WeakMap(),active=new Set(),contexts=new Map(),fonts=[];
  let state='starting',initializationPending=1,pendingImageReads=0,pendingFontReads=0,pendingFontLoads=0,pendingFontSelections=0;
  let imageEncodedReservedBytes=0,imageRawOwnedBytes=0,decodedLiveBytes=0,liveTextures=0,fontRawOwnedBytes=0,fontPayloadBytes=0,installedFonts=0;
  let png,dependencies,closePromise,native,initializationWork,cleanupFailures=0;
  let resolveReady,rejectReady;
  const ready=handled(new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;}));
  function checkpoint(){if(state!=='starting')throw fault('CLOSED');}
  function captureNative(){
    if(typeof window==='undefined'||typeof document==='undefined'||window.document!==document)throw fault('UNAVAILABLE',new TypeError('Same-window browser document required'));
    const owner=document,set=owner.fonts,Face=globalThis.FontFace,fetchOperation=globalThis.fetch,cryptoOwner=globalThis.crypto;
    if(typeof Face!=='function'||typeof fetchOperation!=='function'||typeof cryptoOwner?.subtle?.digest!=='function'||typeof cryptoOwner.randomUUID!=='function'
      ||!set||['add','delete','has','load','check'].some(key=>typeof set[key]!=='function')||typeof set[Symbol.iterator]!=='function')throw fault('UNAVAILABLE',new TypeError('Native font operations required'));
    const faceLoad=Face.prototype.load,family=Object.getOwnPropertyDescriptor(Face.prototype,'family')?.get,status=Object.getOwnPropertyDescriptor(Face.prototype,'status')?.get;
    if(typeof faceLoad!=='function'||typeof family!=='function'||typeof status!=='function')throw fault('UNAVAILABLE',new TypeError('Native FontFace operations required'));
    return{owner,set,Face,fetch:fetchOperation,cryptoOwner,subtle:cryptoOwner.subtle,digest:cryptoOwner.subtle.digest,uuid:cryptoOwner.randomUUID,
      add:set.add,delete:set.delete,has:set.has,load:set.load,check:set.check,iterate:set[Symbol.iterator],faceLoad,family,status};
  }
  async function digest(copy,row){
    const original=APPLY(native.digest,native.subtle,['SHA-256',copy]);row.hashTask=original;
    return Array.from(new Uint8Array(await original),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function nativeBytes(url,row){
    row.fetchTask=APPLY(native.fetch,globalThis,[url,{cache:'no-store'}]);const response=await row.fetchTask;
    if(!response.ok)throw fault('HTTP_FAILED',response.status);
    row.arrayBufferTask=response.arrayBuffer();return new Uint8Array(await row.arrayBufferTask);
  }
  const reader=originalReader===undefined?async function(ref,context){return nativeBytes(ref.id,contexts.get(context));}:originalReader;
  function makePng(){
    return createBrowserTextureProvider({ports:suppliedPorts,readBytes(ref,context){
      const job=contexts.get(context);pendingImageReads++;
      try{job.rawTask=APPLY(reader,options,[ref,context]);}
      catch(cause){pendingImageReads--;throw cause;}
      job.verificationTask=Promise.resolve(job.rawTask).then(async value=>{
        pendingImageReads--;const copy=snapshotBytes(value,job.pin.bytes);job.raw=copy;imageRawOwnedBytes+=copy.byteLength;
        if(await digest(copy,job)!==job.pin.sha256)throw fault('IDENTITY');return copy;
      },cause=>{pendingImageReads--;throw cause;});
      return job.verificationTask;
    }});
  }
  const textureProvider=FREEZE({
    load(ref,context){
      let resolve,reject;const original=handled(new Promise((yes,no)=>{resolve=yes;reject=no;}));
      function refuse(code,cause){reject(fault(code,cause));return original;}
      if(state==='closing'||state==='closed')return refuse('CLOSED');
      if(state!=='ready')return refuse('NOT_READY');
      let pin;try{pin=IMAGE_URLS.get(ref&&typeof ref==='object'?Object.getOwnPropertyDescriptor(ref,'id')?.value:undefined);}catch(cause){return refuse('NOT_SELECTED',cause);}
      if(pin===undefined)return refuse('NOT_SELECTED');
      if(contexts.has(context))return refuse('CONTEXT_BUSY');if(active.size>=4)return refuse('LIMIT');
      const job={pin,raw:undefined,rawTask:undefined,verificationTask:undefined,pngTask:undefined,hashTask:undefined,fetchTask:undefined,arrayBufferTask:undefined};
      contexts.set(context,job);active.add(original);imageEncodedReservedBytes+=pin.bytes;
      function finish(){contexts.delete(context);active.delete(original);imageEncodedReservedBytes-=pin.bytes;if(job.raw!==undefined){imageRawOwnedBytes-=job.raw.byteLength;job.raw=undefined;}}
      function failed(cause){finish();reject(cause);}
      function delivered(value){
        try{
          if(state!=='ready')throw fault('CLOSED');if(!isTexture(value))throw fault('VIEW_INVALID');
          const image=APPLY(IMAGE,value,[]),rect=APPLY(RECT,value,[]);
          if(image.width!==pin.width||image.height!==pin.height||rect.x!==0||rect.y!==0||rect.width!==pin.width||rect.height!==pin.height)throw fault('VIEW_INVALID');
          textureEvidence.set(value,FREEZE({key:pin.key,bytes:pin.bytes,sha256:pin.sha256,width:pin.width,height:pin.height,revision:pin.revision}));
          const bytes=4*pin.width*pin.height;issued.set(value,{retired:false,bytes});decodedLiveBytes+=bytes;liveTextures++;finish();resolve(value);
        }catch(cause){try{png.dispose(value);}catch(cleanup){cause=new EgretError(cause?.code??'PREPARED_SCENE_DEPS_VIEW_INVALID',{cause,cleanupErrors:[cleanup]});}failed(cause);}
      }
      // Exact original job is occupied before SDK/reader/native reentry.
      try{job.pngTask=png.load(ref,context);void APPLY(THEN,job.pngTask,[delivered,failed]);}catch(cause){failed(cause);}return original;
    },
    dispose(value){const record=issued.get(value);if(record===undefined)throw fault('VALUE_INVALID');if(record.retired)return;png.dispose(value);record.retired=true;decodedLiveBytes-=record.bytes;liveTextures--;},
  });
  function familyOf(face){return APPLY(native.family,face,[]);}
  function members(family){return Array.from(APPLY(native.iterate,native.set,[])).filter(face=>familyOf(face)===family);}
  async function prepareFont(pin,families,evidence){
    checkpoint();const row={pin,face:undefined,raw:undefined,counted:false,readTask:undefined,fetchTask:undefined,arrayBufferTask:undefined,hashTask:undefined,loadTask:undefined,selectionTask:undefined};fonts.push(row);
    try{
      pendingFontReads++;try{row.readTask=nativeBytes(pin.url,row);const value=await row.readTask;row.raw=snapshotBytes(value,pin.bytes);fontRawOwnedBytes+=row.raw.byteLength;}finally{pendingFontReads--;}
      if(await digest(row.raw,row)!==pin.sha256)throw fault('IDENTITY');checkpoint();
      const family='EgretPrepared_'+pin.key+'_'+APPLY(native.uuid,native.cryptoOwner,[]).replaceAll('-','');row.family=family;
      if(members(family).length!==0)throw fault('FONT_IDENTITY');checkpoint();
      row.face=new native.Face(family,row.raw.buffer,{weight:'400',style:'normal'});checkpoint();
      pendingFontLoads++;try{row.loadTask=APPLY(native.faceLoad,row.face,[]);await row.loadTask;}finally{pendingFontLoads--;}
      checkpoint();if(APPLY(native.status,row.face,[])!=='loaded'||members(family).length!==0)throw fault('FONT_IDENTITY');
      checkpoint();
      // Capture an add failure separately from exact membership verification.
      let addFailure;try{APPLY(native.add,native.set,[row.face]);}catch(cause){addFailure={cause};}
      let member,memberFailure;try{member=APPLY(native.has,native.set,[row.face]);}catch(cause){memberFailure={cause};}
      if(member){row.counted=true;installedFonts++;fontPayloadBytes+=pin.bytes;}
      if(addFailure){if(memberFailure)throw new EgretError('PREPARED_SCENE_DEPS_FONT_INSTALL_FAILED',{cause:addFailure.cause,cleanupErrors:[memberFailure.cause]});throw addFailure.cause;}
      if(memberFailure)throw memberFailure.cause;if(!member)throw fault('FONT_IDENTITY');checkpoint();
      const font='normal 400 '+pin.size+'px "'+family+'"';let selected;
      pendingFontSelections++;try{row.selectionTask=APPLY(native.load,native.set,[font,pin.text]);selected=await row.selectionTask;}finally{pendingFontSelections--;}
      checkpoint();if(selected.length!==1||selected[0]!==row.face||!APPLY(native.has,native.set,[row.face])||members(family).length!==1||!APPLY(native.check,native.set,[font,pin.text]))throw fault('FONT_IDENTITY');
      families[pin.key]=family;evidence[pin.key]=FREEZE({bytes:pin.bytes,sha256:pin.sha256,revision:pin.revision});
    }finally{
      if(row.raw!==undefined){fontRawOwnedBytes-=row.raw.byteLength;row.raw=undefined;}
      // Original native work is settled; do not retain fulfilled reader buffers.
      for(const key of ['readTask','fetchTask','arrayBufferTask','hashTask','loadTask','selectionTask'])row[key]=undefined;
    }
  }
  async function initialize(){
    checkpoint();native=captureNative();checkpoint();png=makePng();checkpoint();
    const families={},evidence={};for(const pin of FONT_PINS)await prepareFont(pin,families,evidence);
    checkpoint();const textProvider=createCanvasTextRasterProvider();checkpoint();
    return FREEZE({revision:'p03-scene-deps-r1',textureProvider,textureEvidence,textProvider,fontFamilies:FREEZE(families),fontEvidence:FREEZE(evidence)});
  }
  function snapshot(){
    // Independent logical accounts, excluding native-private/cache/frame/GPU costs.
    return FREEZE({state,initializationPending,activeTextureJobs:active.size,pendingImageReads,pendingFontReads,pendingFontLoads,pendingFontSelections,
      imageEncodedReservedBytes,imageRawOwnedBytes,decodedLiveBytes,liveTextures,fontRawOwnedBytes,fontPayloadBytes,installedFonts,cleanupFailures});
  }
  function close(){
    if(closePromise!==undefined)return closePromise;let resolve,reject;
    closePromise=handled(new Promise((yes,no)=>{resolve=yes;reject=no;}));state='closing';
    const originalJobs=[...active],pngAtClose=png;let pngClosing;
    try{pngClosing=png?.close();}catch(cause){pngClosing=Promise.reject(cause);}
    // Keep an original close rejection handled while waiting for other work.
    const pngOutcome=Promise.resolve(pngClosing).then(()=>({ok:true}),cause=>({ok:false,cause}));
    void(async()=>{
      const failures=[];
      await settled(initializationWork);
      // A reentrant close during provider construction still owns its late result.
      if(png!==undefined&&png!==pngAtClose)try{await png.close();}catch(cause){failures.push(cause);}
      await Promise.all(originalJobs.map(settled));const pngResult=await pngOutcome;if(!pngResult.ok)failures.push(pngResult.cause);
      for(const row of fonts){
        if(row.face===undefined)continue;
        let before,beforeFailure;try{before=APPLY(native.has,native.set,[row.face]);}catch(cause){beforeFailure={cause};failures.push(cause);}
        // Exact owned faces only; no FontFaceSet clear or foreign retirement.
        if(before||beforeFailure)try{APPLY(native.delete,native.set,[row.face]);}catch(cause){failures.push(cause);}
        let absent=false;try{absent=!APPLY(native.has,native.set,[row.face]);if(!absent)failures.push(fault('FONT_CLEANUP_FAILED'));}catch(cause){failures.push(cause);}
        if(absent){if(row.counted){installedFonts--;fontPayloadBytes-=row.pin.bytes;row.counted=false;}row.face=undefined;}
      }
      cleanupFailures=failures.length;state='closed';
      if(failures.length===1)throw failures[0];if(failures.length>1)throw new EgretError('PREPARED_SCENE_DEPS_CLOSE_FAILED',{cause:failures[0],cleanupErrors:failures.slice(1)});
    })().then(resolve,reject);
    return closePromise;
  }
  const owner=FREEZE({ready,get dependencies(){if(state==='closing'||state==='closed')throw fault('CLOSED');if(state!=='ready')throw fault('NOT_READY');return dependencies;},snapshot,close});
  // The retained initialization Promise exists before its first native callout.
  initializationWork=handled(Promise.resolve().then(initialize));
  void APPLY(THEN,initializationWork,[value=>{initializationPending=0;if(state!=='starting'){rejectReady(fault('CLOSED'));return;}dependencies=value;state='ready';resolveReady(value);},cause=>{initializationPending=0;rejectReady(cause);void close();}]);
  return owner;
}
