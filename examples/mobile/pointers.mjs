// SPDX-License-Identifier: Apache-2.0
import {createEngine, Sprite} from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {createBrowserKeyboardInput} from '@egret/engine/web/keyboard';

/** One disposable demo session; the shell remounts it after a viewport change. */
export async function mount({canvas, controls, viewport, signal, report, model = {}}) {
  const {width, height, density} = viewport;
  if (![width, height, density].every(Number.isFinite) || width < 240 || width > 960 || height <= 32 || density <= 0 || density > 2) {
    throw new RangeError('MOBILE_POINTER_VIEWPORT');
  }
  const document = canvas.ownerDocument;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.action = 'pointer-toggle';
  toggle.disabled = true;
  const summary = document.createElement('output');
  summary.setAttribute('aria-live', 'polite');
  const keyboardHint = document.createElement('p');
  keyboardHint.textContent = 'Focus the canvas, then Tab / Shift+Tab or ← / → to navigate; Enter / Space activates. Pointer and keyboard can coexist. / 聚焦画布后，用 Tab / Shift+Tab 或左右方向键切换，回车／空格激活；可同时使用触摸。';
  controls.append(toggle, summary, keyboardHint);

  const frame = Object.freeze({width, height, clearColor: 0x172033, clearAlpha: 1});
  const active = new Map(), markers = new Map(), notifications = [], diagnostics = [];
  const regionWidth = (width - 48) / 2;
  const regions = Object.freeze([
    Object.freeze({id: 'left', x: 16, y: 16, width: regionWidth, height: height - 32}),
    Object.freeze({id: 'right', x: 32 + regionWidth, y: 16, width: regionWidth, height: height - 32}),
  ]);
  let engine, host, scope, input, keyboard, focusMarker, root, left, right;
  const activations = {left:Number.isSafeInteger(model?.activations?.left)&&model.activations.left>=0?model.activations.left:0,right:Number.isSafeInteger(model?.activations?.right)&&model.activations.right>=0?model.activations.right:0};
  const keyboardEvents = [];
  let keyboardCancels = 0;
  let state = 'starting', closing = false, closePromise, renders = 0, maximumContacts = 0;
  let suspended = model?.suspended === true;

  function emit(value) {
    if (typeof report === 'function') report(value);
  }
  function diagnostic(value) {
    // Retain the SDK's code and one nested cause code without altering the error.
    const row = Object.freeze({code: typeof value?.code === 'string' ? value.code : null,
      causeCode: typeof value?.cause?.code === 'string' ? value.cause.code : null});
    diagnostics.push(row);
    if (diagnostics.length > 64) diagnostics.shift();
    emit({type: 'diagnostic', ...row});
  }
  function describe() {
    toggle.disabled = closing || !input || input.state === 'closed';
    toggle.textContent = suspended ? 'Resume / \u7ee7\u7eed' : 'Suspend / \u6682\u505c';
    toggle.setAttribute('aria-pressed', String(suspended));
    const contacts = [...active.values()];
    summary.textContent = 'Left / \u5de6: ' + contacts.filter(value => value.region === 'left').length
      + ' \u00b7 Right / \u53f3: ' + contacts.filter(value => value.region === 'right').length
      + ' · Keys / 键盘: ' + (keyboard?.getSnapshot().focusedId ?? '—') + ' · Activated / 激活: ' + activations.left + ' / ' + activations.right;
  }
  function render() {
    if (!engine || closing || scope?.state !== 'open') return;
    if(keyboard&&focusMarker){
      const view=keyboard.getSnapshot(),box=regions.find(value=>value.id===view.focusedId);
      focusMarker.graphics.clear();
      if(box&&view.focusVisible){
        focusMarker.x=box.x;focusMarker.y=box.y;
        focusMarker.graphics.beginFill(view.pressedKeys.length?0xffffff:0xffd166)
          .drawRect(-3,-3,box.width+6,3).drawRect(-3,box.height,box.width+6,3)
          .drawRect(-3,0,3,box.height).drawRect(box.width,0,3,box.height).endFill();
      }
    }
    engine.renderFrame(frame);
    renders++;
  }
  function onContact({kind, contact, target, reason}) {
    const {session} = contact;
    const key = session.generation + ':' + session.id;
    const region = target === left ? 'left' : target === right ? 'right' : 'outside';
    if(kind==='begin'&&keyboard&&region!=='outside'){canvas.focus({preventScroll:true});keyboard.focus(region,{reason:'pointer',visible:false});}
    const sample = Object.freeze({kind, ...(reason === undefined ? {} : {reason}), region,
      id: session.id, generation: session.generation, pointerId: session.pointerId,
      pointerType: session.pointerType, globalX: contact.globalX, globalY: contact.globalY,
      sequence: contact.sequence, viewportRevision: contact.viewportRevision});
    notifications.push(sample);
    if (notifications.length > 128) notifications.shift();
    if (kind === 'begin' || kind === 'move') {
      active.set(key, sample);
      if (!markers.has(key)) {
        const marker = root.addChild(new Sprite());
        marker.graphics.beginFill(0xffffff).drawRect(-5, -5, 10, 10).endFill();
        markers.set(key, marker);
      }
      const marker = markers.get(key);
      marker.x = contact.globalX;
      marker.y = contact.globalY;
      maximumContacts = Math.max(maximumContacts, active.size);
    } else {
      active.delete(key);
      markers.get(key)?.dispose();
      markers.delete(key);
    }
    describe();
    render();
    emit({type: 'contact', ...sample, activeContacts: active.size});
  }
  function inspect() {
    return {state: closing ? state : input?.state ?? state,
      inputState: input?.state ?? null, scopeState: scope?.state ?? null,
      active: [...active.values()], notifications: notifications.slice(), diagnostics: diagnostics.slice(),
      maximumContacts, markerCount: markers.size, renders,
      keyboard:keyboard?.getSnapshot()??null, keyboardEvents:keyboardEvents.slice(), keyboardCancels, activations:{...activations},
      viewportRevision: input?.viewportRevision ?? 0, viewport: {width, height, density},
      backing: {width: canvas.width, height: canvas.height}, regions: regions.map(value => ({...value}))};
  }
  function snapshot() {
    // Contacts belong to this input instance and never survive a shell remount.
    const view=keyboard?.getSnapshot();
    return {suspended,activations:{...activations},focusedId:view?.focusedId,focusVisible:view?.focusVisible};
  }
  function toggleInteractive() {
    if (closing || !input || input.state === 'closed') return;
    try {
      input.setInteractive(input.state === 'suspended');
      suspended = input.state === 'suspended';
      keyboard?.setInteractive(!suspended);render();
      describe();
      emit({type: 'state', state: input.state, activeContacts: active.size});
    } catch (cause) {
      diagnostic(cause);
    }
  }
  function onAbort() {
    void close().catch(diagnostic);
  }
  function close() {
    if (closePromise) return closePromise;
    closing = true;
    state = 'closing';
    toggle.disabled = true;
    toggle.removeEventListener('click', toggleInteractive);
    signal?.removeEventListener('abort', onAbort);
    closePromise = (async () => {
      const failures = [];
      // Terminal notifications run before their display owners are retired.
      try { keyboard?.dispose(); } catch (cause) { failures.push(cause); }
      try { input?.dispose(); } catch (cause) { failures.push(cause); }
      try {
        if (engine) await engine.dispose();
        else await host?.close();
      } catch (cause) { failures.push(cause); }
      active.clear();
      markers.clear();
      toggle.remove();
      summary.remove();keyboardHint.remove();
      state = 'closed';
      emit({type: 'state', state, activeContacts: 0});
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, 'Mobile pointer cleanup failed');
      return inspect();
    })();
    return closePromise;
  }
  const session = Object.freeze({inspect, snapshot, close});
  describe();
  if (signal?.aborted) {
    await close();
    return session;
  }
  try {
    host = createCanvasHost({canvas, pixelRatio: density});
    engine = await createEngine({host, onDiagnostic: diagnostic});
    // An abort may arrive while createEngine is awaiting native startup.
    if (signal?.aborted) {
      await close();
      return session;
    }
    scope = engine.createScope();
    root = scope.use(new Sprite());
    engine.stage.addChild(root);
    function createRegion(box, color) {
      const node = root.addChild(new Sprite());
      node.x = box.x;
      node.y = box.y;
      node.touchEnabled = true;
      node.hitArea = {x: 0, y: 0, width: box.width, height: box.height};
      node.graphics.beginFill(color).drawRect(0, 0, box.width, box.height).endFill();
      return node;
    }
    left = createRegion(regions[0], 0x087e8b);
    right = createRegion(regions[1], 0xc45233);
    input = createBrowserPointerInput({engine, scope, width, height, capacity: 10, onContact});
    focusMarker=root.addChild(new Sprite());
    keyboard=createBrowserKeyboardInput({engine,scope,onFocusChange(){describe();render();emit({type:'keyboard-focus',...keyboard?.getSnapshot()});}});
    keyboard.registerTarget({id:'left',target:left});keyboard.registerTarget({id:'right',target:right});
    engine.stage.on(keyboard.events.keyDown,event=>{
      const {targetId,code,repeat}=event.payload;
      keyboardEvents.push({kind:'down',targetId,code,repeat});if(keyboardEvents.length>64)keyboardEvents.shift();
      if(code==='ArrowLeft'||code==='ArrowRight'){event.preventDefault();keyboard.moveFocus(code==='ArrowLeft'?'previous':'next',true);}
      else if(code==='Enter'||code==='Space'){event.preventDefault();if(!repeat&&Object.hasOwn(activations,targetId))activations[targetId]++;}
      describe();render();
    },{signal:scope.signal});
    for(const [kind,type] of [['up',keyboard.events.keyUp],['cancel',keyboard.events.cancel]])engine.stage.on(type,event=>{
      keyboardEvents.push({kind,targetId:event.payload.targetId,code:event.payload.code});if(keyboardEvents.length>64)keyboardEvents.shift();if(kind==='cancel')keyboardCancels++;describe();render();
    },{signal:scope.signal});
    if(model.focusedId==='left'||model.focusedId==='right')keyboard.focus(model.focusedId,{visible:model.focusVisible===true});
    if (suspended) {input.setInteractive(false);keyboard.setInteractive(false);}
    toggle.addEventListener('click', toggleInteractive);
    signal?.addEventListener('abort', onAbort, {once: true});
    state = input.state;
    describe();
    render();
    if (signal?.aborted) await close();
    else emit({type: 'state', state: input.state, activeContacts: 0});
    return session;
  } catch (cause) {
    diagnostic(cause);
    try { await close(); } catch (cleanupCause) { diagnostic(cleanupCause); }
    throw cause;
  }
}
