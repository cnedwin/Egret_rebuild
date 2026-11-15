// SPDX-License-Identifier: Apache-2.0
// A game in a page from one call: a Host chosen for the browser, an Engine, a scope, pointer and keyboard input and
// a frame loop, each made the way its own entry makes it, and all of them ended by one dispose.
import { EgretError } from '@egret/runtime';
import { createAssetRef, createAssetType, createEngineForProfile, isTexture, SHARED_FRAME_PROFILE_2D } from '@egret/engine';
import { createBrowserTextureProvider } from './image.js';
import { createTextField, createTextRasterCache } from '@egret/engine/text';
import { createBrowserFrameLoop } from './loop.js';
import { createBrowserPointerInput } from './pointer.js';
import { createBrowserKeyboardInput } from './keyboard.js';
import { createBrowserStatsPanel } from './BrowserStatsPanel.js';
const invalid = () => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const whole = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
/** WebGPU where the browser has it and gives an adapter. Asking for an adapter does not touch the canvas, which can hold one kind of context only. */
async function chooseBackend(asked) {
    if (asked !== 'auto')
        return asked;
    const gpu = globalThis.navigator?.gpu;
    if (gpu === undefined || gpu === null)
        return 'webgl2';
    try {
        return (await gpu.requestAdapter()) ? 'webgpu' : 'webgl2';
    }
    catch {
        return 'webgl2';
    }
}
/**
 * Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects
 * to `game.stage`. Everything it makes is what the separate entries make; a game that outgrows it takes them apart.
 */
export async function createBrowserGame(options) {
    if (options === null || typeof options !== 'object')
        throw invalid();
    const { canvas, width, height, update, onError } = options;
    const asked = options.backend ?? 'auto', clearColor = options.clearColor ?? 0, clearAlpha = options.clearAlpha ?? 1;
    const device = Number(globalThis.devicePixelRatio), pixelRatio = options.pixelRatio ?? (device > 0 ? Math.min(device, 2) : 1);
    if (canvas === null ||
        typeof canvas !== 'object' ||
        typeof canvas.getBoundingClientRect !== 'function' ||
        !whole(width) ||
        !whole(height) ||
        (asked !== 'auto' && asked !== 'webgpu' && asked !== 'webgl2') ||
        typeof pixelRatio !== 'number' ||
        !(pixelRatio > 0) ||
        !Number.isFinite(pixelRatio) ||
        !Number.isInteger(clearColor) ||
        clearColor < 0 ||
        clearColor > 0xffffff ||
        typeof clearAlpha !== 'number' ||
        !(clearAlpha >= 0 && clearAlpha <= 1) ||
        (update !== undefined && typeof update !== 'function') ||
        (onError !== undefined && typeof onError !== 'function') ||
        [options.pointer, options.keyboard, options.autoStart, options.stats].some(flag => flag !== undefined && typeof flag !== 'boolean') ||
        !['none', 'contain', 'cover', 'stretch'].includes(options.fit ?? 'none') ||
        (options.fitTo !== undefined && (options.fitTo === null || typeof options.fitTo !== 'object')))
        throw invalid();
    const backend = await chooseBackend(asked);
    // Only the chosen backend's module is loaded.
    const host = backend === 'webgpu'
        ? (await import('./webgpu.js')).createSharedWebGPUHost({ canvas, pixelRatio })
        : (await import('./webgl2.js')).createSharedWebGL2Host({ canvas, pixelRatio });
    let engine;
    try {
        engine = await createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D);
    }
    catch (cause) {
        try {
            await host.close();
        }
        catch {
            /* The first failure is the one to tell. */
        }
        throw cause;
    }
    let loop, stats, disposal;
    try {
        const scope = engine.createScope(), frame = Object.freeze({ width, height, clearColor, clearAlpha });
        const pointer = options.pointer === false ? undefined : createBrowserPointerInput({ engine, scope, width, height });
        const keyboard = options.keyboard === false ? undefined : createBrowserKeyboardInput({ engine, scope });
        const panel = (stats = options.stats === true ? createBrowserStatsPanel({ canvas, label: backend }) : undefined);
        let drawn;
        // With a panel, the loop draws through a step that keeps the frame, and each step tells the panel what the last one did.
        const made = (loop =
            panel === undefined
                ? createBrowserFrameLoop({
                    engine,
                    host,
                    frame,
                    ...(update === undefined ? {} : { update }),
                    ...(onError === undefined ? {} : { onError })
                })
                : createBrowserFrameLoop({
                    engine: {
                        clock: engine.clock,
                        advanceTime: (seconds) => engine.advanceTime(seconds),
                        renderSharedFrame: (given) => (drawn = engine.renderSharedFrame(given))
                    },
                    host,
                    frame,
                    ...(onError === undefined ? {} : { onError }),
                    update(seconds) {
                        const now = made.snapshot();
                        panel.sample({
                            ...(drawn === undefined ? {} : { frame: drawn }),
                            pendingFrames: host.getStatus().pendingFrames,
                            frames: now.frames,
                            skipped: now.skipped
                        });
                        drawn = undefined;
                        update?.(seconds);
                    }
                }));
        // Images by address: one asset type whose key is the address, read with the page's own request and decoded as PNG.
        const imageType = createAssetType('egret.browser-game.image', isTexture);
        const images = createBrowserTextureProvider({
            async readBytes(ref, context) {
                const stop = new AbortController(), abort = () => stop.abort();
                if (context.signal.aborted)
                    abort();
                else
                    context.signal.addEventListener('abort', abort, { once: true });
                try {
                    const response = await globalThis.fetch(ref.id, { signal: stop.signal });
                    if (!response.ok)
                        throw new EgretError('BROWSER_GAME_IMAGE_FAILED', { cause: new Error(response.status + ' ' + ref.id) });
                    return new Uint8Array(await response.arrayBuffer());
                }
                finally {
                    context.signal.removeEventListener('abort', abort);
                }
            }
        });
        engine.assets.register(imageType, images);
        // The canvas in its element: sized now and whenever the element changes size. The stage keeps its own units.
        const fit = options.fit ?? 'none', holder = options.fitTo ?? canvas.parentElement;
        let watcher;
        if (fit !== 'none' && holder !== null) {
            const place = () => {
                const box = holder.getBoundingClientRect(), wide = box.width / width, tall = box.height / height;
                const scaleX = fit === 'stretch' ? wide : fit === 'contain' ? Math.min(wide, tall) : Math.max(wide, tall), scaleY = fit === 'stretch' ? tall : scaleX;
                const style = canvas.style;
                style.width = width * scaleX + 'px';
                style.height = height * scaleY + 'px';
                // Centred in its element; with "cover" what does not fit is outside it, for the element to cut off.
                style.marginLeft = (box.width - width * scaleX) / 2 + 'px';
                style.marginTop = (box.height - height * scaleY) / 2 + 'px';
            };
            place();
            watcher = new ResizeObserver(place);
            watcher.observe(holder);
        }
        // Text: one cache for the Engine, made with the page's rasterizer when the first label is asked for.
        let textCache;
        async function createLabel(given = {}) {
            if (given === null || typeof given !== 'object')
                throw invalid();
            textCache ??= import('./text.js').then(text => createTextRasterCache(engine.assets, { provider: text.createCanvasTextRasterProvider() }));
            const field = createTextField(engine, scope, await textCache);
            let now = {
                text: '',
                fontFamily: 'sans-serif',
                fontSize: 24,
                fontWeight: 400,
                italic: false,
                lineHeight: 0,
                color: 0xffffff,
                locale: 'en',
                direction: 'ltr'
            };
            let ready = Promise.resolve();
            const apply = (next) => {
                if (next === null || typeof next !== 'object')
                    throw invalid();
                now = { ...now, ...next };
                field.setRequest({
                    text: now.text,
                    fontFamily: now.fontFamily,
                    fontSize: now.fontSize,
                    fontWeight: now.fontWeight,
                    fontStyle: now.italic ? 'italic' : 'normal',
                    lineHeight: now.lineHeight > 0 ? now.lineHeight : now.fontSize * 1.25,
                    locale: now.locale,
                    direction: now.direction,
                    density: pixelRatio,
                    fillColor: now.color
                });
                const pending = field.prepare().then(() => { });
                // A failure is the label's to tell through `ready`; it is not left unheard.
                pending.catch(() => { });
                ready = pending;
            };
            apply(given);
            return Object.freeze({
                display: field,
                get text() {
                    return now.text;
                },
                set text(value) {
                    if (value !== now.text)
                        apply({ text: value });
                },
                get ready() {
                    return ready;
                },
                set: apply,
                dispose() {
                    field.dispose();
                }
            });
        }
        const game = Object.freeze({
            backend,
            engine,
            host,
            stage: engine.stage,
            scope,
            frame,
            loop: made,
            pointer,
            keyboard,
            stats: panel,
            createLabel,
            async loadTexture(url) {
                if (typeof url !== 'string' || url === '')
                    throw invalid();
                return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
            },
            toStage(clientX, clientY) {
                const box = canvas.getBoundingClientRect();
                return { x: ((clientX - box.left) * width) / box.width, y: ((clientY - box.top) * height) / box.height };
            },
            dispose() {
                // The scope ends the input it was given; the Engine ends its scopes and its Host.
                return (disposal ??= (async () => {
                    made.dispose();
                    panel?.dispose();
                    watcher?.disconnect();
                    // The scope ends the labels; then the cache they were drawn from can end, before the Engine does.
                    scope.dispose();
                    if (textCache !== undefined) {
                        const cache = await textCache.catch(() => undefined);
                        cache?.dispose();
                        await cache?.whenIdle();
                    }
                    await engine.dispose();
                    await images.close();
                })());
            }
        });
        if (options.autoStart !== false)
            made.start();
        return game;
    }
    catch (cause) {
        loop?.dispose();
        stats?.dispose();
        try {
            await engine.dispose();
        }
        catch {
            /* The first failure is the one to tell. */
        }
        throw cause;
    }
}
//# sourceMappingURL=BrowserGame.js.map