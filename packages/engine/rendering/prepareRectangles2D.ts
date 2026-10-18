import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { ClipRectangle2D } from '@egret/contracts';
import type { RectangleFrame2D } from './RectangleFrame2D.js';
import { orient2d } from 'robust-predicates';
import { readPreparedStage2D, tryReplayPreparedStage2D, acceptPreparedStage2D, publishPreparedStage2D } from './preparedFrameCache2D.js';
import type { PreparedCacheContext2D, PreparedStageCost2D } from './preparedFrameCache2D.js';

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
export interface PreparedRectangles2D {
    readonly points: readonly PreparedPoint2D[];
    readonly commands: readonly { readonly pointIndices: readonly number[]; readonly color: number; readonly alpha: number }[];
    readonly edgeTests: number;
}
export interface RectanglePreparationOptions {
    readonly pixelRatio: number;
    readonly maxPreparedVertices: number;
    readonly maxClipEdgeTests: number;
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
export class Preparation {
    public edgeTests = 0;
    public constructor(private readonly options: RectanglePreparationOptions, private readonly budget?: PreparationBudget2D) {}
    private determinant(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): number {
        if (this.edgeTests >= this.options.maxClipEdgeTests) fail('budget');
        this.budget?.admitPredicate();
        this.edgeTests++;
        const value = orient2d(a.x, a.y, b.x, b.y, c.x, c.y);
        if (!Number.isFinite(value)) fail('precision');
        return value;
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
        for (const value of [m.a, m.b, m.c, m.d, m.tx, m.ty, r.x, r.y, r.width, r.height]) coordinate(value);
        const right = coordinate(r.x + r.width), bottom = coordinate(r.y + r.height);
        const points: PreparedPoint2D[] = [];
        for (const [x, y] of [[r.x, r.y], [right, r.y], [right, bottom], [r.x, bottom]] as const) {
            const px = coordinate(coordinate(coordinate(m.a * x) + coordinate(m.c * y)) + m.tx);
            const py = coordinate(coordinate(coordinate(m.b * x) + coordinate(m.d * y)) + m.ty);
            points.push({ x: coordinate(px * ratio), y: coordinate(py * ratio) });
        }
        // Singular matrices must not acquire fabricated area from rounded corner arithmetic.
        const determinant = this.sign({ x: 0, y: 0 }, { x: m.a, y: m.b }, { x: m.c, y: m.d });
        if (r.width === 0 || r.height === 0 || determinant === 0) return [];
        return points;
    }
    public rectangle(input: ClipRectangle2D): PreparedPoint2D[] {
        const points = this.corners(input);
        return points.length ? this.normalize(points) : [];
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
    public intersect(subject: PreparedPoint2D[], clip: readonly PreparedPoint2D[]): PreparedPoint2D[] {
        return clipPolygon2D(this, subject, clip, normalizeRectangle, attachRectangle);
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
export function clipPolygon2D<P extends PreparedPoint2D>(preparation: Preparation, subject: P[], clip: readonly PreparedPoint2D[], normalize: (preparation: Preparation, input: readonly P[]) => P[], attach: CrossingAttributes<P>, policy?: PolygonClipPolicy2D<P>): P[] {
    if (!clip.length) return [];
    for (let edge = 0; edge < clip.length && subject.length; edge++) {
        const a = clip[edge]!, b = clip[(edge + 1) % clip.length]!;
        const signs = subject.map(point => preparation.sign(a, b, point));
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
export function prepareRectangles2D(frame: RectangleFrame2D, width: number, height: number, options: RectanglePreparationOptions, budget?: PreparationBudget2D, commandIndices?: number[],
    cache?: PreparedCacheContext2D, sourceCommandIndices?: readonly number[]): PreparedRectangles2D {
    // A clear-only frame still consumes nominal DPR, so its envelope is unconditional.
    coordinate(options.pixelRatio);
    const preparation = new Preparation(options, budget);
    const points: PreparedPoint2D[] = [];
    const commands: { pointIndices: number[]; color: number; alpha: number }[] = [];
    const viewport = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
    let vertices = 0;
    for (let commandIndex = 0; commandIndex < frame.commands.length; commandIndex++) {
        const command = frame.commands[commandIndex]!;
        const slot = cache?.cache.slot(cache, [command], width, height, undefined, undefined, false, sourceCommandIndices?.[commandIndex] ?? commandIndex);
        const cached = readPreparedStage2D<{ readonly polygon: readonly PreparedPoint2D[] }>(slot, 'geometry');
        const previousPredicates = preparation.edgeTests;
        let polygon: readonly PreparedPoint2D[], fanVertices: number, hit = false;
        if (cached && cached.cost.predicates <= options.maxClipEdgeTests - preparation.edgeTests
            && cached.cost.preparedVertices <= options.maxPreparedVertices - vertices
            && cached.cost.preparedVertices <= 4294967295 - vertices
            && tryReplayPreparedStage2D(budget, cached.cost)) {
            polygon = cached.value.polygon; fanVertices = cached.cost.preparedVertices;
            preparation.edgeTests += cached.cost.predicates; hit = true;
            acceptPreparedStage2D(slot);
        } else {
            let computed = preparation.rectangle(command);
            // Preflight all clips even when an earlier clip or alpha already removes coverage.
            const clips = command.clips.map(clip => preparation.rectangle(clip));
            for (const clip of clips) computed = preparation.intersect(computed, clip);
            computed = preparation.intersect(computed, viewport);
            polygon = command.alpha === 0 ? [] : computed;
            fanVertices = polygon.length ? (polygon.length - 2) * 3 : 0;
            if (polygon.length) {
                if (fanVertices > options.maxPreparedVertices - vertices || fanVertices > 4294967295 - vertices) fail('budget');
                budget?.admitPreparedVertices(fanVertices);
            }
        }
        vertices += fanVertices;
        if (polygon.length) {
            const pointIndices: number[] = [];
            for (const point of polygon) { pointIndices.push(points.length); points.push(point); }
            commands.push({ pointIndices, color: command.color, alpha: command.alpha });
            // Retain the actual source ordinal, including holes from empty commands.
            commandIndices?.push(commandIndex);
        }
        if (!hit) publishPreparedStage2D(slot, 'geometry', { polygon },
            { preparedVertices: fanVertices, predicates: preparation.edgeTests - previousPredicates, tupleComparisons: 0 });
    }
    return { points, commands, edgeTests: preparation.edgeTests };
}
