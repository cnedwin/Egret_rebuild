# Readonly paragraph SDK

English | [简体中文](../../Cns/docs/readonly-paragraph-sdk.md)

The optional readonly paragraph profile wraps text to a logical width and exposes the actual layout height to ordinary UI leaves and virtual rows. The same prepared result supplies the displayed image and line metrics. It uses the existing Engine, Scope, AssetManager and texture leases; full M3.2 remains OPEN.

## Alignment, line caps and provider capabilities

The optional request fields are `textAlign` and `maxLines`; a clamped result adds `truncated`. Capability admission is explicit, CRLF/CR retain authored UTF-16 coordinates, and a required marker that cannot fit is refused before publication. See the [complete layout contract](paragraph-layout-controls.md).

## Public entries and ownership

| Entry | Public surface |
| --- | --- |
| `@egret/engine/paragraph` | `createParagraphCache(assets, options)`, `createParagraph(engine, scope, cache)` and paragraph types |
| `@egret/engine/web/paragraph` | `createCanvasKitParagraphProvider(options)` and its host/module/font types |
| `@egret/engine/ui` | Existing `createUiRoot`, plus `UiLeafContent` and `UiLeafPrepareContext` |

The default Engine entry does not load a paragraph provider, Wasm or fonts. The runtime paragraph code is DOM/Node-free. The web adapter accepts an already initialized CanvasKit module and explicit font bytes; it performs no module loading, network access or system-font discovery.

A genuine Engine admits only its own Scope and registered cache. One fixed explicit-line cache and one fixed paragraph cache may coexist on the same authentic `engine.assets`; each profile has one lifetime per manager. Creating another AssetManager does not grant access to an Engine. Display parentage does not transfer resource ownership.

The application owns the provider and its backend module. The provider snapshots registered font bytes and derives an identity from the declared build/module and font identities. Caller-declared hashes are not independently verified by this synchronous adapter. Keep the provider's fonts immutable; a different registered font set requires a new provider and a new Engine/AssetManager lifetime for its paragraph cache. The cache borrows the provider and does not dispose it. After application-owned preparation work and cache/display borrowers have retired, the host explicitly disposes the provider. Engine shutdown owns Scope and AssetManager cleanup; native module/realm lifetime remains with the host.

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

The first profile has one size, color, language and base direction per paragraph, an explicit registered fallback-family order, automatic wrapping and an optional minimum `lineHeight`. Natural font ascent/descent and leading may produce a taller line than the requested minimum. Missing requested families and unresolved glyphs are refused.

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

**Final-line L1/L2 is integrated with finite native/browser qualification.** See the [shared line contract and results](paragraph-line-bidi.md). Full M3.2, independent glyph/ink references, public glyph-cluster/selection/caret mapping, editing/IME, phone/browser coverage, performance, live/physical-memory acceptance and OOM recovery remain OPEN. Attributed spans, custom ellipsis markers or vertical alignment, emoji/ZWJ, Indic and variable-font/font-collection coverage are not advertised by this first profile. Historical [private bidi results](paragraph-bidi-comparison.md) retain their original evidence scope; adoption of this bounded optional SDK does not rewrite them.
