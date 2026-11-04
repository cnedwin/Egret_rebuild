# 按 key 定位虚拟列表

[English](README.md) | 简体中文

这个独立编写、采用 Apache-2.0 的验证示例通过公开可选 UI 入口绘制 50,000 条带 key 的记录。目标行的高度从估算的 20 变为实测的 80 逻辑像素；先显式居中定位，检查提交结果，再调用现有仅可见行焦点接口。白色条表示焦点。原生 Space 取消和 Enter 投递沿用现有 Canvas 键盘桥接。示例不新增输入监听器、素材、字体或依赖。

运行常规示例服务器，打开 `/examples/ui-key-navigation/index.html?backend=webgpu` 或 `?backend=webgl2`，点击定位按钮。采集命令为 `node examples/ui-key-navigation/verify.mjs <Playwright-1.62.1-directory> <new-external-output-directory>`，使用默认 Edge，不添加启动参数。启动前冻结实际运行时导入、源码身份和采集器辅助模块，保存四个明确像素点的参考、原始 RGBA、截图及清理观察。生成的结果摘要仅是输出，不作为冻结输入。

这些桌面检查不证明平滑滚动、自动跨屏 Tab 遍历、原生编辑/IME、无障碍、真机或性能验收。参见[接口约定](../../knowledge-base/Cns/docs/ui-data-panel.md#按-key-定位)。
