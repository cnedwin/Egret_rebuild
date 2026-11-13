import type { ClipRectangle2D, ImageData2D, Matrix2D, Rectangle2D, SharedGeometry2D, SharedMaterial2D, SharedRegion2D, TexturedGeometry2D } from '@egret/contracts';
import type { PreparedStageCost2D } from './prepareRectangles2D.js';
import type { SharedDrawCommand2D, SharedPoint2D } from './prepareSharedDraws2D.js';

/**
 * What one Host keeps of the last frame it prepared, so that a draw which is the same in the next frame is
 * not clipped and packed again. A kept result is used only for a draw whose every input is the same value,
 * and only after its recorded charges fit the frame's budget, so a frame prepared with kept results has the
 * same geometry, rows, charges and refusals as one prepared without them.
 *
 * The limits are logical: a record counts 32 bytes and 8 for each field, an array 24 and 8 for each element,
 * a typed array its byte length, and every kept draw 256 for itself. A frame the largest limits admit keeps
 * less than the byte limit; a Host is given no other.
 */
export const SHARED_RETAINED_DRAWS_2D = 65536, SHARED_RETAINED_BYTES_2D = 33554432;
const ENTRY_BYTES = 256, POINT_BYTES = 32 + 8 * 11;
/** Where a draw is looked for, from where the draw before it was found. */
const PLACES = [0, -1, 1, -2, 2];

type Geometry = TexturedGeometry2D | SharedGeometry2D;
/** One draw of the last frame. `polygons` is absent in a draw that changed twice running; it is kept again once it rests. */
export interface RetainedSharedDraw2D {
    command: SharedDrawCommand2D; material: SharedMaterial2D; region: SharedRegion2D | undefined; page: ImageData2D | undefined; geometry: Geometry | undefined;
    polygons: readonly (readonly SharedPoint2D[])[] | undefined; vertexReservation: number; geometryCost: PreparedStageCost2D | undefined;
    rows: Float32Array<ArrayBuffer> | undefined; vertexCount: number; rowsCost: PreparedStageCost2D | undefined;
    changes: number; bytes: number; frame: number;
}
const same = Object.is;
function sameMatrix(a: Matrix2D, b: Matrix2D): boolean {
    return a === b || (same(a.a, b.a) && same(a.b, b.b) && same(a.c, b.c) && same(a.d, b.d) && same(a.tx, b.tx) && same(a.ty, b.ty));
}
function sameRect(a: Rectangle2D, b: Rectangle2D): boolean {
    return a === b || (same(a.x, b.x) && same(a.y, b.y) && same(a.width, b.width) && same(a.height, b.height));
}
function sameClips(a: readonly ClipRectangle2D[], b: readonly ClipRectangle2D[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) { const x = a[i]!, y = b[i]!; if (x !== y && !(sameMatrix(x.matrix, y.matrix) && sameRect(x.rect, y.rect))) return false; }
    return true;
}
function sameRegion(a: SharedRegion2D | undefined, b: SharedRegion2D | undefined): boolean {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    const p = a.packed, q = b.packed;
    return same(p.x, q.x) && same(p.y, q.y) && same(p.width, q.width) && same(p.height, q.height) && same(a.logicalWidth, b.logicalWidth)
        && same(a.logicalHeight, b.logicalHeight) && same(a.trimX, b.trimX) && same(a.trimY, b.trimY) && same(a.quarterTurn, b.quarterTurn);
}
/** Every input of the geometry of a draw. The opacity only matters by being zero: a draw of none has no geometry. */
function sameDraw(kept: RetainedSharedDraw2D, command: SharedDrawCommand2D, material: SharedMaterial2D, region: SharedRegion2D | undefined,
    page: ImageData2D | undefined, geometry: Geometry | undefined): boolean {
    const old = kept.command;
    if (old.kind !== command.kind || kept.material !== material || kept.page !== page || kept.geometry !== geometry || (old.opacity === 0) !== (command.opacity === 0)
        || !sameMatrix(old.matrix, command.matrix) || !sameClips(old.clips, command.clips) || !sameRegion(kept.region, region)) return false;
    if (command.kind === 'mesh') return true;
    if (!sameRect((old as typeof command).rect, command.rect)) return false;
    return command.kind !== 'rect' || (same((old as typeof command).fillColor, command.fillColor) && same((old as typeof command).fillAlpha, command.fillAlpha));
}
function polygonBytes(polygons: readonly (readonly SharedPoint2D[])[]): number {
    let bytes = 24 + 8 * polygons.length;
    for (const polygon of polygons) bytes += 24 + 8 * polygon.length + POINT_BYTES * polygon.length;
    return bytes;
}

export class SharedPreparationRetention2D {
    #kept: (RetainedSharedDraw2D | undefined)[] = [];
    #next: (RetainedSharedDraw2D | undefined)[] | undefined;
    #bytes = 0; #nextBytes = 0; #nextCount = 0;
    #width = 0; #height = 0; #ratio = 0; #options: object | undefined;
    #frame = 0; #shift = 0; #unfound = 0;
    readonly #limit: number;
    /** `maxBytes` may only lower the limit on what is kept. */
    public constructor(maxBytes = SHARED_RETAINED_BYTES_2D) {
        if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > SHARED_RETAINED_BYTES_2D) throw new RangeError('maxBytes');
        this.#limit = maxBytes;
    }
    /** The logical bytes and the draws kept now. */
    public get bytes(): number { return this.#bytes; }
    public get draws(): number { let count = 0; for (const entry of this.#kept) if (entry !== undefined) count++; return count; }
    /** Everything kept is dropped; a frame being prepared keeps nothing. */
    public clear(): void { this.#kept = []; this.#next = undefined; this.#bytes = 0; }
    /** Starts a frame. Results kept for another size, pixel ratio or set of limits are dropped first. */
    public begin(commands: number, width: number, height: number, ratio: number, options: object): void {
        if (this.#width !== width || this.#height !== height || !same(this.#ratio, ratio) || this.#options !== options) {
            this.clear(); this.#width = width; this.#height = height; this.#ratio = ratio; this.#options = options;
        }
        this.#next = new Array<RetainedSharedDraw2D | undefined>(commands);
        this.#nextBytes = 0; this.#nextCount = 0; this.#shift = 0; this.#unfound = 0; this.#frame++;
    }
    /**
     * The kept draw that has every input of this one, if the last frame had it at this place or up to two places
     * to either side of where the draw before it was found, so that a draw or two added or removed do not part
     * every later draw from its result. After eight draws running that were not found, only this place is
     * looked at until one is found again: a frame in which everything changed is not searched in vain.
     * A kept draw answers one draw of a frame.
     */
    public find(ordinal: number, command: SharedDrawCommand2D, material: SharedMaterial2D, region: SharedRegion2D | undefined,
        page: ImageData2D | undefined, geometry: Geometry | undefined): RetainedSharedDraw2D | undefined {
        const kept = this.#kept, shift = this.#shift, attempts = this.#unfound < 8 ? PLACES.length : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const delta = shift + PLACES[attempt]!, candidate = kept[ordinal + delta];
            if (candidate === undefined || candidate.frame === this.#frame || !sameDraw(candidate, command, material, region, page, geometry)) continue;
            this.#shift = delta; this.#unfound = 0; candidate.frame = this.#frame;
            return candidate;
        }
        this.#unfound++;
        return undefined;
    }
    /** A kept draw found for this frame stays kept, under the records of this frame. */
    public carry(ordinal: number, entry: RetainedSharedDraw2D, command: SharedDrawCommand2D, region: SharedRegion2D | undefined): void {
        entry.command = command; entry.region = region; entry.changes = 0;
        this.#next![ordinal] = entry; this.#nextBytes += entry.bytes; this.#nextCount++;
    }
    /**
     * Keeps the geometry a draw of this frame was just given, with the three charges it was given. `found` is
     * the kept draw with the same inputs, when there was one without geometry. A draw whose place held another
     * draw twice running is kept without its geometry until it is found the same once; a record without
     * geometry that stood at its place is written over, so a draw that changes in every frame allocates nothing here.
     */
    public keep(ordinal: number, found: RetainedSharedDraw2D | undefined, command: SharedDrawCommand2D, material: SharedMaterial2D, region: SharedRegion2D | undefined,
        page: ImageData2D | undefined, geometry: Geometry | undefined, polygons: readonly (readonly SharedPoint2D[])[], vertexReservation: number,
        preparedVertices: number, predicates: number, tupleComparisons: number): RetainedSharedDraw2D | undefined {
        if (this.#nextCount >= SHARED_RETAINED_DRAWS_2D) return undefined;
        const stood = found === undefined ? this.#kept[ordinal + this.#shift] : undefined, before = stood !== undefined && stood.frame !== this.#frame ? stood : undefined;
        const changes = before !== undefined ? before.changes + 1 : 0;
        if (changes >= 2) {
            if (ENTRY_BYTES > this.#limit - this.#nextBytes) return undefined;
            // Only a record that already was without geometry is written over: a frame that is refused must leave what was kept.
            let entry = before!;
            if (entry.polygons === undefined) { entry.command = command; entry.material = material; entry.region = region; entry.page = page; entry.geometry = geometry; entry.frame = this.#frame; }
            else entry = { command, material, region, page, geometry, polygons: undefined, vertexReservation: 0, geometryCost: undefined, rows: undefined, vertexCount: 0, rowsCost: undefined,
                changes: 2, bytes: ENTRY_BYTES, frame: this.#frame };
            this.#next![ordinal] = entry; this.#nextBytes += ENTRY_BYTES; this.#nextCount++;
            return undefined;
        }
        const bytes = ENTRY_BYTES + polygonBytes(polygons);
        if (bytes > this.#limit - this.#nextBytes) return undefined;
        const entry: RetainedSharedDraw2D = { command, material, region, page, geometry, polygons, vertexReservation,
            geometryCost: { preparedVertices, predicates, tupleComparisons }, rows: undefined, vertexCount: 0, rowsCost: undefined, changes, bytes, frame: this.#frame };
        this.#next![ordinal] = entry; this.#nextBytes += bytes; this.#nextCount++;
        return entry;
    }
    /** The geometry of the frame is complete: what it kept replaces what was kept before. */
    public commit(): void {
        if (this.#next === undefined) return;
        this.#kept = this.#next; this.#bytes = this.#nextBytes; this.#next = undefined;
    }
    /** A frame that did not complete its geometry leaves what was kept before as it was. */
    public abandon(): void { this.#next = undefined; }
    /** Keeps a copy of the rows a kept draw was just given, while there is room. */
    public keepRows(entry: RetainedSharedDraw2D, rows: Float32Array<ArrayBuffer>, vertexCount: number, cost: PreparedStageCost2D): void {
        if (entry.rows !== undefined || entry.polygons === undefined || rows.byteLength > this.#limit - this.#bytes) return;
        entry.rows = rows.slice(); entry.vertexCount = vertexCount; entry.rowsCost = cost;
        entry.bytes += rows.byteLength; this.#bytes += rows.byteLength;
    }
}
