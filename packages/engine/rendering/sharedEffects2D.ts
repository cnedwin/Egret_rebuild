// SPDX-License-Identifier: Apache-2.0
import type { Matrix2D, Rectangle2D, SharedRenderFrame2D } from '@egret/contracts';
/** A schedule contains no native handles and borrows only immutable captured data. */
/** `spread` is the radius in backing pixels of a glow or outline, whose alpha a pass spreads into the group's scratch target, or -1 for neither. */
export interface PreparedEffect2D {readonly enter:number;readonly exit:number;readonly depth:number;readonly maskPageIndex:number|undefined;readonly radius:number;readonly spread:number;readonly uniform:Float32Array<ArrayBuffer>;}
/** The bytes of one group's uniform: 36 vectors of four floats. */
export const EFFECT_UNIFORM_BYTES=576;
const decode=(c:number):number=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
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
      const uniform=new Float32Array(EFFECT_UNIFORM_BYTES/4);uniform[0]=radius;uniform[2]=e.clips.length;
      let spread=0;
      // Vector 28: whether there is a colour matrix, the kind of spread, its radius and its strength; 29: its colour in linear
      // light and its alpha; 30: its offset in backing pixels, inner and knockout; 31-35: the matrix, by rows, and its offsets.
      if(e.colorMatrix!==undefined){
        if(e.colorMatrix.length!==20||e.colorMatrix.some(v=>!Number.isFinite(v)))fail();
        uniform[112]=1;
        for(let row=0;row<4;row++){for(let k=0;k<4;k++)uniform[124+row*4+k]=e.colorMatrix[row*5+k]!;uniform[140+row]=e.colorMatrix[row*5+4]!/255;}
      }
      if(e.glow!==undefined){
        const g=e.glow;
        spread=g.kind==='outline'?Math.min(16,Math.max(1,Math.round(g.spread*ratio))):Math.min(16,Math.ceil(g.spread*ratio));
        if(!Number.isInteger(spread)||spread<0||!Number.isInteger(g.color)||g.color<0||g.color>0xffffff)fail();
        uniform[113]=g.kind==='outline'?2:1;uniform[114]=spread;uniform[115]=g.strength;
        uniform[116]=decode(((g.color>>16)&255)/255);uniform[117]=decode(((g.color>>8)&255)/255);uniform[118]=decode((g.color&255)/255);uniform[119]=g.alpha;
        uniform[120]=Math.round(g.offsetX*ratio);uniform[121]=Math.round(g.offsetY*ratio);uniform[122]=g.inner?1:0;uniform[123]=g.knockout?1:0;
      }
      if(e.maskPageIndex!==undefined){
        if(!Number.isInteger(e.maskPageIndex)||!frame.pages[e.maskPageIndex]||!e.maskRect)fail();
        uniform[3]=1;uniform.set(inverse(e.matrix,e.maskRect,ratio),4);
      }
      for(let i=0;i<e.clips.length;i++){const clip=e.clips[i]!;uniform.set(inverse(clip.matrix,clip.rect,ratio),16+i*12);}
      const index=groups.length;groups.push({enter:command.ordinal,exit:-1,depth:stack.length+1,maskPageIndex:e.maskPageIndex,radius,spread:e.glow===undefined?-1:spread,uniform});
      stack.push({id:command.boundaryId,index});depth=Math.max(depth,stack.length);
    }else if(command.reason==='effect-exit'){
      const top=stack.pop();if(!top||top.id!==command.boundaryId)fail();
      groups[top.index]={...groups[top.index]!,exit:command.ordinal};
    }else if(command.effect!==undefined)fail();
  }
  if(stack.length)fail();
  return {groups,depth,targetCount:2*depth,uniformBytes:groups.length*EFFECT_UNIFORM_BYTES};
}
