# @egret/spine

English | [简体中文](README.zh-CN.md)

Optional Spine asset SDK using official Core 4.3.13. Egret's own adapter is Apache-2.0; Core uses its [original license](../../third-party/spine-core-4.3.13.LICENSE), including the conditional licensed-user distribution route. Read the [contract and qualification limits](../../knowledge-base/en/docs/spine-content-ingress.md) before integration. Default Engine imports remain separate; this private workspace package is not published on npm.

With Node 26.7.0 and pnpm 11.25.0, run `pnpm build`. Supply an existing admitted manifest with the documented Spine/atlas profiles:

```js
import {createManifestSpineContentLoader} from '@egret/spine/web';
const owner = engine.createScope();
const loader = createManifestSpineContentLoader(engine, owner, manifest, {baseUrl});
const scope = engine.createScope();
const group = loader.load(scope, ['e_skeleton']);
await group.ready;
const asset = group.getSpine('e_skeleton');
console.log(asset.info.exportVersion, asset.info.pages);
scope.dispose();
await loader.close();
owner.dispose();
```

The root `createSpineContentLoader` supports custom genuine Texture/string providers. All demand uses existing resource leases and Scope ownership. Create independent players with `createSpineInstance(asset, scope)`, queue `setAnimation(0, name, {loop: true})`, and call `advance(tick)` from the existing Engine clock. Players borrow their source group lifetime. See the [playback controls and limits](../../knowledge-base/en/docs/spine-content-ingress.md#independent-playback-instances); shared graphics and full Spine qualification remain separate. Original fixtures in `test/fixtures.mjs` demonstrate manifest construction; they are not certified Editor exports.

Focused verification: `node --test packages/spine/test/content.test.mjs packages/spine/test/draw-order.test.mjs packages/spine/test/playback.test.mjs packages/spine/test/types.test.mjs` and `node tools/check-spine-content.mjs`. Normal `pnpm test` and merge checks include these obligations. The optional actual-browser command is `node tools/verify-spine-content.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`; it requires installed Edge and preserves a fresh source snapshot/result. It verifies transport, native PNG, independent numerical playback and logical cleanup; it does not qualify rendered pixels or physical devices.

Shared display: call `createSpineDisplay(player, displayScope, {colorProfile: 'egret-shared-linear/1'})`, then add its `node` to the Stage. Explicit player ticks publish copied geometry before callbacks. Existing Mesh2D, materials, page leases and WebGPU/WebGL2 hosts remain the render path. See [profile equations, limits and evidence](../../knowledge-base/en/docs/spine-content-ingress.md#shared-rendering-display); other Spine renderer gamma profiles and full feature qualification are not implied.

Compose existing outfit parts with `player.setSkins(['body/base', 'clothes/coat'])`; later parts override matching placeholders at the next explicit tick without restarting playback. `snapshot.skins` records the ordered selection; `setSkin` remains compatible. See the [bounded skin contract](../../knowledge-base/en/docs/spine-content-ingress.md#combined-outfit-skins).

For a fixed total, use `player.setAnimation(0, 'walk', {plays: 3})`; `addAnimation` accepts the same count. Counts are 1–1024, cannot be combined with `loop`, and zero-duration animations accept only one play. The final pose holds; queued successors consume remaining tick time. Snapshot tracks expose `plays` and committed `completedPlays`. See [finite-play semantics and work bounds](../../knowledge-base/en/docs/spine-content-ingress.md#finite-total-plays).
