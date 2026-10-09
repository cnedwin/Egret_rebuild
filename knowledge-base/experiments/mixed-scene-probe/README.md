# 本地混合图形实验

[English](README.en.md) | 简体中文

在本目录运行 `node run-headless.cjs <已有Playwright模块路径>`，启动新的临时无界面测试浏览器与仅监听loopback的本地页面；运行结束关闭浏览器和服务器。无需安装引擎、执行历史工程或使用用户浏览器资料。默认优先已有Chromium、否则尝试已安装Edge。

本轮实际Edge154.0.4258.62，WebGL2，256×192像素目标。程序生成12三角形透视cube；UI相邻兼容矩形合并为顶点数据并实际一次draw，按batch header绑定texture/blend/scissor。文字是Canvas生成的英文纹理，骨骼仅两段刚性变换，序列帧为3×1颜色fixture图集；不是完整字体、动画或3D资源导入。

首项CPU参考逐pixel、逐command读取原始rect/clip/pipeline/color，没有调用批次builder或executor；当前6条命令实际为3个draw，49,152像素、196,608通道最大误差1，在预先规定的±3容差内。另故意忽略clip/pipeline得到GPU像素反例；透视mesh叠UI、两个骨骼确定帧、图集两帧及真实contextlost/restored后的资源重建分别检查。

证据链从知识库根目录计：

- `evidence/mixed-scene-probe-empty-results.json`：空renderer1通过/6失败；当时恢复比较只看相同输出，空图也可通过，该弱点如实保留。
- `evidence/mixed-scene-probe-strict-empty-results.json`：加非空守卫后空renderer0通过/7失败。
- `evidence/mixed-scene-probe-shared-builder-results.json`：实现后7通过，但首项CPU参考还共用builder，不能声称独立分批对照。
- `evidence/mixed-scene-probe-results.json`：修正为独立逐命令oracle，实际重新运行7通过/0失败；无页面或console错误。

各版五份页面/renderer/server/runner源码在 `history/empty-renderer/`、`history/strict-empty/`、`history/shared-builder-oracle/`。首次共用的批次模块在 `history/batch-state-probe/model.mjs`；后两版各自的模块在该版 `batch-model-snapshot.mjs`。原报告里的共享模块名称仍保留为`../batch-state-probe/model.mjs`，复核历史hash时映射到上述对应快照。复现请在临时目录恢复完整结构，避免覆盖当前证据；这些历史目录不是当前执行入口。

恢复只比较同一固定帧的像素，并不验证玩法/动画事件恢复；程序生成文字纹理被包括在恢复画面，但没有独立文字质量oracle。renderer字符串不独立认证硬件加速。没有PBR/光影、蒙皮约束/附件、滤镜/任意遮罩、实际小游戏/原生宿主、WebGPU场景后端、手机、GPU计时/功耗或旧工程迁移验收。
