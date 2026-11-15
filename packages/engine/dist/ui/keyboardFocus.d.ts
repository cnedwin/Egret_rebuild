import type { DisplayObjectContainer } from '@egret/runtime';
import type { KeyboardInput, KeyboardFocusOptions } from '../keyboardInputTypes.js';
export interface KeyboardRow {
    readonly key: string;
    readonly content: DisplayObjectContainer;
    readonly visible: boolean;
}
/**
 * Owns registrations only. The application retains the channel and its native bridge.
 *
 * Without `tabStop` every row that shows is a stop of its own, in the order of the rows. With it
 * the rows are one stop of that index: Tab enters at the row that last held the focus, or at the
 * first that shows, and leaves the list from there.
 */
export declare function createUiKeyboardFocus(input: KeyboardInput, prefix: string, tabStop?: number): Readonly<{
    validate: (keys: Iterable<string>) => void;
    getFocus: () => Readonly<{
        key: string | undefined;
        focusVisible: boolean;
    }>;
    focus: (key: string | undefined, options?: KeyboardFocusOptions) => void;
    before: (rows: readonly KeyboardRow[]) => Readonly<{
        key: string | undefined;
        focusVisible: boolean;
    }> | undefined;
    commit: (rows: readonly KeyboardRow[], restore: ReturnType<(rows: readonly KeyboardRow[]) => Readonly<{
        key: string | undefined;
        focusVisible: boolean;
    }> | undefined>) => void;
    dispose: () => void;
}>;
//# sourceMappingURL=keyboardFocus.d.ts.map