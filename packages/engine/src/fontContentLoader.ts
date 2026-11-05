// SPDX-License-Identifier: Apache-2.0
import {isAdmittedResourceManifest,inspectFontArtifact} from '@egret/contracts/resources';
import type {AdmittedResourceManifest,ResourceManifestEntry} from '@egret/contracts/resources';
import {createAssetType,Scope,EgretError} from '@egret/runtime';
import type {AssetLease,AssetRef} from '@egret/runtime';
import type {Engine} from './Engine.js';
import {requireContentEngine} from './internal/contentFactoryState.js';
import {createManifestAssetBinding} from './manifestResourceState.js';
import type {ManifestAssetBinding} from './manifestResourceTypes.js';
import type {FontContentBinding,FontContentAsset,FontContentGroup,FontContentLoader,FontContentProviderFactory} from './fontContentTypes.js';

const apply=Reflect.apply,freeze=Object.freeze,own=Object.getOwnPropertyDescriptor;
const scopeState=own(Scope.prototype,'state')!.get!,use=Scope.prototype.use;
const typed=Object.getPrototypeOf(Uint8Array.prototype) as object;
const length=own(typed,'byteLength')!.get!,buffer=own(typed,'buffer')!.get!,offset=own(typed,'byteOffset')!.get!;
const tag=own(typed,Symbol.toStringTag)!.get!,set=Uint8Array.prototype.set;
const fault=(code:string,cause?:unknown):EgretError=>new EgretError('FONT_CONTENT_'+code,{cause});
function bytes(input:unknown,maximum:number):Uint8Array {
  try{
    if(apply(tag,input,[])!=='Uint8Array')throw fault('BYTES');
    const size=apply(length,input,[]) as number,backing=apply(buffer,input,[]) as ArrayBuffer,start=apply(offset,input,[]) as number;
    apply(own(ArrayBuffer.prototype,'byteLength')!.get!,backing,[]);
    const resizable=own(ArrayBuffer.prototype,'resizable')?.get;
    if(resizable&&apply(resizable,backing,[])||size>maximum)throw fault('LIMIT');
    const copy=new Uint8Array(size);apply(set,copy,[new Uint8Array(backing,start,size)]);return copy;
  }catch(cause){throw fault('BYTES',cause);}
}
/** One typed font catalog over the existing manager and genuine dependency groups. */
export function createFontContentLoader(engine:Engine,manifest:AdmittedResourceManifest,factory:FontContentProviderFactory):FontContentLoader {
  const owner=requireContentEngine(engine);
  if(!isAdmittedResourceManifest(manifest)||typeof factory!=='function')throw fault('INPUT');
  const type=createAssetType<Uint8Array>('egret.content.font',(v:unknown):v is Uint8Array=>{try{return apply(tag,v,[])==='Uint8Array';}catch{return false;}});
  const entries=new Map<string,ResourceManifestEntry>(),bindings=new Map<string,ManifestAssetBinding<Uint8Array>>(),byRef=new Map<AssetRef<Uint8Array>,ResourceManifestEntry>(),rows:FontContentBinding[]=[];
  for(const e of manifest.entries){
    if(e.resourceKind!=='font')continue;
    const options=e.settings.options as Record<string,unknown>|undefined;
    if(e.importer.id!=='egret.font'||e.importer.version!=='1.0.0'||e.artifactFormatVersion!=='egret.font/1'||e.dependencies.length||e.artifact.byteLength>33554432||!options||typeof options.family!=='string'||!options.family.length||options.family.length>256||/[\u0000-\u001f\u007f]/u.test(options.family)||!['truetype','opentype'].includes(options.flavor as string)||e.artifact.mediaType!==(options.flavor==='truetype'?'font/ttf':'font/otf'))throw fault('PROFILE');
    if(rows.length===128)throw fault('LIMIT');
    const binding=createManifestAssetBinding(manifest,e.id,type);entries.set(e.id,e);bindings.set(e.id,binding);byRef.set(binding.ref,e);rows.push(freeze({id:e.id,family:options.family,binding}));
  }
  const supplied=factory(freeze(rows));owner.assertOpen();
  if(!supplied||typeof supplied!=='object')throw fault('PROVIDER');
  const load=own(supplied,'load'),disposeSource=own(supplied,'dispose');
  if(!load||!disposeSource||!Object.hasOwn(load,'value')||!Object.hasOwn(disposeSource,'value')||typeof load.value!=='function'||typeof disposeSource.value!=='function')throw fault('PROVIDER');
  let sourceBytes=0,disposed=false,disown=()=>{};
  const owned=new WeakMap<Uint8Array,number>(),groups=new Set<FontContentGroup>();
  const live=():void=>{owner.assertOpen();if(disposed)throw fault('CLOSED');};
  owner.register(type,{
    async load(ref,context){
      live();const entry=byRef.get(ref);if(!entry)throw fault('REF');
      const original:unknown=await apply(load.value,supplied,[ref,context]);
      let copy!:Uint8Array;
      try{
        live();if(context.signal.aborted)throw fault('CANCELLED',context.signal.reason);
        const size=apply(length,original,[]) as number;
        if(size!==entry.artifact.byteLength||sourceBytes+size>67108864)throw fault('LIMIT');
        copy=bytes(original,33554432);const info=inspectFontArtifact(copy);
        if(info.format!==(entry.settings.options as Record<string,unknown>).flavor)throw fault('FLAVOR');
        live();if(context.signal.aborted)throw fault('CANCELLED');

      }finally{apply(disposeSource.value,supplied,[original]);}
      // External disposal may close the owner or reenter; account only after it returns.
      live();if(context.signal.aborted)throw fault('CANCELLED');
      if(sourceBytes+copy.byteLength>67108864)throw fault('LIMIT');
      owned.set(copy,copy.byteLength);sourceBytes+=copy.byteLength;return copy;
    },
    dispose(value){const size=owned.get(value);if(size!==undefined){owned.delete(value);sourceBytes-=size;}}
  });
  const loader:FontContentLoader=freeze({
    get isDisposed(){if(this!==loader)throw fault('LOADER');return disposed;},
    getStatus(){if(this!==loader)throw fault('LOADER');return freeze({groups:groups.size,sourceBytes});},
    dispose(){if(this!==loader)throw fault('LOADER');if(disposed)return;disposed=true;disown();let first:unknown;for(const group of [...groups]){try{group.dispose();}catch(cause){first??=cause;}}if(first!==undefined)throw first;},
    load(scope:Scope,roots:readonly string[],options?:Parameters<FontContentLoader['load']>[2]){
      if(this!==loader)throw fault('LOADER');live();
      const check=():void=>{live();if(!owner.isScope(scope)||apply(scopeState,scope,[])!=='open')throw fault('SCOPE');};check();
      if(!Array.isArray(roots)||roots.length<1||roots.length>16||groups.size>=8)throw fault('LIMIT');
      const ids:string[]=[],families=new Set<string>();let total=0;
      const count=roots.length;
      for(let i=0;i<count;i++){
        const descriptor=own(roots,String(i));check();const id=descriptor?.value;
        if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof id!=='string'||ids.includes(id)||!entries.has(id))throw fault('ROOTS');
        const entry=entries.get(id)!,family=(entry.settings.options as Record<string,unknown>).family as string;
        total+=entry.artifact.byteLength;if(families.has(family)||total>33554432)throw fault('LIMIT');families.add(family);ids.push(id);
      }
      const raw=owner.group(scope,manifest,freeze(ids),ids.map(id=>bindings.get(id)!),options);
      // Options/root access can reenter; admission is rechecked before publication.
      if(groups.size>=8){raw.dispose();throw fault('LIMIT');}
      let state:'pending'|'ready'|'closed'='pending',resolve!:()=>void,reject!:(cause:unknown)=>void,finish!:()=>void,failClose!:(cause:unknown)=>void;
      const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no;}),closed=new Promise<void>((yes,no)=>{finish=yes;failClose=no;});void ready.catch(()=>{});void closed.catch(()=>{});
      const assets:FontContentAsset[]=[];
      const retire=(cause:unknown):void=>{if(state==='closed')return;const pending=state==='pending';state='closed';assets.length=0;groups.delete(group);if(pending)reject(cause);try{raw.dispose();finish();}catch(error){failClose(error);throw error;}};
      const group:FontContentGroup=freeze({
        ready,closed,get isDisposed(){if(this!==group)throw fault('GROUP');return state==='closed';},
        getFonts(){if(this!==group)throw fault('GROUP');check();if(state!=='ready')throw fault('NOT_READY');return freeze([...assets]);},
        dispose(){if(this!==group)throw fault('GROUP');retire(fault('CANCELLED'));}
      });
      groups.add(group);
      try{apply(use,scope,[group]);check();}catch(cause){retire(cause);throw cause;}
      void raw.ready.then(()=>{
        if(state!=='pending')return;
        try{check();for(const id of ids){
          const entry=entries.get(id)!,lease:AssetLease<Uint8Array>=raw.get(bindings.get(id)!);
          const asset:FontContentAsset=freeze({id,family:(entry.settings.options as Record<string,unknown>).family as string,identity:entry.artifact.sha256,byteLength:entry.artifact.byteLength,format:(entry.settings.options as Record<string,unknown>).flavor as 'truetype'|'opentype',
            copyBytes(){if(this!==asset)throw fault('ASSET');check();if(state!=='ready')throw fault('NOT_READY');return bytes(lease.value,33554432);}});
          assets.push(asset);
        }state='ready';resolve();}catch(cause){retire(cause);}
      },cause=>retire(cause)).catch(cause=>retire(cause));
      return group;
    }
  });
  disown=owner.own(()=>loader.dispose());return loader;
}
