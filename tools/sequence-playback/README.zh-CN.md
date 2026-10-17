# 公开 SequencePlayback 不透明像素浏览器验证器

历史采集配置：下文 Node 24.19.0 指令保留此实验的原始协议，不是当前上手入口，也不证明 Node 26 兼容。请通过[当前指南](../../knowledge-base/Cns/docs/getting-started.md#贡献元数据与浏览器检查)和 tools/browser-tool-matrix.json 选择活跃套件。它们不替代本采集工具的比较范围；影响本范围的变更需要单独评审迁移。

[English](README.md) | 简体中文

这个第一方工具观察真实 Engine 时钟驱动公开实例方法 `engine.createSequencePlayback`，随后显式捕获、渲染并重放不可变帧。仅使用 `@egret/engine` 和所选 `/web` 或 `/webgpu` 公开宿主，不使用显式 player、私有 sampler、产品 stub 或手工 crop。既有 `tools/sequence-player` 结果保留历史边界，不能作为新控制器验收。

源码文件本身不表示浏览器运行通过。下列数量定义协议要求；具体尝试的结果以保存记录为准。

## 前提与运行入口

使用已评审的 Windows x64 环境：已安装 Node.js24.19.0、TypeScript7.0.2、Playwright及相邻 playwright-core1.62.1、正常安装的 Microsoft Edge、真实工作区依赖。安装参见[仓库说明](../../README.zh-CN.md)。工具不安装、不构建、不下载；独立执行方须构建当前源码、审查源码／构建记录，再冻结准入输入。

从工作区根目录：

```text
node tools/sequence-playback/collector.mjs --playwright "<已安装 playwright 包目录绝对路径>" --channel msedge --output "<新的输出目录绝对路径>" --admission "<已审查准入 JSON 绝对路径>"
```

三个路径均为绝对路径。输出父目录必须已存在，输出目录必须不存在并位于仓库和已安装 Playwright 根目录之外。每次尝试使用新目录，只接受这四个参数各一次。Edge 采用正常渠道默认无界面选项，无额外 flags、浏览器环境／配置目录覆写。实际版本、OS和 adapter 信息归属具体尝试，不代表所有设备合格。

## 只读准入契约

Pins 为普通 `{path,bytes,sha256}`，长度为非负安全整数，哈希为小写 SHA256。产品／源码／产物／配置数组保留记录的根目录相对、正斜杠逻辑路径；authority／runtime pins 使用绝对路径，七个编译器 owner 条目保留记录的绝对路径拼写。逻辑与物理身份仅通过下述固定归属映射关联，不把两种路径文本视为相同。这是保存身份核对，不是签名、安全认证或 CI 授权。准入必须独立审查，工具不创建输入，也不把作者升级为独立评审。

| 字段 | 必需含义 |
| --- | --- |
| `schemaVersion` | `sequence-playback-native-admission/1` |
| `status` | `ROOT_FROZEN_REVIEWED_CURRENT_BUILD` |
| `repositoryRoot` | 绝对路径，其 realpath 等于实际工具工作区 |
| `sourceBase` | 已记录 `head/tree`，各40字符小写 Git SHA；工具不运行 Git 核验 |
| `productSourcePins` | 下列四路径，与完整源码清单及产品评审一致 |
| `sdkSourcePins` | 四个 SDK `src` 和 Engine `web/rendering` 下完整当前 `.ts` 清单 |
| `sdkEmittedPins` | 四个 SDK `dist` 下完整 `.js/.d.ts` 清单，不含 maps 或实验输出 |
| `configurationPins` | 下列精确配置集合 |
| `compilerOwnerPins` | 精确七个保存条目：已绑定的外部 Node 文件、四个 TypeScript 包／launcher 文件、两个 native platform 包／可执行文件 |
| `runtimePin` | 保存构建与 collector 共用的实际 Node 文件 |
| `reviews.plan` | `{pin}` 已接受评审，numeric `openFindings:0`，verdict以 `PASS` 开头 |
| `reviews.product` | `{pin,sourcePinsPointer}` 已接受源码评审，显式 JSON pointer 指向四个普通逻辑／绝对 pins |
| `reviews.build` | `{pin,receiptPinPointer,inventoryPinPointer}` 独立 `PASS_ACTUAL` 构建评审、numeric open0、指向精确 receipt/inventory pins |
| `build` | `{receiptPin,jobPin,inventoryPin,commandName,stdoutPin,stderrPin}` 真实保存的 actor/job/清单／原始日志 |

产品路径：`packages/engine/src/sequencePlaybackTypes.ts`、`sequencePlayback.ts`、`Engine.ts`、`index.ts`。精确二十个配置路径：根 `package.json/pnpm-lock.yaml/pnpm-workspace.yaml/tsconfig.json/tsconfig.base.json`，`tools/build.mjs`、`tools/generate-project-format.mjs`、`packages/contracts/schema/project-format.schema.json`，四个 SDK 的包清单和 `tsconfig.json`，Engine `tsconfig.rendering.json/tsconfig.web.json`，以及逻辑路径 `node_modules/typescript/bin/tsc` 与 `node_modules/typescript/package.json`。

两个编译器配置路径和四个 TypeScript owner 条目（`package.json`、`bin/tsc`、`lib/tsc.js`、`lib/getExePath.js`）通过真实 `node_modules/typescript` Junction 解析到 `node_modules/.pnpm/typescript@7.0.2/node_modules/typescript`。精确平台 owner 是 `node_modules/.pnpm/@typescript+typescript-win32-x64@7.0.2/node_modules/@typescript/typescript-win32-x64`；TypeScript 包相邻的平台 Junction 必须指向这里，并核对 `package.json` 和 `lib/tsc.exe` pins。包名／版本、launcher 元数据、Windows/x64 元数据必须一致。只有已核对的保存构建／collector Node 文件允许位于工作区外；没有通用 alias 或外部文件授权。保存原条目不变，分别对指定物理 owner 核对字节／哈希。

浏览器启动前，`compiler-owner-before.json` 和 `admission-binding.json` 记录四条固定目录关系（两个逻辑 alias 及各自物理 owner 的自映射），以及六个指定逻辑文件路径的期望／观测物理 pins。两个逻辑编译器配置文件包含在这六个路径中。Fixture／context／browser／回环服务退役后，collector 重新解析同样四条目录关系和六条文件关系，写入 `compiler-owner-after.json`，再要求端点及字节／哈希身份不变，之后才能标记 `identitiesStable` 或任何 `PASS` 状态。关系缺失、变化、读取失败或未观察均为 `INCOMPLETE`，即使原物理文件哈希仍然相同。这是固定 owner 读回检查，不是通用 resolver 或 OS 物理进程退役证明。

`build.inventoryPin` 指向保存对象，schema为 `sequence-playback-sdk-build-inventory/1`、status为 `ROOT_FROZEN_ACTUAL_SDK_BUILD_INVENTORY`，显式 `repositoryRoot` 与实际工作区一致。其嵌套 `build` 含精确 `receiptPin/jobPin/stdoutPin/stderrPin/runtimePin`。五个记录数组 `productSourcePins/sdkSourcePins/sdkEmittedPins/configurationPins/compilerOwnerPins` 必须与准入保留相同路径／字节／哈希集合，再通过固定的逻辑到物理身份检查。该关联须独立接受，不能仅用任意当前哈希填写。

Receipt 为 literal ARRAY，唯一 `build.commandName` 条目须 exit0、timeoutfalse、参数 `["tools/build.mjs"]`、真实时间戳及匹配的原始日志路径／哈希。`job.commands` 同名条目使用实际工作区 cwd、当前 Node 和相同参数。缺 owner、漂移、评审未合格、缺 declaration 或 graph 语法不支持均在浏览器启动前拒绝，不预测未来哈希／数量。

Graph 将真实包声明根／imports和真实基础依赖映射到回环路由。逐字复用的有限词法读取器没有通用 resolver、求值或远程回退。每个所选第一方 source/JS/declaration 与保存构建清单绑定；前后身份包含工具、配置、已安装运行时／依赖和保存 authority。

## 固定字面观察

每个新 Canvas/WebGPU realm 拥有一个6×2不透明 atlas、Texture、manager签发 lease，以及位于 `(1,1)` 的 Bitmap。红2×2、绿1×2、蓝3×1时长为 `.125/.25/.125`。资源、播放和 observer Scope 分离；clock ceiling `.5`、source baseline0。

| 提交 | 公开操作 | 预期状态／局部 elapsed | Crop |
| --- | --- | --- | --- |
| once-start | start once | running /0 | 红 |
| once-end | source .5 | completed /.5 | 蓝 |
| loop-start | 同 target 创建并 start loop | running /0 | 红 |
| loop-cross | source1 | running /.5 | 红 |
| loop-green | source1.125 | running /.625 | 绿 |
| paused-gap | pause后source1.625 | paused /.625 | 绿 |
| resumed-held | resume，不advance | running /.625 | 绿 |
| resumed-blue | source1.875 | running /.875 | 蓝 |
| saved-red | 调用方资源／Engine关闭，另一host replay | 原缓存terminal记录 | 红 |

Capture/render/equal-source保留 clock/sample 观察。真实拥有的 observer 记录五个字面 tick 和公开 subscription 退役，不编造内部 handler 数量。Playback Scope关闭后 Bitmap／Texture／精确 lease仍有效，provider-disposal0；随后调用方清空／release资源、关闭 Engine／clock／Scopes、provider处置一次。缓存 samples和保存真实image/frame不变。Replay使用另一无asset兼容host；WebGPU使用另行取得、身份不同的device，关闭后不capture/resample。

每后端九次提交含八次新capture和一次replay，完整性目标18次、576像素、2304原始色彩通道比对，不代表实际成功。[独立 oracle](oracle.mjs)固定8×4 DPR1全部像素，含透明外围，容差0。每份完整128字节RGBA比对前保存，并记录 source/destination/matrix、image身份、frame IDs1–8/replay1及宿主serials。不只用截图，不从观测字节拟合期望。

## 原生清理与边界

Render前requestReadback，等待前注册 `whenIdle`，再一起await。记录startup/loss/uncaptured GPU errors、页面／网络故障、完整warning分类、未完成工作与迟到归属。仅[console-policy.mjs](console-policy.mjs)中逐字继承的精确Canvas readback建议为advisory，保存 `performanceEvidence:false`；其余warning/error均fatal，不形成性能结论。

先settle acquisition/ticket，再安全关闭host，随后才destroy被host借用、由collector拥有的device，观察destroyed loss。不安全或超时未settle则quarantine并为 `INCOMPLETE`。Fixture/context/browser/回环server必须关闭，所选身份不变。保留每操作20,000ms、collection240,000、cleanup280,000、hard295,000、外层至多300,000ms watchdog及继承的事件／文件／字节上限。

独立外部Windows Job owner须保存完整stdout/stderr与EOF、assignment、active-zero/Job closure和进程退役证据。Collector/browser close不证明OS物理进程退役；保存结果须独立复核。

`result.json`为 `PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET`、`FAIL_SEQUENCE_PLAYBACK_OPAQUE_SUBSET` 或 `INCOMPLETE`，exit0/1/2。Raw submission数量含replay，只对应记录的当前构建和实际环境。Capacity、受控故障、alpha blending／插值、其它浏览器／手机、物理显示、硬件加速、性能、完整MovieClip/Spine和迁移另行验证。
