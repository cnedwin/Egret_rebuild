# 白鹭响应式示例

[English](README.md) | 简体中文

环境准备后运行 `pnpm example:browser`，打开终端显示的网址，可选择资源角色、独立触点、托管 UI 或多语言段落。触摸、鼠标和笔使用已有公开输入桥，同时保留原生控件。面板明确选择 WebGL2／WebGPU。旋转和 DPR 变化时按顺序替换会话并保留应用状态，有效密度为 [1,2]。

既有固定示例和采集器保持原字节，明确链接保留原有输入与像素契约。固定序列帧控件页已支持原生触摸点击，仍按其说明准备内容。本次不增加 Engine 功能，也不自动宣称验收通过。

参阅[布局、所有权、输入和验证契约](../../knowledge-base/Cns/docs/mobile-examples.md)。安装 Playwright 1.62.1 和 Microsoft Edge 后，可运行 `node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>` 复现有限桌面浏览器模拟，输出必须位于仓库之外尚不存在的目录。Android／iPhone 真机、输入法和性能验收继续未完成。
