# Reliable Cross Boundary Events In Memory Research

English | [简体中文](README.md)

Second-round local contract research using the [technical white paper](../../docs/技术白皮书.en.md) and [first-round audit](../../docs/第一轮审计.en.md). Gameplay TS remains authoritative. No production engine, real audio execution, network, IPC, or WASM bridge is implemented. Tests consume actual in-memory events/effect arrays rather than assert mock calls.

## Contract and scope

- Graphics `epoch` manages reconstructible visual mirrors only and cannot modify event outbox/consumer watermarks.
- `producerSession + streamId + sequence` creates stable `eventID`. `consumerSession` binds a living consumer session. Reject mismatched producer/stream/consumer events/ACK. Identifiers exclude delimiters; protocol version 1.
- New events enter bounded outbox before sending; sends retain them. Cumulative ACK removes entries only after validating current identity, continuous consumed watermark, and handed-to-transport sequences. Duplicate/older valid ACK cannot remove newer entries.
- Consumers accept only the next watermark item. Gaps execute no effects, buffer no reordered items, and return no jumping ACK; retransmission must fill gaps. Resent consumed items return current-watermark ACK only.
- Insufficient capacity returns`null`: no new acceptance, accepted-entry deletion, or sequence consumption. Callers handle refusal/retry. Invalid configuration/effects throw before enqueue.
- Transport receives separate copies; edits cannot alter accepted records. `pending()` hands items to transport and marks sent. Loss/ACK loss is created by discarding actual copies/replies, without a real network.

Within one instance, effects are synchronous array appends committed with the watermark in one synchronous execution. The prototype supports **ordered, one-time in-memory consumption under fair retries**, without durable atomic effects or crash recovery/cross-process exactly-once. The reset counterexample produces a second effect for the same eventID in a new instance, proving this limit without an operating-system process crash.

## Falsifiable results and retained chain

1. [Initial red](../../evidence/reliable-event-probe-red-results.json):11 cases,1 pass/10 failures. Minimal wrong model deletes on send, consumes out of order, resets events with snapshots, and lacks ACK identity checks. Its only pass is the old-graphics-snapshot counterexample: drop an epoch 1 packet carrying`sound-A`, switch to epoch 2 snapshot, reject old retransmission, leaving effects empty.
2. [Input-counterexample red](../../evidence/reliable-event-probe-red-input-results.json):12 cases,1 pass/11 failures after invalid-producer input added. Both red reports retain full model/run source and SHA256 without later overwrite.
3. [Current results](../../evidence/reliable-event-probe-results.json):13 cases,13 passes/0 failures. First 12 are red/green cases;11 turn green while the old missed-event negative control passes throughout. Case 13 characterizes duplicate effects after reset without claiming repair. Counts cover only listed cases.
4. [Source reproduction/targeted mutations](../../evidence/reliable-event-probe-verification-results.json):nine passes/zero failures. Retained red source reproduces 1/10 and 1/11; source hashes/states/counts of three reports match. Six temporary wrong models—duplicate effects, gap consumption, delete-on-send, ignored capacity, graphics recovery clearing events, bad ACK identity—are each caught by actual consumption tests. This is author self-check, not independent audit/full mutation coverage. Verification script/source hash is embedded.

`breakCaught` under test names identifies the faulty change targeted. Expected sequences are handwritten literals. Current runner executes every prototype case: event/ACK loss, deduplication, out-of-order gaps, graphics recovery, backpressure, stale ACK, unsent/future ACK, invalid events/ACK, transport-copy isolation, old cumulative ACK.

## Local rerun

Run in this directory without installation:

```powershell
node 'run.mjs'
```

Default overwrites current JSON; failure exits 1. `--output=<文件路径>` saves separately; `--preserve-sources` embeds current source. Time is actual UTC execution; environment records actual Node/runtime/platform/architecture. `sourceHashes` covers model/run using actual UTF-8 SHA256. Red `sourceSnapshots` restore rerunnable originals for digest checks. Public candidates normalize historical absolute local metadata to filenames; originals remain private, with embedded source/digests unchanged.

## Uncovered scope

No durable outbox/watermark/effect transactions: producer crashes can lose events, consumer crashes can repeat effects. No consumer-session rebinding, permanent failure/dead letters, total ordering across streams, multiple consumers, external-effect exceptions, timed retry scheduling, sequence exhaustion, byte-memory limits, sustained stress/throughput, binary parsing, real graphics-epoch rebuilding, or security authentication. ACK identity prevents structurally stale/wrong-stream confirmations, not malicious same-identity forgery. Effect-audit arrays grow with cases. Bounds apply only to unacknowledged outbox entries/sent set, not total memory. Permanent loss, absent consumers, and sustained backpressure are not automatically overcome.
