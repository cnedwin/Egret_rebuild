import { Event, Sprite, createEventType } from '@egret/engine';

/** @typedef {{globalX:number, globalY:number, button:0, pointerType:'mouse'}} PickPayload */
const FRAME = Object.freeze({ width: 320, height: 200, clearColor: 0, clearAlpha: 1 });

/** Compose authored input regions, actual typed dispatch and one render per change. */
export function createHitTestScene(engine, scope) {
  const stage = engine.stage;
  const root = scope.use(new Sprite()); stage.addChild(root);
  const labels = new Map([[stage, 'stage'], [root, 'root']]);
  const colors = new Map();
  function actor(label, parent, x, y, width, height, color) {
    const node = parent.addChild(new Sprite()); node.x = x; node.y = y;
    node.touchEnabled = true; node.hitArea = { x: 0, y: 0, width, height };
    node.graphics.beginFill(color).drawRect(0, 0, width, height).endFill();
    labels.set(node, label); colors.set(node, color); return node;
  }
  const lower = actor('lower', root, 16, 16, 80, 80, 0xff0000);
  const upper = actor('upper', root, 48, 32, 64, 64, 0x0000ff);
  const gate = root.addChild(new Sprite()); gate.x = 160; gate.y = 24;
  gate.clipRect = { x: 0, y: 0, width: 48, height: 48 }; labels.set(gate, 'gate');
  const gatedChild = actor('gatedChild', gate, 0, 0, 80, 80, 0x00ff00);
  const left = actor('left', root, 16, 128, 32, 32, 0xff00ff);
  const right = actor('right', root, 48, 128, 32, 32, 0xffff00);
  const feedback = root.addChild(new Sprite()); feedback.x = 272; feedback.y = 16;
  labels.set(feedback, 'feedback');
  const actors = [lower, upper, gatedChild, left, right];
  const nodes = [stage, root, lower, upper, gate, gatedChild, left, right, feedback];
  /** @type {import('@egret/engine').EventType<PickPayload>} */
  const pickedType = createEventType('example.hit-test.pick', { bubbles: true, cancelable: false });
  let route = [], lastPayload, selectedLabel, status = 'ready';
  let pointerCount = 0, dispatchCount = 0, renderCount = 0, lastFrameId;
  let feedbackColor = 0x404040, unsubscribeAttempts = 0, typedListenerCount = 0;
  function paintFeedback(color) {
    feedbackColor = color;
    // Graphics drawRect appends; clearing keeps feedback at one primitive.
    feedback.graphics.clear();
    feedback.graphics.beginFill(color).drawRect(0, 0, 24, 24).endFill();
  }
  function rememberFrame(frame) { renderCount++; lastFrameId = frame.frameId; }
  function record(event) {
    // Dispatch state is transient; retain only scalar labels during the handler.
    route.push(Object.freeze({ currentTarget: labels.get(event.currentTarget), target: labels.get(event.target), phase: event.eventPhase }));
  }
  const unsubscribes = [];
  function subscribe(node, capture = false) {
    unsubscribes.push(node.on(pickedType, record, { capture, signal: scope.signal }));
    typedListenerCount++;
  }
  for (const node of actors) subscribe(node);
  subscribe(stage, true); subscribe(root); subscribe(stage);
  scope.use({ dispose() {
    const failures = [];
    for (const unsubscribe of unsubscribes) {
      unsubscribeAttempts++;
      try { unsubscribe(); } catch (cause) { failures.push(cause); }
    }
    unsubscribes.length = 0; typedListenerCount = 0;
    if (failures.length !== 0) throw new AggregateError(failures, 'Typed listener retirement failed');
  } });
  paintFeedback(feedbackColor);
  rememberFrame(engine.renderFrame(FRAME));

  function pick(payload) {
    pointerCount++;
    lastPayload = Object.freeze({ globalX: payload.globalX, globalY: payload.globalY, button: payload.button, pointerType: payload.pointerType });
    route = []; selectedLabel = undefined; status = 'miss';
    const selected = stage.hitTest(payload.globalX, payload.globalY, { maxNodes: 9 });
    if (selected === undefined) return undefined;
    selectedLabel = labels.get(selected); status = 'hit';
    dispatchCount++;
    selected.dispatchEvent(new Event(pickedType, lastPayload));
    paintFeedback(colors.get(selected));
    // Application-only post-dispatch projection anchor; initial rendering is separate.
    rememberFrame(engine.renderFrame(FRAME));
    return selected;
  }
  function toggleUpper() {
    upper.visible = !upper.visible;
    rememberFrame(engine.renderFrame(FRAME));
  }
  function toggleGateVisibility() {
    gate.visible = !gate.visible;
    rememberFrame(engine.renderFrame(FRAME));
  }
  function toggleTouchChildren() {
    gate.touchChildren = !gate.touchChildren;
    rememberFrame(engine.renderFrame(FRAME));
  }
  function readSnapshot() {
    const disposedNodes = nodes.filter(node => node.isDisposed).length;
    return Object.freeze({
      status, selectedLabel, lastPayload,
      route: Object.freeze(route.slice()), pointerCount, dispatchCount, renderCount, lastFrameId,
      feedbackColor, liveNodes: nodes.length - disposedNodes, disposedNodes,
      enabledActors: actors.filter(node => !node.isDisposed && node.touchEnabled).length,
      typedListenerCount, unsubscribeAttempts, scopeState: scope.state,
      upperVisible: upper.visible, gateVisible: gate.visible, touchChildren: gate.touchChildren,
    });
  }
  return Object.freeze({ pick, toggleUpper, toggleGateVisibility, toggleTouchChildren, readSnapshot, pickedType });
}
