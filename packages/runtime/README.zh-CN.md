# @egret/runtime

[English](README.md) | 简体中文

继承的 `getBounds` 读取权威接收者局部内容，提供类型专用 `BoundsQueryOptions`、显式节点／图元预算及全新冻结结果，见[边界契约](../../knowledge-base/Cns/docs/显示内容边界契约.md)。

继承的显示坐标查询使用真实显示状态、有界祖先／生命周期检查及可选的 `CoordinateQueryOptions`。 阅读[坐标契约](../../knowledge-base/Cns/docs/显示坐标查询契约.md)。

白鹭实验性逻辑包，仅依赖 `@egret/contracts`。接收事件描述符、同步清理值及 Engine 注入的窄生命周期端口，提供取消、Scope、显示树、同步派发和 CPU 资源获取／租约，维持 Scope 所有权、对象与 Engine 绑定、父子关系及事件状态。

## 所有权与清理

`EngineContext`、`createScope` 与 `createStage` 供引擎内部装配，公共门面不导出。Engine 创建 Scope、Stage 和 AssetManager；资源类型与引用由工厂创建并在运行时核查。共享获取任务和独立租约保持分离，见[资源合同](../../knowledge-base/Cns/docs/资源核心合同.md)。

Scope 登记处理同值递归、用户回调后的状态复核、关闭期间迟到值及所有权冲突。内部挂载和终结保持实际树状态，不隐式调用公共 `removeChild` 重载；当前合同没有 mount/remove 通知。清理失败逐项记录，继续处理其余监听和子树；递归终结遵守发起根的 owner 边界。

signal 登记失败撤回订阅并尝试 adapter 回滚。同步事件 handler 返回 Promise 时同步拒绝，并观察其拒绝。

## 显示与帧状态

内部可视状态和迭代帧提取保持权威树顺序；公共 getter 不作为帧事实来源。Graphics 归其 Sprite 所有。裁剪与矩形值复制并冻结，后续修改不能改变旧帧。离树但仍绑定的对象同样遵守引擎 closing 限制。

通过引擎门面，`DisplayObject` 提供 `x`、`y`、`scaleX`、`scaleY`、`rotation`、`alpha`、`visible` 与 `clipRect`；`Sprite.graphics` 拥有矩形填充。`Engine.captureFrame`／`renderFrame` 捕获／提交不可变 `RenderFrame2D`。独立 `@egret/engine/web` 入口导出 `createCanvasHost`，根入口保持无 DOM。见[显示与帧合同](../../knowledge-base/Cns/docs/显示与帧执行合同.md)；自动帧调度不属于该合同。

## 验证与范围

行为测试使用公共 engine 构建入口。在仓库根运行 `node tools/verify.mjs`。设计与绑定版本的证据见[知识库](../../knowledge-base/Cns/README.md)及[显示与帧实现记录](../../knowledge-base/Cns/docs/显示与帧执行实现记录.md)，归属见[来源记录](../../source-origin.json)。

接口保持实验性质。完整文字、纹理、动画、UI 与 3D 执行、Native 支持、目标设备性能、编辑器、Agent 服务及完整迁移须分别验收。包版本 `0.0.0` 与 `private: true` 保持不变；本指南不产生 npm 发布。第一方代码与本文采用 [Apache-2.0](../../LICENSE)。

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
