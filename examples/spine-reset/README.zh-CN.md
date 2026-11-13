# Spine 资源版本 RESET

[English](README.md) | 中文

运行 `pnpm build`、`node examples/spine-reset/author.mjs`，然后运行 `pnpm example:browser`。打开 [WebGPU](http://127.0.0.1:4173/examples/spine-reset/index.html?backend=webgpu) 或 [WebGL2](http://127.0.0.1:4173/examples/spine-reset/index.html?backend=webgl2)。固定使用 Node 26.7.0 与 pnpm 11.25.0。

左侧角色替换一个 Spine 资源版本，右侧角色以独立玩家继续借用初始共享资源。第一版为红色身体/蓝色头部，第二版为更窄的绿色身体/黄色头部。两版均为原创程序化 JSON/图集/PNG。author 命令在被忽略的 work 存储中保留源和工件副本，使用现有公开 manifest 构建器；不修改用户素材，也不认证 Editor 导出。

依次操作准备、CPU 提交和提交显示。准备会加载并初始化离线零时刻候选，并暂存其真实帧。CPU 提交后旧像素仍可见；提交显示才执行独立 Host 呈现。取消和错误动画保留旧活跃玩家。旧动画变化后拒绝会在准备后改变旧姿态，观察真实过期 CPU 拒绝，销毁 upload，再呈现仍活跃的旧玩家。前进由应用明确驱动 Engine 时间；例子不会自动推进。

**准备第二版并保留播放**用 `requestPreserving` 代替 reset 请求。候选在被捕获时接续活跃玩家的轨道、皮肤、速率和位置，因此 CPU 提交并提交显示之后，新版本画在旧版本动画进行到的位置，循环继续，不会重复送达事件。存在尚未应用的命令，或混合正在进行时，请求会被拒绝；前进一步后再试。

再次替换只自动退休槽自有前代实例/组；初始借用组与兄弟玩家仍存活。重放已退休版本展示不可变保存帧的保留。关闭明确退休调用者拥有的初始内容和 loader，分别关闭 Engine/Host，并展示逻辑清理计数。

阅读[固定 CPU RESET 契约](../../knowledge-base/Cns/docs/spine-reset-slot.md)。主动持有 upload 时不要等待 Host idle，应先销毁或提交 upload。真实上传就绪/代次、CPU 提交、submit 和完成彼此独立。原生 submit 可能在发出绘制后抛错，因此本例不承诺 GPU 原子回滚或恢复。

复现有限原生检查：

~~~text
node examples/spine-reset/verify.mjs <Playwright-1.62.1-index.mjs绝对路径> <仓库外新的输出目录绝对路径>
~~~

收集器使用默认有界面 Edge，无额外参数或原生拦截，真实传输及两种后端。保留实际执行输入的精确指纹、未修改 RGBA/PNG 和关闭观察。五个字面量点区分角色和背景，允许每通道一个码值误差。便携结果见 [verification-summary.json](verification-summary.json)；原始执行与独立审查、完整 CI、发布分别记录。

保留播放的验证运行 `node examples/spine-reset/verify-preserve.mjs <Playwright index.mjs 绝对路径> <新的绝对输出目录>`。它以有界面方式启动已安装的 Edge；第三个参数 `software` 改用自带浏览器和软件渲染。2026-11-14 以这种方式在无头 Chromium 153 上通过了 WebGL2 的九项检查。**WebGPU 以及所有硬件项尚未运行**：该机器的软件 WebGPU 适配器在这个示例启动时即丢失设备。

第一方代码、几何、像素、测试和文档均为 AI 辅助独立编写，采用 Apache-2.0。可选官方 Spine Core 4.3.13 保留[原始附条件许可](../../third-party/spine-core-4.3.13.LICENSE)。素材不复制运行时源码或商业美术。稳定授权 Editor 导出、完整物理/事件兼容、手机/原生 Host、完整 M2.4 及 M1.2 性能仍 OPEN。

## 设备恢复

同一示例现提供显式恢复重绘，并通过既有 Host generation 检查替换流程。参见[应用恢复契约](../../knowledge-base/Cns/docs/spine-recovery-integration.md)。CPU RESET、应用受控测试与真实原生丢失证据分别记录，历史 verification-summary.json 保持不变。
