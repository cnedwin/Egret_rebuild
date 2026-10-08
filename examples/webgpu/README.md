# WebGPU 固定矩形示例

[Complete English](README.en.md)

本示例仅通过公开 `@egret/engine` 与 `@egret/engine/webgpu` API 绘制红色 .5 后蓝色 .5 矩形。在仓库根目录执行 `node tools/build.mjs`，再运行 `node tools/serve-canvas.mjs`，使用它打印的 loopback 地址，把路径改为 `/examples/webgpu/index.html`。需要安全上下文中的原生 WebGPU 浏览器；启动不支持时明确失败。普通示例关闭读回。import map 映射依赖的公开 `robust-predicates` 根入口，包含其六个输出模块，不以产品深层导入替换。

在仓库根目录运行完整原生验证：

```text
node tools/verify-webgpu.mjs --playwright <已安装的-playwright-模块目录> --channel msedge --output <仓库外的私有输出目录>
```

Playwright 和 pngjs 是外部验证工具，不是产品依赖。运行器加载指定 Playwright 目录的公开入口，并从该目录的模块上下文解析公开 pngjs。如另装于其他位置，可传 `--pngjs <已安装的-pngjs-目录>`。不会安装依赖。已检查工具为 Playwright 1.62.1 和 pngjs 7.0.0（MIT）。运行器使用默认 headless Edge、新非持久 profile、安全 127.0.0.1、默认 adapter/device 请求，无额外启动 flags。不支持启动或超时以 INCOMPLETE 非零退出，不隐式 fallback 或记为通过。

固定预期通过下一帧公开 `requestReadback()` ticket 取得原始预乘 RGBA8，ticket 在 `Engine.renderFrame()` 前建立。预期几何和颜色独立于产品工具。普通 UNORM 每通道容差 2；透明黑及完整重置字节要求严格零。严格采样距预期外边界至少一个 backing 像素。名义 DPR 标记明确是边界诊断。扇形扫描跨越内部三角剖分接缝。有理数/Canvas 覆盖按等价预乘表示比较，外边抗锯齿及相邻命令差异另行报告。

运行器在不透明黑/白页面背景各等待两次动画帧，再解码真实浏览器 PNG 截图，浏览器 DPR 为 1，CSS/backing 尺寸 1:1。记录帧/serial、尺寸、CSS、截图比例及 PNG chunk/色彩配置元数据。读回开启与关闭配置都验证。截图仅证明浏览器合成，不证明物理扫描输出。套件覆盖 painter 顺序、继承 alpha、仿射/反射/组合错切、嵌套旋转裁剪及兄弟、DPR、完整 reset/resize、扇形和不可变 A 对修改/重挂后的 B。

有界生命周期检查包括配置上传预算/实际 device limit、close 时真实在途 ticket、普通关闭后借用设备存活、显式销毁独立借用默认设备，以及合作 host 租约以外的 scoped 无效 16 字节 buffer 描述符。它观察真实 validation，不推导 OOM 阈值或任意驱动重置。意外 page/console/network/host 错误均失败；仅明确命名窗口中的受控 loss 诊断及 scoped validation 属预期。

七项有限修改仅作用于仓库外的临时 engine 构建副本：no-op、反序、移除裁剪、重复预乘、平移、不清屏及 DPR 替换。每项必须败于具名固定断言。不清屏使用空红色 .5 帧，避免浏览器新零纹理掩盖遗漏。另有明确标为合成缓存字节的反例，验证完整透明重置断言本身。副本、精确补丁、原件/副本 hash、原始字节、PNG 与请求日志保持私有；最终原产品 hash 必须一致，修改构建不作为产品导出。

实际运行以 `result.json` 为准。任何选定正例失败，即使其他检查通过，仍为 FAIL/非零；启动不可用为 INCOMPLETE/非零。本实验切片不证明硬件认证、手机、性能、文字/纹理/UI、3D、迁移或完整引擎。
