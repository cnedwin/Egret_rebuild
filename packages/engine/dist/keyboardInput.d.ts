import type { KeyboardInput, KeyboardInputOptions } from './keyboardInputTypes.js';
export type * from './keyboardInputTypes.js';
interface Binding {
    readonly surface: object;
    report(cause: unknown): void;
    onClose(callback: () => void): () => void;
    onInteractive(callback: (active: boolean) => void): () => void;
}
/** Private browser binding reuses the genuine eager Engine authority. */
export declare function bindKeyboardSurface(input: KeyboardInput): Binding;
export declare function createKeyboardInput(options: KeyboardInputOptions): KeyboardInput;
//# sourceMappingURL=keyboardInput.d.ts.map