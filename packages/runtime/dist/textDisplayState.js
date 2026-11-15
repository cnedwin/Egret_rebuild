import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from './displayVisualState.js';
import { Scope } from './Scope.js';
import { EgretError } from './EgretError.js';
const states = new WeakMap();
const readPublishedState = states.get.bind(states);
const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
/** Metadata only: default collectors never import the text cache or leaf class. */
export function hasTextFieldState(value) {
    return states.has(value);
}
export function readTextFieldState(value) {
    return states.get(value);
}
export function writeTextFieldState(value, state) {
    const changed = readPublishedState(value) !== state;
    states.set(value, state);
    // Desired requests stay separate; only committed display/clear publications arrive here.
    if (changed)
        recordVisualChange(value, VISUAL_CONTENT | VISUAL_BINDING);
}
/** A same-name own getter or writable shadow cannot reopen a closing Scope. */
export function assertTextFieldScope(scope) {
    if (APPLY(SCOPE_STATE, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
//# sourceMappingURL=textDisplayState.js.map