import type { OwnedWebGPUBuffer, OwnedWebGPUTexture } from './webgpuLifetime.js';
export interface RetentionBufferRequest {
    readonly kind: 'buffer';
    readonly id: number;
    readonly role: 'vertex' | 'index' | 'uniform';
    readonly usage: 40 | 24 | 72;
    readonly byteLength: number;
}
export interface RetentionTargetRequest {
    readonly kind: 'color' | 'depth';
    readonly id: number;
    readonly width: number;
    readonly height: number;
    readonly format: 'rgba8unorm-srgb' | 'depth32float';
    readonly usage: 20 | 16;
    readonly byteLength: number;
    readonly sampleCount: 1;
    readonly mipLevelCount: 1;
    readonly depthOrArrayLayers: 1;
    readonly recipe: 'egret.srgb-pma8-target/1' | 'egret.shared-reverse-depth/1';
}
export type RetentionRequest = RetentionBufferRequest | RetentionTargetRequest;
export type RetentionHandle = ((RetentionBufferRequest & {
    readonly resource: OwnedWebGPUBuffer;
}) | (RetentionTargetRequest & {
    readonly resource: OwnedWebGPUTexture;
})) & {
    readonly identity: object;
    readonly session: object;
};
export interface RetentionLease {
    readonly requestId: number;
    readonly handle: RetentionHandle;
    readonly offset: 0;
    readonly size: number;
}
export interface RetentionPlan {
    readonly session: object;
    readonly revision: object;
    readonly requests: readonly RetentionRequest[];
    readonly matches: ReadonlyMap<number, RetentionHandle>;
    readonly leases: readonly RetentionLease[];
    readonly victims: readonly RetentionHandle[];
}
export interface RetentionReturnPlan {
    readonly identity: object;
    readonly retained: readonly RetentionHandle[];
    readonly transient: readonly RetentionHandle[];
}
export interface WebGPURetentionPool {
    plan(requests: readonly RetentionRequest[]): RetentionPlan;
    claim(plan: RetentionPlan): readonly RetentionLease[];
    registerCreated(request: RetentionRequest, resource: OwnedWebGPUBuffer | OwnedWebGPUTexture): RetentionLease;
    reserveReturns(leases: readonly RetentionLease[]): RetentionReturnPlan;
    publishReturns(plan: RetentionReturnPlan): readonly RetentionHandle[];
    cancelReturns(plan: RetentionReturnPlan): readonly RetentionHandle[];
    detach(handle: RetentionHandle): void;
    destroyed(handle: RetentionHandle, succeeded: boolean): void;
    contextInvalidated(handle: RetentionHandle): void;
    invalidate(): void;
    detachIdleForClose(): readonly RetentionHandle[];
}
import type { RetentionLedgerDiagnostics } from './sharedRetentionLedger.js';
/** Preserve WebGPU descriptor admission while sharing callback-free lease ownership. */
export declare function createWebGPURetentionPool(session: object, diagnostics?: RetentionLedgerDiagnostics): WebGPURetentionPool;
//# sourceMappingURL=webgpuRetentionPool.d.ts.map