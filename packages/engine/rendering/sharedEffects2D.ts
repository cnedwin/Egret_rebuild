// SPDX-License-Identifier: Apache-2.0
import type { Matrix2D, Rectangle2D, SharedRenderFrame2D } from '@egret/contracts';
/** A schedule contains no native handles and borrows only immutable captured data. */
export interface PreparedEffect2D {readonly enter:number;readonly exit:number;readonly depth:number;readonly maskPageIndex:number|undefined;readonly radius:number;readonly uniform:Float32Array<ArrayBuffer>;}
export interface PreparedEffects2D {readonly groups:readonly PreparedEffect2D[];readonly depth:number;readonly targetCount:number;readonly uniformBytes:number;}
function fail():never{throw new RangeError('Shared effect limits or geometry are unsupported');}
function inverse(m:Matrix2D,rect:Rectangle2D,ratio:number):number[]{
  const det=m.a*m.d-m.b*m.c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-12)fail();
  const a=m.d/det,b=-m.b/det,c=-m.c/det,d=m.a/det;
  const values=[a/ratio,b/ratio,c/ratio,d/ratio,-a*m.tx-c*m.ty,-b*m.tx-d*m.ty,rect.x,rect.y,rect.width,rect.height,0,0].map(Math.fround);
  if(values.some(v=>!Number.isFinite(v))||values[8]!<=0||values[9]!<=0)fail();return values;
}
/** All admission precedes target/buffer allocation. Clips execute at group composition. */
export function prepareEffects2D(frame:SharedRenderFrame2D,ratio:number,enabled:boolean):PreparedEffects2D {
  const groups:PreparedEffect2D[]=[],stack:{id:number;index:number}[]=[];let depth=0;
  for(const command of frame.commands){
    if(command.kind!=='barrier'){
      if(stack.length&&frame.materials[command.materialIndex]?.blend==='add-preserve')fail();
      continue;
    }
    if(command.reason==='effect-enter'){
      if(!enabled||!command.effect||groups.length>=8||stack.length>=4)fail();
      const e=command.effect,radius=Math.min(16,Math.ceil(e.blurRadius*ratio));
      if(!Number.isInteger(radius)||radius<0||radius>16||e.clips.length>8)fail();
      const uniform=new Float32Array(112);uniform[0]=radius;uniform[2]=e.clips.length;
      if(e.maskPageIndex!==undefined){
        if(!Number.isInteger(e.maskPageIndex)||!frame.pages[e.maskPageIndex]||!e.maskRect)fail();
        uniform[3]=1;uniform.set(inverse(e.matrix,e.maskRect,ratio),4);
      }
      for(let i=0;i<e.clips.length;i++){const clip=e.clips[i]!;uniform.set(inverse(clip.matrix,clip.rect,ratio),16+i*12);}
      const index=groups.length;groups.push({enter:command.ordinal,exit:-1,depth:stack.length+1,maskPageIndex:e.maskPageIndex,radius,uniform});
      stack.push({id:command.boundaryId,index});depth=Math.max(depth,stack.length);
    }else if(command.reason==='effect-exit'){
      const top=stack.pop();if(!top||top.id!==command.boundaryId)fail();
      groups[top.index]={...groups[top.index]!,exit:command.ordinal};
    }else if(command.effect!==undefined)fail();
  }
  if(stack.length)fail();
  return {groups,depth,targetCount:2*depth,uniformBytes:groups.length*448};
}
