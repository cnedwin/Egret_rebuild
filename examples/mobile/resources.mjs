// SPDX-License-Identifier: Apache-2.0
// Mobile application composition; the original resource-scene fixtures stay unchanged.
import { createCanvasHost } from '@egret/engine/web';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createResourceSceneSession } from '../resource-scene/session.mjs';

const WIDTH = 192, HEIGHT = 128, TAP_DISTANCE_CSS = 12;
const IDS = Object.freeze(['pilot-left', 'pilot-right']);
const IMAGE_PINS = Object.freeze([
  ['../resource-scene/assets/atlas-v1.png', 130, '54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd'],
  ['../resource-scene/assets/atlas-v2.png', 129, '006e69af587d0471da17b1fa5c40949ffc3f2ec21bab0ce4f73d77bd18e8fea2'],
  ['../resource-scene/assets/outfit-A.png', 83, '376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'],
  ['../resource-scene/assets/outfit-B.png', 80, 'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'],
  ['../resource-scene/assets/outfit-C.png', 81, 'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'],
  ['../resource-scene/assets/outfit-D.png', 83, 'd2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'],
  ['../../tools/browser-png/assets/rgb-red-green.png', 72, '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d'],
]);
const FONT_PINS = Object.freeze([
  { key: 'ahem', path: '../canvas-text/assets/ahem.ttf', bytes: 22572,
    sha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc', size: 8, text: 'X X XX' },
  { key: 'cjk', path: '../resource-scene/assets/NotoSansSC-fixed.woff2', bytes: 1796,
    sha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895', size: 12, text: '左侧 已选择右侧' },
]);

/** Borrow the shell's Canvas and controls; own the session, input, fonts and providers. */
export async function mount({ canvas, controls, viewport, signal, report = () => {}, model }) {
  if (!viewport || ![viewport.width, viewport.height, viewport.density].every(value => Number.isFinite(value) && value > 0)
      || Math.abs(viewport.height - viewport.width * HEIGHT / WIDTH) > 0.01) {
    throw new Error('MOBILE_RESOURCE_VIEWPORT_INVALID');
  }
  const lifetime = new AbortController(), fonts = [], families = {}, active = new Map(), ending = new Map();
  const handlers = [], actions = new Set(), errors = [];
  const pins = new Map(IMAGE_PINS.map(([path, bytes, sha256]) => [new URL(path, import.meta.url).href, { bytes, sha256 }]));
  // CSS coordinates map to 192x128 once in the input adapter. DPR scales rendering only.
  const pixelRatio = viewport.width / WIDTH * viewport.density;
  let state = 'starting', host, provider, session, input, initialization, serial = Promise.resolve(), closePromise, sessionClosing;
  let closed = false, seconds = 0, renderCount = 0, selectionCount = 0, eventCount = 0, maximumContacts = 0;
  let beginCount = 0, endCount = 0, moveCount = 0, cancelCount = 0, lastKind = '', lastReason = '', lastActor = '';
  let lastPointerType = '', lastPointerId = -1, lastSessionId = -1, lastX = 0, lastY = 0;
  let mouseSelections = 0, touchSelections = 0, penSelections = 0, leftSelections = 0, rightSelections = 0;
  let cleanupFailures = 0, buttonBusy = false, controlRoot, pilotSelect, outfitSelect, changeButton, stepButton, pauseButton;
  const expectedBackingWidth = Math.ceil(WIDTH * pixelRatio), expectedBackingHeight = Math.ceil(HEIGHT * pixelRatio);

  function assertOpen() {
    if (closed || lifetime.signal.aborted) throw new DOMException('Mobile resource session aborted', 'AbortError');
  }
  function inspect() {
    const view = session?.inspect(), currentModel = session?.snapshot() ?? model;
    const selected = view?.selectedId ?? model?.selectedId ?? IDS[0], actor = currentModel?.actors[selected];
    return Object.freeze({
      state, selectedId: selected, selectedOutfit: actor?.committedOutfit ?? 'A', selectedPaused: actor?.paused ?? false,
      leftOutfit: currentModel?.actors[IDS[0]].committedOutfit ?? 'A', rightOutfit: currentModel?.actors[IDS[1]].committedOutfit ?? 'A',
      leftPaused: currentModel?.actors[IDS[0]].paused ?? false, rightPaused: currentModel?.actors[IDS[1]].paused ?? false,
      inputState: input?.state ?? 'unavailable',
      contacts: input?.contacts.length ?? 0, events: eventCount, maximumContacts, beginCount, endCount, moveCount, cancelCount,
      lastKind, lastReason, lastActor, lastPointerType, lastPointerId, lastSessionId, lastX, lastY,
      selectionCount, mouseSelections, touchSelections, penSelections, leftSelections, rightSelections,
      logicalWidth: WIDTH, logicalHeight: HEIGHT, cssWidth: viewport.width, cssHeight: viewport.height,
      density: viewport.density, pixelRatio, backingWidth: canvas.width, backingHeight: canvas.height,
      expectedBackingWidth, expectedBackingHeight, renderCount, seconds,
      pendingSources: view?.pendingSources ?? 0, pendingTasks: (view?.pendingTasks ?? 0) + actions.size,
      diagnostics: view?.diagnostics.length ?? 0, errors: errors.length, lastError: errors.at(-1) ?? '', cleanupFailures,
      fontCount: fonts.filter(face => document.fonts.has(face)).length,
      pendingTaps: ending.size, heldTaps: active.size,
    });
  }
  function publish() { report(inspect()); }
  function fail(cause) {
    if (errors.length < 32) errors.push(String(cause?.code ?? cause?.message ?? cause));
    publish();
  }
  async function verifiedBytes(url, pin) {
    const response = await fetch(url, { cache: 'no-store', signal: lifetime.signal });
    if (!response.ok) throw new Error('MOBILE_RESOURCE_HTTP_' + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const sha256 = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== pin.bytes || sha256 !== pin.sha256) throw new Error('MOBILE_RESOURCE_ASSET_IDENTITY');
    assertOpen(); return bytes;
  }
  async function prepareFonts() {
    for (const pin of FONT_PINS) {
      const bytes = await verifiedBytes(new URL(pin.path, import.meta.url), pin);
      assertOpen();
      const family = 'EgretMobile_' + pin.key + '_' + crypto.randomUUID().replaceAll('-', '');
      const face = new FontFace(family, bytes.buffer, { weight: '400', style: 'normal' }); fonts.push(face);
      await face.load(); assertOpen();
      document.fonts.add(face); families[pin.key] = family;
      const request = 'normal 400 ' + pin.size + 'px "' + family + '"';
      const selected = await document.fonts.load(request, pin.text); assertOpen();
      if (selected.length !== 1 || selected[0] !== face || !document.fonts.has(face) || !document.fonts.check(request, pin.text)) {
        throw new Error('MOBILE_RESOURCE_FONT_IDENTITY');
      }
    }
  }
  function refreshControls() {
    if (!controlRoot) return;
    const ready = state === 'ready' && !closed;
    for (const control of controlRoot.querySelectorAll('button,select')) control.disabled = !ready;
    if (!session) return;
    const snapshot = session.snapshot(), selected = snapshot.selectedId, actor = snapshot.actors[selected];
    pilotSelect.value = selected;
    changeButton.disabled = !ready || buttonBusy || !actor.present;
    stepButton.disabled = !ready;
    pauseButton.disabled = !ready || !actor.present;
    pauseButton.textContent = actor.paused ? 'Resume pilot / 继续角色' : 'Pause pilot / 暂停角色';
  }
  function draw() {
    const work = serial.then(async () => {
      assertOpen(); await session.scene.textReady; assertOpen();
      input?.sync();
      host.renderFrame(session.capture()); renderCount++;
      refreshControls(); publish();
    });
    serial = work.catch(() => undefined); return work;
  }
  function perform(operation) {
    if (closed || state !== 'ready') return;
    const work = Promise.resolve().then(() => { assertOpen(); return operation(); });
    actions.add(work);
    void work.then(() => { actions.delete(work); refreshControls(); publish(); }, cause => {
      actions.delete(work); refreshControls();
      if (!closed) fail(cause);
    });
  }
  function actorId(target) { return IDS.find(id => session?.scene.actors[id]?.root === target) ?? ''; }
  function finishTap(pointerSession, row) {
    if (ending.get(pointerSession) !== row) return;
    ending.delete(pointerSession);
    if (closed || state !== 'ready' || row.moved || !row.beginEvent || !row.endEvent
        || row.beginEvent.defaultPrevented || row.endEvent.defaultPrevented || !row.actor) {
      if (!closed) publish();
      return;
    }
    // The Pointer layer captures the original owner. Selection additionally requires a current real hit.
    const target = session.scene.engine.stage.hitTest(row.endX, row.endY);
    if (target !== row.target || actorId(target) !== row.actor || !session.selectTarget(target)) { publish(); return; }
    selectionCount++;
    if (row.pointerType === 'mouse') mouseSelections++;
    else if (row.pointerType === 'touch') touchSelections++;
    else penSelections++;
    if (row.actor === IDS[0]) leftSelections++; else rightSelections++;
    refreshControls(); publish();
    void draw().catch(cause => { if (!closed) fail(cause); });
  }
  function contact({ kind, contact: value, target, reason }) {
    const pointerSession = value.session;
    eventCount++; lastKind = kind; lastReason = reason ?? ''; lastActor = actorId(target);
    lastPointerType = pointerSession.pointerType; lastPointerId = pointerSession.pointerId;
    lastSessionId = pointerSession.id; lastX = value.globalX; lastY = value.globalY;
    if (kind === 'begin' && !closed) {
      beginCount++;
      active.set(pointerSession, { target, actor: actorId(target), pointerType: pointerSession.pointerType,
        startX: value.globalX, startY: value.globalY, moved: false, beginEvent: undefined, endEvent: undefined });
      maximumContacts = Math.max(maximumContacts, active.size);
    } else if (kind === 'move' || kind === 'end') {
      const row = active.get(pointerSession);
      if (kind === 'move') moveCount++; else endCount++;
      if (row) {
        const dx = (value.globalX - row.startX) * viewport.width / WIDTH;
        const dy = (value.globalY - row.startY) * viewport.height / HEIGHT;
        if (Math.hypot(dx, dy) > TAP_DISTANCE_CSS) row.moved = true;
        if (kind === 'end') {
          active.delete(pointerSession); row.endX = value.globalX; row.endY = value.globalY;
          ending.set(pointerSession, row);
          // Runs after the original synchronous target route, never a second route inside onContact.
          queueMicrotask(() => { try { finishTap(pointerSession, row); } catch (cause) { if (!closed) fail(cause); } });
        }
      }
    } else if (kind === 'cancel') {
      cancelCount++; active.delete(pointerSession); ending.delete(pointerSession);
    }
    if (!closed) publish();
  }
  function listen(node, type, handler) {
    node.addEventListener(type, handler); handlers.push([node, type, handler]);
  }
  function makeControls() {
    const doc = controls.ownerDocument;
    controlRoot = doc.createElement('div'); controlRoot.className = 'controls';
    function selectControl(name, labelText, options) {
      const label = doc.createElement('label'); label.textContent = labelText + ' ';
      const select = doc.createElement('select'); select.dataset.resourceControl = name;
      for (const [value, text] of options) {
        const option = doc.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      label.append(select); controlRoot.append(label); return select;
    }
    function button(name, text, handler) {
      const value = doc.createElement('button'); value.type = 'button'; value.textContent = text;
      value.dataset.resourceControl = name; controlRoot.append(value);
      listen(value, 'click', () => perform(handler)); return value;
    }
    pilotSelect = selectControl('pilot', 'Pilot / 角色', [[IDS[0], 'Left / 左侧'], [IDS[1], 'Right / 右侧']]);
    outfitSelect = selectControl('outfit', 'Outfit / 服装', ['A', 'B', 'C', 'D'].map(value => [value, value]));
    listen(pilotSelect, 'change', () => perform(async () => {
      const target = session.scene.actors[pilotSelect.value]?.root;
      if (target) session.selectTarget(target);
      await draw();
    }));
    changeButton = button('change', 'Change outfit / 换装', async () => {
      buttonBusy = true; refreshControls();
      try { await session.replaceOutfit(session.inspect().selectedId, outfitSelect.value); await draw(); }
      finally { buttonBusy = false; refreshControls(); }
    });
    stepButton = button('step', 'Step 0.125 s / 前进', async () => {
      session.advanceTo(seconds + 0.125); seconds += 0.125; await draw();
    });
    pauseButton = button('pause', 'Pause pilot / 暂停角色', async () => {
      const snapshot = session.snapshot(), id = snapshot.selectedId;
      if (snapshot.actors[id].paused) session.resume(id); else session.pause(id);
      await draw();
    });
    controls.append(controlRoot); refreshControls();
  }
  function closeSession() {
    if (session && !sessionClosing) {
      try { sessionClosing = session.close(); }
      catch (cause) { sessionClosing = Promise.reject(cause); }
      void sessionClosing.catch(() => undefined);
    }
  }
  function close() {
    if (closePromise) return closePromise;
    closed = true; state = 'closing';
    signal?.removeEventListener('abort', onAbort);
    for (const [node, type, handler] of handlers.splice(0)) node.removeEventListener(type, handler);
    ending.clear();
    const failures = [];
    try { input?.dispose(); } catch (cause) { failures.push(cause); }
    active.clear(); closeSession(); lifetime.abort();
    refreshControls();
    closePromise = (async () => {
      const keep = async operation => { try { await operation(); } catch (cause) { failures.push(cause); } };
      await Promise.resolve(initialization).catch(() => undefined);
      closeSession();
      if (sessionClosing) await keep(() => sessionClosing);
      await serial;
      await Promise.allSettled([...actions]);
      if (provider) await keep(() => provider.close());
      if (host) await keep(() => host.close());
      for (const face of fonts) await keep(() => {
        if (document.fonts.has(face)) document.fonts.delete(face);
        if (document.fonts.has(face)) throw new Error('MOBILE_RESOURCE_FONT_CLEANUP');
      });
      controlRoot?.remove(); cleanupFailures = failures.length; state = 'closed'; publish();
      if (failures.length) throw new AggregateError(failures, 'Mobile resource cleanup failed');
      return inspect();
    })();
    return closePromise;
  }
  function onAbort() { void close().catch(() => undefined); }
  signal?.addEventListener('abort', onAbort, { once: true });
  initialization = (async () => {
    if (signal?.aborted) throw new DOMException('Mobile resource session aborted', 'AbortError');
    await prepareFonts(); assertOpen();
    host = createCanvasHost({ canvas, pixelRatio });
    provider = createBrowserTextureProvider({ readBytes(ref) {
      const pin = pins.get(ref.id);
      if (!pin) return Promise.reject(new Error('MOBILE_RESOURCE_IMAGE_NOT_SELECTED'));
      return verifiedBytes(ref.id, pin);
    } });
    session = createResourceSceneSession({ host, profile: 'canvas-2d', restore: model, textureProvider: provider,
      textProvider: createCanvasTextRasterProvider(), fontFamilies: families });
    await session.ready; assertOpen();
    input = createBrowserPointerInput({ engine: session.scene.engine, scope: session.scene.inputScope,
      width: WIDTH, height: HEIGHT, capacity: 10, onContact: contact });
    const stage = session.scene.engine.stage, inputSignal = session.scene.inputScope.signal;
    stage.on(input.events.begin, event => {
      const row = active.get(event.payload.session);
      if (row && row.target === event.target) row.beginEvent = event;
    }, { signal: inputSignal });
    stage.on(input.events.end, event => {
      const row = ending.get(event.payload.session);
      if (row && row.target === event.target) row.endEvent = event;
    }, { signal: inputSignal });
    makeControls(); state = 'ready'; await draw(); assertOpen();
    if (canvas.width !== expectedBackingWidth || canvas.height !== expectedBackingHeight) {
      throw new Error('MOBILE_RESOURCE_BACKING_MISMATCH');
    }
    refreshControls(); publish();
  })();
  try { await initialization; }
  catch (cause) {
    try { await close(); }
    catch (cleanup) { throw new AggregateError([cause, cleanup], 'Mobile resource startup and cleanup failed'); }
    if (signal?.aborted) throw new DOMException('Mobile resource session aborted', 'AbortError');
    throw cause;
  }
  return Object.freeze({ inspect, async whenIdle(){let pending;do{pending=serial;await Promise.allSettled([...actions]);await pending;}while(pending!==serial||actions.size>0);}, snapshot() { return session.snapshot(); }, close });
}
