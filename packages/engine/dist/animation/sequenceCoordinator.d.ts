import type { GameClockTick } from '../gameClockTypes.js';
import type { SequenceControllerEnginePort } from '../internal/sequenceControllerFactoryState.js';
export interface SequenceDelivery {
    events(): void;
    diagnostics(): void;
}
export interface SequenceDriver {
    advance(tick: GameClockTick): SequenceDelivery | undefined;
    stop(): void;
}
export interface SequenceCoordinator {
    readonly size: number;
    add(driver: SequenceDriver): void;
    remove(driver: SequenceDriver): void;
    discardIfEmpty(): void;
}
/** User getters cannot masquerade as an ordinary callback command boundary. */
export declare function assertNotCapturing(port: SequenceControllerEnginePort): void;
export declare function captureInput<T>(port: SequenceControllerEnginePort, callback: () => T): T;
export declare function mustQueue(port: SequenceControllerEnginePort): boolean;
export declare function protectedDelivery<T>(port: SequenceControllerEnginePort, callback: () => T): T;
export declare function deliver(port: SequenceControllerEnginePort, delivery: SequenceDelivery | undefined): void;
export declare function coordinatorSize(port: SequenceControllerEnginePort): number;
/** One authentic subscription serves all live controllers, never the first caller's Scope. */
export declare function requireCoordinator(port: SequenceControllerEnginePort): SequenceCoordinator;
//# sourceMappingURL=sequenceCoordinator.d.ts.map