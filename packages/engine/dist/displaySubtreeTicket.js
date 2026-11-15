// SPDX-License-Identifier: Apache-2.0
import { Scope, EgretError } from '@egret/runtime';
const use = Scope.prototype.use, state = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
/** One Engine's authentic handles close over its genuine Stage operations. */
export function createDisplaySubtreeTickets(context, operations) {
    const handles = new WeakMap();
    function lifetime(scope) {
        context.assertOpen();
        if (!context.isEngineScope(scope))
            throw new EgretError('DISPLAY_SUBTREE_SCOPE_INVALID');
        if (state.call(scope) !== 'open')
            throw new EgretError('SCOPE_CLOSED');
    }
    function available(ticket) {
        context.assertOpen();
        const row = handles.get(ticket);
        if (!row)
            throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');
        lifetime(row.scope);
        if (!row.token)
            throw new EgretError('DISPLAY_SUBTREE_RETIRED');
        return row;
    }
    function idle() {
        if (context.isBusy())
            throw new EgretError('DISPLAY_SUBTREE_REENTRANT');
    }
    return Object.freeze({
        prepare(scope, target, candidate) {
            lifetime(scope);
            idle();
            const token = operations.prepare(target, candidate), row = { scope, token: token };
            const handle = Object.freeze({
                commit() {
                    if (this !== handle)
                        throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');
                    const current = available(handle);
                    idle();
                    operations.commit(current.token);
                    current.token = undefined;
                },
                dispose() {
                    if (this !== handle)
                        throw new EgretError('DISPLAY_SUBTREE_TICKET_INVALID');
                    const token = row.token;
                    row.token = undefined;
                    if (token)
                        operations.dispose(token);
                }
            });
            handles.set(handle, row);
            try {
                use.call(scope, handle);
            }
            catch (cause) {
                handle.dispose();
                throw cause;
            }
            return handle;
        },
        read(ticket) {
            const row = available(ticket);
            return Object.freeze({
                validate() {
                    const current = available(ticket);
                    operations.validate(current.token);
                },
                captureContent() {
                    const current = available(ticket);
                    return operations.capture(current.token);
                }
            });
        }
    });
}
//# sourceMappingURL=displaySubtreeTicket.js.map