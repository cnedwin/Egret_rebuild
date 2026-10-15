# Browser PNG implementation and verification plan — BIP1

English | [简体中文](../../Cns/docs/浏览器PNG实施计划.md)

## Current 0.46.0 publication cutoff — 2026-10-14

The optional browser PNG adapter has independently accepted source, 4/4 terminal regressions, 95/95 public CPU/cold cases, five strict lanes (0/32/54/0/6 diagnostics), the public type gate, 17/17 new policy cases with 272/272 retained boundary cases, and 39/39 observer UNIT cases. Counts describe separate scopes and are not added together. Native collector R2 source, adoption/syntax and input preparation are accepted. Independent saved-result review accepted the bounded default-browser Canvas/WebGPU PNG subset as PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY, with 6 submissions / 192 pixels / 768 channels at tolerance 0. At that dated cutoff, complete repository/prepush gates, this increment's push/PR/Main and remote CI acceptance were PENDING.

The sections retained below record the earlier 2026-10-13 source/documentation cutoff. Their NOT_RUN statements retain that historical scope; the dated successor in this section takes precedence for that historical status, while the behavior and frozen numeric schedule remain unchanged.

Earlier public-documentation checkpoint: 2026-10-13. Source, public CPU/cold behavior, strict consumers, the public type gate and owned-copy policy controls have independently accepted evidence. The operation observer has accepted controlled UNIT evidence. At that earlier checkpoint, native collector source work was in progress; native browser execution, full repository gates and this increment's delivery were NOT_RUN. The [contract](browser-png-contract.md) defines behavior; the [evidence](browser-png-evidence.md) records the current acceptance cutoff and preserved failures.

## Architecture and developer route

The adapter joins caller-supplied PNG bytes to existing engine resources:

`application reader → owned encoded copy → structural/profile admission → browser ImageBitmap → transient Canvas → owned ImageData2D → Texture → engine.assets lease → SpriteSheet/Bitmap/sequence → captured frame`

`packages/engine/web/image.ts` is the optional facade. `packages/engine/web/BrowserTextureProvider.ts` implements the adapter; `packages/engine/package.json` supplies the exact `./web/image` types/import mapping. Existing contracts/runtime identities, resource ownership, clock, render commands and package dependencies remain authoritative. The adapter adds no runtime dependency or second asset cache. The existing web build owns DOM types; default core entries remain DOM/Node-free.

Use `createBrowserTextureProvider({ readBytes })` from `@egret/engine/web/image`, register it for a genuine texture asset type, then acquire the original ref through `engine.assets`. Retain the returned lease in the Engine's Scope. Pass that same lease to existing SpriteSheet/Bitmap APIs. Application code owns byte retrieval and any networking policy; the provider owns an exact private copy before browser callbacks begin. It does not implement URL downloading or retry scheduling.

The existing manager owns delivered Texture demand and disposal. The application separately owns `provider.close()`: close Engine/manager demand, then await the provider. Scope's synchronous disposal cannot substitute for this Promise. Provider close preserves already delivered values; unresolved original source/decode work keeps provider close pending. See the [resource contract](resource-core-contract.md), [SpriteSheet contract](spritesheet-contract.md) and [sequence playback contract](sequence-playback-contract.md).

## Work packages and current status

| Work | Result or remaining acceptance |
| --- | --- |
| Public API and adapter | Independently reviewed source; one optional value and four erased interfaces. Public CPU/cold tests and terminal-retirement regression accepted. |
| Strict consumers | Five unsuppressed lanes and exact full diagnostic tuples accepted; standalone public type gate replay accepted. Negative exits are 1, not 2. |
| Package policy | Current repository baseline, 16 separate owned-copy refusal controls and exact inverses accepted; existing core/SpriteSheet/sequence checkers and retained boundary suite accepted within their own scope. |
| Native-operation observer | Source/permission and 39 controlled UNIT tests accepted for six exact operations. Actual browser operations remain unmeasured. |
| Native resource/render route | Frozen [native schedule](browser-png-native-plan.md); collector source/closure review and actual default-browser execution still required. |
| Public delivery | Final bilingual/source-origin curation, critical English comments, complete publication/prepush/hook checks, push, PR and Main evidence still required for this increment. |

These are separate evidence families. Repeated replays and overlapping suites are not added into a single acceptance count. A passing type or policy gate does not establish native decoding or rendered pixels.

## Fixed verification families

| Family | Required behavior |
| --- | --- |
| BIP01 | Exact optional value/types, inert cold import, unchanged default routes and DOM/Node-free roots. |
| BIP02 | Ordered snapshots; intrinsic byte-view admission; shared/detached/resizable refusal; copy before callbacks; meaningful cap endpoints and one-over refusals. |
| BIP03 | Complete framing/profile checks before decode; precise RGB/RGBA8 subset and admitted color metadata; unsupported/malformed inputs never silently stripped. CRC storage is not checksum verification. |
| BIP04 | Original reader receiver/ref/context, four occupied jobs without a queue, cancellation/close precedence, late settlement and retained capacity. |
| BIP05 | Transient ownership, original causes including undefined, every actual close/reset attempt, quarantine and close-specific reason order. |
| BIP06 | Genuine manager sharing, independent leases, old/new invalidate generations, Engine/late-result ownership and provider close preserving delivered values. |
| BIP07 | Same-lease SpriteSheet/Bitmap/clip/clock composition, default native decode/readback, Canvas/WebGPU literal pixels and held-frame lifetime. Native portion pending. |
| BIP08 | Full strict tuples, baseline → one assigned policy mutation → exact inverse → restored baseline, independent source/result review and bilingual/full delivery gates. |

The four-job and per-load byte limits make an independent aggregate one-over input unreachable: the aggregate limit equals four maximum payloads. Test the legal four-payload endpoint and actual job/per-load refusal paths. These limits bound admission accounting, not physical browser/GPU memory or OOM behavior.

## Reproducing focused checks

Use the repository's pinned dependencies and stock build before consumers. The focused public commands are:

```sh
node tools/build.mjs
node --test tests/browser-png-terminal-retirement.test.mjs
node --test tests/browser-png.test.mjs tests/browser-png-lifecycle.test.mjs tests/browser-png-assets.test.mjs tests/browser-png-api.test.mjs
node tools/browser-png-types.mjs
node tools/browser-png-boundary.mjs
node --test tests/browser-png-boundaries.test.mjs
node --test tests/browser-png-native-observer.test.mjs
```

Controlled image ports make callback/error/ownership behavior reproducible. Controlled observer owners are UNIT fixtures. Neither substitutes for native acceptance. The type gate replays complete file/line/column/code/message objects, verifies current stock compiler/native-package/declaration owners before/after compilation, and does not force Windows executable hashes on another OS. Policy mutations start from fresh complete built copies and must reach their assigned refusal before generic fingerprint failure.

The mandatory verifier inserts `browser-png-boundary` after `sequence-playback-boundary` and `browser-png-types` after `check-types`, preserving the previous seven stages and their failure behavior. Full `tools/verify.mjs`, publication and prepush/hook execution remain separate from the focused results recorded here. Follow [repository identity and line endings](repository-identity-and-line-endings.md): authored text uses the shared canonical writer; original evidence bytes and SHA-256 identities remain untouched.

## Native and delivery completion

Native admission binds accepted implementation/emission, CPU/cold/types/policy/observer evidence, original two PNGs, literal oracles, complete public module closure and installed tool owners. Omit image ports, use genuine Engine assets/leases and the frozen sampling/timing schedule. Save original source-image outputs, complete rendered buffers, operation/retirement observations and failures before comparison. Independently review both collector source and saved actual results.

Then finalize the four paired documents and public provenance ledger at the new cutoff, verify critical English comments and bilingual links, run complete repository/publication/prepush checks and the mandatory push hook, and record actual GitHub PR/Main delivery. Native, publication or delivery failure retains its own incomplete boundary and original artifacts.

The implementation is independently developed within Egret. Format references are [PNG 3, 2025-06-24 Recommendation](https://www.w3.org/TR/2025/REC-png-3-20250624/), [HTML ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap) and [Canvas premultiplied-alpha rules](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context), reviewed for this design on 2026-10-13. Browser normalization can lose hidden RGB or translucent precision. Full PNG/color/alpha support, target-device performance, full Spine R020/V020 and one-click migration R008/V006 remain OPEN.
