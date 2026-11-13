import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { ClipRectangle2D } from '@egret/contracts';
import { orient2d } from 'robust-predicates';

export interface PreparedPoint2D { readonly x: number; readonly y: number; }
/** Private structural seam; the opted-in dispatcher supplies one first-party ledger. */
export interface PreparationBudget2D {
    admitPreparedVertices(count: number): void;
    admitPredicate(): void;
    tryReplayStageCost?(cost: PreparedStageCost2D): boolean;
}
/** Private polygon policy; omission retains the legacy XY cache and corner limit. */
export interface PolygonClipPolicy2D<P extends PreparedPoint2D> {
    readonly maxCorners: number;
    before(first: P, second: P): boolean;
    sameTuple(first: P, second: P): boolean;
    assertAppend(currentLength: number): void;
}
/** What a clip already prepared in this call would have cost; replaying it charges the same budget. */
export interface PreparedStageCost2D {
    readonly preparedVertices: number;
    readonly predicates: number;
    readonly tupleComparisons: number;
}
function tryReplayPreparedStage2D(budget: PreparationBudget2D | undefined, cost: PreparedStageCost2D): boolean {
    if (!Number.isSafeInteger(cost.preparedVertices) || cost.preparedVertices < 0
        || !Number.isSafeInteger(cost.predicates) || cost.predicates < 0
        || !Number.isSafeInteger(cost.tupleComparisons) || cost.tupleComparisons < 0) return false;
    return budget === undefined || budget.tryReplayStageCost?.(cost) === true;
}
export interface RectanglePreparationOptions {
    readonly pixelRatio: number;
    readonly maxPreparedVertices: number;
    readonly maxClipEdgeTests: number;
}
interface ClipRectanglePreparationEntry2D {
    readonly polygon: readonly PreparedPoint2D[];
    readonly predicates: number;
}
interface ContainedClipStackBounds2D {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly count: number;
}
/** Call-local scratch supplied only by the opted-in ordinary TEXTURED dispatcher. */
export interface ClipRectanglePreparationContext2D {
    readonly options: RectanglePreparationOptions;
    readonly budget: PreparationBudget2D;
    active: boolean;
    entries: Map<ClipRectangle2D, ClipRectanglePreparationEntry2D> | undefined;
}
const clearClipEntries = Map.prototype.clear;
/** Drop all clip references before packing, including on an original preparation failure. */
export function clearClipRectangleContext2D(context: ClipRectanglePreparationContext2D | undefined): void {
    if (context === undefined) return;
    context.active = false;
    const entries = context.entries;
    context.entries = undefined;
    if (entries !== undefined) clearClipEntries.call(entries);
}
/** Adapter-owned mapping keeps these numeric errors private to preparation. */
export class GeometryPreparationError extends Error {
    public constructor(public readonly reason: 'range' | 'precision' | 'budget', cause: unknown = undefined) {
        super(`Geometry preparation ${reason}`, { cause });
    }
}
const MINIMUM = 2 ** -100, MAXIMUM = 2 ** 20;
export const POLYGON_LIMIT = 1024;
function fail(reason: 'range' | 'precision' | 'budget'): never { throw noteOwnedPreparationFailure(new GeometryPreparationError(reason)); }
export function coordinate(value: number): number {
    if (!Number.isFinite(value) || (value !== 0 && (Math.abs(value) < MINIMUM || Math.abs(value) > MAXIMUM))) fail('range');
    return value === 0 ? 0 : value;
}
export function same(a: PreparedPoint2D, b: PreparedPoint2D): boolean { return a.x === b.x && a.y === b.y; }
export function before(a: PreparedPoint2D, b: PreparedPoint2D): boolean { return a.x < b.x || (a.x === b.x && a.y < b.y); }
function between(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): boolean {
    return b.x >= Math.min(a.x, c.x) && b.x <= Math.max(a.x, c.x) && b.y >= Math.min(a.y, c.y) && b.y <= Math.max(a.y, c.y);
}
/** Preserve the checked affine operation order without temporary corner-pair arrays. */
function appendCorner(points: PreparedPoint2D[], m: ClipRectangle2D['matrix'], x: number, y: number, ratio: number): void {
    const px = coordinate(coordinate(coordinate(m.a * x) + coordinate(m.c * y)) + m.tx);
    const py = coordinate(coordinate(coordinate(m.b * x) + coordinate(m.d * y)) + m.ty);
    points.push({ x: coordinate(px * ratio), y: coordinate(py * ratio) });
}
export class Preparation {
    public edgeTests = 0;
    private readonly reuseContainedSubjects: boolean;
    public constructor(private readonly options: RectanglePreparationOptions, private readonly budget?: PreparationBudget2D,
        private readonly containedClipping = false, clipContext?: ClipRectanglePreparationContext2D) {
        // Dispatcher subjects are independently owned before clipping, so no
        // unchanged step needs to replace the array or its point objects.
        this.reuseContainedSubjects = containedClipping && budget !== undefined
            && clipContext?.options === options && clipContext.budget === budget;
    }
    private determinant(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): number {
        if (this.edgeTests >= this.options.maxClipEdgeTests) fail('budget');
        this.budget?.admitPredicate();
        this.edgeTests++;
        const value = orient2d(a.x, a.y, b.x, b.y, c.x, c.y);
        if (!Number.isFinite(value)) fail('precision');
        return value;
    }
    /** Intersect only already qualified canonical clip bounds, with the viewport last. */
    public containedClipStackBounds(clips: readonly (readonly PreparedPoint2D[])[],
        viewport: readonly PreparedPoint2D[]): ContainedClipStackBounds2D | undefined {
        if (!this.reuseContainedSubjects || clips.length < 2) return undefined;
        let left = -Infinity, top = -Infinity, right = Infinity, bottom = Infinity;
        for (let index = 0; index <= clips.length; index++) {
            const clip = index === clips.length ? viewport : clips[index]!;
            if (clip.length !== 4) return undefined;
            const first = clip[0]!, second = clip[1]!, third = clip[2]!, fourth = clip[3]!;
            const x = first.x, y = first.y, endX = second.x, endY = third.y;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(endX) || !Number.isFinite(endY)
                || !(x < endX) || !(y < endY) || second.y !== y || third.x !== endX || fourth.x !== x || fourth.y !== endY) return undefined;
            left = Math.max(left, x); top = Math.max(top, y);
            right = Math.min(right, endX); bottom = Math.min(bottom, endY);
        }
        return { left, top, right, bottom, count: clips.length + 1 };
    }
    /** Charge a wholly contained stack at once without merging any actual cuts. */
    public tryContainedClipStack(subject: readonly PreparedPoint2D[], bounds: ContainedClipStackBounds2D | undefined,
        normalization: 'rectangle' | 'image' | 'mesh'): boolean {
        if (!this.reuseContainedSubjects || bounds === undefined) return false;
        const count = subject.length;
        if (count < 3 || count > (normalization === 'mesh' ? 64 : POLYGON_LIMIT)) return false;
        for (const point of subject) {
            if (!(point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom)) return false;
        }
        const predicates = (normalization === 'rectangle' ? 12 : 8) * count * bounds.count;
        const tuples = normalization === 'mesh' ? 2 * count * (count + 1) * bounds.count : 0;
        // An atomic refusal leaves the ordered per-clip traversal to report and
        // charge the same first failure. A successful replay cannot cut a point.
        if (predicates > this.options.maxClipEdgeTests - this.edgeTests
            || !tryReplayPreparedStage2D(this.budget, { preparedVertices: 0, predicates, tupleComparisons: tuples })) return false;
        this.edgeTests += predicates;
        return true;
    }
    /** Only the ordinary TEXTURED Host enables this for its own normalized polygons and ledger. */
    public tryContainedClip<P extends PreparedPoint2D>(subject: P[], clip: readonly PreparedPoint2D[],
        normalization: 'rectangle' | 'image' | 'mesh'): P[] | undefined {
        // Default/direct helpers and missing atomic ledgers retain every original
        // predicate callback. An omitted budget is not authority to replay work.
        if (!this.containedClipping || this.budget === undefined || typeof this.budget.tryReplayStageCost !== 'function') return undefined;
        const count = subject.length;
        if (count < 3 || count > (normalization === 'mesh' ? 64 : POLYGON_LIMIT) || clip.length !== 4) return undefined;
        const first = clip[0]!, second = clip[1]!, third = clip[2]!, fourth = clip[3]!;
        const left = first.x, top = first.y, right = second.x, bottom = third.y;
        // Keep the narrow canonical positive-winding rectangle; no bounding-box
        // substitution, epsilon or changed crossing arithmetic is permitted.
        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)
            || !(left < right) || !(top < bottom) || second.y !== top || third.x !== right || fourth.x !== left || fourth.y !== bottom) return undefined;
        for (const point of subject) if (!(point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)) return undefined;
        // A successful first-party normalization is stable. Every contained edge
        // originally classifies n points, then normalizes the identical sequence.
        // Rectangles retain both the collinear scan and winding cost; image/Mesh
        // retain attributed collinear corners. Mesh additionally charges all XY pairs.
        const predicates = (normalization === 'rectangle' ? 12 : 8) * count;
        const tuples = normalization === 'mesh' ? 2 * count * (count + 1) : 0;
        if (predicates > this.options.maxClipEdgeTests - this.edgeTests) return undefined;
        if (!tryReplayPreparedStage2D(this.budget, { preparedVertices: 0, predicates, tupleComparisons: tuples })) return undefined;
        // Admission is all-or-nothing. A miss leaves local/global counts untouched
        // so the original interleaved traversal still decides its first failure.
        this.edgeTests += predicates;
        if (this.reuseContainedSubjects) return subject;
        // Direct helpers still give callers an independently owned container.
        return normalization === 'mesh' ? subject.map(point => ({ ...point })) : subject.slice();
    }
    /** Known first-party normalization may skip one unchanged canonical half-plane. */
    public tryContainedEdge<P extends PreparedPoint2D>(subject: P[], clip: readonly PreparedPoint2D[], edge: number,
        normalization: 'rectangle' | 'image' | 'mesh'): P[] | undefined {
        // A normalization kind alone grants no callback-skipping authority.
        if (!this.containedClipping || this.budget === undefined || typeof this.budget.tryReplayStageCost !== 'function') return undefined;
        const count = subject.length;
        if (count < 3 || count > (normalization === 'mesh' ? 64 : POLYGON_LIMIT)
            || clip.length !== 4 || !Number.isInteger(edge) || edge < 0 || edge > 3) return undefined;
        const first = clip[0]!, second = clip[1]!, third = clip[2]!, fourth = clip[3]!;
        const left = first.x, top = first.y, right = second.x, bottom = third.y;
        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)
            || !(left < right) || !(top < bottom) || second.y !== top || third.x !== right || fourth.x !== left || fourth.y !== bottom) return undefined;
        for (const point of subject) {
            const inside = edge === 0 ? point.y >= top : edge === 1 ? point.x <= right : edge === 2 ? point.y <= bottom : point.x >= left;
            if (!inside) return undefined;
        }
        // Use the current edge's n: a preceding real cut may have changed it.
        // No crossing occurs; the already stable normalization keeps this sequence.
        const predicates = (normalization === 'rectangle' ? 3 : 2) * count;
        const tuples = normalization === 'mesh' ? count * (count + 1) / 2 : 0;
        if (predicates > this.options.maxClipEdgeTests - this.edgeTests) return undefined;
        if (!tryReplayPreparedStage2D(this.budget, { preparedVertices: 0, predicates, tupleComparisons: tuples })) return undefined;
        // An atomic miss leaves the original edge's interleaved first refusal intact.
        this.edgeTests += predicates;
        if (this.reuseContainedSubjects) return subject;
        return normalization === 'mesh' ? subject.map(point => ({ ...point })) : subject.slice();
    }
    /** Use exact comparisons for the classification stage of an owned axis edge. */
    public classifyOwnedAxisEdge(subject: readonly PreparedPoint2D[], a: PreparedPoint2D, b: PreparedPoint2D): number[] | undefined {
        if (!this.reuseContainedSubjects) return undefined;
        const vertical = a.x === b.x, horizontal = a.y === b.y;
        if (vertical === horizontal) return undefined;
        const predicates = subject.length;
        // A refusal keeps the original point-by-point debit and first error.
        if (predicates > this.options.maxClipEdgeTests - this.edgeTests
            || !tryReplayPreparedStage2D(this.budget, { preparedVertices: 0, predicates, tupleComparisons: 0 })) return undefined;
        this.edgeTests += predicates;
        const boundary = vertical ? a.x : a.y;
        const higherSign = (vertical ? b.y < a.y : b.x > a.x) ? 1 : -1;
        const signs = new Array<number>(predicates);
        let retained = false;
        for (let index = 0; index < predicates; index++) {
            // Prepared coordinates are finite and bounded by 2**20; viewport
            // dimensions can reach uint32. For a nonzero axis extent, the
            // perpendicular comparison is exact, including either zero.
            const point = subject[index]!, position = vertical ? point.x : point.y;
            const sign = position < boundary ? -higherSign : position > boundary ? higherSign : 0;
            signs[index] = sign;
            if (sign >= 0) retained = true;
        }
        // All-strictly-outside has no crossing or normalization work to charge.
        if (!retained) signs.length = 0;
        return signs;
    }
    public sign(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): number {
        // The dependency uses the opposite sign to the conventional algebraic cross product.
        return -Math.sign(this.determinant(a, b, c));
    }
    public normalize(input: readonly PreparedPoint2D[]): PreparedPoint2D[] {
        if (input.length > POLYGON_LIMIT) fail('budget');
        const points: PreparedPoint2D[] = [];
        for (const point of input) if (!points.length || !same(points[points.length - 1]!, point)) points.push(point);
        if (points.length > 1 && same(points[0]!, points[points.length - 1]!)) points.pop();
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) if (same(points[i]!, points[j]!)) fail('precision');
        if (points.length < 3) return [];
        // Remove only exact collinear middle points, never merely thin or nearly parallel turns.
        let changed = true;
        while (changed && points.length >= 3) {
            changed = false;
            for (let i = 0; i < points.length; i++) {
                const a = points[(i + points.length - 1) % points.length]!, b = points[i]!, c = points[(i + 1) % points.length]!;
                if (this.sign(a, b, c) === 0 && between(a, b, c)) { points.splice(i, 1); changed = true; break; }
            }
        }
        if (points.length < 3) return [];
        return finishPolygonWinding2D(this, points);
    }
    public corners(input: ClipRectangle2D): PreparedPoint2D[] {
        const { matrix: m, rect: r } = input, ratio = coordinate(this.options.pixelRatio);
        // Capture the original array-literal reads before any value validation.
        const a = m.a, b = m.b, c = m.c, d = m.d, tx = m.tx, ty = m.ty,
            x = r.x, y = r.y, width = r.width, height = r.height;
        coordinate(a); coordinate(b); coordinate(c); coordinate(d); coordinate(tx); coordinate(ty);
        coordinate(x); coordinate(y); coordinate(width); coordinate(height);
        const right = coordinate(r.x + r.width), bottom = coordinate(r.y + r.height);
        const points: PreparedPoint2D[] = [];
        // All pair-literal getters originally ran before the first point arithmetic.
        const firstX = r.x, firstY = r.y, secondY = r.y, fourthX = r.x;
        appendCorner(points, m, firstX, firstY, ratio);
        appendCorner(points, m, right, secondY, ratio);
        appendCorner(points, m, right, bottom, ratio);
        appendCorner(points, m, fourthX, bottom, ratio);
        // Singular matrices must not acquire fabricated area from rounded corner arithmetic.
        const determinant = this.sign({ x: 0, y: 0 }, { x: m.a, y: m.b }, { x: m.c, y: m.d });
        if (r.width === 0 || r.height === 0 || determinant === 0) return [];
        return points;
    }
    public rectangle(input: ClipRectangle2D): PreparedPoint2D[] {
        const points = this.corners(input);
        return points.length ? this.normalize(points) : [];
    }
    /** Reuse only successful first-party clip rectangles, never the subject or viewport. */
    public clipRectangle(input: ClipRectangle2D, context?: ClipRectanglePreparationContext2D): readonly PreparedPoint2D[] {
        if (!this.containedClipping || context === undefined || !context.active
            || context.options !== this.options || this.budget === undefined || context.budget !== this.budget
            || context.entries === undefined) return this.rectangle(input);
        const entries = context.entries, cached = entries.get(input);
        if (cached !== undefined) {
            // A failed aggregate admission changes neither ledger. The original
            // ordered rectangle operation must decide the first refusal and debit.
            if (cached.predicates <= this.options.maxClipEdgeTests - this.edgeTests
                && tryReplayPreparedStage2D(this.budget, { preparedVertices: 0, predicates: cached.predicates, tupleComparisons: 0 })) {
                this.edgeTests += cached.predicates;
                return cached.polygon;
            }
            return this.rectangle(input);
        }
        const previousPredicates = this.edgeTests;
        // Required geometry work stays outside every optional-allocation catch.
        const polygon = this.rectangle(input);
        if (entries.size < 64 && polygon.length <= 4) {
            try {
                // Own a separate read-only copy; the original miss result may
                // escape a private helper without changing later cached values.
                const copy = Object.freeze(polygon.map(point => Object.freeze({ x: point.x, y: point.y })));
                entries.set(input, { polygon: copy, predicates: this.edgeTests - previousPredicates });
            } catch {
                // Map insertion and copying are optional. Never swallow a
                // rectangle/predicate failure or retain a partially inserted row.
                clearClipRectangleContext2D(context);
            }
        }
        return polygon;
    }
    public crossing<P extends PreparedPoint2D>(a: PreparedPoint2D, b: PreparedPoint2D, first: P, second: P, attach: CrossingAttributes<P>, policy?: PolygonClipPolicy2D<P>): P {
        const p = (policy === undefined ? before(first, second) : policy.before(first, second)) ? first : second, q = p === first ? second : first;
        const u = Math.abs(this.determinant(a, b, p)), v = Math.abs(this.determinant(a, b, q));
        const sum = u + v, t = u / sum;
        if (!(u > 0) || !(v > 0) || !Number.isFinite(sum) || !Number.isFinite(t)) fail('precision');
        let x: number, y: number, weight = t, complementary = false;
        if (t > 0 && t < 1) {
            // Preserve the operation order and bits of strict-interior crossings.
            x = coordinate(p.x + t * (q.x - p.x)); y = coordinate(p.y + t * (q.y - p.y));
        } else if (t === 1) {
            // Compute the small complementary weight directly; 1-t loses it.
            const s = v / sum;
            if (!Number.isFinite(s) || !(s > 0 && s <= 0.5)) fail('precision');
            x = coordinate(q.x + s * (p.x - q.x)); y = coordinate(q.y + s * (p.y - q.y));
            weight = s; complementary = true;
        } else fail('precision');
        if (x < Math.min(p.x, q.x) || x > Math.max(p.x, q.x) || y < Math.min(p.y, q.y) || y > Math.max(p.y, q.y)) fail('precision');
        return attach(p, q, weight, complementary, x, y);
    }
    public intersect(subject: PreparedPoint2D[], clip: readonly PreparedPoint2D[], normalized = false): PreparedPoint2D[] {
        // Generic callers may supply unnormalized points; only the real producer opts in.
        return clipPolygon2D(this, subject, clip, normalizeRectangle, attachRectangle, undefined, normalized ? 'rectangle' : undefined);
    }
}
/** Policy wrappers keep their collinear/duplicate rules; this finish preserves sign order and full points. */
export function finishPolygonWinding2D<P extends PreparedPoint2D>(preparation: Preparation, points: P[]): P[] {
    let winding = 0;
    for (let i = 0; i < points.length; i++) {
        const sign = preparation.sign(points[i]!, points[(i + 1) % points.length]!, points[(i + 2) % points.length]!);
        if (sign !== 0) { if (winding !== 0 && winding !== sign) fail('precision'); winding = sign; }
    }
    if (winding === 0) return [];
    if (winding < 0) points.reverse();
    return points;
}
export type CrossingAttributes<P extends PreparedPoint2D> = (p: P, q: P, weight: number, complementary: boolean, x: number, y: number) => P;
const normalizeRectangle = (preparation: Preparation, input: readonly PreparedPoint2D[]): PreparedPoint2D[] => preparation.normalize(input);
// Plain rectangle corners retain exactly their original two-field shape.
const attachRectangle: CrossingAttributes<PreparedPoint2D> = (_p, _q, _weight, _complementary, x, y) => ({ x, y });
/** Shared traversal preserves determinant order; callers own attribute normalization. */
export function clipPolygon2D<P extends PreparedPoint2D>(preparation: Preparation, subject: P[], clip: readonly PreparedPoint2D[], normalize: (preparation: Preparation, input: readonly P[]) => P[], attach: CrossingAttributes<P>, policy?: PolygonClipPolicy2D<P>,
    normalization?: 'rectangle' | 'image' | 'mesh'): P[] {
    if (!clip.length) return [];
    for (let edge = 0; edge < clip.length && subject.length; edge++) {
        // Only known first-party call sites mark their successful normalization.
        // Preparation independently requires the existing trusted clipping selection.
        if (normalization !== undefined) {
            const contained = preparation.tryContainedEdge(subject, clip, edge, normalization);
            if (contained !== undefined) { subject = contained; continue; }
        }
        const a = clip[edge]!, b = clip[(edge + 1) % clip.length]!;
        const classified = normalization === undefined ? undefined : preparation.classifyOwnedAxisEdge(subject, a, b);
        if (classified?.length === 0) return [];
        const signs = classified ?? subject.map(point => preparation.sign(a, b, point));
        const output: P[] = [];
        const cache: { p: P; q: P; point: P }[] = [];
        const append = (point: P): void => {
            if (policy === undefined) {
                if (output.length >= POLYGON_LIMIT) fail('budget');
            } else policy.assertAppend(output.length);
            output.push(point);
        };
        for (let i = 0; i < subject.length; i++) {
            const p = subject[i]!, j = (i + 1) % subject.length, q = subject[j]!;
            const ps = signs[i]!, qs = signs[j]!;
            if (ps >= 0) append(p);
            if ((ps < 0 && qs > 0) || (ps > 0 && qs < 0)) {
                const left = (policy === undefined ? before(p, q) : policy.before(p, q)) ? p : q, right = left === p ? q : p;
                let hit: { p: P; q: P; point: P } | undefined;
                if (policy === undefined) hit = cache.find(item => same(item.p, left) && same(item.q, right));
                else {
                    // Each attempted endpoint pair is admitted before any tuple read.
                    for (const item of cache) {
                        if (policy.sameTuple(item.p, left) && policy.sameTuple(item.q, right)) { hit = item; break; }
                    }
                }
                if (!hit) { hit = { p: left, q: right, point: preparation.crossing(a, b, left, right, attach, policy) }; cache.push(hit); }
                append(hit.point);
            }
        }
        subject = normalize(preparation, output);
    }
    return subject;
}
