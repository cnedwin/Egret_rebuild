import { Scope } from '@egret/runtime';
import type { DisplayObject, DisplayObjectContainer, EngineContext } from '@egret/runtime';
declare const displaySubtreeTicketBrand: unique symbol;
/** Borrows all nodes/resources; disposal only revokes this candidate publication. */
export interface DisplaySubtreeTicket {
    readonly [displaySubtreeTicketBrand]: true;
    commit(): void;
    dispose(): void;
}
type Operations = Parameters<NonNullable<EngineContext['registerPreparedDisplayOperations']>>[0];
interface Context {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    isBusy(): boolean;
}
/** One Engine's authentic handles close over its genuine Stage operations. */
export declare function createDisplaySubtreeTickets(context: Context, operations: Operations): Readonly<{
    prepare(scope: Scope, target: DisplayObjectContainer, candidate: DisplayObject): DisplaySubtreeTicket;
    read(ticket: unknown): Readonly<{
        validate(): void;
        captureContent(): import("@egret/runtime").CapturedSharedContent2D;
    }>;
}>;
export {};
//# sourceMappingURL=displaySubtreeTicket.d.ts.map