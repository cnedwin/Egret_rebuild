# 浏览器 PNG 证据与剩余验收 — BIP1

[English](../../en/docs/browser-png-evidence.md) | 简体中文

## 当前 0.46.0 公开材料截止点 — 2026-10-14

可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

下方保留章节记录原 2026-10-13 源码／文档截止点，其中 NOT_RUN 保留当时的历史范围；当前状态以本后继章节为准，行为契约与冻结的数值安排不变。

原始证据记录截止点：2026-10-13，位于修复后的策略整合获独立接受之后。本文记录有界源码及保存的实际执行证据。原生浏览器 PNG／绘制运行、完整仓库／prepush 门禁及本增量 GitHub 交付均为 NOT_RUN。参见[开发者契约](浏览器PNG纹理Provider契约.md)、[实施计划](浏览器PNG实施计划.md)及[固定原生计划](浏览器PNG原生验证计划.md)。

## 分别保留的已接受证据

| 证据 | 实际观察与接受范围 |
| --- | --- |
| 适配器／源码 | 可选门面／provider 与精确包映射经过独立评审；无新增运行时依赖。 |
| 终止退休回归 | 修复后 4/4 通过。后续 close getter 抛 undefined 或返回 handle 缺少 close 时，先前 close/cancel 仍是主因；未尝试退休的拒绝保留为独立隔离原因。 |
| 公开 CPU／冷导入 suite | 95/95 通过，范围含受控 ports、真实 manager 租约、同 image 的 Texture／图集／Bitmap／clock、生命周期和 cold API；不证明原生 decoder／绘制。 |
| 严格消费者采集 | 五条 stock TypeScript 7.0.2 通道：退出 0/1/1/0/1，完整诊断为 0/32/54/0/6。92 个负例 tuple 是诊断对象，不是引擎功能或浏览器测试数量。 |
| 公开类型门禁 | 独立重放已接受：精确 source/configuration/markers/完整 tuple、当前 stock／native compiler owner 与声明库。原生 executable 字节按本地平台测量；Windows 二进制哈希不是可移植要求。 |
| 包策略 | 新 17/17 用例：当前基线及 16 个全新自有副本对照、指定拒绝、精确逆操作和恢复基线。保留边界 suite 272/272，三个既有 core／图集／序列检查器退出 0。当前独立清单为 486 文件；序列 root values 保留为 38。 |
| 操作观察器 | 六项精确操作的 39/39 个受控 UNIT 用例已接受，含原结果／Promise 透明性、上限与 descriptor 恢复。受控模拟 UNIT owner 不是浏览器／PNG 证据。 |
| 原始 PNG 生成 | 两个第一方 2×1 文件，各 72 字节；以标准库 CRC／zlib 生成并独立核验。编码器自检不等于浏览器解码。 |
| 原生 PNG／绘制 | 日程获源码接受；采集器源码／闭包工作进行中；默认真实浏览器 Canvas/WebGPU 运行 NOT_RUN。 |
| 完整门禁与交付 | 本增量完整 publication/prepush/push-hook、推送／PR/Main 及远端 CI 接受均为 NOT_RUN。 |

各项结果保留各自输入、源码评审、原 command 回执、原始 stdout/stderr 及真实截止点。公开投影删去私有路径，不改写原始证据。源码介导的通过断言不能产生独立的逐对象、子进程或 OS 回收回执；这些 suite 和重放不合并计数。

资源链路使用原 asset ref 和 manager context；manager 保留租约／generation 所有权。Provider close 等待自己已准入工作与临时退休，保留已交付 Texture。既有捕获帧独立保留自有图像，不依赖后来 Texture／租约退休。上述公开 CPU 身份不证明 GPU 上传或真实浏览器像素保真。

## 保留的失败与精确修复

| 较早观察 | 修复与解释 |
| --- | --- |
| 首次 stock build 以 TS2345 拒绝 | 收窄已验证 callback 的捕获，使源码不依赖 type assertion 通过编译；门面／manifest 与快照／receiver 语义保留。编译失败不是功能行为 RED。 |
| BIP-PRODUCT-F01：四个回归失败 | 更早的 close/cancel 被后续退休 descriptor／shape 拒绝覆盖。修复保留先前 code/cause，继续捕获实际返回 handle，并隔离退休拒绝；后续实际 4/4 通过属于新的后继证据。 |
| Collector 预期负例退出 2 | Stock native compiler 实际返回 1。修改预期并使用全新输出，保留较早失败的源码／日志；完整 tuple 仍无 suppression 并独立核验。 |
| 新写诊断投影出现 CRLF | 保留尚未封存的新草稿，在源码封存前使用共享规范文本写入器编码，解析含义相同。原 compiler collection、stdout/stderr 及原始 SHA-256 身份不规范化。 |
| 策略检查器最初尚不存在 | 17 次精确 missing-module 加载失败，零功能策略检查或副本。这是声明的 loading RED，不是语义拒绝对照。 |
| 首次策略整合：1 通过、16 副本基线失败 | 当前仓库基线通过；每个副本在变体前遇到缺少 `tools/build.mjs`。两个复制清单也遗漏 `tools/generate-project-format.mjs`，这是源码评审确认的第二处遗漏，不是第二次实际失败。指定变体／逆操作执行数均为零。 |
| 修复后的副本策略基线 | 仅向两个完整复制清单补入这两个稳定工具，保留检查器规则、独立变体和逆操作。独立接受的后继提供上表 17/17 与保留策略结果。 |

失败产物及较早 PENDING／source-only 截止点继续保留为历史。后继成功在新截止点补充证据，不把较早失败重新标记为通过。

## 原生 oracle 依据与缺少的结果

| 输入 | 原始 SHA-256 | 逐行 RGBA8 字面值 |
| --- | --- | --- |
| rgb-red-green.png | 917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d | [255,0,0,255, 0,255,0,255] |
| rgba-red-transparent-black.png | b94f4bc3c8e745088406b8f87bd06c99c6bbc2cd2646b9948a4cab0b89084ab0 | [255,0,0,255, 0,0,0,0] |

两者均为原创 8 位 RGB/RGBA、无交错、无标签的 IHDR/IDAT/IEND 文件；字节与字面 oracle 先于 decoder 执行。CPU 中带占位 CRC／IDAT 的受控 framing 样例不能替代这些文件。

原生计划要求默认浏览器 ports、真实 `engine.assets` 租约、两个解码图像和每帧三个图像命令。Canvas 与 WebGPU 分别提交 N1/N2，并在源对象退休后重放精确保存的 N1。计划总数为 6 次提交、4 个捕获、2 次重放、192 像素／768 通道，容差 0；原生临时观察另要求 4 decode／4 bitmap-close／4 source readback／8 reset 尝试。这些是计划要求，尚无实际观察数量。检查全部透明外围；不透明红／绿和透明黑明确不用于断言任意半透明／隐藏 RGB 保真。

实现的 preflight 检查 PNG signature、有界 chunk framing／次序、准入 profile 与 CRC 存储位置，不核算 CRC、inflate 压缩内容或实现浏览器 codec。输出是浏览器归一化 straight sRGB RGBA8，不是作者 PNG 字节无损相等。即使原生通过，也只限定其实际浏览器／环境／样例，不覆盖全部 PNG 或设备／平台矩阵。

## 历史交付与后续更新

独立的仓库卫生 0.45.1 工作已通过 [PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) 交付，合入 Main commit `8fb5384a8517f20318ead797ce031c6a321a7b9e`。这属于[仓库卫生证据](仓库路径与换行验证记录.md)历史创作截止点之后的交付后继；原文 PENDING 字段保留，不代表本 PNG 增量已交付。

本 PNG 增量公开前，须在各自新截止点补充实际 collector／闭包／默认浏览器证据、独立结果评审、最终双语／source-origin 整理、完整本地 publication/prepush/hook 结果及真实 PR/Main 事实。原生缺口或 cleanup 失败仍是未完成；本文不分配未来 release／version／registry 身份。

鸣谢：[PNG 3，2025-06-24 Recommendation](https://www.w3.org/TR/2025/REC-png-3-20250624/)、[HTML ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap)、[Canvas 预乘 alpha 规则](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)与 [File API Blob 表示](https://w3c.github.io/FileAPI/#blob-section)。这些标准为 Egret 的独立实现提供依据；Blob 的草案状态和浏览器归一化不认证 codec 覆盖。完整 Spine R020/V020、迁移 R008/V006、完整 UI／3D、目标设备字体／耗电／性能及 Native SDK／平台覆盖在各自计划中保持 OPEN 或未验证。

## 0.46.0 原生准备与观察结果后继记录

源码确立的 R1 运行时上限问题，把 64 MiB 数据上限用于 92,825,416 字节的可执行文件。R2 分离 64 MiB 数据、每个运行时文件 256 MiB 与运行时合计 1 GiB 上限，并最多允许 4,096 个运行时指纹。修正已通过独立源码评审；R1 问题不是观察到的浏览器失败。采集器源码、采用／语法与输入准备已接受。准备图包含 375 个文件、107 个模块、113 份声明、113 份源文件及 1,492,342 字节；Canvas／WebGPU 声明 72/103 条模块路由。运行时准备包含 175 个文件及 116,779,934 字节。准备证明输入闭包与字节身份，不代表浏览器执行。

保存的浏览器执行结果为 PASS，浏览器为 155.0.4283.45：6 次提交含 4 次捕获与 2 次重放、6 次原始读回、192 个像素／768 个通道，容差 0；无主失败／清理失败／未决结果，上下文、浏览器及服务器已关闭。图与运行时身份稳定。请求总数 180：Canvas 请求 72/72 条声明模块路由；WebGPU 请求 96/103 条，另 7 条惰性路由未请求。当前后继截止点的独立保存原生结果核验已对该限定浏览器子集 ACCEPTED，完整仓库门禁与交付仍为 PENDING。声明路由不等于所有实际请求；此桌面运行不构成手机、物理 GPU、性能或能耗核验。

此前已完成交付：[PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) 将 0.45.1 合并到 Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`，树 `56e49e879d93fae351c948375e0ec12f21c739ab`。强制推送门禁分别通过 137/137 公开材料、2,909/2,909 核心及 160/160 实验测试，知识库问题为 0。此后继记录保留旧 PENDING 截止点，不宣称远端 CI 验收。

## 独立接受的原生结果后继记录

保存结果评审为 **PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY**，状态 **SAVED_NATIVE_SUBSET_ACCEPTED**，未关闭问题为 0。原始字节身份为 37111 字节／`34080f219a352d1713f93f511761c746f8adb9711c85e3d89472f3b83a58d728`；评审将原始 47 文件包与当前原始源码绑定对照。

Canvas 与 WebGPU 共记录 4 次原始解码调用、4 次返回的 ImageBitmap close、4 次源图像读回与 8 次返回的零尺寸重置，和 39/39 受控观察器 UNIT 用例分开。每个后端在 N1 前恢复描述符，两份 2×1 源图像均符合原始字面 RGBA 字节。每个后端的帧 id 为 1/2/1，时钟经过时间为 0/0.125/0.125、tick 为 0/1/1；关闭的原点时钟保留经过时间。WebGPU serial 为 1/2/1，重放使用不同宿主／设备。两个错误预期控制都在保存的 N2 的 (1,1)、通道 0 处拒绝，预期 255／实际 0，不增加提交或读回。

调用者生命周期断言依靠原始采集器／fixture 源码与保存的成功快照：真实共享 Texture 租约、SpriteSheet／Bitmap／SequenceClip、单次时钟推进、先退役原点 Engine 再关闭 Provider，以及在不同宿主重放 N1。这些是源码介导的断言，不是每对象密码学证明或物理内存回收证明。保存的端口报告安全关闭、无未决票据，自有 WebGPU 设备观察到 `destroyed` 丢失原因；上下文、浏览器和服务器已关闭。图的前后稳定与运行时稳定基于原始快照、原始源码断言及当前指纹文件对照获得接受，不存在伪造的运行时后置包或单独保存的 HTTP 响应体证明。

结果范围是已安装默认无头浏览器中两份素材的限定 Canvas／WebGPU 验证，不构成手机／小游戏／Native SDK、硬件身份、物理 OS／GC 回收、基准性能、能耗、文字／字体、全量 PNG／半透明／HDR／色彩管理或完整产品验收。完整 Spine R020/V020 与迁移 R008/V006 仍为 OPEN。当前完整门禁与 PNG 推送／PR／Main 仍为 PENDING。

<!-- BIP-TYPE-ISOLATION-R5-BEGIN -->
## 完整门禁失败与类型测试隔离后继记录 — 2026-10-14

当前首次完整推送前门禁退出 1。公开材料测试通过 137/137；核心测试通过 3,062/3,064，失败 2 项。失败为 `BIP_BOUNDARY_OWNER` 下的独立策略副本基线／恢复拒绝：“BIP-P missing canonical erased type” 在已到达指定语义断言之后的真实恢复基线失败；“BIP-P wrong existing facade forwarding” 在指定变更之前的全新真实基线失败。它们不代表两个已完成的语义变更控制。核心失败后，F2 源码、最终无头阶段与最终知识库阶段均 NOT_RUN。这是保留的失败尝试，与此前已接受的限定原生 PNG 浏览器结果分开。

独立源码诊断定位到一个既有工程测试：它在共享检出中运行真实类型检查器。检查器创建／删除生成的类型源码和配置，而其他测试进程要求完整 Git 清单保持不变。原完整运行的通用拒绝未保存失败当时的差异文件名快照，不能确定两次失败瞬间的具体差异文件。单独接受的 RED 使用原始且成功的选定测试复现了可见输入变化：通过 1 项／失败 0 项，50 次轮询保存 33 份变化的 NUL 清单，实际观察到 40 条生成路径，无基线名称被移除，最终 NUL 成员关系精确恢复。原始输入读回保持不变。采样并非穷尽观察，也不宣称源码内容被破坏。

独立源码修复将两个工程类型测试调用者移到同一套完整、自有的四包副本。它复制完整检查器、保留的 Sequence／SpriteSheet 类型门禁、原始消费者与配置、原版 TypeScript／原生编译器输入和自有包别名。检查器字节与诊断保持不变；未加入模拟、依赖安装、硬链接、检查策略弱化或全局串行化。源码声明的既有覆盖仍为 31 项工程测试，含 27 个变更控制、29 个纯类型导出，以及各要求 28 条诊断的错误代码／位置两个变体。这些源码声明不是实际通过声明。

当前修复截止点：源码、原始 RED、采用源码的字节读回、隔离 GREEN 与并发工程／策略控制已独立接受。当前完整推送前门禁重跑、最终公开材料门禁、推送／PR／Main 与远端 CI 仍为 PENDING。此前 0.46.0 证据／原生验收及原完整门禁的失败尝试保持保留。
<!-- BIP-TYPE-ISOLATION-R5-END -->

## 独立接受的隔离 GREEN 与并发控制

保存的修复执行集合包含 4 个命令，均退出 0 且无超时。选定的完整副本类型门禁通过 1 项测试，55 次轮询观察到 0 次原工程 Git 清单变化，并恢复完整的 1,486 名称 NUL 清单。单独的并发集合通过 48/48 项测试：31 项工程边界测试与 17 项 PNG 策略测试，无失败、取消、跳过或 TODO。工程错误代码／位置两个控制均保留 28 条真实编译器诊断。重叠运行属于不同证据范围，不合并计数。

原始前后源码清单对照 934 份原始包、类型、产物、稳定工具与配置文件，原始路径／大小／SHA 集合相等。当前已采用的 `tests/project-boundaries.test.mjs` 为 16,334 字节／`fb8484018a9399912662352498ab1bb5e2687cd34f8279c89a91948fa28800de`。这些原始保存结果已通过独立评审。轮询并非穷尽观察，自有副本的准备与清理通过原始源码／fixture 断言介导；不宣称存在独立的每副本完整文件回执、物理 OS 回收或新增原生浏览器运行。PNG 产品与此前限定原生证据保持不变。

修复后的并发集合只核验其命名范围，不替代新的完整推送前运行、此前未到达的最终 F2／无头／知识库阶段、已提交快照核验、强制执行的推送前钩子、PR／Main 交付或远端 CI。上述步骤仍为 PENDING。
