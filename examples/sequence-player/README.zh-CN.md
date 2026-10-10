# 显式时间序列样例

[English](README.md) | 简体中文

使用仓库固定 Node 执行 `node tools/build.mjs`，通过普通本地 HTTP 静态服务器提供仓库根目录，再打开 `/examples/sequence-player/`。显式 import map 解析公共包入口及包依赖；样例只导入 `@egret/engine` 与所选公共浏览器后端。WebGPU 需要兼容浏览器与安全上下文（localhost）。

通过界面选择 Canvas / WebGPU，或使用 `?backend=canvas&mode=once` / `?backend=webgpu&mode=loop`。更改选项会重新载入页面。时间按钮直接提供绝对秒数，没有自动计时器。0 / 0.125 / 0.375 秒分别选择红 2×2 / 绿 1×2 / 蓝 3×1。0.5 秒时 once 保持蓝色并标记 `atEnd: true`，loop 回到红色并标记 `atEnd: false`。Bitmap 从 (16,16) 开始，放大 32 倍，对应显示尺寸 64×64 / 32×64 / 96×32。

内嵌 6×2 RGBA 图集为本样例自主创作，仅加载一次。保存绿帧捕获不可变帧，重放通过公共 host 渲染。释放借用会销毁播放器与 Bitmap、释放调用方租约，再重放已保存绿帧；保存帧自主拥有的像素继续可用。关闭按钮释放剩余调用方资源并关闭 Engine。播放器本身仅借用资源，不安装清理订阅。

此可复现样例不代替原生浏览器验收。Canvas / WebGPU 的实际像素、保存帧重放、性能与目标设备仍需单独执行并记录。不宣称透明过滤精度或完整动画迁移。
