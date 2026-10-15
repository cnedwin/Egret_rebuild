# Spine Core 手动网格桥接实验

[English](../../../en/experiments/spine-f2-core/README.md) | 简体中文

工程预览 **0.47.0** · **S101 / V052**。阅读完整的[契约与指南](../../docs/SpineCore手动网格桥接.md)及[验证／待完成工作](../../docs/SpineCore手动网格桥接证据.md)。共享实现、原始资产及有限观察器位于 `knowledge-base/experiments/spine-f2-core`。

可选实验公开一个工厂与四个擦除类型，使用真实白鹭资源／显示所有权，经外部提供的官方 Core 4.3.13 完成有限、手动、非加权网格的 translate／deform 采样。默认 Engine／Runtime／Project 入口不增加 Core 依赖。

```text
node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core <existing-official-package-directory> --output <fresh-directory-outside-repository>
```

运行器检查原始源／工具／SDK 字节、独立构建、实际严格类型诊断、真实 F2C00 前提、命名空间及十个 CPU 用例 ID，不安装软件、不创建别名。前提拒绝执行零项主用例。独立资源、回调、受控故障、策略／冷导入及浏览器观察分别计数。

第一方适配器与程序生成的原始资产适用 Apache-2.0。外部 SDK 保留 [Spine Runtimes License](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/LICENSE)，许可资格 unknown、分发资格 unverified。不打包 SDK 或上游动画资产。完整 Spine R020/V020 与迁移 R008/V006 保持 OPEN。
