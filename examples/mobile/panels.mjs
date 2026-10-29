// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile, Sprite, Bitmap, createTexture, createImageData2D, createAssetType, createAssetRef, isTexture} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createTextField, createTextRasterCache} from '@egret/engine/text';
import {createCanvasTextRasterProvider} from '@egret/engine/web/text';
import {createParagraph, createParagraphCache} from '@egret/engine/paragraph';
import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';

const fontInputs = Object.freeze([
  {family: 'Noto Sans', file: 'NotoSans-Regular.ttf', identity: 'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'},
  {family: 'Noto Sans Arabic', file: 'NotoSansArabic-Regular.ttf', identity: 'bd86ca02f087d7f3c3788ba458fb6b73744c7639ed276b8d870dba6def6c40d0'},
  {family: 'Noto Sans CJK SC', file: 'NotoSansCJKsc-Regular.otf', identity: '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b'},
]);
const fontFamilies = Object.freeze(fontInputs.map(font => font.family));
const rowCopy = Object.freeze([
  'A world can grow from a small idea. Paragraph wrapping gives every card its own natural height.',
  '角色、资源与世界的信息自然换行。条目高度来自真实排版，手机上的窄列会产生更多文本行。',
  'يتغير ارتفاع النص مع عرض اللوحة. هذه الفقرات تستخدم الخطوط المحددة وتلتف تلقائيًا.',
]);
let canvasKitScript;

function loadCanvasKitScript() {
  if (typeof globalThis.CanvasKitInit === 'function') return Promise.resolve();
  if (!canvasKitScript) {
    canvasKitScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../paragraph-panel/vendor/runtime/layout-r1/canvaskit.js', import.meta.url).href;
      script.onload = () => {
        script.onload = script.onerror = null;
        if (typeof globalThis.CanvasKitInit === 'function') resolve();
        else { script.remove(); reject(Error('MOBILE_PARAGRAPH_RUNTIME_UNAVAILABLE')); }
      };
      script.onerror = () => {
        script.onload = script.onerror = null;
        script.remove();
        reject(Error('MOBILE_PARAGRAPH_RUNTIME_HTTP'));
      };
      document.head.append(script);
    }).catch(cause => { canvasKitScript = undefined; throw cause; });
  }
  return canvasKitScript;
}

const errorInfo = cause => ({code: cause?.code ?? null, message: String(cause?.message ?? cause)});
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** An application session; the shell closes it before replacing its canvas or viewport. */
export async function mount({canvas, controls, viewport, signal, report, model = {}, kind = 'ui', backend = 'webgl2'}) {
  if (!['ui', 'paragraph'].includes(kind) || !['webgl2', 'webgpu'].includes(backend)) throw Error('MOBILE_PANEL_OPTIONS');
  const width = clamp(finite(viewport?.width, 360), 240, 960);
  const height = clamp(finite(viewport?.height, kind === 'ui' ? 520 : 680), 320, 1200);
  const density = clamp(finite(viewport?.density, 1), 1, 2);
  const columns = width >= 700 ? 2 : 1;
  const frameOptions = {width, height, clearColor: 0x142033, clearAlpha: 1, outputAlpha: 'opaque'};
  const restored = model && typeof model === 'object' ? model : {};
  let fontSize = restored.fontSize === 22 ? 22 : 18;
  let selectedKey = typeof restored.selectedKey === 'string' ? restored.selectedKey : null;
  let requestedScroll = Math.max(0, finite(restored.scrollOffset, 0));
  let scrollOffset = requestedScroll, revision = 1, state = 'starting';
  let engine, host, scope, input, cache, nativeProvider, detailRoot, listRoot;
  let fontFace, fontFamily, texture, badgeLease, unclaimedTexture;
  let initialization, closePromise, stopped = false, queue = Promise.resolve();
  let scrollQueued = false, listBounds, drag, lastReadback = null, lastRootSnapshots = [];
  let providerCalls = 0, fontBytes = 0, runtimeBytes = 0, bindCount = 0, unbindCount = 0;
  let frames = 0, pointerEvents = 0, hitCount = 0, selectionCount = 0, dragCount = 0;
  let textureDisposals = 0, bitmapClosed = false, controlRoot, range, selectionOutput;
  const errors = [], diagnostics = [], events = [], preparations = [], listeners = [];
  const pendingTextPreparations = [], cleanupFailures = [];
  let activeTextPreparations = 0;

  function checkOpen() {
    if (stopped || signal?.aborted) throw new DOMException('Panel session aborted', 'AbortError');
  }
  function remember(array, value, maximum = 64) {
    array.push(value);
    if (array.length > maximum) array.splice(0, array.length - maximum);
  }
  function roots() { return [detailRoot, listRoot].filter(Boolean); }
  function captureRoots() {
    if (state !== 'closed') lastRootSnapshots = roots().map(root => root.snapshot());
    return lastRootSnapshots;
  }
  function inspect() {
    const snapshots = captureRoots();
    const list = snapshots.find(root => root.rootId === 'mobile-' + kind + '-list');
    return {
      state, kind, backend, width, height, density, columns,
      dimensions: {width, height, density, backingWidth: canvas.width, backingHeight: canvas.height},
      fontSize, selectedKey, scrollOffset, scrollExtent: list?.scrollExtent ?? 0,
      committedRevision: list?.committedRevision ?? 0,
      committedLayouts: snapshots.map(root => ({rootId: root.rootId, committedRevision: root.committedRevision, origin: root.origin, viewport: root.viewport, boxes: root.boxes})),
      roots: snapshots, rows: list?.rows ?? [], listBounds: listBounds ? {...listBounds} : null,
      frames, bindCount, unbindCount, providerCalls, fontBytes, runtimeBytes,
      textPreparationConcurrency: activeTextPreparations, pendingTextPreparations: pendingTextPreparations.length,
      hitCount, pointerEvents, selectionCount, dragCount, events: [...events], preparations: [...preparations],
      errors: [...errors], diagnostics: [...diagnostics], readback: lastReadback ? {...lastReadback} : null,
      inputState: input?.state ?? null, scopeState: scope?.state ?? null,
      cache: cache?.getStatus() ?? null, textureDisposals, bitmapClosed, cleanupFailureCount: cleanupFailures.length,
    };
  }
  function notify() {
    if (range && listRoot && state !== 'closed') {
      const value = listRoot.snapshot();
      range.max = String(Math.max(0, Math.ceil(value.scrollExtent - listBounds.height)));
      range.value = String(value.scrollOffset);
    }
    if (selectionOutput) selectionOutput.textContent = selectedKey ? 'Selected / 已选择: ' + selectedKey : 'Tap a row / 点选列表行';
    try { report?.(inspect()); } catch { /* A shell observer does not own this session. */ }
  }
  function enqueue(operation) {
    const result = queue.then(async () => { checkOpen(); return operation(); });
    queue = result.catch(cause => {
      if (cause?.name !== 'AbortError' && !stopped) { remember(errors, errorInfo(cause)); notify(); }
    });
    return result;
  }
  async function checkedBytes(relative, identity) {
    checkOpen();
    const response = await fetch(new URL(relative, import.meta.url), {signal});
    if (!response.ok) throw Error('MOBILE_ASSET_HTTP');
    const bytes = new Uint8Array(await response.arrayBuffer());
    checkOpen();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    checkOpen();
    if (digest !== identity) throw Error('MOBILE_ASSET_IDENTITY');
    return bytes;
  }
  async function publish(root) {
    for (let attempt = 0; attempt < 48; attempt++) {
      checkOpen();
      const preparation = await root.prepare();
      checkOpen();
      if (preparation.status === 'pending') { await new Promise(resolve => setTimeout(resolve, 0)); continue; }
      const result = root.commit(preparation);
      if (result.kind === 'stale') continue;
      if (!['committed', 'unchanged'].includes(result.kind) || result.postCommitErrors.length) throw Error('MOBILE_UI_COMMIT');
      return;
    }
    throw Error('MOBILE_UI_PREPARATION_LIMIT');
  }
  async function draw() {
    checkOpen();
    host.renderSharedFrame(engine.captureSharedFrame(frameOptions));
    await host.whenIdle();
    checkOpen();
    frames++;
    scrollOffset = listRoot?.snapshot().scrollOffset ?? scrollOffset;
    notify();
  }
  function prepareText(node) {
    return new Promise((resolve, reject) => {
      // UiRoot starts detached row bindings concurrently; this application admits
      // at most four actual raster jobs and 64 waiting field preparations.
      if (pendingTextPreparations.length >= 64) { reject(Error('MOBILE_TEXT_QUEUE_LIMIT')); return; }
      pendingTextPreparations.push({node, resolve, reject});
      drainTextPreparations();
    });
  }
  function drainTextPreparations() {
    while (activeTextPreparations < 4 && pendingTextPreparations.length) {
      const task = pendingTextPreparations.shift();
      activeTextPreparations++;
      void (async () => {
        try {
          checkOpen();
          const metrics = await task.node.prepare();
          // A field can resolve before the cache retires its asset-delivery actor.
          // Wait for real cache settlement before admitting the next raster job.
          await cache.whenIdle();
          checkOpen();
          task.resolve(metrics);
        } catch (cause) { task.reject(cause); }
        finally { activeTextPreparations--; drainTextPreparations(); }
      })();
    }
  }
  async function textField(owner, text, size = 16, color = 0xe9f2ff) {
    const node = createTextField(engine, owner, cache);
    node.setRequest({text, fontFamily, fontSize: size, lineHeight: size + 8, fontWeight: 400, fontStyle: 'normal', locale: 'en', direction: 'ltr', density, fillColor: color});
    await prepareText(node);
    checkOpen();
    return node;
  }
  function uiDetails() {
    const chosen = selectedKey?.replace('world-', '') ?? '--';
    return {kind: 'column', id: 'detail-column', explicitWidth: columns === 2 ? width - listBounds.width - 36 : width - 24, gap: 6, crossAlign: 'stretch', children: [
      {kind: 'leaf', id: 'detail-accent', explicitHeight: 4, fill: {color: 0x51d9b3}},
      {kind: 'leaf', id: 'detail-copy', content: {revision, async prepare(context) {
        const content = context.scope.use(new Sprite());
        const title = await textField(context.scope, 'World library', 20); content.addChild(title);
        const subtitle = await textField(context.scope, 'Selected: ' + chosen, 16, 0x91dcc9); subtitle.y = 32; content.addChild(subtitle);
        if (columns === 2) {
          const hint = await textField(context.scope, 'Drag or tap a row', 14, 0xa9bcd2); hint.y = 68; content.addChild(hint);
        }
        if (context.signal.aborted) throw new DOMException('Detached detail cancelled', 'AbortError');
        return {content, measuredHeight: columns === 2 ? 108 : 66};
      }}},
    ]};
  }
  function uiSource() {
    const records = Array.from({length: 30}, (_, index) => ({key: 'world-' + String(index + 1).padStart(2, '0'), contentVersion: 1, estimatedHeight: 78 + index % 3 * 12, value: index}));
    return {revision: 1, records, async bind(context) {
      bindCount++;
      const rowHeight = 78 + context.index % 3 * 12;
      const content = context.scope.use(new Sprite());
      content.graphics.beginFill(context.index % 2 ? 0x253f5e : 0x1b324e).drawRect(0, 0, context.width, rowHeight - 4).endFill();
      const badge = context.scope.use(new Bitmap(badgeLease)); badge.x = 10; badge.y = 18; badge.scaleX = 12; badge.scaleY = 24; content.addChild(badge);
      const title = await textField(context.scope, 'World ' + String(context.index + 1).padStart(2, '0'), 17); title.x = 46; title.y = 10; content.addChild(title);
      const subtitle = await textField(context.scope, ['Explore', 'Characters', 'Resources'][context.index % 3], 13, 0xa9bcd2); subtitle.x = 46; subtitle.y = 39; content.addChild(subtitle);
      if (context.signal.aborted) throw new DOMException('Detached row cancelled', 'AbortError');
      return {content, measuredHeight: rowHeight};
    }, unbind() { unbindCount++; }};
  }
  function paragraphRequest(text, availableWidth, direction = 'ltr', requestedDensity = density) {
    return {text, width: availableWidth, fontFamilies, fontSize, direction, locale: direction === 'rtl' ? 'ar' : 'en', fillColor: 0xe9f2ff, density: requestedDensity};
  }
  function paragraphDetails(availableWidth) {
    const leaf = (id, text, direction = 'ltr') => ({kind: 'leaf', id, content: {revision, async prepare(context) {
      const node = createParagraph(engine, context.scope, cache);
      node.setRequest(paragraphRequest(text, context.width, direction, context.density));
      const metrics = await node.prepare();
      checkOpen();
      if (context.signal.aborted) throw new DOMException('Detached paragraph cancelled', 'AbortError');
      remember(preparations, {id, width: context.width, density: context.density, height: metrics.height, lines: metrics.lines.length});
      return {content: node, measuredHeight: metrics.height};
    }}});
    return {kind: 'column', id: 'article-column', explicitWidth: availableWidth, gap: 12, crossAlign: 'stretch', children: [
      {kind: 'leaf', id: 'article-accent', explicitHeight: 5, fill: {color: 0x51d9b3}},
      leaf('article-copy', 'A paragraph flows with the panel.\n真实换行决定布局高度。\nMixed text: abc مرحبا 123 xyz.'),
      leaf('article-arabic', 'يتغير ارتفاع الفقرة مع عرض اللوحة.', 'rtl'),
      {kind: 'leaf', id: 'article-end', explicitHeight: 4, fill: {color: 0xe9a66e}},
    ]};
  }
  function paragraphSource() {
    return {revision, records: Array.from({length: 24}, (_, index) => ({key: 'paragraph-' + String(index + 1).padStart(2, '0'), contentVersion: revision, estimatedHeight: 140, value: {text: rowCopy[index % 3].repeat(index % 4 === 3 ? 2 : 1), direction: index % 3 === 2 ? 'rtl' : 'ltr'}})), async bind(context) {
      bindCount++;
      const node = createParagraph(engine, context.scope, cache);
      node.setRequest(paragraphRequest(context.value.text, context.width - 24, context.value.direction, context.density));
      const metrics = await node.prepare();
      checkOpen();
      if (context.signal.aborted) throw new DOMException('Detached paragraph row cancelled', 'AbortError');
      const content = context.scope.use(new Sprite());
      content.graphics.beginFill(context.index % 2 ? 0x253f5e : 0x1b324e).drawRect(0, 0, context.width, metrics.height + 24).endFill();
      node.x = 12; node.y = 10; content.addChild(node);
      remember(preparations, {id: context.key, width: context.width - 24, density: context.density, height: metrics.height, lines: metrics.lines.length});
      return {content, measuredHeight: metrics.height + 28};
    }, unbind() { unbindCount++; }};
  }
  function listTree(source) {
    return {kind: 'virtualList', id: 'rows', explicitWidth: listBounds.width, explicitHeight: listBounds.height, initialScrollOffset: requestedScroll, source};
  }
  function onRowPointer(notification) {
    const contact = notification.event.payload;
    hitCount++;
    remember(events, {kind: notification.kind, key: notification.key, index: notification.index, pointerId: contact.session.pointerId, pointerType: contact.session.pointerType, globalX: contact.globalX, globalY: contact.globalY, layoutRevision: notification.layoutRevision, ...(contact.reason ? {reason: contact.reason} : {})});
    if (notification.kind === 'begin' && drag?.session === contact.session) {
      drag.key = notification.key;
      drag.target = notification.target;
      drag.bindingGeneration = notification.bindingGeneration;
      drag.contentVersion = notification.contentVersion;
    }
    notify();
  }
  function withinList(contact) {
    return listBounds && contact.globalX >= listBounds.x && contact.globalX < listBounds.x + listBounds.width && contact.globalY >= listBounds.y && contact.globalY < listBounds.y + listBounds.height;
  }
  function requestScroll(next) {
    if (stopped || !listRoot) return;
    const maximum = Math.max(0, listRoot.snapshot().scrollExtent - listBounds.height);
    requestedScroll = clamp(next, 0, maximum);
    if (scrollQueued) return;
    scrollQueued = true;
    void enqueue(async () => {
      // Moves share one queued operation; no permanent frame loop or unbounded move queue.
      try {
        do {
          const target = requestedScroll;
          listRoot.list('rows').setScrollOffset(target);
          await publish(listRoot);
          await draw();
          if (Math.abs(requestedScroll - target) < 0.1) break;
        } while (!stopped);
      } finally { scrollQueued = false; }
    }).catch(() => {});
  }
  function onContact(notification) {
    pointerEvents++;
    const contact = notification.contact;
    if (stopped || state !== 'ready') return;
    if (notification.kind === 'begin' && !drag && withinList(contact)) {
      drag = {session: contact.session, x: contact.globalX, y: contact.globalY, offset: requestedScroll, moved: false, key: null};
    } else if (drag?.session === contact.session) {
      const distanceX = contact.globalX - drag.x, distanceY = contact.globalY - drag.y;
      if (Math.hypot(distanceX, distanceY) > 7) drag.moved = true;
      if (notification.kind === 'move') {
        if (Math.abs(distanceY) > 7) requestScroll(drag.offset - distanceY);
      } else if (notification.kind === 'end' || notification.kind === 'cancel') {
        const finished = drag; drag = undefined;
        if (finished.moved) dragCount++;
        // Pointer capture preserves a delivery route after leaving its row. A tap
        // needs the same still-visible binding and a fresh genuine Stage hit.
        const releasedRow = notification.kind === 'end' && !finished.moved && finished.key && withinList(contact)
          ? listRoot.snapshot().rows.find(row => row.key === finished.key && row.visible && row.bindingGeneration === finished.bindingGeneration && row.contentVersion === finished.contentVersion)
          : undefined;
        if (releasedRow && engine.stage.hitTest(contact.globalX, contact.globalY) === finished.target) {
          selectedKey = finished.key; selectionCount++;
          void enqueue(async () => {
            if (kind === 'ui') { revision++; detailRoot.setTree(uiDetails()); await publish(detailRoot); }
            await draw();
          }).catch(() => {});
        }
      }
    }
    notify();
  }
  async function positionParagraphList() {
    if (columns === 2) {
      const columnWidth = (width - 36) / 2;
      listBounds = {x: 24 + columnWidth, y: 12, width: columnWidth, height: height - 24};
    } else {
      const article = detailRoot.snapshot();
      const bottom = Math.max(0, ...article.boxes.map(box => box.y + box.height));
      const y = Math.ceil(bottom) + 24;
      if (height - y - 12 < 72) throw Error('MOBILE_PARAGRAPH_VIEWPORT_TOO_SHORT');
      listBounds = {x: 12, y, width: width - 24, height: height - y - 12};
    }
    if (listRoot) {
      listRoot.setOrigin({x: listBounds.x, y: listBounds.y});
      listRoot.setViewport({width: listBounds.width, height: listBounds.height}, density);
      listRoot.setTree(listTree(paragraphSource()));
      await publish(listRoot);
    }
  }
  function listen(element, type, handler, options) {
    element.addEventListener(type, handler, options);
    listeners.push(() => element.removeEventListener(type, handler, options));
  }
  function installControls() {
    if (!controls) return;
    controlRoot = document.createElement('div');
    controlRoot.className = 'panel-controls';
    const button = (label, operation) => {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = label;
      listen(node, 'click', operation); controlRoot.append(node);
    };
    button('↑ Previous / 向上', () => requestScroll(requestedScroll - listBounds.height * 0.7));
    button('↓ Next / 向下', () => requestScroll(requestedScroll + listBounds.height * 0.7));
    button('Top / 回顶部', () => requestScroll(0));
    const label = document.createElement('label'); label.textContent = 'Scroll / 滚动 ';
    range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '0'; range.step = '1';
    range.setAttribute('aria-label', 'List scroll position / 列表滚动位置');
    listen(range, 'input', () => requestScroll(Number(range.value))); label.append(range); controlRoot.append(label);
    if (kind === 'paragraph') button('Type size / 字号', () => {
      void enqueue(async () => {
        fontSize = fontSize === 18 ? 22 : 18; revision++;
        detailRoot.setTree(paragraphDetails(columns === 2 ? (width - 36) / 2 : width - 24));
        await publish(detailRoot); await positionParagraphList(); await draw();
      }).catch(() => {});
    });
    selectionOutput = document.createElement('output'); selectionOutput.setAttribute('aria-live', 'polite');
    controlRoot.append(selectionOutput); controls.append(controlRoot);
    listen(canvas, 'wheel', event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? listBounds.height : 1;
      requestScroll(requestedScroll + event.deltaY * unit);
    }, {passive: false});
  }
  async function readback() {
    return enqueue(async () => {
      const ticket = host.requestReadback(); void ticket.catch(() => {});
      host.renderSharedFrame(engine.captureSharedFrame(frameOptions));
      const result = await ticket; await host.whenIdle(); checkOpen();
      if (result.width !== Math.ceil(width * density) || result.height !== Math.ceil(height * density)) throw Error('MOBILE_READBACK_DIMENSIONS');
      lastReadback = {width: result.width, height: result.height, frameId: result.frameId, serial: result.serial, format: result.format, colorSpace: result.colorSpace, bytes: result.bytes.length};
      let binary = '';
      for (let index = 0; index < result.bytes.length; index += 16384) binary += String.fromCharCode(...result.bytes.subarray(index, index + 16384));
      notify();
      return {...lastReadback, base64: btoa(binary)};
    });
  }
  function snapshot() { return {scrollOffset: state === 'closed' ? scrollOffset : listRoot?.snapshot().scrollOffset ?? scrollOffset, selectedKey, fontSize}; }
  function close() {
    if (closePromise) return closePromise;
    stopped = true; state = 'closing';
    const recordCleanupFailure = cause => { cleanupFailures.push(cause); remember(errors, errorInfo(cause)); };
    const attemptSync = action => { try { action(); } catch (cause) { recordCleanupFailure(cause); } };
    attemptSync(() => signal?.removeEventListener('abort', onAbort));
    for (const remove of listeners.splice(0)) attemptSync(remove);
    attemptSync(() => controlRoot?.remove());
    // Stop native contact delivery before waiting for in-flight application operations.
    attemptSync(() => input?.dispose());
    closePromise = (async () => {
      await initialization?.catch(() => {});
      await queue.catch(() => {});
      const attempt = async action => { try { await action(); } catch (cause) { recordCleanupFailure(cause); } };
      await attempt(() => captureRoots());
      for (const root of roots()) await attempt(() => root.dispose());
      await attempt(() => input?.dispose());
      await attempt(() => scope?.dispose());
      await attempt(() => cache?.dispose());
      await attempt(() => cache?.whenIdle?.());
      await attempt(() => host?.whenIdle());
      await attempt(() => engine ? engine.dispose() : host?.close());
      await attempt(() => nativeProvider?.dispose());
      await attempt(() => { if (unclaimedTexture) { unclaimedTexture.dispose(); unclaimedTexture = undefined; textureDisposals++; } });
      await attempt(() => { if (fontFace) document.fonts.delete(fontFace); });
      state = 'closed'; notify();
      // A failed retirement must stop the shell from reusing this canvas. Keep
      // original failure objects so callers retain codes, causes and stacks.
      if (cleanupFailures.length) throw new AggregateError([...cleanupFailures], 'MOBILE_PANEL_CLEANUP_FAILED');
      return inspect();
    })();
    return closePromise;
  }
  function onAbort() { void close().catch(() => {}); }
  signal?.addEventListener('abort', onAbort, {once: true});
  initialization = (async () => {
    checkOpen();
    if (kind === 'paragraph') {
      const response = await fetch(new URL('../paragraph-panel/vendor/manifest.json', import.meta.url), {signal});
      if (!response.ok) throw Error('MOBILE_PARAGRAPH_MANIFEST_HTTP');
      const manifest = await response.json(); checkOpen();
      runtimeBytes = manifest.payloadBytes.runtime;
      if (!Number.isSafeInteger(runtimeBytes) || runtimeBytes < 1 || typeof manifest.runtime.buildIdentity !== 'string') throw Error('MOBILE_PARAGRAPH_MANIFEST');
      const fonts = await Promise.all(fontInputs.map(async font => {
        const data = await checkedBytes('../paragraph-panel/vendor/fonts/' + font.file, font.identity);
        fontBytes += data.length; return {family: font.family, identity: font.identity, data};
      }));
      await loadCanvasKitScript(); checkOpen();
      const canvasKit = await globalThis.CanvasKitInit({locateFile: () => new URL('../paragraph-panel/vendor/runtime/layout-r1/canvaskit.wasm', import.meta.url).href});
      checkOpen();
      nativeProvider = createCanvasKitParagraphProvider({canvasKit, fonts, buildIdentity: manifest.runtime.buildIdentity});
    } else {
      const data = await checkedBytes('../paragraph-panel/vendor/fonts/NotoSans-Regular.ttf', fontInputs[0].identity);
      fontBytes = data.length; fontFamily = 'EgretMobile_' + crypto.randomUUID();
      fontFace = new FontFace(fontFamily, data, {style: 'normal', weight: '400'});
      await fontFace.load(); checkOpen(); document.fonts.add(fontFace);
      const png = await checkedBytes('../../tools/browser-png/assets/rgb-red-green.png', '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d');
      const image = await createImageBitmap(new Blob([png], {type: 'image/png'}));
      try {
        checkOpen();
        if (image.width !== 2 || image.height !== 1) throw Error('MOBILE_BADGE_DIMENSIONS');
        const decoder = document.createElement('canvas'); decoder.width = 2; decoder.height = 1;
        const context = decoder.getContext('2d', {willReadFrequently: true});
        if (!context) throw Error('MOBILE_BADGE_DECODER');
        context.drawImage(image, 0, 0);
        texture = unclaimedTexture = createTexture(createImageData2D({width: 2, height: 1, pixels: new Uint8Array(context.getImageData(0, 0, 2, 1).data)}));
      } finally { image.close(); bitmapClosed = true; }
    }
    checkOpen();
    host = (backend === 'webgpu' ? createSharedWebGPUHost : createSharedWebGL2Host)({canvas, pixelRatio: density, outputAlpha: 'opaque', enableReadback: true, onDiagnostic: value => remember(diagnostics, {code: value.code, phase: value.phase})});
    engine = await createEngineForProfile({host, onDiagnostic: value => remember(diagnostics, {code: value.code, phase: value.phase})}, 'egret.shared-frame2d/1');
    checkOpen(); scope = engine.createScope();
    if (kind === 'paragraph') {
      const provider = {identity: nativeProvider.identity, capabilities: nativeProvider.capabilities, prepare(request, context) { providerCalls++; return nativeProvider.prepare(request, context); }};
      cache = createParagraphCache(engine.assets, {provider});
    } else {
      const type = createAssetType('mobile-ui-badge', isTexture);
      engine.assets.register(type, {load: async () => { unclaimedTexture = undefined; return texture; }, dispose(value) { textureDisposals++; value.dispose(); }});
      badgeLease = scope.use(await engine.assets.acquire(createAssetRef(type, 'identified-png'))); checkOpen();
      // Four raster jobs match the SDK's public ceiling. Caller leases cover old
      // committed rows plus their detached replacements; retention stays bounded.
      cache = createTextRasterCache(engine.assets, {provider: createCanvasTextRasterProvider(), maxPendingJobs: 4, maxWaiters: 16, maxCallerLeases: 128, maxResidentEntries: 24});
    }
    input = createBrowserPointerInput({engine, scope, width, height, capacity: 10, onContact});
    if (kind === 'ui') {
      const listWidth = columns === 2 ? Math.floor((width - 36) * 0.64) : width - 24;
      listBounds = {x: 12, y: columns === 2 ? 12 : 108, width: listWidth, height: height - (columns === 2 ? 24 : 120)};
      const detailWidth = columns === 2 ? width - listWidth - 36 : width - 24;
      detailRoot = createUiRoot({engine, scope, id: 'mobile-ui-detail', viewport: {width: detailWidth, height: columns === 2 ? height - 24 : 84}, origin: {x: columns === 2 ? listWidth + 24 : 12, y: 12}, density, tree: uiDetails()});
      await publish(detailRoot);
    } else {
      const detailWidth = columns === 2 ? (width - 36) / 2 : width - 24;
      detailRoot = createUiRoot({engine, scope, id: 'mobile-paragraph-detail', viewport: {width: detailWidth, height: height - 24}, origin: {x: 12, y: 12}, density, tree: paragraphDetails(detailWidth)});
      await publish(detailRoot); await positionParagraphList();
    }
    listRoot = createUiRoot({engine, scope, id: 'mobile-' + kind + '-list', viewport: {width: listBounds.width, height: listBounds.height}, origin: {x: listBounds.x, y: listBounds.y}, density, tree: listTree(kind === 'ui' ? uiSource() : paragraphSource()), input, onRowPointer, limits: {overscan: 1, residentCap: 32, retainedCap: 0}});
    await publish(listRoot);
    state = 'ready'; installControls(); await draw();
  })();
  try {
    await initialization;
    checkOpen();
    return Object.freeze({inspect, snapshot, close, readback, async whenIdle(){let pending;do{pending=queue;await pending;}while(pending!==queue);}});
  } catch (cause) {
    if (cause?.name !== 'AbortError') remember(errors, errorInfo(cause));
    await close();
    if (signal?.aborted) throw new DOMException('Panel session aborted', 'AbortError');
    throw cause;
  }
}
