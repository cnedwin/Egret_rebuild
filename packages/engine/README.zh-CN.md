# @egret/engine

[English](README.md) | 简体中文

根门面导出类型专用 `BoundsQueryOptions` 与继承的 `getBounds`，复用只读 `Rectangle2D`，见[接收者局部边界契约](../../knowledge-base/Cns/docs/显示内容边界契约.md)；布局及命中测试仍待完成。

根入口导出仅类型的 `Point2D`／`CoordinateQueryOptions`，显示类继承 `localToGlobal`／`globalToLocal`。 阅读[坐标契约](../../knowledge-base/Cns/docs/显示坐标查询契约.md)。

白鹭实验性公共门面，装配 `@egret/runtime` 与 `@egret/contracts`，管理逻辑生命周期、显示／帧访问、CPU 资源及 surface 独占预留；物理资源和安全归还由宿主负责。根入口保持无 DOM，独立 `@egret/engine/web` 导出 `createCanvasHost`，`@egret/engine/webgpu` 显式启用 WebGPU。Engine 为渲染准备固定使用 `robust-predicates` 3.0.3。

## 公共 API 与生命周期

`createEngine` 接收显式 `HostAdapter`、可选正整数关闭 deadline 和诊断回调，提供 `Engine`、所属 `Stage`、`Scope`、assets 服务及唯一关闭 Promise。公共门面不导出内部装配接口。

`createEngine` 在等待 `host.start` 前预留 surface；启动失败仍进入清理。关闭立即开始，等待当前帧调用退出后处理 Scope、Stage 和 CPU 资源管理器，再停止宿主并有界等待 `close`。只有 close 成功才释放预留；超时或拒绝保持隔离，迟到成功可以释放预留。Engine 不销毁借用的 surface 或 device；本切片没有强制释放或恢复入口。

Scope 或 Stage 清理失败仍继续后续步骤。`EgretError` 保留原 cause 和按顺序收集的清理错误。

## 显示与帧执行

`DisplayObject` 提供 `x`、`y`、`scaleX`、`scaleY`、`rotation`、`alpha`、`visible` 与 `clipRect`；`Sprite.graphics` 拥有矩形填充。`Engine.captureFrame` 生成不可变 `RenderFrame2D`，`renderFrame` 另向创建时固定的同步宿主端口提交。没有渲染端口时捕获仍可用，渲染会拒绝。帧读取和执行拒绝重入；清理等待帧调用退出。

Canvas DOM 类型与执行保留在 web 子入口。具体行为见[显示与帧合同](../../knowledge-base/Cns/docs/显示与帧执行合同.md)，绑定版本的证据见[实现记录](../../knowledge-base/Cns/docs/显示与帧执行实现记录.md)。

## WebGPU 使用

将 `HTMLCanvasElement` 作为 `canvas`。可选 readback 绑定下一次通过预检的帧；`renderFrame` 同步返回 `undefined`。`result.bytes` 是调用者所有的预乘 RGBA，与浏览器合成结果不同。`whenIdle` 截取已提交工作；只有 `close` 成功才证明安全归还，Engine 包装保留原 cause。见 [WebGPU 示例](../../examples/webgpu/README.zh-CN.md)。

```ts
import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';

const host = createWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngine({ host });
const rect = new Sprite();
rect.graphics.beginFill(0x00ff00).drawRect(4, 4, 16, 16);
engine.stage.addChild(rect);
const pixels = host.requestReadback();
engine.renderFrame({ width: 48, height: 40, clearColor: 0, clearAlpha: 0 });
const result = await pixels;
await engine.dispose();
```

## 验证与范围

在仓库根运行 `node tools/verify.mjs`、`node examples/headless.mjs` 及 `node examples/assets.mjs`。影响渲染的修改还须运行[协作约定](../../AGENTS.zh-CN.md)规定的对应真实浏览器门禁。包指南说明接口；历史数量和交付记录见[知识库](../../knowledge-base/Cns/README.md)及其[版本记录](../../knowledge-base/Cns/CHANGELOG.md)。

完整文字、纹理、动画、UI 与 3D 执行、Native SDK、目标设备性能、编辑器、Agent 服务及完整旧工程迁移各有独立验收义务。内部 CPU 场景、序列帧及转换工作不代表这些能力已公开或完整实现。

包版本 `0.0.0`、协议 `1.0` 和实验性 API 状态保持不变。`private: true` 防止意外 npm 发布。归属见[来源记录](../../source-origin.json)，交付政策见[发布指南](../../PUBLICATION.zh-CN.md)。第一方代码与本文采用 [Apache-2.0](../../LICENSE)。

## 显式序列动画

`createSequenceClip` 拥有已校验图集时序；`SequencePlayer` 把调用方提供的绝对秒数应用于一个 Bitmap 与确切借用租约。构造不改变裁剪，销毁不释放调用方资源，不包含自动调度器。见[契约与验收范围](../../knowledge-base/Cns/docs/显式时间序列播放器契约.md)，以及公共 `examples/sequence-player` / `tools/sequence-player` 指南。
