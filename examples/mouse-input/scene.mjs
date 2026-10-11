// First-party example composition; only public Egret SDK entries. Apache-2.0.
import { Sprite } from '@egret/engine';

const FRAME = Object.freeze({ width: 160, height: 100, clearColor: 0, clearAlpha: 1 });

export function createMouseScene(engine, scope) {
  const stage = engine.stage;
  const panel = scope.use(new Sprite()); panel.x = 10; panel.y = 10; stage.addChild(panel);
  const labels = new Map([[stage, 'stage'], [panel, 'panel']]);
  function actor(name, x, y, width, height, color) {
    const node = panel.addChild(new Sprite()); node.x = x; node.y = y;
    node.touchEnabled = true; node.hitArea = { x: 0, y: 0, width, height };
    node.graphics.beginFill(color).drawRect(0, 0, width, height).endFill();
    labels.set(node, name); return node;
  }
  const back = actor('back', 10, 10, 80, 50, 0xff0000);
  const upper = actor('upper', 30, 20, 40, 30, 0x00ff00);
  const cover = actor('cover', 30, 20, 40, 30, 0x0000ff); cover.visible = false;
  const nodes = [stage, panel, back, upper, cover];
  let input, unsubscribes = [], log = [], revealOnEnd = false, overflow = false;
  let renderCount = 0, lastFrameId = 0;

  function render() { const frame = engine.renderFrame(FRAME); renderCount++; lastFrameId = frame.frameId; return lastFrameId; }
  function unbind() {
    const failures = [];
    for (const unsubscribe of unsubscribes) { try { unsubscribe(); } catch (cause) { failures.push(cause); } }
    unsubscribes = [];
    if (failures.length) throw new AggregateError(failures, 'Example typed listener cleanup failed');
  }
  function bind(handle) {
    unbind(); input = handle;
    for (const kind of ['begin', 'end', 'activate', 'cancel']) {
      for (const node of nodes) for (const capture of [true, false]) {
        unsubscribes.push(node.on(input.events[kind], event => {
          if (log.length >= 256) { overflow = true; return; }
          const data = event.payload;
          // Read transient dispatch state while the genuine handler is active.
          log.push({ kind, currentTarget: labels.get(event.currentTarget), target: labels.get(event.target),
            phase: event.eventPhase, state: input.state, pointerId: data.pointerId,
            globalX: data.globalX, globalY: data.globalY, pointerType: data.pointerType, button: data.button,
            frozenEvent: Object.isFrozen(event), frozenPayload: Object.isFrozen(data) });
          if (kind === 'end' && node === upper && !capture && revealOnEnd) {
            revealOnEnd = false; cover.visible = true;
          }
        }, { capture, signal: scope.signal }));
      }
    }
  }
  scope.use({ dispose: unbind });
  render();
  return Object.freeze({
    bind, unbind, render,
    resetLog() { log = []; overflow = false; },
    armCover() { revealOnEnd = true; },
    resetCover() { cover.visible = false; revealOnEnd = false; },
    snapshot() {
      return { log: log.map(row => ({ ...row })), overflow, renderCount, lastFrameId,
        coverVisible: cover.visible, scopeState: scope.state,
        liveNodes: nodes.filter(node => !node.isDisposed).length,
        disposedNodes: nodes.filter(node => node.isDisposed).length };
    },
  });
}
