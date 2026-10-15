# 共享输入的位图按钮

[English](README.md) | 简体中文

本原创示例使用一个共享 MouseInput 和一个借用图集租约，创建两个具有真实 Scope 的按钮。红、蓝、灰表示抬起、按下和禁用。界面提供启用/禁用、释放/重建、独立/双按钮布局、保存抬起帧回放、当前画面及关闭。

执行 `node tools/build.mjs`，通过普通本地 HTTP 服务托管仓库根目录，再打开 `/examples/bitmap-button/`。默认 Canvas，可显式选择 WebGPU；启动不可用时显示原因，不静默切换。切换前等待当前 Engine 完成关闭链。

预览为 192×128。`?preset=verification&backend=canvas` 选择固定 24×24、DPR 1 用例；backend=webgpu 使用同一规格。该用例服务于独立像素核验，不是性能基准。

公开输入路由合并排入一个应用微任务，捕获已提交状态。保存帧回放提交原始抬起帧，不改变实时按钮状态或激活计数。仅用于核验的 WebGPU Host 适配层在每次原始提交前申请原有公开读回，不增加产品导出或诊断钩子。

控件 Scope 先于输入和资源 Scope 退役；关闭等待启动、资源任务和 Engine 释放。图集采用原创程序化像素；示例不增加自动游戏时钟或依赖。参阅[契约](../../knowledge-base/Cns/docs/位图按钮契约.md)及[核验](../../knowledge-base/Cns/docs/位图按钮核验.md)。
