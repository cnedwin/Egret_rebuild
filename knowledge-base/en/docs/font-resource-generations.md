# Font resources and runtime font sets

English | [简体中文](../../Cns/docs/font-resource-generations.md)

This bounded M2.1/M3.2 increment connects reproducible font artifacts to readonly paragraphs and existing UI transactions. The original fixed-font provider remains available. Font replacement does not recreate the Engine, resource manager, renderer or input system.

## Build and load

The content recipe importer is egret.font 1.0.0, with artifact format egret.font/1 and settings {family, flavor}. Flavor is truetype or opentype; the source is a standalone TTF or OTF face. The artifact preserves the exact source bytes and SHA-256. Existing build keys, provenance, immutable cache generations and ProjectStore adoption remain authoritative. A family is an explicit runtime alias, not a renamed font file.

The producer checks the bounded SFNT directory, required tables and declared flavor. Native decoding owns glyph semantics. This is not a complete untrusted-font sanitizer, variable-axis API, collection/WOFF decoder, font converter or subsetter. Sources must have actual usage and redistribution rights.

One font is at most 32 MiB. Build-wide source/output budgets remain 64/128 MiB. The explicit font-sfnt/1 store and browser transport profile admits larger font blobs; existing default PNG/metadata bounds remain unchanged. The browser source checks exact length and SHA-256 before the DOM-free loader receives bytes. Concurrent encoded transport credit is at most 64 MiB, accounting for two times each admitted file size; this is not a physical-memory guarantee.

createFontContentLoader in @egret/engine/resources uses the existing AssetManager and genuine ManifestGroup/Scope. A catalog contains at most 128 entries. A group contains 1–16 unique fonts and unique aliases, totaling at most 32 MiB. At most eight groups and 64 MiB of logical retained source bytes are admitted. A ready group's getFonts returns immutable descriptors; copyBytes makes an owned copy while the group and its Scope remain live. Scope disposal cancels pending loads and retires the group. The browser convenience createManifestFontContentLoader exposes its loader and source plus asynchronous close.

## Immutable font sets

createCanvasKitFontSetProvider in @egret/engine/web/paragraph is one stable provider for a paragraph cache. load(scope, loader, roots) returns a new immutable ParagraphFontSet after managed font loading and native registration. Its key is a session-local generation identifier, not a persistent content ID. Store manifest/build identities in projects; never serialize this key as a reusable font identity.

~~~ts
const fonts = createManifestFontContentLoader(engine, manifest, {baseUrl});
const provider = createCanvasKitFontSetProvider({canvasKit, buildIdentity});
const cache = createParagraphCache(engine.assets, {provider});
const fontScope = engine.createScope();
const set = await provider.load(fontScope, fonts.loader, fontResourceIds);
paragraph.setRequest({...request, fontFamilies: set.fontFamilies, fontSet: set.key});
await paragraph.prepare();
// Dispose only after no root needs to prepare more content with this set.
set.dispose();
await set.closed;
~~~

The optional request fontSet participates in the existing immutable cache key. Omission retains the old fixed-font request/key shape. Old providers refuse explicit font-set requests before allocation. A generation-aware provider supplies fontSets capability and hasFontSet; liveness is checked before warm-cache demand and before delivering a result. Retired keys are never reused. Already borrowed raster images remain valid ordinary texture leases, so old committed UI can stay visible while replacement loads or fails.

At most eight live/retiring sets and 64 MiB of logical per-set font bytes are admitted. Native typeface wrappers with identical identity and bytes share ownership across active sets within this provider. The last owning fixed provider releases each wrapper; in-flight prepare work delays native retirement. This table does not fetch or independently own resource leases. Engine-side font bytes remain in the existing resource manager. Native internal caches and physical WASM memory are outside these logical counters.

The pinned CanvasKit raw font binding takes ownership of its allocation. The adapter checks allocation before writing bytes and refuses a zero pointer, protecting old state from the convenience wrapper's unchecked write. Legacy injected modules without that raw binding retain their existing convenience path; they do not gain this checked-allocation guarantee. No bundled runtime or font bytes are modified.

## UI publication and retirement

Prepare a detached paragraph using the candidate set, return its measured height through existing UI content, then commit the root. Font readiness alone is not paragraph preparation or visible publication. Text, geometry and measured row/leaf height follow the existing UI transaction. A failed, cancelled or superseded candidate cannot replace committed content.

Each UiRoot is an independent publication domain. Keep a set alive while any root may prepare new rows or content with it, including virtual-list scrolling. A switch is not an atomic transaction across multiple roots, and this contract does not promise GPU rollback. Cancellation uses the candidate's existing Scope. At shutdown, dispose roots/scopes and close the provider and browser source; await their cleanup promises and observe errors.

The existing paragraph-panel example accepts a generated fontConfig query. Its button replaces the article's fonts while the independent list retains its previous selection; later ordinary UI actions can adopt the new set. Repeated replacement releases unused sets. The default example retains its fixed-font mode. Touch and other input implementations are unchanged.

## Validation and limits

Build first, then run node tools/content/author-font-example.mjs and append its printed configPath as fontConfig to the paragraph-panel URL. Run node examples/paragraph-panel/verify-fonts.mjs <playwright-1.62.1-root> <new-output-directory> for actual Edge WebGL2/WebGPU checks. The collector records actual served input identities, output hashes, repeated replacement, failed transport, cancellation, supersession and cleanup. Native unit tests compare real-font layout/raster to the retained fixed provider; that is an integration reference, not an independent font algorithm oracle.

The [verification summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/font-verification-summary.json) retains the earlier native allocation failure and its repair separately from passing results. No phone, IME, accessibility, full script/font corpus, physical-memory or performance acceptance is claimed. M1.2 remains open at 10.3 ms against its 8 ms target. M2.1 and M3.2 retain their other work.

Sources: existing bundled Noto/OFL records and CanvasKit provenance are unchanged. The checked native ownership contract follows the pinned [Skia binding](https://github.com/google/skia/blob/e2def78fa232884d4aedcf3ad92d4a0dd673b898/modules/canvaskit/canvaskit_bindings.cpp#L3020) and [font wrapper](https://github.com/google/skia/blob/e2def78fa232884d4aedcf3ad92d4a0dd673b898/modules/canvaskit/font.js#L145). New engine orchestration, admission and lifecycle logic are independently authored.
