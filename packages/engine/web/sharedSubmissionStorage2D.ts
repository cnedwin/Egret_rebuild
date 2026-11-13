import type { PreparedSharedFrame2D } from '../rendering/prepareSharedDraws2D.js';
import { copySharedPagePixels } from '../rendering/sharedColor2D.js';
import type { SharedPageCopyDiagnostics2D } from '../rendering/sharedColor2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import type { ProjectionPlan2D } from './imageProjections2D.js';

/** Private logical limits; native capabilities remain in each concrete wrapper. */
export interface SharedStorageLimits2D {
    readonly maxUploadBytes:number;
    readonly maxPendingUploadBytes:number;
    readonly maxPendingFrames:number;
    readonly maxReadbackBytes:number;
    readonly maxPendingGeometryBytes:number;
    /** Absent in a caller that predates the option: the profile's own 64 MiB. */
    readonly maxFramePageBytes?:number;
}
// Page texture bytes awaiting completion, and conversion memory held at once, are each bounded by
// two frames' worth of pages, as the number of accepted frames is bounded by two.
const pendingPageBytes=(framePageBytes:number|undefined):number=>2*Math.min(67108864,framePageBytes??67108864);
export class SharedStorageError2D extends Error { public constructor(public readonly reason:'budget'|'device'|'backpressure'|'serial'){super('Shared storage '+reason);} }
function fail(reason:SharedStorageError2D['reason']):never {throw noteOwnedPreparationFailure(new SharedStorageError2D(reason));}
export interface SharedOwnerSnapshot2D { readonly pendingFrames:number; readonly pendingUploadBytes:number; readonly pendingReadbackBytes:number; readonly pendingTextureBytes:number; readonly pendingGeometryBytes:number; readonly pendingColorBytes:number; readonly pendingCanonicalBytes:number; readonly serial:number; }
export interface SharedStorageFees2D { readonly prepared:PreparedSharedFrame2D; readonly options:SharedStorageLimits2D; readonly upload:number; readonly colorBytes:number; readonly effectBytes:number; }
/** Concrete amounts authored by the backend after the shared logical fee check. */
export interface SharedReadbackLayout2D { readonly rowPitch:number; readonly staging:number; readonly output:number; }
export interface SharedStoragePlan2D extends SharedStorageFees2D,SharedReadbackLayout2D {}
export interface SharedSubmissionStorage2D extends SharedStoragePlan2D { readonly projectionPlan:ProjectionPlan2D; }

/** Joint logical fees precede readback layout, native limits, pending checks and payloads. */
export function planSharedStorageFees2D(prepared:PreparedSharedFrame2D,options:SharedStorageLimits2D):SharedStorageFees2D {
    const {width,height}=prepared,colorBytes=4*width*height,effectBytes=colorBytes*prepared.effects.targetCount,upload=prepared.upload;
    if(!Number.isSafeInteger(colorBytes)||colorBytes+effectBytes>67108864||!Number.isSafeInteger(upload)||upload>options.maxUploadBytes)fail('budget');
    return {prepared,options,upload,colorBytes,effectBytes};
}
/** No allocator or callback is accepted; the caller supplies its already computed layout. */
export function withSharedReadbackLayout2D(fees:SharedStorageFees2D,layout:SharedReadbackLayout2D):SharedStoragePlan2D {
    const {rowPitch,staging,output}=layout;
    if(!Number.isSafeInteger(staging)||staging+output>fees.options.maxReadbackBytes)fail('budget');
    return {...fees,rowPitch,staging,output};
}
export function checkSharedCapacity2D(storage:SharedStoragePlan2D,owner:SharedOwnerSnapshot2D,canonicalBytes=0,sourceCopy=0):void {
    const {options,prepared}=storage;
    const check=(used:number,amount:number,limit:number):void=>{if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(amount)||amount<0||amount>limit-used)fail('backpressure');};
    check(owner.pendingFrames,1,options.maxPendingFrames);check(owner.pendingUploadBytes,storage.upload,options.maxPendingUploadBytes);
    check(owner.pendingReadbackBytes,storage.staging+storage.output,options.maxReadbackBytes);const pagesAtOnce=pendingPageBytes(options.maxFramePageBytes);check(owner.pendingTextureBytes,prepared.pageBytes,pagesAtOnce);
    check(owner.pendingGeometryBytes,prepared.geometryBytes,options.maxPendingGeometryBytes);check(owner.pendingColorBytes,storage.colorBytes+storage.effectBytes,134217728);
    if(canonicalBytes+sourceCopy>pagesAtOnce)fail('budget');check(owner.pendingCanonicalBytes,canonicalBytes+sourceCopy,pagesAtOnce);
    if(!Number.isSafeInteger(owner.serial)||owner.serial<0||owner.serial>=Number.MAX_SAFE_INTEGER)fail('serial');
}
/** Only current READY identities authorize omitted whole-page copies. */
export function materializeSharedPages2D(storage:SharedSubmissionStorage2D,cold:ReadonlySet<number>,owner:SharedOwnerSnapshot2D,diagnostics?:SharedPageCopyDiagnostics2D):{projections:(Uint8Array<ArrayBuffer>|undefined)[];canonicalBytes:number} {
    let canonicalBytes=0,sourceCopy=0;
    for(const index of cold){const bytes=storage.projectionPlan.views[index]!.byteLength;canonicalBytes+=bytes;sourceCopy=Math.max(sourceCopy,bytes);}
    checkSharedCapacity2D(storage,owner,canonicalBytes,sourceCopy);
    const before=diagnostics?.canonicalBytes;
    try {
        const projections=storage.projectionPlan.views.map((view,index)=>cold.has(index)?copySharedPagePixels(view.image,diagnostics):undefined);
        return {projections,canonicalBytes};
    } catch(cause) {
        // No returned projection array owns the earlier completed copies on this exit.
        if(diagnostics)diagnostics.canonicalBytes=before!;
        throw cause;
    }
}
