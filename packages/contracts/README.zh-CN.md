# @egret/contracts

[English](README.md) | 简体中文


## 0.12.0 显示与帧候选范围

后续工作包按[显示与帧合同](../../knowledge-base/Cns/docs/显示与帧执行合同.md)及[实现计划](../../knowledge-base/Cns/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](../../knowledge-base/Cns/docs/显示与帧执行实现记录.md)和[验证](../../verification/display-frame-verification.json)承载。

帧合同增加 Matrix2D、Rectangle2D、ClipRectangle2D、RectangleCommand2D、FrameOptions2D、RenderFrame2D 与 RenderHostAdapter。renderFrame 同步返回 undefined；宿主 close 仍承担在途工作完成的证明，CPU 帧不可替代设备完成栅栏。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

experimental类型包，提供CancellationSignal、Disposable/Releasable、Diagnostic和HostAdapter合同。输入为白鹭生命周期规格，没有第三方运行时依赖、DOM/Node环境全局或宿主初始化副作用。包的`private: true`用于防止意外发布npm包。

HostAdapter中的surface表示稳定对象身份，物理资源由宿主负责。`close()`只在安全归还surface并完成宿主在途工作后resolve；拒绝时Engine保留独占预留。注入的毫秒deadline端口应支持同步取消，本包提供类型合同，真实宿主需单独验证。

在仓库根目录使用`node tools/verify.mjs`验证严格编译、声明与导入边界，以及正负类型样例。设计入口见[知识库](../../knowledge-base/Cns/README.md)，归属见[来源记录](../../source-origin.json)。第一方代码与本文采用[Apache-2.0](../../LICENSE)。

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。
