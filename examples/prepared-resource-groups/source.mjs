// SPDX-License-Identifier: Apache-2.0
// Fixed example composition of the public browser PNG provider.
import { EgretError, Texture, isTexture } from '@egret/engine';
import { createBrowserTextureProvider } from '@egret/engine/web/image';

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
const BYTE_SET=BYTE_PROTO.set;
const PINS=FREEZE({
  A:FREEZE({bytes:83,sha256:'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'}),
  B:FREEZE({bytes:80,sha256:'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'}),
  C:FREEZE({bytes:81,sha256:'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'}),
  D:FREEZE({bytes:83,sha256:'d2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'}),
});
const URLS=new Map(Object.keys(PINS).map(id=>[new URL('../resource-scene/assets/outfit-'+id+'.png',import.meta.url).href,id]));
const IGNORE=()=>{};
function fault(code,cause){return new EgretError('PREPARED_OUTFIT_SOURCE_'+code,{cause});}
function handled(promise){void APPLY(THEN,promise,[undefined,IGNORE]);return promise;}
function settled(promise){return APPLY(THEN,promise,[IGNORE,IGNORE]);}
function snapshotBytes(value,length){
  try{
    if(APPLY(TAG,value,[])!=='Uint8Array'||APPLY(LENGTH,value,[])!==length)throw new TypeError('Fixed original Uint8Array length required');
    const backing=APPLY(BUFFER,value,[]),offset=APPLY(OFFSET,value,[]);
    APPLY(BACKING_LENGTH,backing,[]);
    if(RESIZABLE&&APPLY(RESIZABLE,backing,[]))throw new TypeError('Fixed original backing required');
    const copy=new Uint8Array(length);APPLY(BYTE_SET,copy,[new Uint8Array(backing,offset,length)]);return copy;
  }catch(cause){throw fault('IDENTITY',cause);}
}

/** Original source/decode work stays occupied until the genuine PNG load settles. */
export function createPreparedOutfitSource(options={}){
  if(options===null||typeof options!=='object'||Array.isArray(options))throw fault('OPTIONS_INVALID');
  const receiver=options,read=options.readBytes,ports=options.ports;
  const fetchOperation=read===undefined?globalThis.fetch:undefined;
  // Only omission or undefined selects the native default reader.
  const reader=read===undefined?(async function(ref){
    const response=await APPLY(fetchOperation,globalThis,[ref.id]);
    if(!response.ok)throw new Error('Fixed outfit fetch failed: '+response.status);
    return new Uint8Array(await response.arrayBuffer());
  }):read;
  if(typeof reader!=='function')throw fault('OPTIONS_INVALID');
  const assetEvidence=new WeakMap(),active=new Set(),sourceLedger=FREEZE({active});
  const contexts=new Map(),issued=new WeakMap();
  let state='open',pendingReads=0,encodedReservedBytes=0,rawOwnedBytes=0,decodedLiveBytes=0,liveValues=0,closePromise;
  const png=createBrowserTextureProvider({ports,readBytes(ref,context){
    const job=contexts.get(context);
    // Keep the original reader task separately from verification and PNG tasks.
    pendingReads++;job.readPending=true;
    try{job.rawTask=APPLY(reader,receiver,[ref,context]);}
    catch(cause){pendingReads--;job.readPending=false;throw cause;}
    job.verificationTask=Promise.resolve(job.rawTask).then(async value=>{
      pendingReads--;job.readPending=false;
      const copy=snapshotBytes(value,job.pin.bytes);
      job.raw=copy;rawOwnedBytes+=copy.byteLength;
      const digest=await globalThis.crypto.subtle.digest('SHA-256',copy);
      const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hash!==job.pin.sha256)throw fault('IDENTITY');
      return copy;
    },cause=>{pendingReads--;job.readPending=false;throw cause;});
    return job.verificationTask;
  }});
  const provider=FREEZE({
    load(ref,context){
      let resolve,reject;
      const original=handled(new Promise((yes,no)=>{resolve=yes;reject=no;}));
      function refuse(code){reject(fault(code));return original;}
      if(state!=='open')return refuse('CLOSED');
      let assetId;
      try{const id=ref&&typeof ref==='object'?Object.getOwnPropertyDescriptor(ref,'id')?.value:undefined;assetId=URLS.get(id);}
      catch(cause){reject(fault('NOT_SELECTED',cause));return original;}
      if(assetId===undefined)return refuse('NOT_SELECTED');
      if(contexts.has(context))return refuse('CONTEXT_BUSY');
      if(active.size>=4)return refuse('LIMIT');
      const job={pin:PINS[assetId],raw:undefined,rawTask:undefined,verificationTask:undefined,pngTask:undefined,readPending:false};
      contexts.set(context,job);active.add(original);encodedReservedBytes+=job.pin.bytes;
      function finish(){
        contexts.delete(context);active.delete(original);encodedReservedBytes-=job.pin.bytes;
        if(job.raw!==undefined){rawOwnedBytes-=job.raw.byteLength;job.raw=undefined;}
      }
      function failed(cause){finish();reject(cause);}
      function delivered(value){
        try{
          if(!isTexture(value))throw fault('VIEW_INVALID');
          const image=APPLY(IMAGE,value,[]),rect=APPLY(RECT,value,[]);
          if(image.width!==16||image.height!==16||rect.x!==0||rect.y!==0||rect.width!==16||rect.height!==16)throw fault('VIEW_INVALID');
          assetEvidence.set(value,FREEZE({assetId,bytes:job.pin.bytes,sha256:job.pin.sha256,width:16,height:16,contentRevision:'p02-outfits-r1',layoutRevision:'two-layer-r1'}));
          issued.set(value,false);decodedLiveBytes+=1024;liveValues++;
          finish();resolve(value);
        }catch(cause){
          try{png.dispose(value);}catch(cleanup){cause=new EgretError(cause.code??'PREPARED_OUTFIT_SOURCE_VIEW_INVALID',{cause,cleanupErrors:[cleanup]});}
          failed(cause);
        }
      }
      // Registration precedes SDK, reader and native callbacks, including reentry.
      try{job.pngTask=png.load(ref,context);void APPLY(THEN,job.pngTask,[delivered,failed]);}
      catch(cause){failed(cause);}
      return original;
    },
    dispose(value){
      const retired=issued.get(value);
      if(retired===undefined)throw fault('VALUE_INVALID');
      if(retired)return;
      png.dispose(value);issued.set(value,true);decodedLiveBytes-=1024;liveValues--;
    },
  });
  function snapshot(){
    // Logical ownership only; excludes reader-held/native-private/GPU/physical costs.
    return FREEZE({state,activeJobs:active.size,pendingReads,encodedReservedBytes,rawOwnedBytes,decodedLiveBytes,liveValues});
  }
  function close(){
    if(closePromise!==undefined)return closePromise;
    let resolve,reject;
    closePromise=handled(new Promise((yes,no)=>{resolve=yes;reject=no;}));state='closed';
    const originals=[...active];let pngClosing;
    try{pngClosing=png.close();}catch(cause){pngClosing=Promise.reject(cause);}
    const pngOutcome=Promise.resolve(pngClosing).then(()=>({ok:true}),cause=>({ok:false,cause}));
    void Promise.all([...originals.map(settled),pngOutcome]).then(results=>{
      const result=results.at(-1);if(result.ok)resolve();else reject(result.cause);
    },reject);
    return closePromise;
  }
  return FREEZE({provider,assetEvidence,sourceLedger,snapshot,close});
}
