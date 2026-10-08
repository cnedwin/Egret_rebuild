# @egret/engine

English | [简体中文](README.md)

An experimental public facade depending only on runtime and contracts. Inputs are an explicit HostAdapter, optional positive-integer shutdown deadline, and diagnostic callback; outputs are Engine, its Stage, Scope, and assets service, and a single shutdown Promise. Engine manages logical lifecycle and surface reservations; the host manages physical resources and the fact of safe return.

createEngine reserves the surface before awaiting host.start, and startup failure still enters cleanup. Shutdown handles Scope, Stage, and the CPU asset manager first, then stops the host and waits for close within bounds. Only successful close releases the surface. Timeouts or rejection preserve isolation; late success may release the reservation. The core does not destroy borrowed surfaces/devices; this slice has no forced-release or recovery entry.

Scope or Stage cleanup failures do not stop subsequent steps. EgretError retains the original cause and cleanupErrors collected in order. Root exports contain only implemented slice capabilities; internal assembly interfaces are not exported.

Root verification is `node tools/verify.mjs`; the integrated example is `node examples/headless.mjs` and `node examples/assets.mjs`. See the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for sources. The package retains `private: true` to prevent accidental npm publication. First-party code and this document use [Apache-2.0](../../LICENSE).
