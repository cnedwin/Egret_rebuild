// SPDX-License-Identifier: Apache-2.0
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

import { createRetentionLedger } from './sharedRetentionLedger.js';

/** Preserve WebGPU descriptor admission while sharing callback-free lease ownership. */
export function createWebGPURetentionPool(session: object): WebGPURetentionPool {
    const ledger = createRetentionLedger<RetentionRequest, OwnedWebGPUBuffer | OwnedWebGPUTexture>(session);
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

    function keyed(input: RetentionRequest): { request: RetentionRequest; key: string } {
        const request = Object.freeze({ ...input });
        validateRequest(request);
        return { request, key: keyOf(request) };
    }
    return {
        plan(requests) {
            ledger.assertActive();
            const rows: { request: RetentionRequest; key: string }[] = [];
            for (let i = 0; i < requests.length; i++) {
                const row = keyed(requests[i]!);
                if (row.request.id !== i) throw new TypeError('Nonsequential buffer request');
                rows.push(row);
            }
            return ledger.plan(rows) as RetentionPlan;
        },
        claim: plan => ledger.claim(plan) as readonly RetentionLease[],
        registerCreated: (request, resource) => ledger.registerCreated(keyed(request), resource) as RetentionLease,
        reserveReturns: leases => ledger.reserveReturns(leases) as RetentionReturnPlan,
        publishReturns: plan => ledger.publishReturns(plan) as readonly RetentionHandle[],
        cancelReturns: plan => ledger.cancelReturns(plan) as readonly RetentionHandle[],
        detach: handle => ledger.detach(handle),
        destroyed: (handle, succeeded) => ledger.settled(handle, succeeded ? 'destroyed' : 'unknown'),
        invalidate: () => ledger.invalidate(),
        detachIdleForClose: () => ledger.detachIdleForClose() as readonly RetentionHandle[],
    };
}
