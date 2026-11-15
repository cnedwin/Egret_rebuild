import { createWebGPURetentionPool } from './webgpuRetentionPool.js';
// The legacy facade preserves its exact request shape and delegates every owner
// transition to the same finite authority used by shared color/depth targets.
const weakGet = Function.prototype.call.bind(WeakMap.prototype.get);
const weakSet = Function.prototype.call.bind(WeakMap.prototype.set);
export function createWebGPUBufferPool(session) {
    return createBufferPoolFacade(createWebGPURetentionPool(session));
}
/** Assembly-only; no second counter, session or FIFO is created by this view. */
export function createBufferPoolFacade(owner) {
    const plans = new WeakMap();
    return {
        plan(requests) {
            const plan = owner.plan(requests.map(request => ({ ...request, kind: 'buffer' })));
            const result = Object.freeze({
                session: plan.session,
                revision: plan.revision,
                requests: Object.freeze(requests.map(request => Object.freeze({ id: request.id, role: request.role, usage: request.usage, byteLength: request.byteLength }))),
                matches: plan.matches,
                leases: plan.leases,
                victims: plan.victims
            });
            weakSet(plans, result, plan);
            return result;
        },
        claim(plan) {
            const actual = weakGet(plans, plan);
            if (!actual)
                throw new TypeError('Foreign buffer plan');
            return owner.claim(actual);
        },
        registerCreated(request, resource) {
            return owner.registerCreated({ ...request, kind: 'buffer' }, resource);
        },
        reserveReturns(leases) {
            return owner.reserveReturns(leases);
        },
        publishReturns(plan) {
            return owner.publishReturns(plan);
        },
        cancelReturns(plan) {
            return owner.cancelReturns(plan);
        },
        detach(handle) {
            owner.detach(handle);
        },
        destroyed(handle, succeeded) {
            owner.destroyed(handle, succeeded);
        },
        invalidate() {
            owner.invalidate();
        },
        detachIdleForClose() {
            return owner.detachIdleForClose();
        }
    };
}
//# sourceMappingURL=webgpuBufferPool.js.map