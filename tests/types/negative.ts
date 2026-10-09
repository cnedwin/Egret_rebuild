import { Engine, Stage, Scope, DisplayObject, Event, EventDispatcher, createEventType } from "@egret/engine";
import type { EngineOptions, EventType } from "@egret/engine";
import { AssetManager, AssetLease, createAssetRef, createAssetType } from "@egret/engine";
import type { AssetRef, AssetType } from "@egret/engine";

const numeric = createEventType<number>("numeric");
const dispatcher = new EventDispatcher();
// @ts-expect-error Descriptor fixes payload type.
new Event(numeric, "wrong");
// @ts-expect-error Handler payload cannot contradict the descriptor.
dispatcher.on(numeric, (event: Event<string>) => { void event; });
// @ts-expect-error Synchronous event handlers reject Promise return types.
dispatcher.on(numeric, async () => {});
declare const mixedHandler: (event: Event<number>) => number | Promise<void>;
// @ts-expect-error A union containing a Promise is not a synchronous handler.
dispatcher.on(numeric, mixedHandler);
// @ts-expect-error Invariant descriptors cannot be widened to unrelated payloads.
const wide: EventType<number | string> = numeric;
const node = new DisplayObject();
// @ts-expect-error Parent is controlled by the display tree.
node.parent = undefined;
// @ts-expect-error Pure core does not expose DOM globals.
document.createElement("canvas");
// @ts-expect-error Pure core does not expose Node globals.
process.exit(0);
declare const validOptions: EngineOptions;
// @ts-expect-error Engine must reserve the surface and start through its factory.
new Engine(validOptions, 1000, () => {});
// @ts-expect-error Stage can only be created by Engine.
new Stage({ assertOpen() {}, report() {}, captureCleanup() {} });
// @ts-expect-error Scope can only be created by Engine.
new Scope({ assertOpen() {}, report() {}, captureCleanup() {} }, () => {});
void wide;

const stringType = createAssetType("text", (value): value is string => typeof value === "string");
const stringRef = createAssetRef(stringType, "greeting");
declare const engine: Engine;
// @ts-expect-error Descriptor generics must remain invariant.
const broadType: AssetType<string | number> = stringType;
// @ts-expect-error Resource reference generics must remain invariant.
const broadRef: AssetRef<string | number> = stringRef;
// @ts-expect-error Acquisition accepts a factory reference, never a string ID.
engine.assets.acquire("greeting");
// @ts-expect-error Provider value type follows the descriptor.
engine.assets.register(stringType, { load: async () => 42, dispose: () => {} });
// @ts-expect-error Validators must narrow unknown to the selected value type.
createAssetType<string>("bad", (value): value is number => typeof value === "number");
// @ts-expect-error CPU managers must be created through Engine.
new AssetManager({ assertOpen() {}, report() {}, captureCleanup() {} });
// @ts-expect-error CPU leases must be created through the manager.
new AssetLease();
// @ts-expect-error Internal manager factory is not a facade API.
import { createAssetManager } from "@egret/engine";
void broadType; void broadRef;

import type {RenderFrame2D, RenderHostAdapter} from '@egret/engine';
declare const capturedFrame:RenderFrame2D;
// @ts-expect-error Frames are immutable headers.
capturedFrame.width=10;
// @ts-expect-error Commands are readonly snapshots.
capturedFrame.commands.push(capturedFrame.commands[0]!);
// @ts-expect-error Geometry is immutable.
capturedFrame.commands[0]!.matrix.tx=1;
declare const baseRenderHost:RenderHostAdapter;
// @ts-expect-error Async rendering cannot satisfy the synchronous submission port.
const asyncRenderHost:RenderHostAdapter={...baseRenderHost,async renderFrame(){}};
