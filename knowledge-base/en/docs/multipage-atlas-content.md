# Multipage atlas content

English | [简体中文](../../Cns/docs/multipage-atlas-content.md)

M2.1 adds the first-party `egret.atlas-pages` 1.0.0 profile to the existing content build and resource loader. One atlas resource owns several named pages, each represented by the existing SpriteSheet. This is a finite source format, not an automatic texture packer or a general exporter adapter.

## Source and artifact

Recipes use importer `{id: 'egret.atlas-pages', version: '1.0.0'}`, artifact format `egret.atlas-pages/1`, empty settings and one to sixteen distinct ordered PNG resource dependencies. The authored JSON source has this shape:

```json
{"format":"egret.atlas-pages-source/1","pages":[{"name":"characters","frames":[{"name":"idle","x":0,"y":0,"width":2,"height":2,"layout":{"sourceWidth":2,"sourceHeight":2,"trimX":0,"trimY":0,"packedRotation":0}}]}]}
```

Source page order binds exactly to dependency order. A page contains its logical name and frames; the producer obtains page dimensions from the verified PNG dependency. The canonical output additionally stores each page's `pageDependency` ordinal, width and height. No physical path or owning project/resource/file ID is embedded in intrinsic output. Duplicate JSON properties, unknown fields, invalid names or invalid frame layouts are refused. Runtime admission requires the exact canonical output, including property order and numeric spelling, rather than accepting arbitrary JSON with equivalent parsed values.

Names are exact, case-sensitive logical strings of one to 128 UTF-16 units, with valid Unicode scalar values and no ASCII control characters. They are not filesystem paths. Page names are unique within an atlas; frame names are unique within a page. Two different pages may both contain `idle`.

Limits are sixteen pages, 1,024 frames per page, 8,192 frames in total, 32,768 frame-name units per page (the existing SpriteSheet limit), and 262,144 total name units. Existing PNG bounds remain: at most 4,096 per dimension and 1,048,576 pixels per page. Source metadata and canonical output are each limited to 4 MiB by the Node producer; browser metadata transport retains its 4 MiB byte bound. The core also bounds supplied metadata strings to 4,194,304 UTF-16 units. Existing per-build source/output/scanline budgets and the 128-resource group closure apply independently.

Each frame contains a packed rectangle plus the existing trim/rotation layout. `packedRotation` is 0 or 90, meaning the existing packed clockwise-rotation convention. Logical trimmed width/height swap for a 90-degree packed rectangle; trim offsets and that logical rectangle must fit the declared untrimmed source dimensions. Source dimensions are bounded to 65,535. This profile adds no renderer, UV algorithm or alternate SpriteSheet.

## Runtime and ownership

```js
const group = loader.load(dataScope, ['e_pages']);
await group.ready;
const pageNames = group.getAtlasPages('e_pages');
const page = group.getAtlasPage('e_pages', pageNames[0]);
const bitmap = displayScope.use(page.createBitmap('idle'));
engine.stage.addChild(bitmap);
```

The two methods are on the existing `ContentGroup`; page names are frozen and ordered. Getters require a live, selected and completely ready group. `getAtlas(id)` continues to select only a single-page atlas, while `getAtlasPage(id, pageName)` selects only this multipage profile. Old image, atlas and sequence APIs retain their meaning. Existing Aseprite single-page admission is unchanged; cross-page sequences are not part of this increment.

The loader borrows genuine image leases from its existing ManifestAssetGroup and creates a SpriteSheet for each page. Overlapping groups in the same loader share AssetManager texture values and retain independent leases. A group publishes no partial pages. An error during loading or page assembly retires every created sheet before releasing the raw leases. Group, Scope, loader or Engine disposal cancels outstanding demand; late completion cannot reopen the group.

Returned sheets and image leases are borrowed; applications must not dispose or re-own them separately. Dispose application display/playback consumers before their data group. Browser users keep using `createManifestContentLoader` and await `close()` for source/PNG-provider settlement. The new core remains free of DOM, Node, PNG decoding and project/build dependencies.

## Builds and replacement

The existing source verification, dependency keys, immutable cache blobs, ready-generation publication and ProjectStore adoption own the pipeline. A changed PNG invalidates that page's output and the multipage metadata key, while another unchanged image can remain cached. Prior generation artifacts remain intact. Atlas output can remain byte-identical when only colors change; its dependency key still changes. There is no second resource manager or hot-update transaction.

Prepare a new manifest loader/group while keeping the active display and old group alive. After the whole candidate is ready, switch application consumers and retire old consumers before old data. A failed or cancelled candidate leaves the old group usable. The contract does not automatically retarget already created Bitmaps or preserve animation position.

## Example, verification and sources

Run `node examples/atlas-pages/author.mjs` after `pnpm setup:dev`, then `pnpm example:browser`. Open the printed generated configuration through `/examples/atlas-pages/index.html?config=/work/atlas-pages/run-XXXXXX/browser-config.json`. The [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-pages/README.md) describes backend selection and release.

The original two-page fixture displays red, green, rotated/trimmed blue-yellow and cyan frames. Its seven literal pixel references are authored independently of the renderer. [Verification](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/atlas-pages/verification.json) distinguishes built public behavior/type tests from real Edge WebGL2/WebGPU pixels and controlled HTTP failure/cancellation. Browser source/provider counters establish logical drain, not physical GPU memory. M1.2 performance remains open at the previously recorded 10.3 ms against 8 ms.

Core, producer, schema and fixture are independently authored under Apache-2.0 with AI assistance. They reuse first-party content build, SpriteSheet and source-selection code. Existing pinned pngjs 7.0.0 handles PNGs; jsonc-parser 3.3.1 supplies strict JSON syntax trees and duplicate-property inspection. Their existing attribution/licenses remain unchanged. This increment does not qualify Aseprite multipage exports, Spine licenses/semantics, independent production assets, phones or performance, and does not complete all of M2.1.
