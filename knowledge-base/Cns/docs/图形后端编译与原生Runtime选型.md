# 图形后端 编译链路与原生 Runtime 选型

[English](../../en/docs/graphics-backends-and-native-runtime-selection.md) | 简体中文

版本：0.1 候选设计 · 所属知识库：0.6.1 · 更新：2026年10月8日。

新白鹭建议采用面向 WebGPU 的图形架构，同时维护 WebGL 兼容执行器；Canvas 主要提供文字与离屏内容，有限纯 2D 回退单独定义。开发语言继续采用 TypeScript，把快速预览、类型检查、资源构建和原生编译拆开。原生 Runtime 先建立可替换的图形、脚本与宿主接口，再按收益逐模块引入 Rust，保留 C++ 成熟依赖。桌面扩展与 GPU AI 通过可选能力接入，不要求每个作品携带全部模块。

目标是复杂 UI、2D 动画和轻量 3D 的完整作品体验、快速迭代及低加载成本。S033补充的历史编译时间属于历史经验；Rust、WebGPU 或新编译器的名称不能证明今天的性能收益。当前第三轮 17 项桌面 WebGL2 参考检查保持原范围，本轮选型研究不增加它的覆盖或通过数量。技术候选仍待对应产品与设备验收。

## 三种建设路径

| 路径 | 收益 | 代价与判断 |
| --- | --- | --- |
| WebGPU 独占，浏览器和原生统一进入 WASM 核 | 图形表达和资源管理容易围绕现代 API 组织 | 宿主覆盖、下载初始化、跨语言通信、调试与多端文字成本集中；本阶段不推荐全量采用。 |
| 以旧 WebGL 和 C++ 为中心，逐项加 WebGPU | 能延续现有经验和兼容路径 | 若公共材质、资源生命周期和帧合同仍绑旧 API，新能力持续变成分支补丁；可保留旧实现作对照，不能据此锁住新架构。 |
| 统一作品语义与能力合同，WebGPU/WebGL 双执行器，原生独立适配 | 能向新 GPU 能力发展，同时保持市场覆盖与按需包体 | 需要维护不同后端的语义、恢复和质量回归；建议采用这一候选主线。 |

## WebGPU 与 WebGL 的分工

WebGPU 是先进能力与未来优化的主线，WebGL 是需要持续维护的兼容路径。新设计以显式资源、管线和绑定布局、渲染 pass、异步设备初始化及丢失恢复为基础；按作品和宿主 profile 选择执行器。启动时检查真实 adapter/device、features、limits、纹理格式、surface 和代表性 shader 初始化，不能只检查 navigator.gpu 是否存在。

同一个主 surface 内，3D、UI、2D 骨骼和序列帧尽量由同一设备与帧调度器合成。WebGPU 模式的 UI 也由 WebGPU 绘制；WebGL 模式的 UI 由该 WebGL context 绘制。[HTML 标准](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-getcontext)明确不同 context 类型不能同时绑定一个 canvas。默认不安排 WebGPU 画 3D、WebGL 画 UI 后每帧跨 API 拷贝；多 surface、第三方视频或宿主强制合成作为明确的适配边界。

Canvas 可以在离屏 surface 上测量、绘制文字和部分矢量，变更时上传到选定 GPU 后端。原文、字体就绪、图集代次、分辨率、颜色空间和预乘 alpha 属于同一资源合同。缓存降低重绘与上传的目标仍需按实际文字负载测量；Canvas 不必然意味着软件执行，GPU 主画面也不会自动解决中文字体、IME 或换行。

WebGL 后端以 WebGL2 为目标；WebGL1 的有限 2D 兼容仅在目标宿主或旧工程样本确有需要时纳入。Canvas-only profile 只覆盖声明的 2D 功能，不能兜底完整 3D、任意滤镜或 GPU compute。必要效果无等价实现时导出阻断；可选质量降级写入作品 profile。后端在资源创建前选定，设备丢失先恢复原执行器；若需降级，通过可重建 CPU 来源和运行状态重新创建 surface/资源，不宣称零成本热切换。

[GPUWeb 当前实施状态](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)于2026年10月2日更新，主流浏览器已按 OS、GPU 和版本扩大正式支持；驱动黑名单、硬件加速、安全上下文及实际 adapter 仍有条件。微信官方 Canvas 类型声明和抖音小游戏渲染文档目前能确认的仍是 2D/WebGL 路径；检索没有取得它们的 WebGPU 保证，不据此断言绝对不能支持。Meta、Discord 和 Telegram 的 SDK/iframe/WebView 同样不能继承桌面浏览器的全部能力。详见[宿主与 GPU AI 研究](../../evidence/backend-host-ai-research.json)。

[Three.js 官方设计](https://threejs.org/manual/pages/webgpurenderer)已经采用 WebGPU 加 WebGL2 fallback，但其材质、后处理迁移需要改变，当前说明仍保留实验性和某些场景 WebGL 更好的边界。它支持方向判断，不能证明新白鹭已经完成双后端。WebGPU 版本不能直接照搬上一轮 WebGL resetState 适配：新的资源布局、pipeline cache、command encoder 与 device 恢复责任需重新验证。

## 底层合同与领先空间

公共 API 表达场景、UI 顺序、材质语义、资源引用、质量等级和玩法事件。后端可以拥有不同执行器和 shader 实现，不把 WebGL 的 bind/use 调用逐个包装成公共 RHI。内核接口以稳定句柄、资源描述、pass 和批量命令为单位；扩展能力不强制压到所有后端的最低共同集合。

只定义白鹭实际支持的材质语义子集与明确扩展；Three/Babylon 的任意材质、TSL 节点、后处理或私有对象不能自动转为原生 wgpu/Dawn 命令。成熟 renderer 的内部 shader/缓存由它拥有，共享设备、pass、资源导入与最终呈现需要其公开接口和固定版本验证；接口不允许时保留隔离或更换组件，不能宣称统一合同已经实现通用互操作。

建议固定以下职责：

- UI 与 2D 保持显示顺序，允许相邻兼容批次合并；复杂 UI 不转换成每节点一个 3D 对象。
- 3D 按深度、材质和透明语义组织，必要时使用 compute 批处理；轻量负载保留 CPU 路径，避免为了使用 GPU 而增加同步、上传和扫描。
- 资源区分 CPU 来源、解码、上传、驻留、使用完成与释放；deviceEpoch、resourceGeneration 和实例租约不能合并成一个布尔 ready。可重建来源不等于无限保留全部解码数据，应按预算保留压缩源、稳定 URI/哈希与生成参数；断网恢复需要离线可取得的来源或明确失败状态。
- 图形创建和提交有单一 owner；异步 pipeline 准备、上传预算、缓存、取消与恢复具有可诊断结果。WGSL/GLSL/HLSL/MSL 差异由成熟 shader 工具或选定组件承担，材质合同仍需各后端回归。
- 浏览器 2D 包使用宿主 JS 环境，不携带原生 VM；原生 2D 包仍须包含选定 VM 或使用已验证的宿主 VM。各 profile 去除无用 3D 和 AI 模型，增强后端按目标构建分包。优化要同时计入 CPU 准备、GPU 工作、带宽、内存、冷启动和首交互。

可形成优势的方向是 UI 稀疏更新、文字缓存、保序批次、按能力构建、异步准备和持续负载控制。WebGPU compute、render bundle 等只是可用工具，不是每个作品应默认开启的优化。领先幅度由等功能、等画质、相同设备上的作品对照决定。

## 编译与调试链路

新工程应锁定当前稳定 TypeScript 语义与工具版本，并把开发迭代拆成独立流水线：源码变更先快速转译与局部替换；后台增量类型检查输出对应工程版本的诊断；资源按内容哈希转换；发行阶段执行完整类型、能力、资源和目标构建检查。编辑器、CLI 与 Agent 使用同一配置和结构化诊断，不能由预览已显示推导发行可用。

截至2026年10月8日，[Microsoft 发布列表](https://github.com/microsoft/TypeScript/releases)与[发布包元数据](https://registry.npmjs.org/typescript/latest)均指向 TypeScript 7.0.2；Go 原生重写已于[7月8日正式发布](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)。建议锁此版本作为新项目 CLI/LSP 候选基线，不再把主线描述成 tsgo preview。这里的原生编译器是开发工具，游戏仍输出 JS，不会因为升级而变成原生机器码或直接提高运行帧率。官方公开工程全量构建约8–12倍的对比属于厂商测量，未在白鹭复测。

产物链是 TS 源码 → JS 与 source map → 浏览器或原生脚本 VM。Rust/C++ 核、shader 与资源分别编译/转换；VM cache/snapshot 按该 VM、版本、构建和架构产生，不代替原始可编辑工程。这些步骤的耗时分别记录。

TypeScript 7.0.2 已暴露 unstable 新接口，但没有可直接继承旧 Compiler API 的稳定兼容保证；旧分析、代码生成或编辑器插件可由独立 TS6 工具进程承接，不进入游戏包。7.1 API 稳定计划不能当已交付。Web 预览先评估已正式发布的[Vite8](https://vite.dev/blog/announcing-vite8)：Oxc 转译与 Rolldown 打包；[官方明确转译不进行类型检查](https://vite.dev/guide/features#typescript)。小游戏发布仍通过独立目标导出器，不假定 Vite dev server 可以直接移入所有宿主。

旧 namespace、ES5/AMD/System 等配置、const enum、legacy/标准装饰器与反射分别纳入迁移。Vite8/Oxc 对装饰器 metadata 的支持[存在推断边界](https://oxc.rs/docs/guide/usage/transformer/typescript)，不能用“支持”掩盖 Object 回退；需要精确旧语义时保留相应转换适配器或先使用兼容转译路径。新组件元数据优先显式 schema/注册，便于 Agent 修改和后端交换。完整版本与未知项见[编译工具链研究](../../evidence/backend-ts-research.json)。

性能指标分别记录冷启动、一次普通代码修改、场景修改、shader 修改、增量类型诊断、发布构建和 native build。旧项目编译小于 30 秒不能成为新工程单次交互预算；具体目标需在代表性样本和当前设备上设定。优先避免每次改动重扫或重构无关资源，随后才依据测量更换热点编译环节。

热更新需要区分资源、场景数据、模块代码、游戏状态及 GPU pipeline。状态采用显式 schema 和迁移，结构变更不安全时进行可预期的局部或完整重启；不能向 AI 创作者承诺任意代码变化都能保留全部运行状态。source map 把运行错误映射到原始 TS、场景对象与 Agent 修改事务；过期构建的错误不能混入当前工程诊断。

## Rust 与 C++ 的分工

Rust 适合新建的资源所有权、调度、命令校验和并发基础模块；C++ 可继续承担成熟图形、脚本、字体和平台依赖。两者都能产生高效机器码，Rust 的所有权检查有助于降低一类内存和并发错误，但不能证明同算法必然更快或耗电更低。FFI、GPU 句柄和外部生命周期仍需明确验证。

候选先建立窄 C ABI、版本化批量协议和明确的线程/缓冲所有权，避免 JavaScript 每个节点每个属性跨界。逻辑权威保留在 TS，原生树与 GPU 数据是可重建执行镜像；跨界必达事件使用独立身份和确认规则，不随图形恢复清空。WASM 只承接已测热点，并计入下载、编译初始化、复制与桥接；线程/SIMD 依宿主能力选用，不把全部浏览器版本自动拉入大 WASM 模块。

完整 Runtime 还包含脚本 VM、surface、输入/IME、字体、音频、网络/文件、生命周期与调试。更换 GPU 库或语言不能直接覆盖这些职责。SDK 嵌入现有 App 时，要定义宿主和白鹭各自的 device/surface、线程、资源同步及丢失恢复责任，避免两边同时拥有提交和回收。

浏览器 Canvas 文字提供者不直接存在于纯原生 Runtime。原生应通过独立文字 provider 包装成熟的系统文字或 Skia/HarfBuzz/FreeType 等候选，并逐项验证字体、塑形、fallback、IME 与缓存；共享原文/布局合同，不要求两端调用同一个 Canvas API。若是 WebView 包装则使用该容器的真实能力，不能与原生 SDK 加速混称。

## 原生图形与脚本 VM

图形接口按 D3D12、Vulkan、Metal 等现代后端留扩展空间；D3D11 的独立执行或现有宿主 device 接入单独评估。Steam 是分发与服务集成目标，桌面适配还需要窗口、输入/手柄、文件、生命周期、shader 分发与平台发布，不由图形 API 支持自动完成。

图形库先比较 Rust wgpu 与 C++ Dawn 的维护、后端能力和 SDK 接入成本，选择一个主要实现，保留接口替换能力；不同时维护多套完整 renderer。GL 兼容或 bgfx 可以作为特定需求对照，不能无限叠加所有抽象层。底层库的公开支持表、主线代码和已验收支持等级分别记录，未构建的代码不能标为白鹭支持。

[wgpu 官方后端表](https://github.com/gfx-rs/wgpu)列有 Vulkan、Metal、D3D12 和 GL，没有直接 D3D11。Dawn 当前主线已有[D3D11实现](https://github.com/google/dawn/tree/main/src/dawn/native/d3d11)与[借用 ID3D11Device 的接口](https://github.com/google/dawn/blob/main/include/dawn/native/D3D11Backend.h)，比部分 README/support 表更靠前；主线存在不证明某个 release 或白鹭构建已通过。若原生 SDK 需要接入现有 D3D11 App，Dawn 是重点对照；若现代后端与 Rust 管理是优先目标，wgpu 是优先候选。首先限定为可审查的对照范围，不预先承诺双库生产支持。GL 兼容、D3D11 接入和现代完整图形能力不是同一承诺。

本次官方 release/docs 核查的 Rust wgpu 为30.0.1，独立 C 绑定 wgpu-native release 为29.0.1.1；不能混用其头文件、库或假定两个项目同步升级。Dawn 主线观察与本次发现的 nightly release 分别记录，不把主线文件冒充该发布二进制。SDK 声明 owned/borrowed device 模式，核对 same-device 限制、外部资源导入、BeginAccess/EndAccess 或相应同步、resource state、fence、提交/释放顺序和关闭线程；这些是后端扩展，不能自动映射为浏览器标准 WebGPU 的共享能力。无法直接导入时明确复制/合成路径并计成本。

历史说明中的VM称谓由档案核对为V8。补充档案有多套 V8 头文件目录与 JSVM 适配路径；CMake 的默认条件选择 JSVM，同时还能看到无条件 V8 预编译库链接，实际生效的 VM 与二进制版本需构建核查。不能把最高版本目录当运行版本，更不能据此声称已升级或变快。私有条目证据保存在内部资料，公开候选只登记有限结论。

脚本 VM 是独立可替换模块。V8 适合重视现代 JS、开发工具和 JIT 能力的目标；轻量解释器可能节省包体和启动，但可能牺牲长期执行能力与生态兼容。JSC、Hermes 或宿主 JSVM 必须按实际系统、绑定、调试、许可和构建条件判断。更换 V8 版本还需回归绑定 API、ArrayBuffer 所有权、模块、GC 回调、Promise/任务队列、调试与 snapshot；不能把预编译 snapshot/bytecode 当跨 VM、架构或版本通用资产。

建议 Android/桌面先以维护中的 V8 作候选对照，鸿蒙按宿主 JSVM 接口核查；iOS 单独评估系统 JSC 或可允许的运行模式，不从桌面 JIT 配置推导商店可用。QuickJS/Hermes 留作明确包体/启动/内存或绑定需求的对照，不立刻新增全部 VM 的正式支持。需要锁实际依赖、构建参数、发布二进制和安全更新机制，性能与底包测试分别记录。详见[原生 Runtime 研究摘要](../../evidence/backend-native-research.json)。

## GPU AI 的接入空间

AI 首先放在创作和构建环节，用于从真实诊断提出资源压缩、LOD、纹理图集、shader 变体和缓存策略变更；修改必须复验行为、视觉和实际成本。每帧 LLM 调用不进入核心调度。

运行阶段把 3D 超分辨率、降噪及小模型推理设计为可选服务。3D 可以较低分辨率渲染，再重建至目标分辨率，最后绘制原生分辨率 UI；文字、点击命中和业务时钟保持独立。需要 motion vector、深度、历史帧的算法由相应 profile 提供并在切镜头、透明 VFX、动画与 UI 场景回归。轻量 3D 或 CPU 受限作品可能没有净收益。

WebGPU compute 不等于直接开放 Tensor Core/NPU，也不等于可调用 DLSS；GPU 推理和原生厂商 SDK 分开适配。评估实际节省的绘制工作与新增推理、内存和带宽成本，并检查画质、输入延迟、能源及模型许可。没有收益证据时默认关闭可选增强。

可以从[ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)的指定模型与执行提供者开始，而非自研推理内核；GPU/WebNN 的算子覆盖与 WASM 不同，后端失败需要明确退路。WebNN 是独立推理 API，不能从 WebGPU 可用推导 NPU 可用。原生 DLSS、FSR、XeSS 与 MetalFX 的硬件、驱动、API 和输入条件分别验收；例如[AMD 2026年6月正式发布的 FSR4.1.1](https://gpuopen.com/learn/amd-fsr-sdk-2-3-blog/)已扩展至 RX7000/9000 的指定条件，不能沿用2025年的 RX9000-only 条件，也不能把这一条件套给全部 FSR 功能。

[ORT WebGPU 默认 CPU tensor 路径](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)会产生上传与读回；GPU 输入输出绑定需显式设置。AI 提供者合同因此声明输入/输出位置、device、buffer owner、使用完成及释放规则；共享 GPUDevice 需在创建首个推理 session 前协商，资源不能从另一个 device 直接拿来。设备丢失取消相应作业并重建相关 session，不读取旧 epoch 结果；需要 CPU 退路时把复制与耗时计入预算。是否能与选定 renderer 共用 device 需公开接口和固定版本验证，不能预设零拷贝。

## 下一步可审查输出

维持现有 2D 骨骼金样、完整 3D 角色与复杂 UI 任务；补双后端能力/材质/恢复合同及 TS 开发流水线样本。原生先静态梳理依赖和 VM 构建权威，再形成 Rust/C++ 两个小范围成本对照与 SDK surface 接入说明。实际设备到位后才完成宿主与持续负载验收。

不为基础矩阵、插值、GLTF 解析、字体栅格或 shader 编译器另起从零实现。性能实验集中在白鹭新增适配、作品规模、跨界成本和差异化收益。R008/V006 一键迁移后的完整运行、继续编辑与真实发布始终保留，旧装饰器、TS 版本和资源语义属于迁移检查。

迁移清单还需覆盖旧 GLSL 自定义 shader、滤镜与后处理的坐标、颜色/预乘、mask 和组合顺序；成熟 WebGPU renderer 的自定义材质限制不会自动解决这些语义。转换、等价替换或不支持项均留下差异和固定视觉回归，不能删去必要效果后称完整迁移。

## 独立实现的选型约束

R015及[独立实现与第三方依赖规范](独立实现与第三方依赖规范.md)约束后续代码任务：WebGPU/WebGL执行、UI合成与资源合同依白鹭规格独立编写；wgpu/Dawn、VM、编译器、字体或转码器可作为显式公共依赖。Three/Babylon/PlayCanvas内部实现用于研究，不摘取后冒充核心；若库形式接入产品，须明确第三方归属和实际自写范围。既有17项参考结果不证明自主后端已完成。
