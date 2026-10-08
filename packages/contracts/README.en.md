# @egret/contracts

English | [简体中文](README.md)

An experimental type package providing CancellationSignal, Disposable/Releasable, Diagnostic, and HostAdapter contracts. Its input is the Egret lifecycle specification. It has no third-party runtime dependencies, DOM/Node environment globals, or host-initialization side effects. Package `private: true` prevents accidental npm publication.

HostAdapter surface denotes stable object identity; the host owns physical resources. `close()` resolves only after safely returning the surface and completing in-flight host work; if it rejects, Engine retains the exclusive reservation. The injected millisecond-deadline port should support synchronous cancellation. This package provides type contracts; real hosts require separate verification.

From the repository root, use `node tools/verify.mjs` to verify strict compilation, declarations/import boundaries, and positive/negative type samples. See the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for attribution. First-party code and this document use [Apache-2.0](../../LICENSE).
