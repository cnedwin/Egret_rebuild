# 候选子树示例

[English](README.md) | 简体中文

运行 `pnpm setup:dev` 和 `pnpm example:browser`，在本地服务打开 `/examples/prepared-subtree/index.html?backend=webgpu` 或 `?backend=webgl2`。

准备阶段把离线绿色 Mesh／青色 Bitmap 放入既有变换、裁剪和透明度下，红色场景仍保持可见。提交替换 CPU 子树；呈现才提交已上传帧。取消只撤销未提交请求；重放按钮展示不可变捕获帧。完成替换后刷新页面即可重试。借用的旧节点／资源仅在关闭时由各自所有者退休。

阅读[完整契约与证据](../../knowledge-base/Cns/docs/prepared-display-subtree.md)。CPU 发布与 Host 提交相互独立：本例不承诺提交失败回滚或设备恢复。它是后续 Spine RESET 集成的前置能力，不是动画热替换封装。输入／焦点事务与性能验收仍未完成。

固定桌面采集命令为 `node examples/prepared-subtree/verify.mjs <Playwright-1.62.1/index.mjs> <absolute-output>`。采用默认有界面 Edge，不加额外参数；覆盖两个共享后端、固定像素预期、原始截图／读回与实际执行输入闭包。[可移植摘要](verification-summary.json)记录有限结果、原始失败与边界；完整 CI 与独立审查另行判断。

全部几何、颜色页与预期均为原创程序化内容，不含 Editor 导出或第三方美术。一方代码／内容／文档由 AI 辅助独立编写，采用 Apache-2.0。既有 SDK 依赖声明继续适用；本例没有新增运行时依赖。
