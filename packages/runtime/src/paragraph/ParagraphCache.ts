// SPDX-License-Identifier: Apache-2.0
import { createImageData2D } from '@egret/contracts';
import type { CancellationSignal } from '@egret/contracts';
import type { AssetManager } from '../AssetManager.js';
import type { AssetLease } from '../AssetLease.js';
import { observeAssetLeaseRetirement, readAssetLeaseValue } from '../AssetLease.js';
import { createAssetRef, createAssetType } from '../AssetRef.js';
import type { AssetRef } from '../AssetRef.js';
import { EgretError } from '../EgretError.js';
import { createTexture, isTexture } from '../Texture.js';
import type { Texture } from '../Texture.js';
import { beginParagraphCacheCreation, commitParagraphCacheLifetime, requireAssetManagerOwner } from '../assetManagerOwnerState.js';
import { commitBinding } from '../ownership.js';
import { createParagraphNode } from './Paragraph.js';
import { snapshotParagraphRequest, snapshotParagraphRaster } from './request.js';
import type { ParagraphCache, ParagraphCacheOptions, ParagraphProvider, ParagraphRequest, ParagraphRequestInput, PreparedParagraph } from './types.js';

type Owner = ReturnType<typeof requireAssetManagerOwner>;
interface Result { readonly texture: Texture; readonly prepared: Omit<PreparedParagraph, 'lease'>; readonly bytes: number; }
interface Slot { readonly ref: AssetRef<Texture>; key: string | undefined; request: ParagraphRequest | undefined; result: Result | undefined; callers: number; resident: AssetLease<Texture> | undefined; residentPending: boolean; used: number; }
interface State { readonly owner: Owner; readonly provider: ParagraphProvider; readonly prepare: ParagraphProvider['prepare']; readonly slots: readonly Slot[]; readonly maxBytes: number; readonly maxJobs: number; readonly textures: Map<Texture, Result>; closed: boolean; generation: number; clock: number; jobs: number; bytes: number; }
const states = new WeakMap<object, State>();
const releaseLease = (lease: AssetLease<Texture> | undefined): void => { lease?.release(); };
function stateOf(cache: unknown): State { const s=states.get(cache as object); if (!s) throw new EgretError('PARAGRAPH_CACHE_INVALID'); return s; }
function live(s: State): void { s.owner.assertOpen(); if(s.closed) throw new EgretError('PARAGRAPH_CACHE_CLOSED'); }
function limit(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new EgretError('PARAGRAPH_CACHE_OPTIONS_INVALID');
  return value;
}
function retire(s: State, slot: Slot): void {
  slot.key=undefined; slot.request=undefined; slot.result=undefined;
  const resident=slot.resident; slot.resident=undefined;
  // Revoke the current generation before releasing residency; caller leases remain valid.
  s.owner.invalidate(slot.ref); releaseLease(resident);
}
function evictFor(s: State, needed: number, except: Slot): void {
  while(s.bytes + needed > s.maxBytes) {
    const candidate=s.slots.filter(slot=>slot!==except && slot.key!==undefined && slot.callers===0 && !slot.residentPending).sort((a,b)=>a.used-b.used)[0];
    if (!candidate) throw new EgretError('PARAGRAPH_CACHE_BUDGET');
    retire(s,candidate);
  }
}
function close(s: State): void {
  if(s.closed) return;
  s.closed=true;
  let first: unknown, failed=false;
  for(const slot of s.slots) {
    // Manager shutdown already owns invalidation; explicit cache disposal still retires its refs.
    const resident=slot.resident;slot.resident=undefined;slot.key=undefined;slot.request=undefined;slot.result=undefined;
    try { s.owner.invalidate(slot.ref); } catch(cause) { if(!failed){first=cause;failed=true;} }
    try { releaseLease(resident); } catch(cause) { if(!failed){first=cause;failed=true;} }
  }
  if(failed) { try { s.owner.assertOpen(); } catch { return; } throw first; }
}
async function acquire(this: ParagraphCache, input: ParagraphRequestInput, options: Readonly<{signal?: CancellationSignal}> = {}): Promise<PreparedParagraph> {
  const s=stateOf(this);live(s);
  const request=snapshotParagraphRequest(input), signal=options.signal;
  live(s); if(signal?.aborted) throw new EgretError('PARAGRAPH_CANCELLED',{cause:signal.reason});
  if(s.slots.reduce((total,slot)=>total+slot.callers,0)>=256)throw new EgretError('PARAGRAPH_CACHE_BUDGET');
  const key=JSON.stringify(request);
  let slot=s.slots.find(slot=>slot.key===key);
  if(!slot) {
    slot=s.slots.find(slot=>slot.key===undefined && slot.callers===0 && !slot.residentPending);
    if(!slot) {
      slot=s.slots.filter(slot=>slot.callers===0 && !slot.residentPending).sort((a,b)=>a.used-b.used)[0];
      if(!slot) throw new EgretError('PARAGRAPH_CACHE_BUDGET');
      retire(s,slot);
    }
    slot.key=key;slot.request=request;
  }
  const selected=slot;selected.used=++s.clock;selected.callers++;
  let lease: AssetLease<Texture> | undefined, observed=false;
  try {
    lease=await s.owner.acquire(selected.ref,signal===undefined?{}:{signal});
    live(s);if(signal?.aborted)throw new EgretError('PARAGRAPH_CANCELLED',{cause:signal.reason});
    const texture=readAssetLeaseValue(lease) as Texture, result=s.textures.get(texture);
    if(!result) throw new EgretError('PARAGRAPH_CACHE_INVALID');
    if(!observeAssetLeaseRetirement(lease,()=>{selected.callers--;})) throw new EgretError('PARAGRAPH_CACHE_INVALID');
    observed=true;
    // One bounded resident borrow keeps unchanged paragraphs out of shape/raster work.
    if(!selected.resident && !selected.residentPending && selected.key===key && selected.result===result) {
      selected.residentPending=true;
      void s.owner.acquire(selected.ref).then(resident=>{
        selected.residentPending=false;
        if(!s.closed && selected.key===key && selected.result===result) selected.resident=resident;
        else resident.release();
      },()=>{selected.residentPending=false;});
    }
    return Object.freeze({lease,...result.prepared});
  } catch(cause) {
    // No observer was installed for a failed delivery.
    if(lease) lease.release();
    if(!observed)selected.callers--;
    if(selected.callers===0 && !selected.resident && !selected.residentPending) retire(s,selected);
    throw cause;
  }
}
function invalidate(this: ParagraphCache): void {
  const s=stateOf(this);live(s);s.generation++;
  for(const slot of s.slots) if(slot.key!==undefined) retire(s,slot);
}
function getStatus(this: ParagraphCache): ReturnType<ParagraphCache['getStatus']> {
  const s=stateOf(this);return Object.freeze({closed:s.closed,generation:s.generation,entries:s.slots.filter(slot=>slot.key!==undefined).length,imageBytes:s.bytes,pendingJobs:s.jobs,callerLeases:s.slots.reduce((sum,slot)=>sum+slot.callers,0)});
}
function dispose(this: ParagraphCache): void {close(stateOf(this));}

/** A fixed optional profile shares Engine/AssetManager leases and their shutdown authority. */
export function createParagraphCache(assets: AssetManager, options: ParagraphCacheOptions): ParagraphCache {
  const owner=requireAssetManagerOwner(assets),finish=beginParagraphCacheCreation(assets);
  try {
    const provider=options.provider,identity=provider.identity,prepare=provider.prepare;
    const count=limit(options.maxEntries,32,1,32),maxBytes=limit(options.maxImageBytes,16777216,4,67108864),maxJobs=limit(options.maxPendingJobs,32,1,32);
    if(typeof identity!=='string' || identity.length<1 || identity.length>8192 || typeof prepare!=='function')throw new EgretError('PARAGRAPH_PROVIDER_INVALID');
    owner.assertOpen();
    const type=createAssetType<Texture>('egret.paragraph.v1.texture',isTexture);
    const slots=Object.freeze(Array.from({length:count},(_,index):Slot=>({ref:createAssetRef(type,'egret.paragraph.v1.slot.'+index),key:undefined,request:undefined,result:undefined,callers:0,resident:undefined,residentPending:false,used:0})));
    const s:State={owner,provider,prepare,slots,maxBytes,maxJobs,textures:new Map(),closed:false,generation:1,clock:0,jobs:0,bytes:0};
    const cache=Object.freeze({profile:'readonly-paragraph-v1',acquire,invalidate,getStatus,dispose}) as ParagraphCache;
    states.set(cache,s);commitBinding([cache],owner.context);
    commitParagraphCacheLifetime(assets,()=>close(s));
    try {
      owner.register(type,{
        async load(ref,context): Promise<Texture> {
          live(s);if(s.jobs>=s.maxJobs)throw new EgretError('PARAGRAPH_CACHE_BUDGET');
          const slot=slots.find(slot=>slot.ref===ref),request=slot?.request;
          if(!slot || !request)throw new EgretError('PARAGRAPH_CACHE_INVALID');
          const key=slot.key;s.jobs++;
          try {
            const output=await Reflect.apply(prepare,provider,[request,Object.freeze({signal:context.signal})]);
            live(s);if(context.signal.aborted || slot.key!==key)throw new EgretError('PARAGRAPH_CANCELLED');
            const prepared=snapshotParagraphRaster(output,request);
            live(s);if(context.signal.aborted || slot.key!==key)throw new EgretError('PARAGRAPH_CANCELLED');
            const image=prepared.image??createImageData2D({width:1,height:1,pixels:new Uint8Array(4),alphaMode:'straight',colorSpace:'srgb'});
            const bytes=image.width*image.height*4;evictFor(s,bytes,slot);
            live(s);if(context.signal.aborted || slot.key!==key)throw new EgretError('PARAGRAPH_CANCELLED');
            const texture=createTexture(image),result:Result={texture,bytes,prepared:Object.freeze({metrics:prepared.metrics,offsetX:prepared.offsetX,offsetY:prepared.offsetY,density:request.density})};
            s.textures.set(texture,result);s.bytes+=bytes;slot.result=result;
            return texture;
          }finally{s.jobs--;}
        },
        dispose(texture): void {
          const result=s.textures.get(texture);if(result){s.textures.delete(texture);s.bytes-=result.bytes;}
          texture.dispose();
        },
      });
      owner.context.registerTextFieldCache?.(cache,scope=>createParagraphNode(scope,{
        context:owner.context,assertOpen:()=>live(s),generation:()=>s.generation,
        acquire:(request,signal)=>acquire.call(cache,request,{signal}),
      }),'paragraph');
    }catch(cause){close(s);throw cause;}
    return cache;
  }finally{finish();}
}
