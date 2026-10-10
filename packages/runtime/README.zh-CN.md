# @egret/runtime

[English](README.md) | 简体中文


## 0.12.0 显示与帧候选范围

后续工作包按[显示与帧合同](../../knowledge-base/Cns/docs/显示与帧执行合同.md)及[实现计划](../../knowledge-base/Cns/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](../../knowledge-base/Cns/docs/显示与帧执行实现记录.md)和[验证](../../verification/display-frame-verification.json)承载。

内部可视状态和迭代帧提取保持权威树顺序；公共 getter 不作为帧事实来源。Graphics 只绑定其 Sprite，裁剪与矩形值复制并冻结，后续修改不能改变旧帧。离树但仍绑定的对象也须遵守引擎 closing 限制。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

experimental逻辑包，仅依赖`@egret/contracts`。它接收事件描述符、同步清理值和Engine注入的窄生命周期端口，提供取消、Scope、显示树、同步派发与 CPU 资源获取/租约。Scope所有权、对象Engine绑定、父子关系与事件状态由本包保持一致。

EngineContext和createScope/createStage供engine内部装配，公共门面不导出。Scope与Stage由Engine创建；AssetManager 由 Engine 创建，资源类型与引用由工厂创建并在运行时核查；共享任务与独立租约分开，详见[资源合同](../../knowledge-base/Cns/docs/资源核心合同.md)。后续显示与帧范围见上文；自动帧调度不属于该合同。

Scope登记会处理同值递归、用户回调后的状态复核、关闭期间迟到值和所有权冲突。内部挂载与终结保持实际树状态，不隐式调用公共removeChild重载；当前合同没有mount/remove通知。清理失败逐项记录并继续处理其余监听与子树，递归终结遵守发起根的owner边界。signal登记失败撤回订阅并尝试adapter回滚；同步事件handler返回Promise时同步拒绝并观察其拒绝。

行为测试通过公共engine构建入口运行。根目录验证为`node tools/verify.mjs`；设计见[知识库](../../knowledge-base/Cns/README.md)，来源见[来源记录](../../source-origin.json)。包保留`private: true`以防止意外npm发布，第一方代码与本文采用[Apache-2.0](../../LICENSE)。

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。
