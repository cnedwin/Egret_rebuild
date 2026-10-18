import type { PreparedSharedDraw2D, PreparedSharedFrame2D } from './prepareSharedDraws2D.js';
import { qualifySharedUV, sharedFailure } from './prepareSharedDraws2D.js';
import { packedOrientation } from './packedOrientation.js';
export interface PackedSharedDraw2D { readonly prepared:PreparedSharedDraw2D; readonly data:Float32Array<ArrayBuffer>; readonly vertexCount:number; readonly uniform:Uint8Array<ArrayBuffer>; }
export type PackedSharedEntry2D = PackedSharedDraw2D | { readonly barrier:true; readonly ordinal:number };
/** Backing coordinates stay backing coordinates until the fixed vertex shader. */
export function packSharedDraws2D(prepared:PreparedSharedFrame2D):PackedSharedEntry2D[] {
    const result:PackedSharedEntry2D[]=[];
    for(const draw of prepared.entries){
        if(draw.kind==='barrier'){result.push({barrier:true,ordinal:draw.ordinal});continue;}
        const rows:number[][]=[];
        for(const polygon of draw.polygons){
            const points=polygon.map(p=>{const row=[p.x,p.y,p.u,p.v,p.r,p.g,p.b,p.a,p.dr,p.dg,p.db].map(Math.fround);
                if(row.some(n=>!Number.isFinite(n)))sharedFailure('precision');
                qualifySharedUV({...p,u:row[2]!,v:row[3]!},draw,prepared.frame);return row;});
            for(let i=1;i+1<points.length;i++){
                const a=points[0]!,b=points[i]!,c=points[i+1]!;
                // Preparation normalizes clockwise backing-space polygons. A
                // represented reversal refuses; a represented collapse stays a barrier.
                const sign=packedOrientation(a[0]!,a[1]!,b[0]!,b[1]!,c[0]!,c[1]!,prepared.budget);
                if(!Number.isFinite(sign)||sign<0)sharedFailure('precision');if(sign===0)continue;
                rows.push(a,b,c);
            }
        }
        const data=new Float32Array(rows.length*11);let offset=0;
        for(const row of rows){data.set(row,offset);offset+=11;}
        const uniform=new Uint8Array(128),floats=new Float32Array(uniform.buffer,0,12),words=new Uint32Array(uniform.buffer,48,20);
        const material=draw.material;
        floats.set([prepared.width,prepared.height,draw.command.opacity,0,...material.light,...material.dark,0]);
        // Solid draws have canonical unused sampling fields, never a white page.
        words.set([1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0]);
        if(draw.region){const region=draw.region,p=region.packed,page=prepared.frame.pages[draw.pageIndex!]!.source;
            const odd=region.quarterTurn===1||region.quarterTurn===3;
            const address=(value:string):number=>value==='repeat'?1:value==='mirror-repeat'?2:0;
            const strategy=material.filter==='nearest'?0:material.samplingDomain==='page'?1:material.regionIsolation==='strict'?3:2;
            words.set([region.logicalWidth,region.logicalHeight,region.trimX,region.trimY,odd?p.height:p.width,odd?p.width:p.height,p.x,p.y,p.width,p.height,
                region.quarterTurn,material.samplingDomain==='page'?1:0,address(material.addressU),address(material.addressV),material.filter==='linear'?1:0,
                material.regionIsolation==='strict'?1:0,page.width,page.height,draw.command.kind==='mesh'?2:1,strategy]);
        }
        result.push({prepared:draw,data,vertexCount:rows.length,uniform});
    }
    return result;
}
