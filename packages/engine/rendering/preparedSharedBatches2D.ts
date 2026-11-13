import type { PackedSharedDraw2D, PackedSharedEntry2D } from './packSharedDraws2D.js';
import { SHARED_BATCH_PAGES_2D, SHARED_NO_PAGE_2D } from './packSharedDraws2D.js';
import type { PreparedBatchScratch2D } from './preparedBatches2D.js';
export interface PreparedSharedBatchPlan2D { readonly draws:PackedSharedDraw2D[]; logicalDraws:readonly PackedSharedEntry2D[]|undefined; readonly logicalSpans:{first:number;count:number}[]; bytes:number; released:boolean; transferred:boolean; }
function compatible(a:PackedSharedDraw2D,b:PackedSharedDraw2D,previous:PackedSharedDraw2D):boolean {
    const x=a.prepared,y=b.prepared,xc=x.command,yc=y.command;
    // Regions of one window of the region table share a batch, whatever their page and opacity: the
    // region's slot and the opacity are in each vertex, and the page in the region's row. The caller
    // counts the pages. A draw with a region and one without never share a batch.
    if(yc.ordinal!==previous.prepared.command.ordinal+1||xc.kind!==yc.kind||x.material!==y.material||(x.pageIndex===undefined)!==(y.pageIndex===undefined)||a.regionWindow!==b.regionWindow
        ||xc.clips.length!==yc.clips.length||b.vertexCount===0)return false;
    for(let i=0;i<xc.clips.length;i++){const l=xc.clips[i]!,r=yc.clips[i]!;
        for(const key of ['a','b','c','d','tx','ty'] as const)if(!Object.is(l.matrix[key],r.matrix[key]))return false;
        for(const key of ['x','y','width','height'] as const)if(!Object.is(l.rect[key],r.rect[key]))return false;}
    // Every uniform byte is part of compatibility, including future fixed padding, except the eight words
    // from byte 48 that name the pages of the texture units.
    for(let i=0;i<48;i++)if(a.uniform[i]!==b.uniform[i])return false;
    for(let i=80;i<128;i++)if(a.uniform[i]!==b.uniform[i])return false;
    return true;
}
/** No logical charge is refunded when a physical upload is concatenated. */
export function prepareSharedBatches2D(input:readonly PackedSharedEntry2D[],maxBufferSize:number,scratch:PreparedBatchScratch2D):PreparedSharedBatchPlan2D {
    const plan:PreparedSharedBatchPlan2D={draws:[],logicalDraws:input,logicalSpans:[],bytes:0,released:false,transferred:false};
    try{for(let start=0;start<input.length;){const first=input[start]!;
        if('barrier' in first||first.vertexCount===0){start++;continue;}
        let end=start+1,bytes=first.data.byteLength,previous=first;
        const ceiling=Math.min(maxBufferSize,scratch.available());
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
            plan.draws.push({...first,data,vertexCount:data.length/13,uniform,pages});plan.logicalSpans.push({first:start,count:end-start});}
        else{scratch.refund(plan,bytes);for(let i=start;i<end;i++){plan.draws.push(input[i] as PackedSharedDraw2D);plan.logicalSpans.push({first:i,count:1});}}
        start=end;
    }return plan;}catch(cause){scratch.release(plan);throw cause;}
}
