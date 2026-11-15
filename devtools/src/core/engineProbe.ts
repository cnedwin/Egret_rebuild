// SPDX-License-Identifier: Apache-2.0
// Splits the engine's share of a frame into clock, capture and submit, using
// only calls the engine already offers. Nothing inside the engine is changed:
// the host's frame port is timed from outside, and capture is what remains of
// renderSharedFrame once the host's part is taken away.
import type { SharedFrameLike } from './frameStats.js';
import type { PerformanceMonitor } from './types.js';

/** Section names written by the probe. */
export const ENGINE_SECTIONS = Object.freeze({ clock: 'clock', update: 'update', capture: 'capture', submit: 'submit', render: 'render' } as const);

interface ClockEngineLike { advanceTime(sourceSeconds: number): unknown; }
interface FrameEngineLike<Options, Frame extends SharedFrameLike> { renderSharedFrame(options: Options): Frame; }

/** The part of createBrowserFrameLoop's options the probe reads and replaces. */
export interface FrameLoopOptionsLike {
    readonly engine: { readonly clock: unknown; advanceTime(sourceSeconds: number): unknown; renderSharedFrame(options: never): unknown };
    readonly update?: (deltaSeconds: number) => void;
    readonly requestFrame?: (callback: (milliseconds: number) => void) => number;
}

export interface EngineProbe {
    /**
     * Options for createBrowserFrameLoop that measure the loop: each step of
     * the display is one frame of work, the engine's clock is the clock
     * section, the game's update is the update section, and drawing is timed
     * and counted as renderSharedFrame is. Every other option is kept. With
     * the inert monitor the options themselves are returned.
     */
    frameLoop<O extends FrameLoopOptionsLike>(options: O): O;
    /**
     * Return a host that times its shared frame port. Pass the result to
     * createEngineForProfile in place of the host; keep the original for its
     * own methods. With the inert monitor the host itself is returned.
     */
    wrapHost<T extends object>(host: T): T;
    /** engine.advanceTime, timed as the clock section: game clock, tweens and sequences. */
    advanceTime<E extends ClockEngineLike>(engine: E, sourceSeconds: number): ReturnType<E['advanceTime']>;
    /**
     * engine.renderSharedFrame, timed and counted. With a wrapped host the
     * time is split into capture and submit; otherwise it is one render section.
     */
    renderSharedFrame<Options, Frame extends SharedFrameLike>(engine: FrameEngineLike<Options, Frame>, options: Options): Frame;
}

/** Create the probe for one monitor. */
export function createEngineProbe(monitor: PerformanceMonitor): EngineProbe {
    // Time the host spent in its port during the renderSharedFrame call in progress.
    let hostMs = Number.NaN, rendering = false;

    function wrapHost<T extends object>(host: T): T {
        if (!monitor.active) return host;
        const port: unknown = (host as { readonly renderSharedFrame?: unknown }).renderSharedFrame;
        if (typeof port !== 'function') throw new TypeError('The host has no renderSharedFrame port.');
        const timed = (frame: SharedFrameLike): unknown => {
            const started = monitor.now();
            try { return Reflect.apply(port, host, [frame]); }
            finally {
                const elapsed = monitor.now() - started;
                monitor.addTime(ENGINE_SECTIONS.submit, elapsed);
                if (rendering) hostMs = (Number.isNaN(hostMs) ? 0 : hostMs) + elapsed;
                monitor.observeSharedFrame(frame);
            }
        };
        // A plain stand-in rather than a Proxy: hosts publish frozen members, and a
        // Proxy may not answer differently from a frozen property of its target.
        // Every other member keeps the host as its receiver, so private state still resolves.
        const wrapper: Record<PropertyKey, unknown> = {};
        for (let source: object | null = host; source !== null && source !== Object.prototype; source = Object.getPrototypeOf(source) as object | null) {
            for (const key of Reflect.ownKeys(source)) {
                if (key === 'constructor' || Object.hasOwn(wrapper, key)) continue;
                const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
                if (descriptor === undefined) continue;
                if (key === 'renderSharedFrame') Object.defineProperty(wrapper, key, { value: timed, enumerable: descriptor.enumerable === true });
                else if (typeof descriptor.value === 'function') Object.defineProperty(wrapper, key, { value: (descriptor.value as (...args: unknown[]) => unknown).bind(host), enumerable: descriptor.enumerable === true });
                else Object.defineProperty(wrapper, key, {
                    get: (): unknown => Reflect.get(host, key, host),
                    set: (value: unknown): void => { Reflect.set(host, key, value, host); },
                    enumerable: descriptor.enumerable === true,
                });
            }
        }
        return Object.freeze(wrapper) as T;
    }

    function renderSharedFrame<Options, Frame extends SharedFrameLike>(engine: FrameEngineLike<Options, Frame>, options: Options): Frame {
        if (!monitor.active || rendering) return engine.renderSharedFrame(options);
        const started = monitor.now();
        rendering = true; hostMs = Number.NaN;
        let frame: Frame | undefined;
        try { frame = engine.renderSharedFrame(options); return frame; }
        finally {
            rendering = false;
            const total = monitor.now() - started;
            if (Number.isNaN(hostMs)) {
                // The host was not wrapped: one number, and the counts are read here instead.
                monitor.addTime(ENGINE_SECTIONS.render, total);
                if (frame !== undefined) monitor.observeSharedFrame(frame);
            } else monitor.addTime(ENGINE_SECTIONS.capture, Math.max(0, total - hostMs));
        }
    }

    function frameLoop<O extends FrameLoopOptionsLike>(options: O): O {
        if (!monitor.active) return options;
        const { engine, update } = options;
        const request = options.requestFrame ?? (globalThis as { readonly requestAnimationFrame?: (callback: (milliseconds: number) => void) => number }).requestAnimationFrame;
        if (typeof request !== 'function') throw new TypeError('There is no requestAnimationFrame; pass requestFrame.');
        // The loop reads the clock's limit from the engine it is given, so the stand-in passes the clock through.
        const timedEngine = Object.freeze({
            get clock(): unknown { return engine.clock; },
            advanceTime: (sourceSeconds: number): unknown => monitor.measure(ENGINE_SECTIONS.clock, () => engine.advanceTime(sourceSeconds)),
            renderSharedFrame: (given: unknown): unknown => renderSharedFrame(engine as unknown as FrameEngineLike<unknown, SharedFrameLike>, given),
        });
        return {
            ...options,
            engine: timedEngine,
            ...(update === undefined ? {} : { update: (deltaSeconds: number): void => { monitor.measure(ENGINE_SECTIONS.update, () => update(deltaSeconds)); } }),
            // The loop does all of a frame's work inside the display's callback, so the callback is the frame.
            requestFrame: (callback: (milliseconds: number) => void): number => Reflect.apply(request, globalThis, [(milliseconds: number): void => {
                monitor.beginFrame();
                try { callback(milliseconds); } finally { monitor.endFrame(); }
            }]) as number,
        } as O;
    }

    return Object.freeze({
        frameLoop,
        wrapHost,
        advanceTime<E extends ClockEngineLike>(engine: E, sourceSeconds: number): ReturnType<E['advanceTime']> {
            return monitor.measure(ENGINE_SECTIONS.clock, () => engine.advanceTime(sourceSeconds)) as ReturnType<E['advanceTime']>;
        },
        renderSharedFrame,
    });
}
