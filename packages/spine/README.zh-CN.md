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

使用 `createSpineInstance(asset, scope)` 创建独立实例，以 `setAnimation(0, name, {loop: true})` 排队动画，再由既有 Engine 时钟调用 `advance(tick)`。实例借用源资源组生命周期。`seek({elapsedSeconds})` 分阶段地把播放移到另一个时间，由实例自己的有界历史重建，见[跳转](../../knowledge-base/Cns/docs/spine-seek.md)。参阅[播放控制与边界](../../knowledge-base/Cns/docs/spine-content-ingress.md#独立播放实例)；共享图形与完整 Spine 资格验收仍分开处理。

共享显示：调用 `createSpineDisplay(player, displayScope, {colorProfile: 'egret-shared-linear/1'})`，将其 `node` 添加到 Stage。显式播放器 tick 在回调前发布复制几何，渲染沿用既有 Mesh2D、材质、页面租约及 WebGPU／WebGL2 宿主。参阅[配置方程、限制及证据](../../knowledge-base/Cns/docs/spine-content-ingress.md#共享渲染显示)，不默认宣称与其他 Spine 渲染器的 gamma 配置一致或完整功能通过。

使用 `player.setSkins(['body/base', 'clothes/coat'])` 组合已有装扮部件；后面的部件在下一次显式更新时覆盖同名占位，不重启动画。`snapshot.skins` 记录有序选择，`setSkin` 保持兼容。参见[组合皮肤契约](../../knowledge-base/Cns/docs/spine-content-ingress.md#组合皮肤换装)。

固定总次数使用 `player.setAnimation(0, 'walk', {plays: 3})`；`addAnimation` 也支持该次数。范围为 1–1024，不能与 `loop` 混用，零时长动画仅允许一次。最终姿态保留，排队后继继续消费 tick 剩余时间。快照轨道提供 `plays` 与已提交的 `completedPlays`。参阅[有限播放语义与工作量边界](../../knowledge-base/Cns/docs/spine-content-ingress.md#有限总播放次数)。

可通过显式、仅 CPU 的重置槽替换单个资源版本：`createSpineResetSlot(engine, scope, target, initial)`。新候选拥有其组，初始玩家和所有传入 loader 仍为借用。参见 [RESET 契约](../../knowledge-base/Cns/docs/spine-reset-slot.md)与[普通双版本例子](../../examples/spine-reset/README.zh-CN.md)。GPU 原子替换和完整 M2.4 仍未完成。
