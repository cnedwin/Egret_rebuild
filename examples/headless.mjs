import { DisplayObject, DisplayObjectContainer, Event, createEngine, createEventType } from "@egret/engine";

const trace = [];
const timers = new Set();
const host = {
  surface: {},
  start() { trace.push("host.start"); },
  stop() { trace.push("host.stop"); },
  async close() { trace.push("host.close"); },
  setTimeout(callback, delayMs) {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delayMs);
    timers.add(timer);
    return () => { timers.delete(timer); clearTimeout(timer); };
  },
};
const engine = await createEngine({ host, onDiagnostic: (d) => trace.push(`diagnostic:${d.code}`) });
const screen = engine.createScope();
const lease = screen.use({ release() { trace.push("lease.release"); } });
const panel = screen.use(new DisplayObjectContainer());
const button = screen.use(new DisplayObject());
panel.addChild(button);
engine.stage.addChild(panel);
const tap = createEventType("tap", { bubbles: true, cancelable: true });
engine.stage.on(tap, () => { trace.push("capture"); }, { capture: true, signal: screen.signal });
button.on(tap, (event) => { trace.push(`button:${event.payload}`); event.preventDefault(); }, { once: true, signal: screen.signal });
panel.on(tap, () => { trace.push("bubble"); }, { signal: screen.signal });
const defaultAllowed = button.dispatchEvent(new Event(tap, "headless"));
screen.signal.addEventListener("abort", () => trace.push(`scope:${screen.state}`));
screen.dispose();
await engine.dispose();
void lease;
const result = {
  defaultAllowed,
  trace,
  scopeState: screen.state,
  panelDisposed: panel.isDisposed,
  buttonDisposed: button.isDisposed,
  stageDisposed: engine.stage.isDisposed,
  pendingTimers: timers.size,
};
console.log(JSON.stringify(result, null, 2));
