// SPDX-License-Identifier: Apache-2.0
// Original artifacts and public behavior controls, independent of the parser.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as egret from '@egret/engine';
import * as resources from '@egret/engine/resources';
import {buildResourceManifest} from '@egret/contracts/resources';
import {description,entry} from './fixtures/resource-manifest.mjs';
import {host,deferred,flush} from './helpers.mjs';

const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const layout=()=>({sourceWidth:1,sourceHeight:1,trimX:0,trimY:0,packedRotation:0});
const frame=(x,durationSeconds)=>({x,y:0,width:1,height:1,durationSeconds,layout:layout()});
export function contentFixture(change=()=>{}){
 const sequenceInput={atlasWidth:2,atlasHeight:1,frames:[frame(0,0.125),frame(1,0.25)]};
 const atlas={format:'egret.atlas/1',pageDependency:0,width:2,height:1,frames:[{name:'red',x:0,y:0,width:1,height:1,layout:layout()},{name:'green',x:1,y:0,width:1,height:1,layout:layout()}],sequenceInput};
 const sequence={format:'egret.sequence/1',atlasDependency:0,sequenceInput:structuredClone(sequenceInput)};
 const rows=[['e_page','image','egret.png','png/1',[]],['e_atlas','atlas','egret.aseprite-atlas','egret.atlas/1',['e_page']],['e_sequence','sequence','egret.sequence','egret.sequence/1',['e_atlas']]].map(([id,kind,importer,format,deps])=>{
  const r=entry(id,deps);r.resourceKind=kind;r.importer={id:importer,version:'1.0.0'};r.artifactFormatVersion=format;
  r.source={...r.source,id:kind==='image'?'f_png':'f_json',path:kind==='image'?'source/page.png':'source/atlas.json'};
  r.artifact={...r.artifact,id:'f_'+id,path:'assets/'+id,mediaType:kind==='image'?'image/png':'application/json'};return r;
 });
 const f={atlas,sequence,rows};change(f);
 const texts=new Map([['e_atlas',canonical(atlas)],['e_sequence',canonical(sequence)]]);
 for(const r of rows){const bytes=Buffer.from(texts.get(r.id)??'PNG fixture bytes');r.artifact.sha256=createHash('sha256').update(bytes).digest('hex');r.artifact.byteLength=bytes.length;}
 const result=buildResourceManifest(description(rows));assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return {...f,texts,manifest:result.value};
}
export async function contentSetup(f=contentFixture(),control={},existingEngine){
 const engine=existingEngine??await egret.createEngine({host:host().adapter});const loads=[],disposed=[],pending=[],textures=[];
 assert.equal(typeof resources.createContentLoader,'function','CONTENT_RUNTIME_FACTORY_MISSING');
 const loader=resources.createContentLoader(engine,f.manifest,bindings=>{
  const ids=new Map(bindings.map(r=>[r.binding.ref.id,r.id]));
  const provider={load(ref,context){const id=ids.get(ref.id);loads.push(id);control.onLoad?.(id);if(id==='e_page'){
   const texture=egret.createTexture(egret.createImageData2D({width:2,height:1,pixels:new Uint8Array(control.pixels??[255,0,0,255,0,255,0,255])}));textures.push(texture);
   if(control.hold){const d=deferred();pending.push({d,texture,context});return d.promise;}return Promise.resolve(texture);
  }if(control.fail===id)return Promise.reject(new Error('original provider failure'));return Promise.resolve(control.text??f.texts.get(id));},dispose(value){disposed.push(value);control.onDispose?.(value);if(egret.isTexture(value))value.dispose();}};
  return {textures:provider,metadata:provider};
 });
 return {engine,loader,loads,disposed,pending,textures,f,async close(){loader.dispose();for(const p of pending)p.d.resolve(p.texture);await engine.dispose();}};
}
