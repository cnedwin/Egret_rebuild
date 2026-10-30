// SPDX-License-Identifier: Apache-2.0
import { Engine, AssetManager, AssetLease, Scope, Texture, createAssetType, createAssetRef, isTexture, CancellationController, EgretError } from '@egret/engine';
import type { AssetProvider, AssetRef, AssetType, AssetLoadContext } from '@egret/engine';
import { createManifestAssetBinding } from '@egret/engine/resources';
import type { ManifestBinding, ManifestAssetBinding, ManifestAssetGroup, ManifestGroupOptions } from '@egret/engine/resources';
import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
import type { SpineContentOptions, SpineContentProviderFactory, SpineContentProviders, SpineContentBinding, SpineContentLoader, SpineContentGroup, SpineAsset, SpineContentStatus } from './types.js';
import { admitSpineCatalog, selectSpineDependencies, spineFault } from './catalog.js';
import { parseSpineSetup } from './parse.js';
import type { ParsedSpineSetup } from './parse.js';

const APPLY=Reflect.apply,FREEZE=Object.freeze;
const GROUP=Engine.prototype.createManifestGroup,USE=Scope.prototype.use;
const SCOPE_STATE=Object.getOwnPropertyDescriptor(Scope.prototype,'state')!.get!;
const REGISTER=AssetManager.prototype.register,ACQUIRE=AssetManager.prototype.acquire;
const VALUE=Object.getOwnPropertyDescriptor(AssetLease.prototype,'value')!.get!,RELEASE=AssetLease.prototype.release;
type PortKind='textures'|'metadata';
type SetupValue={parsed:ParsedSpineSetup|undefined;pages:AssetLease<Texture>[];fee:number;disposed:boolean};
type Stage={id:string;active:()=>boolean};
function leaseValue<T>(lease:AssetLease<T>):T{return APPLY(VALUE,lease,[]) as T;}
function release<T>(lease:AssetLease<T>):void{APPLY(RELEASE,lease,[]);}
function provider<T>(value:unknown):AssetProvider<T>{
  if(!value||typeof value!=='object')throw spineFault('PROVIDERS','');
  const load=Object.getOwnPropertyDescriptor(value,'load'),dispose=Object.getOwnPropertyDescriptor(value,'dispose');
  if(!load||!dispose||!Object.hasOwn(load,'value')||!Object.hasOwn(dispose,'value')||typeof load.value!=='function'||typeof dispose.value!=='function')throw spineFault('PROVIDERS','');
  return {load:(...args)=>APPLY(load.value,value,args) as Promise<T>,dispose:asset=>{APPLY(dispose.value,value,[asset]);}};
}
function cleanup(operations:readonly (()=>void)[],code:string):void{const errors:unknown[]=[];for(const operation of operations)try{operation();}catch(error){errors.push(error);}if(errors.length)throw new EgretError(code,{cause:errors[0],cleanupErrors:errors.slice(1)});}

/** Explicit optional SDK. All source, setup and image ownership stays in Egret's manager. */
export function createSpineContentLoader(engine:Engine,ownerScope:Scope,manifest:AdmittedResourceManifest,factory:SpineContentProviderFactory,options?:SpineContentOptions):SpineContentLoader {
  // The original public operation authenticates both Engine and Scope before callbacks.
  const validation=APPLY(GROUP,engine,[ownerScope,manifest,[],[]]) as ManifestAssetGroup;validation.dispose();
  const scopeOpen=():void=>{if(APPLY(SCOPE_STATE,ownerScope,[])!=='open')throw spineFault('OWNER_CLOSED','');};scopeOpen();
  let allowPrerelease=false,maximum=16777216;
  if(options!==undefined){if(!options||typeof options!=='object')throw spineFault('OPTIONS','');for(const key of Reflect.ownKeys(options)){scopeOpen();const row=Object.getOwnPropertyDescriptor(options,key);scopeOpen();if(!row||!Object.hasOwn(row,'value'))throw spineFault('OPTIONS','');if(key==='allowPrerelease'&&typeof row.value==='boolean')allowPrerelease=row.value;else if(key==='maxSetupBytes'&&Number.isSafeInteger(row.value)&&!Object.is(row.value,-0)&&row.value>=0&&row.value<=67108864)maximum=row.value;else throw spineFault('OPTIONS','');}}
  scopeOpen();
  let catalog:ReturnType<typeof admitSpineCatalog>|undefined=admitSpineCatalog(manifest),admitted:AdmittedResourceManifest|undefined=manifest;const bindings=new Map<string,ManifestBinding>(),cacheRefs=new Map<string,AssetRef<SetupValue>>(),skeletonByRef=new Map<string,ResourceManifestEntry>();
  const textures=createAssetType<Texture>('egret.spine.page',isTexture),metadata=createAssetType<string>('egret.spine.metadata',v=>typeof v==='string');
  const setupValues=new WeakSet<object>(),setup=createAssetType<SetupValue>('egret.spine.setup',(v:unknown):v is SetupValue=>typeof v==='object'&&v!==null&&setupValues.has(v));
  const descriptions:SpineContentBinding[]=[];
  for(const entry of catalog.selected){const kind=entry.resourceKind==='image'?'image':'metadata';
    const binding=kind==='image'?createManifestAssetBinding(manifest,entry.id,textures):createManifestAssetBinding(manifest,entry.id,metadata);bindings.set(entry.id,binding);descriptions.push(FREEZE({id:entry.id,kind,binding}));
  }
  // Genuine source ref identities include the manifest binding's type token, so overlapping
  // loader generations cannot reserve the same ID with different private types.
  for(const entry of catalog.skeletons.values()){const ref=createAssetRef(setup,'spine.setup:'+(bindings.get(entry.id)! as ManifestAssetBinding<unknown>).ref.id);cacheRefs.set(entry.id,ref);skeletonByRef.set(ref.id,entry);}
  scopeOpen();if(typeof factory!=='function')throw spineFault('PROVIDERS','');const result:unknown=APPLY(factory,undefined,[FREEZE(descriptions)]);scopeOpen();
  if(!result||typeof result!=='object'||Reflect.ownKeys(result).length!==2)throw spineFault('PROVIDERS','');
  const port=(key:PortKind):unknown=>{const row=Object.getOwnPropertyDescriptor(result,key);if(!row||!Object.hasOwn(row,'value'))throw spineFault('PROVIDERS','');return row.value;};
  let ports:SpineContentProviders|undefined={textures:provider<Texture>(port('textures')),metadata:provider<string>(port('metadata'))};scopeOpen();
  const managerDescriptor=Object.getOwnPropertyDescriptor(engine,'assets');if(!managerDescriptor||!Object.hasOwn(managerDescriptor,'value'))throw spineFault('MANAGER','');const manager=managerDescriptor.value as AssetManager;
  let disposed=false,activeSourceLoads=0,liveSourceValues=0,pendingSetups=0,liveSetups=0,setupBytes=0,closePromise:Promise<void>|undefined;
  const groups=new Set<SpineContentGroup>(),stages=new Map<string,Set<Stage>>(),work=new Set<Promise<unknown>>();
  function assertOpen():void{if(disposed)throw spineFault('LOADER_DISPOSED','');scopeOpen();}
  function dropPorts():void{if(disposed&&!activeSourceLoads&&!liveSourceValues)ports=undefined;if(disposed&&!activeSourceLoads&&!liveSourceValues&&!pendingSetups&&!liveSetups){catalog=undefined;admitted=undefined;bindings.clear();cacheRefs.clear();skeletonByRef.clear();}}
  function track<T>(promise:Promise<T>):Promise<T>{work.add(promise);void promise.finally(()=>work.delete(promise)).catch(()=>{});return promise;}
  function managed<T>(kind:PortKind):AssetProvider<T>{return {load(ref,context){const current=ports?.[kind] as AssetProvider<T>|undefined;if(!current||disposed)return Promise.reject(spineFault('LOADER_DISPOSED',ref.id));activeSourceLoads++;
    return track((async()=>{try{const value=await current.load(ref,context);liveSourceValues++;return value;}finally{activeSourceLoads--;dropPorts();}})());},dispose(value){const current=ports?.[kind] as AssetProvider<T>|undefined;try{if(!current)throw spineFault('PROVIDER_RETIRED','');current.dispose(value);}finally{liveSourceValues--;dropPorts();}}};}
  APPLY(REGISTER,manager,[textures,managed<Texture>('textures')]);APPLY(REGISTER,manager,[metadata,managed<string>('metadata')]);
  const binding=<T>(id:string):ManifestAssetBinding<T>=>bindings.get(id) as ManifestAssetBinding<T>;
  function reserve(amount:number,id:string):void{if(!Number.isSafeInteger(amount)||amount<0||setupBytes+amount>maximum)throw spineFault('SETUP_BUDGET',id);setupBytes+=amount;}
  function checkContext(context:AssetLoadContext):void{if(disposed||context.signal.aborted)throw spineFault('CANCELLED','',context.signal.reason);}
  const setupProvider:AssetProvider<SetupValue>={
    load(ref,context){pendingSetups++;return track((async()=>{
      const acquired:AssetLease<unknown>[]=[],pages:AssetLease<Texture>[]=[];let parsed:ParsedSpineSetup|undefined,fee=0;
      try{
        checkContext(context);const currentCatalog=catalog;const source=currentCatalog?.skeletons.get(skeletonByRef.get(ref.id)?.id??'');if(!source||![...(stages.get(source.id)??[])].some(s=>s.active()))throw spineFault('SOURCE_STAGE',ref.id);
        const atlas=currentCatalog!.entries.get(source.dependencies[0]!)!,ids=[source.id,atlas.id,...atlas.dependencies];
        // These exact sources are already resident in a ready raw ManifestGroup.
        // Direct acquisitions retain them without nesting the fair group scheduler.
        for(const id of ids){checkContext(context);const lease=await APPLY(ACQUIRE,manager,[binding<unknown>(id).ref,{signal:context.signal}]) as AssetLease<unknown>;acquired.push(lease);checkContext(context);}
        const raw=leaseValue(acquired[0]!),atlasText=leaseValue(acquired[1]!);if(typeof atlasText!=='string'||typeof raw!=='string')throw spineFault('SOURCE',source.id);
        const sourceData=raw,sourceFee=sourceData.length*2+atlasText.length*2;reserve(sourceFee,source.id);fee=sourceFee;
        for(let i=2;i<acquired.length;i++)pages.push(acquired[i]! as AssetLease<Texture>);
        parsed=parseSpineSetup(source.id,sourceData,atlasText,atlas.settings.pageNames as readonly string[],atlas.dependencies,pages,allowPrerelease);checkContext(context);
        const extra=parsed.info.boneCount*32+parsed.info.slotCount*32+parsed.atlas.regions.length*64+parsed.info.animations.length*128;reserve(extra,source.id);fee+=extra;
        // Publish the shared value only after raw metadata has retired. Until
        // this transfer succeeds, the failure path still owns every page lease.
        const sourceLeases=acquired.splice(0,2);cleanup(sourceLeases.map(l=>()=>release(l)),'SPINE_SOURCE_RELEASE_FAILED');
        const value:SetupValue={parsed,pages,fee,disposed:false};setupValues.add(value);liveSetups++;acquired.length=0;return value;
      }catch(cause){const secondary:unknown[]=[];try{parsed?.atlas.dispose();}catch(error){secondary.push(error);}for(const lease of acquired)try{release(lease);}catch(error){secondary.push(error);}setupBytes-=fee;throw secondary.length?new EgretError('SPINE_SETUP_FAILED',{cause,cleanupErrors:secondary}):spineFault('SETUP',ref.id,cause);}
      finally{pendingSetups--;dropPorts();}
    })());},
    dispose(value){if(value.disposed)return;value.disposed=true;const parsed=value.parsed,pages=value.pages;value.parsed=undefined;value.pages=[];setupBytes-=value.fee;value.fee=0;liveSetups--;try{cleanup([()=>parsed?.atlas.dispose(),...pages.map(lease=>()=>release(lease))],'SPINE_SETUP_RELEASE_FAILED');}finally{dropPorts();}},
  };
  APPLY(REGISTER,manager,[setup,setupProvider]);
  function dispose():void{if(disposed)return;disposed=true;const owned=[...groups];groups.clear();try{cleanup(owned.map(group=>()=>group.dispose()),'SPINE_LOADER_RELEASE_FAILED');}finally{stages.clear();dropPorts();}}
  const loader:SpineContentLoader=FREEZE({
    get isDisposed(){if(this!==loader)throw spineFault('LOADER_RECEIVER','');return disposed;},
    getStatus():SpineContentStatus{if(this!==loader)throw spineFault('LOADER_RECEIVER','');return FREEZE({isDisposed:disposed,groups:groups.size,activeSourceLoads,liveSourceValues,pendingSetups,liveSetups,setupBytes});},
    dispose(){if(this!==loader)throw spineFault('LOADER_RECEIVER','');dispose();},
    close(){if(this!==loader)throw spineFault('LOADER_RECEIVER','');if(!closePromise){closePromise=(async()=>{let failed=false,cause:unknown;try{dispose();}catch(error){failed=true;cause=error;}while(work.size)await Promise.allSettled([...work]);await Promise.resolve();dropPorts();if(failed)throw cause;})();}return closePromise;},
    load(scope:Scope,roots:readonly string[],options?:ManifestGroupOptions):SpineContentGroup{
      if(this!==loader)throw spineFault('LOADER_RECEIVER','');assertOpen();if(groups.size>=8||!Array.isArray(roots))throw spineFault('GROUP_LIMIT','');const count=roots.length;assertOpen();if(!Number.isSafeInteger(count)||count<0||count>32)throw spineFault('ROOTS','');
      const ids:string[]=[];for(let i=0;i<count;i++){const row=Object.getOwnPropertyDescriptor(roots,String(i));assertOpen();if(!row||!Object.hasOwn(row,'value')||typeof row.value!=='string'||ids.includes(row.value)||!catalog!.skeletons.has(row.value))throw spineFault('ROOTS','');ids.push(row.value);}
      // ManifestGroup requires exactly the selected dependency closure, not every catalog binding.
      const selected=selectSpineDependencies(catalog!,ids);
      let raw:ManifestAssetGroup|undefined=APPLY(GROUP,engine,[scope,admitted!,FREEZE(ids),selected.map(id=>bindings.get(id)!),options]) as ManifestAssetGroup;
      const abort=new CancellationController(),leases:AssetLease<SetupValue>[]=[],assets=new Map<string,SpineAsset>(),ownedStages:Stage[]=[];let state:'pending'|'ready'|'failed'|'disposed'='pending';
      let resolve!:()=>void,reject!:(cause:unknown)=>void;const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});void ready.catch(()=>{});
      function retire(next:'failed'|'disposed',cause?:unknown):void{if(state==='failed'||state==='disposed')return;const pending=state==='pending';state=next;groups.delete(group);if(pending)reject(cause??spineFault('GROUP_DISPOSED',''));for(const staged of ownedStages){const set=stages.get(staged.id);set?.delete(staged);if(!set?.size)stages.delete(staged.id);}ownedStages.length=0;assets.clear();abort.abort(cause);const ownedRaw=raw;raw=undefined;cleanup([...leases.splice(0).map(lease=>()=>release(lease)),()=>ownedRaw?.dispose()],'SPINE_GROUP_RELEASE_FAILED');}
      const group:SpineContentGroup=FREEZE({get ready(){if(this!==group)throw spineFault('GROUP_RECEIVER','');return ready;},get isDisposed(){if(this!==group)throw spineFault('GROUP_RECEIVER','');return state==='disposed'||state==='failed';},dispose(){if(this!==group)throw spineFault('GROUP_RECEIVER','');retire('disposed');},getSpine(id:string):SpineAsset{if(this!==group)throw spineFault('GROUP_RECEIVER','');assertOpen();if(state!=='ready')throw spineFault('GROUP_NOT_READY',id);const asset=assets.get(id);if(!asset)throw spineFault('ASSET',id);return asset;}});
      groups.add(group);try{APPLY(USE,scope,[group]);assertOpen();}catch(cause){retire('disposed',cause);throw cause;}
      void raw!.ready.then(async()=>{try{
        if(state!=='pending')return;assertOpen();
        for(const id of ids){const staged:Stage={id,active:()=>state==='pending'};let set=stages.get(id);if(!set){set=new Set();stages.set(id,set);}set.add(staged);ownedStages.push(staged);
          const lease=await APPLY(ACQUIRE,manager,[cacheRefs.get(id)!,{signal:abort.signal}]) as AssetLease<SetupValue>;if(state!=='pending'){release(lease);return;}leases.push(lease);assertOpen();const info=leaseValue(lease).parsed!.info;
          assets.set(id,FREEZE({info,get isDisposed(){return state!=='ready';}}) as SpineAsset);
        }
        // All setup values now own their page leases. Retire staging metadata before
        // readiness; a cleanup callback may cancel the consumer during transfer.
        const staging=raw;raw=undefined;staging?.dispose();if(state!=='pending')return;assertOpen();state='ready';for(const staged of ownedStages){const set=stages.get(staged.id);set?.delete(staged);if(!set?.size)stages.delete(staged.id);}ownedStages.length=0;resolve();
      }catch(cause){retire('failed',cause);}},cause=>retire('failed',spineFault('LOAD',ids.join(','),cause))).catch(()=>{});
      return group;
    },
  });
  try{APPLY(USE,ownerScope,[loader]);scopeOpen();}catch(cause){dispose();throw cause;}return loader;
}
