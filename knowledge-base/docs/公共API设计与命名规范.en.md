# Public API Design and Naming Standards

English | [简体中文](公共API设计与命名规范.md)

Version: 0.1 candidate specification · Knowledge base 0.9.0 · Updated: October 8, 2026.

This specification preserves Egret's display-list, stage, event, and animation language in new projects while adopting modularity, explicit instances, and verifiable lifecycles. R016 confirms the objective of redefining complete architecture and standards; D016 carries the candidate design. Package names, methods, and complete examples have not had a stable release or complete acceptance. The [first core-slice record](核心框架实现记录.en.md) lists the compiled and verified subset. See [engineering technical architecture](工程技术架构与项目结构.en.md) for engineering boundaries and [code standards](代码规范与质量门禁.en.md) for implementation requirements.

## Egret identity and naming table

Retain familiar, clearly defined domain terms rather than expressing modernization through new abbreviations. The [naming research](../evidence/egret-naming-contract-summary.json) summarizes eight selected historical files and existing EUI static evidence; it does not prove behavioral compatibility across all old versions.

| Area | Candidate names and semantics |
| --- | --- |
| Display list | `DisplayObject`, `DisplayObjectContainer`, `Stage`; retain `addChild`, `removeChild`, `getChildAt`, and `setChildIndex`. |
| Drawing and images | `Sprite` remains a display container with `graphics`; `Bitmap` continues displaying textures. Sprite cannot become an image-only object. |
| Text and animation | `TextField`, `MovieClip`, `Tween`; retain playback, pause, frame, and timeline concepts, with timing owned by Engine. |
| GUI | Explicit `/eui` entry point, retaining EUI component, layout, Skin, and data-list vocabulary; migrators map between the new schema and old EXML. |
| 3D | `/scene3d` entry point with `Scene3D`, `Node3D`, `Camera3D`, `Mesh3D`, and `Material`. 3D nodes do not inherit 2D layout/pixel sizes; they share object IDs, resources, and scheduling contracts. |
| Events | `Event`, `TouchEvent`, `EventDispatcher`; retain common constants such as `TOUCH_BEGIN`, `TOUCH_END`, and `TOUCH_TAP`. New mouse/pen input may use an explicit `PointerEvent` contract. |
| Classes and types | PascalCase: `Texture`, `AssetLease`, `EngineOptions`; no interface `I` or type `T` prefixes. Local generic parameters may use `T`. |
| Members and functions | camelCase: `scaleX`, `touchEnabled`, `createEngine`, `acquire`; booleans use `is/has/can/should` or existing clear domain names. |
| Constants and serialization | True constants and historical event constants use UPPER_SNAKE_CASE; project fields use camelCase, with explicit version fields and units. Stable IDs are separate from user-editable `name`. |
| Files and native code | TS main-class files retain the `DisplayObject.ts` style, responsibility modules use `frameScheduler.ts`, directories use kebab-case; Rust crates start with `egret-`, modules/functions use snake_case, types PascalCase; C ABI uses the `egret_` prefix. |

Private members gain no public commitment from historical `$` or underscore prefixes; legacy identifiers such as `hashCode` are not persistent project IDs. Initially, do not give one constructor multiple old/new synonyms such as Group/Container.

## Imports and initialization

Candidate public identities are `@egret/engine`, `@egret/project`, and `@egret/cli`. npm scope/name availability must still be checked before publication. New code defaults to named imports, while `import * as egret from "@egret/engine"` can retain the call appearance. This is an ESM module object and creates no global variable. EUI can use `import * as eui from "@egret/engine/eui"`.

The root entry exports basic 2D and `createEngine`; `/web`, `/eui`, `/scene3d`, `/animation`, and `/compat` are explicit entry points. Import does not create a GPU, start a clock, download resources, or register global plugins. `createEngine({host, graphics, features})` starts asynchronously and returns Engine; failed startup cleans up acquired owned resources. One page can create multiple instances. Their stages, clocks, events, and resource leases do not depend on a global “current engine.” Objects bind to Engine when registered in Scope or first attached; detach retains the binding. Cross-Engine attachment, scope ownership takeover, or binding instance resources is an error. Shared source assets are acquired separately in each instance; immutable math/style values may be shared. Backend and host construction comes from explicit adapters assembled at the entry point.

Public types do not default to complete DOM or Node declarations; browser-specific HTMLCanvasElement appears only in `/web`. `features` consists of explicitly imported capability factories rather than arbitrary strings automatically registering all modules. `/compat` includes runtime compatibility facilities only, not the entire development-time legacy-project converter.

## Properties and queries

`x/y/scaleX/scaleY/alpha/rotation/visible/touchEnabled` retain accessible properties. Frequent changes first enter CPU logical state and dirty queues, then are extracted at defined frame stages. Property assignments do not cross languages individually or synchronously wait for the GPU. Queries such as `getBounds` read CPU-known state; operations needing layout refresh are explicitly named `validateLayout`, without hiding an entire render frame in ordinary getters.

Display-tree members offer read-only iteration or snapshots; no directly mutable children array is exposed. `addChild` maintains a single parent and explicit order; reattachment does not destroy objects. 2D `width/height` express untransformed logical layout size; rules for explicit and natural content sizes are documented by object type. Transformed bounds are queried through `getBounds`. Size behavior is not uniform across historical snapshots. Do not automatically convert every old width assignment to scale; migration comparisons depend on version, subclass, and EUI layout mode.

2D coordinates use logical pixels independent of device pixel density, with top-left origin, x rightward, and y downward; retain degrees for historical `rotation`. 3D defaults to right-handed coordinates, Y up, and cameras facing local -Z, with world units defined as meters. `rotation` uses Quaternion; Euler helpers are explicitly named `setEulerRadians`, without mixing 2D degrees. Asset import records coordinate and unit conversions. Game clocks and new animation durations default to seconds, using `durationSeconds` when names need distinction; compatibility entry points explicitly convert legacy Tween milliseconds.

## Asynchronous resources and ownership

Candidate `assets.acquire(ref, {signal})` returns `Promise<AssetLease<T>>`. `ref` is an `AssetRef<T>` with stable ID and resource type, which may be generated from the project manifest. Types are inferred from references and checked at runtime; caller-supplied generics alone cannot turn an arbitrary ID into a texture. Leases provide readonly `value` and idempotent `release()`. Each acquisition has its own leaseId, separating shared download/decode tasks from one use entitlement.

`signal` cancels only this acquisition before successful delivery. Delivery and cancellation are decided serially; whichever first reaches a terminal state wins. If cancellation occurs first, temporary results clean themselves up and must not be delivered. After successful delivery, remove this wait's abort listener; the caller's release or Scope owns the lease. Cancellation does not cancel shared tasks still needed by other callers. This separates “acquisition cancellation” from “the use period of delivered resources,” preventing cancellation notification from invalidating Bitmap resources still attached to the tree.

Bitmap borrows a logical Texture without implicitly acquiring another lease. Its creator retains the lease until every borrower has stopped using it. Lease release immediately invalidates its own use entitlement; physical GPU resources are reclaimed only after the last valid reference and in-flight use complete. Device rebuild replaces GPU projections only; logical resource identity and gameplay state persist by contract. Raw WebGPU/WebGL handles are advanced internal extensions, not the Bitmap texture interface.

## Cross-host cancellation protocol

Public signals use a DOM-free, minimal readonly CancellationSignal protocol: aborted, reason, addEventListener("abort", listener, {once?}), and removeEventListener("abort", listener). Listeners do not depend on DOM Event types. reason is undefined before cancellation and stable afterward. Abort happens once; listeners added when already aborted receive no replay. Each operation checks aborted, registers, and checks again. Scope enters closing before notification; listeners added during notification do not execute, removed listeners are skipped, and exceptions become collected diagnostics without blocking later cancellation or cleanup. The pure core implements this protocol. Browser adapters must accept standard AbortSignal through real type-compatibility checks; required hosts provide equivalent adapters. The first slice has compiled and verified the minimal cancellation protocol; browser and mini-game adapters have not passed acceptance. Existing AbortController in mini-games is not a prerequisite.

## Scope and shutdown order

`engine.createScope()` establishes a local ownership boundary and cross-host cancellation signal. `scope.use(value)` takes ownership of Disposable or AssetLease and returns the original value. Repeated registration of the same value in one scope deduplicates; another scope cannot silently become its owner. Reattaching a node does not transfer scope ownership. Initially, cross-scope ownership transfer is unavailable: retain the original owner or rebuild in the new scope.

Scope has open, closing, and closed states. `dispose()` first enters closing, aborts to stop waits and subscriptions, then runs dispose/release in reverse registration order and ends closed. It is synchronous and idempotent; logical cleanup does not wait for the GPU. A cleanup failure does not stop other cleanup, and aggregate errors are reported through Engine diagnostics. When use encounters closing/closed, it first checks ownership. A value already registered in this scope reports only a closing error and does not clean up early; the scheduled reverse order handles it. A value owned elsewhere is rejected without destruction. A new unowned late value is cleaned up immediately before the closing error is reported; cleanup exceptions become associated diagnostics of that error. Late await results therefore still have a cleanup path.

`removeChild` only removes from the tree; it does not cancel the object's tasks or release resources. `DisplayObject.dispose()` is explicit termination: detach from the parent, clean listeners and own tasks, then prohibit reuse. It does not destroy borrowed shared assets. `DisplayObjectContainer.dispose()` defaults to recursively terminating the current subtree; remove or reattach children beforehand to preserve them. Recursive cleanup always carries the initiating root's owner boundary. An owned root retains its scope boundary; an unowned root cleans only unowned nodes. An unowned intermediate container does not alter that boundary. On a child with another owner, detach and diagnose only, without descending into its subtree. Failed child cleanup does not stop sibling/root termination; diagnostics listeners throwing must not interrupt shutdown completion. Objects and leases are idempotent, so repeated termination during Scope's reverse cleanup does not reclaim twice.

The first `engine.dispose()` creates a unique shutdown Promise. Reentrancy during closing and later repeated calls return that same result without repeated submission or destruction. Failed results do not automatically retry. It asynchronously closes the entire run: reject new tasks, close Scope, stop frame submission, and wait within a bound for in-flight GPU/VM and platform cleanup. Timeout/cleanup failure rejects the shutdown Promise with an EgretError retaining diagnostics, and the instance cannot be reused. In-flight handles remain until completion conditions; timeout does not reclaim them early. Unfinished borrowed-host work returns to owner negotiation. Do not wait indefinitely or independently destroy borrowed devices/surfaces. Preserve primary and cleanup failures together; EgretError supplies cause and readonly cleanupErrors. Closing a local scope does not exit the entire Engine.

## Event contract

`node.on(eventType, handler, options)` returns idempotent unsubscribe; options include signal, capture, once, and priority. Event descriptors link stable event keys to specific payload types while retaining the appearance of TouchEvent constants. Each on call creates an independent subscription; unsubscribe/cancellation affects only it. Already-canceled signals register no listener. Compatibility maps old duplicate-registration and listener/thisObject/capture identity rules separately.

New display-tree dispatch fixes the propagation path and subscription candidates for all nodes/phases at the start of the entire dispatch, rather than rereading lists at each phase. Ancestor capture proceeds root to parent, then target capture before target non-capture, then bubbling parent to root. priority is a finite integer, defaults to 0, and orders each group descending, then by registration sequence within a priority. Added listeners affect the next dispatch only; removed subscriptions are skipped when reached. once invalidates before invocation to avoid duplicate reentrant calls. This new rule differs from the selected historical snapshot and must retain compatibility tests. stopPropagation preserves the current node's remaining listeners, including both target groups, but visits no more nodes. stopImmediatePropagation stops the current node's remaining listeners and further propagation. preventDefault only prevents the default action of cancelable events. Descriptor bubbles/cancelable default false. bubbles controls ancestor bubbling only; ancestor capture in the display tree still executes. Ordinary service events have no display-tree path. Input descriptors specify both flags separately. The same active Event object cannot be dispatched again; nested dispatch needs a new object.

Thrown handlers propagate to the current caller, while finally restores internal dispatch state. Engine's outer scheduler records and terminates the failed step; unexecuted listeners are not marked successful. Synchronous handlers must not return unhandled Promises. Time-consuming asynchronous work enters explicit tasks and submits results at defined stages. New public event objects are not silently returned to pools after callbacks. Payload remains stable for delayed use, while propagation controls work only during dispatch. Resource notifications, lifecycle, and ordinary service events do not bubble by default.

Input, gameplay animation events, and GPU device epochs have separate numbering. Device loss must not replay consumed gameplay events. Public synchronous events and internal cross-thread reliable event streams are different contracts; internal ACK/deduplication does not change synchronous capture/bubbling meanings.

## Proposed call appearance

The example below shows the complete candidate contract, including unimplemented capabilities such as Bitmap/TouchEvent. There is no published package or compilation result for this complete example; see the [core framework implementation record](核心框架实现记录.en.md) for the first subset. The subsequent CPU asset service is separately scoped by the [asset contract](资源核心合同.en.md) and [implementation record](资源核心实现记录.en.md). Host adapters and generated project references provide `host` and `assets.logo`.

```ts
import { Bitmap, EgretError, TouchEvent, createEngine } from "@egret/engine";

const engine = await createEngine({ host });
const screen = engine.createScope();

try {
  const texture = screen.use(await engine.assets.acquire(assets.logo, {
    signal: screen.signal,
  }));
  const logo = screen.use(new Bitmap(texture.value));
  logo.x = 120;
  logo.y = 80;
  engine.stage.addChild(logo);

  logo.on(TouchEvent.TOUCH_TAP, () => {
    logo.alpha = 0.8;
  }, { signal: screen.signal });
} catch (error) {
  screen.dispose();
  try {
    await engine.dispose();
  } catch (cleanupError) {
    throw new EgretError("SETUP_FAILED", {
      cause: error,
      cleanupErrors: [cleanupError],
    });
  }
  throw error;
}

// 关闭界面时：先解绑/取消，再销毁logo，最后释放纹理租约。
screen.dispose();
// 宿主或作品退出时：等待整次运行关闭。
await engine.dispose();
```

The source comments describe this cleanup order: when closing the screen, first unbind/cancel, then destroy logo, then release the texture lease; when the host or work exits, await shutdown of the entire run. There is no implicit global stage, resource singleton, or separate GPUDevice behind each UI object. Real teaching examples should wait for screen tasks to finish before shutdown; the final lines above illustrate cleanup order only.

## Compatibility and versions

New defaults are `on`, typed AssetRef, Scope, ESM, and Engine services. Migrators identify old `addEventListener(type, listener, thisObject, ...)`, static `RES` entry points, namespaces/global scripts, EXML, old Tween timing, and internal-field access. `/compat` retains necessary adapters for supported old behaviors. Event removal cannot generate a new bound function each time; handler/thisObject/capture identity must remain stable. RES was not reviewed method by method in this round, so one-to-one new methods for all old resource calls cannot be promised.

Compatibility separately checks public types, module/bundling resolution, external behavior, and project/resource/bridge formats. Semantic changes to stable interfaces also count as breaking changes and publish migration rules and deprecation information. Mark experimental APIs explicitly; they do not become permanent default examples. Initially, the three public packages may release in lockstep. projectSchema, resourceFormat, bridgeProtocol, and toolProtocol each have independent versions and compatibility ranges.

Complete R008/V006 migration, continued editing, target publication, and updates remain part of the first complete release objective. Retaining names or passing type checks cannot replace it. Specification acceptance covers multiple-Engine isolation, size/order, once reentrancy, cancellation races, late Scope results, lease sharing, color/coordinates, and old-project comparisons; see the [engineering-structure gates](工程技术架构与项目结构.en.md).

Language mechanism reference: [TypeScript modules and type exports](https://www.typescriptlang.org/docs/handbook/modules/reference.html). ESM mechanisms support this entry-point design but do not establish that actual release packages already trim on demand.
