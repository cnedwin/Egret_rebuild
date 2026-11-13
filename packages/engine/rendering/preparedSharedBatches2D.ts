import type { PackedSharedDraw2D, PackedSharedEntry2D } from './packSharedDraws2D.js';
import { SHARED_BATCH_PAGES_2D, SHARED_NO_PAGE_2D } from './packSharedDraws2D.js';
import type { PreparedBatchScratch2D } from './preparedBatches2D.js';
export interface PreparedSharedBatchPlan2D { readonly draws:PackedSharedDraw2D[]; logicalDraws:readonly PackedSharedEntry2D[]|undefined; readonly logicalSpans:{first:number;count:number}[]; bytes:number; released:boolean; transferred:boolean; }
/**
 * What two draws of one batch have in common, whatever lies between them. It holds of a draw and itself,
 * either way round, and of the first and third of three draws when it holds of the first two and the last two.
 */
function alike(a:PackedSharedDraw2D,b:PackedSharedDraw2D):boolean {
    const x=a.prepared,y=b.prepared,xc=x.command,yc=y.command;
    // Regions of one window of the region table share a batch, whatever their page and opacity: the
    // region's slot and the opacity are in each vertex, and the page in the region's row. The caller
    // counts the pages. A draw with a region and one without never share a batch.
    if(xc.kind!==yc.kind||x.material!==y.material||(x.pageIndex===undefined)!==(y.pageIndex===undefined)||a.regionWindow!==b.regionWindow
        ||xc.clips.length!==yc.clips.length)return false;
    if(xc.clips!==yc.clips)for(let i=0;i<xc.clips.length;i++){const l=xc.clips[i]!,r=yc.clips[i]!;
        for(const key of ['a','b','c','d','tx','ty'] as const)if(!Object.is(l.matrix[key],r.matrix[key]))return false;
        for(const key of ['x','y','width','height'] as const)if(!Object.is(l.rect[key],r.rect[key]))return false;}
    // Every uniform byte is part of compatibility, including future fixed padding, except the eight words
    // from byte 48 that name the pages of the texture units. Draws next to each other may share one block.
    const p=a.uniform,q=b.uniform;
    if(p===q)return true;
    for(let i=0;i<48;i++)if(p[i]!==q[i])return false;
    for(let i=80;i<128;i++)if(p[i]!==q[i])return false;
    return true;
}
/** Whether `b`, which follows `previous`, joins the batch that `a` began. */
function compatible(a:PackedSharedDraw2D,b:PackedSharedDraw2D,previous:PackedSharedDraw2D):boolean {
    return b.prepared.command.ordinal===previous.prepared.command.ordinal+1&&b.vertexCount!==0&&alike(a,b);
}
/** What the batches of a frame ask of the records a Host keeps between frames. */
export interface KeptSharedBatches2D {
    beginBatches():void;
    findBatch(ordinal:number):KeptSharedBatch2D|undefined;
    carryBatch(batch:KeptSharedBatch2D):void;
    roomForBatch(draws:number,joinedBytes:number):boolean;
    keepBatch(members:(PackedSharedDraw2D|undefined)[],lengths:Uint32Array<ArrayBuffer>,pages:Int32Array<ArrayBuffer>,joined:PackedSharedDraw2D):void;
    commitBatches():void;
}
interface KeptSharedBatch2D { readonly members:(PackedSharedDraw2D|undefined)[]; readonly lengths:Uint32Array<ArrayBuffer>; readonly pages:Int32Array<ArrayBuffer>; joined:PackedSharedDraw2D; }
const NO_ROWS=new Float32Array(0);
/**
 * What a kept batch holds of one of its draws. A record whose rows are a whole allocation is held itself: a
 * draw at rest has that same record in the next frame. The rows of any other record are a part of the rows
 * of its frame, which holding it would keep alive, so nothing is held for it; in the first place a record
 * without rows stands for it, because the draws of the next frame are compared with the first.
 */
function held(draw:PackedSharedDraw2D,first:boolean):PackedSharedDraw2D|undefined {
    if(draw.data.byteLength===draw.data.buffer.byteLength)return draw;
    return first?{prepared:draw.prepared,data:NO_ROWS,vertexCount:draw.vertexCount,uniform:draw.uniform,regionWindow:draw.regionWindow,pages:draw.pages}:undefined;
}
// The places and offsets of the draws of a kept batch that are other records than the batch holds. Batching is synchronous and calls no caller code.
let changed=new Uint32Array(64);
/**
 * No logical charge is refunded when a physical upload is concatenated.
 *
 * With `kept`, a batch joined here is kept, and the batch that begins at the same place in the next frame is
 * not joined again if it is certain that joining would take the same number of draws, each with as many
 * rows as the kept batch has for it, and would be given the same room. The rows of every draw that is
 * another record than the batch holds are then written over the rows the batch had for it, in the kept array
 * itself, and nothing is written for a draw that is the same record. The batches are the same draws, with
 * the same rows, as without `kept`.
 *
 * So the rows of a batch given with `kept` are only good until the next call with the same `kept`. A caller
 * that reads them later than that must not pass `kept`.
 */
export function prepareSharedBatches2D(input:readonly PackedSharedEntry2D[],maxBufferSize:number,scratch:PreparedBatchScratch2D,kept?:KeptSharedBatches2D):PreparedSharedBatchPlan2D {
    const plan:PreparedSharedBatchPlan2D={draws:[],logicalDraws:input,logicalSpans:[],bytes:0,released:false,transferred:false};
    try{kept?.beginBatches();
    for(let start=0;start<input.length;){const first=input[start]!;
        if('barrier' in first||first.vertexCount===0){start++;continue;}
        const ceiling=Math.min(maxBufferSize,scratch.available());
        const before=kept?.findBatch(first.prepared.command.ordinal);
        if(before!==undefined){
            const members=before.members,lengths=before.lengths,pages=before.pages,count=members.length,old=before.joined,total=old.data.byteLength,ordinal=first.prepared.command.ordinal;
            // Joining took these `count` draws. It takes as many again, into the same places of the same array, if
            // every draw that is another record is like the first, follows the draw before it, and has as many
            // rows and the same page as the batch has at its place; and if there is the room.
            // A first draw that is another record must be like the one before it, for the draws that are the same records to be like it.
            let same=start+count<=input.length&&total<=ceiling&&(first===members[0]||alike(members[0]!,first)),differ=0;
            for(let i=0,offset=0;same&&i<count;i++){
                const next=input[start+i]!,length=lengths[i]!;
                if(next!==members[i]){
                    if('barrier' in next||next.data.length!==length||(next.prepared.pageIndex??-1)!==pages[i]||next.prepared.command.ordinal!==ordinal+i||!alike(first,next)){same=false;break;}
                    if(2*differ+2>changed.length){const grown=new Uint32Array(2*changed.length);grown.set(changed);changed=grown;}
                    changed[2*differ]=i;changed[2*differ+1]=offset;differ++;
                }
                offset+=length;
            }
            if(same&&start+count<input.length){
                // Joining ended at the last of these draws. It ends there again unless the draw after them now joins.
                const next=input[start+count]!;
                if(!('barrier' in next)&&compatible(first,next,input[start+count-1] as PackedSharedDraw2D)&&next.data.byteLength<=ceiling-total){
                    const page=next.prepared.pageIndex;
                    same=page!==undefined&&!old.pages.includes(page)&&old.pages.length===SHARED_BATCH_PAGES_2D;
                }
            }
            if(same&&scratch.reserve(plan,total)){
                for(let i=0;i<differ;i++){const place=changed[2*i]!,next=input[start+place] as PackedSharedDraw2D;
                    if(next.data.length>0)old.data.set(next.data,changed[2*i+1]!);
                    members[place]=held(next,place===0);}
                // The joined draw names the record of the first draw; its block and pages are as they were.
                const joined=old.prepared===first.prepared?old:{prepared:first.prepared,data:old.data,vertexCount:old.vertexCount,uniform:old.uniform,regionWindow:old.regionWindow,pages:old.pages};
                before.joined=joined;kept!.carryBatch(before);
                plan.draws.push(joined);plan.logicalSpans.push({first:start,count});start+=count;continue;
            }
        }
        let end=start+1,bytes=first.data.byteLength,previous=first;
        // The pages of the batch in the order they first appear, which is the order of their texture units.
        let pages=first.pages;
        while(end<input.length){const next=input[end]!;if('barrier' in next||!compatible(first,next,previous)||next.data.byteLength>ceiling-bytes)break;
            const page=next.prepared.pageIndex;
            if(page!==undefined&&!pages.includes(page)){if(pages.length===SHARED_BATCH_PAGES_2D)break;pages=[...pages,page];}
            bytes+=next.data.byteLength;previous=next;end++;}
        if(end===start+1||!scratch.reserve(plan,bytes)){plan.draws.push(first);plan.logicalSpans.push({first:start,count:1});start++;continue;}
        let data:Float32Array<ArrayBuffer>|undefined;
        try{data=new Float32Array(bytes/4);let offset=0;for(let i=start;i<end;i++){const source=(input[i] as PackedSharedDraw2D).data;data.set(source,offset);offset+=source.length;}}catch{data=undefined;}
        if(data){
            // A batch of one page keeps the block of its first draw. One of several pages has a block of its own.
            let uniform=first.uniform;
            if(pages.length>1){uniform=first.uniform.slice();const units=new Uint32Array(uniform.buffer,48,SHARED_BATCH_PAGES_2D);
                for(let unit=0;unit<SHARED_BATCH_PAGES_2D;unit++)units[unit]=unit<pages.length?pages[unit]!:SHARED_NO_PAGE_2D;}
            const joined:PackedSharedDraw2D={prepared:first.prepared,data,vertexCount:data.length/13,uniform,regionWindow:first.regionWindow,pages};
            plan.draws.push(joined);plan.logicalSpans.push({first:start,count:end-start});
            if(kept!==undefined&&kept.roomForBatch(end-start,bytes)){
                const count=end-start,members=new Array<PackedSharedDraw2D|undefined>(count),lengths=new Uint32Array(count),memberPages=new Int32Array(count);
                for(let i=0;i<count;i++){const draw=input[start+i] as PackedSharedDraw2D;members[i]=held(draw,i===0);lengths[i]=draw.data.length;memberPages[i]=draw.prepared.pageIndex??-1;}
                kept.keepBatch(members,lengths,memberPages,joined);
            }}
        else{scratch.refund(plan,bytes);for(let i=start;i<end;i++){plan.draws.push(input[i] as PackedSharedDraw2D);plan.logicalSpans.push({first:i,count:1});}}
        start=end;
    }
    kept?.commitBatches();
    return plan;}catch(cause){scratch.release(plan);throw cause;}
}
