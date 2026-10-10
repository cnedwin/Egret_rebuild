# Resource core implementation record

English | [简体中文](../../Cns/docs/资源核心实现记录.md)

Date: 2026-10-08 · Knowledge base 0.11.0 · Artifact version 0.0.0 · Support level experimental. Status: CPU subset implemented and locally verified.

This slice adds CPU resource acquisition and leases to the existing three headless core packages, exposed through `engine.assets` in the workspace package `@egret/engine`. Its behavior follows the [resource core contract](resource-core-contract.md), implementing the typed references, acquisition cancellation, and Scope ownership in the [public API contract](public-api-design-and-naming.md) as a separate implementation slice. This record describes the actual CPU implementation and local verification. Results and provenance hashes are maintained in the [bounded verification report](../../evidence/asset-core-verification.json), without establishing acceptance of a complete resource product, graphics backend, or real host.

## Implementation boundary

contracts adds the assets diagnostic phase; runtime defines resource type, reference, provider, and lease protocols and owns CPU resource management and ownership; engine owns instance assembly and shutdown ordering. Dependency direction remains engine → runtime/contracts and runtime → contracts. Public consumption and behavioral verification enter through the built `@egret/engine` package. The core retains its boundary without DOM/Node environment globals; Node is used for development verification and examples.

`createAssetType` creates a type descriptor with a runtime guard, `createAssetRef` creates a typed stable reference, `register` configures a provider for that type, and `acquire` returns an independent lease. The type is inferred from the reference, and successful provider results still pass through the guard. Factory identity, type invariance, and a type binding for each ID together constrain invalid references; a caller-supplied generic cannot replace runtime checking. Type descriptors with the same name do not automatically share identity.

A provider is the boundary for acquiring and synchronously cleaning up CPU values. Each successful load result has independent cleanup ownership; if underlying objects are shared, the provider wraps its own reference counting. The manager does not supply network providers, protocol downloads, image/model/font decoding, GPU upload or residency, budgets/LRU, persistent manifests, `deviceEpoch` recovery, or in-flight GPU fences.

## State and ownership rules

| Object/operation | Contract |
| --- | --- |
| One acquisition | `waiting → delivered / cancelled / failed`, with first-terminal-wins arbitration; only a waiting acquisition responds to its signal. |
| Delivered lease | `active → released`; release is idempotent, and subsequent `value` access throws `ASSET_LEASE_RELEASED`. Successful delivery detaches the acquisition's cancellation listener, and later abort does not release the lease. |
| Shared task | The same ID/type/current generation shares one load, while every acquisition has its own lease; canceling one waiter must not stop other demand. |
| Generation without demand | When the last waiter cancels with no delivered leases, terminate the entry before notifying the provider; ignored-cancel late success is cleaned up without delivery. The last valid lease release triggers cleanup, and the next acquisition creates a new generation. |
| invalidate | The original generation retires from future acquisition while existing waiters and leases retain it; later acquisition creates a new generation, and old callbacks/releases must not overwrite or delete the new entry. |
| Manager closure | Synchronously close entry points, reject waits, revoke all its own leases, and clean up values; repeated disposal is idempotent. Engine closes assets after Scope and Stage cleanup and before `host.stop`. |
| Scope/Engine ownership | Leases bind to the producing Engine; adoption by a foreign Engine's Scope reports `ENGINE_MISMATCH`. A Scope cancels waits before releasing leases in reverse order, and `use` still cleans up a late unowned lease after closure. |

`leaseId` and `taskId` increase within the manager, while `resourceGeneration` increases for the same ID; all are positive safe integers. They have distinct responsibilities and do not represent persistent project IDs, device epochs, or cross-thread ACKs. Valid IDs are not implicitly trimmed or rewritten.

Cleanup and reentry commit terminal state before invoking external code. Entry terminal state, current mapping removal, and the cleanup-attempt flag must precede cancellation notifications, subsequent handling of type guards, `provider.dispose`, and diagnostic callbacks; mapping deletion must check entry identity. Each successful load result receives one synchronous disposal attempt. A throw records an assets diagnostic and preserves `cleanupErrors` during Engine closure while other cleanup continues. One disposal invocation does not mean physical cleanup succeeded, and synchronous manager closure cannot prove that physical work stopped for a provider that ignores cancellation or never settles.

Manager revocation removes access through a lease's `value`; an ordinary CPU object reference previously copied by a borrower cannot be physically recalled. Callers must retain a lease throughout every borrower's use. This boundary cannot be extended into a GPU-handle or thread-safety guarantee.

## Usage example

The example below illustrates the type guard, provider, and Scope adoption. It has been strictly compiled against the current built public declarations without DOM/Node environment types. It is a CPU object fixture with no external handle, network request, or decoding; the file-provider example below separately verifies actual asynchronous execution. The caller supplies `HostAdapter`, and a real host adapter requires separate acceptance.

```ts
import {
  createAssetRef,
  createAssetType,
  createEngine,
  type AssetProvider,
  type HostAdapter,
} from "@egret/engine";

interface Caption {
  text: string;
}

const captionType = createAssetType<Caption>(
  "caption",
  (value): value is Caption =>
    typeof value === "object" && value !== null &&
    "text" in value && typeof value.text === "string",
);
const welcome = createAssetRef(captionType, "screen/welcome");

const provider: AssetProvider<Caption> = {
  async load(ref, { signal }) {
    await Promise.resolve();
    if (signal.aborted) throw signal.reason ?? new Error("Cancelled");
    return { text: ref.id };
  },
  dispose(value) {
    // This plain CPU fixture has no external handle to release.
    void value;
  },
};

export async function readWelcome(host: HostAdapter): Promise<string> {
  const engine = await createEngine({ host });
  const screen = engine.createScope();
  try {
    engine.assets.register(captionType, provider);
    const caption = screen.use(await engine.assets.acquire(welcome, {
      signal: screen.signal,
    }));
    return caption.value.text;
  } finally {
    screen.dispose();
    await engine.dispose();
  }
}
```

Retain a lease when a resource must remain available; do not treat the example's lease as valid after the function exits. After successful acquisition, a later abort of the screen signal only affects still-waiting acquisitions; this example eventually releases the registered lease through `screen.dispose`. Real providers should respond to the signal at their work boundary, while the manager still identifies and cleans up abandoned late results.

## Failures and diagnostics

Closure, missing providers, forged references, type conflicts, cancellation, synchronous load throws or asynchronous rejections, and failed/throwing guards reach the caller through rejected Promises. A failed generation terminates and a later explicit acquisition can retry; there is no implicit retry. Returned values that fail validation are still cleaned up. The manager observes all internal Promise rejections, while callers must still handle their own acquisition Promises.

Validation failures in factories, `register`, and `invalidate` throw synchronously; `acquire` converts entry-point and asynchronous failures into rejected Promises. Resource errors in the current code are listed below; actual execution reports still determine test coverage.

| Error code | Trigger |
| --- | --- |
| `ASSET_TYPE_INVALID` / `ASSET_REF_INVALID` | Invalid names/IDs, a type descriptor not created by the factory, or a forged reference. |
| `ASSET_TYPE_MISMATCH` | An ID already bound within the manager is reused with another type descriptor. |
| `ASSET_PROVIDER_REGISTERED` / `ASSET_PROVIDER_MISSING` / `ASSET_PROVIDER_INVALID` | Duplicate registration, no corresponding provider, or load/dispose is not a function. |
| `ASSET_MANAGER_CLOSED` | The manager or producing Engine has closed its entry points. |
| `ASSET_ACQUIRE_CANCELLED` | The signal cancels a waiting acquisition; its cancellation reason is retained as cause. |
| `ASSET_LOAD_FAILED` | The provider's load throws synchronously or rejects asynchronously, preserving the original cause. |
| `ASSET_VALUE_INVALID` | The guard returns false or throws; a thrown cause is retained, and the returned value is still cleaned up. |
| `ASSET_SIGNAL_FAILED` | Reading signal properties or registering/removing its listener fails. |
| `ASSET_ACQUIRE_FAILED` | Other non-EgretError failures during acquisition/lease creation are wrapped, preserving cause. |
| `ASSET_ID_EXHAUSTED` | An identity increment would exceed the safe-integer range. |
| `ASSET_LEASE_RELEASED` | Reading `value` after release or manager revocation. |
| `ASSET_MANAGER_FACTORY_REQUIRED` / `ASSET_LEASE_FACTORY_REQUIRED` | Bypassing private constructors and internal creation credentials; normal callers obtain the manager from Engine and leases through acquisition. |

`ASSET_NO_DEMAND` is a no-demand cancellation reason on the provider signal, not a postdelivery lease-revocation notification. Foreign-Engine Scope adoption continues to use `ENGINE_MISMATCH`. A throwing provider cleanup produces an `ASSET_CLEANUP_FAILED` diagnostic; signal failures also produce diagnostics, with `phase: "assets"` and the original cause. A cancellation-signal adapter that fails to register/remove a listener must roll back the local wait; a throwing diagnostic observer does not change cleanup progress. Engine collects failures during shutdown. The first failure becomes cause on the final close error, and subsequent failures remain in readonly `cleanupErrors` in order; checking only `cleanupErrors` cannot establish an error-free shutdown.

## Verification status and evidence

| Check | Current status and intended boundary |
| --- | --- |
| Strict build, package exports/dependency boundaries, positive/negative type examples | Passed; 19 negative type assertions produce 19 actual compiler errors, with 78 source/build/declaration files checked for the public entry point, dependency direction, and core without DOM/Node. |
| Current behavior regressions | 73/73 passed: 44 existing core regressions, 14 foundational resource cases, and 15 resource interleaving/correction cases; none failed, canceled, or skipped. |
| Scope and Engine integration | The resource cases above cover late `use`, foreign-Engine rejection, Scope/Stage/assets/host close ordering, and preservation of cleanup exceptions. |
| Core example with a genuinely asynchronous provider | `examples/assets.mjs` obtains a first-party fixture through Node fs.readFile and JSON parsing: 2 loads, 2 cleanup attempts, generations 1→2. The headless example also passes. File I/O and parsing stay in the provider rather than becoming core environment dependencies. |
| Independent contract/code review and required corrections | Bounded review retains pre-fix identity, actual callback counterexamples, and post-fix checks; additional review probes do not join the repository's 73 regression cases. |

The fixed development environment is Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2; current execution is Node headless verification on Windows x64. `node tools/verify.mjs` runs build, package-boundary, type, and behavior checks in order, exiting 0. See [resource core verification evidence](../../evidence/asset-core-verification.json) for actual environments, commands, results, corrections, and hashes. The 73 cases include 44 existing regressions rerun here, leaving 29 added resource behavior cases. Historical evidence for the first slice's 44 cases and 11 negative type assertions retains its original identity. The research model's 25 cases are not added to this execution, and independent review probes do not become counts of additional product capabilities.

Tests preceded resource API implementation: the initial 14 foundational and 12 interleaving cases failed at the prerequisite assertion that the typed asset API did not yet exist. This establishes a real API-absence red state, without claiming every nested behavior branch was separately witnessed failing. Initial implementation verification passed 68/70. Two new tests checked only `cleanupErrors` and omitted the existing primary cause; their predicates were reconciled to `[cause, ...cleanupErrors]`, preserving production error order.

Subsequent self-review found that an application EgretError thrown by a signal getter propagated directly, omitting `ASSET_SIGNAL_FAILED` wrapping and diagnostics. A targeted mechanism regression failed before correction and passed afterward. Independent code review then found that, despite capturing function identity at registration, `load.call`/`dispose.call` still read a later-mutated own call property on the function object, violating the fixed-registration-callback contract. Separate load and dispose mechanism regressions both failed first. After switching to `Reflect.apply` to invoke the captured functions while retaining the original provider receiver, both passed and the complete suite reached 73/73. Pre-fix review hashes and post-fix code hashes remain separate; earlier passing reports are not rewritten to include this correction.

GPU renderers, real browsers/mini-games/mobile devices, Native, font shaping or text rendering, production network providers, image/font/model decoders, performance/package-size/memory/power benchmarks, and complete legacy-project migration acceptance have not been executed. A passing CPU contract advances only partial core implementation, without changing complete product acceptance or the obligations for continued editing, target publication, and updates.

## Design inputs and implementation provenance

Codex assists this slice, independently organizing implementation and documentation from the project's first-party API/lifecycle specifications, the new [CPU resource contract](resource-core-contract.md), and first-party behavior fixtures. Earlier [asynchronous resource research](../../evidence/async-resource-probe-results.json) supplies mechanisms and counterexamples concerning independent leases, task identity, and isolation of old results. Its 25 cases are manually scheduled interleavings using string CPU fixtures, not execution evidence for this Promise-based manager. Whole-lifecycle cancellation in the reference chain is treated separately from cancellation of a wait in this acquisition API.

The new core does not copy research probes, competitor source code, or third-party implementations. Research execution modules and upstream licenses retain their attribution in the original records; first-party code and documentation in this slice retain Apache-2.0. Actual dependencies, AI-generated scope, author review, and final file hashes are maintained in the repository-root `source-origin.json` and bounded verification/review records. This declaration describes the slice's actual inputs and workflow; it does not guarantee model training sources, all output provenance, or global originality.

This slice adds no third-party runtime dependencies or tool upgrades; local implementation and verification do not establish remote integration, CI, or a completed release. Implementation, research, historical baselines, public translation, and product acceptance retain distinct traceable identities; conclusions remain bounded by their corresponding versions and evidence.
