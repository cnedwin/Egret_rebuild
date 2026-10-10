import { IMAGE_LIMITS_2D } from '@egret/contracts';
import type { TexturedRenderFrame2D } from '@egret/contracts';
import type { TexturedFrameAdmission2D, PreparedTexturedDraw2D } from '../rendering/prepareTexturedDraws2D.js';
import type { TexturedPreparationBudget2D } from '../rendering/texturedPreparationBudget2D.js';
import { packImageVertices2D } from '../rendering/packImageVertices2D.js';
import type { PackedImage2D } from '../rendering/packImageVertices2D.js';
import { packTexturedMesh2D } from '../rendering/packTexturedMesh2D.js';
import type { PackedTexturedMesh2D } from '../rendering/packTexturedMesh2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import { packWebGPUVertices } from './webgpuPass.js';
import { copyProjectionPixels } from './imageProjections2D.js';
import type { ProjectionPlan2D, ProjectionView2D } from './imageProjections2D.js';

type PackedRectangles2D = ReturnType<typeof packWebGPUVertices>;
export interface TexturedSubmissionStorageOptions2D {
    readonly maxUploadBytes: number; readonly maxPendingUploadBytes: number;
    readonly maxPendingFrames: number; readonly maxReadbackBytes: number;
    readonly maxPendingGeometryBytes: number;
}
export interface TexturedSubmissionHardware2D { readonly maxBufferSize: number; readonly maxTextureDimension2D: number; }
export interface TexturedSubmissionOwnerSnapshot2D {
    readonly pendingFrames: number; readonly pendingUploadBytes: number; readonly pendingReadbackBytes: number;
    readonly pendingTextureBytes: number; readonly pendingGeometryBytes: number; readonly serial: number;
}
export interface TexturedSubmissionRequest2D {
    readonly admitted: TexturedFrameAdmission2D; readonly draws: readonly PreparedTexturedDraw2D[];
    readonly projectionPlan: ProjectionPlan2D; readonly options: TexturedSubmissionStorageOptions2D;
    readonly hardware: TexturedSubmissionHardware2D; readonly owner: TexturedSubmissionOwnerSnapshot2D; readonly readback: boolean;
}
export interface TexturedDrawStorage2D { readonly vertexBytes: number; readonly uniformBytes: 0 | 16; }
export interface TexturedSubmissionStorage2D {
    readonly request: TexturedSubmissionRequest2D; readonly frame: TexturedRenderFrame2D;
    readonly width: number; readonly height: number; readonly upload: number; readonly geometryBytes: number;
    readonly drawStorage: readonly TexturedDrawStorage2D[]; readonly rowPitch: number; readonly staging: number; readonly output: number;
}
export type PackedTexturedDraw2D =
    { readonly kind: 'rect'; readonly packed: PackedRectangles2D } |
    { readonly kind: 'image'; readonly packed: PackedImage2D; readonly viewIndex: number; readonly alpha: number; uniform: Float32Array<ArrayBuffer> | undefined } |
    { readonly kind: 'mesh'; readonly packed: PackedTexturedMesh2D; readonly viewIndex: number; readonly alpha: number; uniform: Float32Array<ArrayBuffer> | undefined };
export interface TexturedSubmissionPlan2D {
    readonly frame: TexturedRenderFrame2D; readonly width: number; readonly height: number;
    readonly draws: PackedTexturedDraw2D[]; readonly upload: number; readonly geometryBytes: number;
    readonly projectionPlan: ProjectionPlan2D; readonly projections: Uint8Array<ArrayBuffer>[];
    readonly rowPitch: number; readonly staging: number; readonly output: number; readonly ticket: undefined; readonly scene: undefined;
}
/** This seam is private. The real host always selects the captured first-party table. */
export interface TexturedPayloadOperations2D {
    pack(draw: PreparedTexturedDraw2D, width: number, height: number, admittedVertexBytes: number,
        budget: TexturedPreparationBudget2D): PackedRectangles2D | PackedImage2D | PackedTexturedMesh2D;
    copy(view: ProjectionView2D): Uint8Array<ArrayBuffer>;
    uniform(alpha: number): Float32Array<ArrayBuffer>;
}
class TexturedSubmissionAdmissionError2D extends Error {
    public constructor(public readonly reason: 'budget' | 'device' | 'backpressure' | 'serial',
        public readonly facet: 'upload' | 'buffer' | 'texture' | 'readback' | 'frames' | 'geometry' | 'serial') { super(`Textured submission ${reason}: ${facet}`); }
}
const refusals = new WeakSet<object>();
function fail(reason: TexturedSubmissionAdmissionError2D['reason'], facet: TexturedSubmissionAdmissionError2D['facet']): never {
    const failure = noteOwnedPreparationFailure(new TexturedSubmissionAdmissionError2D(reason, facet));
    refusals.add(failure); throw failure;
}
/** Module creation alone is insufficient: public mapping also checks the current scope object. */
export function isTexturedSubmissionAdmissionError2D(error: unknown): error is TexturedSubmissionAdmissionError2D {
    return typeof error === 'object' && error !== null && refusals.has(error);
}
function nonnegative(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function fan(corners: number): number {
    if (!nonnegative(corners) || corners > Math.floor(Number.MAX_SAFE_INTEGER / 3) + 2) fail('budget', 'upload');
    return corners < 3 ? 0 : 3 * (corners - 2);
}
function capacities(storage: TexturedSubmissionStorage2D, owner: TexturedSubmissionOwnerSnapshot2D): void {
    const { options, projectionPlan } = storage.request;
    const check = (current: number, charge: number, limit: number, facet: TexturedSubmissionAdmissionError2D['facet']): void => {
        if (!nonnegative(current) || !nonnegative(charge) || charge > limit - current) fail('backpressure', facet);
    };
    check(owner.pendingFrames, 1, options.maxPendingFrames, 'frames');
    check(owner.pendingUploadBytes, storage.upload, options.maxPendingUploadBytes, 'upload');
    check(owner.pendingReadbackBytes, storage.staging + storage.output, options.maxReadbackBytes, 'readback');
    check(owner.pendingTextureBytes, projectionPlan.projectionBytes, IMAGE_LIMITS_2D.maxPendingTextureBytes, 'texture');
    check(owner.pendingGeometryBytes, storage.geometryBytes, options.maxPendingGeometryBytes, 'geometry');
    if (!nonnegative(owner.serial) || owner.serial >= Number.MAX_SAFE_INTEGER) fail('serial', 'serial');
}

/** Reserve whole upper bounds before packing, copying, uniform creation or owner mutation. */
export function planTexturedSubmissionStorage2D(request: TexturedSubmissionRequest2D): TexturedSubmissionStorage2D {
    const { admitted, draws, options, hardware, projectionPlan } = request;
    const { frame, width, height } = admitted;
    let upload = 0;
    const drawStorage: TexturedDrawStorage2D[] = [];
    for (const draw of draws) {
        let vertices = 0;
        if (draw.kind === 'rect') {
            for (const command of draw.prepared.commands) {
                const count = fan(command.pointIndices.length);
                if (count > Number.MAX_SAFE_INTEGER - vertices) fail('budget', 'upload');
                vertices += count;
            }
        } else if (draw.kind === 'image') vertices = fan(draw.prepared.pointIndices.length);
        else vertices = draw.prepared.preparedVerticesCharged;
        const stride = draw.kind === 'rect' ? 24 : draw.kind === 'image' ? 16 : 32;
        if (!nonnegative(vertices) || vertices > Math.floor(Number.MAX_SAFE_INTEGER / stride)) fail('budget', 'upload');
        const vertexBytes = vertices * stride, uniformBytes = draw.kind !== 'rect' && vertices > 0 ? 16 : 0;
        if (vertexBytes > options.maxUploadBytes - upload) fail('budget', 'upload');
        upload += vertexBytes;
        if (uniformBytes > options.maxUploadBytes - upload) fail('budget', 'upload');
        upload += uniformBytes;
        drawStorage.push({ vertexBytes, uniformBytes });
    }
    // Configuration has priority over every hardware predicate across all draws.
    for (const draw of drawStorage) {
        if (draw.vertexBytes > hardware.maxBufferSize) fail('device', 'buffer');
        if (draw.uniformBytes > hardware.maxBufferSize) fail('device', 'buffer');
    }
    if (width > hardware.maxTextureDimension2D || height > hardware.maxTextureDimension2D) fail('device', 'texture');
    for (const view of projectionPlan.views) {
        if (view.region.width > hardware.maxTextureDimension2D || view.region.height > hardware.maxTextureDimension2D) fail('device', 'texture');
    }
    let rowPitch = 0, staging = 0, output = 0;
    if (request.readback) {
        if (!nonnegative(width) || width > Math.floor(Number.MAX_SAFE_INTEGER / 4)) fail('budget', 'readback');
        const rows = Math.ceil(4 * width / 256);
        if (rows > Math.floor(Number.MAX_SAFE_INTEGER / 256)) fail('budget', 'readback');
        rowPitch = rows * 256;
        if (!nonnegative(height) || height > Math.floor(Number.MAX_SAFE_INTEGER / rowPitch) ||
            height > Math.floor(Number.MAX_SAFE_INTEGER / (4 * width))) fail('budget', 'readback');
        staging = rowPitch * height; output = 4 * width * height;
        if (staging > options.maxReadbackBytes || output > options.maxReadbackBytes - staging) fail('budget', 'readback');
        if (staging > hardware.maxBufferSize) fail('device', 'readback');
    }
    const storage: TexturedSubmissionStorage2D = { request, frame, width, height, upload,
        geometryBytes: admitted.uniqueGeometryBytes, drawStorage, rowPitch, staging, output };
    capacities(storage, request.owner);
    return storage;
}
const FIRST_PARTY_OPERATIONS: TexturedPayloadOperations2D = Object.freeze({
    pack(draw: PreparedTexturedDraw2D, width: number, height: number, bytes: number, budget: TexturedPreparationBudget2D) {
        if (draw.kind === 'rect') return packWebGPUVertices(draw.prepared, width, height, { maxUploadBytes: bytes, maxBufferSize: bytes }, budget);
        if (draw.kind === 'image') return packImageVertices2D(draw.prepared, width, height, bytes, budget);
        return packTexturedMesh2D(draw.prepared, width, height, bytes, budget);
    },
    copy: (view: ProjectionView2D) => copyProjectionPixels(view, 'premultiplied'),
    uniform: (alpha: number) => new Float32Array([alpha, 0, 0, 0]),
});

/** Allocate only after whole admission, then recheck the sole owner's fresh state. */
export function prepareTexturedSubmission2D(request: TexturedSubmissionRequest2D, budget: TexturedPreparationBudget2D,
    readOwner: () => TexturedSubmissionOwnerSnapshot2D, operations: TexturedPayloadOperations2D = FIRST_PARTY_OPERATIONS): TexturedSubmissionPlan2D {
    const storage = planTexturedSubmissionStorage2D(request);
    const draws: PackedTexturedDraw2D[] = [];
    for (let i = 0; i < request.draws.length; i++) {
        const draw = request.draws[i]!, bytes = storage.drawStorage[i]!.vertexBytes;
        const packed = operations.pack(draw, storage.width, storage.height, bytes, budget);
        if (draw.kind === 'rect') draws.push({ kind: 'rect', packed: packed as PackedRectangles2D });
        else {
            const record = request.admitted.commands[draw.commandIndex]!, viewIndex = request.projectionPlan.commandViews[draw.commandIndex]!;
            // Only type erasure joins the three packers; no caller data chooses this dispatch.
            if (draw.kind === 'image') draws.push({ kind: 'image', packed: packed as PackedImage2D, viewIndex, alpha: record.command.alpha, uniform: undefined });
            else draws.push({ kind: 'mesh', packed: packed as PackedTexturedMesh2D, viewIndex, alpha: record.command.alpha, uniform: undefined });
        }
    }
    const projections: Uint8Array<ArrayBuffer>[] = [];
    for (const view of request.projectionPlan.views) projections.push(operations.copy(view));
    for (const draw of draws) if (draw.kind !== 'rect' && draw.packed.vertexCount > 0) draw.uniform = operations.uniform(draw.alpha);
    // No serial, reservation or ticket changes occur in this helper.
    capacities(storage, readOwner());
    return { frame: storage.frame, width: storage.width, height: storage.height, draws, upload: storage.upload,
        geometryBytes: storage.geometryBytes, projectionPlan: request.projectionPlan, projections,
        rowPitch: storage.rowPitch, staging: storage.staging, output: storage.output, ticket: undefined, scene: undefined };
}
