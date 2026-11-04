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

根入口的 `createSpineContentLoader` 支持自定义真实 Texture／字符串 provider，全部需求沿用既有资源租约与 Scope。设置资产可通过下述独立工厂创建播放实例。`test/fixtures.mjs` 的原创夹具演示清单构建，不是经过认证的 Editor 导出。

定向验证：`node --test packages/spine/test/content.test.mjs packages/spine/test/draw-order.test.mjs packages/spine/test/playback.test.mjs packages/spine/test/types.test.mjs` 及 `node tools/check-spine-content.mjs`，常规 `pnpm test` 与合并检查包含相同义务。可选实际浏览器命令为 `node tools/verify-spine-content.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`，需要已安装 Edge，并保留全新的源码快照／结果；验证传输、原生 PNG、独立数值播放和逻辑清理，不构成渲染像素或实体设备验收。

使用 `createSpineInstance(asset, scope)` 创建独立实例，以 `setAnimation(0, name, {loop: true})` 排队动画，再由既有 Engine 时钟调用 `advance(tick)`。实例借用源资源组生命周期。参阅[播放控制与边界](../../knowledge-base/Cns/docs/spine-content-ingress.md#独立播放实例)；共享图形与完整 Spine 资格验收仍分开处理。

共享显示：调用 `createSpineDisplay(player, displayScope, {colorProfile: 'egret-shared-linear/1'})`，将其 `node` 添加到 Stage。显式播放器 tick 在回调前发布复制几何，渲染沿用既有 Mesh2D、材质、页面租约及 WebGPU／WebGL2 宿主。参阅[配置方程、限制及证据](../../knowledge-base/Cns/docs/spine-content-ingress.md#共享渲染显示)，不默认宣称与其他 Spine 渲染器的 gamma 配置一致或完整功能通过。
