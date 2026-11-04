// SPDX-License-Identifier: Apache-2.0
// Original literal geometry; public SDK only. The ticket borrows every node and lease.
import {Sprite,DisplayObjectContainer,Mesh2D,Bitmap,createAssetType,createAssetRef,isTexture,createTexture,createImageData2D,createSharedGeometry2D} from '@egret/engine';
export const frameOptions=Object.freeze({width:64,height:64,clearColor:0,clearAlpha:1,outputAlpha:'opaque'});
export async function createScene(engine){
 const oldScope=engine.createScope(),newScope=engine.createScope(),ticketScope=engine.createScope(),resourceScope=engine.createScope();
 const disposals=[];const type=createAssetType('prepared-subtree-original-pages',isTexture);
 engine.assets.register(type,{async load(ref){const rgba=ref.id==='green'?[0,255,0,255]:[0,255,255,255];const pixels=new Uint8Array(16);for(let i=0;i<16;i+=4)pixels.set(rgba,i);return createTexture(createImageData2D({width:2,height:2,pixels}));},dispose(value){disposals.push(value);value.dispose();}});
 const group=engine.createAssetGroup(resourceScope,[createAssetRef(type,'green'),createAssetRef(type,'cyan')]);const leases=await group.ready;
 const rect=(scope,color,x,y,w,h)=>{const node=scope.use(new Sprite());node.x=x;node.y=y;node.graphics.beginFill(color).drawRect(0,0,w,h).endFill();return node;};
 const parent=oldScope.use(new DisplayObjectContainer());parent.x=8;parent.y=8;parent.scaleX=2;parent.scaleY=2;parent.alpha=.5;parent.clipRect={x:0,y:0,width:20,height:20};engine.stage.addChild(parent);
 const target=oldScope.use(new DisplayObjectContainer());target.x=2;target.y=2;target.clipRect={x:0,y:0,width:12,height:12};parent.addChild(target);
 const old=rect(oldScope,0xff0000,0,0,16,16);target.addChild(old);
 const sibling=rect(oldScope,0x0000ff,8,4,3,3);parent.addChild(sibling);
 const candidate=newScope.use(new DisplayObjectContainer());candidate.x=2;candidate.y=1;candidate.clipRect={x:0,y:0,width:8,height:8};
 const geometry=createSharedGeometry2D({positions:new Float32Array([0,0,8,0,8,8,0,8]),uvs:new Float32Array([0,0,1,0,1,1,0,1]),lightColors:new Float32Array(Array(4).fill([1,1,1,1]).flat()),darkColors:new Float32Array(12),indices:new Uint16Array([0,1,2,0,2,3])});
 const binding=Mesh2D.createBinding(leases[0],geometry);newScope.use(binding);candidate.addChild(binding.node);
 const bitmap=newScope.use(new Bitmap(leases[1]));bitmap.x=4;bitmap.y=4;candidate.addChild(bitmap);
 return {engine,parent,target,old,sibling,candidate,bitmap,binding,geometry,leases,group,oldScope,newScope,ticketScope,resourceScope,disposals,
  prepare(){return engine.prepareDisplaySubtree(ticketScope,target,candidate);},capture(){return engine.captureSharedFrame(frameOptions);},
  inspect(){return {oldDisposed:old.isDisposed,candidateDisposed:candidate.isDisposed,oldAttached:old.parent===target,candidateAttached:candidate.parent===target,children:target.numChildren,disposedTextures:disposals.length};},
  close(){ticketScope.dispose();newScope.dispose();oldScope.dispose();resourceScope.dispose();return this.inspect();}};
}
