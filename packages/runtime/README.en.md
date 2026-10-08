# @egret/runtime

English | [简体中文](README.md)

An experimental logic package depending only on `@egret/contracts`. It receives event descriptors, synchronous cleanup values, and narrow lifecycle ports injected by Engine, and provides cancellation, Scope, display trees, synchronous dispatch, and CPU asset acquisition/leases. This package maintains consistency of Scope ownership, object-to-Engine binding, parent/child relationships, and event state.

EngineContext and createScope/createStage serve engine's internal assembly and are not exported by the public facade. Engine creates Scope and Stage; AssetManager is created by Engine; asset types and references are factory-created and checked at runtime. Shared tasks and independent leases are separate; see the [asset contract](../../knowledge-base/docs/资源核心合同.en.md). Graphics execution and frame scheduling remain unimplemented.

Scope registration handles recursion on the same value, state rechecks after user callbacks, late values during shutdown, and ownership conflicts. Internal mounting and finalization preserve actual tree state without implicitly calling public removeChild overrides; the current contract has no mount/remove notifications. Cleanup failures are recorded individually while remaining listeners and subtrees continue to be processed. Recursive finalization respects the initiating root's owner boundary. Failed signal registration withdraws the subscription and attempts adapter rollback. If a synchronous event handler returns a Promise, it is rejected synchronously and its rejection is observed.

Behavioral tests run through the public built engine entry point. Root verification is `node tools/verify.mjs`; see the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for sources. The package retains `private: true` to prevent accidental npm publication. First-party code and this document use [Apache-2.0](../../LICENSE).
