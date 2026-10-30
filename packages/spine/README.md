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

The root `createSpineContentLoader` supports custom genuine Texture/string providers. All demand uses existing resource leases and Scope ownership. These are setup assets, not playable instances. Original fixtures in `test/fixtures.mjs` demonstrate manifest construction; they are not certified Editor exports.

Focused verification: `node --test packages/spine/test/content.test.mjs packages/spine/test/draw-order.test.mjs packages/spine/test/types.test.mjs` and `node tools/check-spine-content.mjs`. Normal `pnpm test` and merge checks include these obligations. The optional actual-browser command is `node tools/verify-spine-content.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`; it requires installed Edge and preserves a fresh source snapshot/result. It verifies transport/native PNG/logical cleanup only.
