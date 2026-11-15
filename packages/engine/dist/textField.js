import { requireTextFieldEngine } from './internal/textFieldFactoryState.js';
/** Public explicit entry; shape, proxies and borrowed identities grant no authority. */
export function createTextField(engine, scope, cache) {
    return requireTextFieldEngine(engine).construct(scope, cache);
}
//# sourceMappingURL=textField.js.map