# @egret/engine

[English](README.md) | 简体中文

白鹭实验性公共门面，装配 `@egret/runtime` 与 `@egret/contracts`，管理逻辑生命周期、显示／帧访问、CPU 资源及 surface 独占预留；物理资源和安全归还由宿主负责。根入口保持无 DOM，独立 `@egret/engine/web` 导出 `createCanvasHost`，`@egret/engine/webgpu` 显式启用 WebGPU。Engine 为渲染准备固定使用 `robust-predicates` 3.0.3。

## 工程预览 0.55.0 — 显式本地线性布局

可选已构建入口 `@egret/engine/layout` 提供 `planLinearLayout` 及四个擦除接口，由调用方提供数字尺寸、选择成员并应用局部坐标。规划器无 DOM/Node 依赖，不写场景，不增加默认 API、依赖或 SDK Host 协议，也不完成自动 EUI 布局。参阅[规格](../../knowledge-base/Cns/docs/local-linear-layout-spec.md)、[证据](../../knowledge-base/Cns/docs/local-linear-layout-evidence.md)和[双按钮示例](../../examples/linear-layout/README.zh-CN.md)。已记录的桌面 Canvas/WebGPU 检查覆盖固定双 Button 流程；环境及边界见证据记录。

## 工程预览 0.52.0 — 显示锚点偏移

现有显示类继承有限 number 属性 `anchorOffsetX` 与 `anchorOffsetY`，默认 +0。指定枢轴使缩放／旋转在坐标、逻辑边界、裁剪、显式命中及帧捕获中保持一致，并保留原零偏移字节。阅读[当前契约](../../knowledge-base/Cns/docs/显示锚点偏移契约.md)和[有限证据](../../knowledge-base/Cns/docs/显示锚点偏移证据.md)。

**以下模块旧说明保留早于 0.52.0 的原截止点。** 其中早先的待完成表述限定原版本；当前接受范围由所链接的新证据确定。完整 EUI／布局和完整 Spine 仍为 OPEN。

DisplayObjectContainer.getChildIndex(child: DisplayObject): number 只读查询精确当前直接子节点，以 O(n) 扫描私有真实顺序，不建立列表快照／缓存，不修改树、转移 owner、操作资源或调用显示回调。Sprite／Stage 继承，根值／类型、子入口、依赖及协议不变。 阅读 [0.50 契约](../../knowledge-base/Cns/docs/容器子节点索引契约.md).

`DisplayObjectContainer.removeChildren(): void` 清空显示层，同时保留节点、后代、资源及清理所有者。它认证真实接收者，空容器也先检查 Engine 再检查接收者生命周期，在全部直接边校验后无调用者 hook 提交；Sprite 和 Stage 继承方法，根值／类型、规格、依赖和协议不变。 阅读 [0.49 契约](../../knowledge-base/Cns/docs/容器清空子节点契约.md).

工程预览 0.48.0 在 Runtime／Engine 根入口新增 `NineSliceBitmap` 及擦除类型 `NineSliceBitmapOptions`，借用真实 Texture 租约调整固定边框 NS1 内容；正向渲染使用显式纹理 WebGPU 宿主，Canvas mesh 被拒绝。阅读[契约](../../knowledge-base/Cns/docs/九宫格位图契约.md)及[有限证据](../../knowledge-base/Cns/docs/九宫格位图证据.md)。

根门面导出类型专用 `BoundsQueryOptions` 与继承的 `getBounds`，复用只读 `Rectangle2D`，见[接收者局部边界契约](../../knowledge-base/Cns/docs/显示内容边界契约.md)；布局及命中测试仍待完成。

根入口导出仅类型的 `Point2D`／`CoordinateQueryOptions`，显示类继承 `localToGlobal`／`globalToLocal`。 阅读[坐标契约](../../knowledge-base/Cns/docs/显示坐标查询契约.md)。

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

## 自有二进制读取

根入口导出 `ByteReader` 与冻结的 `BYTE_READER_LIMITS`，以及仅类型 `ByteOrder`。读取器复制符合条件的固定普通 Uint8Array 载荷，默认 bigEndian，提供有界原子标量／复制读取；返回字节是独立副本，释放清除自有引用。既有 Scope 可通过可释放对象形状管理读取器。阅读 [BR1 契约](../../knowledge-base/Cns/docs/字节读取器BR1契约.md)与[已有验证范围](../../knowledge-base/Cns/docs/字节读取器BR1证据.md)。不承诺二进制格式、文字编码或旧 ByteArray 兼容；本准备截止点的 Main 集成与公开门禁仍待完成。

<!-- NS1-DOC-0.41.0-BEGIN -->
## 工程预览 0.41.0 — 九宫格拉伸几何 NS1

**S094 / V045。有限 CPU、类型、策略和浏览器结果已接受；完整发布门禁与交付仍为 PENDING。** 固定边框的拉伸网格复用现有 Mesh2D 纹理租约，调整尺寸时仅替换几何。运行时／引擎根入口提供一个工厂与两个只读类型，保留原有自有几何身份。

实际 CPU 27/27 项通过，其中 11 个 NS 组、6 个 Mesh 组及包含嵌套用例的 10 项几何检查。正例类型诊断为 0；两组刻意负例实际为 41/35 条，共 76 条精确位置记录。严格类型门禁与策略检查退出码为 0；指定策略对照 13/13 通过。实际浏览器完成 2 帧和 96 次颜色通道比较，并验证资源清理；具体环境与范围见证据。

原始 NSP09 的 13/12/1 失败与有限测试输入修正分别保留。

0.40.0 ByteWriter 已通过 [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27) 合并；已回读 Main `8e1509878252cc2a9295fcc56d7597877d023c85` 与 tree `ca1f2f176713e388e09016ae22d610c5c1b95201`。必要推送门禁退出码为 0，公开校验 63 项、核心校验 2724 项。远端状态／检查运行数均为零，不能据此声明远端 CI PASS。较早的 PENDING 截止点和失败记录继续保留。

[契约](../../knowledge-base/Cns/docs/九宫格几何NS1契约.md) / [证据](../../knowledge-base/Cns/docs/九宫格几何NS1证据.md)。

这是复杂 2D UI 的有限几何增量，不构成完整 UI/EUI、布局、完整 Spine、迁移、手机能耗／性能或原生 SDK／PC 验收。
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## 自有二进制写入

根入口提供同一个 `ByteWriter` 与冻结的 `BYTE_WRITER_LIMITS`；容量固定，整数严格校验，浮点遵循原生 IEEE 转换。`toUint8Array()` 只复制已提交前缀，`Scope.use(writer)` 使用原有生命周期。ByteOrder 保持纯类型，可选宿主入口不新增写入器。完整范围与分阶段结果见[契约](../../knowledge-base/Cns/docs/字节写入器BW1契约.md)与[证据](../../knowledge-base/Cns/docs/字节写入器BW1证据.md)。包版本、实验性状态和 npm 发布约定不变。
<!-- BW1-DOC-0.40.0-END -->
