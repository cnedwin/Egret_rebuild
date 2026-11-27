// SPDX-License-Identifier: Apache-2.0
// Services required by the exported player bundle in a bare V8 isolate.
(() => {
    const native = globalThis.EgretNativePlayer;
    const timers = new Map();
    let sequence = 0;
    globalThis.performance = Object.freeze({ now: () => native.now() });
    globalThis.setTimeout = (callback, delay = 0, ...args) => {
        if (typeof callback !== "function") throw new TypeError("A timer requires a callback");
        do { sequence = sequence % 0x7fffffff + 1; } while (timers.has(sequence));
        const id = sequence;
        timers.set(id, () => callback(...args));
        native.schedule(id, Math.min(0x7fffffff, Math.max(0, Math.trunc(Number(delay)) || 0)));
        return id;
    };
    globalThis.clearTimeout = id => {
        if (timers.delete(id)) native.cancel(id);
    };
    const groups = new Map();
    let scriptsClosed = false;
    const closedError = () => Object.assign(new Error("Project scripts closed"), {name: "AbortError"});
    globalThis.EgretRuntimeScripts = Object.freeze({
        loadGroup(name) {
            if (scriptsClosed) return Promise.reject(closedError());
            if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
                return Promise.reject(new TypeError("Invalid script group name"));
            }
            const existing = groups.get(name);
            if (existing) return existing.promise;
            if (!native.requestScriptGroup(name)) return Promise.reject(new Error("Unknown script group: " + name));
            const record = {};
            record.promise = new Promise((resolve, reject) => Object.assign(record, {resolve, reject}));
            groups.set(name, record);
            return record.promise;
        },
    });
    globalThis.EgretRuntimeTasks = Object.freeze({
        scriptGroupResult(name, error) {
            const record = groups.get(name);
            if (!record || !record.resolve) return;
            if (error == null) record.resolve();
            else record.reject(new Error(error));
            // Keep the settled promise: retrying a partly executed classic script
            // in this isolate would repeat its global side effects.
            delete record.resolve;
            delete record.reject;
        },
        closeScripts() {
            scriptsClosed = true;
            for (const record of groups.values()) record.reject?.(closedError());
            groups.clear();
        },
        fire(id) {
            const callback = timers.get(id);
            if (callback) {
                timers.delete(id);
                callback();
            }
        },
    });
    globalThis.queueMicrotask = callback => Promise.resolve().then(callback).catch(e => native.failure(String(e)));
    // Cancellation only needs the signal contract used by the engine's resource scopes.
    const abort = Symbol("abort");
    class Signal {
        #aborted = false;
        #reason;
        #listeners = new Set();
        onabort = null;
        get aborted() { return this.#aborted; }
        get reason() { return this.#reason; }
        throwIfAborted() { if (this.#aborted) throw this.#reason; }
        addEventListener(type, listener) {
            if (type === "abort" && listener && !this.#aborted) this.#listeners.add(listener);
        }
        removeEventListener(type, listener) {
            if (type === "abort") this.#listeners.delete(listener);
        }
        [abort](reason) {
            if (this.#aborted) return;
            this.#aborted = true;
            this.#reason = reason === undefined
                ? Object.assign(new Error("The operation was aborted"), { name: "AbortError" }) : reason;
            const event = { type: "abort", target: this, currentTarget: this };
            for (const listener of [...this.#listeners]) {
                if (!this.#listeners.delete(listener)) continue;
                try {
                    if (typeof listener === "function") listener.call(this, event);
                    else listener.handleEvent(event);
                } catch (error) { native.failure(String(error)); }
            }
            if (typeof this.onabort === "function") this.onabort(event);
        }
    }
    globalThis.AbortController = class {
        #signal = new Signal();
        get signal() { return this.#signal; }
        abort(reason) { this.#signal[abort](reason); }
    };
})();
