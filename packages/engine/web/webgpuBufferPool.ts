import type { OwnedWebGPUBuffer } from './webgpuLifetime.js';

export type SubmissionBufferRole = 'vertex' | 'index' | 'uniform';
export interface SubmissionBufferRequest {
    readonly id: number;
    readonly role: SubmissionBufferRole;
    readonly usage: 40 | 24 | 72;
    readonly byteLength: number;
}
export interface BufferHandle {
    readonly identity: object;
    readonly session: object;
    readonly resource: OwnedWebGPUBuffer;
    readonly usage: 40 | 24 | 72;
    readonly byteLength: number;
}
export interface SubmissionBufferLease {
    readonly requestId: number;
    readonly handle: BufferHandle;
    readonly offset: 0;
    readonly size: number;
}
export interface BufferReusePlan {
    readonly session: object;
    readonly revision: object;
    readonly requests: readonly SubmissionBufferRequest[];
    readonly matches: ReadonlyMap<number, BufferHandle>;
    readonly leases: readonly SubmissionBufferLease[];
    readonly victims: readonly BufferHandle[];
}
export interface BufferReturnPlan {
    readonly identity: object;
    readonly retained: readonly BufferHandle[];
    readonly transient: readonly BufferHandle[];
}
export interface WebGPUBufferPool {
    plan(requests: readonly SubmissionBufferRequest[]): BufferReusePlan;
    claim(plan: BufferReusePlan): readonly SubmissionBufferLease[];
    registerCreated(request: SubmissionBufferRequest, resource: OwnedWebGPUBuffer): SubmissionBufferLease;
    reserveReturns(leases: readonly SubmissionBufferLease[]): BufferReturnPlan;
    publishReturns(plan: BufferReturnPlan): readonly BufferHandle[];
    cancelReturns(plan: BufferReturnPlan): readonly BufferHandle[];
    detach(handle: BufferHandle): void;
    destroyed(handle: BufferHandle, succeeded: boolean): void;
    invalidate(): void;
    detachIdleForClose(): readonly BufferHandle[];
}

// Capture callback-free collection operations before any Host native callback.
// Claim uses only these operations and preallocated nodes/leases after detaching.
const NativeMap = Map, NativeSet = Set, NativeWeakMap = WeakMap, NativeWeakSet = WeakSet;
const mapGet = Function.prototype.call.bind(Map.prototype.get) as <K, V>(map: Map<K, V>, key: K) => V | undefined;
const mapSet = Function.prototype.call.bind(Map.prototype.set) as <K, V>(map: Map<K, V>, key: K, value: V) => Map<K, V>;
const mapHas = Function.prototype.call.bind(Map.prototype.has) as <K, V>(map: Map<K, V>, key: K) => boolean;
const mapDelete = Function.prototype.call.bind(Map.prototype.delete) as <K, V>(map: Map<K, V>, key: K) => boolean;
const setAdd = Function.prototype.call.bind(Set.prototype.add) as <T>(set: Set<T>, value: T) => Set<T>;
const setHas = Function.prototype.call.bind(Set.prototype.has) as <T>(set: Set<T>, value: T) => boolean;
const weakGet = Function.prototype.call.bind(WeakMap.prototype.get) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakSet = Function.prototype.call.bind(WeakMap.prototype.set) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => WeakMap<K, V>;
const weakHas = Function.prototype.call.bind(WeakSet.prototype.has) as <T extends object>(set: WeakSet<T>, value: T) => boolean;
const weakAdd = Function.prototype.call.bind(WeakSet.prototype.add) as <T extends object>(set: WeakSet<T>, value: T) => WeakSet<T>;
const MAX_IDLE_BYTES = 33554432;
const MAX_IDLE_ENTRIES = 4096;
// A captured resource may acquire exactly one allocation identity, even when two
// Hosts borrow one device. Native object identity alone is not an allocation ID.
const registeredResources = new NativeWeakSet<OwnedWebGPUBuffer>();
type OwnerState = 'leased' | 'reserved' | 'idle' | 'detached' | 'unknown' | 'destroyed';
interface Bucket {
    readonly usage: 40 | 24 | 72;
    readonly byteLength: number;
    readonly sizes: Map<number, Bucket>;
    head: BufferNode | undefined;
    tail: BufferNode | undefined;
}
interface BufferNode {
    readonly handle: BufferHandle;
    state: OwnerState;
    lease: SubmissionBufferLease | undefined;
    bucket: Bucket | undefined;
    keyPrevious: BufferNode | undefined;
    keyNext: BufferNode | undefined;
    previous: BufferNode | undefined;
    next: BufferNode | undefined;
}
interface ClaimState {
    readonly revision: object;
    readonly nextRevision: object;
    readonly matches: readonly BufferNode[];
    readonly victims: readonly BufferNode[];
    readonly leases: readonly SubmissionBufferLease[];
    consumed: boolean;
}
interface ReturnState {
    readonly nodes: readonly BufferNode[];
    consumed: boolean;
}
interface Charge { bytes: number; count: number }

/** Callback-free allocation metadata. Host alone decides proofs and runs GPU calls. */
export function createWebGPUBufferPool(session: object): WebGPUBufferPool {
    const indexes = new NativeMap<40 | 24 | 72, Map<number, Bucket>>();
    // Usage directories are fixed; empty exact-size buckets are always pruned.
    mapSet(indexes, 40, new NativeMap()); mapSet(indexes, 24, new NativeMap()); mapSet(indexes, 72, new NativeMap());
    const nodes = new NativeWeakMap<BufferHandle, BufferNode>();
    const leaseNodes = new NativeWeakMap<SubmissionBufferLease, BufferNode>();
    const claims = new NativeWeakMap<BufferReusePlan, ClaimState>();
    const returns = new NativeWeakMap<BufferReturnPlan, ReturnState>();
    const idle: Charge = { bytes: 0, count: 0 }, leased: Charge = { bytes: 0, count: 0 };
    const reserved: Charge = { bytes: 0, count: 0 }, detached: Charge = { bytes: 0, count: 0 };
    const unknown: Charge = { bytes: 0, count: 0 };
    let head: BufferNode | undefined, tail: BufferNode | undefined;
    let revision: object = {}, active = true;

    function requireActive(): void { if (!active) throw new TypeError('Inactive buffer pool'); }
    function requireNode(handle: BufferHandle): BufferNode {
        const node = weakGet(nodes, handle);
        if (!node) throw new TypeError('Foreign buffer handle');
        return node;
    }
    function validateRequest(request: SubmissionBufferRequest): void {
        if (!Number.isSafeInteger(request.id) || request.id < 0
            || (request.role !== 'vertex' && request.role !== 'index' && request.role !== 'uniform')
            || (request.usage !== 40 && request.usage !== 24 && request.usage !== 72)
            || !Number.isSafeInteger(request.byteLength) || request.byteLength <= 0 || request.byteLength % 4 !== 0) {
            throw new TypeError('Invalid submission buffer request');
        }
    }
    function charge(total: Charge, node: BufferNode, direction: 1 | -1): void {
        total.bytes += direction * node.handle.byteLength; total.count += direction;
    }
    function leaseFor(request: SubmissionBufferRequest, node: BufferNode): SubmissionBufferLease {
        const lease: SubmissionBufferLease = Object.freeze({ requestId: request.id, handle: node.handle, offset: 0, size: request.byteLength });
        weakSet(leaseNodes, lease, node);
        return lease;
    }
    /** All links already exist before claim; unlinking publishes no new owner. */
    function unlink(node: BufferNode): void {
        const bucket = node.bucket!;
        if (node.keyPrevious) node.keyPrevious.keyNext = node.keyNext; else bucket.head = node.keyNext;
        if (node.keyNext) node.keyNext.keyPrevious = node.keyPrevious; else bucket.tail = node.keyPrevious;
        if (node.previous) node.previous.next = node.next; else head = node.next;
        if (node.next) node.next.previous = node.previous; else tail = node.previous;
        if (!bucket.head) mapDelete(bucket.sizes, bucket.byteLength);
        node.bucket = undefined; node.keyPrevious = undefined; node.keyNext = undefined;
        node.previous = undefined; node.next = undefined;
        charge(idle, node, -1);
    }
    function append(node: BufferNode): void {
        const handle = node.handle, sizes = mapGet(indexes, handle.usage)!;
        let bucket = mapGet(sizes, handle.byteLength);
        if (!bucket) {
            bucket = { usage: handle.usage, byteLength: handle.byteLength, sizes, head: undefined, tail: undefined };
            // A failing metadata allocation leaves this node reservation-owned.
            mapSet(sizes, handle.byteLength, bucket);
        }
        node.bucket = bucket; node.keyPrevious = bucket.tail; node.keyNext = undefined;
        if (bucket.tail) bucket.tail.keyNext = node; else bucket.head = node;
        bucket.tail = node;
        node.previous = tail; node.next = undefined;
        if (tail) tail.next = node; else head = node;
        tail = node;
        charge(reserved, node, -1); charge(leased, node, -1); charge(idle, node, 1);
        node.state = 'idle'; node.lease = undefined;
    }
    function detachNode(node: BufferNode): void {
        if (node.state === 'idle') unlink(node);
        else if (node.state === 'reserved') { charge(reserved, node, -1); charge(leased, node, -1); }
        else if (node.state === 'leased') charge(leased, node, -1);
        else return;
        node.state = 'detached'; node.lease = undefined; charge(detached, node, 1);
    }
    function returnState(plan: BufferReturnPlan): ReturnState {
        const state = weakGet(returns, plan);
        if (!state || state.consumed) throw new TypeError('Foreign or consumed buffer return plan');
        return state;
    }

    return {
        plan(requests) {
            requireActive();
            const rows: SubmissionBufferRequest[] = [], matches = new NativeMap<number, BufferHandle>();
            const selected: BufferNode[] = [], leases: SubmissionBufferLease[] = [], victims: BufferNode[] = [];
            const cursors = new NativeMap<Bucket, BufferNode | undefined>(), protectedNodes = new NativeSet<BufferNode>();
            let incomingBytes = 0, incomingCount = 0, matchedBytes = 0;
            for (let i = 0; i < requests.length; i++) {
                const input = requests[i]!;
                const request = Object.freeze({ id: input.id, role: input.role, usage: input.usage, byteLength: input.byteLength });
                validateRequest(request);
                if (request.id !== i) throw new TypeError('Nonsequential buffer request');
                rows.push(request);
                if (request.byteLength <= MAX_IDLE_BYTES) {
                    // Saturating sums preserve pressure decisions for arbitrarily
                    // many admitted candidates without creating a new refusal.
                    incomingBytes = Math.min(MAX_IDLE_BYTES + 1, incomingBytes + request.byteLength);
                    incomingCount = Math.min(MAX_IDLE_ENTRIES + 1, incomingCount + 1);
                }
                const bucket = mapGet(mapGet(indexes, request.usage)!, request.byteLength);
                if (!bucket) continue;
                const node = mapHas(cursors, bucket) ? mapGet(cursors, bucket) : bucket.head;
                if (!node) continue;
                mapSet(cursors, bucket, node.keyNext); setAdd(protectedNodes, node); selected.push(node);
                mapSet(matches, request.id, node.handle); leases.push(leaseFor(request, node)); matchedBytes += node.handle.byteLength;
            }
            let remainingBytes = idle.bytes - matchedBytes, remainingCount = idle.count - selected.length;
            // Protect every exact hit before selecting one unmatched FIFO prefix.
            for (let node = head; node && (remainingBytes + reserved.bytes + incomingBytes > MAX_IDLE_BYTES
                || remainingCount + reserved.count + incomingCount > MAX_IDLE_ENTRIES); node = node.next) {
                if (setHas(protectedNodes, node)) continue;
                victims.push(node); remainingBytes -= node.handle.byteLength; remainingCount--;
            }
            const publicLeases = Object.freeze(leases), publicVictims = Object.freeze(victims.map(node => node.handle));
            const plan: BufferReusePlan = Object.freeze({ session, revision, requests: Object.freeze(rows), matches,
                leases: publicLeases, victims: publicVictims });
            weakSet(claims, plan, { revision, nextRevision: {}, matches: selected, victims, leases: publicLeases, consumed: false });
            return plan;
        },
        claim(plan) {
            requireActive();
            const state = weakGet(claims, plan);
            if (!state || state.consumed || state.revision !== revision) throw new TypeError('Foreign, stale or consumed buffer plan');
            // Host has already attached these exact leases and every victim to
            // persistent cleanup owners. No allocation follows the first unlink.
            state.consumed = true; revision = state.nextRevision;
            for (let i = 0; i < state.matches.length; i++) {
                const node = state.matches[i]!;
                unlink(node); node.state = 'leased'; node.lease = state.leases[i]!; charge(leased, node, 1);
            }
            for (let i = 0; i < state.victims.length; i++) detachNode(state.victims[i]!);
            return state.leases;
        },
        registerCreated(request, resource) {
            // Registration follows Host capture even if a native callback has
            // just invalidated reuse; it still records an owned cold allocation.
            validateRequest(request);
            if (weakHas(registeredResources, resource)) throw new TypeError('Already registered buffer resource');
            const handle: BufferHandle = Object.freeze({ identity: Object.freeze({}), session, resource,
                usage: request.usage, byteLength: request.byteLength });
            const node: BufferNode = { handle, state: 'leased', lease: undefined, bucket: undefined,
                keyPrevious: undefined, keyNext: undefined, previous: undefined, next: undefined };
            const lease = leaseFor(request, node), nextRevision = {};
            weakSet(nodes, handle, node); weakAdd(registeredResources, resource);
            node.lease = lease; charge(leased, node, 1); revision = nextRevision;
            return lease;
        },
        reserveReturns(leases) {
            const selected: BufferNode[] = [], retained: BufferHandle[] = [], transient: BufferHandle[] = [];
            const seen = new NativeSet<BufferNode>();
            let bytes = idle.bytes + reserved.bytes, count = idle.count + reserved.count;
            for (let i = 0; i < leases.length; i++) {
                const lease = leases[i]!, node = weakGet(leaseNodes, lease);
                if (!node || node.state !== 'leased' || node.lease !== lease || setHas(seen, node)) {
                    throw new TypeError('Foreign, duplicate or inactive buffer lease');
                }
                setAdd(seen, node);
                if (active && bytes + node.handle.byteLength <= MAX_IDLE_BYTES && count < MAX_IDLE_ENTRIES) {
                    selected.push(node); retained.push(node.handle); bytes += node.handle.byteLength; count++;
                } else transient.push(node.handle);
            }
            const plan: BufferReturnPlan = Object.freeze({ identity: Object.freeze({}), retained: Object.freeze(retained), transient: Object.freeze(transient) });
            const nextRevision = {};
            weakSet(returns, plan, { nodes: selected, consumed: false });
            // Reservations bound retention only: the leased allocation charge
            // remains until publication or detach, never counted twice as memory.
            for (let i = 0; i < selected.length; i++) { const node = selected[i]!; node.state = 'reserved'; charge(reserved, node, 1); }
            revision = nextRevision;
            return plan;
        },
        publishReturns(plan) {
            requireActive();
            const state = returnState(plan), nextRevision = {};
            for (let i = 0; i < state.nodes.length; i++) {
                if (state.nodes[i]!.state !== 'reserved') throw new TypeError('Detached return reservation');
            }
            // Keep the plan cancellable until every append succeeds. If an
            // allocation throws, cancellation also removes already-idle nodes.
            revision = nextRevision;
            for (let i = 0; i < state.nodes.length; i++) append(state.nodes[i]!);
            state.consumed = true;
            return plan.retained;
        },
        cancelReturns(plan) {
            const state = returnState(plan), cleanup: BufferHandle[] = [], nextRevision = {};
            for (let i = 0; i < state.nodes.length; i++) {
                const node = state.nodes[i]!;
                if (node.state === 'reserved' || node.state === 'idle' || node.state === 'detached') cleanup.push(node.handle);
            }
            const result = Object.freeze(cleanup);
            state.consumed = true; revision = nextRevision;
            for (let i = 0; i < state.nodes.length; i++) detachNode(state.nodes[i]!);
            return result;
        },
        detach(handle) { const node = requireNode(handle), nextRevision = {}; detachNode(node); revision = nextRevision; },
        destroyed(handle, succeeded) {
            const node = requireNode(handle);
            if (node.state === 'unknown' || node.state === 'destroyed') throw new TypeError('GPU buffer destruction already reported');
            const nextRevision = {};
            detachNode(node); charge(detached, node, -1);
            node.state = succeeded ? 'destroyed' : 'unknown';
            if (!succeeded) { charge(unknown, node, 1); active = false; }
            // Unknown destruction is a permanent charge, never available idle
            // capacity, and is never retried or later refunded by this pool.
            revision = nextRevision;
        },
        invalidate() { active = false; },
        detachIdleForClose() {
            const cleanup: BufferHandle[] = [];
            for (let node = head; node; node = node.next) cleanup.push(node.handle);
            const result = Object.freeze(cleanup), nextRevision = {};
            while (head) detachNode(head);
            revision = nextRevision;
            return result;
        },
    };
}
