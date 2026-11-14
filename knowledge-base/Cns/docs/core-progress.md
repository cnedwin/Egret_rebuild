# 核心能力与剩余工作

[English](../../en/docs/core-progress.md) | 简体中文

2026-11-14 按 main [39941143](https://github.com/cnedwin/Egret_rebuild/commit/39941143b6340be85ab6b1e59af9c72bb837fbb0) 复盘。工程预览提供可运行的公共示例。工作区包为 private 0.0.0，稳定引擎发行仍待交付。

本页说明当前能力，[工程计划](工程规划.md)说明接下来的工作，子系统契约给出准确 API 和证据范围。历史预览记录不再作为并行的“当前版本”。

## 产品目标与当前实现

白鹭的产品目标包括动画丰富的 2D 游戏、复杂界面、轻量 3D、一体化 AI 创作平台、目标平台发布和旧工程迁移。当前实现提供运行时基础，尚未交付完整的创作、原生／小游戏或迁移产品。

| 领域 | 已有实现 | 仍缺失的能力或验收 |
| --- | --- | --- |
| 显示与渲染 | 熟悉的显示对象、坐标、显式命中几何和不可变捕获；有序 WebGPU／WebGL2 共享路径、相邻准备／合批、纹理页、有界缓冲／目标复用、Alpha 遮罩、可分离模糊、沿用 Egret 名称的[混合模式](blend-modes.md)、颜色矩阵、发光、投影和描边[滤镜](filters.md)、作为显示对象的[视频](video.md)及[可选 WebGL2 图层缓存](webgl2-executor-contract.md#可缓存的-2d-图层) | 固定桌面帧节奏与未测 GPU 时间、更广泛设备与宿主、完整功能参考；Canvas 文字和图像提供者继续使用 |
| 资源与构建 | 清单准入、共享获取／租约、Scope 清理、取消及迟到结果处理；选定 PNG／图集／序列／字体的可复现构建、缓存／工程采用及类型化运行时组 | Spine 二进制产物、选定纹理／mip／压缩变体、更广泛格式／导出器资格与完整场景验收 |
| 动画 | 显式 Engine 时间、Tween、兼容序列替换和共享渲染器上的可选 Spine JSON 播放。独立播放器支持轨道、队列、组合皮肤和有限播放次数。已支持 RESET 和有界跳转／重放，播放保留替换覆盖选定的进行中混合。 | 独立的选定版本参考、导出器变体及真机生命周期验收。 [#213](https://github.com/cnedwin/Egret_rebuild/pull/213) · [#218](https://github.com/cnedwin/Egret_rebuild/pull/218) · [#219](https://github.com/cnedwin/Egret_rebuild/pull/219) |
| UI | 托管布局、变高列表与行焦点、主题／皮肤代次、特效和弹出层／模态层。示例已结合语义投影接入开关、选项组、滑条、标签页、进度条、下拉和多选。 | 最新控件的硬件／WebGPU、实体手机和辅助技术验证，以及完整大场景验收。[UI 语义](ui-semantics.md) |
| 文字与字体 | 只读 CanvasKit／SkParagraph 段落、最终行双向排版、换行、对齐／行数限制、多样式、已提交命中／选区／插入点几何及受管字体集合切换、可选原生单／多行编辑及配对浏览器字体 | 真实 IME 资格、必需文字／字体／墨迹的独立参考、传输／启动及 CPU／Wasm／内存资格 |
| 输入 | 兼容旧鼠标 API、可选多触点路由、键盘／逻辑焦点、响应式示例、移动／动作状态、悬停／滚轮、成组键盘焦点，以及驱动同样按键的[手柄](gamepad.md) | 更广手势仲裁、真人操作、实体手机、输入法和无障碍验证 |
| 2D 世界 | 带跟随、边界、缩放、震动和视差图层的[可选相机](camera-2d.md)，从 Tiled 读取、按区块裁剪绘制的[瓦片地图](tilemap.md)、[粒子](particles.md)，以及带传感器、查询、射线和沿墙滑动角色的[碰撞与简单物理](physics-2d.md)，以及读取 BMFont 和 Egret 格式的[位图字体](bitmap-font.md) | 会旋转的刚体、关节和连续碰撞；等距地图和图块动画播放 |
| 声音 | [可选的 2D 混音器](audio.md)：计入预算的已解码声音、以流播放的长音乐、发声位、带渐变的单首音乐、有名字的音量，以及等待第一次点击、页面隐藏时静音的 Web Audio 后端 | 资源清单中的声音、其他宿主，以及扬声器、手机、Safari 和 Firefox 的验证 |
| 3D | [可选 World3D](world3d.md)提供独立 WebGL2／WebGPU 渲染器，以及 glTF 实例、光照阴影、后处理、蒙皮、变形和文字。物理预览包含形状扫掠、组合刚体、分片求解和玩法辅助组件。 | 后端功能与验收范围见契约。更广资产、设备与性能资格及统一 2D／3D 创作流程仍待交付。 |
| 工程与工具 | 版本化工程快照／事务、换装工作室内打开工程、干净工程包和浏览器冒烟检查、结构化诊断与有界旧 RES／MovieClip 分析 | 工程到运行游戏的创作闭环、集成可视化工具、Agent／Skill／MCP 应用、发布／更新适配和完整迁移 |

## 当前图形与设备验证 — 2026-11-14

SharedFrame2D 是当前唯一的 2D 帧路径。示例通过 `captureSharedFrame` 使用共享 WebGPU 或 WebGL2 Host。原 Canvas Host、早期 WebGPU Host 及 scene3d 原型宿主均已退役，Canvas 文字和图像提供者继续使用。World3D 提供独立的可选渲染器，支持的画布分层与屏幕层合成见其契约。换装工作室的 `/1` 组件路径通过 SharedFrame2D 绘制两块平面背景。`/2` 混合路径将不透明 World3D 画布置于透明 SharedFrame2D 覆盖层下方。早期含 3D 背景的记录对应已退役宿主。 [#180](https://github.com/cnedwin/Egret_rebuild/pull/180) · [#182](https://github.com/cnedwin/Egret_rebuild/pull/182) · [#187](https://github.com/cnedwin/Egret_rebuild/pull/187)

| 范围 | 已记录证据 | 仍需验收 |
| --- | --- | --- |
| 2D 渲染 | 历史软件渲染对比保留 57 个场景的像素基线。已合入的合批暂存修复在 Windows 验证了四组前后像素完全一致。短时 20,000 个位图全移动负载的 WebGPU／WebGL2 rAF p95 在 Windows Edge 从 195.8／55.6 降至 50.0／41.7 毫秒，在 Galaxy Z Fold7 Chrome 从 400.4／133.4 降至 50.2／66.7 毫秒。 | 更广设备、恢复和持续场景仍待验收。此基准在 Fold7 上没有可用的 WebGL2 GPU 计时结果。 [#185](https://github.com/cnedwin/Egret_rebuild/pull/185) · [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) · [#198](https://github.com/cnedwin/Egret_rebuild/pull/198) · [#199](https://github.com/cnedwin/Egret_rebuild/pull/199) |
| 桌面帧节奏 | E20 与当前 SharedFrame2D 各采集 12 秒，分别观察到 1,083 和 800 次容量停顿。每次均有两次提交等待原生回调，队列栅栏的回调最后到达。 | 沿用原正式阈值与结果。当前追踪未将 GPU 执行完成关联到单个 JavaScript 栅栏。 [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) |
| Android 与 iPhone | Fold7 的前序混合场景未达到 100 毫秒触摸响应目标。当前 World3D 独立示例在 Fold7 上用两个后端验证了 CDP 双触点缩放、Android Home 后返回及干净停止。前序 Rally 检查覆盖 120 帧 WebGL2。 | 真人触摸、iPhone Safari、辅助技术和更广生命周期仍待验收。 [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) · [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) · [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) |
| 画布原生文字输入 | 独立适配层在 Windows Edge 157（RTX 5090 Laptop）与 Galaxy Z Fold7 Chrome 157（Adreno 830）上每个后端均通过三项用例。三星原生键盘实际弹出，可视视口从 813.7 缩至 423.2 CSS px。文字通过 CDP 输入。 | 真人中日韩组合输入、候选确认及取消，以及 iPhone Safari、桌面 Firefox 和 Safari 仍待验证。 [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#195](https://github.com/cnedwin/Egret_rebuild/pull/195) |
| 托管原生编辑器 | Windows Edge 与 Fold7 Chrome 各完成 12 轮打开与结束，每个后端六轮，交替覆盖原生单行和多行字段。Fold7 每轮实际显示和收起软键盘，可视视口从 487.2 恢复到 813.7 CSS px。关闭正在编辑的页面时，两个后端均释放原生节点、编辑器租约、已加载字体和段落缓存。 | 原生剪贴板、更广输入法、真人操作和辅助技术继续单独验收。 [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) |
| World3D | 独立浏览器 Worker 在 Windows Edge 与 Fold7 Chrome 上分别通过远程物理修复的三项用例。布娃娃和载具在两个设备的浏览器中分别通过两项 API 用例。前序 Rally 阴影统计与软件渲染物理场景各有独立记录。 | [#169](https://github.com/cnedwin/Egret_rebuild/issues/169) 记录已合入的五项修复。更广玩法、设备性能及 GPU 计时仍待验收。 [#168](https://github.com/cnedwin/Egret_rebuild/pull/168) · [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#201](https://github.com/cnedwin/Egret_rebuild/pull/201) · [#202](https://github.com/cnedwin/Egret_rebuild/pull/202) |
| 混合验收 | 旧 X-D60/1 和 X-MTouch/1 保留含 3D 背景的负载及未达标记录。当前平面 2D 组件的 WebGPU／WebGL2 完成帧间隔 p95 的三个五秒窗口中位数在 Windows 为 26.0／26.4 毫秒，在 Fold7 为 61.2／91.3 毫秒。已合入的旋转重排修复在 Edge 和 Fold7 真机的两个后端均通过背景像素检查。 | #236 的打开工程用例已在 Windows 和 Fold7 通过限定验证。X-D60/2 已在 Windows Edge 的两个后端通过限定合成、键盘、阻塞导入取消与重试和分层丢失恢复检查。Windows WebGPU 还在导入请求阻塞期间恢复了背景层。Fold7 X-MTouch/2 最终横屏检查覆盖 CDP 触控、取消重试及两层丢失，系统竖屏覆盖对齐、合成像素与输入；前一候选另有完整竖屏检查。#92 保留原阈值、历史未达标结果及完整正式验收。 [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) · [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) · [#200](https://github.com/cnedwin/Egret_rebuild/pull/200) |

/2 全脏对照定位了 Spine 几何构造开销。WebGPU／WebGL2 的应用完成帧间隔 p95 在 Windows Edge 降至 21.1／24.3 毫秒，在 Fold7 Chrome 降至 54.6／61.0 毫秒，四组均仍高于 16.7 毫秒。Fold7 在 #255 参考构建中完成了每个后端十轮主动触发的图形丢失与恢复。 [M4.2 测量范围](m4-core-acceptance-plan.md#混合场景帧间隔诊断--2026-11-14)

### UI 与消费者真机进度

Windows Edge 和 Fold7 Chrome 在源码树 `906895d9` 上分别通过 13 个示例、两个硬件后端的共 26 项聚焦检查。采集包含浏览器无障碍树、原生完成帧回读及受控鼠标或触摸。Windows 原完整套件保留 75／93 结果。定向复验确认了树形标记内部实色、按 DOM 实收增量的滚轮消费，以及指针离开前步进器悬停帧的精确像素。集成 UI、读屏语音、真人输入、Firefox 和 Safari 继续开放。 [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

Windows Edge 和 Fold7 Chrome 均通过同一份已安装打包消费者的两个后端。保留播放进度的 Spine 替换在两个设备的每个后端均通过原有九项断言。Fold7 的 Spine 截图采用整数物理像素放大，区分了原采样颜色和合成插值。 [#86](https://github.com/cnedwin/Egret_rebuild/issues/86) · [#93](https://github.com/cnedwin/Egret_rebuild/issues/93)

## 可选 World3D — 2026-11-13

[#147](https://github.com/cnedwin/Egret_rebuild/pull/147) 合入独立渲染器。[#148](https://github.com/cnedwin/Egret_rebuild/pull/148) 和 [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) 扩展材质、场景、纹理和碰撞。[#151](https://github.com/cnedwin/Egret_rebuild/pull/151) 新增折射、光照贴图、景深、合批、文字几何体、变换操纵器及物理能力。[#152](https://github.com/cnedwin/Egret_rebuild/pull/152) 新增功能展厅，扩展 CPU 回归负载、阴影准备和碰撞路径。

[#154](https://github.com/cnedwin/Egret_rebuild/pull/154) 到 [#159](https://github.com/cnedwin/Egret_rebuild/pull/159) 新增角色控制、压缩资源解码、导航、地形与反射、蒙皮人群及场景特效。Windows Edge 通过全部 24 个 WebGL2／WebGPU 固定场景对比和软粒子深度专项检查。此前 Android Chrome 真机证据覆盖示例呈现及两个后端的指定屏幕效果、顶点钩子和斜投影。功能展厅另有 WebGL2 软件渲染记录。各后端和设备的具体覆盖范围见 [World3D 契约](world3d.md)。

[#161](https://github.com/cnedwin/Egret_rebuild/pull/161) 扩展地形和水面、蒙皮人群及特效。Windows Edge 通过 25 个固定 WebGL2／WebGPU 离屏对比，包含体积雾，并通过两个后端的软粒子深度检查。流式地块与水下雾效所有权由独立无头回归验证。地形示例交互、更广设备及正式性能验收仍开放。

自动实例化合并符合条件的网格绘制，仍可逐个拾取网格。稠密网格拾取使用包围盒层级，部分逐帧操作减少了内存分配。所列性能数据来自单台开发机器。 [#163](https://github.com/cnedwin/Egret_rebuild/pull/163)

物理检查点新增形状扫掠、组合刚体、滑动关节、弹簧、接触报告与果冻视觉形变，并扩展静态刚体层级、面接触、成组休眠、分片求解和高速刚体扫掠。随后增加布娃娃、街机式载具、绳索、布料和消息端口物理客户端。对应 PR 记录在使用软件渲染的无头 Chromium 中分别通过 26 和 27 个固定 WebGL2／WebGPU 对比。该批远程物理测试使用 MessageChannel 和 Node 工作线程。后续 Worker 和设备检查见上表，更广玩法与性能仍待验收。 [#169](https://github.com/cnedwin/Egret_rebuild/issues/169) [#166](https://github.com/cnedwin/Egret_rebuild/pull/166) · [#167](https://github.com/cnedwin/Egret_rebuild/pull/167) · [#168](https://github.com/cnedwin/Egret_rebuild/pull/168)

## Windows 合并门禁 — 2026-11-13

代码路线在 Windows 上并行执行独立检查作业和四个测试分片。路线作业选择适用的检查，汇总作业要求各项结果通过。#164 合并前的最终托管工作流从创建到完成用时 13 分 12 秒，最慢分片运行 12 分 33 秒。耗时仅对应这次工作流及其执行机分配。 [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) · [托管运行记录](https://github.com/cnedwin/Egret_rebuild/actions/runs/43294257120)

## 固定混合场景 — 2026-11-08

原换装工作室检查点运行了 X-D60/1 与 X-MTouch/1，包含 6,000 个创作节点、八个双轨 Spine、80 个序列帧实例及 50,000 条虚拟目录。桌面两端的各状态均采集五个窗口。全脏同步阶段耗时 p95 为 WebGPU 74.0 毫秒、WebGL2 87.8 毫秒。该数据用于定位帧耗时，正式全引擎 CPU 仍待测，完成帧间隔未达到目标。Android Chrome 真机在每端采集 100 次受控触摸响应，并验证实际键盘、旋转与 Home 返回。两端响应 p95 为 412.4 与 383.6 毫秒，目标为 100 毫秒。正式生命周期、真人输入与 iPhone 项仍待验收。[固定场景证据](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/fixed-verification-summary.json)

## 固定场景的共享裁剪 — 2026-11-11

两个共享渲染后端在标准裁剪矩形完全包含多边形时复用已规范化的顶点。预算仍按原路径计入几何谓词和顶点元组比较。实际相交或预算无法一次扣除时，沿用既有裁剪路径。

同一 X-D60/1 场景在前台 Edge 预热 5 秒，每个状态采集三个 5 秒窗口。静态与全脏的 Host p95 分别为 WebGPU 34.4 → 17.6、39.5 → 19.2 毫秒，WebGL2 40.9 → 22.6、42.0 → 27.0 毫秒。正式 X 计时和设备目标继续验收。[M4 验收计划](m4-core-acceptance-plan.md)

## 固定场景的 Spine 网格构造 — 2026-11-11

共享几何工厂通过预先捕获的原生数组构造方法一次生成并冻结密集数值数组。数据复制、范围校验、精度和实例身份规则沿用现有契约。Spine 角色继续使用同一公开几何接口。

同一全量变更的 X-D60/1 场景在前台 Edge 做短时对照。动画阶段 p95 在 WebGPU 上为 39.6 → 10.2 毫秒，在 WebGL2 上为 47.4 → 9.7 毫秒。完成帧间隔 p95 分别为 68.7 → 42.5 和 83.0 → 47.1 毫秒。两端各预热 5 秒并采集三个 5 秒窗口，完成帧间隔仍高于正式目标。[M4 验收计划](m4-core-acceptance-plan.md)

同一部 Android 真机运行 X-MTouch/1 时，动画阶段 p95 在 WebGPU 上为 51.1 → 11.6 毫秒，在 WebGL2 上为 68.1 → 11.7 毫秒。完成帧间隔 p95 分别为 112.8 → 68.9 和 132.3 → 77.2 毫秒。Host p95 分别从 23.0、42.1 升至 29.6、43.7 毫秒。这是 USB 供电下顺序采集的短时对照，正式手机帧率和触摸响应目标仍待验收。

## 精简桌面参考场景增量 — 2026-11-08

原换装工作室检查点通过同一个 Engine 组合两个独立控制的 Spine 角色、序列帧、带原生重命名的托管 UI 及不透明 3D 背景。配色候选复用 Spine RESET 与共享 Host 准备流程。导出的快照重新打开后保留稳定 ID 和创作值。每个后端通过十项检查，覆盖字体拒绝、拖出原行再释放、替换失败、重试及退出清理。[换装工作室](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/README.zh-CN.md)

[#204](https://github.com/cnedwin/Egret_rebuild/pull/204) 已交付浏览器内打开工程，沿用现有工程事务，并保持角色稳定 ID、顺序和版本固定值。后续 [#236](https://github.com/cnedwin/Egret_rebuild/pull/236) 处理配色往返切换和取消边界。最后一个使用初始配色组的角色替换后，释放该组。工程开始提交后，打开按钮禁用至首帧结束。Windows Edge 两后端各通过十项。Fold7 Chrome 使用浏览器文件对象和 X-MTouch/1 档位，两后端各通过五项。

六次本地回环冷启动观测中，WebGPU 和 WebGL2 的传输分别为 28.91 MiB 和 28.73 MiB。浏览器记录三份字体 16.36 MiB，CanvasKit WASM 8.20 MiB。当前桌面到首个可交互帧的中位数分别为 885 ms 和 744 ms。正式压缩、限速及设备配置仍由 #92 验收。

## 弹出层与模态层增量 — 2026-11-07

M3.4 新增[根级弹出层与模态层](ui-layers.md)、分阶段发布、裁剪锚点、嵌套关闭、指针屏障、逻辑焦点包含及原生编辑暂停。现有表单整合详情、重命名与返回，共享既有资源。完整控件、手势、语义投影和设备与辅助技术验收仍归 #90，本增量不实现由其他贡献者负责的触摸工作。

M3.4 手机补充验证在两个共享后端观察32项当前设备断言，修复回退焦点自动激活输入和系统旋转丢失组合文本。见[层级证据](ui-layers.md)，首次锁屏拒绝及真实失败均保留。其他设备／输入法、语义及完整 M3.4／M4 仍待完成。

## 原生编辑增量 — 2026-11-07

M3.3 提供可选原生 input／textarea 编辑，复用已提交文本／选区／组合状态、段落／UI 发布、配对字体和行／资源生命周期。最终桌面批次每后端通过固定 21 项及响应式八项；三星实际软键盘观察与最终准确源码的 Android 生命周期检查分别记录在 [Android 补充验证](android-native-text-editing.md)。桥接器修复取消后的终止组合回调，响应式表单在宽度切换时退役独立界面 Scope。其他输入法／设备、系统剪贴板、无障碍、完整工作包及 M1.2 继续开放；触摸分工和固定夹具不变。

## 已实现包与入口

仓库有四个基础包和一个显式可选 Spine 包。这是实际工作区，不是远期目录提案。

| 包 | 当前责任与入口 |
| --- | --- |
| @egret/contracts | 不依赖其他产品包的共享契约与资源记录 |
| @egret/runtime | 无宿主依赖的显示、事件、Scope、资源及文字／输入／UI 状态；仅依赖 contracts |
| @egret/engine | 公开装配、时钟、资源、UI／动画协调及显式浏览器后端；依赖 runtime／contracts |
| @egret/project | 工程事务及选定内容／导入工具；依赖 contracts 和已声明解析器 |
| @egret/spine | 可选第一方资产／播放器／显示／RESET 整合，采用官方 Core 4.3.13；依赖公共白鹭边界及单独许可的运行库 |

默认 Engine 导入不初始化 Spine、3D、段落 WASM 或原生虚拟机。[实际包结构](工程技术架构与项目结构.md)、包清单和公共入口契约定义可用名称。计划中的 CLI／编辑器／原生包不是已安装产品。

当前使用契约：

- [共享渲染](shared-render-profile-contract.md)、[WebGL2](webgl2-executor-contract.md)、[资源恢复](resource-recovery-contract.md)和[共享 UI 特效](shared-ui-effects.md)。
- [构建到运行时内容](content-build-pipeline.md)、[多页图集](multipage-atlas-content.md)和[字体资源／代次](font-resource-generations.md)。
- [Spine 资产／播放／显示](spine-content-ingress.md)、[Spine RESET](spine-reset-slot.md)、[序列控制](sequence-controls.md)和[序列 RESET](序列动画RESET替换.md)。
- [托管 UI](ui-data-panel.md)、[多样式段落](paragraph-styled-runs.md)、[已提交文字几何](paragraph-text-geometry.md)、[字体／布局控制](paragraph-layout-controls.md)和[主题](ui-theme-generations.md)。
- [多触点输入](multi-pointer-input.md)、[键盘／焦点](keyboard-focus-input.md)、[移动／动作控件范围](m3-ui-text-input-plan.md)和[响应式示例](mobile-examples.md)。
- [World3D](world3d.md)、[工程事务](工程事务核心合同.md)和[旧工程迁移范围](旧工程迁移.md)。

独立的可选集成包提供 Tiled／TMX 工具、2D 物理、浏览器音频与存档、ZIP 资源、KTX2 检查及 RGBA8 解码和多语言，各能力都有显式入口。

## 现有工作包

M2–M4 的十一个工作包均保留完整验收要求。下表确认已合并能力，不据此宣布整个工作包完成。

| 工作包／Issue | 已交付基础 | 剩余结果／协调责任 |
| --- | --- | --- |
| M2.1／[#83](https://github.com/cnedwin/Egret_rebuild/issues/83) | PNG、图集、多页、序列、字体构建／运行时及可选 Spine JSON 接入 | 二进制／变体构建、授权选定版本参考清单／内容维护者 |
| M2.2／[#84](https://github.com/cnedwin/Egret_rebuild/issues/84) | 独立 Spine 实例、轨道／队列、皮肤、有限播放及序列控制；基于有界历史的[分阶段跳转](spine-seek.md)，在原创夹具上带物理时与直接运行相等 | 完整合格语义、独立的物理参考和检查点／动画维护者 |
| M2.3／[#85](https://github.com/cnedwin/Egret_rebuild/issues/85) | 显式 egret-shared-linear/1 下的共享 Spine 几何 | 完整附件／裁剪／双色／混合／采样参考／渲染维护者 |
| M2.4／[#86](https://github.com/cnedwin/Egret_rebuild/issues/86) | 可编辑 20-Spine／200-序列示例、RESET、兼容序列状态保留、保留播放（含进行中的混合）的 Spine 替换及选定恢复 | Spine 保留播放的硬件验证，以及组合动画生命周期／预算验收／资源动画维护者 |
| M3.1／[#87](https://github.com/cnedwin/Egret_rebuild/issues/87) | 托管布局、稳定键虚拟化、锚点、焦点／定位、字体／主题整合及有界编辑行保留 | 完整一致 UI 场景／UI 维护者 |
| M3.2／[#88](https://github.com/cnedwin/Egret_rebuild/issues/88) | 只读多样式文字、几何和字体代次 | 必需独立参考及 provider 成本／恢复资格／文字维护者 |
| M3.3／[#89](https://github.com/cnedwin/Egret_rebuild/issues/89) | 触点路由、[悬停与滚轮路由](pointer-hover.md)、键盘／焦点、行整合及原生单／多行纯文本编辑 | 真实 IME／移动键盘、真实鼠标／手写笔／触控板会话、剪贴板及无障碍资格／输入宿主维护者 |
| M3.4／[#90](https://github.com/cnedwin/Egret_rebuild/issues/90) | 遮罩／模糊、主题、社区移动／动作状态，[悬停、开关、多选一、范围、滚动和文本框状态](ui-controls.md)及[它们的常用按键](ui-controls.md#按键)，以及[语义树及其浏览器投射](ui-semantics.md)，它跟随[托管列表的行](ui-semantics.md#托管虚拟列表)，并描述[它的盒与层](ui-semantics.md#托管-ui-的盒与层)。一个[设置界面](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.zh-CN.md)把这些与主题、文本框、托管列表和模态层放在一起，另有一个[下拉选择](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)把弹出层锚定在滚动列表的一行上，[带进度条的标签页](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.zh-CN.md)也有了相应的角色。此后又有行菜单、多行选择、带朗读消息的按步数量、作为网格的行囊、可排序的表格和树；[全部界面见索引](ui-examples.md) | 整合场景中的遮罩与模糊组及设备恢复、U 夹具、手势，以及真实辅助技术会话／UI 维护者与现有触摸贡献者 |
| M4.1／[#91](https://github.com/cnedwin/Egret_rebuild/issues/91) | 可编辑精简与固定 X 换装场景、浏览器内打开已导出工程、双后端计时和有界 Android 证据 | 选定能力覆盖、混合合成评审与正式 X 验收／集成与验收维护者 |
| M4.2／[#92](https://github.com/cnedwin/Egret_rebuild/issues/92) | 固定桌面恢复、Android 组件证据及共享裁剪／几何构造的短时对照 | 完整混合生命周期、性能和必需设备验收／性能平台维护者 |
| M4.3／[#93](https://github.com/cnedwin/Egret_rebuild/issues/93) | 可观察预览失败／取消／重载、公开贡献入口，以及对打包后的默认引擎在 Node 中的自动[干净消费者检查](clean-consumer.md)，含一个在软件渲染下用 WebGL2 完成绘制并响应按下的消费者页面 | 已发布的分发物、消费者页面在 WebGPU、硬件和其他浏览器上的运行、实测的首次可交互、真人演练与合格交接／发布维护者 |

角色表示责任，不代表人员配置或自动分派志愿者。保留既有触摸／控件贡献边界，其余工作消费对应接口。

## 继续开放的证据

M1.1–M1.5 工程已集成。最新固定 Windows 正式对照中，静态／稀疏／全脏 Engine p95 中位数为 **5.0／5.9／5.3 ms**，包含准备的 Host 为 **2.5／3.2／2.8 ms**。三种状态均满足 Engine 8 ms 和准备 4 ms 上界。 稀疏和全脏的按时长加权墙钟间隔 p95 高于 16.7 ms，#55 的节拍验收仍开放。 GPU 时间仍未测，整体 D60 仍待验收。历史失败与最新证据见[验证记录](incremental-frame-preparation-evidence.md)。

[Android 报告](android-device-validation.md)记录了有限 WebGPU／WebGL2 组件、生命周期与受控恢复，包括 #129 字体注册示例修正和 #130 新增十二个诊断／生命周期用例。历史约 41.4 ms 回调触发条件未复现；精确堆／后备存储观察不能证明物理内存或通用零泄漏验收。已撤回的错误目标启动报告不是 Engine 回归。

这些手机证据不等于完整 X-MTouch/1、混合百次生命周期／十次恢复、必需 iPhone／IME／无障碍记录或完整授权 Spine 素材。API 探测、模拟输入、CI 或短时回调采样不能关闭这些项目。

M0 的[独立新贡献者演练 #52](https://github.com/cnedwin/Egret_rebuild/issues/52)及[剩余场景／权利／设备资格 #54](https://github.com/cnedwin/Egret_rebuild/issues/54)同样保持开放。它们阻塞相应声明，不阻塞无关实现。

## 下一开发阶段

换装工作室在运行中的页面内以一次编辑事务打开已导出的工程。原始打开工程用例已在软件 WebGL2 通过。[#236](https://github.com/cnedwin/Egret_rebuild/pull/236) 后续修复已在 Windows 和 Fold7 通过 WebGPU 与 WebGL2 限定验证。[#91](https://github.com/cnedwin/Egret_rebuild/issues/91) 已有 X-D60/2 与 X-MTouch/2 双画布负载在 Windows 和 Fold7 上的限定功能证据。#55 需为稀疏与全脏墙钟间隔固定基于相同输入的 SharedFrame2D 成对测量方案。#92 在 #91 选定能力和经评审的后继档位就绪后开展正式验收。

#86 已有[保留播放的 Spine 替换](spine-reset-slot.md#保留播放)，已逐 tick 对照被替换的播放器检查，并在软件渲染 Chromium 的 WebGL2 上通过。其硬件验证和组合动画生命周期继续并行推进。#89／#90 处理剩余输入法、控件与语义。#93 已有对默认引擎及其入口和声明的自动干净消费者检查。打包后的消费者工程也已通过软件 WebGL2 浏览器冒烟检查。硬件与 WebGPU 运行、选定预览产物的首次交互正式验收和真人演练仍待补齐。完整交接仍依赖 #91／#92。[工程计划](工程规划.md)列出依赖和退出标准。

## 历史记录

[更新日志](../CHANGELOG.md)、子系统证据及[复盘基线中的旧进度页](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/Cns/docs/core-progress.md)保留原预览截止、计数、失败、散列及后续修复。本次整理改变呈现方式，不改变执行结果；来源、上游许可和贡献署名留在原记录中。
