# 可编辑动画与换装参考场景

[English](README.md) | 简体中文

同一个 Engine 渲染 20 个独立 Spine 播放实例，共享一份解析后的设置和两张图集页；另有 200 个独立序列控制器，共享一个片段和一张纹理。四行场景交错呈现 Spine 显示对象、序列 Bitmap 和 Engine 图形。DOM 仅提供控件、画布与状态外壳。此原创几何示例供 M3/M4 复用，不代表完整 M2.4 验收。

## 运行与编辑

准备仓库固定的 Node 26.7.0、pnpm 11.25.0 和 TypeScript 7.0.2 依赖后执行：

    node tools/build.mjs
    node examples/animation-outfits/author.mjs
    node tools/serve-example.mjs --port 4173

打开 [WebGPU](http://127.0.0.1:4173/examples/animation-outfits/index.html?backend=webgpu) 或 [WebGL2](http://127.0.0.1:4173/examples/animation-outfits/index.html?backend=webgl2)。选择角色、服装、动作、循环或两次、速率与暂停状态，再点击应用。应用会推进一次共享的 1/60 秒时钟，让排队的 Spine 命令生效；单步推进 0.1 秒。预览在每次完成绘制后推进固定 1/60 秒模拟时间，不是墙钟播放或性能测量。重新加载或重试会在完整释放后重建场景，关闭也可取消正在进行的加载。

在 [content.mjs](content.mjs) 中编辑原创几何、皮肤、事件和序列帧，再次运行生成命令。生成器在忽略的 work/animation-outfits 下写入可复现的源文件、产物字节和经公开契约接纳的资源清单。这个有限清单生成器不是计划中的通用 Spine 内容导入器、缓存、增量构建或 Editor 工程导出器。

## 所有权与边界

现有清单 Spine 加载器持有元数据、校验完整性的 PNG 页和一份解析设置。序列清单组使用同一个 Engine AssetManager，以及现有字节和纹理提供器；没有额外资源管理器或渲染 Host。每个实例拥有独立 Scope；20 个 Spine 订阅和一个序列协调器使用 Engine 时钟。场景先释放显示对象与控制器，再释放数据、加载器、提供器和 Host。重复打开合并处理，之后的关闭会撤销尚未启动的打开操作；待处理绘制通过 Host 完成信号串行执行。

场景使用现有可选 Spine API，包括 setSkins 与 plays，不增加 SDK 导出。显式的 16 段播放器预算允许界面提供的双倍速 0.1 秒单步。序列控制器上限从 64 提升到既有的 256 个合并目标上限，两个执行点和精确的接纳、拒绝、复用测试同步更新。每控制器预算不变。每次协调器边界推导出的上限为 262,144 个事件和 11,228,160 次搜索迭代，不代表实测耗时或可接受的帧预算。参见[序列契约](../../knowledge-base/Cns/docs/sequence-controls.md)。

## 验证与未覆盖范围

    node --test tests/animation-outfits.test.mjs tests/sequence-controller.test.mjs tests/sequence-controller-lifecycle.test.mjs tests/sequence-controller-integration.test.mjs
    node examples/animation-outfits/verify.mjs <Playwright-index.mjs-绝对路径> <证据目录绝对路径>

采集器使用固定 Playwright 1.62.1 和默认有界面 Edge，不添加启动参数；覆盖两个后端，保存冻结输入指纹、原始 RGBA 和截图。每后端检查 242 个固定初始像素点，覆盖全部 20 个身体与头部和 200 个序列，并对照故意错误的默认颜色预期检查组合换装，还验证有限完成、独立暂停与速率、精确数量、关闭与重载、传输拒绝、挂起源文件的取消与迟到结束、重试。清理证据是逻辑所有权观测，不是物理内存测量。原创几何数据提供独立编写的预期，不构成对官方 Core 算法的独立认证。[验证摘要](verification-summary.json) 记录有限采集结果与修复。

冷热缓存测量、增量内容接纳、跨版本或热替换、GPU 设备恢复、完整 Spine 特性、Editor 导出资格、手机输入和正式性能仍未覆盖。M1.2 先前 10.3 毫秒对比 8 毫秒的性能失败不因本示例改变。完整 M2.4 与 Issue #86 仍保持开放。运行时权利与美术权利分别判断，参见[来源说明](PROVENANCE.zh-CN.md)。
