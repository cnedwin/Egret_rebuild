import type { PreparedSharedDraw2D, PreparedSharedFrame2D, SharedPoint2D } from './prepareSharedDraws2D.js';
import { qualifySharedUV, sharedFailure } from './prepareSharedDraws2D.js';
import { packedOrientation } from './packedOrientation.js';
/**
 * `regionWindow` is the window of the region table this draw's region is in, or -1 for a draw without a region.
 * `pages` are the pages of the frame the draw samples, in the order of the texture units that hold them: the
 * one page of a draw as it is packed, up to eight for a batch, none for a draw without a region.
 * Nothing of a record is written once it is given, except the rows of a batch a Host keeps between frames:
 * see `prepareSharedBatches2D`. Draws next to each other may share one `uniform`, and one `pages`.
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
/** Writes the block of one draw at float index `f` of a buffer seen as floats and as words. Every word it does not write is zero. */
function writeBlock(floats:Float32Array<ArrayBuffer>,words:Uint32Array<ArrayBuffer>,f:number,width:number,height:number,draw:PreparedSharedDraw2D):void {
    // Float and word indices of this draw's block: twelve floats, then twenty words from byte 48.
    // The block holds what is the same for a whole batch. The third float, once the opacity, stays zero: the
    // opacity is in each vertex. Of the first eleven words, once the region, the first eight name the pages
    // of the texture units and the next three stay zero: the region is in the region table.
    const w=f+12,material=draw.material,light=material.light,dark=material.dark;
    if(light.length===4&&dark.length===3){
        floats[f]=width;floats[f+1]=height;floats[f+2]=0;floats[f+3]=0;
        floats[f+4]=light[0];floats[f+5]=light[1];floats[f+6]=light[2];floats[f+7]=light[3];
        floats[f+8]=dark[0];floats[f+9]=dark[1];floats[f+10]=dark[2];floats[f+11]=0;
    }else floats.subarray(f,f+12).set([width,height,0,0,...light,...dark,0]);
    if(draw.region){
        // A draw as it is packed samples one page, held by the first unit. The page's size is in the row of
        // its region, so that draws of pages of different sizes have equal blocks.
        words[w]=draw.pageIndex!;for(let unit=1;unit<SHARED_BATCH_PAGES_2D;unit++)words[w+unit]=SHARED_NO_PAGE_2D;
        const strategy=material.filter==='nearest'?0:material.samplingDomain==='page'?1:material.regionIsolation==='strict'?3:2;
        words[w+11]=material.samplingDomain==='page'?1:0;words[w+12]=address(material.addressU);words[w+13]=address(material.addressV);
        words[w+14]=material.filter==='linear'?1:0;words[w+15]=material.regionIsolation==='strict'?1:0;
        words[w+18]=draw.command.kind==='mesh'?2:1;words[w+19]=strategy;
    }else{
        // Solid draws have canonical unused sampling fields, never a white page.
        words[w+16]=1;words[w+17]=1;
    }
}
/** Blocks are allocated this many at a time: draws next to each other mostly share one. */
const BLOCKS=32;
/**
 * Backing coordinates stay backing coordinates until the fixed vertex shader. A draw whose geometry was kept
 * from the last frame takes the rows kept with it, once the charges recorded with those rows fit: the rows of
 * a draw depend on its geometry alone, except the place of its region and its opacity, which are written anew.
 * A kept draw that rested, whose record preparation gave again, is packed once and its packed record kept:
 * the next frame is given that record, while the draw goes on resting, for the charges alone.
 */
export function packSharedDraws2D(prepared:PreparedSharedFrame2D):PackedSharedEntry2D[] {
    // The vertex rows packed in one call share one allocation; each draw's `data` is a view of its own range,
    // with the same length and bytes as a separate array. A kept packed record has rows of its own.
    const result:PackedSharedEntry2D[]=[],frame=prepared.frame,budget=prepared.budget;
    const retention=prepared.retention,retained=prepared.retained,entries=prepared.entries;
    // A fan of n corners yields at most n-2 triangles; collapsed ones are dropped below and leave the tail unused.
    let capacity=0;
    for(let entry=0;entry<entries.length;entry++){const draw=entries[entry]!;if(draw.kind==='barrier')continue;
        const kept=retained?.[entry];if(kept!==undefined&&kept.rested&&kept.rows!==undefined)continue;
        for(const polygon of draw.polygons)if(polygon.length>2)capacity+=(polygon.length-2)*3;}
    let rows=new Float32Array(capacity*ROW),used=0;
    // The block of a draw is the block of the draw packed before it in the same way, kept or not, when
    // that draw has the same material, page and kind: every input of the two blocks is then the same.
    let blockBytes:Uint8Array<ArrayBuffer>|undefined,blockFloats:Float32Array<ArrayBuffer>|undefined,blockWords:Uint32Array<ArrayBuffer>|undefined,block=0,blockEnd=0;
    const blockOf=(draw:PreparedSharedDraw2D,beside:PackedSharedDraw2D|undefined):Uint8Array<ArrayBuffer>=>{
        const other=beside?.prepared;
        if(other!==undefined&&other.material===draw.material&&other.pageIndex===draw.pageIndex&&other.command.kind===draw.command.kind)return beside!.uniform;
        if(block===blockEnd){const blocks=new ArrayBuffer(BLOCKS*BLOCK);blockBytes=new Uint8Array(blocks);blockFloats=new Float32Array(blocks);blockWords=new Uint32Array(blocks);block=0;blockEnd=BLOCKS*BLOCK;}
        writeBlock(blockFloats!,blockWords!,block>>2,prepared.width,prepared.height,draw);
        block+=BLOCK;return blockBytes!.subarray(block-BLOCK,block);
    };
    // A kept record never shares the block of a record that is not kept, which would hold a whole allocation of blocks for it.
    const keptBlockOf=(draw:PreparedSharedDraw2D,beside:PackedSharedDraw2D|undefined):Uint8Array<ArrayBuffer>=>{
        const other=beside?.prepared;
        if(other!==undefined&&other.material===draw.material&&other.pageIndex===draw.pageIndex&&other.command.kind===draw.command.kind)return beside!.uniform;
        const own=new ArrayBuffer(BLOCK);writeBlock(new Float32Array(own),new Uint32Array(own),0,prepared.width,prepared.height,draw);return new Uint8Array(own);
    };
    let fresh:PackedSharedDraw2D|undefined,rested:PackedSharedDraw2D|undefined;
    // The arrays of the one page of a draw, by page: a draw reads its array and never writes it.
    const pagesOf:(readonly number[]|undefined)[]=[];
    for(let entry=0;entry<entries.length;entry++){
        const draw=entries[entry]!;
        if(draw.kind==='barrier'){result.push({barrier:true,ordinal:draw.ordinal});continue;}
        const kept=retained?.[entry],keptRows=kept?.rows;
        if(keptRows!==undefined&&kept!.rested){
            if(budget.tryReplayStageCost(kept!.rowsCost!)){
                // The record of a draw that rested since it was packed has this command, this page and these rows.
                let packed=kept!.packed;
                if(packed===undefined||packed.prepared!==draw){
                    const index=draw.command.kind==='rect'?0:draw.command.regionIndex,slot=index%SHARED_REGION_WINDOW_2D,opacity=draw.command.opacity;
                    let data=keptRows;
                    // The kept rows have the place and the opacity of the frame that packed them. Kept rows are never written.
                    if(data.length>0&&(data[11]!==slot||!Object.is(data[12],Math.fround(opacity)))){data=data.slice();for(let o=11;o<data.length;o+=ROW){data[o]=slot;data[o+1]=opacity;}}
                    let pages=NO_PAGES;
                    if(draw.region){const known=rested?.pages;pages=known!==undefined&&known.length===1&&known[0]===draw.pageIndex?known:[draw.pageIndex!];}
                    packed={prepared:draw,data,vertexCount:kept!.vertexCount,uniform:keptBlockOf(draw,rested),regionWindow:draw.region?Math.floor(index/SHARED_REGION_WINDOW_2D):-1,pages};
                    // Without room to keep it, the record is this frame's alone and is made again for the next.
                    if(retention!.keepPacked(kept!,packed))rested=packed;
                }else rested=packed;
                result.push(packed);continue;
            }
            // The charges do not fit: the draw is packed as if nothing were kept, and refuses where it would have.
            // No room was counted for it, so the draws from here on are packed into a new allocation with that
            // room; the draws before it keep their views of the old one.
            let own=0;for(const polygon of draw.polygons)if(polygon.length>2)own+=(polygon.length-2)*3;
            rows=new Float32Array(rows.length-used+own*ROW);used=0;
        }
        const opacity=draw.command.opacity,index=draw.command.kind==='rect'?0:draw.command.regionIndex;
        const slot=index%SHARED_REGION_WINDOW_2D,regionWindow=draw.region?Math.floor(index/SHARED_REGION_WINDOW_2D):-1;
        let pages=NO_PAGES;
        if(draw.region){const known=pagesOf[draw.pageIndex!];if(known===undefined)pagesOf[draw.pageIndex!]=pages=[draw.pageIndex!];else pages=known;}
        const first=used;let vertices=0;
        const predicatesBefore=budget.predicatesCharged;
        if(keptRows!==undefined&&!kept!.rested&&budget.tryReplayStageCost(kept!.rowsCost!)){
            rows.set(keptRows,used);vertices=kept!.vertexCount;
            for(let o=used+11,end=used+keptRows.length;o<end;o+=ROW){rows[o]=slot;rows[o+1]=opacity;}
            used+=keptRows.length;
        }else for(const polygon of draw.polygons){
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
        // The orientation of each triangle is the one charge of this stage.
        if(kept!==undefined&&keptRows===undefined)retention!.keepRows(kept,rows.subarray(first,used),vertices,{preparedVertices:0,predicates:budget.predicatesCharged-predicatesBefore,tupleComparisons:0});
        fresh={prepared:draw,data:rows.subarray(first,used),vertexCount:vertices,uniform:blockOf(draw,fresh),regionWindow,pages};
        result.push(fresh);
    }
    return result;
}
