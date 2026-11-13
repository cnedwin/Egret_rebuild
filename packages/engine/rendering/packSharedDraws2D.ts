import type { PreparedSharedDraw2D, PreparedSharedFrame2D, SharedPoint2D } from './prepareSharedDraws2D.js';
import { qualifySharedUV, sharedFailure } from './prepareSharedDraws2D.js';
import { packedOrientation } from './packedOrientation.js';
/**
 * `regionWindow` is the window of the region table this draw's region is in, or -1 for a draw without a region.
 * `pages` are the pages of the frame the draw samples, in the order of the texture units that hold them: the
 * one page of a draw as it is packed, up to eight for a batch, none for a draw without a region.
 */
export interface PackedSharedDraw2D { readonly prepared:PreparedSharedDraw2D; readonly data:Float32Array<ArrayBuffer>; readonly vertexCount:number; readonly uniform:Uint8Array<ArrayBuffer>; readonly regionWindow:number; readonly pages:readonly number[]; }
export type PackedSharedEntry2D = PackedSharedDraw2D | { readonly barrier:true; readonly ordinal:number };
/**
 * One vertex is thirteen f32 values: x y u v r g b a dr dg db slot opacity. `slot` is the place of the
 * draw's region in its window of the region table, and `opacity` the opacity of the draw; both are the
 * same at every vertex of a draw, so that draws which differ only in them share a batch.
 */
export const SHARED_VERTEX_BYTES_2D=52;
/**
 * The region table holds twelve u32 values for every region of a frame, in frame order: logical width and
 * height, trim x and y; content width and height, packed x and y; quarter turn, the index of the region's
 * page in the frame, and the width and height of that page. A draw reads it through a window of 341
 * consecutive regions, the most that fit the 16,384 bytes every WebGL2 context gives one uniform block.
 */
export const SHARED_REGION_WINDOW_2D=341,SHARED_REGION_WINDOW_BYTES_2D=16368;
/**
 * A batch samples at most this many pages. Words 12 to 19 of its block name them: the word of a texture
 * unit is the index in the frame of the page that unit holds, and 0xffffffff for a unit that holds none.
 * A vertex finds its page's unit by the page index in its region's row of the region table.
 */
export const SHARED_BATCH_PAGES_2D=8,SHARED_NO_PAGE_2D=0xffffffff;
const ROW=SHARED_VERTEX_BYTES_2D/4,BLOCK=128,NO_PAGES:readonly number[]=Object.freeze([]);
// One polygon's represented corners. Packing is synchronous and calls no caller code, so the storage is shared.
let corners=new Float32Array(64*ROW);
// Qualification reads the two represented texture coordinates of this one reused point.
const represented={x:0,y:0,u:0,v:0,r:0,g:0,b:0,a:0,dr:0,dg:0,db:0},representedPoint:SharedPoint2D=represented;
const address=(value:string):number=>value==='repeat'?1:value==='mirror-repeat'?2:0;
/** The region table of one frame. Every region is written, whether or not a draw of the frame uses it. */
export function packSharedRegions2D(frame:PreparedSharedFrame2D['frame']):Uint32Array<ArrayBuffer> {
    const regions=frame.regions,table=new Uint32Array(12*regions.length);
    for(let i=0,o=0;i<regions.length;i++,o+=12){
        const region=regions[i]!,p=region.packed,odd=region.quarterTurn===1||region.quarterTurn===3,page=frame.pages[region.pageIndex]!.source;
        table[o]=region.logicalWidth;table[o+1]=region.logicalHeight;table[o+2]=region.trimX;table[o+3]=region.trimY;
        table[o+4]=odd?p.height:p.width;table[o+5]=odd?p.width:p.height;table[o+6]=p.x;table[o+7]=p.y;
        table[o+8]=region.quarterTurn;table[o+9]=region.pageIndex;table[o+10]=page.width;table[o+11]=page.height;
    }
    return table;
}
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
        const opacity=draw.command.opacity,index=draw.command.kind==='rect'?0:draw.command.regionIndex;
        const slot=index%SHARED_REGION_WINDOW_2D,regionWindow=draw.region?Math.floor(index/SHARED_REGION_WINDOW_2D):-1;
        for(const polygon of draw.polygons){
            const count=polygon.length;
            if(count*ROW>corners.length)corners=new Float32Array(count*ROW);
            for(let i=0,o=0;i<count;i++,o+=ROW){
                const p=polygon[i]!;
                // A typed store rounds to f32 exactly as Math.fround does.
                corners[o]=p.x;corners[o+1]=p.y;corners[o+2]=p.u;corners[o+3]=p.v;corners[o+4]=p.r;corners[o+5]=p.g;
                corners[o+6]=p.b;corners[o+7]=p.a;corners[o+8]=p.dr;corners[o+9]=p.dg;corners[o+10]=p.db;corners[o+11]=slot;corners[o+12]=opacity;
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
        // The block holds what is the same for a whole batch. The third float, once the opacity, stays zero: the
        // opacity is in each vertex. Of the first eleven words, once the region, the first eight name the pages
        // of the texture units and the next three stay zero: the region is in the region table.
        const f=block>>2,w=f+12,material=draw.material,light=material.light,dark=material.dark;
        if(light.length===4&&dark.length===3){
            blockFloats[f]=prepared.width;blockFloats[f+1]=prepared.height;blockFloats[f+2]=0;blockFloats[f+3]=0;
            blockFloats[f+4]=light[0];blockFloats[f+5]=light[1];blockFloats[f+6]=light[2];blockFloats[f+7]=light[3];
            blockFloats[f+8]=dark[0];blockFloats[f+9]=dark[1];blockFloats[f+10]=dark[2];blockFloats[f+11]=0;
        }else new Float32Array(blocks,block,12).set([prepared.width,prepared.height,0,0,...light,...dark,0]);
        if(draw.region){
            // A draw as it is packed samples one page, held by the first unit. The page's size is in the row of
            // its region, so that draws of pages of different sizes have equal blocks.
            blockWords[w]=draw.pageIndex!;for(let unit=1;unit<SHARED_BATCH_PAGES_2D;unit++)blockWords[w+unit]=SHARED_NO_PAGE_2D;
            const strategy=material.filter==='nearest'?0:material.samplingDomain==='page'?1:material.regionIsolation==='strict'?3:2;
            blockWords[w+11]=material.samplingDomain==='page'?1:0;blockWords[w+12]=address(material.addressU);blockWords[w+13]=address(material.addressV);
            blockWords[w+14]=material.filter==='linear'?1:0;blockWords[w+15]=material.regionIsolation==='strict'?1:0;
            blockWords[w+18]=draw.command.kind==='mesh'?2:1;blockWords[w+19]=strategy;
        }else{
            // Solid draws have canonical unused sampling fields, never a white page.
            blockWords[w+16]=1;blockWords[w+17]=1;
        }
        result.push({prepared:draw,data:rows.subarray(first,used),vertexCount:vertices,uniform:blockBytes.subarray(block,block+BLOCK),regionWindow,pages:draw.region?[draw.pageIndex!]:NO_PAGES});
        block+=BLOCK;
    }
    return result;
}
