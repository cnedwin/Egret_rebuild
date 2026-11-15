// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createAudioMixer } from '@egret/engine/audio';
/** Shorter than a click can be heard, long enough that a step in volume makes none. */
const SMOOTH = 0.005;
const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
const passive = Object.freeze({ capture: true, passive: true });
const at = (line, time) => time >= line.end
    ? line.to
    : time <= line.start
        ? line.from
        : line.from + ((line.to - line.from) * (time - line.start)) / (line.end - line.start);
/**
 * Sound for a page on Web Audio. A page may not sound before the person has touched it: until
 * then the mixer is locked, music asked for waits, and the first touch or key lets it start.
 */
export function createBrowserAudio(options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options))
        throw new EgretError('AUDIO_OPTIONS_INVALID');
    const { context: given, unlockTarget, pauseWhenHidden = true, onError, ...configuration } = options;
    const Live = globalThis.AudioContext, page = globalThis.document;
    if ((given !== undefined && (given === null || typeof given !== 'object')) ||
        typeof pauseWhenHidden !== 'boolean' ||
        (onError !== undefined && typeof onError !== 'function') ||
        (unlockTarget !== undefined && (unlockTarget === null || typeof unlockTarget.addEventListener !== 'function')))
        throw new EgretError('AUDIO_OPTIONS_INVALID');
    if (given === undefined && typeof Live !== 'function')
        throw new EgretError('AUDIO_HOST_UNAVAILABLE');
    const context = given ?? new Live();
    /** Only an output that runs in real time can be suspended, resumed and locked. */
    const live = typeof Live === 'function' && context instanceof Live ? context : undefined;
    const buffers = new WeakMap();
    const nodes = new WeakMap();
    const streams = new WeakMap();
    /** The media elements that should be heard now. */
    const sounding = new Set();
    const pairs = [];
    const armed = [];
    let closed = false, desired = true, output, silent;
    function report(cause) {
        if (onError !== undefined)
            onError(cause);
        else if (typeof globalThis.reportError === 'function')
            globalThis.reportError(cause);
    }
    function ramp(parameter, line, value, seconds) {
        const time = context.currentTime;
        // The first value of a gain is where it starts, not a movement.
        if (line === undefined) {
            parameter.value = value;
            return { from: value, to: value, start: time, end: time };
        }
        const from = at(line, time), end = time + Math.max(seconds, SMOOTH);
        parameter.cancelScheduledValues(time);
        parameter.setValueAtTime(from, time);
        parameter.linearRampToValueAtTime(value, end);
        return { from, to: value, start: time, end };
    }
    function listen(list, target, type, listener) {
        target.addEventListener(type, listener, passive);
        list.push({ target, type, listener });
    }
    function unlisten(list) {
        for (const pair of list.splice(0).reverse())
            try {
                pair.target.removeEventListener(pair.type, pair.listener, passive);
            }
            catch (cause) {
                report(cause);
            }
    }
    /** After the output or what is wanted of it changed: the lock of the mixer follows the output. */
    function settle() {
        if (closed || live === undefined)
            return;
        try {
            follow();
            if (live.state === 'running') {
                unlisten(armed);
                mixer.setLocked(false);
                if (!desired)
                    live.suspend().catch(report);
            }
            else if (desired) {
                arm();
                mixer.setLocked(true);
            }
        }
        catch (cause) {
            report(cause);
        }
    }
    /** An output that refused to start is waited for as a locked one is: the next touch asks again. */
    function refused(cause) {
        report(cause);
        settle();
    }
    /** A touch or a key is what lets a page sound. A silent sample started inside it is what some phones ask for. */
    const unlock = () => {
        if (closed || live === undefined)
            return;
        try {
            silent ??= live.createBuffer(1, 1, live.sampleRate);
            const source = live.createBufferSource();
            source.buffer = silent;
            source.connect(live.destination);
            source.start(0);
            // A media element is let play by the touch it is started in.
            if (desired)
                for (const element of sounding)
                    if (element.paused)
                        element.play().catch(held);
            live.resume().then(settle, refused);
        }
        catch (cause) {
            report(cause);
        }
    };
    function arm() {
        const target = unlockTarget ?? page;
        if (armed.length > 0 || target === undefined)
            return;
        for (const type of gestures)
            listen(armed, target, type, unlock);
    }
    /** The way of one voice from what makes its sound to its bus: its gain, and its two sides once it leaves the middle. */
    function makeStrip(input, bus, request) {
        const gain = context.createGain(), time = context.currentTime;
        let sides, line;
        if (request.fadeIn > 0) {
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(request.gain, time + request.fadeIn);
            line = { from: 0, to: request.gain, start: time, end: time + request.fadeIn };
        }
        else
            line = ramp(gain.gain, undefined, request.gain, 0);
        /**
         * A pan is a balance: towards one side the other side falls in a straight line, and the middle is the sound as it is.
         * A voice in the middle needs no nodes for it. They are put in the first time it leaves the middle.
         */
        function place(pan) {
            if (sides === undefined) {
                if (pan === 0)
                    return;
                const splitter = context.createChannelSplitter(2), merger = context.createChannelMerger(2), left = context.createGain(), right = context.createGain();
                // One channel is heard on both sides before the sides are told apart.
                gain.channelCount = 2;
                gain.channelCountMode = 'explicit';
                gain.channelInterpretation = 'speakers';
                gain.disconnect();
                gain.connect(splitter);
                splitter.connect(left, 0);
                splitter.connect(right, 1);
                left.connect(merger, 0, 0);
                right.connect(merger, 0, 1);
                merger.connect(bus);
                sides = { left, right, nodes: [splitter, left, right, merger] };
            }
            sides.left.gain.value = 1 - Math.max(0, pan);
            sides.right.gain.value = 1 + Math.min(0, pan);
        }
        input.connect(gain);
        gain.connect(bus);
        place(request.pan);
        return {
            gain,
            setGain(value, seconds) {
                line = ramp(gain.gain, line, value, seconds);
            },
            setPan: place,
            release() {
                for (const node of [gain, ...(sides?.nodes ?? [])])
                    node.disconnect();
            }
        };
    }
    /** What a media element was refused: without a touch it waits for one; a pause that overtook it is nothing. */
    function held(cause) {
        const name = cause?.name;
        if (name === 'NotAllowedError')
            arm();
        else if (name !== 'AbortError')
            report(cause);
    }
    /** A media element keeps its own time. It is made to play while the output runs and to wait while it does not. */
    function follow() {
        const run = desired && (live === undefined || live.state === 'running');
        for (const element of sounding) {
            if (run && element.paused)
                element.play().catch(held);
            else if (!run && !element.paused)
                element.pause();
        }
    }
    function startStream(stream, bus, request, ended) {
        const { element, node } = stream, strip = makeStrip(node, bus, request);
        let over = false, timer;
        function finish() {
            if (over)
                return;
            over = true;
            sounding.delete(element);
            try {
                element.removeEventListener('ended', finish);
                element.pause();
                if (timer !== undefined) {
                    timer.onended = null;
                    timer.stop();
                    timer.disconnect();
                }
                node.disconnect(strip.gain);
                strip.release();
            }
            catch (cause) {
                report(cause);
            }
            ended();
        }
        element.loop = request.loop;
        element.playbackRate = request.rate;
        // A rate is speed and pitch together, as it is for a decoded sound.
        if ('preservesPitch' in element)
            element.preservesPitch = false;
        if (element.currentTime !== request.offset)
            element.currentTime = request.offset;
        element.addEventListener('ended', finish);
        sounding.add(element);
        follow();
        return {
            setGain: strip.setGain,
            setRate(value) {
                element.playbackRate = value;
            },
            setPan: strip.setPan,
            stop(seconds) {
                if (over)
                    return;
                if (seconds <= 0) {
                    finish();
                    return;
                }
                // The end of a fade is a time on the clock of the output: a silent source that stops then tells it.
                silent ??= context.createBuffer(1, 1, context.sampleRate);
                timer = context.createBufferSource();
                timer.buffer = silent;
                timer.loop = true;
                timer.connect(context.destination);
                timer.onended = finish;
                timer.start(0);
                timer.stop(context.currentTime + seconds);
            },
            position: () => element.currentTime
        };
    }
    const backend = {
        get time() {
            return context.currentTime;
        },
        async decode(bytes) {
            // Decoding takes the buffer it is given away from its owner: it is given a copy.
            const copy = bytes.slice().buffer;
            const buffer = await new Promise((resolve, reject) => {
                const result = context.decodeAudioData(copy, resolve, reject);
                if (result !== undefined && typeof result.then === 'function')
                    result.then(resolve, reject);
            });
            const sound = {
                duration: buffer.duration,
                channels: buffer.numberOfChannels,
                sampleRate: buffer.sampleRate,
                release() {
                    buffers.delete(sound);
                }
            };
            buffers.set(sound, buffer);
            return sound;
        },
        async openStream(url) {
            const Element = globalThis.Audio;
            if (typeof Element !== 'function' || live === undefined)
                throw new EgretError('AUDIO_HOST_UNAVAILABLE');
            const element = new Element();
            element.preload = 'auto';
            // A file of another origin is asked for in the way that lets its samples into the graph, or not at all.
            element.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                const done = () => {
                    element.removeEventListener('loadedmetadata', loaded);
                    element.removeEventListener('error', failed);
                };
                const loaded = () => {
                    done();
                    resolve();
                };
                const failed = () => {
                    done();
                    reject(element.error ?? new EgretError('AUDIO_STREAM_FAILED'));
                };
                element.addEventListener('loadedmetadata', loaded);
                element.addEventListener('error', failed);
                element.src = url;
            });
            const node = live.createMediaElementSource(element);
            const sound = {
                duration: element.duration,
                channels: node.channelCount,
                sampleRate: live.sampleRate,
                streamed: true,
                release() {
                    streams.delete(sound);
                    sounding.delete(element);
                    element.pause();
                    element.removeAttribute('src');
                    element.load();
                    node.disconnect();
                }
            };
            streams.set(sound, { element, node });
            return sound;
        },
        createBus(parent) {
            const node = context.createGain(), target = parent === undefined ? context.destination : nodes.get(parent);
            if (target === undefined)
                throw new EgretError('AUDIO_BACKEND_FAILED');
            node.connect(target);
            output ??= node;
            let line;
            const bus = {
                setGain(value, seconds) {
                    line = ramp(node.gain, line, value, seconds);
                },
                release() {
                    nodes.delete(bus);
                    node.disconnect();
                }
            };
            nodes.set(bus, node);
            return bus;
        },
        start(request, ended) {
            const bus = nodes.get(request.bus), stream = streams.get(request.sound);
            if (bus === undefined)
                throw new EgretError('AUDIO_BACKEND_FAILED');
            if (stream !== undefined)
                return startStream(stream, bus, request, ended);
            const buffer = buffers.get(request.sound);
            if (buffer === undefined)
                throw new EgretError('AUDIO_BACKEND_FAILED');
            const source = context.createBufferSource(), strip = makeStrip(source, bus, request);
            let over = false;
            source.buffer = buffer;
            source.loop = request.loop;
            source.playbackRate.value = request.rate;
            source.onended = () => {
                if (over)
                    return;
                over = true;
                source.onended = null;
                try {
                    source.disconnect();
                    strip.release();
                }
                catch (cause) {
                    report(cause);
                }
                ended();
            };
            source.start(0, request.offset);
            return {
                setGain: strip.setGain,
                setRate(value) {
                    source.playbackRate.value = value;
                },
                setPan: strip.setPan,
                stop(seconds) {
                    if (over)
                        return;
                    source.stop(seconds > 0 ? context.currentTime + seconds : 0);
                }
            };
        },
        suspend() {
            desired = false;
            follow();
            if (live !== undefined && live.state === 'running')
                live.suspend().catch(report);
        },
        resume() {
            desired = true;
            follow();
            // Asked even of an output that still runs: a suspension on its way would otherwise be the last word.
            if (live !== undefined)
                live.resume().then(settle, refused);
        },
        close() {
            if (closed)
                return;
            closed = true;
            unlisten(armed);
            unlisten(pairs);
            if (live !== undefined && given === undefined)
                live.close().catch(report);
        }
    };
    let mixer;
    try {
        mixer = createAudioMixer({ ...configuration, backend, locked: live !== undefined && live.state !== 'running' });
    }
    catch (cause) {
        if (live !== undefined && given === undefined)
            live.close().catch(report);
        throw cause;
    }
    if (live !== undefined) {
        try {
            listen(pairs, live, 'statechange', settle);
            if (pauseWhenHidden && page !== undefined) {
                const visibility = () => {
                    try {
                        if (page.visibilityState === 'hidden')
                            mixer.suspend('hidden');
                        else
                            mixer.resume('hidden');
                    }
                    catch (cause) {
                        report(cause);
                    }
                };
                listen(pairs, page, 'visibilitychange', visibility);
                if (page.visibilityState === 'hidden')
                    mixer.suspend('hidden');
            }
            if (live.state !== 'running')
                arm();
        }
        catch (cause) {
            try {
                mixer.dispose();
            }
            catch {
                /* the first failure is the one told */
            }
            throw cause;
        }
    }
    return Object.freeze({
        mixer,
        context,
        output: output,
        dispose() {
            mixer.dispose();
        }
    });
}
//# sourceMappingURL=BrowserAudio.js.map