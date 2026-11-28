# Readonly paragraph SDK

English | [简体中文](../../Cns/docs/readonly-paragraph-sdk.md)

The optional readonly paragraph profile wraps text to a logical width and exposes the actual layout height to ordinary UI leaves and virtual rows. The same prepared result supplies the displayed image and line metrics. It uses the existing Engine, Scope, AssetManager and texture leases; full M3.2 remains OPEN.

## Alignment, line caps and provider capabilities

The optional request fields are `textAlign` and `maxLines`; a clamped result adds `truncated`. Capability admission is explicit, CRLF/CR retain authored UTF-16 coordinates, and a required marker that cannot fit is refused before publication. See the [complete layout contract](paragraph-layout-controls.md).

## Public entries and ownership

| Entry | Public surface |
| --- | --- |
| `@egret/engine/paragraph` | `createParagraphCache(assets, options)`, `createParagraph(engine, scope, cache)` and paragraph types |
| `@egret/engine/web/paragraph` | `createCanvasKitParagraphProvider(options)` and its host/module/font types; `createCanvasParagraphProvider(options)`, which needs no WebAssembly; `chooseParagraphProvider(options)` |
| `@egret/engine/ui` | Existing `createUiRoot`, plus `UiLeafContent` and `UiLeafPrepareContext` |

The default Engine entry does not load a paragraph provider, Wasm or fonts. The runtime paragraph code is DOM/Node-free. The web adapter accepts an already initialized CanvasKit module and explicit font bytes; it performs no module loading, network access or system-font discovery.

A genuine Engine admits only its own Scope and registered cache. One fixed explicit-line cache and one fixed paragraph cache may coexist on the same authentic `engine.assets`; each profile has one lifetime per manager.

**One paragraph cache per asset manager.** Make it once for an Engine and pass the same cache to every paragraph, UI leaf and text editor. A second `createParagraphCache` on the same `engine.assets` is refused with `PARAGRAPH_CACHE_ALREADY_CREATED`, whose message says so. The text cache of labels follows the same rule (`TEXT_CACHE_ALREADY_CREATED`); a browser game makes that one for its labels. Creating another AssetManager does not grant access to an Engine. Display parentage does not transfer resource ownership.

The application owns the provider and its backend module. The provider snapshots registered font bytes and derives an identity from the declared build/module and font identities. Caller-declared hashes are not independently verified by this synchronous adapter. Keep the provider's fonts immutable; a different registered font set requires a new provider and a new Engine/AssetManager lifetime for its paragraph cache. The cache borrows the provider and does not dispose it. After application-owned preparation work and cache/display borrowers have retired, the host explicitly disposes the provider. Engine shutdown owns Scope and AssetManager cleanup; native module/realm lifetime remains with the host.

## Color fonts in CanvasKit paragraphs

For standalone TTF and OTF files, the fixed provider and the manifest-backed font-set provider reject an OpenType `SVG ` table or a `COLR` table newer than version 0 with `PARAGRAPH_FONT_COLOR_UNSUPPORTED`. Check this error when loading optional fonts and keep using the previous font set if a replacement fails. In the bundled renderer an SVG test glyph silently drew the outline in the text color, while its COLRv0 counterpart drew the green palette color. This check leaves bitmap tables and outline fonts on the existing decoder path.

The direct byte API also checks the first face it opens from a TrueType Collection and the visible table directory of WOFF1. It can identify an SVG table in WOFF1 and read an uncompressed COLR version. Compressed WOFF1 COLR data, WOFF2, and other opaque wrappers retain the host decoder's behavior. Supply standalone TTF or OTF when the application requires this admission check. The font asset importer remains usable by other renderers. [OpenType color layers](https://learn.microsoft.com/en-us/typography/opentype/spec/colr) · [OpenType SVG glyphs](https://learn.microsoft.com/en-us/typography/opentype/spec/svg)

## Prepare and display a paragraph

The application first initializes `hostCanvasKit` and loads `fonts`, whose entries contain `{ family, data: Uint8Array, identity }`. The runnable [paragraph panel](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.md) verifies font bytes and supplies the bundled build identity.

```js
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { createCanvasKitParagraphProvider } from '@egret/engine/web/paragraph';

// engine, hostCanvasKit, buildIdentity and fonts are application-owned inputs.
const provider = createCanvasKitParagraphProvider({
  canvasKit: hostCanvasKit, buildIdentity, fonts,
});
const cache = createParagraphCache(engine.assets, { provider });
const scope = engine.createScope();
const paragraph = createParagraph(engine, scope, cache);
const request = {
  text: 'Text wraps to the available width. 段落按宽度换行。',
  width: 320,
  fontFamilies: fonts.map(font => font.family),
  fontSize: 20, locale: 'en', direction: 'ltr',
  fillColor: 0xffffff, density: 1,
};
paragraph.setRequest(request);
const metrics = await paragraph.prepare();
engine.stage.addChild(paragraph);
// metrics.width, metrics.height and metrics.lines describe this committed result.
```

The compatible no-runs request has one size, color, language and base direction per paragraph, an explicit registered fallback-family order, automatic wrapping and an optional minimum `lineHeight`. Natural font ascent/descent and leading may produce a taller line than the requested minimum. Missing requested families and unresolved glyphs are refused.

`setRequest` snapshots the request. `prepare()` returns immutable `{ width, height, lines }`; each line has UTF-16 `start/end`, `baseline`, `ascent`, `descent`, `height` and `width`. `getStatus()` separates desired/committed revisions and pending state. An unchanged request/generation reuses the committed result. A failed or superseded replacement keeps the preceding committed image and metrics. Scope disposal cancels pending demand and retires the display's lease; late results cannot restore a closed node.

`cache.acquire(request, { signal })` is also available for callers that directly own a prepared texture lease. Release that lease when its display retires. `invalidate()` retires cache generations while keeping already borrowed images valid; it does not replace every visible paragraph. Call `prepare()` for standalone nodes, or invalidate/revise the affected UI content. `getStatus()` reports logical image bytes, entries, jobs and caller demand. These counters do not measure native heap or physical memory.

## Width-aware UI content

An ordinary leaf may supply `content` or a synchronous `measure` callback. The two are mutually exclusive. A content source has a nonnegative safe-integer `revision` and `prepare({ scope, width, density, signal })`, returning `{ content: DisplayObjectContainer, measuredHeight }` synchronously or asynchronously.

```js
import { createUiRoot } from '@egret/engine/ui';

const textContent = {
  revision: 1,
  async prepare(context) {
    const node = createParagraph(engine, context.scope, cache);
    node.setRequest({ ...request, width: context.width, density: context.density });
    const metrics = await node.prepare();
    return { content: node, measuredHeight: metrics.height };
  },
};
const ui = createUiRoot({
  engine, scope: engine.createScope(), id: 'article',
  viewport: { width: 360, height: 600 }, density: 1,
  tree: {
    id: 'column', kind: 'column', explicitWidth: 360,
    crossAlign: 'stretch', gap: 12,
    children: [
      { id: 'body', kind: 'leaf', content: textContent },
      { id: 'footer', kind: 'leaf', explicitHeight: 8, fill: { color: 0x44ccaa } },
    ],
  },
});
ui.commit(await ui.prepare());
```

`context.width` is the resolved inner width after padding and constraints. Pass that width to the paragraph and return `metrics.height`; leave the leaf height unspecified when text should determine it. Existing explicit/minimum/maximum layout constraints still apply. UI preparation waits for the required detached content, then publishes content, sibling geometry and the hit tree in one revision. Failure, supersession or close disposes new staging Scopes and preserves the preceding committed presentation until an accepted replacement. Reusing a content source at the same revision, width and density performs no new content preparation; `invalidate(id, 'measure')` forces preparation. Submit changed source revisions through `setTree`; changing a closed-over value alone does not invalidate layout.

Existing virtual rows use the same width/Scope/density contract through `bind`:

```js
async function bind(context) {
  const node = createParagraph(engine, context.scope, cache);
  node.setRequest({ ...request, text: context.value.text,
    width: context.width, density: context.density });
  const metrics = await node.prepare();
  return { content: node, measuredHeight: metrics.height };
}
```

Keep stable record keys, increase `contentVersion` when record content changes and increase the data-source revision. The existing height journal commits measured heights with row content, hit geometry and the preserved top-key scroll anchor. A list preparation can return `pending` while measured heights expand its finite visible window; follow the existing [UI panel preparation contract](ui-data-panel.md).

Logical layout height includes the actual line metrics and empty lines. The raster may extend beyond that box for signed ink bearings and a two-pixel antialias guard on each edge. Density scales pixels, not logical line geometry. Do not use texture pixel height as a row height, or derive hit regions from painted pixels.

## Admitted limits

| Input or resource | Current bound |
| --- | --- |
| Source | Well-formed UTF-16, at most 8,192 code units |
| Logical width / font size | Width 0.25–4,096; font size 1–512 |
| Optional minimum line height / density | Line height 1–1,024; density 0.25–4 |
| Families / locale | 1–16 requested/registered families; family names at most 256 code units; locale at most 64 |
| Provider font/build identities | Each at most 512 code units; combined provider identity at most 8,192 |
| Registered original font bytes | At most 32 MiB per CanvasKit provider |
| Raster | At most 4,096 pixels per edge and 1,048,576 total pixels |
| Paragraph cache entries / simultaneous provider jobs | Defaults 32/32; configurable 1–32 each |
| Logical cached/live image bytes | Default 16 MiB; configurable 4 bytes–64 MiB |
| Caller leases plus pending caller demand | At most 256 combined |

Limits reject work; they do not silently truncate text, choose system fonts or lower density. Live borrowed images remain charged until retired and may prevent eviction. Image-byte limits cover owned image charges, not all CPU/Wasm scratch, provider fonts, pending native allocations or physical memory. An empty/inkless cached result uses a bounded transparent image resource.

## Optional assets, observations and remaining scope

The example's optional runtime is **8,696,388 raw bytes**; its three original fonts total **17,148,712 bytes**, for **25,845,100 bytes** combined. `source/icudtl.dat` is a rebuild input already embedded in Wasm and is not loaded separately by the browser. Default SDK imports do not load these assets. Raw sizes do not establish compressed transfer, startup, live memory or performance. Exact versions, hashes, patches, source-rebuild limits and retained third-party/font notices are in the [vendor description](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/README.md) and [manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json).

The original SDK desktop run used Edge 156.0.4314.50 with default headless settings and Playwright 1.62.1. WebGL2 and WebGPU each passed 13 behavior checks: wrapping and subsequent geometry, font/minimum line height, density-independent logical layout, static reuse, failed/pending/completed replacement, cancellation with late provider settlement, scrolling/hits and close-time image/lease retirement. All 161 actually requested dependency paths, including the pinned virtual robust-predicates alias, retained their observed identities during capture. The focused SDK/UI/T1 regression run passed 118 tests. See [recorded results and screenshots](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sdk/verification.json); these are finite functional observations, not timing or independent glyph/ink acceptance.

Run `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>` after building, using installed Playwright 1.62.1 and Edge. The collector runs one integrated behavior sequence on each backend and requires a new output directory. The delayed browser case holds the provider before native work and proves late settlement cannot overwrite the committed revision; it does not prove native Wasm preemption. Backend hashes are not asserted equal at density two. Original failed observations are retained and described in the result scope. Protected CI and PR/Main delivery remain separate publication evidence.

**Final-line L1/L2 is integrated with finite native/browser qualification.** See the [shared line contract and results](paragraph-line-bidi.md). Full M3.2, independent glyph/ink references, complete glyph-cluster mapping, editing/IME, phone/browser coverage, performance, live/physical-memory acceptance and OOM recovery remain OPEN. Bounded [styled runs](paragraph-styled-runs.md) and [grapheme selection/caret geometry](paragraph-text-geometry.md) have separate contracts. Custom ellipsis markers or vertical alignment, emoji/ZWJ, Indic and variable-font/font-collection coverage are not advertised by this first profile. Historical [private bidi results](paragraph-bidi-comparison.md) retain their original evidence scope; adoption of this bounded optional SDK does not rewrite them.

## Styled readonly runs

The optional [styled-run contract](paragraph-styled-runs.md) adds bounded font-family, size and foreground ranges through the same provider, cache and UI ownership. The original one-style profile above remains the compatibility baseline; the linked increment records current admission, cluster paint and synthetic-content limits.

## A provider without WebAssembly

`createCanvasParagraphProvider(options)` lays out and draws with a canvas's 2D context. It needs no WebAssembly and no font bytes: it uses the fonts the page has registered with `FontFace`, or the mini game with `wx.loadFont`, named by family. It takes the same requests and gives the same metrics and geometry as the CanvasKit provider, with the capabilities `styledRuns`, `textAlign`, `textGeometry` and `maxLines`.

- `families` lists the families a request may name. A request naming another is refused with `PARAGRAPH_FONT_NOT_REGISTERED`. Any family is admitted when it is not given.
- `buildIdentity` names the fonts, so that the provider's identity changes when they do.
- `createCanvas` returns a canvas with `getContext('2d')`. By default the provider uses `document.createElement('canvas')`, which a mini game's adapter makes from `wx.createCanvas()`.

It lays text out as CanvasKit does:

- English breaks at spaces and after `-` and `/`. Chinese and Japanese break between characters. A closing mark such as `，` does not start a line, and an opening mark such as `（` does not end one. A word wider than the line is cut between letters.
- A wide character is measured alone, as CanvasKit sets it.
- With `lineHeight`, each line takes that height, its extra room shared above and below the first family's font. Without it, a line is as tall as the tallest font drawn on it.
- A line cap takes characters off the end of the last line until an ellipsis fits after them. The ellipsis is set in the font of the last character kept, and that character's box covers it.

Right-to-left text (`direction: 'rtl'`, or a character of a right-to-left script) is refused with `PARAGRAPH_FEATURE_UNSUPPORTED` rather than drawn in the wrong order.

**Compared with CanvasKit.** `examples/paragraph-canvas/verify.mjs` lays one styled paragraph of Chinese and English out with both providers in headless Chromium, with the same Noto Sans and Noto Sans CJK SC fonts. It does so three times: with a minimum line height, centred at natural line heights, and capped at three lines. On November 26, 2026 each pair had the same lines, character boxes and selections within 0.000 px, and the same offset for a hit at every character. On a phone, a canvas may give `measureText` only a width. The provider then estimates a font's ascent and descent, and line heights may differ from CanvasKit's by a few pixels. No phone has been run.

`chooseParagraphProvider(options)` creates the provider a device can afford and returns `{ backend, reason, provider, cause? }`:

```js
import { chooseParagraphProvider } from '@egret/engine/web/paragraph';

const { provider, backend, reason } = await chooseParagraphProvider({
  // Called only when CanvasKit is chosen.
  loadCanvasKit: async () => ({ canvasKit: await CanvasKitInit({ locateFile }), fonts, buildIdentity }),
  canvas: { families: ['Noto Sans', 'Noto Sans CJK SC'] }
});
const cache = createParagraphCache(engine.assets, { provider });
```

- With no `WebAssembly` global, in a WeChat mini game, or with `navigator.deviceMemory` at or below `lowMemory` (2 by default), it gives the canvas provider. `loadCanvasKit` is not called, so neither the module nor the font bytes are downloaded.
- Otherwise it loads CanvasKit. If loading or starting it fails, it gives the canvas provider, with `reason: 'load-failed'` and the error as `cause`.
- `prefer: 'canvas'` or `prefer: 'canvaskit'` decides instead. CanvasKit asked for by name throws when it fails. `device` states what is known of the device in place of what the global object says.

With the canvas provider, register the fonts before the first paragraph is prepared.

## November 27 device follow-up

November 27 follow-up: physical Windows WebGL2 compared Canvas and CanvasKit using the same fonts; on Fold7 the no-WASM Canvas provider rendered a three-line mixed Chinese/English sample. The font-set editor Node checks passed; actual WeChat font metrics and host input remain open. [Device observations and remaining coverage](november-27-claude-hardware.md).
