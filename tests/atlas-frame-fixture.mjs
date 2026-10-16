// SPDX-License-Identifier: Apache-2.0
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';
export {egret};
export const PROFILE='trim-rotation-v1';
export const A={x:0,y:0,width:2,height:3};
export const B={x:3,y:0,width:2,height:3};
export const LA={sourceWidth:4,sourceHeight:5,trimX:1,trimY:1,packedRotation:0};
export const LB={sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90};
export const frames=()=>[{name:'A',...A,layout:{...LA}},{name:'B',...B,layout:{...LB}}];
export const input=(fs=frames())=>({atlasWidth:6,atlasHeight:6,frames:fs.map((f,i)=>({...f,durationSeconds:i===0?.125:.25}))});
export const clip=()=>egret.createSequenceClip(input(),PROFILE);
export async function fixture(base){
 const engine=await egret.createEngine({host:host().adapter});
 const scope=engine.createScope();
 const image=egret.createImageData2D({width:6,height:6,pixels:new Uint8Array(144)});
 const type=egret.createAssetType('atlas-frame-fixture',egret.isTexture);
 let disposals=0;
 engine.assets.register(type,{async load(){return egret.createTexture(image,base);},dispose(t){disposals++;t.dispose();}});
 const ref=egret.createAssetRef(type,'atlas');
 const lease=scope.use(await engine.assets.acquire(ref));
 return {engine,scope,lease,ref,disposals:()=>disposals,async close(){await engine.dispose();}};
}
export const options={width:64,height:64,clearColor:0,clearAlpha:0};
