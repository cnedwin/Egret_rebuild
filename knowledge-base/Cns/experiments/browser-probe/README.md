# 浏览器图形能力与像素研究原型

[English](../../../en/experiments/browser-probe/README.md) | 简体中文

在本目录运行 `node server.mjs`，在测试浏览器打开其输出的本地地址。服务仅监听本机；测试结果保存至 `../../evidence/browser-probe-results.json`。用完关闭服务。

程序测试 WebGL2 深度、透明顺序、矩形裁剪及上下文恢复，并尝试 WebGPU 设备创建和清屏读回。它不加载商业游戏或历史源码，也不测性能、骨骼、文字或完整3D资源。测试的桌面浏览器与实际硬件/驱动路径如实记录；API或浏览器页面可用不能代替小游戏宿主、手机、原生或性能认证。

2026年10月10日调整阅读文档位置。文中的实验命令仍在仓库根目录下的共享目录 `knowledge-base/experiments/browser-probe` 中运行。此次阅读文档迁移没有重跑实验，也没有改写原始证据。
