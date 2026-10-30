# Responsive interactive examples

English | [简体中文](../../Cns/docs/mobile-examples.md)

## Entry and scope

Run `pnpm example:browser` after the pinned Node 26.7.0 / pnpm 11.25.0 setup. The printed local URL and `/` open `/examples/mobile/index.html`. Select actors, independent pointer regions, UI rows or multilingual paragraphs. UI/paragraph demos explicitly choose WebGL2 or WebGPU; actor/pointer demos use Canvas. The server remains loopback-only with a finite file allowlist. A physical phone needs a separately configured forwarding connection; this change does not expose a LAN server.

This entry composes existing public SDKs. It adds no Engine API, input protocol, renderer or package dependency. The actor page reuses the existing resource-scene session, PNG leases, font identities and sequence playback; panels reuse owned UiRoot, text/paragraph caches and host lifetimes. Sequence controls already use native HTML click controls and remain available through their existing fixed entry and generated-content instructions.

## Layout and density

The shell measures the available content width, up to 960 CSS pixels. UI and paragraph pages use a single column below 700 logical pixels and two columns above that threshold. Paragraph metrics determine article/list placement and row heights. Controls wrap, retain visible keyboard focus and provide native buttons alongside canvas interaction. Only the canvas disables touch scrolling; the rest of the page can scroll.

Panel/pointer logical coordinates equal CSS coordinates. The small actor scene keeps its 192×128 world and 3:2 aspect ratio; its input adapter maps CSS to that world once. Effective density is clamped to [1,2]. Panel/pointer Host ratio equals density; actor Host ratio equals CSS width / 192 × density. Backing dimensions therefore follow CSS size × effective density (rounded up), rather than multiplying input coordinates by DPR. No CSS transform or zoom is used.

Host ratio and input logical dimensions are construction-time options. A content-width or DPR change serially snapshots application state, cancels old contacts, closes the old owner, and mounts the new viewport. Stale initialization closes before any replacement starts. Actor selection, committed outfits and pause state survive; animation time restarts. Panels preserve selection, scrolling and chosen type size. Pointer contacts never survive a rebuild; suspended state can survive. This simple preview lifecycle is not an Engine hot-resize API.

## Input and ownership

Canvas demos use one BrowserPointerInput bridge. Mouse, touch and pen retain their own sessions. Actor tap selection requires a completed, unprevented route, at most 12 CSS pixels of movement and a matching fresh final hit. List selection checks two-dimensional movement, current row binding and a fresh hit; drag/recycling/cancellation cannot reuse an old row as a tap. Drag scrolling is example policy; buttons and the native range control provide an alternate path. Multi-pointer regions demonstrate independent capture and outside release. Resize, scroll, loss of focus, cancellation and close terminate held sessions under the existing adapter contract.

The legacy MouseInput API and all existing fixed example HTML/modules, input schedules, source seals, dimensions, pixel references and collectors are preserved. Use the explicit fixed-entry link for qualification; do not use the responsive page with an old pixel collector. Existing fixed resource-scene mouse activation remains unchanged. UI text preparation uses a bounded application queue within the existing four-job cache budget.

## Verification and limits

Focused Node checks cover geometry/density policy, owner replacement, initialization races, cancellation, cleanup-on-failure and server access. The browser command uses an external Playwright 1.62.1 installation and an empty output destination outside the repository:

```text
node --test tests/mobile-examples.test.mjs tests/publication/m0-foundations.test.mjs
node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>
node examples/mobile/verify-device.mjs <new-output-directory> [--adb <adb-prefix>] [--port 9222]
```

The finite matrix runs actual default-headless Microsoft Edge: four desktop mouse contexts at DPR 1, four touch-enabled mobile viewport contexts at DPR 3 (effective 2), plus UI/paragraph WebGPU mobile contexts. It checks input, reflow, portrait/landscape and small widths, live DPR changes, ownership cleanup, served source identities and actual GPU readback for the panels. Screenshots and raw results are separate from the fixed collectors. Desktop touch emulation does not establish Android/iPhone hardware behavior, human IME, sustained thermal/power, GPU timing, independent glyph correctness or M4 acceptance. Those requirements remain open. Source identity and CI do not substitute for those results.

The device command uses only Node built-ins. It requires exactly one device visible to `adb` and the host port reversed into it, drives the four scenes over the existing DevTools endpoint, and records ready state, bounded effective density, backing dimensions, canvas touch policy, a routed synthetic touch per scene, logical-focus transfer and focus movement from keys on the Two contacts page, cancellation of two held contacts, a failed session when a texture is blocked and its recovery, and a rebuilt session on rotation and on a density change with the selection preserved. It restores every Android setting it changes before exit and writes `summary.json` plus one record per scene. Synthetic DevTools key samples are unreliable on Android — the channel sometimes rejects them as invalid and sometimes delivers them late — so key focus and activation are recorded rather than asserted, and a physical keyboard remains required for key acceptance. A panel scene also needs a real navigation before synthetic touch is admitted, which the command performs. This is a reproducible physical-device observation, not a hardware qualification: native IME, pen input, palm rejection, thermal and power behavior, sustained runs and iOS remain open.

## Sources

The new shell and application glue are independently authored first-party examples under Apache-2.0. They use existing Egret public entries and example-local resource composition. Existing Ahem, Noto fonts, CanvasKit/Skia distribution and their notices remain under their recorded licenses; no new third-party source or binary is introduced. See the [paragraph SDK](readonly-paragraph-sdk.md), [multi-pointer contract](multi-pointer-input.md) and [UI contract](ui-data-panel.md).

The live-density browser case changes DPR together with a one-CSS-pixel viewport resize. A debug-protocol-only DPR override can change the DPR readout without emitting resize or resolution-media events; that unnotified override is not claimed as event-driven detection. The preview also rechecks on visibility restoration and does not poll continuously.

Recorded local verification on 2026-10-30 used Node 26.7.0, Playwright 1.62.1 and Microsoft Edge 156.0.4314.50 with default headless settings. All 485 checks passed across ten distinct contexts; 188 actually served source identities remained exact. The 45 focused Node/source/fixture checks passed. Ten supplementary actor-state checks passed for committed outfit/pause restoration, rapid resizing and font cleanup. Screenshot capture uses the stable viewport instead of a full-page viewport expansion; polling predicates are synchronous. These are bounded desktop results, not physical-device or performance qualification.
