// SPDX-License-Identifier: Apache-2.0
import { EgretError, Sprite } from '@egret/runtime';
import type { DisplayObjectContainer, Scope } from '@egret/runtime';
import { captureUiLayout, planUiLayout, UiHeightIndex, createUiDisplayOperations } from '@egret/runtime/ui';
import type { UiLayoutTree, UiLayoutNode, UiLayoutPlan, UiLayoutBox, UiDisplayUpdate } from '@egret/runtime/ui';
import { requireUiEngine } from '../internal/uiFactoryState.js';
import type { PointerInput } from '../pointerInputTypes.js';
import { captureSource } from './virtualList.js';
import type { CapturedSource } from './virtualList.js';
import { captureUiTree, leafConstraintTree, leafMeasuredTree, fixedLeafMeasurement } from './leafContent.js';
import type { CapturedLeafContent } from './leafContent.js';
import type { UiRoot, UiRootOptions, UiSnapshot, UiPreparation, UiCommitResult, UiRowSnapshot, UiCounters, UiInvalidationKind, VirtualDataSource, VirtualListHandle, RowUnbindInfo, UiRowPointerNotification } from './types.js';
type ScopePort = ReturnType<ReturnType<typeof requireUiEngine>['scope']>;
type InputPort = ReturnType<ReturnType<typeof requireUiEngine>['requireInput']>;
interface Binding {
    key: string;
    version: number;
    generation: number;
    width: number;
    density: number;
    source: Pick<CapturedSource, 'identity' | 'bind' | 'unbind'> | undefined;
    scope: ScopePort;
    wrapper: DisplayObjectContainer;
    content?: DisplayObjectContainer;
    height?: number;
    entered: boolean;
    terminal: boolean;
    subscriptions: (() => void)[];
}
interface LeafBinding {
    readonly id: string;
    readonly width: number;
    readonly density: number;
    readonly scope: ScopePort;
    readonly wrapper: DisplayObjectContainer;
    source: CapturedLeafContent | undefined;
    content?: DisplayObjectContainer;
    height?: number;
    measure?: NonNullable<UiLayoutNode['measure']>;
    terminal: boolean;
}
interface Shell {
    scope: ScopePort;
    wrapper: DisplayObjectContainer;
}
interface WindowState {
    cleanupErrors: unknown[];
    revision: number;
    source: CapturedSource | undefined;
    index: UiHeightIndex | undefined;
    plan: UiLayoutPlan | undefined;
    box: UiLayoutBox | undefined;
    width: number;
    height: number;
    scroll: number;
    round: number;
    heights: Map<string, {
        key: string;
        height: number;
        contentVersion: number;
    }>;
    bindings: Map<string, Binding>;
    leafBindings: Map<string, LeafBinding>;
}
interface Candidate {
    nextPool: Shell[];
    discardedShells: Shell[];
    retiring: readonly {
        binding: Binding;
        reason: RowUnbindInfo['reason'];
    }[];
    oldFills: ScopePort[];
    retiringLeaves: readonly LeafBinding[];
    preparedWindow: WindowState;
    rows: readonly UiRowSnapshot[];
    bindings: Map<string, Binding>;
    shells: Map<string, Shell>;
    freshShells: Shell[];
    fillScopes: ScopePort[];
    displayToken: object;
    indexJournal: ReturnType<UiHeightIndex['stageHeights']> | undefined;
    snapshot: UiSnapshot;
    inputGeneration: number;
}
interface TokenState {
    used: boolean;
    retired?: boolean;
    candidate?: Candidate;
}
const freeze = Object.freeze;
const sourceMarker = freeze({});
// Layout caches retain numeric descriptors, never historical data source snapshots.
function withoutSources(tree: UiLayoutTree): UiLayoutTree {
    function copy(node: UiLayoutNode): UiLayoutNode {
        const result = freeze({
            ...node,
            ...(node.kind === 'virtualList' ? {
                source: sourceMarker
            }
                : {}),
            ...(node.children === undefined ? {}
                : {
                    children: freeze(node.children.map(copy))
                })
        });
        return result;
    }
    const root = copy(tree.root);
    return captureUiLayout(root);
}
function preparationError(cause: unknown, cleanupErrors: unknown[]): EgretError {
    if (cause instanceof EgretError && cleanupErrors.length === 0)
        return cause;
    return new EgretError(cause instanceof EgretError ? cause.code : 'UI_PREPARE_FAILED', { cause, cleanupErrors });
}
function fail(code: string): never {
    throw new EgretError(code);
}
function next(value: number): number {
    if (value >= Number.MAX_SAFE_INTEGER)
        fail('UI_REVISION_EXHAUSTED');
    return value + 1;
}
function number(value: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        fail('UI_VALUE_INVALID');
    return value === 0 ? 0 : value;
}
function viewport(value: Readonly<{
    width: number;
    height: number;
}>) {
    return freeze({
        width: number(value.width, Number.MIN_VALUE, 16384),
        height: number(value.height, Number.MIN_VALUE, 16384)
    });
}
function origin(value: Readonly<{
    x: number;
    y: number;
}>, size: Readonly<{
    width: number;
    height: number;
}>) {
    const x = number(value.x, -1048576, 1048576), y = number(value.y, -1048576, 1048576);
    if (Math.abs(x + size.width) > 1048576 || Math.abs(y + size.height) > 1048576)
        fail('UI_VALUE_INVALID');
    return freeze({
        x,
        y
    });
}
/** One owned transaction domain over the genuine display and input authorities. */
export function createUiRoot(options: UiRootOptions): UiRoot {
    const port = requireUiEngine(options.engine);
    port.assertOpen();
    port.assertIdle();
    const owner = port.scope(options.scope);
    owner.assertOpen();
    const display = port.display(createUiDisplayOperations);
    display.assertStage();
    const id = options.id;
    if (typeof id !== 'string' || id.length === 0 || id.length > 128)
        fail('UI_VALUE_INVALID');
    let size = viewport(options.viewport), density = number(options.density, Number.MIN_VALUE, 8), position = origin(options.origin ?? {
        x: 0,
        y: 0
    }, size);
    const capturedTree = captureUiTree(options.tree);
    let tree = capturedTree.tree, leafContents = capturedTree.contents;
    const initialNodes = [...tree.nodes.values()];
    const listNodes = initialNodes.filter(n => n.kind === 'virtualList');
    if (listNodes.length > 1)
        fail('UI_LIMIT');
    const listId = listNodes[0]?.id;
    let source = listNodes[0] === undefined ? undefined : captureSource(listNodes[0].source as VirtualDataSource<unknown>);
    let explicitScroll = listNodes[0] === undefined ? undefined : number(listNodes[0].initialScrollOffset ?? 0, -Number.MAX_VALUE, Number.MAX_VALUE);
    tree = withoutSources(tree);
    const emptyTree = captureUiLayout({
        id,
        kind: 'leaf',
        explicitWidth: 1,
        explicitHeight: 1
    });
    const overscan = number(options.limits?.overscan ?? 2, 0, 32), residentCap = number(options.limits?.residentCap ?? 128, 1, 2048), retainedCap = number(options.limits?.retainedCap ?? 2, 0, 8);
    if (!Number.isInteger(overscan) || !Number.isInteger(residentCap) || !Number.isInteger(retainedCap))
        fail('UI_VALUE_INVALID');
    const callback = options.onRowPointer;
    if (callback !== undefined && typeof callback !== 'function')
        fail('UI_VALUE_INVALID');
    let inputIdentity = options.input, input = inputIdentity === undefined ? undefined : port.requireInput(inputIdentity);
    function validateNewInput(value: InputPort | undefined) {
        if (value !== undefined && (value.state() !== 'active' || value.activeContacts() !== 0))
            fail('UI_INPUT_BUSY');
    }
    validateNewInput(input);
    let closed = false, desired = 1, committed = 0, inputGeneration = 0, generation = 0, busy = false, committing = false;
    let cancelFlight: ((error: unknown) => void) | undefined, preparedWindow: WindowState | undefined, plan: UiLayoutPlan | undefined, committedIndex: UiHeightIndex | undefined, committedSource: CapturedSource | undefined;
    let bindings = new Map<string, Binding>(), shells = new Map<string, Shell>(), pool: Shell[] = [], fills: ScopePort[] = [];
    let leafBindings = new Map<string, LeafBinding>();
    const allLeafBindings = new Set<LeafBinding>();
    let outstandingLeaves = 0;
    const allBindings = new Set<Binding>(), retentions = new Map<string, Set<object>>(), dirty = new Map<string, UiInvalidationKind>(), heightUpdates = new Map<string, {
        key: string;
        height: number;
        contentVersion: number;
    }>(), admissions = new Set<string>();
    const tokens = new WeakMap<object, TokenState>();
    const candidates = new Set<Candidate>();
    const candidateEntries = new Map<Candidate, TokenState>();
    let outstanding = 0, bindTotal = 0, unbindTotal = 0, retentionCount = 0;
    let unsubscribeClose = () => {
    };
    const rootWrapper = display.createWrapper(owner.scope);
    const listWrapper = listId === undefined ? undefined : display.createWrapper(owner.scope);
    function counters(rows: readonly UiRowSnapshot[] = [], index = committedIndex): UiCounters {
        const listBox = plan?.boxes.find(box => box.id === listId);
        const range = index === undefined || listBox === undefined ? undefined : index.range(snapshot.scrollOffset, listBox.innerHeight, overscan);
        const overscanOnly = range === undefined ? 0 : rows.filter(row => !row.visible && row.index >= range.start && row.index < range.end).length;
        return freeze({
            recordCount: index?.size ?? 0,
            heightIndexEntries: index?.size ?? 0,
            heightIndexBytes: index?.logicalBytes ?? 0,
            measuredRecordCount: index?.measuredCount ?? 0,
            liveShells: shells.size + pool.length,
            visibleRows: rows.filter(r => r.visible).length,
            overscanOnlyRows: overscanOnly,
            retainedOnlyRows: rows.filter(r => !r.visible).length - overscanOnly,
            freeShells: pool.length,
            activeBindings: bindings.size,
            stagedBindings: [...allBindings].filter(b => !b.terminal && bindings.get(b.key) !== b).length,
            unsettledBindCalls: outstanding,
            measurementCalls: plan?.measurementCalls ?? 0,
            reusedMeasurements: plan?.reusedMeasurements ?? 0,
            bindTotal,
            unbindTotal,
            resourceDemands: undefined,
            resourceLeases: undefined
        });
    }
    let snapshot: UiSnapshot = freeze({
        id: listId ?? id,
        rootId: id,
        committedRevision: 0,
        desiredRevision: desired,
        origin: position,
        viewport: size,
        density,
        boxes: freeze([]),
        rows: freeze([]),
        scrollOffset: 0,
        scrollExtent: 0,
        anchor: undefined,
        counters: counters()
    });
    function open() {
        if (closed)
            fail('UI_CLOSED');
        port.assertOpen();
        owner.assertOpen();
    }
    function admit<T>(name: string, action: () => T): T {
        open();
        if (admissions.has(name))
            fail('UI_BUSY');
        admissions.add(name);
        try {
            return action();
        }
        finally {
            admissions.delete(name);
        }
    }
    // Mark terminal before callbacks so cancellation and unbind reentry cannot retire twice.
    function retire(binding: Binding, reason: RowUnbindInfo['reason'], errors: unknown[] = []) {
        if (binding.terminal)
            return;
        binding.terminal = true;
        const pairedSource = binding.source;
        binding.source = undefined;
        allBindings.delete(binding);
        for (const remove of binding.subscriptions.splice(0)) {
            try {
                remove();
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (binding.entered) {
            unbindTotal++;
            try {
                (pairedSource!).unbind.call((pairedSource!).identity, freeze({
                    key: binding.key,
                    bindingGeneration: binding.generation,
                    contentVersion: binding.version,
                    reason
                }));
            }
            catch (e) {
                errors.push(e);
            }
        }
        try {
            binding.scope.dispose();
        }
        catch (e) {
            errors.push(e);
        }
    }
    function discardWindow(errors?: unknown[], reason: RowUnbindInfo['reason'] = 'cancel') {
        if (preparedWindow === undefined)
            return;
        const previous = preparedWindow;
        preparedWindow = undefined;
        const retiring = [...previous.bindings.values()];
        // Ignored provider promises may retain this small settlement object. Clear
        // full data/index/layout references before any terminal user callback.
        previous.bindings.clear();
        const retiringLeaves = [...previous.leafBindings.values()];
        previous.leafBindings.clear();
        previous.heights.clear();
        previous.source = undefined;
        previous.index = undefined;
        previous.plan = undefined;
        previous.box = undefined;
        for (const leaf of retiringLeaves)
            if (leafBindings.get(leaf.id) !== leaf)
                retireLeaf(leaf, errors ?? previous.cleanupErrors);
        for (const binding of retiring) {
            if (bindings.get(binding.key) !== binding)
                retire(binding, reason, errors ?? previous.cleanupErrors);
        }
    }
    // Supersession accepts intent first, retires all staging, then reports direct
    // cleanup failures. The prior committed geometry is never partially changed.
    function change() {
        desired = next(desired);
        const errors = preparedWindow?.cleanupErrors ?? [];
        cancelFlight?.(new EgretError('UI_STALE'));
        for (const candidate of [...candidates])
            clearCandidate(candidate, errors);
        discardWindow(errors);
        if (errors.length !== 0)
            throw new EgretError('UI_CLEANUP_FAILED', {
                cause: errors[0],
                cleanupErrors: errors.slice(1)
            });
    }
    function check(revision: number) {
        open();
        if (desired !== revision)
            fail('UI_STALE');
    }
    function sync(errors: unknown[]) {
        if (input !== undefined) {
            try {
                if (input.state() !== 'active')
                    fail('UI_INPUT_CLOSED');
                input.sync();
            }
            catch (e) {
                errors.push(e);
            }
        }
    }
    function subscriptions(binding: Binding, bridge: InputPort | undefined): (() => void)[] {
        if (bridge === undefined || callback === undefined)
            return [];
        const result: (() => void)[] = [];
        try {
            for (const kind of ['begin', 'move', 'end', 'cancel'] as const) {
                const descriptor = bridge.events[kind];
                result.push(binding.wrapper.on(descriptor as typeof bridge.events.begin, event => {
                    if (closed || binding.terminal || bindings.get(binding.key) !== binding)
                        return;
                    const row = snapshot.rows.find(row => row.key === binding.key);
                    if (row === undefined)
                        return;
                    return callback(freeze({
                        kind,
                        listId: listId!,
                        key: binding.key,
                        index: row.index,
                        bindingGeneration: binding.generation,
                        contentVersion: binding.version,
                        layoutRevision: committed,
                        target: binding.wrapper,
                        event
                    }) as UiRowPointerNotification);
                }));
            }
            return result;
        }
        catch (e) {
            for (const remove of result)
                remove();
            throw e;
        }
    }
    function compatible(binding: Binding | undefined, w: WindowState, key: string): binding is Binding {
        const record = w.source?.byKey.get(key);
        return binding !== undefined && !binding.terminal && record !== undefined && binding.version === record.contentVersion && binding.width === w.width && binding.density === density;
    }
    function makeBinding(w: WindowState, key: string): Promise<Binding> {
        if (outstanding >= residentCap)
            fail('UI_PENDING_LIMIT');
        if (allBindings.size - bindings.size >= residentCap)
            fail('UI_LIMIT');
        generation = next(generation);
        const record = (w.source!).byKey.get(key)!;
        const scope = port.scope(port.createScope());
        let wrapper: DisplayObjectContainer;
        try {
            wrapper = display.createWrapper(scope.scope);
        }
        catch (e) {
            scope.dispose();
            throw e;
        }
        const binding: Binding = {
            key,
            version: record.contentVersion,
            generation,
            width: w.width,
            density,
            source: { identity: (w.source!).identity, bind: (w.source!).bind, unbind: (w.source!).unbind },
            scope,
            wrapper,
            entered: false,
            terminal: false,
            subscriptions: []
        };
        // A single replaceable listener set follows this binding Scope across input swaps.
        scope.add(() => {
            for (const remove of binding.subscriptions.splice(0))
                remove();
        });
        allBindings.add(binding);
        w.bindings.set(key, binding);
        const context = freeze({
            key,
            index: (w.index!).indexOf(key),
            value: record.value,
            contentVersion: record.contentVersion,
            bindingGeneration: binding.generation,
            width: w.width,
            density,
            scope: scope.scope,
            signal: scope.signal
        });
        binding.entered = true;
        bindTotal++;
        outstanding++;
        let returned: ReturnType<CapturedSource['bind']>;
        try {
            returned = (binding.source!).bind.call((binding.source!).identity, context);
        }
        catch (e) {
            outstanding--;
            retire(binding, 'error', w.cleanupErrors);
            return Promise.reject(e);
        }
        return Promise.resolve(returned).then(value => {
            if (binding.terminal || closed || desired !== w.revision) {
                retire(binding, 'cancel');
                fail('UI_STALE');
            }
            const content = value.content, height = number(value.measuredHeight, 1, 1048576);
            display.validateContent(content, scope.scope);
            check(w.revision);
            binding.content = content;
            binding.height = height;
            binding.subscriptions = subscriptions(binding, input);
            w.heights.set(key, {
                key,
                height,
                contentVersion: binding.version
            });
            return binding;
        }).catch(e => {
            retire(binding, 'error', w.cleanupErrors);
            throw e;
        }).finally(() => {
            outstanding--;
        });
    }
    function selected(index: UiHeightIndex | ReturnType<UiHeightIndex['stageHeights']>, scroll: number, height: number): string[] {
        const selected: string[] = [];
        if (index.size === 0)
            return selected;
        const range = index.range(scroll, height, overscan);
        for (let i = range.start; i < range.end; i++)
            selected.push(index.keyAt(i));
        for (const key of retentions.keys())
            if (!selected.includes(key))
                selected.push(key);
        if (selected.length > residentCap)
            fail('UI_LIMIT');
        let retainedOnly = 0;
        for (const key of retentions.keys()) {
            const i = index.indexOf(key);
            if (i < range.start || i >= range.end)
                retainedOnly++;
        }
        if (retainedOnly > retainedCap)
            fail('UI_LIMIT');
        return selected;
    }
    function retireLeaf(binding: LeafBinding, errors: unknown[] = []) {
        if (binding.terminal) return;
        binding.terminal = true;
        binding.source = undefined;
        delete binding.content;
        delete binding.measure;
        allLeafBindings.delete(binding);
        try { binding.scope.dispose(); }
        catch (cause) { errors.push(cause); }
    }
    function makeLeafBinding(w: WindowState, name: string, captured: CapturedLeafContent, width: number): Promise<LeafBinding> {
        if (outstandingLeaves >= 4096) fail('UI_PENDING_LIMIT');
        if (allLeafBindings.size - leafBindings.size >= 4096) fail('UI_LIMIT');
        const scope = port.scope(port.createScope());
        let wrapper: DisplayObjectContainer;
        try { wrapper = display.createWrapper(scope.scope); }
        catch (cause) { scope.dispose(); throw cause; }
        const binding: LeafBinding = { id: name, width, density, scope, wrapper, source: captured, terminal: false };
        allLeafBindings.add(binding);
        w.leafBindings.set(name, binding);
        const context = freeze({ scope: scope.scope, width, density, signal: scope.signal });
        outstandingLeaves++;
        let returned: ReturnType<CapturedLeafContent['prepare']>;
        try { returned = captured.prepare.call(captured.identity, context); }
        catch (cause) { outstandingLeaves--; retireLeaf(binding, w.cleanupErrors); return Promise.reject(cause); }
        return Promise.resolve(returned).then(value => {
            if (binding.terminal || closed || desired !== w.revision) {
                retireLeaf(binding, w.cleanupErrors);
                fail('UI_STALE');
            }
            const content = value.content, height = number(value.measuredHeight, 0, 1048576);
            display.validateContent(content, scope.scope);
            check(w.revision);
            binding.content = content;
            binding.height = height;
            binding.measure = fixedLeafMeasurement(width, height, binding.source!.revision);
            return binding;
        }).catch(cause => {
            retireLeaf(binding, w.cleanupErrors);
            throw cause;
        }).finally(() => { outstandingLeaves--; });
    }
    function makeWindow(revision: number): WindowState {
        return { cleanupErrors: [], revision, source, index: undefined, plan: undefined, box: undefined,
            width: 0, height: 0, scroll: 0, round: 0, heights: new Map(heightUpdates),
            bindings: new Map(), leafBindings: new Map() };
    }
    function initializeWindow(w: WindowState): void | Promise<void> {
        const baseTree = tree, sources = leafContents, widths = new Map<string, number>();
        if (sources.size !== 0) {
            planUiLayout(leafConstraintTree(baseTree, sources, widths), size, density);
            check(w.revision);
            const work: Promise<LeafBinding>[] = [], force = new Set<string>();
            function collectMeasureDirty(node: UiLayoutNode, ancestorDirty: boolean): void {
                const measureDirty = ancestorDirty || dirty.get(node.id) === 'measure';
                if (node.kind === 'leaf' && measureDirty) force.add(node.id);
                for (const child of node.children ?? []) collectMeasureDirty(child, measureDirty);
            }
            collectMeasureDirty(baseTree.root, false);
            for (const [name, captured] of sources) {
                const width = number(widths.get(name)!, Number.MIN_VALUE, 16384), prior = leafBindings.get(name);
                if (!force.has(name) && prior !== undefined && !prior.terminal && prior.source?.identity === captured.identity
                    && prior.source.revision === captured.revision && prior.source.prepare === captured.prepare
                    && prior.width === width && prior.density === density) {
                    w.leafBindings.set(name, prior);
                    continue;
                }
                const promise = makeLeafBinding(w, name, captured, width);
                void promise.catch(() => {});
                work.push(promise);
                check(w.revision);
            }
            return Promise.all(work).then(() => {
                check(w.revision);
                completeWindow(w, baseTree);
            });
        }
        completeWindow(w, baseTree);
    }
    function completeWindow(w: WindowState, baseTree: UiLayoutTree): void {
        const measures = new Map<string, NonNullable<UiLayoutNode['measure']>>();
        for (const [name, binding] of w.leafBindings) measures.set(name, binding.measure!);
        const nextPlan = planUiLayout(measures.size === 0 ? baseTree : leafMeasuredTree(baseTree, measures), size, density, plan, dirty);
        check(w.revision);
        const box = nextPlan.boxes.find(b => b.id === listId), width = box?.innerWidth ?? 0, height = box?.innerHeight ?? 0;
        if (box !== undefined && (width <= 0 || height <= 0)) fail('UI_VALUE_INVALID');
        const index = w.source === undefined ? undefined : w.source === committedSource && committedIndex !== undefined
            && snapshot.boxes.find(b => b.id === listId)?.innerWidth === width && snapshot.density === density
            ? committedIndex : new UiHeightIndex(w.source.records, width, density, committedIndex);
        for (const key of retentions.keys()) {
            const b = bindings.get(key);
            if (b !== undefined && (w.source?.byKey.get(key)?.contentVersion !== b.version || width !== b.width || density !== b.density)) fail('UI_ROW_RETAINED');
        }
        const scroll = index === undefined ? 0 : explicitScroll !== undefined ? index.clampScroll(explicitScroll, height)
            : committedIndex === undefined ? 0 : index.preserveAnchor(snapshot.anchor, committedIndex, height);
        w.plan = nextPlan; w.box = box; w.width = width; w.height = height; w.index = index; w.scroll = scroll;
    }
    function token(status: UiPreparation['status'], candidate?: Candidate): UiPreparation {
        const result = freeze({
            status,
            desiredRevision: desired,
            baseCommittedRevision: committed
        }) as UiPreparation;
        const entry: TokenState = {
            used: false,
            ...(candidate === undefined ? {}
                : {
                    candidate
                })
        };
        tokens.set(result, entry);
        if (candidate !== undefined) {
            candidates.add(candidate);
            candidateEntries.set(candidate, entry);
        }
        return result;
    }
    // Each explicit prepare expands the detached preparedWindow once, with a hard eight-round limit.
    async function prepareWork(revision: number): Promise<UiPreparation> {
        if (desired === committed)
            return token('unchanged');
        if (preparedWindow === undefined || preparedWindow.revision !== revision)
            preparedWindow = makeWindow(revision);
        const w = preparedWindow;
        if (w.plan === undefined) {
            const initialization = initializeWindow(w);
            if (initialization !== undefined) await initialization;
        }
        check(revision);
        w.round++;
        if (w.round > 8) {
            discardWindow();
            fail('UI_LAYOUT_UNSTABLE');
        }
        let journal = w.index?.stageHeights([...w.heights.values()]);
        let view = journal ?? w.index;
        if (view !== undefined)
            w.scroll = explicitScroll !== undefined ? view.clampScroll(explicitScroll, w.height) : committedIndex === undefined ? view.clampScroll(w.scroll, w.height) : view.preserveAnchor(snapshot.anchor, committedIndex, w.height);
        const keys = view === undefined ? [] : selected(view, w.scroll, w.height);
        const work: Promise<Binding>[] = [];
        for (const key of keys) {
            if (compatible(w.bindings.get(key), w, key))
                continue;
            const live = bindings.get(key);
            if (compatible(live, w, key)) {
                w.bindings.set(key, live);
                continue;
            }
            const promise = makeBinding(w, key);
            void promise.catch(() => {
            });
            work.push(promise);
            check(revision);
        }
        // Do not retain Fenwick base/journal references across ignored callbacks.
        journal = undefined;
        view = undefined;
        await Promise.all(work);
        check(revision);
        journal = w.index?.stageHeights([...w.heights.values()]);
        view = journal ?? w.index;
        if (view !== undefined)
            w.scroll = explicitScroll !== undefined ? view.clampScroll(explicitScroll, w.height) : committedIndex === undefined ? view.clampScroll(w.scroll, w.height) : view.preserveAnchor(snapshot.anchor, committedIndex, w.height);
        const finalKeys = view === undefined ? [] : selected(view, w.scroll, w.height);
        if (finalKeys.some(key => !compatible(w.bindings.get(key), w, key))) {
            if (w.round >= 8) {
                discardWindow();
                fail('UI_LAYOUT_UNSTABLE');
            }
            return token('pending');
        }
        const updates: UiDisplayUpdate[] = [], nextBindings = new Map<string, Binding>(), nextShells = new Map<string, Shell>(), freshShells: Shell[] = [], fillScopes: ScopePort[] = [], rows: UiRowSnapshot[] = [];
        const available = [...pool, ...[...shells].filter(([key]) => !finalKeys.includes(key)).map(([, s]) => s)];
        const childWrappers: DisplayObjectContainer[] = [];
        try {
            let priorIndex = -2, priorEnd = 0;
            for (const key of finalKeys) {
                const b = w.bindings.get(key)!, i = (view!).indexOf(key), top = i === priorIndex + 1 ? priorEnd : (view!).prefix(i), y = top - w.scroll, h = (view!).heightAt(i), visible = y + h > 0 && y < w.height;
                priorIndex = i;
                priorEnd = top + h;
                const shell = shells.get(key) ?? available.shift() ?? (() => {
                    const scope = port.scope(port.createScope());
                    const item = {
                        scope,
                        wrapper: display.createWrapper(scope.scope)
                    };
                    freshShells.push(item);
                    return item;
                })();
                nextBindings.set(key, b);
                nextShells.set(key, shell);
                childWrappers.push(shell.wrapper);
                updates.push({
                    wrapper: shell.wrapper,
                    x: 0,
                    y,
                    visible,
                    children: [b.wrapper],
                    touchEnabled: false,
                    touchChildren: true
                });
                updates.push({
                    wrapper: b.wrapper,
                    x: 0,
                    y: 0,
                    visible,
                    children: [b.content!],
                    hitArea: {
                        x: 0,
                        y: 0,
                        width: w.width,
                        height: h
                    },
                    touchEnabled: visible,
                    touchChildren: false
                });
                rows.push(freeze({
                    key,
                    index: i,
                    bindingGeneration: b.generation,
                    contentVersion: b.version,
                    box: freeze({
                        x: (w.box!).innerX,
                        y: (w.box!).innerY + y,
                        width: w.width,
                        height: h
                    }),
                    visible
                }));
            }
            const rootChildren: DisplayObjectContainer[] = [], paintOrder = new Map<DisplayObjectContainer, number>();
            for (const [paintIndex, box] of (w.plan!).boxes.entries()) {
                const node = tree.nodes.get(box.id)!;
                if (node.kind === 'leaf' && node.fill !== undefined) {
                    const scope = port.scope(port.createScope());
                    fillScopes.push(scope);
                    const shape = new Sprite();
                    scope.use(shape);
                    const color = node.fill;
                    shape.graphics.beginFill(color.color, color.alpha ?? 1).drawRect(0, 0, box.width, box.height).endFill();
                    const wrapper = display.createWrapper(scope.scope);
                    updates.push({
                        wrapper,
                        x: box.x,
                        y: box.y,
                        children: [shape],
                        touchEnabled: false,
                        touchChildren: false
                    });
                    rootChildren.push(wrapper);
                    paintOrder.set(wrapper, paintIndex);
                }
            }
            for (const [paintIndex, box] of (w.plan!).boxes.entries()) {
                const binding = w.leafBindings.get(box.id);
                if (binding === undefined) continue;
                updates.push({ wrapper: binding.wrapper, x: box.innerX, y: box.innerY, children: [binding.content!],
                    hitArea: { x: 0, y: 0, width: box.innerWidth, height: box.innerHeight },
                    touchEnabled: false, touchChildren: true });
                rootChildren.push(binding.wrapper);
                paintOrder.set(binding.wrapper, paintIndex);
            }
            if (w.box !== undefined && listWrapper !== undefined) {
                rootChildren.push(listWrapper);
                paintOrder.set(listWrapper, (w.plan!).boxes.findIndex(box => box.id === listId));
                updates.push({
                    wrapper: listWrapper,
                    x: w.box.innerX,
                    y: w.box.innerY,
                    clipRect: {
                        x: 0,
                        y: 0,
                        width: w.width,
                        height: w.height
                    },
                    children: childWrappers,
                    touchEnabled: false,
                    touchChildren: true
                });
            }
            updates.push({
                wrapper: rootWrapper,
                x: position.x,
                y: position.y,
                clipRect: {
                    x: 0,
                    y: 0,
                    width: size.width,
                    height: size.height
                },
                children: rootChildren,
                touchEnabled: false,
                touchChildren: true
            });
            rootChildren.sort((a, b) => paintOrder.get(a)! - paintOrder.get(b)!);
            const displayToken = display.prepare(rootWrapper, updates);
            check(revision);
            const nextSnapshot: UiSnapshot = freeze({
                id: listId ?? id,
                rootId: id,
                committedRevision: revision,
                desiredRevision: revision,
                origin: position,
                viewport: size,
                density,
                boxes: (w.plan!).boxes,
                rows: freeze(rows),
                scrollOffset: w.scroll,
                scrollExtent: view?.totalHeight ?? 0,
                anchor: view?.anchor(w.scroll),
                counters: counters(rows, w.index)
            });
            const used = new Set(nextShells.values()), availablePool = [...pool, ...shells.values()].filter((s, i, a) => !used.has(s) && a.indexOf(s) === i), nextPool = availablePool.slice(0, residentCap - nextShells.size), discardedShells = availablePool.slice(residentCap - nextShells.size);
            const retiring: {
                binding: Binding;
                reason: RowUnbindInfo['reason'];
            }[] = [];
            for (const [key, b] of bindings)
                if (nextBindings.get(key) !== b)
                    retiring.push({
                        binding: b,
                        reason: w.source?.byKey.has(key) ? (w.source.byKey.get(key)!).contentVersion === b.version ? 'recycle' : 'replace' : 'delete'
                    });
            for (const b of w.bindings.values())
                if (nextBindings.get(b.key) !== b && !retiring.some(r => r.binding === b))
                    retiring.push({
                        binding: b,
                        reason: 'recycle'
                    });
            return token('ready', {
                nextPool,
                discardedShells,
                retiring,
                oldFills: fills,
                retiringLeaves: [...leafBindings.values()].filter(binding => w.leafBindings.get(binding.id) !== binding),
                preparedWindow: w,
                rows: nextSnapshot.rows,
                bindings: nextBindings,
                shells: nextShells,
                freshShells,
                fillScopes,
                displayToken,
                indexJournal: journal,
                snapshot: nextSnapshot,
                inputGeneration
            });
        }
        catch (e) {
            for (const s of freshShells)
                s.scope.dispose();
            for (const s of fillScopes)
                s.dispose();
            throw e;
        }
    }
    function clearCandidate(candidate: Candidate, errors: unknown[] = []) {
        if (!candidates.delete(candidate))
            return;
        const entry = candidateEntries.get(candidate);
        if (entry !== undefined) {
            entry.retired = true;
            delete entry.candidate;
        }
        candidateEntries.delete(candidate);
        for (const shell of candidate.freshShells) {
            try {
                shell.scope.dispose();
            }
            catch (cause) {
                errors.push(cause);
            }
        }
        for (const scope of candidate.fillScopes) {
            try {
                scope.dispose();
            }
            catch (cause) {
                errors.push(cause);
            }
        }
    }
    const handle: VirtualListHandle<unknown> = freeze({
        setSource(value: VirtualDataSource<unknown>) {
            admit('source', () => {
                const revision = desired;
                const captured = captureSource(value);
                check(revision);
                if (source?.identity === value && source.revision === captured.revision) {
                    if (source.bind !== captured.bind || source.unbind !== captured.unbind || source.records.length !== captured.records.length || source.records.some((r, i) => {
                        const other = captured.records[i]!;
                        return r.key !== other.key || r.contentVersion !== other.contentVersion || r.estimatedHeight !== other.estimatedHeight || r.value !== other.value;
                    }))
                        fail('UI_SOURCE_REVISION');
                    return;
                }
                if (source !== undefined && captured.revision <= source.revision)
                    fail('UI_SOURCE_REVISION');
                for (const key of retentions.keys())
                    if (captured.byKey.get(key)?.contentVersion !== bindings.get(key)?.version)
                        fail('UI_ROW_RETAINED');
                source = captured;
                change();
            });
        },
        setScrollOffset(value: number) {
            admit('scroll', () => {
                const scroll = number(value, -Number.MAX_VALUE, Number.MAX_VALUE);
                if (explicitScroll === scroll || explicitScroll === undefined && snapshot.scrollOffset === scroll)
                    return;
                explicitScroll = scroll;
                change();
            });
        },
        updateHeights(values: readonly {
            key: string;
            height: number;
            contentVersion: number;
        }[]) {
            admit('heights', () => {
                const revision = desired, seen = new Set<string>(), accepted: {
                    key: string;
                    height: number;
                    contentVersion: number;
                }[] = [];
                for (const v of values) {
                    const key = v.key, height = number(v.height, 1, 1048576), contentVersion = v.contentVersion;
                    if (seen.has(key) || !source?.byKey.has(key))
                        fail('UI_VALUE_INVALID');
                    seen.add(key);
                    if ((source.byKey.get(key)!).contentVersion === contentVersion)
                        accepted.push({
                            key,
                            height,
                            contentVersion
                        });
                }
                check(revision);
                if (accepted.length === 0)
                    return;
                for (const v of accepted)
                    heightUpdates.set(v.key, v);
                change();
            });
        },
        retain(key: string, reason: 'focus' | 'composition') {
            return admit('retain', () => {
                if (reason !== 'focus' && reason !== 'composition')
                    fail('UI_VALUE_INVALID');
                if (!bindings.has(key))
                    fail('UI_ROW_NOT_REALIZED');
                if (retentionCount >= 16)
                    fail('UI_LIMIT');
                const identity = {}, set = retentions.get(key) ?? new Set<object>();
                set.add(identity);
                retentions.set(key, set);
                retentionCount++;
                change();
                let released = false;
                return freeze({
                    release() {
                        if (released)
                            return;
                        released = true;
                        if (closed)
                            return;
                        set.delete(identity);
                        retentionCount--;
                        if (set.size === 0)
                            retentions.delete(key);
                        change();
                    }
                });
            });
        },
        snapshot() {
            return api.snapshot();
        }
    });
    const api: UiRoot = {
        id,
        get state() {
            return closed ? 'closed' : 'open';
        },
        setViewport(value, newDensity) {
            admit('viewport', () => {
                const revision = desired, newSize = viewport(value), d = number(newDensity, Number.MIN_VALUE, 8);
                origin(position, newSize);
                check(revision);
                if (newSize.width === size.width && newSize.height === size.height && d === density)
                    return;
                for (const key of retentions.keys())
                    if (d !== density || newSize.width !== size.width)
                        fail('UI_ROW_RETAINED');
                size = newSize;
                density = d;
                change();
            });
        },
        setOrigin(value) {
            admit('origin', () => {
                const revision = desired, p = origin(value, size);
                check(revision);
                if (p.x === position.x && p.y === position.y)
                    return;
                position = p;
                change();
            });
        },
        setTree(value) {
            admit('tree', () => {
                const revision = desired, captured = captureUiTree(value), t = captured.tree;
                check(revision);
                if (t.nodes.size !== tree.nodes.size || [...t.nodes].some(([key, node]) => tree.nodes.get(key)?.kind !== node.kind))
                    fail('UI_TREE_SHAPE');
                const list = listId === undefined ? undefined : t.nodes.get(listId), s = list === undefined ? undefined : captureSource(list.source as VirtualDataSource<unknown>);
                if (s !== undefined && source !== undefined && s.revision <= source.revision && (s.revision !== source.revision || s.identity !== source.identity || s.bind !== source.bind || s.unbind !== source.unbind || s.records.length !== source.records.length || s.records.some((record, index) => { const old = (source!).records[index]!; return record.key !== old.key || record.contentVersion !== old.contentVersion || record.estimatedHeight !== old.estimatedHeight || record.value !== old.value; })))
                    fail('UI_SOURCE_REVISION');
                check(revision);
                for (const key of retentions.keys())
                    if (s?.byKey.get(key)?.contentVersion !== bindings.get(key)?.version)
                        fail('UI_ROW_RETAINED');
                for (const [name, content] of captured.contents) {
                    const previous = leafContents.get(name);
                    if (previous?.identity === content.identity && (content.revision < previous.revision
                        || content.revision === previous.revision && content.prepare !== previous.prepare)) fail('UI_SOURCE_REVISION');
                }
                tree = withoutSources(t);
                leafContents = captured.contents;
                if (s !== undefined)
                    source = s;
                change();
            });
        },
        setInput(value) {
            admit('input', () => {
                if (value === inputIdentity)
                    return;
                if (busy || committing)
                    fail('UI_BUSY');
                port.assertIdle();
                display.assertStage();
                if (input !== undefined && input.state() !== 'closed' && input.activeContacts() !== 0)
                    fail('UI_INPUT_BUSY');
                const revision = desired, association = inputGeneration, oldInput = input;
                const bridge = value === undefined ? undefined : port.requireInput(value);
                validateNewInput(bridge);
                const staged = new Map<Binding, (() => void)[]>();
                try {
                    for (const b of allBindings)
                        staged.set(b, subscriptions(b, bridge));
                    port.assertIdle();
                    display.assertStage();
                    check(revision);
                    if (inputGeneration !== association || input !== oldInput)
                        fail('UI_STALE');
                    if (oldInput !== undefined && oldInput.state() !== 'closed' && oldInput.activeContacts() !== 0)
                        fail('UI_INPUT_BUSY');
                    validateNewInput(bridge);
                }
                catch (e) {
                    for (const list of staged.values())
                        for (const remove of list)
                            remove();
                    throw e;
                }
                for (const [b, list] of staged) {
                    for (const remove of b.subscriptions)
                        remove();
                    b.subscriptions = list;
                }
                inputIdentity = value;
                input = bridge;
                inputGeneration = next(inputGeneration);
            });
        },
        list<T>(key: string) {
            open();
            if (key !== listId)
                fail('UI_LIST_NOT_FOUND');
            return handle as VirtualListHandle<T>;
        },
        invalidate(key, kind) {
            admit('invalidate', () => {
                if (!tree.nodes.has(key) || !['measure', 'arrange', 'paint', 'interaction', 'semantic'].includes(kind))
                    fail('UI_VALUE_INVALID');
                const rank = { measure: 4, arrange: 3, paint: 2, interaction: 1, semantic: 0 };
                const previous = dirty.get(key);
                if (previous === undefined || rank[kind] > rank[previous])
                    dirty.set(key, kind);
                change();
            });
        },
        async prepare() {
            open();
            port.assertIdle();
            if (busy || committing)
                fail('UI_BUSY');
            for (const c of [...candidates])
                clearCandidate(c);
            busy = true;
            const revision = desired;
            let rejectCancellation: (e: unknown) => void = () => {
            };
            const canceled = new Promise<never>((_, reject) => {
                rejectCancellation = reject;
            });
            cancelFlight = rejectCancellation;
            let flightWindow: WindowState | undefined;
            try {
                const operation = prepareWork(revision);
                flightWindow = preparedWindow;
                return await Promise.race([operation, canceled]);
            }
            catch (e) {
                const cleanupErrors = flightWindow?.cleanupErrors ?? [];
                if (desired === revision)
                    discardWindow(cleanupErrors);
                throw preparationError(e, cleanupErrors);
            }
            finally {
                if (cancelFlight === rejectCancellation)
                    cancelFlight = undefined;
                busy = false;
            }
        },
        commit(preparation) {
            const entry = tokens.get(preparation);
            if (entry === undefined || entry.used)
                fail('UI_PREPARATION_INVALID');
            if (preparation.status === 'pending')
                fail('UI_NOT_READY');
            if (closed) {
                entry.used = true;
                if (entry.candidate !== undefined)
                    clearCandidate(entry.candidate);
                return result('closed', []);
            }
            port.assertIdle();
            if (busy || committing)
                fail('UI_BUSY');
            display.assertStage();
            if (entry.retired === true || entry.candidate !== undefined && !candidates.has(entry.candidate) || preparation.desiredRevision !== desired || preparation.baseCommittedRevision !== committed || entry.candidate !== undefined && entry.candidate.inputGeneration !== inputGeneration) {
                entry.used = true;
                if (entry.candidate !== undefined)
                    clearCandidate(entry.candidate);
                return result('stale', []);
            }
            if (preparation.status === 'unchanged') {
                entry.used = true;
                return result('unchanged', []);
            }
            const c = entry.candidate!;
            committing = true;
            const errors: unknown[] = [];
            // All child arrays, pool membership, retire lists and the snapshot already exist.
            // Runtime publication and index/reference assignment contain no user callbacks.
            try {
                display.commit(c.displayToken);
                c.indexJournal?.apply();
                candidates.delete(c);
                candidateEntries.delete(c);
                delete entry.candidate;
                entry.used = true;
                pool = c.nextPool;
                bindings = c.bindings;
                shells = c.shells;
                fills = c.fillScopes;
                leafBindings = c.preparedWindow.leafBindings;
                committed = desired;
                committedIndex = c.preparedWindow.index;
                committedSource = c.preparedWindow.source;
                plan = c.preparedWindow.plan;
                snapshot = c.snapshot;
                preparedWindow = undefined;
                explicitScroll = undefined;
                heightUpdates.clear();
                dirty.clear();
                // Observers see the new complete revision before any old binding is retired.
                sync(errors);
                for (const leaf of c.retiringLeaves)
                    retireLeaf(leaf, errors);
                for (const item of c.retiring)
                    retire(item.binding, item.reason, errors);
                for (const s of c.discardedShells) {
                    try {
                        s.scope.dispose();
                    }
                    catch (e) {
                        errors.push(e);
                    }
                }
                for (const s of c.oldFills) {
                    try {
                        s.dispose();
                    }
                    catch (e) {
                        errors.push(e);
                    }
                }
                return result('committed', errors);
            }
            finally {
                committing = false;
            }
        },
        snapshot() {
            return freeze({
                ...snapshot,
                desiredRevision: desired,
                counters: counters(snapshot.rows)
            });
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            owner.remove(onOwnerAbort);
            const errors: unknown[] = preparedWindow?.cleanupErrors ?? [];
            cancelFlight?.(new EgretError('UI_CLOSED'));
            for (const candidate of [...candidates])
                clearCandidate(candidate, errors);
            try {
                display.detach(rootWrapper);
            }
            catch (e) {
                errors.push(e);
            }
            if (input?.state() === 'active')
                sync(errors);
            discardWindow(errors, 'dispose');
            for (const leaf of [...allLeafBindings])
                retireLeaf(leaf, errors);
            leafBindings.clear();
            for (const b of [...allBindings])
                retire(b, 'dispose', errors);
            for (const s of [...shells.values(), ...pool]) {
                try {
                    s.scope.dispose();
                }
                catch (e) {
                    errors.push(e);
                }
            }
            for (const s of fills) {
                try {
                    s.dispose();
                }
                catch (e) {
                    errors.push(e);
                }
            }
            try {
                if (listWrapper !== undefined)
                    display.disposeWrapper(listWrapper);
                display.disposeWrapper(rootWrapper);
            }
            catch (e) {
                errors.push(e);
            }
            bindings.clear();
            shells.clear();
            pool = [];
            fills = [];
            preparedWindow = undefined;
            retentions.clear();
            retentionCount = 0;
            heightUpdates.clear();
            dirty.clear();
            source = undefined;
            committedSource = undefined;
            committedIndex = undefined;
            plan = undefined;
            tree = emptyTree;
            leafContents = new Map();
            input = undefined;
            inputIdentity = undefined;
            unsubscribeClose();
            snapshot = freeze({
                ...snapshot,
                rows: freeze([]),
                boxes: freeze([]),
                scrollExtent: 0,
                scrollOffset: 0,
                anchor: undefined,
                counters: counters()
            });
            if (errors.length !== 0)
                throw new EgretError('UI_CLEANUP_FAILED', {
                    cause: errors[0],
                    cleanupErrors: errors.slice(1)
                });
        }
    };
    function onOwnerAbort() {
        api.dispose();
    }
    function result(kind: UiCommitResult['kind'], errors: unknown[]): UiCommitResult {
        return freeze({
            kind,
            revision: committed,
            postCommitErrors: freeze(errors)
        });
    }
    try {
        const placeholder = display.prepare(rootWrapper, [{
                wrapper: rootWrapper,
                x: position.x,
                y: position.y,
                clipRect: {
                    x: 0,
                    y: 0,
                    width: size.width,
                    height: size.height
                },
                children: [],
                touchEnabled: false,
                touchChildren: false
            }
        ]);
        port.assertIdle();
        display.commit(placeholder);
        owner.use({
            dispose: () => api.dispose()
        });
        owner.add(onOwnerAbort);
        unsubscribeClose = port.onClose(() => api.dispose());
        return freeze(api);
    }
    catch (e) {
        try {
            api.dispose();
        }
        catch {
        }
        throw e;
    }
}
