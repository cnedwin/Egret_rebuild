# 序列控制

[English](README.md) | 简体中文

本原创有限示例使用可选公开入口 `@egret/engine/animation`。A、B 共享通过真实内容构建生成的四色纹理和片段，分别拥有 Bitmap、Scope 和控制器。标题条、白色覆盖层和裁剪均由 Engine Sprite 呈现；DOM 按钮调用公开接口，不负责绘制动画内容。

完成仓库的标准依赖准备和构建后，使用固定的 Node 26.7.0。先创建被忽略的 `work/sequence-controls` 父目录，再从仓库根目录运行：

```text
node examples/sequence-controls/author.mjs --parent ABSOLUTE_REPOSITORY/work/sequence-controls
node tools/serve-example.mjs
```

作者工具输出新建并保留的运行目录。将其中目录名填入回环服务器地址 `/examples/sequence-controls/index.html?backend=webgpu&config=/work/sequence-controls/run-XXXXXX/browser-config.json`。将后端改为 `backend=webgl2` 可使用 WebGL2。每次运行保留项目、严格配方、源文件指纹、候选快照、回执、清单和产物。页面验证候选快照及清单字节，并沿真实生成选择器读取资源，再通过 ManifestByteSource、ManifestTextureProvider 和清单资源组加载。元数据是 Aseprite 1.3.18.6 格式的合成输入，不代表真实导出器验收。

A 以速率 1 播放两次；B 以速率 2 无限循环。四帧时长均为精确的 0.25 秒。标记按 zero@0、half@0.5、halfAgain@0.5、end@1 的顺序定义。采集器使用 [fixture.mjs](fixture.mjs) 独立写定的 11 阶段字面表，包含暂停 B、将 A 改为速率 2、A 在黄色终帧完成，以及 B 静默向后跳转并继续。逐行比较完整事件记录、状态与采样字段，检查两个实例的不透明 RGBA、背景、覆盖层和裁剪边界。保留初始共享帧，在两个实例前进后回放，检查整帧字节完全恢复且时钟与事件不变。独立的监听器抛错和目标已释放场景检查另一实例继续推进及有限诊断。两帧十进制片段还检查五个相邻 binary64 边界字面值及向前补发。

使用已安装的 Playwright 1.62.1 和默认 Edge 进行有限真实浏览器采集：

```text
node examples/sequence-controls/verify.mjs --playwright ABSOLUTE_PLAYWRIGHT_PACKAGE --output NEW_ABSOLUTE_DIRECTORY_OUTSIDE_REPOSITORY
```

采集器不执行仓库构建。它生成真实内容产物，在启动浏览器前冻结字面参考、实际浏览器导入闭包、对应源码与类型闭包及作者工具输入，仅提供已捕获的路由。以默认无额外参数的无头 Edge 分别运行 WebGPU、WebGL2，保存完整原始 RGBA、PNG、全部记录和失败，清理后复核快照与源文件身份。原生可用性与失败分别记录；旧输出不覆盖。

清理证据包括真实 Scope、Bitmap、控制器终止，通过公开拒绝读取验证资源组租约释放，纹理已释放，原生源和提供器当前计数归零，宿主空闲及关闭，应用错误记录。所有控制器终止后，必须能创建 256 个真实 GameClock 订阅，第 257 个必须拒绝，随后释放全部探针句柄。这验证公开槽位容量，不虚构协调器计数，也不证明物理内存回收。

源文件与参考检查：`node --test examples/sequence-controls/fixture.test.mjs`。这些是源码契约和独立字面检查，不是浏览器或 SDK 行为验收。本文不暗示浏览器已通过，实际保存的采集结果才提供该证据。手机输入、性能、完整 M2.1、Spine、长时间运行和迁移验收不在本示例范围内。
