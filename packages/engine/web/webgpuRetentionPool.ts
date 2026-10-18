import type { OwnedWebGPUBuffer, OwnedWebGPUTexture } from './webgpuLifetime.js';
export interface RetentionBufferRequest { readonly kind: 'buffer'; readonly id: number; readonly role: 'vertex' | 'index' | 'uniform'; readonly usage: 40 | 24 | 72; readonly byteLength: number; }
export interface RetentionTargetRequest { readonly kind: 'color' | 'depth'; readonly id: number; readonly width: number; readonly height: number; readonly format: 'rgba8unorm-srgb' | 'depth32float'; readonly usage: 20 | 16; readonly byteLength: number; readonly sampleCount: 1; readonly mipLevelCount: 1; readonly depthOrArrayLayers: 1; readonly recipe: 'egret.srgb-pma8-target/1' | 'egret.shared-reverse-depth/1'; }
export type RetentionRequest = RetentionBufferRequest | RetentionTargetRequest;
export type RetentionHandle = (RetentionBufferRequest & { readonly resource: OwnedWebGPUBuffer } | RetentionTargetRequest & { readonly resource: OwnedWebGPUTexture }) & { readonly identity: object; readonly session: object };
export interface RetentionLease { readonly requestId: number; readonly handle: RetentionHandle; readonly offset: 0; readonly size: number; }
export interface RetentionPlan { readonly session: object; readonly revision: object; readonly requests: readonly RetentionRequest[]; readonly matches: ReadonlyMap<number, RetentionHandle>; readonly leases: readonly RetentionLease[]; readonly victims: readonly RetentionHandle[]; }
export interface RetentionReturnPlan { readonly identity: object; readonly retained: readonly RetentionHandle[]; readonly transient: readonly RetentionHandle[]; }
export interface WebGPURetentionPool {
    plan(requests: readonly RetentionRequest[]): RetentionPlan;
    claim(plan: RetentionPlan): readonly RetentionLease[];
    registerCreated(request: RetentionRequest, resource: OwnedWebGPUBuffer | OwnedWebGPUTexture): RetentionLease;
    reserveReturns(leases: readonly RetentionLease[]): RetentionReturnPlan;
    publishReturns(plan: RetentionReturnPlan): readonly RetentionHandle[];
    cancelReturns(plan: RetentionReturnPlan): readonly RetentionHandle[];
    detach(handle: RetentionHandle): void; destroyed(handle: RetentionHandle, succeeded: boolean): void;
    invalidate(): void; detachIdleForClose(): readonly RetentionHandle[];
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
const registeredResources = new NativeWeakSet<OwnedWebGPUBuffer | OwnedWebGPUTexture>();
type OwnerState = 'leased' | 'reserved' | 'idle' | 'detached' | 'unknown' | 'destroyed';
interface Bucket {
    readonly key: string;
    readonly sizes: Map<string, Bucket>;
    head: RetentionNode | undefined;
    tail: RetentionNode | undefined;
}
interface RetentionNode {
    readonly handle: RetentionHandle;
    state: OwnerState;
    lease: RetentionLease | undefined;
    bucket: Bucket | undefined;
    keyPrevious: RetentionNode | undefined;
    keyNext: RetentionNode | undefined;
    previous: RetentionNode | undefined;
    next: RetentionNode | undefined;
}
interface ClaimState {
    readonly revision: object;
    readonly nextRevision: object;
    readonly matches: readonly RetentionNode[];
    readonly victims: readonly RetentionNode[];
    readonly leases: readonly RetentionLease[];
    consumed: boolean;
}
interface ReturnState {
    readonly nodes: readonly RetentionNode[];
    consumed: boolean;
}
interface Charge { bytes: number; count: number }

/** Callback-free allocation metadata. Host alone decides proofs and runs GPU calls. */
export function createWebGPURetentionPool(session: object): WebGPURetentionPool {
    const indexes = new NativeMap<string, Bucket>();
    const nodes = new NativeWeakMap<RetentionHandle, RetentionNode>();
    const leaseNodes = new NativeWeakMap<RetentionLease, RetentionNode>();
    const claims = new NativeWeakMap<RetentionPlan, ClaimState>();
    const returns = new NativeWeakMap<RetentionReturnPlan, ReturnState>();
    const idle: Charge = { bytes: 0, count: 0 }, leased: Charge = { bytes: 0, count: 0 };
    const reserved: Charge = { bytes: 0, count: 0 }, detached: Charge = { bytes: 0, count: 0 };
    const unknown: Charge = { bytes: 0, count: 0 };
    let head: RetentionNode | undefined, tail: RetentionNode | undefined;
    let revision: object = {}, active = true;

    function requireActive(): void { if (!active) throw new TypeError('Inactive buffer pool'); }
    function requireNode(handle: RetentionHandle): RetentionNode {
        const node = weakGet(nodes, handle);
        if (!node) throw new TypeError('Foreign buffer handle');
        return node;
    }
    function validateRequest(request: RetentionRequest): void {
        if (!Number.isSafeInteger(request.id) || request.id < 0 || !Number.isSafeInteger(request.byteLength)
            || request.byteLength <= 0 || request.byteLength % 4 !== 0) throw new TypeError('Invalid retention request');
        if (request.kind === 'buffer') {
            if ((request.role !== 'vertex' && request.role !== 'index' && request.role !== 'uniform')
                || (request.usage !== 40 && request.usage !== 24 && request.usage !== 72)) throw new TypeError('Invalid buffer request');
        } else if ((request.kind !== 'color' && request.kind !== 'depth') || !Number.isSafeInteger(request.width)
            || !Number.isSafeInteger(request.height) || request.width <= 0 || request.height <= 0
            || request.byteLength !== 4 * request.width * request.height || request.sampleCount !== 1
            || request.mipLevelCount !== 1 || request.depthOrArrayLayers !== 1
            || (request.kind === 'color' ? request.format !== 'rgba8unorm-srgb' || request.usage !== 20 || request.recipe !== 'egret.srgb-pma8-target/1'
                : request.format !== 'depth32float' || request.usage !== 16 || request.recipe !== 'egret.shared-reverse-depth/1')) {
            throw new TypeError('Invalid target request');
        }
    }
    function keyOf(value: RetentionRequest | RetentionHandle): string {
        return value.kind === 'buffer' ? 'buffer:' + value.usage + ':' + value.byteLength
            : value.kind + ':' + value.width + ':' + value.height + ':' + value.format + ':' + value.usage
                + ':' + value.sampleCount + ':' + value.mipLevelCount + ':' + value.depthOrArrayLayers + ':' + value.recipe;
    }
    function charge(total: Charge, node: RetentionNode, direction: 1 | -1): void {
        total.bytes += direction * node.handle.byteLength; total.count += direction;
    }
    function leaseFor(request: RetentionRequest, node: RetentionNode): RetentionLease {
        const lease: RetentionLease = Object.freeze({ requestId: request.id, handle: node.handle, offset: 0, size: request.byteLength });
        weakSet(leaseNodes, lease, node);
        return lease;
    }
    /** All links already exist before claim; unlinking publishes no new owner. */
    function unlink(node: RetentionNode): void {
        const bucket = node.bucket!;
        if (node.keyPrevious) node.keyPrevious.keyNext = node.keyNext; else bucket.head = node.keyNext;
        if (node.keyNext) node.keyNext.keyPrevious = node.keyPrevious; else bucket.tail = node.keyPrevious;
        if (node.previous) node.previous.next = node.next; else head = node.next;
        if (node.next) node.next.previous = node.previous; else tail = node.previous;
        if (!bucket.head) mapDelete(bucket.sizes, bucket.key);
        node.bucket = undefined; node.keyPrevious = undefined; node.keyNext = undefined;
        node.previous = undefined; node.next = undefined;
        charge(idle, node, -1);
    }
    function append(node: RetentionNode): void {
        const handle = node.handle, sizes = indexes, key = keyOf(handle);
        let bucket = mapGet(sizes, key);
        if (!bucket) {
            bucket = { key, sizes, head: undefined, tail: undefined };
            // A failing metadata allocation leaves this node reservation-owned.
            mapSet(sizes, key, bucket);
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
    function detachNode(node: RetentionNode): void {
        if (node.state === 'idle') unlink(node);
        else if (node.state === 'reserved') { charge(reserved, node, -1); charge(leased, node, -1); }
        else if (node.state === 'leased') charge(leased, node, -1);
        else return;
        node.state = 'detached'; node.lease = undefined; charge(detached, node, 1);
    }
    function returnState(plan: RetentionReturnPlan): ReturnState {
        const state = weakGet(returns, plan);
        if (!state || state.consumed) throw new TypeError('Foreign or consumed buffer return plan');
        return state;
    }

    return {
        plan(requests) {
            requireActive();
            const rows: RetentionRequest[] = [], matches = new NativeMap<number, RetentionHandle>();
            const selected: RetentionNode[] = [], leases: RetentionLease[] = [], victims: RetentionNode[] = [];
            const cursors = new NativeMap<Bucket, RetentionNode | undefined>(), protectedNodes = new NativeSet<RetentionNode>();
            let incomingBytes = 0, incomingCount = 0, matchedBytes = 0;
            for (let i = 0; i < requests.length; i++) {
                const input = requests[i]!;
                const request = Object.freeze({ ...input });
                validateRequest(request);
                if (request.id !== i) throw new TypeError('Nonsequential buffer request');
                rows.push(request);
                if (request.byteLength <= MAX_IDLE_BYTES) {
                    // Saturating sums preserve pressure decisions for arbitrarily
                    // many admitted candidates without creating a new refusal.
                    incomingBytes = Math.min(MAX_IDLE_BYTES + 1, incomingBytes + request.byteLength);
                    incomingCount = Math.min(MAX_IDLE_ENTRIES + 1, incomingCount + 1);
                }
                const bucket = mapGet(indexes, keyOf(request));
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
            const plan: RetentionPlan = Object.freeze({ session, revision, requests: Object.freeze(rows), matches,
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
            const handle = Object.freeze({ ...request, identity: Object.freeze({}), session, resource }) as RetentionHandle;
            const node: RetentionNode = { handle, state: 'leased', lease: undefined, bucket: undefined,
                keyPrevious: undefined, keyNext: undefined, previous: undefined, next: undefined };
            const lease = leaseFor(request, node), nextRevision = {};
            weakSet(nodes, handle, node); weakAdd(registeredResources, resource);
            node.lease = lease; charge(leased, node, 1); revision = nextRevision;
            return lease;
        },
        reserveReturns(leases) {
            const selected: RetentionNode[] = [], retained: RetentionHandle[] = [], transient: RetentionHandle[] = [];
            const seen = new NativeSet<RetentionNode>();
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
            const plan: RetentionReturnPlan = Object.freeze({ identity: Object.freeze({}), retained: Object.freeze(retained), transient: Object.freeze(transient) });
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
            const state = returnState(plan), cleanup: RetentionHandle[] = [], nextRevision = {};
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
            const cleanup: RetentionHandle[] = [];
            for (let node = head; node; node = node.next) cleanup.push(node.handle);
            const result = Object.freeze(cleanup), nextRevision = {};
            while (head) detachNode(head);
            revision = nextRevision;
            return result;
        },
    };
}
