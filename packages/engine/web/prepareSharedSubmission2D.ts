import type { PreparedSharedFrame2D } from '../rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../rendering/packSharedDraws2D.js';
import { copySharedPagePixels } from '../rendering/sharedColor2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import type { ProjectionPlan2D } from './imageProjections2D.js';
import type { SharedWebGPUConfiguration } from './sharedWebGPUOptions.js';
export class SharedStorageError2D extends Error { public constructor(public readonly reason:'budget'|'device'|'backpressure'|'serial'){super('Shared storage '+reason);} }
function fail(reason:SharedStorageError2D['reason']):never {throw noteOwnedPreparationFailure(new SharedStorageError2D(reason));}
export interface SharedOwnerSnapshot2D { readonly pendingFrames:number; readonly pendingUploadBytes:number; readonly pendingReadbackBytes:number; readonly pendingTextureBytes:number; readonly pendingGeometryBytes:number; readonly pendingColorBytes:number; readonly pendingCanonicalBytes:number; readonly pendingSceneBytes:number; readonly pendingUniformBytes:number; readonly pendingDepthBytes:number; readonly serial:number; }
export interface SharedSceneStorage2D { readonly sceneBytes:number; readonly uniformBytes:number; readonly depthBytes:number; }
export interface SharedSubmissionStorage2D { readonly prepared:PreparedSharedFrame2D; readonly options:SharedWebGPUConfiguration; readonly projectionPlan:ProjectionPlan2D; readonly upload:number; readonly colorBytes:number; readonly rowPitch:number; readonly staging:number; readonly output:number; readonly scene:SharedSceneStorage2D|undefined; }
export function checkSharedCapacity2D(storage:SharedSubmissionStorage2D,owner:SharedOwnerSnapshot2D,canonicalBytes=0,sourceCopy=0):void {
    const {options,prepared,scene}=storage;
    const check=(used:number,amount:number,limit:number):void=>{if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(amount)||amount<0||amount>limit-used)fail('backpressure');};
    check(owner.pendingFrames,1,options.maxPendingFrames);check(owner.pendingUploadBytes,storage.upload,options.maxPendingUploadBytes);
    check(owner.pendingReadbackBytes,storage.staging+storage.output,options.maxReadbackBytes);check(owner.pendingTextureBytes,prepared.pageBytes,33554432);
    check(owner.pendingGeometryBytes,prepared.geometryBytes,options.maxPendingGeometryBytes);check(owner.pendingColorBytes,storage.colorBytes,134217728);
    if(canonicalBytes+sourceCopy>33554432)fail('budget');check(owner.pendingCanonicalBytes,canonicalBytes+sourceCopy,33554432);
    if(scene){check(owner.pendingSceneBytes,scene.sceneBytes,8388608);check(owner.pendingUniformBytes,scene.uniformBytes,8192);check(owner.pendingDepthBytes,scene.depthBytes,33554432);}
    if(!Number.isSafeInteger(owner.serial)||owner.serial<0||owner.serial>=Number.MAX_SAFE_INTEGER)fail('serial');
}
/** Full logical and device admission precedes every required payload allocation. */
export function planSharedSubmission2D(prepared:PreparedSharedFrame2D,options:SharedWebGPUConfiguration,hardware:{maxTextureDimension2D:number;maxBufferSize:number;sceneBufferBytes?:readonly number[]},owner:SharedOwnerSnapshot2D,readback:boolean,scene?:SharedSceneStorage2D):SharedSubmissionStorage2D {
    const {width,height}=prepared,colorBytes=4*width*height,upload=prepared.upload+(scene?scene.sceneBytes+scene.uniformBytes:0);
    if(!Number.isSafeInteger(colorBytes)||colorBytes>67108864||!Number.isSafeInteger(upload)||upload>options.maxUploadBytes)fail('budget');
    if(scene&&(scene.sceneBytes>4194304||scene.uniformBytes>4096||scene.depthBytes>16777216))fail('budget');
    const rowPitch=readback?Math.ceil(4*width/256)*256:0,staging=rowPitch*height,output=readback?colorBytes:0;
    if(!Number.isSafeInteger(staging)||staging+output>options.maxReadbackBytes)fail('budget');
    if(width>hardware.maxTextureDimension2D||height>hardware.maxTextureDimension2D||staging>hardware.maxBufferSize)fail('device');
    for(const bytes of hardware.sceneBufferBytes??[])if(bytes>hardware.maxBufferSize)fail('device');
    for(const draw of prepared.entries)if(draw.kind==='draw'&&(44*draw.vertexReservation>hardware.maxBufferSize||128>hardware.maxBufferSize))fail('device');
    const views=prepared.frame.pages.map(page=>{const image=page.source;if(image.width>hardware.maxTextureDimension2D||image.height>hardware.maxTextureDimension2D)fail('device');return {image,region:{x:0,y:0,width:image.width,height:image.height},byteLength:image.byteLength};});
    const projectionPlan:ProjectionPlan2D={views,commandViews:[],projectionBytes:prepared.pageBytes,scratchBytes:0};
    const storage={prepared,options,projectionPlan,upload,colorBytes,rowPitch,staging,output,scene};checkSharedCapacity2D(storage,owner);return storage;
}
export const packSharedSubmission2D=packSharedDraws2D;
/** Only current READY identities authorize omitted whole-page copies. */
export function materializeSharedPages2D(storage:SharedSubmissionStorage2D,cold:ReadonlySet<number>,owner:SharedOwnerSnapshot2D):{projections:(Uint8Array<ArrayBuffer>|undefined)[];canonicalBytes:number} {
    let canonicalBytes=0,sourceCopy=0;
    for(const index of cold){const bytes=storage.projectionPlan.views[index]!.byteLength;canonicalBytes+=bytes;sourceCopy=Math.max(sourceCopy,bytes);}
    checkSharedCapacity2D(storage,owner,canonicalBytes,sourceCopy);
    const projections=storage.projectionPlan.views.map((view,index)=>cold.has(index)?copySharedPagePixels(view.image):undefined);
    return {projections,canonicalBytes};
}
