import { createWebGPURetentionPool } from './webgpuRetentionPool.js';
import type { RetentionHandle, RetentionLease, RetentionPlan, RetentionReturnPlan, WebGPURetentionPool } from './webgpuRetentionPool.js';
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


// The legacy facade preserves its exact request shape and delegates every owner
// transition to the same finite authority used by shared color/depth targets.
const weakGet = Function.prototype.call.bind(WeakMap.prototype.get) as <K extends object,V>(map:WeakMap<K,V>,key:K)=>V|undefined;
const weakSet = Function.prototype.call.bind(WeakMap.prototype.set) as <K extends object,V>(map:WeakMap<K,V>,key:K,value:V)=>void;
export function createWebGPUBufferPool(session: object): WebGPUBufferPool {
    return createBufferPoolFacade(createWebGPURetentionPool(session));
}
/** Assembly-only; no second counter, session or FIFO is created by this view. */
export function createBufferPoolFacade(owner: WebGPURetentionPool): WebGPUBufferPool {
    const plans = new WeakMap<BufferReusePlan, RetentionPlan>();
    return {
        plan(requests) {
            const plan = owner.plan(requests.map(request => ({ ...request, kind: 'buffer' as const })));
            const result: BufferReusePlan = Object.freeze({ session: plan.session, revision: plan.revision,
                requests: Object.freeze(requests.map(request => Object.freeze({ id: request.id, role: request.role, usage: request.usage, byteLength: request.byteLength }))),
                matches: plan.matches as ReadonlyMap<number, BufferHandle>, leases: plan.leases as readonly SubmissionBufferLease[], victims: plan.victims as readonly BufferHandle[] });
            weakSet(plans, result, plan); return result;
        },
        claim(plan) { const actual = weakGet(plans, plan); if (!actual) throw new TypeError('Foreign buffer plan'); return owner.claim(actual) as readonly SubmissionBufferLease[]; },
        registerCreated(request, resource) { return owner.registerCreated({ ...request, kind: 'buffer' }, resource) as SubmissionBufferLease; },
        reserveReturns(leases) { return owner.reserveReturns(leases as readonly RetentionLease[]) as BufferReturnPlan; },
        publishReturns(plan) { return owner.publishReturns(plan as RetentionReturnPlan) as readonly BufferHandle[]; },
        cancelReturns(plan) { return owner.cancelReturns(plan as RetentionReturnPlan) as readonly BufferHandle[]; },
        detach(handle) { owner.detach(handle as RetentionHandle); },
        destroyed(handle, succeeded) { owner.destroyed(handle as RetentionHandle, succeeded); },
        invalidate() { owner.invalidate(); },
        detachIdleForClose() { return owner.detachIdleForClose() as readonly BufferHandle[]; },
    };
}
