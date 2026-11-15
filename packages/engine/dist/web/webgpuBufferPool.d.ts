import type { WebGPURetentionPool } from './webgpuRetentionPool.js';
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
export declare function createWebGPUBufferPool(session: object): WebGPUBufferPool;
/** Assembly-only; no second counter, session or FIFO is created by this view. */
export declare function createBufferPoolFacade(owner: WebGPURetentionPool): WebGPUBufferPool;
//# sourceMappingURL=webgpuBufferPool.d.ts.map