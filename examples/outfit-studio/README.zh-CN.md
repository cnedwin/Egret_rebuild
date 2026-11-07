# 白鹭换装工作室

[English](README.md) | 简体中文

这是 M4.1 的首个桌面切片。同一个 Engine 组合了可编辑角色列表、两个 Spine 实例、序列帧效果、程序化 3D 背景和原生重命名弹窗。两个角色起初共享相同图集，各自保留装扮和播放状态。

在仓库根目录运行 `pnpm setup:dev`，然后运行 `node examples/outfit-studio/serve.mjs`。打开输出的本地地址，选择 WebGPU 或 WebGL2。桌面场景使用 960 × 520 的逻辑尺寸和像素比 1。用鼠标或 Tab 与 Enter 选择角色并应用装扮。在详情里选择重命名，再选中字段进行编辑。保存时先用场景字体检查名称，检查通过后提交到工程。名称被拒绝时可在弹窗内重新编辑。取消会丢弃草稿。鼠标操作需在按下的行内释放才会执行。

切换配色通过共享场景 Host 准备新的 Spine 资源。加载期间保留原画面。加载或准备失败时，当前角色与工程仍可使用，同一行可以重试。切换成功后，所选角色沿用既有 RESET 策略重新开始动画。关闭时释放界面、播放、字体、资源组和 Host。重新载入会打开创作数据。

修改 `project.json` 后重启服务即可看到变化。两个稳定实体 ID 标识角色及各自的 `name`、`outfit`、`palette` 字段。「导出工程」会下载当前已提交的快照。通过 `node examples/outfit-studio/serve.mjs --project <快照路径>` 可以打开该文件。播放时间、选择和草稿属于本次会话。示例复用现有工程存储和共享资源管理器。[示例工程](project.json)

工作室沿用 `animation-outfits` 的原创程序化 Spine 和序列帧素材。第二套配色交换现有两张图集页的颜色，并构建新的清单身份。工作室代码及原创场景几何采用 Apache-2.0。[换装素材出处](../animation-outfits/PROVENANCE.zh-CN.md) · [CanvasKit 和 Noto 素材](../paragraph-panel/vendor/README.zh-CN.md) · [Spine 运行时条款](../../third-party/spine-core-4.3.13.LICENSE) · [JSONC 解析器署名](../../third-party/jsonc-parser-3.3.1.LICENSE)

使用 Playwright 1.62.1 和已安装的 Edge，运行 `node examples/outfit-studio/verify.mjs <Playwright 包绝对路径> <新的绝对输出目录>`。同批验证覆盖两个真实浏览器后端、鼠标与键盘、名称拒绝、拖出原行再释放、配色失败与重试、导出重开和退出清理。每个后端采集三次冷 HTTP 启动，截止到首帧完成并允许交互。记录的传输是本地回环未压缩 HTTP。[验证摘要](verification-summary.json)

这是 M4.1 的桌面开发切片。完整混合 X 负载、正式性能与恢复指标、设备资格继续按现有计划验收。[M4 验收计划](../../knowledge-base/Cns/docs/m4-core-acceptance-plan.md)
