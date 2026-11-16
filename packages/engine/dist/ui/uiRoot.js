// SPDX-License-Identifier: Apache-2.0
import { requireUiTheme, sameThemeMetrics, applyUiTheme } from './theme.js';
import { EgretError, DisplayObject } from '@egret/runtime';
import { captureUiLayout, planUiLayout, UiHeightIndex, createUiDisplayOperations } from '@egret/runtime/ui';
import { requireUiEngine } from '../internal/uiFactoryState.js';
import { registerUiRoot } from '../internal/uiRootState.js';
import { captureSource, captureReveal, revealScroll } from './virtualList.js';
import { createUiKeyboardFocus } from './keyboardFocus.js';
import { captureUiTree, leafConstraintTree, leafMeasuredTree, fixedLeafMeasurement } from './leafContent.js';
import { withoutSources, preparationError, fail, next, number, viewport, origin } from './uiRootModel.js';
import { createUiRootDisplayDraft, stageUiRootDisplay } from './uiRootDisplay.js';
const freeze = Object.freeze;
/** One owned transaction domain over the genuine display and input authorities. */
export function createUiRoot(options) {
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
    let theme = options.theme;
    requireUiTheme(theme);
    let authoredTree = capturedTree.tree, themeBindings = capturedTree.themes;
    let tree = applyUiTheme(authoredTree, themeBindings, theme), leafContents = capturedTree.contents;
    const initialNodes = [...tree.nodes.values()];
    const listNodes = initialNodes.filter(n => n.kind === 'virtualList');
    if (listNodes.length > 1)
        fail('UI_LIMIT');
    const listId = listNodes[0]?.id;
    let source = listNodes[0] === undefined ? undefined : captureSource(listNodes[0].source);
    let explicitScroll = listNodes[0] === undefined
        ? undefined
        : number(listNodes[0].initialScrollOffset ?? 0, -Number.MAX_VALUE, Number.MAX_VALUE);
    let revealIntent;
    tree = withoutSources(tree);
    authoredTree = withoutSources(authoredTree);
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
    function validateNewInput(value) {
        if (value !== undefined && (value.state() !== 'active' || value.activeContacts() !== 0))
            fail('UI_INPUT_BUSY');
    }
    validateNewInput(input);
    const keyboardOptions = options.keyboard;
    const keyboardIdentity = keyboardOptions === undefined ? undefined : port.requireKeyboard(keyboardOptions.input);
    const keyboard = keyboardIdentity === undefined
        ? undefined
        : createUiKeyboardFocus(keyboardIdentity, keyboardOptions.idPrefix, keyboardOptions.tabStop);
    let layerVisible = true, layerPointer = true, layerKeyboard = true, layerGeneration = 0, layerOwned = false;
    let layerOrigin;
    keyboard?.validate(source?.byKey.keys() ?? []);
    let committedTheme, paintThemeOnly = false, paintCommitted = false, layoutPasses = 0;
    function layout(...args) {
        layoutPasses = next(layoutPasses);
        return planUiLayout(...args);
    }
    let closed = false, desired = 1, committed = 0, inputGeneration = 0, generation = 0, busy = false, committing = false;
    let closeEditorRoot = () => [];
    let cancelFlight, preparedWindow, plan, committedIndex, committedSource;
    let bindings = new Map(), shells = new Map(), pool = [], fills = [];
    let leafBindings = new Map();
    const allLeafBindings = new Set();
    let outstandingLeaves = 0;
    const allBindings = new Set(), retentions = new Map(), dirty = new Map(), heightUpdates = new Map(), admissions = new Set();
    // Native editors retain row identity while permitting authenticated readonly re-publication.
    // Public focus/composition retention continues to lock binding content and metrics.
    const editorRetentions = new Set();
    const bindingLocked = (key) => [...(retentions.get(key) ?? [])].some(token => !editorRetentions.has(token));
    const tokens = new WeakMap();
    const candidates = new Set();
    const candidateEntries = new Map();
    let outstanding = 0, bindTotal = 0, unbindTotal = 0, retentionCount = 0;
    let unsubscribeClose = () => { };
    const rootWrapper = display.createWrapper(owner.scope);
    const listWrapper = listId === undefined ? undefined : display.createWrapper(owner.scope);
    function counters(rows = [], index = committedIndex) {
        const listBox = plan?.boxes.find(box => box.id === listId);
        const range = index === undefined || listBox === undefined
            ? undefined
            : index.range(snapshot.scrollOffset, listBox.innerHeight, overscan);
        const overscanOnly = range === undefined
            ? 0
            : rows.filter(row => !row.visible && row.index >= range.start && row.index < range.end).length;
        return freeze({
            layoutPasses,
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
            measurementCalls: paintCommitted ? 0 : (plan?.measurementCalls ?? 0),
            reusedMeasurements: paintCommitted ? 0 : (plan?.reusedMeasurements ?? 0),
            bindTotal,
            unbindTotal,
            resourceDemands: undefined,
            resourceLeases: undefined
        });
    }
    let snapshot = freeze({
        theme: undefined,
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
    function admit(name, action) {
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
    function retire(binding, reason, errors = []) {
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
                pairedSource.unbind.call(pairedSource.identity, freeze({
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
    function discardWindow(errors, reason = 'cancel') {
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
    function change(onlyTheme = false) {
        paintThemeOnly = onlyTheme && (desired === committed || paintThemeOnly) && sameThemeMetrics(committedTheme, theme);
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
    function check(revision) {
        open();
        if (desired !== revision)
            fail('UI_STALE');
    }
    function sync(errors) {
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
    function subscriptions(binding, bridge) {
        if (bridge === undefined || callback === undefined)
            return [];
        const result = [];
        try {
            for (const kind of ['begin', 'move', 'end', 'cancel']) {
                const descriptor = bridge.events[kind];
                result.push(binding.wrapper.on(descriptor, event => {
                    if (closed || binding.terminal || bindings.get(binding.key) !== binding)
                        return;
                    const row = snapshot.rows.find(row => row.key === binding.key);
                    if (row === undefined)
                        return;
                    return callback(freeze({
                        kind,
                        listId: listId,
                        key: binding.key,
                        index: row.index,
                        bindingGeneration: binding.generation,
                        contentVersion: binding.version,
                        layoutRevision: committed,
                        target: binding.wrapper,
                        event
                    }));
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
    function compatible(binding, w, key) {
        const record = w.source?.byKey.get(key);
        return (binding !== undefined &&
            !binding.terminal &&
            record !== undefined &&
            binding.theme === w.theme &&
            binding.version === record.contentVersion &&
            binding.width === w.width &&
            binding.density === density);
    }
    function makeBinding(w, key) {
        if (outstanding >= residentCap)
            fail('UI_PENDING_LIMIT');
        if (allBindings.size - bindings.size >= residentCap)
            fail('UI_LIMIT');
        generation = next(generation);
        const record = w.source.byKey.get(key);
        const scope = port.scope(port.createScope());
        let wrapper;
        try {
            wrapper = display.createWrapper(scope.scope);
        }
        catch (e) {
            scope.dispose();
            throw e;
        }
        const binding = {
            theme: w.theme,
            key,
            version: record.contentVersion,
            generation,
            width: w.width,
            density,
            source: { identity: w.source.identity, bind: w.source.bind, unbind: w.source.unbind },
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
            theme: w.theme,
            key,
            index: w.index.indexOf(key),
            value: record.value,
            contentVersion: record.contentVersion,
            bindingGeneration: binding.generation,
            width: w.width,
            density,
            scope: scope.scope,
            signal: scope.signal,
            target: wrapper
        });
        binding.entered = true;
        bindTotal++;
        outstanding++;
        let returned;
        try {
            returned = binding.source.bind.call(binding.source.identity, context);
        }
        catch (e) {
            outstanding--;
            retire(binding, 'error', w.cleanupErrors);
            return Promise.reject(e);
        }
        return Promise.resolve(returned)
            .then(value => {
            if (binding.terminal || closed || desired !== w.revision) {
                retire(binding, 'cancel');
                fail('UI_STALE');
            }
            const content = value.content, height = number(value.measuredHeight, 1, 1048576);
            display.validateContent(content, scope.scope);
            check(w.revision);
            // Explicit height updates can supersede the measurement retained by a binding.
            const committedPosition = committedIndex?.indexOf(key) ?? -1;
            if (w.paintOnly && (committedPosition < 0 || height !== committedIndex.heightAt(committedPosition)))
                fail('UI_THEME_METRICS_CHANGED');
            binding.content = content;
            binding.height = height;
            binding.subscriptions = subscriptions(binding, input);
            w.heights.set(key, {
                key,
                height,
                contentVersion: binding.version
            });
            return binding;
        })
            .catch(e => {
            retire(binding, 'error', w.cleanupErrors);
            throw e;
        })
            .finally(() => {
            outstanding--;
        });
    }
    function selected(index, scroll, height) {
        const selected = [];
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
    function retireLeaf(binding, errors = []) {
        if (binding.terminal)
            return;
        binding.terminal = true;
        binding.source = undefined;
        delete binding.content;
        delete binding.measure;
        allLeafBindings.delete(binding);
        try {
            binding.scope.dispose();
        }
        catch (cause) {
            errors.push(cause);
        }
    }
    function makeLeafBinding(w, name, captured, width) {
        if (outstandingLeaves >= 4096)
            fail('UI_PENDING_LIMIT');
        if (allLeafBindings.size - leafBindings.size >= 4096)
            fail('UI_LIMIT');
        const scope = port.scope(port.createScope());
        let wrapper;
        try {
            wrapper = display.createWrapper(scope.scope);
        }
        catch (cause) {
            scope.dispose();
            throw cause;
        }
        const binding = {
            theme: w.theme,
            id: name,
            width,
            density,
            scope,
            wrapper,
            source: captured,
            terminal: false
        };
        allLeafBindings.add(binding);
        w.leafBindings.set(name, binding);
        const context = freeze({ theme: w.theme, scope: scope.scope, width, density, signal: scope.signal });
        outstandingLeaves++;
        let returned;
        try {
            returned = captured.prepare.call(captured.identity, context);
        }
        catch (cause) {
            outstandingLeaves--;
            retireLeaf(binding, w.cleanupErrors);
            return Promise.reject(cause);
        }
        return Promise.resolve(returned)
            .then(value => {
            if (binding.terminal || closed || desired !== w.revision) {
                retireLeaf(binding, w.cleanupErrors);
                fail('UI_STALE');
            }
            const content = value.content, height = number(value.measuredHeight, 0, 1048576);
            display.validateContent(content, scope.scope);
            check(w.revision);
            if (w.paintOnly && height !== leafBindings.get(name)?.height)
                fail('UI_THEME_METRICS_CHANGED');
            binding.content = content;
            binding.height = height;
            binding.measure = fixedLeafMeasurement(width, height, binding.source.revision);
            return binding;
        })
            .catch(cause => {
            retireLeaf(binding, w.cleanupErrors);
            throw cause;
        })
            .finally(() => {
            outstandingLeaves--;
        });
    }
    function makeWindow(revision) {
        return {
            theme,
            paintOnly: paintThemeOnly && plan !== undefined,
            cleanupErrors: [],
            revision,
            source,
            index: undefined,
            plan: undefined,
            box: undefined,
            width: 0,
            height: 0,
            scroll: 0,
            round: 0,
            heights: new Map(heightUpdates),
            bindings: new Map(),
            leafBindings: new Map()
        };
    }
    function initializeWindow(w) {
        const baseTree = tree, sources = leafContents, widths = new Map();
        if (sources.size !== 0) {
            if (w.paintOnly) {
                for (const box of plan.boxes)
                    if (sources.has(box.id))
                        widths.set(box.id, box.innerWidth);
            }
            else
                layout(leafConstraintTree(baseTree, sources, widths), size, density);
            check(w.revision);
            const work = [], force = new Set();
            function collectMeasureDirty(node, ancestorDirty) {
                const measureDirty = ancestorDirty || dirty.get(node.id) === 'measure' || !sameThemeMetrics(committedTheme, w.theme);
                if (node.kind === 'leaf' && measureDirty)
                    force.add(node.id);
                for (const child of node.children ?? [])
                    collectMeasureDirty(child, measureDirty);
            }
            collectMeasureDirty(baseTree.root, false);
            for (const [name, captured] of sources) {
                const width = number(widths.get(name), Number.MIN_VALUE, 16384), prior = leafBindings.get(name);
                if (!force.has(name) &&
                    prior !== undefined &&
                    !prior.terminal &&
                    prior.theme === w.theme &&
                    prior.source?.identity === captured.identity &&
                    prior.source.revision === captured.revision &&
                    prior.source.prepare === captured.prepare &&
                    prior.width === width &&
                    prior.density === density) {
                    w.leafBindings.set(name, prior);
                    continue;
                }
                const promise = makeLeafBinding(w, name, captured, width);
                void promise.catch(() => { });
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
    function completeWindow(w, baseTree) {
        const measures = new Map();
        for (const [name, binding] of w.leafBindings)
            measures.set(name, binding.measure);
        const layoutDirty = !sameThemeMetrics(committedTheme, w.theme)
            ? new Map(dirty).set(baseTree.root.id, 'measure')
            : dirty;
        const nextPlan = w.paintOnly
            ? plan
            : layout(measures.size === 0 ? baseTree : leafMeasuredTree(baseTree, measures), size, density, plan, layoutDirty);
        check(w.revision);
        const box = nextPlan.boxes.find(b => b.id === listId), width = box?.innerWidth ?? 0, height = box?.innerHeight ?? 0;
        if (box !== undefined && (width <= 0 || height <= 0))
            fail('UI_VALUE_INVALID');
        const index = w.source === undefined
            ? undefined
            : sameThemeMetrics(committedTheme, w.theme) &&
                w.source === committedSource &&
                committedIndex !== undefined &&
                snapshot.boxes.find(b => b.id === listId)?.innerWidth === width &&
                snapshot.density === density
                ? committedIndex
                : new UiHeightIndex(w.source.records, width, density, sameThemeMetrics(committedTheme, w.theme) ? committedIndex : undefined);
        for (const key of retentions.keys()) {
            const b = bindings.get(key);
            if (!w.source?.byKey.has(key) ||
                (bindingLocked(key) &&
                    b !== undefined &&
                    (b.theme !== w.theme ||
                        w.source?.byKey.get(key)?.contentVersion !== b.version ||
                        width !== b.width ||
                        density !== b.density)))
                fail('UI_ROW_RETAINED');
        }
        const scroll = index === undefined
            ? 0
            : explicitScroll !== undefined
                ? index.clampScroll(explicitScroll, height)
                : committedIndex === undefined
                    ? 0
                    : index.preserveAnchor(snapshot.anchor, committedIndex, height);
        w.plan = nextPlan;
        w.box = box;
        w.width = width;
        w.height = height;
        w.index = index;
        w.scroll = scroll;
    }
    function token(status, candidate) {
        const result = freeze({
            status,
            desiredRevision: desired,
            baseCommittedRevision: committed
        });
        const entry = {
            used: false,
            ...(candidate === undefined
                ? {}
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
    async function prepareWork(revision) {
        if (desired === committed)
            return token('unchanged');
        if (preparedWindow === undefined || preparedWindow.revision !== revision)
            preparedWindow = makeWindow(revision);
        const w = preparedWindow;
        if (w.plan === undefined) {
            const initialization = initializeWindow(w);
            if (initialization !== undefined)
                await initialization;
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
            w.scroll =
                revealIntent !== undefined
                    ? revealScroll(view, revealIntent, snapshot.scrollOffset, w.height)
                    : explicitScroll !== undefined
                        ? view.clampScroll(explicitScroll, w.height)
                        : committedIndex === undefined
                            ? view.clampScroll(w.scroll, w.height)
                            : view.preserveAnchor(snapshot.anchor, committedIndex, w.height);
        const keys = view === undefined ? [] : selected(view, w.scroll, w.height);
        const work = [];
        for (const key of keys) {
            if (compatible(w.bindings.get(key), w, key))
                continue;
            const live = bindings.get(key);
            if (compatible(live, w, key)) {
                w.bindings.set(key, live);
                continue;
            }
            const promise = makeBinding(w, key);
            void promise.catch(() => { });
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
            w.scroll =
                revealIntent !== undefined
                    ? revealScroll(view, revealIntent, snapshot.scrollOffset, w.height)
                    : explicitScroll !== undefined
                        ? view.clampScroll(explicitScroll, w.height)
                        : committedIndex === undefined
                            ? view.clampScroll(w.scroll, w.height)
                            : view.preserveAnchor(snapshot.anchor, committedIndex, w.height);
        const finalKeys = view === undefined ? [] : selected(view, w.scroll, w.height);
        if (finalKeys.some(key => !compatible(w.bindings.get(key), w, key))) {
            if (w.round >= 8) {
                discardWindow();
                fail('UI_LAYOUT_UNSTABLE');
            }
            return token('pending');
        }
        const draft = createUiRootDisplayDraft(pool, shells, finalKeys);
        const { updates, nextBindings, nextShells, freshShells, fillScopes, rows } = draft;
        try {
            stageUiRootDisplay(draft, {
                w,
                finalKeys,
                view,
                shells,
                port,
                display,
                tree,
                listWrapper,
                listId,
                rootWrapper,
                layerOrigin,
                position,
                size,
                layerVisible,
                layerPointer
            });
            const displayToken = display.prepare(rootWrapper, updates);
            check(revision);
            const nextSnapshot = freeze({
                theme: w.theme,
                id: listId ?? id,
                rootId: id,
                committedRevision: revision,
                desiredRevision: revision,
                origin: position,
                viewport: size,
                density,
                boxes: w.plan.boxes,
                rows: freeze(rows),
                scrollOffset: w.scroll,
                scrollExtent: view?.totalHeight ?? 0,
                anchor: view?.anchor(w.scroll),
                counters: counters(rows, w.index)
            });
            const used = new Set(nextShells.values()), availablePool = [...pool, ...shells.values()].filter((s, i, a) => !used.has(s) && a.indexOf(s) === i), nextPool = availablePool.slice(0, residentCap - nextShells.size), discardedShells = availablePool.slice(residentCap - nextShells.size);
            const retiring = [];
            for (const [key, b] of bindings)
                if (nextBindings.get(key) !== b)
                    retiring.push({
                        binding: b,
                        reason: w.source?.byKey.has(key)
                            ? w.source.byKey.get(key).contentVersion === b.version
                                ? 'recycle'
                                : 'replace'
                            : 'delete'
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
                inputGeneration,
                layerGeneration
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
    function clearCandidate(candidate, errors = []) {
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
    function retainRow(key, reason, editor = false) {
        return admit('retain', () => {
            if (reason !== 'focus' && reason !== 'composition')
                fail('UI_VALUE_INVALID');
            if (!bindings.has(key))
                fail('UI_ROW_NOT_REALIZED');
            if (retentionCount >= 16)
                fail('UI_LIMIT');
            const identity = {}, set = retentions.get(key) ?? new Set();
            set.add(identity);
            if (editor)
                editorRetentions.add(identity);
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
                    editorRetentions.delete(identity);
                    retentionCount--;
                    if (set.size === 0)
                        retentions.delete(key);
                    change();
                }
            });
        });
    }
    const handle = freeze({
        setSource(value) {
            admit('source', () => {
                const revision = desired;
                const captured = captureSource(value);
                keyboard?.validate(captured.byKey.keys());
                check(revision);
                if (source?.identity === value && source.revision === captured.revision) {
                    if (source.bind !== captured.bind ||
                        source.unbind !== captured.unbind ||
                        source.records.length !== captured.records.length ||
                        source.records.some((r, i) => {
                            const other = captured.records[i];
                            return (r.key !== other.key ||
                                r.contentVersion !== other.contentVersion ||
                                r.estimatedHeight !== other.estimatedHeight ||
                                r.value !== other.value);
                        }))
                        fail('UI_SOURCE_REVISION');
                    return;
                }
                if (source !== undefined && captured.revision <= source.revision)
                    fail('UI_SOURCE_REVISION');
                for (const key of retentions.keys())
                    if (!captured.byKey.has(key) ||
                        (bindingLocked(key) && captured.byKey.get(key)?.contentVersion !== bindings.get(key)?.version))
                        fail('UI_ROW_RETAINED');
                source = captured;
                revealIntent = undefined;
                change();
            });
        },
        reveal(key, options) {
            admit('reveal', () => {
                const revision = desired, intent = captureReveal(key, options);
                check(revision);
                if (intent !== undefined && !source?.byKey.has(intent.key))
                    fail('UI_UNKNOWN_KEY');
                if (intent === undefined && revealIntent === undefined)
                    return;
                revealIntent = intent;
                // Cancelling restores ordinary committed-anchor preservation, never a staged offset.
                explicitScroll = undefined;
                change();
            });
        },
        setScrollOffset(value) {
            admit('scroll', () => {
                const scroll = number(value, -Number.MAX_VALUE, Number.MAX_VALUE);
                // A scroll to where the list is changes nothing while nothing else waits. After a new source in the same turn it is not
                // nothing: the list would follow its anchor to another offset, and this says where it is to be instead.
                if (revealIntent === undefined &&
                    (explicitScroll === scroll ||
                        (explicitScroll === undefined && snapshot.scrollOffset === scroll && desired === committed)))
                    return;
                revealIntent = undefined;
                explicitScroll = scroll;
                change();
            });
        },
        updateHeights(values) {
            admit('heights', () => {
                const revision = desired, seen = new Set(), accepted = [];
                for (const v of values) {
                    const key = v.key, height = number(v.height, 1, 1048576), contentVersion = v.contentVersion;
                    if (seen.has(key) || !source?.byKey.has(key))
                        fail('UI_VALUE_INVALID');
                    seen.add(key);
                    if (source.byKey.get(key).contentVersion === contentVersion)
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
        focus(key, options) {
            open();
            if (keyboard === undefined)
                fail('UI_KEYBOARD_UNAVAILABLE');
            keyboard.focus(key, options);
        },
        getFocus() {
            return keyboard?.getFocus() ?? freeze({ key: undefined, focusVisible: false });
        },
        retain(key, reason) {
            return retainRow(key, reason);
        },
        snapshot() {
            return api.snapshot();
        }
    });
    const api = {
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
                    if (bindingLocked(key) && (d !== density || newSize.width !== size.width))
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
                const revision = desired, captured = captureUiTree(value), t = applyUiTheme(captured.tree, captured.themes, theme);
                check(revision);
                if (t.nodes.size !== tree.nodes.size ||
                    [...t.nodes].some(([key, node]) => tree.nodes.get(key)?.kind !== node.kind))
                    fail('UI_TREE_SHAPE');
                const list = listId === undefined ? undefined : t.nodes.get(listId), s = list === undefined ? undefined : captureSource(list.source);
                keyboard?.validate(s?.byKey.keys() ?? []);
                if (s !== undefined &&
                    source !== undefined &&
                    s.revision <= source.revision &&
                    (s.revision !== source.revision ||
                        s.identity !== source.identity ||
                        s.bind !== source.bind ||
                        s.unbind !== source.unbind ||
                        s.records.length !== source.records.length ||
                        s.records.some((record, index) => {
                            const old = source.records[index];
                            return (record.key !== old.key ||
                                record.contentVersion !== old.contentVersion ||
                                record.estimatedHeight !== old.estimatedHeight ||
                                record.value !== old.value);
                        })))
                    fail('UI_SOURCE_REVISION');
                check(revision);
                for (const key of retentions.keys())
                    if (!s?.byKey.has(key) ||
                        (bindingLocked(key) && s?.byKey.get(key)?.contentVersion !== bindings.get(key)?.version))
                        fail('UI_ROW_RETAINED');
                for (const [name, content] of captured.contents) {
                    const previous = leafContents.get(name);
                    if (previous?.identity === content.identity &&
                        (content.revision < previous.revision ||
                            (content.revision === previous.revision && content.prepare !== previous.prepare)))
                        fail('UI_SOURCE_REVISION');
                }
                authoredTree = withoutSources(captured.tree);
                themeBindings = captured.themes;
                tree = withoutSources(t);
                leafContents = captured.contents;
                if (s !== undefined) {
                    if (s.identity !== source?.identity || s.revision !== source?.revision)
                        revealIntent = undefined;
                    source = s;
                }
                change();
            });
        },
        setTheme(value) {
            admit('theme', () => {
                requireUiTheme(value);
                if (value === theme)
                    return;
                // Explicit focus/composition retention forbids replacing its live content.
                for (const key of retentions.keys())
                    if (bindingLocked(key) && bindings.get(key)?.theme !== value)
                        fail('UI_ROW_RETAINED');
                const resolved = applyUiTheme(authoredTree, themeBindings, value);
                theme = value;
                tree = resolved;
                change(true);
            });
        },
        setInput(value) {
            if (layerOwned && value !== inputIdentity)
                fail('UI_LAYER_INPUT_MISMATCH');
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
                const staged = new Map();
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
        list(key) {
            open();
            if (key !== listId)
                fail('UI_LIST_NOT_FOUND');
            return handle;
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
            let rejectCancellation = () => { };
            const canceled = new Promise((_, reject) => {
                rejectCancellation = reject;
            });
            cancelFlight = rejectCancellation;
            let flightWindow;
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
            if (entry.retired === true ||
                (entry.candidate !== undefined && !candidates.has(entry.candidate)) ||
                preparation.desiredRevision !== desired ||
                preparation.baseCommittedRevision !== committed ||
                (entry.candidate !== undefined &&
                    (entry.candidate.inputGeneration !== inputGeneration || entry.candidate.layerGeneration !== layerGeneration))) {
                entry.used = true;
                if (entry.candidate !== undefined)
                    clearCandidate(entry.candidate);
                return result('stale', []);
            }
            if (preparation.status === 'unchanged') {
                entry.used = true;
                return result('unchanged', []);
            }
            const c = entry.candidate;
            committing = true;
            const errors = [];
            // All child arrays, pool membership, retire lists and the snapshot already exist.
            // Runtime publication and index/reference assignment contain no user callbacks.
            try {
                const keyboardRows = c.rows.map(row => ({
                    key: row.key,
                    content: c.bindings.get(row.key).content,
                    visible: row.visible
                }));
                const restoreFocus = keyboard?.before(keyboardRows);
                // Cancellation callbacks may change or close the UI. Never publish their obsolete proposal.
                if (closed || desired !== preparation.desiredRevision || committed !== preparation.baseCommittedRevision) {
                    entry.used = true;
                    clearCandidate(c, errors);
                    return result(closed ? 'closed' : 'stale', errors);
                }
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
                committedTheme = c.preparedWindow.theme;
                paintCommitted = c.preparedWindow.paintOnly;
                paintThemeOnly = false;
                preparedWindow = undefined;
                explicitScroll = undefined;
                revealIntent = undefined;
                heightUpdates.clear();
                dirty.clear();
                try {
                    keyboard?.commit(keyboardRows, restoreFocus);
                }
                catch (cause) {
                    errors.push(cause);
                }
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
                ...(layerOrigin === undefined ? {} : { origin: layerOrigin, layerRevision: layerGeneration }),
                desiredRevision: desired,
                counters: counters(snapshot.rows)
            });
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            owner.remove(onOwnerAbort);
            const errors = preparedWindow?.cleanupErrors ?? [];
            errors.push(...closeEditorRoot());
            cancelFlight?.(new EgretError('UI_CLOSED'));
            for (const candidate of [...candidates])
                clearCandidate(candidate, errors);
            try {
                keyboard?.dispose();
            }
            catch (cause) {
                errors.push(cause);
            }
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
            editorRetentions.clear();
            retentionCount = 0;
            heightUpdates.clear();
            dirty.clear();
            source = undefined;
            revealIntent = undefined;
            committedSource = undefined;
            committedIndex = undefined;
            plan = undefined;
            tree = emptyTree;
            authoredTree = emptyTree;
            themeBindings = new Map();
            theme = undefined;
            committedTheme = undefined;
            leafContents = new Map();
            input = undefined;
            inputIdentity = undefined;
            unsubscribeClose();
            snapshot = freeze({
                ...snapshot,
                theme: undefined,
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
    // Layer publication has its own epoch: pending content can finish without resurrecting an old overlay.
    function presentLayer(value) {
        open();
        port.assertIdle();
        if (committing)
            fail('UI_BUSY');
        const p = origin({ x: value.x, y: value.y }, snapshot.viewport);
        display.presentRoot(rootWrapper, {
            x: p.x,
            y: p.y,
            visible: value.visible,
            interactive: value.pointerEnabled,
            ...(value.index === undefined ? {} : { index: value.index })
        });
        layerVisible = value.visible;
        layerPointer = value.pointerEnabled;
        layerKeyboard = value.keyboardEnabled;
        layerOrigin = p;
        layerGeneration = next(layerGeneration);
    }
    // Revoke only the layer presentation domain. This must also work during routed callbacks and Scope close.
    function releaseLayer(visible) {
        layerOrigin = undefined;
        layerVisible = visible;
        layerPointer = visible;
        layerKeyboard = visible;
        layerGeneration = next(layerGeneration);
        if (!closed)
            display.releaseRoot(rootWrapper, { x: snapshot.origin.x, y: snapshot.origin.y, visible });
    }
    const rootVisible = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'visible').get;
    const rootParent = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'parent').get;
    function anchor(target) {
        if (closed || committed === 0)
            return undefined;
        let box, content;
        if (target.kind === 'row') {
            if (target.listId !== listId)
                return undefined;
            const row = snapshot.rows.find(r => r.key === target.key && r.visible);
            if (!row)
                return undefined;
            box = row.box;
            content = bindings.get(target.key)?.content;
        }
        else {
            if (tree.nodes.get(target.id)?.kind !== 'leaf')
                return undefined;
            box = snapshot.boxes.find(b => b.id === target.id);
            content = leafBindings.get(target.id)?.content;
        }
        if (!box)
            return undefined;
        if (content) {
            let node = content, count = 0;
            while (node !== undefined && node !== rootWrapper) {
                if (++count > 64 || Reflect.apply(rootVisible, node, []) !== true)
                    return undefined;
                node = Reflect.apply(rootParent, node, []);
            }
            if (node !== rootWrapper)
                return undefined;
        }
        let left = Math.max(0, box.x), top = Math.max(0, box.y), right = Math.min(snapshot.viewport.width, box.x + box.width), bottom = Math.min(snapshot.viewport.height, box.y + box.height);
        if (target.kind === 'row') {
            const list = snapshot.boxes.find(b => b.id === listId);
            if (!list)
                return undefined;
            left = Math.max(left, list.innerX);
            top = Math.max(top, list.innerY);
            right = Math.min(right, list.innerX + list.innerWidth);
            bottom = Math.min(bottom, list.innerY + list.innerHeight);
        }
        if (right <= left || bottom <= top)
            return undefined;
        return freeze({ x: left, y: top, width: right - left, height: bottom - top });
    }
    function onOwnerAbort() {
        api.dispose();
    }
    function result(kind, errors) {
        return freeze({
            kind,
            revision: committed,
            postCommitErrors: freeze(errors)
        });
    }
    try {
        const placeholder = display.prepare(rootWrapper, [
            {
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
        owner.assertOpen();
        closeEditorRoot = registerUiRoot(api, options.engine, freeze({
            wrapper: rootWrapper,
            state: () => (closed ? 'closed' : 'open'),
            snapshot: () => api.snapshot(),
            layerState: () => freeze({
                snapshot,
                ready: !closed && !busy && !committing && candidates.size === 0 && desired === committed && committed > 0,
                mutable: !closed && !committing,
                lifetimeOpen: !closed && !owner.signal.aborted && !port.terminal(),
                visible: layerVisible,
                pointerEnabled: layerPointer,
                keyboardEnabled: layerKeyboard,
                input: inputIdentity,
                keyboard: keyboardIdentity
            }),
            presentLayer,
            releaseLayer,
            layerOwnership: (active) => {
                layerOwned = active;
            },
            anchor,
            lookup(target) {
                if (closed)
                    return undefined;
                if (target.kind === 'leaf') {
                    const leaf = leafBindings.get(target.id);
                    return leaf?.content === undefined ? undefined : freeze({ content: leaf.content, visible: true });
                }
                if (target.listId !== listId)
                    return undefined;
                const row = snapshot.rows.find(row => row.key === target.key), binding = bindings.get(target.key);
                return row === undefined || binding?.content === undefined
                    ? undefined
                    : freeze({
                        content: binding.content,
                        visible: row.visible,
                        bindingGeneration: row.bindingGeneration,
                        contentVersion: row.contentVersion
                    });
            },
            retain(id, key) {
                if (id !== listId)
                    fail('UI_UNKNOWN_LIST');
                return retainRow(key, 'focus', true);
            }
        }));
        return freeze(api);
    }
    catch (e) {
        try {
            api.dispose();
        }
        catch { }
        throw e;
    }
}
//# sourceMappingURL=uiRoot.js.map