# 资源组合准备

[English](README.md) | 简体中文

两名动画角色共享图集，各自拥有独立的两层服装。新服装的两张纹理全部就绪后，通过一次绑定票据提交，同时更新两个图层。请求失败、取消或被后续请求替代时，已显示的服装继续保留。

完成仓库的常规构建后，通过本地 HTTP 服务访问本目录的 `index.html`。默认使用 Canvas 2D。可选的实验性 WebGPU 模式将相同的纹理显示内容绘制在小型不透明 3D 背景上，需要浏览器支持。

点击角色或使用选择按钮，然后选择经典、夏日或混搭服装并换装。可以按 0.125 秒步进动画、取消待定换装、移除角色或关闭场景。移除一名角色后，另一名角色的资源保持有效。示例通过真实的公共 Engine、Scope、资源、动画、文本和输入 API 实现这些操作。

`application.mjs` 中可复用的 `createPreparedResourceApplication` 拥有画布、Host、会话及资源和依赖适配器。原始 `ready` Promise 在首帧呈现后完成；`present` 将一帧呈现加入队列；`whenIdle` 返回最近完成的原始呈现结果，包括原生选择操作产生的帧。`ready` 完成后，调用方可以使用真实的 `input.events` 描述符和会话的 `inputScope.signal` 订阅事件；输入对象仍由应用负责关闭。

`session.mjs` 组合场景，`coordinator.mjs` 管理换装发布，`source.mjs` 和 `dependencies.mjs` 适配真实的图像、字体操作。绑定票据借用资源组成员。取消终止发布需求；原始读取、解码操作的占用保留到实际结束。关闭会等待这些原始操作，GPU 画布只在 Host 安全清理后退役。

示例复用资源场景示例中已记录来源的 PNG、Ahem 和 Noto Sans SC 资源，保留原始来源和许可证记录。固定中文标签仅覆盖已记录的字体子集，不能代表通用文字排版、移动设备性能、生产宿主、完整 UI 或完整 Spine 支持。

生命周期、所有权和有限资源限制见[规格](../../knowledge-base/Cns/docs/prepared-resource-groups-spec.md)。验证记录分别说明源码评审、CPU 行为、真实浏览器结果、仓库完整检查和 Git 交付。
