# Named SpriteSheet verification — SS1

English | [简体中文](../../Cns/docs/命名图集证据.md)

Engineering preview 0.45.0; S098 / V049. This reading records independently accepted source, build, public CPU, strict consumer types, controlled original-operation units, package policy, recording example and a finite opaque Canvas/WebGPU experiment. Current complete publication gates, push hook and 0.45 PR/Main remain PENDING at this curation cutoff. Authoring this reading does not execute the product.

## Capability and ownership

`createSpriteSheet(lease, frames)` adds a frozen named rectangle table over one genuine full-image texture lease. Runtime and Engine roots share the same factory and two erased types, `SpriteSheet` / `SpriteSheetFrameInput`. It adds no dependency, public subpath, Engine method, resource load or animation clock. Exact names include whitespace and `__proto__`; caller changes cannot rewrite published metadata.

`createBitmap(name)` creates a genuine caller-owned Bitmap borrowing that same lease. The sheet neither owns those Bitmaps nor releases the caller lease. Sheet retirement stops new Bitmap creation while immutable names, dimensions and regions remain readable. Existing Bitmaps can continue under their own resource lifetime and the delivered `Engine.createSequencePlayback`. Ordinary metadata access after retirement grants no renewed rendering entitlement.

Read the [contract](spritesheet-contract.md) for complete staging, limits, lifecycle/error precedence and the bounded original-Bitmap prototype qualification. The public example is `examples/spritesheet-headless.mjs`; tool/code paths here are literal references, not new KB external hyperlinks.

## Separate measured lanes

| Lane | Independently accepted saved result | Boundary |
| --- | --- | --- |
| Public CPU | 100/100 tests; 0 failed or skipped | SS01–SS10 are 10 specification families, not this test count |
| Retained resource/Bitmap/sequence CPU | 133/133 tests | Separate run; not added to the public count |
| SpriteSheet types | Positive 0; negative 22; import-negative 14; 36 exact tuples and 6 continuation lines | Strict installed TypeScript 7.0.2; no ignored or suppressed diagnostics |
| Retained Sequence types | Negative 27; import-negative 13; 40 exact tuples | Separate retained lane; integrated strict driver completed with exit 0 |
| Original-operation units | 10/10 cases | Each case has baseline, one assigned mutation and restored baseline in 3 fresh child processes; not 30 Node tests |
| SpriteSheet policy | 5/5 tests, including 4 assigned controls | Private port, type-as-value, host backedge and ambient-dependency refusals |
| Retained generic policy | 272/272 tests | Separate complete retained suite |
| Recording example | 8 observations, 6 explicit ticks, 1 load and 1 disposal | CPU port records composition; it does not draw browser pixels |
| Native opaque subset | 18 submissions: 16 captures + 2 replays; 576 pixels / 2304 channels, tolerance 0 | One fixed desktop Canvas/WebGPU fixture; bounded actual cleanup independently accepted |

The current build identity records 160 SDK source files, 320 JavaScript/declaration files, 20 configuration files, 7 installed compiler/Node owners and 4 clone-owned workspace aliases. These are identity inventories, not additional tests or installation claims. The nine prerequisite roles and current seven-tool identities match the accepted actual browser release; recorded before/after identity snapshots remain equal.

The authored 6×2 image contains 48 RGBA channels, including a transparent tail. Two same-lease Bitmaps combine an animated actor at (1,1) with a static icon at (4,1). Native source specifies independent full 128-channel masks, six real clock ticks, eight captures and one saved-frame replay per backend. The accepted run independently compared every byte of all 18 original readbacks against those complete literal masks, including the transparent exterior and tail.

## Preserved failures and corrections

The original build receipt is an ARRAY2: the build succeeded, the first CPU run failed on a test's function-record setup, and the declared third actor has no saved receipt. Later corrected public CPU and retained runs passed separately. The original inventory retains its PENDING independent-review label; its saved bytes are qualified by a separate accepted actual review, not by rewriting that label.

The first integrated type run passed the standalone SpriteSheet stage but failed in the retained Sequence stage before reaching the appended SpriteSheet stage. One measured TS2740 message changed for SEQP-N16 in the current public namespace graph; file, line 89, column 40, code 2740 and all other tuples remained unchanged. Its exact successor table passed the retained and integrated gates. This was a measured diagnostic-table update, not a runtime fix or proof of a compiler-internal cause.

The native R1 source review refused two schema bindings: the plan records its accepted conclusion in `status`, and product pin rows belong to `/reviewedPins`. The finite R2 adapter names only that exact plan schema; all other review verdict rules remain. The native admission producer separately repaired reuse of four already-admitted TypeScript physical owners. These source corrections did not launch a browser.

## Actual opaque browser experiment

A saved normal-host actor completed on 2026-10-13 at 04:13:02.2072968–04:13:06.6220315 UTC, exit 0 without timeout. Reported environment was default headless Edge 155.0.4283.45 (msedge, no added flags or browser-environment overrides), Playwright/playwright-core 1.62.1, Node v24.19.0 and Windows win32 x64 release 10.0.26300. These are runtime observations, not physical GPU or performance measurements.

Each backend drew eight newly captured frames and replayed the original N1 after origin callers/resources retired, using a distinct replay host and a distinct application-owned WebGPU device. N1 was idle; once playback reached green, blue and completion; the same Bitmap then admitted loop playback, held red during pause, resumed without an implicit tick and reached the loop boundary. Six public ticks per backend were recorded; capturing, rendering and replay did not advance playback.

Origin/replay hosts returned safely with pending native/startup accounting zero before acquired application devices were destroyed. Both device-loss promises settled with reason destroyed; browser, server and contexts closed without quarantine or cleanup errors. The recorded Windows-owned Job was assigned before ACK, reached active-zero and closed, with complete raw streams and no fallback. This qualifies that finite owned run, not arbitrary OS process retirement, physical hardware capability or memory reclamation.

The final evidence binds 708 before/after identities, 103 original/served module identities and 328 admitted loopback GET requests. The single classified Canvas readback advisory is not performance evidence. Earlier source/admission PENDING cutoffs and R1 source refusals remain separate historical records.

## Previous actual delivery

Sequence playback 0.44.0 was delivered through [PR #31](https://github.com/cnedwin/Egret_rebuild/pull/31). Main `1dce76a62cd0a4180969949939041f889eb1d923` and tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26` were independently read back. Its mandatory hook passed 63 publication, 2794 core and 160 experimental tests as separate suites; KB issues were 0. Remote status/check-run counts were 0/0, which do not establish remote CI PASS. Earlier 0.44 PENDING blocks remain historical and are not replaced by this successor.

## Origin and remaining work

The named-table implementation, tests, tooling and tiny atlas are original Egret first-party work under Apache-2.0, with AI-assisted authorship and bounded independent review. Existing dependency sources/licenses remain separately recorded; no new upstream asset or runtime is bundled by SS1.

Full Spine R020/V020 and legacy migration R008/V006 remain OPEN. SS1 does not establish complete UI/EUI, packed/rotated/trimmed atlas import, phone/native SDK, physical GPU identity, general OS process retirement, memory zeroization/GC or comparative performance and energy acceptance. The accepted opaque browser subset remains separate from final publication and broader product acceptance. See the [shared verification](../../evidence/spritesheet-verification.json).
