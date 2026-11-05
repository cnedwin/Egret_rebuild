# 序列动画 RESET 示例

[English](README.md) | 简体中文

用新的不可变内容代次替换 A，同时 B 保持独立的序列时钟。A 初始为红/绿/蓝/黄，每帧 250 毫秒；v2 为青/紫/蓝/白，每帧 500 毫秒。这些字面颜色与时长均为 Apache-2.0 下的第一方原创夹具。作者工具复用 `examples/sequence-controls/sources/page.png`、`atlas.json` 和前三条配方，只改写私有生成副本，再运行既有内容构建器。未引入外部美术、导出器验收或新依赖。

构建仓库并创建 `work/sequence-reset`，运行 `node examples/sequence-reset/author.mjs <work/sequence-reset 的绝对目录>`。启动既有示例服务器，使用返回目录打开 `/examples/sequence-reset/index.html?backend=webgpu&config=/work/sequence-reset/run-XXXXXX/config.json`；另一个后端改为 `webgl2`。页面将推进、加载/暂存、CPU 提交、Host 提交、显式恢复、取消和关闭分成独立操作。

实际浏览器有限采集命令为 `node examples/sequence-reset/verify.mjs <已安装 Playwright 1.62.1 的 index.mjs> <仓库外新的绝对证据目录>`。采集器创建两个内容代次，记录启动前源码/产物/声明身份，然后在两个真实 Host 上验证字面像素读回、截图、已取消/已回收内容的保留帧，以及逻辑清理。先前失败执行单独保留；不隐式重建、不拦截原生接口，也不添加设备标志。

参见[契约](../../knowledge-base/Cns/docs/序列动画RESET替换.md)。成功 CPU 提交后，候选停在零时刻，此前正在运行的借用初始控制器保持暂停。Host 就绪/提交/完成分别观察；不承诺发布后回滚，不据此宣称设备恢复、手机、性能或完整 M2.4 验收。
