# Canvas矩形示例

[English](README.md) | 简体中文

> **已改用共享 Host。** 本示例默认用共享 WebGPU Host 绘制，加上 `?backend=webgl2` 时用共享 WebGL2 Host。此前使用的 Canvas Host 已移除；下文提到的验证命令为它编写，不再适用。下文关于 Canvas Host、选择 Canvas 以及已记录的 Canvas 检查的说明，描述的是早先的版本。

先在仓库根执行`pnpm install --frozen-lockfile --ignore-scripts`及`node tools/build.mjs`（或`node tools/verify.mjs`），生成未纳入源码发行包的dist产物。通过HTTP服务仓库根，再打开`/examples/canvas-scene/index.html`。导入映射连接构建后的核心与独立web入口；指针操作改变矩形并重新绘制，仅展示局部场景交互。

渲染变更须另运行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`；亦可配置PLAYWRIGHT_MODULE。默认prepush仅运行结构与headless门禁，不包含真实浏览器。浏览器须已安装，工具不安装依赖。

可从仓库根执行`node tools/serve-canvas.mjs`启动本地HTTP服务，打开它输出的URL；Ctrl+C停止。
