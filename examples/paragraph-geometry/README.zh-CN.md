# 文字几何示例

[English](README.md) | 简体中文

运行 `pnpm example:browser` 并打开 `/examples/paragraph-geometry/index.html`。通过既有 UI 和共享渲染器绘制多语言段落、源文本选区与光标；DOM 表单提供源偏移和局部查询坐标，不增加场景触摸监听器。

使用 `?backend=webgl2` 或 `?backend=webgpu` 选择后端。示例复用现有具有明确身份的可选段落后端与字体，不增加引擎默认依赖。详见[契约](../../knowledge-base/Cns/docs/paragraph-text-geometry.md)。这只是只读几何预览，不代表编辑器、输入法、设备或性能验收。
