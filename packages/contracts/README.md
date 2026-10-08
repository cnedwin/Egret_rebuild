# @egret/contracts

[English](README.en.md) | 简体中文

experimental类型包，提供CancellationSignal、Disposable/Releasable、Diagnostic和HostAdapter合同。输入为白鹭生命周期规格，没有第三方运行时依赖、DOM/Node环境全局或宿主初始化副作用。包的`private: true`用于防止意外发布npm包。

HostAdapter中的surface表示稳定对象身份，物理资源由宿主负责。`close()`只在安全归还surface并完成宿主在途工作后resolve；拒绝时Engine保留独占预留。注入的毫秒deadline端口应支持同步取消，本包提供类型合同，真实宿主需单独验证。

在仓库根目录使用`node tools/verify.mjs`验证严格编译、声明与导入边界，以及正负类型样例。设计入口见[知识库](../../knowledge-base/README.md)，归属见[来源记录](../../source-origin.json)。第一方代码与本文采用[Apache-2.0](../../LICENSE)。
