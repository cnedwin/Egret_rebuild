import { World3DError } from '../../rendering/world3d/core3D.js';
import { Object3D } from '../../rendering/world3d/Object3D.js';
/** Ears of the scene. Attach it to the camera (or pass the camera to update()). */
export class AudioListener3D extends Object3D {
    context;
    /** Everything this listener hears passes through this gain. */
    output;
    #ownsContext;
    #sources = new Set();
    #disposed = false;
    constructor(options = {}) {
        super();
        const Context = globalThis.AudioContext;
        if (!options.context && typeof Context !== 'function')
            throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'Web Audio');
        this.context = options.context ?? new Context();
        this.#ownsContext = !options.context;
        this.output = this.context.createGain();
        this.output.gain.value = options.volume ?? 1;
        this.output.connect(this.context.destination);
    }
    get volume() {
        return this.output.gain.value;
    }
    set volume(value) {
        this.output.gain.value = Math.max(0, value);
    }
    /** Browsers start audio suspended until a user gesture; call this from one. */
    resume() {
        return this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
    }
    /** Fetch and decode a sound file into a buffer that any number of sources can share. */
    async load(url, signal) {
        let response;
        try {
            response = await fetch(url, signal ? { signal } : {});
        }
        catch (cause) {
            throw new World3DError('WORLD3D_RESOURCE_FAILED', url, cause);
        }
        if (!response.ok)
            throw new World3DError('WORLD3D_RESOURCE_FAILED', url + ' (HTTP ' + response.status + ')');
        try {
            return await this.context.decodeAudioData(await response.arrayBuffer());
        }
        catch (cause) {
            throw new World3DError('WORLD3D_RESOURCE_FAILED', 'audio decode: ' + url, cause);
        }
    }
    /** @internal */ register(source) {
        this.#sources.add(source);
    }
    /** @internal */ unregister(source) {
        this.#sources.delete(source);
    }
    /** Copy this node's world pose to the audio listener and every source's to its panner. */
    update() {
        if (this.#disposed)
            return;
        this.updateWorldMatrices();
        const m = this.matrixWorld, listener = this.context.listener, time = this.context.currentTime;
        const fx = -m[8], fy = -m[9], fz = -m[10], ux = m[4], uy = m[5], uz = m[6];
        if (listener.positionX) {
            listener.positionX.setValueAtTime(m[12], time);
            listener.positionY.setValueAtTime(m[13], time);
            listener.positionZ.setValueAtTime(m[14], time);
            listener.forwardX.setValueAtTime(fx, time);
            listener.forwardY.setValueAtTime(fy, time);
            listener.forwardZ.setValueAtTime(fz, time);
            listener.upX.setValueAtTime(ux, time);
            listener.upY.setValueAtTime(uy, time);
            listener.upZ.setValueAtTime(uz, time);
        }
        else {
            // Older engines only have the setter methods.
            const legacy = listener;
            legacy.setPosition(m[12], m[13], m[14]);
            legacy.setOrientation(fx, fy, fz, ux, uy, uz);
        }
        for (const source of this.#sources)
            source.updatePanner();
    }
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        for (const source of [...this.#sources])
            source.dispose();
        this.output.disconnect();
        if (this.#ownsContext)
            void this.context.close().catch(() => undefined);
    }
}
/** A sound placed in the scene. Each play() starts a fresh voice; several may overlap. */
export class PositionalAudio3D extends Object3D {
    listener;
    gain;
    panner;
    buffer;
    loop;
    playbackRate;
    #voices = new Set();
    #disposed = false;
    constructor(listener, options = {}) {
        super();
        if (!(listener instanceof AudioListener3D))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'listener');
        this.listener = listener;
        const context = listener.context;
        this.buffer = options.buffer;
        this.loop = options.loop ?? false;
        this.playbackRate = options.playbackRate ?? 1;
        this.gain = context.createGain();
        this.gain.gain.value = options.volume ?? 1;
        if (options.spatial ?? true) {
            const panner = (this.panner = context.createPanner());
            panner.panningModel = 'HRTF';
            panner.distanceModel = options.distanceModel ?? 'inverse';
            panner.refDistance = options.refDistance ?? 1;
            panner.maxDistance = options.maxDistance ?? 10000;
            panner.rolloffFactor = options.rolloffFactor ?? 1;
            panner.coneInnerAngle = options.coneInnerAngle ?? 360;
            panner.coneOuterAngle = options.coneOuterAngle ?? 360;
            panner.coneOuterGain = options.coneOuterGain ?? 0;
            this.gain.connect(panner);
            panner.connect(listener.output);
        }
        else
            this.gain.connect(listener.output);
        listener.register(this);
    }
    get volume() {
        return this.gain.gain.value;
    }
    set volume(value) {
        this.gain.gain.value = Math.max(0, value);
    }
    get isPlaying() {
        return this.#voices.size > 0;
    }
    /** Start a voice after `delaySeconds`, from `offsetSeconds` into the buffer. */
    play(delaySeconds = 0, offsetSeconds = 0) {
        if (this.#disposed)
            throw new World3DError('WORLD3D_DISPOSED', 'audio');
        if (!this.buffer)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'audio buffer');
        const context = this.listener.context, voice = context.createBufferSource();
        voice.buffer = this.buffer;
        voice.loop = this.loop;
        voice.playbackRate.value = this.playbackRate;
        voice.connect(this.gain);
        voice.onended = () => {
            voice.disconnect();
            this.#voices.delete(voice);
        };
        this.#voices.add(voice);
        this.updatePanner();
        voice.start(context.currentTime + Math.max(0, delaySeconds), Math.max(0, offsetSeconds));
        return voice;
    }
    /** Stop every voice of this source. */
    stop() {
        for (const voice of this.#voices) {
            voice.onended = null;
            try {
                voice.stop();
            }
            catch {
                /* not started yet */
            }
            voice.disconnect();
        }
        this.#voices.clear();
    }
    /** @internal Copy the node's world pose to the panner. */
    updatePanner() {
        const panner = this.panner;
        if (!panner || this.#disposed)
            return;
        this.updateWorldMatrices();
        const m = this.matrixWorld, time = this.listener.context.currentTime;
        if (panner.positionX) {
            panner.positionX.setValueAtTime(m[12], time);
            panner.positionY.setValueAtTime(m[13], time);
            panner.positionZ.setValueAtTime(m[14], time);
            panner.orientationX.setValueAtTime(-m[8], time);
            panner.orientationY.setValueAtTime(-m[9], time);
            panner.orientationZ.setValueAtTime(-m[10], time);
        }
        else {
            const legacy = panner;
            legacy.setPosition(m[12], m[13], m[14]);
            legacy.setOrientation(-m[8], -m[9], -m[10]);
        }
    }
    dispose() {
        if (this.#disposed)
            return;
        this.stop();
        this.#disposed = true;
        this.gain.disconnect();
        this.panner?.disconnect();
        this.listener.unregister(this);
    }
}
export function createAudioListener3D(options = {}) {
    return new AudioListener3D(options);
}
export function createPositionalAudio3D(listener, options = {}) {
    return new PositionalAudio3D(listener, options);
}
//# sourceMappingURL=Audio3D.js.map