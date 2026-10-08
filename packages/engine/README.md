# @egret/engine

[English](README.en.md) | 简体中文


## 0.12.0 显示与帧候选范围

后续工作包按[显示与帧合同](../../knowledge-base/docs/显示与帧执行合同.md)及[实现计划](../../knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](../../knowledge-base/docs/显示与帧执行实现记录.md)和[验证](../../verification/display-frame-verification.json)承载。

captureFrame 仅提取快照，renderFrame 另向创建时固定的同步宿主端口提交；没有渲染端口时前者仍可用，后者拒绝。帧读取/执行期间禁止重入；关闭立即进入 closing，但清理等待帧调用退出。Canvas 的 DOM 类型与执行隔离在 web 子入口，根入口不重导出该适配器。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

experimental公共门面，仅依赖runtime和contracts。输入为显式HostAdapter、可选正整数关闭deadline与诊断回调，输出为Engine及其Stage、Scope、assets服务和唯一关闭Promise。Engine管理逻辑生命周期与surface预留，宿主管理物理资源和安全归还事实。

createEngine在等待host.start前预留surface，启动失败也进入清理。关闭先等待当前帧调用退出，再处理Scope与Stage，再关闭CPU资产管理器、停止host并有界等待close。只有close成功才释放surface；超时或拒绝保持隔离，迟到成功可以释放预留。核心不销毁借用的surface/device，本切片没有强制释放或恢复入口。

Scope或Stage清理失败仍继续后续步骤；EgretError保留原cause与按顺序收集的cleanupErrors。根导出只包含已实现的切片能力，内部装配口不导出。

根目录验证为`node tools/verify.mjs`，联动样例为`node examples/headless.mjs`与`node examples/assets.mjs`。设计见[知识库](../../knowledge-base/README.md)，来源见[来源记录](../../source-origin.json)。包保留`private: true`以防止意外npm发布，第一方代码与本文采用[Apache-2.0](../../LICENSE)。

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。
