# 画布上的文字输入

[English](README.md) | 简体中文

引擎绘制的一个面板，含两个玩家可以输入的输入框：最多八个字的名称，和可以写多行的宣言。编辑使用浏览器原生文本框，由操作系统提供键盘及组合输入。实测范围见下方检查记录。

## 运行

构建各个包，以仓库根目录启动服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

保留服务打印的主机和端口，在那里打开 `/examples/text-input/index.html`。浏览器提供 WebGPU 时页面用它绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以试什么

- 点击名称框，用中文输入法输入。状态行先显示未确定的拼音，然后是选定的字。回车提交。
- 输入超过八个字：刚输入内容里超出的部分会被去掉。
- 点击宣言框。回车插入换行；点击别处提交，或按 Esc 取消。
- 把窗口缩到比画布窄。文本框仍然贴在它的输入框上。

## 工作方式

`main.mjs` 用 `@egret/engine/text` 的 `createTextField` 绘制每个标题和每个已提交的值。在输入框上按下时，调用 `@egret/engine/web/text-input` 的 `input.open`，传入该输入框以舞台单位表示的矩形。文本框打开期间，引擎不绘制这个输入框的文字；会话结束后，游戏保存这个值并重新绘制。

请求的字段、结束会话的规则，以及哪些已检查、哪些未检查，见[指南](../../knowledge-base/Cns/docs/text-input.md)。

## 检查

```text
node examples/text-input/verify.mjs <能解析到 "playwright" 的目录>
```

该命令在无头 Chromium 中以鼠标和手机模拟运行示例，并通过浏览器协议驱动组合输入。另一次真机检查在 Windows Edge 157（RTX 5090 Laptop）和 Galaxy Z Fold7 Chrome 157（Adreno 830）上每个后端均通过三项用例。手机实际弹出三星键盘，可视视口从 813.7 缩至 423.2 CSS px。文字通过 CDP 输入。真人中日韩组合输入与候选字选择，以及 iPhone Safari、桌面 Firefox 和桌面 Safari 仍待验证。[输入验收 #89](https://github.com/cnedwin/Egret_rebuild/issues/89)
