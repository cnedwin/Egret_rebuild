import { CancellationController, DisplayObject, DisplayObjectContainer, Event, EventDispatcher, createEngine, createEventType } from "@egret/engine";
import type { CancellationSignal, HostAdapter, ScopeValue } from "@egret/engine";
import { createAssetType, createAssetRef } from "@egret/engine";
import type { AssetLease, AssetManager, AssetRef, AssetType } from "@egret/engine";

const signal: CancellationSignal = new CancellationController().signal;
const pressed = createEventType<{ readonly x: number }>("pressed", { bubbles: true });
const dispatcher = new EventDispatcher();
dispatcher.on(pressed, (event) => { const x: number = event.payload.x; void x; }, { signal, capture: true, priority: 3 });
const result: boolean = dispatcher.dispatchEvent(new Event(pressed, { x: 1 }));
const container = new DisplayObjectContainer();
const child: DisplayObject = container.addChild(new DisplayObject());
const parent: DisplayObjectContainer | undefined = child.parent;
const lease = { release(): void {} } satisfies ScopeValue;
declare const host: HostAdapter;
async function setup(): Promise<void> {
  const engine = await createEngine({ host, shutdownTimeoutMs: 100 });
  const scope = engine.createScope();
  const strings: AssetType<string> = createAssetType("string", (value): value is string => typeof value === "string");
  const ref: AssetRef<string> = createAssetRef(strings, "greeting");
  const assets: AssetManager = engine.assets;
  assets.register(strings, { load: async (request, context) => { const id: string = request.id; const generation: number = context.resourceGeneration; const task: number = context.taskId; const cancellation: CancellationSignal = context.signal; void generation; void task; void cancellation; return id; }, dispose: value => { const text: string = value; void text; } });
  const cpu: AssetLease<string> = await assets.acquire(ref, { signal });
  const text: string = scope.use(cpu).value;
  void text;
  const retained = scope.use(lease);
  retained.release();
  engine.stage.addChild(scope.use(new DisplayObject()));
  scope.dispose();
  await engine.dispose();
}
void result;
void parent;
void setup;
