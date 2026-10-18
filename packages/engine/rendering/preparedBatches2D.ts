import type { ClipRectangle2D, Rectangle2D } from '@egret/contracts';
import type { PackedImage2D } from './packImageVertices2D.js';
import type { PackedTexturedMesh2D } from './packTexturedMesh2D.js';

interface PackedRectangles2D {
    readonly data: Float32Array<ArrayBuffer>;
    readonly ranges: readonly { firstVertex: number; vertexCount: number }[];
    readonly collapsedTriangles: number;
    readonly maxBackingDisplacement: number;
}
/** Provenance belongs to this admitted frame, never to a cross-frame index. */
export type PreparedBatchDraw2D =
    { readonly kind: 'rect'; readonly packed: PackedRectangles2D;
      readonly rangeClips?: readonly (readonly ClipRectangle2D[])[]; readonly rangeCommands?: readonly number[] } |
    { readonly kind: 'image'; readonly packed: PackedImage2D; readonly viewIndex: number; readonly alpha: number;
      readonly clips?: readonly ClipRectangle2D[]; readonly crop?: Rectangle2D; uniform: Float32Array<ArrayBuffer> | undefined } |
    { readonly kind: 'mesh'; readonly packed: PackedTexturedMesh2D; readonly viewIndex: number; readonly alpha: number;
      readonly clips?: readonly ClipRectangle2D[]; readonly crop?: Rectangle2D; uniform: Float32Array<ArrayBuffer> | undefined };

export interface PreparedBatchPlan2D {
    readonly draws: PreparedBatchDraw2D[];
    logicalDraws: readonly PreparedBatchDraw2D[] | undefined;
    readonly logicalSpans: { first: number; count: number }[];
    bytes: number;
    transferred: boolean;
    released: boolean;
}
/** Both immutable-frame paths share this one optional-concat owner. */
export interface PreparedBatchScratchPlan2D { readonly draws:unknown[]; logicalDraws:readonly unknown[]|undefined; readonly logicalSpans:unknown[]; bytes:number; released:boolean; }
const SCRATCH_LIMIT = 8388608;
/** CPU concat ownership only. The Host retains the original GPU retirement proof. */
export class PreparedBatchScratch2D {
    private retained = 0;
    public available(): number { return SCRATCH_LIMIT - this.retained; }
    public reserve(plan: PreparedBatchScratchPlan2D, bytes: number): boolean {
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.available()) return false;
        this.retained += bytes; plan.bytes += bytes; return true;
    }
    public refund(plan: PreparedBatchScratchPlan2D, bytes: number): void { this.retained -= bytes; plan.bytes -= bytes; }
    public release(plan: PreparedBatchScratchPlan2D): void {
        if (plan.released) return;
        plan.released = true; this.retained -= plan.bytes; plan.bytes = 0;
        plan.logicalDraws = undefined; plan.draws.length = 0; plan.logicalSpans.length = 0;
    }
}
function sameClips(a: readonly ClipRectangle2D[] | undefined, b: readonly ClipRectangle2D[] | undefined): boolean {
    if (a === undefined || b === undefined || a.length !== b.length) return false;
    if (a === b) return true;
    for (let i = 0; i < a.length; i++) {
        const left = a[i]!, right = b[i]!;
        if (!Object.is(left.matrix.a, right.matrix.a) || !Object.is(left.matrix.b, right.matrix.b)
            || !Object.is(left.matrix.c, right.matrix.c) || !Object.is(left.matrix.d, right.matrix.d)
            || !Object.is(left.matrix.tx, right.matrix.tx) || !Object.is(left.matrix.ty, right.matrix.ty)
            || !Object.is(left.rect.x, right.rect.x) || !Object.is(left.rect.y, right.rect.y)
            || !Object.is(left.rect.width, right.rect.width) || !Object.is(left.rect.height, right.rect.height)) return false;
    }
    return true;
}
type SampledDraw = Extract<PreparedBatchDraw2D, { kind: 'image' | 'mesh' }>;
function compatible(a: SampledDraw, b: PreparedBatchDraw2D): b is SampledDraw {
    return b.kind === a.kind && b.packed.vertexCount > 0 && b.viewIndex === a.viewIndex
        && a.crop !== undefined && b.crop !== undefined
        && Object.is(a.crop.x, b.crop.x) && Object.is(a.crop.y, b.crop.y)
        && Object.is(a.crop.width, b.crop.width) && Object.is(a.crop.height, b.crop.height)
        && Object.is(b.alpha, a.alpha) && sameClips(a.clips, b.clips);
}
function mergeRectangleRanges(draw: Extract<PreparedBatchDraw2D, { kind: 'rect' }>): PreparedBatchDraw2D {
    const { ranges } = draw.packed, clips = draw.rangeClips, commands = draw.rangeCommands;
    if (ranges.length < 2 || clips?.length !== ranges.length || commands?.length !== ranges.length) return draw;
    const merged: { firstVertex: number; vertexCount: number }[] = [];
    let previous = -1;
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i]!, last = merged[merged.length - 1];
        if (last && range.firstVertex === last.firstVertex + last.vertexCount && commands[i] === commands[previous]! + 1
            && sameClips(clips[previous], clips[i])) last.vertexCount += range.vertexCount;
        else merged.push({ firstVertex: range.firstVertex, vertexCount: range.vertexCount });
        previous = i;
    }
    return merged.length === ranges.length ? draw : { ...draw, packed: { ...draw.packed, ranges: merged } };
}
/** Logical admission and every original payload allocation must finish before this call. */
export function prepareAdjacentBatches2D(input: readonly PreparedBatchDraw2D[], maxBufferSize: number,
    scratch: PreparedBatchScratch2D): PreparedBatchPlan2D {
    const plan: PreparedBatchPlan2D = { draws: [], logicalDraws: input, logicalSpans: [], bytes: 0, transferred: false, released: false };
    try {
        for (let start = 0; start < input.length;) {
            const first = input[start]!;
            if (first.kind === 'rect') { plan.draws.push(mergeRectangleRanges(first)); plan.logicalSpans.push({ first: start, count: 1 }); start++; continue; }
            if (first.packed.vertexCount === 0) { plan.draws.push(first); plan.logicalSpans.push({ first: start, count: 1 }); start++; continue; }
            let end = start + 1, bytes = first.packed.data.byteLength;
            const ceiling = Math.min(maxBufferSize, scratch.available());
            while (end < input.length) {
                const next = input[end]!;
                if (!compatible(first, next) || next.packed.data.byteLength > ceiling - bytes) break;
                bytes += next.packed.data.byteLength; end++;
            }
            if (end === start + 1 || !scratch.reserve(plan, bytes)) { plan.draws.push(first); plan.logicalSpans.push({ first: start, count: 1 }); start++; continue; }
            let data: Float32Array<ArrayBuffer> | undefined;
            // Only optional concat allocation/copy can fall back. Original packing,
            // uniform allocation, native calls and their errors remain outside.
            try {
                data = new Float32Array(bytes / 4);
                let offset = 0;
                for (let i = start; i < end; i++) {
                    const source = input[i]!.packed.data;
                    data.set(source, offset); offset += source.length;
                }
            } catch { data = undefined; }
            if (data === undefined) {
                scratch.refund(plan, bytes);
                for (let i = start; i < end; i++) { plan.draws.push(input[i]!); plan.logicalSpans.push({ first: i, count: 1 }); }
                start = end; continue;
            }
            let vertexCount = 0, maxBackingDisplacement = 0, maxUVDisplacement = 0;
            if (first.kind === 'image') {
                let collapsedTriangles = 0;
                for (let i = start; i < end; i++) {
                    const item = input[i] as Extract<PreparedBatchDraw2D, { kind: 'image' }>;
                    vertexCount += item.packed.vertexCount; collapsedTriangles += item.packed.collapsedTriangles;
                    maxBackingDisplacement = Math.max(maxBackingDisplacement, item.packed.maxBackingDisplacement);
                    maxUVDisplacement = Math.max(maxUVDisplacement, item.packed.maxUVDisplacement);
                }
                plan.draws.push({ ...first, packed: { data, vertexCount, collapsedTriangles, maxBackingDisplacement, maxUVDisplacement } });
            } else {
                let sourceTrianglesCharged = 0, preparedVerticesCharged = 0, maxLightColorDisplacement = 0;
                const counters = { authoredDegenerateTriangles: 0, singularSuppressedTriangles: 0,
                    transformedCollapsedTriangles: 0, clippedCollapsedTriangles: 0, packedCollapsedTriangles: 0 };
                for (let i = start; i < end; i++) {
                    const item = input[i] as Extract<PreparedBatchDraw2D, { kind: 'mesh' }>;
                    vertexCount += item.packed.vertexCount;
                    sourceTrianglesCharged += item.packed.sourceTrianglesCharged; preparedVerticesCharged += item.packed.preparedVerticesCharged;
                    maxBackingDisplacement = Math.max(maxBackingDisplacement, item.packed.maxBackingDisplacement);
                    maxUVDisplacement = Math.max(maxUVDisplacement, item.packed.maxUVDisplacement);
                    maxLightColorDisplacement = Math.max(maxLightColorDisplacement, item.packed.maxLightColorDisplacement);
                    counters.authoredDegenerateTriangles += item.packed.counters.authoredDegenerateTriangles;
                    counters.singularSuppressedTriangles += item.packed.counters.singularSuppressedTriangles;
                    counters.transformedCollapsedTriangles += item.packed.counters.transformedCollapsedTriangles;
                    counters.clippedCollapsedTriangles += item.packed.counters.clippedCollapsedTriangles;
                    counters.packedCollapsedTriangles += item.packed.counters.packedCollapsedTriangles;
                }
                plan.draws.push({ ...first, packed: { data, vertexCount, sourceTrianglesCharged, preparedVerticesCharged,
                    counters: Object.freeze(counters), maxBackingDisplacement, maxUVDisplacement, maxLightColorDisplacement } });
            }
            plan.logicalSpans.push({ first: start, count: end - start });
            start = end;
        }
        return plan;
    } catch (cause) { scratch.release(plan); throw cause; }
}
