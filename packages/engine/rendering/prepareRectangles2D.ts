import type { ClipRectangle2D, RenderFrame2D } from '@egret/contracts';
import { orient2d } from 'robust-predicates';

export interface PreparedPoint2D { readonly x: number; readonly y: number; }
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
const MINIMUM = 2 ** -100, MAXIMUM = 2 ** 20, POLYGON_LIMIT = 1024;
function fail(reason: 'range' | 'precision' | 'budget'): never { throw new GeometryPreparationError(reason); }
function coordinate(value: number): number {
    if (!Number.isFinite(value) || (value !== 0 && (Math.abs(value) < MINIMUM || Math.abs(value) > MAXIMUM))) fail('range');
    return value === 0 ? 0 : value;
}
function same(a: PreparedPoint2D, b: PreparedPoint2D): boolean { return a.x === b.x && a.y === b.y; }
function before(a: PreparedPoint2D, b: PreparedPoint2D): boolean { return a.x < b.x || (a.x === b.x && a.y < b.y); }
function between(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): boolean {
    return b.x >= Math.min(a.x, c.x) && b.x <= Math.max(a.x, c.x) && b.y >= Math.min(a.y, c.y) && b.y <= Math.max(a.y, c.y);
}
class Preparation {
    public edgeTests = 0;
    public constructor(private readonly options: RectanglePreparationOptions) {}
    private determinant(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): number {
        if (this.edgeTests >= this.options.maxClipEdgeTests) fail('budget');
        this.edgeTests++;
        const value = orient2d(a.x, a.y, b.x, b.y, c.x, c.y);
        if (!Number.isFinite(value)) fail('precision');
        return value;
    }
    private sign(a: PreparedPoint2D, b: PreparedPoint2D, c: PreparedPoint2D): number {
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
        let winding = 0;
        for (let i = 0; i < points.length; i++) {
            const sign = this.sign(points[i]!, points[(i + 1) % points.length]!, points[(i + 2) % points.length]!);
            if (sign !== 0) { if (winding !== 0 && winding !== sign) fail('precision'); winding = sign; }
        }
        if (winding === 0) return [];
        if (winding < 0) points.reverse();
        return points;
    }
    public rectangle(input: ClipRectangle2D): PreparedPoint2D[] {
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
        return this.normalize(points);
    }
    private crossing(a: PreparedPoint2D, b: PreparedPoint2D, first: PreparedPoint2D, second: PreparedPoint2D): PreparedPoint2D {
        const p = before(first, second) ? first : second, q = p === first ? second : first;
        const u = Math.abs(this.determinant(a, b, p)), v = Math.abs(this.determinant(a, b, q));
        const sum = u + v, t = u / sum;
        if (!(u > 0) || !(v > 0) || !Number.isFinite(sum) || !Number.isFinite(t)) fail('precision');
        let x: number, y: number;
        if (t > 0 && t < 1) {
            // Preserve the operation order and bits of strict-interior crossings.
            x = coordinate(p.x + t * (q.x - p.x)); y = coordinate(p.y + t * (q.y - p.y));
        } else if (t === 1) {
            // Compute the small complementary weight directly; 1-t loses it.
            const s = v / sum;
            if (!Number.isFinite(s) || !(s > 0 && s <= 0.5)) fail('precision');
            x = coordinate(q.x + s * (p.x - q.x)); y = coordinate(q.y + s * (p.y - q.y));
        } else fail('precision');
        if (x < Math.min(p.x, q.x) || x > Math.max(p.x, q.x) || y < Math.min(p.y, q.y) || y > Math.max(p.y, q.y)) fail('precision');
        return { x, y };
    }
    public intersect(subject: PreparedPoint2D[], clip: readonly PreparedPoint2D[]): PreparedPoint2D[] {
        if (!clip.length) return [];
        for (let edge = 0; edge < clip.length && subject.length; edge++) {
            const a = clip[edge]!, b = clip[(edge + 1) % clip.length]!;
            const signs = subject.map(point => this.sign(a, b, point));
            const output: PreparedPoint2D[] = [];
            const cache: { p: PreparedPoint2D; q: PreparedPoint2D; point: PreparedPoint2D }[] = [];
            const append = (point: PreparedPoint2D): void => {
                if (output.length >= POLYGON_LIMIT) fail('budget');
                output.push(point);
            };
            for (let i = 0; i < subject.length; i++) {
                const p = subject[i]!, j = (i + 1) % subject.length, q = subject[j]!;
                const ps = signs[i]!, qs = signs[j]!;
                if (ps >= 0) append(p);
                if ((ps < 0 && qs > 0) || (ps > 0 && qs < 0)) {
                    const left = before(p, q) ? p : q, right = left === p ? q : p;
                    let hit = cache.find(item => same(item.p, left) && same(item.q, right));
                    if (!hit) { hit = { p: left, q: right, point: this.crossing(a, b, left, right) }; cache.push(hit); }
                    append(hit.point);
                }
            }
            subject = this.normalize(output);
        }
        return subject;
    }
}
export function prepareRectangles2D(frame: RenderFrame2D, width: number, height: number, options: RectanglePreparationOptions): PreparedRectangles2D {
    // A clear-only frame still consumes nominal DPR, so its envelope is unconditional.
    coordinate(options.pixelRatio);
    const preparation = new Preparation(options);
    const points: PreparedPoint2D[] = [];
    const commands: { pointIndices: number[]; color: number; alpha: number }[] = [];
    const viewport = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
    let vertices = 0;
    for (const command of frame.commands) {
        let polygon = preparation.rectangle(command);
        // Preflight all clips even when an earlier clip or alpha already removes coverage.
        const clips = command.clips.map(clip => preparation.rectangle(clip));
        for (const clip of clips) polygon = preparation.intersect(polygon, clip);
        polygon = preparation.intersect(polygon, viewport);
        if (!polygon.length || command.alpha === 0) continue;
        const fanVertices = (polygon.length - 2) * 3;
        if (fanVertices > options.maxPreparedVertices - vertices || fanVertices > 4294967295 - vertices) fail('budget');
        vertices += fanVertices;
        const pointIndices: number[] = [];
        for (const point of polygon) { pointIndices.push(points.length); points.push(point); }
        commands.push({ pointIndices, color: command.color, alpha: command.alpha });
    }
    return { points, commands, edgeTests: preparation.edgeTests };
}
