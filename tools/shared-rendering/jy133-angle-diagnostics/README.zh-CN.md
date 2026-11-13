# JY 战斗 133 ANGLE 诊断

[English](README.md) | 简体中文

## 当前状态

调查已暂停。独立的 Ubuntu 24.04.5 WSL2 环境保留了已下载的依赖和增量构建结果。Chromium 157.0.8103.78 固定在 `4b3d0dabb8250b6f152d2d85d79e7706e309d087`，ANGLE 依赖固定在 `c56e2a4a9b8cb0040920c995a268be559ba53f1c`。两个探针均已编译成 AArch64 对象，事件名已在二进制中核对。手动中断时，Siso 报告完成 31,846 项、失败 0 项、剩余 43,653 项。完整 APK 仍待生成、安装和真机验证。

此前 Fold7 原提交顺序的跟踪在首次武学落点点击后约 5.574 秒抓到两次 EGL 围栏创建慢提交，分别为 22.932 和 27.659 ms。同批随后两个原生 Flush 分别耗时 5 和 1 µs。它们与历史 70–71 ms 尖峰是否共用一个驱动函数或锁，仍待确认。

## 续接步骤

1. 复用独立 Linux 工作树 `/opt/jy133-build/src`。构建脚本要求 Chromium 和 depot_tools 均已核对并位于 `/opt/jy133-build` 下。用现有的 Linux 脚本副本续跑，或先复制一份固定副本。第一个参数为 ANGLE 补丁，第二个参数为存有 `isolated-browser-launch.diff` 的绝对产物目录。脚本会复用已同步的依赖和增量编译结果。
2. 核对 ARM64 APK、独立包名 `org.chromium.chrome`、shell 采样权限，以及 APK 原生库与保留符号的 Build ID。安装时，将 `JY_ADB` 和 `JY_PHONE_LOCK` 分别设为 ADB 与已有共享设备锁的绝对路径，将产物目录传给 `node install-diagnostic.mjs`。手机被占用或诊断包已存在时，安装会停止。
3. 使用已有私有战斗夹具和真机操作路线。确认实际渲染为 ANGLE OpenGL ES 3.2、Adreno 830、驱动 0800.64.8，并在预期 GPU 线程中捕获两个探针。保留完整 HUD、原绘制负载、围栏、Flush 和错误检查顺序。禁止额外 Flush。将浏览器轨迹与 BOOTTIME Perfetto 采集配对，并将配置中的 `JY_GPU_PID` 替换为诊断版 GPU 进程 ID。
4. 对成对采集结果执行 `node analyze-angle-stacks.mjs <采集目录> <Trace Processor> [轮次]`，核对时钟和采样覆盖。用模块 Build ID 与相对 PC 比对驱动栈帧。确认共用锁还需要同一等待对象或锁地址及持有者证据。找到可修复的根因并完成真机复验后，再发布引擎改动。

此分支保留诊断补丁和可复用工具。原始游戏夹具、真机原始轨迹和 Linux 构建缓存保存在本机工作区。

## 来源

- [固定版本 Chromium Android 构建说明](https://github.com/chromium/chromium/blob/4b3d0dabb8250b6f152d2d85d79e7706e309d087/docs/android_build_instructions.md)
- [固定版本 ANGLE Android 设置](https://github.com/google/angle/blob/c56e2a4a9b8cb0040920c995a268be559ba53f1c/doc/DevSetupAndroid.md)
- [Perfetto 线程调度数据](https://perfetto.dev/docs/data-sources/cpu-scheduling)

补丁上下文来自上述版本的 Chromium 和 ANGLE，上游文件保留原有许可。诊断探针和辅助脚本为本次调查编写。
