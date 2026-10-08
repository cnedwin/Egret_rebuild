# @egret/engine

[English](README.en.md) | 简体中文

experimental公共门面，仅依赖runtime和contracts。输入为显式HostAdapter、可选正整数关闭deadline与诊断回调，输出为Engine及其Stage、Scope、assets服务和唯一关闭Promise。Engine管理逻辑生命周期与surface预留，宿主管理物理资源和安全归还事实。

createEngine在等待host.start前预留surface，启动失败也进入清理。关闭先处理Scope与Stage，再关闭CPU资产管理器、停止host并有界等待close。只有close成功才释放surface；超时或拒绝保持隔离，迟到成功可以释放预留。核心不销毁借用的surface/device，本切片没有强制释放或恢复入口。

Scope或Stage清理失败仍继续后续步骤；EgretError保留原cause与按顺序收集的cleanupErrors。根导出只包含已实现的切片能力，内部装配口不导出。

根目录验证为`node tools/verify.mjs`，联动样例为`node examples/headless.mjs`与`node examples/assets.mjs`。设计见[知识库](../../knowledge-base/README.md)，来源见[来源记录](../../source-origin.json)。包保留`private: true`以防止意外npm发布，第一方代码与本文采用[Apache-2.0](../../LICENSE)。
