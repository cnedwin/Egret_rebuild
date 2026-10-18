import type { ImageData2D, RectangleCommand2D, TexturedGeometry2D, TexturedRenderCommand2D } from '@egret/contracts';
import type { PreparationBudget2D, RectanglePreparationOptions } from './prepareRectangles2D.js';

export interface PreparedStageCost2D {
    readonly preparedVertices: number;
    readonly predicates: number;
    readonly tupleComparisons: number;
}
export interface PreparedStageValue2D<T> {
    readonly value: T;
    readonly cost: PreparedStageCost2D;
    readonly commandIndices: readonly number[] | undefined;
}
export interface PreparedCacheSettings2D extends RectanglePreparationOptions {
    readonly maxSourceTriangles?: number;
    readonly maxTupleComparisons?: number;
}
export interface PreparedCacheContext2D {
    readonly cache: PreparedFrameCache2D;
    readonly profile: 0 | 1 | 2 | 3;
    readonly settings: PreparedCacheSettings2D;
}
/** An opaque call-local key, never a retained frame, table or command array. */
export interface PreparedCacheSlot2D { readonly kind: 'prepared-cache-slot'; }
type Stage = 'geometry' | 'packing';
interface Key {
    readonly address: number;
    numbers: number[];
    image: ImageData2D | undefined;
    geometry: TexturedGeometry2D | undefined;
    resourceBytes: number;
}
interface SlotOwner {
    readonly cache: PreparedFrameCache2D;
    readonly address: number;
    readonly call: object;
    readonly observation: object;
    key: Key | undefined;
    mode: 'full' | 'rearm' | 'probe' | 'disabled';
}
interface Entry {
    key: Key | undefined;
    geometry: PreparedStageValue2D<unknown> | undefined;
    packing: PreparedStageValue2D<unknown> | undefined;
    // Fixed bookkeeping remains within the 256-byte entry allowance. Owned
    // stage records are read-only, so their measured charges remain stable.
    geometryBytes: number;
    packingBytes: number;
    // An empty call stamp never retains its context or input resources. A pending
    // observation stamp has no back-reference to its slot or call-local key.
    probe: boolean;
    replacedWithoutHit: boolean;
    lastCall: object;
    observation: object | boolean;
    bytes: number;
    previous: Entry | undefined;
    next: Entry | undefined;
}
const MAX_ENTRIES = 4096, MAX_BYTES = 16_777_216;
const NativeMap = Map, NativeWeakMap = WeakMap, NativeSet = Set, NativeFloat32Array = Float32Array;
const apply = Reflect.apply, ownKeys = Reflect.ownKeys, descriptor = Object.getOwnPropertyDescriptor;
const prototype = Object.getPrototypeOf, isArray = Array.isArray, sameNumber = Object.is;
const plainPrototype = Object.prototype, arrayPrototype = Array.prototype;
const mapGet = Map.prototype.get, mapSet = Map.prototype.set, mapDelete = Map.prototype.delete;
const weakGet = WeakMap.prototype.get, weakSet = WeakMap.prototype.set;
const setHas = Set.prototype.has, setAdd = Set.prototype.add;
const TOO_LARGE = {};
let slots: WeakMap<object, SlotOwner> | undefined;
let contexts: WeakMap<object, object> | undefined;
try { slots = new NativeWeakMap<object, SlotOwner>(); contexts = new NativeWeakMap<object, object>(); }
catch { /* Optional cache metadata may be unavailable. */ }
const get = <K, V>(map: Map<K, V>, key: K): V | undefined => apply(mapGet, map, [key]) as V | undefined;
const set = <K, V>(map: Map<K, V>, key: K, value: V): void => { apply(mapSet, map, [key, value]); };
function owner(slot: PreparedCacheSlot2D | undefined): SlotOwner | undefined {
    return slot === undefined || slots === undefined ? undefined : apply(weakGet, slots, [slot]) as SlotOwner | undefined;
}
function validCost(cost: PreparedStageCost2D): boolean {
    return Number.isSafeInteger(cost.preparedVertices) && cost.preparedVertices >= 0
        && Number.isSafeInteger(cost.predicates) && cost.predicates >= 0
        && Number.isSafeInteger(cost.tupleComparisons) && cost.tupleComparisons >= 0;
}
function sum(first: number, second: number): number {
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) || first < 0 || second < 0 || second > MAX_BYTES - first) throw TOO_LARGE;
    return first + second;
}
function equal(first: Key, second: Key): boolean {
    if (first.image !== second.image || first.geometry !== second.geometry || first.numbers.length !== second.numbers.length) return false;
    for (let index = 0; index < first.numbers.length; index++) if (!sameNumber(first.numbers[index], second.numbers[index])) return false;
    return true;
}
/** Only first-party data records and Float32 payloads enter retained stage values. */
function size(value: unknown, seen: Set<object>): number {
    if (value === null || typeof value !== 'object') {
        if (value !== undefined && typeof value !== 'number' && typeof value !== 'boolean') throw new TypeError('Optional cache data value');
        return 0;
    }
    if (apply(setHas, seen, [value])) return 0;
    apply(setAdd, seen, [value]);
    if (value instanceof NativeFloat32Array) return sum(32 + 8 * 3, value.byteLength);
    const array = isArray(value);
    if (prototype(value) !== (array ? arrayPrototype : plainPrototype)) throw new TypeError('Optional cache data record');
    let total = array ? sum(24, (value as unknown[]).length * 8) : 32;
    for (const key of ownKeys(value)) {
        if (array && key === 'length') continue;
        const field = descriptor(value, key);
        if (typeof key !== 'string' || !field || !('value' in field)) throw new TypeError('Optional cache data property');
        if (!array) total = sum(total, 8);
        total = sum(total, size(field.value, seen));
    }
    return total;
}
function copy<T>(value: T, seen: Map<object, unknown>): T {
    if (value === null || typeof value !== 'object') return value;
    const prior = get(seen, value); if (prior !== undefined) return prior as T;
    if (value instanceof NativeFloat32Array) {
        const result = new NativeFloat32Array(value.length);
        for (let index = 0; index < value.length; index++) result[index] = value[index]!;
        set(seen, value, result); return result as T;
    }
    const result: unknown[] | Record<string, unknown> = isArray(value) ? [] : {};
    set(seen, value, result);
    for (const key of ownKeys(value)) {
        if (isArray(value) && key === 'length') continue;
        const field = descriptor(value, key)!;
        (result as Record<string, unknown>)[key as string] = copy(field.value, seen);
    }
    return result as T;
}
/** Copy only the validated private numeric sequence, preserving signed zero. */
function copyKey(key: Key): Key {
    const numbers: number[] = [];
    for (let index = 0; index < key.numbers.length; index++) numbers[index] = key.numbers[index]!;
    return { address: key.address, numbers, image: key.image, geometry: key.geometry, resourceBytes: key.resourceBytes };
}
function keySize(key: Key): number { return sum(sum(32 + 8 * 5, 24 + key.numbers.length * 8), key.resourceBytes); }
function addressOf(context: PreparedCacheContext2D, run: boolean, ordinal: number): number {
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > Math.floor((Number.MAX_SAFE_INTEGER - 7) / 8)) throw TOO_LARGE;
    // The ordinal selects one candidate, never a resource or value identity.
    return 8 * ordinal + 2 * context.profile + (run ? 1 : 0);
}
/** The same ordered numeric walk builds full keys and observes numeric probes. */
function visitNumbers(context: PreparedCacheContext2D, commands: readonly TexturedRenderCommand2D[], width: number, height: number,
    run: boolean, visit: (value: number, index: number) => void): number {
    let length = 0;
    const append = (value: number): void => {
        if (!Number.isFinite(value) || length >= (MAX_BYTES - 1024) / 8) throw new RangeError('Optional cache key');
        visit(value, length++);
    };
    const matrix = (value: TexturedRenderCommand2D['matrix']): void => {
        append(value.a); append(value.b); append(value.c); append(value.d); append(value.tx); append(value.ty);
    };
    const rectangle = (value: RectangleCommand2D['rect']): void => { append(value.x); append(value.y); append(value.width); append(value.height); };
    const settings = context.settings;
    append(context.profile); append(width); append(height); append(settings.pixelRatio);
    append(settings.maxPreparedVertices); append(settings.maxClipEdgeTests);
    append(settings.maxSourceTriangles ?? 0); append(settings.maxTupleComparisons ?? 0);
    append(run ? 1 : 0); append(commands.length);
    for (const command of commands) {
        append(command.kind === 'rect' ? 0 : command.kind === 'image' ? 1 : 2); matrix(command.matrix);
        if (command.kind !== 'mesh') rectangle(command.rect);
        append(command.alpha);
        if (command.kind === 'rect') append(command.color); else rectangle(command.sourceRect);
        append(command.clips.length);
        for (const clip of command.clips) { matrix(clip.matrix); rectangle(clip.rect); }
    }
    return length;
}
function buildKey(context: PreparedCacheContext2D, commands: readonly TexturedRenderCommand2D[], width: number, height: number,
    image: ImageData2D | undefined, geometry: TexturedGeometry2D | undefined, run: boolean, address: number): Key {
    const values: number[] = [];
    visitNumbers(context, commands, width, height, run, (value, index) => { values[index] = value; });
    let resourceBytes = image === undefined ? 0 : sum(32 + 8 * 8, image.byteLength);
    if (geometry !== undefined) {
        resourceBytes = sum(resourceBytes, sum(32 + 8 * 8, geometry.logicalByteLength));
        for (const array of [geometry.positions, geometry.uvs, geometry.lightColors, geometry.indices]) {
            resourceBytes = sum(resourceBytes, sum(24, 8 * array.length));
        }
    }
    return { address, numbers: values, image, geometry, resourceBytes };
}

/** One Host owns the combined geometry/packing allowance and its terminal clear. */
export class PreparedFrameCache2D {
    private candidates: Map<number, Entry> | undefined;
    private oldest: Entry | undefined;
    private newest: Entry | undefined;
    private entries = 0;
    private bytes = 0;
    private reserved = 0;
    private peakBytes = 0;
    private peakEntries = 0;
    public constructor() { try { if (slots !== undefined && contexts !== undefined) this.candidates = new NativeMap<number, Entry>(); } catch { /* Cold operation remains available. */ } }
    public context(profile: 0 | 1 | 2 | 3, settings: PreparedCacheSettings2D): PreparedCacheContext2D | undefined {
        if (!this.candidates || !contexts) return undefined;
        try {
            const context: PreparedCacheContext2D = { cache: this, profile, settings: { pixelRatio: settings.pixelRatio, maxPreparedVertices: settings.maxPreparedVertices,
                maxClipEdgeTests: settings.maxClipEdgeTests, ...(settings.maxSourceTriangles === undefined ? {} : { maxSourceTriangles: settings.maxSourceTriangles }),
                ...(settings.maxTupleComparisons === undefined ? {} : { maxTupleComparisons: settings.maxTupleComparisons }) } };
            apply(weakSet, contexts, [context, {}]); return context;
        } catch { this.clear(); return undefined; }
    }
    public slot(context: PreparedCacheContext2D, commands: readonly TexturedRenderCommand2D[], width: number, height: number,
        image?: ImageData2D, geometry?: TexturedGeometry2D, run = false, ordinal = 0): PreparedCacheSlot2D | undefined {
        if (!this.candidates || context.cache !== this || !slots || !contexts) return undefined;
        try {
            const call = apply(weakGet, contexts, [context]) as object | undefined;
            if (call === undefined) return undefined;
            const address = addressOf(context, run, ordinal);
            const selected: SlotOwner = { cache: this, address, call, observation: {}, key: undefined, mode: 'full' };
            const prior = get(this.candidates, address);
            if (prior?.probe && prior.key) {
                const wasObserved = prior.observation === true, previousCall = prior.lastCall;
                // Cancel readiness before any in-place observation. Only this
                // empty stamp's successful producer may make it ready again.
                prior.observation = selected.observation; prior.lastCall = call;
                selected.mode = 'probe';
                const numbers = prior.key.numbers;
                let stable = true;
                const length = visitNumbers(context, commands, width, height, run, (value, index) => {
                    if (index >= numbers.length) { stable = false; return; }
                    if (!sameNumber(numbers[index], value)) stable = false;
                    numbers[index] = value;
                });
                if (length !== numbers.length) {
                    // Never grow retained storage during observation, and never
                    // let this slot's later packing re-create the discarded entry.
                    this.remove(prior); selected.mode = 'disabled';
                } else if (stable && wasObserved && previousCall !== call) selected.mode = 'rearm';
            }
            if (selected.mode === 'full' || selected.mode === 'rearm') {
                // This scratch key is never retained directly. Only successful
                // publication reserves and copies complete owned key authority.
                selected.key = buildKey(context, commands, width, height, image, geometry, run, address);
                if (keySize(selected.key) > MAX_BYTES - 256) return undefined;
            }
            const slot: PreparedCacheSlot2D = { kind: 'prepared-cache-slot' };
            apply(weakSet, slots, [slot, selected]); return slot;
        } catch { return undefined; }
    }
    private find(selected: SlotOwner): Entry | undefined {
        if (!this.candidates || !selected.key || selected.mode === 'probe' || selected.mode === 'disabled') return undefined;
        const entry = get(this.candidates, selected.address);
        return entry?.key && !entry.probe && equal(entry.key, selected.key) ? entry : undefined;
    }
    private unlink(entry: Entry): void {
        if (entry.previous) entry.previous.next = entry.next; else this.oldest = entry.next;
        if (entry.next) entry.next.previous = entry.previous; else this.newest = entry.previous;
        entry.previous = undefined; entry.next = undefined;
    }
    private append(entry: Entry): void {
        entry.previous = this.newest;
        if (this.newest) this.newest.next = entry; else this.oldest = entry;
        this.newest = entry;
    }
    private remove(entry: Entry): void {
        const key = entry.key;
        if (!key || !this.candidates) return;
        apply(mapDelete, this.candidates, [key.address]);
        this.unlink(entry); this.entries--; this.bytes -= entry.bytes;
        entry.key = undefined; entry.geometry = undefined; entry.packing = undefined;
    }
    public read<T>(selected: SlotOwner, stage: Stage): PreparedStageValue2D<T> | undefined {
        try { return this.find(selected)?.[stage] as PreparedStageValue2D<T> | undefined; }
        catch { this.clear(); return undefined; }
    }
    public touch(selected: SlotOwner): void {
        try {
            const entry = this.find(selected);
            if (entry) {
                // Only accepted replay, after required-copy success, resets the
                // replacement history. A probe has no stage to accept.
                entry.replacedWithoutHit = false;
                if (entry !== this.newest) { this.unlink(entry); this.append(entry); }
            }
        } catch { this.clear(); }
    }
    private convertToProbe(entry: Entry, selected: SlotOwner): void {
        const retained = entry.key!, current = selected.key!;
        selected.mode = 'probe'; selected.key = undefined;
        if (retained.numbers.length !== current.numbers.length) {
            this.remove(entry); selected.mode = 'disabled'; return;
        }
        const bytes = 256 + 72 + 24 + 8 * retained.numbers.length, previousBytes = entry.bytes;
        for (let index = 0; index < retained.numbers.length; index++) retained.numbers[index] = current.numbers[index]!;
        // The probe keeps only charged numeric metadata. Release all strong
        // resource/payload ownership before refunding those logical charges.
        retained.image = undefined; retained.geometry = undefined; retained.resourceBytes = 0;
        entry.geometry = undefined; entry.packing = undefined; entry.geometryBytes = 0; entry.packingBytes = 0;
        entry.probe = true; entry.replacedWithoutHit = true; entry.lastCall = selected.call; entry.observation = true;
        entry.bytes = bytes; this.bytes -= previousBytes - bytes;
        if (entry !== this.newest) { this.unlink(entry); this.append(entry); }
    }
    public publish<T>(selected: SlotOwner, stage: Stage, value: T, cost: PreparedStageCost2D, commandIndices?: readonly number[]): void {
        if (!this.candidates || !validCost(cost) || selected.mode === 'disabled') return;
        try {
            const prior = get(this.candidates, selected.address);
            if (selected.mode === 'probe') {
                if (prior?.probe && prior.lastCall === selected.call && prior.observation === selected.observation) {
                    prior.observation = true;
                    if (prior !== this.newest) { this.unlink(prior); this.append(prior); }
                }
                return;
            }
            const key = selected.key;
            if (!key) return;
            // A slot created before another slot converted the address cannot
            // rearm it. Only the current stable observation grants a cold rebuild.
            if (prior?.probe && (selected.mode !== 'rearm' || prior.observation !== selected.observation)) return;
            const matched = prior?.key && !prior.probe && equal(prior.key, key) ? prior : undefined;
            const previousCall = prior?.lastCall;
            if (prior && !prior.probe && !matched && prior.replacedWithoutHit && previousCall !== selected.call) {
                // The original computation succeeded; skip optional size/copy
                // now, before doing either stage's generic payload traversal.
                this.convertToProbe(prior, selected); return;
            }
            const replacedWithoutHit = prior?.probe ? true : matched ? matched.replacedWithoutHit
                : prior ? previousCall === selected.call ? prior.replacedWithoutHit : true : false;
            // Capture transferred ownership and its charge before remove clears
            // the old entry. An exact match reuses its immutable owned key.
            const retainedKey = matched?.key;
            const other = matched?.[stage === 'geometry' ? 'packing' : 'geometry'];
            const otherBytes = matched ? matched[stage === 'geometry' ? 'packingBytes' : 'geometryBytes'] : 0;
            const source: PreparedStageValue2D<T> = { value, cost, commandIndices };
            // Each stage receives an independent owned copy. Source references
            // shared across stages must therefore pay for both retained copies.
            const stageBytes = size(source, new NativeSet<object>());
            const bytes = sum(sum(sum(256, keySize(key)), stageBytes), otherBytes);
            if (prior) this.remove(prior);
            while (this.oldest && (this.entries >= MAX_ENTRIES || bytes > MAX_BYTES - this.bytes)) this.remove(this.oldest);
            if (this.entries >= MAX_ENTRIES || bytes > MAX_BYTES - this.bytes) return;
            // Reserve before allocating cache-owned copies. The original required
            // geometry/typed payload already succeeded outside this optional scope.
            this.reserved = bytes; this.peakBytes = Math.max(this.peakBytes, this.bytes + bytes);
            const ownedKey = retainedKey ?? copyKey(key);
            const owned = copy(source, new NativeMap<object, unknown>());
            // The original 256-byte fixed bookkeeping allowance also covers the
            // extra fields and two empty stamps: 128 + 32 + 32 + 48 = 240 bytes.
            // Variable numeric storage, resource ownership and stages pay extra.
            const entry: Entry = { key: ownedKey, geometry: stage === 'geometry' ? owned : other,
                packing: stage === 'packing' ? owned : other,
                geometryBytes: stage === 'geometry' ? stageBytes : otherBytes,
                packingBytes: stage === 'packing' ? stageBytes : otherBytes,
                probe: false, replacedWithoutHit, lastCall: selected.call, observation: false,
                bytes, previous: undefined, next: undefined };
            set(this.candidates, key.address, entry); this.append(entry); this.entries++; this.bytes += bytes; this.reserved = 0;
            this.peakEntries = Math.max(this.peakEntries, this.entries);
        } catch (cause) { this.reserved = 0; if (cause !== TOO_LARGE) this.clear(); }
    }
    /** Terminal invalidation cannot be undone by an already-created call-local slot. */
    public clear(): void { this.candidates = undefined; this.oldest = undefined; this.newest = undefined; this.entries = 0; this.bytes = 0; this.reserved = 0; }
    /** Private UNIT/diagnostic logical accounting; no keys, resources or GPU authority. */
    public snapshot(): { readonly entries: number; readonly bytes: number; readonly reservedBytes: number; readonly peakEntries: number; readonly peakBytes: number; readonly enabled: boolean } {
        return { entries: this.entries, bytes: this.bytes, reservedBytes: this.reserved, peakEntries: this.peakEntries, peakBytes: this.peakBytes, enabled: this.candidates !== undefined };
    }
}
export function readPreparedStage2D<T>(slot: PreparedCacheSlot2D | undefined, stage: Stage): PreparedStageValue2D<T> | undefined {
    const selected = owner(slot); return selected?.cache.read<T>(selected, stage);
}
export function acceptPreparedStage2D(slot: PreparedCacheSlot2D | undefined): void { const selected = owner(slot); if (selected) selected.cache.touch(selected); }
export function publishPreparedStage2D<T>(slot: PreparedCacheSlot2D | undefined, stage: Stage, value: T,
    cost: PreparedStageCost2D, commandIndices?: readonly number[]): void {
    const selected = owner(slot); if (selected) selected.cache.publish(selected, stage, value, cost, commandIndices);
}
export function tryReplayPreparedStage2D(budget: PreparationBudget2D | undefined, cost: PreparedStageCost2D): boolean {
    if (!validCost(cost)) return false;
    return budget === undefined || budget.tryReplayStageCost?.(cost) === true;
}
/** Required per-submission allocation stays outside every optional-cache catch. */
export function copyPreparedPacking2D<T extends { readonly data: Float32Array<ArrayBuffer> }>(value: T): T {
    const data = new Float32Array(value.data.length);
    for (let index = 0; index < value.data.length; index++) data[index] = value.data[index]!;
    return { ...value, data };
}
