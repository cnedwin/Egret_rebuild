import type { PreparedSharedDraw2D, PreparedSharedFrame2D, SharedPoint2D } from './prepareSharedDraws2D.js';
import { qualifySharedUV, sharedFailure } from './prepareSharedDraws2D.js';
import { packedOrientation } from './packedOrientation.js';
export interface PackedSharedDraw2D { readonly prepared:PreparedSharedDraw2D; readonly data:Float32Array<ArrayBuffer>; readonly vertexCount:number; readonly uniform:Uint8Array<ArrayBuffer>; }
export type PackedSharedEntry2D = PackedSharedDraw2D | { readonly barrier:true; readonly ordinal:number };
// Eleven f32 values per vertex: x y u v r g b a dr dg db.
const ROW=11,BLOCK=128;
// One polygon's represented corners. Packing is synchronous and calls no caller code, so the storage is shared.
let corners=new Float32Array(64*ROW);
// Qualification reads the two represented texture coordinates of this one reused point.
const represented={x:0,y:0,u:0,v:0,r:0,g:0,b:0,a:0,dr:0,dg:0,db:0},representedPoint:SharedPoint2D=represented;
const address=(value:string):number=>value==='repeat'?1:value==='mirror-repeat'?2:0;
/** Backing coordinates stay backing coordinates until the fixed vertex shader. */
export function packSharedDraws2D(prepared:PreparedSharedFrame2D):PackedSharedEntry2D[] {
    // The vertex rows of one frame share one allocation, and its uniform blocks another; each draw's
    // `data` and `uniform` are views of its own range, with the same length and bytes as separate arrays.
    const result:PackedSharedEntry2D[]=[],frame=prepared.frame,budget=prepared.budget;
    // A fan of n corners yields at most n-2 triangles; collapsed ones are dropped below and leave the tail unused.
    let capacity=0,draws=0;
    for(const draw of prepared.entries){if(draw.kind==='barrier')continue;draws++;for(const polygon of draw.polygons)if(polygon.length>2)capacity+=(polygon.length-2)*3;}
    const rows=new Float32Array(capacity*ROW),blocks=new ArrayBuffer(draws*BLOCK),blockBytes=new Uint8Array(blocks),blockFloats=new Float32Array(blocks),blockWords=new Uint32Array(blocks);
    let used=0,block=0;
    for(const draw of prepared.entries){
        if(draw.kind==='barrier'){result.push({barrier:true,ordinal:draw.ordinal});continue;}
        const first=used;let vertices=0;
        for(const polygon of draw.polygons){
            const count=polygon.length;
            if(count*ROW>corners.length)corners=new Float32Array(count*ROW);
            for(let i=0,o=0;i<count;i++,o+=ROW){
                const p=polygon[i]!;
                // A typed store rounds to f32 exactly as Math.fround does.
                corners[o]=p.x;corners[o+1]=p.y;corners[o+2]=p.u;corners[o+3]=p.v;corners[o+4]=p.r;corners[o+5]=p.g;
                corners[o+6]=p.b;corners[o+7]=p.a;corners[o+8]=p.dr;corners[o+9]=p.dg;corners[o+10]=p.db;
                for(let k=0;k<ROW;k++)if(!Number.isFinite(corners[o+k]!))sharedFailure('precision');
                represented.u=corners[o+2]!;represented.v=corners[o+3]!;qualifySharedUV(representedPoint,draw,frame);
            }
            for(let i=1;i+1<count;i++){
                const b=i*ROW,c=b+ROW;
                // Preparation normalizes clockwise backing-space polygons. A
                // represented reversal refuses; a represented collapse stays a barrier.
                const sign=packedOrientation(corners[0]!,corners[1]!,corners[b]!,corners[b+1]!,corners[c]!,corners[c+1]!,budget);
                if(!Number.isFinite(sign)||sign<0)sharedFailure('precision');if(sign===0)continue;
                for(let k=0;k<ROW;k++){rows[used+k]=corners[k]!;rows[used+ROW+k]=corners[b+k]!;rows[used+2*ROW+k]=corners[c+k]!;}
                used+=3*ROW;vertices+=3;
            }
        }
        // Float and word indices of this draw's block: twelve floats, then twenty words from byte 48.
        const f=block>>2,w=f+12,material=draw.material,light=material.light,dark=material.dark;
        if(light.length===4&&dark.length===3){
            blockFloats[f]=prepared.width;blockFloats[f+1]=prepared.height;blockFloats[f+2]=draw.command.opacity;blockFloats[f+3]=0;
            blockFloats[f+4]=light[0];blockFloats[f+5]=light[1];blockFloats[f+6]=light[2];blockFloats[f+7]=light[3];
            blockFloats[f+8]=dark[0];blockFloats[f+9]=dark[1];blockFloats[f+10]=dark[2];blockFloats[f+11]=0;
        }else new Float32Array(blocks,block,12).set([prepared.width,prepared.height,draw.command.opacity,0,...light,...dark,0]);
        if(draw.region){const region=draw.region,p=region.packed,page=frame.pages[draw.pageIndex!]!.source;
            const odd=region.quarterTurn===1||region.quarterTurn===3;
            const strategy=material.filter==='nearest'?0:material.samplingDomain==='page'?1:material.regionIsolation==='strict'?3:2;
            blockWords[w]=region.logicalWidth;blockWords[w+1]=region.logicalHeight;blockWords[w+2]=region.trimX;blockWords[w+3]=region.trimY;
            blockWords[w+4]=odd?p.height:p.width;blockWords[w+5]=odd?p.width:p.height;blockWords[w+6]=p.x;blockWords[w+7]=p.y;blockWords[w+8]=p.width;blockWords[w+9]=p.height;
            blockWords[w+10]=region.quarterTurn;blockWords[w+11]=material.samplingDomain==='page'?1:0;blockWords[w+12]=address(material.addressU);blockWords[w+13]=address(material.addressV);
            blockWords[w+14]=material.filter==='linear'?1:0;blockWords[w+15]=material.regionIsolation==='strict'?1:0;blockWords[w+16]=page.width;blockWords[w+17]=page.height;
            blockWords[w+18]=draw.command.kind==='mesh'?2:1;blockWords[w+19]=strategy;
        }else{
            // Solid draws have canonical unused sampling fields, never a white page.
            blockWords[w]=1;blockWords[w+1]=1;blockWords[w+4]=1;blockWords[w+5]=1;blockWords[w+8]=1;blockWords[w+9]=1;blockWords[w+16]=1;blockWords[w+17]=1;
        }
        result.push({prepared:draw,data:rows.subarray(first,used),vertexCount:vertices,uniform:blockBytes.subarray(block,block+BLOCK)});
        block+=BLOCK;
    }
    return result;
}
