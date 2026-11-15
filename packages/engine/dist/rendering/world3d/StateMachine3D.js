// SPDX-License-Identifier: Apache-2.0
// Parameter-driven animation state machine on top of AnimationMixer3D.
// States play one clip or a 1D blend of several; transitions fire on
// parameter conditions and an optional exit time, and cross-fade by weight.
// An interrupted fade keeps the weights it had reached, so poses never pop.
import { AnimationMixer3D } from './Animation3D.js';
import { World3DError, requireFinite3D } from './core3D.js';
export const STATE_MACHINE3D_LIMITS = Object.freeze({
    maxStates: 256,
    maxTransitions: 2048,
    maxTransitionsPerUpdate: 8
});
export class AnimationStateMachine3D {
    mixer;
    /** Called after every state change, including forced ones. */
    onStateChange;
    #states = new Map();
    #transitions = [];
    #parameters = new Map();
    #triggers = new Set();
    #current;
    #fadeDuration = 0;
    #fadeElapsed = 0;
    #fading = false;
    constructor(mixer) {
        if (!(mixer instanceof AnimationMixer3D))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'mixer');
        this.mixer = mixer;
    }
    /** Name of the active state; during a fade this is the state being faded in. */
    get current() {
        return this.#current?.name;
    }
    get isTransitioning() {
        return this.#fading;
    }
    /** Play time of the active state in passes of its duration. */
    get normalizedTime() {
        return this.#current?.normalizedTime ?? 0;
    }
    addState(name, options) {
        if (typeof name !== 'string' || name.length === 0 || name === '*' || this.#states.has(name))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'state name');
        if (this.#states.size >= STATE_MACHINE3D_LIMITS.maxStates)
            throw new World3DError('WORLD3D_BUDGET', 'states');
        const entries = options.blend
            ? [...options.blend.clips].sort((a, b) => a.threshold - b.threshold)
            : options.clip
                ? [{ clip: options.clip, threshold: 0 }]
                : [];
        if (entries.length === 0 || (options.blend && options.clip))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'state needs a clip or a blend');
        for (const entry of entries)
            requireFinite3D(entry.threshold, 'blend threshold');
        const loop = options.loop ?? true, speed = requireFinite3D(options.speed ?? 1, 'state speed');
        const actions = entries.map(entry => {
            const action = this.mixer.clipAction(entry.clip);
            action.loop = loop ? 'repeat' : 'once';
            action.clampWhenFinished = !loop;
            return action;
        });
        this.#states.set(name, {
            name,
            actions,
            thresholds: entries.map(entry => entry.threshold),
            blendParameter: options.blend?.parameter,
            loop,
            speed,
            onEnter: options.onEnter,
            onExit: options.onExit,
            events: [],
            blendWeights: entries.map(() => 0),
            weight: 0,
            fadeFrom: 0,
            normalizedTime: 0
        });
        return this;
    }
    addTransition(options) {
        if (options.from !== '*' && !this.#states.has(options.from))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'transition from: ' + options.from);
        if (!this.#states.has(options.to))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'transition to: ' + options.to);
        if (this.#transitions.length >= STATE_MACHINE3D_LIMITS.maxTransitions)
            throw new World3DError('WORLD3D_BUDGET', 'transitions');
        const conditions = [...(options.conditions ?? [])];
        if (conditions.length === 0 && options.exitTime === undefined)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'transition needs a condition or an exit time');
        for (const condition of conditions)
            if (typeof condition.parameter !== 'string' || condition.parameter.length === 0)
                throw new World3DError('WORLD3D_INPUT_INVALID', 'condition parameter');
        const duration = Math.max(0, requireFinite3D(options.duration ?? 0.2, 'transition duration'));
        this.#transitions.push({
            from: options.from,
            to: options.to,
            duration,
            conditions,
            exitTime: options.exitTime === undefined ? undefined : requireFinite3D(options.exitTime, 'exitTime'),
            canInterrupt: options.canInterrupt ?? true
        });
        return this;
    }
    /** Run `callback` each time `state` passes `normalizedTime` (0 to 1 within one pass). */
    addEvent(state, normalizedTime, callback) {
        const target = this.#states.get(state);
        if (!target || typeof callback !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'event');
        target.events.push({ time: Math.min(Math.max(requireFinite3D(normalizedTime, 'event time'), 0), 1), callback });
        return this;
    }
    set(parameter, value) {
        if (typeof value !== 'boolean')
            requireFinite3D(value, 'parameter ' + parameter);
        this.#parameters.set(parameter, value);
        return this;
    }
    get(parameter) {
        return this.#parameters.get(parameter);
    }
    /** Raise a one-shot flag; the first transition that tests it consumes it. */
    trigger(parameter) {
        this.#triggers.add(parameter);
        return this;
    }
    resetTrigger(parameter) {
        this.#triggers.delete(parameter);
        return this;
    }
    /** Switch to `state` now, cross-fading over `duration` seconds. */
    play(state, duration = 0) {
        const next = this.#states.get(state);
        if (!next)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'state: ' + state);
        this.enter(next, Math.max(0, requireFinite3D(duration, 'duration')));
        return this;
    }
    enter(next, duration) {
        const previous = this.#current;
        if (previous === next && !this.#fading)
            return;
        previous?.onExit?.();
        // Every state fades from the weight it holds right now, so interrupting a fade is seamless.
        for (const state of this.#states.values())
            state.fadeFrom = state.weight;
        if (next.weight === 0) {
            next.normalizedTime = 0;
            for (const action of next.actions)
                action.reset().play();
        }
        this.#current = next;
        this.#fadeDuration = duration;
        this.#fadeElapsed = 0;
        this.#fading = duration > 0;
        if (!this.#fading)
            for (const state of this.#states.values())
                state.weight = state === next ? 1 : 0;
        next.onEnter?.();
        this.onStateChange?.(previous?.name, next.name);
    }
    holds(condition) {
        if (this.#triggers.has(condition.parameter))
            return condition.op === undefined;
        const value = this.#parameters.get(condition.parameter);
        if (condition.op === undefined)
            return value === true;
        if (value === undefined || condition.value === undefined)
            return false;
        switch (condition.op) {
            case '>':
                return value > condition.value;
            case '>=':
                return value >= condition.value;
            case '<':
                return value < condition.value;
            case '<=':
                return value <= condition.value;
            case '==':
                return value === condition.value;
            default:
                return value !== condition.value;
        }
    }
    evaluate() {
        const current = this.#current;
        if (!current)
            return false;
        for (const transition of this.#transitions) {
            if (transition.from !== '*' && transition.from !== current.name)
                continue;
            if (transition.to === current.name)
                continue;
            if (this.#fading && !transition.canInterrupt)
                continue;
            if (transition.exitTime !== undefined && current.normalizedTime < transition.exitTime)
                continue;
            if (!transition.conditions.every(condition => this.holds(condition)))
                continue;
            for (const condition of transition.conditions)
                this.#triggers.delete(condition.parameter);
            this.enter(this.#states.get(transition.to), transition.duration);
            return true;
        }
        return false;
    }
    applyState(state, delta) {
        const { actions, thresholds, blendWeights } = state, count = actions.length;
        let duration = actions[0].clip.duration;
        if (count > 1) {
            const raw = state.blendParameter === undefined ? undefined : this.#parameters.get(state.blendParameter);
            const value = Math.min(Math.max(typeof raw === 'number' ? raw : thresholds[0], thresholds[0]), thresholds[count - 1]);
            let upper = 1;
            while (upper < count - 1 && thresholds[upper] < value)
                upper++;
            const lower = upper - 1, span = thresholds[upper] - thresholds[lower], t = span > 0 ? (value - thresholds[lower]) / span : 0;
            blendWeights.fill(0);
            blendWeights[lower] = 1 - t;
            blendWeights[upper] = t;
            // Blend the cycle length too, and scale each clip to it so their phases stay locked.
            duration = actions[lower].clip.duration * (1 - t) + actions[upper].clip.duration * t;
        }
        else
            blendWeights[0] = 1;
        for (let i = 0; i < count; i++) {
            const action = actions[i];
            action.weight = state.weight * blendWeights[i];
            action.timeScale = duration > 0 ? (state.speed * action.clip.duration) / duration : state.speed;
            if (state.weight > 0 && !action.isRunning)
                action.play();
        }
        if (state.weight <= 0)
            return;
        const before = state.normalizedTime, step = duration > 0 ? (delta * state.speed) / duration : 0;
        let after = before + step;
        if (!state.loop)
            after = Math.min(after, 1);
        state.normalizedTime = after;
        if (state.events.length > 0 && after > before) {
            for (const event of state.events) {
                // Count how many times the event time was crossed, wrapping per pass.
                const crossings = Math.floor(after - event.time) - Math.floor(before - event.time);
                if (crossings > 0 || (before === 0 && event.time === 0 && step > 0))
                    event.callback();
            }
        }
    }
    /** Evaluate transitions, advance fades and drive the mixer by `deltaSeconds`. */
    update(deltaSeconds) {
        const delta = requireFinite3D(deltaSeconds, 'deltaSeconds') * this.mixer.timeScale;
        // Chained transitions with zero-length states are bounded so a cycle cannot hang the frame.
        for (let i = 0; i < STATE_MACHINE3D_LIMITS.maxTransitionsPerUpdate && this.evaluate(); i++)
            ;
        if (this.#fading) {
            this.#fadeElapsed += Math.abs(delta);
            const k = Math.min(this.#fadeElapsed / this.#fadeDuration, 1);
            for (const state of this.#states.values())
                state.weight = state.fadeFrom * (1 - k) + (state === this.#current ? k : 0);
            if (k >= 1)
                this.#fading = false;
        }
        for (const state of this.#states.values()) {
            if (state.weight <= 0 && state !== this.#current) {
                for (const action of state.actions)
                    if (action.isRunning)
                        action.stop();
                continue;
            }
            this.applyState(state, delta);
        }
        this.mixer.update(deltaSeconds);
        // Triggers last one update when nothing consumed them.
        this.#triggers.clear();
    }
}
export function createAnimationStateMachine3D(mixer) {
    return new AnimationStateMachine3D(mixer);
}
//# sourceMappingURL=StateMachine3D.js.map