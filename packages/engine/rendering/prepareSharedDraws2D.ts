import { isImageData2D, isSharedGeometry2D, isSharedMaterial2D, isTexturedGeometry2D } from '@egret/contracts';
import { prepareEffects2D } from './sharedEffects2D.js';
import type { PreparedEffects2D } from './sharedEffects2D.js';
import type { SharedRenderFrame2D, SharedRenderCommand2D, SharedMaterial2D, SharedRegion2D, Matrix2D } from '@egret/contracts';
import { Preparation, coordinate, clipPolygon2D, finishPolygonWinding2D } from './prepareRectangles2D.js';
import type { PolygonClipPolicy2D, CrossingAttributes, PreparedPoint2D, ClipRectanglePreparationContext2D } from './prepareRectangles2D.js';
import { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';
import type { TexturedPreparationLimits2D } from './texturedPreparationBudget2D.js';
import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import { decodeSharedSRGB } from './sharedColor2D.js';
import type { RetainedSharedDraw2D, SharedPreparationRetention2D } from './sharedPreparationRetention2D.js';
export class SharedPreparationError extends Error {
    public constructor(public readonly reason: 'frame' | 'profile' | 'precision' | 'budget') { super('Shared preparation ' + reason); }
}
export function sharedFailure(reason: SharedPreparationError['reason']): never { throw noteOwnedPreparationFailure(new SharedPreparationError(reason)); }
export interface SharedPoint2D { readonly x:number; readonly y:number; readonly u:number; readonly v:number; readonly r:number; readonly g:number; readonly b:number; readonly a:number; readonly dr:number; readonly dg:number; readonly db:number; }
export type SharedDrawCommand2D = Exclude<SharedRenderCommand2D, { kind: 'barrier' }>;
export interface PreparedSharedDraw2D { readonly kind:'draw'; readonly command:SharedDrawCommand2D; readonly material:SharedMaterial2D; readonly region:SharedRegion2D|undefined; readonly pageIndex:number|undefined; readonly polygons:readonly (readonly SharedPoint2D[])[]; readonly vertexReservation:number; }
export interface PreparedSharedBarrier2D { readonly kind:'barrier'; readonly ordinal:number; readonly occurrenceId:number; }
export type PreparedSharedEntry2D = PreparedSharedDraw2D | PreparedSharedBarrier2D;
/** What one shared frame may hold at most, whatever a Host is configured to admit. */
export const SHARED_FRAME_REGIONS_2D=4096,SHARED_FRAME_PAGE_BYTES_2D=67108864;
/** A Host option may lower the two frame ceilings; an absent one leaves the profile's own. */
export interface SharedPreparationOptions2D extends TexturedPreparationLimits2D { readonly enableEffects?:boolean; readonly pixelRatio:number; readonly maxCommands:number; readonly maxClipRectangles:number; readonly maxFrameGeometryBytes:number; readonly maxFrameRegions?:number; readonly maxFramePageBytes?:number; }
/**
 * `retention` is the Host's kept draws, when the frame was prepared with them, and `retained` names for each
 * entry the kept draw that packing may take its rows from or give them to.
 */
export interface PreparedSharedFrame2D { readonly effects:PreparedEffects2D; readonly frame:SharedRenderFrame2D; readonly width:number; readonly height:number; readonly entries:readonly PreparedSharedEntry2D[]; readonly budget:TexturedPreparationBudget2D; readonly geometryBytes:number; readonly pageBytes:number; readonly upload:number;
    readonly retention?:SharedPreparationRetention2D; readonly retained?:readonly (RetainedSharedDraw2D|undefined)[]; }
const ATTRS = ['u','v','r','g','b','a','dr','dg','db'] as const;
function unit(value:number):number { if(!Number.isFinite(value)||value<0||value>1) sharedFailure('precision'); return value===0?0:value; }
function uv(value:number):number { if(!Number.isFinite(value))sharedFailure('precision'); return value===0?0:value; }
function add(used:number,value:number,limit:number):number { if(!Number.isSafeInteger(value)||value<0||value>limit-used)sharedFailure('budget');return used+value; }
/** Address qualification follows f32 preparation and never clamps/modulos authored vertices. */
export function qualifySharedUV(point:SharedPoint2D, draw:Pick<PreparedSharedDraw2D,'region'|'material'|'pageIndex'>, frame:SharedRenderFrame2D):void {
    if(draw.pageIndex===undefined)return;
    const region=draw.region!, page=frame.pages[draw.pageIndex]!.source, material=draw.material;
    const width=material.samplingDomain==='page'?page.width:region.logicalWidth;
    const height=material.samplingDomain==='page'?page.height:region.logicalHeight;
    const periodic=material.samplingDomain==='page'&&(material.addressU!=='clamp-to-edge'||material.addressV!=='clamp-to-edge');
    const limit=periodic?8192:1048576;
    const u=Math.fround(point.u),v=Math.fround(point.v),x=Math.fround(u*width),y=Math.fround(v*height);
    if(!Number.isFinite(u)||!Number.isFinite(v)||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>limit||Math.abs(y)>limit)sharedFailure('precision');
}
function policyFor(budget:TexturedPreparationBudget2D) {
    const sameXY=(a:SharedPoint2D,b:SharedPoint2D):boolean=>{budget.admitTupleComparison();return a.x===b.x&&a.y===b.y;};
    const sameAttributes=(a:SharedPoint2D,b:SharedPoint2D):boolean=>{budget.admitTupleComparison();
        return a.u===b.u&&a.v===b.v&&a.r===b.r&&a.g===b.g&&a.b===b.b&&a.a===b.a&&a.dr===b.dr&&a.dg===b.dg&&a.db===b.db;};
    const assertAppend=(length:number):void=>{if(!Number.isSafeInteger(length)||length<0||length>=64)sharedFailure('budget');};
    const policy:PolygonClipPolicy2D<SharedPoint2D>={maxCorners:64,before(a,b){budget.admitTupleComparison();return a.x<b.x||(a.x===b.x&&a.y<b.y);},sameTuple(a,b){return sameXY(a,b)&&sameAttributes(a,b);},assertAppend};
    // `owned` marks corners this preparation created itself and nothing else reads: they are checked and
    // made canonical where they are, in the same order, instead of being copied into new objects.
    const finish=(preparation:Preparation,input:readonly SharedPoint2D[],owned:boolean):SharedPoint2D[]=>{
        if(input.length>64)sharedFailure('budget');const result:SharedPoint2D[]=[];
        for(const p of input){let value:SharedPoint2D;
            if(owned){const q=p as OwnedPoint;q.x=coordinate(q.x);q.y=coordinate(q.y);q.u=uv(q.u);q.v=uv(q.v);q.r=unit(q.r);q.g=unit(q.g);q.b=unit(q.b);q.a=unit(q.a);q.dr=unit(q.dr);q.dg=unit(q.dg);q.db=unit(q.db);value=q;}
            else value={x:coordinate(p.x),y:coordinate(p.y),u:uv(p.u),v:uv(p.v),r:unit(p.r),g:unit(p.g),b:unit(p.b),a:unit(p.a),dr:unit(p.dr),dg:unit(p.dg),db:unit(p.db)};
            const previous=result[result.length-1];if(previous&&sameXY(previous,value)){if(!sameAttributes(previous,value))sharedFailure('precision');}else{assertAppend(result.length);result.push(value);}}
        if(result.length>1&&sameXY(result[0]!,result[result.length-1]!)){if(!sameAttributes(result[0]!,result[result.length-1]!))sharedFailure('precision');result.pop();}
        for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(sameXY(result[i]!,result[j]!)){sameAttributes(result[i]!,result[j]!);sharedFailure('precision');}
        return result.length<3?[]:finishPolygonWinding2D(preparation,result);
    };
    const normalize=(preparation:Preparation,input:readonly SharedPoint2D[]):SharedPoint2D[]=>finish(preparation,input,false);
    const normalizeOwned=(preparation:Preparation,input:readonly SharedPoint2D[]):SharedPoint2D[]=>finish(preparation,input,true);
    return {policy,normalize,normalizeOwned};
}
const attach:CrossingAttributes<SharedPoint2D>=(p,q,weight,complementary,x,y)=>{
    const value=(key:typeof ATTRS[number]):number=>{const n=complementary?q[key]+weight*(p[key]-q[key]):p[key]+weight*(q[key]-p[key]);return key==='u'||key==='v'?uv(n):unit(n);};
    return {x:coordinate(x),y:coordinate(y),u:value('u'),v:value('v'),r:value('r'),g:value('g'),b:value('b'),a:value('a'),dr:value('dr'),dg:value('dg'),db:value('db')};
};
type OwnedPoint={-readonly [K in keyof SharedPoint2D]:SharedPoint2D[K]};
/** Moves an authored corner this preparation owns to backing space; both coordinates are read before either is written. */
function transform(p:OwnedPoint,m:Matrix2D,ratio:number):void {
    const x=coordinate(coordinate(coordinate(m.a*p.x)+coordinate(m.c*p.y))+m.tx);
    const y=coordinate(coordinate(coordinate(m.b*p.x)+coordinate(m.d*p.y))+m.ty);
    const backingX=coordinate(x*ratio);
    p.y=coordinate(y*ratio);p.x=backingX;
}
const ORIGIN:PreparedPoint2D={x:0,y:0};
const NO_CLIPS:readonly (readonly PreparedPoint2D[])[]=[];
/**
 * Authentic completion is checked by Host; this helper still defends all table references. With `retention`,
 * a draw whose every input is the same as in the last frame takes the geometry kept for it, once the charges
 * recorded with that geometry fit what is left of the budget; any other draw is prepared here and kept.
 * The frame's tables, every command's own numbers and every frame-wide charge are checked for every frame.
 */
export function prepareSharedDraws2D(frame:SharedRenderFrame2D,width:number,height:number,options:SharedPreparationOptions2D,retention?:SharedPreparationRetention2D):PreparedSharedFrame2D {
    if(frame.profile!=='egret.shared-frame2d/1'||frame.colorRecipe!=='egret.linear-srgb-pma/1'||frame.targetRepresentation!=='egret.srgb-pma8-target/1')sharedFailure('profile');
    if(frame.commands.length>options.maxCommands||frame.commands.length>65536||frame.pages.length>64||frame.regions.length>Math.min(SHARED_FRAME_REGIONS_2D,options.maxFrameRegions??SHARED_FRAME_REGIONS_2D)||frame.materials.length>256||frame.geometries.length>128)sharedFailure('budget');
    const pageLimit=Math.min(SHARED_FRAME_PAGE_BYTES_2D,options.maxFramePageBytes??SHARED_FRAME_PAGE_BYTES_2D);
    const effects=prepareEffects2D(frame,options.pixelRatio,options.enableEffects===true);
    const budget=new TexturedPreparationBudget2D(options);let geometryBytes=0,pageBytes=0,clipsCount=0;
    for(const command of frame.commands)if(command.kind==='barrier'&&command.effect)clipsCount=add(clipsCount,command.effect.clips.length,options.maxClipRectangles);
    for(const page of frame.pages){if(!isImageData2D(page.source)||page.sourceRepresentation!=='egret.srgb-straight-rgba8/1'||page.canonicalRepresentation!=='egret.alpha8-capped-srgb-pma8/1')sharedFailure('frame');pageBytes=add(pageBytes,page.source.byteLength,pageLimit);}
    for(const material of frame.materials){if(!isSharedMaterial2D(material))sharedFailure('frame');if(material.blend==='add-preserve'&&frame.outputAlpha!=='opaque')sharedFailure('profile');}
    for(const geometry of frame.geometries){if(!isTexturedGeometry2D(geometry)&&!isSharedGeometry2D(geometry))sharedFailure('frame');geometryBytes=add(geometryBytes,geometry.logicalByteLength,options.maxFrameGeometryBytes);}
    for(const region of frame.regions){const page=frame.pages[region.pageIndex]?.source,p=region.packed;
        if(!Number.isSafeInteger(region.pageIndex)||!page||![p.x,p.y,p.width,p.height,region.logicalWidth,region.logicalHeight,region.trimX,region.trimY,region.quarterTurn].every(Number.isSafeInteger)
            ||p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>page.width||p.y+p.height>page.height||region.logicalWidth<=0||region.logicalHeight<=0||region.logicalWidth>1048576||region.logicalHeight>1048576||region.trimX<0||region.trimY<0||region.quarterTurn<0||region.quarterTurn>3)sharedFailure('frame');
        const odd=region.quarterTurn===1||region.quarterTurn===3;
        if(region.trimX+(odd?p.height:p.width)>region.logicalWidth||region.trimY+(odd?p.width:p.height)>region.logicalHeight)sharedFailure('frame');}
    for(let i=0;i<frame.commands.length;i++){const command=frame.commands[i]!;if(command.ordinal!==i||!Number.isSafeInteger(command.occurrenceId)||command.occurrenceId<0)sharedFailure('frame');if(command.kind==='barrier')continue;
        if(!frame.materials[command.materialIndex])sharedFailure('frame');clipsCount=add(clipsCount,command.clips.length,options.maxClipRectangles);
        if(command.kind!=='rect'&&!frame.regions[command.regionIndex])sharedFailure('frame');
        if(command.kind==='mesh'){const geometry=frame.geometries[command.geometryIndex];if(!geometry)sharedFailure('frame');budget.admitSourceTriangles(geometry.triangleCount);}}
    const entries:PreparedSharedEntry2D[]=[];let upload=0;
    const retained:(RetainedSharedDraw2D|undefined)[]|undefined=retention?[]:undefined;
    retention?.begin(frame.commands.length,width,height,options.pixelRatio,options);
    // One clip policy and one predicate ledger serve every command; the ledger's per-command count restarts at each draw.
    // The inactive context only states that every polygon handed to clipping is owned by this call, so a
    // step that leaves a polygon unchanged returns it instead of a copy. No clip rectangle is cached.
    const owned:ClipRectanglePreparationContext2D={options,budget,active:false,entries:undefined};
    const {policy,normalize,normalizeOwned}=policyFor(budget),preparation=new Preparation(options,budget,true,owned);
    const axisX={x:0,y:0},axisY={x:0,y:0};let lastColor=-1,red=0,green=0,blue=0;
    let viewport:PreparedPoint2D[]|undefined,ratio=0;
    // The state of the command being prepared, read by `accept` below.
    let command:SharedDrawCommand2D,m:Matrix2D,clips:readonly (readonly PreparedPoint2D[])[]=NO_CLIPS,polygons:SharedPoint2D[][]=[],vertexReservation=0;
    let descriptor:{region:SharedRegion2D|undefined;material:SharedMaterial2D;pageIndex:number|undefined};
    // Both SHARED Hosts authenticate the frame before this private helper owns its budget.
    // Shared polygons retain attributed corners and charge the same XY comparisons as TEXTURED meshes.
    const intersect=(polygon:SharedPoint2D[],clip:readonly PreparedPoint2D[]):SharedPoint2D[]=>
        preparation.tryContainedClip(polygon,clip,'mesh')??clipPolygon2D(preparation,polygon,clip,normalize,attach,policy,'mesh');
    // `points` are fresh authored corners; they become the backing-space corners in place.
    const accept=(points:OwnedPoint[]):void=>{
        for(const p of points)qualifySharedUV(p,descriptor,frame);
        const authored=preparation.sign(points[0]!,points[1]!,points[2]!);if(authored===0)return;
        axisX.x=m.a;axisX.y=m.b;axisY.x=m.c;axisY.y=m.d;
        const rank=preparation.sign(ORIGIN,axisX,axisY);if(rank===0)return;
        for(const p of points)transform(p,m,ratio);
        const sign=preparation.sign(points[0]!,points[1]!,points[2]!);if(sign===0)return;if(sign!==authored*rank)sharedFailure('precision');
        let polygon=normalizeOwned(preparation,points);for(const clip of clips)polygon=intersect(polygon,clip);
        polygon=intersect(polygon,viewport!);
        for(const p of polygon)qualifySharedUV(p,descriptor,frame);
        if(polygon.length<3||command.opacity===0)return;const count=(polygon.length-2)*3;budget.admitPreparedVertices(count);vertexReservation+=count;polygons.push(polygon);
    };
    try{
    for(const entry of frame.commands){if(entry.kind==='barrier'){entries.push({kind:'barrier',ordinal:entry.ordinal,occurrenceId:entry.occurrenceId});retained?.push(undefined);continue;}
        command=entry;
        const material=frame.materials[command.materialIndex]!,region=command.kind==='rect'?undefined:frame.regions[command.regionIndex]!,pageIndex=region?.pageIndex;
        preparation.edgeTests=0;m=command.matrix;ratio=coordinate(options.pixelRatio);
        coordinate(m.a);coordinate(m.b);coordinate(m.c);coordinate(m.d);coordinate(m.tx);coordinate(m.ty);unit(command.opacity);
        // A kept draw with these inputs gives its geometry, if its charges fit. Otherwise the draw is prepared below, as without retention.
        const page=pageIndex===undefined?undefined:frame.pages[pageIndex]!.source,geometry=command.kind==='mesh'?frame.geometries[command.geometryIndex]!:undefined;
        const found=retention?.find(command.ordinal,command,material,region,page,geometry);
        if(found!==undefined&&found.polygons!==undefined&&budget.tryReplayStageCost(found.geometryCost!)){
            retention!.carry(command.ordinal,found,command,region);retained!.push(found);
            upload=add(upload,52*found.vertexReservation+128,Number.MAX_SAFE_INTEGER);
            entries.push({kind:'draw',command,material,region,pageIndex,polygons:found.polygons,vertexReservation:found.vertexReservation});
            continue;
        }
        const verticesBefore=budget.preparedVerticesCharged,predicatesBefore=budget.predicatesCharged,tuplesBefore=budget.tupleComparisonsCharged;
        clips=command.clips.length===0?NO_CLIPS:command.clips.map(clip=>preparation.rectangle(clip));
        // The viewport corners are the same for every command; they are checked when the first draw reaches them.
        viewport??=[{x:0,y:0},{x:coordinate(width),y:0},{x:coordinate(width),y:coordinate(height)},{x:0,y:coordinate(height)}];
        polygons=[];vertexReservation=0;descriptor={region,material,pageIndex};
        if(command.kind==='mesh'){
            const g=frame.geometries[command.geometryIndex]!,shared=isSharedGeometry2D(g);
            for(let i=0;i<g.indexCount;i+=3){const points:OwnedPoint[]=[];for(let k=0;k<3;k++){const n=g.indices[i+k]!,p=2*n,c=4*n,d=3*n;
                points.push({x:coordinate(g.positions[p]!),y:coordinate(g.positions[p+1]!),u:uv(g.uvs[p]!),v:uv(g.uvs[p+1]!),r:unit(g.lightColors[c]!),g:unit(g.lightColors[c+1]!),b:unit(g.lightColors[c+2]!),a:unit(g.lightColors[c+3]!),dr:shared?unit(g.darkColors[d]!):0,dg:shared?unit(g.darkColors[d+1]!):0,db:shared?unit(g.darkColors[d+2]!):0});}accept(points);}
        }else{
            const rect=command.rect,right=coordinate(rect.x+rect.width),bottom=coordinate(rect.y+rect.height);
            coordinate(rect.x);coordinate(rect.y);coordinate(rect.width);coordinate(rect.height);
            const color=command.kind==='rect'?command.fillColor:0xffffff,a=command.kind==='rect'?unit(command.fillAlpha):1;
            // Decoding is a pure function of the colour; consecutive draws of one colour decode it once.
            if(color!==lastColor){red=decodeSharedSRGB(((color>>>16)&255)/255);green=decodeSharedSRGB(((color>>>8)&255)/255);blue=decodeSharedSRGB((color&255)/255);lastColor=color;}
            const points:OwnedPoint[]=[];
            for(let corner=0;corner<4;corner++){
                // Corner order: top-left, top-right, bottom-right, bottom-left.
                let u=corner===1||corner===2?1:0,v=corner>=2?1:0;
                if(region&&material.samplingDomain==='page'){
                    const p=region.packed,odd=region.quarterTurn===1||region.quarterTurn===3,w=odd?p.height:p.width,h=odd?p.width:p.height,s=u*w,t=v*h;
                    const x=region.quarterTurn===1?h-t:region.quarterTurn===2?w-s:region.quarterTurn===3?t:s;
                    const y=region.quarterTurn===1?s:region.quarterTurn===2?h-t:region.quarterTurn===3?w-s:t;
                    const page=frame.pages[pageIndex!]!.source;u=(p.x+x)/page.width;v=(p.y+y)/page.height;}
                points.push({x:corner===1||corner===2?right:rect.x,y:corner>=2?bottom:rect.y,u,v,r:red,g:green,b:blue,a,dr:0,dg:0,db:0});
            }
            accept(points);
        }
        upload=add(upload,52*vertexReservation+128,Number.MAX_SAFE_INTEGER);
        entries.push({kind:'draw',command,material,region,pageIndex,polygons,vertexReservation});
        retained?.push(retention!.keep(command.ordinal,found,command,material,region,page,geometry,polygons,vertexReservation,
            budget.preparedVerticesCharged-verticesBefore,budget.predicatesCharged-predicatesBefore,budget.tupleComparisonsCharged-tuplesBefore));
    }
    }catch(cause){retention?.abandon();throw cause;}
    retention?.commit();
    // The region table is uploaded with the frame: 48 bytes for each of its regions.
    return {effects,frame,width,height,entries,budget,geometryBytes,pageBytes,upload:upload+48*frame.regions.length+effects.uniformBytes,...(retention?{retention,retained:retained!}:{})};
}
