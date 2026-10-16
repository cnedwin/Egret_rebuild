# 裁剪图集帧播放

[English](README.md) | 简体中文

先运行 `node tools/build.mjs` 构建仓库，再通过 HTTP 提供仓库静态文件，打开 `examples/trimmed-atlas-playback/index.html`。Canvas 示例解码原创 6×6 PNG，核对编码字节的 SHA256 和解码后完整 144 个通道，再使用公共 Engine、Canvas API 组成场景。无需外部美术资源。

启动两个播放句柄后，每次按钮将手动源时间推进 1/16 秒。左侧仅播放一次，右侧循环；暂停和恢复只影响左侧。两个 Bitmap 始终保持逻辑 4×5 bounds，packed crop 都是 2×3，但 trim 与顺时针打包旋转不同。两个句柄共用不可变 clip，各有独立 exact lease。关闭会依次退役播放、显示对象、所拥有的 lease、Texture 和 Engine/Host；重新加载页面可新建会话。

`trim-rotation-v1` 显式启用五字段 layout。90 度表示像素按顺时针打包；捕获的 image command 在普通显示变换内部应用逆旋转。普通 `sourceRect` 赋值会清除 layout。更换为新的 exact lease，即使 Texture 相同，旧 player 仍失效。sheet 与 playback 借用 lease；会话 Scope 拥有自己 acquire 的 lease。

独立 native collector 只接受 `canvas-2d` 和 `webgpu-textured-2d`。经独立审查的桌面 Edge 运行，每后端完成 11 次普通 readback，包括原对象与 Host 全部退役后，重放未改动的 saved N01 frame。每后端另外两个独立 control context 各先运行新的健康 B@.125 Page，关闭后，再从另一个 origin 的新 Page 运行指定产品突变构建。六个全新上下文的全部 30 次完整 24×16 RGBA 读回均以零容差符合字面 mask；assigned 输出也与健康 mask 不同。参阅[证据与环境](../../knowledge-base/Cns/docs/atlas-frame-layout-evidence.md)及[布局契约](../../knowledge-base/Cns/docs/atlas-frame-layout-contract.md)。截至 2026-10-17 编写截止点，最终公开内容/prepush 与 0.59 Git/远端交付仍待完成。

每个有限场景通过 `node tools/atlas-frame/prepare-native.mjs --repository <绝对仓库目录> --task-root <绝对私有任务目录> --destination <新的绝对私有目录> --playwright-root <已安装的Playwright1.62.1目录> --profile <profile> --kind <ordinary|rotation-sign|trim-y-constant>` 制备。helper 建立独立 disposable owner，保存实际 compiler 输入、输出和原始日志，不改选定的开发仓库。私有配置、snapshot 与 raw artifact 均放在公共仓库之外。

首先执行 helper 返回的带 `--snapshot-only` 命令，状态为 `SOURCE_ONLY_NO_BROWSER`。完整 closure、实际构建 receipt、toolkit、fixture、oracle 与 assigned diff 获得独立审查后，使用同一份 config 路径和原始 SHA256，不带 `--snapshot-only` 执行。collector 使用固定 Playwright/core 1.62.1，以默认 Edge 启动且不增加 flags。source snapshot 不是浏览器接受证明；assigned 页面的 setup、module、readback 或 cleanup 失败不能算识别了产品突变。

有限场景不提供 exporter importer、多页图集、pivot/nine-slice adapter、seek/rate/frame events、动画 retarget、设备恢复、目标手机性能或物理内存保证。第一方代码与原创美术使用 Apache-2.0；素材来源见 `assets/provenance.json`。
