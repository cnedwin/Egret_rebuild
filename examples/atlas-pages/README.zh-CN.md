# 多页图集示例

[English](README.md) | 简体中文

完成 `pnpm setup:dev` 后运行 `node examples/atlas-pages/author.mjs`，生成原创 PNG／源文件并调用真实内容构建和采纳管线。运行 `pnpm example:browser`，打开 `/examples/atlas-pages/index.html?config=/work/atlas-pages/run-XXXXXX/browser-config.json`，将目录替换成实际输出值。默认 WebGL2，通过页面链接或 `&backend=webgpu` 选择 WebGPU。

场景展示两页同名局部帧，以及裁剪／旋转帧。释放按钮依次结束显示、数据和浏览器提供器的所有权；不安装触摸控件。

可选有界采集器为 `node examples/atlas-pages/verify-browser.mjs <playwright-1.62.1-root> <新输出目录>`。使用已安装的默认 Edge，每个后端比较七个预先编写的像素点，并另用两个上下文验证受控 HTTP 失败／取消，保存原始读回、截图和源身份；不作为性能或设备基准。

见[内容契约](../../knowledge-base/Cns/docs/multipage-atlas-content.md)。源和像素为第一方原创 Apache-2.0 夹具，不代表 Spine、导出器、手机或完整 M2 验收。
