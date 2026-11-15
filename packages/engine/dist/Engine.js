import { createDisplaySubtreeTickets } from './displaySubtreeTicket.js';
import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import { collectSharedFrameContent } from '@egret/runtime';
import { EgretError, createScope, createStage, createAssetManager, reportDiagnostic, createDisplayInputOperations } from '@egret/runtime';
import { createBitmapResourceSlotOwner } from './bitmapResourceSlot.js';
import { createBitmapBindingOwner } from './bitmapBindingTicket.js';
import { closeHost } from './closeHost.js';
import { registerSharedFrame } from './internal/texturedFrameState.js';
import { createGameClockOwner } from './gameClock.js';
import { createTweenOwner } from './tween.js';
import { registerTextFieldEngine } from './internal/textFieldFactoryState.js';
import { createAssetGroupOwner } from './assetGroup.js';
import { createManifestAssetGroupOwner } from './manifestAssetGroup.js';
import { createMouseInputOwner } from './mouseInput.js';
import { createSequencePlaybackOwner } from './sequencePlayback.js';
import { registerUiEngine } from './internal/uiFactoryState.js';
import { createSequenceTargetClaims } from './sequenceTargetClaims.js';
import { registerSequenceControllerEngine } from './internal/sequenceControllerFactoryState.js';
import { registerContentEngine } from './internal/contentFactoryState.js';
export let constructEngine;
const freezeSharedFrame = Object.freeze;
const CREATION_TOKEN = Symbol('egret.engineFactory');
/** Observation does not accept asynchronous submission or prove host completion. */
function observeRejectedRenderResult(result) {
    const ignoreRejection = () => { };
    try {
        // Intrinsic brand checking recognizes native Promises from other realms and
        // avoids consulting an overridden .then property on a native Promise.
        void Reflect.apply(Promise.prototype.then, result, [undefined, ignoreRejection]);
    }
    catch {
        // Ordinary thenables (including throwing then getters) are assimilated into
        // a handled Promise. Observation must not replace the invalid-port cause.
        try {
            void Promise.resolve(result).then(undefined, ignoreRejection);
        }
        catch {
            /* A hostile constructor cannot make this return type acceptable. */
        }
    }
}
/** One headless run. Construct with createEngine(), not directly. */
export class Engine {
    #displaySubtreeTickets;
    #contentLoaders = new Set();
    #gameClockOwner;
    #tweenOwner;
    #sequencePlaybackOwner;
    #sequenceControllerOwner;
    #assetGroupOwner;
    #manifestAssetGroupOwner;
    #bitmapResourceSlotOwner;
    #bitmapBindingOwner;
    #bitmapResourceTargets = new WeakMap();
    #mouseInputOwner;
    #uiOwner;
    #engineScopes = new WeakSet();
    frameBusy = false;
    nextFrameId = 1;
    frameIdle;
    releaseFrame;
    sharedRenderer;
    #currentState = 'open';
    scopes = new Set();
    cleanupErrors = [];
    closePromise;
    host;
    timeoutMs;
    onDiagnostic;
    releaseSurface;
    #context;
    stage;
    assets;
    sharedFrameProfile;
    clock;
    constructor(options, timeoutMs, surface, releaseSurface, ports, clockOptions, token) {
        if (token !== CREATION_TOKEN)
            throw new EgretError('ENGINE_FACTORY_REQUIRED');
        this.host = options.host;
        this.sharedRenderer = ports.shared;
        this.sharedFrameProfile = ports.sharedProfile;
        this.timeoutMs = timeoutMs;
        this.onDiagnostic = options.onDiagnostic;
        this.releaseSurface = releaseSurface;
        const assertOpen = () => {
            if (this.#currentState !== 'open')
                throw new EgretError('ENGINE_CLOSED');
        };
        const textFields = registerTextFieldEngine(this, assertOpen, (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope));
        let preparedDisplayOperations;
        let assetGroupOperations;
        // The context is never retained in a named public property by its consumers.
        this.#context = Object.freeze({
            assertOpen: () => {
                if (this.#currentState !== 'open')
                    throw new EgretError('ENGINE_CLOSED');
            },
            report: (diagnostic) => reportDiagnostic(this.onDiagnostic, diagnostic),
            captureCleanup: (cause) => {
                if (this.#currentState === 'closing')
                    this.cleanupErrors.push(cause);
            },
            registerTextFieldCache: textFields.registerCache,
            registerPreparedDisplayOperations: (operations) => {
                preparedDisplayOperations = operations;
            },
            registerBitmapResourceTarget: (bitmap, operations) => {
                this.#bitmapResourceTargets.set(bitmap, operations);
            },
            registerAssetGroupOperations: (operations) => {
                assetGroupOperations = operations;
            }
        });
        // The inert owner precedes publication and uses private Scope membership.
        this.#gameClockOwner = createGameClockOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            isFrameBusy: () => this.frameBusy,
            report: this.#context.report
        }, clockOptions);
        // Tween assembly receives the authentic private clock before publication.
        this.#tweenOwner = createTweenOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            clock: this.#gameClockOwner.clock
        });
        const sequenceClaims = createSequenceTargetClaims();
        // Sequence playback borrows the private clock and authentic Scope authority.
        this.#sequencePlaybackOwner = createSequencePlaybackOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            clock: this.#gameClockOwner.clock,
            claims: sequenceClaims,
            captureCleanup: this.#context.captureCleanup
        });
        this.#sequenceControllerOwner = registerSequenceControllerEngine(this, {
            assertOpen: this.#context.assertOpen,
            createScope: () => this.#createScope(),
            clock: this.#gameClockOwner.clock,
            isClockBusy: this.#gameClockOwner.isBusy,
            claims: sequenceClaims,
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        });
        this.clock = this.#gameClockOwner.clock;
        const stage = createStage(this.#context);
        this.#uiOwner = registerUiEngine(this, {
            stage,
            assertOpen: this.#context.assertOpen,
            isFrameBusy: () => this.frameBusy,
            createScope: () => this.#createScope(),
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        });
        const rawInput = createDisplayInputOperations(stage);
        const deliverInput = this.#uiOwner.deliver;
        const inputOperations = Object.freeze({
            pick: rawInput.pick,
            isAttached: rawInput.isAttached,
            dispatch: (...args) => deliverInput(() => rawInput.dispatch(...args))
        });
        // Capture original startup and Stage authority before publishing replaceable readonly fields.
        this.#mouseInputOwner = createMouseInputOwner(this, {
            surface,
            operations: inputOperations,
            assertOpen: this.#context.assertOpen,
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        });
        this.stage = stage;
        this.#displaySubtreeTickets = createDisplaySubtreeTickets({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => this.#engineScopes.has(scope),
            isBusy: () => this.frameBusy || this.#gameClockOwner.isBusy()
        }, preparedDisplayOperations);
        this.assets = createAssetManager(this.#context);
        this.#bitmapBindingOwner = createBitmapBindingOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope)
        }, this.#bitmapResourceTargets);
        // Authentic manager construction captured the operations before publication.
        this.#bitmapResourceSlotOwner = createBitmapResourceSlotOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        }, assetGroupOperations, this.#bitmapResourceTargets);
        this.#assetGroupOwner = createAssetGroupOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        }, assetGroupOperations);
        this.#manifestAssetGroupOwner = createManifestAssetGroupOwner({
            assertOpen: this.#context.assertOpen,
            isEngineScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            report: this.#context.report,
            captureCleanup: this.#context.captureCleanup
        }, assetGroupOperations);
        const assets = this.assets;
        const register = assets.register;
        registerContentEngine(this, {
            assertOpen,
            isScope: (scope) => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope),
            register: (type, provider) => {
                Reflect.apply(register, assets, [type, provider]);
            },
            group: (scope, manifest, roots, bindings, options) => this.#manifestAssetGroupOwner.create(scope, manifest, roots, bindings, options),
            own: (dispose) => {
                assertOpen();
                this.#contentLoaders.add(dispose);
                return () => {
                    this.#contentLoaders.delete(dispose);
                };
            }
        });
    }
    static {
        constructEngine = (options, timeoutMs, surface, releaseSurface, ports, clockOptions) => new Engine(options, timeoutMs, surface, releaseSurface, ports, clockOptions, CREATION_TOKEN);
    }
    advanceTime(sourceSeconds) {
        return this.#gameClockOwner.advance(sourceSeconds);
    }
    captureSharedFrame(options) {
        return this.executeSharedFrame(options, false);
    }
    /** Capture a prepared binding view without publishing it to the live scene. */
    capturePreparedSharedFrame(ticket, options) {
        return this.executeSharedFrame(options, false, [ticket]);
    }
    /**
     * Prepare one borrowed detached root as the target container's new sole child.
     * Uses authenticated already-bound private state, not fresh subclass hooks/getters.
     * Run application semantic guards before preparation; Scope ownership is not their approval.
     */
    prepareDisplaySubtree(scope, target, candidate) {
        return this.#displaySubtreeTickets.prepare(scope, target, candidate);
    }
    /** Immutable candidate snapshot; the live Stage remains unchanged. */
    capturePreparedDisplaySharedFrame(ticket, options) {
        return this.executeSharedFrame(options, false, undefined, [ticket]);
    }
    renderSharedFrame(options) {
        return this.executeSharedFrame(options, true);
    }
    /** Busy precedes all external reads; cleanup waits for the finally barrier. */
    executeSharedFrame(options, render, candidate, displayCandidate) {
        this.#context.assertOpen();
        if (this.frameBusy)
            throw new EgretError('FRAME_REENTRANT');
        if (this.#gameClockOwner.isBusy())
            throw new EgretError('CLOCK_REENTRANT');
        this.frameBusy = true;
        this.frameIdle = new Promise(resolve => {
            this.releaseFrame = resolve;
        });
        try {
            const renderer = this.sharedRenderer;
            if (render && renderer === undefined)
                throw new EgretError('RENDERER_REQUIRED');
            const prepared = displayCandidate !== undefined
                ? this.#displaySubtreeTickets.read(displayCandidate[0])
                : candidate === undefined
                    ? undefined
                    : this.#bitmapBindingOwner.readPreparedForCapture(candidate[0]);
            let width, height, colorInput, alphaInput, outputInput;
            let optionsFailed = false, optionsCause;
            try {
                width = options.width;
                height = options.height;
                colorInput = options.clearColor;
                alphaInput = options.clearAlpha;
                outputInput = options.outputAlpha;
            }
            catch (cause) {
                // Even a caller-thrown EgretError is an external read failure here.
                if (prepared === undefined)
                    throw new EgretError('INVALID_FRAME_OPTIONS', { cause });
                optionsFailed = true;
                optionsCause = cause;
            }
            // Candidate lifetime/phase wins even when an option getter threw undefined.
            // Binding, target and entitlement preflight waits for valid options below.
            prepared?.validate();
            if (optionsFailed)
                throw new EgretError('INVALID_FRAME_OPTIONS', { cause: optionsCause });
            const outputAlpha = outputInput === undefined ? 'premultiplied' : outputInput;
            const clearColor = colorInput === undefined ? 0 : colorInput;
            const clearAlpha = alphaInput === undefined ? (outputAlpha === 'opaque' ? 1 : 0) : alphaInput;
            if (typeof width !== 'number' ||
                !Number.isFinite(width) ||
                width <= 0 ||
                typeof height !== 'number' ||
                !Number.isFinite(height) ||
                height <= 0 ||
                typeof clearColor !== 'number' ||
                !Number.isInteger(clearColor) ||
                clearColor < 0 ||
                clearColor > 0xffffff ||
                typeof clearAlpha !== 'number' ||
                !Number.isFinite(clearAlpha) ||
                clearAlpha < 0 ||
                clearAlpha > 1 ||
                (outputAlpha !== 'opaque' && outputAlpha !== 'premultiplied') ||
                (outputAlpha === 'opaque' && clearAlpha !== 1))
                throw new EgretError('INVALID_FRAME_OPTIONS');
            this.#context.assertOpen();
            const content = prepared === undefined ? collectSharedFrameContent(this.stage) : prepared.captureContent(this.stage);
            this.#context.assertOpen();
            prepared?.validate();
            if (!Number.isSafeInteger(this.nextFrameId) || this.nextFrameId <= 0)
                throw new EgretError('FRAME_ID_EXHAUSTED');
            const frame = freezeSharedFrame({
                profile: SHARED_FRAME_PROFILE_2D,
                colorRecipe: 'egret.linear-srgb-pma/1',
                targetRepresentation: 'egret.srgb-pma8-target/1',
                outputRepresentation: outputAlpha === 'opaque' ? 'egret.srgb-opaque-unorm8/1' : 'egret.srgb-premultiplied-unorm8/1',
                frameId: this.nextFrameId,
                width,
                height,
                clearColor,
                clearAlpha,
                outputAlpha,
                ...content
            });
            registerSharedFrame(frame);
            this.nextFrameId++;
            if (render) {
                try {
                    const result = Reflect.apply(renderer, this.host, [frame]);
                    if (result !== undefined) {
                        observeRejectedRenderResult(result);
                        throw new EgretError('INVALID_RENDERER');
                    }
                }
                catch (cause) {
                    this.#context.report({ code: 'FRAME_RENDER_FAILED', phase: 'graphics', severity: 'error', cause });
                    throw new EgretError('FRAME_RENDER_FAILED', { cause });
                }
            }
            return frame;
        }
        finally {
            this.frameBusy = false;
            const release = this.releaseFrame;
            this.releaseFrame = undefined;
            this.frameIdle = undefined;
            release?.();
        }
    }
    createScope() {
        return this.#createScope();
    }
    #createScope() {
        this.#context.assertOpen();
        const scope = createScope(this.#context, (closed) => {
            this.scopes.delete(closed);
        });
        this.scopes.add(scope);
        this.#engineScopes.add(scope);
        this.#sequenceControllerOwner.registerScope(scope);
        this.#mouseInputOwner.registerScope(scope);
        this.#uiOwner.registerScope(scope);
        return scope;
    }
    createTween(scope, options) {
        return this.#tweenOwner.create(scope, options);
    }
    /** Create an idle, Scope-owned sequence controller without rendering or ticking. */
    createSequencePlayback(scope, bitmap, clip, options) {
        return this.#sequencePlaybackOwner.create(scope, bitmap, clip, options);
    }
    /** Preserve the current image while an explicitly requested replacement loads. */
    createBitmapResourceSlot(scope, bitmap) {
        return this.#bitmapResourceSlotOwner.create(scope, bitmap);
    }
    /** Capture exact Bitmap bindings before asynchronously preparing a borrowed group. */
    captureBitmapBindings(scope, targets) {
        return this.#bitmapBindingOwner.capture(scope, targets);
    }
    createAssetGroup(scope, refs, options) {
        return this.#assetGroupOwner.create(scope, refs, options);
    }
    /** Acquire an admitted dependency closure with independent group-owned leases. */
    createManifestGroup(scope, manifest, roots, bindings, options) {
        return this.#manifestAssetGroupOwner.create(scope, manifest, roots, bindings, options);
    }
    /** Every caller shares one close promise, including reentrant cleanup callbacks. */
    dispose() {
        if (this.closePromise !== undefined)
            return this.closePromise;
        let resolveClose = () => { };
        let rejectClose = () => { };
        this.closePromise = new Promise((resolve, reject) => {
            resolveClose = resolve;
            rejectClose = reject;
        });
        // Cache the result before abort/cleanup/diagnostic callbacks can reenter.
        this.#currentState = 'closing';
        // Revoke content wrappers before manifest leases and callback-capable cleanup.
        for (const dispose of [...this.#contentLoaders])
            dispose();
        // Detach managed UI before input and ordinary Scope/Stage cleanup.
        this.#uiOwner.close();
        // Revoke every manifest group before cleanup callbacks can reenter.
        this.#manifestAssetGroupOwner.close();
        this.#bitmapBindingOwner.close();
        this.#bitmapResourceSlotOwner.close();
        // Retire browser input before the remaining callback-capable owners or idle wait.
        this.#mouseInputOwner.close();
        // Terminal observations change now, before the existing idle barriers wait.
        this.#assetGroupOwner.close();
        this.#tweenOwner.close();
        this.#sequenceControllerOwner.close();
        this.#sequencePlaybackOwner.close();
        this.#gameClockOwner.close();
        void this.runClose().then(resolveClose, rejectClose);
        return this.closePromise;
    }
    // Scope and Stage cleanup precede CPU assets, stop and asynchronous host close.
    async runClose() {
        try {
            if (this.frameIdle !== undefined)
                await this.frameIdle;
            if (this.#gameClockOwner.isBusy())
                await this.#gameClockOwner.whenIdle();
            for (const scope of [...this.scopes].reverse()) {
                try {
                    scope.dispose();
                }
                catch (cause) {
                    this.cleanupErrors.push(cause);
                    this.#context.report({ code: 'ENGINE_SCOPE_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause });
                }
            }
            try {
                this.stage.dispose();
            }
            catch (cause) {
                this.cleanupErrors.push(cause);
                this.#context.report({ code: 'ENGINE_STAGE_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause });
            }
            try {
                this.assets.dispose();
            }
            catch (cause) {
                this.cleanupErrors.push(cause);
                this.#context.report({ code: 'ENGINE_ASSETS_CLEANUP_FAILED', phase: 'assets', severity: 'error', cause });
            }
            try {
                this.host.stop?.();
            }
            catch (cause) {
                this.cleanupErrors.push(cause);
                this.#context.report({ code: 'HOST_STOP_FAILED', phase: 'engine', severity: 'error', cause });
            }
            await closeHost(this.host, this.timeoutMs, this.releaseSurface, this.cleanupErrors, this.onDiagnostic);
        }
        finally {
            this.#currentState = 'closed';
        }
    }
}
//# sourceMappingURL=Engine.js.map