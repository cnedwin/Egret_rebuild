# 浏览器 PNG 原生验证计划

[English](../../en/docs/browser-png-native-plan.md) | 简体中文

## 当前 0.46.0 公开材料截止点 — 2026-10-14

可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

下方保留章节记录原 2026-10-13 源码／文档截止点，其中 NOT_RUN 保留当时的历史范围；当前状态以本后继章节为准，行为契约与冻结的数值安排不变。

原始原生计划记录，日期为 2026-10-13。日程已获独立源码接受；六操作观察器的源码及 39/39 个受控 UNIT 结果已获独立接受，不能当作真实浏览器结果。产品 CPU／冷导入与严格类型证据已接受，当前策略对照已获独立实际接受，原生采集器正在准备源码。原生浏览器运行、完整仓库及交付门禁均为 NOT_RUN。下列原生数量是验收要求，不是已观察的通过结果。参见[契约](浏览器PNG纹理Provider契约.md)、[实施计划](浏览器PNG实施计划.md)及[证据](浏览器PNG验证证据.md)。

## 原创输入与输出权威

复用已独立接受的原创编码文件，不重新生成或修改：

| 文件 | 字节数 | 原始 SHA-256 | 尺寸 | 字面解码 RGBA 预期 |
| --- | ---: | --- | --- | --- |
| rgb-red-green.png | 72 | 917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d | 2×1 | [255,0,0,255, 0,255,0,255] |
| rgba-red-transparent-black.png | 72 | b94f4bc3c8e745088406b8f87bd06c99c6bbc2cd2646b9948a4cab0b89084ab0 | 2×1 | [255,0,0,255, 0,0,0,0] |

两者均为原创 8 位、无交错、无颜色标签的 IHDR/IDAT/IEND 文件。已接受的生成使用 Python 标准库 CRC／zlib，并包含编码器自检关系；生成不等于浏览器解码。保留原生成器、生成记录和实际独立评审指纹，以及两份字面 8 通道 oracle。CPU 受控端口使用的占位 CRC／IDAT 结构样例不能作为原生 PNG 输入。

下方行表及封存日程数据中的原创完整帧掩码是预期像素，不得从已渲染帧、产品解码器、图像采样器或截图反推。掩码使用透明黑 T=[0,0,0,0]、红 R=[255,0,0,255] 和绿 G=[0,255,0,255]。Canvas 直通 RGBA 与 WebGPU 预乘 RGBA 在该不透明／透明黑子集相等，不能据此证明任意半透明、隐藏 RGB、HDR、颜色配置或全部 PNG 的保真度。

## 每个后端仅使用真实资源链路

一次默认 headless msedge 启动，先 Canvas 后 WebGPU，各自使用全新 context。复用已准入的现有浏览器／Playwright／Node 所有者，不增加启动 flags、浏览器环境覆盖、安装或依赖。deviceScaleFactor 与宿主 pixelRatio 均为 1，viewport 为 800×650，Canvas backing 和 CSS 均精确为 8×4。记录实际浏览器版本及可用 adapter 信息，不在此预报。WebGPU 不可用时明确保留未完成／不可用阶段，不能静默回退 Canvas 或记作跳过后的 PASS。

只导入构建后的公开 `@egret/engine`、`@egret/engine/web/image` 和所选公开宿主入口 `@egret/engine/web` 或 `@egret/engine/webgpu`。构造 `createBrowserTextureProvider({ readBytes })` 时**不传 ports**。真实 reader 只 fetch 两个准入的同源 PNG 路由并返回实际 native response 字节，记录原 ref／receiver／冻结的 manager context 与精确获取字节。禁止伪造 context、直接调用 provider.load、用 oracle 重建 Texture 或增加 provider 缓存。

创建真实 Engine，向该 provider 注册一个原创资源类型。通过 engine.assets 获取 RGB 两次，验证同一条目与不同租约，释放第一租约，将第二租约交给 resource Scope；获取 RGBA 一次并将租约交给同一 Scope。要求 reader／原生 decode 各调用两次，返回两个真实 Texture，并核对公开 ImageData2D 像素副本。provider 在内部使用既有 API 创建自有图像及 Texture；采集器不得以 createTexture／createImageData2D 代替 PNG 解码。

RGB SpriteSheet 区域为 red=(0,0,1,1)、green=(1,0,1,1)；actor 和静态 green icon 借用同一 RGB 租约，位置分别为 (1,1)、(2,1)。RGBA 图集区域 pair=(0,0,2,1)，其 Bitmap 放在 (4,1)。这是三个按绘制顺序排列的图像命令与两个原图，保留精确租约／图像身份、自然尺寸和源裁剪。

使用既有 RGB SequenceClip，red／green 持续时间为 0.125／0.125 秒；在独立 animation Scope 创建真实 Engine once playback。先以 advanceTime(0) 初始化，再 start，之后只按下方字面源时间推进。Scope、采样和 invalidate generation 语义仍属于独立接受的 CPU 阶段；原生阶段增加真实解码图像／绘制／保留帧链路，不另写播放器或 manager 算法。

## 固定绘制与读回步骤

| 每后端步骤 | 操作 | y=1、x=0…7 的预期行 |
| --- | --- | --- |
| N1 | 时间初始化为 0 并 start 后捕获并提交红样本，保留这个精确帧 | T R G T R T T T |
| N2 | advanceTime(0.125)，捕获并提交绿样本 | T G G T R T T T |
| N3 | 源 Engine 与 provider 退出后，向同后端全新宿主／Engine 提交原 N1 帧 | T R G T R T T T |

y=0,2,3 全部为 T。每个捕获帧指定 width=8、height=4、clearColor=0、clearAlpha=0；整数坐标以 1:1 采样，不缩放、旋转或使用小数变换。像素容差精确为 0，包含 alpha 和全部透明外围。

主步骤要求：**6 次提交 = 4 个新捕获 + 2 次保存帧重放**；每次 **32 像素／128 通道**，共比较 **192 像素／768 通道**。每次提交有 **3 个自研图像命令**，不能当作 GPU 批处理 draw call 数。每个源 Engine 精确有 **1 次推进 tick**；捕获、绘制、读回和重放不能推进原时钟或替换保留样本。不预设 frame ID 或 GPU serial，N3 绑定实际原 N1 的帧身份并记录真实 native ID。

Canvas 通过真实宿主提交，每步读取一份完整 native getImageData 缓冲。WebGPU 每步在 renderFrame 前申请一张 readback ticket，之后等待该 ticket 和 whenIdle，保留规范 RGBA 字节及实际格式／alpha 元数据。无须截图解码器、额外渲染帧或只检查部分像素的通过路径。

每个后端的正例比较完成后，将 N1 掩码应用于已经保存的 N2 缓冲，要求在 (1,1) 拒绝像素比较。这是 **2 项独立错误 oracle 分类对照**，增加 **0 次提交／读回**；它验证比较路径，不是产品变体。

每后端两个交付 ImageData2D 副本分别与各自 8 通道源 oracle 比较；源对象退出后，再检查保存帧中原来两个图像的身份及字节。这些重复源图像检查与 768 个渲染通道比较分别记录。

## 原生操作账本及限定权限

主原生链路必须观察实际 Blob／createImageBitmap／readback 和瞬时对象退出，不注入 decode／createCanvas ports。已独立评审的观察单元限定为六项操作；39 个已接受 UNIT 用例只验证受控所有者上的转发／恢复。真实采集器仍需自己的源码／闭包评审及已完成的策略核验，不产生通用 patch 或私有导入权限。

有界观察器只可临时观察隔离同窗口源页面中的以下操作：window.createImageBitmap、ImageBitmap.prototype.close、document.createElement、HTMLCanvasElement.prototype 的 width／height setter，以及 CanvasRenderingContext2D.prototype.getImageData。先捕获准确 owner、ownness、完整 descriptor 和原方法；在源宿主／Engine 启动之后、默认 provider 构造之前安装。安装期间不绘制、不创建重放宿主，只跟踪此阶段返回的真实原生 ImageBitmap 和新建、未挂载的 source Canvas。

每个封装都必须以原 receiver／参数精确调用捕获的原操作一次，返回同一结果或抛出同一发生值，包括 undefined。decode 观察器原样返回 native Promise，只附加立即处理拒绝的观察，不替换 Promise。不得改变 Blob、decode options、像素、尺寸或 native 归属。trace 记录失败必须保留 native 操作发生值，并使 probe 独立失败；复制的元数据取自原始 native 输出，不使用替身对象。

每后端主阶段要求观察 **2 次原生 Blob／decode**、**2 次成功的原生 bitmap close**、**2 个 source Canvas／readback** 和 **4 次零尺寸 reset 尝试**（每 Canvas 先 width 后 height），最终真实尺寸为 0×0。记录各 Blob 的 native size／type 与精确 PNG 字节、冻结 decode options、native 源尺寸和原 8 通道 readback。两个后端合计分别为 **4／4／4／8**，与宿主读回分别记录，保留已处理的 observer ticket 和完整成功／拒绝记录。

两个原获取完成并退出瞬时对象后，恢复每份完整 descriptor，或仅移除自己建立的临时 shadow；N1 之前核对原操作／descriptor 身份。部分安装或早期失败也须逆序恢复全部已修改 descriptor，同时保留原 primary 和 cleanup 发生值。另行创作的源码权限／单元测试须验证 native 转发、原 Promise 身份、primary undefined、部分安装恢复和恢复后的干净基线；已接受的 39 个 UNIT 用例属于观察器独立证据，不计入原生 decode／render 数量。缺少准入或原生观察时仍保留 PENDING，显式 ports 不能替代默认路径。

## 采集器依赖闭包与原始证据

actor 前冻结原创 collector／fixture／oracle 单元及精确源码权限。经由公开入口封存各后端完整字面构建导入闭包，包含实际 package-export alias、源对应项及原始源码／JavaScript／声明／配置身份。本计划不接受或冻结已实现 image 入口及最终闭包；准入须绑定实际独立接受的源码与构建输出。包内实现依赖只能沿已评审公开闭包出现，fixture 本身不得导入私有产品文件。

loopback GET 路由／Host 只提供封存模块字节、两个固定 PNG、精确入口 HTML 和固定空 favicon。reader 需要同源 fetch，因此新 HTML policy 使用 connect-src 'self'，不能复用旧 SpriteSheet collector 的 connect-src 'none'。拒绝未选方法、路径、query／alias／traversal 变体、重定向和响应字节漂移，记录模块／PNG 请求及响应哈希。逻辑／物理归属和原始指纹采用已接受的共享 file-identity helper，不沿用旧有忽略平台的全局小写／文件名拼接方案。

准入须绑定当前实现、API RED、公共 CPU／生命周期／资源、严格消费者、策略、操作单元和 collector 源码评审，以及实际当前构建、workspace／已安装工具所有者。记录前后精确身份及声明／实际模块和 PNG 路由清单，不虚构闭包大小、环境版本或当前 Git 身份。

浏览器启动前保存字面原创步骤／oracle，保留全部 **6 个完整 128 字节渲染缓冲**、每个输入 PNG、所有 native source-image 的 8 字节输出、模块图、原生操作账本、运行元数据、错误和清理结果。保存原 command job、字面 ARRAY 回执及完整原始 stdout／stderr。哈希覆盖原始产物字节，不规范化 EOL／BOM／Unicode；公开投影删去私有路径，同时保留原身份及失败截止点。

采集器不构建、不安装、不调用生成器；只读取现有已评审输入，在 checkout 外使用全新输出。help／source／admission 检查不启动 SDK、浏览器或 GPU。计划每操作超时 20,000 ms，operation deadline 为开始后 180,000 ms，cleanup deadline 为 220,000 ms，外层 containment 为 240,000 ms。超时、trace 溢出或 EOF 不完整属于 INCOMPLETE，不能记作成功退出。

## 调用方退出及验收边界

立即登记每个实际 fulfilled 的租约／Engine／device／readback ticket，避免前面的断言跳过后续归属清理。primary 发生与其值分别记录，聚合全部 secondary cleanup 发生值。等待原 startup／readback／observer ticket；超时竞速不能使原工作完成。

N2 之后先关闭源 Engine（含 Scopes／租约／Bitmaps／host），再单独等待 provider.close。确认 Texture 退出和已退出租约不可读，同时保存帧的原 owned image 仍可读取且字节相同。manager／Engine 不拥有 provider.close；provider.close 保留仍已交付租约以及新旧 invalidate generation 的语义明确留在另行实际 CPU 证据中，不推定原生重复验证。

借用 WebGPU device 仍归应用：安全 host 返回且 ticket 完成后，仅 destroy 自己获取的 device 并观察 loss reason。重开全新 replay host／Engine，WebGPU 使用自己的新 device，提交 N3 后按同一归属顺序退出。原生 Canvas／bitmap 关闭、browser／server／context 关闭及外层进程所有权事实各自保留实际范围。quarantine 或未完成工作阻止 PASS，逻辑关闭不能证明实体内存／GC／OS 回收。

原生验收结论之前必须独立审查源码与保存结果，之后另行完成完整仓库和交付门禁。该桌面样例不能证明手机／小游戏／Native SDK／Steam 平台矩阵、实体 GPU 身份、能耗／性能、中文字体、完整 PNG／3D／UI／Spine R020/V020 或迁移 R008/V006。本计划不分配未来版本、registry ID 或发布状态。

## 公开原始资产与采集器接口

仓库提供 `tools/browser-png/assets/rgb-red-green.png`、`tools/browser-png/assets/rgba-red-transparent-black.png` 及其`tools/browser-png/assets/provenance.json`。两份 PNG 都是上表中已独立核验的原始素材字节的精确 72 字节副本。第一方来源记录保留原始输入身份与字面像素预期，不重新生成素材，也不打包编解码器。

显式采集器接口为 `node tools/verify-browser-png.mjs --admission <absolute-reviewed-admission.json> --output <fresh-absolute-output-directory>`。两个参数均为绝对路径；输出为已准入输出所有者内、检出目录之外的全新直接子目录。准入 JSON 使用 `schemaVersion: 1` 与 `status: BIP1_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED`，包含 `sourceFilesRoot`、`outputOwner`、原始 `graphPin`、`graphInputs`、`reviewPins`、`proofBindings` 与 `runtime`。评审角色为 plan、productSource、observerSource、collectorSource、missingEntryRed、cpu、build、strictTypes、policy、observerUnits 和 fixtures。运行时输入包含原始指纹及显式 nodeExecutable、playwrightEntry、edgeExecutable 身份。完整绝对所有者使用共享物理路径比较，逻辑图路径与原始字节指纹保持精确。字段来自已评审准入，不从文件名猜测，也不写入旧回执。

源码确立的 R1 运行时上限问题，把 64 MiB 数据上限用于 92,825,416 字节的可执行文件。R2 分离 64 MiB 数据、每个运行时文件 256 MiB 与运行时合计 1 GiB 上限，并最多允许 4,096 个运行时指纹。修正已通过独立源码评审；R1 问题不是观察到的浏览器失败。采集器源码、采用／语法与输入准备已接受。准备图包含 375 个文件、107 个模块、113 份声明、113 份源文件及 1,492,342 字节；Canvas／WebGPU 声明 72/103 条模块路由。运行时准备包含 175 个文件及 116,779,934 字节。准备证明输入闭包与字节身份，不代表浏览器执行。

保存的浏览器执行结果为 PASS，浏览器为 155.0.4283.45：6 次提交含 4 次捕获与 2 次重放、6 次原始读回、192 个像素／768 个通道，容差 0；无主失败／清理失败／未决结果，上下文、浏览器及服务器已关闭。图与运行时身份稳定。请求总数 180：Canvas 请求 72/72 条声明模块路由；WebGPU 请求 96/103 条，另 7 条惰性路由未请求。当前后继截止点的独立保存原生结果核验已对该限定浏览器子集 ACCEPTED，完整仓库门禁与交付仍为 PENDING。声明路由不等于所有实际请求；此桌面运行不构成手机、物理 GPU、性能或能耗核验。

## 独立接受的原生结果后继记录

保存结果评审为 **PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY**，状态 **SAVED_NATIVE_SUBSET_ACCEPTED**，未关闭问题为 0。原始字节身份为 37111 字节／`34080f219a352d1713f93f511761c746f8adb9711c85e3d89472f3b83a58d728`；评审将原始 47 文件包与当前原始源码绑定对照。

Canvas 与 WebGPU 共记录 4 次原始解码调用、4 次返回的 ImageBitmap close、4 次源图像读回与 8 次返回的零尺寸重置，和 39/39 受控观察器 UNIT 用例分开。每个后端在 N1 前恢复描述符，两份 2×1 源图像均符合原始字面 RGBA 字节。每个后端的帧 id 为 1/2/1，时钟经过时间为 0/0.125/0.125、tick 为 0/1/1；关闭的原点时钟保留经过时间。WebGPU serial 为 1/2/1，重放使用不同宿主／设备。两个错误预期控制都在保存的 N2 的 (1,1)、通道 0 处拒绝，预期 255／实际 0，不增加提交或读回。

调用者生命周期断言依靠原始采集器／fixture 源码与保存的成功快照：真实共享 Texture 租约、SpriteSheet／Bitmap／SequenceClip、单次时钟推进、先退役原点 Engine 再关闭 Provider，以及在不同宿主重放 N1。这些是源码介导的断言，不是每对象密码学证明或物理内存回收证明。保存的端口报告安全关闭、无未决票据，自有 WebGPU 设备观察到 `destroyed` 丢失原因；上下文、浏览器和服务器已关闭。图的前后稳定与运行时稳定基于原始快照、原始源码断言及当前指纹文件对照获得接受，不存在伪造的运行时后置包或单独保存的 HTTP 响应体证明。

结果范围是已安装默认无头浏览器中两份素材的限定 Canvas／WebGPU 验证，不构成手机／小游戏／Native SDK、硬件身份、物理 OS／GC 回收、基准性能、能耗、文字／字体、全量 PNG／半透明／HDR／色彩管理或完整产品验收。完整 Spine R020/V020 与迁移 R008/V006 仍为 OPEN。当前完整门禁与 PNG 推送／PR／Main 仍为 PENDING。
