// SPDX-License-Identifier: Apache-2.0
// One optional display borrows existing page leases and the instance's explicit time.
import { SkeletonRendererCore } from '@esotericsoftware/spine-core';
import { DisplayObjectContainer, Mesh2D, Scope, EgretError } from '@egret/engine';
import type { DisplayObject, SharedGeometry2D, SharedMaterial2D } from '@egret/engine';
import type { SpineInstance } from './instanceTypes.js';
import type { SpineDisplay, SpineDisplayOptions, SpineDisplayStatus } from './displayTypes.js';
import { requireSpineRender } from './renderAuthority.js';
import { registerResetDisplay } from './resetAuthority.js';
import type { SpineDrawCandidate, SpineDrawSink } from './renderAuthority.js';
import { copySpineDraws, drawFault } from './drawGeometry.js';
import type { SpineDrawRow } from './drawGeometry.js';
const apply=Reflect.apply,add=DisplayObjectContainer.prototype.addChild,remove=DisplayObjectContainer.prototype.removeChild;
const children=Object.getOwnPropertyDescriptor(DisplayObjectContainer.prototype,'numChildren')!.get!,childAt=DisplayObjectContainer.prototype.getChildAt;
const closeContainer=DisplayObjectContainer.prototype.dispose,use=Scope.prototype.use;
type Binding = ReturnType<typeof Mesh2D.createBinding<SharedGeometry2D>>;
/** Bind one authenticated semantic player to the ordinary ordered shared render path. */
export function createSpineDisplay(instance: SpineInstance, scope: Scope, options: SpineDisplayOptions): SpineDisplay {
  const port=requireSpineRender(instance);port.asset.authenticate(scope,false);
  const limits={commands:256,vertices:65536,indices:196608};
  {
    if(!options||typeof options!=='object')throw drawFault('OPTIONS_INVALID');
    const profile=Object.getOwnPropertyDescriptor(options,'colorProfile');
    if(!profile||!Object.hasOwn(profile,'value')||profile.value!=='egret-shared-linear/1')throw drawFault('COLOR_PROFILE_REQUIRED');
    if(!options||typeof options!=='object')throw drawFault('OPTIONS_INVALID');
    for(const key of Reflect.ownKeys(options)){
      if(key==='colorProfile')continue;
      const name=key==='maxCommands'?'commands':key==='maxVertices'?'vertices':key==='maxIndices'?'indices':undefined;
      const descriptor=Object.getOwnPropertyDescriptor(options,key);
      if(!name||!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isSafeInteger(descriptor.value)||descriptor.value<1||descriptor.value>limits[name])throw drawFault('OPTIONS_INVALID');
      limits[name]=descriptor.value as number;
    }
  }
  port.asset.authenticate(scope,false);
  let disposed=false,revision=0,detach:(()=>void)|undefined,renderer:SkeletonRendererCore|undefined=new SkeletonRendererCore();
  let current:DisplayObjectContainer|undefined,meshes:DisplayObject[]=[],bindings:Binding[]=[],rows:SpineDrawRow[]=[];
  const materials=new Map<string,SharedMaterial2D>();
  type Retired = {container:DisplayObjectContainer|undefined;bindings:Binding[];finish?:(()=>void)[]};
  const retired=new Set<Retired>();
  function markRetired(row:Retired):void { row.finish??=row.bindings.map(binding=>binding.beginDispose()); }
  function release(row:Retired):void {
    markRetired(row);const errors:unknown[]=[];
    for(const finish of row.finish!)try{finish();}catch(cause){errors.push(cause);}
    try{if(row.container)apply(closeContainer,row.container,[]);}catch(cause){errors.push(cause);}finally{retired.delete(row);}
    if(errors.length)throw new EgretError('SPINE_DISPLAY_CLEANUP_FAILED',{cause:errors[0],cleanupErrors:errors.slice(1)});
  }
  let status:SpineDisplayStatus=Object.freeze({colorProfile:'egret-shared-linear/1',isDisposed:false,revision,commands:0,vertices:0,indices:0});
  // The public node permits placement, but terminal disposal must also revoke the private participant.
  class Root extends DisplayObjectContainer { override dispose():void { dispose(); } }
  const root=new Root();Object.freeze(root);
  function assertOpen():void { if(disposed)throw drawFault('DISPOSED');port.asset.assertOpen(); }
  function intact():void {
    assertOpen();if(apply(children,root,[])!==(current?1:0)||current&&(current.isDisposed||apply(childAt,root,[0])!==current||apply(children,current,[])!==meshes.length))throw drawFault('TOPOLOGY_CHANGED');
    for(let i=0;i<meshes.length;i++)if(meshes[i]!.isDisposed||apply(childAt,current,[i])!==meshes[i])throw drawFault('TOPOLOGY_CHANGED');
  }
  function dispose():void {
    if(disposed)return;disposed=true;const unregister=detach;detach=undefined;unregister?.();renderer=undefined;materials.clear();
    const failures:unknown[]=[],active={container:current,bindings};current=undefined;meshes=[];bindings=[];rows=[];status=Object.freeze({...status,isDisposed:true});
    const owned=[active,...retired];for(const row of owned)markRetired(row);
    for(const row of owned)try{release(row);}catch(cause){failures.push(cause);}
    try{apply(closeContainer,root,[]);}catch(cause){failures.push(cause);}
    if(failures.length)throw new EgretError('SPINE_DISPLAY_CLEANUP_FAILED',{cause:failures[0],cleanupErrors:failures.slice(1)});
  }
  const sink:SpineDrawSink={dispose,prepare(skeleton):SpineDrawCandidate {
    intact();const next=copySpineDraws(renderer!.render(skeleton,false,undefined,2),port.asset,limits,materials);
    const reuse=next.length===rows.length&&next.every((row,i)=>row.lease===rows[i]!.lease&&row.material===rows[i]!.material);
    const prepared=reuse?next.map((row,i)=>bindings[i]!.prepare(row.lease,row.geometry)):[];
    let staged:DisplayObjectContainer|undefined,newMeshes:DisplayObject[]=[],newBindings:Binding[]=[];
    if(!reuse){staged=new DisplayObjectContainer();try{for(const row of next){const binding=Mesh2D.createBinding(row.lease,row.geometry);newBindings.push(binding);const mesh=binding.node;mesh.sharedMaterial=row.material;apply(add,staged,[mesh]);newMeshes.push(mesh);}Object.freeze(staged);}catch(cause){for(const binding of newBindings)binding.dispose();apply(closeContainer,staged,[]);throw cause;}}
    let settled=false,old:Retired|undefined;
    return {abort(){if(settled)return;settled=true;for(const item of prepared)item.abort();for(const binding of newBindings)binding.dispose();if(staged)apply(closeContainer,staged,[]);},commit(){
      if(settled)throw drawFault('CANDIDATE_RETIRED');intact();
      // All owned geometry and topology are validated before callback-free content publication.
      if(reuse){for(const item of prepared)item.commit();}
      else {const previous=current,previousBindings=bindings;apply(add,root,[staged!]);if(previous)apply(remove,root,[previous]);current=staged;meshes=newMeshes;bindings=newBindings;if(previous){old={container:previous,bindings:previousBindings};retired.add(old);}}
      rows=next;settled=true;revision++;status=Object.freeze({colorProfile:'egret-shared-linear/1',isDisposed:false,revision,commands:next.length,vertices:next.reduce((n,row)=>n+row.geometry.vertexCount,0),indices:next.reduce((n,row)=>n+row.geometry.indexCount,0)});
    },retire(){if(old){const row=old;old=undefined;release(row);}}};
  }};
  const display:SpineDisplay=Object.freeze({node:root,dispose,getStatus(){return disposed?Object.freeze({...status,isDisposed:true}):status;}});
  try{apply(use,scope,[root]);detach=port.attach(scope,sink);apply(use,scope,[display]);assertOpen();}
  catch(cause){dispose();throw cause;}
  registerResetDisplay(display,instance);
  return display;
}
