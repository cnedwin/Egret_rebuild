# 图集帧布局证据与限制

[English](../../en/docs/atlas-frame-layout-evidence.md) | 简体中文 · [公开契约](atlas-frame-layout-contract.md)

**编写截止点：2026-10-17。** 0.59.0 工程预览候选已有独立接受的 SDK 和有限桌面 Canvas/WebGPU 结果。截至此处，当前完整十三阶段验证器、最终公开内容/prepush、受影响的既有浏览器门禁、0.59 commit/push/PR/Main 和远端 CI 仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议为 1.0。

本增量通过现有 Bitmap 和序列 runtime，在标准化单页 trim 与顺时针 90 度打包后保持精灵逻辑画布稳定。[契约](atlas-frame-layout-contract.md)定义 API 与所有权规则；[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.zh-CN.md)演示组合方法。

## 已接受的证据

| 分项 | 已接受结果与范围 |
| --- | --- |
| SDK 源码与聚焦行为 | 已审查实现保留默认矩形路径、拥有的五字段 layout、精确 lease 检查及 `M * S` 几何。聚焦运行通过 48/48 项测试，九项专用严格/源码门禁全部通过。 |
| 完整 SDK 运行 | 已接受的十二阶段 `node tools/verify.mjs` 通过核心 3559/3559 及单独 Spine 实验 160/160，两套 failed/cancelled/skipped/todo 均为 0。这是较早的 SDK 截止点。新登记的第十三个图集源码边界阶段已有单独正向 Source 运行：114 个 modules、1470 个 inputs、117 条 routes；这不等于完整十三阶段重跑。 |
| 素材与独立 oracle | 第一方图集/出处及字面 mask 已审查，纯 oracle 检查通过 23/23。它们本身不证明浏览器像素。 |
| 公开会话与验证策略 | 已接受的 R3 CPU 套件通过 17/17：三项真实公开 SDK 会话测试及十四项策略测试。真实捕获执行 N01–N10，并触发实际 Scope 清理故障；与原生运行分开记录。 |
| 原生输入 closure | 六个场景、十个 role owner、14896 个唯一原始文件已在启动前获得独立准入，包含实际编译产物、固定工具链、素材、oracle、routes 和所提供模块的完整 closure。 |
| 原生像素、播放与退役 | 六个实际作业均在首次尝试通过，各使用一个全新上下文。30 次完整读回均以零容差符合独立字面 mask；assigned 帧也与健康 mask 不同。ordinary N11 在原资源退役后通过 distinct Host 重放。各 role 前后身份及实际加载响应身份均已保留并经独立审查。 |
| 最终门禁与交付 | 此处当前完整验证、最终 prepush/公开内容及受影响的既有浏览器门禁仍待完成。不指定 0.59 commit、PR、Main 或远端 CI 结果；没有远端检查项不等于 CI 通过。 |

## 实际原生结果

记录于 2026-10-16 UTC 的六个作业均以 exit 0 完成、无超时，PASS 报告已获接受。每次读回覆盖完整 24×16 surface：384 pixels / 1536 RGBA channels，容差为零。

| 后端 | Ordinary | Rotation-sign 对照 | Constant-trimY 对照 | 上下文 / 读回 |
| --- | --- | --- | --- | --- |
| Canvas 2D | N01–N11：11 次匹配 | 全新 healthy + assigned：2 次匹配 | 全新 healthy + assigned：2 次匹配 | 3 / 15 |
| 纹理 WebGPU 2D | N01–N11：11 次匹配 | 全新 healthy + assigned：2 次匹配 | 全新 healthy + assigned：2 次匹配 | 3 / 15 |

记录环境为 Windows x64 10.0.26300、Node.js 24.19.0、Edge 155.0.4283.45（`msedge`）、Playwright/core 1.62.1，不增加启动 flags。浏览器 viewport 为 640×480、device scale factor 为 1；比较 surface 为 24×16。SDK 构建使用 pnpm 11.25.0 和 TypeScript 7.0.2。全部原对象、Host、context、browser 和 server 均已关闭；最终 diagnostic、page/console error、清理失败与未完成原任务均为零。Canvas ordinary 保留一条 `willReadFrequently` console warning；它是读回提示，不是测得的性能结果。这些观察不识别物理 GPU 硬件，也不接受其它宿主或设备。

## 保留的失败与修复

源码审查的反例发现，展开后的放置代数掩盖了 assigned local rotation-sign 表达式。helper 现先显式构造 local `S`，再合成 `M * S`；聚焦行为及门禁已重跑，原失败继续保留。

初次公开会话/策略回归保留五项失败。修复后的场景正确识别 completed once controller 的 `isDisposed === true`，同时要求 Bitmap 仍存活并显示末帧。退役会检查清理 settle 后的真实 Scope diagnostic stream，即使 terminal getter 都为 true，也保留 Error 与 `undefined` 清理 cause。编译器 metadata 中小写的物理引用，在各已准入 role owner 内唯一绑定到原 authored logical source。相同套件随后通过 15/15，再扩展为最终 17/17。原失败证据保持完整；之后六次原生运行没有重试。

assigned copy 仅允许一个批准的 TypeScript 表达式及真实 emitted JavaScript 对应表达式不同。仅其对应 JavaScript source map 和 runtime `tsconfig.tsbuildinfo` 中一个已认证 source-version entry 可作为编译器派生差异；实际 raw hash、精确差异与 compiler receipt 全部保留。所有声明和 declaration map、其它代码/map、配置与 toolkit 字节必须相同。build metadata 不提供给浏览器。这不授权任意依赖 bookkeeping 变化或规范化 hash。

单独的既有 B1 验证器因固定 allowlist 缺少新增 placement 依赖，在启动浏览器前的依赖准入阶段停止，没有生成原生帧。原失败已保留，修复后的全新运行在此处仍待完成；它不属于上述已接受的六次图集运行。

## 复现检查

在仓库根目录使用记录的固定工具链：

```text
node tools/verify.mjs
node --test tests/atlas-frame-admission.test.mjs tests/atlas-frame-bitmap.test.mjs tests/atlas-frame-capture.test.mjs tests/atlas-frame-playback.test.mjs
node --test tests/atlas-frame-oracle-unit.test.mjs tests/atlas-frame-session.test.mjs tests/atlas-frame-native-source.test.mjs tests/atlas-frame-boundary.test.mjs
node tools/atlas-frame/boundary.mjs
```

两种 profile、三种 kind 的每个组合均制备新的私有目录；以下占位符替换为绝对路径：

```text
node tools/atlas-frame/prepare-native.mjs --repository <repository> --task-root <private-task-root> --destination <new-private-directory> --playwright-root <installed-playwright-1.62.1-directory> --profile <canvas-2d|webgpu-textured-2d> --kind <ordinary|rotation-sign|trim-y-constant>
node tools/verify-atlas-frame.mjs --config <returned-config-path> --config-sha256 <returned-raw-sha256> --snapshot-only
node tools/verify-atlas-frame.mjs --config <same-config-path> --config-sha256 <same-raw-sha256>
```

完整 snapshot 经独立审查后，才执行最后一条命令启动浏览器。私有配置、snapshot、compiler receipt 和 raw artifact 放在仓库之外。以下参考定义有限场景和比较域；已接受的六次运行执行的就是该协议。

## 独立像素与几何

固定第一方图集为 6×6 RGBA，背景为透明零。各命名颜色通道仅取 0 或 255，alpha 为 255。A packed 区域为 `(0,0,2,3)`，rotation 0，source 4×5，trim `(1,1)`；可见行是 `[red,green]`、`[blue,yellow]`、`[magenta,cyan]`。B packed 区域为 `(3,0,2,3)`，顺时针 90 度，source 4×5，trim `(1,2)`；packed 行是 `[yellow,red]`、`[magenta,green]`、`[cyan,blue]`，解包行必须是 `[red,green,blue]`、`[yellow,magenta,cyan]`。

A 时长 0.125 秒，B 时长 0.25 秒，clip 总时长 0.375 秒。两帧逻辑边界始终为 4×5，packed command 矩形均为 2×3。素材生成器及原始 RGBA/编码身份须为第一方且确定。oracle 须使用独立字面 mask，不导入产品 placement 或 sampling，不导入生成器，也不从实际 command 推导预期像素。

每个后端使用 24×16、DPR1 的透明 surface，不绘制文本：**每个完整帧为 384 pixels / 1536 channels，像素容差为零**。不能以抽样点替代这一比较域。parent Sprite 初始位置为 `(2,2)` 和 `(12,2)`，child Bitmap 位于 `(0,0)`。其余初始变换、anchor、clip、alpha 和 visibility 分别为 identity、零、无、1 和 true。两 actor 共用一个不可变 clip，但使用不同的精确 lease。left 始终为 `once`，right 始终为 `loop`。

两条已执行 profile 为：`canvas-2d` 使用公开 Engine、CanvasHost 和 `captureFrame`；`webgpu-textured-2d` 使用公开 Engine、WebGPUHost 和 `captureTexturedFrame`。后者覆盖 textured 2D，不包含 3D 或字体。每条使用独立新 context、默认 Edge 及 pin 的 Playwright/core 1.62.1，不增加 launch flags。须记录实际浏览器、Host 和 readback 环境身份；不能从一个后端推断另一个。

## Ordinary 序列参考

`advanceTime(0)` 建立源时间基线后，sheet 创建的 Bitmap 显示 A，两 controller 均为 idle 且没有 `lastSample`。表中 idle actor 的帧表示可见 Bitmap，而非 sample。A 的 index 为 0，B 为 1。此固定调度的 source 与 game time 相同。

| Case | capture 前操作；source/game time | Left once：state / elapsed / frame | Right loop：state / elapsed / frame |
| --- | --- | --- | --- |
| N01 | 保存真实不可变帧为 `savedN01`；0 | idle / 0 / A | idle / 0 / A |
| N02 | start left；advance 至 0.125 | running / 0.125 / B | idle / 0 / A |
| N03 | start right；不 advance，0.125 | running / 0.125 / B | running / 0 / A |
| N04 | pause left；不 advance，0.125 | paused / 0.125 / B | running / 0 / A |
| N05 | advance 至 0.1875，然后 resume left | running / 0.125 / B | running / 0.0625 / A |
| N06 | advance 至 0.4375；delta 0.25 等于默认上限 | completed / 0.375 / B | running / 0.3125 / B |
| N07 | advance 至 0.5 | completed / 0.375 / B | running / 0.375 / A |
| N08 | 在 0.5 将 left parent rotation 设为 90，两个 anchor offset 设为 1 | completed / 0.375 / B | running / 0.375 / A |
| N09 | 在 0.5 设置 left parent clip `(0,0,3,4)` | completed / 0.375 / B | running / 0.375 / A |
| N10 | 在 0.5 恢复 left parent rotation/anchor 为零，移除 clip | completed / 0.375 / B | running / 0.375 / A |
| N11 | 退役 origin 资源，仅通过 distinct Host replay `savedN01` | 无存活 handle 或新时间 | 无存活 handle 或新时间 |

只有 N02/N05/N06/N07 的四次 advance 产生 tick。start 和 resume 立即 apply，不产生 tick；N05 重新应用持有的 0.125，不要求保持 sample 对象身份。N06 后 left 保持 completed；N07 回绕的是原 right loop handle。N08/N09 不改变时间。

identity parent 下，A 起点为 left `(3,3)` / right `(13,3)`，行是 RG/BY/MC；B 起点为 left `(3,4)` / right `(13,4)`，行是 RGB/YMC。其余像素全部透明零。N08 理想 left image matrix 为 `(1,0,0,1,-1,2)`，画布内仅 x=0、y=2/3/4 显示 R/G/B。N09 的 clip 保持 parent matrix `(0,1,-1,0,3,1)`，去除 y=4 像素，留下 R/G。right A 不变。N10 恢复 left B/right A；N11 必须精确重放 N01 的两个 A。

N08/N09 的实际矩阵来自现有 sine/cosine display transform。须原样保存真实 command 和 clip 系数；六系数均须有限，并与理想字面值的绝对误差不大于 1e-12，不得将舍入值写回产品。packed 矩形、source 矩形、时间和 index 仍精确，完整 RGBA 比较仍为零容差。直接字面矩阵检查和 identity-parent assigned control 不沿用该三角函数容差。

N11 前，stop right，并真实 dispose 原 controllers、Bitmap、sheet、lease、Texture、Engine 和 Host，确认退役。distinct Host 只接收保存帧，不查询旧资源、不重新 sampling、不修改其 frame/matrix/image。这验证 origin 退役后不可变帧所有权，而非 device-loss 或通用图形恢复。

## Assigned control 参考

healthy 和 assigned control 是第一方验证器机制，并非引擎功能。每后端使用两个独立 control context。每个 control 均先需要自己的全新完整 healthy baseline，再需要独立封存的 assigned root；两者仅有一个批准的产品 source 表达式及其真实编译 JavaScript 对应表达式不同。声明、其它产品字节、fixture、图集、layout、oracle 和 actor/time 调度保持相同。

两种 control 均 capture left once/running/0.125/B 与 right loop/idle/0/A；source/game 为 0.125，parent 为原位置的 identity。健康 left image matrix 为 `(0,-1,1,0,3,6)`。

| Control | `packages/runtime/src/bitmapAtlasPlacement.ts` 中唯一源码变化 | 必需的 assigned 观察 |
| --- | --- | --- |
| C-sign | local clockwise90 `S` 中，将 `b: -1` 改为 `b: 1` | matrix `(0,1,1,0,3,6)`；left 在 `(3,6)` 为 YMC 行，在 `(3,7)` 为 RGB 行 |
| C-trim | `ty: layout.trimY + width` 中，仅将 `layout.trimY` 换为字面 `1` | matrix `(0,-1,1,0,3,5)`；left 在 `(3,3)` 为 RGB 行，在 `(3,4)` 为 YMC 行 |

每个 healthy page 先精确符合 B-at-0.125 完整字面 mask。关闭该 page 并等待清理 settle，再在同一 control context 的不同 assigned origin 打开新 page/document/module realm。通过固定 routes/import map 加载完整已接受 assigned 模块图，记录实际响应身份。仅磁盘 hash 不能证明 assigned module 已加载。不得修改已加载的 healthy module，不得增加运行时 bad-input flag、debug export 或修改 fixture。

assigned raw frame 必须既符合其完整字面 wrong mask，又与健康预期 mask 不同；right actor 和背景保持不变。保留实际 actor state、mode、elapsed time、packed source rectangle 及真实提交的 command matrix。setup/import/page 错误、缺少 B、浏览器/清理失败、场景改变或无法证明已加载 closure，均是验证尝试被拒绝，不算成功命中 control。关闭 page、Host、task、server 和 context；每个 root 的 before/after 均与其自己的已接受 snapshot 比较。

已接受运行实际执行 **6 个 contexts、30 次完整 readback**：每后端 ordinary 11 次，加 C-sign 2 次、C-trim 2 次，共 3 个 contexts。每次 readback 覆盖 1536 channels。实际源码 `ty: layout.trimY + width` 中的 `width` 是 packed crop 宽度，与契约几何中的 packed-width 项相同。

## Snapshot 与执行边界

`tools/verify-atlas-frame.mjs` 仅接受 `--config`、`--config-sha256` 及至多一次 `--snapshot-only`。必须拒绝未知、重复或缺失 flag，在严格 UTF-8/JSON 和 exact-own-key 检查之前认证配置原始字节，再检查声明的 owner 和 closure。封闭配置绑定 scenario profile/kind、root、output/snapshot 位置、fixture、oracle 及有序 healthy/assigned role，不提供任意脚本或场景函数。

snapshot-only 须生成新的完整 source/emission/declaration/configuration/toolchain/asset/oracle/served-closure snapshot，状态为 `SOURCE_ONLY_NO_BROWSER`。独立接受 snapshot 是 launch 前提。执行须使用同一配置原始字节/hash，在 launch 前及清理后将每个当前 closure 与已接受 snapshot 比较，并保留实际 raw output 和已加载响应身份。执行不得替换已接受 snapshot。control 表达式变化须先重新取得源码/协议接受才能使用。

最终完整本地门禁、公开内容/source-origin 与双语后继版本审查、实际 0.59 Git 交付和远端 CI 保持各自待完成分项。此有限协议不能证明 exporter 导入、多页、pivot/nine-slice 导入、seek/rate/events、动画资源原子替换、完整 Spine R020/V020、迁移 R008/V006、物理 GPU/移动端行为、内存、device-loss 或性能。此增量基于现有 Egret Engine runtime 独立实现。既有[来源记录](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json)和[致谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md)保留出处与适用声明。
