# @egret/runtime

[English](README.en.md) | 简体中文

experimental逻辑包，仅依赖`@egret/contracts`。它接收事件描述符、同步清理值和Engine注入的窄生命周期端口，提供取消、Scope、显示树、同步派发与 CPU 资源获取/租约。Scope所有权、对象Engine绑定、父子关系与事件状态由本包保持一致。

EngineContext和createScope/createStage供engine内部装配，公共门面不导出。Scope与Stage由Engine创建；AssetManager 由 Engine 创建，资源类型与引用由工厂创建并在运行时核查；共享任务与独立租约分开，详见[资源合同](../../knowledge-base/docs/资源核心合同.md)。本切片尚未实现图形执行或帧调度。

Scope登记会处理同值递归、用户回调后的状态复核、关闭期间迟到值和所有权冲突。内部挂载与终结保持实际树状态，不隐式调用公共removeChild重载；当前合同没有mount/remove通知。清理失败逐项记录并继续处理其余监听与子树，递归终结遵守发起根的owner边界。signal登记失败撤回订阅并尝试adapter回滚；同步事件handler返回Promise时同步拒绝并观察其拒绝。

行为测试通过公共engine构建入口运行。根目录验证为`node tools/verify.mjs`；设计见[知识库](../../knowledge-base/README.md)，来源见[来源记录](../../source-origin.json)。包保留`private: true`以防止意外npm发布，第一方代码与本文采用[Apache-2.0](../../LICENSE)。
