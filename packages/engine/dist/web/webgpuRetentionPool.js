import { createRetentionLedger } from './sharedRetentionLedger.js';
/** Preserve WebGPU descriptor admission while sharing callback-free lease ownership. */
export function createWebGPURetentionPool(session, diagnostics) {
    const ledger = createRetentionLedger(session, diagnostics);
    function validateRequest(request) {
        if (!Number.isSafeInteger(request.id) ||
            request.id < 0 ||
            !Number.isSafeInteger(request.byteLength) ||
            request.byteLength <= 0 ||
            request.byteLength % 4 !== 0)
            throw new TypeError('Invalid retention request');
        if (request.kind === 'buffer') {
            if ((request.role !== 'vertex' && request.role !== 'index' && request.role !== 'uniform') ||
                (request.usage !== 40 && request.usage !== 24 && request.usage !== 72))
                throw new TypeError('Invalid buffer request');
        }
        else if ((request.kind !== 'color' && request.kind !== 'depth') ||
            !Number.isSafeInteger(request.width) ||
            !Number.isSafeInteger(request.height) ||
            request.width <= 0 ||
            request.height <= 0 ||
            request.byteLength !== 4 * request.width * request.height ||
            request.sampleCount !== 1 ||
            request.mipLevelCount !== 1 ||
            request.depthOrArrayLayers !== 1 ||
            (request.kind === 'color'
                ? request.format !== 'rgba8unorm-srgb' || request.usage !== 20 || request.recipe !== 'egret.srgb-pma8-target/1'
                : request.format !== 'depth32float' ||
                    request.usage !== 16 ||
                    request.recipe !== 'egret.shared-reverse-depth/1')) {
            throw new TypeError('Invalid target request');
        }
    }
    function keyOf(value) {
        return value.kind === 'buffer'
            ? 'buffer:' + value.usage + ':' + value.byteLength
            : value.kind +
                ':' +
                value.width +
                ':' +
                value.height +
                ':' +
                value.format +
                ':' +
                value.usage +
                ':' +
                value.sampleCount +
                ':' +
                value.mipLevelCount +
                ':' +
                value.depthOrArrayLayers +
                ':' +
                value.recipe;
    }
    function keyed(input) {
        const request = Object.freeze({ ...input });
        validateRequest(request);
        return { request, key: keyOf(request) };
    }
    return {
        plan(requests) {
            ledger.assertActive();
            const rows = [];
            for (let i = 0; i < requests.length; i++) {
                const row = keyed(requests[i]);
                if (row.request.id !== i)
                    throw new TypeError('Nonsequential buffer request');
                rows.push(row);
            }
            return ledger.plan(rows);
        },
        claim: plan => ledger.claim(plan),
        registerCreated: (request, resource) => ledger.registerCreated(keyed(request), resource),
        reserveReturns: leases => ledger.reserveReturns(leases),
        publishReturns: plan => ledger.publishReturns(plan),
        cancelReturns: plan => ledger.cancelReturns(plan),
        detach: handle => ledger.detach(handle),
        destroyed: (handle, succeeded) => ledger.settled(handle, succeeded ? 'destroyed' : 'unknown'),
        contextInvalidated: handle => ledger.settled(handle, 'context-invalidated'),
        invalidate: () => ledger.invalidate(),
        detachIdleForClose: () => ledger.detachIdleForClose()
    };
}
//# sourceMappingURL=webgpuRetentionPool.js.map