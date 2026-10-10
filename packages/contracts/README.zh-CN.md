# @egret/contracts

[English](README.md) | 简体中文

白鹭实验性类型包，依据生命周期规格定义 `CancellationSignal`、`Disposable`／`Releasable`、`Diagnostic` 和 `HostAdapter` 合同。没有包依赖或第三方运行时依赖、DOM／Node 环境全局，也没有宿主初始化副作用。

## 宿主与帧义务

`HostAdapter.surface` 表示稳定对象身份，物理资源由宿主负责。`close()` 仅在安全归还 surface 并完成宿主在途工作后 resolve；拒绝时 Engine 保留独占预留。注入的毫秒 deadline 端口应支持同步取消。类型合同本身不验证真实宿主。

[显示与帧合同](../../knowledge-base/Cns/docs/显示与帧执行合同.md)定义 `Matrix2D`、`Rectangle2D`、`ClipRectangle2D`、`RectangleCommand2D`、`FrameOptions2D`、`RenderFrame2D` 与 `RenderHostAdapter`。`renderFrame` 同步返回 `undefined`；宿主 `close` 仍证明在途工作完成，CPU 帧不能充当设备完成栅栏。

通过引擎门面，`DisplayObject` 提供 `x`、`y`、`scaleX`、`scaleY`、`rotation`、`alpha`、`visible` 与 `clipRect`；`Sprite.graphics` 拥有矩形填充，`Engine.captureFrame`／`renderFrame` 捕获／提交不可变帧。`createCanvasHost` 位于独立 `@egret/engine/web` 入口，根入口保持无 DOM。

## 验证与范围

在仓库根运行 `node tools/verify.mjs`，检查严格编译、声明／导入边界及正负类型样例。设计和绑定版本的证据见[知识库](../../knowledge-base/Cns/README.md)及[显示与帧实现记录](../../knowledge-base/Cns/docs/显示与帧执行实现记录.md)，归属见[来源记录](../../source-origin.json)。

接口保持实验性质。完整文字、纹理、动画、UI 与 3D 执行、GPU／Native 验收、目标设备性能、编辑器、Agent 服务及完整迁移仍有独立义务。包版本 `0.0.0`、协议 `1.0` 与 `private: true` 保持不变，继续禁止意外 npm 发布。第一方代码与本文采用 [Apache-2.0](../../LICENSE)。
