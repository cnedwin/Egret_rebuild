# @egret/spine

[English](README.md) | 简体中文

可选 Spine 资产 SDK，使用官方 Core 4.3.13。白鹭适配器为 Apache-2.0，Core 遵循其[原始许可](../../third-party/spine-core-4.3.13.LICENSE)，包括附带条件的使用者授权分发路径。接入前请阅读[契约与验收边界](../../knowledge-base/Cns/docs/spine-content-ingress.md)。默认 Engine 导入保持独立；本 private 工作区包尚未发布 npm。

在 Node 26.7.0、pnpm 11.25.0 下运行 `pnpm build`，提供符合所述 Spine／图集配置的既有准入清单：

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

根入口的 `createSpineContentLoader` 支持自定义真实 Texture／字符串 provider，全部需求沿用既有资源租约与 Scope。这些是设置资产，不是可播放实例。`test/fixtures.mjs` 的原创夹具演示清单构建，不是经过认证的 Editor 导出。

定向验证：`node --test packages/spine/test/content.test.mjs packages/spine/test/draw-order.test.mjs packages/spine/test/types.test.mjs` 及 `node tools/check-spine-content.mjs`，常规 `pnpm test` 与合并检查包含相同义务。可选实际浏览器命令为 `node tools/verify-spine-content.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`，需要已安装 Edge，并保留全新的源码快照／结果；只验证传输、原生 PNG 和逻辑清理。
