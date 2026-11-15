/**
 * What one Host keeps of the last frame it prepared, so that a draw which is the same in the next frame is
 * not clipped and packed again, and a batch that takes the same draws is not joined again: only the rows of
 * its draws that changed are written. A kept result is used only for a draw whose every input is the same
 * value, and only after its recorded charges fit the frame's budget, so a frame prepared with kept results
 * has the same geometry, rows, batches, charges and refusals as one prepared without them.
 *
 * The limits are logical: a record counts 32 bytes and 8 for each field, an array 24 and 8 for each element,
 * a typed array its byte length, and every kept draw 256 for itself. A frame the largest limits admit keeps
 * less than the byte limit; a Host is given no other.
 */
export const SHARED_RETAINED_DRAWS_2D = 65536, SHARED_RETAINED_BYTES_2D = 50331648;
const ENTRY_BYTES = 256, POINT_BYTES = 32 + 8 * 11;
/** A packed record and, counted whether or not it shares them with the record beside it, the 128 bytes of its block and the array of its one page. */
const PACKED_BYTES = 32 + 8 * 6 + 128 + 24 + 8;
/**
 * A kept batch without its rows and what it holds for each draw: its own record, its joined draw, the record that
 * stands for its first draw and, counted whether or not it has them, a block and a list of pages of its own.
 */
const BATCH_BYTES = 32 + 8 * 6 + 2 * (32 + 8 * 6) + 128 + 24 + 8 * 8;
/** Where a draw is looked for, from where the draw before it was found. */
const PLACES = [0, -1, 1, -2, 2];
const same = Object.is;
function sameMatrix(a, b) {
    return (a === b ||
        (same(a.a, b.a) && same(a.b, b.b) && same(a.c, b.c) && same(a.d, b.d) && same(a.tx, b.tx) && same(a.ty, b.ty)));
}
function sameRect(a, b) {
    return a === b || (same(a.x, b.x) && same(a.y, b.y) && same(a.width, b.width) && same(a.height, b.height));
}
function sameClips(a, b) {
    if (a === b)
        return true;
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        if (x !== y && !(sameMatrix(x.matrix, y.matrix) && sameRect(x.rect, y.rect)))
            return false;
    }
    return true;
}
function sameRegion(a, b) {
    if (a === b)
        return true;
    if (a === undefined || b === undefined)
        return false;
    const p = a.packed, q = b.packed;
    return (same(p.x, q.x) &&
        same(p.y, q.y) &&
        same(p.width, q.width) &&
        same(p.height, q.height) &&
        same(a.logicalWidth, b.logicalWidth) &&
        same(a.logicalHeight, b.logicalHeight) &&
        same(a.trimX, b.trimX) &&
        same(a.trimY, b.trimY) &&
        same(a.quarterTurn, b.quarterTurn));
}
/** Every input of the geometry of a draw. The opacity only matters by being zero: a draw of none has no geometry. */
function sameDraw(kept, command, material, region, page, geometry) {
    const old = kept.command;
    if (old.kind !== command.kind ||
        kept.material !== material ||
        kept.page !== page ||
        kept.geometry !== geometry ||
        (old.opacity === 0) !== (command.opacity === 0) ||
        !sameMatrix(old.matrix, command.matrix) ||
        !sameClips(old.clips, command.clips) ||
        !sameRegion(kept.region, region))
        return false;
    if (command.kind === 'mesh')
        return true;
    if (!sameRect(old.rect, command.rect))
        return false;
    return (command.kind !== 'rect' ||
        (same(old.fillColor, command.fillColor) &&
            same(old.fillAlpha, command.fillAlpha)));
}
function polygonBytes(polygons) {
    let bytes = 24 + 8 * polygons.length;
    for (const polygon of polygons)
        bytes += 24 + 8 * polygon.length + POINT_BYTES * polygon.length;
    return bytes;
}
export class SharedPreparationRetention2D {
    #kept = [];
    #next;
    #bytes = 0;
    #nextBytes = 0;
    #nextCount = 0;
    // Kept batches by the place in the frame of their first draw.
    #batches = new Map();
    #nextBatches;
    #batchBytes = 0;
    #nextBatchBytes = 0;
    #width = 0;
    #height = 0;
    #ratio = 0;
    #options;
    #frame = 0;
    #shift = 0;
    #unfound = 0;
    #limit;
    /** `maxBytes` may only lower the limit on what is kept. */
    constructor(maxBytes = SHARED_RETAINED_BYTES_2D) {
        if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > SHARED_RETAINED_BYTES_2D)
            throw new RangeError('maxBytes');
        this.#limit = maxBytes;
    }
    /** The logical bytes and the draws kept now. */
    get bytes() {
        return this.#bytes + this.#batchBytes;
    }
    /** The batches kept now. */
    get batches() {
        return this.#batches.size;
    }
    get draws() {
        let count = 0;
        for (const entry of this.#kept)
            if (entry !== undefined)
                count++;
        return count;
    }
    /** Everything kept is dropped; a frame being prepared keeps nothing. */
    clear() {
        this.#kept = [];
        this.#next = undefined;
        this.#bytes = 0;
        this.#batches = new Map();
        this.#nextBatches = undefined;
        this.#batchBytes = 0;
    }
    /** Starts a frame. Results kept for another size, pixel ratio or set of limits are dropped first. */
    begin(commands, width, height, ratio, options) {
        if (this.#width !== width || this.#height !== height || !same(this.#ratio, ratio) || this.#options !== options) {
            this.clear();
            this.#width = width;
            this.#height = height;
            this.#ratio = ratio;
            this.#options = options;
        }
        this.#next = new Array(commands);
        this.#nextBytes = 0;
        this.#nextCount = 0;
        this.#shift = 0;
        this.#unfound = 0;
        this.#frame++;
    }
    /**
     * The kept draw that has every input of this one, if the last frame had it at this place or up to two places
     * to either side of where the draw before it was found, so that a draw or two added or removed do not part
     * every later draw from its result. After eight draws running that were not found, only this place is
     * looked at until one is found again: a frame in which everything changed is not searched in vain.
     * A kept draw answers one draw of a frame.
     */
    find(ordinal, command, material, region, page, geometry) {
        const kept = this.#kept, shift = this.#shift, attempts = this.#unfound < 8 ? PLACES.length : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const delta = shift + PLACES[attempt], candidate = kept[ordinal + delta];
            if (candidate === undefined ||
                candidate.frame === this.#frame ||
                !sameDraw(candidate, command, material, region, page, geometry))
                continue;
            this.#shift = delta;
            this.#unfound = 0;
            candidate.frame = this.#frame;
            return candidate;
        }
        this.#unfound++;
        return undefined;
    }
    /**
     * The record the last frame was given for a kept draw, to be given again: while the command is the same
     * object and the draw's page has the same place among the frame's pages. Then the draw has rested.
     */
    rest(entry, command, pageIndex) {
        const before = entry.prepared;
        if (before === undefined || before.command !== command || before.pageIndex !== pageIndex)
            return undefined;
        entry.rested = true;
        return before;
    }
    /** The new record of a kept draw that did not rest. A packed record kept for its old one is dropped. */
    give(entry, prepared) {
        if (entry.packed !== undefined) {
            entry.packed = undefined;
            entry.bytes -= PACKED_BYTES;
        }
        entry.prepared = prepared;
        entry.rested = false;
    }
    /** A kept draw found for this frame stays kept, under the records of this frame. */
    carry(ordinal, entry, command, region) {
        entry.command = command;
        entry.region = region;
        entry.changes = 0;
        this.#next[ordinal] = entry;
        this.#nextBytes += entry.bytes;
        this.#nextCount++;
    }
    /**
     * Keeps the geometry a draw of this frame was just given, with the three charges it was given, and the record
     * `prepared` that holds it. `found` is
     * the kept draw with the same inputs, when there was one without geometry. A draw whose place held another
     * draw twice running is kept without its geometry until it is found the same once; a record without
     * geometry that stood at its place is written over, so a draw that changes in every frame allocates nothing here.
     */
    keep(ordinal, found, command, material, region, page, geometry, prepared, preparedVertices, predicates, tupleComparisons) {
        const polygons = prepared.polygons, vertexReservation = prepared.vertexReservation, room = this.#limit - this.#nextBytes - this.#batchBytes;
        if (this.#nextCount >= SHARED_RETAINED_DRAWS_2D)
            return undefined;
        const stood = found === undefined ? this.#kept[ordinal + this.#shift] : undefined, before = stood !== undefined && stood.frame !== this.#frame ? stood : undefined;
        const changes = before !== undefined ? before.changes + 1 : 0;
        if (changes >= 2) {
            if (ENTRY_BYTES > room)
                return undefined;
            // Only a record that already was without geometry is written over: a frame that is refused must leave what was kept.
            let entry = before;
            if (entry.polygons === undefined) {
                entry.command = command;
                entry.material = material;
                entry.region = region;
                entry.page = page;
                entry.geometry = geometry;
                entry.frame = this.#frame;
            }
            else
                entry = {
                    command,
                    material,
                    region,
                    page,
                    geometry,
                    polygons: undefined,
                    vertexReservation: 0,
                    geometryCost: undefined,
                    rows: undefined,
                    vertexCount: 0,
                    rowsCost: undefined,
                    prepared: undefined,
                    rested: false,
                    packed: undefined,
                    changes: 2,
                    bytes: ENTRY_BYTES,
                    frame: this.#frame
                };
            this.#next[ordinal] = entry;
            this.#nextBytes += ENTRY_BYTES;
            this.#nextCount++;
            return undefined;
        }
        const bytes = ENTRY_BYTES + polygonBytes(polygons);
        if (bytes > room)
            return undefined;
        const entry = {
            command,
            material,
            region,
            page,
            geometry,
            polygons,
            vertexReservation,
            geometryCost: { preparedVertices, predicates, tupleComparisons },
            rows: undefined,
            vertexCount: 0,
            rowsCost: undefined,
            prepared,
            rested: false,
            packed: undefined,
            changes,
            bytes,
            frame: this.#frame
        };
        this.#next[ordinal] = entry;
        this.#nextBytes += bytes;
        this.#nextCount++;
        return entry;
    }
    /** The geometry of the frame is complete: what it kept replaces what was kept before. */
    commit() {
        if (this.#next === undefined)
            return;
        this.#kept = this.#next;
        this.#bytes = this.#nextBytes;
        this.#next = undefined;
    }
    /** A frame that did not complete its geometry leaves what was kept before as it was. */
    abandon() {
        this.#next = undefined;
    }
    /** Keeps a copy of the rows a kept draw was just given, while there is room. */
    keepRows(entry, rows, vertexCount, cost) {
        if (entry.rows !== undefined || entry.polygons === undefined || rows.byteLength > this.#limit - this.bytes)
            return;
        entry.rows = rows.slice();
        entry.vertexCount = vertexCount;
        entry.rowsCost = cost;
        entry.bytes += rows.byteLength;
        this.#bytes += rows.byteLength;
    }
    /**
     * Keeps the packed record of a draw that rested, while there is room. The rows of the record become the
     * kept rows of the draw: they are the same rows, with the place of the region and the opacity of this frame.
     */
    keepPacked(entry, packed) {
        if (entry.packed !== undefined ||
            entry.rows === undefined ||
            packed.data.byteLength !== entry.rows.byteLength ||
            PACKED_BYTES > this.#limit - this.bytes)
            return false;
        entry.packed = packed;
        entry.rows = packed.data;
        entry.bytes += PACKED_BYTES;
        this.#bytes += PACKED_BYTES;
        return true;
    }
    /** Starts the batches of a frame. Until they are complete, the batches kept before stay kept. */
    beginBatches() {
        this.#nextBatches = new Map();
        this.#nextBatchBytes = 0;
    }
    /** The kept batch whose first draw was at this place in its frame. */
    findBatch(ordinal) {
        return this.#batches.get(ordinal);
    }
    /** A kept batch that is a batch of this frame stays kept. */
    carryBatch(batch) {
        if (this.#nextBatches === undefined)
            return;
        this.#nextBatches.set(batch.ordinal, batch);
        this.#nextBatchBytes += batch.bytes;
    }
    /** Whether there is room to keep a batch of this many draws with these joined rows. */
    roomForBatch(draws, joinedBytes) {
        return (this.#nextBatches !== undefined &&
            draws >= 2 &&
            BATCH_BYTES + joinedBytes + 24 + 16 * draws <= this.#limit - this.#bytes - this.#nextBatchBytes);
    }
    /** Keeps a batch this frame joined. The caller has asked whether there is room. */
    keepBatch(members, lengths, pages, joined) {
        if (!this.roomForBatch(members.length, joined.data.byteLength))
            return;
        const ordinal = joined.prepared.command.ordinal, bytes = BATCH_BYTES + joined.data.byteLength + 24 + 16 * members.length;
        this.#nextBatches.set(ordinal, { ordinal, members, lengths, pages, joined, bytes });
        this.#nextBatchBytes += bytes;
    }
    /** The batches of the frame are complete: what it kept replaces what was kept before. */
    commitBatches() {
        if (this.#nextBatches === undefined)
            return;
        this.#batches = this.#nextBatches;
        this.#batchBytes = this.#nextBatchBytes;
        this.#nextBatches = undefined;
    }
}
//# sourceMappingURL=sharedPreparationRetention2D.js.map